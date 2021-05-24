use crate::TristimulusColor;

use wasm_bindgen::prelude::*;

const CORRECTION_FACTORS_12TH_ROOT: [f32; 23] = [
    0.5297315471796477,
    0.5612310241546865,
    0.5946035575013605, 
    0.6299605249474366, 
    0.6674199270850172, 
    0.7071067811865476, 
    0.7491535384383408, 
    0.7937005259840998, 
    0.8408964152537145, 
    0.8908987181403393, 
    0.9438743126816935, 
    1.0,
    1.0594630943592953,
    1.122462048309373,
    1.189207115002721,
    1.2599210498948732, 
    1.3348398541700344, 
    1.4142135623730951, 
    1.4983070768766815, 
    1.5874010519681994, 
    1.681792830507429, 
    1.7817974362806785, 
    1.887748625363387
];

const CORRECTION_FACTORS_5TH_ROOT: [f32; 9] = [
    0.5743491774985174, 
    0.6597539553864471, 
    0.757858283255199, 
    0.8705505632961241, 
    1.0, 
    1.148698354997035, 
    1.3195079107728942, 
    1.515716566510398, 
    1.7411011265922482
];

#[wasm_bindgen]
#[derive(Debug, Copy, Clone)]
pub struct SRGBColor(pub f32, pub f32, pub f32);

impl TristimulusColor for SRGBColor {

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
#[derive(Debug, Copy, Clone)]
pub struct LinearRGBColor(pub f32, pub f32, pub f32);

impl TristimulusColor for LinearRGBColor {

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
#[derive(Debug, Copy, Clone)]
pub struct CIEXYZColor(pub f32, pub f32, pub f32);

impl TristimulusColor for CIEXYZColor {

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
pub fn srgb_gamma(val: f32) -> f32 {
    if val <= 0.0031308 {
        return val * 12.92;
    } else {
        let float_bits: u32 = f32::to_bits(val);
        let exponent: i32 = ((float_bits >> 23) & 0xff) as i32 - 126;
        let new_float_bits: u32 = (float_bits & 0x807fffff) | 0x3f000000;
        let x: f32 = f32::from_bits(new_float_bits);

        let y = ((((x * 0.06740218964272982 - 0.31414927092326544) * 
                    x + 0.6193915145851007) *
                        x - 0.6838657745157206) * 
                            x + 0.5125530264346017) * 
                                x + 0.798668892157733;
        
        let exponent_new = exponent / 12;
        let correction_shift = f32::from_bits(((exponent_new as u32 + 127) & 0xff) << 23);
        let correction_index = ((exponent - exponent_new * 12) + 11) as usize;
        let correction_factor = CORRECTION_FACTORS_12TH_ROOT[correction_index];
        let twelfth_root = y * correction_shift * correction_factor;

        let gamma_part = twelfth_root * twelfth_root;
        let gamma_part = gamma_part * gamma_part * twelfth_root;

        return gamma_part * 1.055 - 0.055;
    }
}

#[wasm_bindgen]
pub fn srgb_digamma(val: f32) -> f32 {
    if val <= 0.04045 {
        return val / 12.92;
    } else {
        let digamma_part = (val + 0.055) / 1.055;
        let float_bits: u32 = f32::to_bits(digamma_part);
        let exponent: i32 = ((float_bits >> 23) & 0xff) as i32 - 126;
        let new_float_bits: u32 = (float_bits & 0x807fffff) | 0x3f000000;
        let x: f32 = f32::from_bits(new_float_bits);

        let y = ((((x * 0.11857729282950705 - 0.5561006058653446) * 
                    x + 1.108062007906361) *
                        x - 1.2505477535604077) * 
                            x + 1.0085571210525826) * 
                                x + 0.5714529292453215;
        
        let exponent_new = exponent / 5;
        let correction_shift = f32::from_bits(((exponent_new as u32 + 127) & 0xff) << 23);
        let correction_index = ((exponent - exponent_new * 5) + 4) as usize;
        let correction_factor = CORRECTION_FACTORS_5TH_ROOT[correction_index];
        let fifth_root = y * correction_shift * correction_factor;

        let digamma = fifth_root * fifth_root * fifth_root;
        let digamma = digamma * digamma;
        let digamma = digamma * digamma;

        return digamma;
    }
}

#[wasm_bindgen]
pub fn srgb_to_linear_rgb(srgb: SRGBColor) -> LinearRGBColor {
    let SRGBColor(r, g, b) = srgb;
    LinearRGBColor(
        srgb_digamma(r),
        srgb_digamma(g),
        srgb_digamma(b),
    )
}

#[wasm_bindgen]
pub fn linear_rgb_to_srgb(lin_rgb: LinearRGBColor) -> SRGBColor {
    let LinearRGBColor(lin_r, lin_g, lin_b) = lin_rgb;
    SRGBColor(
        srgb_gamma(lin_r),
        srgb_gamma(lin_g),
        srgb_gamma(lin_b),
    )
}

#[wasm_bindgen]
pub fn srgb_to_xyz(rgb: SRGBColor) -> CIEXYZColor {
    let SRGBColor(r, g, b) = rgb;
    let r_lin = srgb_digamma(r);
    let g_lin = srgb_digamma(g);
    let b_lin = srgb_digamma(b);
    
    CIEXYZColor(
        r_lin * 0.4123907992659594812888840055 + g_lin * 0.3575843393838779637292839034 + b_lin * 0.1804807884018342875046284426,
        r_lin * 0.2126390058715103575395808154 + g_lin * 0.7151686787677559274585678068 + b_lin * 0.07219231536073371500185137706,
        r_lin * 0.01933081871559185068541643776 + g_lin * 0.1191947797946259879097613012 + b_lin * 0.9505321522496605808577097982
    )
}

#[wasm_bindgen]
pub fn xyz_to_srgb(xyz: CIEXYZColor) -> SRGBColor {
    let CIEXYZColor(x, y, z) = xyz;
    SRGBColor(
        srgb_gamma(x * 3.240969941904521343773680225 + y * -1.537383177570093457943925235 + z * -0.4986107602930032836574892651),
        srgb_gamma(x * -0.9692436362808798261285146964 + y * 1.875967501507720667721122882 + z * 0.04155505740717561247596181202),
        srgb_gamma(x * 0.05563007969699360845892843062 + y * -0.2039769588889765643494042455 + z * 1.056971514242878560719640180)
    )
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::CompareMargin;

    const MARGIN: f32 = 1.0e-3;

    #[test]
    fn test_srgb_to_xyz() {
        assert!(srgb_to_xyz(SRGBColor(0.0, 128.0_f32 / 255.0, 1.0)).equal_within(CIEXYZColor(0.25769, 0.2266, 0.9762), MARGIN));
        assert!(srgb_to_xyz(SRGBColor(20.0 / 255.0, 30.0 / 255.0, 100.0 / 255.0)).equal_within(CIEXYZColor(0.0305, 0.02, 0.1228), MARGIN));
        assert!(srgb_to_xyz(SRGBColor(1.0, 1.0, 1.0)).equal_within(CIEXYZColor(0.9505, 1.0, 1.089), MARGIN));
    }

    #[test]
    fn test_xyz_to_srgb() {
        assert!(xyz_to_srgb(CIEXYZColor(0.25769, 0.22658, 0.97623)).equal_within(SRGBColor(0.0, 128.0_f32 / 255.0, 1.0), MARGIN));
        assert!(xyz_to_srgb(CIEXYZColor(0.0305, 0.02, 0.1228)).equal_within(SRGBColor(20.0 / 255.0, 30.0 / 255.0, 100.0 / 255.0), MARGIN));
        assert!(xyz_to_srgb(CIEXYZColor(0.9505, 1.0, 1.089)).equal_within(SRGBColor(1.0, 1.0, 1.0), MARGIN));
    }

    #[test]
    fn test_srgb_to_linear_rgb() {
        assert!(srgb_to_linear_rgb(SRGBColor(0.0, 128.0_f32 / 255.0, 1.0)).equal_within(LinearRGBColor(0.0, 0.21586, 1.0), MARGIN));
        assert!(srgb_to_linear_rgb(SRGBColor(20.0 / 255.0, 30.0 / 255.0, 100.0 / 255.0)).equal_within(LinearRGBColor(0.0069954, 0.012983, 0.12743768), MARGIN));
        assert!(srgb_to_linear_rgb(SRGBColor(1.0, 1.0, 1.0)).equal_within(LinearRGBColor(1.0, 1.0, 1.0), MARGIN));
    }

    #[test]
    fn test_linear_rgb_to_srgb() {
        assert!(linear_rgb_to_srgb(LinearRGBColor(0.0, 0.21586, 1.0)).equal_within(SRGBColor(0.0, 128.0_f32 / 255.0, 1.0), MARGIN));
        assert!(linear_rgb_to_srgb(LinearRGBColor(0.0069954, 0.012983, 0.12743768)).equal_within(SRGBColor(20.0 / 255.0, 30.0 / 255.0, 100.0 / 255.0), MARGIN));
        assert!(linear_rgb_to_srgb(LinearRGBColor(1.0, 1.0, 1.0)).equal_within(SRGBColor(1.0, 1.0, 1.0), MARGIN));
    }
}

