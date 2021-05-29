"use strict"

import init, * as backend from "../pkg/colorspaces.js";
import * as msg from "./messages.js";

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
p5.prototype._cs_wasmInstance = null;
p5.prototype._cs_backendLoaded = false;
p5.prototype._cs_wasmMemory = null;
p5.prototype._cs_threads = [];

p5.prototype.loadColorSpaces = async function() {
  const wasmURL = new URL("colorspaces_bg.wasm", import.meta.url);

  const wasmModule = await WebAssembly.compileStreaming(fetch(wasmURL));
  const wasmMemory = new WebAssembly.Memory({initial: 17, maximum: 16384, shared: true});

  // TODO: dynamically figure out memory limits
  this._cs_wasmMemory = wasmMemory;
  this._cs_wasmInstance = await init(wasmModule, this._cs_wasmMemory);

  this._cs_backend = {};
  Object.assign(this._cs_backend, backend);

  const numWorkers = navigator.hardwareConcurrency;
  const workerURL = new URL("worker.js", import.meta.url);
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(workerURL, {name: "thread " + i, type: "module"});
    worker.postMessage({
      id: msg.MSG_WASM_MODULE,
      module: wasmModule,
      memory: wasmMemory
    })
    this._cs_threads.push(worker);
  }

  this._cs_backendLoaded = true;
}

p5.prototype.registerPromisePreload({
  method: "loadColorSpaces",
  target: p5.prototype,
  addCallbacks: true
});

p5.prototype._cs_checkIfBackendLoaded = function() {
  if (!this._cs_backendLoaded) {
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

p5.prototype._cs_allocation_ptr = 0;
p5.prototype._cs_allocation_len = 0;

p5.prototype._cs_ensureAllocationSize = function (len) {
  if (this._cs_allocation_ptr != 0 && this._cs_allocation_len < len) {
    this._cs_backend.deallocate_buffer(this._cs_allocation);
  }

  this._cs_allocation_ptr = this._cs_backend.allocate_buffer(len);
  this._cs_allocation_len = len;
}

p5.prototype._cs_deallocate = function () {
  if (this._cs_allocation) {
    this._cs_backend.deallocate_buffer(this._cs_allocation_ptr, this._cs_allocation_size);
  }
}

p5.prototype.registerMethod("remove", p5.prototype._cs_deallocate);

function convertImageData(imageData, conversionFunc, backend) {
  const imageArray = new Uint8Array(imageData.data.buffer);

  const blockSize = 1024;
  const stripSize = imageArray.length % blockSize;
  const strippedLength = imageArray.length - stripSize;
  let allocation = null;

  try {
    allocation = backend.allocate_buffer(blockSize);
    const wasmMemoryView = backend.get_memory_view(allocation);

    for (let i = 0; i < strippedLength; i += blockSize) {
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

  let conversionFunc;
  switch (colorSpace) {
    case CIEXYZ:
      conversionFunc = "convert_memory_srgb_to_xyz";
      break;
    case LINEAR_RGB:
      conversionFunc = "convert_memory_srgb_to_linear_rgb";
      break;
  }

  const imageData = this.drawingContext.getImageData(0, 0, this.width, this.height);
  const imageArray = new Uint8Array(imageData.data.buffer);
  this._cs_ensureAllocationSize(imageArray.length);

  const wasmMemoryView = this._cs_backend.get_memory_view(this._cs_allocation_ptr, this._cs_allocation_len);
  wasmMemoryView.set(imageArray);

  this._cs_backend[conversionFunc](this._cs_allocation_ptr, 0, imageArray.length);
  imageArray.set(wasmMemoryView);

  this.drawingContext.putImageData(imageData, 0, 0);

  this._cs_currentColorSpace = colorSpace;
}

/*
Converts the canvas back to sRGB.
*/
p5.prototype.exitColorSpace = function() {
  this._cs_checkIfBackendLoaded();

  if (this._cs_currentColorSpace == this.SRGB){
    logMessage("exitColorSpace() was called while not inside of a color space.", LEVEL_WARN);
    return;
  }

  let conversionFunc;
  switch (this._cs_currentColorSpace) {
    case CIEXYZ:
      conversionFunc = "convert_memory_xyz_to_srgb";
      break;
    case LINEAR_RGB:
      conversionFunc = "convert_memory_linear_rgb_to_srgb";
      break;
  }

  const imageData = this.drawingContext.getImageData(0, 0, this.width, this.height);
  const imageArray = new Uint8Array(imageData.data.buffer);
  this._cs_ensureAllocationSize(imageArray.length);

  const wasmMemoryView = this._cs_backend.get_memory_view(this._cs_allocation_ptr, this._cs_allocation_len);
  wasmMemoryView.set(imageArray);

  this._cs_backend[conversionFunc](this._cs_allocation_ptr, 0, imageArray.length);
  imageArray.set(wasmMemoryView);

  this.drawingContext.putImageData(imageData, 0, 0);

  this._cs_currentColorSpace = this.SRGB;
}
