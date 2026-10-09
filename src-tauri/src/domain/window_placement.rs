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

/// Size of the control widget window in logical pixels (the spec allows at most 120×40).
pub const CONTROL_WIDTH: f64 = 120.0;
pub const CONTROL_HEIGHT: f64 = 40.0;
/// Room kept free at the right for the minimize/maximize/close buttons of maximized windows.
const CAPTION_BUTTONS_WIDTH: f64 = 150.0;
const CONTROL_TOP_GAP: f64 = 2.0;

/// Top-left position of the control widget in the top right corner of a work area, left of
/// where maximized windows have their caption buttons. `scale` is the monitor's scale factor.
pub fn control_position(area: Rect, scale: f64) -> (i32, i32) {
    let from_right = ((CAPTION_BUTTONS_WIDTH + CONTROL_WIDTH) * scale).round() as i64;
    let x = (i64::from(area.x) + i64::from(area.width) - from_right).max(i64::from(area.x));
    let y = i64::from(area.y) + (CONTROL_TOP_GAP * scale).round() as i64;
    // Both values lie inside `area`, whose coordinates are i32.
    (x as i32, y as i32)
}

/// Where the control widget of the given size (physical pixels) goes: where the user dragged
/// it, when at least half of it lies on one work area (then moved fully into that area), or
/// else the default corner of the primary work area.
pub fn control_origin(
    saved: Option<(i32, i32)>,
    size: (u32, u32),
    work_areas: &[Rect],
    primary: Rect,
    scale: f64,
) -> (i32, i32) {
    let default = control_position(primary, scale);
    let Some((x, y)) = saved else {
        return default;
    };
    let widget = Rect::new(x, y, size.0, size.1);
    let half = i64::from(size.0) * i64::from(size.1) / 2;
    let Some(area) = work_areas.iter().find(|area| {
        let (w, h) = widget.intersection(area);
        w * h >= half
    }) else {
        return default;
    };
    let clamp = |pos: i32, len: u32, start: i32, area_len: u32| {
        let max = i64::from(start) + i64::from(area_len) - i64::from(len);
        // Within the area's i32 coordinates.
        i64::from(pos).clamp(i64::from(start), max.max(i64::from(start))) as i32
    };
    (
        clamp(x, size.0, area.x, area.width),
        clamp(y, size.1, area.y, area.height),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONTROL: (u32, u32) = (120, 40);

    #[test]
    fn control_goes_to_the_corner_until_moved() {
        assert_eq!(
            control_origin(None, CONTROL, &[PRIMARY], PRIMARY, 1.0),
            (1650, 2)
        );
    }

    #[test]
    fn a_moved_control_stays_where_it_was_put() {
        assert_eq!(
            control_origin(
                Some((300, 500)),
                CONTROL,
                &[PRIMARY, SECONDARY],
                PRIMARY,
                1.0
            ),
            (300, 500)
        );
        assert_eq!(
            control_origin(
                Some((3000, 900)),
                CONTROL,
                &[PRIMARY, SECONDARY],
                PRIMARY,
                1.0
            ),
            (3000, 900)
        );
    }

    #[test]
    fn a_control_hanging_over_the_edge_is_pulled_in() {
        assert_eq!(
            control_origin(Some((1830, 1010)), CONTROL, &[PRIMARY], PRIMARY, 1.0),
            (1800, 1000)
        );
    }

    #[test]
    fn a_control_on_a_disconnected_monitor_returns_to_the_corner() {
        assert_eq!(
            control_origin(Some((3000, 900)), CONTROL, &[PRIMARY], PRIMARY, 1.0),
            (1650, 2)
        );
    }

    #[test]
    fn control_sits_left_of_the_caption_buttons() {
        assert_eq!(control_position(PRIMARY, 1.0), (1650, 2));
        // 150 % scaling: everything in physical pixels grows with it.
        assert_eq!(
            control_position(Rect::new(0, 0, 2880, 1560), 1.5),
            (2475, 3)
        );
        // A monitor left of and above the primary one.
        assert_eq!(
            control_position(Rect::new(-1920, -200, 1920, 1040), 1.0),
            (-270, -198)
        );
    }

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
