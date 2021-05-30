"use strict"

import init, * as backend from "../pkg/colorspaces.js";
import * as msg from "./messages.js";

let semaphore = null;

function semaphoreDown(s) {
  Atomics.sub(s, 0, 1);
}

onmessage = function(e) {
  if (e.data.id == msg.MSG_WASM_MODULE) {
    init(e.data.module, e.data.memory).then(() => {
      postMessage({id: msg.MSG_ACK_WASM_MODULE});
    });
  } else if (e.data.id == msg.MSG_CONVERSION) {
    const func = e.data.func;
    const ptr = e.data.ptr;
    const offset = e.data.offset;
    const len = e.data.len;
    backend[func](ptr, offset, len);
    semaphoreDown(semaphore);
  } else if (e.data.id == msg.MSG_SEMAPHORE) {
    semaphore = new Int32Array(e.data.semaphoreBuffer);
  }
}
