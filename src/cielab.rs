use crate::{TristimulusColor, CIEXYZColor};

use wasm_bindgen::prelude::*;

const CORRECTION_FACTOR_3RD_ROOT: [f32; 5] = [
    0.6299605249474366,
    0.7937005259840998,
    1.0,
    1.2599210498948732,
    1.5874010519681994
];

#[wasm_bindgen]
#[derive(Debug, Copy, Clone)]
pub struct CIELabColor(pub f32, pub f32, pub f32);

#[wasm_bindgen]
impl CIELabColor {
    
    #[wasm_bindgen(constructor)]
    pub fn new(l: f32, a: f32, b: f32) -> CIELabColor {
        CIELabColor(l, a, b)
    }
}

impl TristimulusColor for CIELabColor {

    fn get_0(&self) -> f32 {
        self.0
    }

    fn get_1(&self) -> f32 {
        self.1
    }

    fn get_2(&self) -> f32 {
        self.2
    }
}

#[wasm_bindgen]
pub fn lab_gamma(val: f32) -> f32 {
    if val <= 0.008856451679035631 {
        return val / 0.12841854934601665 + 0.13793103448275862;
    } else {
        let float_bits: u32 = f32::to_bits(val);
        let exponent: i32 = ((float_bits >> 23) & 0xff) as i32 - 126;
        let new_float_bits: u32 = (float_bits & 0x807fffff) | 0x3f000000;
        let x: f32 = f32::from_bits(new_float_bits);

        let y = ((((x * 0.13380815400574772 - 0.6322612589104776) * 
                    x + 1.2763453267854687) *
                        x - 1.4815697155541507) * 
                            x + 1.327585761559465) * 
                                x + 0.37609281991938703;
        
        let exponent_new = exponent / 3;
        let correction_shift = f32::from_bits(((exponent_new as i32 + 127) as u32 & 0xff) << 23);
        let correction_index = ((exponent - exponent_new * 3) + 2) as usize;
        let correction_factor = CORRECTION_FACTOR_3RD_ROOT[correction_index];
        return y * correction_shift * correction_factor;
    }
}

#[wasm_bindgen]
pub fn lab_digamma(val: f32) -> f32 {
    if val <= 0.20689655172413793 {
        (val - 0.13793103448275862) * 0.12841854934601665
    } else {
        val * val * val
    }
}

#[wasm_bindgen]
pub fn xyz_to_lab(xyz: &CIEXYZColor, white: &CIEXYZColor) -> CIELabColor {
    let &CIEXYZColor(x, y, z) = xyz;
    let &CIEXYZColor(xw, yw, zw) = white;

    let x_gamma = lab_gamma(x / xw);
    let y_gamma = lab_gamma(y / yw);
    let z_gamma = lab_gamma(z / zw);

    CIELabColor(116.0 * y_gamma - 16.0, 500.0 * (x_gamma - y_gamma), 200.0 * (y_gamma - z_gamma))
}

#[wasm_bindgen]
pub fn lab_to_xyz(lab: &CIELabColor, white: &CIEXYZColor) -> CIEXYZColor {
    let &CIELabColor(l, a, b) = lab;
    let &CIEXYZColor(xw, yw, zw) = white;

    let y_gamma = (l + 16.0) / 116.0;
    let x_gamma = y_gamma + a / 500.0;
    let z_gamma = y_gamma - b / 200.0;

    CIEXYZColor(xw * lab_digamma(x_gamma), yw * lab_digamma(y_gamma), zw * lab_digamma(z_gamma))
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::CompareMargin;

    const MARGIN: f32 = 1.0e-3;

    const D65: CIEXYZColor = CIEXYZColor(0.95047, 1.0, 1.08883);

    #[test]
    fn test_xyz_to_lab() {
        assert!(xyz_to_lab(&CIEXYZColor(0.44272, 0.28123, 0.14037), &D65).equal_within(CIELabColor(60.0, 60.0, 30.0), MARGIN));
        assert!(xyz_to_lab(&CIEXYZColor(0.55, 0.9, 0.001), &D65).equal_within(CIELabColor(95.997, -66.088, 164.081), MARGIN));
        assert!(xyz_to_lab(&CIEXYZColor(0.3, 0.5, 0.8), &D65).equal_within(CIELabColor(76.069, -56.418, -21.731), MARGIN));
    }

    #[test]
    fn test_lab_to_xyz() {
        assert!(lab_to_xyz(&CIELabColor(60.0, 60.0, 30.0), &D65).equal_within(CIEXYZColor(0.44272, 0.28123, 0.14037), MARGIN));
        assert!(lab_to_xyz(&CIELabColor(95.997, -66.088, 164.081), &D65).equal_within(CIEXYZColor(0.55, 0.9, 0.001), MARGIN));
        assert!(lab_to_xyz(&CIELabColor(76.069, -56.418, -21.731), &D65).equal_within(CIEXYZColor(0.3, 0.5, 0.8), MARGIN));
    }
}
