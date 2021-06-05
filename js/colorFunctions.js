import * as constants from "./constants.js";

/*
Overrides for p5.js color functions
*/

p5.prototype._cs_currentColorMode = p5.prototype.RGB;
p5.prototype._cs_currentRGBMaxes = [255.0, 255.0, 255.0, 255.0];

p5.prototype._cs_originalColorMode = p5.prototype.colorMode;
p5.prototype.colorMode = function (...args) {
  const mode = args[0];
  
  if (mode == p5.prototype.RGB) {
    // Store maxes for RGB because we override them for p5.colorSpaces Colors
    switch (args.length) {
      case 2:
        const max = args[1];
        this._cs_currentRGBMaxes = [max, max, max, max];
        break;
      case 4:
        this._cs_currentRGBMaxes = [args[1], args[2], args[3], 255.0];
        break;
      case 5:
        this._cs_currentRGBMaxes = [args[1], args[2], args[3], args[4]];
        break;
    }
  }

  if (mode === this.RGB) {
    this._cs_originalColorMode(this.RGB, ...this._cs_currentRGBMaxes);
  } else if (mode === this.HSV || mode === this.HSL) {
    this._cs_originalColorMode(...args);
  } else {
    this._cs_originalColorMode(this.RGB, 1.0, 1.0, 1.0, 1.0);
  }
  this._cs_currentColorMode = mode;
}

function createGrayscaleTristimulus(gray, colorSpace) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return [gray, gray, gray, 1.0];
    case constants.CIEXYZ:
      return [0.0, gray, 0.0, 1.0];
    case constants.CIELAB:
    case constants.CIELCH:
    case constants.CIELUV:
    case constants.CIELCHUV:
      return [gray, 0.0, 0.0, 1.0];
  }
}

function unapplyScaling(input, colorSpace) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return input;
    case constants.CIEXYZ:
      return [input[0] * 0.95047, input[1], input[2] * 1.08883, input[3]];
    case constants.CIELAB:
      return [input[0] * 100.0, (input[1] * 255) - 128, (input[2] * 255) - 128, input[3]];
  }
}

function colorSpaceToXYZ(input, colorSpace, whiteXYZ, backend) {
  switch (colorSpace) {
    case constants.SRGB:
      const srgb = new backend.SRGBColor(input[0], input[1], input[2]);
      return backend.srgb_to_xyz(srgb);
    case constants.LINEAR_RGB:
      const linRGB = new backend.LinearRGBColor(input[0], input[1], input[2]);
      return backend.linear_rgb_to_xyz(linRGB);
    case constants.CIEXYZ:
      return new backend.CIEXYZColor(input[0], input[1], input[2]);
    case constants.CIELAB:
      const lab = new backend.CIELabColor(input[0], input[1], input[2]);
      return backend.lab_to_xyz(lab, whiteXYZ);
  }
}

function XYZToColorSpace(xyzColor, colorSpace, whiteXYZ, backend) {
  switch (colorSpace) {
    case constants.SRGB:
      return backend.xyz_to_srgb(xyzColor);
    case constants.LINEAR_RGB:
      return backend.xyz_to_linear_rgb(xyzColor);
    case constants.CIEXYZ:
      return xyzColor;
    case constants.CIELAB:
      return backend.xyz_to_lab(xyzColor, whiteXYZ);
  }
}

function applyScaling(input, colorSpace) {
  switch (colorSpace) {
    case constants.SRGB:
    case constants.LINEAR_RGB:
      return input;
    case constants.CIEXYZ:
      return [input[0] / 0.95047, input[1], input[2] / 1.08883, input[3]];
    case constants.CIELAB:
      return [input[0] / 100.0, (input[1] + 128) / 255, (input[2] + 128) / 255, input[3]];
  }
}

p5.prototype._cs_originalColor = p5.prototype.color;
p5.prototype.color = function (...args) {
  /*
  Convert input into a known format.
  */
  let input;
  let inputMode;

  if (args[0] instanceof p5.Color) {
    input = [...args[0]._array];
    inputMode = args[0]._cs_sourceColorSpace || constants.SRGB;
    input = unapplyScaling(input, inputMode);
  } else if (this._cs_currentColorMode == this.RGB || this._cs_currentColorMode == this.HSL || this._cs_currentColorMode == this.HSB) { 
    const parsedInput = this._cs_originalColor(...args);
    input = [...parsedInput._array];
    inputMode = constants.SRGB;
  } else if (args.length < 3 && typeof args[0] == "number") {
    input = createGrayscaleTristimulus(args[0], this._cs_currentColorMode);
    inputMode = this._cs_currentColorMode
  } else {
    // input is already a tristimulus values suitable for p5.colorSpaces
    input = args;
    if (args.length == 3) {
      input.push(1.0);
    }
    inputMode = this._cs_currentColorMode
  }

  const alpha = input[3];

  /*
  Convert to CIEXYZ
  */
  const [chromaX, chromaY, y] = this._cs_currentWhitePoint;
  const whiteXYZ = new this._cs_backend.CIEXYZColor(chromaX / chromaY * y, y, (1.0 - chromaX - chromaY) / chromaY * y);
  const xyzColor = colorSpaceToXYZ(input, inputMode, whiteXYZ, this._cs_backend);

  /*
  Convert to target color space
  */
  let outColor = XYZToColorSpace(xyzColor, this._cs_currentColorSpace, whiteXYZ, this._cs_backend);
  outColor = applyScaling(outColor, this._cs_currentColorSpace);

  let storedColorMode = this._cs_currentColorMode;
  this.colorMode(this._cs_currentColorSpace)
  let outColorP5 = this._cs_originalColor(outColor[0], outColor[1], outColor[2], alpha);
  this.colorMode(storedColorMode);

  outColorP5._cs_sourceColorSpace = this._cs_currentColorSpace;
  return outColorP5;
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
