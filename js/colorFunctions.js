import * as constants from "./constants.js";
import { D65_2 } from "./whitepoints.js";

/*
Overrides for p5.js color functions
*/

p5.prototype._cs_inputColorSpace = p5.prototype.RGB;
p5.prototype._cs_inputWhitePoint = D65_2;
p5.prototype._cs_currentRGBMaxes = [255.0, 255.0, 255.0, 255.0];

p5.prototype._cs_originalColorMode = p5.prototype.colorMode;
p5.prototype.colorMode = function (...args) {
  let mode;
  let white;
  
  if (typeof args[0] == "object") {
    mode = args[0][1];
    white = args[0][1];
  } else {
    mode = args[0];
    white = this._cs_inputWhitePoint;
  }

  if (mode == p5.prototype.RGB) {
    // Store maxes for RGB because we override them for p5.colorSpaces Colors
    switch (args.length) {
      /*
      When no values for the maxes are given, p5.js reuses the last values that were submitted to colorMode().
      (i.e. it does not use a default value of 255 or alike.)

      The maxes for p5.RGB, p5.HSV and p5.HSB are also all separate values.
      */
      case 2:
        const max = args[1];
        this._cs_currentRGBMaxes = [max, max, max, max];
        break;
      case 4:
        this._cs_currentRGBMaxes = [args[1], args[2], args[3], this._cs_currentRGBMaxes[4]];
        break;
      case 5:
        this._cs_currentRGBMaxes = [args[1], args[2], args[3], args[4]];
        break;
    }
  }

  if (mode === this.RGB) {
    /*
    Explicitly set the maxes when p5.js's RGB mode is set, because the
    maxes might have been overridden by one of p5.colorSpaces' modes.
    */
    this._cs_originalColorMode(this.RGB, ...this._cs_currentRGBMaxes);
  } else if (mode === this.HSV || mode === this.HSL) {
    /*
    Do nothing special for p5js's HSV and HSB modes.
    */
    this._cs_originalColorMode(...args);
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

/*
Maps a color tuple in a given color space from the range [0; 1] into 
the color space's native range.
*/
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

/*
Converts a color tuple into the CIEXYZ color space.

@param input color tuple.
@param sourceColorSpace Color space of the input tuple.
@param whiteXYZ CIEXYZ color representing the reference white point of the input, if required.
@param backend WASM backend.
*/
function colorSpaceToXYZ(input, sourceColorSpace, sourceWhiteXYZ, backend) {
  switch (sourceColorSpace) {
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
      return backend.lab_to_xyz(lab, sourceWhiteXYZ);
  }
}

/*
Converts a CIEXYZ color into another color space.

@param xyzColor input CIEXYZ color.
@param targetColorSpace Color space to convert the input color to.
@param targetWhiteXYZ CIEXYZ color to be used as a reference white point, if required.
@param backend WASM backend.
*/
function XYZToColorSpace(xyzColor, targetColorSpace, targetWhiteXYZ, backend) {
  switch (targetColorSpace) {
    case constants.SRGB:
      return backend.xyz_to_srgb(xyzColor);
    case constants.LINEAR_RGB:
      return backend.xyz_to_linear_rgb(xyzColor);
    case constants.CIEXYZ:
      return xyzColor;
    case constants.CIELAB:
      return backend.xyz_to_lab(xyzColor, targetWhiteXYZ);
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
    input = createGrayscaleTristimulus(args[0], this._cs_inputColorSpace);
    inputMode = this._cs_inputColorSpace
  }
  else if (args.length >= 3 && typeof args[0] == "number" && typeof args[1] == "number" && typeof args[2] == "number" && typeof args[3] == "number") {
    /*
    Input is a tristimulus value suitable for p5.colorSpaces
    */
    input = args;
    // Add alpha if not provided.
    if (args.length == 3) {
      input.push(1.0);
    }
    inputMode = this._cs_inputColorSpace
  }

  const alpha = input[3];

  /*
  Convert from input color space to CIEXYZ.
  */
  const [inputChromaX, inputChromaY, inputY] = this._cs_inputWhitePoint;
  const inputWhiteXYZ = new this._cs_backend.CIEXYZColor(
    inputChromaX / inputChromaY * inputY,
    inputY,
    (1.0 - inputChromaX - inputChromaY) / inputChromaY * inputY
  );
  const xyzColor = colorSpaceToXYZ(input, inputMode, inputWhiteXYZ, this._cs_backend);

  /*
  Convert from CIEXYZ to mixing color space.
  */
  const [mixingChromaX, mixingChromaY, mixingY] = this._cs_inputWhitePoint;
  const mixingWhiteXYZ = new this._cs_backend.CIEXYZColor(
    mixingChromaX / mixingChromaY * mixingY,
    mixingY,
    (1.0 - mixingChromaX - mixingChromaY) / mixingChromaY * mixingY
  );
  let outColor = XYZToColorSpace(xyzColor, this._cs_mixingColorSpace, mixingWhiteXYZ, this._cs_backend);
  outColor = applyScaling(outColor, this._cs_mixingColorSpace);

  /*
  Create p5.Color object.
  */
  let storedColorMode = this._cs_inputColorSpace;
  this.colorMode(this._cs_mixingColorSpace)
  let outColorP5 = this._cs_originalColor(outColor[0], outColor[1], outColor[2], alpha);
  this.colorMode(storedColorMode);

  outColorP5._cs_sourceColorSpace = this._cs_mixingColorSpace;
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
