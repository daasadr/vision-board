//! Pixels of the native control widget (Windows). The look is designed in CSS
//! (src/app/control) and rendered to PNGs at 3× by `pnpm control:render`; here they are scaled
//! to the monitor and converted to what a layered window takes.

use image::imageops::FilterType;
use image::ImageFormat;

use super::window_placement::{CONTROL_HEIGHT, CONTROL_WIDTH};

const GALERIE_NORMAL: &[u8] = include_bytes!("../../assets/control/galerie-normal.png");
const GALERIE_HOVER: &[u8] = include_bytes!("../../assets/control/galerie-hover.png");
const NOC_NORMAL: &[u8] = include_bytes!("../../assets/control/noc-normal.png");
const NOC_HOVER: &[u8] = include_bytes!("../../assets/control/noc-hover.png");

/// An image ready for a layered window: premultiplied BGRA, rows top to bottom.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bitmap {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

/// The widget in the Noc (dark) or Galerie theme, at rest or under the pointer, for a monitor
/// with the given scale factor.
pub fn bitmap(dark: bool, hover: bool, scale: f64) -> Result<Bitmap, image::ImageError> {
    let png = match (dark, hover) {
        (false, false) => GALERIE_NORMAL,
        (false, true) => GALERIE_HOVER,
        (true, false) => NOC_NORMAL,
        (true, true) => NOC_HOVER,
    };
    let scale = scale.clamp(0.5, 4.0);
    let width = (CONTROL_WIDTH * scale).round() as u32;
    let height = (CONTROL_HEIGHT * scale).round() as u32;
    let rgba = image::load_from_memory_with_format(png, ImageFormat::Png)?
        .resize_exact(width, height, FilterType::Lanczos3)
        .to_rgba8();
    Ok(Bitmap {
        width,
        height,
        pixels: premultiplied_bgra(rgba.as_raw()),
    })
}

/// RGBA → BGRA with color multiplied by alpha, as `UpdateLayeredWindow` expects.
fn premultiplied_bgra(rgba: &[u8]) -> Vec<u8> {
    rgba.chunks_exact(4)
        .flat_map(|p| {
            let a = u16::from(p[3]);
            let mul = |c: u8| ((u16::from(c) * a + 127) / 255) as u8;
            [mul(p[2]), mul(p[1]), mul(p[0]), p[3]]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scales_to_the_monitor() {
        let at_100 = bitmap(false, false, 1.0).expect("galerie");
        assert_eq!((at_100.width, at_100.height), (120, 40));
        assert_eq!(at_100.pixels.len(), 120 * 40 * 4);

        let at_150 = bitmap(true, true, 1.5).expect("noc hover");
        assert_eq!((at_150.width, at_150.height), (180, 60));
    }

    #[test]
    fn corners_are_transparent_and_the_middle_is_opaque() {
        let b = bitmap(true, false, 1.0).expect("noc");
        let alpha = |x: u32, y: u32| b.pixels[((y * b.width + x) * 4 + 3) as usize];
        assert_eq!(alpha(0, 0), 0, "corner around the rounded bar");
        assert_eq!(alpha(60, 18), 255, "middle of the bar");
    }

    #[test]
    fn premultiplies_and_swaps_channels() {
        assert_eq!(
            premultiplied_bgra(&[255, 128, 0, 255, 200, 100, 50, 0, 255, 255, 255, 128]),
            vec![0, 128, 255, 255, 0, 0, 0, 0, 128, 128, 128, 128]
        );
    }
}
