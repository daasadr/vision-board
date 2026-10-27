//! Linux implementation of the platform integrations. No FFI: WebKitGTK is reached through
//! its safe gtk-rs bindings.

pub mod wallpaper {
    use gtk::gio;
    use webkit2gtk::{SnapshotOptions, SnapshotRegion, WebViewExt};

    pub type Done = Box<dyn FnOnce(Result<Vec<u8>, String>) + Send>;

    /// Takes a PNG snapshot of what the window's webview draws and hands the bytes to `done`,
    /// exactly once. WebKitGTK answers asynchronously on the main loop, so this returns at
    /// once. `whole_page`: the full document instead of the visible viewport.
    pub fn capture_png(
        window: &tauri::WebviewWindow,
        whole_page: bool,
        done: Done,
    ) -> tauri::Result<()> {
        let region = if whole_page {
            SnapshotRegion::FullDocument
        } else {
            SnapshotRegion::Visible
        };
        window.with_webview(move |webview| {
            webview.inner().snapshot(
                region,
                SnapshotOptions::NONE,
                None::<&gio::Cancellable>,
                move |result| done(result.map_err(|e| e.to_string()).and_then(to_png)),
            );
        })
    }

    fn to_png(surface: cairo::Surface) -> Result<Vec<u8>, String> {
        let image = cairo::ImageSurface::try_from(surface)
            .map_err(|_| "the snapshot is not an image surface".to_owned())?;
        let mut png = Vec::new();
        image.write_to_png(&mut png).map_err(|e| e.to_string())?;
        Ok(png)
    }
}
