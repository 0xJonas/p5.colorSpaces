"use strict"

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

p5.prototype._cs_backend = {};
p5.prototype._cs_backendLoaded = false;

p5.prototype.loadColorSpaces = async function() {
  this._cs_backend = await import("../pkg/index.js");
  this._cs_backendLoaded = true;
}

// p5.prototype.loadColorSpaces = async function() {
//   const x = await import("../pkg/index.js");

//   //TODO: Add check for SIMD 
//   //const wasmModule = "colorspacesSIMD.wasm";
//   const wasmModule = "colorspaces.wasm";

//   // Load WASM module from the same location as the script
//   const scriptURL = new URL(import.meta.url);
//   const scriptPath = scriptURL.pathname;
//   const pathEnd = scriptPath.lastIndexOf("/");
//   const wasmPath = scriptPath.substring(0, pathEnd + 1) + wasmModule;
//   const wasmURL = new URL(wasmPath, scriptURL.origin);
//   const wasmRequest = new Request(wasmURL, {
//     cache: "no-cache" //TODO: remove
//   });
  
//   // Compile and instantiate WASM
//   const module = await WebAssembly.instantiateStreaming(fetch(wasmRequest));
//   Object.assign(this._cs_backend, module.instance.exports);

//   backendColorSpaces[this.SRGB] = this._cs_backend.SRGB.value;
//   backendColorSpaces[this.LINEAR_RGB] = this._cs_backend.LINEAR_RGB.value;
//   backendColorSpaces[this.CIEXYZ] = this._cs_backend.CIEXYZ.value;
//   backendColorSpaces[this.CIELAB] = this._cs_backend.CIELAB.value;
//   backendColorSpaces[this.CIELCH] = this._cs_backend.CIELCH.value;
//   backendColorSpaces[this.CIELUV] = this._cs_backend.CIELUV.value;
//   backendColorSpaces[this.CIELCHUV] = this._cs_backend.CIELCHUV.value;

//   this._cs_backendLoaded = true;
// }

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

const backendColorSpaces = {};

/*
Conversion functions
*/

p5.prototype._cs_currentColorSpace = false;

function convertToColorSpace(colorSpace, src, dst, backend) {
  const wasmStartAddress = 256;
  const blockSize = 256;
  const stripSize = src.length % blockSize;
  const strippedLength = src.length - stripSize;
  const wasmMemory = new Uint32Array(backend.memory.buffer).subarray(wasmStartAddress / 4, wasmStartAddress / 4 + blockSize);
  const colorSpaceIndex = backendColorSpaces[colorSpace];

  // TODO: Setup white point
  for(let i = 0; i < strippedLength; i += blockSize) {
    wasmMemory.set(src.subarray(i, i + blockSize));
    backend.convertToColorSpace(colorSpaceIndex, wasmStartAddress, blockSize * 4);
    dst.set(wasmMemory, i);
  }

  wasmMemory.set(src.subarray(strippedLength));
  backend.convertToColorSpace(colorSpaceIndex, wasmStartAddress, stripSize * 4);
  dst.set(wasmMemory.subarray(0, stripSize), strippedLength);
}

function convertToSRGB(colorSpace, src, dst, backend) {
  const wasmStartAddress = 256;
  const blockSize = 256;
  const stripSize = src.length % blockSize;
  const strippedLength = src.length - stripSize;
  const wasmMemory = new Uint32Array(backend.memory.buffer).subarray(wasmStartAddress / 4, wasmStartAddress / 4 + blockSize);
  const colorSpaceIndex = backendColorSpaces[colorSpace];

  // TODO: Setup white point
  for(let i = 0; i < strippedLength; i += blockSize) {
    wasmMemory.set(src.subarray(i, i + blockSize));
    backend.convertToSRGB(colorSpaceIndex, wasmStartAddress, blockSize * 4);
    dst.set(wasmMemory, i);
  }

  wasmMemory.set(src.subarray(strippedLength));
  backend.convertToSRGB(colorSpaceIndex, wasmStartAddress, stripSize * 4);
  dst.set(wasmMemory.subarray(0, stripSize), strippedLength);
}

/*
Converts the whole canvas into a given color space.
*/
p5.prototype.enterColorSpace = function(colorSpace, whitePoint) {
  this._cs_checkIfBackendLoaded();

  const imageData = this.drawingContext.getImageData(0, 0, this.width, this.height);
  const imageArray = new Uint8Array(imageData.data.buffer);

  // convertToColorSpace(colorSpace, imageArray, imageArray, this._cs_backend);
  let convertFunc;
  switch(colorSpace) {
    case CIEXYZ:
      convertFunc = this._cs_backend.convert_memory_srgb_to_xyz;
      break;
    case LINEAR_RGB:
      convertFunc = this._cs_backend.convert_memory_srgb_to_linear_rgb;
      break;
  }

  const blockSize = 256;
  const stripSize = imageArray.length % blockSize;
  const strippedLength = imageArray.length - stripSize;
  let allocation = null;

  try {
    allocation = this._cs_backend.allocate_buffer(blockSize);
    const wasmMemoryView = this._cs_backend.get_memory_view(allocation);

    for(let i = 0; i < strippedLength; i += blockSize) {
      const section = imageArray.subarray(i, i + blockSize);
      wasmMemoryView.set(section);
      convertFunc(allocation);
      section.set(wasmMemoryView);
    }
    const section = imageArray.subarray(strippedLength, imageArray.length);
    wasmMemoryView.set(section);
    convertFunc(allocation);
    section.set(wasmMemoryView.subarray(0, stripSize));

    this.drawingContext.putImageData(imageData, 0, 0);

    this._cs_currentColorSpace = colorSpace;
  } finally {
    if (allocation) {
      this._cs_backend.deallocate_buffer(allocation);
    }
  }
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
  const imageArray = new Uint8Array(imageData.data.buffer);
  // convertToSRGB(this._cs_currentColorSpace, imageArray, imageArray, this._cs_backend);

  let convertFunc;
  switch(this._cs_currentColorSpace) {
    case CIEXYZ:
      convertFunc = this._cs_backend.convert_memory_xyz_to_srgb;
      break;
    case LINEAR_RGB:
      convertFunc = this._cs_backend.convert_memory_linear_rgb_to_srgb;
      break;
  }

  const blockSize = 256;
  const stripSize = imageArray.length % blockSize;
  const strippedLength = imageArray.length - stripSize;
  let allocation = null;

  try{
    allocation = this._cs_backend.allocate_buffer(blockSize);
    const wasmMemoryView = this._cs_backend.get_memory_view(allocation);

    for(let i = 0; i < strippedLength; i += blockSize) {
      const section = imageArray.subarray(i, i + blockSize);
      wasmMemoryView.set(section);
      convertFunc(allocation);
      section.set(wasmMemoryView);
    }
    const section = imageArray.subarray(strippedLength, imageArray.length);
    wasmMemoryView.set(section);
    convertFunc(allocation);
    section.set(wasmMemoryView.subarray(0, stripSize));

    this.drawingContext.putImageData(imageData, 0, 0);

    this._cs_currentColorSpace = this.SRGB;
  } finally {
    if (allocation != 0) {
      this._cs_backend.deallocate_buffer(allocation);
    }
  }
}
