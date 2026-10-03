//! Decides whether a restored window position is still usable on the current monitor setup.

/// A rectangle in physical pixels on the virtual desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub const fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    fn right(&self) -> i64 {
        i64::from(self.x) + i64::from(self.width)
    }

    fn bottom(&self) -> i64 {
        i64::from(self.y) + i64::from(self.height)
    }

    fn intersection(&self, other: &Rect) -> (i64, i64) {
        let w = self.right().min(other.right()) - i64::from(self.x.max(other.x));
        let h = self.bottom().min(other.bottom()) - i64::from(self.y.max(other.y));
        (w.max(0), h.max(0))
    }
}

/// Height of the strip at the top of the window that holds the title bar.
const TITLE_BAR_HEIGHT: u32 = 32;
/// How much of the title bar must be on a monitor for the user to grab and move the window.
const MIN_GRABBABLE_WIDTH: i64 = 96;
const MIN_GRABBABLE_HEIGHT: i64 = 16;

/// A window is usable when enough of its title bar lies on one monitor's work area to drag it.
pub fn is_reachable(window: Rect, work_areas: &[Rect]) -> bool {
    let title_bar = Rect::new(
        window.x,
        window.y,
        window.width,
        TITLE_BAR_HEIGHT.min(window.height),
    );
    work_areas.iter().any(|area| {
        let (w, h) = title_bar.intersection(area);
        w >= MIN_GRABBABLE_WIDTH.min(i64::from(window.width))
            && h >= MIN_GRABBABLE_HEIGHT.min(i64::from(title_bar.height))
    })
}

/// Top-left position that centers a window of the given size in the work area,
/// shrinking the size when the window is larger than the work area.
pub fn centered_in(width: u32, height: u32, area: Rect) -> Rect {
    let width = width.min(area.width);
    let height = height.min(area.height);
    let x = i64::from(area.x) + (i64::from(area.width) - i64::from(width)) / 2;
    let y = i64::from(area.y) + (i64::from(area.height) - i64::from(height)) / 2;
    // Both values lie inside `area`, whose coordinates are i32.
    Rect::new(x as i32, y as i32, width, height)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRIMARY: Rect = Rect::new(0, 0, 1920, 1040);
    const SECONDARY: Rect = Rect::new(1920, 0, 2560, 1400);

    #[test]
    fn window_on_primary_is_reachable() {
        assert!(is_reachable(Rect::new(100, 100, 1280, 800), &[PRIMARY]));
    }

    #[test]
    fn window_on_disconnected_monitor_is_not_reachable() {
        let on_secondary = Rect::new(2200, 200, 1280, 800);
        assert!(is_reachable(on_secondary, &[PRIMARY, SECONDARY]));
        assert!(!is_reachable(on_secondary, &[PRIMARY]));
    }

    #[test]
    fn window_with_title_bar_above_screen_is_not_reachable() {
        assert!(!is_reachable(Rect::new(100, -500, 1280, 800), &[PRIMARY]));
    }

    #[test]
    fn window_barely_overlapping_edge_is_not_reachable() {
        assert!(!is_reachable(Rect::new(1900, 100, 1280, 800), &[PRIMARY]));
    }

    #[test]
    fn window_spanning_two_monitors_is_reachable() {
        assert!(is_reachable(
            Rect::new(1500, 100, 1280, 800),
            &[PRIMARY, SECONDARY]
        ));
    }

    #[test]
    fn no_monitors_means_not_reachable() {
        assert!(!is_reachable(Rect::new(0, 0, 800, 600), &[]));
    }

    #[test]
    fn centers_in_work_area() {
        assert_eq!(
            centered_in(1280, 800, PRIMARY),
            Rect::new(320, 120, 1280, 800)
        );
        assert_eq!(
            centered_in(1280, 800, SECONDARY),
            Rect::new(2560, 300, 1280, 800)
        );
    }

    #[test]
    fn oversized_window_is_shrunk_to_work_area() {
        assert_eq!(centered_in(4000, 3000, PRIMARY), PRIMARY);
    }
}
