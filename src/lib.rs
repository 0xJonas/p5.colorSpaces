mod rgb;
mod cielab;

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;
use std::alloc::{alloc, dealloc, Layout};

pub use crate::rgb::*;
pub use crate::cielab::*;

pub trait TristimulusColor {
    fn get_0(&self) -> f32;
    fn get_1(&self) -> f32;
    fn get_2(&self) -> f32;
}

pub(crate) trait CompareMargin<T> {
    fn equal_within(&self, other: T, margin: f32) -> bool;
}

impl<T: TristimulusColor> CompareMargin<T> for T {

    fn equal_within(&self, other: T, margin: f32) -> bool {
        (self.get_0() - other.get_0()).abs() < margin &&
        (self.get_1() - other.get_1()).abs() < margin &&
        (self.get_2() - other.get_2()).abs() < margin
    }
}

#[wasm_bindgen]
pub fn allocate_buffer(len: usize) -> *mut u8 {
    let layout = Layout::array::<u8>(len).unwrap();
    unsafe {
        alloc(layout)
    }
}

#[wasm_bindgen]
pub fn deallocate_buffer(ptr: *mut u8, len: usize) {
    let layout = Layout::array::<u8>(len).unwrap();
    unsafe {
        dealloc(ptr, layout);
    }
}

#[wasm_bindgen]
pub fn get_memory_view(ptr: *mut u8, len: usize) -> Uint8Array {
    unsafe {
        Uint8Array::view_mut_raw(ptr, len)
    }
}

#[wasm_bindgen]
pub fn convert_memory_srgb_to_xyz(ptr: *mut u8, offset: usize, len: usize) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    for i in 0..(data.len() / 4) {
        let r = data[i * 4 + 0] as f32 / 255.0;
        let g = data[i * 4 + 1] as f32 / 255.0;
        let b = data[i * 4 + 2] as f32 / 255.0;

        let CIEXYZColor(x, y, z) = srgb_to_xyz(&SRGBColor(r, g, b));

        /*
        This cast from f32 to u8 looks strange but has very good performance.

        First, the value is scaled and offset according to the target color space. Then
        it is clamped to the range 0..255. After that the offset 256.5 is added to it. This constant
        consists of two parts: the 0.5 ensured that the truncation performed later will effectivly round
        the value to the nearest integer. The 256 ensures that the fractional part of the float bits
        start with the equivalent integer value. Finally, the top 8 bits of the 
        fractional part are extracted to form the final u8 value.
        */
        data[i * 4 + 0] = (f32::to_bits((x * 269.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((y * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((z * 235.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_xyz_to_srgb(ptr: *mut u8, offset: usize, len: usize) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    for i in 0..(data.len() / 4) {
        let x = data[i * 4 + 0] as f32 / 269.0;
        let y = data[i * 4 + 1] as f32 / 255.0;
        let z = data[i * 4 + 2] as f32 / 235.0;

        let SRGBColor(r, g, b) = xyz_to_srgb(&CIEXYZColor(x, y, z));

        data[i * 4 + 0] = (f32::to_bits((r * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((g * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_srgb_to_linear_rgb(ptr: *mut u8, offset: usize, len: usize) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    for i in 0..(data.len() / 4) {
        let r = data[i * 4 + 0] as f32 / 255.0;
        let g = data[i * 4 + 1] as f32 / 255.0;
        let b = data[i * 4 + 2] as f32 / 255.0;

        let LinearRGBColor(lin_r, lin_g, lin_b) = srgb_to_linear_rgb(&SRGBColor(r, g, b));

        data[i * 4 + 0] = (f32::to_bits((lin_r * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((lin_g * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((lin_b * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_linear_rgb_to_srgb(ptr: *mut u8, offset: usize, len: usize) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    for i in 0..(data.len() / 4) {
        let lin_r = data[i * 4 + 0] as f32 / 255.0;
        let lin_g = data[i * 4 + 1] as f32 / 255.0;
        let lin_b = data[i * 4 + 2] as f32 / 255.0;

        let SRGBColor(r, g, b) = linear_rgb_to_srgb(&LinearRGBColor(lin_r, lin_g, lin_b));

        data[i * 4 + 0] = (f32::to_bits((r * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((g * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_srgb_to_lab(ptr: *mut u8, offset: usize, len: usize, white_x: f32, white_y: f32, white_yy: f32) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    let white = CIEXYZColor(white_x / white_y * white_yy, white_yy, (1.0 - white_x - white_y) / white_y * white_yy);

    for i in 0..(data.len() / 4) {
        let r = data[i * 4 + 0] as f32 / 255.0;
        let g = data[i * 4 + 1] as f32 / 255.0;
        let b = data[i * 4 + 2] as f32 / 255.0;

        let xyz = srgb_to_xyz(&SRGBColor(r, g, b));
        let CIELabColor(l, a_s, b_s) = xyz_to_lab(&xyz, &white);

        data[i * 4 + 0] = (f32::to_bits((l * 2.55).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((a_s + 128.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b_s + 128.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_lab_to_srgb(ptr: *mut u8, offset: usize, len: usize, white_x: f32, white_y: f32, white_yy: f32) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(ptr.add(offset), len)
    };

    let white = CIEXYZColor(white_x / white_y * white_yy, white_yy, (1.0 - white_x - white_y) / white_y * white_yy);

    for i in 0..(data.len() / 4) {
        let l = data[i * 4 + 0] as f32 / 2.550;
        let a_s = data[i * 4 + 1] as f32 - 128.0;
        let b_s = data[i * 4 + 2] as f32 - 128.0;

        let xyz = lab_to_xyz(&CIELabColor(l, a_s, b_s), &white);
        let SRGBColor(r, g, b) = xyz_to_srgb(&xyz);

        data[i * 4 + 0] = (f32::to_bits((r * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((g * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}
