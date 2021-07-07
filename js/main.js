"use strict"

import init, * as backend from "../pkg/colorspaces.js";
import * as constants from "./constants.js";
import * as white from "./whitepoints.js";
import "./colorFunctions.js";
import "./colorQuery.js";

import vertexShaderSource from "./shaders/vertexShader.glsl";
import srgb2xyzSource from "./shaders/srgb2xyz.glsl";
import xyz2srgbSource from "./shaders/xyz2srgb.glsl";

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

/*
Initializes the library. This function loads the WASM backend as well as setup up
the worker threads.
*/
p5.prototype.loadColorSpaces = async function() {
  const wasmURL = new URL("colorspaces_bg.wasm", import.meta.url);

  // Prepare compiled module and memory so that they can be sent to the worker threads.
  const wasmModule = await WebAssembly.compileStreaming(fetch(wasmURL));
  // TODO: dynamically figure out memory limits
  const wasmMemory = new WebAssembly.Memory({initial: 17, maximum: 16384, shared: true});

  // Instantiate main thread module and initialize wasm-bindgen bindings.
  this._cs_wasmMemory = wasmMemory;
  this._cs_wasmInstance = await init(wasmModule, this._cs_wasmMemory);
  this._cs_backend = {};
  Object.assign(this._cs_backend, backend);

  // Mark the backend as loaded
  this._cs_backendLoaded = true;
}

p5.prototype.registerPromisePreload({
  method: "loadColorSpaces",
  target: p5.prototype,
  addCallbacks: true
});

/*
Checks if the WASM backend is loaded and raises an Error if it is not.
*/
p5.prototype._cs_checkIfBackendLoaded = function() {
  if (!this._cs_backendLoaded) {
    throw new ColorSpacesError("p5.colorspaces backend is not loaded. Please add 'loadColorSpaces()' to your preload() function.");
  }
}

/*
Color space constants
*/

p5.prototype.SRGB = constants.SRGB;
p5.prototype.LINEAR_RGB = constants.LINEAR_RGB;
p5.prototype.CIEXYZ = constants.CIEXYZ;
p5.prototype.CIELAB = constants.CIELAB;
p5.prototype.CIELCH = constants.CIELCH;
p5.prototype.CIELUV = constants.CIELUV;
p5.prototype.CIELCHUV = constants.CIELCHUV;

Object.assign(p5.prototype, white);

/*
Conversion functions
*/

p5.prototype._cs_mixingColorSpace = constants.SRGB;
p5.prototype._cs_mixingWhitePoint = white.D65_2;

p5.prototype._cs_conversionPrograms = {};
p5.prototype._cs_offscreenGraphics = null;
p5.prototype._cs_canvasTexture = null;
p5.prototype._cs_webglWidth = 0;
p5.prototype._cs_webglHeight = 0;
p5.prototype._cs_vertexShader = null;
p5.prototype._cs_vertexBuffer = null;

function loadShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new ColorSpacesError(error);
  }

  return shader;
}

function createProgramFromShaders(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new ColorSpacesError(error);
  }

  return program;
}

function setupVertexBuffer(gl) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const vertices = new Float32Array([
    -1.0, -1.0,
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  return buffer;
}

function setupVertexAttribute(gl, program, buffer) {
  const attribLocation = gl.getAttribLocation(program, "vertexCoords");
  gl.enableVertexAttribArray(attribLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(attribLocation, 2, gl.FLOAT, false, 0, 0);
}

p5.prototype._cs_loadColorSpace = function (colorSpace) {
  let sourceA;
  let sourceB;
  switch(colorSpace) {
    case constants.CIEXYZ: {
      sourceA = srgb2xyzSource;
      sourceB = xyz2srgbSource;
      break;
    }
  }

  const gl = this._cs_offscreenGraphics.drawingContext;

  let fragmentShaderA;
  let fragmentShaderB;
  let programA;
  let programB;
  try {
    fragmentShaderA = loadShader(gl, sourceA, gl.FRAGMENT_SHADER);
    fragmentShaderB = loadShader(gl, sourceB, gl.FRAGMENT_SHADER);

    if (!this._cs_vertexShader) {
      this._cs_vertexShader = loadShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    }

    programA = createProgramFromShaders(gl, this._cs_vertexShader, fragmentShaderA);
    programB = createProgramFromShaders(gl, this._cs_vertexShader, fragmentShaderB);

    if (!this._cs_vertexBuffer) {
      this._cs_vertexBuffer = setupVertexBuffer(gl);
    }

    setupVertexAttribute(gl, programA, this._cs_vertexBuffer);
    setupVertexAttribute(gl, programB, this._cs_vertexBuffer);

    this._cs_conversionPrograms[colorSpace] = {
      toColorSpace: programA,
      toSRGB: programB
    };
  } catch (error) {
    if (programB) {
      gl.deleteProgram(programB);
    }
    if (programA) {
      gl.deleteProgram(programA);
    }
    if (fragmentShaderB) {
      gl.deleteShader(fragmentShaderB);
    }
    if (fragmentShaderA) {
      gl.deleteShader(fragmentShaderA);
    }

    throw error;
  }
}

function setupTexture(gl) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

p5.prototype.prepareForColorSpace = function(colorSpace, whitePoint) {
  if (!this._cs_offscreenGraphics) {
    this._cs_offscreenGraphics = this.createGraphics(this.width, this.height, this.WEBGL);
    this._cs_webglWidth = this.width;
    this._cs_webglHeight = this.height;
  } else if (this.width != this._cs_webglWidth || this.height != this._cs_webglHeight) {
    this._cs_offscreenGraphics.resize(this.width, this.height);
    this._cs_webglWidth = this.width;
    this._cs_webglHeight = this.height;
  }

  if (!this._cs_canvasTexture) {
    this._cs_canvasTexture = setupTexture(this._cs_offscreenGraphics.drawingContext);
  }

  if (!this._cs_conversionPrograms[colorSpace]) {
    this._cs_loadColorSpace(colorSpace);
  }
}

/*
Converts the whole canvas into a given color space.
*/
p5.prototype.enterColorSpace = function(colorSpace, whitePoint) {
  this.prepareForColorSpace(colorSpace, whitePoint);

  const gl = this._cs_offscreenGraphics.drawingContext;

  gl.useProgram(this._cs_conversionPrograms[colorSpace].toColorSpace);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this._cs_canvasTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.drawingContext.canvas);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.flush();

  this.push();
  this.resetMatrix();
  this.drawingContext.drawImage(this._cs_offscreenGraphics.drawingContext.canvas, 0, 0);
  this.pop();

  this._cs_mixingColorSpace = colorSpace;
  this._cs_mixingWhitePoint = whitePoint;
}

/*
Converts the canvas back to sRGB.
*/
p5.prototype.exitColorSpace = function() {
  this.prepareForColorSpace(this._cs_mixingColorSpace, this._cs_mixingWhitePoint);

  const gl = this._cs_offscreenGraphics.drawingContext;

  gl.useProgram(this._cs_conversionPrograms[this._cs_mixingColorSpace].toSRGB);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this._cs_canvasTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.drawingContext.canvas);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.flush();

  this.push();
  this.resetMatrix();
  this.drawingContext.drawImage(this._cs_offscreenGraphics.drawingContext.canvas, 0, 0);
  this.pop();
  
  this._cs_mixingColorSpace = this.SRGB;
}

/*
Sets the current color space and white point without actually converting anything.

This function should be used when the entire canvas is redrawn each frame.
*/
p5.prototype.warpToColorSpace = function (colorSpace, whitePoint) {
  this._cs_mixingColorSpace = colorSpace;
  if (whitePoint) {
    this._cs_mixingWhitePoint = white.D65_2;
  }
}
