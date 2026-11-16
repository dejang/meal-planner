use std::io::Cursor;

use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, ImageDecoder, ImageReader,
};

use crate::{ResizedImage, Result};

pub fn resize_image(bytes: &[u8]) -> Result<ResizedImage> {
    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(image::ImageError::IoError)?
        .into_decoder()?;
    let orientation = decoder.orientation()?;
    let mut decoded = DynamicImage::from_decoder(decoder)?;
    decoded.apply_orientation(orientation);

    let rgb = {
        let rgba = decoded.into_rgba8();
        image::RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
            let pixel = rgba.get_pixel(x, y);
            let alpha = u32::from(pixel[3]);
            image::Rgb([0, 1, 2].map(|channel| {
                ((u32::from(pixel[channel]) * alpha + 255 * (255 - alpha) + 127) / 255) as u8
            }))
        })
    };
    let max_long_edge = 1200;
    let mut resized = DynamicImage::ImageRgb8(rgb);
    if resized.width().max(resized.height()) > max_long_edge {
        resized = resized.resize(max_long_edge, max_long_edge, FilterType::Lanczos3);
    }
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 85).encode_image(&resized)?;
    Ok(ResizedImage {
        bytes,
        width: resized.width(),
        height: resized.height(),
    })
}

#[cfg(test)]
mod tests;
