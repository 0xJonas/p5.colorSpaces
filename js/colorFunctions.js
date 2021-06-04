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
    // Store maxes for RGB because the override for color() needs to know these
    // in case of weird inputs.
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

p5.prototype._cs_originalColor = p5.prototype.color;
p5.prototype.color = function (...args) {
  /*
  Short-circuit if the input already is a p5.Color instance.
  This is necessary because the red(), green() and blue() functions
  called further down internally use color(), which would lead to
  infinite recursion.
  */
  if (args[0] instanceof p5.Color) {
    return args[0];
  }

  /*
  Convert input into a known format.
  */
  let input;
  let inputMode = this._cs_currentColorMode;
  if (inputMode == this.RGB || inputMode == this.HSL || inputMode == this.HSB) { 
    inputMode = constants.SRGB;
    const parsedInput = this._cs_originalColor(...args);
    const maxes = this._cs_currentRGBMaxes;
    input = [
      this.red(parsedInput) / maxes[0],
      this.green(parsedInput) / maxes[1],
      this.blue(parsedInput) / maxes[2],
      this.alpha(parsedInput) / maxes[3]
    ];
  } else if (args.length < 3 && typeof args[0] == "number") {
    input = createGrayscaleTristimulus(args[0], this._cs_currentColorMode);
  } else {
    // input is already a tristimulus values suitable for p5.colorSpaces
    input = args;
    if (args.length == 3) {
      input.push(1.0);
    }
  }

  const alpha = input[3];

  /*
  Convert to CIEXYZ
  */
  let xyzColor;
  const [chromaX, chromaY, y] = this._cs_currentWhitePoint;
  const whiteXYZ = new this._cs_backend.CIEXYZColor(chromaX / chromaY * y, y, (1.0 - chromaX - chromaY) / chromaY * y);
  switch (inputMode) {
    case constants.SRGB:
      const srgb = new this._cs_backend.SRGBColor(input[0], input[1], input[2]);
      xyzColor = this._cs_backend.srgb_to_xyz(srgb);
      break;
    case constants.LINEAR_RGB:
      const linRGB = new this._cs_backend.LinearRGBColor(input[0], input[1], input[2]);
      xyzColor = this._cs_backend.linear_rgb_to_xyz(linRGB);
      break;
    case constants.CIEXYZ:
      xyzColor = new this._cs_backend.CIEXYZColor(input[0], input[1], input[2]);
      break;
    case constants.CIELAB:
      const lab = new this._cs_backend.CIELabColor(input[0], input[1], input[2]);
      xyzColor = this._cs_backend.lab_to_xyz(lab, whiteXYZ);
      break;
  }

  /*
  Convert to target color space
  */
  let outColor;
  let storedColorMode = this._cs_currentColorMode;
  this.colorMode(this._cs_currentColorSpace)
  switch (this._cs_currentColorSpace) {
    case constants.SRGB:
      const rgb = this._cs_backend.xyz_to_srgb(xyzColor);
      outColor = this._cs_originalColor(rgb[0], rgb[1], rgb[2], alpha);
      break;
    case constants.LINEAR_RGB:
      const rgbLin = this._cs_backend.xyz_to_linear_rgb(xyzColor);
      outColor = this._cs_originalColor(rgbLin[0], rgbLin[1], rgbLin[2], alpha);
      break;
    case constants.CIEXYZ:
      const xyz = xyzColor;
      outColor = this._cs_originalColor(xyz[0] / 0.95047, xyz[1], xyz[2] / 1.08883, alpha);
      break;
    case constants.CIELAB:
      const lab = this._cs_backend.xyz_to_lab(xyzColor, whiteXYZ);
      outColor = this._cs_originalColor(lab[0] / 100.0, (lab[1] + 128.0) / 255.0, (lab[2] + 128.0) / 255.0, alpha);
      break;
  }
  this.colorMode(storedColorMode);

  return outColor;
}

p5.prototype._cs_originalFill = p5.prototype.fill;
p5.prototype.fill = function (...args) {
  return this._cs_originalFill(this.color(...args));
}

p5.prototype._cs_originalStroke = p5.prototype.stroke;
p5.prototype.stroke = function (...args) {
  return this._cs_originalStroke(this.color(...args));
}
