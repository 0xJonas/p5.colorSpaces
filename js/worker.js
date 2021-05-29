"use strict"

import init, * as backend from "../pkg/colorspaces.js";
import * as msg from "./messages.js";

onmessage = function(e) {
    if (e.data.id == msg.MSG_WASM_MODULE) {
        init(e.data.module, e.data.memory);
    } else if (e.data.id == msg.MSG_CONVERSION) {
        const func = e.data.func;
        const ptr = e.data.ptr;
        const offset = e.data.offset;
        const len = e.data.len;
        backend[func](ptr, offset, len);
    }
}
