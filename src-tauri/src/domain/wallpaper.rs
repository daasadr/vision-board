//! Composes the wallpaper image of one monitor from a snapshot of the board (16:9) and, for a
//! partial placement, the user's original wallpaper underneath.

use image::imageops::{self, FilterType};
use image::{DynamicImage, ImageBuffer, Luma, Rgb, RgbImage, RgbaImage};

use super::placement;
use super::settings::{Placement, PlacementMode};
use super::window_placement::Rect;

/// Corner radius of a partial board, in thousandths of its width.
const RADIUS_PER_MILLE: u32 = 12;
/// Shadow under a partial board: blur and offset in thousandths of the board width, strength.
const SHADOW_BLUR_PER_MILLE: f32 = 25.0;
const SHADOW_OFFSET_PER_MILLE: u32 = 10;
const SHADOW_OPACITY: f32 = 0.45;

/// The image for a monitor of `size` (physical pixels).
///
/// Full screen: the board fills the monitor, letterboxed in its own edge color when the
/// monitor is not 16:9. Partial: the board sits where `placement` puts it, with rounded
/// corners and a soft shadow, over `background` (the original wallpaper, cover-scaled) or
/// the board's edge color when there is none.
pub fn compose(
    board: &RgbaImage,
    background: Option<&DynamicImage>,
    size: (u32, u32),
    placement: Placement,
) -> RgbImage {
    let (width, height) = size;
    let edge = edge_color(board);
    let mut canvas: RgbImage = match (placement.mode, background) {
        (PlacementMode::Partial, Some(bg)) => cover(bg, width, height),
        _ => ImageBuffer::from_pixel(width, height, edge),
    };

    let area = Rect::new(0, 0, width, height);
    let target = match placement.mode {
        PlacementMode::Full => fit_16_9(area),
        PlacementMode::Partial => placement::rect_in(area, placement),
    };
    if target.width == 0 || target.height == 0 {
        return canvas;
    }
    let scaled = imageops::resize(board, target.width, target.height, FilterType::Lanczos3);

    if placement.mode == PlacementMode::Partial {
        let radius = target.width * RADIUS_PER_MILLE / 1000;
        draw_shadow(&mut canvas, target, radius);
        overlay_rounded(&mut canvas, &scaled, target, radius);
    } else {
        overlay_rounded(&mut canvas, &scaled, target, 0);
    }
    canvas
}

/// The board's own background at its edge, to fill around it seamlessly.
fn edge_color(board: &RgbaImage) -> Rgb<u8> {
    let p = board.get_pixel(board.width() / 2, 0);
    Rgb([p[0], p[1], p[2]])
}

/// The largest 16:9 rectangle centered in `area`.
fn fit_16_9(area: Rect) -> Rect {
    let mut w = area.width;
    let mut h = w * 9 / 16;
    if h > area.height {
        h = area.height;
        w = h * 16 / 9;
    }
    Rect::new(
        area.x + ((area.width - w) / 2) as i32,
        area.y + ((area.height - h) / 2) as i32,
        w,
        h,
    )
}

/// `image` scaled to cover `width × height`, cropped in the middle (like "Fill").
fn cover(image: &DynamicImage, width: u32, height: u32) -> RgbImage {
    image
        .resize_to_fill(width, height, FilterType::Triangle)
        .to_rgb8()
}

/// Whether pixel (x, y) of a `w × h` box lies inside its rounded corners of `radius`.
fn inside_rounded(x: u32, y: u32, w: u32, h: u32, radius: u32) -> f32 {
    if radius == 0 {
        return 1.0;
    }
    let r = radius as f32;
    let cx = (x as f32 + 0.5).clamp(r, w as f32 - r);
    let cy = (y as f32 + 0.5).clamp(r, h as f32 - r);
    let d = ((x as f32 + 0.5 - cx).powi(2) + (y as f32 + 0.5 - cy).powi(2)).sqrt();
    // One pixel of anti-aliasing along the arc.
    (r - d + 0.5).clamp(0.0, 1.0)
}

fn overlay_rounded(canvas: &mut RgbImage, board: &RgbaImage, at: Rect, radius: u32) {
    for (x, y, pixel) in board.enumerate_pixels() {
        let (cx, cy) = (at.x + x as i32, at.y + y as i32);
        if cx < 0 || cy < 0 || cx as u32 >= canvas.width() || cy as u32 >= canvas.height() {
            continue;
        }
        let alpha = f32::from(pixel[3]) / 255.0 * inside_rounded(x, y, at.width, at.height, radius);
        let under = canvas.get_pixel_mut(cx as u32, cy as u32);
        for c in 0..3 {
            under[c] =
                (f32::from(pixel[c]) * alpha + f32::from(under[c]) * (1.0 - alpha)).round() as u8;
        }
    }
}

/// A soft dark shadow under the board, blurred at a small scale to stay cheap on 4K screens.
fn draw_shadow(canvas: &mut RgbImage, at: Rect, radius: u32) {
    const DOWNSCALE: u32 = 8;
    let (cw, ch) = (
        canvas.width().div_ceil(DOWNSCALE),
        canvas.height().div_ceil(DOWNSCALE),
    );
    let offset = (at.width * SHADOW_OFFSET_PER_MILLE / 1000) as i32;
    let mut mask: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(cw, ch);
    for (x, y, p) in mask.enumerate_pixels_mut() {
        let px = (x * DOWNSCALE) as i32 - at.x;
        let py = (y * DOWNSCALE) as i32 - at.y - offset;
        if px >= 0 && py >= 0 && (px as u32) < at.width && (py as u32) < at.height {
            let inside = inside_rounded(px as u32, py as u32, at.width, at.height, radius);
            p[0] = (inside * 255.0) as u8;
        }
    }
    let sigma = at.width as f32 * SHADOW_BLUR_PER_MILLE / 1000.0 / DOWNSCALE as f32;
    let blurred = imageops::blur(&mask, sigma.max(0.5));
    let full = imageops::resize(
        &blurred,
        canvas.width(),
        canvas.height(),
        FilterType::Triangle,
    );
    for (pixel, shade) in canvas.pixels_mut().zip(full.pixels()) {
        let darken = 1.0 - f32::from(shade[0]) / 255.0 * SHADOW_OPACITY;
        for c in 0..3 {
            pixel[c] = (f32::from(pixel[c]) * darken).round() as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::settings::Anchor;
    use image::Rgba;

    fn board() -> RgbaImage {
        ImageBuffer::from_pixel(320, 180, Rgba([200, 100, 50, 255]))
    }

    fn partial(anchor: Anchor) -> Placement {
        Placement {
            mode: PlacementMode::Partial,
            size: 40,
            anchor,
        }
    }

    #[test]
    fn full_screen_fills_a_16_9_monitor_with_the_board() {
        let image = compose(&board(), None, (1920, 1080), Placement::default());
        assert_eq!(image.dimensions(), (1920, 1080));
        assert_eq!(image.get_pixel(5, 5), &Rgb([200, 100, 50]));
        assert_eq!(image.get_pixel(1915, 1075), &Rgb([200, 100, 50]));
    }

    #[test]
    fn full_screen_letterboxes_a_16_10_monitor_in_the_board_color() {
        let image = compose(&board(), None, (1920, 1200), Placement::default());
        assert_eq!(image.dimensions(), (1920, 1200));
        assert_eq!(
            image.get_pixel(960, 2),
            &Rgb([200, 100, 50]),
            "letterbox matches the edge"
        );
    }

    #[test]
    fn a_partial_board_sits_on_the_original_wallpaper() {
        let original =
            DynamicImage::ImageRgb8(ImageBuffer::from_pixel(800, 600, Rgb([10, 20, 30])));
        let image = compose(
            &board(),
            Some(&original),
            (1920, 1080),
            partial(Anchor::BottomRight),
        );
        // rect_in: 768×432 at (1114, 610).
        assert_eq!(
            image.get_pixel(1114 + 384, 610 + 216),
            &Rgb([200, 100, 50]),
            "board"
        );
        assert_eq!(
            image.get_pixel(100, 100),
            &Rgb([10, 20, 30]),
            "wallpaper far from the board"
        );
        // Rounded corner: the very corner pixel shows the (shadowed) wallpaper, not the board.
        let corner = image.get_pixel(1114, 610);
        assert!(corner[0] < 100, "corner is rounded off: {corner:?}");
        // Shadow below the board darkens the wallpaper a little.
        let below = image.get_pixel(1114 + 384, 610 + 432 + 4);
        assert!(below[2] < 30, "shadow: {below:?}");
    }

    #[test]
    fn without_an_original_wallpaper_the_board_color_fills_around() {
        let image = compose(&board(), None, (1920, 1080), partial(Anchor::Center));
        assert_eq!(image.get_pixel(5, 5), &Rgb([200, 100, 50]));
    }
}
