//! Windows implementation of the platform integrations.
#![allow(unsafe_code)]

use std::cell::RefCell;
use std::ffi::c_void;
use std::rc::Rc;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
    AC_SRC_ALPHA, AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows::Win32::UI::Input::KeyboardAndMouse::{TrackMouseEvent, TME_LEAVE, TRACKMOUSEEVENT};
use windows::Win32::UI::WindowsAndMessaging::{
    AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu, DestroyWindow,
    GetCursorPos, LoadCursorW, RegisterClassW, SetCursor, SetForegroundWindow, ShowWindow,
    TrackPopupMenu, UpdateLayeredWindow, IDC_HAND, MA_NOACTIVATE, MF_STRING, SW_SHOWNOACTIVATE,
    TPM_RETURNCMD, TPM_RIGHTBUTTON, ULW_ALPHA, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_LBUTTONUP,
    WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_RBUTTONUP, WM_SETCURSOR, WM_SETTINGCHANGE, WNDCLASSW,
    WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
};

use super::{ControlEvent, ControlLook, ControlMenuItem};
use crate::domain::control_look::Bitmap;

/// Whether "system" means the dark theme: Windows apps mode (Settings > Personalization >
/// Colors). Unknown counts as light, like the webview's `prefers-color-scheme`.
pub fn system_prefers_dark() -> bool {
    let mut value: u32 = 1;
    let mut size = std::mem::size_of::<u32>() as u32;
    // SAFETY: `value` and `size` are valid for writes for the duration of the call and `size`
    // holds the buffer size in bytes; the key and value names are static wide strings.
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            w!("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"),
            w!("AppsUseLightTheme"),
            RRF_RT_REG_DWORD,
            None,
            Some(std::ptr::from_mut(&mut value).cast::<c_void>()),
            Some(&mut size),
        )
    };
    status.is_ok() && value == 0
}

/// The native control widget: a layered, always-on-top tool window that shows a pre-rendered
/// bitmap with per-pixel alpha. No webview, so it costs a few hundred kilobytes instead of a
/// WebView2 process tree. All functions must run on the main (event loop) thread, which also
/// pumps the widget's messages.
pub mod control {
    use super::*;

    const CLASS_NAME: PCWSTR = w!("VisionBoardControl");
    /// Sent after TrackMouseEvent(TME_LEAVE) when the pointer leaves (in Win32_UI_Controls,
    /// which this crate does not otherwise need).
    const WM_MOUSELEAVE: u32 = 0x02A3;
    const MENU_OPEN: usize = 1;
    const MENU_SETTINGS: usize = 2;
    const MENU_HIDE: usize = 3;

    /// Receives what the user does with the widget.
    pub type Handler = Rc<dyn Fn(ControlEvent)>;

    struct Control {
        hwnd: HWND,
        look: ControlLook,
        hovering: bool,
    }

    thread_local! {
        static CONTROL: RefCell<Option<Control>> = const { RefCell::new(None) };
        static HANDLER: RefCell<Option<Handler>> = const { RefCell::new(None) };
    }

    /// Shows the widget with the given look, or updates the shown one. `on_event` receives
    /// clicks, menu choices and display changes.
    pub fn show(look: ControlLook, on_event: Handler) -> windows::core::Result<()> {
        HANDLER.with(|h| *h.borrow_mut() = Some(on_event));
        let existing = CONTROL.with(|c| c.borrow().as_ref().map(|c| c.hwnd));
        let hwnd = match existing {
            Some(hwnd) => hwnd,
            None => create(&look)?,
        };
        paint(hwnd, &look, false)?;
        CONTROL.with(|c| {
            *c.borrow_mut() = Some(Control {
                hwnd,
                look,
                hovering: false,
            });
        });
        Ok(())
    }

    /// Destroys the widget, if shown.
    pub fn hide() {
        if let Some(control) = CONTROL.with(|c| c.borrow_mut().take()) {
            // SAFETY: the window was created by `create` on this thread and not destroyed yet
            // (it is destroyed only here, after being taken out of CONTROL).
            let _ = unsafe { DestroyWindow(control.hwnd) };
        }
        HANDLER.with(|h| h.borrow_mut().take());
    }

    fn create(look: &ControlLook) -> windows::core::Result<HWND> {
        // SAFETY: plain Win32 calls with valid arguments: a static class name, a window
        // procedure with the required signature, and this module's instance handle.
        unsafe {
            let instance = GetModuleHandleW(None)?;
            let class = WNDCLASSW {
                lpfnWndProc: Some(window_proc),
                hInstance: instance.into(),
                lpszClassName: CLASS_NAME,
                ..Default::default()
            };
            // Fails harmlessly when the class is already registered (widget shown again).
            RegisterClassW(&class);
            let hwnd = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_NOACTIVATE,
                CLASS_NAME,
                w!("Vision Board"),
                WS_POPUP,
                look.x,
                look.y,
                look.normal.width as i32,
                look.normal.height as i32,
                None,
                None,
                Some(instance.into()),
                None,
            )?;
            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            Ok(hwnd)
        }
    }

    /// Puts a bitmap on screen with per-pixel alpha.
    fn paint(hwnd: HWND, look: &ControlLook, hover: bool) -> windows::core::Result<()> {
        let bitmap: &Bitmap = if hover { &look.hover } else { &look.normal };
        let width = bitmap.width as i32;
        let height = bitmap.height as i32;
        // SAFETY: the DIB section is created for exactly width × height 32-bit pixels and
        // `bits` points to its memory, so copying `bitmap.pixels` (same size, checked by the
        // assert) stays in bounds. Every GDI object created here is released before return.
        unsafe {
            let screen = GetDC(None);
            let memory = CreateCompatibleDC(Some(screen));
            let info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height, // top-down rows
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bits: *mut c_void = std::ptr::null_mut();
            let result = CreateDIBSection(Some(memory), &info, DIB_RGB_COLORS, &mut bits, None, 0)
                .and_then(|dib| {
                    assert_eq!(bitmap.pixels.len(), (width * height * 4) as usize);
                    std::ptr::copy_nonoverlapping(
                        bitmap.pixels.as_ptr(),
                        bits.cast::<u8>(),
                        bitmap.pixels.len(),
                    );
                    let previous = SelectObject(memory, dib.into());
                    let blend = BLENDFUNCTION {
                        BlendOp: AC_SRC_OVER as u8,
                        BlendFlags: 0,
                        SourceConstantAlpha: 255,
                        AlphaFormat: AC_SRC_ALPHA as u8,
                    };
                    let result = UpdateLayeredWindow(
                        hwnd,
                        Some(screen),
                        Some(&POINT {
                            x: look.x,
                            y: look.y,
                        }),
                        Some(&SIZE {
                            cx: width,
                            cy: height,
                        }),
                        Some(memory),
                        Some(&POINT::default()),
                        COLORREF(0),
                        Some(&blend),
                        ULW_ALPHA,
                    );
                    SelectObject(memory, previous);
                    let _ = DeleteObject(dib.into());
                    result
                });
            let _ = DeleteDC(memory);
            ReleaseDC(None, screen);
            result
        }
    }

    /// Calls the handler outside of the borrow, so it may show or hide the widget itself.
    fn emit(event: ControlEvent) {
        if let Some(handler) = HANDLER.with(|h| h.borrow().clone()) {
            handler(event);
        }
    }

    fn set_hover(hwnd: HWND, hover: bool) {
        let look = CONTROL.with(|c| {
            let mut c = c.borrow_mut();
            let control = c.as_mut()?;
            if control.hovering == hover {
                return None;
            }
            control.hovering = hover;
            Some(control.look.clone())
        });
        if let Some(look) = look {
            let _ = paint(hwnd, &look, hover);
        }
    }

    fn context_menu(hwnd: HWND) {
        let Some(labels) = CONTROL.with(|c| c.borrow().as_ref().map(|c| c.look.menu.clone()))
        else {
            return;
        };
        let wide: Vec<Vec<u16>> = labels
            .iter()
            .map(|l| l.encode_utf16().chain([0]).collect())
            .collect();
        // SAFETY: the menu is created, used and destroyed here; the label buffers outlive the
        // TrackPopupMenu call that reads them. The window is ours and alive (we are in its
        // window procedure).
        let chosen = unsafe {
            let Ok(menu) = CreatePopupMenu() else {
                return;
            };
            for (id, label) in [MENU_OPEN, MENU_SETTINGS, MENU_HIDE].into_iter().zip(&wide) {
                let _ = AppendMenuW(menu, MF_STRING, id, PCWSTR(label.as_ptr()));
            }
            let mut at = POINT::default();
            let _ = GetCursorPos(&mut at);
            // Without this, the menu does not close when the user clicks elsewhere.
            let _ = SetForegroundWindow(hwnd);
            let chosen = TrackPopupMenu(
                menu,
                TPM_RETURNCMD | TPM_RIGHTBUTTON,
                at.x,
                at.y,
                None,
                hwnd,
                None,
            );
            let _ = DestroyMenu(menu);
            chosen.0 as usize
        };
        let item = match chosen {
            MENU_OPEN => ControlMenuItem::OpenBoard,
            MENU_SETTINGS => ControlMenuItem::Settings,
            MENU_HIDE => ControlMenuItem::Hide,
            _ => return,
        };
        emit(ControlEvent::Menu(item));
    }

    extern "system" fn window_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            // Clicking the widget must not take focus from the app the user works in.
            WM_MOUSEACTIVATE => LRESULT(MA_NOACTIVATE as isize),
            WM_SETCURSOR => {
                // SAFETY: loading a system cursor and setting it has no preconditions.
                unsafe {
                    if let Ok(cursor) = LoadCursorW(None, IDC_HAND) {
                        SetCursor(Some(cursor));
                    }
                }
                LRESULT(1)
            }
            WM_MOUSEMOVE => {
                let mut track = TRACKMOUSEEVENT {
                    cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                    dwFlags: TME_LEAVE,
                    hwndTrack: hwnd,
                    dwHoverTime: 0,
                };
                // SAFETY: `track` is a valid, initialized TRACKMOUSEEVENT for our window.
                let _ = unsafe { TrackMouseEvent(&mut track) };
                set_hover(hwnd, true);
                LRESULT(0)
            }
            WM_MOUSELEAVE => {
                set_hover(hwnd, false);
                LRESULT(0)
            }
            WM_LBUTTONUP => {
                emit(ControlEvent::Click);
                LRESULT(0)
            }
            WM_RBUTTONUP => {
                context_menu(hwnd);
                LRESULT(0)
            }
            // Theme, scaling or monitor layout may have changed: let the app recompute.
            WM_SETTINGCHANGE | WM_DISPLAYCHANGE | WM_DPICHANGED => {
                emit(ControlEvent::Refresh);
                // SAFETY: forwarding the unchanged message to the default procedure.
                unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
            }
            // SAFETY: forwarding the unchanged message to the default procedure.
            _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
        }
    }
}
