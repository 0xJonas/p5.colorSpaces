import * as constants from "./constants.js";
import { D65_2 } from "./whitepoints.js";
import { applyScaling, unapplyScaling, convertColor } from "./colorUtils.js";

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

  if (mode === this.RGB || mode === this.HSB || mode === this.HSL) {
    /*
    Explicitly set the maxes when a native p5.js mode is set, because the
    maxes might have been overridden by one of p5.colorSpaces' modes.
    */
    this._cs_originalColorMode(mode, ...this._cs_inputMaxes[mode]);
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

p5.prototype._cs_originalColor = p5.prototype.color;
p5.prototype.color = function (...args) {
  this._cs_checkIfBackendLoaded();

  /*
  Convert input into a known format.
  */
  let input;
  let inputMode;
  let inputWhite;

  if (args[0] instanceof p5.Color) {
    /*
    Input is a p5.Color object, take components and color space directly from it.
    */
    input = [...args[0]._array];
    inputMode = args[0]._cs_sourceColorSpace || constants.SRGB;
    inputWhite = args[0]._cs_sourceWhitePoint || D65_2;
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
    inputWhite = D65_2;
  }
  else if (args.length < 3 && typeof args[0] == "number") {
    /*
    Color mode is a p5.colorSpaces mode and the input is a single number, representing
    a gray value.
    */
    input = createGrayscaleTristimulus(args[0], this._cs_inputColorSpace, this._cs_inputWhitePoint);
    inputMode = this._cs_inputColorSpace
    inputWhite = this._cs_inputWhitePoint;
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
    inputWhite = this._cs_inputWhitePoint;
  }

  const alpha = input[3];

  const outColor = convertColor(
    input,
    inputMode,
    inputWhite,
    this._cs_mixingColorSpace,
    this._cs_mixingWhitePoint,
    this._cs_backend
  );
  const outColorScaled = applyScaling(outColor, this._cs_mixingColorSpace);

  /*
  Create p5.Color object.
  */
  let storedInputColorSpace = this._cs_inputColorSpace;
  this._cs_originalColorMode(this.RGB, 1.0);
  let outColorP5 = this._cs_originalColor(outColorScaled[0], outColorScaled[1], outColorScaled[2], alpha);
  this.colorMode(storedInputColorSpace);

  outColorP5._cs_sourceColorSpace = this._cs_mixingColorSpace;
  outColorP5._cs_sourceWhitePoint = this._cs_mixingWhitePoint;
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
