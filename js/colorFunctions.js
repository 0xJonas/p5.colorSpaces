import * as constants from "./constants.js";
import { D65_2 } from "./whitepoints.js";

/*
Overrides for p5.js color functions
*/

p5.prototype._cs_inputColorSpace = p5.prototype.RGB;
p5.prototype._cs_inputWhitePoint = D65_2;
p5.prototype._cs_inputMaxes = {
  [p5.prototype.RGB]: [255.0, 255.0, 255.0, 255.0],
  [p5.prototype.HSB]: [360.0, 100.0, 100.0, 1.0],
  [p5.prototype.HSL]: [360.0, 100.0, 100.0, 1.0],
  [constants.SRGB]: [1.0, 1.0, 1.0, 1.0],
  [constants.LINEAR_RGB]: [1.0, 1.0, 1.0, 1.0],
  [constants.CIEXYZ]: [1.0, 1.0, 1.0, 1.0],
  [constants.CIELAB]: [1.0, 1.0, 1.0, 1.0],
  [constants.CIELUV]: [1.0, 1.0, 1.0, 1.0],
  [constants.CIELCH]: [1.0, 1.0, 1.0, 1.0],
  [constants.CIELCHUV]: [1.0, 1.0, 1.0, 1.0]
};

p5.prototype._cs_originalColorMode = p5.prototype.colorMode;
p5.prototype.colorMode = function (...args) {
  let mode;
  let white;
  
  if (args[0] instanceof Array) {
    mode = args[0][0];
    white = args[0][1];
  } else {
    mode = args[0];
    white = this._cs_inputWhitePoint;
  }

  let maxes = this._cs_inputMaxes[mode];
  switch (args.length) {
    case 2:
      const max = args[1];
      maxes = [max, max, max, max];
      break;
    case 4:
      maxes = [args[1], args[2], args[3], maxes[4]];
      break;
    case 5:
      maxes = [args[1], args[2], args[3], args[4]];
      break;
  }
  this._cs_inputMaxes[mode] = maxes;

  if (mode === this.RGB) {
    /*
    Explicitly set the maxes when p5.js's RGB mode is set, because the
    maxes might have been overridden by one of p5.colorSpaces' modes.
    */
    this._cs_originalColorMode(this.RGB, ...this._cs_inputMaxes[this.RGB]);
  } else if (mode === this.HSB || mode === this.HSL) {
    /*
    Do nothing special for p5js's HSV and HSB modes.
    */
    this._cs_originalColorMode(mode, ...maxes);
  } else {
    /*
    All p5.colorSpaces color modes use p5.js's RGB mode under the hood,
    with maxes at all 1.0s.
    */
    this._cs_originalColorMode(this.RGB, 1.0, 1.0, 1.0, 1.0);
  }
  this._cs_inputColorSpace = mode;
  this._cs_inputWhitePoint = white;
}

/*
Creates a grayscale color for a given gray value and color space.
*/
function createGrayscaleTristimulus(gray, colorSpace, white) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return [gray, gray, gray, 1.0];
    case constants.CIEXYZ:
      const [chromaX, chromaY, y] = white;
      return [chromaX / chromaY * y * gray, y * gray, (1.0 - chromaX - chromaY) / chromaY * y * gray, 1.0];
    case constants.CIELAB:
    case constants.CIELCH:
    case constants.CIELUV:
    case constants.CIELCHUV:
      return [gray, 0.0, 0.0, 1.0];
  }
}

/*
Maps a color tuple in a given color space from the range [0; 1] into 
the color space's native range.
*/
function unapplyScaling(input, colorSpace) {
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
  try {
    const [chromaX, chromaY, y] = targetWhite;
    targetWhiteXYZ = new backend.CIEXYZColor(
      chromaX / chromaY * y,
      y,
      (1.0 - chromaX - chromaY) / chromaY * y
    );

    let out;
    switch (targetColorSpace) {
      case constants.SRGB:
        out = backend.xyz_to_srgb(xyzColor);
        break;
      case constants.LINEAR_RGB:
        out = backend.xyz_to_linear_rgb(xyzColor);
        break;
      case constants.CIEXYZ:
        // Clone the color because the caller of this function expects a different object from the
        // input to be returned.
        out = new backend.CIEXYZColor(xyzColor[0], xyzColor[1], xyzColor[2]);
        break;
      case constants.CIELAB:
        out = backend.xyz_to_lab(xyzColor, targetWhiteXYZ);
        break;
    }

    return out;
  } finally {
    if (targetWhiteXYZ) {
      targetWhiteXYZ.free();
    }
  }
}

/*
Maps a color tuple in a given color space into the range [0; 1].
Each color space has it's own scale factors and offsets for this.
*/
function applyScaling(input, colorSpace) {
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

p5.prototype._cs_originalColor = p5.prototype.color;
p5.prototype.color = function (...args) {
  this._cs_checkIfBackendLoaded();

  /*
  Convert input into a known format.
  */
  let input;
  let inputMode;

  if (args[0] instanceof p5.Color) {
    /*
    Input is a p5.Color object, take components and color space directly from it.
    */
    input = [...args[0]._array];
    inputMode = args[0]._cs_sourceColorSpace || constants.SRGB;
    input = unapplyScaling(input, inputMode);
  }
  else if (this._cs_inputColorSpace == this.RGB || this._cs_inputColorSpace == this.HSL || this._cs_inputColorSpace == this.HSB) {
    /*
    Input is ...something. Whatever it is, the current colorMode is one of the native p5.js modes,
    so use the original p5.color function to parse it.
    Take the rgba components from the resulting color object.
    */
    const parsedInput = this._cs_originalColor(...args);
    input = [...parsedInput._array];
    inputMode = constants.SRGB;
  }
  else if (args.length < 3 && typeof args[0] == "number") {
    /*
    Color mode is a p5.colorSpaces mode and the input is a single number, representing
    a gray value.
    */
    input = createGrayscaleTristimulus(args[0], this._cs_inputColorSpace, this._cs_inputWhitePoint);
    inputMode = this._cs_inputColorSpace
  }
  else if (args.length >= 3 && typeof args[0] == "number" && typeof args[1] == "number" && typeof args[2] == "number") {
    /*
    Input is a tristimulus value suitable for p5.colorSpaces
    */
    input = args;
    // Add alpha if not provided.
    if (args.length <= 3) {
      input.push(1.0);
    }
    inputMode = this._cs_inputColorSpace
  }

  const alpha = input[3];

  let xyzColor;
  let outColor;
  try {
    /*
    Convert from input color space to CIEXYZ.
    */
    xyzColor = colorSpaceToXYZ(input, inputMode, this._cs_inputWhitePoint, this._cs_backend);

    /*
    Convert from CIEXYZ to mixing color space.
    */
    outColor = XYZToColorSpace(xyzColor, this._cs_mixingColorSpace, this._cs_mixingWhitePoint, this._cs_backend);
    const outColorScaled = applyScaling(outColor, this._cs_mixingColorSpace);

    /*
    Create p5.Color object.
    */
    let storedColorMode = this._cs_inputColorSpace;
    this.colorMode(this._cs_mixingColorSpace)
    let outColorP5 = this._cs_originalColor(outColorScaled[0], outColorScaled[1], outColorScaled[2], alpha);
    this.colorMode(storedColorMode);

    outColorP5._cs_sourceColorSpace = this._cs_mixingColorSpace;
    outColorP5._cs_sourceWhitePoint = this._cs_mixingWhitePoint;
    return outColorP5;
  } finally {
    if (outColor) {
      outColor.free();
    }
    if (xyzColor) {
      xyzColor.free();
    }
  } 
}

p5.prototype._cs_originalFill = p5.prototype.fill;
p5.prototype.fill = function (...args) {
  return this._cs_originalFill(this.color(...args));
}

p5.prototype._cs_originalStroke = p5.prototype.stroke;
p5.prototype.stroke = function (...args) {
  return this._cs_originalStroke(this.color(...args));
}

p5.prototype._cs_originalBackground = p5.prototype.background;
p5.prototype.background = function (...args) {
  return this._cs_originalBackground(this.color(...args));
}

function convertColor(color, targetColorSpace, targetWhitePoint, backend) {
  let sourceColorSpace = color._cs_sourceColorSpace || constants.SRGB;
  let sourceWhitePoint = color._cs_sourceWhitePoint || D65_2;

  let xyzColor;
  let outColor;

  try {
    const scaledColor = unapplyScaling(color._array, sourceColorSpace);
    const xyzColor = colorSpaceToXYZ(scaledColor, sourceColorSpace, sourceWhitePoint, backend);
    const outColor = XYZToColorSpace(xyzColor, targetColorSpace, targetWhitePoint, backend);

    return [outColor[0], outColor[1], outColor[2], color[3]];
  } finally {
    if (outColor) {
      outColor.free();
    }
    if (xyzColor) {
      xyzColor.free();
    }
  }
}

function calcHSL(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;

  if (min == 1.0) {
    // White, return immediately to prevent division by 0 later.
    return [0.0, 0.0, 1.0]
  } else if (max == 0.0) {
    // Black, return immediately to prevent division by 0 later.
    return [0.0, 0.0, 0.0]
  } else {
    let hue = 0.0;

    if (chroma == 0) {
      hue = 0.0;
    } else if (max == r) {
      hue = ((g - b) / chroma + 6) % 6;
    } else if (max == g) {
      hue = (b - r) / chroma + 2;
    } else {
      hue = (r - g) / chroma + 4;
    }

    return [hue / 6.0, chroma / (1 - Math.abs(2 * lightness - 1)), lightness];
  } 
}

function calcHSB(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  let hue = 0.0;
  if (max == 0) {
    // Black, return immediately to prevent division by 0 later.
    return [0, 0, 0];
  } else if (chroma == 0) {
    hue = 0.0;
  } else if (max == r) {
    hue = ((g - b) / chroma + 6) % 6;
  } else if (max == g) {
    hue = (b - r) / chroma + 2;
  } else {
    hue = (r - g) / chroma + 4;
  }

  return [hue / 6.0, chroma / max, max];
}

p5.prototype._cs_ensureP5ColorWithSRGB = function (colorArgs, backend) {
  let colorObj;
  if (!(colorArgs instanceof p5.Color)) {
    colorObj = this.color(...colorArgs);
  } else {
    colorObj = colorArgs;
  }

  if (!colorObj[constants.SRGB]) {
    colorObj[constants.SRGB] = convertColor(colorObj, constants.SRGB, D65_2, backend);
  }

  return colorObj;
}

p5.prototype._cs_originalRed = p5.prototype.red;
p5.prototype.red = function (...args) {
  this._cs_checkIfBackendLoaded();
  const colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);
  return colorObj[constants.SRGB][0] * this._cs_inputMaxes[p5.prototype.RGB][0];
}

p5.prototype._cs_originalGreen = p5.prototype.green;
p5.prototype.green = function (...args) {
  this._cs_checkIfBackendLoaded();
  const colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);
  return colorObj[constants.SRGB][1] * this._cs_inputMaxes[p5.prototype.RGB][1];
}

p5.prototype._cs_originalBlue = p5.prototype.blue;
p5.prototype.blue = function (...args) {
  this._cs_checkIfBackendLoaded();
  const colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);
  return colorObj[constants.SRGB][2] * this._cs_inputMaxes[p5.prototype.RGB][2];
}

p5.prototype._cs_originalHue = p5.prototype.hue;
p5.prototype.hue = function (...args) {
  this._cs_checkIfBackendLoaded();
  const colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);

  if (this._cs_inputColorSpace == this.HSB) {
    if (!colorObj._cs_hsb) { 
      colorObj._cs_hsb = calcHSB(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
    }
    return colorObj._cs_hsb[0] * this._cs_inputMaxes[this.HSB][0];
  } else {
    if (!colorObj._cs_hsl) { 
      colorObj._cs_hsl = calcHSL(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
    }
    return colorObj._cs_hsl[0] * this._cs_inputMaxes[this.HSL][0];
  }
}

p5.prototype._cs_originalSaturation = p5.prototype.saturation;
p5.prototype.saturation = function (...args) {
  this._cs_checkIfBackendLoaded();
  let colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);

  if (this._cs_inputColorSpace == this.HSB) {
    if (!colorObj._cs_hsb) { 
      colorObj._cs_hsb = calcHSB(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
    }
    return colorObj._cs_hsb[1] * this._cs_inputMaxes[this.HSB][1];
  } else {
    if (!colorObj._cs_hsl) { 
      colorObj._cs_hsl = calcHSL(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
    }
    return colorObj._cs_hsl[1] * this._cs_inputMaxes[this.HSL][1];
  }
}

p5.prototype._cs_originalLightness = p5.prototype.lightness;
p5.prototype.lightness = function (...args) {
  this._cs_checkIfBackendLoaded();
  let colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);

  if (!colorObj._cs_hsl) { 
    colorObj._cs_hsl = calcHSL(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
  }
  return colorObj._cs_hsl[2] * this._cs_inputMaxes[this.HSL][2];
}

p5.prototype._cs_originalBrightness = p5.prototype.brightness;
p5.prototype.brightness = function (...args) {
  this._cs_checkIfBackendLoaded();
  let colorObj = this._cs_ensureP5ColorWithSRGB(args, this._cs_backend);

  if (!colorObj._cs_hsb) { 
    colorObj._cs_hsb = calcHSB(colorObj[constants.SRGB][0], colorObj[constants.SRGB][1], colorObj[constants.SRGB][2]);
  }
  return colorObj._cs_hsb[2] * this._cs_inputMaxes[this.HSB][2];
}
