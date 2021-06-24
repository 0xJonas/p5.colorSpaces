import { applyScaling, unapplyScaling, convertColor } from "./colorUtils.js";
import * as constants from "./constants.js";
import { D65_2 } from "./whitepoints.js";

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
  if (!(colorArgs[0] instanceof p5.Color)) {
    colorObj = this.color(...colorArgs);
  } else {
    colorObj = colorArgs[0];
  }

  if (!colorObj[constants.SRGB]) {
    const sourceColorSpace = colorObj._cs_sourceColorSpace || constants.SRGB;
    const sourceWhitePoint = colorObj._cs_sourceWhitePoint || D65_2;
    colorObj[constants.SRGB] = convertColor(
      unapplyScaling(colorObj._array, sourceColorSpace),
      sourceColorSpace,
      sourceWhitePoint,
      constants.SRGB,
      D65_2,
      backend
    );
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
