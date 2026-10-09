//! Where the board shows outside the main window (pop-up, wallpaper), on any monitor.
//! The settings preview computes the same in `src/app/settings/placement.ts`; both test the
//! same cases.

use super::settings::{Anchor, Placement, PlacementMode};
use super::window_placement::Rect;

/// Gap between a partial board and the screen edge, in thousandths of the work area width.
const MARGIN_PER_MILLE: u32 = 20;

/// The rectangle the board occupies in `area`. A partial board keeps the 16:9 canvas ratio and
/// never exceeds the work area.
pub fn rect_in(area: Rect, placement: Placement) -> Rect {
    if placement.mode == PlacementMode::Full {
        return area;
    }
    let percent = u64::from(placement.size.min(100));
    let mut width = u64::from(area.width) * percent / 100;
    let mut height = width * 9 / 16;
    if height > u64::from(area.height) {
        height = u64::from(area.height);
        width = height * 16 / 9;
    }
    let margin = u64::from(area.width) * u64::from(MARGIN_PER_MILLE) / 1000;
    let free_x = u64::from(area.width) - width;
    let free_y = u64::from(area.height) - height;
    let (dx, dy) = match placement.anchor {
        Anchor::Center => (free_x / 2, free_y / 2),
        Anchor::TopLeft => (margin.min(free_x), margin.min(free_y)),
        Anchor::TopRight => (free_x.saturating_sub(margin), margin.min(free_y)),
        Anchor::BottomLeft => (margin.min(free_x), free_y.saturating_sub(margin)),
        Anchor::BottomRight => (free_x.saturating_sub(margin), free_y.saturating_sub(margin)),
    };
    // All values are bounded by the area's u32 size and i32 position.
    Rect::new(
        (i64::from(area.x) + dx as i64) as i32,
        (i64::from(area.y) + dy as i64) as i32,
        width as u32,
        height as u32,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Rect = Rect::new(0, 0, 1920, 1080);

    fn partial(size: u8, anchor: Anchor) -> Placement {
        Placement {
            mode: PlacementMode::Partial,
            size,
            anchor,
        }
    }

    #[test]
    fn full_screen_is_the_whole_work_area() {
        let offset = Rect::new(1920, 40, 2560, 1400);
        assert_eq!(rect_in(offset, Placement::default()), offset);
    }

    // The same cases are in src/app/settings/placement.test.ts.
    #[test]
    fn partial_placement_at_every_anchor() {
        assert_eq!(
            rect_in(AREA, partial(40, Anchor::BottomRight)),
            Rect::new(1114, 610, 768, 432)
        );
        assert_eq!(
            rect_in(AREA, partial(40, Anchor::TopLeft)),
            Rect::new(38, 38, 768, 432)
        );
        assert_eq!(
            rect_in(AREA, partial(40, Anchor::TopRight)),
            Rect::new(1114, 38, 768, 432)
        );
        assert_eq!(
            rect_in(AREA, partial(40, Anchor::BottomLeft)),
            Rect::new(38, 610, 768, 432)
        );
        assert_eq!(
            rect_in(AREA, partial(50, Anchor::Center)),
            Rect::new(480, 270, 960, 540)
        );
    }

    #[test]
    fn partial_placement_is_offset_with_its_monitor() {
        let second = Rect::new(1920, 0, 1920, 1080);
        assert_eq!(
            rect_in(second, partial(40, Anchor::TopLeft)),
            Rect::new(1958, 38, 768, 432)
        );
    }

    #[test]
    fn a_wide_board_is_limited_by_a_short_screen() {
        // 21:9 work area: 90 % of the width would be taller than the screen at 16:9.
        let ultrawide = Rect::new(0, 0, 3440, 1400);
        let rect = rect_in(ultrawide, partial(90, Anchor::Center));
        assert_eq!((rect.width, rect.height), (2488, 1400));
        assert_eq!(rect.y, 0);
    }
}
