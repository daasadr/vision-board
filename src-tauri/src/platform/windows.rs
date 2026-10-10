//! Windows implementation of the platform integrations.
#![allow(unsafe_code)]

use std::cell::RefCell;
use std::ffi::c_void;
use std::rc::Rc;
use std::time::Duration;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
    AC_SRC_ALPHA, AC_SRC_OVER, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, BLENDFUNCTION, DIB_RGB_COLORS,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows::Win32::System::SystemInformation::GetTickCount;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    ReleaseCapture, SetCapture, TrackMouseEvent, TME_LEAVE, TRACKMOUSEEVENT,
};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, QUNS_BUSY, QUNS_NOT_PRESENT, QUNS_PRESENTATION_MODE,
    QUNS_QUIET_TIME, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    AppendMenuW, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu, DestroyWindow,
    GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowLongPtrW, IsWindow, LoadCursorW,
    RegisterClassW, SetCursor, SetForegroundWindow, SetWindowLongPtrW, SetWindowPos, ShowWindow,
    TrackPopupMenu, UpdateLayeredWindow, GWL_EXSTYLE, HWND_BOTTOM, HWND_TOPMOST, IDC_HAND,
    MA_NOACTIVATE, MF_STRING, SM_CXDRAG, SM_CYDRAG, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    SWP_NOZORDER, SW_HIDE, SW_SHOWNOACTIVATE, TPM_RETURNCMD, TPM_RIGHTBUTTON, ULW_ALPHA, WINDOWPOS,
    WM_CAPTURECHANGED, WM_DISPLAYCHANGE, WM_DPICHANGED, WM_LBUTTONDOWN, WM_LBUTTONUP,
    WM_MOUSEACTIVATE, WM_MOUSEMOVE, WM_RBUTTONUP, WM_SETCURSOR, WM_SETTINGCHANGE,
    WM_WINDOWPOSCHANGING, WNDCLASSW, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_POPUP,
};

use super::{ControlEvent, ControlLook, ControlMenuItem};
use crate::domain::control_look::Bitmap;

/// Time since the last keyboard/mouse input and the shell's notification state. These are the
/// only things read: no keys, window titles or screen content.
pub fn activity() -> crate::domain::activity::Activity {
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    // SAFETY: `info` is a valid LASTINPUTINFO with cbSize set, valid for writes. GetTickCount
    // and SHQueryUserNotificationState take no pointers.
    let (idle, state) = unsafe {
        let idle = GetLastInputInfo(&mut info).as_bool().then(|| {
            // Both are 32-bit tick counts that wrap after ~49 days; wrapping_sub stays right.
            Duration::from_millis(u64::from(GetTickCount().wrapping_sub(info.dwTime)))
        });
        (idle, SHQueryUserNotificationState().ok())
    };
    crate::domain::activity::Activity {
        idle,
        busy: matches!(
            state,
            Some(
                QUNS_BUSY | QUNS_RUNNING_D3D_FULL_SCREEN | QUNS_PRESENTATION_MODE | QUNS_QUIET_TIME
            )
        ),
        away: state == Some(QUNS_NOT_PRESENT),
    }
}

/// The window in the foreground (whatever app it belongs to), to give focus back later.
pub fn foreground_window() -> Option<isize> {
    // SAFETY: no arguments; returns a handle or null.
    let hwnd = unsafe { GetForegroundWindow() };
    (!hwnd.is_invalid()).then_some(hwnd.0 as isize)
}

/// Gives focus back to a window remembered by `foreground_window`, if it still exists.
/// Works while this app is in the foreground (the user clicked into one of its windows).
pub fn restore_foreground(window: isize) {
    let hwnd = HWND(window as *mut c_void);
    // SAFETY: IsWindow accepts any value and tells whether it is a live window; only then is
    // it passed to SetForegroundWindow.
    unsafe {
        if IsWindow(Some(hwnd)).as_bool() {
            let _ = SetForegroundWindow(hwnd);
        }
    }
}

/// Keeps a shown webview window out of Alt+Tab and the taskbar (tool window). tao rewrites the
/// extended style when it shows a window, so this runs after showing, and hides and shows the
/// window again without activating it so the shell picks the style up.
pub fn hide_from_task_switcher(window: &tauri::WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    // SAFETY: `hwnd` is a live window of this process (`window` keeps it alive). Only its
    // extended style bits and visibility change; no pointers are passed.
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let style = (style | WS_EX_TOOLWINDOW.0 as isize) & !(WS_EX_APPWINDOW.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
        let _ = ShowWindow(hwnd, SW_HIDE);
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

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
    const MENU_RESET_POSITION: usize = 3;
    const MENU_HIDE: usize = 4;

    /// Receives what the user does with the widget.
    pub type Handler = Rc<dyn Fn(ControlEvent)>;

    struct Control {
        hwnd: HWND,
        look: ControlLook,
        hovering: bool,
        drag: Option<Drag>,
    }

    /// A press of the left button on the widget, which becomes a drag once the pointer moves
    /// further than the system drag threshold; otherwise it is a click.
    struct Drag {
        cursor: POINT,
        origin: (i32, i32),
        moving: bool,
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
        let front = look.front;
        CONTROL.with(|c| {
            *c.borrow_mut() = Some(Control {
                hwnd,
                look,
                hovering: false,
                drag: None,
            });
        });
        set_layer(hwnd, front);
        Ok(())
    }

    /// Above all windows, or at the bottom of the z-order (WM_WINDOWPOSCHANGING keeps it there).
    fn set_layer(hwnd: HWND, front: bool) {
        let after = if front { HWND_TOPMOST } else { HWND_BOTTOM };
        // SAFETY: `hwnd` is our live widget window; only its z-order changes.
        let _ = unsafe {
            SetWindowPos(
                hwnd,
                Some(after),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
        };
    }

    fn is_front() -> bool {
        // try_borrow: z-order messages can arrive while `show` holds the state.
        CONTROL.with(|c| {
            c.try_borrow()
                .ok()
                .and_then(|c| c.as_ref().map(|c| c.look.front))
                .unwrap_or(true)
        })
    }

    fn cursor() -> POINT {
        let mut at = POINT::default();
        // SAFETY: `at` is valid for writes.
        let _ = unsafe { GetCursorPos(&mut at) };
        at
    }

    fn start_drag(hwnd: HWND) {
        let started = CONTROL.with(|c| {
            let mut c = c.borrow_mut();
            let control = c.as_mut()?;
            control.drag = Some(Drag {
                cursor: cursor(),
                origin: (control.look.x, control.look.y),
                moving: false,
            });
            Some(())
        });
        if started.is_some() {
            // SAFETY: capturing the mouse for our own window, so the drag continues outside it.
            unsafe { SetCapture(hwnd) };
        }
    }

    /// Moves the widget with the pointer once the drag threshold is passed.
    fn continue_drag(hwnd: HWND) {
        let target = CONTROL.with(|c| {
            let mut c = c.borrow_mut();
            let control = c.as_mut()?;
            let drag = control.drag.as_mut()?;
            let now = cursor();
            let (dx, dy) = (now.x - drag.cursor.x, now.y - drag.cursor.y);
            if !drag.moving {
                // SAFETY: reading system metrics has no preconditions.
                let (tx, ty) =
                    unsafe { (GetSystemMetrics(SM_CXDRAG), GetSystemMetrics(SM_CYDRAG)) };
                if dx.abs() < tx && dy.abs() < ty {
                    return None;
                }
                drag.moving = true;
            }
            control.look.x = drag.origin.0 + dx;
            control.look.y = drag.origin.1 + dy;
            Some((control.look.x, control.look.y))
        });
        if let Some((x, y)) = target {
            // SAFETY: `hwnd` is our live widget window; only its position changes.
            let _ = unsafe {
                SetWindowPos(
                    hwnd,
                    None,
                    x,
                    y,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                )
            };
        }
    }

    /// Ends a press: a click when the pointer stayed put, otherwise the end of a drag.
    fn end_drag() -> Option<ControlEvent> {
        let drag = CONTROL.with(|c| c.borrow_mut().as_mut().and_then(|c| c.drag.take()))?;
        if !drag.moving {
            return Some(ControlEvent::Click);
        }
        CONTROL.with(|c| {
            c.borrow().as_ref().map(|c| ControlEvent::Moved {
                x: c.look.x,
                y: c.look.y,
            })
        })
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
                WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
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
            let ids = [MENU_OPEN, MENU_SETTINGS, MENU_RESET_POSITION, MENU_HIDE];
            for (id, label) in ids.into_iter().zip(&wide) {
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
            MENU_RESET_POSITION => ControlMenuItem::ResetPosition,
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
                continue_drag(hwnd);
                LRESULT(0)
            }
            WM_MOUSELEAVE => {
                set_hover(hwnd, false);
                LRESULT(0)
            }
            WM_LBUTTONDOWN => {
                start_drag(hwnd);
                LRESULT(0)
            }
            WM_LBUTTONUP => {
                // Releasing the capture sends WM_CAPTURECHANGED, which finds the drag ended.
                let event = end_drag();
                // SAFETY: releasing the capture this window took in WM_LBUTTONDOWN.
                let _ = unsafe { ReleaseCapture() };
                if let Some(event) = event {
                    emit(event);
                }
                LRESULT(0)
            }
            // Capture lost mid-drag (e.g. another window grabbed the mouse): keep where it got.
            WM_CAPTURECHANGED => {
                if let Some(event @ ControlEvent::Moved { .. }) = end_drag() {
                    emit(event);
                }
                LRESULT(0)
            }
            // At the bottom layer, every z-order change is turned into "stay at the bottom",
            // so clicking the widget or other apps never brings it above windows.
            WM_WINDOWPOSCHANGING if !is_front() => {
                let pos = lparam.0 as *mut WINDOWPOS;
                // SAFETY: for WM_WINDOWPOSCHANGING, lparam points to a WINDOWPOS the system
                // owns for the duration of this call and lets us modify.
                unsafe {
                    if let Some(pos) = pos.as_mut() {
                        pos.hwndInsertAfter = HWND_BOTTOM;
                        pos.flags &= !SWP_NOZORDER;
                    }
                    DefWindowProcW(hwnd, msg, wparam, lparam)
                }
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
