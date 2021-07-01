use wasm_bindgen::prelude::*;

use crate::TristimulusColor;
use crate::CIEXYZColor;

const CORRECTION_FACTOR_3RD_ROOT: [f32; 5] = [
    0.6299605249474366,
    0.7937005259840998,
    1.0,
    1.2599210498948732,
    1.5874010519681994
];

#[wasm_bindgen]
#[derive(Debug)]
pub struct CIELuvColor(pub f32, pub f32, pub f32);

impl TristimulusColor for CIELuvColor {

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

fn luv_gamma(val: f32) -> f32 {
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

#[inline(always)]
pub(crate) fn calc_uv_prime(xyz: &CIEXYZColor) -> (f32, f32) {
    let &CIEXYZColor(x, y, z) = xyz;
    let uv_scale = x + 15.0 * y + 3.0 * z;
    if uv_scale == 0.0 {
        return (0.0, 0.0);
    }

    let u_prime = 4.0 * x / uv_scale;
    let v_prime = 9.0 * y / uv_scale;
    return (u_prime, v_prime);
}

#[inline(always)]
pub(crate) fn xyz_to_luv_precomputed_white(xyz: &CIEXYZColor, yw: f32, u_prime_w: f32, v_prime_w: f32) -> CIELuvColor {
    let &CIEXYZColor(_, y, _) = xyz;
    let y_scaled = y / yw;
    let l = if y_scaled <= 0.008856451679035631 {
        903.2962962962963 * y_scaled
    } else { 
        116.0 * luv_gamma(y_scaled) - 16.0
    };

    let (u_prime, v_prime) = calc_uv_prime(xyz);
    let u = 13.0 * l * (u_prime - u_prime_w);
    let v = 13.0 * l * (v_prime - v_prime_w);

    return CIELuvColor(l, u, v);
}

#[wasm_bindgen]
pub fn xyz_to_luv(xyz: &CIEXYZColor, white: &CIEXYZColor) -> CIELuvColor {
    let &CIEXYZColor(_, y_white, _) = white;
    let (u_prime_white, v_prime_white) = calc_uv_prime(white);
    return xyz_to_luv_precomputed_white(xyz, y_white, u_prime_white, v_prime_white);
}

#[inline(always)]
pub(crate) fn luv_to_xyz_precomputed_white(luv: &CIELuvColor, yw: f32, u_prime_w: f32, v_prime_w: f32) -> CIEXYZColor {
    let &CIELuvColor(l, u, v) = luv;
    if l == 0.0 {
        return CIEXYZColor(0.0, 0.0, 0.0);
    }

    let u_prime = u / (13.0 * l) + u_prime_w;
    let v_prime = v / (13.0 * l) + v_prime_w;
    let y = if l <= 8.0 {
        yw * l * 0.0011070564598794539
    } else {
        let temp = (l + 16.0) / 116.0;
        yw * temp * temp * temp
    };

    let x = y * (9.0 * u_prime) / (4.0 * v_prime);
    let z = y * (12.0 - 3.0 * u_prime - 20.0 * v_prime) / (4.0 * v_prime);

    return CIEXYZColor(x, y, z);
}

#[wasm_bindgen]
pub fn luv_to_xyz(luv: &CIELuvColor, white: &CIEXYZColor) -> CIEXYZColor {
    let &CIEXYZColor(_, y_white, _) = white;
    let (u_prime_white, v_prime_white) = calc_uv_prime(white);
    return luv_to_xyz_precomputed_white(luv, y_white, u_prime_white, v_prime_white);
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::CompareMargin;

    const MARGIN: f32 = 1.0e-3;

    const D65: CIEXYZColor = CIEXYZColor(0.95047, 1.0, 1.08883);

    #[test]
    fn test_xyz_to_luv() {
        assert!(xyz_to_luv(&CIEXYZColor(0.16206, 0.28885, 0.16274), &D65).equal_within(CIELuvColor(60.680, -53.444, 42.096), MARGIN));
        assert!(xyz_to_luv(&CIEXYZColor(0.37714, 0.66363, 0.40521), &D65).equal_within(CIELuvColor(85.181, -74.411, 54.152), MARGIN));
        assert!(xyz_to_luv(&CIEXYZColor(0.0, 0.0, 0.0), &D65).equal_within(CIELuvColor(0.0, 0.0, 0.0), MARGIN));
    }

    #[test]
    fn test_luv_to_xyz() {
        assert!(luv_to_xyz(&CIELuvColor(60.680, -53.444, 42.096), &D65).equal_within(CIEXYZColor(0.16206, 0.28885, 0.16274), MARGIN));
        assert!(luv_to_xyz(&CIELuvColor(85.181, -74.411, 54.152), &D65).equal_within(CIEXYZColor(0.37714, 0.66363, 0.40521), MARGIN));
        assert!(luv_to_xyz(&CIELuvColor(0.0, 0.0, 0.0), &D65).equal_within(CIEXYZColor(0.0, 0.0, 0.0), MARGIN));
    }
}
