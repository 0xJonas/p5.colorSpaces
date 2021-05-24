mod rgb;

use wasm_bindgen::prelude::*;
use js_sys::Uint8Array;
use std::alloc::{alloc, dealloc, Layout};

pub use crate::rgb::*;

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
pub struct Allocation {
    ptr: *mut u8,
    len: usize
}

#[wasm_bindgen]
pub fn allocate_buffer(len: usize) -> Allocation {
    let layout = Layout::array::<u8>(len).unwrap();
    let ptr = unsafe {
        alloc(layout)
    };
    Allocation { ptr: ptr, len: len}
}

#[wasm_bindgen]
pub fn deallocate_buffer(allocation: Allocation) {
    let layout = Layout::array::<u8>(allocation.len).unwrap();
    unsafe {
        dealloc(allocation.ptr, layout);
    }
}

#[wasm_bindgen]
pub fn get_memory_view(allocation: &Allocation) -> Uint8Array {
    unsafe {
        Uint8Array::view_mut_raw(allocation.ptr, allocation.len)
    }
}

#[wasm_bindgen]
pub fn convert_memory_srgb_to_xyz(allocation: &Allocation) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(allocation.ptr, allocation.len)
    };

    for i in 0..(data.len() / 4) {
        let r = data[i * 4 + 0] as f32 / 255.0;
        let g = data[i * 4 + 1] as f32 / 255.0;
        let b = data[i * 4 + 2] as f32 / 255.0;

        let CIEXYZColor(x, y, z) = srgb_to_xyz(SRGBColor(r, g, b));

        /*
        This cast from f32 to u8 looks strange but has very good performance.

        First, the value is scaled and offset according to the target color space. Then
        it is clamped to the range 0..255. After that the offset 256.5 is added to it. This constant
        consists of two parts: the 0.5 ensured that the truncation performed later will effectivly round
        the value to the nearest integer. The 256 ensures that the fractional part of the float bits
        start with the equivalent integer value. Finally, the top 8 bits of the 
        fractional part are extracted to form the final u8 value.
        */
        data[i * 4 + 0] = (f32::to_bits((x * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((y * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((z * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_xyz_to_srgb(allocation: &Allocation) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(allocation.ptr, allocation.len)
    };

    for i in 0..(data.len() / 4) {
        let x = data[i * 4 + 0] as f32 / 200.0;
        let y = data[i * 4 + 1] as f32 / 200.0;
        let z = data[i * 4 + 2] as f32 / 200.0;

        let SRGBColor(r, g, b) = xyz_to_srgb(CIEXYZColor(x, y, z));

        data[i * 4 + 0] = (f32::to_bits((r * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((g * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b * 255.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_srgb_to_linear_rgb(allocation: &Allocation) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(allocation.ptr, allocation.len)
    };

    for i in 0..(data.len() / 4) {
        let r = data[i * 4 + 0] as f32 / 255.0;
        let g = data[i * 4 + 1] as f32 / 255.0;
        let b = data[i * 4 + 2] as f32 / 255.0;

        let LinearRGBColor(lin_r, lin_g, lin_b) = srgb_to_linear_rgb(SRGBColor(r, g, b));

        data[i * 4 + 0] = (f32::to_bits((lin_r * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((lin_g * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((lin_b * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}

#[wasm_bindgen]
pub fn convert_memory_linear_rgb_to_srgb(allocation: &Allocation) {
    let data: &mut [u8] = unsafe {
        std::slice::from_raw_parts_mut(allocation.ptr, allocation.len)
    };

    for i in 0..(data.len() / 4) {
        let lin_r = data[i * 4 + 0] as f32 / 255.0;
        let lin_g = data[i * 4 + 1] as f32 / 255.0;
        let lin_b = data[i * 4 + 2] as f32 / 255.0;

        let SRGBColor(r, g, b) = linear_rgb_to_srgb(LinearRGBColor(lin_r, lin_g, lin_b));

        data[i * 4 + 0] = (f32::to_bits((r * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 1] = (f32::to_bits((g * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
        data[i * 4 + 2] = (f32::to_bits((b * 200.0).clamp(0.0, 255.0) + 256.5) >> 15) as u8;
    }
}
