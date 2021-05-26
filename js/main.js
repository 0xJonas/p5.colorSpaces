"use strict"

import init, * as backend from "../pkg/colorspaces.js";

/*
Error messages and logging
*/

const flairs = ["🌈", "🎨", "🌌", "🌠", "✨"];
const LEVEL_INFO = 0;
const LEVEL_WARN = 1;
const LEVEL_ERROR = 2;

function logMessage(message, level) {
  let outFunction = console.log;
  switch(level) {
    case LEVEL_INFO:
      outFunction = console.log;
      break;
    case LEVEL_WARN:
      outFunction = console.warn;
      break;
    case LEVEL_ERROR:
      outFunction = console.error;
      break;
  }

  const flair = flairs[Math.floor(flairs.length * Math.random())];
  console.group(flair + " p5.colorspaces says:");
  outFunction(message);
  console.groupEnd();
}

class ColorSpacesError extends Error {
  constructor(message) {
    super(message);
    const flair = flairs[Math.floor(flairs.length * Math.random())];
    this.name = flair + " p5.colorspaces says";
  }
}

/*
Functions for loading the WASM backend
*/

p5.prototype._cs_backend = null
p5.prototype._cs_wasmModule = null;
p5.prototype._cs_backendLoaded = false;

p5.prototype.loadColorSpaces = async function() {
  // TODO load WASM module dynamically with shared memory
  this._cs_wasmModule = await init();

  p5.prototype._cs_backend = {};
  Object.assign(p5.prototype._cs_backend, backend);

  this._cs_backendLoaded = true;
}

p5.prototype.registerPromisePreload({
  method: "loadColorSpaces",
  target: p5.prototype,
  addCallbacks: true
});

p5.prototype._cs_checkIfBackendLoaded = function() {
  if(!this._cs_backendLoaded) {
    throw new ColorSpacesError("p5.colorspaces backend is not loaded. Please add 'loadColorSpaces()' to your preload() function.");
  }
}

/*
Color space constants
*/

const SRGB = "sRGB";
const LINEAR_RGB = "linear RGB";
const CIEXYZ = "CIEXYZ";
const CIELAB = "CIELab";
const CIELCH = "CIELCh";
const CIELUV = "CIELuv";
const CIELCHUV = "CIELChuv";

p5.prototype.SRGB = SRGB;
p5.prototype.LINEAR_RGB = LINEAR_RGB;
p5.prototype.CIEXYZ = CIEXYZ;
p5.prototype.CIELAB = CIELAB;
p5.prototype.CIELCH = CIELCH;
p5.prototype.CIELUV = CIELUV;
p5.prototype.CIELCHUV = CIELCHUV;

/*
Conversion functions
*/

p5.prototype._cs_currentColorSpace = false;

function convertImageData(imageData, conversionFunc, backend) {
  const imageArray = new Uint8Array(imageData.data.buffer);

  const blockSize = 1024;
  const stripSize = imageArray.length % blockSize;
  const strippedLength = imageArray.length - stripSize;
  let allocation = null;

  try{
    allocation = backend.allocate_buffer(blockSize);
    const wasmMemoryView = backend.get_memory_view(allocation);

    for(let i = 0; i < strippedLength; i += blockSize) {
      const section = imageArray.subarray(i, i + blockSize);
      wasmMemoryView.set(section);
      conversionFunc(allocation);
      section.set(wasmMemoryView);
    }
    const section = imageArray.subarray(strippedLength, imageArray.length);
    wasmMemoryView.set(section);
    conversionFunc(allocation);
    section.set(wasmMemoryView.subarray(0, stripSize));

    return imageData;
  } finally {
    if (allocation != 0) {
      backend.deallocate_buffer(allocation);
    }
  }
}

/*
Converts the whole canvas into a given color space.
*/
p5.prototype.enterColorSpace = function(colorSpace, whitePoint) {
  this._cs_checkIfBackendLoaded();

  const imageData = this.drawingContext.getImageData(0, 0, this.width, this.height);

  let conversionFunc;
  switch(colorSpace) {
    case CIEXYZ:
      conversionFunc = this._cs_backend.convert_memory_srgb_to_xyz;
      break;
    case LINEAR_RGB:
      conversionFunc = this._cs_backend.convert_memory_srgb_to_linear_rgb;
      break;
  }

  convertImageData(imageData, conversionFunc, this._cs_backend);

  this.drawingContext.putImageData(imageData, 0, 0);

  this._cs_currentColorSpace = colorSpace;
}

/*
Converts the canvas back to sRGB.
*/
p5.prototype.exitColorSpace = function() {
  this._cs_checkIfBackendLoaded();

  if(this._cs_currentColorSpace == this.SRGB){
    logMessage("exitColorSpace() was called while not inside of a color space.", LEVEL_WARN);
    return;
  }

  const imageData = this.drawingContext.getImageData(0, 0, this.width, this.height);

  let conversionFunc;
  switch(this._cs_currentColorSpace) {
    case CIEXYZ:
      conversionFunc = this._cs_backend.convert_memory_xyz_to_srgb;
      break;
    case LINEAR_RGB:
      conversionFunc = this._cs_backend.convert_memory_linear_rgb_to_srgb;
      break;
  }

  convertImageData(imageData, conversionFunc, this._cs_backend);

  this.drawingContext.putImageData(imageData, 0, 0);

  this._cs_currentColorSpace = this.SRGB;
}
