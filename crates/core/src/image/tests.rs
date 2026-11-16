use std::io::Cursor;

use image::{
    codecs::gif::GifEncoder, DynamicImage, Frame, ImageFormat, Rgb, RgbImage, Rgba, RgbaImage,
};

use super::resize_image;
use crate::Error;

#[test]
fn resizes_supported_formats_without_enlarging() {
    for (format, width, height, expected) in [
        (ImageFormat::Png, 3000, 2000, (1200, 800)),
        (ImageFormat::Jpeg, 1000, 3000, (400, 1200)),
        (ImageFormat::WebP, 800, 600, (800, 600)),
        (ImageFormat::Gif, 800, 600, (800, 600)),
    ] {
        let source =
            DynamicImage::ImageRgb8(RgbImage::from_pixel(width, height, Rgb([40, 90, 160])));
        let mut input = Cursor::new(Vec::new());
        source.write_to(&mut input, format).unwrap_or_else(|error| {
            panic!("encoding {width}×{height} {format:?} fixture: {error}")
        });
        let result = resize_image(input.get_ref()).unwrap_or_else(|error| {
            panic!("resizing {width}×{height} {format:?} fixture: {error}")
        });
        assert_eq!((result.width, result.height), expected, "{format:?}");
        assert_eq!(
            image::guess_format(&result.bytes).unwrap_or_else(|error| {
                panic!("detecting output format for {width}×{height} {format:?}: {error}")
            }),
            ImageFormat::Jpeg
        );
        let decoded = image::load_from_memory(&result.bytes)
            .unwrap_or_else(|error| {
                panic!("decoding output for {width}×{height} {format:?}: {error}")
            })
            .to_rgb8();
        assert_eq!(decoded.dimensions(), expected);
        assert_pixel_near(
            decoded.get_pixel(expected.0 / 2, expected.1 / 2),
            [40, 90, 160],
        );
    }
}

#[test]
fn flattens_png_transparency_onto_white() {
    for (alpha, expected) in [
        (0, [255, 255, 255]),
        (128, [127, 127, 255]),
        (255, [0, 0, 255]),
    ] {
        let source =
            DynamicImage::ImageRgba8(RgbaImage::from_pixel(32, 32, Rgba([0, 0, 255, alpha])));
        let mut input = Cursor::new(Vec::new());
        source
            .write_to(&mut input, ImageFormat::Png)
            .unwrap_or_else(|error| panic!("encoding PNG fixture with alpha {alpha}: {error}"));
        let result = resize_image(input.get_ref())
            .unwrap_or_else(|error| panic!("flattening PNG fixture with alpha {alpha}: {error}"));
        let decoded = image::load_from_memory(&result.bytes)
            .unwrap_or_else(|error| panic!("decoding flattened PNG with alpha {alpha}: {error}"))
            .to_rgb8();
        assert_pixel_near(decoded.get_pixel(16, 16), expected);
    }
}

#[test]
fn uses_only_first_gif_frame() {
    let mut input = Vec::new();
    {
        let mut encoder = GifEncoder::new(&mut input);
        for color in [[255, 0, 0, 255], [0, 0, 255, 255]] {
            encoder
                .encode_frame(Frame::new(RgbaImage::from_pixel(32, 24, Rgba(color))))
                .unwrap_or_else(|error| panic!("encoding GIF frame with color {color:?}: {error}"));
        }
    }
    let result = resize_image(&input)
        .unwrap_or_else(|error| panic!("resizing two-frame GIF fixture: {error}"));
    assert_eq!((result.width, result.height), (32, 24));
    let decoded = image::load_from_memory(&result.bytes)
        .unwrap_or_else(|error| panic!("decoding JPEG output from two-frame GIF: {error}"))
        .to_rgb8();
    assert_pixel_near(decoded.get_pixel(16, 12), [255, 0, 0]);
}

#[test]
fn applies_exif_orientation_before_resizing() {
    let source = DynamicImage::ImageRgb8(RgbImage::from_fn(3000, 2000, |_, y| {
        if y < 1000 {
            Rgb([255, 0, 0])
        } else {
            Rgb([0, 0, 255])
        }
    }));
    let mut jpeg = Cursor::new(Vec::new());
    source
        .write_to(&mut jpeg, ImageFormat::Jpeg)
        .unwrap_or_else(|error| panic!("encoding 3000×2000 EXIF fixture: {error}"));
    let exif = [
        0xff, 0xe1, 0x00, 0x22, b'E', b'x', b'i', b'f', 0, 0, b'I', b'I', 0x2a, 0, 8, 0, 0, 0, 1,
        0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ];
    let mut input = jpeg.into_inner();
    input.splice(2..2, exif);
    let result = resize_image(&input)
        .unwrap_or_else(|error| panic!("resizing JPEG fixture with EXIF orientation 6: {error}"));
    assert_eq!((result.width, result.height), (800, 1200));
    let decoded = image::load_from_memory(&result.bytes)
        .unwrap_or_else(|error| panic!("decoding oriented JPEG output: {error}"))
        .to_rgb8();
    assert_eq!(decoded.dimensions(), (800, 1200));
    assert_pixel_near(decoded.get_pixel(200, 600), [0, 0, 255]);
    assert_pixel_near(decoded.get_pixel(600, 600), [255, 0, 0]);
}

#[test]
fn rejects_invalid_images() {
    for input in [&b"not an image"[..], &b"\x89PNG\r\n\x1a\n"[..]] {
        assert!(matches!(resize_image(input), Err(Error::Image(_))));
    }
}

fn assert_pixel_near(actual: &Rgb<u8>, expected: [u8; 3]) {
    for (actual, expected) in actual.0.into_iter().zip(expected) {
        assert!(
            actual.abs_diff(expected) <= 3,
            "{actual} differs from {expected}"
        );
    }
}
