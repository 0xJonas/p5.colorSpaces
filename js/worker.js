"use strict"

import init, * as backend from "../pkg/colorspaces.js";
import * as constants from "./constants.js";

let semaphore = null;

function semaphoreDown(s) {
  Atomics.sub(s, 0, 1);
}

onmessage = function(e) {
  if (e.data.id == constants.MSG_WASM_MODULE) {
    // Message contains a WASM module.
    init(e.data.module, e.data.memory).then(() => {
      postMessage({id: constants.MSG_ACK_WASM_MODULE});
    });
  } else if (e.data.id == constants.MSG_CONVERSION) {
    // Message contains a section of WASM memory to convert, and a conversion function to use.
    const func = e.data.func;
    const ptr = e.data.ptr;
    const offset = e.data.offset;
    const len = e.data.len;
    const whitePoint = e.data.whitePoint;
    backend[func](ptr, offset, len, ...whitePoint);
    semaphoreDown(semaphore);
  } else if (e.data.id == constants.MSG_SEMAPHORE) {
    // Message contains a semaphore.
    semaphore = new Int32Array(e.data.semaphoreBuffer);
  }
}
