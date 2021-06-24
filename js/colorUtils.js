import { D65_2 } from "./whitepoints.js";
import * as constants from "./constants.js";

/*
Converts a color tuple into the CIEXYZ color space.

@param input color tuple.
@param sourceColorSpace Color space of the input tuple.
@param sourceWhite CIExyY color representing the reference white point of the input, if required.
@param backend WASM backend.
*/
function colorSpaceToXYZ(input, sourceColorSpace, sourceWhite, backend) {
  let inputWASM;
  let sourceWhiteXYZ;
  try{
    const [chromaX, chromaY, y] = sourceWhite;
    sourceWhiteXYZ = new backend.CIEXYZColor(
      chromaX / chromaY * y,
      y,
      (1.0 - chromaX - chromaY) / chromaY * y
    );

    let out;
    switch (sourceColorSpace) {
      case constants.SRGB:
        inputWASM = new backend.SRGBColor(input[0], input[1], input[2]);
        out = backend.srgb_to_xyz(inputWASM);
        break;
      case constants.LINEAR_RGB:
        inputWASM = new backend.LinearRGBColor(input[0], input[1], input[2]);
        out = backend.linear_rgb_to_xyz(inputWASM);
        break;
      case constants.CIEXYZ:
        out = new backend.CIEXYZColor(input[0], input[1], input[2]);
        break;
      case constants.CIELAB:
        inputWASM = new backend.CIELabColor(input[0], input[1], input[2]);
        out = backend.lab_to_xyz(inputWASM, sourceWhiteXYZ);
        break;
    }

    return out;
  } finally {
    if (sourceWhiteXYZ) {
      sourceWhiteXYZ.free();
    }
    if (inputWASM) {
      inputWASM.free();
    }
  }
}

/*
Converts a CIEXYZ color into another color space.

@param xyzColor input CIEXYZ color.
@param targetColorSpace Color space to convert the input color to.
@param targetWhite CIExyY color to be used as a reference white point, if required.
@param backend WASM backend.
*/
function XYZToColorSpace(xyzColor, targetColorSpace, targetWhite, backend) {
  let targetWhiteXYZ;
  let outWasm;
  try {
    const [chromaX, chromaY, y] = targetWhite;
    targetWhiteXYZ = new backend.CIEXYZColor(
      chromaX / chromaY * y,
      y,
      (1.0 - chromaX - chromaY) / chromaY * y
    );

    switch (targetColorSpace) {
      case constants.SRGB:
        outWasm = backend.xyz_to_srgb(xyzColor);
        break;
      case constants.LINEAR_RGB:
        outWasm = backend.xyz_to_linear_rgb(xyzColor);
        break;
      case constants.CIEXYZ:
        // Clone the color because the caller of this function expects a different object from the
        // input to be returned.
        outWasm = new backend.CIEXYZColor(xyzColor[0], xyzColor[1], xyzColor[2]);
        break;
      case constants.CIELAB:
        outWasm = backend.xyz_to_lab(xyzColor, targetWhiteXYZ);
        break;
    }
   
    return [outWasm[0], outWasm[1], outWasm[2]];
  } finally {
    if (outWasm) {
      outWasm.free();
    }
    if (targetWhiteXYZ) {
      targetWhiteXYZ.free();
    }
  }
}

/*
Maps a color tuple in a given color space from the range [0; 1] into 
the color space's native range.
*/
export function unapplyScaling(input, colorSpace) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return [input[0], input[1], input[2], input[3]];
    case constants.CIEXYZ:
      return [input[0] * 0.95047, input[1], input[2] * 1.08883, input[3]];
    case constants.CIELAB:
      return [input[0] * 100.0, (input[1] * 255) - 128, (input[2] * 255) - 128, input[3]];
  }
}

/*
Maps a color tuple in a given color space into the range [0; 1].
Each color space has it's own scale factors and offsets for this.
*/
export function applyScaling(input, colorSpace) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return [input[0], input[1], input[2], input[3]];
    case constants.CIEXYZ:
      return [input[0] / 0.95047, input[1], input[2] / 1.08883, input[3]];
    case constants.CIELAB:
      return [input[0] / 100.0, (input[1] + 128) / 255, (input[2] + 128) / 255, input[3]];
  }
}

export function convertColor(color, sourceColorSpace, sourceWhitePoint, targetColorSpace, targetWhitePoint, backend) {
  let xyzColor;

  try {
    xyzColor = colorSpaceToXYZ(color, sourceColorSpace, sourceWhitePoint, backend);
    const outColor = XYZToColorSpace(xyzColor, targetColorSpace, targetWhitePoint, backend);

    return [outColor[0], outColor[1], outColor[2], color[3]];
  } finally {
    if (xyzColor) {
      xyzColor.free();
    }
  }
}
