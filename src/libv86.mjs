var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/const.js
var LOG_ALL = -1;
var LOG_CPU = 2;
var LOG_FPU = 4;
var LOG_MEM = 8;
var LOG_DMA = 16;
var LOG_IO = 32;
var LOG_PS2 = 64;
var LOG_PIC = 128;
var LOG_VGA = 256;
var LOG_PIT = 512;
var LOG_MOUSE = 1024;
var LOG_PCI = 2048;
var LOG_BIOS = 4096;
var LOG_FLOPPY = 8192;
var LOG_SERIAL = 16384;
var LOG_DISK = 32768;
var LOG_RTC = 65536;
var LOG_ACPI = 262144;
var LOG_APIC = 524288;
var LOG_NET = 1048576;
var LOG_VIRTIO = 2097152;
var LOG_9P = 4194304;
var LOG_SB16 = 8388608;
var LOG_FETCH = 16777216;
var LOG_NAMES = [
  [1, ""],
  [LOG_CPU, "CPU"],
  [LOG_DISK, "DISK"],
  [LOG_FPU, "FPU"],
  [LOG_MEM, "MEM"],
  [LOG_DMA, "DMA"],
  [LOG_IO, "IO"],
  [LOG_PS2, "PS2"],
  [LOG_PIC, "PIC"],
  [LOG_VGA, "VGA"],
  [LOG_PIT, "PIT"],
  [LOG_MOUSE, "MOUS"],
  [LOG_PCI, "PCI"],
  [LOG_BIOS, "BIOS"],
  [LOG_FLOPPY, "FLOP"],
  [LOG_SERIAL, "SERI"],
  [LOG_RTC, "RTC"],
  [LOG_ACPI, "ACPI"],
  [LOG_APIC, "APIC"],
  [LOG_NET, "NET"],
  [LOG_VIRTIO, "VIO"],
  [LOG_9P, "9P"],
  [LOG_SB16, "SB16"],
  [LOG_FETCH, "FETC"]
];
var FLAG_CARRY = 1;
var FLAG_PARITY = 4;
var FLAG_ADJUST = 16;
var FLAG_ZERO = 64;
var FLAG_SIGN = 128;
var FLAG_TRAP = 256;
var FLAG_INTERRUPT = 512;
var FLAG_DIRECTION = 1024;
var FLAG_OVERFLOW = 2048;
var FLAG_IOPL = 1 << 12 | 1 << 13;
var FLAG_NT = 1 << 14;
var FLAG_RF = 1 << 16;
var FLAG_VM = 1 << 17;
var FLAG_AC = 1 << 18;
var FLAG_VIF = 1 << 19;
var FLAG_VIP = 1 << 20;
var FLAG_ID = 1 << 21;
var FLAGS_DEFAULT = 1 << 1;
var REG_EAX = 0;
var REG_ECX = 1;
var REG_EDX = 2;
var REG_EBX = 3;
var REG_ESP = 4;
var REG_EBP = 5;
var REG_ESI = 6;
var REG_EDI = 7;
var REG_ES = 0;
var REG_CS = 1;
var REG_SS = 2;
var REG_DS = 3;
var REG_FS = 4;
var REG_GS = 5;
var REG_LDTR = 7;
var MMAP_BLOCK_BITS = 17;
var MMAP_BLOCK_SIZE = 1 << MMAP_BLOCK_BITS;
var MMAP_MAX = 4294967296;
var CR0_PG = 1 << 31;
var CR4_PAE = 1 << 5;
var FW_CFG_SIGNATURE = 0;
var FW_CFG_ID = 1;
var FW_CFG_RAM_SIZE = 3;
var FW_CFG_NB_CPUS = 5;
var FW_CFG_MAX_CPUS = 15;
var FW_CFG_NUMA = 13;
var FW_CFG_FILE_DIR = 25;
var FW_CFG_CUSTOM_START = 32768;
var FW_CFG_FILE_START = 49152;
var FW_CFG_SIGNATURE_QEMU = 1431127377;
var WASM_TABLE_SIZE = 900;
var WASM_TABLE_OFFSET = 1024;
var MIXER_CHANNEL_LEFT = 0;
var MIXER_CHANNEL_RIGHT = 1;
var MIXER_CHANNEL_BOTH = 2;
var MIXER_SRC_MASTER = 0;
var MIXER_SRC_PCSPEAKER = 1;
var MIXER_SRC_DAC = 2;

// src/log.js
if (false) {
  globalThis.DEBUG = true;
}
var LOG_TO_FILE = false;
var LOG_LEVEL = LOG_ALL & ~LOG_PS2 & ~LOG_PIT & ~LOG_VIRTIO & ~LOG_9P & ~LOG_PIC & ~LOG_DMA & ~LOG_SERIAL & ~LOG_NET & ~LOG_FLOPPY & ~LOG_DISK & ~LOG_VGA & ~LOG_SB16;
function set_log_level(level) {
  LOG_LEVEL = level;
}
var log_data = [];
function do_the_log(message) {
  if (LOG_TO_FILE) {
    log_data.push(message, "\n");
  } else {
    console.log(message);
  }
}
var dbg_log = (function() {
  if (true) {
    return function() {
    };
  }
  const dbg_names = LOG_NAMES.reduce(function(a, x) {
    a[x[0]] = x[1];
    return a;
  }, {});
  var log_last_message = "";
  var log_message_repetitions = 0;
  function dbg_log_(stuff, level) {
    if (true) return;
    level = level || 1;
    if (level & LOG_LEVEL) {
      var level_name = dbg_names[level] || "", message = "[" + pads(level_name, 4) + "] " + stuff;
      if (message === log_last_message) {
        log_message_repetitions++;
        if (log_message_repetitions < 2048) {
          return;
        }
      }
      var now = /* @__PURE__ */ new Date();
      var time_str = pad0(now.getHours(), 2) + ":" + pad0(now.getMinutes(), 2) + ":" + pad0(now.getSeconds(), 2) + "+" + pad0(now.getMilliseconds(), 3) + " ";
      if (log_message_repetitions) {
        if (log_message_repetitions === 1) {
          do_the_log(time_str + log_last_message);
        } else {
          do_the_log("Previous message repeated " + log_message_repetitions + " times");
        }
        log_message_repetitions = 0;
      }
      do_the_log(time_str + message);
      log_last_message = message;
    }
  }
  return dbg_log_;
})();
function dbg_trace(level) {
  if (true) return;
  dbg_log(Error().stack, level);
}
function dbg_assert(cond, msg, level) {
  if (true) return;
  if (!cond) {
    dbg_assert_failed(msg);
  }
}
function dbg_assert_failed(msg) {
  debugger;
  console.trace();
  if (msg) {
    throw "Assert failed: " + msg;
  } else {
    throw "Assert failed";
  }
}

// src/lib.js
function pads(str, len) {
  str = str || str === 0 ? str + "" : "";
  return str.padEnd(len, " ");
}
function pad0(str, len) {
  str = str || str === 0 ? str + "" : "";
  return str.padStart(len, "0");
}
var view = function(constructor, memory, offset, length) {
  dbg_assert(offset >= 0);
  return new Proxy(
    {},
    {
      get: function(target, property, receiver) {
        const b = new constructor(memory.buffer, offset, length);
        const x = b[property];
        if (typeof x === "function") {
          return x.bind(b);
        }
        dbg_assert(/^\d+$/.test(property) || property === "buffer" || property === "length" || property === "BYTES_PER_ELEMENT" || property === "byteOffset");
        return x;
      },
      set: function(target, property, value, receiver) {
        dbg_assert(/^\d+$/.test(property));
        new constructor(memory.buffer, offset, length)[property] = value;
        return true;
      }
    }
  );
};
function h(n, len) {
  if (!n) {
    var str = "";
  } else {
    var str = n.toString(16);
  }
  return "0x" + pad0(str.toUpperCase(), len || 1);
}
function hex_dump(buffer) {
  function hex(n, len) {
    return pad0(n.toString(16).toUpperCase(), len);
  }
  const result = [];
  let offset = 0;
  for (; offset + 15 < buffer.length; offset += 16) {
    let line2 = hex(offset, 5) + "   ";
    for (let j = 0; j < 16; j++) {
      line2 += hex(buffer[offset + j], 2) + " ";
    }
    line2 += "  ";
    for (let j = 0; j < 16; j++) {
      const x = buffer[offset + j];
      line2 += x >= 33 && x !== 34 && x !== 92 && x <= 126 ? String.fromCharCode(x) : ".";
    }
    result.push(line2);
  }
  let line = hex(offset, 5) + "   ";
  for (; offset < buffer.length; offset++) {
    line += hex(buffer[offset], 2) + " ";
  }
  const remainder = offset & 15;
  line += "   ".repeat(16 - remainder);
  line += "  ";
  for (let j = 0; j < remainder; j++) {
    const x = buffer[offset + j];
    line += x >= 33 && x !== 34 && x !== 92 && x <= 126 ? String.fromCharCode(x) : ".";
  }
  result.push(line);
  return "\n" + result.join("\n") + "\n";
}
var get_rand_int;
if (typeof crypto !== "undefined" && crypto.getRandomValues) {
  const rand_data = new Int32Array(1);
  get_rand_int = function() {
    crypto.getRandomValues(rand_data);
    return rand_data[0];
  };
} else if (typeof __require !== "undefined") {
  const crypto2 = __require("crypto");
  get_rand_int = function() {
    return crypto2.randomBytes(4)["readInt32LE"](0);
  };
} else if (typeof process !== "undefined") {
  import("node:crypto").then((crypto2) => {
    get_rand_int = function() {
      return crypto2["randomBytes"](4)["readInt32LE"](0);
    };
  });
} else {
  dbg_assert(false, "Unsupported platform: No cryptographic random values");
}
var int_log2;
if (typeof Math.clz32 === "function" && Math.clz32(0) === 32 && Math.clz32(74565) === 15 && Math.clz32(-1) === 0) {
  int_log2 = function(x) {
    dbg_assert(x > 0);
    return 31 - Math.clz32(x);
  };
} else {
  int_log2_table = new Int8Array(256);
  for (i = 0, b = -2; i < 256; i++) {
    if (!(i & i - 1))
      b++;
    int_log2_table[i] = b;
  }
  int_log2 = function(x) {
    x >>>= 0;
    dbg_assert(x > 0);
    var tt = x >>> 16;
    if (tt) {
      var t = tt >>> 8;
      if (t) {
        return 24 + int_log2_table[t];
      } else {
        return 16 + int_log2_table[tt];
      }
    } else {
      var t = x >>> 8;
      if (t) {
        return 8 + int_log2_table[t];
      } else {
        return int_log2_table[x];
      }
    }
  };
}
var int_log2_table;
var i;
var b;
var round_up_to_next_power_of_2 = function(x) {
  dbg_assert(x >= 0);
  return x <= 1 ? 1 : 1 << 1 + int_log2(x - 1);
};
if (false) {
  dbg_assert(int_log2(1) === 0);
  dbg_assert(int_log2(2) === 1);
  dbg_assert(int_log2(7) === 2);
  dbg_assert(int_log2(8) === 3);
  dbg_assert(int_log2(123456789) === 26);
  dbg_assert(round_up_to_next_power_of_2(0) === 1);
  dbg_assert(round_up_to_next_power_of_2(1) === 1);
  dbg_assert(round_up_to_next_power_of_2(2) === 2);
  dbg_assert(round_up_to_next_power_of_2(7) === 8);
  dbg_assert(round_up_to_next_power_of_2(8) === 8);
  dbg_assert(round_up_to_next_power_of_2(123456789) === 134217728);
}
function ByteQueue(size) {
  var data = new Uint8Array(size), start, end;
  dbg_assert((size & size - 1) === 0);
  this.length = 0;
  this.push = function(item) {
    if (this.length === size) {
    } else {
      this.length++;
    }
    data[end] = item;
    end = end + 1 & size - 1;
  };
  this.shift = function() {
    if (!this.length) {
      return -1;
    } else {
      var item = data[start];
      start = start + 1 & size - 1;
      this.length--;
      return item;
    }
  };
  this.peek = function() {
    if (!this.length) {
      return -1;
    } else {
      return data[start];
    }
  };
  this.clear = function() {
    start = 0;
    end = 0;
    this.length = 0;
  };
  this.clear();
}
function FloatQueue(size) {
  this.size = size;
  this.data = new Float32Array(size);
  this.start = 0;
  this.end = 0;
  this.length = 0;
  dbg_assert((size & size - 1) === 0);
}
FloatQueue.prototype.push = function(item) {
  if (this.length === this.size) {
    this.start = this.start + 1 & this.size - 1;
  } else {
    this.length++;
  }
  this.data[this.end] = item;
  this.end = this.end + 1 & this.size - 1;
};
FloatQueue.prototype.shift = function() {
  if (!this.length) {
    return void 0;
  } else {
    var item = this.data[this.start];
    this.start = this.start + 1 & this.size - 1;
    this.length--;
    return item;
  }
};
FloatQueue.prototype.shift_block = function(count) {
  var slice = new Float32Array(count);
  if (count > this.length) {
    count = this.length;
  }
  var slice_end = this.start + count;
  var partial = this.data.subarray(this.start, slice_end);
  slice.set(partial);
  if (slice_end >= this.size) {
    slice_end -= this.size;
    slice.set(this.data.subarray(0, slice_end), partial.length);
  }
  this.start = slice_end;
  this.length -= count;
  return slice;
};
FloatQueue.prototype.peek = function() {
  if (!this.length) {
    return void 0;
  } else {
    return this.data[this.start];
  }
};
FloatQueue.prototype.clear = function() {
  this.start = 0;
  this.end = 0;
  this.length = 0;
};
function CircularQueue(size) {
  this.data = [];
  this.index = 0;
  this.size = size;
}
CircularQueue.prototype.add = function(item) {
  this.data[this.index] = item;
  this.index = (this.index + 1) % this.size;
};
CircularQueue.prototype.toArray = function() {
  return [].slice.call(this.data, this.index).concat([].slice.call(this.data, 0, this.index));
};
CircularQueue.prototype.clear = function() {
  this.data = [];
  this.index = 0;
};
CircularQueue.prototype.set = function(new_data) {
  this.data = new_data;
  this.index = 0;
};
function dump_file(ab, name) {
  if (!Array.isArray(ab)) {
    ab = [ab];
  }
  var blob = new Blob(ab);
  download(blob, name);
}
function download(file_or_blob, name) {
  var a = document.createElement("a");
  a["download"] = name;
  a.href = window.URL.createObjectURL(file_or_blob);
  a.dataset["downloadurl"] = ["application/octet-stream", a["download"], a.href].join(":");
  if (document.createEvent) {
    var ev = document.createEvent("MouseEvent");
    ev.initMouseEvent(
      "click",
      true,
      true,
      window,
      0,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );
    a.dispatchEvent(ev);
  } else {
    a.click();
  }
  window.URL.revokeObjectURL(a.href);
}
var Bitmap = function(length_or_buffer) {
  if (typeof length_or_buffer === "number") {
    this.view = new Uint8Array(length_or_buffer + 7 >> 3);
  } else if (length_or_buffer instanceof ArrayBuffer) {
    this.view = new Uint8Array(length_or_buffer);
  } else {
    dbg_assert(false, "Bitmap: Invalid argument");
  }
};
Bitmap.prototype.set = function(index, value) {
  const bit_index = index & 7;
  const byte_index = index >> 3;
  const bit_mask = 1 << bit_index;
  this.view[byte_index] = value ? this.view[byte_index] | bit_mask : this.view[byte_index] & ~bit_mask;
};
Bitmap.prototype.get = function(index) {
  const bit_index = index & 7;
  const byte_index = index >> 3;
  return this.view[byte_index] >> bit_index & 1;
};
Bitmap.prototype.get_buffer = function() {
  return this.view.buffer;
};
var load_file;
var get_file_size;
if (typeof XMLHttpRequest === "undefined" || typeof process !== "undefined" && process.versions && process.versions.node) {
  let fs;
  load_file = async function(filename, options, n_tries) {
    if (!fs) {
      fs = await import("node:fs/promises");
    }
    if (options.range) {
      dbg_assert(!options.as_json);
      const fd = await fs["open"](filename, "r");
      const length = options.range.length;
      const buffer = Buffer.allocUnsafe(length);
      try {
        const result = await fd["read"]({
          buffer,
          position: options.range.start
        });
        dbg_assert(result.bytesRead === length);
      } finally {
        await fd["close"]();
      }
      options.done && options.done(new Uint8Array(buffer));
    } else {
      const o = {
        encoding: options.as_json ? "utf-8" : null
      };
      const data = await fs["readFile"](filename, o);
      const result = options.as_json ? JSON.parse(data) : new Uint8Array(data).buffer;
      options.done(result);
    }
  };
  get_file_size = async function(path) {
    if (!fs) {
      fs = await import("node:fs/promises");
    }
    const stat = await fs["stat"](path);
    return stat.size;
  };
} else {
  load_file = async function(filename, options, n_tries) {
    var http = new XMLHttpRequest();
    http.open(options.method || "get", filename, true);
    if (options.as_json) {
      http.responseType = "json";
    } else {
      http.responseType = "arraybuffer";
    }
    if (options.headers) {
      var header_names = Object.keys(options.headers);
      for (var i = 0; i < header_names.length; i++) {
        var name = header_names[i];
        http.setRequestHeader(name, options.headers[name]);
      }
    }
    if (options.range) {
      const start = options.range.start;
      const end = start + options.range.length - 1;
      http.setRequestHeader("Range", "bytes=" + start + "-" + end);
      http.setRequestHeader("X-Accept-Encoding", "identity");
      http.onreadystatechange = function() {
        if (http.status === 200) {
          console.error("Server sent full file in response to ranged request, aborting", { filename });
          http.abort();
        }
      };
    }
    http.onload = function(e) {
      if (http.readyState === 4) {
        if (http.status !== 200 && http.status !== 206) {
          console.error("Loading the image " + filename + " failed (status %d)", http.status);
          if (http.status >= 500 && http.status < 600) {
            retry();
          }
        } else if (http.response) {
          if (options.range) {
            const enc = http.getResponseHeader("Content-Encoding");
            if (enc && enc !== "identity") {
              console.error("Server sent Content-Encoding in response to ranged request", { filename, enc });
            }
          }
          options.done && options.done(http.response, http);
        }
      }
    };
    http.onerror = function(e) {
      console.error("Loading the image " + filename + " failed", e);
      retry();
    };
    if (options.progress) {
      http.onprogress = function(e) {
        options.progress(e);
      };
    }
    http.send(null);
    function retry() {
      const number_of_tries = n_tries || 0;
      const timeout = [1, 1, 2, 3, 5, 8, 13, 21][number_of_tries] || 34;
      setTimeout(() => {
        load_file(filename, options, number_of_tries + 1);
      }, 1e3 * timeout);
    }
  };
  get_file_size = async function(url) {
    return new Promise((resolve, reject) => {
      load_file(url, {
        done: (buffer, http) => {
          var header = http.getResponseHeader("Content-Range") || "";
          var match = header.match(/\/(\d+)\s*$/);
          if (match) {
            resolve(+match[1]);
          } else {
            const error = new Error("`Range: bytes=...` header not supported (Got `" + header + "`)");
            reject(error);
          }
        },
        headers: {
          Range: "bytes=0-0",
          "X-Accept-Encoding": "identity"
        }
      });
    });
  };
}
function read_sized_string_from_mem(mem, offset, len) {
  offset >>>= 0;
  len >>>= 0;
  return String.fromCharCode(...new Uint8Array(mem.buffer, offset, len));
}
var CHARMAPS = {
  cp437: " \u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2195\u203C\xB6\xA7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2302\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0 ",
  cp858: "\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xF8\xA3\xD8\xD7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\xAE\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\xC1\xC2\xC0\xA9\u2563\u2551\u2557\u255D\xA2\xA5\u2510\u2514\u2534\u252C\u251C\u2500\u253C\xE3\xC3\u255A\u2554\u2569\u2566\u2560\u2550\u256C\xA4\xF0\xD0\xCA\xCB\xC8\u20AC\xCD\xCE\xCF\u2518\u250C\u2588\u2584\xA6\xCC\u2580\xD3\xDF\xD4\xD2\xF5\xD5\xB5\xFE\xDE\xDA\xDB\xD9\xFD\xDD\xAF\xB4\xAD\xB1\u2017\xBE\xB6\xA7\xF7\xB8\xB0\xA8\xB7\xB9\xB3\xB2\u25A0 "
};
CHARMAPS.cp858 = CHARMAPS.cp437.slice(0, 128) + CHARMAPS.cp858;
CHARMAPS.ascii = CHARMAPS.cp437.split("").map((c, i) => i > 31 && i < 128 ? c : ".").join("");
function get_charmap(encoding) {
  return encoding && CHARMAPS[encoding] ? CHARMAPS[encoding] : CHARMAPS.cp437;
}

// src/buffer.js
var BLOCK_SIZE = 256;
var ASYNC_SAFE = false;
function SyncBuffer(buffer) {
  dbg_assert(buffer instanceof ArrayBuffer);
  this.buffer = buffer;
  this.byteLength = buffer.byteLength;
  this.onload = void 0;
  this.onprogress = void 0;
}
SyncBuffer.prototype.load = function() {
  this.onload && this.onload({ buffer: this.buffer });
};
SyncBuffer.prototype.get = function(start, len, fn) {
  dbg_assert(start + len <= this.byteLength);
  fn(new Uint8Array(this.buffer, start, len));
};
SyncBuffer.prototype.set = function(start, slice, fn) {
  dbg_assert(start + slice.byteLength <= this.byteLength);
  new Uint8Array(this.buffer, start, slice.byteLength).set(slice);
  fn();
};
SyncBuffer.prototype.get_buffer = function(fn) {
  fn(this.buffer);
};
SyncBuffer.prototype.get_state = function() {
  const state = [];
  state[0] = this.byteLength;
  state[1] = new Uint8Array(this.buffer);
  return state;
};
SyncBuffer.prototype.set_state = function(state) {
  this.byteLength = state[0];
  this.buffer = state[1].slice().buffer;
};
function AsyncXHRBuffer(filename, size, fixed_chunk_size) {
  this.filename = filename;
  this.byteLength = size;
  this.block_cache = /* @__PURE__ */ new Map();
  this.block_cache_is_write = /* @__PURE__ */ new Set();
  this.fixed_chunk_size = fixed_chunk_size;
  this.cache_reads = !!fixed_chunk_size;
  this.onload = void 0;
  this.onprogress = void 0;
}
AsyncXHRBuffer.prototype.load = async function() {
  if (this.byteLength !== void 0) {
    this.onload && this.onload(/* @__PURE__ */ Object.create(null));
    return;
  }
  const size = await get_file_size(this.filename);
  this.byteLength = size;
  this.onload && this.onload(/* @__PURE__ */ Object.create(null));
};
AsyncXHRBuffer.prototype.get_from_cache = function(offset, len) {
  var number_of_blocks = len / BLOCK_SIZE;
  var block_index = offset / BLOCK_SIZE;
  for (var i = 0; i < number_of_blocks; i++) {
    var block = this.block_cache.get(block_index + i);
    if (!block) {
      return;
    }
  }
  if (number_of_blocks === 1) {
    return this.block_cache.get(block_index);
  } else {
    var result = new Uint8Array(len);
    for (var i = 0; i < number_of_blocks; i++) {
      result.set(this.block_cache.get(block_index + i), i * BLOCK_SIZE);
    }
    return result;
  }
};
AsyncXHRBuffer.prototype.get = function(offset, len, fn) {
  dbg_assert(offset + len <= this.byteLength);
  dbg_assert(offset % BLOCK_SIZE === 0);
  dbg_assert(len % BLOCK_SIZE === 0);
  dbg_assert(len);
  var block = this.get_from_cache(offset, len);
  if (block) {
    if (ASYNC_SAFE) {
      setTimeout(fn.bind(this, block), 0);
    } else {
      fn(block);
    }
    return;
  }
  var requested_start = offset;
  var requested_length = len;
  if (this.fixed_chunk_size) {
    requested_start = offset - offset % this.fixed_chunk_size;
    requested_length = Math.ceil((offset - requested_start + len) / this.fixed_chunk_size) * this.fixed_chunk_size;
  }
  load_file(this.filename, {
    done: function done(buffer) {
      var block2 = new Uint8Array(buffer);
      this.handle_read(requested_start, requested_length, block2);
      if (requested_start === offset && requested_length === len) {
        fn(block2);
      } else {
        fn(block2.subarray(offset - requested_start, offset - requested_start + len));
      }
    }.bind(this),
    range: { start: requested_start, length: requested_length }
  });
};
AsyncXHRBuffer.prototype.set = function(start, data, fn) {
  var len = data.length;
  dbg_assert(start + data.byteLength <= this.byteLength);
  dbg_assert(start % BLOCK_SIZE === 0);
  dbg_assert(len % BLOCK_SIZE === 0);
  dbg_assert(len);
  var start_block = start / BLOCK_SIZE;
  var block_count = len / BLOCK_SIZE;
  for (var i = 0; i < block_count; i++) {
    var block = this.block_cache.get(start_block + i);
    if (block === void 0) {
      const data_slice = data.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
      this.block_cache.set(start_block + i, data_slice);
    } else {
      const data_slice = data.subarray(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
      dbg_assert(block.byteLength === data_slice.length);
      block.set(data_slice);
    }
    this.block_cache_is_write.add(start_block + i);
  }
  fn();
};
AsyncXHRBuffer.prototype.handle_read = function(offset, len, block) {
  var start_block = offset / BLOCK_SIZE;
  var block_count = len / BLOCK_SIZE;
  for (var i = 0; i < block_count; i++) {
    const cached_block = this.block_cache.get(start_block + i);
    if (cached_block) {
      block.set(cached_block, i * BLOCK_SIZE);
    } else if (this.cache_reads) {
      this.block_cache.set(start_block + i, block.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE));
    }
  }
};
AsyncXHRBuffer.prototype.get_buffer = function(fn) {
  fn();
};
AsyncXHRBuffer.prototype.get_state = function() {
  const state = [];
  const block_cache = [];
  for (const [index, block] of this.block_cache) {
    dbg_assert(isFinite(index));
    if (this.block_cache_is_write.has(index)) {
      block_cache.push([index, block]);
    }
  }
  state[0] = block_cache;
  return state;
};
AsyncXHRBuffer.prototype.set_state = function(state) {
  const block_cache = state[0];
  this.block_cache.clear();
  this.block_cache_is_write.clear();
  for (const [index, block] of block_cache) {
    dbg_assert(isFinite(index));
    this.block_cache.set(index, block);
    this.block_cache_is_write.add(index);
  }
};
function AsyncXHRPartfileBuffer(filename, size, fixed_chunk_size, partfile_alt_format, zstd_decompress) {
  const parts = filename.match(/\.[^\.]+(\.zst)?$/);
  this.extension = parts ? parts[0] : "";
  this.basename = filename.substring(0, filename.length - this.extension.length);
  this.is_zstd = this.extension.endsWith(".zst");
  if (!this.basename.endsWith("/")) {
    this.basename += "-";
  }
  this.block_cache = /* @__PURE__ */ new Map();
  this.block_cache_is_write = /* @__PURE__ */ new Set();
  this.byteLength = size;
  this.fixed_chunk_size = fixed_chunk_size;
  this.partfile_alt_format = !!partfile_alt_format;
  this.zstd_decompress = zstd_decompress;
  this.cache_reads = !!fixed_chunk_size;
  this.onload = void 0;
  this.onprogress = void 0;
}
AsyncXHRPartfileBuffer.prototype.load = function() {
  if (this.byteLength !== void 0) {
    this.onload && this.onload(/* @__PURE__ */ Object.create(null));
    return;
  }
  dbg_assert(false);
  this.onload && this.onload(/* @__PURE__ */ Object.create(null));
};
AsyncXHRPartfileBuffer.prototype.get = function(offset, len, fn) {
  dbg_assert(offset + len <= this.byteLength);
  dbg_assert(offset % BLOCK_SIZE === 0);
  dbg_assert(len % BLOCK_SIZE === 0);
  dbg_assert(len);
  const block = this.get_from_cache(offset, len);
  if (block) {
    if (ASYNC_SAFE) {
      setTimeout(fn.bind(this, block), 0);
    } else {
      fn(block);
    }
    return;
  }
  if (this.fixed_chunk_size) {
    const start_index = Math.floor(offset / this.fixed_chunk_size);
    const m_offset = offset - start_index * this.fixed_chunk_size;
    dbg_assert(m_offset >= 0);
    const total_count = Math.ceil((m_offset + len) / this.fixed_chunk_size);
    const blocks = new Uint8Array(total_count * this.fixed_chunk_size);
    let finished = 0;
    for (let i = 0; i < total_count; i++) {
      const offset2 = (start_index + i) * this.fixed_chunk_size;
      const part_filename = this.partfile_alt_format ? (
        // matches output of gnu split:
        //   split -b 512 -a8 -d --additional-suffix .img w95.img w95-
        this.basename + (start_index + i + "").padStart(8, "0") + this.extension
      ) : this.basename + offset2 + "-" + (offset2 + this.fixed_chunk_size) + this.extension;
      const block2 = this.get_from_cache(offset2, this.fixed_chunk_size);
      if (block2) {
        blocks.set(block2, i * this.fixed_chunk_size);
        finished++;
        if (finished === total_count) {
          fn(blocks.subarray(m_offset, m_offset + len));
        }
      } else {
        load_file(part_filename, {
          done: async function done(buffer) {
            let block3 = new Uint8Array(buffer);
            if (this.is_zstd) {
              const decompressed = await this.zstd_decompress(this.fixed_chunk_size, block3);
              block3 = new Uint8Array(decompressed);
            }
            blocks.set(block3, i * this.fixed_chunk_size);
            this.handle_read((start_index + i) * this.fixed_chunk_size, this.fixed_chunk_size | 0, block3);
            finished++;
            if (finished === total_count) {
              fn(blocks.subarray(m_offset, m_offset + len));
            }
          }.bind(this)
        });
      }
    }
  } else {
    const part_filename = this.basename + offset + "-" + (offset + len) + this.extension;
    load_file(part_filename, {
      done: function done(buffer) {
        dbg_assert(buffer.byteLength === len);
        var block2 = new Uint8Array(buffer);
        this.handle_read(offset, len, block2);
        fn(block2);
      }.bind(this)
    });
  }
};
AsyncXHRPartfileBuffer.prototype.get_from_cache = AsyncXHRBuffer.prototype.get_from_cache;
AsyncXHRPartfileBuffer.prototype.set = AsyncXHRBuffer.prototype.set;
AsyncXHRPartfileBuffer.prototype.handle_read = AsyncXHRBuffer.prototype.handle_read;
AsyncXHRPartfileBuffer.prototype.get_state = AsyncXHRBuffer.prototype.get_state;
AsyncXHRPartfileBuffer.prototype.set_state = AsyncXHRBuffer.prototype.set_state;
function SyncFileBuffer(file) {
  this.file = file;
  this.byteLength = file.size;
  if (file.size > 1 << 30) {
    console.warn("SyncFileBuffer: Allocating buffer of " + (file.size >> 20) + " MB ...");
  }
  this.buffer = new ArrayBuffer(file.size);
  this.onload = void 0;
  this.onprogress = void 0;
}
SyncFileBuffer.prototype.load = function() {
  this.load_next(0);
};
SyncFileBuffer.prototype.load_next = function(start) {
  const PART_SIZE = 4 << 20;
  var filereader = new FileReader();
  filereader.onload = function(e) {
    var buffer = new Uint8Array(e.target.result);
    new Uint8Array(this.buffer, start).set(buffer);
    this.load_next(start + PART_SIZE);
  }.bind(this);
  if (this.onprogress) {
    this.onprogress({
      loaded: start,
      total: this.byteLength,
      lengthComputable: true
    });
  }
  if (start < this.byteLength) {
    var end = Math.min(start + PART_SIZE, this.byteLength);
    var slice = this.file.slice(start, end);
    filereader.readAsArrayBuffer(slice);
  } else {
    this.file = void 0;
    this.onload && this.onload({ buffer: this.buffer });
  }
};
SyncFileBuffer.prototype.get = SyncBuffer.prototype.get;
SyncFileBuffer.prototype.set = SyncBuffer.prototype.set;
SyncFileBuffer.prototype.get_buffer = SyncBuffer.prototype.get_buffer;
SyncFileBuffer.prototype.get_state = SyncBuffer.prototype.get_state;
SyncFileBuffer.prototype.set_state = SyncBuffer.prototype.set_state;
function AsyncFileBuffer(file) {
  this.file = file;
  this.byteLength = file.size;
  this.block_cache = /* @__PURE__ */ new Map();
  this.block_cache_is_write = /* @__PURE__ */ new Set();
  this.onload = void 0;
  this.onprogress = void 0;
}
AsyncFileBuffer.prototype.load = function() {
  this.onload && this.onload(/* @__PURE__ */ Object.create(null));
};
AsyncFileBuffer.prototype.get = function(offset, len, fn) {
  dbg_assert(offset % BLOCK_SIZE === 0);
  dbg_assert(len % BLOCK_SIZE === 0);
  dbg_assert(len);
  var block = this.get_from_cache(offset, len);
  if (block) {
    fn(block);
    return;
  }
  var fr = new FileReader();
  fr.onload = function(e) {
    var buffer = e.target.result;
    var block2 = new Uint8Array(buffer);
    this.handle_read(offset, len, block2);
    fn(block2);
  }.bind(this);
  fr.readAsArrayBuffer(this.file.slice(offset, offset + len));
};
AsyncFileBuffer.prototype.get_from_cache = AsyncXHRBuffer.prototype.get_from_cache;
AsyncFileBuffer.prototype.set = AsyncXHRBuffer.prototype.set;
AsyncFileBuffer.prototype.handle_read = AsyncXHRBuffer.prototype.handle_read;
AsyncFileBuffer.prototype.get_state = AsyncXHRBuffer.prototype.get_state;
AsyncFileBuffer.prototype.set_state = AsyncXHRBuffer.prototype.set_state;
AsyncFileBuffer.prototype.get_buffer = function(fn) {
  fn();
};
AsyncFileBuffer.prototype.get_as_file = function(name) {
  var parts = [];
  var existing_blocks = Array.from(this.block_cache.keys()).sort(function(x, y) {
    return x - y;
  });
  var current_offset = 0;
  for (var i = 0; i < existing_blocks.length; i++) {
    var block_index = existing_blocks[i];
    var block = this.block_cache.get(block_index);
    var start = block_index * BLOCK_SIZE;
    dbg_assert(start >= current_offset);
    if (start !== current_offset) {
      parts.push(this.file.slice(current_offset, start));
      current_offset = start;
    }
    parts.push(block);
    current_offset += block.length;
  }
  if (current_offset !== this.file.size) {
    parts.push(this.file.slice(current_offset));
  }
  var file = new File(parts, name);
  dbg_assert(file.size === this.file.size);
  return file;
};
function buffer_from_object(obj, zstd_decompress_worker) {
  if (obj.buffer instanceof ArrayBuffer) {
    return new SyncBuffer(obj.buffer);
  } else if (typeof File !== "undefined" && obj.buffer instanceof File) {
    let is_async = obj.async;
    if (is_async === void 0) {
      is_async = obj.buffer.size >= 256 * 1024 * 1024;
    }
    if (is_async) {
      return new AsyncFileBuffer(obj.buffer);
    } else {
      return new SyncFileBuffer(obj.buffer);
    }
  } else if (obj.url) {
    if (obj.use_parts) {
      return new AsyncXHRPartfileBuffer(obj.url, obj.size, obj.fixed_chunk_size, false, zstd_decompress_worker);
    } else {
      return new AsyncXHRBuffer(obj.url, obj.size, obj.fixed_chunk_size);
    }
  } else {
    dbg_log("Ignored file: url=" + obj.url + " buffer=" + obj.buffer);
  }
}

// src/dma.js
function DMA(cpu) {
  this.cpu = cpu;
  this.channel_page = new Uint8Array(8);
  this.channel_pagehi = new Uint8Array(8);
  this.channel_addr = new Uint16Array(8);
  this.channel_addr_init = new Uint16Array(8);
  this.channel_count = new Uint16Array(8);
  this.channel_count_init = new Uint16Array(8);
  this.channel_mask = new Uint8Array(8);
  this.channel_mode = new Uint8Array(8);
  this.unmask_listeners = [];
  this.lsb_msb_flipflop = 0;
  var io = cpu.io;
  io.register_write(0, this, this.port_addr_write.bind(this, 0));
  io.register_write(2, this, this.port_addr_write.bind(this, 1));
  io.register_write(4, this, this.port_addr_write.bind(this, 2));
  io.register_write(6, this, this.port_addr_write.bind(this, 3));
  io.register_write(1, this, this.port_count_write.bind(this, 0));
  io.register_write(3, this, this.port_count_write.bind(this, 1));
  io.register_write(5, this, this.port_count_write.bind(this, 2));
  io.register_write(7, this, this.port_count_write.bind(this, 3));
  io.register_read(0, this, this.port_addr_read.bind(this, 0));
  io.register_read(2, this, this.port_addr_read.bind(this, 1));
  io.register_read(4, this, this.port_addr_read.bind(this, 2));
  io.register_read(6, this, this.port_addr_read.bind(this, 3));
  io.register_read(1, this, this.port_count_read.bind(this, 0));
  io.register_read(3, this, this.port_count_read.bind(this, 1));
  io.register_read(5, this, this.port_count_read.bind(this, 2));
  io.register_read(7, this, this.port_count_read.bind(this, 3));
  io.register_write(192, this, this.port_addr_write.bind(this, 4));
  io.register_write(196, this, this.port_addr_write.bind(this, 5));
  io.register_write(200, this, this.port_addr_write.bind(this, 6));
  io.register_write(204, this, this.port_addr_write.bind(this, 7));
  io.register_write(194, this, this.port_count_write.bind(this, 4));
  io.register_write(198, this, this.port_count_write.bind(this, 5));
  io.register_write(202, this, this.port_count_write.bind(this, 6));
  io.register_write(206, this, this.port_count_write.bind(this, 7));
  io.register_read(192, this, this.port_addr_read.bind(this, 4));
  io.register_read(196, this, this.port_addr_read.bind(this, 5));
  io.register_read(200, this, this.port_addr_read.bind(this, 6));
  io.register_read(204, this, this.port_addr_read.bind(this, 7));
  io.register_read(194, this, this.port_count_read.bind(this, 4));
  io.register_read(198, this, this.port_count_read.bind(this, 5));
  io.register_read(202, this, this.port_count_read.bind(this, 6));
  io.register_read(206, this, this.port_count_read.bind(this, 7));
  io.register_write(135, this, this.port_page_write.bind(this, 0));
  io.register_write(131, this, this.port_page_write.bind(this, 1));
  io.register_write(129, this, this.port_page_write.bind(this, 2));
  io.register_write(130, this, this.port_page_write.bind(this, 3));
  io.register_write(143, this, this.port_page_write.bind(this, 4));
  io.register_write(139, this, this.port_page_write.bind(this, 5));
  io.register_write(137, this, this.port_page_write.bind(this, 6));
  io.register_write(138, this, this.port_page_write.bind(this, 7));
  io.register_read(135, this, this.port_page_read.bind(this, 0));
  io.register_read(131, this, this.port_page_read.bind(this, 1));
  io.register_read(129, this, this.port_page_read.bind(this, 2));
  io.register_read(130, this, this.port_page_read.bind(this, 3));
  io.register_read(143, this, this.port_page_read.bind(this, 4));
  io.register_read(139, this, this.port_page_read.bind(this, 5));
  io.register_read(137, this, this.port_page_read.bind(this, 6));
  io.register_read(138, this, this.port_page_read.bind(this, 7));
  io.register_write(1159, this, this.port_pagehi_write.bind(this, 0));
  io.register_write(1155, this, this.port_pagehi_write.bind(this, 1));
  io.register_write(1153, this, this.port_pagehi_write.bind(this, 2));
  io.register_write(1154, this, this.port_pagehi_write.bind(this, 3));
  io.register_write(1163, this, this.port_pagehi_write.bind(this, 5));
  io.register_write(1161, this, this.port_pagehi_write.bind(this, 6));
  io.register_write(1162, this, this.port_pagehi_write.bind(this, 7));
  io.register_read(1159, this, this.port_pagehi_read.bind(this, 0));
  io.register_read(1155, this, this.port_pagehi_read.bind(this, 1));
  io.register_read(1153, this, this.port_pagehi_read.bind(this, 2));
  io.register_read(1154, this, this.port_pagehi_read.bind(this, 3));
  io.register_read(1163, this, this.port_pagehi_read.bind(this, 5));
  io.register_read(1161, this, this.port_pagehi_read.bind(this, 6));
  io.register_read(1162, this, this.port_pagehi_read.bind(this, 7));
  io.register_write(10, this, this.port_singlemask_write.bind(this, 0));
  io.register_write(212, this, this.port_singlemask_write.bind(this, 4));
  io.register_write(15, this, this.port_multimask_write.bind(this, 0));
  io.register_write(222, this, this.port_multimask_write.bind(this, 4));
  io.register_read(15, this, this.port_multimask_read.bind(this, 0));
  io.register_read(222, this, this.port_multimask_read.bind(this, 4));
  io.register_write(11, this, this.port_mode_write.bind(this, 0));
  io.register_write(214, this, this.port_mode_write.bind(this, 4));
  io.register_write(12, this, this.portC_write);
  io.register_write(216, this, this.portC_write);
}
DMA.prototype.get_state = function() {
  return [
    this.channel_page,
    this.channel_pagehi,
    this.channel_addr,
    this.channel_addr_init,
    this.channel_count,
    this.channel_count_init,
    this.channel_mask,
    this.channel_mode,
    this.lsb_msb_flipflop
  ];
};
DMA.prototype.set_state = function(state) {
  this.channel_page = state[0];
  this.channel_pagehi = state[1];
  this.channel_addr = state[2];
  this.channel_addr_init = state[3];
  this.channel_count = state[4];
  this.channel_count_init = state[5];
  this.channel_mask = state[6];
  this.channel_mode = state[7];
  this.lsb_msb_flipflop = state[8];
};
DMA.prototype.port_count_write = function(channel, data_byte) {
  dbg_log("count write [" + channel + "] = " + h(data_byte), LOG_DMA);
  this.channel_count[channel] = this.flipflop_get(this.channel_count[channel], data_byte, false);
  this.channel_count_init[channel] = this.flipflop_get(this.channel_count_init[channel], data_byte, true);
};
DMA.prototype.port_count_read = function(channel) {
  dbg_log("count read [" + channel + "] -> " + h(this.channel_count[channel]), LOG_DMA);
  return this.flipflop_read(this.channel_count[channel]);
};
DMA.prototype.port_addr_write = function(channel, data_byte) {
  dbg_log("addr write [" + channel + "] = " + h(data_byte), LOG_DMA);
  this.channel_addr[channel] = this.flipflop_get(this.channel_addr[channel], data_byte, false);
  this.channel_addr_init[channel] = this.flipflop_get(this.channel_addr_init[channel], data_byte, true);
};
DMA.prototype.port_addr_read = function(channel) {
  dbg_log("addr read [" + channel + "] -> " + h(this.channel_addr[channel]), LOG_DMA);
  return this.flipflop_read(this.channel_addr[channel]);
};
DMA.prototype.port_pagehi_write = function(channel, data_byte) {
  dbg_log("pagehi write [" + channel + "] = " + h(data_byte), LOG_DMA);
  this.channel_pagehi[channel] = data_byte;
};
DMA.prototype.port_pagehi_read = function(channel) {
  dbg_log("pagehi read [" + channel + "]", LOG_DMA);
  return this.channel_pagehi[channel];
};
DMA.prototype.port_page_write = function(channel, data_byte) {
  dbg_log("page write [" + channel + "] = " + h(data_byte), LOG_DMA);
  this.channel_page[channel] = data_byte;
};
DMA.prototype.port_page_read = function(channel) {
  dbg_log("page read [" + channel + "]", LOG_DMA);
  return this.channel_page[channel];
};
DMA.prototype.port_singlemask_write = function(channel_offset, data_byte) {
  var channel = (data_byte & 3) + channel_offset;
  var value = data_byte & 4 ? 1 : 0;
  dbg_log("singlechannel mask write [" + channel + "] = " + value, LOG_DMA);
  this.update_mask(channel, value);
};
DMA.prototype.port_multimask_write = function(channel_offset, data_byte) {
  dbg_log("multichannel mask write: " + h(data_byte), LOG_DMA);
  for (var i = 0; i < 4; i++) {
    this.update_mask(channel_offset + i, data_byte & 1 << i);
  }
};
DMA.prototype.port_multimask_read = function(channel_offset) {
  var value = 0;
  value |= this.channel_mask[channel_offset + 0];
  value |= this.channel_mask[channel_offset + 1] << 1;
  value |= this.channel_mask[channel_offset + 2] << 2;
  value |= this.channel_mask[channel_offset + 3] << 3;
  dbg_log("multichannel mask read: " + h(value), LOG_DMA);
  return value;
};
DMA.prototype.port_mode_write = function(channel_offset, data_byte) {
  var channel = (data_byte & 3) + channel_offset;
  dbg_log("mode write [" + channel + "] = " + h(data_byte), LOG_DMA);
  this.channel_mode[channel] = data_byte;
};
DMA.prototype.portC_write = function(data_byte) {
  dbg_log("flipflop reset", LOG_DMA);
  this.lsb_msb_flipflop = 0;
};
DMA.prototype.on_unmask = function(fn, this_value) {
  this.unmask_listeners.push({
    fn,
    this_value
  });
};
DMA.prototype.update_mask = function(channel, value) {
  if (this.channel_mask[channel] !== value) {
    this.channel_mask[channel] = value;
    if (!value) {
      dbg_log("firing on_unmask(" + channel + ")", LOG_DMA);
      for (var i = 0; i < this.unmask_listeners.length; i++) {
        this.unmask_listeners[i].fn.call(
          this.unmask_listeners[i].this_value,
          channel
        );
      }
    }
  }
};
DMA.prototype.do_read = function(buffer, start, len, channel, fn) {
  var read_count = this.count_get_8bit(channel), addr = this.address_get_8bit(channel);
  dbg_log("DMA write channel " + channel, LOG_DMA);
  dbg_log("to " + h(addr) + " len " + h(read_count), LOG_DMA);
  if (len < read_count) {
    dbg_log("DMA should read more than provided: " + h(len) + " " + h(read_count), LOG_DMA);
  }
  if (start + read_count > buffer.byteLength) {
    dbg_log("DMA read outside of buffer", LOG_DMA);
    fn(true);
  } else {
    var cpu = this.cpu;
    this.channel_addr[channel] += read_count;
    buffer.get(start, read_count, function(data) {
      cpu.write_blob(data, addr);
      fn(false);
    });
  }
};
DMA.prototype.do_write = function(buffer, start, len, channel, fn) {
  var read_count = this.channel_count[channel] + 1 & 65535, bytes_per_count = channel >= 5 ? 2 : 1, read_bytes = read_count * bytes_per_count, addr = this.address_get_8bit(channel), unfinished = false, want_more = false, autoinit = this.channel_mode[channel] & 16;
  dbg_log("DMA write channel " + channel, LOG_DMA);
  dbg_log("to " + h(addr) + " len " + h(read_bytes), LOG_DMA);
  if (len < read_bytes) {
    dbg_log("DMA should read more than provided", LOG_DMA);
    read_count = Math.floor(len / bytes_per_count);
    read_bytes = read_count * bytes_per_count;
    unfinished = true;
  } else if (len > read_bytes) {
    dbg_log("DMA attempted to read more than provided", LOG_DMA);
    want_more = true;
  }
  if (start + read_bytes > buffer.byteLength) {
    dbg_log("DMA write outside of buffer", LOG_DMA);
    fn(true);
  } else {
    this.channel_addr[channel] += read_count;
    this.channel_count[channel] -= read_count;
    if (!unfinished && autoinit) {
      dbg_log("DMA autoinit", LOG_DMA);
      this.channel_addr[channel] = this.channel_addr_init[channel];
      this.channel_count[channel] = this.channel_count_init[channel];
    }
    buffer.set(
      start,
      this.cpu.mem8.subarray(addr, addr + read_bytes),
      () => {
        if (want_more && autoinit) {
          dbg_log("DMA continuing from start", LOG_DMA);
          this.do_write(buffer, start + read_bytes, len - read_bytes, channel, fn);
        } else {
          fn(false);
        }
      }
    );
  }
};
DMA.prototype.address_get_8bit = function(channel) {
  var addr = this.channel_addr[channel];
  if (channel >= 5) {
    addr = addr << 1;
  }
  addr &= 65535;
  addr |= this.channel_page[channel] << 16;
  addr |= this.channel_pagehi[channel] << 24;
  return addr;
};
DMA.prototype.count_get_8bit = function(channel) {
  var count = this.channel_count[channel] + 1;
  if (channel >= 5) {
    count *= 2;
  }
  return count;
};
DMA.prototype.flipflop_get = function(old_dword, new_byte, continuing) {
  if (!continuing) {
    this.lsb_msb_flipflop ^= 1;
  }
  if (this.lsb_msb_flipflop) {
    return old_dword & ~255 | new_byte;
  } else {
    return old_dword & ~65280 | new_byte << 8;
  }
};
DMA.prototype.flipflop_read = function(dword) {
  this.lsb_msb_flipflop ^= 1;
  if (this.lsb_msb_flipflop) {
    return dword & 255;
  } else {
    return dword >> 8 & 255;
  }
};

// src/io.js
var LOG_ALL_IO = false;
function IO(cpu) {
  this.ports = [];
  this.cpu = cpu;
  for (var i = 0; i < 65536; i++) {
    this.ports[i] = this.create_empty_entry();
  }
  var memory_size = cpu.memory_size[0];
  for (var i = 0; i << MMAP_BLOCK_BITS < memory_size; i++) {
    cpu.memory_map_read8[i] = cpu.memory_map_write8[i] = void 0;
    cpu.memory_map_read32[i] = cpu.memory_map_write32[i] = void 0;
  }
  this.mmap_register(
    memory_size,
    MMAP_MAX - memory_size,
    function(addr) {
      dbg_log("Read from unmapped memory space, addr=" + h(addr >>> 0, 8), LOG_IO);
      return 255;
    },
    function(addr, value) {
      dbg_log("Write to unmapped memory space, addr=" + h(addr >>> 0, 8) + " value=" + h(value, 2), LOG_IO);
    },
    function(addr) {
      dbg_log("Read from unmapped memory space, addr=" + h(addr >>> 0, 8), LOG_IO);
      return -1;
    },
    function(addr, value) {
      dbg_log("Write to unmapped memory space, addr=" + h(addr >>> 0, 8) + " value=" + h(value >>> 0, 8), LOG_IO);
    }
  );
}
IO.prototype.create_empty_entry = function() {
  return {
    read8: this.empty_port_read8,
    read16: this.empty_port_read16,
    read32: this.empty_port_read32,
    write8: this.empty_port_write,
    write16: this.empty_port_write,
    write32: this.empty_port_write,
    device: void 0
  };
};
IO.prototype.empty_port_read8 = function() {
  return 255;
};
IO.prototype.empty_port_read16 = function() {
  return 65535;
};
IO.prototype.empty_port_read32 = function() {
  return -1;
};
IO.prototype.empty_port_write = function(x) {
};
IO.prototype.register_read = function(port_addr, device, r8, r16, r32) {
  dbg_assert(typeof port_addr === "number");
  dbg_assert(typeof device === "object");
  dbg_assert(!r8 || typeof r8 === "function");
  dbg_assert(!r16 || typeof r16 === "function");
  dbg_assert(!r32 || typeof r32 === "function");
  dbg_assert(r8 || r16 || r32);
  if (false) {
    var fail = function(n) {
      dbg_assert(false, "Overlapped read" + n + " " + h(port_addr, 4) + " (" + device.name + ")");
      return -1 >>> 32 - n | 0;
    };
    if (!r8) r8 = fail.bind(this, 8);
    if (!r16) r16 = fail.bind(this, 16);
    if (!r32) r32 = fail.bind(this, 32);
  }
  if (r8) this.ports[port_addr].read8 = r8;
  if (r16) this.ports[port_addr].read16 = r16;
  if (r32) this.ports[port_addr].read32 = r32;
  this.ports[port_addr].device = device;
};
IO.prototype.register_write = function(port_addr, device, w8, w16, w32) {
  dbg_assert(typeof port_addr === "number");
  dbg_assert(typeof device === "object");
  dbg_assert(!w8 || typeof w8 === "function");
  dbg_assert(!w16 || typeof w16 === "function");
  dbg_assert(!w32 || typeof w32 === "function");
  dbg_assert(w8 || w16 || w32);
  if (false) {
    var fail = function(n) {
      dbg_assert(false, "Overlapped write" + n + " " + h(port_addr) + " (" + device.name + ")");
    };
    if (!w8) w8 = fail.bind(this, 8);
    if (!w16) w16 = fail.bind(this, 16);
    if (!w32) w32 = fail.bind(this, 32);
  }
  if (w8) this.ports[port_addr].write8 = w8;
  if (w16) this.ports[port_addr].write16 = w16;
  if (w32) this.ports[port_addr].write32 = w32;
  this.ports[port_addr].device = device;
};
IO.prototype.register_read_consecutive = function(port_addr, device, r8_1, r8_2, r8_3, r8_4) {
  dbg_assert(arguments.length === 4 || arguments.length === 6);
  function r16_1() {
    return r8_1.call(this) | r8_2.call(this) << 8;
  }
  function r16_2() {
    return r8_3.call(this) | r8_4.call(this) << 8;
  }
  function r32() {
    return r8_1.call(this) | r8_2.call(this) << 8 | r8_3.call(this) << 16 | r8_4.call(this) << 24;
  }
  if (r8_3 && r8_4) {
    this.register_read(port_addr, device, r8_1, r16_1, r32);
    this.register_read(port_addr + 1, device, r8_2);
    this.register_read(port_addr + 2, device, r8_3, r16_2);
    this.register_read(port_addr + 3, device, r8_4);
  } else {
    this.register_read(port_addr, device, r8_1, r16_1);
    this.register_read(port_addr + 1, device, r8_2);
  }
};
IO.prototype.register_write_consecutive = function(port_addr, device, w8_1, w8_2, w8_3, w8_4) {
  dbg_assert(arguments.length === 4 || arguments.length === 6);
  function w16_1(data) {
    w8_1.call(this, data & 255);
    w8_2.call(this, data >> 8 & 255);
  }
  function w16_2(data) {
    w8_3.call(this, data & 255);
    w8_4.call(this, data >> 8 & 255);
  }
  function w32(data) {
    w8_1.call(this, data & 255);
    w8_2.call(this, data >> 8 & 255);
    w8_3.call(this, data >> 16 & 255);
    w8_4.call(this, data >>> 24);
  }
  if (w8_3 && w8_4) {
    this.register_write(port_addr, device, w8_1, w16_1, w32);
    this.register_write(port_addr + 1, device, w8_2);
    this.register_write(port_addr + 2, device, w8_3, w16_2);
    this.register_write(port_addr + 3, device, w8_4);
  } else {
    this.register_write(port_addr, device, w8_1, w16_1);
    this.register_write(port_addr + 1, device, w8_2);
  }
};
IO.prototype.mmap_read32_shim = function(addr) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  var fn = this.cpu.memory_map_read8[aligned_addr];
  return fn(addr) | fn(addr + 1) << 8 | fn(addr + 2) << 16 | fn(addr + 3) << 24;
};
IO.prototype.mmap_write32_shim = function(addr, value) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  var fn = this.cpu.memory_map_write8[aligned_addr];
  fn(addr, value & 255);
  fn(addr + 1, value >> 8 & 255);
  fn(addr + 2, value >> 16 & 255);
  fn(addr + 3, value >>> 24);
};
IO.prototype.mmap_register = function(addr, size, read_func8, write_func8, read_func32, write_func32) {
  dbg_log("mmap_register addr=" + h(addr >>> 0, 8) + " size=" + h(size, 8), LOG_IO);
  dbg_assert((addr & MMAP_BLOCK_SIZE - 1) === 0);
  dbg_assert(size && (size & MMAP_BLOCK_SIZE - 1) === 0);
  if (!read_func32)
    read_func32 = this.mmap_read32_shim.bind(this);
  if (!write_func32)
    write_func32 = this.mmap_write32_shim.bind(this);
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  for (; size > 0; aligned_addr++) {
    this.cpu.memory_map_read8[aligned_addr] = read_func8;
    this.cpu.memory_map_write8[aligned_addr] = write_func8;
    this.cpu.memory_map_read32[aligned_addr] = read_func32;
    this.cpu.memory_map_write32[aligned_addr] = write_func32;
    size -= MMAP_BLOCK_SIZE;
  }
};
IO.prototype.port_write8 = function(port_addr, data) {
  var entry = this.ports[port_addr];
  if (entry.write8 === this.empty_port_write || LOG_ALL_IO) {
    dbg_log(
      "write8 port #" + h(port_addr, 4) + " <- " + h(data, 2) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  return entry.write8.call(entry.device, data);
};
IO.prototype.port_write16 = function(port_addr, data) {
  var entry = this.ports[port_addr];
  if (entry.write16 === this.empty_port_write || LOG_ALL_IO) {
    dbg_log(
      "write16 port #" + h(port_addr, 4) + " <- " + h(data, 4) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  return entry.write16.call(entry.device, data);
};
IO.prototype.port_write32 = function(port_addr, data) {
  var entry = this.ports[port_addr];
  if (entry.write32 === this.empty_port_write || LOG_ALL_IO) {
    dbg_log(
      "write32 port #" + h(port_addr, 4) + " <- " + h(data >>> 0, 8) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  return entry.write32.call(entry.device, data);
};
IO.prototype.port_read8 = function(port_addr) {
  var entry = this.ports[port_addr];
  if (entry.read8 === this.empty_port_read8 || LOG_ALL_IO) {
    dbg_log(
      "read8 port  #" + h(port_addr, 4) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  var value = entry.read8.call(entry.device, port_addr);
  dbg_assert(typeof value === "number");
  if (value < 0 || value >= 256) dbg_assert(false, "8 bit port returned large value: " + h(port_addr));
  return value;
};
IO.prototype.port_read16 = function(port_addr) {
  var entry = this.ports[port_addr];
  if (entry.read16 === this.empty_port_read16 || LOG_ALL_IO) {
    dbg_log(
      "read16 port  #" + h(port_addr, 4) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  var value = entry.read16.call(entry.device, port_addr);
  dbg_assert(typeof value === "number");
  if (value < 0 || value >= 65536) dbg_assert(false, "16 bit port returned large value: " + h(port_addr));
  return value;
};
IO.prototype.port_read32 = function(port_addr) {
  var entry = this.ports[port_addr];
  if (entry.read32 === this.empty_port_read32 || LOG_ALL_IO) {
    dbg_log(
      "read32 port  #" + h(port_addr, 4) + this.get_port_description(port_addr),
      LOG_IO
    );
  }
  var value = entry.read32.call(entry.device, port_addr);
  dbg_assert((value | 0) === value);
  return value;
};
var debug_port_list = {
  4: "PORT_DMA_ADDR_2",
  5: "PORT_DMA_CNT_2",
  10: "PORT_DMA1_MASK_REG",
  11: "PORT_DMA1_MODE_REG",
  12: "PORT_DMA1_CLEAR_FF_REG",
  13: "PORT_DMA1_MASTER_CLEAR",
  32: "PORT_PIC1_CMD",
  33: "PORT_PIC1_DATA",
  64: "PORT_PIT_COUNTER0",
  65: "PORT_PIT_COUNTER1",
  66: "PORT_PIT_COUNTER2",
  67: "PORT_PIT_MODE",
  96: "PORT_PS2_DATA",
  97: "PORT_PS2_CTRLB",
  100: "PORT_PS2_STATUS",
  112: "PORT_CMOS_INDEX",
  113: "PORT_CMOS_DATA",
  128: "PORT_DIAG",
  129: "PORT_DMA_PAGE_2",
  146: "PORT_A20",
  160: "PORT_PIC2_CMD",
  161: "PORT_PIC2_DATA",
  178: "PORT_SMI_CMD",
  179: "PORT_SMI_STATUS",
  212: "PORT_DMA2_MASK_REG",
  214: "PORT_DMA2_MODE_REG",
  218: "PORT_DMA2_MASTER_CLEAR",
  240: "PORT_MATH_CLEAR",
  368: "PORT_ATA2_CMD_BASE",
  496: "PORT_ATA1_CMD_BASE",
  632: "PORT_LPT2",
  744: "PORT_SERIAL4",
  760: "PORT_SERIAL2",
  884: "PORT_ATA2_CTRL_BASE",
  888: "PORT_LPT1",
  1e3: "PORT_SERIAL3",
  //0x03f4: "PORT_ATA1_CTRL_BASE",
  1008: "PORT_FD_BASE",
  1010: "PORT_FD_DOR",
  1012: "PORT_FD_STATUS",
  1013: "PORT_FD_DATA",
  1014: "PORT_HD_DATA",
  1015: "PORT_FD_DIR",
  1016: "PORT_SERIAL1",
  3320: "PORT_PCI_CMD",
  3321: "PORT_PCI_REBOOT",
  3324: "PORT_PCI_DATA",
  1026: "PORT_BIOS_DEBUG",
  1296: "PORT_QEMU_CFG_CTL",
  1297: "PORT_QEMU_CFG_DATA",
  45056: "PORT_ACPI_PM_BASE",
  45312: "PORT_SMB_BASE",
  35072: "PORT_BIOS_APM"
};
IO.prototype.get_port_description = function(addr) {
  if (debug_port_list[addr]) {
    return "  (" + debug_port_list[addr] + ")";
  } else {
    return "";
  }
};

// src/bus.js
var Bus = {};
function BusConnector() {
  this.listeners = {};
  this.pair = void 0;
}
BusConnector.prototype.register = function(name, fn, this_value) {
  var listeners = this.listeners[name];
  if (listeners === void 0) {
    listeners = this.listeners[name] = [];
  }
  listeners.push({
    fn,
    this_value
  });
};
BusConnector.prototype.unregister = function(name, fn) {
  var listeners = this.listeners[name];
  if (listeners === void 0) {
    return;
  }
  this.listeners[name] = listeners.filter(function(l) {
    return l.fn !== fn;
  });
};
BusConnector.prototype.send = function(name, value, unused_transfer) {
  if (!this.pair) {
    return;
  }
  var listeners = this.pair.listeners[name];
  if (listeners === void 0) {
    return;
  }
  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    listener.fn.call(listener.this_value, value);
  }
};
BusConnector.prototype.send_async = function(name, value) {
  dbg_assert(arguments.length === 1 || arguments.length === 2);
  setTimeout(this.send.bind(this, name, value), 0);
};
Bus.create = function() {
  var c0 = new BusConnector();
  var c1 = new BusConnector();
  c0.pair = c1;
  c1.pair = c0;
  return [c0, c1];
};

// src/sb16.js
var DSP_COPYRIGHT = "COPYRIGHT (C) CREATIVE TECHNOLOGY LTD, 1992.";
var DSP_NO_COMMAND = 0;
var DSP_BUFSIZE = 64;
var DSP_DACSIZE = 65536;
var SB_DMA_BUFSIZE = 65536;
var SB_DMA_BLOCK_SAMPLES = 1024;
var SB_DMA0 = 0;
var SB_DMA1 = 1;
var SB_DMA3 = 3;
var SB_DMA5 = 5;
var SB_DMA6 = 6;
var SB_DMA7 = 7;
var SB_DMA_CHANNEL_8BIT = SB_DMA1;
var SB_DMA_CHANNEL_16BIT = SB_DMA5;
var SB_IRQ2 = 2;
var SB_IRQ5 = 5;
var SB_IRQ7 = 7;
var SB_IRQ10 = 10;
var SB_IRQ = SB_IRQ5;
var SB_IRQ_8BIT = 1;
var SB_IRQ_16BIT = 2;
var DSP_COMMAND_SIZES = new Uint8Array(256);
var DSP_COMMAND_HANDLERS = [];
var MIXER_READ_HANDLERS = [];
var MIXER_WRITE_HANDLERS = [];
var MIXER_REGISTER_IS_LEGACY = new Uint8Array(256);
var FM_HANDLERS = [];
function SB16(cpu, bus) {
  this.cpu = cpu;
  this.bus = bus;
  this.write_buffer = new ByteQueue(DSP_BUFSIZE);
  this.read_buffer = new ByteQueue(DSP_BUFSIZE);
  this.read_buffer_lastvalue = 0;
  this.command = DSP_NO_COMMAND;
  this.command_size = 0;
  this.mixer_current_address = 0;
  this.mixer_registers = new Uint8Array(256);
  this.mixer_reset();
  this.dummy_speaker_enabled = false;
  this.test_register = 0;
  this.dsp_highspeed = false;
  this.dsp_stereo = false;
  this.dsp_16bit = false;
  this.dsp_signed = false;
  this.dac_buffers = [
    new FloatQueue(DSP_DACSIZE),
    new FloatQueue(DSP_DACSIZE)
  ];
  this.dma = cpu.devices.dma;
  this.dma_sample_count = 0;
  this.dma_bytes_count = 0;
  this.dma_bytes_left = 0;
  this.dma_bytes_block = 0;
  this.dma_irq = 0;
  this.dma_channel = 0;
  this.dma_channel_8bit = SB_DMA_CHANNEL_8BIT;
  this.dma_channel_16bit = SB_DMA_CHANNEL_16BIT;
  this.dma_autoinit = false;
  this.dma_buffer = new ArrayBuffer(SB_DMA_BUFSIZE);
  this.dma_buffer_int8 = new Int8Array(this.dma_buffer);
  this.dma_buffer_uint8 = new Uint8Array(this.dma_buffer);
  this.dma_buffer_int16 = new Int16Array(this.dma_buffer);
  this.dma_buffer_uint16 = new Uint16Array(this.dma_buffer);
  this.dma_syncbuffer = new SyncBuffer(this.dma_buffer);
  this.dma_waiting_transfer = false;
  this.dma_paused = false;
  this.sampling_rate = 22050;
  bus.send("dac-tell-sampling-rate", this.sampling_rate);
  this.bytes_per_sample = 1;
  this.e2_value = 170;
  this.e2_count = 0;
  this.asp_registers = new Uint8Array(256);
  this.mpu_read_buffer = new ByteQueue(DSP_BUFSIZE);
  this.mpu_read_buffer_lastvalue = 0;
  this.fm_current_address0 = 0;
  this.fm_current_address1 = 0;
  this.fm_waveform_select_enable = false;
  this.irq = SB_IRQ;
  this.irq_triggered = new Uint8Array(16);
  cpu.io.register_read_consecutive(
    544,
    this,
    this.port2x0_read,
    this.port2x1_read,
    this.port2x2_read,
    this.port2x3_read
  );
  cpu.io.register_read_consecutive(
    904,
    this,
    this.port2x0_read,
    this.port2x1_read
  );
  cpu.io.register_read_consecutive(
    548,
    this,
    this.port2x4_read,
    this.port2x5_read
  );
  cpu.io.register_read(550, this, this.port2x6_read);
  cpu.io.register_read(551, this, this.port2x7_read);
  cpu.io.register_read(552, this, this.port2x8_read);
  cpu.io.register_read(553, this, this.port2x9_read);
  cpu.io.register_read(554, this, this.port2xA_read);
  cpu.io.register_read(555, this, this.port2xB_read);
  cpu.io.register_read(556, this, this.port2xC_read);
  cpu.io.register_read(557, this, this.port2xD_read);
  cpu.io.register_read_consecutive(
    558,
    this,
    this.port2xE_read,
    this.port2xF_read
  );
  cpu.io.register_write_consecutive(
    544,
    this,
    this.port2x0_write,
    this.port2x1_write,
    this.port2x2_write,
    this.port2x3_write
  );
  cpu.io.register_write_consecutive(
    904,
    this,
    this.port2x0_write,
    this.port2x1_write
  );
  cpu.io.register_write_consecutive(
    548,
    this,
    this.port2x4_write,
    this.port2x5_write
  );
  cpu.io.register_write(550, this, this.port2x6_write);
  cpu.io.register_write(551, this, this.port2x7_write);
  cpu.io.register_write_consecutive(
    552,
    this,
    this.port2x8_write,
    this.port2x9_write
  );
  cpu.io.register_write(554, this, this.port2xA_write);
  cpu.io.register_write(555, this, this.port2xB_write);
  cpu.io.register_write(556, this, this.port2xC_write);
  cpu.io.register_write(557, this, this.port2xD_write);
  cpu.io.register_write(558, this, this.port2xE_write);
  cpu.io.register_write(559, this, this.port2xF_write);
  cpu.io.register_read_consecutive(816, this, this.port3x0_read, this.port3x1_read);
  cpu.io.register_write_consecutive(816, this, this.port3x0_write, this.port3x1_write);
  this.dma.on_unmask(this.dma_on_unmask, this);
  bus.register("dac-request-data", function() {
    this.dac_handle_request();
  }, this);
  bus.register("speaker-has-initialized", function() {
    this.mixer_reset();
  }, this);
  bus.send("speaker-confirm-initialized");
  this.dsp_reset();
}
SB16.prototype.dsp_reset = function() {
  this.write_buffer.clear();
  this.read_buffer.clear();
  this.command = DSP_NO_COMMAND;
  this.command_size = 0;
  this.dummy_speaker_enabled = false;
  this.test_register = 0;
  this.dsp_highspeed = false;
  this.dsp_stereo = false;
  this.dsp_16bit = false;
  this.dsp_signed = false;
  this.dac_buffers[0].clear();
  this.dac_buffers[1].clear();
  this.dma_sample_count = 0;
  this.dma_bytes_count = 0;
  this.dma_bytes_left = 0;
  this.dma_bytes_block = 0;
  this.dma_irq = 0;
  this.dma_channel = 0;
  this.dma_autoinit = false;
  this.dma_buffer_uint8.fill(0);
  this.dma_waiting_transfer = false;
  this.dma_paused = false;
  this.e2_value = 170;
  this.e2_count = 0;
  this.sampling_rate = 22050;
  this.bytes_per_sample = 1;
  this.lower_irq(SB_IRQ_8BIT);
  this.irq_triggered.fill(0);
  this.asp_registers.fill(0);
  this.asp_registers[5] = 1;
  this.asp_registers[9] = 248;
};
SB16.prototype.get_state = function() {
  var state = [];
  state[2] = this.read_buffer_lastvalue;
  state[3] = this.command;
  state[4] = this.command_size;
  state[5] = this.mixer_current_address;
  state[6] = this.mixer_registers;
  state[7] = this.dummy_speaker_enabled;
  state[8] = this.test_register;
  state[9] = this.dsp_highspeed;
  state[10] = this.dsp_stereo;
  state[11] = this.dsp_16bit;
  state[12] = this.dsp_signed;
  state[15] = this.dma_sample_count;
  state[16] = this.dma_bytes_count;
  state[17] = this.dma_bytes_left;
  state[18] = this.dma_bytes_block;
  state[19] = this.dma_irq;
  state[20] = this.dma_channel;
  state[21] = this.dma_channel_8bit;
  state[22] = this.dma_channel_16bit;
  state[23] = this.dma_autoinit;
  state[24] = this.dma_buffer_uint8;
  state[25] = this.dma_waiting_transfer;
  state[26] = this.dma_paused;
  state[27] = this.sampling_rate;
  state[28] = this.bytes_per_sample;
  state[29] = this.e2_value;
  state[30] = this.e2_count;
  state[31] = this.asp_registers;
  state[33] = this.mpu_read_buffer_last_value;
  state[34] = this.irq;
  state[35] = this.irq_triggered;
  return state;
};
SB16.prototype.set_state = function(state) {
  this.read_buffer_lastvalue = state[2];
  this.command = state[3];
  this.command_size = state[4];
  this.mixer_current_address = state[5];
  this.mixer_registers = state[6];
  this.mixer_full_update();
  this.dummy_speaker_enabled = state[7];
  this.test_register = state[8];
  this.dsp_highspeed = state[9];
  this.dsp_stereo = state[10];
  this.dsp_16bit = state[11];
  this.dsp_signed = state[12];
  this.dma_sample_count = state[15];
  this.dma_bytes_count = state[16];
  this.dma_bytes_left = state[17];
  this.dma_bytes_block = state[18];
  this.dma_irq = state[19];
  this.dma_channel = state[20];
  this.dma_channel_8bit = state[21];
  this.dma_channel_16bit = state[22];
  this.dma_autoinit = state[23];
  this.dma_buffer_uint8 = state[24];
  this.dma_waiting_transfer = state[25];
  this.dma_paused = state[26];
  this.sampling_rate = state[27];
  this.bytes_per_sample = state[28];
  this.e2_value = state[29];
  this.e2_count = state[30];
  this.asp_registers = state[31];
  this.mpu_read_buffer_last_value = state[33];
  this.irq = state[34];
  this.irq_triggered = state[35];
  this.dma_buffer = this.dma_buffer_uint8.buffer;
  this.dma_buffer_int8 = new Int8Array(this.dma_buffer);
  this.dma_buffer_int16 = new Int16Array(this.dma_buffer);
  this.dma_buffer_uint16 = new Uint16Array(this.dma_buffer);
  this.dma_syncbuffer = new SyncBuffer(this.dma_buffer);
  if (this.dma_paused) {
    this.bus.send("dac-disable");
  } else {
    this.bus.send("dac-enable");
  }
};
SB16.prototype.port2x0_read = function() {
  dbg_log("220 read: fm music status port (unimplemented)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x1_read = function() {
  dbg_log("221 read: fm music data port (write only)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x2_read = function() {
  dbg_log("222 read: advanced fm music status port (unimplemented)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x3_read = function() {
  dbg_log("223 read: advanced music data port (write only)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x4_read = function() {
  dbg_log("224 read: mixer address port", LOG_SB16);
  return this.mixer_current_address;
};
SB16.prototype.port2x5_read = function() {
  dbg_log("225 read: mixer data port", LOG_SB16);
  return this.mixer_read(this.mixer_current_address);
};
SB16.prototype.port2x6_read = function() {
  dbg_log("226 read: (write only)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x7_read = function() {
  dbg_log("227 read: undocumented", LOG_SB16);
  return 255;
};
SB16.prototype.port2x8_read = function() {
  dbg_log("228 read: fm music status port (unimplemented)", LOG_SB16);
  return 255;
};
SB16.prototype.port2x9_read = function() {
  dbg_log("229 read: fm music data port (write only)", LOG_SB16);
  return 255;
};
SB16.prototype.port2xA_read = function() {
  dbg_log("22A read: read data", LOG_SB16);
  if (this.read_buffer.length) {
    this.read_buffer_lastvalue = this.read_buffer.shift();
  }
  dbg_log(" <- " + this.read_buffer_lastvalue + " " + h(this.read_buffer_lastvalue) + " '" + String.fromCharCode(this.read_buffer_lastvalue) + "'", LOG_SB16);
  return this.read_buffer_lastvalue;
};
SB16.prototype.port2xB_read = function() {
  dbg_log("22B read: undocumented", LOG_SB16);
  return 255;
};
SB16.prototype.port2xC_read = function() {
  dbg_log("22C read: write-buffer status", LOG_SB16);
  return 127;
};
SB16.prototype.port2xD_read = function() {
  dbg_log("22D read: undocumented", LOG_SB16);
  return 255;
};
SB16.prototype.port2xE_read = function() {
  dbg_log("22E read: read-buffer status / irq 8bit ack.", LOG_SB16);
  if (this.irq_triggered[SB_IRQ_8BIT]) {
    this.lower_irq(SB_IRQ_8BIT);
  }
  var ready = this.read_buffer.length && !this.dsp_highspeed;
  return ready << 7 | 127;
};
SB16.prototype.port2xF_read = function() {
  dbg_log("22F read: irq 16bit ack", LOG_SB16);
  this.lower_irq(SB_IRQ_16BIT);
  return 0;
};
SB16.prototype.port2x0_write = function(value) {
  dbg_log("220 write: (unimplemented) fm register 0 address = " + h(value), LOG_SB16);
  this.fm_current_address0 = 0;
};
SB16.prototype.port2x1_write = function(value) {
  dbg_log("221 write: (unimplemented) fm register 0 data = " + h(value), LOG_SB16);
  var handler = FM_HANDLERS[this.fm_current_address0];
  if (!handler) {
    handler = this.fm_default_write;
  }
  handler.call(this, value, 0, this.fm_current_address0);
};
SB16.prototype.port2x2_write = function(value) {
  dbg_log("222 write: (unimplemented) fm register 1 address = " + h(value), LOG_SB16);
  this.fm_current_address1 = 0;
};
SB16.prototype.port2x3_write = function(value) {
  dbg_log("223 write: (unimplemented) fm register 1 data =" + h(value), LOG_SB16);
  var handler = FM_HANDLERS[this.fm_current_address1];
  if (!handler) {
    handler = this.fm_default_write;
  }
  handler.call(this, value, 1, this.fm_current_address1);
};
SB16.prototype.port2x4_write = function(value) {
  dbg_log("224 write: mixer address = " + h(value), LOG_SB16);
  this.mixer_current_address = value;
};
SB16.prototype.port2x5_write = function(value) {
  dbg_log("225 write: mixer data = " + h(value), LOG_SB16);
  this.mixer_write(this.mixer_current_address, value);
};
SB16.prototype.port2x6_write = function(yesplease) {
  dbg_log("226 write: reset = " + h(yesplease), LOG_SB16);
  if (this.dsp_highspeed) {
    dbg_log(" -> exit highspeed", LOG_SB16);
    this.dsp_highspeed = false;
  } else if (yesplease) {
    dbg_log(" -> reset", LOG_SB16);
    this.dsp_reset();
  }
  this.read_buffer.clear();
  this.read_buffer.push(170);
};
SB16.prototype.port2x7_write = function(value) {
  dbg_log("227 write: undocumented", LOG_SB16);
};
SB16.prototype.port2x8_write = function(value) {
  dbg_log("228 write: fm music register port (unimplemented)", LOG_SB16);
};
SB16.prototype.port2x9_write = function(value) {
  dbg_log("229 write: fm music data port (unimplemented)", LOG_SB16);
};
SB16.prototype.port2xA_write = function(value) {
  dbg_log("22A write: dsp read data port (read only)", LOG_SB16);
};
SB16.prototype.port2xB_write = function(value) {
  dbg_log("22B write: undocumented", LOG_SB16);
};
SB16.prototype.port2xC_write = function(value) {
  dbg_log("22C write: write command/data", LOG_SB16);
  if (this.command === DSP_NO_COMMAND) {
    dbg_log("22C write: command = " + h(value), LOG_SB16);
    this.command = value;
    this.write_buffer.clear();
    this.command_size = DSP_COMMAND_SIZES[value];
  } else {
    dbg_log("22C write: data: " + h(value), LOG_SB16);
    this.write_buffer.push(value);
  }
  if (this.write_buffer.length >= this.command_size) {
    this.command_do();
  }
};
SB16.prototype.port2xD_write = function(value) {
  dbg_log("22D write: undocumented", LOG_SB16);
};
SB16.prototype.port2xE_write = function(value) {
  dbg_log("22E write: dsp read buffer status (read only)", LOG_SB16);
};
SB16.prototype.port2xF_write = function(value) {
  dbg_log("22F write: undocumented", LOG_SB16);
};
SB16.prototype.port3x0_read = function() {
  dbg_log("330 read: mpu data", LOG_SB16);
  if (this.mpu_read_buffer.length) {
    this.mpu_read_buffer_lastvalue = this.mpu_read_buffer.shift();
  }
  dbg_log(" <- " + h(this.mpu_read_buffer_lastvalue), LOG_SB16);
  return this.mpu_read_buffer_lastvalue;
};
SB16.prototype.port3x0_write = function(value) {
  dbg_log("330 write: mpu data (unimplemented) : " + h(value), LOG_SB16);
};
SB16.prototype.port3x1_read = function() {
  dbg_log("331 read: mpu status", LOG_SB16);
  var status = 0;
  status |= 64 * 0;
  status |= 128 * !this.mpu_read_buffer.length;
  return status;
};
SB16.prototype.port3x1_write = function(value) {
  dbg_log("331 write: mpu command: " + h(value), LOG_SB16);
  if (value === 255) {
    this.mpu_read_buffer.clear();
    this.mpu_read_buffer.push(254);
  }
};
SB16.prototype.command_do = function() {
  var handler = DSP_COMMAND_HANDLERS[this.command];
  if (!handler) {
    handler = this.dsp_default_handler;
  }
  handler.call(this);
  this.command = DSP_NO_COMMAND;
  this.command_size = 0;
  this.write_buffer.clear();
};
SB16.prototype.dsp_default_handler = function() {
  dbg_log("Unhandled command: " + h(this.command), LOG_SB16);
};
function register_dsp_command(commands, size, handler) {
  if (!handler) {
    handler = SB16.prototype.dsp_default_handler;
  }
  for (var i = 0; i < commands.length; i++) {
    DSP_COMMAND_SIZES[commands[i]] = size;
    DSP_COMMAND_HANDLERS[commands[i]] = handler;
  }
}
function any_first_digit(base) {
  var commands = [];
  for (var i = 0; i < 16; i++) {
    commands.push(base + i);
  }
  return commands;
}
register_dsp_command([14], 2, function() {
  this.asp_registers[this.write_buffer.shift()] = this.write_buffer.shift();
});
register_dsp_command([15], 1, function() {
  this.read_buffer.clear();
  this.read_buffer.push(this.asp_registers[this.write_buffer.shift()]);
});
register_dsp_command([16], 1, function() {
  var value = audio_normalize(this.write_buffer.shift(), 127.5, -1);
  this.dac_buffers[0].push(value);
  this.dac_buffers[1].push(value);
  this.bus.send("dac-enable");
});
register_dsp_command([20, 21], 2, function() {
  this.dma_irq = SB_IRQ_8BIT;
  this.dma_channel = this.dma_channel_8bit;
  this.dma_autoinit = false;
  this.dsp_signed = false;
  this.dsp_16bit = false;
  this.dsp_highspeed = false;
  this.dma_transfer_size_set();
  this.dma_transfer_start();
});
register_dsp_command([22], 2);
register_dsp_command([23], 2);
register_dsp_command([28], 0, function() {
  this.dma_irq = SB_IRQ_8BIT;
  this.dma_channel = this.dma_channel_8bit;
  this.dma_autoinit = true;
  this.dsp_signed = false;
  this.dsp_16bit = false;
  this.dsp_highspeed = false;
  this.dma_transfer_start();
});
register_dsp_command([31], 0);
register_dsp_command([32], 0, function() {
  this.read_buffer.clear();
  this.read_buffer.push(127);
});
register_dsp_command([36], 2);
register_dsp_command([44], 0);
register_dsp_command([48], 0);
register_dsp_command([49], 0);
register_dsp_command([52], 0);
register_dsp_command([53], 0);
register_dsp_command([54], 0);
register_dsp_command([55], 0);
register_dsp_command([56], 0);
register_dsp_command([64], 1, function() {
  this.sampling_rate_change(
    1e6 / (256 - this.write_buffer.shift()) / this.get_channel_count()
  );
});
register_dsp_command([65, 66], 2, function() {
  this.sampling_rate_change(this.write_buffer.shift() << 8 | this.write_buffer.shift());
});
register_dsp_command([72], 2, function() {
  this.dma_transfer_size_set();
});
register_dsp_command([116], 2);
register_dsp_command([117], 2);
register_dsp_command([118], 2);
register_dsp_command([119], 2);
register_dsp_command([125], 0);
register_dsp_command([127], 0);
register_dsp_command([128], 2);
register_dsp_command([144], 0, function() {
  this.dma_irq = SB_IRQ_8BIT;
  this.dma_channel = this.dma_channel_8bit;
  this.dma_autoinit = true;
  this.dsp_signed = false;
  this.dsp_highspeed = true;
  this.dsp_16bit = false;
  this.dma_transfer_start();
});
register_dsp_command([145], 0);
register_dsp_command([152], 0);
register_dsp_command([153], 0);
register_dsp_command([160], 0);
register_dsp_command([168], 0);
register_dsp_command(any_first_digit(176), 3, function() {
  if (this.command & 1 << 3) {
    this.dsp_default_handler();
    return;
  }
  var mode = this.write_buffer.shift();
  this.dma_irq = SB_IRQ_16BIT;
  this.dma_channel = this.dma_channel_16bit;
  this.dma_autoinit = !!(this.command & 1 << 2);
  this.dsp_signed = !!(mode & 1 << 4);
  this.dsp_stereo = !!(mode & 1 << 5);
  this.dsp_16bit = true;
  this.dma_transfer_size_set();
  this.dma_transfer_start();
});
register_dsp_command(any_first_digit(192), 3, function() {
  if (this.command & 1 << 3) {
    this.dsp_default_handler();
    return;
  }
  var mode = this.write_buffer.shift();
  this.dma_irq = SB_IRQ_8BIT;
  this.dma_channel = this.dma_channel_8bit;
  this.dma_autoinit = !!(this.command & 1 << 2);
  this.dsp_signed = !!(mode & 1 << 4);
  this.dsp_stereo = !!(mode & 1 << 5);
  this.dsp_16bit = false;
  this.dma_transfer_size_set();
  this.dma_transfer_start();
});
register_dsp_command([208], 0, function() {
  this.dma_paused = true;
  this.bus.send("dac-disable");
});
register_dsp_command([209], 0, function() {
  this.dummy_speaker_enabled = true;
});
register_dsp_command([211], 0, function() {
  this.dummy_speaker_enabled = false;
});
register_dsp_command([212], 0, function() {
  this.dma_paused = false;
  this.bus.send("dac-enable");
});
register_dsp_command([213], 0, function() {
  this.dma_paused = true;
  this.bus.send("dac-disable");
});
register_dsp_command([214], 0, function() {
  this.dma_paused = false;
  this.bus.send("dac-enable");
});
register_dsp_command([216], 0, function() {
  this.read_buffer.clear();
  this.read_buffer.push(this.dummy_speaker_enabled * 255);
});
register_dsp_command([217, 218], 0, function() {
  this.dma_autoinit = false;
});
register_dsp_command([224], 1, function() {
  this.read_buffer.clear();
  this.read_buffer.push(~this.write_buffer.shift());
});
register_dsp_command([225], 0, function() {
  this.read_buffer.clear();
  this.read_buffer.push(4);
  this.read_buffer.push(5);
});
register_dsp_command([226], 1);
register_dsp_command([227], 0, function() {
  this.read_buffer.clear();
  for (var i = 0; i < DSP_COPYRIGHT.length; i++) {
    this.read_buffer.push(DSP_COPYRIGHT.charCodeAt(i));
  }
  this.read_buffer.push(0);
});
register_dsp_command([228], 1, function() {
  this.test_register = this.write_buffer.shift();
});
register_dsp_command([232], 0, function() {
  this.read_buffer.clear();
  this.read_buffer.push(this.test_register);
});
register_dsp_command([242, 243], 0, function() {
  this.raise_irq();
});
var SB_F9 = new Uint8Array(256);
SB_F9[14] = 255;
SB_F9[15] = 7;
SB_F9[55] = 56;
register_dsp_command([249], 1, function() {
  var input = this.write_buffer.shift();
  dbg_log("dsp 0xf9: unknown function. input: " + input, LOG_SB16);
  this.read_buffer.clear();
  this.read_buffer.push(SB_F9[input]);
});
SB16.prototype.mixer_read = function(address) {
  var handler = MIXER_READ_HANDLERS[address];
  var data;
  if (handler) {
    data = handler.call(this);
  } else {
    data = this.mixer_registers[address];
    dbg_log("unhandled mixer register read. addr:" + h(address) + " data:" + h(data), LOG_SB16);
  }
  return data;
};
SB16.prototype.mixer_write = function(address, data) {
  var handler = MIXER_WRITE_HANDLERS[address];
  if (handler) {
    handler.call(this, data);
  } else {
    dbg_log("unhandled mixer register write. addr:" + h(address) + " data:" + h(data), LOG_SB16);
  }
};
SB16.prototype.mixer_default_read = function() {
  dbg_log("mixer register read. addr:" + h(this.mixer_current_address), LOG_SB16);
  return this.mixer_registers[this.mixer_current_address];
};
SB16.prototype.mixer_default_write = function(data) {
  dbg_log("mixer register write. addr:" + h(this.mixer_current_address) + " data:" + h(data), LOG_SB16);
  this.mixer_registers[this.mixer_current_address] = data;
};
SB16.prototype.mixer_reset = function() {
  this.mixer_registers[4] = 12 << 4 | 12;
  this.mixer_registers[34] = 12 << 4 | 12;
  this.mixer_registers[38] = 12 << 4 | 12;
  this.mixer_registers[40] = 0;
  this.mixer_registers[46] = 0;
  this.mixer_registers[10] = 0;
  this.mixer_registers[48] = 24 << 3;
  this.mixer_registers[49] = 24 << 3;
  this.mixer_registers[50] = 24 << 3;
  this.mixer_registers[51] = 24 << 3;
  this.mixer_registers[52] = 24 << 3;
  this.mixer_registers[53] = 24 << 3;
  this.mixer_registers[54] = 0;
  this.mixer_registers[55] = 0;
  this.mixer_registers[56] = 0;
  this.mixer_registers[57] = 0;
  this.mixer_registers[59] = 0;
  this.mixer_registers[60] = 31;
  this.mixer_registers[61] = 21;
  this.mixer_registers[62] = 11;
  this.mixer_registers[63] = 0;
  this.mixer_registers[64] = 0;
  this.mixer_registers[65] = 0;
  this.mixer_registers[66] = 0;
  this.mixer_registers[67] = 0;
  this.mixer_registers[68] = 8 << 4;
  this.mixer_registers[69] = 8 << 4;
  this.mixer_registers[70] = 8 << 4;
  this.mixer_registers[71] = 8 << 4;
  this.mixer_full_update();
};
SB16.prototype.mixer_full_update = function() {
  for (var i = 1; i < this.mixer_registers.length; i++) {
    if (MIXER_REGISTER_IS_LEGACY[i]) {
      continue;
    }
    this.mixer_write(i, this.mixer_registers[i]);
  }
};
function register_mixer_read(address, handler) {
  if (!handler) {
    handler = SB16.prototype.mixer_default_read;
  }
  MIXER_READ_HANDLERS[address] = handler;
}
function register_mixer_write(address, handler) {
  if (!handler) {
    handler = SB16.prototype.mixer_default_write;
  }
  MIXER_WRITE_HANDLERS[address] = handler;
}
function register_mixer_legacy(address_old, address_new_left, address_new_right) {
  MIXER_REGISTER_IS_LEGACY[address_old] = 1;
  MIXER_READ_HANDLERS[address_old] = function() {
    var left = this.mixer_registers[address_new_left] & 240;
    var right = this.mixer_registers[address_new_right] >>> 4;
    return left | right;
  };
  MIXER_WRITE_HANDLERS[address_old] = function(data) {
    this.mixer_registers[address_old] = data;
    var prev_left = this.mixer_registers[address_new_left];
    var prev_right = this.mixer_registers[address_new_right];
    var left = data & 240 | prev_left & 15;
    var right = data << 4 & 240 | prev_right & 15;
    this.mixer_write(address_new_left, left);
    this.mixer_write(address_new_right, right);
  };
}
function register_mixer_volume(address, mixer_source, channel) {
  MIXER_READ_HANDLERS[address] = SB16.prototype.mixer_default_read;
  MIXER_WRITE_HANDLERS[address] = function(data) {
    this.mixer_registers[address] = data;
    this.bus.send(
      "mixer-volume",
      [
        mixer_source,
        channel,
        (data >>> 2) - 62
      ]
    );
  };
}
register_mixer_read(0, function() {
  this.mixer_reset();
  return 0;
});
register_mixer_write(0);
register_mixer_legacy(4, 50, 51);
register_mixer_legacy(34, 48, 49);
register_mixer_legacy(38, 52, 53);
register_mixer_legacy(40, 54, 55);
register_mixer_legacy(46, 56, 57);
register_mixer_volume(48, MIXER_SRC_MASTER, MIXER_CHANNEL_LEFT);
register_mixer_volume(49, MIXER_SRC_MASTER, MIXER_CHANNEL_RIGHT);
register_mixer_volume(50, MIXER_SRC_DAC, MIXER_CHANNEL_LEFT);
register_mixer_volume(51, MIXER_SRC_DAC, MIXER_CHANNEL_RIGHT);
register_mixer_read(59);
register_mixer_write(59, function(data) {
  this.mixer_registers[59] = data;
  this.bus.send("mixer-volume", [MIXER_SRC_PCSPEAKER, MIXER_CHANNEL_BOTH, (data >>> 6) * 6 - 18]);
});
register_mixer_read(65);
register_mixer_write(65, function(data) {
  this.mixer_registers[65] = data;
  this.bus.send("mixer-gain-left", (data >>> 6) * 6);
});
register_mixer_read(66);
register_mixer_write(66, function(data) {
  this.mixer_registers[66] = data;
  this.bus.send("mixer-gain-right", (data >>> 6) * 6);
});
register_mixer_read(68);
register_mixer_write(68, function(data) {
  this.mixer_registers[68] = data;
  data >>>= 3;
  this.bus.send("mixer-treble-left", data - (data < 16 ? 14 : 16));
});
register_mixer_read(69);
register_mixer_write(69, function(data) {
  this.mixer_registers[69] = data;
  data >>>= 3;
  this.bus.send("mixer-treble-right", data - (data < 16 ? 14 : 16));
});
register_mixer_read(70);
register_mixer_write(70, function(data) {
  this.mixer_registers[70] = data;
  data >>>= 3;
  this.bus.send("mixer-bass-right", data - (data < 16 ? 14 : 16));
});
register_mixer_read(71);
register_mixer_write(71, function(data) {
  this.mixer_registers[71] = data;
  data >>>= 3;
  this.bus.send("mixer-bass-right", data - (data < 16 ? 14 : 16));
});
register_mixer_read(128, function() {
  switch (this.irq) {
    case SB_IRQ2:
      return 1;
    case SB_IRQ5:
      return 2;
    case SB_IRQ7:
      return 4;
    case SB_IRQ10:
      return 8;
    default:
      return 0;
  }
});
register_mixer_write(128, function(bits) {
  if (bits & 1) this.irq = SB_IRQ2;
  if (bits & 2) this.irq = SB_IRQ5;
  if (bits & 4) this.irq = SB_IRQ7;
  if (bits & 8) this.irq = SB_IRQ10;
});
register_mixer_read(129, function() {
  var ret = 0;
  switch (this.dma_channel_8bit) {
    case SB_DMA0:
      ret |= 1;
      break;
    case SB_DMA1:
      ret |= 2;
      break;
    // Channel 2 is hardwired to floppy disk.
    case SB_DMA3:
      ret |= 8;
      break;
  }
  switch (this.dma_channel_16bit) {
    // Channel 4 cannot be used.
    case SB_DMA5:
      ret |= 32;
      break;
    case SB_DMA6:
      ret |= 64;
      break;
    case SB_DMA7:
      ret |= 128;
      break;
  }
  return ret;
});
register_mixer_write(129, function(bits) {
  if (bits & 1) this.dma_channel_8bit = SB_DMA0;
  if (bits & 2) this.dma_channel_8bit = SB_DMA1;
  if (bits & 8) this.dma_channel_8bit = SB_DMA3;
  if (bits & 32) this.dma_channel_16bit = SB_DMA5;
  if (bits & 64) this.dma_channel_16bit = SB_DMA6;
  if (bits & 128) this.dma_channel_16bit = SB_DMA7;
});
register_mixer_read(130, function() {
  var ret = 32;
  for (var i = 0; i < 16; i++) {
    ret |= i * this.irq_triggered[i];
  }
  return ret;
});
SB16.prototype.fm_default_write = function(data, register, address) {
  dbg_log("unhandled fm register write. addr:" + register + "|" + h(address) + " data:" + h(data), LOG_SB16);
};
function register_fm_write(addresses, handler) {
  if (!handler) {
    handler = SB16.prototype.fm_default_write;
  }
  for (var i = 0; i < addresses.length; i++) {
    FM_HANDLERS[addresses[i]] = handler;
  }
}
function between(start, end) {
  var a = [];
  for (var i = start; i <= end; i++) {
    a.push(i);
  }
  return a;
}
var SB_FM_OPERATORS_BY_OFFSET = new Uint8Array(32);
SB_FM_OPERATORS_BY_OFFSET[0] = 0;
SB_FM_OPERATORS_BY_OFFSET[1] = 1;
SB_FM_OPERATORS_BY_OFFSET[2] = 2;
SB_FM_OPERATORS_BY_OFFSET[3] = 3;
SB_FM_OPERATORS_BY_OFFSET[4] = 4;
SB_FM_OPERATORS_BY_OFFSET[5] = 5;
SB_FM_OPERATORS_BY_OFFSET[8] = 6;
SB_FM_OPERATORS_BY_OFFSET[9] = 7;
SB_FM_OPERATORS_BY_OFFSET[10] = 8;
SB_FM_OPERATORS_BY_OFFSET[11] = 9;
SB_FM_OPERATORS_BY_OFFSET[12] = 10;
SB_FM_OPERATORS_BY_OFFSET[13] = 11;
SB_FM_OPERATORS_BY_OFFSET[16] = 12;
SB_FM_OPERATORS_BY_OFFSET[17] = 13;
SB_FM_OPERATORS_BY_OFFSET[18] = 14;
SB_FM_OPERATORS_BY_OFFSET[19] = 15;
SB_FM_OPERATORS_BY_OFFSET[20] = 16;
SB_FM_OPERATORS_BY_OFFSET[21] = 17;
function get_fm_operator(register, offset) {
  return register * 18 + SB_FM_OPERATORS_BY_OFFSET[offset];
}
register_fm_write([1], function(bits, register, address) {
  this.fm_waveform_select_enable[register] = bits & 32 > 0;
  this.fm_update_waveforms();
});
register_fm_write([2]);
register_fm_write([3]);
register_fm_write([4], function(bits, register, address) {
  switch (register) {
    case 0:
      break;
    case 1:
      break;
  }
});
register_fm_write([5], function(bits, register, address) {
  if (register === 0) {
    this.fm_default_write(bits, register, address);
  } else {
  }
});
register_fm_write([8], function(bits, register, address) {
});
register_fm_write(between(32, 53), function(bits, register, address) {
  var operator = get_fm_operator(register, address - 32);
});
register_fm_write(between(64, 85), function(bits, register, address) {
  var operator = get_fm_operator(register, address - 64);
});
register_fm_write(between(96, 117), function(bits, register, address) {
  var operator = get_fm_operator(register, address - 96);
});
register_fm_write(between(128, 149), function(bits, register, address) {
  var operator = get_fm_operator(register, address - 128);
});
register_fm_write(between(160, 168), function(bits, register, address) {
  var channel = address - 160;
});
register_fm_write(between(176, 184), function(bits, register, address) {
});
register_fm_write([189], function(bits, register, address) {
});
register_fm_write(between(192, 200), function(bits, register, address) {
});
register_fm_write(between(224, 245), function(bits, register, address) {
  var operator = get_fm_operator(register, address - 224);
});
SB16.prototype.fm_update_waveforms = function() {
};
SB16.prototype.sampling_rate_change = function(rate) {
  this.sampling_rate = rate;
  this.bus.send("dac-tell-sampling-rate", rate);
};
SB16.prototype.get_channel_count = function() {
  return this.dsp_stereo ? 2 : 1;
};
SB16.prototype.dma_transfer_size_set = function() {
  this.dma_sample_count = 1 + (this.write_buffer.shift() << 0) + (this.write_buffer.shift() << 8);
};
SB16.prototype.dma_transfer_start = function() {
  dbg_log("begin dma transfer", LOG_SB16);
  this.bytes_per_sample = 1;
  if (this.dsp_16bit) this.bytes_per_sample *= 2;
  this.dma_bytes_count = this.dma_sample_count * this.bytes_per_sample;
  this.dma_bytes_block = SB_DMA_BLOCK_SAMPLES * this.bytes_per_sample;
  var max_bytes_block = Math.max(this.dma_bytes_count >> 2 & ~3, 32);
  this.dma_bytes_block = Math.min(max_bytes_block, this.dma_bytes_block);
  this.dma_waiting_transfer = true;
  if (!this.dma.channel_mask[this.dma_channel]) {
    this.dma_on_unmask(this.dma_channel);
  }
};
SB16.prototype.dma_on_unmask = function(channel) {
  if (channel !== this.dma_channel || !this.dma_waiting_transfer) {
    return;
  }
  this.dma_waiting_transfer = false;
  this.dma_bytes_left = this.dma_bytes_count;
  this.dma_paused = false;
  this.bus.send("dac-enable");
};
SB16.prototype.dma_transfer_next = function() {
  dbg_log("dma transfering next block", LOG_SB16);
  var size = Math.min(this.dma_bytes_left, this.dma_bytes_block);
  var samples = Math.floor(size / this.bytes_per_sample);
  this.dma.do_write(this.dma_syncbuffer, 0, size, this.dma_channel, (error) => {
    dbg_log("dma block transfer " + (error ? "unsuccessful" : "successful"), LOG_SB16);
    if (error) return;
    this.dma_to_dac(samples);
    this.dma_bytes_left -= size;
    if (!this.dma_bytes_left) {
      this.raise_irq(this.dma_irq);
      if (this.dma_autoinit) {
        this.dma_bytes_left = this.dma_bytes_count;
      }
    }
  });
};
SB16.prototype.dma_to_dac = function(sample_count) {
  var amplitude = this.dsp_16bit ? 32767.5 : 127.5;
  var offset = this.dsp_signed ? 0 : -1;
  var repeats = this.dsp_stereo ? 1 : 2;
  var buffer;
  if (this.dsp_16bit) {
    buffer = this.dsp_signed ? this.dma_buffer_int16 : this.dma_buffer_uint16;
  } else {
    buffer = this.dsp_signed ? this.dma_buffer_int8 : this.dma_buffer_uint8;
  }
  var channel = 0;
  for (var i = 0; i < sample_count; i++) {
    var sample = audio_normalize(buffer[i], amplitude, offset);
    for (var j = 0; j < repeats; j++) {
      this.dac_buffers[channel].push(sample);
      channel ^= 1;
    }
  }
  this.dac_send();
};
SB16.prototype.dac_handle_request = function() {
  if (!this.dma_bytes_left || this.dma_paused) {
    this.dac_send();
  } else {
    this.dma_transfer_next();
  }
};
SB16.prototype.dac_send = function() {
  if (!this.dac_buffers[0].length) {
    return;
  }
  var out0 = this.dac_buffers[0].shift_block(this.dac_buffers[0].length);
  var out1 = this.dac_buffers[1].shift_block(this.dac_buffers[1].length);
  this.bus.send("dac-send-data", [out0, out1], [out0.buffer, out1.buffer]);
};
SB16.prototype.raise_irq = function(type) {
  dbg_log("raise irq", LOG_SB16);
  this.irq_triggered[type] = 1;
  this.cpu.device_raise_irq(this.irq);
};
SB16.prototype.lower_irq = function(type) {
  dbg_log("lower irq", LOG_SB16);
  this.irq_triggered[type] = 0;
  this.cpu.device_lower_irq(this.irq);
};
function audio_normalize(value, amplitude, offset) {
  return audio_clip(value / amplitude + offset, -1, 1);
}
function audio_clip(value, low, high) {
  return (value < low) * low + (value > high) * high + (low <= value && value <= high) * value;
}

// src/acpi.js
var PMTIMER_FREQ_SECONDS = 3579545;
function ACPI(cpu) {
  this.cpu = cpu;
  var io = cpu.io;
  var acpi = {
    pci_id: 7 << 3,
    pci_space: [
      134,
      128,
      19,
      113,
      7,
      0,
      128,
      2,
      8,
      0,
      128,
      6,
      0,
      0,
      128,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      9,
      1,
      0,
      0
    ],
    pci_bars: [],
    name: "acpi"
  };
  cpu.devices.pci.register_device(acpi);
  this.timer_last_value = 0;
  this.timer_imprecision_offset = 0;
  this.status = 1;
  this.pm1_status = 0;
  this.pm1_enable = 0;
  this.last_timer = this.get_timer(v86.microtick());
  this.gpe = new Uint8Array(4);
  io.register_read(45056, this, void 0, function() {
    dbg_log("ACPI pm1_status read", LOG_ACPI);
    return this.pm1_status;
  });
  io.register_write(45056, this, void 0, function(value) {
    dbg_log("ACPI pm1_status write: " + h(value, 4), LOG_ACPI);
    this.pm1_status &= ~value;
  });
  io.register_read(45058, this, void 0, function() {
    dbg_log("ACPI pm1_enable read", LOG_ACPI);
    return this.pm1_enable;
  });
  io.register_write(45058, this, void 0, function(value) {
    dbg_log("ACPI pm1_enable write: " + h(value), LOG_ACPI);
    this.pm1_enable = value;
  });
  io.register_read(45060, this, function() {
    dbg_log("ACPI status read8", LOG_ACPI);
    return this.status & 255;
  }, function() {
    dbg_log("ACPI status read", LOG_ACPI);
    return this.status;
  });
  io.register_write(45060, this, void 0, function(value) {
    dbg_log("ACPI status write: " + h(value), LOG_ACPI);
    this.status = value;
    if (value & 1 << 13) {
      var slp_typ = value >> 10 & 7;
      dbg_log("ACPI power off request: SLP_TYP=" + slp_typ, LOG_ACPI);
      this.cpu.bus.send("emulator-stopped");
    }
  });
  io.register_read(45064, this, void 0, void 0, function() {
    if (!this.dsdt_patched) {
      this.dsdt_patched = this.patch_dsdt_s5();
    }
    var value = this.get_timer(v86.microtick()) & 16777215;
    return value;
  });
  io.register_read(45024, this, function() {
    dbg_log("Read gpe#0", LOG_ACPI);
    return this.gpe[0];
  });
  io.register_read(45025, this, function() {
    dbg_log("Read gpe#1", LOG_ACPI);
    return this.gpe[1];
  });
  io.register_read(45026, this, function() {
    dbg_log("Read gpe#2", LOG_ACPI);
    return this.gpe[2];
  });
  io.register_read(45027, this, function() {
    dbg_log("Read gpe#3", LOG_ACPI);
    return this.gpe[3];
  });
  io.register_write(45024, this, function(value) {
    dbg_log("Write gpe#0: " + h(value), LOG_ACPI);
    this.gpe[0] = value;
  });
  io.register_write(45025, this, function(value) {
    dbg_log("Write gpe#1: " + h(value), LOG_ACPI);
    this.gpe[1] = value;
  });
  io.register_write(45026, this, function(value) {
    dbg_log("Write gpe#2: " + h(value), LOG_ACPI);
    this.gpe[2] = value;
  });
  io.register_write(45027, this, function(value) {
    dbg_log("Write gpe#3: " + h(value), LOG_ACPI);
    this.gpe[3] = value;
  });
  io.register_write(178, this, function(value) {
    dbg_log("ACPI SMI_CMD write: " + h(value), LOG_ACPI);
    if (value === 241) {
      this.status |= 1;
      dbg_log("ACPI enabled (SCI_EN set)", LOG_ACPI);
    } else if (value === 240) {
      this.status &= ~1;
      dbg_log("ACPI disabled (SCI_EN cleared)", LOG_ACPI);
    }
  });
  this.dsdt_patched = false;
}
ACPI.prototype.timer = function(now) {
  var timer = this.get_timer(now);
  var highest_bit_changed = ((timer ^ this.last_timer) & 1 << 23) !== 0;
  if (this.pm1_enable & 1 && highest_bit_changed) {
    dbg_log("ACPI raise irq", LOG_ACPI);
    this.pm1_status |= 1;
    this.cpu.device_raise_irq(9);
  } else {
    this.cpu.device_lower_irq(9);
  }
  this.last_timer = timer;
  return 100;
};
ACPI.prototype.get_timer = function(now) {
  const t = Math.round(now * (PMTIMER_FREQ_SECONDS / 1e3));
  if (t === this.timer_last_value) {
    if (this.timer_imprecision_offset < PMTIMER_FREQ_SECONDS / 1e3) {
      this.timer_imprecision_offset++;
    }
  } else {
    dbg_assert(t > this.timer_last_value);
    const previous_timer = this.timer_last_value + this.timer_imprecision_offset;
    if (previous_timer <= t) {
      this.timer_imprecision_offset = 0;
      this.timer_last_value = t;
    } else {
      dbg_log("Warning: Overshot pmtimer, waiting; current=" + t + " last=" + this.timer_last_value + " offset=" + this.timer_imprecision_offset, LOG_ACPI);
    }
  }
  return this.timer_last_value + this.timer_imprecision_offset;
};
ACPI.prototype.patch_dsdt_s5 = function() {
  const mem = this.cpu.mem8;
  if (!mem || mem.length < 1048576) {
    dbg_log("ACPI patch_dsdt_s5: mem8 not ready yet", LOG_ACPI);
    return;
  }
  const RSD_SIG = [82, 83, 68, 32, 80, 84, 82, 32];
  let rsdp_addr = -1;
  outer: for (let addr = 917504; addr < 1048576 - 8; addr += 16) {
    for (let i = 0; i < 8; i++) {
      if (mem[addr + i] !== RSD_SIG[i]) continue outer;
    }
    rsdp_addr = addr;
    break;
  }
  if (rsdp_addr === -1) {
    dbg_log("ACPI patch_dsdt_s5: RSDP not found in 0xE0000\u20130xFFFFF", LOG_ACPI);
    return;
  }
  dbg_log("ACPI patch_dsdt_s5: RSDP at " + h(rsdp_addr), LOG_ACPI);
  const rsdt_addr = mem[rsdp_addr + 16] | mem[rsdp_addr + 17] << 8 | mem[rsdp_addr + 18] << 16 | mem[rsdp_addr + 19] << 24;
  if (rsdt_addr === 0 || rsdt_addr >= mem.length) {
    dbg_log("ACPI patch_dsdt_s5: invalid RSDT address " + h(rsdt_addr >>> 0), LOG_ACPI);
    return;
  }
  dbg_log("ACPI patch_dsdt_s5: RSDT at " + h(rsdt_addr >>> 0), LOG_ACPI);
  if (mem[rsdt_addr] !== 82 || mem[rsdt_addr + 1] !== 83 || mem[rsdt_addr + 2] !== 68 || mem[rsdt_addr + 3] !== 84) {
    dbg_log("ACPI patch_dsdt_s5: RSDT signature mismatch", LOG_ACPI);
    return;
  }
  const rsdt_len = mem[rsdt_addr + 4] | mem[rsdt_addr + 5] << 8 | mem[rsdt_addr + 6] << 16 | mem[rsdt_addr + 7] << 24;
  const entry_count = rsdt_len - 36 >>> 2;
  let facp_addr = -1;
  for (let i = 0; i < entry_count; i++) {
    const ptr_off = rsdt_addr + 36 + i * 4;
    const entry = mem[ptr_off] | mem[ptr_off + 1] << 8 | mem[ptr_off + 2] << 16 | mem[ptr_off + 3] << 24;
    if (entry === 0 || entry >= mem.length) continue;
    if (mem[entry] === 70 && mem[entry + 1] === 65 && mem[entry + 2] === 67 && mem[entry + 3] === 80) {
      facp_addr = entry;
      break;
    }
  }
  if (facp_addr === -1) {
    dbg_log("ACPI patch_dsdt_s5: FACP not found in RSDT", LOG_ACPI);
    return;
  }
  dbg_log("ACPI patch_dsdt_s5: FACP at " + h(facp_addr >>> 0), LOG_ACPI);
  const dsdt_addr = mem[facp_addr + 40] | mem[facp_addr + 41] << 8 | mem[facp_addr + 42] << 16 | mem[facp_addr + 43] << 24;
  if (dsdt_addr === 0 || dsdt_addr >= mem.length) {
    dbg_log("ACPI patch_dsdt_s5: invalid DSDT address " + h(dsdt_addr >>> 0), LOG_ACPI);
    return;
  }
  dbg_log("ACPI patch_dsdt_s5: DSDT at " + h(dsdt_addr >>> 0), LOG_ACPI);
  if (mem[dsdt_addr] !== 68 || mem[dsdt_addr + 1] !== 83 || mem[dsdt_addr + 2] !== 68 || mem[dsdt_addr + 3] !== 84) {
    dbg_log("ACPI patch_dsdt_s5: DSDT signature mismatch", LOG_ACPI);
    return;
  }
  const dsdt_len_orig = mem[dsdt_addr + 4] | mem[dsdt_addr + 5] << 8 | mem[dsdt_addr + 6] << 16 | mem[dsdt_addr + 7] << 24;
  const aml_end = dsdt_addr + dsdt_len_orig;
  for (let a = dsdt_addr + 36; a < aml_end - 4; a++) {
    if (mem[a] === 95 && mem[a + 1] === 83 && mem[a + 2] === 53 && mem[a + 3] === 95) {
      dbg_log("ACPI patch_dsdt_s5: \\_S5_ already present, skipping patch", LOG_ACPI);
      return;
    }
  }
  if (aml_end + 16 > mem.length) {
    dbg_log("ACPI patch_dsdt_s5: no room to append \\S5_ AML", LOG_ACPI);
    return;
  }
  const S5_AML = [
    8,
    95,
    83,
    53,
    95,
    // NameOp + "_S5_"
    18,
    10,
    4,
    // PackageOp, PkgLength, NumElements
    10,
    5,
    10,
    5,
    // SLP_TYPa, SLP_TYPb
    10,
    5,
    10,
    5
    // Reserved entries
  ];
  for (let i = 0; i < S5_AML.length; i++) {
    mem[aml_end + i] = S5_AML[i];
  }
  const new_len = dsdt_len_orig + 16;
  mem[dsdt_addr + 4] = new_len & 255;
  mem[dsdt_addr + 5] = new_len >>> 8 & 255;
  mem[dsdt_addr + 6] = new_len >>> 16 & 255;
  mem[dsdt_addr + 7] = new_len >>> 24 & 255;
  mem[dsdt_addr + 9] = 0;
  let sum = 0;
  for (let i = 0; i < new_len; i++) {
    sum += mem[dsdt_addr + i];
  }
  mem[dsdt_addr + 9] = 256 - (sum & 255) & 255;
  dbg_log(
    "ACPI patch_dsdt_s5: appended \\_S5_ AML at " + h(aml_end >>> 0) + ", DSDT len " + h(dsdt_len_orig >>> 0) + " \u2192 " + h(new_len >>> 0),
    LOG_ACPI
  );
  return true;
};
ACPI.prototype.get_state = function() {
  var state = [];
  state[0] = this.status;
  state[1] = this.pm1_status;
  state[2] = this.pm1_enable;
  state[3] = this.gpe;
  return state;
};
ACPI.prototype.set_state = function(state) {
  this.status = state[0];
  this.pm1_status = state[1];
  this.pm1_enable = state[2];
  this.gpe = state[3];
};

// src/pit.js
var OSCILLATOR_FREQ = 1193.1816666;
function PIT(cpu, bus) {
  this.cpu = cpu;
  this.bus = bus;
  this.counter_start_time = new Float64Array(3);
  this.counter_start_value = new Uint16Array(3);
  this.counter_next_low = new Uint8Array(4);
  this.counter_enabled = new Uint8Array(4);
  this.counter_mode = new Uint8Array(4);
  this.counter_read_mode = new Uint8Array(4);
  this.counter_latch = new Uint8Array(4);
  this.counter_latch_value = new Uint16Array(3);
  this.counter_reload = new Uint16Array(3);
  cpu.io.register_read(97, this, function() {
    var now = v86.microtick();
    var ref_toggle = now * (1e3 * 1e3 / 15e3) & 1;
    var counter2_out = this.did_rollover(2, now);
    return ref_toggle << 4 | counter2_out << 5;
  });
  cpu.io.register_write(97, this, function(data) {
    if (data & 1) {
      this.bus.send("pcspeaker-enable");
    } else {
      this.bus.send("pcspeaker-disable");
    }
  });
  cpu.io.register_read(64, this, function() {
    return this.counter_read(0);
  });
  cpu.io.register_read(65, this, function() {
    return this.counter_read(1);
  });
  cpu.io.register_read(66, this, function() {
    return this.counter_read(2);
  });
  cpu.io.register_write(64, this, function(data) {
    this.counter_write(0, data);
  });
  cpu.io.register_write(65, this, function(data) {
    this.counter_write(1, data);
  });
  cpu.io.register_write(66, this, function(data) {
    this.counter_write(2, data);
    this.bus.send("pcspeaker-update", [this.counter_mode[2], this.counter_reload[2]]);
  });
  cpu.io.register_write(67, this, this.port43_write);
}
PIT.prototype.get_state = function() {
  var state = [];
  state[0] = this.counter_next_low;
  state[1] = this.counter_enabled;
  state[2] = this.counter_mode;
  state[3] = this.counter_read_mode;
  state[4] = this.counter_latch;
  state[5] = this.counter_latch_value;
  state[6] = this.counter_reload;
  state[7] = this.counter_start_time;
  state[8] = this.counter_start_value;
  return state;
};
PIT.prototype.set_state = function(state) {
  this.counter_next_low = state[0];
  this.counter_enabled = state[1];
  this.counter_mode = state[2];
  this.counter_read_mode = state[3];
  this.counter_latch = state[4];
  this.counter_latch_value = state[5];
  this.counter_reload = state[6];
  this.counter_start_time = state[7];
  this.counter_start_value = state[8];
};
PIT.prototype.timer = function(now, no_irq) {
  var time_to_next_interrupt = 100;
  if (!no_irq) {
    if (this.counter_enabled[0] && this.did_rollover(0, now)) {
      this.counter_start_value[0] = this.get_counter_value(0, now);
      this.counter_start_time[0] = now;
      dbg_log("pit interrupt. new value: " + this.counter_start_value[0], LOG_PIT);
      this.cpu.device_lower_irq(0);
      this.cpu.device_raise_irq(0);
      var mode = this.counter_mode[0];
      if (mode === 0) {
        this.counter_enabled[0] = 0;
      }
    } else {
      this.cpu.device_lower_irq(0);
    }
    if (this.counter_enabled[0]) {
      const diff = now - this.counter_start_time[0];
      const diff_in_ticks = Math.floor(diff * OSCILLATOR_FREQ);
      const ticks_missing = this.counter_start_value[0] - diff_in_ticks;
      time_to_next_interrupt = ticks_missing / OSCILLATOR_FREQ;
    }
  }
  return time_to_next_interrupt;
};
PIT.prototype.get_counter_value = function(i, now) {
  if (!this.counter_enabled[i]) {
    return 0;
  }
  var diff = now - this.counter_start_time[i];
  var diff_in_ticks = Math.floor(diff * OSCILLATOR_FREQ);
  var value = this.counter_start_value[i] - diff_in_ticks;
  dbg_log("diff=" + diff + " dticks=" + diff_in_ticks + " value=" + value + " reload=" + this.counter_reload[i], LOG_PIT);
  var reload = this.counter_reload[i];
  if (value >= reload) {
    dbg_log("Warning: Counter" + i + " value " + value + " is larger than reload " + reload, LOG_PIT);
    value %= reload;
  } else if (value < 0) {
    value = value % reload + reload;
  }
  return value;
};
PIT.prototype.did_rollover = function(i, now) {
  var diff = now - this.counter_start_time[i];
  if (diff < 0) {
    dbg_log("Warning: PIT timer difference is negative, resetting (timer " + i + ")");
    return true;
  }
  var diff_in_ticks = Math.floor(diff * OSCILLATOR_FREQ);
  return this.counter_start_value[i] < diff_in_ticks;
};
PIT.prototype.counter_read = function(i) {
  var latch = this.counter_latch[i];
  if (latch) {
    this.counter_latch[i]--;
    if (latch === 2) {
      return this.counter_latch_value[i] & 255;
    } else {
      return this.counter_latch_value[i] >> 8;
    }
  } else {
    var next_low = this.counter_next_low[i];
    if (this.counter_mode[i] === 3) {
      this.counter_next_low[i] ^= 1;
    }
    var value = this.get_counter_value(i, v86.microtick());
    if (next_low) {
      return value & 255;
    } else {
      return value >> 8;
    }
  }
};
PIT.prototype.counter_write = function(i, value) {
  if (this.counter_next_low[i]) {
    this.counter_reload[i] = this.counter_reload[i] & ~255 | value;
  } else {
    this.counter_reload[i] = this.counter_reload[i] & 255 | value << 8;
  }
  if (this.counter_read_mode[i] !== 3 || !this.counter_next_low[i]) {
    if (!this.counter_reload[i]) {
      this.counter_reload[i] = 65535;
    }
    this.counter_start_value[i] = this.counter_reload[i];
    this.counter_enabled[i] = true;
    this.counter_start_time[i] = v86.microtick();
    dbg_log("counter" + i + " reload=" + h(this.counter_reload[i]) + " tick=" + (this.counter_reload[i] || 65536) / OSCILLATOR_FREQ + "ms", LOG_PIT);
  }
  if (this.counter_read_mode[i] === 3) {
    this.counter_next_low[i] ^= 1;
  }
};
PIT.prototype.port43_write = function(reg_byte) {
  var mode = reg_byte >> 1 & 7, binary_mode = reg_byte & 1, i = reg_byte >> 6 & 3, read_mode = reg_byte >> 4 & 3;
  if (i === 1) {
    dbg_log("Unimplemented timer1", LOG_PIT);
  }
  if (i === 3) {
    dbg_log("Unimplemented read back", LOG_PIT);
    return;
  }
  if (read_mode === 0) {
    this.counter_latch[i] = 2;
    var value = this.get_counter_value(i, v86.microtick());
    dbg_log("latch: " + value, LOG_PIT);
    this.counter_latch_value[i] = value ? value - 1 : 0;
    return;
  }
  if (mode >= 6) {
    mode &= ~4;
  }
  dbg_log("Control: mode=" + mode + " ctr=" + i + " read_mode=" + read_mode + " bcd=" + binary_mode, LOG_PIT);
  if (read_mode === 1) {
    this.counter_next_low[i] = 1;
  } else if (read_mode === 2) {
    this.counter_next_low[i] = 0;
  } else {
    this.counter_next_low[i] = 1;
  }
  if (i === 0) {
    this.cpu.device_lower_irq(0);
  }
  if (mode === 0) {
  } else if (mode === 3 || mode === 2) {
  } else {
    dbg_log("Unimplemented counter mode: " + h(mode), LOG_PIT);
  }
  this.counter_mode[i] = mode;
  this.counter_read_mode[i] = read_mode;
  if (i === 2) {
    this.bus.send("pcspeaker-update", [this.counter_mode[2], this.counter_reload[2]]);
  }
};
PIT.prototype.dump = function() {
  const reload = this.counter_reload[0];
  const time = (reload || 65536) / OSCILLATOR_FREQ;
  dbg_log("counter0 ticks every " + time + "ms (reload=" + reload + ")");
};

// src/uart.js
var DLAB = 128;
var UART_IER_MSI = 8;
var UART_IER_THRI = 2;
var UART_IER_RDI = 1;
var UART_IIR_MSI = 0;
var UART_IIR_NO_INT = 1;
var UART_IIR_THRI = 2;
var UART_IIR_RDI = 4;
var UART_IIR_CTI = 12;
var UART_MCR_LOOPBACK = 16;
var UART_LSR_DATA_READY = 1;
var UART_LSR_TX_EMPTY = 32;
var UART_LSR_TRANSMITTER_EMPTY = 64;
var UART_MSR_DCD = 7;
var UART_MSR_RI = 6;
var UART_MSR_DSR = 5;
var UART_MSR_CTS = 4;
var UART_MSR_DDCD = 3;
var UART_MSR_TERI = 2;
var UART_MSR_DDSR = 1;
var UART_MSR_DCTS = 0;
function UART(cpu, port, bus) {
  this.bus = bus;
  this.cpu = cpu;
  this.ints = 1 << UART_IIR_THRI;
  this.baud_rate = 0;
  this.line_control = 0;
  this.lsr = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY;
  this.fifo_control = 0;
  this.ier = 0;
  this.iir = UART_IIR_NO_INT;
  this.modem_control = 0;
  this.modem_status = 0;
  this.scratch_register = 0;
  this.irq = 0;
  this.input = [];
  this.current_line = "";
  switch (port) {
    case 1016:
      this.com = 0;
      this.irq = 4;
      break;
    case 760:
      this.com = 1;
      this.irq = 3;
      break;
    case 1e3:
      this.com = 2;
      this.irq = 4;
      break;
    case 744:
      this.com = 3;
      this.irq = 3;
      break;
    default:
      dbg_log("Invalid serial port: " + h(port), LOG_SERIAL);
      this.com = 0;
      this.irq = 4;
  }
  this.bus.register("serial" + this.com + "-input", function(data) {
    this.data_received(data);
  }, this);
  this.bus.register("serial" + this.com + "-modem-status-input", function(data) {
    this.set_modem_status(data);
  }, this);
  this.bus.register("serial" + this.com + "-carrier-detect-input", function(data) {
    const status = data ? this.modem_status | 1 << UART_MSR_DCD | 1 << UART_MSR_DDCD : this.modem_status & ~(1 << UART_MSR_DCD) & ~(1 << UART_MSR_DDCD);
    this.set_modem_status(status);
  }, this);
  this.bus.register("serial" + this.com + "-ring-indicator-input", function(data) {
    const status = data ? this.modem_status | 1 << UART_MSR_RI | 1 << UART_MSR_TERI : this.modem_status & ~(1 << UART_MSR_RI) & ~(1 << UART_MSR_TERI);
    this.set_modem_status(status);
  }, this);
  this.bus.register("serial" + this.com + "-data-set-ready-input", function(data) {
    const status = data ? this.modem_status | 1 << UART_MSR_DSR | 1 << UART_MSR_DDSR : this.modem_status & ~(1 << UART_MSR_DSR) & ~(1 << UART_MSR_DDSR);
    this.set_modem_status(status);
  }, this);
  this.bus.register("serial" + this.com + "-clear-to-send-input", function(data) {
    const status = data ? this.modem_status | 1 << UART_MSR_CTS | 1 << UART_MSR_DCTS : this.modem_status & ~(1 << UART_MSR_CTS) & ~(1 << UART_MSR_DCTS);
    this.set_modem_status(status);
  }, this);
  var io = cpu.io;
  io.register_write(port, this, function(out_byte) {
    this.write_data(out_byte);
  }, function(out_word) {
    this.write_data(out_word & 255);
    this.write_data(out_word >> 8);
  });
  io.register_write(port | 1, this, function(out_byte) {
    if (this.line_control & DLAB) {
      this.baud_rate = this.baud_rate & 255 | out_byte << 8;
      dbg_log("baud rate: " + h(this.baud_rate), LOG_SERIAL);
    } else {
      if ((this.ier & UART_IIR_THRI) === 0 && out_byte & UART_IIR_THRI) {
        this.ThrowInterrupt(UART_IIR_THRI);
      }
      this.ier = out_byte & 15;
      dbg_log("interrupt enable: " + h(out_byte), LOG_SERIAL);
      this.CheckInterrupt();
    }
  });
  io.register_read(port, this, function() {
    if (this.line_control & DLAB) {
      return this.baud_rate & 255;
    } else {
      let data = 0;
      if (this.input.length === 0) {
        dbg_log("Read input empty", LOG_SERIAL);
      } else {
        data = this.input.shift();
        dbg_log("Read input: " + h(data), LOG_SERIAL);
      }
      if (this.input.length === 0) {
        this.lsr &= ~UART_LSR_DATA_READY;
        this.ClearInterrupt(UART_IIR_CTI);
        this.ClearInterrupt(UART_IIR_RDI);
      }
      return data;
    }
  });
  io.register_read(port | 1, this, function() {
    if (this.line_control & DLAB) {
      return this.baud_rate >> 8;
    } else {
      return this.ier & 15;
    }
  });
  io.register_read(port | 2, this, function() {
    var ret = this.iir & 15;
    dbg_log("read interrupt identification: " + h(this.iir), LOG_SERIAL);
    if (this.iir === UART_IIR_THRI) {
      this.ClearInterrupt(UART_IIR_THRI);
    }
    if (this.fifo_control & 1) ret |= 192;
    return ret;
  });
  io.register_write(port | 2, this, function(out_byte) {
    dbg_log("fifo control: " + h(out_byte), LOG_SERIAL);
    this.fifo_control = out_byte;
  });
  io.register_read(port | 3, this, function() {
    dbg_log("read line control: " + h(this.line_control), LOG_SERIAL);
    return this.line_control;
  });
  io.register_write(port | 3, this, function(out_byte) {
    dbg_log("line control: " + h(out_byte), LOG_SERIAL);
    this.line_control = out_byte;
  });
  io.register_read(port | 4, this, function() {
    return this.modem_control;
  });
  io.register_write(port | 4, this, function(out_byte) {
    dbg_log("modem control: " + h(out_byte), LOG_SERIAL);
    this.modem_control = out_byte;
  });
  io.register_read(port | 5, this, function() {
    dbg_log("read line status: " + h(this.lsr), LOG_SERIAL);
    return this.lsr;
  });
  io.register_write(port | 5, this, function(out_byte) {
    dbg_log("Factory test write", LOG_SERIAL);
  });
  io.register_read(port | 6, this, function() {
    dbg_log("read modem status: " + h(this.modem_status), LOG_SERIAL);
    this.modem_status &= 240;
    return this.modem_status;
  });
  io.register_write(port | 6, this, function(out_byte) {
    dbg_log("write modem status: " + h(out_byte), LOG_SERIAL);
    this.set_modem_status(out_byte);
  });
  io.register_read(port | 7, this, function() {
    return this.scratch_register;
  });
  io.register_write(port | 7, this, function(out_byte) {
    this.scratch_register = out_byte;
  });
}
UART.prototype.get_state = function() {
  var state = [];
  state[0] = this.ints;
  state[1] = this.baud_rate;
  state[2] = this.line_control;
  state[3] = this.lsr;
  state[4] = this.fifo_control;
  state[5] = this.ier;
  state[6] = this.iir;
  state[7] = this.modem_control;
  state[8] = this.modem_status;
  state[9] = this.scratch_register;
  state[10] = this.irq;
  return state;
};
UART.prototype.set_state = function(state) {
  this.ints = state[0];
  this.baud_rate = state[1];
  this.line_control = state[2];
  this.lsr = state[3];
  this.fifo_control = state[4];
  this.ier = state[5];
  this.iir = state[6];
  this.modem_control = state[7];
  this.modem_status = state[8];
  this.scratch_register = state[9];
  this.irq = state[10];
};
UART.prototype.CheckInterrupt = function() {
  if (this.ints & 1 << UART_IIR_CTI && this.ier & UART_IER_RDI) {
    this.iir = UART_IIR_CTI;
    this.cpu.device_raise_irq(this.irq);
  } else if (this.ints & 1 << UART_IIR_RDI && this.ier & UART_IER_RDI) {
    this.iir = UART_IIR_RDI;
    this.cpu.device_raise_irq(this.irq);
  } else if (this.ints & 1 << UART_IIR_THRI && this.ier & UART_IER_THRI) {
    this.iir = UART_IIR_THRI;
    this.cpu.device_raise_irq(this.irq);
  } else if (this.ints & 1 << UART_IIR_MSI && this.ier & UART_IER_MSI) {
    this.iir = UART_IIR_MSI;
    this.cpu.device_raise_irq(this.irq);
  } else {
    this.iir = UART_IIR_NO_INT;
    this.cpu.device_lower_irq(this.irq);
  }
};
UART.prototype.ThrowInterrupt = function(line) {
  this.ints |= 1 << line;
  this.CheckInterrupt();
};
UART.prototype.ClearInterrupt = function(line) {
  this.ints &= ~(1 << line);
  this.CheckInterrupt();
};
UART.prototype.data_received = function(data) {
  dbg_log("input: " + h(data), LOG_SERIAL);
  this.input.push(data);
  this.lsr |= UART_LSR_DATA_READY;
  if (this.fifo_control & 1) {
    this.ThrowInterrupt(UART_IIR_CTI);
  } else {
    this.ThrowInterrupt(UART_IIR_RDI);
  }
};
UART.prototype.write_data = function(out_byte) {
  if (this.line_control & DLAB) {
    this.baud_rate = this.baud_rate & ~255 | out_byte;
    return;
  }
  dbg_log("data: " + h(out_byte), LOG_SERIAL);
  this.ThrowInterrupt(UART_IIR_THRI);
  if (this.modem_control & UART_MCR_LOOPBACK) {
    this.data_received(out_byte);
  } else {
    this.bus.send("serial" + this.com + "-output-byte", out_byte);
  }
  if (false) {
    var char = String.fromCharCode(out_byte);
    this.current_line += char;
    if (char === "\n") {
      const line = this.current_line.trimRight().replace(/[\x00-\x08\x0b-\x1f\x7f\x80-\xff]/g, "");
      dbg_log("SERIAL: " + line);
      this.current_line = "";
    }
  }
};
UART.prototype.set_modem_status = function(status) {
  dbg_log("modem status: " + h(status), LOG_SERIAL);
  const prev_delta_bits = this.modem_status & 15;
  let delta = (this.modem_status ^ status) >> 4;
  delta |= prev_delta_bits;
  this.modem_status = status;
  this.modem_status |= delta;
};

// src/pci.js
var PCI_CONFIG_ADDRESS = 3320;
var PCI_CONFIG_DATA = 3324;
function PCI(cpu) {
  this.pci_addr = new Uint8Array(4);
  this.pci_value = new Uint8Array(4);
  this.pci_response = new Uint8Array(4);
  this.pci_status = new Uint8Array(4);
  this.pci_addr32 = new Int32Array(this.pci_addr.buffer);
  this.pci_value32 = new Int32Array(this.pci_value.buffer);
  this.pci_response32 = new Int32Array(this.pci_response.buffer);
  this.pci_status32 = new Int32Array(this.pci_status.buffer);
  this.device_spaces = [];
  this.devices = [];
  this.cpu = cpu;
  for (var i = 0; i < 256; i++) {
    this.device_spaces[i] = void 0;
    this.devices[i] = void 0;
  }
  this.io = cpu.io;
  cpu.io.register_write(
    PCI_CONFIG_DATA,
    this,
    function(value) {
      this.pci_write8(this.pci_addr32[0], value);
    },
    function(value) {
      this.pci_write16(this.pci_addr32[0], value);
    },
    function(value) {
      this.pci_write32(this.pci_addr32[0], value);
    }
  );
  cpu.io.register_write(
    PCI_CONFIG_DATA + 1,
    this,
    function(value) {
      this.pci_write8(this.pci_addr32[0] + 1 | 0, value);
    }
  );
  cpu.io.register_write(
    PCI_CONFIG_DATA + 2,
    this,
    function(value) {
      this.pci_write8(this.pci_addr32[0] + 2 | 0, value);
    },
    function(value) {
      this.pci_write16(this.pci_addr32[0] + 2 | 0, value);
    }
  );
  cpu.io.register_write(
    PCI_CONFIG_DATA + 3,
    this,
    function(value) {
      this.pci_write8(this.pci_addr32[0] + 3 | 0, value);
    }
  );
  cpu.io.register_read_consecutive(
    PCI_CONFIG_DATA,
    this,
    function() {
      return this.pci_response[0];
    },
    function() {
      return this.pci_response[1];
    },
    function() {
      return this.pci_response[2];
    },
    function() {
      return this.pci_response[3];
    }
  );
  cpu.io.register_read_consecutive(
    PCI_CONFIG_ADDRESS,
    this,
    function() {
      return this.pci_status[0];
    },
    function() {
      return this.pci_status[1];
    },
    function() {
      return this.pci_status[2];
    },
    function() {
      return this.pci_status[3];
    }
  );
  cpu.io.register_write_consecutive(
    PCI_CONFIG_ADDRESS,
    this,
    function(out_byte) {
      this.pci_addr[0] = out_byte & 252;
    },
    function(out_byte) {
      if ((this.pci_addr[1] & 6) === 2 && (out_byte & 6) === 6) {
        dbg_log("CPU reboot via PCI");
        cpu.reboot_internal();
        return;
      }
      this.pci_addr[1] = out_byte;
    },
    function(out_byte) {
      this.pci_addr[2] = out_byte;
    },
    function(out_byte) {
      this.pci_addr[3] = out_byte;
      this.pci_query();
    }
  );
  const PAM0 = 16;
  var host_bridge = {
    pci_id: 0,
    pci_space: [
      // 00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)
      134,
      128,
      55,
      18,
      0,
      0,
      0,
      0,
      2,
      0,
      0,
      6,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      PAM0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    pci_bars: [],
    name: "82441FX PMC"
  };
  this.register_device(host_bridge);
  this.isa_bridge = {
    pci_id: 1 << 3,
    pci_space: [
      // 00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]
      134,
      128,
      0,
      112,
      7,
      0,
      0,
      2,
      0,
      0,
      1,
      6,
      0,
      0,
      128,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ],
    pci_bars: [],
    name: "82371SB PIIX3 ISA"
  };
  this.isa_bridge_space = this.register_device(this.isa_bridge);
  this.isa_bridge_space8 = new Uint8Array(this.isa_bridge_space.buffer);
}
PCI.prototype.get_state = function() {
  var state = [];
  for (var i = 0; i < 256; i++) {
    state[i] = this.device_spaces[i];
  }
  state[256] = this.pci_addr;
  state[257] = this.pci_value;
  state[258] = this.pci_response;
  state[259] = this.pci_status;
  return state;
};
PCI.prototype.set_state = function(state) {
  for (var i = 0; i < 256; i++) {
    var device = this.devices[i];
    var space = state[i];
    if (!device || !space) {
      if (device) {
        dbg_log("Warning: While restoring PCI device: Device exists in current configuration but not in snapshot (" + device.name + ")");
      }
      if (space) {
        dbg_log("Warning: While restoring PCI device: Device doesn't exist in current configuration but does in snapshot (device " + h(i, 2) + ")");
      }
      continue;
    }
    for (var bar_nr = 0; bar_nr < device.pci_bars.length; bar_nr++) {
      var value = space[(16 >> 2) + bar_nr];
      if (value & 1) {
        var bar = device.pci_bars[bar_nr];
        var from = bar.original_bar & ~1 & 65535;
        var to = value & ~1 & 65535;
        this.set_io_bars(bar, from, to);
      } else {
      }
    }
    this.device_spaces[i].set(space);
  }
  this.pci_addr.set(state[256]);
  this.pci_value.set(state[257]);
  this.pci_response.set(state[258]);
  this.pci_status.set(state[259]);
};
PCI.prototype.pci_query = function() {
  var dbg_line = "query";
  var bdf = this.pci_addr[2] << 8 | this.pci_addr[1], addr = this.pci_addr[0] & 252, dev = bdf >> 3 & 31, enabled = this.pci_addr[3] >> 7;
  dbg_line += " enabled=" + enabled;
  dbg_line += " bdf=" + h(bdf, 4);
  dbg_line += " dev=" + h(dev, 2);
  dbg_line += " addr=" + h(addr, 2);
  var device = this.device_spaces[bdf];
  if (device !== void 0) {
    this.pci_status32[0] = 2147483648 | 0;
    if (addr < device.byteLength) {
      this.pci_response32[0] = device[addr >> 2];
    } else {
      this.pci_response32[0] = 0;
    }
    dbg_line += " " + h(this.pci_addr32[0] >>> 0, 8) + " -> " + h(this.pci_response32[0] >>> 0, 8);
    if (addr >= device.byteLength) {
      dbg_line += " (undef)";
    }
    dbg_line += " (" + this.devices[bdf].name + ")";
    dbg_log(dbg_line, LOG_PCI);
  } else {
    this.pci_response32[0] = -1;
    this.pci_status32[0] = 0;
  }
};
PCI.prototype.pci_write8 = function(address, written) {
  var bdf = address >> 8 & 65535;
  var addr = address & 255;
  var space = new Uint8Array(this.device_spaces[bdf].buffer);
  var device = this.devices[bdf];
  if (!space) {
    return;
  }
  dbg_assert(
    !(addr >= 16 && addr < 44 || addr >= 48 && addr < 52),
    "PCI: Expected 32-bit write, got 8-bit (addr: " + h(addr) + ")"
  );
  dbg_log("PCI write8 dev=" + h(bdf >> 3, 2) + " (" + device.name + ") addr=" + h(addr, 4) + " value=" + h(written, 2), LOG_PCI);
  space[addr] = written;
};
PCI.prototype.pci_write16 = function(address, written) {
  dbg_assert((address & 1) === 0);
  var bdf = address >> 8 & 65535;
  var addr = address & 255;
  var space = new Uint16Array(this.device_spaces[bdf].buffer);
  var device = this.devices[bdf];
  if (!space) {
    return;
  }
  if (addr >= 16 && addr < 44) {
    dbg_log("Warning: PCI: Expected 32-bit write, got 16-bit (addr: " + h(addr) + ")");
    return;
  }
  dbg_assert(
    !(addr >= 48 && addr < 52),
    "PCI: Expected 32-bit write, got 16-bit (addr: " + h(addr) + ")"
  );
  dbg_log("PCI writ16 dev=" + h(bdf >> 3, 2) + " (" + device.name + ") addr=" + h(addr, 4) + " value=" + h(written, 4), LOG_PCI);
  space[addr >>> 1] = written;
};
PCI.prototype.pci_write32 = function(address, written) {
  dbg_assert((address & 3) === 0);
  var bdf = address >> 8 & 65535;
  var addr = address & 255;
  var space = this.device_spaces[bdf];
  var device = this.devices[bdf];
  if (!space) {
    return;
  }
  if (addr >= 16 && addr < 40) {
    var bar_nr = addr - 16 >> 2;
    var bar = device.pci_bars[bar_nr];
    dbg_log("BAR" + bar_nr + " exists=" + (bar ? "y" : "n") + " changed from " + h(space[addr >> 2]) + " to " + h(written >>> 0) + " dev=" + h(bdf >> 3, 2) + " (" + device.name + ") ", LOG_PCI);
    if (bar) {
      dbg_assert(!(bar.size & bar.size - 1), "bar size should be power of 2");
      var space_addr = addr >> 2;
      var type = space[space_addr] & 1;
      if ((written | 3 | bar.size - 1) === -1) {
        written = ~(bar.size - 1) | type;
        if (type === 0) {
          space[space_addr] = written;
        }
      } else {
        if (type === 0) {
          var original_bar = bar.original_bar;
          if ((written & ~15) !== (original_bar & ~15)) {
            dbg_log("Warning: Changing memory bar not supported, ignored", LOG_PCI);
          }
          space[space_addr] = original_bar;
        }
      }
      if (type === 1) {
        dbg_assert(type === 1);
        var from = space[space_addr] & ~1 & 65535;
        var to = written & ~1 & 65535;
        dbg_log("io bar changed from " + h(from >>> 0, 8) + " to " + h(to >>> 0, 8) + " size=" + bar.size, LOG_PCI);
        this.set_io_bars(bar, from, to);
        space[space_addr] = written | 1;
      }
    } else {
      space[addr >> 2] = 0;
    }
    dbg_log("BAR effective value: " + h(space[addr >> 2] >>> 0), LOG_PCI);
  } else if (addr === 48) {
    dbg_log("PCI write rom address dev=" + h(bdf >> 3, 2) + " (" + device.name + ") value=" + h(written >>> 0, 8), LOG_PCI);
    if (device.pci_rom_size) {
      if ((written | 2047) === (4294967295 | 0)) {
        space[addr >> 2] = -device.pci_rom_size | 0;
      } else {
        space[addr >> 2] = device.pci_rom_address | 0;
      }
    } else {
      space[addr >> 2] = 0;
    }
  } else if (addr === 4) {
    dbg_log("PCI write dev=" + h(bdf >> 3, 2) + " (" + device.name + ") addr=" + h(addr, 4) + " value=" + h(written >>> 0, 8), LOG_PCI);
  } else {
    dbg_log("PCI write dev=" + h(bdf >> 3, 2) + " (" + device.name + ") addr=" + h(addr, 4) + " value=" + h(written >>> 0, 8), LOG_PCI);
    space[addr >>> 2] = written;
  }
};
PCI.prototype.register_device = function(device) {
  dbg_assert(device.pci_id !== void 0);
  dbg_assert(device.pci_space !== void 0);
  dbg_assert(device.pci_bars !== void 0);
  var device_id = device.pci_id;
  dbg_log("PCI register bdf=" + h(device_id) + " (" + device.name + ")", LOG_PCI);
  if (this.devices[device_id]) {
    dbg_log("warning: overwriting device " + this.devices[device_id].name + " with " + device.name, LOG_PCI);
  }
  dbg_assert(device.pci_space.length >= 64);
  dbg_assert(device_id < this.devices.length);
  var space = new Int32Array(64);
  space.set(new Int32Array(new Uint8Array(device.pci_space).buffer));
  this.device_spaces[device_id] = space;
  this.devices[device_id] = device;
  var bar_space = space.slice(4, 10);
  for (var i = 0; i < device.pci_bars.length; i++) {
    var bar = device.pci_bars[i];
    if (!bar) {
      continue;
    }
    var bar_base = bar_space[i];
    var type = bar_base & 1;
    dbg_log("device " + device.name + " register bar of size " + bar.size + " at " + h(bar_base), LOG_PCI);
    bar.original_bar = bar_base;
    bar.entries = [];
    if (type === 0) {
    } else {
      dbg_assert(type === 1);
      var port = bar_base & ~1;
      for (var j = 0; j < bar.size; j++) {
        bar.entries[j] = this.io.ports[port + j];
      }
    }
  }
  return space;
};
PCI.prototype.set_io_bars = function(bar, from, to) {
  var count = bar.size;
  dbg_log("Move io bars: from=" + h(from) + " to=" + h(to) + " count=" + count, LOG_PCI);
  var ports = this.io.ports;
  for (var i = 0; i < count; i++) {
    var old_entry = ports[from + i];
    if (from + i >= 4096) {
      ports[from + i] = this.io.create_empty_entry();
    }
    var entry = bar.entries[i];
    var empty_entry = ports[to + i];
    dbg_assert(entry && empty_entry);
    if (to + i >= 4096) {
      ports[to + i] = entry;
    }
  }
};
PCI.prototype.raise_irq = function(pci_id) {
  var space = this.device_spaces[pci_id];
  dbg_assert(space);
  var pin = (space[60 >>> 2] >> 8 & 255) - 1;
  var device = (pci_id >> 3) - 1 & 255;
  var parent_pin = pin + device & 3;
  var irq = this.isa_bridge_space8[96 + parent_pin];
  this.cpu.device_raise_irq(irq);
};
PCI.prototype.lower_irq = function(pci_id) {
  var space = this.device_spaces[pci_id];
  dbg_assert(space);
  var pin = space[60 >>> 2] >> 8 & 255;
  var device = pci_id >> 3 & 255;
  var parent_pin = pin + device - 2 & 3;
  var irq = this.isa_bridge_space8[96 + parent_pin];
  this.cpu.device_lower_irq(irq);
};

// src/ne2k.js
var NE2K_LOG_VERBOSE = false;
var NE2K_LOG_PACKETS = false;
var E8390_CMD = 0;
var EN0_STARTPG = 1;
var EN0_STOPPG = 2;
var EN0_BOUNDARY = 3;
var EN0_TSR = 4;
var EN0_TPSR = 4;
var EN0_TCNTLO = 5;
var EN0_TCNTHI = 6;
var EN0_ISR = 7;
var EN0_RSARLO = 8;
var EN0_RSARHI = 9;
var EN0_RCNTLO = 10;
var EN0_RCNTHI = 11;
var EN0_RSR = 12;
var EN0_RXCR = 12;
var EN0_TXCR = 13;
var EN0_COUNTER0 = 13;
var EN0_DCFG = 14;
var EN0_COUNTER1 = 14;
var EN0_IMR = 15;
var EN0_COUNTER2 = 15;
var NE_DATAPORT = 16;
var NE_RESET = 31;
var ENISR_RX = 1;
var ENISR_TX = 2;
var ENISR_RDC = 64;
var ENISR_RESET = 128;
var ENRSR_RXOK = 1;
var START_PAGE = 64;
var START_RX_PAGE = 64 + 12;
var STOP_PAGE = 128;
function translate_mac_address(packet, search_mac, replacement_mac) {
  if (packet[0] === search_mac[0] && packet[1] === search_mac[1] && packet[2] === search_mac[2] && packet[3] === search_mac[3] && packet[4] === search_mac[4] && packet[5] === search_mac[5]) {
    dbg_log("Replace mac in eth destination field", LOG_NET);
    packet[0] = replacement_mac[0];
    packet[1] = replacement_mac[1];
    packet[2] = replacement_mac[2];
    packet[3] = replacement_mac[3];
    packet[4] = replacement_mac[4];
    packet[5] = replacement_mac[5];
  }
  if (packet[6 + 0] === search_mac[0] && packet[6 + 1] === search_mac[1] && packet[6 + 2] === search_mac[2] && packet[6 + 3] === search_mac[3] && packet[6 + 4] === search_mac[4] && packet[6 + 5] === search_mac[5]) {
    dbg_log("Replace mac in eth source field", LOG_NET);
    packet[6 + 0] = replacement_mac[0];
    packet[6 + 1] = replacement_mac[1];
    packet[6 + 2] = replacement_mac[2];
    packet[6 + 3] = replacement_mac[3];
    packet[6 + 4] = replacement_mac[4];
    packet[6 + 5] = replacement_mac[5];
  }
  const ethertype = packet[12] << 8 | packet[13];
  if (ethertype === 2048) {
    const ipv4_packet = packet.subarray(14);
    const ipv4_version = ipv4_packet[0] >> 4;
    if (ipv4_version !== 4) {
      dbg_log("Expected ipv4.version==4 but got: " + ipv4_version, LOG_NET);
      return;
    }
    const ipv4_ihl = ipv4_packet[0] & 15;
    dbg_assert(ipv4_ihl === 5, "TODO: ihl!=5");
    const ipv4_proto = ipv4_packet[9];
    if (ipv4_proto === 17) {
      const udp_packet = ipv4_packet.subarray(5 * 4);
      const source_port = udp_packet[0] << 8 | udp_packet[1];
      const destination_port = udp_packet[2] << 8 | udp_packet[3];
      const checksum = udp_packet[6] << 8 | udp_packet[7];
      dbg_log("udp srcport=" + source_port + " dstport=" + destination_port + " checksum=" + h(checksum, 4), LOG_NET);
      if (source_port === 67 || destination_port === 67) {
        const dhcp_packet = udp_packet.subarray(8);
        const dhcp_magic = dhcp_packet[236] << 24 | dhcp_packet[237] << 16 | dhcp_packet[238] << 8 | dhcp_packet[239];
        if (dhcp_magic !== 1669485411) {
          dbg_log("dhcp packet didn't match magic: " + h(dhcp_magic, 8));
          return;
        }
        if (dhcp_packet[28 + 0] === search_mac[0] && dhcp_packet[28 + 1] === search_mac[1] && dhcp_packet[28 + 2] === search_mac[2] && dhcp_packet[28 + 3] === search_mac[3] && dhcp_packet[28 + 4] === search_mac[4] && dhcp_packet[28 + 5] === search_mac[5]) {
          dbg_log("Replace mac in dhcp.chaddr", LOG_NET);
          dhcp_packet[28 + 0] = replacement_mac[0];
          dhcp_packet[28 + 1] = replacement_mac[1];
          dhcp_packet[28 + 2] = replacement_mac[2];
          dhcp_packet[28 + 3] = replacement_mac[3];
          dhcp_packet[28 + 4] = replacement_mac[4];
          dhcp_packet[28 + 5] = replacement_mac[5];
          udp_packet[6] = udp_packet[7] = 0;
        }
        let offset = 240;
        while (offset < dhcp_packet.length) {
          const dhcp_option_type = dhcp_packet[offset++];
          if (dhcp_option_type === 255) {
            break;
          }
          const length = dhcp_packet[offset++];
          if (dhcp_option_type === 61 && // client identifier
          dhcp_packet[offset + 0] === 1 && // ethernet
          dhcp_packet[offset + 1] === search_mac[0] && dhcp_packet[offset + 2] === search_mac[1] && dhcp_packet[offset + 3] === search_mac[2] && dhcp_packet[offset + 4] === search_mac[3] && dhcp_packet[offset + 5] === search_mac[4] && dhcp_packet[offset + 6] === search_mac[5]) {
            dbg_log("Replace mac in dhcp.clientidentifier", LOG_NET);
            dhcp_packet[offset + 1] = replacement_mac[0];
            dhcp_packet[offset + 2] = replacement_mac[1];
            dhcp_packet[offset + 3] = replacement_mac[2];
            dhcp_packet[offset + 4] = replacement_mac[3];
            dhcp_packet[offset + 5] = replacement_mac[4];
            dhcp_packet[offset + 6] = replacement_mac[5];
            udp_packet[6] = udp_packet[7] = 0;
          }
          offset += length;
        }
      }
    } else {
    }
  } else if (ethertype === 2054) {
    const arp_packet = packet.subarray(14);
    dbg_log("arp oper=" + arp_packet[7] + " " + format_mac(arp_packet.subarray(8, 8 + 6)) + " " + format_mac(arp_packet.subarray(18, 18 + 6)), LOG_NET);
    if (arp_packet[8 + 0] === search_mac[0] && arp_packet[8 + 1] === search_mac[1] && arp_packet[8 + 2] === search_mac[2] && arp_packet[8 + 3] === search_mac[3] && arp_packet[8 + 4] === search_mac[4] && arp_packet[8 + 5] === search_mac[5]) {
      dbg_log("Replace mac in arp.sha", LOG_NET);
      arp_packet[8 + 0] = replacement_mac[0];
      arp_packet[8 + 1] = replacement_mac[1];
      arp_packet[8 + 2] = replacement_mac[2];
      arp_packet[8 + 3] = replacement_mac[3];
      arp_packet[8 + 4] = replacement_mac[4];
      arp_packet[8 + 5] = replacement_mac[5];
    }
  } else {
  }
}
function format_mac(mac) {
  return [
    mac[0].toString(16).padStart(2, "0"),
    mac[1].toString(16).padStart(2, "0"),
    mac[2].toString(16).padStart(2, "0"),
    mac[3].toString(16).padStart(2, "0"),
    mac[4].toString(16).padStart(2, "0"),
    mac[5].toString(16).padStart(2, "0")
  ].join(":");
}
function dump_packet(packet, prefix) {
  const ethertype = packet[12] << 8 | packet[13] << 0;
  if (ethertype === 2048) {
    const ipv4_packet = packet.subarray(14);
    const ipv4_len = ipv4_packet[2] << 8 | ipv4_packet[3];
    const ipv4_proto = ipv4_packet[9];
    if (ipv4_proto === 17) {
      const udp_packet = ipv4_packet.subarray(5 * 4);
      const source_port = udp_packet[0] << 8 | udp_packet[1];
      const destination_port = udp_packet[2] << 8 | udp_packet[3];
      const checksum = udp_packet[6] << 8 | udp_packet[7];
      if (source_port === 67 || destination_port === 67) {
        const dhcp_packet = udp_packet.subarray(8);
        const dhcp_chaddr = dhcp_packet.subarray(28, 28 + 6);
        dbg_log(prefix + " len=" + packet.length + " ethertype=" + h(ethertype) + " ipv4.len=" + ipv4_len + " ipv4.proto=" + h(packet[14 + 9]) + " udp.srcport=" + source_port + " udp.dstport=" + destination_port + " udp.chksum=" + h(checksum, 4) + " dhcp.chaddr=" + format_mac(dhcp_chaddr));
      } else {
        dbg_log(prefix + " len=" + packet.length + " ethertype=" + h(ethertype) + " ipv4.len=" + ipv4_len + " ipv4.proto=" + h(packet[14 + 9]) + " udp.srcport=" + source_port + " udp.dstport=" + destination_port + " udp.chksum=" + h(checksum, 4));
      }
    } else if (ipv4_proto === 1) {
    } else {
      dbg_log(prefix + " len=" + packet.length + " ethertype=" + h(ethertype) + " ipv4.len=" + ipv4_len + " ipv4.proto=" + h(packet[14 + 9]));
    }
  } else {
    const arp_packet = packet.subarray(14);
    dbg_log(prefix + " len=" + packet.length + " ethertype=" + h(ethertype) + " arp");
  }
  dbg_log(hex_dump(packet));
}
function Ne2k(cpu, bus, preserve_mac_from_state_image, mac_address_translation, id) {
  this.cpu = cpu;
  this.pci = cpu.devices.pci;
  this.id = id || 0;
  this.preserve_mac_from_state_image = preserve_mac_from_state_image;
  this.mac_address_translation = mac_address_translation;
  this.bus = bus;
  this.bus.register("net" + this.id + "-receive", function(data) {
    this.receive(data);
  }, this);
  this.port = 768 + 256 * this.id;
  this.name = "ne2k";
  const use_pci = true;
  if (use_pci) {
    this.pci_space = [
      236,
      16,
      41,
      128,
      3,
      1,
      0,
      0,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      this.port & 255 | 1,
      this.port >> 8,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      244,
      26,
      0,
      17,
      0,
      0,
      184,
      254,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0
    ];
    this.pci_id = (this.id === 0 ? 5 : 7 + this.id) << 3;
    this.pci_bars = [
      {
        size: 32
      }
    ];
  }
  this.isr = 0;
  this.imr = 0;
  this.cr = 1;
  this.dcfg = 0;
  this.rcnt = 0;
  this.tcnt = 0;
  this.tpsr = 0;
  this.memory = new Uint8Array(256 * 128);
  this.rxcr = 0;
  this.txcr = 0;
  this.tsr = 1;
  this.mac = new Uint8Array([
    0,
    34,
    21,
    Math.random() * 255 | 0,
    Math.random() * 255 | 0,
    Math.random() * 255 | 0
  ]);
  this.bus.send("net" + this.id + "-mac", format_mac(this.mac));
  this.mar = Uint8Array.of(255, 255, 255, 255, 255, 255, 255, 255);
  this.mac_address_in_state = null;
  for (var i = 0; i < 6; i++) {
    this.memory[i << 1] = this.memory[i << 1 | 1] = this.mac[i];
  }
  this.memory[14 << 1] = this.memory[14 << 1 | 1] = 87;
  this.memory[15 << 1] = this.memory[15 << 1 | 1] = 87;
  dbg_log("Mac: " + format_mac(this.mac), LOG_NET);
  this.rsar = 0;
  this.pstart = START_PAGE;
  this.pstop = STOP_PAGE;
  this.curpg = START_RX_PAGE;
  this.boundary = START_RX_PAGE;
  var io = cpu.io;
  io.register_read(
    this.port | E8390_CMD,
    this,
    function() {
      dbg_log("Read cmd", LOG_NET);
      return this.cr;
    },
    function() {
      dbg_log("Read16 cmd", LOG_NET);
      return this.cr;
    }
  );
  io.register_write(this.port | E8390_CMD, this, function(data_byte) {
    this.cr = data_byte;
    dbg_log("Write command: " + h(data_byte, 2) + " newpg=" + (this.cr >> 6) + " txcr=" + h(this.txcr, 2), LOG_NET);
    if (this.cr & 1) {
      return;
    }
    if (data_byte & 24 && this.rcnt === 0) {
      this.do_interrupt(ENISR_RDC);
    }
    if (data_byte & 4) {
      var start = this.tpsr << 8;
      var data = this.memory.subarray(start, start + this.tcnt);
      if (NE2K_LOG_PACKETS) {
        dump_packet(data, "send");
      }
      if (this.mac_address_in_state) {
        data = new Uint8Array(data);
        translate_mac_address(data, this.mac_address_in_state, this.mac);
      }
      this.bus.send("net" + this.id + "-send", data);
      this.bus.send("eth-transmit-end", [data.length]);
      this.cr &= ~4;
      this.do_interrupt(ENISR_TX);
      dbg_log("Command: Transfer. length=" + h(data.byteLength), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_COUNTER0, this, function() {
    var pg = this.get_page();
    if (pg === 1) {
      dbg_log("Read mar5", LOG_NET);
      return this.mar[5];
    } else {
      dbg_log("Read counter0 pg=" + pg, LOG_NET);
      return 0;
    }
  });
  io.register_read(
    this.port | EN0_COUNTER1,
    this,
    function() {
      var pg = this.get_page();
      if (pg === 1) {
        dbg_log("Read mar6", LOG_NET);
        return this.mar[6];
      } else {
        dbg_log("Read8 counter1 pg=" + pg, LOG_NET);
        return 0;
      }
    },
    function() {
      dbg_log("Read16 counter1 pg=" + this.get_page(), LOG_NET);
      return 0;
    }
  );
  io.register_read(this.port | EN0_COUNTER2, this, function() {
    var pg = this.get_page();
    if (pg === 1) {
      dbg_log("Read mar7", LOG_NET);
      return this.mar[7];
    } else {
      dbg_log("Read counter2 pg=" + pg, LOG_NET);
      return 0;
    }
  });
  io.register_read(this.port | NE_RESET, this, function() {
    var pg = this.get_page();
    dbg_log("Read reset", LOG_NET);
    this.do_interrupt(ENISR_RESET);
    return 0;
  });
  io.register_write(this.port | NE_RESET, this, function(data_byte) {
    var pg = this.get_page();
    dbg_log("Write reset: " + h(data_byte, 2), LOG_NET);
  });
  io.register_read(this.port | EN0_STARTPG, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      return this.pstart;
    } else if (pg === 1) {
      dbg_log("Read pg1/01 (mac[0])", LOG_NET);
      return this.mac[0];
    } else if (pg === 2) {
      return this.pstart;
    } else {
      dbg_log("Read pg" + pg + "/01");
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_STARTPG, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("start page: " + h(data_byte, 2), LOG_NET);
      this.pstart = data_byte;
    } else if (pg === 1) {
      dbg_log("mac[0] = " + h(data_byte), LOG_NET);
      this.mac[0] = data_byte;
    } else if (pg === 3) {
      dbg_log("Unimplemented: Write pg3/01 (9346CR): " + h(data_byte), LOG_NET);
    } else {
      dbg_log("Write pg" + pg + "/01: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_STOPPG, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      return this.pstop;
    } else if (pg === 1) {
      dbg_log("Read pg1/02 (mac[1])", LOG_NET);
      return this.mac[1];
    } else if (pg === 2) {
      return this.pstop;
    } else {
      dbg_log("Read pg" + pg + "/02", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_STOPPG, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("stop page: " + h(data_byte, 2), LOG_NET);
      if (data_byte > this.memory.length >> 8) {
        data_byte = this.memory.length >> 8;
        dbg_log("XXX: Adjusting stop page to " + h(data_byte), LOG_NET);
      }
      this.pstop = data_byte;
    } else if (pg === 1) {
      dbg_log("mac[1] = " + h(data_byte), LOG_NET);
      this.mac[1] = data_byte;
    } else {
      dbg_log("Write pg" + pg + "/02: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_ISR, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read isr: " + h(this.isr, 2), LOG_NET);
      return this.isr;
    } else if (pg === 1) {
      dbg_log("Read curpg: " + h(this.curpg, 2), LOG_NET);
      return this.curpg;
    } else {
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_ISR, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write isr: " + h(data_byte, 2), LOG_NET);
      this.isr &= ~data_byte;
      this.update_irq();
    } else if (pg === 1) {
      dbg_log("Write curpg: " + h(data_byte, 2), LOG_NET);
      this.curpg = data_byte;
    } else {
      dbg_assert(false);
    }
  });
  io.register_write(this.port | EN0_TXCR, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      this.txcr = data_byte;
      dbg_log("Write tx config: " + h(data_byte, 2), LOG_NET);
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0d " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_write(this.port | EN0_DCFG, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write data configuration: " + h(data_byte, 2), LOG_NET);
      this.dcfg = data_byte;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0e " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_RCNTLO, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read pg0/0a", LOG_NET);
      return 80;
    } else if (pg === 1) {
      dbg_log("Read mar2", LOG_NET);
      return this.mar[2];
    } else {
      dbg_assert(false, "TODO");
      return 0;
    }
  });
  io.register_write(this.port | EN0_RCNTLO, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write remote byte count low: " + h(data_byte, 2), LOG_NET);
      this.rcnt = this.rcnt & 65280 | data_byte & 255;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0a " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_RCNTHI, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read pg0/0b", LOG_NET);
      return 67;
    } else if (pg === 1) {
      dbg_log("Read mar3", LOG_NET);
      return this.mar[3];
    } else {
      dbg_assert(false, "TODO");
      return 0;
    }
  });
  io.register_write(this.port | EN0_RCNTHI, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write remote byte count high: " + h(data_byte, 2), LOG_NET);
      this.rcnt = this.rcnt & 255 | data_byte << 8 & 65280;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0b " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_RSARLO, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read remote start address low", LOG_NET);
      return this.rsar & 255;
    } else if (pg === 1) {
      dbg_log("Read mar0", LOG_NET);
      return this.mar[0];
    } else {
      dbg_log("Unimplemented: Read pg" + pg + "/08", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_RSARLO, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write remote start address low: " + h(data_byte, 2), LOG_NET);
      this.rsar = this.rsar & 65280 | data_byte & 255;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/08 " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_RSARHI, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read remote start address high", LOG_NET);
      return this.rsar >> 8 & 255;
    } else if (pg === 1) {
      dbg_log("Read mar1", LOG_NET);
      return this.mar[1];
    } else {
      dbg_log("Unimplemented: Read pg" + pg + "/09", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_RSARHI, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write remote start address low: " + h(data_byte, 2), LOG_NET);
      this.rsar = this.rsar & 255 | data_byte << 8 & 65280;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/09 " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_write(this.port | EN0_IMR, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write interrupt mask register: " + h(data_byte, 2) + " isr=" + h(this.isr, 2), LOG_NET);
      this.imr = data_byte;
      this.update_irq();
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0f " + h(data_byte, 2), LOG_NET);
    }
  });
  io.register_read(this.port | EN0_BOUNDARY, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Read boundary: " + h(this.boundary, 2), LOG_NET);
      return this.boundary;
    } else if (pg === 1) {
      dbg_log("Read pg1/03 (mac[2])", LOG_NET);
      return this.mac[2];
    } else if (pg === 3) {
      dbg_log("Unimplemented: Read pg3/03 (CONFIG0)", LOG_NET);
      return 0;
    } else {
      dbg_log("Read pg" + pg + "/03", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_BOUNDARY, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write boundary: " + h(data_byte, 2), LOG_NET);
      this.boundary = data_byte;
    } else if (pg === 1) {
      dbg_log("mac[2] = " + h(data_byte), LOG_NET);
      this.mac[2] = data_byte;
    } else {
      dbg_log("Write pg" + pg + "/03: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_TSR, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      return this.tsr;
    } else if (pg === 1) {
      dbg_log("Read pg1/04 (mac[3])", LOG_NET);
      return this.mac[3];
    } else {
      dbg_log("Read pg" + pg + "/04", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_TPSR, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write tpsr: " + h(data_byte, 2), LOG_NET);
      this.tpsr = data_byte;
    } else if (pg === 1) {
      dbg_log("mac[3] = " + h(data_byte), LOG_NET);
      this.mac[3] = data_byte;
    } else {
      dbg_log("Write pg" + pg + "/04: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_TCNTLO, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Unimplemented: Read pg0/05 (NCR: Number of Collisions Register)", LOG_NET);
      return 0;
    } else if (pg === 1) {
      dbg_log("Read pg1/05 (mac[4])", LOG_NET);
      return this.mac[4];
    } else if (pg === 3) {
      dbg_log("Unimplemented: Read pg3/05 (CONFIG2)", LOG_NET);
      return 0;
    } else {
      dbg_log("Read pg" + pg + "/05", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_TCNTLO, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write tcnt low: " + h(data_byte, 2), LOG_NET);
      this.tcnt = this.tcnt & ~255 | data_byte;
    } else if (pg === 1) {
      dbg_log("mac[4] = " + h(data_byte), LOG_NET);
      this.mac[4] = data_byte;
    } else if (pg === 3) {
      dbg_log("Unimplemented: Write pg3/05 (CONFIG2): " + h(data_byte), LOG_NET);
    } else {
      dbg_log("Write pg" + pg + "/05: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_TCNTHI, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_assert(false, "TODO");
      return 0;
    } else if (pg === 1) {
      dbg_log("Read pg1/06 (mac[5])", LOG_NET);
      return this.mac[5];
    } else if (pg === 3) {
      dbg_log("Unimplemented: Read pg3/06 (CONFIG3)", LOG_NET);
      return 0;
    } else {
      dbg_log("Read pg" + pg + "/06", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_TCNTHI, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("Write tcnt high: " + h(data_byte, 2), LOG_NET);
      this.tcnt = this.tcnt & 255 | data_byte << 8;
    } else if (pg === 1) {
      dbg_log("mac[5] = " + h(data_byte), LOG_NET);
      this.mac[5] = data_byte;
    } else if (pg === 3) {
      dbg_log("Unimplemented: Write pg3/06 (CONFIG3): " + h(data_byte), LOG_NET);
    } else {
      dbg_log("Write pg" + pg + "/06: " + h(data_byte), LOG_NET);
      dbg_assert(false);
    }
  });
  io.register_read(this.port | EN0_RSR, this, function() {
    var pg = this.get_page();
    if (pg === 0) {
      return 1 | 1 << 3;
    } else if (pg === 1) {
      dbg_log("Read mar4", LOG_NET);
      return this.mar[4];
    } else {
      dbg_log("Unimplemented: Read pg" + pg + "/0c", LOG_NET);
      dbg_assert(false);
      return 0;
    }
  });
  io.register_write(this.port | EN0_RXCR, this, function(data_byte) {
    var pg = this.get_page();
    if (pg === 0) {
      dbg_log("RX configuration reg write: " + h(data_byte, 2), LOG_NET);
      this.rxcr = data_byte;
    } else {
      dbg_log("Unimplemented: Write pg" + pg + "/0c: " + h(data_byte), LOG_NET);
    }
  });
  io.register_read(
    this.port | NE_DATAPORT | 0,
    this,
    this.data_port_read8,
    this.data_port_read16,
    this.data_port_read32
  );
  io.register_write(
    this.port | NE_DATAPORT | 0,
    this,
    this.data_port_write16,
    this.data_port_write16,
    this.data_port_write32
  );
  if (use_pci) {
    cpu.devices.pci.register_device(this);
  }
}
Ne2k.prototype.get_state = function() {
  var state = [];
  state[0] = this.isr;
  state[1] = this.imr;
  state[2] = this.cr;
  state[3] = this.dcfg;
  state[4] = this.rcnt;
  state[5] = this.tcnt;
  state[6] = this.tpsr;
  state[7] = this.rsar;
  state[8] = this.pstart;
  state[9] = this.curpg;
  state[10] = this.boundary;
  state[11] = this.pstop;
  state[12] = this.rxcr;
  state[13] = this.txcr;
  state[14] = this.tsr;
  state[15] = this.mac;
  state[16] = this.memory;
  return state;
};
Ne2k.prototype.set_state = function(state) {
  this.isr = state[0];
  this.imr = state[1];
  this.cr = state[2];
  this.dcfg = state[3];
  this.rcnt = state[4];
  this.tcnt = state[5];
  this.tpsr = state[6];
  this.rsar = state[7];
  this.pstart = state[8];
  this.curpg = state[9];
  this.boundary = state[10];
  this.pstop = state[11];
  this.rxcr = state[12];
  this.txcr = state[13];
  this.tsr = state[14];
  if (this.preserve_mac_from_state_image) {
    this.mac = state[15];
    this.memory = state[16];
  } else if (this.mac_address_translation) {
    this.mac_address_in_state = state[15];
    this.memory = state[16];
    dbg_log("Using mac address translation guest_os_mac=" + format_mac(this.mac_address_in_state) + " real_mac=" + format_mac(this.mac), LOG_NET);
  }
  this.bus.send("net" + this.id + "-mac", format_mac(this.mac));
};
Ne2k.prototype.do_interrupt = function(ir_mask) {
  dbg_log("Do interrupt " + h(ir_mask, 2), LOG_NET);
  this.isr |= ir_mask;
  this.update_irq();
};
Ne2k.prototype.update_irq = function() {
  if (this.imr & this.isr) {
    this.pci.raise_irq(this.pci_id);
  } else {
    this.pci.lower_irq(this.pci_id);
  }
};
Ne2k.prototype.data_port_write = function(data_byte) {
  if (NE2K_LOG_VERBOSE) {
    dbg_log("Write data port: data=" + h(data_byte & 255, 2) + " rsar=" + h(this.rsar, 4) + " rcnt=" + h(this.rcnt, 4), LOG_NET);
  }
  if (this.rsar <= 16 || this.rsar >= START_PAGE << 8 && this.rsar < STOP_PAGE << 8) {
    this.memory[this.rsar] = data_byte;
  }
  this.rsar++;
  this.rcnt--;
  if (this.rsar >= this.pstop << 8) {
    this.rsar += this.pstart - this.pstop << 8;
  }
  if (this.rcnt === 0) {
    this.do_interrupt(ENISR_RDC);
  }
};
Ne2k.prototype.data_port_write16 = function(data) {
  this.data_port_write(data);
  if (this.dcfg & 1) {
    this.data_port_write(data >> 8);
  }
};
Ne2k.prototype.data_port_write32 = function(data) {
  this.data_port_write(data);
  this.data_port_write(data >> 8);
  this.data_port_write(data >> 16);
  this.data_port_write(data >> 24);
};
Ne2k.prototype.data_port_read = function() {
  let data = 0;
  if (this.rsar < STOP_PAGE << 8) {
    data = this.memory[this.rsar];
  }
  if (NE2K_LOG_VERBOSE) {
    dbg_log("Read data port: data=" + h(data, 2) + " rsar=" + h(this.rsar, 4) + " rcnt=" + h(this.rcnt, 4), LOG_NET);
  }
  this.rsar++;
  this.rcnt--;
  if (this.rsar >= this.pstop << 8) {
    this.rsar += this.pstart - this.pstop << 8;
  }
  if (this.rcnt === 0) {
    this.do_interrupt(ENISR_RDC);
  }
  return data;
};
Ne2k.prototype.data_port_read8 = function() {
  return this.data_port_read16() & 255;
};
Ne2k.prototype.data_port_read16 = function() {
  if (this.dcfg & 1) {
    return this.data_port_read() | this.data_port_read() << 8;
  } else {
    return this.data_port_read();
  }
};
Ne2k.prototype.data_port_read32 = function() {
  return this.data_port_read() | this.data_port_read() << 8 | this.data_port_read() << 16 | this.data_port_read() << 24;
};
Ne2k.prototype.receive = function(data) {
  if (this.cr & 1) {
    return;
  }
  if (NE2K_LOG_PACKETS) {
    dump_packet(data, "receive");
  }
  this.bus.send("eth-receive-end", [data.length]);
  if (this.rxcr & 16) {
  } else if (this.rxcr & 4 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === 255 && data[5] === 255) {
  } else if (this.rxcr & 8 && (data[0] & 1) === 1) {
    return;
  } else if (data[0] === this.mac[0] && data[1] === this.mac[1] && data[2] === this.mac[2] && data[3] === this.mac[3] && data[4] === this.mac[4] && data[5] === this.mac[5]) {
  } else {
    return;
  }
  if (this.mac_address_in_state) {
    data = new Uint8Array(data);
    translate_mac_address(data, this.mac, this.mac_address_in_state);
  }
  var packet_length = Math.max(60, data.length);
  var offset = this.curpg << 8;
  var total_length = packet_length + 4;
  var data_start = offset + 4;
  var next = this.curpg + 1 + (total_length >> 8);
  var end = offset + total_length;
  const needed = 1 + (total_length >> 8);
  const available = this.boundary > this.curpg ? this.boundary - this.curpg : this.pstop - this.curpg + this.boundary - this.pstart;
  if (available < needed && this.boundary !== 0) {
    dbg_log("Buffer full, dropping packet pstart=" + h(this.pstart) + " pstop=" + h(this.pstop) + " curpg=" + h(this.curpg) + " needed=" + h(needed) + " boundary=" + h(this.boundary) + " available=" + h(available), LOG_NET);
    return;
  }
  if (end > this.pstop << 8) {
    dbg_assert(data.length >= 60);
    var cut = (this.pstop << 8) - data_start;
    dbg_assert(cut >= 0);
    this.memory.set(data.subarray(0, cut), data_start);
    this.memory.set(data.subarray(cut), this.pstart << 8);
    dbg_log("rcv cut=" + h(cut), LOG_NET);
  } else {
    this.memory.set(data, data_start);
    if (data.length < 60) {
      this.memory.fill(0, data_start + data.length, data_start + 60);
    }
  }
  if (next >= this.pstop) {
    next += this.pstart - this.pstop;
  }
  this.memory[offset] = ENRSR_RXOK;
  this.memory[offset + 1] = next;
  this.memory[offset + 2] = total_length;
  this.memory[offset + 3] = total_length >> 8;
  this.curpg = next;
  dbg_log("rcv offset=" + h(offset) + " len=" + h(total_length) + " next=" + h(next), LOG_NET);
  this.do_interrupt(ENISR_RX);
};
Ne2k.prototype.get_page = function() {
  return this.cr >> 6 & 3;
};

// src/virtio.js
var VIRTIO_PCI_VENDOR_ID = 6900;
var VIRTIO_PCI_CAP_VENDOR = 9;
var VIRTIO_PCI_CAP_LENGTH = 16;
var VIRTIO_PCI_CAP_COMMON_CFG = 1;
var VIRTIO_PCI_CAP_NOTIFY_CFG = 2;
var VIRTIO_PCI_CAP_ISR_CFG = 3;
var VIRTIO_PCI_CAP_DEVICE_CFG = 4;
var VIRTIO_PCI_CAP_PCI_CFG = 5;
var VIRTIO_STATUS_ACKNOWLEDGE = 1;
var VIRTIO_STATUS_DRIVER = 2;
var VIRTIO_STATUS_DRIVER_OK = 4;
var VIRTIO_STATUS_FEATURES_OK = 8;
var VIRTIO_STATUS_DEVICE_NEEDS_RESET = 64;
var VIRTIO_STATUS_FAILED = 128;
var VIRTIO_ISR_QUEUE = 1;
var VIRTIO_ISR_DEVICE_CFG = 2;
var VIRTIO_F_RING_INDIRECT_DESC = 28;
var VIRTIO_F_RING_EVENT_IDX = 29;
var VIRTIO_F_VERSION_1 = 32;
var VIRTQ_DESC_ENTRYSIZE = 16;
var VIRTQ_AVAIL_ENTRYSIZE = 2;
var VIRTQ_USED_ENTRYSIZE = 8;
var VIRTQ_IDX_MASK = 65535;
var VIRTQ_DESC_F_NEXT = 1;
var VIRTQ_DESC_F_WRITE = 2;
var VIRTQ_DESC_F_INDIRECT = 4;
var VIRTQ_AVAIL_F_NO_INTERRUPT = 1;
function VirtIO(cpu, options) {
  const io = cpu.io;
  this.cpu = cpu;
  this.pci = cpu.devices.pci;
  this.device_id = options.device_id;
  this.pci_space = [
    // Vendor ID
    VIRTIO_PCI_VENDOR_ID & 255,
    VIRTIO_PCI_VENDOR_ID >> 8,
    // Device ID
    options.device_id & 255,
    options.device_id >> 8,
    // Command
    7,
    5,
    // Status - enable capabilities list
    16,
    0,
    // Revision ID
    1,
    // Prof IF, Subclass, Class code
    0,
    2,
    0,
    // Cache line size
    0,
    // Latency Timer
    0,
    // Header Type
    0,
    // Built-in self test
    0,
    // BAR0
    1,
    168,
    0,
    0,
    // BAR1
    0,
    16,
    191,
    254,
    // BAR2
    0,
    0,
    0,
    0,
    // BAR3
    0,
    0,
    0,
    0,
    // BAR4
    0,
    0,
    0,
    0,
    // BAR5
    0,
    0,
    0,
    0,
    // CardBus CIS pointer
    0,
    0,
    0,
    0,
    // Subsystem vendor ID
    VIRTIO_PCI_VENDOR_ID & 255,
    VIRTIO_PCI_VENDOR_ID >> 8,
    // Subsystem ID
    options.subsystem_device_id & 255,
    options.subsystem_device_id >> 8,
    // Expansion ROM base address
    0,
    0,
    0,
    0,
    // Capabilities pointer
    64,
    // Reserved
    0,
    0,
    0,
    // Reserved
    0,
    0,
    0,
    0,
    // Interrupt line
    0,
    // Interrupt pin
    1,
    // Min grant
    0,
    // Max latency
    0
  ];
  this.pci_space = this.pci_space.concat(Array(256 - this.pci_space.length).fill(0));
  this.pci_id = options.pci_id;
  this.pci_bars = [];
  this.name = options.name;
  this.device_feature_select = 0;
  this.driver_feature_select = 0;
  this.device_feature = new Uint32Array(4);
  this.driver_feature = new Uint32Array(4);
  for (const f of options.common.features) {
    dbg_assert(
      f >= 0,
      "VirtIO device<" + this.name + "> feature bit numbers must be non-negative"
    );
    dbg_assert(
      f < 128,
      "VirtIO device<" + this.name + "> feature bit numbers assumed less than 128 in implementation"
    );
    this.device_feature[f >>> 5] |= 1 << (f & 31);
    this.driver_feature[f >>> 5] |= 1 << (f & 31);
  }
  dbg_assert(
    options.common.features.includes(VIRTIO_F_VERSION_1),
    "VirtIO device<" + this.name + "> only non-transitional devices are supported"
  );
  this.features_ok = true;
  this.device_status = 0;
  this.config_has_changed = false;
  this.config_generation = 0;
  this.queues = [];
  for (const queue_options of options.common.queues) {
    this.queues.push(new VirtQueue(cpu, this, queue_options));
  }
  this.queue_select = 0;
  this.queue_selected = this.queues[0];
  this.isr_status = 0;
  if (false) {
    const offsets = /* @__PURE__ */ new Set();
    for (const offset of this.queues.map((q) => q.notify_offset)) {
      const effective_offset = options.notification.single_handler ? 0 : offset;
      offsets.add(effective_offset);
      dbg_assert(
        options.notification.handlers[effective_offset],
        "VirtIO device<" + this.name + "> every queue's notifier must exist"
      );
    }
    for (const [index, handler] of options.notification.handlers.entries()) {
      dbg_assert(
        !handler || offsets.has(index),
        "VirtIO device<" + this.name + "> no defined notify handler should be unused"
      );
    }
  }
  const capabilities = [];
  capabilities.push(this.create_common_capability(options.common));
  capabilities.push(this.create_notification_capability(options.notification));
  capabilities.push(this.create_isr_capability(options.isr_status));
  if (options.device_specific) {
    capabilities.push(this.create_device_specific_capability(options.device_specific));
  }
  this.init_capabilities(capabilities);
  cpu.devices.pci.register_device(this);
  this.reset();
}
VirtIO.prototype.create_common_capability = function(options) {
  return {
    type: VIRTIO_PCI_CAP_COMMON_CFG,
    bar: 0,
    port: options.initial_port,
    use_mmio: false,
    offset: 0,
    extra: new Uint8Array(0),
    struct: [
      {
        bytes: 4,
        name: "device_feature_select",
        read: () => this.device_feature_select,
        write: (data) => {
          this.device_feature_select = data;
        }
      },
      {
        bytes: 4,
        name: "device_feature",
        read: () => this.device_feature[this.device_feature_select] || 0,
        write: (data) => {
        }
      },
      {
        bytes: 4,
        name: "driver_feature_select",
        read: () => this.driver_feature_select,
        write: (data) => {
          this.driver_feature_select = data;
        }
      },
      {
        bytes: 4,
        name: "driver_feature",
        read: () => this.driver_feature[this.driver_feature_select] || 0,
        write: (data) => {
          const supported_feature = this.device_feature[this.driver_feature_select];
          if (this.driver_feature_select < this.driver_feature.length) {
            this.driver_feature[this.driver_feature_select] = data & supported_feature;
          }
          const invalid_bits = data & ~supported_feature;
          this.features_ok = this.features_ok && !invalid_bits;
        }
      },
      {
        bytes: 2,
        name: "msix_config",
        read: () => {
          dbg_log("No msi-x capability supported.", LOG_VIRTIO);
          return 65535;
        },
        write: (data) => {
          dbg_log("No msi-x capability supported.", LOG_VIRTIO);
        }
      },
      {
        bytes: 2,
        name: "num_queues",
        read: () => this.queues.length,
        write: (data) => {
        }
      },
      {
        bytes: 1,
        name: "device_status",
        read: () => this.device_status,
        write: (data) => {
          if (data === 0) {
            dbg_log("Reset device<" + this.name + ">", LOG_VIRTIO);
            this.reset();
          } else if (data & VIRTIO_STATUS_FAILED) {
            dbg_log("Warning: Device<" + this.name + "> status failed", LOG_VIRTIO);
          } else {
            dbg_log(
              "Device<" + this.name + "> status: " + (data & VIRTIO_STATUS_ACKNOWLEDGE ? "ACKNOWLEDGE " : "") + (data & VIRTIO_STATUS_DRIVER ? "DRIVER " : "") + (data & VIRTIO_STATUS_DRIVER_OK ? "DRIVER_OK" : "") + (data & VIRTIO_STATUS_FEATURES_OK ? "FEATURES_OK " : "") + (data & VIRTIO_STATUS_DEVICE_NEEDS_RESET ? "DEVICE_NEEDS_RESET" : ""),
              LOG_VIRTIO
            );
          }
          if (data & ~this.device_status & VIRTIO_STATUS_DRIVER_OK && this.device_status & VIRTIO_STATUS_DEVICE_NEEDS_RESET) {
            this.notify_config_changes();
          }
          if (!this.features_ok) {
            if (false) {
              dbg_log("Removing FEATURES_OK", LOG_VIRTIO);
            }
            data &= ~VIRTIO_STATUS_FEATURES_OK;
          }
          this.device_status = data;
          if (data & ~this.device_status & VIRTIO_STATUS_DRIVER_OK) {
            options.on_driver_ok();
          }
        }
      },
      {
        bytes: 1,
        name: "config_generation",
        read: () => this.config_generation,
        write: (data) => {
        }
      },
      {
        bytes: 2,
        name: "queue_select",
        read: () => this.queue_select,
        write: (data) => {
          this.queue_select = data;
          if (this.queue_select < this.queues.length) {
            this.queue_selected = this.queues[this.queue_select];
          } else {
            this.queue_selected = null;
          }
        }
      },
      {
        bytes: 2,
        name: "queue_size",
        read: () => this.queue_selected ? this.queue_selected.size : 0,
        write: (data) => {
          if (!this.queue_selected) {
            return;
          }
          if (data & data - 1) {
            dbg_log("Warning: dev<" + this.name + "> Given queue size was not a power of 2. Rounding up to next power of 2.", LOG_VIRTIO);
            data = 1 << int_log2(data - 1) + 1;
          }
          if (data > this.queue_selected.size_supported) {
            dbg_log("Warning: dev<" + this.name + "> Trying to set queue size greater than supported. Clamping to supported size.", LOG_VIRTIO);
            data = this.queue_selected.size_supported;
          }
          this.queue_selected.set_size(data);
        }
      },
      {
        bytes: 2,
        name: "queue_msix_vector",
        read: () => {
          dbg_log("No msi-x capability supported.", LOG_VIRTIO);
          return 65535;
        },
        write: (data) => {
          dbg_log("No msi-x capability supported.", LOG_VIRTIO);
        }
      },
      {
        bytes: 2,
        name: "queue_enable",
        read: () => this.queue_selected ? this.queue_selected.enabled | 0 : 0,
        write: (data) => {
          if (!this.queue_selected) {
            return;
          }
          if (data === 1) {
            if (this.queue_selected.is_configured()) {
              this.queue_selected.enable();
            } else {
              dbg_log("Driver bug: tried enabling unconfigured queue", LOG_VIRTIO);
            }
          } else if (data === 0) {
            dbg_log("Driver bug: tried writing 0 to queue_enable", LOG_VIRTIO);
          }
        }
      },
      {
        bytes: 2,
        name: "queue_notify_off",
        read: () => this.queue_selected ? this.queue_selected.notify_offset : 0,
        write: (data) => {
        }
      },
      {
        bytes: 4,
        name: "queue_desc (low dword)",
        read: () => this.queue_selected ? this.queue_selected.desc_addr : 0,
        write: (data) => {
          if (this.queue_selected) this.queue_selected.desc_addr = data;
        }
      },
      {
        bytes: 4,
        name: "queue_desc (high dword)",
        read: () => 0,
        write: (data) => {
          if (data !== 0) dbg_log("Warning: High dword of 64 bit queue_desc ignored:" + data, LOG_VIRTIO);
        }
      },
      {
        bytes: 4,
        name: "queue_avail (low dword)",
        read: () => this.queue_selected ? this.queue_selected.avail_addr : 0,
        write: (data) => {
          if (this.queue_selected) this.queue_selected.avail_addr = data;
        }
      },
      {
        bytes: 4,
        name: "queue_avail (high dword)",
        read: () => 0,
        write: (data) => {
          if (data !== 0) dbg_log("Warning: High dword of 64 bit queue_avail ignored:" + data, LOG_VIRTIO);
        }
      },
      {
        bytes: 4,
        name: "queue_used (low dword)",
        read: () => this.queue_selected ? this.queue_selected.used_addr : 0,
        write: (data) => {
          if (this.queue_selected) this.queue_selected.used_addr = data;
        }
      },
      {
        bytes: 4,
        name: "queue_used (high dword)",
        read: () => 0,
        write: (data) => {
          if (data !== 0) dbg_log("Warning: High dword of 64 bit queue_used ignored:" + data, LOG_VIRTIO);
        }
      }
    ]
  };
};
VirtIO.prototype.create_notification_capability = function(options) {
  const notify_struct = [];
  let notify_off_multiplier;
  if (options.single_handler) {
    dbg_assert(
      options.handlers.length === 1,
      "VirtIO device<" + this.name + "> too many notify handlers specified: expected single handler"
    );
    notify_off_multiplier = 0;
  } else {
    notify_off_multiplier = 2;
  }
  for (const [i, handler] of options.handlers.entries()) {
    notify_struct.push(
      {
        bytes: 2,
        name: "notify" + i,
        read: () => 65535,
        write: handler || ((data) => {
        })
      }
    );
  }
  return {
    type: VIRTIO_PCI_CAP_NOTIFY_CFG,
    bar: 1,
    port: options.initial_port,
    use_mmio: false,
    offset: 0,
    extra: new Uint8Array(
      [
        notify_off_multiplier & 255,
        notify_off_multiplier >> 8 & 255,
        notify_off_multiplier >> 16 & 255,
        notify_off_multiplier >> 24
      ]
    ),
    struct: notify_struct
  };
};
VirtIO.prototype.create_isr_capability = function(options) {
  return {
    type: VIRTIO_PCI_CAP_ISR_CFG,
    bar: 2,
    port: options.initial_port,
    use_mmio: false,
    offset: 0,
    extra: new Uint8Array(0),
    struct: [
      {
        bytes: 1,
        name: "isr_status",
        read: () => {
          const isr_status = this.isr_status;
          this.lower_irq();
          return isr_status;
        },
        write: (data) => {
        }
      }
    ]
  };
};
VirtIO.prototype.create_device_specific_capability = function(options) {
  dbg_assert(
    ~options.offset & 3,
    "VirtIO device<" + this.name + "> device specific cap offset must be 4-byte aligned"
  );
  return {
    type: VIRTIO_PCI_CAP_DEVICE_CFG,
    bar: 3,
    port: options.initial_port,
    use_mmio: false,
    offset: 0,
    extra: new Uint8Array(0),
    struct: options.struct
  };
};
VirtIO.prototype.init_capabilities = function(capabilities) {
  let cap_next = this.pci_space[52] = 64;
  let cap_ptr = cap_next;
  for (const cap of capabilities) {
    const cap_len2 = VIRTIO_PCI_CAP_LENGTH + cap.extra.length;
    cap_ptr = cap_next;
    cap_next = cap_ptr + cap_len2;
    dbg_assert(
      cap_next <= 256,
      "VirtIO device<" + this.name + "> can't fit all capabilities into 256byte configspace"
    );
    dbg_assert(
      0 <= cap.bar && cap.bar < 6,
      "VirtIO device<" + this.name + "> capability invalid bar number"
    );
    let bar_size = cap.struct.reduce((bytes, field) => bytes + field.bytes, 0);
    bar_size += cap.offset;
    bar_size = bar_size < 16 ? 16 : 1 << int_log2(bar_size - 1) + 1;
    dbg_assert(
      (cap.port & bar_size - 1) === 0,
      "VirtIO device<" + this.name + "> capability port should be aligned to pci bar size"
    );
    this.pci_bars[cap.bar] = {
      size: bar_size
    };
    this.pci_space[cap_ptr] = VIRTIO_PCI_CAP_VENDOR;
    this.pci_space[cap_ptr + 1] = cap_next;
    this.pci_space[cap_ptr + 2] = cap_len2;
    this.pci_space[cap_ptr + 3] = cap.type;
    this.pci_space[cap_ptr + 4] = cap.bar;
    this.pci_space[cap_ptr + 5] = 0;
    this.pci_space[cap_ptr + 6] = 0;
    this.pci_space[cap_ptr + 7] = 0;
    this.pci_space[cap_ptr + 8] = cap.offset & 255;
    this.pci_space[cap_ptr + 9] = cap.offset >>> 8 & 255;
    this.pci_space[cap_ptr + 10] = cap.offset >>> 16 & 255;
    this.pci_space[cap_ptr + 11] = cap.offset >>> 24;
    this.pci_space[cap_ptr + 12] = bar_size & 255;
    this.pci_space[cap_ptr + 13] = bar_size >>> 8 & 255;
    this.pci_space[cap_ptr + 14] = bar_size >>> 16 & 255;
    this.pci_space[cap_ptr + 15] = bar_size >>> 24;
    for (const [i, extra_byte] of cap.extra.entries()) {
      this.pci_space[cap_ptr + 16 + i] = extra_byte;
    }
    const bar_offset = 16 + 4 * cap.bar;
    this.pci_space[bar_offset] = cap.port & 254 | !cap.use_mmio;
    this.pci_space[bar_offset + 1] = cap.port >>> 8 & 255;
    this.pci_space[bar_offset + 2] = cap.port >>> 16 & 255;
    this.pci_space[bar_offset + 3] = cap.port >>> 24 & 255;
    let port = cap.port + cap.offset;
    for (const field of cap.struct) {
      let read = field.read;
      let write = field.write;
      if (false) {
        read = () => {
          const val = field.read();
          dbg_log(
            "Device<" + this.name + "> cap[" + cap.type + "] read[" + field.name + "] => " + h(val, field.bytes * 8),
            LOG_VIRTIO
          );
          return val;
        };
        write = (data) => {
          dbg_log(
            "Device<" + this.name + "> cap[" + cap.type + "] write[" + field.name + "] <= " + h(data, field.bytes * 8),
            LOG_VIRTIO
          );
          field.write(data);
        };
      }
      if (cap.use_mmio) {
        dbg_assert(false, "VirtIO device <" + this.name + "> mmio capability not implemented.");
      } else {
        const shim_read8_on_16 = function(addr) {
          dbg_log("Warning: 8-bit read from 16-bit virtio port", LOG_VIRTIO);
          return read(addr & ~1) >> ((addr & 1) << 3) & 255;
        };
        const shim_read8_on_32 = function(addr) {
          dbg_log("Warning: 8-bit read from 32-bit virtio port", LOG_VIRTIO);
          return read(addr & ~3) >> ((addr & 3) << 3) & 255;
        };
        const shim_read32_on_16 = function(addr) {
          dbg_log("Warning: 32-bit read from 16-bit virtio port", LOG_VIRTIO);
          return read(addr);
        };
        switch (field.bytes) {
          case 4:
            this.cpu.io.register_read(port, this, shim_read8_on_32, void 0, read);
            this.cpu.io.register_read(port + 1, this, shim_read8_on_32);
            this.cpu.io.register_read(port + 2, this, shim_read8_on_32);
            this.cpu.io.register_read(port + 3, this, shim_read8_on_32);
            this.cpu.io.register_write(port, this, void 0, void 0, write);
            break;
          case 2:
            this.cpu.io.register_read(port, this, shim_read8_on_16, read, shim_read32_on_16);
            this.cpu.io.register_read(port + 1, this, shim_read8_on_16);
            this.cpu.io.register_write(port, this, void 0, write);
            break;
          case 1:
            this.cpu.io.register_read(port, this, read);
            this.cpu.io.register_write(port, this, write);
            break;
          default:
            dbg_assert(
              false,
              "VirtIO device <" + this.name + "> invalid capability field width of " + field.bytes + " bytes"
            );
            break;
        }
      }
      port += field.bytes;
    }
  }
  const cap_len = VIRTIO_PCI_CAP_LENGTH + 4;
  dbg_assert(
    cap_next + cap_len <= 256,
    "VirtIO device<" + this.name + "> can't fit all capabilities into 256byte configspace"
  );
  this.pci_space[cap_next] = VIRTIO_PCI_CAP_VENDOR;
  this.pci_space[cap_next + 1] = 0;
  this.pci_space[cap_next + 2] = cap_len;
  this.pci_space[cap_next + 3] = VIRTIO_PCI_CAP_PCI_CFG;
  this.pci_space[cap_next + 4] = 0;
  this.pci_space[cap_next + 5] = 0;
  this.pci_space[cap_next + 6] = 0;
  this.pci_space[cap_next + 7] = 0;
  this.pci_space[cap_next + 8] = 0;
  this.pci_space[cap_next + 9] = 0;
  this.pci_space[cap_next + 10] = 0;
  this.pci_space[cap_next + 11] = 0;
  this.pci_space[cap_next + 12] = 0;
  this.pci_space[cap_next + 13] = 0;
  this.pci_space[cap_next + 14] = 0;
  this.pci_space[cap_next + 15] = 0;
  this.pci_space[cap_next + 16] = 0;
  this.pci_space[cap_next + 17] = 0;
  this.pci_space[cap_next + 18] = 0;
  this.pci_space[cap_next + 19] = 0;
};
VirtIO.prototype.get_state = function() {
  let state = [];
  state[0] = this.device_feature_select;
  state[1] = this.driver_feature_select;
  state[2] = this.device_feature;
  state[3] = this.driver_feature;
  state[4] = this.features_ok;
  state[5] = this.device_status;
  state[6] = this.config_has_changed;
  state[7] = this.config_generation;
  state[8] = this.isr_status;
  state[9] = this.queue_select;
  state = state.concat(this.queues);
  return state;
};
VirtIO.prototype.set_state = function(state) {
  this.device_feature_select = state[0];
  this.driver_feature_select = state[1];
  this.device_feature = state[2];
  this.driver_feature = state[3];
  this.features_ok = state[4];
  this.device_status = state[5];
  this.config_has_changed = state[6];
  this.config_generation = state[7];
  this.isr_status = state[8];
  this.queue_select = state[9];
  let i = 0;
  for (const queue of state.slice(10)) {
    this.queues[i].set_state(queue);
    i++;
  }
  this.queue_selected = this.queues[this.queue_select] || null;
};
VirtIO.prototype.reset = function() {
  this.device_feature_select = 0;
  this.driver_feature_select = 0;
  this.driver_feature.set(this.device_feature);
  this.features_ok = true;
  this.device_status = 0;
  this.queue_select = 0;
  this.queue_selected = this.queues[0];
  for (const queue of this.queues) {
    queue.reset();
  }
  this.config_has_changed = false;
  this.config_generation = 0;
  this.lower_irq();
};
VirtIO.prototype.notify_config_changes = function() {
  this.config_has_changed = true;
  if (this.device_status & VIRTIO_STATUS_DRIVER_OK) {
    this.raise_irq(VIRTIO_ISR_DEVICE_CFG);
  } else {
    dbg_assert(
      false,
      "VirtIO device<" + this.name + "> attempted to notify driver before DRIVER_OK"
    );
  }
};
VirtIO.prototype.update_config_generation = function() {
  if (this.config_has_changed) {
    this.config_generation++;
    this.config_generation &= 255;
    this.config_has_changed = false;
  }
};
VirtIO.prototype.is_feature_negotiated = function(feature) {
  return (this.driver_feature[feature >>> 5] & 1 << (feature & 31)) > 0;
};
VirtIO.prototype.needs_reset = function() {
  dbg_log("Device<" + this.name + "> experienced error - requires reset", LOG_VIRTIO);
  this.device_status |= VIRTIO_STATUS_DEVICE_NEEDS_RESET;
  if (this.device_status & VIRTIO_STATUS_DRIVER_OK) {
    this.notify_config_changes();
  }
};
VirtIO.prototype.raise_irq = function(type) {
  dbg_log("Raise irq " + h(type), LOG_VIRTIO);
  this.isr_status |= type;
  this.pci.raise_irq(this.pci_id);
};
VirtIO.prototype.lower_irq = function() {
  dbg_log("Lower irq ", LOG_VIRTIO);
  this.isr_status = 0;
  this.pci.lower_irq(this.pci_id);
};
function VirtQueue(cpu, virtio, options) {
  this.cpu = cpu;
  this.virtio = virtio;
  this.size = options.size_supported;
  this.size_supported = options.size_supported;
  this.mask = this.size - 1;
  this.enabled = false;
  this.notify_offset = options.notify_offset;
  this.desc_addr = 0;
  this.avail_addr = 0;
  this.avail_last_idx = 0;
  this.used_addr = 0;
  this.num_staged_replies = 0;
  this.reset();
}
VirtQueue.prototype.get_state = function() {
  const state = [];
  state[0] = this.size;
  state[1] = this.size_supported;
  state[2] = this.enabled;
  state[3] = this.notify_offset;
  state[4] = this.desc_addr;
  state[5] = this.avail_addr;
  state[6] = this.avail_last_idx;
  state[7] = this.used_addr;
  state[8] = this.num_staged_replies;
  state[9] = 1;
  return state;
};
VirtQueue.prototype.set_state = function(state) {
  this.size = state[0];
  this.size_supported = state[1];
  this.enabled = state[2];
  this.notify_offset = state[3];
  this.desc_addr = state[4];
  this.avail_addr = state[5];
  this.avail_last_idx = state[6];
  this.used_addr = state[7];
  this.num_staged_replies = state[8];
  this.mask = this.size - 1;
  this.fix_wrapping = state[9] !== 1;
};
VirtQueue.prototype.reset = function() {
  this.enabled = false;
  this.desc_addr = 0;
  this.avail_addr = 0;
  this.avail_last_idx = 0;
  this.used_addr = 0;
  this.num_staged_replies = 0;
  this.set_size(this.size_supported);
};
VirtQueue.prototype.is_configured = function() {
  return this.desc_addr && this.avail_addr && this.used_addr;
};
VirtQueue.prototype.enable = function() {
  dbg_assert(this.is_configured(), "VirtQueue must be configured before enabled");
  this.enabled = true;
};
VirtQueue.prototype.set_size = function(size) {
  dbg_assert((size & size - 1) === 0, "VirtQueue size must be power of 2 or zero");
  dbg_assert(size <= this.size_supported, "VirtQueue size must be within supported size");
  this.size = size;
  this.mask = size - 1;
};
VirtQueue.prototype.count_requests = function() {
  dbg_assert(this.avail_addr, "VirtQueue addresses must be configured before use");
  if (this.fix_wrapping) {
    this.fix_wrapping = false;
    this.avail_last_idx = (this.avail_get_idx() & ~this.mask) + (this.avail_last_idx & this.mask);
  }
  return this.avail_get_idx() - this.avail_last_idx & 65535;
};
VirtQueue.prototype.has_request = function() {
  dbg_assert(this.avail_addr, "VirtQueue addresses must be configured before use");
  return this.count_requests() !== 0;
};
VirtQueue.prototype.pop_request = function() {
  dbg_assert(this.avail_addr, "VirtQueue addresses must be configured before use");
  dbg_assert(this.has_request(), "VirtQueue must not pop nonexistent request");
  const desc_idx = this.avail_get_entry(this.avail_last_idx);
  dbg_log("Pop request: avail_last_idx=" + this.avail_last_idx + " desc_idx=" + desc_idx, LOG_VIRTIO);
  const bufchain = new VirtQueueBufferChain(this, desc_idx);
  this.avail_last_idx = this.avail_last_idx + 1 & 65535;
  return bufchain;
};
VirtQueue.prototype.push_reply = function(bufchain) {
  dbg_assert(this.used_addr, "VirtQueue addresses must be configured before use");
  dbg_assert(this.num_staged_replies < this.size, "VirtQueue replies must not exceed queue size");
  const used_idx = this.used_get_idx() + this.num_staged_replies & this.mask;
  dbg_log("Push reply: used_idx=" + used_idx + " desc_idx=" + bufchain.head_idx, LOG_VIRTIO);
  this.used_set_entry(used_idx, bufchain.head_idx, bufchain.length_written);
  this.num_staged_replies++;
};
VirtQueue.prototype.flush_replies = function() {
  dbg_assert(this.used_addr, "VirtQueue addresses must be configured before use");
  if (this.num_staged_replies === 0) {
    dbg_log("flush_replies: Nothing to flush", LOG_VIRTIO);
    return;
  }
  dbg_log("Flushing " + this.num_staged_replies + " replies", LOG_VIRTIO);
  const old_idx = this.used_get_idx();
  const new_idx = old_idx + this.num_staged_replies & VIRTQ_IDX_MASK;
  this.used_set_idx(new_idx);
  this.num_staged_replies = 0;
  if (this.virtio.is_feature_negotiated(VIRTIO_F_RING_EVENT_IDX)) {
    const used_event = this.avail_get_used_event();
    let has_passed = old_idx <= used_event && used_event < new_idx;
    if (new_idx <= old_idx) {
      has_passed = used_event < new_idx || old_idx <= used_event;
    }
    {
      this.virtio.raise_irq(VIRTIO_ISR_QUEUE);
    }
  } else {
    if (~this.avail_get_flags() & VIRTQ_AVAIL_F_NO_INTERRUPT) {
      this.virtio.raise_irq(VIRTIO_ISR_QUEUE);
    }
  }
};
VirtQueue.prototype.notify_me_after = function(num_skipped_requests) {
  dbg_assert(num_skipped_requests >= 0, "Must skip a non-negative number of requests");
  const avail_event = this.avail_get_idx() + num_skipped_requests & 65535;
  this.used_set_avail_event(avail_event);
};
VirtQueue.prototype.get_descriptor = function(table_address, i) {
  return {
    addr_low: this.cpu.read32s(table_address + i * VIRTQ_DESC_ENTRYSIZE),
    addr_high: this.cpu.read32s(table_address + i * VIRTQ_DESC_ENTRYSIZE + 4),
    len: this.cpu.read32s(table_address + i * VIRTQ_DESC_ENTRYSIZE + 8),
    flags: this.cpu.read16(table_address + i * VIRTQ_DESC_ENTRYSIZE + 12),
    next: this.cpu.read16(table_address + i * VIRTQ_DESC_ENTRYSIZE + 14)
  };
};
VirtQueue.prototype.avail_get_flags = function() {
  return this.cpu.read16(this.avail_addr);
};
VirtQueue.prototype.avail_get_idx = function() {
  return this.cpu.read16(this.avail_addr + 2);
};
VirtQueue.prototype.avail_get_entry = function(i) {
  return this.cpu.read16(this.avail_addr + 4 + VIRTQ_AVAIL_ENTRYSIZE * (i & this.mask));
};
VirtQueue.prototype.avail_get_used_event = function() {
  return this.cpu.read16(this.avail_addr + 4 + VIRTQ_AVAIL_ENTRYSIZE * this.size);
};
VirtQueue.prototype.used_get_flags = function() {
  return this.cpu.read16(this.used_addr);
};
VirtQueue.prototype.used_set_flags = function(value) {
  this.cpu.write16(this.used_addr, value);
};
VirtQueue.prototype.used_get_idx = function() {
  return this.cpu.read16(this.used_addr + 2);
};
VirtQueue.prototype.used_set_idx = function(value) {
  this.cpu.write16(this.used_addr + 2, value);
};
VirtQueue.prototype.used_set_entry = function(i, desc_idx, length_written) {
  this.cpu.write32(this.used_addr + 4 + VIRTQ_USED_ENTRYSIZE * i, desc_idx);
  this.cpu.write32(this.used_addr + 8 + VIRTQ_USED_ENTRYSIZE * i, length_written);
};
VirtQueue.prototype.used_set_avail_event = function(value) {
  this.cpu.write16(this.used_addr + 4 + VIRTQ_USED_ENTRYSIZE * this.size, value);
};
function VirtQueueBufferChain(virtqueue, head_idx) {
  this.cpu = virtqueue.cpu;
  this.virtio = virtqueue.virtio;
  this.head_idx = head_idx;
  this.read_buffers = [];
  this.read_buffer_idx = 0;
  this.read_buffer_offset = 0;
  this.length_readable = 0;
  this.write_buffers = [];
  this.write_buffer_idx = 0;
  this.write_buffer_offset = 0;
  this.length_written = 0;
  this.length_writable = 0;
  let table_address = virtqueue.desc_addr;
  let desc_idx = head_idx;
  let chain_length = 0;
  let chain_max = virtqueue.size;
  let writable_region = false;
  const has_indirect_feature = this.virtio.is_feature_negotiated(VIRTIO_F_RING_INDIRECT_DESC);
  dbg_log("<<< Descriptor chain start", LOG_VIRTIO);
  do {
    const desc = virtqueue.get_descriptor(table_address, desc_idx);
    dbg_log("descriptor: idx=" + desc_idx + " addr=" + h(desc.addr_high, 8) + ":" + h(desc.addr_low, 8) + " len=" + h(desc.len, 8) + " flags=" + h(desc.flags, 4) + " next=" + h(desc.next, 4), LOG_VIRTIO);
    if (has_indirect_feature && desc.flags & VIRTQ_DESC_F_INDIRECT) {
      if (false) {
        dbg_log("Driver bug: has set VIRTQ_DESC_F_NEXT flag in an indirect table descriptor", LOG_VIRTIO);
      }
      table_address = desc.addr_low;
      desc_idx = 0;
      chain_length = 0;
      chain_max = desc.len / VIRTQ_DESC_ENTRYSIZE;
      dbg_log("start indirect", LOG_VIRTIO);
      continue;
    }
    if (desc.flags & VIRTQ_DESC_F_WRITE) {
      writable_region = true;
      this.write_buffers.push(desc);
      this.length_writable += desc.len;
    } else {
      if (writable_region) {
        dbg_log("Driver bug: readonly buffer after writeonly buffer within chain", LOG_VIRTIO);
        break;
      }
      this.read_buffers.push(desc);
      this.length_readable += desc.len;
    }
    chain_length++;
    if (chain_length > chain_max) {
      dbg_log("Driver bug: descriptor chain cycle detected", LOG_VIRTIO);
      break;
    }
    if (desc.flags & VIRTQ_DESC_F_NEXT) {
      desc_idx = desc.next;
    } else {
      break;
    }
  } while (true);
  dbg_log("Descriptor chain end >>>", LOG_VIRTIO);
}
VirtQueueBufferChain.prototype.get_next_blob = function(dest_buffer) {
  let dest_offset = 0;
  let remaining = dest_buffer.length;
  while (remaining) {
    if (this.read_buffer_idx === this.read_buffers.length) {
      dbg_log("Device<" + this.virtio.name + "> Read more than device-readable buffers has", LOG_VIRTIO);
      break;
    }
    const buf = this.read_buffers[this.read_buffer_idx];
    const read_address = buf.addr_low + this.read_buffer_offset;
    let read_length = buf.len - this.read_buffer_offset;
    if (read_length > remaining) {
      read_length = remaining;
      this.read_buffer_offset += remaining;
    } else {
      this.read_buffer_idx++;
      this.read_buffer_offset = 0;
    }
    dest_buffer.set(this.cpu.read_blob(read_address, read_length), dest_offset);
    dest_offset += read_length;
    remaining -= read_length;
  }
  return dest_offset;
};
VirtQueueBufferChain.prototype.set_next_blob = function(src_buffer) {
  let src_offset = 0;
  let remaining = src_buffer.length;
  while (remaining) {
    if (this.write_buffer_idx === this.write_buffers.length) {
      dbg_log("Device<" + this.virtio.name + "> Write more than device-writable capacity", LOG_VIRTIO);
      break;
    }
    const buf = this.write_buffers[this.write_buffer_idx];
    const write_address = buf.addr_low + this.write_buffer_offset;
    let write_length = buf.len - this.write_buffer_offset;
    if (write_length > remaining) {
      write_length = remaining;
      this.write_buffer_offset += remaining;
    } else {
      this.write_buffer_idx++;
      this.write_buffer_offset = 0;
    }
    const src_end = src_offset + write_length;
    this.cpu.write_blob(src_buffer.subarray(src_offset, src_end), write_address);
    src_offset += write_length;
    remaining -= write_length;
  }
  this.length_written += src_offset;
  return src_offset;
};

// lib/marshall.js
var textde = new TextDecoder();
var texten = new TextEncoder();
function Marshall(typelist, input, struct, offset) {
  var item;
  var size = 0;
  for (var i = 0; i < typelist.length; i++) {
    item = input[i];
    switch (typelist[i]) {
      case "w":
        struct[offset++] = item & 255;
        struct[offset++] = item >> 8 & 255;
        struct[offset++] = item >> 16 & 255;
        struct[offset++] = item >> 24 & 255;
        size += 4;
        break;
      case "d":
        struct[offset++] = item & 255;
        struct[offset++] = item >> 8 & 255;
        struct[offset++] = item >> 16 & 255;
        struct[offset++] = item >> 24 & 255;
        struct[offset++] = 0;
        struct[offset++] = 0;
        struct[offset++] = 0;
        struct[offset++] = 0;
        size += 8;
        break;
      case "h":
        struct[offset++] = item & 255;
        struct[offset++] = item >> 8;
        size += 2;
        break;
      case "b":
        struct[offset++] = item;
        size += 1;
        break;
      case "s":
        var lengthoffset = offset;
        var length = 0;
        struct[offset++] = 0;
        struct[offset++] = 0;
        size += 2;
        var stringBytes = texten.encode(item);
        size += stringBytes.byteLength;
        length += stringBytes.byteLength;
        struct.set(stringBytes, offset);
        offset += stringBytes.byteLength;
        struct[lengthoffset + 0] = length & 255;
        struct[lengthoffset + 1] = length >> 8 & 255;
        break;
      case "Q":
        Marshall(["b", "w", "d"], [item.type, item.version, item.path], struct, offset);
        offset += 13;
        size += 13;
        break;
      default:
        dbg_log("Marshall: Unknown type=" + typelist[i]);
        break;
    }
  }
  return size;
}
function Unmarshall(typelist, struct, state) {
  let offset = state.offset;
  var output = [];
  for (var i = 0; i < typelist.length; i++) {
    switch (typelist[i]) {
      case "w":
        var val = struct[offset++];
        val += struct[offset++] << 8;
        val += struct[offset++] << 16;
        val += struct[offset++] << 24 >>> 0;
        output.push(val);
        break;
      case "d":
        var val = struct[offset++];
        val += struct[offset++] << 8;
        val += struct[offset++] << 16;
        val += struct[offset++] << 24 >>> 0;
        offset += 4;
        output.push(val);
        break;
      case "h":
        var val = struct[offset++];
        output.push(val + (struct[offset++] << 8));
        break;
      case "b":
        output.push(struct[offset++]);
        break;
      case "s":
        var len = struct[offset++];
        len += struct[offset++] << 8;
        var stringBytes = struct.slice(offset, offset + len);
        offset += len;
        output.push(textde.decode(stringBytes));
        break;
      case "Q":
        state.offset = offset;
        const qid = Unmarshall(["b", "w", "d"], struct, state);
        offset = state.offset;
        output.push({
          type: qid[0],
          version: qid[1],
          path: qid[2]
        });
        break;
      default:
        dbg_log("Error in Unmarshall: Unknown type=" + typelist[i]);
        break;
    }
  }
  state.offset = offset;
  return output;
}

// src/virtio_console.js
var VIRTIO_CONSOLE_DEVICE_READY = 0;
var VIRTIO_CONSOLE_DEVICE_ADD = 1;
var VIRTIO_CONSOLE_PORT_READY = 3;
var VIRTIO_CONSOLE_CONSOLE_PORT = 4;
var VIRTIO_CONSOLE_RESIZE = 5;
var VIRTIO_CONSOLE_PORT_OPEN = 6;
var VIRTIO_CONSOLE_PORT_NAME = 7;
var VIRTIO_CONSOLE_F_SIZE = 0;
var VIRTIO_CONSOLE_F_MULTIPORT = 1;
function VirtioConsole(cpu, bus) {
  this.bus = bus;
  this.rows = 25;
  this.cols = 80;
  this.ports = 4;
  const queues = [
    {
      size_supported: 16,
      notify_offset: 0
    },
    {
      size_supported: 16,
      notify_offset: 1
    },
    {
      size_supported: 16,
      notify_offset: 2
    },
    {
      size_supported: 16,
      notify_offset: 3
    }
  ];
  for (let i = 1; i < this.ports; ++i) {
    queues.push({ size_supported: 16, notify_offset: 0 });
    queues.push({ size_supported: 8, notify_offset: 1 });
  }
  this.virtio = new VirtIO(
    cpu,
    {
      name: "virtio-console",
      pci_id: 12 << 3,
      device_id: 4163,
      subsystem_device_id: 3,
      common: {
        initial_port: 47104,
        queues,
        features: [
          VIRTIO_CONSOLE_F_SIZE,
          VIRTIO_CONSOLE_F_MULTIPORT,
          VIRTIO_F_VERSION_1
        ],
        on_driver_ok: () => {
        }
      },
      notification: {
        initial_port: 47360,
        single_handler: false,
        handlers: [
          (queue_id) => {
          },
          (queue_id) => {
            const queue = this.virtio.queues[queue_id];
            const port = queue_id > 3 ? queue_id - 3 >> 1 : 0;
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              this.bus.send("virtio-console" + port + "-output-bytes", buffer);
              this.Ack(queue_id, bufchain);
            }
          },
          (queue_id) => {
            if (queue_id !== 2) {
              dbg_assert(false, "VirtioConsole Notified for wrong queue: " + queue_id + " (expected queue_id of 2)");
            }
          },
          (queue_id) => {
            if (queue_id !== 3) {
              dbg_assert(false, "VirtioConsole Notified for wrong queue: " + queue_id + " (expected queue_id of 3)");
              return;
            }
            const queue = this.virtio.queues[queue_id];
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              const parts = Unmarshall(["w", "h", "h"], buffer, { offset: 0 });
              const port = parts[0];
              const event = parts[1];
              const value = parts[2];
              this.Ack(queue_id, bufchain);
              switch (event) {
                case VIRTIO_CONSOLE_DEVICE_READY:
                  for (let i = 0; i < this.ports; ++i) {
                    this.SendEvent(i, VIRTIO_CONSOLE_DEVICE_ADD, 0);
                  }
                  break;
                case VIRTIO_CONSOLE_PORT_READY:
                  this.Ack(queue_id, bufchain);
                  this.SendEvent(port, VIRTIO_CONSOLE_CONSOLE_PORT, 1);
                  this.SendName(port, "virtio-" + port);
                  this.SendEvent(port, VIRTIO_CONSOLE_PORT_OPEN, 1);
                  break;
                case VIRTIO_CONSOLE_PORT_OPEN:
                  this.Ack(queue_id, bufchain);
                  if (port === 0) {
                    this.SendWindowSize(port);
                  }
                  break;
                default:
                  dbg_assert(false, " VirtioConsole received unknown event: " + event[1]);
                  return;
              }
            }
          }
        ]
      },
      isr_status: {
        initial_port: 46848
      },
      device_specific: {
        initial_port: 46592,
        struct: [
          {
            bytes: 2,
            name: "cols",
            read: () => this.cols,
            write: (data) => {
            }
          },
          {
            bytes: 2,
            name: "rows",
            read: () => this.rows,
            write: (data) => {
            }
          },
          {
            bytes: 4,
            name: "max_nr_ports",
            read: () => this.ports,
            write: (data) => {
            }
          },
          {
            bytes: 4,
            name: "emerg_wr",
            read: () => 0,
            write: (data) => {
              dbg_assert(false, "Emergency write!");
            }
          }
        ]
      }
    }
  );
  for (let port = 0; port < this.ports; ++port) {
    const queue_id = port === 0 ? 0 : port * 2 + 2;
    this.bus.register("virtio-console" + port + "-input-bytes", function(data) {
      const queue = this.virtio.queues[queue_id];
      if (queue.has_request()) {
        const bufchain = queue.pop_request();
        this.Send(queue_id, bufchain, new Uint8Array(data));
      } else {
      }
    }, this);
    this.bus.register("virtio-console" + port + "-resize", function(size) {
      if (port === 0) {
        this.cols = size[0];
        this.rows = size[1];
      }
      if (this.virtio.queues[2].is_configured() && this.virtio.queues[2].has_request()) {
        this.SendWindowSize(port, size[0], size[1]);
      }
    }, this);
  }
}
VirtioConsole.prototype.SendWindowSize = function(port, cols = void 0, rows = void 0) {
  rows = rows || this.rows;
  cols = cols || this.cols;
  const bufchain = this.virtio.queues[2].pop_request();
  const buf = new Uint8Array(12);
  Marshall(["w", "h", "h", "h", "h"], [port, VIRTIO_CONSOLE_RESIZE, 0, rows, cols], buf, 0);
  this.Send(2, bufchain, buf);
};
VirtioConsole.prototype.SendName = function(port, name) {
  const bufchain = this.virtio.queues[2].pop_request();
  const namex = new TextEncoder().encode(name);
  const buf = new Uint8Array(8 + namex.length + 1);
  Marshall(["w", "h", "h"], [port, VIRTIO_CONSOLE_PORT_NAME, 1], buf, 0);
  for (let i = 0; i < namex.length; ++i) {
    buf[i + 8] = namex[i];
  }
  buf[8 + namex.length] = 0;
  this.Send(2, bufchain, buf);
};
VirtioConsole.prototype.get_state = function() {
  const state = [];
  state[0] = this.virtio;
  state[1] = this.rows;
  state[2] = this.cols;
  state[3] = this.ports;
  return state;
};
VirtioConsole.prototype.set_state = function(state) {
  this.virtio.set_state(state[0]);
  this.rows = state[1];
  this.cols = state[2];
  this.ports = state[3];
};
VirtioConsole.prototype.reset = function() {
  this.virtio.reset();
};
VirtioConsole.prototype.SendEvent = function(port, event, value) {
  const queue = this.virtio.queues[2];
  const bufchain = queue.pop_request();
  const buf = new Uint8Array(8);
  Marshall(["w", "h", "h"], [port, event, value], buf, 0);
  this.Send(2, bufchain, buf);
};
VirtioConsole.prototype.Send = function(queue_id, bufchain, blob) {
  bufchain.set_next_blob(blob);
  this.virtio.queues[queue_id].push_reply(bufchain);
  this.virtio.queues[queue_id].flush_replies();
};
VirtioConsole.prototype.Ack = function(queue_id, bufchain) {
  bufchain.set_next_blob(new Uint8Array(0));
  this.virtio.queues[queue_id].push_reply(bufchain);
  this.virtio.queues[queue_id].flush_replies();
};

// src/ps2.js
var PS2_LOG_VERBOSE = false;
function PS2(cpu, bus) {
  this.cpu = cpu;
  this.bus = bus;
  this.reset();
  this.bus.register("keyboard-code", function(code) {
    this.kbd_send_code(code);
  }, this);
  this.bus.register("mouse-click", function(data) {
    this.mouse_send_click(data[0], data[1], data[2]);
  }, this);
  this.bus.register("mouse-delta", function(data) {
    this.mouse_send_delta(data[0], data[1]);
  }, this);
  this.bus.register("mouse-wheel", function(data) {
    this.wheel_movement -= data[0];
    this.wheel_movement -= data[1] * 2;
    this.wheel_movement = Math.min(7, Math.max(-8, this.wheel_movement));
    this.send_mouse_packet(0, 0);
  }, this);
  cpu.io.register_read(96, this, this.port60_read);
  cpu.io.register_read(100, this, this.port64_read);
  cpu.io.register_write(96, this, this.port60_write);
  cpu.io.register_write(100, this, this.port64_write);
}
PS2.prototype.reset = function() {
  this.enable_mouse_stream = false;
  this.use_mouse = false;
  this.have_mouse = true;
  this.mouse_delta_x = 0;
  this.mouse_delta_y = 0;
  this.mouse_clicks = 0;
  this.have_keyboard = true;
  this.enable_keyboard_stream = false;
  this.next_is_mouse_command = false;
  this.next_read_sample = false;
  this.next_read_led = false;
  this.next_handle_scan_code_set = false;
  this.next_read_rate = false;
  this.next_read_resolution = false;
  this.kbd_buffer = new ByteQueue(1024);
  this.last_port60_byte = 0;
  this.sample_rate = 100;
  this.mouse_detect_state = 0;
  this.mouse_id = 0;
  this.mouse_reset_workaround = false;
  this.wheel_movement = 0;
  this.resolution = 4;
  this.scaling2 = false;
  this.last_mouse_packet = -1;
  this.mouse_buffer = new ByteQueue(1024);
  this.next_byte_is_ready = false;
  this.next_byte_is_aux = false;
  this.command_register = 1 | 4;
  this.controller_output_port = 0;
  this.read_output_register = false;
  this.read_command_register = false;
  this.read_controller_output_port = false;
};
PS2.prototype.get_state = function() {
  var state = [];
  state[0] = this.enable_mouse_stream;
  state[1] = this.use_mouse;
  state[2] = this.have_mouse;
  state[3] = this.mouse_delta_x;
  state[4] = this.mouse_delta_y;
  state[5] = this.mouse_clicks;
  state[6] = this.have_keyboard;
  state[7] = this.enable_keyboard_stream;
  state[8] = this.next_is_mouse_command;
  state[9] = this.next_read_sample;
  state[10] = this.next_read_led;
  state[11] = this.next_handle_scan_code_set;
  state[12] = this.next_read_rate;
  state[13] = this.next_read_resolution;
  state[15] = this.last_port60_byte;
  state[16] = this.sample_rate;
  state[17] = this.resolution;
  state[18] = this.scaling2;
  state[20] = this.command_register;
  state[21] = this.read_output_register;
  state[22] = this.read_command_register;
  state[23] = this.controller_output_port;
  state[24] = this.read_controller_output_port;
  state[25] = this.mouse_id;
  state[26] = this.mouse_detect_state;
  state[27] = this.mouse_reset_workaround;
  return state;
};
PS2.prototype.set_state = function(state) {
  this.enable_mouse_stream = state[0];
  this.use_mouse = state[1];
  this.have_mouse = state[2];
  this.mouse_delta_x = state[3];
  this.mouse_delta_y = state[4];
  this.mouse_clicks = state[5];
  this.have_keyboard = state[6];
  this.enable_keyboard_stream = state[7];
  this.next_is_mouse_command = state[8];
  this.next_read_sample = state[9];
  this.next_read_led = state[10];
  this.next_handle_scan_code_set = state[11];
  this.next_read_rate = state[12];
  this.next_read_resolution = state[13];
  this.last_port60_byte = state[15];
  this.sample_rate = state[16];
  this.resolution = state[17];
  this.scaling2 = state[18];
  this.command_register = state[20];
  this.read_output_register = state[21];
  this.read_command_register = state[22];
  this.controller_output_port = state[23];
  this.read_controller_output_port = state[24];
  this.mouse_id = state[25] || 0;
  this.mouse_detect_state = state[26] || 0;
  this.mouse_reset_workaround = state[27] || false;
  this.next_byte_is_ready = false;
  this.next_byte_is_aux = false;
  this.kbd_buffer.clear();
  this.mouse_buffer.clear();
  this.bus.send("mouse-enable", this.use_mouse);
};
PS2.prototype.raise_irq = function() {
  if (this.next_byte_is_ready) {
    return;
  }
  if (this.kbd_buffer.length) {
    this.kbd_irq();
  } else if (this.mouse_buffer.length) {
    this.mouse_irq();
  }
};
PS2.prototype.mouse_irq = function() {
  this.next_byte_is_ready = true;
  this.next_byte_is_aux = true;
  if (this.command_register & 2) {
    dbg_log("Mouse irq", LOG_PS2);
    this.cpu.device_lower_irq(12);
    this.cpu.device_raise_irq(12);
  }
};
PS2.prototype.kbd_irq = function() {
  this.next_byte_is_ready = true;
  this.next_byte_is_aux = false;
  if (this.command_register & 1) {
    dbg_log("Keyboard irq", LOG_PS2);
    this.cpu.device_lower_irq(1);
    this.cpu.device_raise_irq(1);
  }
};
PS2.prototype.kbd_send_code = function(code) {
  if (this.enable_keyboard_stream) {
    dbg_log("adding kbd code: " + h(code), LOG_PS2);
    this.kbd_buffer.push(code);
    this.raise_irq();
  }
};
PS2.prototype.mouse_send_delta = function(delta_x, delta_y) {
  if (!this.have_mouse || !this.use_mouse) {
    return;
  }
  const factor = 1;
  this.mouse_delta_x += delta_x * factor;
  this.mouse_delta_y += delta_y * factor;
  if (this.enable_mouse_stream) {
    var change_x = this.mouse_delta_x | 0, change_y = this.mouse_delta_y | 0;
    if (change_x || change_y) {
      this.mouse_delta_x -= change_x;
      this.mouse_delta_y -= change_y;
      this.send_mouse_packet(change_x, change_y);
    }
  }
};
PS2.prototype.mouse_send_click = function(left, middle, right) {
  if (!this.have_mouse || !this.use_mouse) {
    return;
  }
  this.mouse_clicks = left | right << 1 | middle << 2;
  if (this.enable_mouse_stream) {
    this.send_mouse_packet(0, 0);
  }
};
PS2.prototype.send_mouse_packet = function(dx, dy) {
  var info_byte = (dy < 0) << 5 | (dx < 0) << 4 | 1 << 3 | this.mouse_clicks, delta_x = dx, delta_y = dy;
  this.last_mouse_packet = Date.now();
  this.mouse_buffer.push(info_byte);
  this.mouse_buffer.push(delta_x);
  this.mouse_buffer.push(delta_y);
  if (this.mouse_id === 4) {
    this.mouse_buffer.push(
      0 << 5 | // TODO: 5th button
      0 << 4 | // TODO: 4th button
      this.wheel_movement & 15
    );
    this.wheel_movement = 0;
  } else if (this.mouse_id === 3) {
    this.mouse_buffer.push(this.wheel_movement & 255);
    this.wheel_movement = 0;
  }
  if (PS2_LOG_VERBOSE) {
    dbg_log("adding mouse packets: " + [info_byte, dx, dy], LOG_PS2);
  }
  this.raise_irq();
};
PS2.prototype.apply_scaling2 = function(n) {
  var abs = Math.abs(n), sign = n >> 31;
  switch (abs) {
    case 0:
    case 1:
    case 3:
      return n;
    case 2:
      return sign;
    case 4:
      return 6 * sign;
    case 5:
      return 9 * sign;
    default:
      return n << 1;
  }
};
PS2.prototype.port60_read = function() {
  this.next_byte_is_ready = false;
  if (!this.kbd_buffer.length && !this.mouse_buffer.length) {
    dbg_log("Port 60 read: Empty", LOG_PS2);
    return this.last_port60_byte;
  }
  if (this.next_byte_is_aux) {
    this.cpu.device_lower_irq(12);
    this.last_port60_byte = this.mouse_buffer.shift();
    dbg_log("Port 60 read (mouse): " + h(this.last_port60_byte), LOG_PS2);
  } else {
    this.cpu.device_lower_irq(1);
    this.last_port60_byte = this.kbd_buffer.shift();
    dbg_log("Port 60 read (kbd)  : " + h(this.last_port60_byte), LOG_PS2);
  }
  if (this.kbd_buffer.length || this.mouse_buffer.length) {
    this.raise_irq();
  }
  return this.last_port60_byte;
};
PS2.prototype.port64_read = function() {
  var status_byte = 16;
  if (this.next_byte_is_ready) {
    status_byte |= 1;
  }
  if (this.next_byte_is_aux) {
    status_byte |= 32;
  }
  dbg_log("port 64 read: " + h(status_byte), LOG_PS2);
  return status_byte;
};
PS2.prototype.port60_write = function(write_byte) {
  dbg_log("port 60 write: " + h(write_byte), LOG_PS2);
  if (this.read_command_register) {
    this.command_register = write_byte;
    this.read_command_register = false;
    dbg_log("Keyboard command register = " + h(this.command_register), LOG_PS2);
  } else if (this.read_output_register) {
    this.read_output_register = false;
    this.mouse_buffer.clear();
    this.mouse_buffer.push(write_byte);
    this.mouse_irq();
  } else if (this.next_read_sample) {
    this.next_read_sample = false;
    this.mouse_buffer.clear();
    this.mouse_buffer.push(250);
    this.sample_rate = write_byte;
    switch (this.mouse_detect_state) {
      case -1:
        if (write_byte === 60) {
          this.mouse_reset_workaround = true;
          this.mouse_detect_state = 0;
        } else {
          this.mouse_reset_workaround = false;
          this.mouse_detect_state = write_byte === 200 ? 1 : 0;
        }
        break;
      case 0:
        if (write_byte === 200) this.mouse_detect_state = 1;
        break;
      case 1:
        if (write_byte === 100) this.mouse_detect_state = 2;
        else if (write_byte === 200) this.mouse_detect_state = 3;
        else this.mouse_detect_state = 0;
        break;
      case 2:
        if (write_byte === 80) this.mouse_id = 3;
        this.mouse_detect_state = -1;
        break;
      case 3:
        if (write_byte === 80) this.mouse_id = 4;
        this.mouse_detect_state = -1;
        break;
    }
    dbg_log("mouse sample rate: " + h(write_byte) + ", mouse id: " + h(this.mouse_id), LOG_PS2);
    if (!this.sample_rate) {
      dbg_log("invalid sample rate, reset to 100", LOG_PS2);
      this.sample_rate = 100;
    }
    this.mouse_irq();
  } else if (this.next_read_resolution) {
    this.next_read_resolution = false;
    this.mouse_buffer.clear();
    this.mouse_buffer.push(250);
    if (write_byte > 3) {
      this.resolution = 4;
      dbg_log("invalid resolution, resetting to 4", LOG_PS2);
    } else {
      this.resolution = 1 << write_byte;
      dbg_log("resolution: " + this.resolution, LOG_PS2);
    }
    this.mouse_irq();
  } else if (this.next_read_led) {
    this.next_read_led = false;
    this.kbd_buffer.push(250);
    this.kbd_irq();
  } else if (this.next_handle_scan_code_set) {
    this.next_handle_scan_code_set = false;
    this.kbd_buffer.push(250);
    this.kbd_irq();
    if (write_byte) {
    } else {
      this.kbd_buffer.push(1);
    }
  } else if (this.next_read_rate) {
    this.next_read_rate = false;
    this.kbd_buffer.push(250);
    this.kbd_irq();
  } else if (this.next_is_mouse_command) {
    this.next_is_mouse_command = false;
    dbg_log("Port 60 data register write: " + h(write_byte), LOG_PS2);
    if (!this.have_mouse) {
      return;
    }
    this.kbd_buffer.clear();
    this.mouse_buffer.clear();
    this.mouse_buffer.push(250);
    switch (write_byte) {
      case 230:
        dbg_log("Scaling 1:1", LOG_PS2);
        this.scaling2 = false;
        break;
      case 231:
        dbg_log("Scaling 2:1", LOG_PS2);
        this.scaling2 = true;
        break;
      case 232:
        this.next_read_resolution = true;
        break;
      case 233:
        this.send_mouse_packet(0, 0);
        break;
      case 235:
        dbg_log("unimplemented request single packet", LOG_PS2);
        this.send_mouse_packet(0, 0);
        break;
      case 242:
        dbg_log("required id: " + h(this.mouse_id), LOG_PS2);
        this.mouse_buffer.push(this.mouse_id);
        this.mouse_clicks = this.mouse_delta_x = this.mouse_delta_y = 0;
        this.raise_irq();
        break;
      case 243:
        this.next_read_sample = true;
        break;
      case 244:
        this.enable_mouse_stream = true;
        this.use_mouse = true;
        this.bus.send("mouse-enable", true);
        this.mouse_clicks = this.mouse_delta_x = this.mouse_delta_y = 0;
        break;
      case 245:
        this.enable_mouse_stream = false;
        break;
      case 246:
        this.enable_mouse_stream = false;
        this.sample_rate = 100;
        this.scaling2 = false;
        this.resolution = 4;
        break;
      case 255:
        dbg_log("Mouse reset", LOG_PS2);
        this.mouse_buffer.push(170);
        this.mouse_buffer.push(0);
        this.use_mouse = true;
        this.bus.send("mouse-enable", true);
        this.enable_mouse_stream = false;
        this.sample_rate = 100;
        this.scaling2 = false;
        this.resolution = 4;
        if (!this.mouse_reset_workaround) {
          this.mouse_id = 0;
        }
        this.mouse_clicks = this.mouse_delta_x = this.mouse_delta_y = 0;
        break;
      default:
        dbg_log("Unimplemented mouse command: " + h(write_byte), LOG_PS2);
    }
    this.mouse_irq();
  } else if (this.read_controller_output_port) {
    this.read_controller_output_port = false;
    this.controller_output_port = write_byte;
  } else {
    dbg_log("Port 60 data register write: " + h(write_byte), LOG_PS2);
    this.mouse_buffer.clear();
    this.kbd_buffer.clear();
    this.kbd_buffer.push(250);
    switch (write_byte) {
      case 237:
        this.next_read_led = true;
        break;
      case 240:
        this.next_handle_scan_code_set = true;
        break;
      case 242:
        this.kbd_buffer.push(171);
        this.kbd_buffer.push(131);
        break;
      case 243:
        this.next_read_rate = true;
        break;
      case 244:
        dbg_log("kbd enable scanning", LOG_PS2);
        this.enable_keyboard_stream = true;
        break;
      case 245:
        dbg_log("kbd disable scanning", LOG_PS2);
        this.enable_keyboard_stream = false;
        break;
      case 246:
        break;
      case 255:
        this.kbd_buffer.clear();
        this.kbd_buffer.push(250);
        this.kbd_buffer.push(170);
        this.kbd_buffer.push(0);
        break;
      default:
        dbg_log("Unimplemented keyboard command: " + h(write_byte), LOG_PS2);
    }
    this.kbd_irq();
  }
};
PS2.prototype.port64_write = function(write_byte) {
  dbg_log("port 64 write: " + h(write_byte), LOG_PS2);
  switch (write_byte) {
    case 32:
      this.kbd_buffer.clear();
      this.mouse_buffer.clear();
      this.kbd_buffer.push(this.command_register);
      this.kbd_irq();
      break;
    case 96:
      this.read_command_register = true;
      break;
    case 209:
      this.read_controller_output_port = true;
      break;
    case 211:
      this.read_output_register = true;
      break;
    case 212:
      this.next_is_mouse_command = true;
      break;
    case 167:
      dbg_log("Disable second port", LOG_PS2);
      this.command_register |= 32;
      break;
    case 168:
      dbg_log("Enable second port", LOG_PS2);
      this.command_register &= ~32;
      break;
    case 169:
      this.kbd_buffer.clear();
      this.mouse_buffer.clear();
      this.kbd_buffer.push(0);
      this.kbd_irq();
      break;
    case 170:
      this.kbd_buffer.clear();
      this.mouse_buffer.clear();
      this.kbd_buffer.push(85);
      this.kbd_irq();
      break;
    case 171:
      this.kbd_buffer.clear();
      this.mouse_buffer.clear();
      this.kbd_buffer.push(0);
      this.kbd_irq();
      break;
    case 173:
      dbg_log("Disable Keyboard", LOG_PS2);
      this.command_register |= 16;
      break;
    case 174:
      dbg_log("Enable Keyboard", LOG_PS2);
      this.command_register &= ~16;
      break;
    case 254:
      dbg_log("CPU reboot via PS2");
      this.cpu.reboot_internal();
      break;
    default:
      dbg_log("port 64: Unimplemented command byte: " + h(write_byte), LOG_PS2);
  }
};

// src/elf.js
var ELF_MAGIC = 1179403647;
var types = DataView.prototype;
var U8 = { size: 1, get: types.getUint8, set: types.setUint8 };
var U16 = { size: 2, get: types.getUint16, set: types.setUint16 };
var U32 = { size: 4, get: types.getUint32, set: types.setUint32 };
var pad = function(size) {
  return {
    size,
    get: (offset) => -1
  };
};
var Header = create_struct([
  { magic: U32 },
  { class: U8 },
  { data: U8 },
  { version0: U8 },
  { osabi: U8 },
  { abiversion: U8 },
  { pad0: pad(7) },
  { type: U16 },
  { machine: U16 },
  { version1: U32 },
  { entry: U32 },
  { phoff: U32 },
  { shoff: U32 },
  { flags: U32 },
  { ehsize: U16 },
  { phentsize: U16 },
  { phnum: U16 },
  { shentsize: U16 },
  { shnum: U16 },
  { shstrndx: U16 }
]);
console.assert(Header.reduce((a, entry) => a + entry.size, 0) === 52);
var ProgramHeader = create_struct([
  { type: U32 },
  { offset: U32 },
  { vaddr: U32 },
  { paddr: U32 },
  { filesz: U32 },
  { memsz: U32 },
  { flags: U32 },
  { align: U32 }
]);
console.assert(ProgramHeader.reduce((a, entry) => a + entry.size, 0) === 32);
var SectionHeader = create_struct([
  { name: U32 },
  { type: U32 },
  { flags: U32 },
  { addr: U32 },
  { offset: U32 },
  { size: U32 },
  { link: U32 },
  { info: U32 },
  { addralign: U32 },
  { entsize: U32 }
]);
console.assert(SectionHeader.reduce((a, entry) => a + entry.size, 0) === 40);
function create_struct(struct) {
  return struct.map(function(entry) {
    const keys = Object.keys(entry);
    console.assert(keys.length === 1);
    const name = keys[0];
    const type = entry[name];
    console.assert(type.size > 0);
    return {
      name,
      type,
      size: type.size,
      get: type.get,
      set: type.set
    };
  });
}
function read_elf(buffer) {
  const view2 = new DataView(buffer);
  const [header, offset] = read_struct(view2, Header);
  console.assert(offset === 52);
  if (false) {
    for (const key of Object.keys(header)) {
      dbg_log(key + ": 0x" + (header[key].toString(16) >>> 0));
    }
  }
  console.assert(header.magic === ELF_MAGIC, "Bad magic");
  console.assert(header.class === 1, "Unimplemented: 64 bit elf");
  console.assert(header.data === 1, "Unimplemented: big endian");
  console.assert(header.version0 === 1, "Bad version0");
  console.assert(header.type === 2, "Unimplemented type");
  console.assert(header.version1 === 1, "Bad version1");
  console.assert(header.ehsize === 52, "Bad header size");
  console.assert(header.phentsize === 32, "Bad program header size");
  console.assert(header.shentsize === 40, "Bad section header size");
  const [program_headers, ph_offset] = read_structs(
    view_slice(view2, header.phoff, header.phentsize * header.phnum),
    ProgramHeader,
    header.phnum
  );
  const [sections_headers, sh_offset] = read_structs(
    view_slice(view2, header.shoff, header.shentsize * header.shnum),
    SectionHeader,
    header.shnum
  );
  if (false) {
    console.log("%d program headers:", program_headers.length);
    for (const program of program_headers) {
      console.log(
        "type=%s offset=%s vaddr=%s paddr=%s filesz=%s memsz=%s flags=%s align=%s",
        program.type.toString(16),
        program.offset.toString(16),
        program.vaddr.toString(16),
        program.paddr.toString(16),
        program.filesz.toString(16),
        program.memsz.toString(16),
        program.flags.toString(16),
        program.align.toString(16)
      );
    }
    console.log("%d section headers:", sections_headers.length);
    for (const section of sections_headers) {
      console.log(
        "name=%s type=%s flags=%s addr=%s offset=%s size=%s link=%s info=%s addralign=%s entsize=%s",
        section.name.toString(16),
        section.type.toString(16),
        section.flags.toString(16),
        section.addr.toString(16),
        section.offset.toString(16),
        section.size.toString(16),
        section.link.toString(16),
        section.info.toString(16),
        section.addralign.toString(16),
        section.entsize.toString(16)
      );
    }
  }
  return {
    header,
    program_headers,
    sections_headers
  };
}
function read_struct(view2, Struct) {
  const result = {};
  let offset = 0;
  const LITTLE_ENDIAN = true;
  for (const entry of Struct) {
    const value = entry.get.call(view2, offset, LITTLE_ENDIAN);
    console.assert(result[entry.name] === void 0);
    result[entry.name] = value;
    offset += entry.size;
  }
  return [result, offset];
}
function read_structs(view2, Struct, count) {
  const result = [];
  let offset = 0;
  for (var i = 0; i < count; i++) {
    const [s, size] = read_struct(view_slice(view2, offset), Struct);
    result.push(s);
    offset += size;
  }
  return [result, offset];
}
function view_slice(view2, offset, length) {
  return new DataView(view2.buffer, view2.byteOffset + offset, length);
}

// src/rtc.js
var CMOS_RTC_SECONDS = 0;
var CMOS_RTC_SECONDS_ALARM = 1;
var CMOS_RTC_MINUTES = 2;
var CMOS_RTC_MINUTES_ALARM = 3;
var CMOS_RTC_HOURS = 4;
var CMOS_RTC_HOURS_ALARM = 5;
var CMOS_RTC_DAY_WEEK = 6;
var CMOS_RTC_DAY_MONTH = 7;
var CMOS_RTC_MONTH = 8;
var CMOS_RTC_YEAR = 9;
var CMOS_STATUS_A = 10;
var CMOS_STATUS_B = 11;
var CMOS_STATUS_C = 12;
var CMOS_STATUS_D = 13;
var CMOS_DIAG_STATUS = 14;
var CMOS_FLOPPY_DRIVE_TYPE = 16;
var CMOS_DISK_DATA = 18;
var CMOS_EQUIPMENT_INFO = 20;
var CMOS_MEM_BASE_LOW = 21;
var CMOS_MEM_BASE_HIGH = 22;
var CMOS_MEM_OLD_EXT_LOW = 23;
var CMOS_MEM_OLD_EXT_HIGH = 24;
var CMOS_DISK_DRIVE1_CYL = 27;
var CMOS_DISK_DRIVE2_CYL = 36;
var CMOS_MEM_EXTMEM_LOW = 48;
var CMOS_MEM_EXTMEM_HIGH = 49;
var CMOS_CENTURY = 50;
var CMOS_MEM_EXTMEM2_LOW = 52;
var CMOS_MEM_EXTMEM2_HIGH = 53;
var CMOS_CENTURY2 = 55;
var CMOS_BIOS_BOOTFLAG1 = 56;
var CMOS_BIOS_DISKTRANSFLAG = 57;
var CMOS_BIOS_BOOTFLAG2 = 61;
var CMOS_MEM_HIGHMEM_LOW = 91;
var CMOS_MEM_HIGHMEM_MID = 92;
var CMOS_MEM_HIGHMEM_HIGH = 93;
var CMOS_BIOS_SMP_COUNT = 95;
var BOOT_ORDER_CD_FIRST = 291;
var BOOT_ORDER_HD_FIRST = 786;
var BOOT_ORDER_FD_FIRST = 801;
function RTC(cpu) {
  this.cpu = cpu;
  this.cmos_index = 0;
  this.cmos_data = new Uint8Array(128);
  this.rtc_time = Date.now();
  this.last_update = this.rtc_time;
  this.next_interrupt = 0;
  this.next_interrupt_alarm = 0;
  this.periodic_interrupt = false;
  this.periodic_interrupt_time = 1e3 / 1024;
  this.cmos_a = 38;
  this.cmos_b = 2;
  this.cmos_c = 0;
  this.cmos_diag_status = 0;
  this.nmi_disabled = 0;
  this.update_interrupt = false;
  this.update_interrupt_time = 0;
  cpu.io.register_write(112, this, function(out_byte) {
    this.cmos_index = out_byte & 127;
    this.nmi_disabled = out_byte >> 7;
  });
  cpu.io.register_write(113, this, this.cmos_port_write);
  cpu.io.register_read(113, this, this.cmos_port_read);
}
RTC.prototype.get_state = function() {
  var state = [];
  state[0] = this.cmos_index;
  state[1] = this.cmos_data;
  state[2] = this.rtc_time;
  state[3] = this.last_update;
  state[4] = this.next_interrupt;
  state[5] = this.next_interrupt_alarm;
  state[6] = this.periodic_interrupt;
  state[7] = this.periodic_interrupt_time;
  state[8] = this.cmos_a;
  state[9] = this.cmos_b;
  state[10] = this.cmos_c;
  state[11] = this.nmi_disabled;
  state[12] = this.update_interrupt;
  state[13] = this.update_interrupt_time;
  state[14] = this.cmos_diag_status;
  return state;
};
RTC.prototype.set_state = function(state) {
  this.cmos_index = state[0];
  this.cmos_data = state[1];
  this.rtc_time = state[2];
  this.last_update = state[3];
  this.next_interrupt = state[4];
  this.next_interrupt_alarm = state[5];
  this.periodic_interrupt = state[6];
  this.periodic_interrupt_time = state[7];
  this.cmos_a = state[8];
  this.cmos_b = state[9];
  this.cmos_c = state[10];
  this.nmi_disabled = state[11];
  this.update_interrupt = state[12] || false;
  this.update_interrupt_time = state[13] || 0;
  this.cmos_diag_status = state[14] || 0;
};
RTC.prototype.timer = function(time, legacy_mode) {
  time = Date.now();
  this.rtc_time += time - this.last_update;
  this.last_update = time;
  if (this.periodic_interrupt && this.next_interrupt < time) {
    this.cpu.device_raise_irq(8);
    this.cmos_c |= 1 << 6 | 1 << 7;
    this.next_interrupt += this.periodic_interrupt_time * Math.ceil((time - this.next_interrupt) / this.periodic_interrupt_time);
  } else if (this.next_interrupt_alarm && this.next_interrupt_alarm < time) {
    this.cpu.device_raise_irq(8);
    this.cmos_c |= 1 << 5 | 1 << 7;
    this.next_interrupt_alarm = 0;
  } else if (this.update_interrupt && this.update_interrupt_time < time) {
    this.cpu.device_raise_irq(8);
    this.cmos_c |= 1 << 4 | 1 << 7;
    this.update_interrupt_time = time + 1e3;
  }
  let t = 100;
  if (this.periodic_interrupt && this.next_interrupt) {
    t = Math.min(t, Math.max(0, this.next_interrupt - time));
  }
  if (this.next_interrupt_alarm) {
    t = Math.min(t, Math.max(0, this.next_interrupt_alarm - time));
  }
  if (this.update_interrupt) {
    t = Math.min(t, Math.max(0, this.update_interrupt_time - time));
  }
  return t;
};
RTC.prototype.bcd_pack = function(n) {
  var i = 0, result = 0, digit;
  while (n) {
    digit = n % 10;
    result |= digit << 4 * i;
    i++;
    n = (n - digit) / 10;
  }
  return result;
};
RTC.prototype.bcd_unpack = function(n) {
  const low = n & 15;
  const high = n >> 4 & 15;
  dbg_assert(n < 256);
  dbg_assert(low < 10);
  dbg_assert(high < 10);
  return low + 10 * high;
};
RTC.prototype.encode_time = function(t) {
  if (this.cmos_b & 4) {
    return t;
  } else {
    return this.bcd_pack(t);
  }
};
RTC.prototype.decode_time = function(t) {
  if (this.cmos_b & 4) {
    return t;
  } else {
    return this.bcd_unpack(t);
  }
};
RTC.prototype.cmos_port_read = function() {
  var index = this.cmos_index;
  switch (index) {
    case CMOS_RTC_SECONDS:
      dbg_log("read second: " + h(this.encode_time(new Date(this.rtc_time).getUTCSeconds())), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCSeconds());
    case CMOS_RTC_MINUTES:
      dbg_log("read minute: " + h(this.encode_time(new Date(this.rtc_time).getUTCMinutes())), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCMinutes());
    case CMOS_RTC_HOURS:
      dbg_log("read hour: " + h(this.encode_time(new Date(this.rtc_time).getUTCHours())), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCHours());
    case CMOS_RTC_DAY_WEEK:
      dbg_log("read day: " + h(this.encode_time(new Date(this.rtc_time).getUTCDay() + 1)), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCDay() + 1);
    case CMOS_RTC_DAY_MONTH:
      dbg_log("read day of month: " + h(this.encode_time(new Date(this.rtc_time).getUTCDate())), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCDate());
    case CMOS_RTC_MONTH:
      dbg_log("read month: " + h(this.encode_time(new Date(this.rtc_time).getUTCMonth() + 1)), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCMonth() + 1);
    case CMOS_RTC_YEAR:
      dbg_log("read year: " + h(this.encode_time(new Date(this.rtc_time).getUTCFullYear() % 100)), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCFullYear() % 100);
    case CMOS_STATUS_A:
      if (v86.microtick() % 1e3 >= 999) {
        return this.cmos_a | 128;
      }
      return this.cmos_a;
    case CMOS_STATUS_B:
      return this.cmos_b;
    case CMOS_STATUS_C:
      this.cpu.device_lower_irq(8);
      dbg_log("cmos reg C read", LOG_RTC);
      var c = this.cmos_c;
      this.cmos_c &= ~240;
      return c;
    case CMOS_STATUS_D:
      return 1 << 7;
    // CMOS battery charged
    case CMOS_DIAG_STATUS:
      dbg_log("cmos diagnostic status read", LOG_RTC);
      return this.cmos_diag_status;
    case CMOS_CENTURY:
    case CMOS_CENTURY2:
      dbg_log("read century: " + h(this.encode_time(new Date(this.rtc_time).getUTCFullYear() / 100 | 0)), LOG_RTC);
      return this.encode_time(new Date(this.rtc_time).getUTCFullYear() / 100 | 0);
    default:
      dbg_log("cmos read from index " + h(index), LOG_RTC);
      return this.cmos_data[this.cmos_index];
  }
};
RTC.prototype.cmos_port_write = function(data_byte) {
  switch (this.cmos_index) {
    case 10:
      this.cmos_a = data_byte & 127;
      this.periodic_interrupt_time = 1e3 / (32768 >> (this.cmos_a & 15) - 1);
      dbg_log("Periodic interrupt, a=" + h(this.cmos_a, 2) + " t=" + this.periodic_interrupt_time, LOG_RTC);
      break;
    case 11:
      this.cmos_b = data_byte;
      if (this.cmos_b & 128) {
        this.cmos_b &= 239;
      }
      if (this.cmos_b & 64) {
        this.next_interrupt = Date.now();
      }
      if (this.cmos_b & 32) {
        const now = /* @__PURE__ */ new Date();
        const seconds = this.decode_time(this.cmos_data[CMOS_RTC_SECONDS_ALARM]);
        const minutes = this.decode_time(this.cmos_data[CMOS_RTC_MINUTES_ALARM]);
        const hours = this.decode_time(this.cmos_data[CMOS_RTC_HOURS_ALARM]);
        const alarm_date = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          hours,
          minutes,
          seconds
        ));
        const ms_from_now = alarm_date - now;
        dbg_log("RTC alarm scheduled for " + alarm_date + " hh:mm:ss=" + hours + ":" + minutes + ":" + seconds + " ms_from_now=" + ms_from_now, LOG_RTC);
        this.next_interrupt_alarm = +alarm_date;
      }
      if (this.cmos_b & 16) {
        dbg_log("update interrupt", LOG_RTC);
        this.update_interrupt_time = Date.now();
      }
      dbg_log("cmos b=" + h(this.cmos_b, 2), LOG_RTC);
      break;
    case CMOS_DIAG_STATUS:
      this.cmos_diag_status = data_byte;
      break;
    case CMOS_RTC_SECONDS_ALARM:
    case CMOS_RTC_MINUTES_ALARM:
    case CMOS_RTC_HOURS_ALARM:
      this.cmos_write(this.cmos_index, data_byte);
      break;
    default:
      dbg_log("cmos write index " + h(this.cmos_index) + ": " + h(data_byte), LOG_RTC);
  }
  this.update_interrupt = (this.cmos_b & 16) === 16 && (this.cmos_a & 15) > 0;
  this.periodic_interrupt = (this.cmos_b & 64) === 64 && (this.cmos_a & 15) > 0;
};
RTC.prototype.cmos_read = function(index) {
  dbg_assert(index < 128);
  return this.cmos_data[index];
};
RTC.prototype.cmos_write = function(index, value) {
  dbg_log("cmos " + h(index) + " <- " + h(value), LOG_RTC);
  dbg_assert(index < 128);
  this.cmos_data[index] = value;
};

// src/floppy.js
var FDC_IRQ_CHANNEL = 6;
var FDC_DMA_CHANNEL = 2;
var CMOS_FDD_TYPE_NO_DRIVE = 0;
var CMOS_FDD_TYPE_360 = 1;
var CMOS_FDD_TYPE_1200 = 2;
var CMOS_FDD_TYPE_720 = 3;
var CMOS_FDD_TYPE_1440 = 4;
var CMOS_FDD_TYPE_2880 = 5;
var CMOS_FDD_TYPE_MEDIUM = {
  [CMOS_FDD_TYPE_NO_DRIVE]: 0,
  // no disk
  [CMOS_FDD_TYPE_360]: 525,
  // 5"1/4 disk
  [CMOS_FDD_TYPE_1200]: 525,
  // 5"1/4 disk
  [CMOS_FDD_TYPE_720]: 350,
  // 3"1/2 disk
  [CMOS_FDD_TYPE_1440]: 350,
  // 3"1/2 disk
  [CMOS_FDD_TYPE_2880]: 350
  // 3"1/2 disk
};
var REG_SRA = 0;
var REG_SRB = 1;
var REG_DOR = 2;
var REG_TDR = 3;
var REG_MSR = 4;
var REG_DSR = 4;
var REG_FIFO = 5;
var REG_DIR = 7;
var REG_CCR = 7;
var SRA_INTPEND = 128;
var SRB_MTR0 = 1;
var SRB_MTR1 = 2;
var SRB_DR0 = 32;
var SRB_RESET = 192;
var DOR_SEL_LO = 1;
var DOR_SEL_HI = 2;
var DOR_NRESET = 4;
var DOR_DMAEN = 8;
var DOR_MOTEN0 = 16;
var DOR_MOTEN1 = 32;
var DOR_SELMASK = 1;
var TDR_BOOTSEL = 4;
var MSR_CMDBUSY = 16;
var MSR_NDMA = 32;
var MSR_DIO = 64;
var MSR_RQM = 128;
var DSR_DRATEMASK = 3;
var DSR_PWRDOWN = 64;
var DSR_SWRESET = 128;
var DIR_DOOR = 128;
var SR0_DS0 = 1;
var SR0_DS1 = 2;
var SR0_HEAD = 4;
var SR0_SEEK = 32;
var SR0_ABNTERM = 64;
var SR0_INVCMD = 128;
var SR0_RDYCHG = SR0_ABNTERM | SR0_INVCMD;
var SR1_MA = 1;
var SR1_NW = 2;
var SR1_EC = 128;
var CMD_READ_TRACK = 2;
var CMD_SPECIFY = 3;
var CMD_SENSE_DRIVE_STATUS = 4;
var CMD_WRITE = 5;
var CMD_READ = 6;
var CMD_RECALIBRATE = 7;
var CMD_SENSE_INTERRUPT_STATUS = 8;
var CMD_WRITE_DELETED_DATA = 9;
var CMD_READ_ID = 10;
var CMD_READ_DELETED_DATA = 12;
var CMD_FORMAT_TRACK = 13;
var CMD_DUMP_REGS = 14;
var CMD_SEEK = 15;
var CMD_VERSION = 16;
var CMD_SCAN_EQUAL = 17;
var CMD_PERPENDICULAR_MODE = 18;
var CMD_CONFIGURE = 19;
var CMD_LOCK = 20;
var CMD_VERIFY = 22;
var CMD_POWERDOWN_MODE = 23;
var CMD_PART_ID = 24;
var CMD_SCAN_LOW_OR_EQUAL = 25;
var CMD_SCAN_HIGH_OR_EQUAL = 29;
var CMD_SAVE = 46;
var CMD_OPTION = 51;
var CMD_RESTORE = 78;
var CMD_DRIVE_SPECIFICATION = 142;
var CMD_RELATIVE_SEEK_OUT = 143;
var CMD_FORMAT_AND_WRITE = 205;
var CMD_RELATIVE_SEEK_IN = 207;
var CMD_FLAG_MULTI_TRACK = 1;
var CMD_PHASE_COMMAND = 1;
var CMD_PHASE_EXECUTION = 2;
var CMD_PHASE_RESULT = 3;
var CONFIG_EFIFO = 32;
var CONFIG_EIS = 64;
var RESET_SENSE_INT_MAX = 4;
var SECTOR_SIZE = 512;
var SECTOR_SIZE_CODE = 2;
function FloppyController(cpu, fda_image, fdb_image, fdc_config) {
  this.io = cpu.io;
  this.cpu = cpu;
  this.dma = cpu.devices.dma;
  this.cmd_table = this.build_cmd_lookup_table();
  this.sra = 0;
  this.srb = SRB_RESET;
  this.dor = DOR_NRESET | DOR_DMAEN;
  this.tdr = 0;
  this.msr = MSR_RQM;
  this.dsr = 0;
  this.cmd_phase = CMD_PHASE_COMMAND;
  this.cmd_code = 0;
  this.cmd_flags = 0;
  this.cmd_buffer = new Uint8Array(17);
  this.cmd_cursor = 0;
  this.cmd_remaining = 0;
  this.response_data = new Uint8Array(15);
  this.response_cursor = 0;
  this.response_length = 0;
  this.status0 = 0;
  this.status1 = 0;
  this.curr_drive_no = 0;
  this.reset_sense_int_count = 0;
  this.locked = false;
  this.step_rate_interval = 0;
  this.head_load_time = 0;
  this.fdc_config = CONFIG_EIS | CONFIG_EFIFO;
  this.precomp_trk = 0;
  this.eot = 0;
  this.drives = [
    new FloppyDrive("fda", fdc_config?.fda, fda_image, CMOS_FDD_TYPE_1440),
    new FloppyDrive("fdb", fdc_config?.fdb, fdb_image, CMOS_FDD_TYPE_1440)
  ];
  Object.seal(this);
  this.cpu.devices.rtc.cmos_write(CMOS_FLOPPY_DRIVE_TYPE, this.drives[0].drive_type << 4 | this.drives[1].drive_type);
  const fdc_io_base = 1008;
  this.io.register_read(fdc_io_base | REG_SRA, this, this.read_reg_sra);
  this.io.register_read(fdc_io_base | REG_SRB, this, this.read_reg_srb);
  this.io.register_read(fdc_io_base | REG_DOR, this, this.read_reg_dor);
  this.io.register_read(fdc_io_base | REG_TDR, this, this.read_reg_tdr);
  this.io.register_read(fdc_io_base | REG_MSR, this, this.read_reg_msr);
  this.io.register_read(fdc_io_base | REG_FIFO, this, this.read_reg_fifo);
  this.io.register_read(fdc_io_base | REG_DIR, this, this.read_reg_dir);
  this.io.register_write(fdc_io_base | REG_DOR, this, this.write_reg_dor);
  this.io.register_write(fdc_io_base | REG_TDR, this, this.write_reg_tdr);
  this.io.register_write(fdc_io_base | REG_DSR, this, this.write_reg_dsr);
  this.io.register_write(fdc_io_base | REG_FIFO, this, this.write_reg_fifo);
  this.io.register_write(fdc_io_base | REG_CCR, this, this.write_reg_ccr);
  dbg_log("floppy controller ready", LOG_FLOPPY);
}
FloppyController.prototype.build_cmd_lookup_table = function() {
  const CMD_DESCRIPTOR = [
    { code: CMD_READ, mask: 31, argc: 8, name: "READ", handler: this.exec_read },
    { code: CMD_WRITE, mask: 63, argc: 8, name: "WRITE", handler: this.exec_write },
    { code: CMD_SEEK, mask: 255, argc: 2, name: "SEEK", handler: this.exec_seek },
    { code: CMD_SENSE_INTERRUPT_STATUS, mask: 255, argc: 0, name: "SENSE INTERRUPT STATUS", handler: this.exec_sense_interrupt_status },
    { code: CMD_RECALIBRATE, mask: 255, argc: 1, name: "RECALIBRATE", handler: this.exec_recalibrate },
    { code: CMD_FORMAT_TRACK, mask: 191, argc: 5, name: "FORMAT TRACK", handler: this.exec_format_track },
    { code: CMD_READ_TRACK, mask: 191, argc: 8, name: "READ TRACK", handler: this.exec_unimplemented },
    { code: CMD_RESTORE, mask: 255, argc: 17, name: "RESTORE", handler: this.exec_unimplemented },
    { code: CMD_SAVE, mask: 255, argc: 0, name: "SAVE", handler: this.exec_unimplemented },
    { code: CMD_READ_DELETED_DATA, mask: 31, argc: 8, name: "READ DELETED DATA", handler: this.exec_unimplemented },
    { code: CMD_SCAN_EQUAL, mask: 31, argc: 8, name: "SCAN EQUAL", handler: this.exec_unimplemented },
    { code: CMD_VERIFY, mask: 31, argc: 8, name: "VERIFY", handler: this.exec_unimplemented },
    { code: CMD_SCAN_LOW_OR_EQUAL, mask: 31, argc: 8, name: "SCAN LOW OR EQUAL", handler: this.exec_unimplemented },
    { code: CMD_SCAN_HIGH_OR_EQUAL, mask: 31, argc: 8, name: "SCAN HIGH OR EQUAL", handler: this.exec_unimplemented },
    { code: CMD_WRITE_DELETED_DATA, mask: 63, argc: 8, name: "WRITE DELETED DATA", handler: this.exec_unimplemented },
    { code: CMD_READ_ID, mask: 191, argc: 1, name: "READ ID", handler: this.exec_read_id },
    { code: CMD_SPECIFY, mask: 255, argc: 2, name: "SPECIFY", handler: this.exec_specify },
    { code: CMD_SENSE_DRIVE_STATUS, mask: 255, argc: 1, name: "SENSE DRIVE STATUS", handler: this.exec_sense_drive_status },
    { code: CMD_PERPENDICULAR_MODE, mask: 255, argc: 1, name: "PERPENDICULAR MODE", handler: this.exec_perpendicular_mode },
    { code: CMD_CONFIGURE, mask: 255, argc: 3, name: "CONFIGURE", handler: this.exec_configure },
    { code: CMD_POWERDOWN_MODE, mask: 255, argc: 2, name: "POWERDOWN MODE", handler: this.exec_unimplemented },
    { code: CMD_OPTION, mask: 255, argc: 1, name: "OPTION", handler: this.exec_unimplemented },
    { code: CMD_DRIVE_SPECIFICATION, mask: 255, argc: 5, name: "DRIVE SPECIFICATION", handler: this.exec_unimplemented },
    { code: CMD_RELATIVE_SEEK_OUT, mask: 255, argc: 2, name: "RELATIVE SEEK OUT", handler: this.exec_unimplemented },
    { code: CMD_FORMAT_AND_WRITE, mask: 255, argc: 10, name: "FORMAT AND WRITE", handler: this.exec_unimplemented },
    { code: CMD_RELATIVE_SEEK_IN, mask: 255, argc: 2, name: "RELATIVE SEEK IN", handler: this.exec_unimplemented },
    { code: CMD_LOCK, mask: 127, argc: 0, name: "LOCK", handler: this.exec_lock },
    { code: CMD_DUMP_REGS, mask: 255, argc: 0, name: "DUMP REGISTERS", handler: this.exec_dump_regs },
    { code: CMD_VERSION, mask: 255, argc: 0, name: "VERSION", handler: this.exec_version },
    { code: CMD_PART_ID, mask: 255, argc: 0, name: "PART ID", handler: this.exec_part_id },
    { code: 0, mask: 0, argc: 0, name: "UNKNOWN COMMAND", handler: this.exec_unimplemented }
    // default handler
  ];
  const cmd_table = new Array(256);
  for (let i = CMD_DESCRIPTOR.length - 1; i >= 0; i--) {
    const cmd_desc = CMD_DESCRIPTOR[i];
    if (cmd_desc.mask === 255) {
      cmd_table[cmd_desc.code] = cmd_desc;
    } else {
      for (let j = 0; j < 256; j++) {
        if ((j & cmd_desc.mask) === cmd_desc.code) {
          cmd_table[j] = cmd_desc;
        }
      }
    }
  }
  return cmd_table;
};
FloppyController.prototype.raise_irq = function(reason) {
  if (!(this.sra & SRA_INTPEND)) {
    this.cpu.device_raise_irq(FDC_IRQ_CHANNEL);
    this.sra |= SRA_INTPEND;
    dbg_log("IRQ raised, reason: " + reason, LOG_FLOPPY);
  }
  this.reset_sense_int_count = 0;
};
FloppyController.prototype.lower_irq = function(reason) {
  this.status0 = 0;
  if (this.sra & SRA_INTPEND) {
    this.cpu.device_lower_irq(FDC_IRQ_CHANNEL);
    this.sra &= ~SRA_INTPEND;
    dbg_log("IRQ lowered, reason: " + reason, LOG_FLOPPY);
  }
};
FloppyController.prototype.set_curr_drive_no = function(curr_drive_no) {
  this.curr_drive_no = curr_drive_no & 1;
  return this.drives[this.curr_drive_no];
};
FloppyController.prototype.enter_command_phase = function() {
  this.cmd_phase = CMD_PHASE_COMMAND;
  this.cmd_cursor = 0;
  this.cmd_remaining = 0;
  this.msr &= ~(MSR_CMDBUSY | MSR_DIO);
  this.msr |= MSR_RQM;
};
FloppyController.prototype.enter_result_phase = function(fifo_len) {
  this.cmd_phase = CMD_PHASE_RESULT;
  this.response_cursor = 0;
  this.response_length = fifo_len;
  this.msr |= MSR_CMDBUSY | MSR_RQM | MSR_DIO;
};
FloppyController.prototype.reset_fdc = function() {
  dbg_log("resetting controller", LOG_FLOPPY);
  this.lower_irq("controller reset");
  this.sra = 0;
  this.srb = SRB_RESET;
  this.dor = DOR_NRESET | DOR_DMAEN;
  this.msr = MSR_RQM;
  this.curr_drive_no = 0;
  this.status0 |= SR0_RDYCHG;
  this.response_cursor = 0;
  this.response_length = 0;
  this.drives[0].seek(0, 0, 1);
  this.drives[1].seek(0, 0, 1);
  this.enter_command_phase();
  this.raise_irq("controller reset");
  this.reset_sense_int_count = RESET_SENSE_INT_MAX;
};
FloppyController.prototype.read_reg_sra = function() {
  dbg_log("SRA read: " + h(this.sra), LOG_FLOPPY);
  return this.sra;
};
FloppyController.prototype.read_reg_srb = function() {
  dbg_log("SRB read: " + h(this.srb), LOG_FLOPPY);
  return this.srb;
};
FloppyController.prototype.read_reg_dor = function() {
  const dor_byte = this.dor & ~(DOR_SEL_LO | DOR_SEL_HI) | this.curr_drive_no;
  dbg_log("DOR read: " + h(dor_byte), LOG_FLOPPY);
  return dor_byte;
};
FloppyController.prototype.read_reg_tdr = function() {
  dbg_log("TDR read: " + h(this.tdr), LOG_FLOPPY);
  return this.tdr;
};
FloppyController.prototype.read_reg_msr = function() {
  dbg_log("MSR read: " + h(this.msr), LOG_FLOPPY);
  this.dsr &= ~DSR_PWRDOWN;
  this.dor |= DOR_NRESET;
  return this.msr;
};
FloppyController.prototype.read_reg_fifo = function() {
  this.dsr &= ~DSR_PWRDOWN;
  if (!(this.msr & MSR_RQM) || !(this.msr & MSR_DIO)) {
    dbg_log("FIFO read rejected: controller not ready for reading", LOG_FLOPPY);
    return 0;
  } else if (this.cmd_phase !== CMD_PHASE_RESULT) {
    dbg_log("FIFO read rejected: floppy controller not in RESULT phase, phase: " + this.cmd_phase, LOG_FLOPPY);
    return 0;
  }
  if (this.response_cursor < this.response_length) {
    const fifo_byte = this.response_data[this.response_cursor++];
    if (this.response_cursor === this.response_length) {
      const lower_irq_reason = false ? "end of " + this.cmd_table[this.cmd_code].name + " response" : "";
      this.msr &= ~MSR_RQM;
      this.enter_command_phase();
      this.lower_irq(lower_irq_reason);
    }
    return fifo_byte;
  } else {
    dbg_log("FIFO read: empty", LOG_FLOPPY);
    return 0;
  }
};
FloppyController.prototype.read_reg_dir = function() {
  const curr_drive = this.drives[this.curr_drive_no];
  const dir_byte = curr_drive.media_changed ? DIR_DOOR : 0;
  dbg_log("DIR read: " + h(dir_byte), LOG_FLOPPY);
  return dir_byte;
};
FloppyController.prototype.write_reg_dor = function(dor_byte) {
  this.srb = this.srb & ~(SRB_MTR0 | SRB_MTR1 | SRB_DR0) | (dor_byte & DOR_MOTEN0 ? SRB_MTR0 : 0) | (dor_byte & DOR_MOTEN1 ? SRB_MTR1 : 0) | (dor_byte & DOR_SEL_LO ? SRB_DR0 : 0);
  if (this.dor & DOR_NRESET) {
    if (!(dor_byte & DOR_NRESET)) {
      dbg_log("enter RESET state", LOG_FLOPPY);
    }
  } else {
    if (dor_byte & DOR_NRESET) {
      this.reset_fdc();
      this.dsr &= ~DSR_PWRDOWN;
      dbg_log("exit RESET state", LOG_FLOPPY);
    }
  }
  const new_drive_no = dor_byte & (DOR_SEL_LO | DOR_SEL_HI);
  dbg_log("DOR write: " + h(dor_byte) + ", motors: " + h(dor_byte >> 4) + ", dma: " + !!(dor_byte & DOR_DMAEN) + ", reset: " + !(dor_byte & DOR_NRESET) + ", drive: " + new_drive_no, LOG_FLOPPY);
  if (new_drive_no > 1) {
    dbg_log("*** WARNING: floppy drive number " + new_drive_no + " not implemented!", LOG_FLOPPY);
  }
  this.curr_drive_no = new_drive_no & DOR_SEL_LO;
  this.dor = dor_byte;
};
FloppyController.prototype.write_reg_tdr = function(tdr_byte) {
  if (!(this.dor & DOR_NRESET)) {
    dbg_log("TDR write " + h(tdr_byte) + " rejected: Floppy controller in RESET mode!", LOG_FLOPPY);
    return;
  }
  dbg_log("TDR write: " + h(tdr_byte), LOG_FLOPPY);
  this.tdr = tdr_byte & TDR_BOOTSEL;
};
FloppyController.prototype.write_reg_dsr = function(dsr_byte) {
  if (!(this.dor & DOR_NRESET)) {
    dbg_log("DSR write: " + h(dsr_byte) + " rejected: Floppy controller in RESET mode!", LOG_FLOPPY);
    return;
  }
  dbg_log("DSR write: " + h(dsr_byte), LOG_FLOPPY);
  if (dsr_byte & DSR_SWRESET) {
    this.dor &= ~DOR_NRESET;
    this.reset_fdc();
    this.dor |= DOR_NRESET;
  }
  if (dsr_byte & DSR_PWRDOWN) {
    this.reset_fdc();
  }
  this.dsr = dsr_byte;
};
FloppyController.prototype.write_reg_fifo = function(fifo_byte) {
  this.dsr &= ~DSR_PWRDOWN;
  if (!(this.dor & DOR_NRESET)) {
    dbg_log("FIFO write " + h(fifo_byte) + " rejected: floppy controller in RESET mode!", LOG_FLOPPY);
    return;
  } else if (!(this.msr & MSR_RQM) || this.msr & MSR_DIO) {
    dbg_log("FIFO write " + h(fifo_byte) + " rejected: controller not ready for writing", LOG_FLOPPY);
    return;
  } else if (this.cmd_phase !== CMD_PHASE_COMMAND) {
    dbg_log("FIFO write " + h(fifo_byte) + " rejected: floppy controller not in COMMAND phase, phase: " + this.cmd_phase, LOG_FLOPPY);
    return;
  }
  if (this.cmd_remaining === 0) {
    const cmd_desc = this.cmd_table[fifo_byte];
    this.cmd_code = fifo_byte;
    this.cmd_remaining = cmd_desc.argc;
    this.cmd_cursor = 0;
    this.cmd_flags = 0;
    if ((cmd_desc.code === CMD_READ || cmd_desc.code === CMD_WRITE) && this.cmd_code & 128) {
      this.cmd_flags |= CMD_FLAG_MULTI_TRACK;
    }
    if (this.cmd_remaining) {
      this.msr |= MSR_RQM;
    }
    this.msr |= MSR_CMDBUSY;
  } else {
    this.cmd_buffer[this.cmd_cursor++] = fifo_byte;
    this.cmd_remaining--;
  }
  if (this.cmd_remaining === 0) {
    this.cmd_phase = CMD_PHASE_EXECUTION;
    const cmd_desc = this.cmd_table[this.cmd_code];
    const args = this.cmd_buffer.slice(0, this.cmd_cursor);
    if (false) {
      const args_hex = [];
      for (const arg of args) {
        args_hex.push(h(arg, 2));
      }
      dbg_log("FD command " + h(this.cmd_code) + ": " + cmd_desc.name + "(" + args_hex.join(", ") + ")", LOG_FLOPPY);
    }
    cmd_desc.handler.call(this, args);
  }
};
FloppyController.prototype.write_reg_ccr = function(ccr_byte) {
  if (!(this.dor & DOR_NRESET)) {
    dbg_log("CCR write: " + h(ccr_byte) + " rejected: Floppy controller in RESET mode!", LOG_FLOPPY);
    return;
  }
  dbg_log("CCR write: " + h(ccr_byte), LOG_FLOPPY);
  this.dsr = this.dsr & ~DSR_DRATEMASK | ccr_byte & DSR_DRATEMASK;
};
FloppyController.prototype.exec_unimplemented = function(args) {
  dbg_assert(false, "Unimplemented floppy command code " + h(this.cmd_code) + "!");
  this.status0 = SR0_INVCMD;
  this.response_data[0] = this.status0;
  this.enter_result_phase(1);
};
FloppyController.prototype.exec_read = function(args) {
  this.start_read_write(args, false);
};
FloppyController.prototype.exec_write = function(args) {
  this.start_read_write(args, true);
};
FloppyController.prototype.exec_seek = function(args) {
  const curr_drive = this.set_curr_drive_no(args[0] & DOR_SELMASK);
  const track = args[1];
  this.enter_command_phase();
  curr_drive.seek(curr_drive.curr_head, track, curr_drive.curr_sect);
  this.status0 |= SR0_SEEK;
  this.raise_irq("SEEK command");
};
FloppyController.prototype.exec_sense_interrupt_status = function(args) {
  const curr_drive = this.drives[this.curr_drive_no];
  let status0;
  if (this.reset_sense_int_count > 0) {
    const drv_nr = RESET_SENSE_INT_MAX - this.reset_sense_int_count--;
    status0 = SR0_RDYCHG | drv_nr;
  } else if (this.sra & SRA_INTPEND) {
    status0 = this.status0 & ~(SR0_HEAD | SR0_DS1 | SR0_DS0) | this.curr_drive_no;
  } else {
    dbg_log("No interrupt pending, aborting SENSE INTERRUPT command!", LOG_FLOPPY);
    this.response_data[0] = SR0_INVCMD;
    this.enter_result_phase(1);
    return;
  }
  this.response_data[0] = status0;
  this.response_data[1] = curr_drive.curr_track;
  this.enter_result_phase(2);
  this.lower_irq("SENSE INTERRUPT command");
  this.status0 = SR0_RDYCHG;
};
FloppyController.prototype.exec_recalibrate = function(args) {
  const curr_drive = this.set_curr_drive_no(args[0] & DOR_SELMASK);
  curr_drive.seek(0, 0, 1);
  this.enter_command_phase();
  this.status0 |= SR0_SEEK;
  this.raise_irq("RECALIBRATE command");
};
FloppyController.prototype.exec_format_track = function(args) {
  const curr_drive = this.set_curr_drive_no(args[0] & DOR_SELMASK);
  let status0 = 0, status1 = 0;
  if (curr_drive.read_only) {
    status0 = SR0_ABNTERM | SR0_SEEK;
    status1 = SR1_NW;
  }
  this.end_read_write(status0, status1, 0);
};
FloppyController.prototype.exec_read_id = function(args) {
  const head_sel = args[0];
  const curr_drive = this.drives[this.curr_drive_no];
  curr_drive.curr_head = head_sel >> 2 & 1;
  if (curr_drive.max_sect !== 0) {
    curr_drive.curr_sect = curr_drive.curr_sect % curr_drive.max_sect + 1;
  }
  this.end_read_write(0, 0, 0);
};
FloppyController.prototype.exec_specify = function(args) {
  const hut_srt = args[0];
  const nd_hlt = args[1];
  this.step_rate_interval = hut_srt >> 4;
  this.head_load_time = nd_hlt >> 1;
  if (nd_hlt & 1) {
    this.dor &= ~DOR_DMAEN;
  } else {
    this.dor |= DOR_DMAEN;
  }
  this.enter_command_phase();
};
FloppyController.prototype.exec_sense_drive_status = function(args) {
  const drv_sel = args[0];
  const curr_drive = this.set_curr_drive_no(drv_sel & DOR_SELMASK);
  curr_drive.curr_head = drv_sel >> 2 & 1;
  this.response_data[0] = (curr_drive.read_only ? 64 : 0) | // response byte is Status Register 3
  (curr_drive.curr_track === 0 ? 16 : 0) | curr_drive.curr_head << 2 | this.curr_drive_no | 40;
  this.enter_result_phase(1);
};
FloppyController.prototype.exec_perpendicular_mode = function(args) {
  const perp_mode = args[0];
  if (perp_mode & 128) {
    const curr_drive = this.drives[this.curr_drive_no];
    curr_drive.perpendicular = perp_mode & 7;
  }
  this.enter_command_phase();
};
FloppyController.prototype.exec_configure = function(args) {
  this.fdc_config = args[1];
  this.precomp_trk = args[2];
  this.enter_command_phase();
};
FloppyController.prototype.exec_lock = function(args) {
  if (this.cmd_code & 128) {
    this.locked = true;
    this.response_data[0] = 16;
  } else {
    this.locked = false;
    this.response_data[0] = 0;
  }
  this.enter_result_phase(1);
};
FloppyController.prototype.exec_dump_regs = function(args) {
  const curr_drive = this.drives[this.curr_drive_no];
  this.response_data[0] = this.drives[0].curr_track;
  this.response_data[1] = this.drives[1].curr_track;
  this.response_data[2] = 0;
  this.response_data[3] = 0;
  this.response_data[4] = this.step_rate_interval;
  this.response_data[5] = this.head_load_time << 1 | (this.dor & DOR_DMAEN ? 1 : 0);
  this.response_data[6] = curr_drive.max_sect;
  this.response_data[7] = (this.locked ? 128 : 0) | curr_drive.perpendicular << 2;
  this.response_data[8] = this.fdc_config;
  this.response_data[9] = this.precomp_trk;
  this.enter_result_phase(10);
};
FloppyController.prototype.exec_version = function(args) {
  this.response_data[0] = 144;
  this.enter_result_phase(1);
};
FloppyController.prototype.exec_part_id = function(args) {
  this.response_data[0] = 65;
  this.enter_result_phase(1);
};
FloppyController.prototype.start_read_write = function(args, do_write) {
  const curr_drive = this.set_curr_drive_no(args[0] & DOR_SELMASK);
  const track = args[1];
  const head = args[2];
  const sect = args[3];
  const ssc = args[4];
  const eot = args[5];
  const dtl = args[7] < 128 ? args[7] : 128;
  switch (curr_drive.seek(head, track, sect)) {
    case 2:
      this.end_read_write(SR0_ABNTERM, 0, 0);
      this.response_data[3] = track;
      this.response_data[4] = head;
      this.response_data[5] = sect;
      return;
    case 3:
      this.end_read_write(SR0_ABNTERM, SR1_EC, 0);
      this.response_data[3] = track;
      this.response_data[4] = head;
      this.response_data[5] = sect;
      return;
    case 1:
      this.status0 |= SR0_SEEK;
      break;
  }
  const sect_size = 128 << (ssc > 7 ? 7 : ssc);
  const sect_start = curr_drive.chs2lba(track, head, sect);
  const data_offset = sect_start * sect_size;
  let data_length;
  if (sect_size === 128) {
    if (do_write && dtl < 128) {
      dbg_assert(false, "dtl=" + dtl + " is less than 128, zero-padding is still unimplemented!");
    }
    data_length = dtl;
  } else {
    if (this.cmd_flags & CMD_FLAG_MULTI_TRACK) {
      data_length = (2 * eot - sect + 1) * sect_size;
    } else {
      data_length = (eot - sect + 1) * sect_size;
    }
    if (data_length <= 0) {
      dbg_log("invalid data_length: " + data_length + " sect=" + sect + " eot=" + eot, LOG_FLOPPY);
      this.end_read_write(SR0_ABNTERM, SR1_MA, 0);
      this.response_data[3] = track;
      this.response_data[4] = head;
      this.response_data[5] = sect;
      return;
    }
  }
  this.eot = eot;
  if (false) {
    dbg_log(
      "Floppy " + this.cmd_table[this.cmd_code].name + " from: " + h(data_offset) + ", length: " + h(data_length) + ", C/H/S: " + track + "/" + head + "/" + sect + ", ro: " + curr_drive.read_only + ", #S: " + curr_drive.max_sect + ", #H: " + curr_drive.max_head,
      LOG_FLOPPY
    );
  }
  if (do_write && curr_drive.read_only) {
    this.end_read_write(SR0_ABNTERM | SR0_SEEK, SR1_NW, 0);
    this.response_data[3] = track;
    this.response_data[4] = head;
    this.response_data[5] = sect;
    return;
  }
  if (this.dor & DOR_DMAEN) {
    this.msr &= ~MSR_RQM;
    const do_dma = do_write ? this.dma.do_write : this.dma.do_read;
    do_dma.call(
      this.dma,
      curr_drive.buffer,
      data_offset,
      data_length,
      FDC_DMA_CHANNEL,
      (dma_error) => {
        if (dma_error) {
          dbg_log("DMA floppy error", LOG_FLOPPY);
          this.end_read_write(SR0_ABNTERM, 0, 0);
        } else {
          this.seek_next_sect();
          this.end_read_write(0, 0, 0);
        }
      }
    );
  } else {
    dbg_assert(false, this.cmd_table[this.cmd_code].name + " in PIO mode not supported!");
  }
};
FloppyController.prototype.end_read_write = function(status0, status1, status2) {
  const curr_drive = this.drives[this.curr_drive_no];
  this.status0 &= ~(SR0_DS0 | SR0_DS1 | SR0_HEAD);
  this.status0 |= this.curr_drive_no;
  if (curr_drive.curr_head) {
    this.status0 |= SR0_HEAD;
  }
  this.status0 |= status0;
  this.msr |= MSR_RQM | MSR_DIO;
  this.msr &= ~MSR_NDMA;
  this.response_data[0] = this.status0;
  this.response_data[1] = status1;
  this.response_data[2] = status2;
  this.response_data[3] = curr_drive.curr_track;
  this.response_data[4] = curr_drive.curr_head;
  this.response_data[5] = curr_drive.curr_sect;
  this.response_data[6] = SECTOR_SIZE_CODE;
  this.enter_result_phase(7);
  this.raise_irq(this.cmd_table[this.cmd_code].name + " command");
};
FloppyController.prototype.seek_next_sect = function() {
  const curr_drive = this.drives[this.curr_drive_no];
  let new_track = curr_drive.curr_track;
  let new_head = curr_drive.curr_head;
  let new_sect = curr_drive.curr_sect;
  let ret = 1;
  if (new_sect >= curr_drive.max_sect || new_sect === this.eot) {
    new_sect = 1;
    if (this.cmd_flags & CMD_FLAG_MULTI_TRACK) {
      if (new_head === 0 && curr_drive.max_head === 2) {
        new_head = 1;
      } else {
        new_head = 0;
        new_track++;
        this.status0 |= SR0_SEEK;
        if (curr_drive.max_head === 1) {
          ret = 0;
        }
      }
    } else {
      this.status0 |= SR0_SEEK;
      new_track++;
      ret = 0;
    }
  } else {
    new_sect++;
  }
  curr_drive.seek(new_head, new_track, new_sect);
  return ret;
};
FloppyController.prototype.get_state = function() {
  const state = [];
  state[19] = this.sra;
  state[20] = this.srb;
  state[21] = this.dor;
  state[22] = this.tdr;
  state[23] = this.msr;
  state[24] = this.dsr;
  state[25] = this.cmd_phase;
  state[26] = this.cmd_code;
  state[27] = this.cmd_flags;
  state[28] = this.cmd_buffer;
  state[29] = this.cmd_cursor;
  state[30] = this.cmd_remaining;
  state[31] = this.response_data;
  state[32] = this.response_cursor;
  state[33] = this.response_length;
  state[34] = this.status0;
  state[35] = this.status1;
  state[36] = this.curr_drive_no;
  state[37] = this.reset_sense_int_count;
  state[38] = this.locked;
  state[39] = this.step_rate_interval;
  state[40] = this.head_load_time;
  state[41] = this.fdc_config;
  state[42] = this.precomp_trk;
  state[43] = this.eot;
  state[44] = this.drives[0].get_state();
  state[45] = this.drives[1].get_state();
  return state;
};
FloppyController.prototype.set_state = function(state) {
  if (typeof state[19] === "undefined") {
    return;
  }
  this.sra = state[19];
  this.srb = state[20];
  this.dor = state[21];
  this.tdr = state[22];
  this.msr = state[23];
  this.dsr = state[24];
  this.cmd_phase = state[25];
  this.cmd_code = state[26];
  this.cmd_flags = state[27];
  this.cmd_buffer.set(state[28]);
  this.cmd_cursor = state[29];
  this.cmd_remaining = state[30];
  this.response_data.set(state[31]);
  this.response_cursor = state[32];
  this.response_length = state[33];
  this.status0 = state[34];
  this.status1 = state[35];
  this.curr_drive_no = state[36];
  this.reset_sense_int_count = state[37];
  this.locked = state[38];
  this.step_rate_interval = state[39];
  this.head_load_time = state[40];
  this.fdc_config = state[41];
  this.precomp_trk = state[42];
  this.eot = state[43];
  this.drives[0].set_state(state[44]);
  this.drives[1].set_state(state[45]);
};
var DISK_FORMATS = [
  //                                                                 ttl_sect     size     collides
  // 1.44 MB 3"1/2 floppy disks                                             |     |        |
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 18, tracks: 80, heads: 2 },
  // 2880  1.44 MB  3.5"
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 20, tracks: 80, heads: 2 },
  // 3200  1.6 MB   3.5"
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 21, tracks: 80, heads: 2 },
  // 3360  1.68 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 21, tracks: 82, heads: 2 },
  // 3444  1.72 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 21, tracks: 83, heads: 2 },
  // 3486  1.74 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 22, tracks: 80, heads: 2 },
  // 3520  1.76 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 23, tracks: 80, heads: 2 },
  // 3680  1.84 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 24, tracks: 80, heads: 2 },
  // 3840  1.92 MB
  // 2.88 MB 3"1/2 floppy disks
  { drive_type: CMOS_FDD_TYPE_2880, sectors: 36, tracks: 80, heads: 2 },
  // 5760  2.88 MB
  { drive_type: CMOS_FDD_TYPE_2880, sectors: 39, tracks: 80, heads: 2 },
  // 6240  3.12 MB
  { drive_type: CMOS_FDD_TYPE_2880, sectors: 40, tracks: 80, heads: 2 },
  // 6400  3.2 MB
  { drive_type: CMOS_FDD_TYPE_2880, sectors: 44, tracks: 80, heads: 2 },
  // 7040  3.52 MB
  { drive_type: CMOS_FDD_TYPE_2880, sectors: 48, tracks: 80, heads: 2 },
  // 7680  3.84 MB
  // 720 kB 3"1/2 floppy disks
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 8, tracks: 80, heads: 2 },
  // 1280  640 kB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 9, tracks: 80, heads: 2 },
  // 1440  720 kB   3.5"
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 10, tracks: 80, heads: 2 },
  // 1600  800 kB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 10, tracks: 82, heads: 2 },
  // 1640  820 kB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 10, tracks: 83, heads: 2 },
  // 1660  830 kB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 13, tracks: 80, heads: 2 },
  // 2080  1.04 MB
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 14, tracks: 80, heads: 2 },
  // 2240  1.12 MB
  // 1.2 MB 5"1/4 floppy disks
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 15, tracks: 80, heads: 2 },
  // 2400  1.2 MB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 18, tracks: 80, heads: 2 },
  // 2880  1.44 MB  5.25"
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 18, tracks: 82, heads: 2 },
  // 2952  1.48 MB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 18, tracks: 83, heads: 2 },
  // 2988  1.49 MB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 20, tracks: 80, heads: 2 },
  // 3200  1.6 MB   5.25"
  // 720 kB 5"1/4 floppy disks
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 9, tracks: 80, heads: 2 },
  // 1440  720 kB   5.25"
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 11, tracks: 80, heads: 2 },
  // 1760  880 kB
  // 360 kB 5"1/4 floppy disks
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 9, tracks: 40, heads: 2 },
  // 720   360 kB   5.25"
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 9, tracks: 40, heads: 1 },
  // 360   180 kB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 10, tracks: 41, heads: 2 },
  // 820   410 kB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 10, tracks: 42, heads: 2 },
  // 840   420 kB
  // 320 kB 5"1/4 floppy disks
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 8, tracks: 40, heads: 2 },
  // 640   320 kB
  { drive_type: CMOS_FDD_TYPE_1200, sectors: 8, tracks: 40, heads: 1 },
  // 320   160 kB
  // 360 kB must match 5"1/4 better than 3"1/2...
  { drive_type: CMOS_FDD_TYPE_1440, sectors: 9, tracks: 80, heads: 1 },
  // 720   360 kB   3.5"
  // types defined in earlier v86 releases (not defined in qemu)
  { drive_type: CMOS_FDD_TYPE_360, sectors: 10, tracks: 40, heads: 1 },
  // 400   200 kB
  { drive_type: CMOS_FDD_TYPE_360, sectors: 10, tracks: 40, heads: 2 }
  // 800   400 kB
];
function FloppyDrive(name, fdd_config, buffer, fallback_drive_type) {
  this.name = name;
  this.drive_type = CMOS_FDD_TYPE_NO_DRIVE;
  this.max_track = 0;
  this.max_head = 0;
  this.max_sect = 0;
  this.curr_track = 0;
  this.curr_head = 0;
  this.curr_sect = 1;
  this.perpendicular = 0;
  this.read_only = false;
  this.media_changed = true;
  this.buffer = null;
  Object.seal(this);
  const cfg_drive_type = fdd_config?.drive_type;
  if (cfg_drive_type !== void 0 && cfg_drive_type >= 0 && cfg_drive_type <= 5) {
    this.drive_type = cfg_drive_type;
  }
  this.insert_disk(buffer, !!fdd_config?.read_only);
  if (this.drive_type === CMOS_FDD_TYPE_NO_DRIVE && cfg_drive_type === void 0) {
    this.drive_type = fallback_drive_type;
  }
  dbg_log("floppy drive " + this.name + " ready, drive type: " + this.drive_type, LOG_FLOPPY);
}
FloppyDrive.prototype.insert_disk = function(buffer, read_only) {
  if (!buffer) {
    return false;
  }
  if (buffer instanceof Uint8Array) {
    buffer = new SyncBuffer(buffer.buffer);
  }
  const [new_buffer, disk_format] = this.find_disk_format(buffer, this.drive_type);
  if (!new_buffer) {
    dbg_log("WARNING: disk rejected, no suitable disk format found for image of size " + buffer.byteLength + " bytes", LOG_FLOPPY);
    return false;
  }
  this.max_track = disk_format.tracks;
  this.max_head = disk_format.heads;
  this.max_sect = disk_format.sectors;
  this.read_only = !!read_only;
  this.media_changed = true;
  this.buffer = new_buffer;
  if (this.drive_type === CMOS_FDD_TYPE_NO_DRIVE) {
    this.drive_type = disk_format.drive_type;
  }
  if (false) {
    dbg_log(
      "disk inserted into " + this.name + ": type: " + disk_format.drive_type + ", C/H/S: " + disk_format.tracks + "/" + disk_format.heads + "/" + disk_format.sectors + ", size: " + new_buffer.byteLength,
      LOG_FLOPPY
    );
  }
  return true;
};
FloppyDrive.prototype.eject_disk = function() {
  this.max_track = 0;
  this.max_head = 0;
  this.max_sect = 0;
  this.media_changed = true;
  this.buffer = null;
};
FloppyDrive.prototype.get_buffer = function() {
  return this.buffer ? new Uint8Array(this.buffer.buffer) : null;
};
FloppyDrive.prototype.chs2lba = function(track, head, sect) {
  return (track * this.max_head + head) * this.max_sect + sect - 1;
};
FloppyDrive.prototype.find_disk_format = function(buffer, drive_type) {
  const autodetect = drive_type === CMOS_FDD_TYPE_NO_DRIVE;
  const buffer_size = buffer.byteLength;
  let preferred_match = -1, medium_match = -1, size_match = -1, nearest_match = -1, nearest_size = -1;
  for (let i = 0; i < DISK_FORMATS.length; i++) {
    const disk_format = DISK_FORMATS[i];
    const disk_size = disk_format.sectors * disk_format.tracks * disk_format.heads * SECTOR_SIZE;
    if (buffer_size === disk_size) {
      if (autodetect || disk_format.drive_type === drive_type) {
        preferred_match = i;
        break;
      } else if (!autodetect && CMOS_FDD_TYPE_MEDIUM[disk_format.drive_type] === CMOS_FDD_TYPE_MEDIUM[drive_type]) {
        medium_match = medium_match === -1 ? i : medium_match;
      } else {
        size_match = size_match === -1 ? i : size_match;
      }
    } else if (buffer_size < disk_size) {
      if (nearest_size === -1 || disk_size < nearest_size) {
        nearest_match = i;
        nearest_size = disk_size;
      }
    }
  }
  if (preferred_match !== -1) {
    return [buffer, DISK_FORMATS[preferred_match]];
  } else if (medium_match !== -1) {
    return [buffer, DISK_FORMATS[medium_match]];
  } else if (size_match !== -1) {
    return [buffer, DISK_FORMATS[size_match]];
  } else if (nearest_match !== -1) {
    const tmp_buffer = new Uint8Array(nearest_size);
    tmp_buffer.set(new Uint8Array(buffer.buffer));
    return [new SyncBuffer(tmp_buffer.buffer), DISK_FORMATS[nearest_match]];
  } else {
    return [null, null];
  }
};
FloppyDrive.prototype.seek = function(head, track, sect) {
  if (track > this.max_track || head !== 0 && this.max_head === 1) {
    dbg_log("WARNING: attempt to seek to invalid track: head: " + head + ", track: " + track + ", sect: " + sect, LOG_FLOPPY);
    return 2;
  }
  if (sect > this.max_sect) {
    dbg_log("WARNING: attempt to seek beyond last sector: " + sect + " (max: " + this.max_sect + ")", LOG_FLOPPY);
    return 3;
  }
  let result = 0;
  const curr_lba = this.chs2lba(this.curr_track, this.curr_head, this.curr_sect);
  const new_lba = this.chs2lba(track, head, sect);
  if (curr_lba !== new_lba) {
    if (this.curr_track !== track) {
      if (this.buffer) {
        this.media_changed = false;
      }
      result = 1;
    }
    this.curr_head = head;
    this.curr_track = track;
    this.curr_sect = sect;
  }
  if (!this.buffer) {
    result = 2;
  }
  return result;
};
FloppyDrive.prototype.get_state = function() {
  const state = [];
  state[0] = this.drive_type;
  state[1] = this.max_track;
  state[2] = this.max_head;
  state[3] = this.max_sect;
  state[4] = this.curr_track;
  state[5] = this.curr_head;
  state[6] = this.curr_sect;
  state[7] = this.perpendicular;
  state[8] = this.read_only;
  state[9] = this.media_changed;
  state[10] = this.buffer ? this.buffer.get_state() : null;
  return state;
};
FloppyDrive.prototype.set_state = function(state) {
  this.drive_type = state[0];
  this.max_track = state[1];
  this.max_head = state[2];
  this.max_sect = state[3];
  this.curr_track = state[4];
  this.curr_head = state[5];
  this.curr_sect = state[6];
  this.perpendicular = state[7];
  this.read_only = state[8];
  this.media_changed = state[9];
  if (state[10]) {
    if (!this.buffer) {
      this.buffer = new SyncBuffer(new ArrayBuffer(0));
    }
    this.buffer.set_state(state[10]);
  } else {
    this.buffer = null;
  }
};

// src/ide.js
var CDROM_SECTOR_SIZE = 2048;
var HD_SECTOR_SIZE = 512;
var BUS_MASTER_BASE = 46080;
var ATA_REG_ERROR = 1;
var ATA_REG_STATUS = 7;
var ATA_REG_ALT_STATUS = 0;
var ATA_REG_DATA = 0;
var ATA_REG_SECTOR = 2;
var ATA_REG_LBA_LOW = 3;
var ATA_REG_LBA_MID = 4;
var ATA_REG_LBA_HIGH = 5;
var ATA_REG_DEVICE = 6;
var ATA_REG_FEATURES = 1;
var ATA_REG_COMMAND = 7;
var ATA_REG_CONTROL = 0;
var BMI_REG_COMMAND = 0;
var BMI_REG_STATUS = 2;
var BMI_REG_PRDT = 4;
var ATA_ER_ABRT = 4;
var ATA_SR_ERR = 1;
var ATA_SR_COND = 1;
var ATA_SR_DRQ = 8;
var ATA_SR_DSC = 16;
var ATA_SR_DF = 32;
var ATA_SR_DRDY = 64;
var ATA_SR_BSY = 128;
var ATA_DR_DEV = 16;
var ATA_CR_NIEN = 2;
var ATA_CR_SRST = 4;
var ATA_CMD_DEVICE_RESET = 8;
var ATA_CMD_EXECUTE_DEVICE_DIAGNOSTIC = 144;
var ATA_CMD_FLUSH_CACHE = 231;
var ATA_CMD_FLUSH_CACHE_EXT = 234;
var ATA_CMD_GET_MEDIA_STATUS = 218;
var ATA_CMD_IDENTIFY_DEVICE = 236;
var ATA_CMD_IDENTIFY_PACKET_DEVICE = 161;
var ATA_CMD_IDLE_IMMEDIATE = 225;
var ATA_CMD_INITIALIZE_DEVICE_PARAMETERS = 145;
var ATA_CMD_MEDIA_LOCK = 222;
var ATA_CMD_NOP = 0;
var ATA_CMD_PACKET = 160;
var ATA_CMD_READ_DMA = 200;
var ATA_CMD_READ_DMA_EXT = 37;
var ATA_CMD_READ_MULTIPLE = 41;
var ATA_CMD_READ_MULTIPLE_EXT = 196;
var ATA_CMD_READ_NATIVE_MAX_ADDRESS = 248;
var ATA_CMD_READ_NATIVE_MAX_ADDRESS_EXT = 39;
var ATA_CMD_READ_SECTORS = 32;
var ATA_CMD_READ_SECTORS_EXT = 36;
var ATA_CMD_READ_VERIFY_SECTORS = 64;
var ATA_CMD_SECURITY_FREEZE_LOCK = 245;
var ATA_CMD_SET_FEATURES = 239;
var ATA_CMD_SET_MAX = 249;
var ATA_CMD_SET_MULTIPLE_MODE = 198;
var ATA_CMD_STANDBY_IMMEDIATE = 224;
var ATA_CMD_WRITE_DMA = 202;
var ATA_CMD_WRITE_DMA_EXT = 53;
var ATA_CMD_WRITE_MULTIPLE = 57;
var ATA_CMD_WRITE_MULTIPLE_EXT = 197;
var ATA_CMD_WRITE_SECTORS = 48;
var ATA_CMD_WRITE_SECTORS_EXT = 52;
var ATA_CMD_10h = 16;
var ATA_CMD_F0h = 240;
var ATA_CMD_NAME = {
  [ATA_CMD_DEVICE_RESET]: "DEVICE RESET",
  [ATA_CMD_EXECUTE_DEVICE_DIAGNOSTIC]: "EXECUTE DEVICE DIAGNOSTIC",
  [ATA_CMD_FLUSH_CACHE]: "FLUSH CACHE",
  [ATA_CMD_FLUSH_CACHE_EXT]: "FLUSH CACHE EXT",
  [ATA_CMD_GET_MEDIA_STATUS]: "GET MEDIA STATUS",
  [ATA_CMD_IDENTIFY_DEVICE]: "IDENTIFY DEVICE",
  [ATA_CMD_IDENTIFY_PACKET_DEVICE]: "IDENTIFY PACKET DEVICE",
  [ATA_CMD_IDLE_IMMEDIATE]: "IDLE IMMEDIATE",
  [ATA_CMD_INITIALIZE_DEVICE_PARAMETERS]: "INITIALIZE DEVICE PARAMETERS",
  [ATA_CMD_MEDIA_LOCK]: "MEDIA LOCK",
  [ATA_CMD_NOP]: "NOP",
  [ATA_CMD_PACKET]: "PACKET",
  [ATA_CMD_READ_DMA]: "READ DMA",
  [ATA_CMD_READ_DMA_EXT]: "READ DMA EXT",
  [ATA_CMD_READ_MULTIPLE]: "READ MULTIPLE",
  [ATA_CMD_READ_MULTIPLE_EXT]: "READ MULTIPLE EXT",
  [ATA_CMD_READ_NATIVE_MAX_ADDRESS]: "READ NATIVE MAX ADDRESS",
  [ATA_CMD_READ_NATIVE_MAX_ADDRESS_EXT]: "READ NATIVE MAX ADDRESS EXT",
  [ATA_CMD_READ_SECTORS]: "READ SECTORS",
  [ATA_CMD_READ_SECTORS_EXT]: "READ SECTORS EXT",
  [ATA_CMD_READ_VERIFY_SECTORS]: "READ VERIFY SECTORS",
  [ATA_CMD_SECURITY_FREEZE_LOCK]: "SECURITY FREEZE LOCK",
  [ATA_CMD_SET_FEATURES]: "SET FEATURES",
  [ATA_CMD_SET_MAX]: "SET MAX",
  [ATA_CMD_SET_MULTIPLE_MODE]: "SET MULTIPLE MODE",
  [ATA_CMD_STANDBY_IMMEDIATE]: "STANDBY IMMEDIATE",
  [ATA_CMD_WRITE_DMA]: "WRITE DMA",
  [ATA_CMD_WRITE_DMA_EXT]: "WRITE DMA EXT",
  [ATA_CMD_WRITE_MULTIPLE]: "WRITE MULTIPLE",
  [ATA_CMD_WRITE_MULTIPLE_EXT]: "WRITE MULTIPLE EXT",
  [ATA_CMD_WRITE_SECTORS]: "WRITE SECTORS",
  [ATA_CMD_WRITE_SECTORS_EXT]: "WRITE SECTORS EXT",
  [ATA_CMD_10h]: "<UNKNOWN 10h>",
  [ATA_CMD_F0h]: "<VENDOR-SPECIFIC F0h>"
};
var ATAPI_CMD_GET_CONFIGURATION = 70;
var ATAPI_CMD_GET_EVENT_STATUS_NOTIFICATION = 74;
var ATAPI_CMD_INQUIRY = 18;
var ATAPI_CMD_MECHANISM_STATUS = 189;
var ATAPI_CMD_MODE_SENSE_6 = 26;
var ATAPI_CMD_MODE_SENSE_10 = 90;
var ATAPI_CMD_PAUSE = 69;
var ATAPI_CMD_PREVENT_ALLOW_MEDIUM_REMOVAL = 30;
var ATAPI_CMD_READ_10 = 40;
var ATAPI_CMD_READ_12 = 168;
var ATAPI_CMD_READ_CAPACITY = 37;
var ATAPI_CMD_READ_CD = 190;
var ATAPI_CMD_READ_DISK_INFORMATION = 81;
var ATAPI_CMD_READ_SUBCHANNEL = 66;
var ATAPI_CMD_READ_TOC_PMA_ATIP = 67;
var ATAPI_CMD_READ_TRACK_INFORMATION = 82;
var ATAPI_CMD_REQUEST_SENSE = 3;
var ATAPI_CMD_START_STOP_UNIT = 27;
var ATAPI_CMD_TEST_UNIT_READY = 0;
var ATAPI_CF_NONE = 0;
var ATAPI_CF_NEEDS_DISK = 1;
var ATAPI_CMD = {
  [ATAPI_CMD_GET_CONFIGURATION]: { name: "GET CONFIGURATION", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_GET_EVENT_STATUS_NOTIFICATION]: { name: "GET EVENT STATUS NOTIFICATION", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_INQUIRY]: { name: "INQUIRY", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_MECHANISM_STATUS]: { name: "MECHANISM STATUS", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_MODE_SENSE_6]: { name: "MODE SENSE (6)", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_MODE_SENSE_10]: { name: "MODE SENSE (10)", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_PAUSE]: { name: "PAUSE", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_PREVENT_ALLOW_MEDIUM_REMOVAL]: { name: "PREVENT ALLOW MEDIUM REMOVAL", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_READ_10]: { name: "READ (10)", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_12]: { name: "READ (12)", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_CAPACITY]: { name: "READ CAPACITY", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_CD]: { name: "READ CD", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_DISK_INFORMATION]: { name: "READ DISK INFORMATION", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_SUBCHANNEL]: { name: "READ SUBCHANNEL", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_TOC_PMA_ATIP]: { name: "READ TOC PMA ATIP", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_READ_TRACK_INFORMATION]: { name: "READ TRACK INFORMATION", flags: ATAPI_CF_NEEDS_DISK },
  [ATAPI_CMD_REQUEST_SENSE]: { name: "REQUEST SENSE", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_START_STOP_UNIT]: { name: "START STOP UNIT", flags: ATAPI_CF_NONE },
  [ATAPI_CMD_TEST_UNIT_READY]: { name: "TEST UNIT READY", flags: ATAPI_CF_NEEDS_DISK }
};
var ATAPI_SIGNATURE_LO = 20;
var ATAPI_SIGNATURE_HI = 235;
var ATAPI_SK_NOT_READY = 2;
var ATAPI_SK_ILLEGAL_REQUEST = 5;
var ATAPI_SK_UNIT_ATTENTION = 6;
var ATAPI_ASC_INV_FIELD_IN_CMD_PACKET = 36;
var ATAPI_ASC_MEDIUM_NOT_PRESENT = 58;
var LOG_DETAIL_REG_IO = 1;
var LOG_DETAIL_IRQ = 2;
var LOG_DETAIL_RW = 4;
var LOG_DETAIL_RW_DMA = 8;
var LOG_DETAIL_CHS = 16;
var LOG_DETAILS = false ? LOG_DETAIL_NONE : 0;
function IDEController(cpu, bus, ide_config) {
  this.cpu = cpu;
  this.bus = bus;
  this.primary = void 0;
  this.secondary = void 0;
  const has_primary = ide_config && ide_config[0][0];
  const has_secondary = ide_config && ide_config[1][0];
  if (has_primary || has_secondary) {
    if (has_primary) {
      this.primary = new IDEChannel(this, 0, ide_config[0], 496, 1014, 14);
    }
    if (has_secondary) {
      this.secondary = new IDEChannel(this, 1, ide_config[1], 368, 886, 15);
    }
    const vendor_id = 32902;
    const device_id = 28688;
    const class_code = 1;
    const subclass = 1;
    const prog_if = 128;
    const interrupt_line = 0;
    const command_base0 = has_primary ? this.primary.command_base : 0;
    const control_base0 = has_primary ? this.primary.control_base : 0;
    const command_base1 = has_secondary ? this.secondary.command_base : 0;
    const control_base1 = has_secondary ? this.secondary.control_base : 0;
    this.name = "ide";
    this.pci_id = 30 << 3;
    this.pci_space = [
      vendor_id & 255,
      vendor_id >> 8,
      device_id & 255,
      device_id >> 8,
      5,
      0,
      160,
      2,
      0,
      prog_if,
      subclass,
      class_code,
      0,
      0,
      0,
      0,
      command_base0 & 255 | 1,
      command_base0 >> 8,
      0,
      0,
      control_base0 & 255 | 1,
      control_base0 >> 8,
      0,
      0,
      command_base1 & 255 | 1,
      command_base1 >> 8,
      0,
      0,
      control_base1 & 255 | 1,
      control_base1 >> 8,
      0,
      0,
      BUS_MASTER_BASE & 255 | 1,
      BUS_MASTER_BASE >> 8,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      67,
      16,
      212,
      130,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      interrupt_line,
      1,
      0,
      0,
      // 0x40
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0x80
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    ];
    this.pci_bars = [
      has_primary ? { size: 8 } : void 0,
      // BAR0: Command block register address of primary channel
      has_primary ? { size: 1 } : void 0,
      // BAR1: Control block register address of primary channel
      has_secondary ? { size: 8 } : void 0,
      // BAR2: Command block register address of secondary channel
      has_secondary ? { size: 1 } : void 0,
      // BAR3: Control block register address of secondary channel
      { size: 16 }
      // BAR4: Bus Master I/O register address of both channels (8+8)
    ];
    cpu.devices.pci.register_device(this);
  }
  Object.seal(this);
}
IDEController.prototype.get_state = function() {
  const state = [];
  state[0] = this.primary;
  state[1] = this.secondary;
  return state;
};
IDEController.prototype.set_state = function(state) {
  this.primary && this.primary.set_state(state[0]);
  this.secondary && this.secondary.set_state(state[1]);
};
function IDEChannel(controller, channel_nr, channel_config, command_base, control_base, irq) {
  this.controller = controller;
  this.channel_nr = channel_nr;
  this.cpu = controller.cpu;
  this.bus = controller.bus;
  this.command_base = command_base;
  this.control_base = control_base;
  this.irq = irq;
  this.name = "ide" + channel_nr;
  const master_cfg = channel_config ? channel_config[0] : void 0;
  const slave_cfg = channel_config ? channel_config[1] : void 0;
  this.master = new IDEInterface(this, 0, master_cfg?.buffer, master_cfg?.is_cdrom);
  this.slave = new IDEInterface(this, 1, slave_cfg?.buffer, slave_cfg?.is_cdrom);
  this.current_interface = this.master;
  this.device_control_reg = ATA_CR_NIEN;
  this.prdt_addr = 0;
  this.dma_status = 0;
  this.dma_command = 0;
  const cpu = controller.cpu;
  cpu.io.register_read(this.command_base | ATA_REG_DATA, this, function() {
    return this.current_interface.read_data(1);
  }, function() {
    return this.current_interface.read_data(2);
  }, function() {
    return this.current_interface.read_data(4);
  });
  cpu.io.register_read(this.command_base | ATA_REG_ERROR, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read Error register: " + h(this.current_interface.error_reg & 255), LOG_DISK);
    }
    return this.current_interface.error_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_SECTOR, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read Sector Count register: " + h(this.current_interface.sector_count_reg & 255), LOG_DISK);
    }
    return this.current_interface.sector_count_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_LBA_LOW, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read LBA Low register: " + h(this.current_interface.lba_low_reg & 255), LOG_DISK);
    }
    return this.current_interface.lba_low_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_LBA_MID, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read LBA Mid register: " + h(this.current_interface.lba_mid_reg & 255), LOG_DISK);
    }
    return this.current_interface.lba_mid_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_LBA_HIGH, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read LBA High register: " + h(this.current_interface.lba_high_reg & 255), LOG_DISK);
    }
    return this.current_interface.lba_high_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_DEVICE, this, function() {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": read Device register", LOG_DISK);
    }
    return this.current_interface.device_reg & 255;
  });
  cpu.io.register_read(this.command_base | ATA_REG_STATUS, this, function() {
    const status = this.read_status();
    if (LOG_DETAILS & (LOG_DETAIL_REG_IO | LOG_DETAIL_IRQ)) {
      dbg_log(`${this.current_interface.name}: read Status register: ${h(status, 2)} (lower IRQ ${this.irq})`, LOG_DISK);
    }
    this.cpu.device_lower_irq(this.irq);
    return status;
  });
  cpu.io.register_write(this.command_base | ATA_REG_DATA, this, function(data) {
    this.current_interface.write_data_port8(data);
  }, function(data) {
    this.current_interface.write_data_port16(data);
  }, function(data) {
    this.current_interface.write_data_port32(data);
  });
  cpu.io.register_write(this.command_base | ATA_REG_FEATURES, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write Features register: " + h(data), LOG_DISK);
    }
    this.current_interface.features_reg = (this.current_interface.features_reg << 8 | data) & 65535;
  });
  cpu.io.register_write(this.command_base | ATA_REG_SECTOR, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write Sector Count register: " + h(data), LOG_DISK);
    }
    this.current_interface.sector_count_reg = (this.current_interface.sector_count_reg << 8 | data) & 65535;
  });
  cpu.io.register_write(this.command_base | ATA_REG_LBA_LOW, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write LBA Low register: " + h(data), LOG_DISK);
    }
    this.current_interface.lba_low_reg = (this.current_interface.lba_low_reg << 8 | data) & 65535;
  });
  cpu.io.register_write(this.command_base | ATA_REG_LBA_MID, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write LBA Mid register: " + h(data), LOG_DISK);
    }
    this.current_interface.lba_mid_reg = (this.current_interface.lba_mid_reg << 8 | data) & 65535;
  });
  cpu.io.register_write(this.command_base | ATA_REG_LBA_HIGH, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write LBA High register: " + h(data), LOG_DISK);
    }
    this.current_interface.lba_high_reg = (this.current_interface.lba_high_reg << 8 | data) & 65535;
  });
  cpu.io.register_write(this.command_base | ATA_REG_DEVICE, this, function(data) {
    const select_slave = data & ATA_DR_DEV;
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write Device register: " + h(data, 2), LOG_DISK);
    }
    if (select_slave && this.current_interface === this.master || !select_slave && this.current_interface === this.slave) {
      if (select_slave) {
        dbg_log(`${this.current_interface.name}: select slave device (${this.channel_nr ? "secondary" : "primary"})`, LOG_DISK);
        this.current_interface = this.slave;
      } else {
        dbg_log(`${this.current_interface.name}: select master device (${this.channel_nr ? "secondary" : "primary"})`, LOG_DISK);
        this.current_interface = this.master;
      }
    }
    this.current_interface.device_reg = data;
    this.current_interface.is_lba = data >> 6 & 1;
    this.current_interface.head = data & 15;
  });
  cpu.io.register_write(this.command_base | ATA_REG_COMMAND, this, function(data) {
    if (LOG_DETAILS & LOG_DETAIL_REG_IO) {
      dbg_log(this.current_interface.name + ": write Command register", LOG_DISK);
    }
    this.current_interface.status_reg &= ~(ATA_SR_ERR | ATA_SR_DF);
    this.current_interface.ata_command(data);
    if (LOG_DETAILS & LOG_DETAIL_IRQ) {
      dbg_log(this.current_interface.name + ": lower IRQ " + this.irq, LOG_DISK);
    }
    this.cpu.device_lower_irq(this.irq);
  });
  cpu.io.register_read(this.control_base | ATA_REG_ALT_STATUS, this, this.read_status);
  cpu.io.register_write(this.control_base | ATA_REG_CONTROL, this, this.write_control);
  const bus_master_base = BUS_MASTER_BASE + channel_nr * 8;
  cpu.io.register_read(
    bus_master_base | BMI_REG_COMMAND,
    this,
    this.dma_read_command8,
    void 0,
    this.dma_read_command
  );
  cpu.io.register_write(
    bus_master_base | BMI_REG_COMMAND,
    this,
    this.dma_write_command8,
    void 0,
    this.dma_write_command
  );
  cpu.io.register_read(
    bus_master_base | BMI_REG_STATUS,
    this,
    this.dma_read_status
  );
  cpu.io.register_write(
    bus_master_base | BMI_REG_STATUS,
    this,
    this.dma_write_status
  );
  cpu.io.register_read(
    bus_master_base | BMI_REG_PRDT,
    this,
    void 0,
    void 0,
    this.dma_read_addr
  );
  cpu.io.register_write(
    bus_master_base | BMI_REG_PRDT,
    this,
    void 0,
    void 0,
    this.dma_set_addr
  );
}
IDEChannel.prototype.read_status = function() {
  return this.current_interface.drive_connected ? this.current_interface.status_reg : 0;
};
IDEChannel.prototype.write_control = function(data) {
  if (LOG_DETAILS & (LOG_DETAIL_REG_IO | LOG_DETAIL_IRQ)) {
    dbg_log(this.current_interface.name + ": write Device Control register: " + h(data, 2) + " interrupts " + (data & ATA_CR_NIEN ? "disabled" : "enabled"), LOG_DISK);
  }
  if (data & ATA_CR_SRST) {
    dbg_log(`${this.current_interface.name}: soft reset via control port (lower IRQ ${this.irq})`, LOG_DISK);
    this.cpu.device_lower_irq(this.irq);
    this.master.device_reset();
    this.slave.device_reset();
  }
  this.device_control_reg = data;
};
IDEChannel.prototype.dma_read_addr = function() {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA get address: " + h(this.prdt_addr, 8), LOG_DISK);
  }
  return this.prdt_addr;
};
IDEChannel.prototype.dma_set_addr = function(data) {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA set address: " + h(data, 8), LOG_DISK);
  }
  this.prdt_addr = data;
};
IDEChannel.prototype.dma_read_status = function() {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA read status: " + h(this.dma_status), LOG_DISK);
  }
  return this.dma_status;
};
IDEChannel.prototype.dma_write_status = function(value) {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA write status: " + h(value), LOG_DISK);
  }
  this.dma_status &= ~(value & 6);
};
IDEChannel.prototype.dma_read_command = function() {
  return this.dma_read_command8() | this.dma_read_status() << 16;
};
IDEChannel.prototype.dma_read_command8 = function() {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA read command: " + h(this.dma_command), LOG_DISK);
  }
  return this.dma_command;
};
IDEChannel.prototype.dma_write_command = function(value) {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA write command: " + h(value), LOG_DISK);
  }
  this.dma_write_command8(value & 255);
  this.dma_write_status(value >> 16 & 255);
};
IDEChannel.prototype.dma_write_command8 = function(value) {
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.current_interface.name + ": DMA write command8: " + h(value), LOG_DISK);
  }
  const old_command = this.dma_command;
  this.dma_command = value & 9;
  if ((old_command & 1) === (value & 1)) {
    return;
  }
  if ((value & 1) === 0) {
    this.dma_status &= ~1;
    return;
  }
  this.dma_status |= 1;
  switch (this.current_interface.current_command) {
    case ATA_CMD_READ_DMA:
    case ATA_CMD_READ_DMA_EXT:
      this.current_interface.do_ata_read_sectors_dma();
      break;
    case ATA_CMD_WRITE_DMA:
    case ATA_CMD_WRITE_DMA_EXT:
      this.current_interface.do_ata_write_sectors_dma();
      break;
    case ATA_CMD_PACKET:
      this.current_interface.do_atapi_dma();
      break;
    default:
      dbg_log(this.current_interface.name + ": spurious DMA command write, current command: " + h(this.current_interface.current_command), LOG_DISK);
      dbg_log(this.current_interface.name + ": DMA clear status bit 1h, set status bit 2h", LOG_DISK);
      this.dma_status &= ~1;
      this.dma_status |= 2;
      this.push_irq();
      break;
  }
};
IDEChannel.prototype.push_irq = function() {
  if ((this.device_control_reg & ATA_CR_NIEN) === 0) {
    if (LOG_DETAILS & LOG_DETAIL_IRQ) {
      dbg_log(this.current_interface.name + ": push IRQ " + this.irq, LOG_DISK);
    }
    this.dma_status |= 4;
    this.cpu.device_raise_irq(this.irq);
  }
};
IDEChannel.prototype.get_state = function() {
  var state = [];
  state[0] = this.master;
  state[1] = this.slave;
  state[2] = this.command_base;
  state[3] = this.irq;
  state[5] = this.control_base;
  state[7] = this.name;
  state[8] = this.device_control_reg;
  state[9] = this.prdt_addr;
  state[10] = this.dma_status;
  state[11] = this.current_interface === this.master;
  state[12] = this.dma_command;
  return state;
};
IDEChannel.prototype.set_state = function(state) {
  this.master.set_state(state[0]);
  this.slave.set_state(state[1]);
  this.command_base = state[2];
  this.irq = state[3];
  this.control_base = state[5];
  this.name = state[7];
  this.device_control_reg = state[8];
  this.prdt_addr = state[9];
  this.dma_status = state[10];
  this.current_interface = state[11] ? this.master : this.slave;
  this.dma_command = state[12];
};
function IDEInterface(channel, interface_nr, buffer, is_cd) {
  this.channel = channel;
  this.name = channel.name + "." + interface_nr;
  this.bus = channel.bus;
  this.channel_nr = channel.channel_nr;
  this.interface_nr = interface_nr;
  this.cpu = channel.cpu;
  this.buffer = null;
  this.drive_connected = is_cd || !!buffer;
  this.sector_size = is_cd ? CDROM_SECTOR_SIZE : HD_SECTOR_SIZE;
  this.is_atapi = is_cd;
  this.sector_count = 0;
  this.head_count = this.is_atapi ? 1 : 0;
  this.sectors_per_track = 0;
  this.cylinder_count = 0;
  this.is_lba = 0;
  this.sector_count_reg = 0;
  this.lba_low_reg = 0;
  this.features_reg = 0;
  this.lba_mid_reg = 0;
  this.lba_high_reg = 0;
  this.head = 0;
  this.device_reg = 0;
  this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
  this.sectors_per_drq = 128;
  this.error_reg = 0;
  this.data_pointer = 0;
  this.data = new Uint8Array(64 * 1024);
  this.data16 = new Uint16Array(this.data.buffer);
  this.data32 = new Int32Array(this.data.buffer);
  this.data_length = 0;
  this.data_end = 0;
  this.current_command = -1;
  this.write_dest = 0;
  this.last_io_id = 0;
  this.in_progress_io_ids = /* @__PURE__ */ new Set();
  this.cancelled_io_ids = /* @__PURE__ */ new Set();
  this.current_atapi_command = -1;
  this.atapi_sense_key = 0;
  this.atapi_add_sense = 0;
  this.medium_changed = false;
  this.set_disk_buffer(buffer);
  if (this.drive_connected) {
    dbg_log(`${this.name}: ${this.is_atapi ? "ATAPI CD-ROM" : "ATA HD"} device ready`, LOG_DISK);
  }
  Object.seal(this);
}
IDEInterface.prototype.has_disk = function() {
  return !!this.buffer;
};
IDEInterface.prototype.eject = function() {
  if (this.is_atapi && this.buffer) {
    this.medium_changed = true;
    this.buffer = null;
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ | ATA_SR_COND;
    this.error_reg = ATAPI_SK_UNIT_ATTENTION << 4;
    this.push_irq();
  }
};
IDEInterface.prototype.set_cdrom = function(buffer) {
  if (this.is_atapi && buffer) {
    this.set_disk_buffer(buffer);
    this.medium_changed = true;
  }
};
IDEInterface.prototype.set_disk_buffer = function(buffer) {
  if (!buffer) {
    return;
  }
  this.buffer = buffer;
  if (this.is_atapi) {
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ | ATA_SR_COND;
    this.error_reg = ATAPI_SK_UNIT_ATTENTION << 4;
  }
  this.sector_count = this.buffer.byteLength / this.sector_size;
  if (this.sector_count !== (this.sector_count | 0)) {
    dbg_log(this.name + ": warning: disk size not aligned with sector size", LOG_DISK);
    this.sector_count = Math.ceil(this.sector_count);
  }
  if (this.is_atapi) {
    this.head_count = 1;
    this.sectors_per_track = 2048;
  } else {
    this.head_count = 16;
    this.sectors_per_track = 63;
  }
  this.cylinder_count = this.sector_count / this.head_count / this.sectors_per_track;
  if (this.cylinder_count !== (this.cylinder_count | 0)) {
    dbg_log(this.name + ": warning: rounding up cylinder count, choose different head number", LOG_DISK);
    this.cylinder_count = Math.floor(this.cylinder_count);
  }
  if (this.interface_nr === 0) {
    const rtc = this.cpu.devices.rtc;
    rtc.cmos_write(
      CMOS_BIOS_DISKTRANSFLAG,
      // TODO: what is this doing, setting LBA translation?
      rtc.cmos_read(CMOS_BIOS_DISKTRANSFLAG) | 1 << this.channel_nr * 4
    );
    rtc.cmos_write(CMOS_DISK_DATA, rtc.cmos_read(CMOS_DISK_DATA) & 15 | 240);
    const drive_reg = this.channel_nr === 0 ? CMOS_DISK_DRIVE1_CYL : CMOS_DISK_DRIVE2_CYL;
    rtc.cmos_write(drive_reg + 0, this.cylinder_count & 255);
    rtc.cmos_write(drive_reg + 1, this.cylinder_count >> 8 & 255);
    rtc.cmos_write(drive_reg + 2, this.head_count & 255);
    rtc.cmos_write(drive_reg + 3, 255);
    rtc.cmos_write(drive_reg + 4, 255);
    rtc.cmos_write(drive_reg + 5, 200);
    rtc.cmos_write(drive_reg + 6, this.cylinder_count & 255);
    rtc.cmos_write(drive_reg + 7, this.cylinder_count >> 8 & 255);
    rtc.cmos_write(drive_reg + 8, this.sectors_per_track & 255);
  }
  if (this.channel.cpu) {
    this.push_irq();
  }
};
IDEInterface.prototype.device_reset = function() {
  if (this.is_atapi) {
    this.status_reg = 0;
    this.sector_count_reg = 1;
    this.error_reg = 1;
    this.lba_low_reg = 1;
    this.lba_mid_reg = ATAPI_SIGNATURE_LO;
    this.lba_high_reg = ATAPI_SIGNATURE_HI;
  } else {
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_ERR;
    this.sector_count_reg = 1;
    this.error_reg = 1;
    this.lba_low_reg = 1;
    this.lba_mid_reg = 0;
    this.lba_high_reg = 0;
  }
  this.cancel_io_operations();
};
IDEInterface.prototype.push_irq = function() {
  this.channel.push_irq();
};
IDEInterface.prototype.ata_abort_command = function() {
  this.error_reg = ATA_ER_ABRT;
  this.status_reg = ATA_SR_DRDY | ATA_SR_ERR;
  this.push_irq();
};
IDEInterface.prototype.capture_regs = function() {
  return `ST=${h(this.status_reg & 255)} ER=${h(this.error_reg & 255)} SC=${h(this.sector_count_reg & 255)} LL=${h(this.lba_low_reg & 255)} LM=${h(this.lba_mid_reg & 255)} LH=${h(this.lba_high_reg & 255)} FE=${h(this.features_reg & 255)}`;
};
IDEInterface.prototype.ata_command = function(cmd) {
  if (!this.drive_connected && cmd !== ATA_CMD_EXECUTE_DEVICE_DIAGNOSTIC) {
    dbg_log(`${this.name}: ATA command ${ATA_CMD_NAME[cmd]} (${h(cmd)}) ignored: no slave drive connected`, LOG_DISK);
    return;
  }
  const regs_pre = false ? this.capture_regs() : void 0;
  let do_dbg_log = false;
  this.current_command = cmd;
  this.error_reg = 0;
  switch (cmd) {
    case ATA_CMD_DEVICE_RESET:
      this.data_pointer = 0;
      this.data_end = 0;
      this.data_length = 0;
      this.device_reset();
      this.push_irq();
      break;
    case ATA_CMD_10h:
      this.lba_mid_reg = 0;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_READ_NATIVE_MAX_ADDRESS:
      var last_sector = this.sector_count - 1;
      this.lba_low_reg = last_sector & 255;
      this.lba_mid_reg = last_sector >> 8 & 255;
      this.lba_high_reg = last_sector >> 16 & 255;
      this.device_reg = this.device_reg & 240 | last_sector >> 24 & 15;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_READ_NATIVE_MAX_ADDRESS_EXT:
      var last_sector = this.sector_count - 1;
      this.lba_low_reg = last_sector & 255;
      this.lba_mid_reg = last_sector >> 8 & 255;
      this.lba_high_reg = last_sector >> 16 & 255;
      this.lba_low_reg |= last_sector >> 24 << 8 & 65280;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_READ_SECTORS:
      do_dbg_log = false;
      if (this.is_atapi) {
        this.lba_mid_reg = ATAPI_SIGNATURE_LO;
        this.lba_high_reg = ATAPI_SIGNATURE_HI;
        this.ata_abort_command();
      } else {
        this.ata_read_sectors(cmd);
      }
      break;
    case ATA_CMD_READ_SECTORS_EXT:
    case ATA_CMD_READ_MULTIPLE:
    case ATA_CMD_READ_MULTIPLE_EXT:
      do_dbg_log = false;
      if (this.is_atapi) {
        this.ata_abort_command();
      } else {
        this.ata_read_sectors(cmd);
      }
      break;
    case ATA_CMD_WRITE_SECTORS:
    case ATA_CMD_WRITE_SECTORS_EXT:
    case ATA_CMD_WRITE_MULTIPLE:
    case ATA_CMD_WRITE_MULTIPLE_EXT:
      do_dbg_log = false;
      if (this.is_atapi) {
        this.ata_abort_command();
      } else {
        this.ata_write_sectors(cmd);
      }
      break;
    case ATA_CMD_EXECUTE_DEVICE_DIAGNOSTIC:
      this.channel.master.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.channel.master.error_reg = 1;
      this.channel.master.push_irq();
      if (this.channel.slave.drive_connected) {
        this.channel.slave.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
        this.channel.slave.error_reg = 1;
        this.channel.slave.push_irq();
      }
      break;
    case ATA_CMD_INITIALIZE_DEVICE_PARAMETERS:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_PACKET:
      if (this.is_atapi) {
        do_dbg_log = false;
        this.data_allocate(12);
        this.data_end = 12;
        this.sector_count_reg = 1;
        this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        this.push_irq();
      } else {
        this.ata_abort_command();
      }
      break;
    case ATA_CMD_IDENTIFY_PACKET_DEVICE:
      if (this.is_atapi) {
        this.create_identify_packet();
        this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        this.push_irq();
      } else {
        this.ata_abort_command();
      }
      break;
    case ATA_CMD_SET_MULTIPLE_MODE:
      dbg_log(this.name + ": logical sectors per DRQ Block: " + h(this.sector_count_reg & 255), LOG_DISK);
      this.sectors_per_drq = this.sector_count_reg & 255;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_READ_DMA:
    case ATA_CMD_READ_DMA_EXT:
      do_dbg_log = false;
      this.ata_read_sectors_dma(cmd);
      break;
    case ATA_CMD_WRITE_DMA:
    case ATA_CMD_WRITE_DMA_EXT:
      do_dbg_log = false;
      this.ata_write_sectors_dma(cmd);
      break;
    case ATA_CMD_READ_VERIFY_SECTORS:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_GET_MEDIA_STATUS:
      if (this.is_atapi) {
        if (!this.buffer) {
          this.error_reg |= 2;
        }
        if (this.medium_changed) {
          this.error_reg |= 32;
          this.medium_changed = false;
        }
        this.error_reg |= 64;
      }
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_STANDBY_IMMEDIATE:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_IDLE_IMMEDIATE:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_FLUSH_CACHE:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_FLUSH_CACHE_EXT:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_IDENTIFY_DEVICE:
      if (this.is_atapi) {
        this.lba_mid_reg = ATAPI_SIGNATURE_LO;
        this.lba_high_reg = ATAPI_SIGNATURE_HI;
        this.ata_abort_command();
      } else {
        this.create_identify_packet();
        this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        this.push_irq();
      }
      break;
    case ATA_CMD_SET_FEATURES:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_MEDIA_LOCK:
      this.status_reg = ATA_SR_DRDY;
      this.push_irq();
      break;
    case ATA_CMD_SECURITY_FREEZE_LOCK:
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.push_irq();
      break;
    case ATA_CMD_SET_MAX:
      this.ata_abort_command();
      break;
    case ATA_CMD_NOP:
      this.ata_abort_command();
      break;
    case ATA_CMD_F0h:
      dbg_log(`${this.name}: error: unimplemented vendor-specific ATA command ${h(cmd)}: ABORT [${this.capture_regs()}]`, LOG_DISK);
      this.ata_abort_command();
      break;
    default:
      dbg_assert(false, `${this.name}: error: unimplemented ATA command ${h(cmd)}: ABORT [${this.capture_regs()}]`, LOG_DISK);
      this.ata_abort_command();
      break;
  }
  if (false) {
    const regs_msg = `[${regs_pre}] -> [${this.capture_regs()}]`;
    const result = this.status_reg & ATA_SR_ERR ? this.error_reg & ATA_ER_ABRT ? "ABORT" : "ERROR" : "OK";
    dbg_log(`${this.name}: ATA command ${ATA_CMD_NAME[cmd]} (${h(cmd)}): ${result} ${regs_msg}`, LOG_DISK);
  }
};
IDEInterface.prototype.atapi_handle = function() {
  const cmd = this.data[0];
  const cmd_name = ATAPI_CMD[cmd] ? ATAPI_CMD[cmd].name : "<undefined>";
  const cmd_flags = ATAPI_CMD[cmd] ? ATAPI_CMD[cmd].flags : ATAPI_CF_NONE;
  const regs_pre = false ? this.capture_regs() : void 0;
  let do_dbg_log = false;
  let dbg_log_extra;
  this.data_pointer = 0;
  this.current_atapi_command = cmd;
  if (cmd !== ATAPI_CMD_REQUEST_SENSE) {
    this.atapi_sense_key = 0;
    this.atapi_add_sense = 0;
  }
  if (!this.buffer && cmd_flags & ATAPI_CF_NEEDS_DISK) {
    this.atapi_check_condition_response(ATAPI_SK_NOT_READY, ATAPI_ASC_MEDIUM_NOT_PRESENT);
    this.push_irq();
    if (false) {
      dbg_log(`${this.name}: ATAPI command ${cmd_name} (${h(cmd)}) without medium: ERROR [${regs_pre}]`, LOG_DISK);
    }
    return;
  }
  switch (cmd) {
    case ATAPI_CMD_TEST_UNIT_READY:
      if (this.buffer) {
        this.data_allocate(0);
        this.data_end = this.data_length;
        this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      } else {
        this.atapi_check_condition_response(ATAPI_SK_NOT_READY, ATAPI_ASC_MEDIUM_NOT_PRESENT);
      }
      break;
    case ATAPI_CMD_REQUEST_SENSE:
      this.data_allocate(this.data[4]);
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.data[0] = 128 | 112;
      this.data[2] = this.atapi_sense_key;
      this.data[7] = 8;
      this.data[12] = this.atapi_add_sense;
      this.atapi_sense_key = 0;
      this.atapi_add_sense = 0;
      break;
    case ATAPI_CMD_INQUIRY:
      var length = this.data[4];
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      dbg_log_extra = "lun=" + h(this.data[1], 2) + " length=" + length;
      this.data.set([
        // 0: Device-type, Removable, ANSI-Version, Response Format
        5,
        128,
        1,
        49,
        // 4: Additional length, Reserved, Reserved, Reserved
        31,
        0,
        0,
        0,
        // 8: Vendor Identification "SONY    "
        83,
        79,
        78,
        89,
        32,
        32,
        32,
        32,
        // 16: Product Identification "CD-ROM CDU-1000 "
        67,
        68,
        45,
        82,
        79,
        77,
        32,
        67,
        68,
        85,
        45,
        49,
        48,
        48,
        48,
        32,
        // 32: Product Revision Level "1.1a"
        49,
        46,
        49,
        97
      ]);
      this.data_end = this.data_length = Math.min(36, length);
      break;
    case ATAPI_CMD_MODE_SENSE_6:
      this.data_allocate(this.data[4]);
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_PREVENT_ALLOW_MEDIUM_REMOVAL:
      this.data_allocate(0);
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      break;
    case ATAPI_CMD_READ_CAPACITY:
      var count = this.sector_count - 1;
      this.data_set(new Uint8Array([
        count >> 24 & 255,
        count >> 16 & 255,
        count >> 8 & 255,
        count & 255,
        0,
        0,
        this.sector_size >> 8 & 255,
        this.sector_size & 255
      ]));
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_READ_10:
    case ATAPI_CMD_READ_12:
      do_dbg_log = false;
      if (this.features_reg & 1) {
        this.atapi_read_dma(this.data);
      } else {
        this.atapi_read(this.data);
      }
      break;
    case ATAPI_CMD_READ_SUBCHANNEL:
      var length = this.data[8];
      dbg_log_extra = "length=" + length;
      this.data_allocate(Math.min(8, length));
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_READ_TOC_PMA_ATIP:
      var length = this.data[8] | this.data[7] << 8;
      var format = this.data[9] >> 6;
      dbg_log_extra = `${h(format, 2)} length=${length} ${!!(this.data[1] & 2)} ${h(this.data[6])}`;
      this.data_allocate(length);
      this.data_end = this.data_length;
      if (format === 0) {
        const sector_count = this.sector_count;
        this.data.set(new Uint8Array([
          0,
          18,
          // length
          1,
          1,
          // first and last session
          0,
          20,
          1,
          // track number
          0,
          0,
          0,
          0,
          0,
          0,
          22,
          170,
          // track number
          0,
          sector_count >> 24,
          sector_count >> 16 & 255,
          sector_count >> 8 & 255,
          sector_count & 255
        ]));
      } else if (format === 1) {
        this.data.set(new Uint8Array([
          0,
          10,
          // length
          1,
          1,
          // first and last session
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]));
      } else {
        dbg_assert(false, this.name + ": error: unimplemented format: " + format);
      }
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_GET_CONFIGURATION:
      var length = Math.min(this.data[8] | this.data[7] << 8, 32);
      dbg_log_extra = "length=" + length;
      this.data_allocate(length);
      this.data_end = this.data_length;
      this.data[0] = length - 4 >> 24 & 255;
      this.data[1] = length - 4 >> 16 & 255;
      this.data[2] = length - 4 >> 8 & 255;
      this.data[3] = length - 4 & 255;
      this.data[6] = 8;
      this.data[10] = 3;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_READ_DISK_INFORMATION:
      this.data_allocate(0);
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      break;
    case ATAPI_CMD_READ_TRACK_INFORMATION:
      dbg_log_extra = "unimplemented";
      this.atapi_check_condition_response(ATAPI_SK_ILLEGAL_REQUEST, ATAPI_ASC_INV_FIELD_IN_CMD_PACKET);
      break;
    case ATAPI_CMD_MODE_SENSE_10:
      var length = this.data[8] | this.data[7] << 8;
      var page_code = this.data[2];
      dbg_log_extra = "page_code=" + h(page_code) + " length=" + length;
      if (page_code === 42) {
        this.data_allocate(Math.min(30, length));
      }
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_MECHANISM_STATUS:
      this.data_allocate(this.data[9] | this.data[8] << 8);
      this.data_end = this.data_length;
      this.data[5] = 1;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      break;
    case ATAPI_CMD_START_STOP_UNIT:
      var loej_start = this.data[4] & 3;
      dbg_log_extra = `Immed=${h(this.data[1] & 1)} LoEj/Start=${h(loej_start)}`;
      if (this.buffer && loej_start === 2) {
        dbg_log_extra += ": disk ejected";
        this.medium_changed = true;
        this.buffer = null;
      }
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.data_allocate(0);
      this.data_end = this.data_length;
      break;
    case ATAPI_CMD_PAUSE:
    case ATAPI_CMD_GET_EVENT_STATUS_NOTIFICATION:
      dbg_log_extra = "unimplemented";
      this.atapi_check_condition_response(ATAPI_SK_ILLEGAL_REQUEST, ATAPI_ASC_INV_FIELD_IN_CMD_PACKET);
      break;
    case ATAPI_CMD_READ_CD:
      dbg_log_extra = "unimplemented";
      this.data_allocate(0);
      this.data_end = this.data_length;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      break;
    default:
      dbg_assert(false, `${this.name}: error: unimplemented ATAPI command ${h(this.data[0])}`, LOG_DISK);
      this.atapi_check_condition_response(ATAPI_SK_ILLEGAL_REQUEST, ATAPI_ASC_INV_FIELD_IN_CMD_PACKET);
      break;
  }
  this.sector_count_reg = this.sector_count_reg & ~7 | 2;
  if ((this.status_reg & ATA_SR_BSY) === 0) {
    this.push_irq();
  }
  if ((this.status_reg & ATA_SR_BSY) === 0 && this.data_length === 0) {
    this.sector_count_reg |= 1;
    this.status_reg &= ~ATA_SR_DRQ;
  }
  if (false) {
    const regs_msg = `[${regs_pre}] -> [${this.capture_regs()}]`;
    const result = this.status_reg & ATA_SR_ERR ? this.error_reg & ATA_ER_ABRT ? "ABORT" : "ERROR" : "OK";
    dbg_log_extra = dbg_log_extra ? ` ${dbg_log_extra}:` : "";
    dbg_log(`${this.name}: ATAPI command ${cmd_name} (${h(cmd)}):${dbg_log_extra} ${result} ${regs_msg}`, LOG_DISK);
  }
};
IDEInterface.prototype.atapi_check_condition_response = function(sense_key, additional_sense) {
  this.data_allocate(0);
  this.data_end = this.data_length;
  this.status_reg = ATA_SR_DRDY | ATA_SR_COND;
  this.error_reg = sense_key << 4;
  this.sector_count_reg = this.sector_count_reg & ~7 | 2 | 1;
  this.atapi_sense_key = sense_key;
  this.atapi_add_sense = additional_sense;
};
IDEInterface.prototype.do_write = function() {
  this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
  dbg_assert(this.data_length <= this.data.length);
  var data = this.data.subarray(0, this.data_length);
  dbg_assert(this.data_length % 512 === 0);
  this.ata_advance(this.current_command, this.data_length / 512);
  this.push_irq();
  this.buffer.set(this.write_dest, data, function() {
  });
  this.report_write(this.data_length);
};
IDEInterface.prototype.atapi_read = function(cmd) {
  var lba = cmd[2] << 24 | cmd[3] << 16 | cmd[4] << 8 | cmd[5];
  var count = cmd[0] === ATAPI_CMD_READ_12 ? cmd[6] << 24 | cmd[7] << 16 | cmd[8] << 8 | cmd[9] : cmd[7] << 8 | cmd[8];
  count >>>= 0;
  var flags = cmd[1];
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  if (LOG_DETAILS & LOG_DETAIL_RW) {
    dbg_log(this.name + ": CD read lba=" + h(lba) + " lbacount=" + h(count) + " bytecount=" + h(byte_count) + " flags=" + h(flags), LOG_DISK);
  }
  this.data_length = 0;
  var req_length = this.lba_high_reg << 8 & 65280 | this.lba_mid_reg & 255;
  this.lba_mid_reg = this.lba_high_reg = 0;
  if (req_length === 65535)
    req_length--;
  if (req_length > byte_count) {
    req_length = byte_count;
  }
  if (!this.buffer) {
    dbg_assert(false, this.name + ": CD read: no buffer", LOG_DISK);
    this.status_reg = 255;
    this.error_reg = 65;
    this.push_irq();
  } else if (start >= this.buffer.byteLength) {
    dbg_assert(false, this.name + ": CD read: Outside of disk  end=" + h(start + byte_count) + " size=" + h(this.buffer.byteLength), LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
  } else if (byte_count === 0) {
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
    this.data_pointer = 0;
  } else {
    byte_count = Math.min(byte_count, this.buffer.byteLength - start);
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_BSY;
    this.report_read_start();
    this.read_buffer(start, byte_count, (data) => {
      if (LOG_DETAILS & LOG_DETAIL_RW) {
        dbg_log(this.name + ": CD read: data arrived", LOG_DISK);
      }
      this.data_set(data);
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.sector_count_reg = this.sector_count_reg & ~7 | 2;
      this.push_irq();
      req_length &= ~3;
      this.data_end = req_length;
      if (this.data_end > this.data_length) {
        this.data_end = this.data_length;
      }
      this.lba_mid_reg = this.data_end & 255;
      this.lba_high_reg = this.data_end >> 8 & 255;
      this.report_read_end(byte_count);
    });
  }
};
IDEInterface.prototype.atapi_read_dma = function(cmd) {
  var lba = cmd[2] << 24 | cmd[3] << 16 | cmd[4] << 8 | cmd[5];
  var count = cmd[0] === ATAPI_CMD_READ_12 ? cmd[6] << 24 | cmd[7] << 16 | cmd[8] << 8 | cmd[9] : cmd[7] << 8 | cmd[8];
  count >>>= 0;
  var flags = cmd[1];
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  dbg_log(this.name + ": CD read DMA lba=" + h(lba) + " lbacount=" + h(count) + " bytecount=" + h(byte_count) + " flags=" + h(flags), LOG_DISK);
  if (start >= this.buffer.byteLength) {
    dbg_assert(false, this.name + ": CD read: Outside of disk  end=" + h(start + byte_count) + " size=" + h(this.buffer.byteLength), LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
  } else {
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_BSY;
    this.report_read_start();
    this.read_buffer(start, byte_count, (data) => {
      dbg_log(this.name + ": atapi_read_dma: Data arrived", LOG_DISK);
      this.report_read_end(byte_count);
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.sector_count_reg = this.sector_count_reg & ~7 | 2;
      this.data_set(data);
      this.do_atapi_dma();
    });
  }
};
IDEInterface.prototype.do_atapi_dma = function() {
  if ((this.channel.dma_status & 1) === 0) {
    dbg_log(this.name + ": do_atapi_dma: Status not set", LOG_DISK);
    return;
  }
  if ((this.status_reg & ATA_SR_DRQ) === 0) {
    dbg_log(this.name + ": do_atapi_dma: DRQ not set", LOG_DISK);
    return;
  }
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.name + ": ATAPI DMA transfer len=" + this.data_length, LOG_DISK);
  }
  var prdt_start = this.channel.prdt_addr;
  var offset = 0;
  var data = this.data;
  do {
    var addr = this.cpu.read32s(prdt_start);
    var count = this.cpu.read16(prdt_start + 4);
    var end = this.cpu.read8(prdt_start + 7) & 128;
    if (!count) {
      count = 65536;
    }
    if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
      dbg_log(this.name + ": DMA read dest=" + h(addr) + " count=" + h(count) + " datalen=" + h(this.data_length), LOG_DISK);
    }
    this.cpu.write_blob(data.subarray(offset, Math.min(offset + count, this.data_length)), addr);
    offset += count;
    prdt_start += 8;
    if (offset >= this.data_length && !end) {
      if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
        dbg_log(this.name + ": leave early end=" + +end + " offset=" + h(offset) + " data_length=" + h(this.data_length) + " cmd=" + h(this.current_command), LOG_DISK);
      }
      break;
    }
  } while (!end);
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.name + ": end offset=" + offset, LOG_DISK);
  }
  this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
  this.channel.dma_status &= ~1;
  this.sector_count_reg = this.sector_count_reg & ~7 | 3;
  this.push_irq();
};
IDEInterface.prototype.read_data = function(length) {
  if (this.data_pointer < this.data_end) {
    dbg_assert(this.data_pointer + length - 1 < this.data_end);
    dbg_assert(this.data_pointer % length === 0, h(this.data_pointer) + " " + length);
    if (length === 1) {
      var result = this.data[this.data_pointer];
    } else if (length === 2) {
      var result = this.data16[this.data_pointer >>> 1];
    } else {
      var result = this.data32[this.data_pointer >>> 2];
    }
    this.data_pointer += length;
    var align = (this.data_end & 4095) === 0 ? 4095 : 255;
    if (LOG_DETAILS & LOG_DETAIL_RW) {
      if ((this.data_pointer & align) === 0) {
        dbg_log(this.name + ": read 1F0: " + h(this.data[this.data_pointer], 2) + " cur=" + h(this.data_pointer) + " cnt=" + h(this.data_length), LOG_DISK);
      }
    }
    if (this.data_pointer >= this.data_end) {
      this.read_end();
    }
    return result;
  } else {
    if (LOG_DETAILS & LOG_DETAIL_RW) {
      dbg_log(this.name + ": read 1F0: empty", LOG_DISK);
    }
    this.data_pointer += length;
    return 0;
  }
};
IDEInterface.prototype.read_end = function() {
  if (LOG_DETAILS & LOG_DETAIL_RW) {
    dbg_log(this.name + ": read_end cmd=" + h(this.current_command) + " data_pointer=" + h(this.data_pointer) + " end=" + h(this.data_end) + " length=" + h(this.data_length), LOG_DISK);
  }
  if (this.current_command === ATA_CMD_PACKET) {
    if (this.data_end === this.data_length) {
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
      this.sector_count_reg = this.sector_count_reg & ~7 | 3;
      this.push_irq();
    } else {
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.sector_count_reg = this.sector_count_reg & ~7 | 2;
      this.push_irq();
      var byte_count = this.lba_high_reg << 8 & 65280 | this.lba_mid_reg & 255;
      if (this.data_end + byte_count > this.data_length) {
        this.lba_mid_reg = this.data_length - this.data_end & 255;
        this.lba_high_reg = this.data_length - this.data_end >> 8 & 255;
        this.data_end = this.data_length;
      } else {
        this.data_end += byte_count;
      }
      if (LOG_DETAILS & LOG_DETAIL_RW) {
        dbg_log(this.name + ": data_end=" + h(this.data_end), LOG_DISK);
      }
    }
  } else {
    this.error_reg = 0;
    if (this.data_pointer >= this.data_length) {
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
    } else {
      if (this.current_command === ATA_CMD_READ_MULTIPLE || this.current_command === ATA_CMD_READ_MULTIPLE_EXT) {
        var sector_count = Math.min(
          this.sectors_per_drq,
          (this.data_length - this.data_end) / 512
        );
        dbg_assert(sector_count % 1 === 0);
      } else {
        dbg_assert(this.current_command === ATA_CMD_READ_SECTORS || this.current_command === ATA_CMD_READ_SECTORS_EXT);
        var sector_count = 1;
      }
      this.ata_advance(this.current_command, sector_count);
      this.data_end += 512 * sector_count;
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.push_irq();
    }
  }
};
IDEInterface.prototype.write_data_port = function(data, length) {
  dbg_assert(this.data_pointer % length === 0);
  if (this.data_pointer >= this.data_end) {
    dbg_log(this.name + ": redundant write to data port: " + h(data) + " count=" + h(this.data_end) + " cur=" + h(this.data_pointer), LOG_DISK);
  } else {
    var align = (this.data_end & 4095) === 0 ? 4095 : 255;
    if (LOG_DETAILS & LOG_DETAIL_RW) {
      if ((this.data_pointer + length & align) === 0 || this.data_end < 20) {
        dbg_log(this.name + ": data port: " + h(data >>> 0) + " count=" + h(this.data_end) + " cur=" + h(this.data_pointer), LOG_DISK);
      }
    }
    if (length === 1) {
      this.data[this.data_pointer++] = data;
    } else if (length === 2) {
      this.data16[this.data_pointer >>> 1] = data;
      this.data_pointer += 2;
    } else {
      this.data32[this.data_pointer >>> 2] = data;
      this.data_pointer += 4;
    }
    dbg_assert(this.data_pointer <= this.data_end);
    if (this.data_pointer === this.data_end) {
      this.write_end();
    }
  }
};
IDEInterface.prototype.write_data_port8 = function(data) {
  this.write_data_port(data, 1);
};
IDEInterface.prototype.write_data_port16 = function(data) {
  this.write_data_port(data, 2);
};
IDEInterface.prototype.write_data_port32 = function(data) {
  this.write_data_port(data, 4);
};
IDEInterface.prototype.write_end = function() {
  if (this.current_command === ATA_CMD_PACKET) {
    this.atapi_handle();
  } else {
    if (LOG_DETAILS & LOG_DETAIL_RW) {
      dbg_log(this.name + ": write_end data_pointer=" + h(this.data_pointer) + " data_length=" + h(this.data_length), LOG_DISK);
    }
    if (this.data_pointer >= this.data_length) {
      this.do_write();
    } else {
      dbg_assert(
        this.current_command === ATA_CMD_WRITE_SECTORS || this.current_command === ATA_CMD_WRITE_SECTORS_EXT || this.current_command === ATA_CMD_WRITE_MULTIPLE_EXT,
        "Unexpected command: " + h(this.current_command)
      );
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.data_end += 512;
      this.push_irq();
    }
  }
};
IDEInterface.prototype.ata_advance = function(cmd, sectors) {
  if (LOG_DETAILS & LOG_DETAIL_RW) {
    dbg_log(this.name + ": advance sectors=" + sectors + " old_sector_count_reg=" + this.sector_count_reg, LOG_DISK);
  }
  this.sector_count_reg -= sectors;
  if (cmd === ATA_CMD_READ_SECTORS_EXT || cmd === ATA_CMD_READ_MULTIPLE || cmd === ATA_CMD_READ_DMA_EXT || cmd === ATA_CMD_WRITE_SECTORS_EXT || cmd === ATA_CMD_WRITE_MULTIPLE || cmd === ATA_CMD_WRITE_DMA_EXT) {
    var new_sector = sectors + this.get_lba48();
    this.lba_low_reg = new_sector & 255 | new_sector >> 16 & 65280;
    this.lba_mid_reg = new_sector >> 8 & 255;
    this.lba_high_reg = new_sector >> 16 & 255;
  } else if (this.is_lba) {
    var new_sector = sectors + this.get_lba28();
    this.lba_low_reg = new_sector & 255;
    this.lba_mid_reg = new_sector >> 8 & 255;
    this.lba_high_reg = new_sector >> 16 & 255;
    this.head = this.head & ~15 | new_sector & 15;
  } else {
    var new_sector = sectors + this.get_chs();
    var c = new_sector / (this.head_count * this.sectors_per_track) | 0;
    this.lba_mid_reg = c & 255;
    this.lba_high_reg = c >> 8 & 255;
    this.head = (new_sector / this.sectors_per_track | 0) % this.head_count & 15;
    this.lba_low_reg = new_sector % this.sectors_per_track + 1 & 255;
    dbg_assert(new_sector === this.get_chs());
  }
};
IDEInterface.prototype.ata_read_sectors = function(cmd) {
  var is_lba48 = cmd === ATA_CMD_READ_SECTORS_EXT || cmd === ATA_CMD_READ_MULTIPLE;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var is_single = cmd === ATA_CMD_READ_SECTORS || cmd === ATA_CMD_READ_SECTORS_EXT;
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  if (LOG_DETAILS & LOG_DETAIL_RW) {
    dbg_log(this.name + ": ATA read cmd=" + h(cmd) + " mode=" + (this.is_lba ? "lba" : "chs") + " lba=" + h(lba) + " lbacount=" + h(count) + " bytecount=" + h(byte_count), LOG_DISK);
  }
  if (start + byte_count > this.buffer.byteLength) {
    dbg_assert(false, this.name + ": ATA read: Outside of disk", LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
  } else {
    this.status_reg = ATA_SR_DRDY | ATA_SR_BSY;
    this.report_read_start();
    this.read_buffer(start, byte_count, (data) => {
      if (LOG_DETAILS & LOG_DETAIL_RW) {
        dbg_log(this.name + ": ata_read: Data arrived", LOG_DISK);
      }
      this.data_set(data);
      this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
      this.data_end = is_single ? 512 : Math.min(byte_count, this.sectors_per_drq * 512);
      this.ata_advance(cmd, is_single ? 1 : Math.min(count, this.sectors_per_track));
      this.push_irq();
      this.report_read_end(byte_count);
    });
  }
};
IDEInterface.prototype.ata_read_sectors_dma = function(cmd) {
  var is_lba48 = cmd === ATA_CMD_READ_DMA_EXT;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.name + ": ATA DMA read lba=" + h(lba) + " lbacount=" + h(count) + " bytecount=" + h(byte_count), LOG_DISK);
  }
  if (start + byte_count > this.buffer.byteLength) {
    dbg_assert(false, this.name + ": ATA read: Outside of disk", LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
    return;
  }
  this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
  this.channel.dma_status |= 1;
};
IDEInterface.prototype.do_ata_read_sectors_dma = function() {
  var cmd = this.current_command;
  var is_lba48 = cmd === ATA_CMD_READ_DMA_EXT;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  dbg_assert(lba < this.buffer.byteLength);
  this.report_read_start();
  var orig_prdt_start = this.channel.prdt_addr;
  this.read_buffer(start, byte_count, (data) => {
    if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
      dbg_log(this.name + ": do_ata_read_sectors_dma: Data arrived", LOG_DISK);
    }
    var prdt_start = this.channel.prdt_addr;
    var offset = 0;
    dbg_assert(orig_prdt_start === prdt_start);
    do {
      var prd_addr = this.cpu.read32s(prdt_start);
      var prd_count = this.cpu.read16(prdt_start + 4);
      var end = this.cpu.read8(prdt_start + 7) & 128;
      if (!prd_count) {
        prd_count = 65536;
        if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
          dbg_log(this.name + ": DMA: prd count was 0", LOG_DISK);
        }
      }
      if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
        dbg_log(this.name + ": DMA read transfer dest=" + h(prd_addr) + " prd_count=" + h(prd_count), LOG_DISK);
      }
      this.cpu.write_blob(data.subarray(offset, offset + prd_count), prd_addr);
      offset += prd_count;
      prdt_start += 8;
    } while (!end);
    dbg_assert(offset === byte_count);
    this.ata_advance(this.current_command, count);
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
    this.channel.dma_status &= ~1;
    this.current_command = -1;
    this.report_read_end(byte_count);
    this.push_irq();
  });
};
IDEInterface.prototype.ata_write_sectors = function(cmd) {
  var is_lba48 = cmd === ATA_CMD_WRITE_SECTORS_EXT || cmd === ATA_CMD_WRITE_MULTIPLE;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var is_single = cmd === ATA_CMD_WRITE_SECTORS || cmd === ATA_CMD_WRITE_SECTORS_EXT;
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  if (LOG_DETAILS & LOG_DETAIL_RW) {
    dbg_log(this.name + ": ATA write lba=" + h(lba) + " mode=" + (this.is_lba ? "lba" : "chs") + " lbacount=" + h(count) + " bytecount=" + h(byte_count), LOG_DISK);
  }
  if (start + byte_count > this.buffer.byteLength) {
    dbg_assert(false, this.name + ": ATA write: Outside of disk", LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
  } else {
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
    this.data_allocate_noclear(byte_count);
    this.data_end = is_single ? 512 : Math.min(byte_count, this.sectors_per_drq * 512);
    this.write_dest = start;
  }
};
IDEInterface.prototype.ata_write_sectors_dma = function(cmd) {
  var is_lba48 = cmd === ATA_CMD_WRITE_DMA_EXT;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.name + ": ATA DMA write lba=" + h(lba) + " lbacount=" + h(count) + " bytecount=" + h(byte_count), LOG_DISK);
  }
  if (start + byte_count > this.buffer.byteLength) {
    dbg_assert(false, this.name + ": ATA DMA write: Outside of disk", LOG_DISK);
    this.status_reg = 255;
    this.push_irq();
    return;
  }
  this.status_reg = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
  this.channel.dma_status |= 1;
};
IDEInterface.prototype.do_ata_write_sectors_dma = function() {
  var cmd = this.current_command;
  var is_lba48 = cmd === ATA_CMD_WRITE_DMA_EXT;
  var count = this.get_count(is_lba48);
  var lba = this.get_lba(is_lba48);
  var byte_count = count * this.sector_size;
  var start = lba * this.sector_size;
  var prdt_start = this.channel.prdt_addr;
  var offset = 0;
  if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
    dbg_log(this.name + ": prdt addr: " + h(prdt_start, 8), LOG_DISK);
  }
  const buffer = new Uint8Array(byte_count);
  do {
    var prd_addr = this.cpu.read32s(prdt_start);
    var prd_count = this.cpu.read16(prdt_start + 4);
    var end = this.cpu.read8(prdt_start + 7) & 128;
    if (!prd_count) {
      prd_count = 65536;
      dbg_log(this.name + ": DMA: prd count was 0", LOG_DISK);
    }
    if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
      dbg_log(this.name + ": DMA write transfer dest=" + h(prd_addr) + " prd_count=" + h(prd_count), LOG_DISK);
    }
    var slice = this.cpu.mem8.subarray(prd_addr, prd_addr + prd_count);
    dbg_assert(slice.length === prd_count);
    buffer.set(slice, offset);
    offset += prd_count;
    prdt_start += 8;
  } while (!end);
  dbg_assert(offset === buffer.length);
  this.buffer.set(start, buffer, () => {
    if (LOG_DETAILS & LOG_DETAIL_RW_DMA) {
      dbg_log(this.name + ": DMA write completed", LOG_DISK);
    }
    this.ata_advance(this.current_command, count);
    this.status_reg = ATA_SR_DRDY | ATA_SR_DSC;
    this.push_irq();
    this.channel.dma_status &= ~1;
    this.current_command = -1;
  });
  this.report_write(byte_count);
};
IDEInterface.prototype.get_chs = function() {
  var c = this.lba_mid_reg & 255 | this.lba_high_reg << 8 & 65280;
  var h2 = this.head;
  var s = this.lba_low_reg & 255;
  if (LOG_DETAILS & LOG_DETAIL_CHS) {
    dbg_log(this.name + ": get_chs: c=" + c + " h=" + h2 + " s=" + s, LOG_DISK);
  }
  return (c * this.head_count + h2) * this.sectors_per_track + s - 1;
};
IDEInterface.prototype.get_lba28 = function() {
  return this.lba_low_reg & 255 | this.lba_mid_reg << 8 & 65280 | this.lba_high_reg << 16 & 16711680 | (this.head & 15) << 24;
};
IDEInterface.prototype.get_lba48 = function() {
  return (this.lba_low_reg & 255 | this.lba_mid_reg << 8 & 65280 | this.lba_high_reg << 16 & 16711680 | this.lba_low_reg >> 8 << 24 & 4278190080) >>> 0;
};
IDEInterface.prototype.get_lba = function(is_lba48) {
  if (is_lba48) {
    return this.get_lba48();
  } else if (this.is_lba) {
    return this.get_lba28();
  } else {
    return this.get_chs();
  }
};
IDEInterface.prototype.get_count = function(is_lba48) {
  if (is_lba48) {
    var count = this.sector_count_reg;
    if (count === 0) count = 65536;
    return count;
  } else {
    var count = this.sector_count_reg & 255;
    if (count === 0) count = 256;
    return count;
  }
};
IDEInterface.prototype.create_identify_packet = function() {
  const cylinder_count = Math.min(16383, this.cylinder_count);
  const strcpy_be16 = (out_buffer, ofs16, len16, str) => {
    let ofs8 = ofs16 << 1;
    const len8 = len16 << 1;
    const end8 = ofs8 + len8;
    out_buffer.fill(32, ofs8, len8);
    for (let i_str = 0; i_str < str.length && ofs8 < end8; i_str++) {
      if (i_str & 1) {
        out_buffer[ofs8] = str.charCodeAt(i_str);
        ofs8 += 2;
      } else {
        out_buffer[ofs8 + 1] = str.charCodeAt(i_str);
      }
    }
  };
  const general_cfg = this.is_atapi ? 34112 : 64;
  const multiword_dma_mode = this.current_command === ATA_CMD_PACKET ? 0 : 1031;
  const major_version = 0;
  const feat_82 = this.is_atapi ? 1 << 14 | 1 << 9 | 1 << 5 : 1 << 14;
  const feat_83 = this.is_atapi ? 1 << 14 | 1 << 12 : 1 << 14 | 1 << 13 | 1 << 12 | 1 << 10;
  const feat_84 = this.is_atapi ? 1 << 14 : 1 << 14;
  this.data.fill(0, 0, 512);
  this.data_set([
    // 0: General configuration
    general_cfg & 255,
    general_cfg >> 8 & 255,
    // 1: Number of cylinders
    cylinder_count & 255,
    cylinder_count >> 8 & 255,
    // 2: reserved
    0,
    0,
    // 3: Number of heads
    this.head_count & 255,
    this.head_count >> 8 & 255,
    // 4: Number of unformatted bytes per track
    this.sectors_per_track / 512 & 255,
    this.sectors_per_track / 512 >> 8 & 255,
    // 5: Number of unformatted bytes per sector
    0,
    512 >> 8,
    // 6: Number of sectors per track
    this.sectors_per_track & 255,
    this.sectors_per_track >> 8 & 255,
    // 7-9: Vendor-unique
    0,
    0,
    0,
    0,
    0,
    0,
    // 10-19: Serial number (20 ASCII characters, filled below)
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 20: Buffer type
    3,
    0,
    // 21: Buffer size in 512 byte increments
    0,
    2,
    // 22: Number of ECC bytes avail on read/write long cmds
    4,
    0,
    // 23-26: Firmware revision (8 ASCII characters, filled below)
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 27-46: Model number (40 ASCII characters, filled below)
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 47: Max. number of sectors per interrupt on read/write multiple commands (1st byte) and Vendor-unique (2nd)
    128,
    0,
    // 48: Indicates whether can perform doubleword I/O (1st byte) [0: no, 1: yes]
    1,
    0,
    // 49: Vendor-unique (1st byte) and Capabilities (2nd) [2: Only LBA, 3: LBA and DMA]
    0,
    2,
    // 50: reserved
    0,
    0,
    // 51: PIO data transfer cycle timing mode
    0,
    2,
    // 52: DMA data transfer cycle timing mode
    0,
    2,
    // 53: Indicates whether fields 54-58 are valid (1st byte) [0: no, 1: yes]
    7,
    0,
    // 54: Number of current cylinders
    cylinder_count & 255,
    cylinder_count >> 8 & 255,
    // 55: Number of current heads
    this.head_count & 255,
    this.head_count >> 8 & 255,
    // 56: Number of current sectors per track
    this.sectors_per_track,
    0,
    // 57-58: Current capacity in sectors
    this.sector_count & 255,
    this.sector_count >> 8 & 255,
    this.sector_count >> 16 & 255,
    this.sector_count >> 24 & 255,
    // 59:  Multiple sector setting
    0,
    0,
    // 60-61: Total number of user addressable sectors (LBA mode only)
    this.sector_count & 255,
    this.sector_count >> 8 & 255,
    this.sector_count >> 16 & 255,
    this.sector_count >> 24 & 255,
    // 62: Single word DMA transfer mode
    0,
    0,
    // 63: Multiword DMA transfer mode (DMA supported mode, DMA selected mode)
    multiword_dma_mode & 255,
    multiword_dma_mode >> 8 & 255,
    // 64: PIO modes supported
    0,
    0,
    // 65-68: fields related to cycle-time
    30,
    0,
    30,
    0,
    30,
    0,
    30,
    0,
    // 69-74: reserved
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 75: Queue depth
    0,
    0,
    // 76-79: reserved
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 80: Major version number
    major_version & 255,
    major_version >> 8 & 255,
    // 81: Minor version number
    0,
    0,
    // 82: Command set supported
    feat_82 & 255,
    feat_82 >> 8 & 255,
    // 83: Command set supported
    feat_83 & 255,
    feat_83 >> 8 & 255,
    // 84: Command set/feature supported extension
    feat_84 & 255,
    feat_84 >> 8 & 255,
    // 85: Command set/feature enabled (copy of 82)
    feat_82 & 255,
    feat_82 >> 8 & 255,
    // 86: Command set/feature enabled (copy of 83)
    feat_83 & 255,
    feat_83 >> 8 & 255,
    // 87: Command set/feature default (copy of 84)
    feat_84 & 255,
    feat_84 >> 8 & 255,
    // 88: DMA related field
    0,
    0,
    // 89: Time required for security erase unit completion
    0,
    0,
    // 90: Time required for Enhanced security erase completion
    0,
    0,
    // 91: Current advanced power management value
    0,
    0,
    // 92: Master Password Revision Code
    0,
    0,
    // 93: Hardware reset result
    1,
    96,
    // 94: Acoustic management value
    0,
    0,
    // 95-99: reserved
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 100-101: Maximum user LBA for 48-bit Address feature set.
    this.sector_count & 255,
    this.sector_count >> 8 & 255,
    this.sector_count >> 16 & 255,
    this.sector_count >> 24 & 255
  ]);
  strcpy_be16(this.data, 10, 10, `8086-86${this.channel_nr}${this.interface_nr}`);
  strcpy_be16(this.data, 23, 4, "1.00");
  strcpy_be16(this.data, 27, 20, this.is_atapi ? "v86 ATAPI CD-ROM" : "v86 ATA HD");
  this.data_length = 512;
  this.data_end = 512;
};
IDEInterface.prototype.data_allocate = function(len) {
  this.data_allocate_noclear(len);
  this.data32.fill(0, 0, len + 3 >> 2);
};
IDEInterface.prototype.data_allocate_noclear = function(len) {
  if (this.data.length < len) {
    this.data = new Uint8Array(len + 3 & ~3);
    this.data16 = new Uint16Array(this.data.buffer);
    this.data32 = new Int32Array(this.data.buffer);
  }
  this.data_length = len;
  this.data_pointer = 0;
};
IDEInterface.prototype.data_set = function(data) {
  this.data_allocate_noclear(data.length);
  this.data.set(data);
};
IDEInterface.prototype.report_read_start = function() {
  this.bus.send("ide-read-start");
};
IDEInterface.prototype.report_read_end = function(byte_count) {
  const sector_count = byte_count / this.sector_size | 0;
  this.bus.send("ide-read-end", [this.channel_nr, byte_count, sector_count]);
};
IDEInterface.prototype.report_write = function(byte_count) {
  const sector_count = byte_count / this.sector_size | 0;
  this.bus.send("ide-write-end", [this.channel_nr, byte_count, sector_count]);
};
IDEInterface.prototype.read_buffer = function(start, length, callback) {
  const id = this.last_io_id++;
  this.in_progress_io_ids.add(id);
  this.buffer.get(start, length, (data) => {
    if (this.cancelled_io_ids.delete(id)) {
      dbg_assert(!this.in_progress_io_ids.has(id));
      return;
    }
    const removed = this.in_progress_io_ids.delete(id);
    dbg_assert(removed);
    callback(data);
  });
};
IDEInterface.prototype.cancel_io_operations = function() {
  for (const id of this.in_progress_io_ids) {
    this.cancelled_io_ids.add(id);
  }
  this.in_progress_io_ids.clear();
};
IDEInterface.prototype.get_state = function() {
  var state = [];
  state[0] = this.sector_count_reg;
  state[1] = this.cylinder_count;
  state[2] = this.lba_high_reg;
  state[3] = this.lba_mid_reg;
  state[4] = this.data_pointer;
  state[5] = 0;
  state[6] = 0;
  state[7] = 0;
  state[8] = 0;
  state[9] = this.device_reg;
  state[10] = this.error_reg;
  state[11] = this.head;
  state[12] = this.head_count;
  state[13] = this.is_atapi;
  state[14] = this.is_lba;
  state[15] = this.features_reg;
  state[16] = this.data;
  state[17] = this.data_length;
  state[18] = this.lba_low_reg;
  state[19] = this.sector_count;
  state[20] = this.sector_size;
  state[21] = this.sectors_per_drq;
  state[22] = this.sectors_per_track;
  state[23] = this.status_reg;
  state[24] = this.write_dest;
  state[25] = this.current_command;
  state[26] = this.data_end;
  state[27] = this.current_atapi_command;
  state[28] = this.buffer;
  return state;
};
IDEInterface.prototype.set_state = function(state) {
  this.sector_count_reg = state[0];
  this.cylinder_count = state[1];
  this.lba_high_reg = state[2];
  this.lba_mid_reg = state[3];
  this.data_pointer = state[4];
  this.device_reg = state[9];
  this.error_reg = state[10];
  this.head = state[11];
  this.head_count = state[12];
  this.is_atapi = state[13];
  this.is_lba = state[14];
  this.features_reg = state[15];
  this.data = state[16];
  this.data_length = state[17];
  this.lba_low_reg = state[18];
  this.sector_count = state[19];
  this.sector_size = state[20];
  this.sectors_per_drq = state[21];
  this.sectors_per_track = state[22];
  this.status_reg = state[23];
  this.write_dest = state[24];
  this.current_command = state[25];
  this.data_end = state[26];
  this.current_atapi_command = state[27];
  this.data16 = new Uint16Array(this.data.buffer);
  this.data32 = new Int32Array(this.data.buffer);
  this.buffer && this.buffer.set_state(state[28]);
  this.drive_connected = this.is_atapi || this.buffer;
  this.medium_changed = false;
};

// src/lapic_stub.js
var LAPIC_ID = 32;
var LAPIC_VERSION = 48;
var LAPIC_TPR = 128;
var LAPIC_EOI = 176;
var LAPIC_LDR = 208;
var LAPIC_DFR = 224;
var LAPIC_SVR = 240;
var LAPIC_ESR = 640;
var LAPIC_ICR_LO = 768;
var LAPIC_ICR_HI = 784;
var LAPIC_LVT_TIMER = 800;
var LAPIC_LVT_THERMAL = 816;
var LAPIC_LVT_PERF = 832;
var LAPIC_LVT_LINT0 = 848;
var LAPIC_LVT_LINT1 = 864;
var LAPIC_LVT_ERROR = 880;
var LAPIC_TIMER_ICR = 896;
var LAPIC_TIMER_CCR = 912;
var LAPIC_TIMER_DCR = 992;
var F_APIC_ID = 0;
var F_TIMER_DIVIDER = 1;
var F_TIMER_DIVIDER_SHIFT = 2;
var F_TIMER_INITIAL_COUNT = 3;
var F_TIMER_CURRENT_COUNT = 4;
var F_TIMER_LAST_TICK_BYTE = 24;
var F_LVT_TIMER = 8;
var F_LVT_PERF = 9;
var F_LVT_INT0 = 10;
var F_LVT_INT1 = 11;
var F_LVT_ERROR = 12;
var F_TPR = 13;
var F_ICR0 = 14;
var F_ICR1 = 15;
var F_IRR_BASE = 16;
var F_ISR_BASE = 24;
var F_TMR_BASE = 32;
var F_SVR = 40;
var F_DFR = 41;
var F_LDR = 42;
var F_ERROR = 43;
var F_READ_ERROR = 44;
var F_LVT_THERMAL = 45;
var IOAPIC_CONFIG_MASKED = 65536;
var APIC_TIMER_FREQ = 1 * 1e3 * 1e3;
var APIC_TIMER_MODE_MASK = 3 << 17;
var APIC_TIMER_MODE_PERIODIC = 1 << 17;
function lapic_read32(apic32, apicF64, offset) {
  switch (offset) {
    case LAPIC_ID:
      return apic32[F_APIC_ID];
    case LAPIC_VERSION:
      return 327700;
    // same as Rust
    case LAPIC_TPR:
      return apic32[F_TPR];
    case LAPIC_EOI:
      return 0;
    // write-only
    case LAPIC_LDR:
      return apic32[F_LDR];
    case LAPIC_DFR:
      return apic32[F_DFR];
    case LAPIC_SVR:
      return apic32[F_SVR];
    // ISR registers 0x100..0x170
    case 256:
    case 272:
    case 288:
    case 304:
    case 320:
    case 336:
    case 352:
    case 368:
      return apic32[F_ISR_BASE + (offset - 256 >> 4)];
    // TMR registers 0x180..0x1F0
    case 384:
    case 400:
    case 416:
    case 432:
    case 448:
    case 464:
    case 480:
    case 496:
      return apic32[F_TMR_BASE + (offset - 384 >> 4)];
    // IRR registers 0x200..0x270
    case 512:
    case 528:
    case 544:
    case 560:
    case 576:
    case 592:
    case 608:
    case 624:
      return apic32[F_IRR_BASE + (offset - 512 >> 4)];
    case LAPIC_ESR:
      return apic32[F_READ_ERROR];
    case LAPIC_ICR_LO:
      return apic32[F_ICR0];
    case LAPIC_ICR_HI:
      return apic32[F_ICR1];
    case LAPIC_LVT_TIMER:
      return apic32[F_LVT_TIMER];
    case LAPIC_LVT_THERMAL:
      return apic32[F_LVT_THERMAL];
    case LAPIC_LVT_PERF:
      return apic32[F_LVT_PERF];
    case LAPIC_LVT_LINT0:
      return apic32[F_LVT_INT0];
    case LAPIC_LVT_LINT1:
      return apic32[F_LVT_INT1];
    case LAPIC_LVT_ERROR:
      return apic32[F_LVT_ERROR];
    case LAPIC_TIMER_DCR:
      return apic32[F_TIMER_DIVIDER];
    case LAPIC_TIMER_ICR:
      return apic32[F_TIMER_INITIAL_COUNT];
    case LAPIC_TIMER_CCR: {
      const now = v86.microtick();
      const last_tick = apicF64[0];
      if (last_tick > now) return apic32[F_TIMER_INITIAL_COUNT];
      const diff = now - last_tick;
      const shift = apic32[F_TIMER_DIVIDER_SHIFT];
      const diff_in_ticks = diff * APIC_TIMER_FREQ / (1 << shift) >>> 0;
      const initial = apic32[F_TIMER_INITIAL_COUNT] >>> 0;
      if (diff_in_ticks < initial) {
        return initial - diff_in_ticks | 0;
      }
      const mode = apic32[F_LVT_TIMER] & APIC_TIMER_MODE_MASK;
      if (mode === APIC_TIMER_MODE_PERIODIC) {
        return initial - diff_in_ticks % (initial + 1) | 0;
      }
      return 0;
    }
    default:
      dbg_log("LAPIC stub: unhandled read offset 0x" + offset.toString(16));
      return 0;
  }
}
function register_get_highest_bit(apic32, base_index) {
  for (let i = 7; i >= 0; i--) {
    const word = apic32[base_index + i] >>> 0;
    if (word !== 0) {
      return i << 5 | 31 - Math.clz32(word);
    }
  }
  return -1;
}
function register_get_bit(apic32, base_index, bit) {
  return (apic32[base_index + (bit >> 5)] & 1 << (bit & 31)) !== 0;
}
function register_set_bit(apic32, base_index, bit) {
  apic32[base_index + (bit >> 5)] |= 1 << (bit & 31);
}
function register_clear_bit(apic32, base_index, bit) {
  apic32[base_index + (bit >> 5)] &= ~(1 << (bit & 31));
}
function lapic_write32(cpu, apic32, apicF64, offset, value) {
  switch (offset) {
    case LAPIC_ID:
      apic32[F_APIC_ID] = value;
      break;
    case LAPIC_VERSION:
      break;
    case LAPIC_TPR:
      apic32[F_TPR] = value & 255;
      break;
    case LAPIC_EOI: {
      const highest = register_get_highest_bit(apic32, F_ISR_BASE);
      if (highest >= 0) {
        register_clear_bit(apic32, F_ISR_BASE, highest);
      }
      break;
    }
    case LAPIC_LDR:
      apic32[F_LDR] = value & 4278190080;
      break;
    case LAPIC_DFR:
      apic32[F_DFR] = value | 268435455;
      break;
    case LAPIC_SVR:
      apic32[F_SVR] = value;
      break;
    case LAPIC_ESR:
      apic32[F_READ_ERROR] = apic32[F_ERROR];
      apic32[F_ERROR] = 0;
      break;
    case LAPIC_ICR_LO: {
      const vector = value & 255;
      const delivery_mode = value >> 8 & 7;
      const destination_shorthand = value >> 18 & 3;
      let cleared = value & ~(1 << 12);
      apic32[F_ICR0] = cleared;
      if (destination_shorthand === 1 || destination_shorthand === 2) {
        if (delivery_mode === 0 && vector >= 16 && vector !== 255) {
          if (!register_get_bit(apic32, F_IRR_BASE, vector)) {
            register_set_bit(apic32, F_IRR_BASE, vector);
          }
          cpu.handle_irqs();
        }
      }
      break;
    }
    case LAPIC_ICR_HI:
      apic32[F_ICR1] = value;
      break;
    case LAPIC_LVT_TIMER:
      apic32[F_LVT_TIMER] = value;
      break;
    case LAPIC_LVT_THERMAL:
      apic32[F_LVT_THERMAL] = value;
      break;
    case LAPIC_LVT_PERF:
      apic32[F_LVT_PERF] = value;
      break;
    case LAPIC_LVT_LINT0:
      apic32[F_LVT_INT0] = value;
      break;
    case LAPIC_LVT_LINT1:
      apic32[F_LVT_INT1] = value;
      break;
    case LAPIC_LVT_ERROR:
      apic32[F_LVT_ERROR] = value;
      break;
    case LAPIC_TIMER_DCR: {
      apic32[F_TIMER_DIVIDER] = value;
      const divide_shift = value & 3 | (value & 8) >> 1;
      apic32[F_TIMER_DIVIDER_SHIFT] = divide_shift === 7 ? 0 : divide_shift + 1;
      break;
    }
    case LAPIC_TIMER_ICR: {
      apic32[F_TIMER_INITIAL_COUNT] = value;
      apic32[F_TIMER_CURRENT_COUNT] = value;
      apicF64[0] = v86.microtick();
      break;
    }
    case LAPIC_TIMER_CCR:
      break;
    default:
      dbg_log("LAPIC stub: unhandled write offset 0x" + offset.toString(16) + " value=0x" + (value >>> 0).toString(16));
      break;
  }
}
function register_lapic_mmio(cpu, io) {
  const apic_base_addr = cpu.get_apic_addr();
  const wasm_buf = cpu.wasm_memory.buffer;
  const apic32 = new Int32Array(wasm_buf, apic_base_addr, 46);
  const apicF64 = new Float64Array(wasm_buf, apic_base_addr + F_TIMER_LAST_TICK_BYTE, 1);
  if (apic32[F_SVR] === 0) {
    apic32[F_SVR] = 254;
  }
  if (apic32[F_LVT_TIMER] === 0) {
    apic32[F_LVT_TIMER] = IOAPIC_CONFIG_MASKED;
  }
  io.mmap_register(
    4276092928,
    MMAP_BLOCK_SIZE,
    // 0x20000 = 128 KB (minimum MMIO block)
    // read8
    function lapic_read8(addr) {
      const offset = addr & 4095;
      const aligned = offset & ~3;
      const val32 = lapic_read32(apic32, apicF64, aligned);
      return val32 >>> 8 * (offset & 3) & 255;
    },
    // write8 — LAPIC registers are 32-bit; byte writes are unusual, ignore
    function lapic_write8(addr, value) {
    },
    // read32
    function lapic_read32_handler(addr) {
      const offset = addr & 4095;
      return lapic_read32(apic32, apicF64, offset) | 0;
    },
    // write32
    function lapic_write32_handler(addr, value) {
      const offset = addr & 4095;
      lapic_write32(cpu, apic32, apicF64, offset, value);
    }
  );
  dbg_log("LAPIC MMIO stub registered at 0xFEE00000 (JS fallback)");
}

// src/ahci_protocol.js
var FIS_TYPE_REG_D2H = 52;
var FIS_TYPE_DEV_BITS = 161;
var ATA_CMD_READ_DMA2 = 200;
var ATA_CMD_READ_DMA_EXT2 = 37;
var ATA_CMD_WRITE_DMA2 = 202;
var ATA_CMD_WRITE_DMA_EXT2 = 53;
var ATA_CMD_READ_FPDMA = 96;
var ATA_CMD_WRITE_FPDMA = 97;
var ATA_CMD_IDENTIFY = 236;
var ATA_CMD_IDENTIFY_PACKET = 161;
var ATA_CMD_READ_SECTORS2 = 32;
var ATA_CMD_READ_SECTORS_EXT2 = 36;
var ATA_CMD_WRITE_SECTORS2 = 48;
var ATA_CMD_WRITE_SECTORS_EXT2 = 52;
var ATA_CMD_FLUSH_CACHE2 = 231;
var ATA_CMD_FLUSH_CACHE_EXT2 = 234;
var ATA_STATUS_ERR = 1 << 0;
var ATA_STATUS_DRQ = 1 << 3;
var ATA_STATUS_DSC = 1 << 4;
var ATA_STATUS_DF = 1 << 5;
var ATA_STATUS_DRDY = 1 << 6;
var ATA_STATUS_BSY = 1 << 7;
var CMD_HDR_WRITE = 1 << 6;
var CMD_HDR_ATAPI = 1 << 5;
var CMD_HDR_RESET = 1 << 8;
var CMD_HDR_BIST = 1 << 9;
var CMD_HDR_CLR_BSY = 1 << 10;
var AHCICommandHeader = class {
  constructor(slot, buffer, offset) {
    this.slot = slot;
    this.buffer = buffer;
    this.offset = offset;
  }
  // Command and Control flags (bits 0-15)
  get flags() {
    return this.buffer[this.offset] | this.buffer[this.offset + 1] << 8;
  }
  set flags(value) {
    this.buffer[this.offset] = value & 255;
    this.buffer[this.offset + 1] = value >> 8 & 255;
  }
  // Command FIS length in DWORDs (bits 0-4 of first byte)
  get cfl() {
    return this.flags & 31;
  }
  // Physical Region Descriptor Table Length (bytes 2-3)
  get prdtl() {
    return this.buffer[this.offset + 2] | this.buffer[this.offset + 3] << 8;
  }
  set prdtl(value) {
    this.buffer[this.offset + 2] = value & 255;
    this.buffer[this.offset + 3] = value >> 8 & 255;
  }
  // Physical Region Descriptor Byte Count (bytes 4-7)
  get prdbc() {
    return this.buffer[this.offset + 4] | this.buffer[this.offset + 5] << 8 | this.buffer[this.offset + 6] << 16 | this.buffer[this.offset + 7] << 24;
  }
  set prdbc(value) {
    this.buffer[this.offset + 4] = value & 255;
    this.buffer[this.offset + 5] = value >> 8 & 255;
    this.buffer[this.offset + 6] = value >> 16 & 255;
    this.buffer[this.offset + 7] = value >> 24 & 255;
  }
  // Command Table Base Address (bytes 8-15, 64-bit)
  get ctba() {
    const low = this.buffer[this.offset + 8] | this.buffer[this.offset + 9] << 8 | this.buffer[this.offset + 10] << 16 | this.buffer[this.offset + 11] << 24;
    const high = this.buffer[this.offset + 12] | this.buffer[this.offset + 13] << 8 | this.buffer[this.offset + 14] << 16 | this.buffer[this.offset + 15] << 24;
    return { low, high };
  }
  set ctba(value) {
    this.buffer[this.offset + 8] = value.low & 255;
    this.buffer[this.offset + 9] = value.low >> 8 & 255;
    this.buffer[this.offset + 10] = value.low >> 16 & 255;
    this.buffer[this.offset + 11] = value.low >> 24 & 255;
    this.buffer[this.offset + 12] = value.high & 255;
    this.buffer[this.offset + 13] = value.high >> 8 & 255;
    this.buffer[this.offset + 14] = value.high >> 16 & 255;
    this.buffer[this.offset + 15] = value.high >> 24 & 255;
  }
};
var PRDTEntry = class {
  constructor(buffer, offset) {
    this.buffer = buffer;
    this.offset = offset;
  }
  // Data Base Address (bytes 0-7, 64-bit)
  get dba() {
    const low = this.buffer[this.offset + 0] | this.buffer[this.offset + 1] << 8 | this.buffer[this.offset + 2] << 16 | this.buffer[this.offset + 3] << 24;
    const high = this.buffer[this.offset + 4] | this.buffer[this.offset + 5] << 8 | this.buffer[this.offset + 6] << 16 | this.buffer[this.offset + 7] << 24;
    return { low, high };
  }
  // Data Byte Count (bytes 12-15)
  get dbc() {
    const value = this.buffer[this.offset + 12] | this.buffer[this.offset + 13] << 8 | this.buffer[this.offset + 14] << 16 | this.buffer[this.offset + 15] << 24;
    return (value & 4194303) + 1;
  }
  // Interrupt on Completion
  get i() {
    return !!(this.buffer[this.offset + 15] & 128);
  }
};
var RegisterFIS_H2D = class {
  constructor(buffer, offset) {
    this.buffer = buffer;
    this.offset = offset;
  }
  get fis_type() {
    return this.buffer[this.offset + 0];
  }
  get flags() {
    return this.buffer[this.offset + 1];
  }
  get command() {
    return this.buffer[this.offset + 2];
  }
  get features() {
    return this.buffer[this.offset + 3];
  }
  get lba_low() {
    return this.buffer[this.offset + 4];
  }
  get lba_mid() {
    return this.buffer[this.offset + 5];
  }
  get lba_high() {
    return this.buffer[this.offset + 6];
  }
  get device() {
    return this.buffer[this.offset + 7];
  }
  get lba_low_exp() {
    return this.buffer[this.offset + 8];
  }
  get lba_mid_exp() {
    return this.buffer[this.offset + 9];
  }
  get lba_high_exp() {
    return this.buffer[this.offset + 10];
  }
  get features_exp() {
    return this.buffer[this.offset + 11];
  }
  get count() {
    return this.buffer[this.offset + 12] | this.buffer[this.offset + 13] << 8;
  }
  get control() {
    return this.buffer[this.offset + 15];
  }
  // Get 48-bit LBA
  get lba48() {
    return this.lba_low | this.lba_mid << 8 | this.lba_high << 16 | this.lba_low_exp << 24 | this.lba_mid_exp << 32 | this.lba_high_exp << 40;
  }
  // Get 28-bit LBA  
  get lba28() {
    return this.lba_low | this.lba_mid << 8 | this.lba_high << 16 | (this.device & 15) << 24;
  }
  // Check if this is a command FIS (C bit set)
  get is_command() {
    return !!(this.flags & 128);
  }
};
var RegisterFIS_D2H = class {
  constructor(buffer, offset) {
    this.buffer = buffer;
    this.offset = offset;
  }
  set fis_type(value) {
    this.buffer[this.offset + 0] = value;
  }
  set flags(value) {
    this.buffer[this.offset + 1] = value;
  }
  set status(value) {
    this.buffer[this.offset + 2] = value;
  }
  set error(value) {
    this.buffer[this.offset + 3] = value;
  }
  set lba_low(value) {
    this.buffer[this.offset + 4] = value;
  }
  set lba_mid(value) {
    this.buffer[this.offset + 5] = value;
  }
  set lba_high(value) {
    this.buffer[this.offset + 6] = value;
  }
  set device(value) {
    this.buffer[this.offset + 7] = value;
  }
  set lba_low_exp(value) {
    this.buffer[this.offset + 8] = value;
  }
  set lba_mid_exp(value) {
    this.buffer[this.offset + 9] = value;
  }
  set lba_high_exp(value) {
    this.buffer[this.offset + 10] = value;
  }
  set count(value) {
    this.buffer[this.offset + 12] = value & 255;
    this.buffer[this.offset + 13] = value >> 8 & 255;
  }
  // Clear the FIS buffer
  clear() {
    for (let i = 0; i < 20; i++) {
      this.buffer[this.offset + i] = 0;
    }
  }
  // Create successful command completion FIS
  set_success(lba, count) {
    this.clear();
    this.fis_type = FIS_TYPE_REG_D2H;
    this.flags = 64;
    this.status = ATA_STATUS_DRDY | ATA_STATUS_DSC;
    this.error = 0;
    if (typeof lba === "number") {
      this.lba_low = lba & 255;
      this.lba_mid = lba >> 8 & 255;
      this.lba_high = lba >> 16 & 255;
      this.lba_low_exp = lba >> 24 & 255;
      this.lba_mid_exp = lba >> 32 & 255;
      this.lba_high_exp = lba >> 40 & 255;
    }
    if (typeof count === "number") {
      this.count = count;
    }
  }
  // Create error FIS
  set_error(error_code, status = ATA_STATUS_DRDY | ATA_STATUS_ERR) {
    this.clear();
    this.fis_type = FIS_TYPE_REG_D2H;
    this.flags = 64;
    this.status = status;
    this.error = error_code;
  }
};
var AHCICommandProcessor = class {
  constructor(controller, port_num) {
    this.controller = controller;
    this.port_num = port_num;
    this.port = controller.ports[port_num];
    this.disk_size = 1024 * 1024 * 1024;
    this.sector_size = 512;
    this.virtual_disk = null;
    this.smp_memory_manager = controller.smp_memory_manager;
    this.dma_manager = controller.dma_manager;
    dbg_log("AHCI Command Processor initialized for port " + port_num, LOG_DISK);
  }
  /**
   * Process a command synchronously — reads FIS, executes ATA command against the
   * RAM-backed virtual disk, writes results back to guest memory, and calls
   * complete_command_success/error — all in the same call stack, before returning.
   *
   * This is required for correct operation inside v86: the x86 guest busy-polls
   * port->ci in a while(1) loop (ahci.c:681).  v86 is a single-threaded JS
   * runtime — a Promise/setTimeout-based completion path can never fire while the
   * CPU simulation loop is running, causing the guest to spin forever.
   *
   * The async process_command() path is kept as a fallback for future network-
   * backed storage (e.g. Durable Objects), but the default path is sync.
   *
   * @param {number} slot - Command slot number
   */
  process_command_sync(slot) {
    dbg_log("AHCI Port " + this.port_num + ": [sync] Processing command slot " + slot, LOG_DISK);
    try {
      const cmd_header = this.get_command_header(slot);
      if (!cmd_header) {
        dbg_log("AHCI Port " + this.port_num + ": Invalid command header for slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      const cmd_table = this.get_command_table(cmd_header);
      if (!cmd_table) {
        dbg_log("AHCI Port " + this.port_num + ": Invalid command table for slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      const cmd_fis = new RegisterFIS_H2D(cmd_table, 0);
      if (!cmd_fis.is_command) {
        dbg_log("AHCI Port " + this.port_num + ": Not a command FIS in slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      this.execute_ata_command_sync(slot, cmd_fis, cmd_header);
    } catch (error) {
      dbg_log("AHCI Port " + this.port_num + ": Error in sync command slot " + slot + ": " + error.message, LOG_DISK);
      this.complete_command_with_error(slot, 4);
    }
  }
  /**
   * Execute ATA command synchronously.
   * @param {number} slot
   * @param {RegisterFIS_H2D} cmd_fis
   * @param {AHCICommandHeader} cmd_header
   */
  execute_ata_command_sync(slot, cmd_fis, cmd_header) {
    const command = cmd_fis.command;
    dbg_log("AHCI Port " + this.port_num + ": [sync] ATA command " + h(command) + " slot " + slot, LOG_DISK);
    switch (command) {
      case ATA_CMD_IDENTIFY:
      case ATA_CMD_IDENTIFY_PACKET:
        this.cmd_identify_sync(slot, cmd_header);
        break;
      case ATA_CMD_READ_DMA2:
      case ATA_CMD_READ_DMA_EXT2:
      case ATA_CMD_READ_SECTORS2:
      case ATA_CMD_READ_SECTORS_EXT2:
        this.cmd_read_dma_sync(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_WRITE_DMA2:
      case ATA_CMD_WRITE_DMA_EXT2:
      case ATA_CMD_WRITE_SECTORS2:
      case ATA_CMD_WRITE_SECTORS_EXT2:
        this.cmd_write_dma_sync(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_READ_FPDMA:
      case ATA_CMD_WRITE_FPDMA:
        if (command === ATA_CMD_READ_FPDMA) {
          this.cmd_read_dma_sync(slot, cmd_fis, cmd_header);
        } else {
          this.cmd_write_dma_sync(slot, cmd_fis, cmd_header);
        }
        break;
      case ATA_CMD_FLUSH_CACHE2:
      case ATA_CMD_FLUSH_CACHE_EXT2:
        this.complete_command_success(slot);
        break;
      default:
        dbg_log("AHCI Port " + this.port_num + ": Unsupported ATA command " + h(command), LOG_DISK);
        this.complete_command_with_error(slot, 4);
        break;
    }
  }
  /**
   * IDENTIFY DEVICE — synchronous version.
   */
  cmd_identify_sync(slot, cmd_header) {
    dbg_log("AHCI Port " + this.port_num + ": [sync] IDENTIFY DEVICE", LOG_DISK);
    const identify_data = new Uint16Array(256);
    const disk_sectors = Math.floor(this.disk_size / this.sector_size);
    identify_data[0] = 64;
    identify_data[1] = 16383;
    identify_data[3] = 16;
    identify_data[6] = 63;
    identify_data[10] = 30264;
    identify_data[11] = 13889;
    identify_data[12] = 18499;
    identify_data[13] = 18756;
    identify_data[14] = 26995;
    identify_data[15] = 27424;
    identify_data[16] = 8224;
    identify_data[17] = 8224;
    identify_data[18] = 8224;
    identify_data[19] = 8224;
    identify_data[27] = 30264;
    identify_data[28] = 13856;
    identify_data[29] = 16712;
    identify_data[30] = 17225;
    identify_data[31] = 8260;
    identify_data[32] = 26995;
    identify_data[33] = 27424;
    identify_data[34] = 8224;
    identify_data[35] = 8224;
    identify_data[36] = 8224;
    identify_data[37] = 8224;
    identify_data[38] = 8224;
    identify_data[39] = 8224;
    identify_data[40] = 8224;
    identify_data[41] = 8224;
    identify_data[42] = 8224;
    identify_data[43] = 8224;
    identify_data[44] = 8224;
    identify_data[45] = 8224;
    identify_data[46] = 8224;
    identify_data[47] = 32769;
    identify_data[49] = 512;
    identify_data[53] = 6;
    identify_data[60] = disk_sectors & 65535;
    identify_data[61] = disk_sectors >> 16 & 65535;
    identify_data[76] = 2;
    identify_data[77] = 0;
    identify_data[80] = 126;
    identify_data[83] = 16384;
    identify_data[86] = 16384;
    identify_data[100] = disk_sectors & 65535;
    identify_data[101] = disk_sectors >> 16 & 65535;
    identify_data[102] = 0;
    identify_data[103] = 0;
    const identify_bytes = new Uint8Array(identify_data.buffer);
    const prdt_entries = this.get_prdt_entries(cmd_header);
    if (prdt_entries.length > 0) {
      const entry = prdt_entries[0];
      const dest_addr = entry.dba.low;
      const xfer_size = Math.min(512, entry.dbc);
      const mem8 = this.controller.cpu.mem8;
      for (let i = 0; i < xfer_size; i++) {
        mem8[dest_addr + i] = identify_bytes[i];
      }
      cmd_header.prdbc = xfer_size;
    }
    this.complete_command_success(slot);
  }
  /**
   * READ DMA — synchronous, directly accesses virtual_disk.data buffer.
   *
   * DMA transfer capping (AHCI spec §4.2.3.3):
   *   Each PRDT entry's DBC field specifies the maximum byte count the HBA
   *   may write to the address in DBA.  The total bytes transferred across
   *   all PRDT entries must not exceed the command's sector count × 512.
   *   Per-entry DBC is the hard upper bound.
   */
  cmd_read_dma_sync(slot, cmd_fis, cmd_header) {
    const is_ext = cmd_fis.command === ATA_CMD_READ_DMA_EXT2 || cmd_fis.command === ATA_CMD_READ_FPDMA || cmd_fis.command === ATA_CMD_READ_SECTORS_EXT2;
    const lba = is_ext ? cmd_fis.lba48 : cmd_fis.lba28;
    const count = cmd_fis.count === 0 ? is_ext ? 65536 : 256 : cmd_fis.count;
    dbg_log("AHCI Port " + this.port_num + ": [sync] READ LBA=" + lba + " count=" + count, LOG_DISK);
    const disk = this.virtual_disk;
    if (!disk || !disk.data) {
      dbg_log("AHCI Port " + this.port_num + ": No RAM disk for READ DMA", LOG_DISK);
      this.complete_command_with_error(slot, 4);
      return;
    }
    const disk_offset = lba * this.sector_size;
    const transfer_size = count * this.sector_size;
    const mem8 = this.controller.cpu.mem8;
    const prdt_entries = this.get_prdt_entries(cmd_header);
    let transferred = 0;
    let disk_pos = disk_offset;
    for (const entry of prdt_entries) {
      const entry_limit = entry.dbc;
      const remaining = transfer_size - transferred;
      const size = Math.min(entry_limit, remaining);
      if (size <= 0) break;
      const memory_addr = entry.dba.low;
      const src_end = Math.min(disk_pos + size, disk.data.length);
      const copy_len = src_end - disk_pos;
      if (copy_len > 0) {
        mem8.set(disk.data.subarray(disk_pos, src_end), memory_addr);
      }
      if (copy_len < size) {
        mem8.fill(0, memory_addr + copy_len, memory_addr + size);
      }
      transferred += size;
      disk_pos += size;
      if (transferred >= transfer_size) break;
    }
    cmd_header.prdbc = transferred;
    this.complete_command_success(slot, lba, count);
  }
  /**
   * WRITE DMA — synchronous, directly accesses virtual_disk.data buffer.
   *
   * Per-entry DBC capping applies symmetrically to writes.
   */
  cmd_write_dma_sync(slot, cmd_fis, cmd_header) {
    const is_ext = cmd_fis.command === ATA_CMD_WRITE_DMA_EXT2 || cmd_fis.command === ATA_CMD_WRITE_FPDMA || cmd_fis.command === ATA_CMD_WRITE_SECTORS_EXT2;
    const lba = is_ext ? cmd_fis.lba48 : cmd_fis.lba28;
    const count = cmd_fis.count === 0 ? is_ext ? 65536 : 256 : cmd_fis.count;
    dbg_log("AHCI Port " + this.port_num + ": [sync] WRITE LBA=" + lba + " count=" + count, LOG_DISK);
    const disk = this.virtual_disk;
    if (!disk || !disk.data) {
      dbg_log("AHCI Port " + this.port_num + ": No RAM disk for WRITE DMA", LOG_DISK);
      this.complete_command_with_error(slot, 4);
      return;
    }
    const disk_offset = lba * this.sector_size;
    const transfer_size = count * this.sector_size;
    const mem8 = this.controller.cpu.mem8;
    const prdt_entries = this.get_prdt_entries(cmd_header);
    let transferred = 0;
    let disk_pos = disk_offset;
    for (const entry of prdt_entries) {
      const entry_limit = entry.dbc;
      const remaining = transfer_size - transferred;
      const size = Math.min(entry_limit, remaining);
      if (size <= 0) break;
      const memory_addr = entry.dba.low;
      const dest_end = Math.min(disk_pos + size, disk.data.length);
      const copy_len = dest_end - disk_pos;
      if (copy_len > 0) {
        disk.data.set(mem8.subarray(memory_addr, memory_addr + copy_len), disk_pos);
      }
      transferred += size;
      disk_pos += size;
      if (transferred >= transfer_size) break;
    }
    cmd_header.prdbc = transferred;
    this.complete_command_success(slot, lba, count);
  }
  /**
   * Process a command from the command list (async fallback for network-backed storage).
   * Not used for RAM-backed disks — use process_command_sync() instead.
   * @param {number} slot - Command slot number
   */
  async process_command(slot) {
    dbg_log("AHCI Port " + this.port_num + ": Processing command slot " + slot, LOG_DISK);
    try {
      const cmd_header = this.get_command_header(slot);
      if (!cmd_header) {
        dbg_log("AHCI Port " + this.port_num + ": Invalid command header for slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      const cmd_table = this.get_command_table(cmd_header);
      if (!cmd_table) {
        dbg_log("AHCI Port " + this.port_num + ": Invalid command table for slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      const cmd_fis = new RegisterFIS_H2D(cmd_table, 0);
      if (!cmd_fis.is_command) {
        dbg_log("AHCI Port " + this.port_num + ": Not a command FIS in slot " + slot, LOG_DISK);
        this.complete_command_with_error(slot, 4);
        return;
      }
      await this.execute_ata_command(slot, cmd_fis, cmd_header);
    } catch (error) {
      dbg_log("AHCI Port " + this.port_num + ": Error processing command slot " + slot + ": " + error.message, LOG_DISK);
      this.complete_command_with_error(slot, 4);
    }
  }
  /**
   * Get command header from command list
   */
  get_command_header(slot) {
    if (this.smp_memory_manager) {
      const cmd_list_entry = this.smp_memory_manager.get_command_list_entry(this.port_num, slot);
      return new AHCICommandHeader(slot, cmd_list_entry, 0);
    }
    const clb = this.port.clb;
    if (clb === 0) {
      return null;
    }
    const mem8 = this.controller.cpu.mem8;
    const entry_addr = clb + slot * 32;
    const cmd_list_buffer = mem8.subarray(entry_addr, entry_addr + 32);
    return new AHCICommandHeader(slot, cmd_list_buffer, 0);
  }
  /**
   * Get command table from command header
   */
  get_command_table(cmd_header) {
    const ctba = cmd_header.ctba;
    if (ctba.low === 0 && ctba.high === 0) {
      return null;
    }
    if (this.smp_memory_manager) {
      const table_index = (ctba.low - 50597888) / 2048;
      if (table_index >= 0 && table_index < 30) {
        return this.smp_memory_manager.get_command_table(table_index);
      }
    }
    const prdtl = cmd_header.prdtl;
    const tbl_size = 128 + prdtl * 16;
    const mem8 = this.controller.cpu.mem8;
    return mem8.subarray(ctba.low, ctba.low + tbl_size);
  }
  /**
   * Execute ATA command
   */
  async execute_ata_command(slot, cmd_fis, cmd_header) {
    const command = cmd_fis.command;
    dbg_log("AHCI Port " + this.port_num + ": Executing ATA command " + h(command) + " in slot " + slot, LOG_DISK);
    switch (command) {
      case ATA_CMD_IDENTIFY:
        await this.cmd_identify(slot, cmd_header);
      case ATA_CMD_IDENTIFY_PACKET:
        break;
      case ATA_CMD_READ_DMA2:
      case ATA_CMD_READ_DMA_EXT2:
      case ATA_CMD_READ_SECTORS2:
      case ATA_CMD_READ_SECTORS_EXT2:
        await this.cmd_read_dma(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_WRITE_DMA2:
      case ATA_CMD_WRITE_DMA_EXT2:
      case ATA_CMD_WRITE_SECTORS2:
      case ATA_CMD_WRITE_SECTORS_EXT2:
        await this.cmd_write_dma(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_READ_FPDMA:
        await this.cmd_read_fpdma(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_WRITE_FPDMA:
        await this.cmd_write_fpdma(slot, cmd_fis, cmd_header);
        break;
      case ATA_CMD_FLUSH_CACHE2:
      case ATA_CMD_FLUSH_CACHE_EXT2:
        await this.cmd_flush_cache(slot);
        break;
      default:
        dbg_log("AHCI Port " + this.port_num + ": Unsupported ATA command " + h(command), LOG_DISK);
        this.complete_command_with_error(slot, 4);
        break;
    }
  }
  /**
   * IDENTIFY DEVICE command
   */
  async cmd_identify(slot, cmd_header) {
    dbg_log("AHCI Port " + this.port_num + ": IDENTIFY DEVICE command", LOG_DISK);
    const identify_data = new Uint16Array(256);
    identify_data[0] = 64;
    identify_data[1] = 16383;
    identify_data[3] = 16;
    identify_data[6] = 63;
    identify_data[10] = 8224;
    identify_data[11] = 8246;
    identify_data[12] = 13856;
    identify_data[13] = 16712;
    identify_data[14] = 18755;
    identify_data[15] = 18720;
    identify_data[16] = 18756;
    identify_data[17] = 21323;
    identify_data[18] = 8224;
    identify_data[19] = 8224;
    identify_data[27] = 30774;
    identify_data[28] = 13856;
    identify_data[29] = 16712;
    identify_data[30] = 18755;
    identify_data[31] = 18720;
    identify_data[32] = 17513;
    identify_data[33] = 29547;
    identify_data[47] = 32769;
    identify_data[49] = 512;
    identify_data[53] = 6;
    identify_data[60] = this.disk_size / 512 & 65535;
    identify_data[61] = this.disk_size / 512 >> 16 & 65535;
    identify_data[80] = 126;
    identify_data[83] = 16384;
    identify_data[86] = 16384;
    identify_data[100] = this.disk_size / 512 & 65535;
    identify_data[101] = this.disk_size / 512 >> 16 & 65535;
    identify_data[102] = 0;
    identify_data[103] = 0;
    identify_data[76] = 2;
    identify_data[77] = 0;
    const identify_bytes = new Uint8Array(identify_data.buffer);
    const prdt_entries = this.get_prdt_entries(cmd_header);
    if (prdt_entries.length > 0) {
      const entry = prdt_entries[0];
      const dest_addr = entry.dba.low;
      const xfer_size = Math.min(512, entry.dbc);
      const mem8 = this.controller.cpu.mem8;
      for (let i = 0; i < xfer_size; i++) {
        mem8[dest_addr + i] = identify_bytes[i];
      }
      cmd_header.prdbc = xfer_size;
    }
    this.complete_command_success(slot);
  }
  /**
   * READ DMA command
   */
  async cmd_read_dma(slot, cmd_fis, cmd_header) {
    const is_ext = cmd_fis.command === ATA_CMD_READ_DMA_EXT2 || cmd_fis.command === ATA_CMD_READ_FPDMA || cmd_fis.command === ATA_CMD_READ_SECTORS_EXT2;
    const lba = is_ext ? cmd_fis.lba48 : cmd_fis.lba28;
    const count = cmd_fis.count === 0 ? is_ext ? 65536 : 256 : cmd_fis.count;
    const disk_offset = lba * this.sector_size;
    const transfer_size = count * this.sector_size;
    dbg_log("AHCI Port " + this.port_num + ": READ DMA LBA=" + lba + " count=" + count, LOG_DISK);
    try {
      const prdt_entries = this.get_prdt_entries(cmd_header);
      let total_transferred = 0;
      let current_disk_offset = disk_offset;
      for (const entry of prdt_entries) {
        const memory_addr = entry.dba.low;
        const size = Math.min(entry.dbc, transfer_size - total_transferred);
        if (size === 0) break;
        if (this.dma_manager) {
          this.dma_manager.set_current_port(this.port_num);
          const result = await this.dma_manager.dma_read(memory_addr, current_disk_offset, size);
          if (!result.success) {
            throw new Error("DMA read failed: " + result.error);
          }
        } else {
          await this.simulate_disk_operation(size);
        }
        total_transferred += size;
        current_disk_offset += size;
        if (total_transferred >= transfer_size) break;
      }
      this.complete_command_success(slot, lba, count);
    } catch (error) {
      dbg_log("AHCI Port " + this.port_num + ": READ DMA failed: " + error.message, LOG_DISK);
      this.complete_command_with_error(slot, 4);
    }
  }
  /**
   * WRITE DMA command
   */
  async cmd_write_dma(slot, cmd_fis, cmd_header) {
    const is_ext = cmd_fis.command === ATA_CMD_WRITE_DMA_EXT2 || cmd_fis.command === ATA_CMD_WRITE_FPDMA || cmd_fis.command === ATA_CMD_WRITE_SECTORS_EXT2;
    const lba = is_ext ? cmd_fis.lba48 : cmd_fis.lba28;
    const count = cmd_fis.count === 0 ? is_ext ? 65536 : 256 : cmd_fis.count;
    const disk_offset = lba * this.sector_size;
    const transfer_size = count * this.sector_size;
    dbg_log("AHCI Port " + this.port_num + ": WRITE DMA LBA=" + lba + " count=" + count, LOG_DISK);
    try {
      const prdt_entries = this.get_prdt_entries(cmd_header);
      let total_transferred = 0;
      let current_disk_offset = disk_offset;
      for (const entry of prdt_entries) {
        const memory_addr = entry.dba.low;
        const size = Math.min(entry.dbc, transfer_size - total_transferred);
        if (size === 0) break;
        if (this.dma_manager) {
          this.dma_manager.set_current_port(this.port_num);
          const result = await this.dma_manager.dma_write(memory_addr, current_disk_offset, size);
          if (!result.success) {
            throw new Error("DMA write failed: " + result.error);
          }
        } else {
          await this.simulate_disk_operation(size);
        }
        total_transferred += size;
        current_disk_offset += size;
        if (total_transferred >= transfer_size) break;
      }
      this.complete_command_success(slot, lba, count);
    } catch (error) {
      dbg_log("AHCI Port " + this.port_num + ": WRITE DMA failed: " + error.message, LOG_DISK);
      this.complete_command_with_error(slot, 4);
    }
  }
  /**
   * READ FPDMA QUEUED (NCQ) command
   */
  async cmd_read_fpdma(slot, cmd_fis, cmd_header) {
    const lba = cmd_fis.lba48;
    const count = cmd_fis.count;
    dbg_log("AHCI Port " + this.port_num + ": READ FPDMA (NCQ) LBA=" + lba + " count=" + count + " slot=" + slot, LOG_DISK);
    this.port.sact |= 1 << slot;
    await this.simulate_disk_operation(count * 512);
    this.complete_ncq_command(slot, lba, count);
  }
  /**
   * WRITE FPDMA QUEUED (NCQ) command
   */
  async cmd_write_fpdma(slot, cmd_fis, cmd_header) {
    const lba = cmd_fis.lba48;
    const count = cmd_fis.count;
    dbg_log("AHCI Port " + this.port_num + ": WRITE FPDMA (NCQ) LBA=" + lba + " count=" + count + " slot=" + slot, LOG_DISK);
    this.port.sact |= 1 << slot;
    await this.simulate_disk_operation(count * 512);
    this.complete_ncq_command(slot, lba, count);
  }
  /**
   * FLUSH CACHE command
   */
  async cmd_flush_cache(slot) {
    dbg_log("AHCI Port " + this.port_num + ": FLUSH CACHE command", LOG_DISK);
    await this.simulate_disk_operation(0);
    this.complete_command_success(slot);
  }
  /**
   * Simulate disk operation delay
   */
  async simulate_disk_operation(bytes) {
    const latency = this.virtual_disk ? 0.5 + bytes / (1024 * 1024) * 0.1 : 2 + bytes / (1024 * 1024) * 0.1;
    return new Promise((resolve) => setTimeout(resolve, latency));
  }
  /**
   * Complete command successfully.
   * Clears the CI bit so the guest's busy-poll loop (ahci.c:681) exits.
   */
  complete_command_success(slot, lba = 0, count = 0) {
    this.create_d2h_fis(lba, count);
    this.port.tfd = 80;
    this.port.ci &= ~(1 << slot);
    this.port.running_commands[slot] = null;
    this.port.is |= 1 << 0;
    this.port.update_port_interrupt();
    dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed successfully", LOG_DISK);
  }
  /**
   * Complete NCQ command successfully
   */
  complete_ncq_command(slot, lba, count) {
    this.port.sact &= ~(1 << slot);
    this.port.ci &= ~(1 << slot);
    this.create_sdb_fis(slot);
    this.port.is |= 1 << 3;
    this.port.update_port_interrupt();
    dbg_log("AHCI Port " + this.port_num + ": NCQ command slot " + slot + " completed", LOG_DISK);
  }
  /**
   * Complete command with error.
   * Clears the CI bit so the guest's busy-poll loop (ahci.c:681) exits.
   */
  complete_command_with_error(slot, error_code) {
    this.create_error_fis(error_code);
    this.port.tfd = error_code << 8 | (ATA_STATUS_DRDY | ATA_STATUS_ERR);
    this.port.ci &= ~(1 << slot);
    this.port.sact &= ~(1 << slot);
    this.port.running_commands[slot] = null;
    this.port.is |= 1 << 30;
    this.port.update_port_interrupt();
    dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed with error " + h(error_code), LOG_DISK);
  }
  /**
   * Create D2H Register FIS in receive area (offset 0x40 in FIS receive structure)
   * AHCI spec: Received FIS structure, D2H Register FIS at byte offset 0x40 (20 bytes)
   */
  create_d2h_fis(lba = 0, count = 0) {
    const fb = this.port.fb;
    if (!fb) return;
    const mem8 = this.controller.cpu.mem8;
    const fis_addr = fb + 64;
    const fis_buf = mem8.subarray(fis_addr, fis_addr + 20);
    const fis = new RegisterFIS_D2H(fis_buf, 0);
    fis.set_success(lba, count);
    dbg_log("AHCI Port " + this.port_num + ": Wrote D2H Register FIS to " + h(fis_addr), LOG_DISK);
  }
  /**
   * Create Set Device Bits FIS for NCQ completion (offset 0x58 in FIS receive structure)
   * AHCI spec: Received FIS structure, Set Device Bits FIS at byte offset 0x58 (8 bytes)
   */
  create_sdb_fis(slot) {
    const fb = this.port.fb;
    if (!fb) return;
    const mem8 = this.controller.cpu.mem8;
    const fis_addr = fb + 88;
    mem8[fis_addr + 0] = FIS_TYPE_DEV_BITS;
    mem8[fis_addr + 1] = 64;
    mem8[fis_addr + 2] = ATA_STATUS_DRDY | ATA_STATUS_DSC;
    mem8[fis_addr + 3] = 0;
    const sact_clear = ~(1 << slot) >>> 0;
    mem8[fis_addr + 4] = sact_clear & 255;
    mem8[fis_addr + 5] = sact_clear >> 8 & 255;
    mem8[fis_addr + 6] = sact_clear >> 16 & 255;
    mem8[fis_addr + 7] = sact_clear >> 24 & 255;
    dbg_log("AHCI Port " + this.port_num + ": Wrote Set Device Bits FIS for slot " + slot + " to " + h(fis_addr), LOG_DISK);
  }
  /**
   * Get Physical Region Descriptor Table entries from command header
   * @param {AHCICommandHeader} cmd_header - Command header
   * @returns {Array<PRDTEntry>} Array of PRDT entries
   */
  get_prdt_entries(cmd_header) {
    const prdtl = cmd_header.prdtl;
    if (prdtl === 0) {
      return [];
    }
    const cmd_table = this.get_command_table(cmd_header);
    if (!cmd_table) {
      return [];
    }
    const entries = [];
    const prdt_start = 128;
    for (let i = 0; i < prdtl && i < 65535; i++) {
      const entry_offset = prdt_start + i * 16;
      if (entry_offset + 16 > cmd_table.length) {
        break;
      }
      entries.push(new PRDTEntry(cmd_table, entry_offset));
    }
    return entries;
  }
  /**
   * Create error D2H Register FIS (offset 0x40 in FIS receive structure)
   */
  create_error_fis(error_code) {
    const fb = this.port.fb;
    if (!fb) return;
    const mem8 = this.controller.cpu.mem8;
    const fis_addr = fb + 64;
    const fis_buf = mem8.subarray(fis_addr, fis_addr + 20);
    const fis = new RegisterFIS_D2H(fis_buf, 0);
    fis.set_error(error_code);
    dbg_log("AHCI Port " + this.port_num + ": Wrote error D2H FIS (err=" + h(error_code) + ") to " + h(fis_addr), LOG_DISK);
  }
  /**
   * Get state for save/restore
   */
  get_state() {
    return {
      port_num: this.port_num,
      disk_size: this.disk_size,
      sector_size: this.sector_size
    };
  }
  /**
   * Set state for save/restore
   */
  set_state(state) {
    this.port_num = state.port_num;
    this.disk_size = state.disk_size || 1024 * 1024 * 1024;
    this.sector_size = state.sector_size || 512;
  }
};

// src/ahci_smp_integration.js
var CPU_BUFFER_SIZE = 480 * 1024;
var SHARED_BUFFER_SIZE = 960 * 1024;
var SLOTS_PER_CPU = 4;
var MAX_CPUS = 8;
var AHCISMPMemoryManager = class {
  constructor(cpu, shared_buffer = null) {
    this.cpu = cpu;
    this.cpu_id = cpu.cpu_id || 0;
    this.shared_buffer = shared_buffer;
    this.smp_enabled = !!shared_buffer;
    this.command_lists = null;
    this.command_tables = null;
    this.data_buffers = null;
    this.fis_buffers = null;
    this.slot_allocation = new Array(32).fill(-1);
    this.slot_locks = new Array(32).fill(false);
    this.init_memory_regions();
    dbg_log("AHCI SMP Memory Manager initialized for CPU " + this.cpu_id + (this.smp_enabled ? " with SMP" : " without SMP"), LOG_DISK);
  }
  /**
   * Initialize memory regions
   */
  init_memory_regions() {
    if (this.smp_enabled && this.shared_buffer) {
      this.init_shared_memory_regions();
    } else {
      this.init_local_memory_regions();
    }
  }
  /**
   * Initialize SharedArrayBuffer regions for SMP
   */
  init_shared_memory_regions() {
    const buffer = this.shared_buffer;
    this.command_lists = new Uint8Array(buffer, 0, 4096);
    this.command_tables = new Uint8Array(buffer, 4096, 61440);
    this.data_buffers = new Uint8Array(buffer, 65536, 3932160);
    this.fis_buffers = new Uint8Array(buffer, 3997696, 4096);
    this.slot_status = new Int32Array(buffer, 4063232, 32);
    dbg_log("AHCI SMP: Initialized SharedArrayBuffer regions", LOG_DISK);
  }
  /**
   * Initialize local memory regions for single-CPU
   */
  init_local_memory_regions() {
    this.command_lists = new Uint8Array(4096);
    this.command_tables = new Uint8Array(61440);
    this.data_buffers = new Uint8Array(3932160);
    this.fis_buffers = new Uint8Array(4096);
    this.slot_status = new Int32Array(32);
    dbg_log("AHCI SMP: Initialized local memory regions", LOG_DISK);
  }
  /**
   * Allocate a command slot for the current CPU
   * @returns {number} Slot number or -1 if no free slots
   */
  allocate_command_slot() {
    const cpu_start = this.cpu_id * SLOTS_PER_CPU;
    const cpu_end = cpu_start + SLOTS_PER_CPU;
    for (let slot = cpu_start; slot < cpu_end && slot < 32; slot++) {
      if (this.try_allocate_slot(slot)) {
        return slot;
      }
    }
    for (let slot = 0; slot < 32; slot++) {
      if (this.try_allocate_slot(slot)) {
        return slot;
      }
    }
    dbg_log("AHCI SMP: No free command slots for CPU " + this.cpu_id, LOG_DISK);
    return -1;
  }
  /**
   * Try to atomically allocate a specific slot
   * @param {number} slot - Slot number to allocate
   * @returns {boolean} True if successful
   */
  try_allocate_slot(slot) {
    if (this.smp_enabled) {
      const old_value = Atomics.compareExchange(this.slot_status, slot, 0, this.cpu_id + 1);
      return old_value === 0;
    } else {
      if (this.slot_status[slot] === 0) {
        this.slot_status[slot] = this.cpu_id + 1;
        return true;
      }
      return false;
    }
  }
  /**
   * Release a command slot
   * @param {number} slot - Slot number to release
   */
  release_command_slot(slot) {
    if (this.smp_enabled) {
      Atomics.store(this.slot_status, slot, 0);
    } else {
      this.slot_status[slot] = 0;
    }
    dbg_log("AHCI SMP: Released command slot " + slot + " for CPU " + this.cpu_id, LOG_DISK);
  }
  /**
   * Get command list entry for a slot
   * @param {number} port - Port number
   * @param {number} slot - Slot number
   * @returns {Uint8Array} Command list entry (32 bytes)
   */
  get_command_list_entry(port, slot) {
    const offset = port * 32 * 32 + slot * 32;
    return new Uint8Array(
      this.command_lists.buffer,
      this.command_lists.byteOffset + offset,
      32
    );
  }
  /**
   * Get command table for a slot
   * @param {number} table_index - Command table index
   * @returns {Uint8Array} Command table (2KB)
   */
  get_command_table(table_index) {
    const offset = table_index * 2048;
    return new Uint8Array(
      this.command_tables.buffer,
      this.command_tables.byteOffset + offset,
      2048
    );
  }
  /**
   * Get DMA buffer for CPU
   * @param {number} cpu_id - CPU ID (defaults to current CPU)
   * @param {number} buffer_offset - Offset within CPU's buffer space
   * @param {number} size - Buffer size needed
   * @returns {Uint8Array} DMA buffer
   */
  get_dma_buffer(cpu_id = this.cpu_id, buffer_offset = 0, size = CPU_BUFFER_SIZE) {
    let start_offset;
    if (cpu_id < MAX_CPUS) {
      start_offset = cpu_id * CPU_BUFFER_SIZE + buffer_offset;
    } else {
      start_offset = MAX_CPUS * CPU_BUFFER_SIZE + buffer_offset;
    }
    dbg_assert(
      start_offset + size <= this.data_buffers.length,
      "DMA buffer request exceeds available space"
    );
    return new Uint8Array(
      this.data_buffers.buffer,
      this.data_buffers.byteOffset + start_offset,
      size
    );
  }
  /**
   * Get FIS buffer for a port
   * @param {number} port - Port number
   * @returns {Uint8Array} FIS buffer (256 bytes)
   */
  get_fis_buffer(port) {
    const offset = port * 256;
    return new Uint8Array(
      this.fis_buffers.buffer,
      this.fis_buffers.byteOffset + offset,
      256
    );
  }
  /**
   * Invalidate cache lines for DMA coherency
   * @param {number} address - Memory address
   * @param {number} size - Size in bytes
   */
  invalidate_cache_lines(address, size) {
    if (!this.smp_enabled) {
      return;
    }
    dbg_log("AHCI SMP: Invalidating cache lines at " + h(address) + " size " + size, LOG_DISK);
    this.broadcast_cache_invalidation(address, size);
  }
  /**
   * Broadcast cache invalidation IPI to all CPUs
   * @param {number} address - Memory address  
   * @param {number} size - Size in bytes
   */
  broadcast_cache_invalidation(address, size) {
    dbg_log("AHCI SMP: Broadcasting cache invalidation IPI for address " + h(address), LOG_DISK);
  }
  /**
   * Wait for all pending DMA operations to complete
   */
  async wait_for_dma_completion() {
    return new Promise((resolve) => setTimeout(resolve, 0.1));
  }
  /**
   * Get memory statistics for debugging
   */
  get_memory_stats() {
    let allocated_slots = 0;
    let cpu_slot_usage = new Array(MAX_CPUS).fill(0);
    for (let slot = 0; slot < 32; slot++) {
      const owner = this.slot_status[slot];
      if (owner > 0) {
        allocated_slots++;
        const cpu_id = owner - 1;
        if (cpu_id < MAX_CPUS) {
          cpu_slot_usage[cpu_id]++;
        }
      }
    }
    return {
      total_slots: 32,
      allocated_slots,
      free_slots: 32 - allocated_slots,
      cpu_slot_usage,
      current_cpu: this.cpu_id,
      smp_enabled: this.smp_enabled,
      buffer_sizes: {
        command_lists: this.command_lists.length,
        command_tables: this.command_tables.length,
        data_buffers: this.data_buffers.length,
        fis_buffers: this.fis_buffers.length
      }
    };
  }
};
var AHCIDMAManager = class {
  constructor(memory_manager, cpu) {
    this.memory_manager = memory_manager;
    this.cpu = cpu;
    this.cpu_id = cpu.cpu_id || 0;
    this.pending_operations = /* @__PURE__ */ new Map();
    this.operation_id_counter = 0;
    this.current_port = 0;
    dbg_log("AHCI DMA Manager initialized for CPU " + this.cpu_id, LOG_DISK);
  }
  /**
   * Perform DMA read operation
   * @param {number} memory_addr - Target memory address
   * @param {number} disk_offset - Disk offset in bytes
   * @param {number} size - Transfer size in bytes
   * @returns {Promise} Completion promise
   */
  async dma_read(memory_addr, disk_offset, size) {
    const op_id = ++this.operation_id_counter;
    dbg_log("AHCI DMA: Starting read operation " + op_id + " addr=" + h(memory_addr) + " disk_offset=" + disk_offset + " size=" + size, LOG_DISK);
    try {
      this.memory_manager.invalidate_cache_lines(memory_addr, size);
      const buffer = this.get_dma_buffer_for_address(memory_addr, size);
      await this.simulate_disk_read(buffer, disk_offset, size);
      await this.copy_to_memory(buffer, memory_addr, size);
      dbg_log("AHCI DMA: Completed read operation " + op_id, LOG_DISK);
      return { success: true, bytes_transferred: size };
    } catch (error) {
      dbg_log("AHCI DMA: Failed read operation " + op_id + ": " + error.message, LOG_DISK);
      return { success: false, error: error.message };
    } finally {
      this.pending_operations.delete(op_id);
    }
  }
  /**
   * Perform DMA write operation
   * @param {number} memory_addr - Source memory address
   * @param {number} disk_offset - Disk offset in bytes
   * @param {number} size - Transfer size in bytes
   * @returns {Promise} Completion promise
   */
  async dma_write(memory_addr, disk_offset, size) {
    const op_id = ++this.operation_id_counter;
    dbg_log("AHCI DMA: Starting write operation " + op_id + " addr=" + h(memory_addr) + " disk_offset=" + disk_offset + " size=" + size, LOG_DISK);
    try {
      const buffer = this.get_dma_buffer_for_address(memory_addr, size);
      await this.copy_from_memory(memory_addr, buffer, size);
      await this.simulate_disk_write(buffer, disk_offset, size);
      dbg_log("AHCI DMA: Completed write operation " + op_id, LOG_DISK);
      return { success: true, bytes_transferred: size };
    } catch (error) {
      dbg_log("AHCI DMA: Failed write operation " + op_id + ": " + error.message, LOG_DISK);
      return { success: false, error: error.message };
    } finally {
      this.pending_operations.delete(op_id);
    }
  }
  /**
   * Get appropriate DMA buffer for memory address
   * @param {number} memory_addr - Memory address
   * @param {number} size - Required size
   * @returns {Uint8Array} DMA buffer
   */
  get_dma_buffer_for_address(memory_addr, size) {
    if (size > CPU_BUFFER_SIZE / 2) {
      return this.memory_manager.get_dma_buffer(MAX_CPUS, 0, size);
    }
    return this.memory_manager.get_dma_buffer(this.cpu_id, 0, size);
  }
  /**
   * Copy data from memory to DMA buffer
   * @param {number} memory_addr - Source memory address
   * @param {Uint8Array} buffer - Target DMA buffer
   * @param {number} size - Transfer size
   */
  async copy_from_memory(memory_addr, buffer, size) {
    dbg_log("AHCI DMA: Copying " + size + " bytes from mem " + h(memory_addr) + " to DMA buffer", LOG_DISK);
    const mem8 = this.cpu.mem8;
    for (let i = 0; i < size; i++) {
      buffer[i] = mem8[memory_addr + i];
    }
  }
  /**
   * Copy data from DMA buffer to memory
   * @param {Uint8Array} buffer - Source DMA buffer  
   * @param {number} memory_addr - Target memory address
   * @param {number} size - Transfer size
   */
  async copy_to_memory(buffer, memory_addr, size) {
    dbg_log("AHCI DMA: Copying " + size + " bytes from DMA buffer to mem " + h(memory_addr), LOG_DISK);
    const mem8 = this.cpu.mem8;
    for (let i = 0; i < size; i++) {
      mem8[memory_addr + i] = buffer[i];
    }
  }
  /**
   * Simulate disk read operation
   * @param {Uint8Array} buffer - Target buffer
   * @param {number} offset - Disk offset
   * @param {number} size - Read size
   */
  async simulate_disk_read(buffer, disk_offset, size) {
    const virtual_disk = this.get_virtual_disk_for_operation();
    if (virtual_disk) {
      try {
        const lba = Math.floor(disk_offset / 512);
        const count = Math.ceil(size / 512);
        const disk_data = await virtual_disk.read_sectors(lba, count);
        const copy_size = Math.min(size, disk_data.length);
        buffer.set(disk_data.subarray(0, copy_size));
        dbg_log("AHCI DMA: Read " + copy_size + " bytes from virtual disk at LBA " + lba, LOG_DISK);
        return;
      } catch (error) {
        dbg_log("AHCI DMA: Virtual disk read failed, falling back to simulation: " + error.message, LOG_DISK);
      }
    }
    const latency = 1 + size / (1024 * 1024) * 0.5;
    await new Promise((resolve) => setTimeout(resolve, latency));
    for (let i = 0; i < size; i++) {
      buffer[i] = disk_offset + i & 255;
    }
  }
  /**
   * Simulate disk write operation
   * @param {Uint8Array} buffer - Source buffer
   * @param {number} offset - Disk offset  
   * @param {number} size - Write size
   */
  async simulate_disk_write(buffer, disk_offset, size) {
    const virtual_disk = this.get_virtual_disk_for_operation();
    if (virtual_disk) {
      try {
        const lba = Math.floor(disk_offset / 512);
        const sector_data = new Uint8Array(Math.ceil(size / 512) * 512);
        sector_data.set(buffer.subarray(0, size));
        const sectors_written = await virtual_disk.write_sectors(lba, sector_data);
        dbg_log("AHCI DMA: Wrote " + sectors_written * 512 + " bytes to virtual disk at LBA " + lba, LOG_DISK);
        return;
      } catch (error) {
        dbg_log("AHCI DMA: Virtual disk write failed, falling back to simulation: " + error.message, LOG_DISK);
      }
    }
    const latency = 2 + size / (1024 * 1024) * 1;
    await new Promise((resolve) => setTimeout(resolve, latency));
    dbg_log("AHCI DMA: Simulated write of " + size + " bytes to disk offset " + disk_offset, LOG_DISK);
  }
  /**
   * Cancel all pending DMA operations
   */
  cancel_all_operations() {
    const count = this.pending_operations.size;
    this.pending_operations.clear();
    if (count > 0) {
      dbg_log("AHCI DMA: Cancelled " + count + " pending operations", LOG_DISK);
    }
  }
  /**
   * Get virtual disk for current operation
   * @returns {VirtualDisk|null} Virtual disk or null
   */
  get_virtual_disk_for_operation() {
    if (this.cpu && this.cpu.devices && this.cpu.devices.ahci) {
      const ahci = this.cpu.devices.ahci;
      if (ahci.disk_manager) {
        return ahci.disk_manager.get_disk(this.current_port);
      }
    }
    return null;
  }
  /**
   * Set current port for DMA operations
   * @param {number} port - Port number
   */
  set_current_port(port) {
    this.current_port = port;
  }
  /**
   * Get DMA statistics
   */
  get_dma_stats() {
    return {
      pending_operations: this.pending_operations.size,
      operation_id_counter: this.operation_id_counter,
      cpu_id: this.cpu_id,
      current_port: this.current_port
    };
  }
};

// src/ahci_msi.js
var MSI_ENABLE = 1 << 0;
var MSI_64BIT_ADDR_CAP = 1 << 7;
var MSI_PER_VECTOR_MASK_CAP = 1 << 8;
var MSIX_ENABLE = 1 << 15;
var MSIX_FUNCTION_MASK = 1 << 14;
var AHCI_IRQ_PORT_BASE = 48;
var MSIXTableEntry = class {
  constructor(buffer, offset) {
    this.buffer = buffer;
    this.offset = offset;
  }
  // Message Address (64-bit)
  get message_addr() {
    const low = this.buffer[this.offset + 0] | this.buffer[this.offset + 1] << 8 | this.buffer[this.offset + 2] << 16 | this.buffer[this.offset + 3] << 24;
    const high = this.buffer[this.offset + 4] | this.buffer[this.offset + 5] << 8 | this.buffer[this.offset + 6] << 16 | this.buffer[this.offset + 7] << 24;
    return { low, high };
  }
  set message_addr(value) {
    this.buffer[this.offset + 0] = value.low & 255;
    this.buffer[this.offset + 1] = value.low >> 8 & 255;
    this.buffer[this.offset + 2] = value.low >> 16 & 255;
    this.buffer[this.offset + 3] = value.low >> 24 & 255;
    this.buffer[this.offset + 4] = value.high & 255;
    this.buffer[this.offset + 5] = value.high >> 8 & 255;
    this.buffer[this.offset + 6] = value.high >> 16 & 255;
    this.buffer[this.offset + 7] = value.high >> 24 & 255;
  }
  // Message Data (32-bit)
  get message_data() {
    return this.buffer[this.offset + 8] | this.buffer[this.offset + 9] << 8 | this.buffer[this.offset + 10] << 16 | this.buffer[this.offset + 11] << 24;
  }
  set message_data(value) {
    this.buffer[this.offset + 8] = value & 255;
    this.buffer[this.offset + 9] = value >> 8 & 255;
    this.buffer[this.offset + 10] = value >> 16 & 255;
    this.buffer[this.offset + 11] = value >> 24 & 255;
  }
  // Vector Control (32-bit)
  get vector_control() {
    return this.buffer[this.offset + 12] | this.buffer[this.offset + 13] << 8 | this.buffer[this.offset + 14] << 16 | this.buffer[this.offset + 15] << 24;
  }
  set vector_control(value) {
    this.buffer[this.offset + 12] = value & 255;
    this.buffer[this.offset + 13] = value >> 8 & 255;
    this.buffer[this.offset + 14] = value >> 16 & 255;
    this.buffer[this.offset + 15] = value >> 24 & 255;
  }
  // Check if vector is masked
  get is_masked() {
    return !!(this.vector_control & 1);
  }
  set is_masked(value) {
    if (value) {
      this.vector_control |= 1;
    } else {
      this.vector_control &= ~1;
    }
  }
};
var AHCIMSIManager = class {
  constructor(controller) {
    this.controller = controller;
    this.cpu = controller.cpu;
    this.msi_enabled = false;
    this.msi_addr = 0;
    this.msi_data = 0;
    this.msi_mask = 0;
    this.msi_pending = 0;
    this.msi_multiple_msg_enable = 0;
    this.msix_enabled = false;
    this.msix_function_mask = false;
    this.msix_table = null;
    this.msix_pba = null;
    this.msix_table_size = 8;
    this.init_msi_table();
    dbg_log("AHCI MSI Manager initialized", LOG_DISK);
  }
  /**
   * Initialize MSI-X table with default values
   */
  init_msi_table() {
    this.msix_table = new Uint8Array(this.msix_table_size * 16);
    this.msix_pba = new Uint32Array(Math.ceil(this.msix_table_size / 32));
    for (let i = 0; i < this.msix_table_size; i++) {
      const entry = new MSIXTableEntry(this.msix_table, i * 16);
      entry.message_addr = { low: 4276092928, high: 0 };
      entry.message_data = AHCI_IRQ_PORT_BASE + i;
      entry.is_masked = true;
    }
    dbg_log("AHCI MSI: Initialized MSI-X table with " + this.msix_table_size + " entries", LOG_DISK);
  }
  /**
   * Enable MSI interrupts
   * @param {number} addr - MSI message address
   * @param {number} data - MSI message data
   */
  enable_msi(addr, data) {
    this.msi_enabled = true;
    this.msi_addr = addr;
    this.msi_data = data;
    dbg_log("AHCI MSI: MSI enabled, addr=" + h(addr) + " data=" + h(data), LOG_DISK);
  }
  /**
   * Disable MSI interrupts
   */
  disable_msi() {
    this.msi_enabled = false;
    dbg_log("AHCI MSI: MSI disabled", LOG_DISK);
  }
  /**
   * Enable MSI-X interrupts
   */
  enable_msix() {
    this.msix_enabled = true;
    this.msix_function_mask = false;
    this.unmask_msix_vector(0);
    dbg_log("AHCI MSI: MSI-X enabled", LOG_DISK);
  }
  /**
   * Disable MSI-X interrupts
   */
  disable_msix() {
    this.msix_enabled = false;
    dbg_log("AHCI MSI: MSI-X disabled", LOG_DISK);
  }
  /**
   * Configure MSI-X vector for a specific port
   * @param {number} port - Port number
   * @param {number} cpu_id - Target CPU ID
   * @param {number} vector - Interrupt vector
   */
  configure_port_vector(port, cpu_id, vector = null) {
    if (port >= this.msix_table_size) {
      dbg_log("AHCI MSI: Invalid port " + port + " for MSI-X configuration", LOG_DISK);
      return;
    }
    const entry = new MSIXTableEntry(this.msix_table, port * 16);
    const apic_addr = 4276092928 | cpu_id << 12;
    entry.message_addr = { low: apic_addr, high: 0 };
    const irq_vector = vector || AHCI_IRQ_PORT_BASE + port;
    entry.message_data = irq_vector | 0 << 8;
    entry.is_masked = false;
    dbg_log("AHCI MSI: Configured port " + port + " vector " + h(irq_vector) + " for CPU " + cpu_id + " at APIC " + h(apic_addr), LOG_DISK);
  }
  /**
   * Mask MSI-X vector
   * @param {number} vector_index - Vector index in table
   */
  mask_msix_vector(vector_index) {
    if (vector_index >= this.msix_table_size) return;
    const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
    entry.is_masked = true;
    dbg_log("AHCI MSI: Masked vector " + vector_index, LOG_DISK);
  }
  /**
   * Unmask MSI-X vector
   * @param {number} vector_index - Vector index in table
   */
  unmask_msix_vector(vector_index) {
    if (vector_index >= this.msix_table_size) return;
    const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
    entry.is_masked = false;
    this.check_pending_msix_interrupt(vector_index);
    dbg_log("AHCI MSI: Unmasked vector " + vector_index, LOG_DISK);
  }
  /**
   * Deliver MSI interrupt for a specific port
   * @param {number} port - Port number
   * @param {number} interrupt_type - Type of interrupt
   */
  deliver_port_interrupt(port, interrupt_type = 0) {
    if (this.msix_enabled && !this.msix_function_mask) {
      this.deliver_msix_interrupt(port, interrupt_type);
    } else if (this.msi_enabled) {
      this.deliver_msi_interrupt();
    } else {
      this.deliver_legacy_interrupt();
    }
  }
  /**
   * Deliver MSI-X interrupt
   * @param {number} vector_index - Vector index
   * @param {number} interrupt_type - Interrupt type
   */
  deliver_msix_interrupt(vector_index, interrupt_type) {
    if (vector_index >= this.msix_table_size) {
      dbg_log("AHCI MSI: Invalid vector index " + vector_index, LOG_DISK);
      return;
    }
    const entry = new MSIXTableEntry(this.msix_table, vector_index * 16);
    if (entry.is_masked) {
      const bit_index = vector_index % 32;
      const dword_index = Math.floor(vector_index / 32);
      this.msix_pba[dword_index] |= 1 << bit_index;
      dbg_log("AHCI MSI: Vector " + vector_index + " masked, setting pending bit", LOG_DISK);
      return;
    }
    const addr = entry.message_addr;
    const data = entry.message_data;
    const target_cpu = addr.low >> 12 & 255;
    const vector = data & 255;
    this.deliver_apic_interrupt(target_cpu, vector);
    dbg_log("AHCI MSI: Delivered MSI-X interrupt vector " + h(vector) + " to CPU " + target_cpu, LOG_DISK);
  }
  /**
   * Deliver MSI interrupt
   */
  deliver_msi_interrupt() {
    if (!this.msi_enabled) return;
    const target_cpu = this.msi_addr >> 12 & 255;
    const vector = this.msi_data & 255;
    this.deliver_apic_interrupt(target_cpu, vector);
    dbg_log("AHCI MSI: Delivered MSI interrupt vector " + h(vector) + " to CPU " + target_cpu, LOG_DISK);
  }
  /**
   * Deliver legacy PCI interrupt
   */
  deliver_legacy_interrupt() {
    if (this.cpu.devices && this.cpu.devices.pci) {
      this.cpu.devices.pci.raise_irq(this.controller.pci_id);
    }
    dbg_log("AHCI MSI: Delivered legacy PCI interrupt", LOG_DISK);
  }
  /**
   * Deliver interrupt via APIC system
   * @param {number} target_cpu - Target CPU ID
   * @param {number} vector - Interrupt vector
   */
  deliver_apic_interrupt(target_cpu, vector) {
    dbg_log("AHCI MSI: Delivering vector " + h(vector) + " to CPU " + target_cpu + " via APIC", LOG_DISK);
    this.deliver_legacy_interrupt();
  }
  /**
   * Check for pending MSI-X interrupts after unmasking
   * @param {number} vector_index - Vector index that was unmasked
   */
  check_pending_msix_interrupt(vector_index) {
    const bit_index = vector_index % 32;
    const dword_index = Math.floor(vector_index / 32);
    if (this.msix_pba[dword_index] & 1 << bit_index) {
      this.msix_pba[dword_index] &= ~(1 << bit_index);
      this.deliver_msix_interrupt(vector_index, 0);
    }
  }
  /**
   * Configure CPU affinity for AHCI interrupts
   * @param {Array<number>} cpu_map - Array mapping ports to CPUs
   */
  configure_cpu_affinity(cpu_map) {
    if (!this.msix_enabled) {
      dbg_log("AHCI MSI: Cannot configure CPU affinity without MSI-X", LOG_DISK);
      return;
    }
    for (let port = 0; port < Math.min(cpu_map.length, this.msix_table_size); port++) {
      const target_cpu = cpu_map[port];
      if (target_cpu >= 0 && target_cpu < 8) {
        this.configure_port_vector(port, target_cpu);
      }
    }
    dbg_log("AHCI MSI: Configured CPU affinity: " + cpu_map.join(", "), LOG_DISK);
  }
  /**
   * Get MSI configuration for PCI config space
   */
  get_msi_config() {
    return {
      msi_enabled: this.msi_enabled,
      msi_addr: this.msi_addr,
      msi_data: this.msi_data,
      msi_mask: this.msi_mask,
      msi_pending: this.msi_pending,
      multiple_msg_enable: this.msi_multiple_msg_enable
    };
  }
  /**
   * Get MSI-X configuration for PCI config space
   */
  get_msix_config() {
    return {
      msix_enabled: this.msix_enabled,
      function_mask: this.msix_function_mask,
      table_size: this.msix_table_size
    };
  }
  /**
   * Get state for save/restore
   */
  get_state() {
    return {
      msi_enabled: this.msi_enabled,
      msi_addr: this.msi_addr,
      msi_data: this.msi_data,
      msi_mask: this.msi_mask,
      msi_pending: this.msi_pending,
      msi_multiple_msg_enable: this.msi_multiple_msg_enable,
      msix_enabled: this.msix_enabled,
      msix_function_mask: this.msix_function_mask,
      msix_table_size: this.msix_table_size,
      msix_table: Array.from(this.msix_table),
      msix_pba: Array.from(this.msix_pba)
    };
  }
  /**
   * Set state for save/restore
   */
  set_state(state) {
    this.msi_enabled = state.msi_enabled || false;
    this.msi_addr = state.msi_addr || 0;
    this.msi_data = state.msi_data || 0;
    this.msi_mask = state.msi_mask || 0;
    this.msi_pending = state.msi_pending || 0;
    this.msi_multiple_msg_enable = state.msi_multiple_msg_enable || 0;
    this.msix_enabled = state.msix_enabled || false;
    this.msix_function_mask = state.msix_function_mask || false;
    this.msix_table_size = state.msix_table_size || 8;
    if (state.msix_table) {
      this.msix_table = new Uint8Array(state.msix_table);
    }
    if (state.msix_pba) {
      this.msix_pba = new Uint32Array(state.msix_pba);
    }
  }
};

// src/ahci_virtual_disk.js
var DISK_TYPE_RAM = "ram";
var DISK_TYPE_DURABLE = "durable";
var DISK_TYPE_BUFFER = "buffer";
var SECTOR_SIZE2 = 512;
var SECTORS_PER_TRACK = 63;
var HEADS_PER_CYLINDER = 16;
var DEFAULT_DISK_SIZE = 1024 * 1024 * 1024;
var VirtualDisk = class {
  constructor(size = DEFAULT_DISK_SIZE, sector_size = SECTOR_SIZE2) {
    this.size = size;
    this.sector_size = sector_size;
    this.sectors = Math.floor(size / sector_size);
    this.read_only = false;
    this.disk_type = "unknown";
    this.last_access_time = Date.now();
    this.calculate_geometry();
    dbg_log("Virtual Disk created: size=" + size + " sectors=" + this.sectors, LOG_DISK);
  }
  /**
   * Calculate CHS (Cylinder/Head/Sector) geometry
   */
  calculate_geometry() {
    const total_sectors = this.sectors;
    this.heads = HEADS_PER_CYLINDER;
    this.sectors_per_track = SECTORS_PER_TRACK;
    this.cylinders = Math.floor(total_sectors / (this.heads * this.sectors_per_track));
    if (this.cylinders > 65535) {
      this.cylinders = 65535;
    }
    dbg_log("Virtual Disk geometry: C=" + this.cylinders + " H=" + this.heads + " S=" + this.sectors_per_track, LOG_DISK);
  }
  /**
   * Read sectors from disk
   * @param {number} lba - Logical Block Address
   * @param {number} count - Number of sectors to read
   * @returns {Promise<Uint8Array>} Read data
   */
  async read_sectors(lba, count) {
    throw new Error("read_sectors must be implemented by subclass");
  }
  /**
   * Write sectors to disk
   * @param {number} lba - Logical Block Address
   * @param {Uint8Array} data - Data to write
   * @returns {Promise<number>} Number of sectors written
   */
  async write_sectors(lba, data) {
    throw new Error("write_sectors must be implemented by subclass");
  }
  /**
   * Flush any cached data to persistent storage
   * @returns {Promise<void>}
   */
  async flush() {
  }
  /**
   * Get disk information
   */
  get_info() {
    return {
      size: this.size,
      sectors: this.sectors,
      sector_size: this.sector_size,
      cylinders: this.cylinders,
      heads: this.heads,
      sectors_per_track: this.sectors_per_track,
      read_only: this.read_only,
      disk_type: this.disk_type,
      last_access: this.last_access_time
    };
  }
  /**
   * Validate LBA range
   * @param {number} lba - Starting LBA
   * @param {number} count - Number of sectors
   * @returns {boolean} True if valid
   */
  validate_range(lba, count) {
    if (lba < 0 || count <= 0) {
      return false;
    }
    if (lba + count > this.sectors) {
      return false;
    }
    return true;
  }
  /**
   * Update last access time
   */
  update_access_time() {
    this.last_access_time = Date.now();
  }
};
function format_ext2(buf, size) {
  const BLOCK_SZ = 1024;
  const SECT_SZ = 512;
  const EXT2_MAGIC = 61267;
  const total_blocks = size / BLOCK_SZ >>> 0;
  const blocks_per_group = total_blocks;
  const nblock_groups = 1;
  const inodes_per_group = 214;
  const INODE_STRUCT_SZ = 140;
  const inode_table_size_blocks = inodes_per_group * INODE_STRUCT_SZ / BLOCK_SZ >>> 0;
  const sblock_sector = 1024 / SECT_SZ >>> 0;
  const gdesc_sector = (1024 + BLOCK_SZ) / SECT_SZ >>> 0;
  const bb_sector = (1024 + BLOCK_SZ + BLOCK_SZ * nblock_groups) / SECT_SZ >>> 0;
  const ib_sector = (1024 + 2 * BLOCK_SZ + BLOCK_SZ * nblock_groups) / SECT_SZ >>> 0;
  const it_sector = (1024 + 3 * BLOCK_SZ + BLOCK_SZ * nblock_groups) / SECT_SZ >>> 0;
  const sblock_off = sblock_sector * SECT_SZ;
  const gdesc_off = gdesc_sector * SECT_SZ;
  const bb_off = bb_sector * SECT_SZ;
  const ib_off = ib_sector * SECT_SZ;
  const it_off = it_sector * SECT_SZ;
  const data_start_sector = it_sector + inode_table_size_blocks * 2;
  const root_dir_sector = data_start_sector;
  const root_dir_off = root_dir_sector * SECT_SZ;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  function w8(off, v) {
    buf[off] = v & 255;
  }
  function w16(off, v) {
    dv.setUint16(off, v, true);
  }
  function w32(off, v) {
    dv.setUint32(off, v, true);
  }
  function wstr(off, s) {
    for (let i = 0; i < s.length; i++) buf[off + i] = s.charCodeAt(i);
  }
  const S = sblock_off;
  w32(S + 0, inodes_per_group * nblock_groups);
  w32(S + 4, total_blocks);
  w32(S + 8, 0);
  w32(S + 12, total_blocks - 40);
  w32(S + 16, inodes_per_group - 2);
  w32(S + 20, sblock_sector);
  w32(S + 24, BLOCK_SZ);
  w32(S + 28, 0);
  w32(S + 32, blocks_per_group);
  w32(S + 36, 0);
  w32(S + 40, inodes_per_group);
  w32(S + 44, 0);
  w32(S + 48, 0);
  w16(S + 52, 0);
  w16(S + 54, 20);
  w16(S + 56, EXT2_MAGIC);
  w16(S + 58, 0);
  w16(S + 60, 1);
  w16(S + 62, 0);
  w32(S + 64, 0);
  w32(S + 68, 3600);
  w32(S + 72, 5);
  w32(S + 76, 0);
  w16(S + 80, 0);
  w16(S + 82, 0);
  w32(S + 84, 0);
  w16(S + 88, INODE_STRUCT_SZ);
  w16(S + 90, 0);
  w32(S + 92, 0);
  w32(S + 96, 0);
  w32(S + 100, 0);
  wstr(S + 120, "Primary");
  w32(S + 200, 0);
  const free_blocks = blocks_per_group - (3 + inode_table_size_blocks + nblock_groups);
  const G = gdesc_off;
  w32(G + 0, bb_sector);
  w32(G + 4, ib_sector);
  w32(G + 8, it_sector);
  w16(G + 12, free_blocks & 65535);
  w16(G + 14, inodes_per_group - 2);
  w16(G + 16, 1);
  w16(G + 18, 0);
  w32(G + 20, inode_table_size_blocks);
  w32(G + 24, gdesc_sector);
  w32(G + 28, 0);
  buf[bb_off] = 128;
  buf[ib_off] = 128;
  const EXT2_DIR = 2;
  const M_EXT2 = 61267 & 255;
  const EXT2_OS_JSOS = 5;
  const ROOT_MODE = 256 | 128 | 64 | 32 | 8 | 4 | 1;
  const I0 = it_off + 0 * INODE_STRUCT_SZ;
  w8(I0 + 0, M_EXT2);
  w32(I0 + 4, 0);
  w16(I0 + 8, ROOT_MODE);
  w32(I0 + 12, EXT2_DIR);
  w32(I0 + 20, 0);
  w16(I0 + 42, 2);
  w16(I0 + 44, 0);
  w16(I0 + 48, EXT2_OS_JSOS);
  const I1 = it_off + 1 * INODE_STRUCT_SZ;
  w8(I1 + 0, M_EXT2);
  w32(I1 + 4, 1);
  w16(I1 + 8, ROOT_MODE);
  w32(I1 + 12, EXT2_DIR);
  w32(I1 + 20, BLOCK_SZ);
  w16(I1 + 42, 2);
  w16(I1 + 44, 2);
  w16(I1 + 48, EXT2_OS_JSOS);
  w32(I1 + 52, root_dir_sector);
  const EXT2_HARDLINK = 8;
  let D = root_dir_off;
  w32(D + 0, 1);
  w16(D + 4, 10);
  w8(D + 6, 1);
  w8(D + 7, EXT2_HARDLINK);
  wstr(D + 8, ".");
  buf[D + 9] = 0;
  D = root_dir_off + 10;
  w32(D + 0, 1);
  w16(D + 4, 11);
  w8(D + 6, 2);
  w8(D + 7, EXT2_HARDLINK);
  wstr(D + 8, "..");
  buf[D + 10] = 0;
  dbg_log("EXT2: Formatted " + (size >> 20) + "MB virtual disk (" + total_blocks + " blocks, root dir at sector " + root_dir_sector + ")", LOG_DISK);
}
var RAMVirtualDisk = class extends VirtualDisk {
  constructor(size = DEFAULT_DISK_SIZE) {
    super(size);
    this.disk_type = DISK_TYPE_RAM;
    this.data = new Uint8Array(size);
    format_ext2(this.data, size);
    dbg_log("RAM Virtual Disk created: " + Math.round(size / (1024 * 1024)) + "MB", LOG_DISK);
  }
  async read_sectors(lba, count) {
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    const start_byte = lba * this.sector_size;
    const length = count * this.sector_size;
    const result = new Uint8Array(length);
    result.set(this.data.subarray(start_byte, start_byte + length));
    dbg_log("RAM Disk read: LBA=" + lba + " count=" + count + " bytes=" + length, LOG_DISK);
    return result;
  }
  async write_sectors(lba, data) {
    if (this.read_only) {
      throw new Error("Disk is read-only");
    }
    const count = Math.floor(data.length / this.sector_size);
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    const start_byte = lba * this.sector_size;
    const length = count * this.sector_size;
    this.data.set(data.subarray(0, length), start_byte);
    dbg_log("RAM Disk write: LBA=" + lba + " count=" + count + " bytes=" + length, LOG_DISK);
    return count;
  }
  /**
   * Fill disk with pattern (useful for testing)
   * @param {number} pattern - Byte pattern to fill with
   */
  fill_pattern(pattern = 0) {
    this.data.fill(pattern);
    dbg_log("RAM Disk filled with pattern " + h(pattern), LOG_DISK);
  }
  /**
   * Load disk image from buffer
   * @param {Uint8Array} buffer - Disk image data
   */
  load_from_buffer(buffer) {
    const copy_size = Math.min(buffer.length, this.data.length);
    this.data.set(buffer.subarray(0, copy_size));
    dbg_log("RAM Disk loaded " + copy_size + " bytes from buffer", LOG_DISK);
  }
};
var BufferVirtualDisk = class extends VirtualDisk {
  constructor(buffer) {
    super(buffer.length);
    this.disk_type = DISK_TYPE_BUFFER;
    this.data = buffer;
    dbg_log("Buffer Virtual Disk created: " + Math.round(buffer.length / (1024 * 1024)) + "MB", LOG_DISK);
  }
  async read_sectors(lba, count) {
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    const start_byte = lba * this.sector_size;
    const length = count * this.sector_size;
    const result = new Uint8Array(length);
    result.set(this.data.subarray(start_byte, start_byte + length));
    return result;
  }
  async write_sectors(lba, data) {
    if (this.read_only) {
      throw new Error("Disk is read-only");
    }
    const count = Math.floor(data.length / this.sector_size);
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    const start_byte = lba * this.sector_size;
    const length = count * this.sector_size;
    this.data.set(data.subarray(0, length), start_byte);
    return count;
  }
};
var DurableObjectVirtualDisk = class extends VirtualDisk {
  constructor(durable_object_id, size = DEFAULT_DISK_SIZE) {
    super(size);
    this.disk_type = DISK_TYPE_DURABLE;
    this.durable_object_id = durable_object_id;
    this.cache = /* @__PURE__ */ new Map();
    this.cache_size = 1024;
    this.dirty_blocks = /* @__PURE__ */ new Set();
    this.pending_writes = /* @__PURE__ */ new Map();
    dbg_log("Durable Object Virtual Disk created: ID=" + durable_object_id + " size=" + Math.round(size / (1024 * 1024)) + "MB", LOG_DISK);
  }
  async read_sectors(lba, count) {
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    const result = new Uint8Array(count * this.sector_size);
    let result_offset = 0;
    for (let i = 0; i < count; i++) {
      const sector_lba = lba + i;
      const sector_data = await this.read_single_sector(sector_lba);
      result.set(sector_data, result_offset);
      result_offset += this.sector_size;
    }
    dbg_log("Durable Object read: LBA=" + lba + " count=" + count, LOG_DISK);
    return result;
  }
  async write_sectors(lba, data) {
    if (this.read_only) {
      throw new Error("Disk is read-only");
    }
    const count = Math.floor(data.length / this.sector_size);
    if (!this.validate_range(lba, count)) {
      throw new Error("Invalid LBA range: " + lba + "+" + count);
    }
    this.update_access_time();
    for (let i = 0; i < count; i++) {
      const sector_lba = lba + i;
      const sector_offset = i * this.sector_size;
      const sector_data = data.subarray(sector_offset, sector_offset + this.sector_size);
      await this.write_single_sector(sector_lba, sector_data);
    }
    dbg_log("Durable Object write: LBA=" + lba + " count=" + count, LOG_DISK);
    return count;
  }
  /**
   * Read a single sector, using cache if available
   * @param {number} lba - Sector LBA
   * @returns {Promise<Uint8Array>} Sector data
   */
  async read_single_sector(lba) {
    if (this.cache.has(lba)) {
      const cached_data = this.cache.get(lba);
      this.cache.delete(lba);
      this.cache.set(lba, cached_data);
      return new Uint8Array(cached_data);
    }
    const sector_data = await this.read_from_durable_object(lba);
    this.add_to_cache(lba, sector_data);
    return sector_data;
  }
  /**
   * Write a single sector to cache and mark dirty
   * @param {number} lba - Sector LBA
   * @param {Uint8Array} data - Sector data
   */
  async write_single_sector(lba, data) {
    this.cache.set(lba, new Uint8Array(data));
    this.dirty_blocks.add(lba);
    this.evict_cache_if_needed();
  }
  /**
   * Add sector to cache with LRU eviction
   * @param {number} lba - Sector LBA
   * @param {Uint8Array} data - Sector data
   */
  add_to_cache(lba, data) {
    this.cache.set(lba, new Uint8Array(data));
    this.evict_cache_if_needed();
  }
  /**
   * Evict cache entries if over limit
   */
  evict_cache_if_needed() {
    while (this.cache.size > this.cache_size) {
      const oldest_lba = this.cache.keys().next().value;
      if (this.dirty_blocks.has(oldest_lba)) {
        this.write_to_durable_object(oldest_lba, this.cache.get(oldest_lba)).catch((error) => {
          dbg_log("Durable Object background write failed: " + error.message, LOG_DISK);
        });
        this.dirty_blocks.delete(oldest_lba);
      }
      this.cache.delete(oldest_lba);
    }
  }
  /**
   * Read sector from Durable Object
   * @param {number} lba - Sector LBA
   * @returns {Promise<Uint8Array>} Sector data
   */
  async read_from_durable_object(lba) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const data = new Uint8Array(this.sector_size);
        for (let i = 0; i < this.sector_size; i++) {
          data[i] = lba * this.sector_size + i & 255;
        }
        resolve(data);
      }, 1);
    });
  }
  /**
   * Write sector to Durable Object
   * @param {number} lba - Sector LBA
   * @param {Uint8Array} data - Sector data
   * @returns {Promise<void>}
   */
  async write_to_durable_object(lba, data) {
    return new Promise((resolve) => {
      setTimeout(() => {
        dbg_log("Durable Object: Wrote sector " + lba, LOG_DISK);
        resolve();
      }, 2);
    });
  }
  /**
   * Flush all dirty blocks to persistent storage
   */
  async flush() {
    const dirty_lbas = Array.from(this.dirty_blocks);
    if (dirty_lbas.length === 0) {
      return;
    }
    dbg_log("Durable Object flush: " + dirty_lbas.length + " dirty blocks", LOG_DISK);
    const write_promises = dirty_lbas.map((lba) => {
      const sector_data = this.cache.get(lba);
      if (sector_data) {
        return this.write_to_durable_object(lba, sector_data);
      }
      return Promise.resolve();
    });
    await Promise.all(write_promises);
    this.dirty_blocks.clear();
    dbg_log("Durable Object flush completed", LOG_DISK);
  }
  /**
   * Get cache statistics
   */
  get_cache_stats() {
    return {
      cache_entries: this.cache.size,
      cache_limit: this.cache_size,
      dirty_blocks: this.dirty_blocks.size,
      hit_ratio: this.cache_hits / (this.cache_hits + this.cache_misses) || 0
    };
  }
};
var VirtualDiskManager = class {
  constructor() {
    this.disks = /* @__PURE__ */ new Map();
    this.default_disk_size = DEFAULT_DISK_SIZE;
    dbg_log("Virtual Disk Manager initialized", LOG_DISK);
  }
  /**
   * Create a virtual disk for a port
   * @param {number} port - Port number
   * @param {string} type - Disk type (ram, durable, buffer, file)
   * @param {Object} options - Disk options
   * @returns {VirtualDisk} Created disk
   */
  create_disk(port, type = DISK_TYPE_RAM, options = {}) {
    let disk;
    const size = options.size || this.default_disk_size;
    switch (type) {
      case DISK_TYPE_RAM:
        disk = new RAMVirtualDisk(size);
        break;
      case DISK_TYPE_DURABLE:
        const do_id = options.durable_object_id || "disk_port_" + port;
        disk = new DurableObjectVirtualDisk(do_id, size);
        break;
      case DISK_TYPE_BUFFER:
        if (!options.buffer) {
          throw new Error("Buffer must be provided for buffer disk");
        }
        disk = new BufferVirtualDisk(options.buffer);
        break;
      default:
        throw new Error("Unsupported disk type: " + type);
    }
    if (options.read_only) {
      disk.read_only = true;
    }
    this.disks.set(port, disk);
    dbg_log("Virtual Disk Manager: Created " + type + " disk for port " + port, LOG_DISK);
    return disk;
  }
  /**
   * Get virtual disk for a port
   * @param {number} port - Port number
   * @returns {VirtualDisk|null} Virtual disk or null if not found
   */
  get_disk(port) {
    return this.disks.get(port) || null;
  }
  /**
   * Remove virtual disk for a port
   * @param {number} port - Port number
   */
  remove_disk(port) {
    const disk = this.disks.get(port);
    if (disk) {
      disk.flush().catch((error) => {
        dbg_log("Error flushing disk during removal: " + error.message, LOG_DISK);
      });
    }
    this.disks.delete(port);
    dbg_log("Virtual Disk Manager: Removed disk for port " + port, LOG_DISK);
  }
  /**
   * Flush all disks
   */
  async flush_all() {
    const flush_promises = [];
    for (const [port, disk] of this.disks) {
      flush_promises.push(
        disk.flush().catch((error) => {
          dbg_log("Error flushing disk port " + port + ": " + error.message, LOG_DISK);
        })
      );
    }
    await Promise.all(flush_promises);
    dbg_log("Virtual Disk Manager: Flushed all disks", LOG_DISK);
  }
  /**
   * Get statistics for all disks
   */
  get_stats() {
    const stats = {
      total_disks: this.disks.size,
      disk_info: {}
    };
    for (const [port, disk] of this.disks) {
      stats.disk_info[port] = disk.get_info();
    }
    return stats;
  }
  /**
   * Load disk from settings
   * @param {number} port - Port number
   * @param {Object} settings - Disk settings
   */
  load_disk_from_settings(port, settings) {
    if (!settings) {
      return this.create_disk(port, DISK_TYPE_RAM);
    }
    const type = settings.type || DISK_TYPE_RAM;
    const options = {
      size: settings.size,
      read_only: settings.read_only,
      buffer: settings.buffer,
      durable_object_id: settings.durable_object_id
    };
    return this.create_disk(port, type, options);
  }
};

// src/ahci.js
var AHCI_MEM_ADDRESS = 4271898624;
var AHCI_MEM_SIZE = 4096;
var AHCI_MAX_PORTS = 32;
var AHCI_MAX_CMDS = 32;
var AHCI_FIS_SIZE = 256;
var HBA_CAP = 0;
var HBA_GHC = 4;
var HBA_IS = 8;
var HBA_PI = 12;
var HBA_VS = 16;
var HBA_CCC_CTL = 20;
var HBA_CCC_PORTS = 24;
var HBA_EM_LOC = 28;
var HBA_EM_CTL = 32;
var HBA_CAP2 = 36;
var HBA_BOHC = 40;
var PORT_CLB = 0;
var PORT_CLBU = 4;
var PORT_FB = 8;
var PORT_FBU = 12;
var PORT_IS = 16;
var PORT_IE = 20;
var PORT_CMD = 24;
var PORT_TFD = 32;
var PORT_SIG = 36;
var PORT_SSTS = 40;
var PORT_SCTL = 44;
var PORT_SERR = 48;
var PORT_SACT = 52;
var PORT_CI = 56;
var PORT_SNTF = 60;
var CAP_NP_MASK = 31;
var CAP_SXS = 1 << 5;
var CAP_EMS = 1 << 6;
var CAP_CCCS = 1 << 7;
var CAP_NCS_SHIFT = 8;
var CAP_PSC = 1 << 13;
var CAP_SSC = 1 << 14;
var CAP_PMD = 1 << 15;
var CAP_FBSS = 1 << 16;
var CAP_SPM = 1 << 17;
var CAP_SAM = 1 << 18;
var CAP_SNZO = 1 << 19;
var CAP_ISS_SHIFT = 20;
var CAP_SCLO = 1 << 24;
var CAP_SAL = 1 << 25;
var CAP_SALP = 1 << 26;
var CAP_SSS = 1 << 27;
var CAP_SMPS = 1 << 28;
var CAP_SSNTF = 1 << 29;
var CAP_SNCQ = 1 << 30;
var CAP_S64A = 1 << 31;
var GHC_HR = 1 << 0;
var GHC_IE = 1 << 1;
var GHC_MRSM = 1 << 2;
var GHC_AE = 1 << 31;
var CMD_ST = 1 << 0;
var CMD_SUD = 1 << 1;
var CMD_POD = 1 << 2;
var CMD_CLO = 1 << 3;
var CMD_FRE = 1 << 4;
var CMD_MPSS = 1 << 13;
var CMD_FR = 1 << 14;
var CMD_CR = 1 << 15;
var CMD_CPS = 1 << 16;
var CMD_PMA = 1 << 17;
var CMD_HPCP = 1 << 18;
var CMD_MPSP = 1 << 19;
var CMD_CPD = 1 << 20;
var CMD_ESP = 1 << 21;
var CMD_FBSCP = 1 << 22;
var CMD_APSTE = 1 << 23;
var CMD_ATAPI = 1 << 24;
var CMD_DLAE = 1 << 25;
var CMD_ALPE = 1 << 26;
var CMD_ASP = 1 << 27;
var PORT_IRQ_DHRS = 1 << 0;
var PORT_IRQ_PSS = 1 << 1;
var PORT_IRQ_DSS = 1 << 2;
var PORT_IRQ_SDBS = 1 << 3;
var PORT_IRQ_UFS = 1 << 4;
var PORT_IRQ_DPS = 1 << 5;
var PORT_IRQ_PCS = 1 << 6;
var PORT_IRQ_DMPS = 1 << 7;
var PORT_IRQ_PRCS = 1 << 22;
var PORT_IRQ_IPMS = 1 << 23;
var PORT_IRQ_OFS = 1 << 24;
var PORT_IRQ_INFS = 1 << 26;
var PORT_IRQ_IFS = 1 << 27;
var PORT_IRQ_HBDS = 1 << 28;
var PORT_IRQ_HBFS = 1 << 29;
var PORT_IRQ_TFES = 1 << 30;
var PORT_IRQ_CPDS = 1 << 31;
var SIG_ATA = 257;
function AHCIController(cpu, bus, disk_options) {
  this.cpu = cpu;
  this.bus = bus;
  this.disk_options = disk_options || {};
  this.cap = 0;
  this.ghc = 0;
  this.is = 0;
  this.pi = 0;
  this.vs = 0;
  this.ccc_ctl = 0;
  this.ccc_ports = 0;
  this.em_loc = 0;
  this.em_ctl = 0;
  this.cap2 = 0;
  this.bohc = 0;
  this.num_ports = 4;
  this.ports = [];
  for (let i = 0; i < this.num_ports; i++) {
    this.ports[i] = new AHCIPort(this, i);
    this.ports[i].cmd_processor.port = this.ports[i];
  }
  this.init_hba_capabilities();
  this.init_pci_device();
  this.init_mmio();
  this.init_smp_support();
  this.smp_memory_manager = new AHCISMPMemoryManager(this.cpu, this.cpu.shared_memory);
  this.dma_manager = new AHCIDMAManager(this.smp_memory_manager, this.cpu);
  this.msi_manager = new AHCIMSIManager(this);
  this.disk_manager = new VirtualDiskManager();
  this.init_default_disks();
  dbg_log("AHCI Controller initialized with " + this.num_ports + " ports", LOG_DISK);
}
AHCIController.prototype.init_hba_capabilities = function() {
  this.cap = this.num_ports - 1 & CAP_NP_MASK | // Number of ports
  AHCI_MAX_CMDS - 1 << CAP_NCS_SHIFT | // Number of command slots  
  CAP_SNCQ | // Native Command Queuing
  CAP_SSNTF | // SNotification Register
  CAP_SALP | // Aggressive Link PM
  CAP_SAL | // Activity LED
  3 << CAP_ISS_SHIFT | // 6 Gbps interface speed
  CAP_PMD | // PIO Multiple DRQ
  CAP_SSC | // Slumber State Capable
  CAP_PSC;
  this.cap2 = 0;
  this.vs = 66305;
  this.pi = 0;
  this.ghc = GHC_AE;
};
AHCIController.prototype.init_pci_device = function() {
  this.name = "ahci";
  this.pci_id = 31 << 3;
  const bar5_lo = AHCI_MEM_ADDRESS & 255;
  const bar5_hi1 = AHCI_MEM_ADDRESS >> 8 & 255;
  const bar5_hi2 = AHCI_MEM_ADDRESS >> 16 & 255;
  const bar5_hi3 = AHCI_MEM_ADDRESS >> 24 & 255;
  this.pci_space = [
    // 0x00: Vendor ID = 0x8086 (Intel)
    134,
    128,
    // 0x02: Device ID = 0x2922 (ICH9 AHCI)
    34,
    41,
    // 0x04: Command = Bus Master + Memory Space (0x0006)
    6,
    0,
    // 0x06: Status = capabilities list present (0x0010)
    16,
    0,
    // 0x08: Revision ID = 0x02
    2,
    // 0x09: Programming Interface = 0x01 (AHCI 1.0)
    1,
    // 0x0A: Subclass = 0x06 (SATA)
    6,
    // 0x0B: Class code = 0x01 (Mass Storage)
    1,
    // 0x0C: Cache Line Size
    0,
    // 0x0D: Latency Timer
    0,
    // 0x0E: Header Type = 0x00 (standard, single function)
    0,
    // 0x0F: BIST
    0,
    // 0x10: BAR0 – not used (0)
    0,
    0,
    0,
    0,
    // 0x14: BAR1 – not used (0)
    0,
    0,
    0,
    0,
    // 0x18: BAR2 – not used (0)
    0,
    0,
    0,
    0,
    // 0x1C: BAR3 – not used (0)
    0,
    0,
    0,
    0,
    // 0x20: BAR4 – not used (0)
    0,
    0,
    0,
    0,
    // 0x24: BAR5 – AHCI ABAR (memory, 32-bit, non-prefetchable)
    bar5_lo,
    bar5_hi1,
    bar5_hi2,
    bar5_hi3,
    // 0x28: CardBus CIS pointer
    0,
    0,
    0,
    0,
    // 0x2C: Subsystem Vendor ID = 0x8086
    134,
    128,
    // 0x2E: Subsystem ID = 0x2922
    34,
    41,
    // 0x30: Expansion ROM base (disabled)
    0,
    0,
    0,
    0,
    // 0x34: Capabilities pointer = 0x80
    128,
    0,
    0,
    0,
    // 0x38: Reserved
    0,
    0,
    0,
    0,
    // 0x3C: Interrupt Line = 0x0B (IRQ 11), Interrupt Pin = 0x01 (INTA#)
    11,
    1,
    // 0x3E: Min Grant, Max Latency
    0,
    0,
    // 0x40 onwards – device-specific / capabilities / padding
    // 64 bytes of capability area + 128 bytes padding = 192 bytes → total = 64+192=256
    ...new Array(192).fill(0)
  ];
  this.pci_bars = [
    void 0,
    // BAR0
    void 0,
    // BAR1
    void 0,
    // BAR2
    void 0,
    // BAR3
    void 0,
    // BAR4
    { size: AHCI_MEM_SIZE }
    // BAR5: AHCI ABAR
  ];
  this.cpu.devices.pci.register_device(this);
  this.cpu.devices.ahci = this;
};
AHCIController.prototype.init_mmio = function() {
  const MMAP_BLOCK_SIZE2 = 1 << 17;
  const mmap_base = AHCI_MEM_ADDRESS & ~(MMAP_BLOCK_SIZE2 - 1);
  const abar = AHCI_MEM_ADDRESS >>> 0;
  const read32 = (addr) => {
    const offset = (addr >>> 0) - abar;
    if (offset < 0 || offset >= AHCI_MEM_SIZE) {
      return 0;
    }
    return this.read_hba_register(offset) >>> 0;
  };
  const write32 = (addr, value) => {
    const offset = (addr >>> 0) - abar;
    if (offset < 0 || offset >= AHCI_MEM_SIZE) return;
    this.write_hba_register(offset, value);
  };
  const read8 = (addr) => {
    const dword_addr = addr & ~3;
    const byte_shift = (addr & 3) << 3;
    const dword_val = read32(dword_addr);
    return dword_val >> byte_shift & 255;
  };
  const write8 = (addr, value) => {
    const dword_addr = addr & ~3;
    const byte_shift = (addr & 3) << 3;
    const old_val = read32(dword_addr);
    const new_val = old_val & ~(255 << byte_shift) | (value & 255) << byte_shift;
    write32(dword_addr, new_val);
  };
  this.cpu.io.mmap_register(
    mmap_base,
    MMAP_BLOCK_SIZE2,
    read8,
    write8,
    read32,
    write32
  );
  dbg_log("AHCI: MMIO registered at " + h(mmap_base >>> 0, 8) + " covering ABAR at " + h(AHCI_MEM_ADDRESS >>> 0, 8), LOG_DISK);
};
AHCIController.prototype.init_smp_support = function() {
  this.smp_enabled = typeof SharedArrayBuffer !== "undefined" && typeof this.cpu.shared_memory !== "undefined";
  if (this.smp_enabled) {
    dbg_log("AHCI: SMP support enabled with SharedArrayBuffer", LOG_DISK);
    this.init_shared_memory_regions();
  } else {
    dbg_log("AHCI: Running in single-CPU mode", LOG_DISK);
  }
  this.cpu_slot_allocation = new Array(8).fill(0);
  this.cpu_id = this.cpu.cpu_id || 0;
};
AHCIController.prototype.init_shared_memory_regions = function() {
  this.shared_command_lists = new Uint32Array(AHCI_MAX_PORTS * AHCI_MAX_CMDS * 8);
  this.shared_fis_buffers = new Uint8Array(AHCI_MAX_PORTS * AHCI_FIS_SIZE);
  this.shared_slot_status = new Int32Array(AHCI_MAX_PORTS * AHCI_MAX_CMDS);
  dbg_log("AHCI: Shared memory regions initialized", LOG_DISK);
};
AHCIController.prototype.init_default_disks = function() {
  const opts = this.disk_options || {};
  const DEFAULT_DISK_SIZE2 = 32 * 1024 * 1024;
  if (opts.hda) {
    this.disk_manager.create_disk(0, "buffer", { buffer: opts.hda });
    dbg_log("AHCI: Port 0 using hda buffer (" + opts.hda.byteLength + " bytes)", LOG_DISK);
  } else {
    const disk_size = opts.ahci_disk_size > 0 ? opts.ahci_disk_size : DEFAULT_DISK_SIZE2;
    this.disk_manager.create_disk(0, "ram", { size: disk_size });
    dbg_log("AHCI: Port 0 using blank " + (disk_size >> 20) + "MB RAM disk", LOG_DISK);
  }
  if (this.num_ports > 1) {
    if (opts.hdb) {
      this.disk_manager.create_disk(1, "buffer", { buffer: opts.hdb });
      dbg_log("AHCI: Port 1 using hdb buffer", LOG_DISK);
    } else {
      this.disk_manager.create_disk(1, "ram", { size: DEFAULT_DISK_SIZE2 });
    }
  }
  for (let i = 0; i < this.num_ports; i++) {
    const disk = this.disk_manager.get_disk(i);
    if (disk && this.ports[i].cmd_processor) {
      this.ports[i].cmd_processor.virtual_disk = disk;
      this.ports[i].cmd_processor.disk_size = disk.size;
      this.ports[i].has_device = true;
    }
  }
  this.pi = 0;
  let device_count = 0;
  for (let i = 0; i < this.num_ports; i++) {
    if (this.ports[i] && this.ports[i].has_device) {
      this.pi |= 1 << i;
      device_count++;
    }
  }
  this.cap = this.cap & ~31 | (device_count > 0 ? device_count - 1 : 0) & 31;
  dbg_log("AHCI: PI=" + this.pi.toString(16) + " (" + device_count + " devices)", LOG_DISK);
  dbg_log("AHCI: Virtual disks initialized", LOG_DISK);
};
AHCIController.prototype.read_hba_register = function(offset) {
  dbg_log("AHCI HBA READ offset=" + offset.toString(16), LOG_DISK);
  if (offset < 256) {
    let val;
    switch (offset) {
      case HBA_CAP:
        val = this.cap;
        break;
      case HBA_GHC:
        val = this.ghc;
        break;
      case HBA_IS:
        val = this.is;
        break;
      case HBA_PI:
        val = this.pi;
        break;
      case HBA_VS:
        val = this.vs;
        break;
      case HBA_CCC_CTL:
        val = this.ccc_ctl;
        break;
      case HBA_CCC_PORTS:
        val = this.ccc_ports;
        break;
      case HBA_EM_LOC:
        val = this.em_loc;
        break;
      case HBA_EM_CTL:
        val = this.em_ctl;
        break;
      case HBA_CAP2:
        val = this.cap2;
        break;
      case HBA_BOHC:
        val = this.bohc;
        break;
      default:
        dbg_log("AHCI: Unknown HBA register read at offset " + h(offset), LOG_DISK);
        return 0;
    }
    return val;
  }
  const port_num = offset - 256 >> 7;
  const port_offset = offset - 256 & 127;
  if (port_num >= this.num_ports) {
    dbg_log("AHCI: Invalid port " + port_num + " register read", LOG_DISK);
    return 0;
  }
  return this.ports[port_num].read_register(port_offset);
};
AHCIController.prototype.write_hba_register = function(offset, value) {
  dbg_log("AHCI HBA WRITE offset=" + offset.toString(16) + " value=" + value.toString(16), LOG_DISK);
  if (offset < 256) {
    switch (offset) {
      case HBA_CAP:
        dbg_log("AHCI: Attempt to write read-only CAP register", LOG_DISK);
        break;
      case HBA_GHC:
        this.write_global_host_control(value);
        break;
      case HBA_IS:
        this.is &= ~value;
        this.update_global_interrupt();
        break;
      case HBA_PI:
        dbg_log("AHCI: Attempt to write read-only PI register", LOG_DISK);
        break;
      case HBA_VS:
        dbg_log("AHCI: Attempt to write read-only VS register", LOG_DISK);
        break;
      case HBA_CCC_CTL:
        this.ccc_ctl = value;
        break;
      case HBA_CCC_PORTS:
        this.ccc_ports = value;
        break;
      case HBA_EM_LOC:
        this.em_loc = value;
        break;
      case HBA_EM_CTL:
        this.em_ctl = value;
        break;
      case HBA_CAP2:
        dbg_log("AHCI: Attempt to write read-only CAP2 register", LOG_DISK);
        break;
      case HBA_BOHC:
        this.bohc = value;
        break;
      default:
        dbg_log("AHCI: Unknown HBA register write at offset " + h(offset) + " value " + h(value), LOG_DISK);
        break;
    }
    return;
  }
  const port_num = offset - 256 >> 7;
  const port_offset = offset - 256 & 127;
  if (port_num >= this.num_ports) {
    dbg_log("AHCI: Invalid port " + port_num + " register write", LOG_DISK);
    return;
  }
  this.ports[port_num].write_register(port_offset, value);
};
AHCIController.prototype.write_global_host_control = function(value) {
  const old_ghc = this.ghc;
  if (value & GHC_HR) {
    dbg_log("AHCI: HBA Reset requested", LOG_DISK);
    this.reset_hba();
    return;
  }
  this.ghc = value & ~GHC_HR | GHC_AE;
  if (this.ghc & GHC_IE && !(old_ghc & GHC_IE)) {
    dbg_log("AHCI: Global interrupts enabled", LOG_DISK);
    this.update_global_interrupt();
  } else if (!(this.ghc & GHC_IE) && old_ghc & GHC_IE) {
    dbg_log("AHCI: Global interrupts disabled", LOG_DISK);
    this.clear_global_interrupt();
  }
};
AHCIController.prototype.reset_hba = function() {
  dbg_log("AHCI: Performing HBA reset", LOG_DISK);
  this.ghc = GHC_AE;
  this.is = 0;
  this.ccc_ctl = 0;
  this.ccc_ports = 0;
  this.em_ctl = 0;
  this.bohc = 0;
  for (let i = 0; i < this.num_ports; i++) {
    this.ports[i].reset();
  }
  this.clear_global_interrupt();
};
AHCIController.prototype.update_global_interrupt = function() {
  if (!(this.ghc & GHC_IE) || this.is === 0) {
    return;
  }
  this.deliver_interrupt();
};
AHCIController.prototype.clear_global_interrupt = function() {
  if (this.cpu.devices && this.cpu.devices.pci) {
    this.cpu.devices.pci.lower_irq(this.pci_id);
  }
};
AHCIController.prototype.deliver_interrupt = function() {
  if (this.msi_manager) {
    for (let port = 0; port < this.num_ports; port++) {
      if (this.is & 1 << port) {
        this.msi_manager.deliver_port_interrupt(port);
        break;
      }
    }
  } else {
    if (this.cpu.devices && this.cpu.devices.pci) {
      this.cpu.devices.pci.raise_irq(this.pci_id);
    }
  }
};
function AHCIPort(controller, port_num) {
  this.controller = controller;
  this.port_num = port_num;
  this.clb = 0;
  this.clbu = 0;
  this.fb = 0;
  this.fbu = 0;
  this.is = 0;
  this.ie = 0;
  this.cmd = 0;
  this.tfd = 0;
  this.sig = 0;
  this.ssts = 0;
  this.sctl = 0;
  this.serr = 0;
  this.sact = 0;
  this.ci = 0;
  this.sntf = 0;
  this.running_commands = new Array(AHCI_MAX_CMDS).fill(null);
  this.command_timeout_id = new Array(AHCI_MAX_CMDS).fill(null);
  this.cmd_processor = new AHCICommandProcessor(controller, port_num);
  this.reset();
  dbg_log("AHCI Port " + port_num + " initialized", LOG_DISK);
}
AHCIPort.prototype.reset = function() {
  this.cmd &= ~(CMD_ST | CMD_FRE | CMD_CR | CMD_FR);
  this.is = 0;
  this.serr = 0;
  this.ci = 0;
  this.sact = 0;
  this.ssts = 0;
  this.sig = SIG_ATA;
  this.tfd = 80;
  for (let i = 0; i < AHCI_MAX_CMDS; i++) {
    if (this.command_timeout_id[i]) {
      clearTimeout(this.command_timeout_id[i]);
      this.command_timeout_id[i] = null;
    }
    this.running_commands[i] = null;
  }
  dbg_log("AHCI Port " + this.port_num + " reset", LOG_DISK);
};
AHCIPort.prototype.read_register = function(offset) {
  switch (offset) {
    case PORT_CLB:
      return this.clb;
    case PORT_CLBU:
      return this.clbu;
    case PORT_FB:
      return this.fb;
    case PORT_FBU:
      return this.fbu;
    case PORT_IS:
      return this.is;
    case PORT_IE:
      return this.ie;
    case PORT_CMD:
      return this.cmd;
    case PORT_TFD:
      return this.tfd;
    case PORT_SIG:
      return this.sig;
    case PORT_SSTS:
      return this.ssts;
    case PORT_SCTL:
      return this.sctl;
    case PORT_SERR:
      return this.serr;
    case PORT_SACT:
      return this.sact;
    case PORT_CI:
      return this.ci;
    case PORT_SNTF:
      return this.sntf;
    default:
      dbg_log("AHCI Port " + this.port_num + ": Unknown register read at offset " + h(offset), LOG_DISK);
      return 0;
  }
};
AHCIPort.prototype.write_register = function(offset, value) {
  switch (offset) {
    case PORT_CLB:
      this.clb = value & 4294966272;
      break;
    case PORT_CLBU:
      this.clbu = value;
      break;
    case PORT_FB:
      this.fb = value & 4294967040;
      break;
    case PORT_FBU:
      this.fbu = value;
      break;
    case PORT_IS:
      this.is &= ~value;
      this.update_port_interrupt();
      break;
    case PORT_IE:
      this.ie = value;
      this.update_port_interrupt();
      break;
    case PORT_CMD:
      this.write_command_register(value);
      break;
    case PORT_TFD:
      dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only TFD register", LOG_DISK);
      break;
    case PORT_SIG:
      dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only SIG register", LOG_DISK);
      break;
    case PORT_SSTS:
      dbg_log("AHCI Port " + this.port_num + ": Attempt to write read-only SSTS register", LOG_DISK);
      break;
    case PORT_SCTL:
      this.sctl = value;
      this.handle_sata_control(value);
      break;
    case PORT_SERR:
      this.serr &= ~value;
      break;
    case PORT_SACT:
      this.sact |= value;
      break;
    case PORT_CI:
      this.issue_commands(value);
      break;
    case PORT_SNTF:
      this.sntf &= ~value;
      break;
    default:
      dbg_log("AHCI Port " + this.port_num + ": Unknown register write at offset " + h(offset) + " value " + h(value), LOG_DISK);
      break;
  }
};
AHCIPort.prototype.write_command_register = function(value) {
  const old_cmd = this.cmd;
  let new_cr = old_cmd & CMD_CR;
  let new_fr = old_cmd & CMD_FR;
  if (value & CMD_ST && !(old_cmd & CMD_ST)) {
    if (this.clb || this.clbu) {
      new_cr = CMD_CR;
      dbg_log("AHCI Port " + this.port_num + ": Command processing started", LOG_DISK);
    }
  } else if (!(value & CMD_ST)) {
    new_cr = 0;
    if (old_cmd & CMD_ST) {
      dbg_log("AHCI Port " + this.port_num + ": Command processing stopped", LOG_DISK);
    }
  }
  if (value & CMD_FRE && !(old_cmd & CMD_FRE)) {
    if (this.fb || this.fbu) {
      new_fr = CMD_FR;
      dbg_log("AHCI Port " + this.port_num + ": FIS processing started", LOG_DISK);
    }
  } else if (!(value & CMD_FRE)) {
    new_fr = 0;
    if (old_cmd & CMD_FRE) {
      dbg_log("AHCI Port " + this.port_num + ": FIS processing stopped", LOG_DISK);
    }
  }
  if (value & CMD_SUD && this.has_device && (this.ssts & 15) === 0) {
    this.ssts = 275;
    this.sig = 257;
    this.tfd = 80;
  }
  this.cmd = value & ~(CMD_CR | CMD_FR) | new_cr | new_fr;
};
AHCIPort.prototype.handle_sata_control = function(value) {
  const det = value & 15;
  switch (det) {
    case 0:
      break;
    case 1:
      this.ssts = 275;
      this.sig = SIG_ATA;
      dbg_log("AHCI Port " + this.port_num + ": SATA device detected", LOG_DISK);
      break;
    case 4:
      this.ssts = 0;
      this.sig = 4294967295;
      dbg_log("AHCI Port " + this.port_num + ": SATA interface disabled", LOG_DISK);
      break;
  }
};
AHCIPort.prototype.issue_commands = function(ci_mask) {
  if (!(this.cmd & CMD_ST)) {
    dbg_log("AHCI Port " + this.port_num + ": CI write with ST=0, auto-starting command engine", LOG_DISK);
    this.cmd |= CMD_ST | CMD_CR;
  }
  const new_commands = ci_mask & ~this.ci;
  for (let slot = 0; slot < AHCI_MAX_CMDS; slot++) {
    if (!(new_commands & 1 << slot)) continue;
    this.ci |= 1 << slot;
    this.process_command_slot(slot);
  }
};
AHCIPort.prototype.process_command_slot = function(slot) {
  dbg_log("AHCI Port " + this.port_num + ": Processing command slot " + slot + " (sync)", LOG_DISK);
  this.running_commands[slot] = {
    start_time: Date.now(),
    slot
  };
  this.cmd_processor.process_command_sync(slot);
};
AHCIPort.prototype.complete_command = function(slot) {
  dbg_log("AHCI Port " + this.port_num + ": Command slot " + slot + " completed", LOG_DISK);
  this.ci &= ~(1 << slot);
  this.sact &= ~(1 << slot);
  if (this.command_timeout_id[slot]) {
    clearTimeout(this.command_timeout_id[slot]);
    this.command_timeout_id[slot] = null;
  }
  this.running_commands[slot] = null;
  this.is |= PORT_IRQ_DHRS;
  this.update_port_interrupt();
};
AHCIPort.prototype.update_port_interrupt = function() {
  const pending_interrupts = this.is & this.ie;
  if (pending_interrupts) {
    this.controller.is |= 1 << this.port_num;
    this.controller.update_global_interrupt();
  } else {
    this.controller.is &= ~(1 << this.port_num);
    if (this.controller.is === 0) {
      this.controller.clear_global_interrupt();
    }
  }
};
AHCIPort.prototype.get_state = function() {
  return {
    clb: this.clb,
    clbu: this.clbu,
    fb: this.fb,
    fbu: this.fbu,
    is: this.is,
    ie: this.ie,
    cmd: this.cmd,
    tfd: this.tfd,
    sig: this.sig,
    ssts: this.ssts,
    sctl: this.sctl,
    serr: this.serr,
    sact: this.sact,
    ci: this.ci,
    sntf: this.sntf,
    running_commands: this.running_commands.slice(),
    cmd_processor: this.cmd_processor ? this.cmd_processor.get_state() : null
  };
};
AHCIPort.prototype.set_state = function(state) {
  this.clb = state.clb;
  this.clbu = state.clbu;
  this.fb = state.fb;
  this.fbu = state.fbu;
  this.is = state.is;
  this.ie = state.ie;
  this.cmd = state.cmd;
  this.tfd = state.tfd;
  this.sig = state.sig;
  this.ssts = state.ssts;
  this.sctl = state.sctl;
  this.serr = state.serr;
  this.sact = state.sact;
  this.ci = state.ci;
  this.sntf = state.sntf;
  this.running_commands = state.running_commands || new Array(AHCI_MAX_CMDS).fill(null);
  if (state.cmd_processor && this.cmd_processor) {
    this.cmd_processor.set_state(state.cmd_processor);
  }
  for (let i = 0; i < AHCI_MAX_CMDS; i++) {
    if (this.command_timeout_id[i]) {
      clearTimeout(this.command_timeout_id[i]);
      this.command_timeout_id[i] = null;
    }
  }
};
AHCIController.prototype.get_state = function() {
  return {
    // HBA global registers
    cap: this.cap,
    ghc: this.ghc,
    is: this.is,
    pi: this.pi,
    vs: this.vs,
    ccc_ctl: this.ccc_ctl,
    ccc_ports: this.ccc_ports,
    em_loc: this.em_loc,
    em_ctl: this.em_ctl,
    cap2: this.cap2,
    bohc: this.bohc,
    // Ports state
    ports: this.ports.map((port) => port.get_state()),
    num_ports: this.num_ports,
    // SMP state
    cpu_slot_allocation: this.cpu_slot_allocation,
    cpu_id: this.cpu_id,
    smp_enabled: this.smp_enabled,
    // SMP managers state
    smp_memory_manager: this.smp_memory_manager ? this.smp_memory_manager.get_memory_stats() : null,
    dma_manager: this.dma_manager ? this.dma_manager.get_dma_stats() : null,
    msi_manager: this.msi_manager ? this.msi_manager.get_state() : null,
    disk_manager: this.disk_manager ? this.disk_manager.get_stats() : null
  };
};
AHCIController.prototype.set_state = function(state) {
  this.cap = state.cap;
  this.ghc = state.ghc;
  this.is = state.is;
  this.pi = state.pi;
  this.vs = state.vs;
  this.ccc_ctl = state.ccc_ctl;
  this.ccc_ports = state.ccc_ports;
  this.em_loc = state.em_loc;
  this.em_ctl = state.em_ctl;
  this.cap2 = state.cap2;
  this.bohc = state.bohc;
  this.num_ports = state.num_ports || 4;
  for (let i = 0; i < this.num_ports; i++) {
    if (state.ports && state.ports[i]) {
      this.ports[i].set_state(state.ports[i]);
    }
  }
  this.cpu_slot_allocation = state.cpu_slot_allocation || new Array(8).fill(0);
  this.cpu_id = state.cpu_id || 0;
  this.smp_enabled = state.smp_enabled || false;
  if (!this.smp_memory_manager) {
    this.smp_memory_manager = new AHCISMPMemoryManager(this.cpu, this.cpu.shared_memory);
  }
  if (!this.dma_manager) {
    this.dma_manager = new AHCIDMAManager(this.smp_memory_manager, this.cpu);
  }
  if (!this.msi_manager) {
    this.msi_manager = new AHCIMSIManager(this);
    if (state.msi_manager) {
      this.msi_manager.set_state(state.msi_manager);
    }
  }
  if (!this.disk_manager) {
    this.disk_manager = new VirtualDiskManager();
    this.init_default_disks();
  }
};

// src/virtio_net.js
var MTU_DEFAULT = 1500;
var VIRTIO_NET_F_MAC = 5;
var VIRTIO_NET_F_CTRL_VQ = 17;
var VIRTIO_NET_F_STATUS = 16;
var VIRTIO_NET_F_MQ = 22;
var VIRTIO_NET_F_CTRL_MAC_ADDR = 23;
var VIRTIO_NET_F_MTU = 3;
var VIRTIO_NET_CTRL_MQ_VQ_PAIRS_SET = 0;
var VIRTIO_NET_CTRL_MAC_ADDR_SET = 1;
function VirtioNet(cpu, bus, preserve_mac_from_state_image, mtu = MTU_DEFAULT) {
  this.bus = bus;
  this.id = cpu.devices.net ? 1 : 0;
  this.pairs = 1;
  this.status = 1;
  this.preserve_mac_from_state_image = preserve_mac_from_state_image;
  this.mac = new Uint8Array([
    0,
    34,
    21,
    Math.random() * 255 | 0,
    Math.random() * 255 | 0,
    Math.random() * 255 | 0
  ]);
  this.bus.send("net" + this.id + "-mac", format_mac(this.mac));
  const queues = [];
  for (let i = 0; i < this.pairs; ++i) {
    queues.push({ size_supported: 1024, notify_offset: 0 });
    queues.push({ size_supported: 1024, notify_offset: 1 });
  }
  queues.push({
    size_supported: 16,
    notify_offset: 2
  });
  this.virtio = new VirtIO(
    cpu,
    {
      name: "virtio-net",
      pci_id: 10 << 3,
      device_id: 4161,
      subsystem_device_id: 1,
      common: {
        initial_port: 51200,
        queues,
        features: [
          VIRTIO_NET_F_MAC,
          VIRTIO_NET_F_STATUS,
          VIRTIO_NET_F_MQ,
          VIRTIO_NET_F_MTU,
          VIRTIO_NET_F_CTRL_VQ,
          VIRTIO_NET_F_CTRL_MAC_ADDR,
          VIRTIO_F_VERSION_1
        ],
        on_driver_ok: () => {
        }
      },
      notification: {
        initial_port: 51456,
        single_handler: false,
        handlers: [
          (queue_id) => {
          },
          (queue_id) => {
            const queue = this.virtio.queues[queue_id];
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              this.bus.send("net" + this.id + "-send", buffer.subarray(12));
              this.bus.send("eth-transmit-end", [buffer.length - 12]);
              this.virtio.queues[queue_id].push_reply(bufchain);
            }
            this.virtio.queues[queue_id].flush_replies();
          },
          (queue_id) => {
            if (queue_id !== this.pairs * 2) {
              dbg_assert(false, "VirtioNet Notified for wrong queue: " + queue_id + " (expected queue_id of 3)");
              return;
            }
            const queue = this.virtio.queues[queue_id];
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              const parts = Unmarshall(["b", "b"], buffer, { offset: 0 });
              const xclass = parts[0];
              const command = parts[1];
              switch (xclass << 8 | command) {
                case 4 << 8 | VIRTIO_NET_CTRL_MQ_VQ_PAIRS_SET:
                  const data = Unmarshall(["h"], buffer, { offset: 2 });
                  dbg_assert(data[0] === 1);
                  this.Send(queue_id, bufchain, new Uint8Array([0]));
                  break;
                case 1 << 8 | VIRTIO_NET_CTRL_MAC_ADDR_SET:
                  this.mac = buffer.subarray(2, 8);
                  this.Send(queue_id, bufchain, new Uint8Array([0]));
                  this.bus.send("net" + this.id + "-mac", format_mac(this.mac));
                  break;
                default:
                  dbg_assert(false, " VirtioNet received unknown command: " + xclass + ":" + command);
                  this.Send(queue_id, bufchain, new Uint8Array([1]));
                  return;
              }
            }
          }
        ]
      },
      isr_status: {
        initial_port: 50944
      },
      device_specific: {
        initial_port: 50688,
        struct: [0, 1, 2, 3, 4, 5].map((v, k) => ({
          bytes: 1,
          name: "mac_" + k,
          read: () => this.mac[k],
          write: (data) => {
          }
        })).concat(
          [
            {
              bytes: 2,
              name: "status",
              read: () => this.status,
              write: (data) => {
              }
            },
            {
              bytes: 2,
              name: "max_pairs",
              read: () => this.pairs,
              write: (data) => {
              }
            },
            {
              bytes: 2,
              name: "mtu",
              read: () => mtu,
              write: (data) => {
              }
            }
          ]
        )
      }
    }
  );
  this.bus.register("net" + this.id + "-receive", (data) => {
    this.bus.send("eth-receive-end", [data.length]);
    const with_header = new Uint8Array(12 + data.byteLength);
    const view2 = new DataView(with_header.buffer, with_header.byteOffset, with_header.byteLength);
    view2.setInt16(10, 1);
    with_header.set(data, 12);
    const queue = this.virtio.queues[0];
    if (queue.has_request()) {
      const bufchain = queue.pop_request();
      bufchain.set_next_blob(with_header);
      this.virtio.queues[0].push_reply(bufchain);
      this.virtio.queues[0].flush_replies();
    } else {
      console.log("No buffer to write into!");
    }
  }, this);
}
VirtioNet.prototype.get_state = function() {
  const state = [];
  state[0] = this.virtio;
  state[1] = this.id;
  state[2] = this.mac;
  return state;
};
VirtioNet.prototype.set_state = function(state) {
  this.virtio.set_state(state[0]);
  this.id = state[1];
  if (this.preserve_mac_from_state_image) {
    this.mac = state[2];
    this.bus.send("net" + this.id + "-mac", format_mac(this.mac));
  }
};
VirtioNet.prototype.reset = function() {
  this.virtio.reset();
};
VirtioNet.prototype.Send = function(queue_id, bufchain, blob) {
  bufchain.set_next_blob(blob);
  this.virtio.queues[queue_id].push_reply(bufchain);
  this.virtio.queues[queue_id].flush_replies();
};
VirtioNet.prototype.Ack = function(queue_id, bufchain) {
  this.virtio.queues[queue_id].push_reply(bufchain);
  this.virtio.queues[queue_id].flush_replies();
};

// src/browser/screen.js
var DEBUG_SCREEN_LAYERS = false;
function ScreenAdapter(options, screen_fill_buffer) {
  const screen_container = options.container;
  this.screen_fill_buffer = screen_fill_buffer;
  console.assert(screen_container, "options.container must be provided");
  const MODE_TEXT = 0;
  const MODE_GRAPHICAL = 1;
  const MODE_GRAPHICAL_TEXT = 2;
  const CHARACTER_INDEX = 0;
  const FLAGS_INDEX = 1;
  const BG_COLOR_INDEX = 2;
  const FG_COLOR_INDEX = 3;
  const TEXT_BUF_COMPONENT_SIZE = 4;
  const FLAG_BLINKING = 1;
  const FLAG_FONT_PAGE_B = 2;
  this.FLAG_BLINKING = FLAG_BLINKING;
  this.FLAG_FONT_PAGE_B = FLAG_FONT_PAGE_B;
  let graphic_screen = screen_container.getElementsByTagName("canvas")[0];
  if (!graphic_screen) {
    graphic_screen = document.createElement("canvas");
    screen_container.appendChild(graphic_screen);
  }
  const graphic_context = graphic_screen.getContext("2d", { alpha: false });
  let text_screen = screen_container.getElementsByTagName("div")[0];
  if (!text_screen) {
    text_screen = document.createElement("div");
    screen_container.appendChild(text_screen);
  }
  const cursor_element = document.createElement("div");
  var cursor_row, cursor_col, scale_x = options.scale !== void 0 ? options.scale : 1, scale_y = options.scale !== void 0 ? options.scale : 1, base_scale = 1, changed_rows, mode, text_mode_data, text_mode_width, text_mode_height, offscreen_context, offscreen_extra_context, font_context, font_image_data, font_is_visible = new Int8Array(8 * 256), font_height, font_width, font_width_9px, font_width_dbl, font_copy_8th_col, font_page_a = 0, font_page_b = 0, blink_visible, tm_last_update = 0, cursor_start, cursor_end, cursor_enabled, charmap = get_charmap(options.encoding), timer_id = 0, paused = false;
  function number_as_color(n) {
    n = n.toString(16);
    return "#" + "0".repeat(6 - n.length) + n;
  }
  function render_font_bitmap(vga_bitmap) {
    const bitmap_width = font_width * 256;
    const bitmap_height = font_height * 8;
    let font_canvas = font_context ? font_context.canvas : null;
    if (!font_canvas || font_canvas.width !== bitmap_width || font_canvas.height !== bitmap_height) {
      if (!font_canvas) {
        font_canvas = new OffscreenCanvas(bitmap_width, bitmap_height);
        font_context = font_canvas.getContext("2d");
      } else {
        font_canvas.width = bitmap_width;
        font_canvas.height = bitmap_height;
      }
      font_image_data = font_context.createImageData(bitmap_width, bitmap_height);
    }
    const font_bitmap = font_image_data.data;
    let i_dst = 0, is_visible;
    const put_bit = font_width_dbl ? function(value) {
      is_visible = is_visible || value;
      font_bitmap[i_dst + 3] = value;
      font_bitmap[i_dst + 7] = value;
      i_dst += 8;
    } : function(value) {
      is_visible = is_visible || value;
      font_bitmap[i_dst + 3] = value;
      i_dst += 4;
    };
    const vga_inc_chr = 32 - font_height;
    const dst_inc_row = bitmap_width * (font_height - 1) * 4;
    const dst_inc_col = (font_width - bitmap_width * font_height) * 4;
    const dst_inc_line = font_width * 255 * 4;
    for (let i_chr_all = 0, i_vga = 0; i_chr_all < 2048; ++i_chr_all, i_vga += vga_inc_chr, i_dst += dst_inc_col) {
      const i_chr = i_chr_all % 256;
      if (i_chr_all && !i_chr) {
        i_dst += dst_inc_row;
      }
      is_visible = false;
      for (let i_line = 0; i_line < font_height; ++i_line, ++i_vga, i_dst += dst_inc_line) {
        const line_bits = vga_bitmap[i_vga];
        for (let i_bit = 128; i_bit > 0; i_bit >>= 1) {
          put_bit(line_bits & i_bit ? 255 : 0);
        }
        if (font_width_9px) {
          put_bit(font_copy_8th_col && i_chr >= 192 && i_chr <= 223 && line_bits & 1 ? 255 : 0);
        }
      }
      font_is_visible[i_chr_all] = is_visible ? 1 : 0;
    }
    font_context.putImageData(font_image_data, 0, 0);
  }
  function render_changed_rows() {
    const font_canvas = font_context.canvas;
    const offscreen_extra_canvas = offscreen_extra_context.canvas;
    const txt_row_size = text_mode_width * TEXT_BUF_COMPONENT_SIZE;
    const gfx_width = text_mode_width * font_width;
    const row_extra_1_y = 0;
    const row_extra_2_y = font_height;
    let n_rows_rendered = 0;
    for (let row_i = 0, row_y = 0, txt_i = 0; row_i < text_mode_height; ++row_i, row_y += font_height) {
      if (!changed_rows[row_i]) {
        txt_i += txt_row_size;
        continue;
      }
      ++n_rows_rendered;
      offscreen_extra_context.clearRect(0, row_extra_2_y, gfx_width, font_height);
      let fg_rgba, fg_x, bg_rgba, bg_x;
      for (let col_x = 0; col_x < gfx_width; col_x += font_width, txt_i += TEXT_BUF_COMPONENT_SIZE) {
        const chr = text_mode_data[txt_i + CHARACTER_INDEX];
        const chr_flags = text_mode_data[txt_i + FLAGS_INDEX];
        const chr_bg_rgba = text_mode_data[txt_i + BG_COLOR_INDEX];
        const chr_fg_rgba = text_mode_data[txt_i + FG_COLOR_INDEX];
        const chr_font_page = chr_flags & FLAG_FONT_PAGE_B ? font_page_b : font_page_a;
        const chr_visible = (!(chr_flags & FLAG_BLINKING) || blink_visible) && font_is_visible[(chr_font_page << 8) + chr];
        if (bg_rgba !== chr_bg_rgba) {
          if (bg_rgba !== void 0) {
            offscreen_context.fillStyle = number_as_color(bg_rgba);
            offscreen_context.fillRect(bg_x, row_y, col_x - bg_x, font_height);
          }
          bg_rgba = chr_bg_rgba;
          bg_x = col_x;
        }
        if (fg_rgba !== chr_fg_rgba) {
          if (fg_rgba !== void 0) {
            offscreen_extra_context.fillStyle = number_as_color(fg_rgba);
            offscreen_extra_context.fillRect(fg_x, row_extra_1_y, col_x - fg_x, font_height);
          }
          fg_rgba = chr_fg_rgba;
          fg_x = col_x;
        }
        if (chr_visible) {
          offscreen_extra_context.drawImage(
            font_canvas,
            chr * font_width,
            chr_font_page * font_height,
            font_width,
            font_height,
            col_x,
            row_extra_2_y,
            font_width,
            font_height
          );
        }
      }
      offscreen_extra_context.fillStyle = number_as_color(fg_rgba);
      offscreen_extra_context.fillRect(fg_x, row_extra_1_y, gfx_width - fg_x, font_height);
      offscreen_extra_context.globalCompositeOperation = "destination-in";
      offscreen_extra_context.drawImage(
        offscreen_extra_canvas,
        0,
        row_extra_2_y,
        gfx_width,
        font_height,
        0,
        row_extra_1_y,
        gfx_width,
        font_height
      );
      offscreen_extra_context.globalCompositeOperation = "source-over";
      offscreen_context.fillStyle = number_as_color(bg_rgba);
      offscreen_context.fillRect(bg_x, row_y, gfx_width - bg_x, font_height);
      offscreen_context.drawImage(
        offscreen_extra_canvas,
        0,
        row_extra_1_y,
        gfx_width,
        font_height,
        0,
        row_y,
        gfx_width,
        font_height
      );
    }
    if (n_rows_rendered) {
      if (blink_visible && cursor_enabled && changed_rows[cursor_row]) {
        const cursor_txt_i = (cursor_row * text_mode_width + cursor_col) * TEXT_BUF_COMPONENT_SIZE;
        const cursor_rgba = text_mode_data[cursor_txt_i + FG_COLOR_INDEX];
        offscreen_context.fillStyle = number_as_color(cursor_rgba);
        offscreen_context.fillRect(
          cursor_col * font_width,
          cursor_row * font_height + cursor_start,
          font_width,
          cursor_end - cursor_start + 1
        );
      }
      changed_rows.fill(0);
    }
    return n_rows_rendered;
  }
  function mark_blinking_rows_dirty() {
    const txt_row_size = text_mode_width * TEXT_BUF_COMPONENT_SIZE;
    for (let row_i = 0, txt_i = 0; row_i < text_mode_height; ++row_i) {
      if (changed_rows[row_i]) {
        txt_i += txt_row_size;
        continue;
      }
      for (let col_i = 0; col_i < text_mode_width; ++col_i, txt_i += TEXT_BUF_COMPONENT_SIZE) {
        if (text_mode_data[txt_i + FLAGS_INDEX] & FLAG_BLINKING) {
          changed_rows[row_i] = 1;
          txt_i += txt_row_size - col_i * TEXT_BUF_COMPONENT_SIZE;
          break;
        }
      }
    }
  }
  this.init = function() {
    cursor_element.classList.add("cursor");
    cursor_element.style.position = "absolute";
    cursor_element.style.backgroundColor = "#ccc";
    cursor_element.style.width = "7px";
    cursor_element.style.display = "inline-block";
    this.set_mode(false);
    this.set_size_text(80, 25);
    if (mode === MODE_GRAPHICAL_TEXT) {
      this.set_size_graphical(720, 400, 720, 400);
    }
    this.set_scale(scale_x, scale_y);
    this.timer();
  };
  this.make_screenshot = function() {
    const image = new Image();
    if (mode === MODE_GRAPHICAL || mode === MODE_GRAPHICAL_TEXT) {
      image.src = graphic_screen.toDataURL("image/png");
    } else {
      const char_size = [9, 16];
      const canvas = document.createElement("canvas");
      canvas.width = text_mode_width * char_size[0];
      canvas.height = text_mode_height * char_size[1];
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      context.font = window.getComputedStyle(text_screen).font;
      context.textBaseline = "top";
      for (let y = 0; y < text_mode_height; y++) {
        for (let x = 0; x < text_mode_width; x++) {
          const index = (y * text_mode_width + x) * TEXT_BUF_COMPONENT_SIZE;
          const character = text_mode_data[index + CHARACTER_INDEX];
          const bg_color = text_mode_data[index + BG_COLOR_INDEX];
          const fg_color = text_mode_data[index + FG_COLOR_INDEX];
          context.fillStyle = number_as_color(bg_color);
          context.fillRect(x * char_size[0], y * char_size[1], char_size[0], char_size[1]);
          context.fillStyle = number_as_color(fg_color);
          context.fillText(charmap[character], x * char_size[0], y * char_size[1]);
        }
      }
      if (cursor_element.style.display !== "none" && cursor_row < text_mode_height && cursor_col < text_mode_width) {
        context.fillStyle = cursor_element.style.backgroundColor;
        context.fillRect(
          cursor_col * char_size[0],
          cursor_row * char_size[1] + parseInt(cursor_element.style.marginTop, 10),
          parseInt(cursor_element.style.width, 10),
          parseInt(cursor_element.style.height, 10)
        );
      }
      image.src = canvas.toDataURL("image/png");
    }
    return image;
  };
  this.put_char = function(row, col, chr, flags, bg_color, fg_color) {
    dbg_assert(row >= 0 && row < text_mode_height);
    dbg_assert(col >= 0 && col < text_mode_width);
    dbg_assert(chr >= 0 && chr < 256);
    const p = TEXT_BUF_COMPONENT_SIZE * (row * text_mode_width + col);
    text_mode_data[p + CHARACTER_INDEX] = chr;
    text_mode_data[p + FLAGS_INDEX] = flags;
    text_mode_data[p + BG_COLOR_INDEX] = bg_color;
    text_mode_data[p + FG_COLOR_INDEX] = fg_color;
    changed_rows[row] = 1;
  };
  this.timer = function() {
    timer_id = requestAnimationFrame(() => this.update_screen());
  };
  this.update_screen = function() {
    if (!paused) {
      if (mode === MODE_TEXT) {
        this.update_text();
      } else if (mode === MODE_GRAPHICAL) {
        this.update_graphical();
      } else {
        this.update_graphical_text();
      }
    }
    this.timer();
  };
  this.update_text = function() {
    for (var i = 0; i < text_mode_height; i++) {
      if (changed_rows[i]) {
        this.text_update_row(i);
        changed_rows[i] = 0;
      }
    }
  };
  this.update_graphical = function() {
    this.screen_fill_buffer();
  };
  this.update_graphical_text = function() {
    if (offscreen_context) {
      const tm_now = performance.now();
      if (tm_now - tm_last_update > 266) {
        blink_visible = !blink_visible;
        if (cursor_enabled) {
          changed_rows[cursor_row] = 1;
        }
        mark_blinking_rows_dirty();
        tm_last_update = tm_now;
      }
      if (render_changed_rows()) {
        graphic_context.drawImage(offscreen_context.canvas, 0, 0);
      }
    }
  };
  this.destroy = function() {
    if (timer_id) {
      cancelAnimationFrame(timer_id);
      timer_id = 0;
    }
  };
  this.pause = function() {
    paused = true;
    cursor_element.classList.remove("blinking-cursor");
  };
  this.continue = function() {
    paused = false;
    cursor_element.classList.add("blinking-cursor");
  };
  this.set_mode = function(graphical) {
    mode = graphical ? MODE_GRAPHICAL : options.use_graphical_text ? MODE_GRAPHICAL_TEXT : MODE_TEXT;
    if (mode === MODE_TEXT) {
      text_screen.style.display = "block";
      graphic_screen.style.display = "none";
    } else {
      text_screen.style.display = "none";
      graphic_screen.style.display = "block";
      if (mode === MODE_GRAPHICAL_TEXT && changed_rows) {
        changed_rows.fill(1);
      }
    }
  };
  this.set_font_bitmap = function(height, width_9px, width_dbl, copy_8th_col, vga_bitmap, vga_bitmap_changed) {
    const width = width_dbl ? 16 : width_9px ? 9 : 8;
    if (font_height !== height || font_width !== width || font_width_9px !== width_9px || font_width_dbl !== width_dbl || font_copy_8th_col !== copy_8th_col || vga_bitmap_changed) {
      const size_changed = font_width !== width || font_height !== height;
      font_height = height;
      font_width = width;
      font_width_9px = width_9px;
      font_width_dbl = width_dbl;
      font_copy_8th_col = copy_8th_col;
      if (mode === MODE_GRAPHICAL_TEXT) {
        render_font_bitmap(vga_bitmap);
        changed_rows.fill(1);
        if (size_changed) {
          this.set_size_graphical_text();
        }
      }
    }
  };
  this.set_font_page = function(page_a, page_b) {
    if (font_page_a !== page_a || font_page_b !== page_b) {
      font_page_a = page_a;
      font_page_b = page_b;
      changed_rows.fill(1);
    }
  };
  this.clear_screen = function() {
    graphic_context.fillStyle = "#000";
    graphic_context.fillRect(0, 0, graphic_screen.width, graphic_screen.height);
  };
  this.set_size_graphical_text = function() {
    if (!font_context) {
      return;
    }
    const gfx_width = font_width * text_mode_width;
    const gfx_height = font_height * text_mode_height;
    const offscreen_extra_height = font_height * 2;
    if (!offscreen_context || offscreen_context.canvas.width !== gfx_width || offscreen_context.canvas.height !== gfx_height || offscreen_extra_context.canvas.height !== offscreen_extra_height) {
      if (!offscreen_context) {
        const offscreen_canvas = new OffscreenCanvas(gfx_width, gfx_height);
        offscreen_context = offscreen_canvas.getContext("2d", { alpha: false });
        const offscreen_extra_canvas = new OffscreenCanvas(gfx_width, offscreen_extra_height);
        offscreen_extra_context = offscreen_extra_canvas.getContext("2d");
      } else {
        offscreen_context.canvas.width = gfx_width;
        offscreen_context.canvas.height = gfx_height;
        offscreen_extra_context.canvas.width = gfx_width;
        offscreen_extra_context.canvas.height = offscreen_extra_height;
      }
      this.set_size_graphical(gfx_width, gfx_height, gfx_width, gfx_height);
      changed_rows.fill(1);
    }
  };
  this.set_size_text = function(cols, rows) {
    if (cols === text_mode_width && rows === text_mode_height) {
      return;
    }
    changed_rows = new Int8Array(rows);
    text_mode_data = new Int32Array(cols * rows * TEXT_BUF_COMPONENT_SIZE);
    text_mode_width = cols;
    text_mode_height = rows;
    if (mode === MODE_TEXT) {
      while (text_screen.childNodes.length > rows) {
        text_screen.removeChild(text_screen.firstChild);
      }
      while (text_screen.childNodes.length < rows) {
        text_screen.appendChild(document.createElement("div"));
      }
      for (var i = 0; i < rows; i++) {
        this.text_update_row(i);
      }
      update_scale_text();
    } else if (mode === MODE_GRAPHICAL_TEXT) {
      this.set_size_graphical_text();
    }
  };
  this.set_size_graphical = function(width, height, buffer_width, buffer_height) {
    if (DEBUG_SCREEN_LAYERS) {
      width = buffer_width;
      height = buffer_height;
    }
    graphic_screen.style.display = "block";
    graphic_screen.width = width;
    graphic_screen.height = height;
    graphic_context.imageSmoothingEnabled = false;
    if (width <= 640 && width * 2 < window.innerWidth * window.devicePixelRatio && height * 2 < window.innerHeight * window.devicePixelRatio) {
      base_scale = 2;
    } else {
      base_scale = 1;
    }
    update_scale_graphic();
  };
  this.set_scale = function(s_x, s_y) {
    scale_x = s_x;
    scale_y = s_y;
    update_scale_text();
    update_scale_graphic();
  };
  function update_scale_text() {
    elem_set_scale(text_screen, scale_x, scale_y, true);
  }
  function update_scale_graphic() {
    elem_set_scale(graphic_screen, scale_x * base_scale, scale_y * base_scale, false);
  }
  function elem_set_scale(elem, scale_x2, scale_y2, use_scale) {
    if (!scale_x2 || !scale_y2) {
      return;
    }
    elem.style.width = "";
    elem.style.height = "";
    if (use_scale) {
      elem.style.transform = "";
    }
    var rectangle = elem.getBoundingClientRect();
    if (use_scale) {
      var scale_str = "";
      scale_str += scale_x2 === 1 ? "" : " scaleX(" + scale_x2 + ")";
      scale_str += scale_y2 === 1 ? "" : " scaleY(" + scale_y2 + ")";
      elem.style.transform = scale_str;
    } else {
      if (scale_x2 % 1 === 0 && scale_y2 % 1 === 0) {
        graphic_screen.style["imageRendering"] = "crisp-edges";
        graphic_screen.style["imageRendering"] = "pixelated";
        graphic_screen.style["-ms-interpolation-mode"] = "nearest-neighbor";
      } else {
        graphic_screen.style["imageRendering"] = "";
        graphic_screen.style["-ms-interpolation-mode"] = "";
      }
      var device_pixel_ratio = window.devicePixelRatio || 1;
      if (device_pixel_ratio % 1 !== 0) {
        scale_x2 /= device_pixel_ratio;
        scale_y2 /= device_pixel_ratio;
      }
    }
    if (scale_x2 !== 1) {
      elem.style.width = rectangle.width * scale_x2 + "px";
    }
    if (scale_y2 !== 1) {
      elem.style.height = rectangle.height * scale_y2 + "px";
    }
  }
  this.update_cursor_scanline = function(start, end, enabled) {
    if (start !== cursor_start || end !== cursor_end || enabled !== cursor_enabled) {
      if (mode === MODE_TEXT) {
        if (enabled) {
          cursor_element.style.display = "inline";
          cursor_element.style.height = end - start + "px";
          cursor_element.style.marginTop = start + "px";
        } else {
          cursor_element.style.display = "none";
        }
      } else if (mode === MODE_GRAPHICAL_TEXT) {
        if (cursor_row < text_mode_height) {
          changed_rows[cursor_row] = 1;
        }
      }
      cursor_start = start;
      cursor_end = end;
      cursor_enabled = enabled;
    }
  };
  this.update_cursor = function(row, col) {
    if (row !== cursor_row || col !== cursor_col) {
      if (row < text_mode_height) {
        changed_rows[row] = 1;
      }
      if (cursor_row < text_mode_height) {
        changed_rows[cursor_row] = 1;
      }
      cursor_row = row;
      cursor_col = col;
    }
  };
  this.text_update_row = function(row) {
    var offset = TEXT_BUF_COMPONENT_SIZE * row * text_mode_width, row_element, color_element, fragment;
    var blinking, bg_color, fg_color, text;
    row_element = text_screen.childNodes[row];
    fragment = document.createElement("div");
    for (var i = 0; i < text_mode_width; ) {
      color_element = document.createElement("span");
      blinking = text_mode_data[offset + FLAGS_INDEX] & FLAG_BLINKING;
      bg_color = text_mode_data[offset + BG_COLOR_INDEX];
      fg_color = text_mode_data[offset + FG_COLOR_INDEX];
      if (blinking) {
        color_element.classList.add("blink");
      }
      color_element.style.backgroundColor = number_as_color(bg_color);
      color_element.style.color = number_as_color(fg_color);
      text = "";
      while (i < text_mode_width && (text_mode_data[offset + FLAGS_INDEX] & FLAG_BLINKING) === blinking && text_mode_data[offset + BG_COLOR_INDEX] === bg_color && text_mode_data[offset + FG_COLOR_INDEX] === fg_color) {
        const chr = charmap[text_mode_data[offset + CHARACTER_INDEX]];
        text += chr;
        dbg_assert(chr);
        i++;
        offset += TEXT_BUF_COMPONENT_SIZE;
        if (row === cursor_row) {
          if (i === cursor_col) {
            break;
          } else if (i === cursor_col + 1) {
            cursor_element.style.backgroundColor = color_element.style.color;
            fragment.appendChild(cursor_element);
            break;
          }
        }
      }
      color_element.textContent = text;
      fragment.appendChild(color_element);
    }
    row_element.parentNode.replaceChild(fragment, row_element);
  };
  this.update_buffer = function(layers) {
    if (DEBUG_SCREEN_LAYERS) {
      graphic_context.strokeStyle = "#0F0";
      graphic_context.lineWidth = 4;
      for (const layer of layers) {
        graphic_context.strokeRect(
          layer.buffer_x,
          layer.buffer_y,
          layer.buffer_width,
          layer.buffer_height
        );
      }
      graphic_context.lineWidth = 1;
      return;
    }
    for (const layer of layers) {
      graphic_context.putImageData(
        layer.image_data,
        layer.screen_x - layer.buffer_x,
        layer.screen_y - layer.buffer_y,
        layer.buffer_x,
        layer.buffer_y,
        layer.buffer_width,
        layer.buffer_height
      );
    }
  };
  this.get_text_screen = function() {
    var screen = [];
    for (var i = 0; i < text_mode_height; i++) {
      screen.push(this.get_text_row(i));
    }
    return screen;
  };
  this.get_text_row = function(y) {
    const begin = y * text_mode_width * TEXT_BUF_COMPONENT_SIZE + CHARACTER_INDEX;
    const end = begin + text_mode_width * TEXT_BUF_COMPONENT_SIZE;
    let row = "";
    for (let i = begin; i < end; i += TEXT_BUF_COMPONENT_SIZE) {
      row += charmap[text_mode_data[i]];
    }
    return row;
  };
  this.init();
}

// src/browser/dummy_screen.js
function DummyScreenAdapter(options) {
  var graphic_image_data, cursor_row = 0, cursor_col = 0, graphical_mode_width = 0, graphical_mode_height = 0, is_graphical = false, text_mode_data, text_mode_width = 0, text_mode_height = 0, charmap = get_charmap(options?.encoding);
  this.put_char = function(row, col, chr, blinking, bg_color, fg_color) {
    dbg_assert(row >= 0 && row < text_mode_height);
    dbg_assert(col >= 0 && col < text_mode_width);
    text_mode_data[row * text_mode_width + col] = chr;
  };
  this.destroy = function() {
  };
  this.pause = function() {
  };
  this.continue = function() {
  };
  this.set_mode = function(graphical) {
    is_graphical = graphical;
  };
  this.set_font_bitmap = function(height, width_9px, width_dbl, copy_8th_col, bitmap, bitmap_changed) {
  };
  this.set_font_page = function(page_a, page_b) {
  };
  this.clear_screen = function() {
  };
  this.set_size_text = function(cols, rows) {
    if (cols === text_mode_width && rows === text_mode_height) {
      return;
    }
    text_mode_data = new Uint8Array(cols * rows);
    text_mode_width = cols;
    text_mode_height = rows;
  };
  this.set_size_graphical = function(width, height) {
    graphical_mode_width = width;
    graphical_mode_height = height;
  };
  this.set_scale = function(s_x, s_y) {
  };
  this.update_cursor_scanline = function(start, end, max) {
  };
  this.update_cursor = function(row, col) {
    cursor_row = row;
    cursor_col = col;
  };
  this.update_buffer = function(layers) {
  };
  this.get_text_screen = function() {
    var screen = [];
    for (var i = 0; i < text_mode_height; i++) {
      screen.push(this.get_text_row(i));
    }
    return screen;
  };
  this.get_text_row = function(y) {
    const begin = y * text_mode_width;
    const end = begin + text_mode_width;
    return Array.from(text_mode_data.subarray(begin, end), (chr) => charmap[chr]).join("");
  };
  this.set_size_text(80, 25);
}

// src/vga.js
var VGA_BANK_SIZE = 64 * 1024;
var MAX_XRES = 2560;
var MAX_YRES = 1600;
var MAX_BPP = 32;
var VGA_LFB_ADDRESS = 3758096384;
var VGA_PIXEL_BUFFER_SIZE = 8 * VGA_BANK_SIZE;
var VGA_MIN_MEMORY_SIZE = 4 * VGA_BANK_SIZE;
var VGA_MAX_MEMORY_SIZE = 256 * 1024 * 1024;
var VGA_HOST_MEMORY_SPACE_START = Uint32Array.from([
  655360,
  655360,
  720896,
  753664
]);
var VGA_HOST_MEMORY_SPACE_SIZE = Uint32Array.from([
  131072,
  // 128K
  65536,
  // 64K
  32768,
  // 32K
  32768
  // 32K
]);
function VGAScreen(cpu, bus, screen, vga_memory_size) {
  this.cpu = cpu;
  this.bus = bus;
  this.screen = screen;
  this.vga_memory_size = vga_memory_size;
  this.cursor_address = 0;
  this.cursor_scanline_start = 14;
  this.cursor_scanline_end = 15;
  this.max_cols = 80;
  this.max_rows = 25;
  this.screen_width = 0;
  this.screen_height = 0;
  this.virtual_width = 0;
  this.virtual_height = 0;
  this.layers = [];
  this.start_address = 0;
  this.start_address_latched = 0;
  this.crtc = new Uint8Array(25);
  this.crtc_mode = 0;
  this.horizontal_display_enable_end = 0;
  this.horizontal_blank_start = 0;
  this.vertical_display_enable_end = 0;
  this.vertical_blank_start = 0;
  this.underline_location_register = 0;
  this.preset_row_scan = 0;
  this.offset_register = 0;
  this.line_compare = 0;
  this.graphical_mode = false;
  this.vga256_palette = new Int32Array(256);
  this.latch_dword = 0;
  this.svga_version = 45253;
  this.svga_width = 0;
  this.svga_height = 0;
  this.svga_enabled = false;
  this.svga_bpp = 32;
  this.svga_bank_offset = 0;
  this.svga_offset = 0;
  this.svga_offset_x = 0;
  this.svga_offset_y = 0;
  if (this.vga_memory_size === void 0 || this.vga_memory_size < VGA_MIN_MEMORY_SIZE) {
    this.vga_memory_size = VGA_MIN_MEMORY_SIZE;
  } else if (this.vga_memory_size > VGA_MAX_MEMORY_SIZE) {
    this.vga_memory_size = VGA_MAX_MEMORY_SIZE;
  } else {
    this.vga_memory_size = round_up_to_next_power_of_2(this.vga_memory_size);
  }
  dbg_log("effective vga memory size: " + this.vga_memory_size, LOG_VGA);
  const pci_revision = 0;
  this.pci_space = [
    52,
    18,
    17,
    17,
    3,
    1,
    0,
    0,
    pci_revision,
    0,
    0,
    3,
    0,
    0,
    0,
    0,
    8,
    VGA_LFB_ADDRESS >>> 8,
    VGA_LFB_ADDRESS >>> 16,
    VGA_LFB_ADDRESS >>> 24,
    0,
    0,
    0,
    0,
    0,
    0,
    191,
    254,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    244,
    26,
    0,
    17,
    0,
    0,
    190,
    254,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ];
  this.pci_id = 18 << 3;
  this.pci_bars = [
    {
      size: this.vga_memory_size
    }
  ];
  this.pci_rom_size = 65536;
  this.pci_rom_address = 4272947200;
  this.name = "vga";
  this.index_crtc = 0;
  this.dac_color_index_write = 0;
  this.dac_color_index_read = 0;
  this.dac_state = 0;
  this.dac_mask = 255;
  this.dac_map = new Uint8Array(16);
  this.attribute_controller_index = -1;
  this.palette_source = 32;
  this.attribute_mode = 0;
  this.color_plane_enable = 0;
  this.horizontal_panning = 0;
  this.color_select = 0;
  this.sequencer_index = -1;
  this.plane_write_bm = 15;
  this.sequencer_memory_mode = 0;
  this.clocking_mode = 0;
  this.graphics_index = -1;
  this.character_map_select = 0;
  this.plane_read = 0;
  this.planar_mode = 0;
  this.planar_rotate_reg = 0;
  this.planar_bitmap = 255;
  this.planar_setreset = 0;
  this.planar_setreset_enable = 0;
  this.miscellaneous_graphics_register = 0;
  this.color_compare = 0;
  this.color_dont_care = 0;
  this.max_scan_line = 0;
  this.miscellaneous_output_register = 255;
  this.port_3DA_value = 255;
  this.font_page_ab_enabled = false;
  var io = cpu.io;
  io.register_write(960, this, this.port3C0_write);
  io.register_read(960, this, this.port3C0_read, this.port3C0_read16);
  io.register_read(961, this, this.port3C1_read);
  io.register_write(962, this, this.port3C2_write);
  io.register_write_consecutive(964, this, this.port3C4_write, this.port3C5_write);
  io.register_read(964, this, this.port3C4_read);
  io.register_read(965, this, this.port3C5_read);
  io.register_write_consecutive(974, this, this.port3CE_write, this.port3CF_write);
  io.register_read(974, this, this.port3CE_read);
  io.register_read(975, this, this.port3CF_read);
  io.register_read(966, this, this.port3C6_read);
  io.register_write(966, this, this.port3C6_write);
  io.register_write(967, this, this.port3C7_write);
  io.register_read(967, this, this.port3C7_read);
  io.register_write(968, this, this.port3C8_write);
  io.register_read(968, this, this.port3C8_read);
  io.register_write(969, this, this.port3C9_write);
  io.register_read(969, this, this.port3C9_read);
  io.register_read(972, this, this.port3CC_read);
  io.register_write(980, this, this.port3D4_write, this.port3D4_write16);
  io.register_write(981, this, this.port3D5_write, this.port3D5_write16);
  io.register_read(980, this, this.port3D4_read);
  io.register_read(981, this, this.port3D5_read, this.port3D5_read16);
  io.register_write(948, this, this.port3D4_write, this.port3D4_write16);
  io.register_write(949, this, this.port3D5_write, this.port3D5_write16);
  io.register_read(948, this, this.port3D4_read);
  io.register_read(949, this, this.port3D5_read, this.port3D5_read16);
  io.register_read(970, this, function() {
    dbg_log("3CA read", LOG_VGA);
    return 0;
  });
  io.register_read(986, this, this.port3DA_read);
  io.register_read(954, this, this.port3DA_read);
  this.dispi_index = -1;
  this.dispi_enable_value = 0;
  io.register_write(462, this, void 0, this.port1CE_write);
  io.register_write(463, this, void 0, this.port1CF_write);
  io.register_read(463, this, void 0, this.port1CF_read);
  const vga_offset = cpu.svga_allocate_memory(this.vga_memory_size) >>> 0;
  this.svga_memory = view(Uint8Array, cpu.wasm_memory, vga_offset, this.vga_memory_size);
  this.diff_addr_min = this.vga_memory_size;
  this.diff_addr_max = 0;
  this.diff_plot_min = this.vga_memory_size;
  this.diff_plot_max = 0;
  this.image_data = null;
  this.vga_memory = new Uint8Array(4 * VGA_BANK_SIZE);
  this.plane0 = new Uint8Array(this.vga_memory.buffer, 0 * VGA_BANK_SIZE, VGA_BANK_SIZE);
  this.plane1 = new Uint8Array(this.vga_memory.buffer, 1 * VGA_BANK_SIZE, VGA_BANK_SIZE);
  this.plane2 = new Uint8Array(this.vga_memory.buffer, 2 * VGA_BANK_SIZE, VGA_BANK_SIZE);
  this.plane3 = new Uint8Array(this.vga_memory.buffer, 3 * VGA_BANK_SIZE, VGA_BANK_SIZE);
  this.pixel_buffer = new Uint8Array(VGA_PIXEL_BUFFER_SIZE);
  io.mmap_register(
    655360,
    131072,
    (addr) => this.vga_memory_read(addr),
    (addr, value) => this.vga_memory_write(addr, value)
  );
  cpu.devices.pci.register_device(this);
}
VGAScreen.prototype.get_state = function() {
  var state = [];
  state[0] = this.vga_memory_size;
  state[1] = this.cursor_address;
  state[2] = this.cursor_scanline_start;
  state[3] = this.cursor_scanline_end;
  state[4] = this.max_cols;
  state[5] = this.max_rows;
  state[6] = this.vga_memory;
  state[7] = this.dac_state;
  state[8] = this.start_address;
  state[9] = this.graphical_mode;
  state[10] = this.vga256_palette;
  state[11] = this.latch_dword;
  state[12] = this.color_compare;
  state[13] = this.color_dont_care;
  state[14] = this.miscellaneous_graphics_register;
  state[15] = this.svga_width;
  state[16] = this.svga_height;
  state[17] = this.crtc_mode;
  state[18] = this.svga_enabled;
  state[19] = this.svga_bpp;
  state[20] = this.svga_bank_offset;
  state[21] = this.svga_offset;
  state[22] = this.index_crtc;
  state[23] = this.dac_color_index_write;
  state[24] = this.dac_color_index_read;
  state[25] = this.dac_map;
  state[26] = this.sequencer_index;
  state[27] = this.plane_write_bm;
  state[28] = this.sequencer_memory_mode;
  state[29] = this.graphics_index;
  state[30] = this.plane_read;
  state[31] = this.planar_mode;
  state[32] = this.planar_rotate_reg;
  state[33] = this.planar_bitmap;
  state[34] = this.max_scan_line;
  state[35] = this.miscellaneous_output_register;
  state[36] = this.port_3DA_value;
  state[37] = this.dispi_index;
  state[38] = this.dispi_enable_value;
  state[39] = this.svga_memory;
  state[41] = this.attribute_controller_index;
  state[42] = this.offset_register;
  state[43] = this.planar_setreset;
  state[44] = this.planar_setreset_enable;
  state[45] = this.start_address_latched;
  state[46] = this.crtc;
  state[47] = this.horizontal_display_enable_end;
  state[48] = this.horizontal_blank_start;
  state[49] = this.vertical_display_enable_end;
  state[50] = this.vertical_blank_start;
  state[51] = this.underline_location_register;
  state[52] = this.preset_row_scan;
  state[53] = this.offset_register;
  state[54] = this.palette_source;
  state[55] = this.attribute_mode;
  state[56] = this.color_plane_enable;
  state[57] = this.horizontal_panning;
  state[58] = this.color_select;
  state[59] = this.clocking_mode;
  state[60] = this.line_compare;
  state[61] = this.pixel_buffer;
  state[62] = this.dac_mask;
  state[63] = this.character_map_select;
  state[64] = this.font_page_ab_enabled;
  return state;
};
VGAScreen.prototype.set_state = function(state) {
  this.vga_memory_size = state[0];
  this.cursor_address = state[1];
  this.cursor_scanline_start = state[2];
  this.cursor_scanline_end = state[3];
  this.max_cols = state[4];
  this.max_rows = state[5];
  state[6] && this.vga_memory.set(state[6]);
  this.dac_state = state[7];
  this.start_address = state[8];
  this.graphical_mode = state[9];
  this.vga256_palette = state[10];
  this.latch_dword = state[11];
  this.color_compare = state[12];
  this.color_dont_care = state[13];
  this.miscellaneous_graphics_register = state[14];
  this.svga_width = state[15];
  this.svga_height = state[16];
  this.crtc_mode = state[17];
  this.svga_enabled = state[18];
  this.svga_bpp = state[19];
  this.svga_bank_offset = state[20];
  this.svga_offset = state[21];
  this.index_crtc = state[22];
  this.dac_color_index_write = state[23];
  this.dac_color_index_read = state[24];
  this.dac_map = state[25];
  this.sequencer_index = state[26];
  this.plane_write_bm = state[27];
  this.sequencer_memory_mode = state[28];
  this.graphics_index = state[29];
  this.plane_read = state[30];
  this.planar_mode = state[31];
  this.planar_rotate_reg = state[32];
  this.planar_bitmap = state[33];
  this.max_scan_line = state[34];
  this.miscellaneous_output_register = state[35];
  this.port_3DA_value = state[36];
  this.dispi_index = state[37];
  this.dispi_enable_value = state[38];
  this.svga_memory.set(state[39]);
  this.attribute_controller_index = state[41];
  this.offset_register = state[42];
  this.planar_setreset = state[43];
  this.planar_setreset_enable = state[44];
  this.start_address_latched = state[45];
  this.crtc.set(state[46]);
  this.horizontal_display_enable_end = state[47];
  this.horizontal_blank_start = state[48];
  this.vertical_display_enable_end = state[49];
  this.vertical_blank_start = state[50];
  this.underline_location_register = state[51];
  this.preset_row_scan = state[52];
  this.offset_register = state[53];
  this.palette_source = state[54];
  this.attribute_mode = state[55];
  this.color_plane_enable = state[56];
  this.horizontal_panning = state[57];
  this.color_select = state[58];
  this.clocking_mode = state[59];
  this.line_compare = state[60];
  state[61] && this.pixel_buffer.set(state[61]);
  this.dac_mask = state[62] === void 0 ? 255 : state[62];
  this.character_map_select = state[63] === void 0 ? 0 : state[63];
  this.font_page_ab_enabled = state[64] === void 0 ? 0 : state[64];
  this.screen.set_mode(this.graphical_mode);
  if (this.graphical_mode) {
    this.screen_width = 0;
    this.screen_height = 0;
    if (this.svga_enabled) {
      this.set_size_graphical(this.svga_width, this.svga_height, this.svga_width, this.svga_height, this.svga_bpp);
      this.update_layers();
    } else {
      this.update_vga_size();
      this.update_layers();
      this.complete_replot();
    }
  } else {
    this.set_font_bitmap(true);
    this.set_size_text(this.max_cols, this.max_rows);
    this.set_font_page();
    this.update_cursor_scanline();
    this.update_cursor();
  }
  this.complete_redraw();
};
VGAScreen.prototype.vga_memory_read = function(addr) {
  if (this.svga_enabled) {
    return this.cpu.read8((addr - 655360 | this.svga_bank_offset) + VGA_LFB_ADDRESS | 0);
  }
  var memory_space_select = this.miscellaneous_graphics_register >> 2 & 3;
  addr -= VGA_HOST_MEMORY_SPACE_START[memory_space_select];
  if (addr < 0 || addr >= VGA_HOST_MEMORY_SPACE_SIZE[memory_space_select]) {
    dbg_log("vga read outside memory space: addr:" + h(addr >>> 0), LOG_VGA);
    return 0;
  }
  this.latch_dword = this.plane0[addr];
  this.latch_dword |= this.plane1[addr] << 8;
  this.latch_dword |= this.plane2[addr] << 16;
  this.latch_dword |= this.plane3[addr] << 24;
  if (this.planar_mode & 8) {
    var reading = 255;
    if (this.color_dont_care & 1) {
      reading &= this.plane0[addr] ^ ~(this.color_compare & 1 ? 255 : 0);
    }
    if (this.color_dont_care & 2) {
      reading &= this.plane1[addr] ^ ~(this.color_compare & 2 ? 255 : 0);
    }
    if (this.color_dont_care & 4) {
      reading &= this.plane2[addr] ^ ~(this.color_compare & 4 ? 255 : 0);
    }
    if (this.color_dont_care & 8) {
      reading &= this.plane3[addr] ^ ~(this.color_compare & 8 ? 255 : 0);
    }
    return reading;
  } else {
    var plane = this.plane_read;
    if (!this.graphical_mode) {
      plane &= 3;
    } else if (this.sequencer_memory_mode & 8) {
      plane = addr & 3;
      addr &= ~3;
    } else if (this.planar_mode & 16) {
      plane = addr & 1;
      addr &= ~1;
    }
    return this.vga_memory[plane << 16 | addr];
  }
};
VGAScreen.prototype.vga_memory_write = function(addr, value) {
  if (this.svga_enabled) {
    this.cpu.write8((addr - 655360 | this.svga_bank_offset) + VGA_LFB_ADDRESS | 0, value);
    return;
  }
  var memory_space_select = this.miscellaneous_graphics_register >> 2 & 3;
  addr -= VGA_HOST_MEMORY_SPACE_START[memory_space_select];
  if (addr < 0 || addr >= VGA_HOST_MEMORY_SPACE_SIZE[memory_space_select]) {
    dbg_log("vga write outside memory space: addr:" + h(addr >>> 0) + ", value:" + h(value), LOG_VGA);
    return;
  }
  if (this.graphical_mode) {
    this.vga_memory_write_graphical(addr, value);
  } else if (!(this.plane_write_bm & 3)) {
    if (this.plane_write_bm & 4) {
      this.plane2[addr] = value;
    }
  } else {
    this.vga_memory_write_text_mode(addr, value);
  }
};
VGAScreen.prototype.vga_memory_write_graphical = function(addr, value) {
  var plane_dword;
  var write_mode = this.planar_mode & 3;
  var bitmask = this.apply_feed(this.planar_bitmap);
  var setreset_dword = this.apply_expand(this.planar_setreset);
  var setreset_enable_dword = this.apply_expand(this.planar_setreset_enable);
  switch (write_mode) {
    case 0:
      value = this.apply_rotate(value);
      plane_dword = this.apply_feed(value);
      plane_dword = this.apply_setreset(plane_dword, setreset_enable_dword);
      plane_dword = this.apply_logical(plane_dword, this.latch_dword);
      plane_dword = this.apply_bitmask(plane_dword, bitmask);
      break;
    case 1:
      plane_dword = this.latch_dword;
      break;
    case 2:
      plane_dword = this.apply_expand(value);
      plane_dword = this.apply_logical(plane_dword, this.latch_dword);
      plane_dword = this.apply_bitmask(plane_dword, bitmask);
      break;
    case 3:
      value = this.apply_rotate(value);
      bitmask &= this.apply_feed(value);
      plane_dword = setreset_dword;
      plane_dword = this.apply_bitmask(plane_dword, bitmask);
      break;
  }
  var plane_select = 15;
  switch (this.sequencer_memory_mode & 12) {
    // Odd/Even (aka chain 2)
    case 0:
      plane_select = 5 << (addr & 1);
      addr &= ~1;
      break;
    // Chain 4
    // Note: FreeVGA may have mistakenly stated that this bit field is
    // for system read only, yet the IBM Open Source Graphics Programmer's
    // Reference Manual explicitly states "both read and write".
    case 8:
    case 12:
      plane_select = 1 << (addr & 3);
      addr &= ~3;
      break;
  }
  plane_select &= this.plane_write_bm;
  if (plane_select & 1) this.plane0[addr] = plane_dword >> 0 & 255;
  if (plane_select & 2) this.plane1[addr] = plane_dword >> 8 & 255;
  if (plane_select & 4) this.plane2[addr] = plane_dword >> 16 & 255;
  if (plane_select & 8) this.plane3[addr] = plane_dword >> 24 & 255;
  var pixel_addr = this.vga_addr_to_pixel(addr);
  this.partial_replot(pixel_addr, pixel_addr + 7);
};
VGAScreen.prototype.apply_feed = function(data_byte) {
  var dword = data_byte;
  dword |= data_byte << 8;
  dword |= data_byte << 16;
  dword |= data_byte << 24;
  return dword;
};
VGAScreen.prototype.apply_expand = function(data_byte) {
  var dword = data_byte & 1 ? 255 : 0;
  dword |= (data_byte & 2 ? 255 : 0) << 8;
  dword |= (data_byte & 4 ? 255 : 0) << 16;
  dword |= (data_byte & 8 ? 255 : 0) << 24;
  return dword;
};
VGAScreen.prototype.apply_rotate = function(data_byte) {
  var wrapped = data_byte | data_byte << 8;
  var count = this.planar_rotate_reg & 7;
  var shifted = wrapped >>> count;
  return shifted & 255;
};
VGAScreen.prototype.apply_setreset = function(data_dword, enable_dword) {
  var setreset_dword = this.apply_expand(this.planar_setreset);
  data_dword |= enable_dword & setreset_dword;
  data_dword &= ~enable_dword | setreset_dword;
  return data_dword;
};
VGAScreen.prototype.apply_logical = function(data_dword, latch_dword) {
  switch (this.planar_rotate_reg & 24) {
    case 8:
      return data_dword & latch_dword;
    case 16:
      return data_dword | latch_dword;
    case 24:
      return data_dword ^ latch_dword;
  }
  return data_dword;
};
VGAScreen.prototype.apply_bitmask = function(data_dword, bitmask_dword) {
  var plane_dword = bitmask_dword & data_dword;
  plane_dword |= ~bitmask_dword & this.latch_dword;
  return plane_dword;
};
VGAScreen.prototype.text_mode_redraw = function() {
  const split_screen_row = this.scan_line_to_screen_row(this.line_compare);
  const row_offset = Math.max(0, (this.offset_register * 2 - this.max_cols) * 2);
  const blink_enabled = this.attribute_mode & 1 << 3;
  const fg_color_mask = this.font_page_ab_enabled ? 7 : 15;
  const bg_color_mask = blink_enabled ? 7 : 15;
  const FLAG_BLINKING = this.screen.FLAG_BLINKING;
  const FLAG_FONT_PAGE_B = this.screen.FLAG_FONT_PAGE_B;
  let addr = this.start_address << 1;
  for (let row = 0; row < this.max_rows; row++) {
    if (row === split_screen_row) {
      addr = 0;
    }
    for (let col = 0; col < this.max_cols; col++) {
      const chr = this.vga_memory[addr];
      const color = this.vga_memory[addr | 1];
      const blinking = blink_enabled && color & 1 << 7;
      const font_page_b = this.font_page_ab_enabled && !(color & 1 << 3);
      const flags = (blinking ? FLAG_BLINKING : 0) | (font_page_b ? FLAG_FONT_PAGE_B : 0);
      this.bus.send("screen-put-char", [row, col, chr]);
      this.screen.put_char(
        row,
        col,
        chr,
        flags,
        this.vga256_palette[this.dac_mask & this.dac_map[color >> 4 & bg_color_mask]],
        this.vga256_palette[this.dac_mask & this.dac_map[color & fg_color_mask]]
      );
      addr += 2;
    }
    addr += row_offset;
  }
};
VGAScreen.prototype.vga_memory_write_text_mode = function(addr, value) {
  this.vga_memory[addr] = value;
  const max_cols = Math.max(this.max_cols, this.offset_register * 2);
  let row;
  let col;
  if (addr >> 1 >= this.start_address) {
    const memory_start = (addr >> 1) - this.start_address;
    row = memory_start / max_cols | 0;
    col = memory_start % max_cols;
  } else {
    const memory_start = addr >> 1;
    row = (memory_start / max_cols | 0) + this.scan_line_to_screen_row(this.line_compare);
    col = memory_start % max_cols;
  }
  dbg_assert(row >= 0 && col >= 0);
  if (col >= this.max_cols || row >= this.max_rows) {
    return;
  }
  let chr;
  let color;
  if (addr & 1) {
    color = value;
    chr = this.vga_memory[addr & ~1];
  } else {
    chr = value;
    color = this.vga_memory[addr | 1];
  }
  const blink_enabled = this.attribute_mode & 1 << 3;
  const blinking = blink_enabled && color & 1 << 7;
  const font_page_b = this.font_page_ab_enabled && !(color & 1 << 3);
  const flags = (blinking ? this.screen.FLAG_BLINKING : 0) | (font_page_b ? this.screen.FLAG_FONT_PAGE_B : 0);
  const fg_color_mask = this.font_page_ab_enabled ? 7 : 15;
  const bg_color_mask = blink_enabled ? 7 : 15;
  this.bus.send("screen-put-char", [row, col, chr]);
  this.screen.put_char(
    row,
    col,
    chr,
    flags,
    this.vga256_palette[this.dac_mask & this.dac_map[color >> 4 & bg_color_mask]],
    this.vga256_palette[this.dac_mask & this.dac_map[color & fg_color_mask]]
  );
};
VGAScreen.prototype.update_cursor = function() {
  const max_cols = Math.max(this.max_cols, this.offset_register * 2);
  let row;
  let col;
  if (this.cursor_address >= this.start_address) {
    row = (this.cursor_address - this.start_address) / max_cols | 0;
    col = (this.cursor_address - this.start_address) % max_cols;
  } else {
    row = (this.cursor_address / max_cols | 0) + this.scan_line_to_screen_row(this.line_compare);
    col = this.cursor_address % max_cols;
  }
  dbg_assert(row >= 0 && col >= 0);
  this.screen.update_cursor(row, col);
};
VGAScreen.prototype.complete_redraw = function() {
  dbg_log("complete redraw", LOG_VGA);
  if (this.graphical_mode) {
    if (this.svga_enabled) {
      this.cpu.svga_mark_dirty();
    } else {
      this.diff_addr_min = 0;
      this.diff_addr_max = VGA_PIXEL_BUFFER_SIZE;
    }
  } else {
    this.text_mode_redraw();
  }
};
VGAScreen.prototype.complete_replot = function() {
  dbg_log("complete replot", LOG_VGA);
  if (!this.graphical_mode || this.svga_enabled) {
    return;
  }
  this.diff_plot_min = 0;
  this.diff_plot_max = VGA_PIXEL_BUFFER_SIZE;
  this.complete_redraw();
};
VGAScreen.prototype.partial_redraw = function(min, max) {
  if (min < this.diff_addr_min) this.diff_addr_min = min;
  if (max > this.diff_addr_max) this.diff_addr_max = max;
};
VGAScreen.prototype.partial_replot = function(min, max) {
  if (min < this.diff_plot_min) this.diff_plot_min = min;
  if (max > this.diff_plot_max) this.diff_plot_max = max;
  this.partial_redraw(min, max);
};
VGAScreen.prototype.reset_diffs = function() {
  this.diff_addr_min = this.vga_memory_size;
  this.diff_addr_max = 0;
  this.diff_plot_min = this.vga_memory_size;
  this.diff_plot_max = 0;
};
VGAScreen.prototype.destroy = function() {
};
VGAScreen.prototype.vga_bytes_per_line = function() {
  var bytes_per_line = this.offset_register << 2;
  if (this.underline_location_register & 64) bytes_per_line <<= 1;
  else if (this.crtc_mode & 64) bytes_per_line >>>= 1;
  return bytes_per_line;
};
VGAScreen.prototype.vga_addr_shift_count = function() {
  var shift_count = 128;
  shift_count += ~this.underline_location_register & this.crtc_mode & 64;
  shift_count -= this.underline_location_register & 64;
  shift_count -= this.attribute_mode & 64;
  return shift_count >>> 6;
};
VGAScreen.prototype.vga_addr_to_pixel = function(addr) {
  var shift_count = this.vga_addr_shift_count();
  if (~this.crtc_mode & 3) {
    var pixel_addr = addr - this.start_address;
    pixel_addr &= this.crtc_mode << 13 | ~24576;
    pixel_addr <<= shift_count;
    var row = pixel_addr / this.virtual_width | 0;
    var col = pixel_addr % this.virtual_width;
    switch (this.crtc_mode & 3) {
      case 2:
        row = row << 1 | addr >> 13 & 1;
        break;
      case 1:
        row = row << 1 | addr >> 14 & 1;
        break;
      case 0:
        row = row << 2 | addr >> 13 & 3;
        break;
    }
    return row * this.virtual_width + col + (this.start_address << shift_count);
  } else {
    return addr << shift_count;
  }
};
VGAScreen.prototype.scan_line_to_screen_row = function(scan_line) {
  if (this.max_scan_line & 128) {
    scan_line >>>= 1;
  }
  var repeat_factor = 1 + (this.max_scan_line & 31);
  scan_line = Math.ceil(scan_line / repeat_factor);
  if (!(this.crtc_mode & 1)) {
    scan_line <<= 1;
  }
  if (!(this.crtc_mode & 2)) {
    scan_line <<= 1;
  }
  return scan_line;
};
VGAScreen.prototype.set_size_text = function(cols_count, rows_count) {
  dbg_assert(!this.graphical_mode);
  this.max_cols = cols_count;
  this.max_rows = rows_count;
  this.screen.set_size_text(cols_count, rows_count);
  this.bus.send("screen-set-size", [cols_count, rows_count, 0]);
};
VGAScreen.prototype.set_size_graphical = function(width, height, virtual_width, virtual_height, bpp) {
  dbg_assert(this.graphical_mode);
  virtual_width = Math.max(virtual_width, 1);
  virtual_height = Math.max(virtual_height, 1);
  const needs_update = this.screen_width !== width || this.screen_height !== height || this.virtual_width !== virtual_width || this.virtual_height !== virtual_height;
  if (needs_update) {
    this.screen_width = width;
    this.screen_height = height;
    this.virtual_width = virtual_width;
    this.virtual_height = virtual_height;
    if (typeof ImageData !== "undefined") {
      const size = virtual_width * virtual_height;
      const offset = this.cpu.svga_allocate_dest_buffer(size) >>> 0;
      this.dest_buffet_offset = offset;
      this.image_data = new ImageData(new Uint8ClampedArray(this.cpu.wasm_memory.buffer, offset, 4 * size), virtual_width, virtual_height);
      this.cpu.svga_mark_dirty();
    } else {
    }
    this.screen.set_size_graphical(width, height, virtual_width, virtual_height);
    this.bus.send("screen-set-size", [width, height, bpp]);
  }
};
VGAScreen.prototype.update_vga_size = function() {
  if (this.svga_enabled) {
    return;
  }
  var horizontal_characters = Math.min(
    1 + this.horizontal_display_enable_end,
    this.horizontal_blank_start
  );
  var vertical_scans = Math.min(
    1 + this.vertical_display_enable_end,
    this.vertical_blank_start
  );
  if (!horizontal_characters || !vertical_scans) {
    return;
  }
  if (this.graphical_mode) {
    var screen_width = horizontal_characters << 3;
    var virtual_width = this.offset_register << 4;
    var bpp = 4;
    if (this.attribute_mode & 64) {
      screen_width >>>= 1;
      virtual_width >>>= 1;
      bpp = 8;
    } else if (this.attribute_mode & 2) {
      bpp = 1;
    }
    var screen_height = this.scan_line_to_screen_row(vertical_scans);
    var available_bytes = VGA_HOST_MEMORY_SPACE_SIZE[0];
    const bytes_per_line = this.vga_bytes_per_line();
    const virtual_height = bytes_per_line ? Math.ceil(available_bytes / bytes_per_line) : screen_height;
    this.set_size_graphical(screen_width, screen_height, virtual_width, virtual_height, bpp);
    this.update_vertical_retrace();
    this.update_layers();
  } else {
    if (this.max_scan_line & 128) {
      vertical_scans >>>= 1;
    }
    var height = vertical_scans / (1 + (this.max_scan_line & 31)) | 0;
    if (horizontal_characters && height) {
      this.set_size_text(horizontal_characters, height);
    }
  }
};
VGAScreen.prototype.update_layers = function() {
  if (!this.graphical_mode) {
    this.text_mode_redraw();
  }
  if (this.svga_enabled) {
    this.layers = [];
    return;
  }
  if (!this.virtual_width || !this.screen_width) {
    return;
  }
  if (!this.palette_source || this.clocking_mode & 32) {
    this.layers = [];
    this.screen.clear_screen();
    return;
  }
  var start_addr = this.start_address_latched;
  var pixel_panning = this.horizontal_panning;
  if (this.attribute_mode & 64) {
    pixel_panning >>>= 1;
  }
  var byte_panning = this.preset_row_scan >> 5 & 3;
  var pixel_addr_start = this.vga_addr_to_pixel(start_addr + byte_panning);
  var start_buffer_row = pixel_addr_start / this.virtual_width | 0;
  var start_buffer_col = pixel_addr_start % this.virtual_width + pixel_panning;
  var split_screen_row = this.scan_line_to_screen_row(1 + this.line_compare);
  split_screen_row = Math.min(split_screen_row, this.screen_height);
  var split_buffer_height = this.screen_height - split_screen_row;
  this.layers = [];
  for (var x = -start_buffer_col, y = 0; x < this.screen_width; x += this.virtual_width, y++) {
    this.layers.push({
      image_data: this.image_data,
      screen_x: x,
      screen_y: 0,
      buffer_x: 0,
      buffer_y: start_buffer_row + y,
      buffer_width: this.virtual_width,
      buffer_height: split_screen_row
    });
  }
  var start_split_col = 0;
  if (!(this.attribute_mode & 32)) {
    start_split_col = this.vga_addr_to_pixel(byte_panning) + pixel_panning;
  }
  for (var x = -start_split_col, y = 0; x < this.screen_width; x += this.virtual_width, y++) {
    this.layers.push({
      image_data: this.image_data,
      screen_x: x,
      screen_y: split_screen_row,
      buffer_x: 0,
      buffer_y: y,
      buffer_width: this.virtual_width,
      buffer_height: split_buffer_height
    });
  }
};
VGAScreen.prototype.update_vertical_retrace = function() {
  this.port_3DA_value |= 8;
  if (this.start_address_latched !== this.start_address) {
    this.start_address_latched = this.start_address;
    this.update_layers();
  }
};
VGAScreen.prototype.update_cursor_scanline = function() {
  const disabled = this.cursor_scanline_start & 32;
  const max = this.max_scan_line & 31;
  const start = Math.min(max, this.cursor_scanline_start & 31);
  const end = Math.min(max, this.cursor_scanline_end & 31);
  const visible = !disabled && start < end;
  this.screen.update_cursor_scanline(start, end, visible);
};
VGAScreen.prototype.port3C0_write = function(value) {
  if (this.attribute_controller_index === -1) {
    dbg_log("attribute controller index register: " + h(value), LOG_VGA);
    this.attribute_controller_index = value & 31;
    dbg_log("attribute actual index: " + h(this.attribute_controller_index), LOG_VGA);
    if (this.palette_source !== (value & 32)) {
      this.palette_source = value & 32;
      this.update_layers();
    }
  } else {
    if (this.attribute_controller_index < 16) {
      dbg_log("internal palette: " + h(this.attribute_controller_index) + " -> " + h(value), LOG_VGA);
      this.dac_map[this.attribute_controller_index] = value;
      if (!(this.attribute_mode & 64)) {
        this.complete_redraw();
      }
    } else
      switch (this.attribute_controller_index) {
        case 16:
          dbg_log("3C0 / attribute mode control: " + h(value), LOG_VGA);
          if (this.attribute_mode !== value) {
            var previous_mode = this.attribute_mode;
            this.attribute_mode = value;
            const is_graphical = (value & 1) !== 0;
            if (!this.svga_enabled && this.graphical_mode !== is_graphical) {
              this.graphical_mode = is_graphical;
              this.screen.set_mode(this.graphical_mode);
            }
            if ((previous_mode ^ value) & 64) {
              this.complete_replot();
            }
            this.update_vga_size();
            this.complete_redraw();
            this.set_font_bitmap(false);
          }
          break;
        case 18:
          dbg_log("3C0 / color plane enable: " + h(value), LOG_VGA);
          if (this.color_plane_enable !== value) {
            this.color_plane_enable = value;
            this.complete_redraw();
          }
          break;
        case 19:
          dbg_log("3C0 / horizontal panning: " + h(value), LOG_VGA);
          if (this.horizontal_panning !== value) {
            this.horizontal_panning = value & 15;
            this.update_layers();
          }
          break;
        case 20:
          dbg_log("3C0 / color select: " + h(value), LOG_VGA);
          if (this.color_select !== value) {
            this.color_select = value;
            this.complete_redraw();
          }
          break;
        default:
          dbg_log("3C0 / attribute controller write " + h(this.attribute_controller_index) + ": " + h(value), LOG_VGA);
      }
    this.attribute_controller_index = -1;
  }
};
VGAScreen.prototype.port3C0_read = function() {
  dbg_log("3C0 read", LOG_VGA);
  return (this.attribute_controller_index | this.palette_source) & 255;
};
VGAScreen.prototype.port3C0_read16 = function() {
  dbg_log("3C0 read16", LOG_VGA);
  return this.port3C0_read() | this.port3C1_read() << 8 & 65280;
};
VGAScreen.prototype.port3C1_read = function() {
  if (this.attribute_controller_index < 16) {
    dbg_log("3C1 / internal palette read: " + h(this.attribute_controller_index) + " -> " + h(this.dac_map[this.attribute_controller_index]), LOG_VGA);
    return this.dac_map[this.attribute_controller_index] & 255;
  }
  switch (this.attribute_controller_index) {
    case 16:
      dbg_log("3C1 / attribute mode read: " + h(this.attribute_mode), LOG_VGA);
      return this.attribute_mode;
    case 18:
      dbg_log("3C1 / color plane enable read: " + h(this.color_plane_enable), LOG_VGA);
      return this.color_plane_enable;
    case 19:
      dbg_log("3C1 / horizontal panning read: " + h(this.horizontal_panning), LOG_VGA);
      return this.horizontal_panning;
    case 20:
      dbg_log("3C1 / color select read: " + h(this.color_select), LOG_VGA);
      return this.color_select;
    default:
      dbg_log("3C1 / attribute controller read " + h(this.attribute_controller_index), LOG_VGA);
  }
  return 255;
};
VGAScreen.prototype.port3C2_write = function(value) {
  dbg_log("3C2 / miscellaneous output register = " + h(value), LOG_VGA);
  this.miscellaneous_output_register = value;
};
VGAScreen.prototype.port3C4_write = function(value) {
  this.sequencer_index = value;
};
VGAScreen.prototype.port3C4_read = function() {
  return this.sequencer_index;
};
VGAScreen.prototype.port3C5_write = function(value) {
  switch (this.sequencer_index) {
    case 1:
      dbg_log("clocking mode: " + h(value), LOG_VGA);
      var previous_clocking_mode = this.clocking_mode;
      this.clocking_mode = value;
      if ((previous_clocking_mode ^ value) & 32) {
        this.update_layers();
      }
      this.set_font_bitmap(false);
      break;
    case 2:
      dbg_log("plane write mask: " + h(value), LOG_VGA);
      var previous_plane_write_bm = this.plane_write_bm;
      this.plane_write_bm = value;
      if (!this.graphical_mode && previous_plane_write_bm & 4 && !(this.plane_write_bm & 4)) {
        this.set_font_bitmap(true);
      }
      break;
    case 3:
      dbg_log("character map select: " + h(value), LOG_VGA);
      var previous_character_map_select = this.character_map_select;
      this.character_map_select = value;
      if (!this.graphical_mode && previous_character_map_select !== value) {
        this.set_font_page();
      }
      break;
    case 4:
      dbg_log("sequencer memory mode: " + h(value), LOG_VGA);
      this.sequencer_memory_mode = value;
      break;
    default:
      dbg_log("3C5 / sequencer write " + h(this.sequencer_index) + ": " + h(value), LOG_VGA);
  }
};
VGAScreen.prototype.port3C5_read = function() {
  dbg_log("3C5 / sequencer read " + h(this.sequencer_index), LOG_VGA);
  switch (this.sequencer_index) {
    case 1:
      return this.clocking_mode;
    case 2:
      return this.plane_write_bm;
    case 3:
      return this.character_map_select;
    case 4:
      return this.sequencer_memory_mode;
    case 6:
      return 18;
    default:
  }
  return 0;
};
VGAScreen.prototype.port3C6_write = function(data) {
  if (this.dac_mask !== data) {
    this.dac_mask = data;
    this.complete_redraw();
  }
};
VGAScreen.prototype.port3C6_read = function() {
  return this.dac_mask;
};
VGAScreen.prototype.port3C7_write = function(index) {
  dbg_log("3C7 write: " + h(index), LOG_VGA);
  this.dac_color_index_read = index * 3;
  this.dac_state &= 0;
};
VGAScreen.prototype.port3C7_read = function() {
  return this.dac_state;
};
VGAScreen.prototype.port3C8_write = function(index) {
  this.dac_color_index_write = index * 3;
  this.dac_state |= 3;
};
VGAScreen.prototype.port3C8_read = function() {
  return this.dac_color_index_write / 3 & 255;
};
VGAScreen.prototype.port3C9_write = function(color_byte) {
  var index = this.dac_color_index_write / 3 | 0, offset = this.dac_color_index_write % 3, color = this.vga256_palette[index];
  if ((this.dispi_enable_value & 32) === 0) {
    color_byte &= 63;
    const b = color_byte & 1;
    color_byte = color_byte << 2 | b << 1 | b;
  }
  if (offset === 0) {
    color = color & ~16711680 | color_byte << 16;
  } else if (offset === 1) {
    color = color & ~65280 | color_byte << 8;
  } else {
    color = color & ~255 | color_byte;
    dbg_log("dac set color, index=" + h(index) + " value=" + h(color), LOG_VGA);
  }
  if (this.vga256_palette[index] !== color) {
    this.vga256_palette[index] = color;
    this.complete_redraw();
  }
  this.dac_color_index_write++;
};
VGAScreen.prototype.port3C9_read = function() {
  dbg_log("3C9 read", LOG_VGA);
  var index = this.dac_color_index_read / 3 | 0;
  var offset = this.dac_color_index_read % 3;
  var color = this.vga256_palette[index];
  var color8 = color >> (2 - offset) * 8 & 255;
  this.dac_color_index_read++;
  if (this.dispi_enable_value & 32) {
    return color8;
  } else {
    return color8 >> 2;
  }
};
VGAScreen.prototype.port3CC_read = function() {
  dbg_log("3CC read", LOG_VGA);
  return this.miscellaneous_output_register;
};
VGAScreen.prototype.port3CE_write = function(value) {
  this.graphics_index = value;
};
VGAScreen.prototype.port3CE_read = function() {
  return this.graphics_index;
};
VGAScreen.prototype.port3CF_write = function(value) {
  switch (this.graphics_index) {
    case 0:
      this.planar_setreset = value;
      dbg_log("plane set/reset: " + h(value), LOG_VGA);
      break;
    case 1:
      this.planar_setreset_enable = value;
      dbg_log("plane set/reset enable: " + h(value), LOG_VGA);
      break;
    case 2:
      this.color_compare = value;
      dbg_log("color compare: " + h(value), LOG_VGA);
      break;
    case 3:
      this.planar_rotate_reg = value;
      dbg_log("plane rotate: " + h(value), LOG_VGA);
      break;
    case 4:
      this.plane_read = value;
      dbg_log("plane read: " + h(value), LOG_VGA);
      break;
    case 5:
      var previous_planar_mode = this.planar_mode;
      this.planar_mode = value;
      dbg_log("planar mode: " + h(value), LOG_VGA);
      if ((previous_planar_mode ^ value) & 96) {
        this.complete_replot();
      }
      break;
    case 6:
      dbg_log("miscellaneous graphics register: " + h(value), LOG_VGA);
      if (this.miscellaneous_graphics_register !== value) {
        this.miscellaneous_graphics_register = value;
        this.update_vga_size();
      }
      break;
    case 7:
      this.color_dont_care = value;
      dbg_log("color don't care: " + h(value), LOG_VGA);
      break;
    case 8:
      this.planar_bitmap = value;
      dbg_log("planar bitmap: " + h(value), LOG_VGA);
      break;
    default:
      dbg_log("3CF / graphics write " + h(this.graphics_index) + ": " + h(value), LOG_VGA);
  }
};
VGAScreen.prototype.port3CF_read = function() {
  dbg_log("3CF / graphics read " + h(this.graphics_index), LOG_VGA);
  switch (this.graphics_index) {
    case 0:
      return this.planar_setreset;
    case 1:
      return this.planar_setreset_enable;
    case 2:
      return this.color_compare;
    case 3:
      return this.planar_rotate_reg;
    case 4:
      return this.plane_read;
    case 5:
      return this.planar_mode;
    case 6:
      return this.miscellaneous_graphics_register;
    case 7:
      return this.color_dont_care;
    case 8:
      return this.planar_bitmap;
    default:
  }
  return 0;
};
VGAScreen.prototype.port3D4_write = function(register) {
  dbg_log("3D4 / crtc index: " + register, LOG_VGA);
  this.index_crtc = register;
};
VGAScreen.prototype.port3D4_write16 = function(register) {
  this.port3D4_write(register & 255);
  this.port3D5_write(register >> 8 & 255);
};
VGAScreen.prototype.port3D4_read = function() {
  dbg_log("3D4 read / crtc index: " + this.index_crtc, LOG_VGA);
  return this.index_crtc;
};
VGAScreen.prototype.port3D5_write = function(value) {
  switch (this.index_crtc) {
    case 1:
      dbg_log("3D5 / hdisp enable end write: " + h(value), LOG_VGA);
      if (this.horizontal_display_enable_end !== value) {
        this.horizontal_display_enable_end = value;
        this.update_vga_size();
      }
      break;
    case 2:
      if (this.horizontal_blank_start !== value) {
        this.horizontal_blank_start = value;
        this.update_vga_size();
      }
      break;
    case 7:
      dbg_log("3D5 / overflow register write: " + h(value), LOG_VGA);
      var previous_vertical_display_enable_end = this.vertical_display_enable_end;
      this.vertical_display_enable_end &= 255;
      this.vertical_display_enable_end |= value << 3 & 512 | value << 7 & 256;
      if (previous_vertical_display_enable_end !== this.vertical_display_enable_end) {
        this.update_vga_size();
      }
      this.line_compare = this.line_compare & 767 | value << 4 & 256;
      var previous_vertical_blank_start = this.vertical_blank_start;
      this.vertical_blank_start = this.vertical_blank_start & 767 | value << 5 & 256;
      if (previous_vertical_blank_start !== this.vertical_blank_start) {
        this.update_vga_size();
      }
      this.update_layers();
      break;
    case 8:
      dbg_log("3D5 / preset row scan write: " + h(value), LOG_VGA);
      this.preset_row_scan = value;
      this.update_layers();
      break;
    case 9:
      dbg_log("3D5 / max scan line write: " + h(value), LOG_VGA);
      var previous_max_scan_line = this.max_scan_line;
      this.max_scan_line = value;
      this.line_compare = this.line_compare & 511 | value << 3 & 512;
      var previous_vertical_blank_start = this.vertical_blank_start;
      this.vertical_blank_start = this.vertical_blank_start & 511 | value << 4 & 512;
      if ((previous_max_scan_line ^ this.max_scan_line) & 159 || previous_vertical_blank_start !== this.vertical_blank_start) {
        this.update_vga_size();
      }
      this.update_cursor_scanline();
      this.update_layers();
      this.set_font_bitmap(false);
      break;
    case 10:
      dbg_log("3D5 / cursor scanline start write: " + h(value), LOG_VGA);
      this.cursor_scanline_start = value;
      this.update_cursor_scanline();
      break;
    case 11:
      dbg_log("3D5 / cursor scanline end write: " + h(value), LOG_VGA);
      this.cursor_scanline_end = value;
      this.update_cursor_scanline();
      break;
    case 12:
      if ((this.start_address >> 8 & 255) !== value) {
        this.start_address = this.start_address & 255 | value << 8;
        this.update_layers();
        if (~this.crtc_mode & 3) {
          this.complete_replot();
        }
      }
      dbg_log("3D5 / start addr hi write: " + h(value) + " -> " + h(this.start_address, 4), LOG_VGA);
      break;
    case 13:
      if ((this.start_address & 255) !== value) {
        this.start_address = this.start_address & 65280 | value;
        this.update_layers();
        if (~this.crtc_mode & 3) {
          this.complete_replot();
        }
      }
      dbg_log("3D5 / start addr lo write: " + h(value) + " -> " + h(this.start_address, 4), LOG_VGA);
      break;
    case 14:
      dbg_log("3D5 / cursor address hi write: " + h(value), LOG_VGA);
      this.cursor_address = this.cursor_address & 255 | value << 8;
      this.update_cursor();
      break;
    case 15:
      dbg_log("3D5 / cursor address lo write: " + h(value), LOG_VGA);
      this.cursor_address = this.cursor_address & 65280 | value;
      this.update_cursor();
      break;
    case 18:
      dbg_log("3D5 / vdisp enable end write: " + h(value), LOG_VGA);
      if ((this.vertical_display_enable_end & 255) !== value) {
        this.vertical_display_enable_end = this.vertical_display_enable_end & 768 | value;
        this.update_vga_size();
      }
      break;
    case 19:
      dbg_log("3D5 / offset register write: " + h(value), LOG_VGA);
      if (this.offset_register !== value) {
        this.offset_register = value;
        this.update_vga_size();
        if (~this.crtc_mode & 3) {
          this.complete_replot();
        }
      }
      break;
    case 20:
      dbg_log("3D5 / underline location write: " + h(value), LOG_VGA);
      if (this.underline_location_register !== value) {
        var previous_underline = this.underline_location_register;
        this.underline_location_register = value;
        this.update_vga_size();
        if ((previous_underline ^ value) & 64) {
          this.complete_replot();
        }
      }
      break;
    case 21:
      dbg_log("3D5 / vertical blank start write: " + h(value), LOG_VGA);
      if ((this.vertical_blank_start & 255) !== value) {
        this.vertical_blank_start = this.vertical_blank_start & 768 | value;
        this.update_vga_size();
      }
      break;
    case 23:
      dbg_log("3D5 / crtc mode write: " + h(value), LOG_VGA);
      if (this.crtc_mode !== value) {
        var previous_mode = this.crtc_mode;
        this.crtc_mode = value;
        this.update_vga_size();
        if ((previous_mode ^ value) & 67) {
          this.complete_replot();
        }
      }
      break;
    case 24:
      dbg_log("3D5 / line compare write: " + h(value), LOG_VGA);
      this.line_compare = this.line_compare & 768 | value;
      this.update_layers();
      break;
    default:
      if (this.index_crtc < this.crtc.length) {
        this.crtc[this.index_crtc] = value;
      }
      dbg_log("3D5 / CRTC write " + h(this.index_crtc) + ": " + h(value), LOG_VGA);
  }
};
VGAScreen.prototype.port3D5_write16 = function(register) {
  dbg_log("16-bit write to 3D5: " + h(register, 4), LOG_VGA);
  this.port3D5_write(register & 255);
};
VGAScreen.prototype.port3D5_read = function() {
  dbg_log("3D5 read " + h(this.index_crtc), LOG_VGA);
  switch (this.index_crtc) {
    case 1:
      return this.horizontal_display_enable_end;
    case 2:
      return this.horizontal_blank_start;
    case 7:
      return this.vertical_display_enable_end >> 7 & 2 | this.vertical_blank_start >> 5 & 8 | this.line_compare >> 4 & 16 | this.vertical_display_enable_end >> 3 & 64;
    case 8:
      return this.preset_row_scan;
    case 9:
      return this.max_scan_line;
    case 10:
      return this.cursor_scanline_start;
    case 11:
      return this.cursor_scanline_end;
    case 12:
      return this.start_address & 255;
    case 13:
      return this.start_address >> 8;
    case 14:
      return this.cursor_address >> 8;
    case 15:
      return this.cursor_address & 255;
    case 18:
      return this.vertical_display_enable_end & 255;
    case 19:
      return this.offset_register;
    case 20:
      return this.underline_location_register;
    case 21:
      return this.vertical_blank_start & 255;
    case 23:
      return this.crtc_mode;
    case 24:
      return this.line_compare & 255;
  }
  if (this.index_crtc < this.crtc.length) {
    return this.crtc[this.index_crtc];
  } else {
    return 0;
  }
};
VGAScreen.prototype.port3D5_read16 = function() {
  dbg_log("Warning: 16-bit read from 3D5", LOG_VGA);
  return this.port3D5_read();
};
VGAScreen.prototype.port3DA_read = function() {
  dbg_log("3DA read - status 1 and clear attr index", LOG_VGA);
  var value = this.port_3DA_value;
  if (!this.graphical_mode) {
    if (this.port_3DA_value & 1) {
      this.port_3DA_value ^= 8;
    }
    this.port_3DA_value ^= 1;
  } else {
    this.port_3DA_value ^= 1;
    this.port_3DA_value &= 1;
  }
  this.attribute_controller_index = -1;
  return value;
};
VGAScreen.prototype.port1CE_write = function(value) {
  this.dispi_index = value;
};
VGAScreen.prototype.port1CF_write = function(value) {
  dbg_log("1CF / dispi write " + h(this.dispi_index) + ": " + h(value), LOG_VGA);
  const was_enabled = this.svga_enabled;
  switch (this.dispi_index) {
    case 0:
      if (value >= 45248 && value <= 45253) {
        this.svga_version = value;
      } else {
        dbg_log("Invalid version value: " + h(value), LOG_VGA);
      }
      break;
    case 1:
      this.svga_width = value;
      if (this.svga_width > MAX_XRES) {
        dbg_log("svga_width reduced from " + this.svga_width + " to " + MAX_XRES, LOG_VGA);
        this.svga_width = MAX_XRES;
      }
      break;
    case 2:
      this.svga_height = value;
      if (this.svga_height > MAX_YRES) {
        dbg_log("svga_height reduced from " + this.svga_height + " to " + MAX_YRES, LOG_VGA);
        this.svga_height = MAX_YRES;
      }
      break;
    case 3:
      this.svga_bpp = value;
      break;
    case 4:
      this.svga_enabled = (value & 1) === 1;
      if (this.svga_enabled && (value & 128) === 0) {
        this.svga_memory.fill(0);
      }
      this.dispi_enable_value = value;
      break;
    case 5:
      dbg_log("SVGA bank offset: " + h(value << 16), LOG_VGA);
      this.svga_bank_offset = value << 16;
      break;
    case 8:
      dbg_log("SVGA X offset: " + h(value), LOG_VGA);
      if (this.svga_offset_x !== value) {
        this.svga_offset_x = value;
        this.svga_offset = this.svga_offset_y * this.svga_width + this.svga_offset_x;
        this.complete_redraw();
      }
      break;
    case 9:
      dbg_log("SVGA Y offset: " + h(value * this.svga_width) + " y=" + h(value), LOG_VGA);
      if (this.svga_offset_y !== value) {
        this.svga_offset_y = value;
        this.svga_offset = this.svga_offset_y * this.svga_width + this.svga_offset_x;
        this.complete_redraw();
      }
      break;
    default:
      dbg_log("Unimplemented dispi write index: " + h(this.dispi_index), LOG_VGA);
  }
  if (this.svga_enabled && (!this.svga_width || !this.svga_height)) {
    dbg_log("SVGA: disabled because of invalid width/height: " + this.svga_width + "x" + this.svga_height, LOG_VGA);
    this.svga_enabled = false;
  }
  dbg_assert(this.svga_bpp !== 4, "unimplemented svga bpp: 4");
  dbg_assert(
    this.svga_bpp === 4 || this.svga_bpp === 8 || this.svga_bpp === 15 || this.svga_bpp === 16 || this.svga_bpp === 24 || this.svga_bpp === 32,
    "unexpected svga bpp: " + this.svga_bpp
  );
  if (this.svga_enabled) {
    dbg_log("SVGA: enabled, " + this.svga_width + "x" + this.svga_height + "x" + this.svga_bpp, LOG_VGA);
  } else {
    dbg_log("SVGA: disabled", LOG_VGA);
  }
  if (this.svga_enabled && !was_enabled) {
    this.svga_offset = 0;
    this.svga_offset_x = 0;
    this.svga_offset_y = 0;
    this.graphical_mode = true;
    this.screen.set_mode(this.graphical_mode);
    this.set_size_graphical(this.svga_width, this.svga_height, this.svga_width, this.svga_height, this.svga_bpp);
  }
  if (was_enabled && !this.svga_enabled) {
    const is_graphical = (this.attribute_mode & 1) !== 0;
    this.graphical_mode = is_graphical;
    this.screen.set_mode(is_graphical);
    this.update_vga_size();
    this.set_font_bitmap(false);
    this.complete_redraw();
  }
  if (!this.svga_enabled) {
    this.svga_bank_offset = 0;
  }
  this.update_layers();
};
VGAScreen.prototype.port1CF_read = function() {
  dbg_log("1CF / dispi read " + h(this.dispi_index), LOG_VGA);
  return this.svga_register_read(this.dispi_index);
};
VGAScreen.prototype.svga_register_read = function(n) {
  switch (n) {
    case 0:
      return this.svga_version;
    case 1:
      return this.dispi_enable_value & 2 ? MAX_XRES : this.svga_width;
    case 2:
      return this.dispi_enable_value & 2 ? MAX_YRES : this.svga_height;
    case 3:
      return this.dispi_enable_value & 2 ? MAX_BPP : this.svga_bpp;
    case 4:
      return this.dispi_enable_value;
    case 5:
      return this.svga_bank_offset >>> 16;
    case 6:
      if (this.screen_width) {
        return this.screen_width;
      } else {
        return 1;
      }
      break;
    case 8:
      return this.svga_offset_x;
    case 9:
      return this.svga_offset_y;
    case 10:
      return this.vga_memory_size / VGA_BANK_SIZE | 0;
    default:
      dbg_log("Unimplemented dispi read index: " + h(this.dispi_index), LOG_VGA);
  }
  return 255;
};
VGAScreen.prototype.vga_replot = function() {
  var start = this.diff_plot_min & ~15;
  var end = Math.min(this.diff_plot_max | 15, VGA_PIXEL_BUFFER_SIZE - 1);
  var addr_shift = this.vga_addr_shift_count();
  var addr_substitution = ~this.crtc_mode & 3;
  var shift_mode = this.planar_mode & 96;
  var pel_width = this.attribute_mode & 64;
  for (var pixel_addr = start; pixel_addr <= end; ) {
    var addr = pixel_addr >>> addr_shift;
    if (addr_substitution) {
      var row = pixel_addr / this.virtual_width | 0;
      var col = pixel_addr - this.virtual_width * row;
      switch (addr_substitution) {
        case 1:
          addr = (row & 1) << 13;
          row >>>= 1;
          break;
        case 2:
          addr = (row & 1) << 14;
          row >>>= 1;
          break;
        case 3:
          addr = (row & 3) << 13;
          row >>>= 2;
          break;
      }
      addr |= (row * this.virtual_width + col >>> addr_shift) + this.start_address;
    }
    var byte0 = this.plane0[addr];
    var byte1 = this.plane1[addr];
    var byte2 = this.plane2[addr];
    var byte3 = this.plane3[addr];
    var shift_loads = new Uint8Array(8);
    switch (shift_mode) {
      // Planar Shift Mode
      // See http://www.osdever.net/FreeVGA/vga/vgaseq.htm
      case 0:
        byte0 <<= 0;
        byte1 <<= 1;
        byte2 <<= 2;
        byte3 <<= 3;
        for (var i = 7; i >= 0; i--) {
          shift_loads[7 - i] = byte0 >> i & 1 | byte1 >> i & 2 | byte2 >> i & 4 | byte3 >> i & 8;
        }
        break;
      // Packed Shift Mode, aka Interleaved Shift Mode
      // Video Modes 4h and 5h
      case 32:
        shift_loads[0] = byte0 >> 6 & 3 | byte2 >> 4 & 12;
        shift_loads[1] = byte0 >> 4 & 3 | byte2 >> 2 & 12;
        shift_loads[2] = byte0 >> 2 & 3 | byte2 >> 0 & 12;
        shift_loads[3] = byte0 >> 0 & 3 | byte2 << 2 & 12;
        shift_loads[4] = byte1 >> 6 & 3 | byte3 >> 4 & 12;
        shift_loads[5] = byte1 >> 4 & 3 | byte3 >> 2 & 12;
        shift_loads[6] = byte1 >> 2 & 3 | byte3 >> 0 & 12;
        shift_loads[7] = byte1 >> 0 & 3 | byte3 << 2 & 12;
        break;
      // 256-Color Shift Mode
      // Video Modes 13h and unchained 256 color
      case 64:
      case 96:
        shift_loads[0] = byte0 >> 4 & 15;
        shift_loads[1] = byte0 >> 0 & 15;
        shift_loads[2] = byte1 >> 4 & 15;
        shift_loads[3] = byte1 >> 0 & 15;
        shift_loads[4] = byte2 >> 4 & 15;
        shift_loads[5] = byte2 >> 0 & 15;
        shift_loads[6] = byte3 >> 4 & 15;
        shift_loads[7] = byte3 >> 0 & 15;
        break;
    }
    if (pel_width) {
      for (var i = 0, j = 0; i < 4; i++, pixel_addr++, j += 2) {
        this.pixel_buffer[pixel_addr] = shift_loads[j] << 4 | shift_loads[j + 1];
      }
    } else {
      for (var i = 0; i < 8; i++, pixel_addr++) {
        this.pixel_buffer[pixel_addr] = shift_loads[i];
      }
    }
  }
};
VGAScreen.prototype.vga_redraw = function() {
  var start = this.diff_addr_min;
  var end = Math.min(this.diff_addr_max, VGA_PIXEL_BUFFER_SIZE - 1);
  const buffer = new Int32Array(this.cpu.wasm_memory.buffer, this.dest_buffet_offset, this.virtual_width * this.virtual_height);
  var mask = 255;
  var colorset = 0;
  if (this.attribute_mode & 128) {
    mask &= 207;
    colorset |= this.color_select << 4 & 48;
  }
  if (this.attribute_mode & 64) {
    for (var pixel_addr = start; pixel_addr <= end; pixel_addr++) {
      var color256 = this.pixel_buffer[pixel_addr] & mask | colorset;
      var color = this.vga256_palette[color256];
      buffer[pixel_addr] = color & 65280 | color << 16 | color >> 16 | 4278190080;
    }
  } else {
    mask &= 63;
    colorset |= this.color_select << 4 & 192;
    for (var pixel_addr = start; pixel_addr <= end; pixel_addr++) {
      var color16 = this.pixel_buffer[pixel_addr] & this.color_plane_enable;
      var color256 = this.dac_map[color16] & mask | colorset;
      var color = this.vga256_palette[color256];
      buffer[pixel_addr] = color & 65280 | color << 16 | color >> 16 | 4278190080;
    }
  }
};
VGAScreen.prototype.screen_fill_buffer = function() {
  if (!this.graphical_mode) {
    this.update_vertical_retrace();
    return;
  }
  if (this.image_data.data.byteLength === 0) {
    const buffer = new Uint8ClampedArray(this.cpu.wasm_memory.buffer, this.dest_buffet_offset, 4 * this.virtual_width * this.virtual_height);
    this.image_data = new ImageData(buffer, this.virtual_width, this.virtual_height);
    this.update_layers();
  }
  if (this.svga_enabled) {
    let min_y = 0;
    let max_y = this.svga_height;
    if (this.svga_bpp === 8) {
      const buffer = new Int32Array(this.cpu.wasm_memory.buffer, this.dest_buffet_offset, this.screen_width * this.screen_height);
      const svga_memory = new Uint8Array(this.cpu.wasm_memory.buffer, this.svga_memory.byteOffset, this.vga_memory_size);
      for (var i = 0; i < buffer.length; i++) {
        var color = this.vga256_palette[svga_memory[i]];
        buffer[i] = color & 65280 | color << 16 | color >> 16 | 4278190080;
      }
    } else {
      this.cpu.svga_fill_pixel_buffer(this.svga_bpp, this.svga_offset);
      const bytes_per_pixel = this.svga_bpp === 15 ? 2 : this.svga_bpp / 8;
      min_y = ((this.cpu.svga_dirty_bitmap_min_offset[0] / bytes_per_pixel | 0) - this.svga_offset) / this.svga_width | 0;
      max_y = (((this.cpu.svga_dirty_bitmap_max_offset[0] / bytes_per_pixel | 0) - this.svga_offset) / this.svga_width | 0) + 1;
    }
    if (min_y < max_y) {
      min_y = Math.max(min_y, 0);
      max_y = Math.min(max_y, this.svga_height);
      this.screen.update_buffer([{
        image_data: this.image_data,
        screen_x: 0,
        screen_y: min_y,
        buffer_x: 0,
        buffer_y: min_y,
        buffer_width: this.svga_width,
        buffer_height: max_y - min_y
      }]);
    }
  } else {
    this.vga_replot();
    this.vga_redraw();
    this.screen.update_buffer(this.layers);
  }
  this.reset_diffs();
  this.update_vertical_retrace();
};
VGAScreen.prototype.set_font_bitmap = function(font_plane_dirty) {
  const height = this.max_scan_line & 31;
  if (height && !this.graphical_mode) {
    const width_dbl = !!(this.clocking_mode & 8);
    const width_9px = !width_dbl && !(this.clocking_mode & 1);
    const copy_8th_col = !!(this.attribute_mode & 4);
    this.screen.set_font_bitmap(
      height + 1,
      // int height, font height 1..32px
      width_9px,
      // bool width_9px, True: font width 9px, else 8px
      width_dbl,
      // bool width_dbl, True: font width 16px (overrides width_9px)
      copy_8th_col,
      // bool copy_8th_col, True: duplicate 8th into 9th column in ASCII chars 0xC0-0xDF
      this.plane2,
      // Uint8Array font_bitmap[64k], static
      font_plane_dirty
      // bool bitmap_changed, True: content of this.plane2 has changed
    );
  }
};
VGAScreen.prototype.set_font_page = function() {
  const linear_index_map = [0, 2, 4, 6, 1, 3, 5, 7];
  const vga_index_A = (this.character_map_select & 12) >> 2 | (this.character_map_select & 32) >> 3;
  const vga_index_B = this.character_map_select & 3 | (this.character_map_select & 16) >> 2;
  this.font_page_ab_enabled = vga_index_A !== vga_index_B;
  this.screen.set_font_page(linear_index_map[vga_index_A], linear_index_map[vga_index_B]);
  this.complete_redraw();
};

// src/virtio_balloon.js
var VIRTIO_BALLOON_F_STATS_VQ = 1;
var VIRTIO_BALLOON_F_FREE_PAGE_HINT = 3;
var STAT_NAMES = [
  "SWAP_IN",
  "SWAP_OUT",
  "MAJFLT",
  "MINFLT",
  "MEMFREE",
  "MEMTOT",
  "AVAIL",
  "CACHES",
  "HTLB_PGALLOC",
  "HTLB_PGFAIL"
];
function VirtioBalloon(cpu, bus) {
  this.bus = bus;
  this.num_pages = 0;
  this.actual = 0;
  this.fp_cmd = 0;
  this.zeroed = 0;
  const queues = [
    { size_supported: 32, notify_offset: 0 },
    { size_supported: 32, notify_offset: 0 },
    { size_supported: 2, notify_offset: 1 },
    { size_supported: 64, notify_offset: 2 }
  ];
  this.virtio = new VirtIO(
    cpu,
    {
      name: "virtio-balloon",
      pci_id: 11 << 3,
      device_id: 4165,
      subsystem_device_id: 5,
      common: {
        initial_port: 55296,
        queues,
        features: [
          VIRTIO_BALLOON_F_STATS_VQ,
          VIRTIO_BALLOON_F_FREE_PAGE_HINT,
          VIRTIO_F_VERSION_1
        ],
        on_driver_ok: () => {
          dbg_log("Balloon setup", LOG_PCI);
        }
      },
      notification: {
        initial_port: 55552,
        single_handler: false,
        handlers: [
          (queue_id) => {
            const queue = this.virtio.queues[queue_id];
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              this.virtio.queues[queue_id].push_reply(bufchain);
              let n = buffer.byteLength / 4;
              this.actual += queue_id === 0 ? n : -n;
            }
            this.virtio.queues[queue_id].flush_replies();
          },
          (queue_id) => {
            const queue = this.virtio.queues[queue_id];
            if (queue.has_request()) {
              const bufchain = queue.pop_request();
              const buffer = new Uint8Array(bufchain.length_readable);
              bufchain.get_next_blob(buffer);
              let result = {};
              for (let i = 0; i < bufchain.length_readable; i += 10) {
                let [cat, value] = Unmarshall(["h", "d"], buffer, { offset: i });
                result[STAT_NAMES[cat]] = value;
              }
              this.virtio.queues[queue_id].push_reply(bufchain);
              if (this.stats_cb) this.stats_cb(result);
            }
          },
          (queue_id) => {
            const queue = this.virtio.queues[queue_id];
            while (queue.has_request()) {
              const bufchain = queue.pop_request();
              if (bufchain.length_readable > 0) {
                const buffer = new Uint8Array(bufchain.length_readable);
                bufchain.get_next_blob(buffer);
                let [cmd] = Unmarshall(["w"], buffer, { offset: 0 });
                if (cmd === 0) {
                  if (this.free_cb) this.free_cb(this.zeroed);
                  if (this.fp_cmd > 1) this.fp_cmd = 1;
                  this.virtio.notify_config_changes();
                }
              }
              if (bufchain.length_writable > 0) {
                let zeros = new Uint8Array(0);
                for (let i = 0; i < bufchain.write_buffers.length; ++i) {
                  let b = bufchain.write_buffers[i];
                  this.zeroed += b.len;
                  this.virtio.cpu.zero_memory(b.addr_low, b.len);
                }
              }
              this.virtio.queues[queue_id].push_reply(bufchain);
            }
            this.virtio.queues[queue_id].flush_replies();
          }
        ]
      },
      isr_status: {
        initial_port: 55040
      },
      device_specific: {
        initial_port: 54784,
        struct: [
          {
            bytes: 4,
            name: "num_pages",
            read: () => this.num_pages,
            write: (data) => {
            }
          },
          {
            bytes: 4,
            name: "actual",
            read: () => {
              return this.actual;
            },
            write: (data) => {
            }
          },
          {
            bytes: 4,
            name: "free_page_hint_cmd_id",
            read: () => this.fp_cmd,
            write: (data) => {
            }
          }
        ]
      }
    }
  );
}
VirtioBalloon.prototype.Inflate = function(amount) {
  this.num_pages += amount;
  this.virtio.notify_config_changes();
};
VirtioBalloon.prototype.Deflate = function(amount) {
  this.num_pages -= amount;
  this.virtio.notify_config_changes();
};
VirtioBalloon.prototype.Cleanup = function(cb) {
  this.fp_cmd = 2;
  this.free_cb = cb;
  this.zeroed = 0;
  this.virtio.notify_config_changes();
};
VirtioBalloon.prototype.get_state = function() {
  const state = [];
  state[0] = this.virtio;
  state[1] = this.num_pages;
  state[2] = this.actual;
  return state;
};
VirtioBalloon.prototype.set_state = function(state) {
  this.virtio.set_state(state[0]);
  this.num_pages = state[1];
  this.actual = state[2];
};
VirtioBalloon.prototype.GetStats = function(data) {
  this.stats_cb = data;
  const queue = this.virtio.queues[2];
  while (queue.has_request()) {
    const bufchain = queue.pop_request();
    this.virtio.queues[2].push_reply(bufchain);
  }
  this.virtio.queues[2].flush_replies();
};
VirtioBalloon.prototype.Reset = function() {
};

// src/browser/filestorage.js
function FileStorageInterface() {
}
FileStorageInterface.prototype.read = function(sha256sum, offset, count, file_size) {
};
FileStorageInterface.prototype.cache = function(sha256sum, data) {
};
FileStorageInterface.prototype.uncache = function(sha256sum) {
};
function MemoryFileStorage() {
  this.filedata = /* @__PURE__ */ new Map();
}
MemoryFileStorage.prototype.read = async function(sha256sum, offset, count) {
  dbg_assert(sha256sum, "MemoryFileStorage read: sha256sum should be a non-empty string");
  const data = this.filedata.get(sha256sum);
  if (!data) {
    return null;
  }
  return data.subarray(offset, offset + count);
};
MemoryFileStorage.prototype.cache = async function(sha256sum, data) {
  dbg_assert(sha256sum, "MemoryFileStorage cache: sha256sum should be a non-empty string");
  this.filedata.set(sha256sum, data);
};
MemoryFileStorage.prototype.uncache = function(sha256sum) {
  this.filedata.delete(sha256sum);
};
function ServerFileStorageWrapper(file_storage, baseurl, zstd_decompress) {
  dbg_assert(baseurl, "ServerMemoryFileStorage: baseurl should not be empty");
  if (!baseurl.endsWith("/")) {
    baseurl += "/";
  }
  this.storage = file_storage;
  this.baseurl = baseurl;
  this.zstd_decompress = zstd_decompress;
}
ServerFileStorageWrapper.prototype.load_from_server = function(sha256sum, file_size) {
  return new Promise((resolve, reject) => {
    load_file(this.baseurl + sha256sum, { done: async (buffer) => {
      let data = new Uint8Array(buffer);
      if (sha256sum.endsWith(".zst")) {
        data = new Uint8Array(
          this.zstd_decompress(file_size, data)
        );
      }
      await this.cache(sha256sum, data);
      resolve(data);
    } });
  });
};
ServerFileStorageWrapper.prototype.read = async function(sha256sum, offset, count, file_size) {
  const data = await this.storage.read(sha256sum, offset, count, file_size);
  if (!data) {
    const full_file = await this.load_from_server(sha256sum, file_size);
    return full_file.subarray(offset, offset + count);
  }
  return data;
};
ServerFileStorageWrapper.prototype.cache = async function(sha256sum, data) {
  return await this.storage.cache(sha256sum, data);
};
ServerFileStorageWrapper.prototype.uncache = function(sha256sum) {
  this.storage.uncache(sha256sum);
};

// lib/filesystem.js
var S_IFMT = 61440;
var S_IFSOCK = 49152;
var S_IFLNK = 40960;
var S_IFREG = 32768;
var S_IFDIR = 16384;
var STATUS_INVALID = -1;
var STATUS_OK = 0;
var STATUS_ON_STORAGE = 2;
var STATUS_UNLINKED = 4;
var STATUS_FORWARDING = 5;
var texten2 = new TextEncoder();
var JSONFS_VERSION = 3;
var JSONFS_IDX_NAME = 0;
var JSONFS_IDX_SIZE = 1;
var JSONFS_IDX_MTIME = 2;
var JSONFS_IDX_MODE = 3;
var JSONFS_IDX_UID = 4;
var JSONFS_IDX_GID = 5;
var JSONFS_IDX_TARGET = 6;
var JSONFS_IDX_SHA256 = 6;
function FS(storage, qidcounter) {
  this.inodes = [];
  this.storage = storage;
  this.qidcounter = qidcounter || { last_qidnumber: 0 };
  this.inodedata = {};
  this.total_size = 256 * 1024 * 1024 * 1024;
  this.used_size = 0;
  this.mounts = [];
  this.CreateDirectory("", -1);
}
FS.prototype.get_state = function() {
  let state = [];
  state[0] = this.inodes;
  state[1] = this.qidcounter.last_qidnumber;
  state[2] = [];
  for (const [id, data] of Object.entries(this.inodedata)) {
    if ((this.inodes[id].mode & S_IFDIR) === 0) {
      state[2].push([id, data]);
    }
  }
  state[3] = this.total_size;
  state[4] = this.used_size;
  state = state.concat(this.mounts);
  return state;
};
FS.prototype.set_state = function(state) {
  this.inodes = state[0].map((state2) => {
    const inode = new Inode(0);
    inode.set_state(state2);
    return inode;
  });
  this.qidcounter.last_qidnumber = state[1];
  this.inodedata = {};
  for (let [key, value] of state[2]) {
    if (value.buffer.byteLength !== value.byteLength) {
      value = value.slice();
    }
    this.inodedata[key] = value;
  }
  this.total_size = state[3];
  this.used_size = state[4];
  this.mounts = state.slice(5);
};
FS.prototype.load_from_json = function(fs) {
  dbg_assert(fs, "Invalid fs passed to load_from_json");
  if (fs["version"] !== JSONFS_VERSION) {
    throw "The filesystem JSON format has changed. Please recreate the filesystem JSON.";
  }
  var fsroot = fs["fsroot"];
  this.used_size = fs["size"];
  for (var i = 0; i < fsroot.length; i++) {
    this.LoadRecursive(fsroot[i], 0);
  }
};
FS.prototype.LoadRecursive = function(data, parentid) {
  var inode = this.CreateInode();
  const name = data[JSONFS_IDX_NAME];
  inode.size = data[JSONFS_IDX_SIZE];
  inode.mtime = data[JSONFS_IDX_MTIME];
  inode.ctime = inode.mtime;
  inode.atime = inode.mtime;
  inode.mode = data[JSONFS_IDX_MODE];
  inode.uid = data[JSONFS_IDX_UID];
  inode.gid = data[JSONFS_IDX_GID];
  var ifmt = inode.mode & S_IFMT;
  if (ifmt === S_IFDIR) {
    this.PushInode(inode, parentid, name);
    this.LoadDir(this.inodes.length - 1, data[JSONFS_IDX_TARGET]);
  } else if (ifmt === S_IFREG) {
    inode.status = STATUS_ON_STORAGE;
    inode.sha256sum = data[JSONFS_IDX_SHA256];
    dbg_assert(inode.sha256sum);
    this.PushInode(inode, parentid, name);
  } else if (ifmt === S_IFLNK) {
    inode.symlink = data[JSONFS_IDX_TARGET];
    this.PushInode(inode, parentid, name);
  } else if (ifmt === S_IFSOCK) {
  } else {
    dbg_log("Unexpected ifmt: " + h(ifmt) + " (" + name + ")", LOG_9P);
  }
};
FS.prototype.LoadDir = function(parentid, children) {
  for (var i = 0; i < children.length; i++) {
    this.LoadRecursive(children[i], parentid);
  }
};
FS.prototype.should_be_linked = function(inode) {
  return !this.is_forwarder(inode) || inode.foreign_id === 0;
};
FS.prototype.link_under_dir = function(parentid, idx, name) {
  const inode = this.inodes[idx];
  const parent_inode = this.inodes[parentid];
  dbg_assert(
    !this.is_forwarder(parent_inode),
    "Filesystem: Shouldn't link under fowarder parents"
  );
  dbg_assert(
    this.IsDirectory(parentid),
    "Filesystem: Can't link under non-directories"
  );
  dbg_assert(
    this.should_be_linked(inode),
    "Filesystem: Can't link across filesystems apart from their root"
  );
  dbg_assert(
    inode.nlinks >= 0,
    "Filesystem: Found negative nlinks value of " + inode.nlinks
  );
  dbg_assert(
    !parent_inode.direntries.has(name),
    "Filesystem: Name '" + name + "' is already taken"
  );
  parent_inode.direntries.set(name, idx);
  inode.nlinks++;
  if (this.IsDirectory(idx)) {
    dbg_assert(
      !inode.direntries.has(".."),
      "Filesystem: Cannot link a directory twice"
    );
    if (!inode.direntries.has(".")) inode.nlinks++;
    inode.direntries.set(".", idx);
    inode.direntries.set("..", parentid);
    parent_inode.nlinks++;
  }
};
FS.prototype.unlink_from_dir = function(parentid, name) {
  const idx = this.Search(parentid, name);
  const inode = this.inodes[idx];
  const parent_inode = this.inodes[parentid];
  dbg_assert(!this.is_forwarder(parent_inode), "Filesystem: Can't unlink from forwarders");
  dbg_assert(this.IsDirectory(parentid), "Filesystem: Can't unlink from non-directories");
  const exists = parent_inode.direntries.delete(name);
  if (!exists) {
    dbg_assert(false, "Filesystem: Can't unlink non-existent file: " + name);
    return;
  }
  inode.nlinks--;
  if (this.IsDirectory(idx)) {
    dbg_assert(
      inode.direntries.get("..") === parentid,
      "Filesystem: Found directory with bad parent id"
    );
    inode.direntries.delete("..");
    parent_inode.nlinks--;
  }
  dbg_assert(
    inode.nlinks >= 0,
    "Filesystem: Found negative nlinks value of " + inode.nlinks
  );
};
FS.prototype.PushInode = function(inode, parentid, name) {
  if (parentid !== -1) {
    this.inodes.push(inode);
    inode.fid = this.inodes.length - 1;
    this.link_under_dir(parentid, inode.fid, name);
    return;
  } else {
    if (this.inodes.length === 0) {
      this.inodes.push(inode);
      inode.direntries.set(".", 0);
      inode.direntries.set("..", 0);
      inode.nlinks = 2;
      return;
    }
  }
  dbg_assert(false, "Error in Filesystem: Pushed inode with name = " + name + " has no parent");
};
function Inode(qidnumber) {
  this.direntries = /* @__PURE__ */ new Map();
  this.status = 0;
  this.size = 0;
  this.uid = 0;
  this.gid = 0;
  this.fid = 0;
  this.ctime = 0;
  this.atime = 0;
  this.mtime = 0;
  this.major = 0;
  this.minor = 0;
  this.symlink = "";
  this.mode = 493;
  this.qid = {
    type: 0,
    version: 0,
    path: qidnumber
  };
  this.caps = void 0;
  this.nlinks = 0;
  this.sha256sum = "";
  this.locks = [];
  this.mount_id = -1;
  this.foreign_id = -1;
}
Inode.prototype.get_state = function() {
  const state = [];
  state[0] = this.mode;
  if ((this.mode & S_IFMT) === S_IFDIR) {
    state[1] = [...this.direntries];
  } else if ((this.mode & S_IFMT) === S_IFREG) {
    state[1] = this.sha256sum;
  } else if ((this.mode & S_IFMT) === S_IFLNK) {
    state[1] = this.symlink;
  } else if ((this.mode & S_IFMT) === S_IFSOCK) {
    state[1] = [this.minor, this.major];
  } else {
    state[1] = null;
  }
  state[2] = this.locks;
  state[3] = this.status;
  state[4] = this.size;
  state[5] = this.uid;
  state[6] = this.gid;
  state[7] = this.fid;
  state[8] = this.ctime;
  state[9] = this.atime;
  state[10] = this.mtime;
  state[11] = this.qid.version;
  state[12] = this.qid.path;
  state[13] = this.nlinks;
  return state;
};
Inode.prototype.set_state = function(state) {
  this.mode = state[0];
  if ((this.mode & S_IFMT) === S_IFDIR) {
    this.direntries = /* @__PURE__ */ new Map();
    for (const [name, entry] of state[1]) {
      this.direntries.set(name, entry);
    }
  } else if ((this.mode & S_IFMT) === S_IFREG) {
    this.sha256sum = state[1];
  } else if ((this.mode & S_IFMT) === S_IFLNK) {
    this.symlink = state[1];
  } else if ((this.mode & S_IFMT) === S_IFSOCK) {
    [this.minor, this.major] = state[1];
  } else {
  }
  this.locks = [];
  for (const lock_state of state[2]) {
    const lock = new FSLockRegion();
    lock.set_state(lock_state);
    this.locks.push(lock);
  }
  this.status = state[3];
  this.size = state[4];
  this.uid = state[5];
  this.gid = state[6];
  this.fid = state[7];
  this.ctime = state[8];
  this.atime = state[9];
  this.mtime = state[10];
  this.qid.type = (this.mode & S_IFMT) >> 8;
  this.qid.version = state[11];
  this.qid.path = state[12];
  this.nlinks = state[13];
};
FS.prototype.divert = function(parentid, filename) {
  const old_idx = this.Search(parentid, filename);
  const old_inode = this.inodes[old_idx];
  const new_inode = new Inode(-1);
  dbg_assert(old_inode, "Filesystem divert: name (" + filename + ") not found");
  dbg_assert(
    this.IsDirectory(old_idx) || old_inode.nlinks <= 1,
    "Filesystem: can't divert hardlinked file '" + filename + "' with nlinks=" + old_inode.nlinks
  );
  Object.assign(new_inode, old_inode);
  const idx = this.inodes.length;
  this.inodes.push(new_inode);
  new_inode.fid = idx;
  if (this.is_forwarder(old_inode)) {
    this.mounts[old_inode.mount_id].backtrack.set(old_inode.foreign_id, idx);
  }
  if (this.should_be_linked(old_inode)) {
    this.unlink_from_dir(parentid, filename);
    this.link_under_dir(parentid, idx, filename);
  }
  if (this.IsDirectory(old_idx) && !this.is_forwarder(old_inode)) {
    for (const [name, child_id] of new_inode.direntries) {
      if (name === "." || name === "..") continue;
      if (this.IsDirectory(child_id)) {
        this.inodes[child_id].direntries.set("..", idx);
      }
    }
  }
  this.inodedata[idx] = this.inodedata[old_idx];
  delete this.inodedata[old_idx];
  old_inode.direntries = /* @__PURE__ */ new Map();
  old_inode.nlinks = 0;
  return idx;
};
FS.prototype.copy_inode = function(src_inode, dest_inode) {
  Object.assign(dest_inode, src_inode, {
    fid: dest_inode.fid,
    direntries: dest_inode.direntries,
    nlinks: dest_inode.nlinks
  });
};
FS.prototype.CreateInode = function() {
  const now = Math.round(Date.now() / 1e3);
  const inode = new Inode(++this.qidcounter.last_qidnumber);
  inode.atime = inode.ctime = inode.mtime = now;
  return inode;
};
FS.prototype.CreateDirectory = function(name, parentid) {
  const parent_inode = this.inodes[parentid];
  if (parentid >= 0 && this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = this.follow_fs(parent_inode).CreateDirectory(name, foreign_parentid);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var x = this.CreateInode();
  x.mode = 511 | S_IFDIR;
  if (parentid >= 0) {
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.mode = this.inodes[parentid].mode & 511 | S_IFDIR;
  }
  x.qid.type = S_IFDIR >> 8;
  this.PushInode(x, parentid, name);
  this.NotifyListeners(this.inodes.length - 1, "newdir");
  return this.inodes.length - 1;
};
FS.prototype.CreateFile = function(filename, parentid) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = this.follow_fs(parent_inode).CreateFile(filename, foreign_parentid);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var x = this.CreateInode();
  x.uid = this.inodes[parentid].uid;
  x.gid = this.inodes[parentid].gid;
  x.qid.type = S_IFREG >> 8;
  x.mode = this.inodes[parentid].mode & 438 | S_IFREG;
  this.PushInode(x, parentid, filename);
  this.NotifyListeners(this.inodes.length - 1, "newfile");
  return this.inodes.length - 1;
};
FS.prototype.CreateNode = function(filename, parentid, major, minor) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = this.follow_fs(parent_inode).CreateNode(filename, foreign_parentid, major, minor);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var x = this.CreateInode();
  x.major = major;
  x.minor = minor;
  x.uid = this.inodes[parentid].uid;
  x.gid = this.inodes[parentid].gid;
  x.qid.type = S_IFSOCK >> 8;
  x.mode = this.inodes[parentid].mode & 438;
  this.PushInode(x, parentid, filename);
  return this.inodes.length - 1;
};
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = this.follow_fs(parent_inode).CreateSymlink(filename, foreign_parentid, symlink);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var x = this.CreateInode();
  x.uid = this.inodes[parentid].uid;
  x.gid = this.inodes[parentid].gid;
  x.qid.type = S_IFLNK >> 8;
  x.symlink = symlink;
  x.mode = S_IFLNK;
  this.PushInode(x, parentid, filename);
  return this.inodes.length - 1;
};
FS.prototype.CreateTextFile = async function(filename, parentid, str) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = await this.follow_fs(parent_inode).CreateTextFile(filename, foreign_parentid, str);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var id = this.CreateFile(filename, parentid);
  var x = this.inodes[id];
  var data = new Uint8Array(str.length);
  x.size = str.length;
  for (var j = 0; j < str.length; j++) {
    data[j] = str.charCodeAt(j);
  }
  await this.set_data(id, data);
  return id;
};
FS.prototype.CreateBinaryFile = async function(filename, parentid, buffer) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = await this.follow_fs(parent_inode).CreateBinaryFile(filename, foreign_parentid, buffer);
    return this.create_forwarder(parent_inode.mount_id, foreign_id);
  }
  var id = this.CreateFile(filename, parentid);
  var x = this.inodes[id];
  var data = new Uint8Array(buffer.length);
  data.set(buffer);
  await this.set_data(id, data);
  x.size = buffer.length;
  return id;
};
FS.prototype.OpenInode = async function(id, mode) {
  var inode = this.inodes[id];
  if (this.is_forwarder(inode)) {
    return await this.follow_fs(inode).OpenInode(inode.foreign_id, mode);
  }
  if ((inode.mode & S_IFMT) === S_IFDIR) {
    this.FillDirectory(id);
  }
};
FS.prototype.CloseInode = async function(id) {
  var inode = this.inodes[id];
  if (this.is_forwarder(inode)) {
    return await this.follow_fs(inode).CloseInode(inode.foreign_id);
  }
  if (inode.status === STATUS_ON_STORAGE) {
    this.storage.uncache(inode.sha256sum);
  }
  if (inode.status === STATUS_UNLINKED) {
    inode.status = STATUS_INVALID;
    await this.DeleteData(id);
  }
};
FS.prototype.Rename = async function(olddirid, oldname, newdirid, newname) {
  if (olddirid === newdirid && oldname === newname) {
    return 0;
  }
  var oldid = this.Search(olddirid, oldname);
  if (oldid === -1) {
    return -ENOENT;
  }
  var oldpath = this.GetFullPath(olddirid) + "/" + oldname;
  var newid = this.Search(newdirid, newname);
  if (newid !== -1) {
    const ret = this.Unlink(newdirid, newname);
    if (ret < 0) return ret;
  }
  var idx = oldid;
  var inode = this.inodes[idx];
  const olddir = this.inodes[olddirid];
  const newdir = this.inodes[newdirid];
  if (!this.is_forwarder(olddir) && !this.is_forwarder(newdir)) {
    this.unlink_from_dir(olddirid, oldname);
    this.link_under_dir(newdirid, idx, newname);
    inode.qid.version++;
  } else if (this.is_forwarder(olddir) && olddir.mount_id === newdir.mount_id) {
    const ret = await this.follow_fs(olddir).Rename(olddir.foreign_id, oldname, newdir.foreign_id, newname);
    if (ret < 0) return ret;
  } else if (this.is_a_root(idx)) {
    dbg_log("XXX: Attempted to move mountpoint (" + oldname + ") - skipped", LOG_9P);
    return -EPERM;
  } else if (!this.IsDirectory(idx) && this.GetInode(idx).nlinks > 1) {
    dbg_log("XXX: Attempted to move hardlinked file (" + oldname + ") across filesystems - skipped", LOG_9P);
    return -EPERM;
  } else {
    const diverted_old_idx = this.divert(olddirid, oldname);
    const old_real_inode = this.GetInode(idx);
    const data = await this.Read(diverted_old_idx, 0, old_real_inode.size);
    if (this.is_forwarder(newdir)) {
      const foreign_fs = this.follow_fs(newdir);
      const foreign_id = this.IsDirectory(diverted_old_idx) ? foreign_fs.CreateDirectory(newname, newdir.foreign_id) : foreign_fs.CreateFile(newname, newdir.foreign_id);
      const new_real_inode = foreign_fs.GetInode(foreign_id);
      this.copy_inode(old_real_inode, new_real_inode);
      this.set_forwarder(idx, newdir.mount_id, foreign_id);
    } else {
      this.delete_forwarder(inode);
      this.copy_inode(old_real_inode, inode);
      this.link_under_dir(newdirid, idx, newname);
    }
    await this.ChangeSize(idx, old_real_inode.size);
    if (data && data.length) {
      await this.Write(idx, 0, data.length, data);
    }
    if (this.IsDirectory(idx)) {
      for (const child_filename of this.GetChildren(diverted_old_idx)) {
        const ret2 = await this.Rename(diverted_old_idx, child_filename, idx, child_filename);
        if (ret2 < 0) return ret2;
      }
    }
    await this.DeleteData(diverted_old_idx);
    const ret = this.Unlink(olddirid, oldname);
    if (ret < 0) return ret;
  }
  this.NotifyListeners(idx, "rename", { oldpath });
  return 0;
};
FS.prototype.Write = async function(id, offset, count, buffer) {
  this.NotifyListeners(id, "write");
  var inode = this.inodes[id];
  if (this.is_forwarder(inode)) {
    const foreign_id = inode.foreign_id;
    await this.follow_fs(inode).Write(foreign_id, offset, count, buffer);
    return;
  }
  var data = await this.get_buffer(id);
  if (!data || data.length < offset + count) {
    await this.ChangeSize(id, Math.floor((offset + count) * 3 / 2));
    inode.size = offset + count;
    data = await this.get_buffer(id);
  } else if (inode.size < offset + count) {
    inode.size = offset + count;
  }
  if (buffer) {
    data.set(buffer.subarray(0, count), offset);
  }
  await this.set_data(id, data);
};
FS.prototype.Read = async function(inodeid, offset, count) {
  const inode = this.inodes[inodeid];
  if (this.is_forwarder(inode)) {
    const foreign_id = inode.foreign_id;
    return await this.follow_fs(inode).Read(foreign_id, offset, count);
  }
  return await this.get_data(inodeid, offset, count);
};
FS.prototype.Search = function(parentid, name) {
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    const foreign_parentid = parent_inode.foreign_id;
    const foreign_id = this.follow_fs(parent_inode).Search(foreign_parentid, name);
    if (foreign_id === -1) return -1;
    return this.get_forwarder(parent_inode.mount_id, foreign_id);
  }
  const childid = parent_inode.direntries.get(name);
  return childid === void 0 ? -1 : childid;
};
FS.prototype.CountUsedInodes = function() {
  let count = this.inodes.length;
  for (const { fs, backtrack } of this.mounts) {
    count += fs.CountUsedInodes();
    count -= backtrack.size;
  }
  return count;
};
FS.prototype.CountFreeInodes = function() {
  let count = 1024 * 1024;
  for (const { fs } of this.mounts) {
    count += fs.CountFreeInodes();
  }
  return count;
};
FS.prototype.GetTotalSize = function() {
  let size = this.used_size;
  for (const { fs } of this.mounts) {
    size += fs.GetTotalSize();
  }
  return size;
};
FS.prototype.GetSpace = function() {
  let size = this.total_size;
  for (const { fs } of this.mounts) {
    size += fs.GetSpace();
  }
  return this.total_size;
};
FS.prototype.GetDirectoryName = function(idx) {
  const parent_inode = this.inodes[this.GetParent(idx)];
  if (this.is_forwarder(parent_inode)) {
    return this.follow_fs(parent_inode).GetDirectoryName(this.inodes[idx].foreign_id);
  }
  if (!parent_inode) return "";
  for (const [name, childid] of parent_inode.direntries) {
    if (childid === idx) return name;
  }
  dbg_assert(false, "Filesystem: Found directory inode whose parent doesn't link to it");
  return "";
};
FS.prototype.GetFullPath = function(idx) {
  dbg_assert(this.IsDirectory(idx), "Filesystem: Cannot get full path of non-directory inode");
  var path = "";
  while (idx !== 0) {
    path = "/" + this.GetDirectoryName(idx) + path;
    idx = this.GetParent(idx);
  }
  return path.substring(1);
};
FS.prototype.Link = function(parentid, targetid, name) {
  if (this.IsDirectory(targetid)) {
    return -EPERM;
  }
  const parent_inode = this.inodes[parentid];
  const inode = this.inodes[targetid];
  if (this.is_forwarder(parent_inode)) {
    if (!this.is_forwarder(inode) || inode.mount_id !== parent_inode.mount_id) {
      dbg_log("XXX: Attempted to hardlink a file into a child filesystem - skipped", LOG_9P);
      return -EPERM;
    }
    return this.follow_fs(parent_inode).Link(parent_inode.foreign_id, inode.foreign_id, name);
  }
  if (this.is_forwarder(inode)) {
    dbg_log("XXX: Attempted to hardlink file across filesystems - skipped", LOG_9P);
    return -EPERM;
  }
  this.link_under_dir(parentid, targetid, name);
  return 0;
};
FS.prototype.Unlink = function(parentid, name) {
  if (name === "." || name === "..") {
    return -EPERM;
  }
  const idx = this.Search(parentid, name);
  const inode = this.inodes[idx];
  const parent_inode = this.inodes[parentid];
  if (this.is_forwarder(parent_inode)) {
    dbg_assert(this.is_forwarder(inode), "Children of forwarders should be forwarders");
    const foreign_parentid = parent_inode.foreign_id;
    return this.follow_fs(parent_inode).Unlink(foreign_parentid, name);
  }
  if (this.IsDirectory(idx) && !this.IsEmpty(idx)) {
    return -ENOTEMPTY;
  }
  this.unlink_from_dir(parentid, name);
  if (inode.nlinks === 0) {
    inode.status = STATUS_UNLINKED;
    this.NotifyListeners(idx, "delete");
  }
  return 0;
};
FS.prototype.DeleteData = async function(idx) {
  const inode = this.inodes[idx];
  if (this.is_forwarder(inode)) {
    await this.follow_fs(inode).DeleteData(inode.foreign_id);
    return;
  }
  inode.size = 0;
  delete this.inodedata[idx];
};
FS.prototype.get_buffer = async function(idx) {
  const inode = this.inodes[idx];
  dbg_assert(inode, `Filesystem get_buffer: idx ${idx} does not point to an inode`);
  if (this.inodedata[idx]) {
    return this.inodedata[idx];
  } else if (inode.status === STATUS_ON_STORAGE) {
    dbg_assert(inode.sha256sum, "Filesystem get_data: found inode on server without sha256sum");
    return await this.storage.read(inode.sha256sum, 0, inode.size, inode.size);
  } else {
    return null;
  }
};
FS.prototype.get_data = async function(idx, offset, count) {
  const inode = this.inodes[idx];
  dbg_assert(inode, `Filesystem get_data: idx ${idx} does not point to an inode`);
  if (this.inodedata[idx]) {
    return this.inodedata[idx].subarray(offset, offset + count);
  } else if (inode.status === STATUS_ON_STORAGE) {
    dbg_assert(inode.sha256sum, "Filesystem get_data: found inode on server without sha256sum");
    return await this.storage.read(inode.sha256sum, offset, count, inode.size);
  } else {
    return null;
  }
};
FS.prototype.set_data = async function(idx, buffer) {
  this.inodedata[idx] = buffer;
  if (this.inodes[idx].status === STATUS_ON_STORAGE) {
    this.inodes[idx].status = STATUS_OK;
    this.storage.uncache(this.inodes[idx].sha256sum);
  }
};
FS.prototype.GetInode = function(idx) {
  dbg_assert(!isNaN(idx), "Filesystem GetInode: NaN idx");
  dbg_assert(idx >= 0 && idx < this.inodes.length, "Filesystem GetInode: out of range idx:" + idx);
  const inode = this.inodes[idx];
  if (this.is_forwarder(inode)) {
    return this.follow_fs(inode).GetInode(inode.foreign_id);
  }
  return inode;
};
FS.prototype.ChangeSize = async function(idx, newsize) {
  var inode = this.GetInode(idx);
  var temp = await this.get_data(idx, 0, inode.size);
  if (newsize === inode.size) return;
  var data = new Uint8Array(newsize);
  inode.size = newsize;
  if (temp) {
    var size = Math.min(temp.length, inode.size);
    data.set(temp.subarray(0, size), 0);
  }
  await this.set_data(idx, data);
};
FS.prototype.SearchPath = function(path) {
  path = path.replace("//", "/");
  var walk = path.split("/");
  if (walk.length > 0 && walk[walk.length - 1].length === 0) walk.pop();
  if (walk.length > 0 && walk[0].length === 0) walk.shift();
  const n = walk.length;
  var parentid = -1;
  var id = 0;
  let forward_path = null;
  for (var i = 0; i < n; i++) {
    parentid = id;
    id = this.Search(parentid, walk[i]);
    if (!forward_path && this.is_forwarder(this.inodes[parentid])) {
      forward_path = "/" + walk.slice(i).join("/");
    }
    if (id === -1) {
      if (i < n - 1) return { id: -1, parentid: -1, name: walk[i], forward_path };
      return { id: -1, parentid, name: walk[i], forward_path };
    }
  }
  return { id, parentid, name: walk[i], forward_path };
};
FS.prototype.GetRecursiveList = function(dirid, list) {
  if (this.is_forwarder(this.inodes[dirid])) {
    const foreign_fs = this.follow_fs(this.inodes[dirid]);
    const foreign_dirid = this.inodes[dirid].foreign_id;
    const mount_id = this.inodes[dirid].mount_id;
    const foreign_start = list.length;
    foreign_fs.GetRecursiveList(foreign_dirid, list);
    for (let i = foreign_start; i < list.length; i++) {
      list[i].parentid = this.get_forwarder(mount_id, list[i].parentid);
    }
    return;
  }
  for (const [name, id] of this.inodes[dirid].direntries) {
    if (name !== "." && name !== "..") {
      list.push({ parentid: dirid, name });
      if (this.IsDirectory(id)) {
        this.GetRecursiveList(id, list);
      }
    }
  }
};
FS.prototype.RecursiveDelete = function(path) {
  var toDelete = [];
  var ids = this.SearchPath(path);
  if (ids.id === -1) return;
  this.GetRecursiveList(ids.id, toDelete);
  for (var i = toDelete.length - 1; i >= 0; i--) {
    const ret = this.Unlink(toDelete[i].parentid, toDelete[i].name);
    dbg_assert(ret === 0, "Filesystem RecursiveDelete failed at parent=" + toDelete[i].parentid + ", name='" + toDelete[i].name + "' with error code: " + -ret);
  }
};
FS.prototype.DeleteNode = function(path) {
  var ids = this.SearchPath(path);
  if (ids.id === -1) return;
  if ((this.inodes[ids.id].mode & S_IFMT) === S_IFREG) {
    const ret = this.Unlink(ids.parentid, ids.name);
    dbg_assert(ret === 0, "Filesystem DeleteNode failed with error code: " + -ret);
  } else if ((this.inodes[ids.id].mode & S_IFMT) === S_IFDIR) {
    this.RecursiveDelete(path);
    const ret = this.Unlink(ids.parentid, ids.name);
    dbg_assert(ret === 0, "Filesystem DeleteNode failed with error code: " + -ret);
  }
};
FS.prototype.NotifyListeners = function(id, action, info) {
};
FS.prototype.Check = function() {
  for (var i = 1; i < this.inodes.length; i++) {
    if (this.inodes[i].status === STATUS_INVALID) continue;
    var inode = this.GetInode(i);
    if (inode.nlinks < 0) {
      dbg_log("Error in filesystem: negative nlinks=" + inode.nlinks + " at id =" + i, LOG_9P);
    }
    if (this.IsDirectory(i)) {
      const inode2 = this.GetInode(i);
      if (this.IsDirectory(i) && this.GetParent(i) < 0) {
        dbg_log("Error in filesystem: negative parent id " + i, LOG_9P);
      }
      for (const [name, id] of inode2.direntries) {
        if (name.length === 0) {
          dbg_log("Error in filesystem: inode with no name and id " + id, LOG_9P);
        }
        for (const c of name) {
          if (c < 32) {
            dbg_log("Error in filesystem: Unallowed char in filename", LOG_9P);
          }
        }
      }
    }
  }
};
FS.prototype.FillDirectory = function(dirid) {
  const inode = this.inodes[dirid];
  if (this.is_forwarder(inode)) {
    this.follow_fs(inode).FillDirectory(inode.foreign_id);
    return;
  }
  let size = 0;
  for (const name of inode.direntries.keys()) {
    size += 13 + 8 + 1 + 2 + texten2.encode(name).length;
  }
  const data = this.inodedata[dirid] = new Uint8Array(size);
  inode.size = size;
  let offset = 0;
  for (const [name, id] of inode.direntries) {
    const child = this.GetInode(id);
    offset += Marshall(
      ["Q", "d", "b", "s"],
      [
        child.qid,
        offset + 13 + 8 + 1 + 2 + texten2.encode(name).length,
        child.mode >> 12,
        name
      ],
      data,
      offset
    );
  }
};
FS.prototype.RoundToDirentry = function(dirid, offset_target) {
  const data = this.inodedata[dirid];
  dbg_assert(data, `FS directory data for dirid=${dirid} should be generated`);
  dbg_assert(data.length, "FS directory should have at least an entry");
  if (offset_target >= data.length) {
    return data.length;
  }
  let offset = 0;
  while (true) {
    const next_offset = Unmarshall(["Q", "d"], data, { offset })[1];
    if (next_offset > offset_target) break;
    offset = next_offset;
  }
  return offset;
};
FS.prototype.IsDirectory = function(idx) {
  const inode = this.inodes[idx];
  if (this.is_forwarder(inode)) {
    return this.follow_fs(inode).IsDirectory(inode.foreign_id);
  }
  return (inode.mode & S_IFMT) === S_IFDIR;
};
FS.prototype.IsEmpty = function(idx) {
  const inode = this.inodes[idx];
  if (this.is_forwarder(inode)) {
    return this.follow_fs(inode).IsDirectory(inode.foreign_id);
  }
  for (const name of inode.direntries.keys()) {
    if (name !== "." && name !== "..") return false;
  }
  return true;
};
FS.prototype.GetChildren = function(idx) {
  dbg_assert(this.IsDirectory(idx), "Filesystem: cannot get children of non-directory inode");
  const inode = this.inodes[idx];
  if (this.is_forwarder(inode)) {
    return this.follow_fs(inode).GetChildren(inode.foreign_id);
  }
  const children = [];
  for (const name of inode.direntries.keys()) {
    if (name !== "." && name !== "..") {
      children.push(name);
    }
  }
  return children;
};
FS.prototype.GetParent = function(idx) {
  dbg_assert(this.IsDirectory(idx), "Filesystem: cannot get parent of non-directory inode");
  const inode = this.inodes[idx];
  if (this.should_be_linked(inode)) {
    return inode.direntries.get("..");
  } else {
    const foreign_dirid = this.follow_fs(inode).GetParent(inode.foreign_id);
    dbg_assert(foreign_dirid !== -1, "Filesystem: should not have invalid parent ids");
    return this.get_forwarder(inode.mount_id, foreign_dirid);
  }
};
FS.prototype.PrepareCAPs = function(id) {
  var inode = this.GetInode(id);
  if (inode.caps) return inode.caps.length;
  inode.caps = new Uint8Array(20);
  inode.caps[0] = 0;
  inode.caps[1] = 0;
  inode.caps[2] = 0;
  inode.caps[3] = 2;
  inode.caps[4] = 255;
  inode.caps[5] = 255;
  inode.caps[6] = 255;
  inode.caps[7] = 255;
  inode.caps[8] = 255;
  inode.caps[9] = 255;
  inode.caps[10] = 255;
  inode.caps[11] = 255;
  inode.caps[12] = 63;
  inode.caps[13] = 0;
  inode.caps[14] = 0;
  inode.caps[15] = 0;
  inode.caps[16] = 63;
  inode.caps[17] = 0;
  inode.caps[18] = 0;
  inode.caps[19] = 0;
  return inode.caps.length;
};
function FSMountInfo(filesystem) {
  this.fs = filesystem;
  this.backtrack = /* @__PURE__ */ new Map();
}
FSMountInfo.prototype.get_state = function() {
  const state = [];
  state[0] = this.fs;
  state[1] = [...this.backtrack];
  return state;
};
FSMountInfo.prototype.set_state = function(state) {
  this.fs = state[0];
  this.backtrack = new Map(state[1]);
};
FS.prototype.set_forwarder = function(idx, mount_id, foreign_id) {
  const inode = this.inodes[idx];
  dbg_assert(
    inode.nlinks === 0,
    "Filesystem: attempted to convert an inode into forwarder before unlinking the inode"
  );
  if (this.is_forwarder(inode)) {
    this.mounts[inode.mount_id].backtrack.delete(inode.foreign_id);
  }
  inode.status = STATUS_FORWARDING;
  inode.mount_id = mount_id;
  inode.foreign_id = foreign_id;
  this.mounts[mount_id].backtrack.set(foreign_id, idx);
};
FS.prototype.create_forwarder = function(mount_id, foreign_id) {
  const inode = this.CreateInode();
  const idx = this.inodes.length;
  this.inodes.push(inode);
  inode.fid = idx;
  this.set_forwarder(idx, mount_id, foreign_id);
  return idx;
};
FS.prototype.is_forwarder = function(inode) {
  return inode.status === STATUS_FORWARDING;
};
FS.prototype.is_a_root = function(idx) {
  return this.GetInode(idx).fid === 0;
};
FS.prototype.get_forwarder = function(mount_id, foreign_id) {
  const mount = this.mounts[mount_id];
  dbg_assert(foreign_id >= 0, "Filesystem get_forwarder: invalid foreign_id: " + foreign_id);
  dbg_assert(mount, "Filesystem get_forwarder: invalid mount number: " + mount_id);
  const result = mount.backtrack.get(foreign_id);
  if (result === void 0) {
    return this.create_forwarder(mount_id, foreign_id);
  }
  return result;
};
FS.prototype.delete_forwarder = function(inode) {
  dbg_assert(this.is_forwarder(inode), "Filesystem delete_forwarder: expected forwarder");
  inode.status = STATUS_INVALID;
  this.mounts[inode.mount_id].backtrack.delete(inode.foreign_id);
};
FS.prototype.follow_fs = function(inode) {
  const mount = this.mounts[inode.mount_id];
  dbg_assert(
    this.is_forwarder(inode),
    "Filesystem follow_fs: inode should be a forwarding inode"
  );
  dbg_assert(mount, "Filesystem follow_fs: inode<id=" + inode.fid + "> should point to valid mounted FS");
  return mount.fs;
};
FS.prototype.Mount = function(path, fs) {
  dbg_assert(
    fs.qidcounter === this.qidcounter,
    "Cannot mount filesystem whose qid numbers aren't synchronised with current filesystem."
  );
  const path_infos = this.SearchPath(path);
  if (path_infos.parentid === -1) {
    dbg_log("Mount failed: parent for path not found: " + path, LOG_9P);
    return -ENOENT;
  }
  if (path_infos.id !== -1) {
    dbg_log("Mount failed: file already exists at path: " + path, LOG_9P);
    return -EEXIST;
  }
  if (path_infos.forward_path) {
    const parent = this.inodes[path_infos.parentid];
    const ret = this.follow_fs(parent).Mount(path_infos.forward_path, fs);
    if (ret < 0) return ret;
    return this.get_forwarder(parent.mount_id, ret);
  }
  const mount_id = this.mounts.length;
  this.mounts.push(new FSMountInfo(fs));
  const idx = this.create_forwarder(mount_id, 0);
  this.link_under_dir(path_infos.parentid, idx, path_infos.name);
  return idx;
};
function FSLockRegion() {
  this.type = P9_LOCK_TYPE_UNLCK;
  this.start = 0;
  this.length = Infinity;
  this.proc_id = -1;
  this.client_id = "";
}
FSLockRegion.prototype.get_state = function() {
  const state = [];
  state[0] = this.type;
  state[1] = this.start;
  state[2] = this.length === Infinity ? 0 : this.length;
  state[3] = this.proc_id;
  state[4] = this.client_id;
  return state;
};
FSLockRegion.prototype.set_state = function(state) {
  this.type = state[0];
  this.start = state[1];
  this.length = state[2] === 0 ? Infinity : state[2];
  this.proc_id = state[3];
  this.client_id = state[4];
};
FSLockRegion.prototype.clone = function() {
  const new_region = new FSLockRegion();
  new_region.set_state(this.get_state());
  return new_region;
};
FSLockRegion.prototype.conflicts_with = function(region) {
  if (this.proc_id === region.proc_id && this.client_id === region.client_id) return false;
  if (this.type === P9_LOCK_TYPE_UNLCK || region.type === P9_LOCK_TYPE_UNLCK) return false;
  if (this.type !== P9_LOCK_TYPE_WRLCK && region.type !== P9_LOCK_TYPE_WRLCK) return false;
  if (this.start + this.length <= region.start) return false;
  if (region.start + region.length <= this.start) return false;
  return true;
};
FSLockRegion.prototype.is_alike = function(region) {
  return region.proc_id === this.proc_id && region.client_id === this.client_id && region.type === this.type;
};
FSLockRegion.prototype.may_merge_after = function(region) {
  return this.is_alike(region) && region.start + region.length === this.start;
};
FS.prototype.DescribeLock = function(type, start, length, proc_id, client_id) {
  dbg_assert(
    type === P9_LOCK_TYPE_RDLCK || type === P9_LOCK_TYPE_WRLCK || type === P9_LOCK_TYPE_UNLCK,
    "Filesystem: Invalid lock type: " + type
  );
  dbg_assert(start >= 0, "Filesystem: Invalid negative lock starting offset: " + start);
  dbg_assert(length > 0, "Filesystem: Invalid non-positive lock length: " + length);
  const lock = new FSLockRegion();
  lock.type = type;
  lock.start = start;
  lock.length = length;
  lock.proc_id = proc_id;
  lock.client_id = client_id;
  return lock;
};
FS.prototype.GetLock = function(id, request) {
  const inode = this.inodes[id];
  if (this.is_forwarder(inode)) {
    const foreign_id = inode.foreign_id;
    return this.follow_fs(inode).GetLock(foreign_id, request);
  }
  for (const region of inode.locks) {
    if (request.conflicts_with(region)) {
      return region.clone();
    }
  }
  return null;
};
FS.prototype.Lock = function(id, request, flags) {
  const inode = this.inodes[id];
  if (this.is_forwarder(inode)) {
    const foreign_id = inode.foreign_id;
    return this.follow_fs(inode).Lock(foreign_id, request, flags);
  }
  request = request.clone();
  if (request.type !== P9_LOCK_TYPE_UNLCK && this.GetLock(id, request)) {
    return P9_LOCK_BLOCKED;
  }
  for (let i = 0; i < inode.locks.length; i++) {
    const region = inode.locks[i];
    dbg_assert(
      region.length > 0,
      "Filesystem: Found non-positive lock region length: " + region.length
    );
    dbg_assert(
      region.type === P9_LOCK_TYPE_RDLCK || region.type === P9_LOCK_TYPE_WRLCK,
      "Filesystem: Found invalid lock type: " + region.type
    );
    dbg_assert(
      !inode.locks[i - 1] || inode.locks[i - 1].start <= region.start,
      "Filesystem: Locks should be sorted by starting offset"
    );
    if (region.start + region.length <= request.start) continue;
    if (request.start + request.length <= region.start) break;
    if (region.proc_id !== request.proc_id || region.client_id !== request.client_id) {
      dbg_assert(
        !region.conflicts_with(request),
        "Filesytem: Found conflicting lock region, despite already checked for conflicts"
      );
      continue;
    }
    const start1 = region.start;
    const start2 = request.start + request.length;
    const length1 = request.start - start1;
    const length2 = region.start + region.length - start2;
    if (length1 > 0 && length2 > 0 && region.type === request.type) {
      return P9_LOCK_SUCCESS;
    }
    if (length1 > 0) {
      region.length = length1;
    }
    if (length1 <= 0 && length2 > 0) {
      region.start = start2;
      region.length = length2;
    } else if (length2 > 0) {
      while (i < inode.locks.length && inode.locks[i].start < start2) i++;
      inode.locks.splice(
        i,
        0,
        this.DescribeLock(region.type, start2, length2, region.proc_id, region.client_id)
      );
    } else if (length1 <= 0) {
      inode.locks.splice(i, 1);
      i--;
    }
  }
  if (request.type !== P9_LOCK_TYPE_UNLCK) {
    let new_region = request;
    let has_merged = false;
    let i = 0;
    for (; i < inode.locks.length; i++) {
      if (new_region.may_merge_after(inode.locks[i])) {
        inode.locks[i].length += request.length;
        new_region = inode.locks[i];
        has_merged = true;
      }
      if (request.start <= inode.locks[i].start) break;
    }
    if (!has_merged) {
      inode.locks.splice(i, 0, new_region);
      i++;
    }
    for (; i < inode.locks.length; i++) {
      if (!inode.locks[i].is_alike(new_region)) continue;
      if (inode.locks[i].may_merge_after(new_region)) {
        new_region.length += inode.locks[i].length;
        inode.locks.splice(i, 1);
      }
      break;
    }
  }
  return P9_LOCK_SUCCESS;
};
FS.prototype.read_dir = function(path) {
  const p = this.SearchPath(path);
  if (p.id === -1) {
    return void 0;
  }
  const dir = this.GetInode(p.id);
  return Array.from(dir.direntries.keys()).filter((path2) => path2 !== "." && path2 !== "..");
};
FS.prototype.read_file = function(file) {
  const p = this.SearchPath(file);
  if (p.id === -1) {
    return Promise.resolve(null);
  }
  const inode = this.GetInode(p.id);
  return this.Read(p.id, 0, inode.size);
};

// lib/9p.js
var TRACK_FILENAMES = false;
var VIRTIO_9P_F_MOUNT_TAG = 0;
var VIRTIO_9P_MAX_TAGLEN = 254;
var MAX_REPLYBUFFER_SIZE = 16 * 1024 * 1024;
var EPERM = 1;
var ENOENT = 2;
var EEXIST = 17;
var EOPNOTSUPP = 95;
var ENOTEMPTY = 39;
var P9_SETATTR_MODE = 1;
var P9_SETATTR_UID = 2;
var P9_SETATTR_GID = 4;
var P9_SETATTR_SIZE = 8;
var P9_SETATTR_ATIME = 16;
var P9_SETATTR_MTIME = 32;
var P9_SETATTR_CTIME = 64;
var P9_SETATTR_ATIME_SET = 128;
var P9_SETATTR_MTIME_SET = 256;
var P9_LOCK_TYPE_RDLCK = 0;
var P9_LOCK_TYPE_WRLCK = 1;
var P9_LOCK_TYPE_UNLCK = 2;
var P9_LOCK_TYPES = ["shared", "exclusive", "unlock"];
var P9_LOCK_SUCCESS = 0;
var P9_LOCK_BLOCKED = 1;
var FID_NONE = -1;
var FID_INODE = 1;
var FID_XATTR = 2;
function range(size) {
  return Array.from(Array(size).keys());
}
function init_virtio(cpu, configspace_taglen, configspace_tagname, receive) {
  const virtio = new VirtIO(
    cpu,
    {
      name: "virtio-9p",
      pci_id: 6 << 3,
      device_id: 4169,
      subsystem_device_id: 9,
      common: {
        initial_port: 43008,
        queues: [
          {
            size_supported: 32,
            notify_offset: 0
          }
        ],
        features: [
          VIRTIO_9P_F_MOUNT_TAG,
          VIRTIO_F_VERSION_1,
          VIRTIO_F_RING_EVENT_IDX,
          VIRTIO_F_RING_INDIRECT_DESC
        ],
        on_driver_ok: () => {
        }
      },
      notification: {
        initial_port: 43264,
        single_handler: false,
        handlers: [
          (queue_id) => {
            if (queue_id !== 0) {
              dbg_assert(false, "Virtio9P Notified for non-existent queue: " + queue_id + " (expected queue_id of 0)");
              return;
            }
            const virtqueue = virtio.queues[0];
            while (virtqueue.has_request()) {
              const bufchain = virtqueue.pop_request();
              receive(bufchain);
            }
            virtqueue.notify_me_after(0);
          }
        ]
      },
      isr_status: {
        initial_port: 42752
      },
      device_specific: {
        initial_port: 42496,
        struct: [
          {
            bytes: 2,
            name: "mount tag length",
            read: () => configspace_taglen,
            write: (data) => {
            }
          }
        ].concat(range(VIRTIO_9P_MAX_TAGLEN).map(
          (index) => ({
            bytes: 1,
            name: "mount tag name " + index,
            // Note: configspace_tagname may have changed after set_state
            read: () => configspace_tagname[index] || 0,
            write: (data) => {
            }
          })
        ))
      }
    }
  );
  return virtio;
}
function Virtio9p(filesystem, cpu, bus) {
  this.fs = filesystem;
  this.bus = bus;
  this.configspace_tagname = [104, 111, 115, 116, 57, 112];
  this.configspace_taglen = this.configspace_tagname.length;
  this.virtio = init_virtio(cpu, this.configspace_taglen, this.configspace_tagname, this.ReceiveRequest.bind(this));
  this.virtqueue = this.virtio.queues[0];
  this.VERSION = "9P2000.L";
  this.BLOCKSIZE = 8192;
  this.msize = 8192;
  this.replybuffer = new Uint8Array(this.msize * 2);
  this.replybuffersize = 0;
  this.fids = [];
}
Virtio9p.prototype.get_state = function() {
  var state = [];
  state[0] = this.configspace_tagname;
  state[1] = this.configspace_taglen;
  state[2] = this.virtio;
  state[3] = this.VERSION;
  state[4] = this.BLOCKSIZE;
  state[5] = this.msize;
  state[6] = this.replybuffer;
  state[7] = this.replybuffersize;
  state[8] = this.fids.map(function(f) {
    return [f.inodeid, f.type, f.uid, f.dbg_name];
  });
  state[9] = this.fs;
  return state;
};
Virtio9p.prototype.set_state = function(state) {
  this.configspace_tagname = state[0];
  this.configspace_taglen = state[1];
  this.virtio.set_state(state[2]);
  this.virtqueue = this.virtio.queues[0];
  this.VERSION = state[3];
  this.BLOCKSIZE = state[4];
  this.msize = state[5];
  this.replybuffer = state[6];
  this.replybuffersize = state[7];
  this.fids = state[8].map(function(f) {
    return { inodeid: f[0], type: f[1], uid: f[2], dbg_name: f[3] };
  });
  this.fs.set_state(state[9]);
};
Virtio9p.prototype.Createfid = function(inodeid, type, uid, dbg_name) {
  return { inodeid, type, uid, dbg_name };
};
Virtio9p.prototype.update_dbg_name = function(idx, newname) {
  for (const fid of this.fids) {
    if (fid.inodeid === idx) fid.dbg_name = newname;
  }
};
Virtio9p.prototype.reset = function() {
  this.fids = [];
  this.virtio.reset();
};
Virtio9p.prototype.BuildReply = function(id, tag, payloadsize) {
  dbg_assert(payloadsize >= 0, "9P: Negative payload size");
  Marshall(["w", "b", "h"], [payloadsize + 7, id + 1, tag], this.replybuffer, 0);
  if (payloadsize + 7 >= this.replybuffer.length) {
    dbg_log("Error in 9p: payloadsize exceeds maximum length", LOG_9P);
  }
  this.replybuffersize = payloadsize + 7;
};
Virtio9p.prototype.SendError = function(tag, errormsg, errorcode) {
  var size = Marshall(["w"], [errorcode], this.replybuffer, 7);
  this.BuildReply(6, tag, size);
};
Virtio9p.prototype.SendReply = function(bufchain) {
  dbg_assert(this.replybuffersize >= 0, "9P: Negative replybuffersize");
  bufchain.set_next_blob(this.replybuffer.subarray(0, this.replybuffersize));
  this.virtqueue.push_reply(bufchain);
  this.virtqueue.flush_replies();
};
Virtio9p.prototype.ReceiveRequest = async function(bufchain) {
  const buffer = new Uint8Array(bufchain.length_readable);
  bufchain.get_next_blob(buffer);
  const state = { offset: 0 };
  var header = Unmarshall(["w", "b", "h"], buffer, state);
  var size = header[0];
  var id = header[1];
  var tag = header[2];
  switch (id) {
    case 8:
      size = this.fs.GetTotalSize();
      var space = this.fs.GetSpace();
      var req = [];
      req[0] = 16914839;
      req[1] = this.BLOCKSIZE;
      req[2] = Math.floor(space / req[1]);
      req[3] = req[2] - Math.floor(size / req[1]);
      req[4] = req[2] - Math.floor(size / req[1]);
      req[5] = this.fs.CountUsedInodes();
      req[6] = this.fs.CountFreeInodes();
      req[7] = 0;
      req[8] = 256;
      size = Marshall(["w", "w", "d", "d", "d", "d", "d", "d", "w"], req, this.replybuffer, 7);
      this.BuildReply(id, tag, size);
      this.SendReply(bufchain);
      break;
    case 112:
    // topen
    case 12:
      var req = Unmarshall(["w", "w"], buffer, state);
      var fid = req[0];
      var mode = req[1];
      dbg_log("[open] fid=" + fid + ", mode=" + mode, LOG_9P);
      var idx = this.fids[fid].inodeid;
      var inode = this.fs.GetInode(idx);
      dbg_log("file open " + this.fids[fid].dbg_name + " tag:" + tag, LOG_9P);
      await this.fs.OpenInode(idx, mode);
      req = [];
      req[0] = inode.qid;
      req[1] = this.msize - 24;
      Marshall(["Q", "w"], req, this.replybuffer, 7);
      this.BuildReply(id, tag, 13 + 4);
      this.SendReply(bufchain);
      break;
    case 70:
      var req = Unmarshall(["w", "w", "s"], buffer, state);
      var dfid = req[0];
      var fid = req[1];
      var name = req[2];
      dbg_log("[link] dfid=" + dfid + ", name=" + name, LOG_9P);
      var ret = this.fs.Link(this.fids[dfid].inodeid, this.fids[fid].inodeid, name);
      if (ret < 0) {
        let error_message = "";
        if (ret === -EPERM) error_message = "Operation not permitted";
        else {
          error_message = "Unknown error: " + -ret;
          dbg_assert(false, "[link]: Unexpected error code: " + -ret);
        }
        this.SendError(tag, error_message, -ret);
        this.SendReply(bufchain);
        break;
      }
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 16:
      var req = Unmarshall(["w", "s", "s", "w"], buffer, state);
      var fid = req[0];
      var name = req[1];
      var symgt = req[2];
      var gid = req[3];
      dbg_log("[symlink] fid=" + fid + ", name=" + name + ", symgt=" + symgt + ", gid=" + gid, LOG_9P);
      var idx = this.fs.CreateSymlink(name, this.fids[fid].inodeid, symgt);
      var inode = this.fs.GetInode(idx);
      inode.uid = this.fids[fid].uid;
      inode.gid = gid;
      Marshall(["Q"], [inode.qid], this.replybuffer, 7);
      this.BuildReply(id, tag, 13);
      this.SendReply(bufchain);
      break;
    case 18:
      var req = Unmarshall(["w", "s", "w", "w", "w", "w"], buffer, state);
      var fid = req[0];
      var name = req[1];
      var mode = req[2];
      var major = req[3];
      var minor = req[4];
      var gid = req[5];
      dbg_log("[mknod] fid=" + fid + ", name=" + name + ", major=" + major + ", minor=" + minor, LOG_9P);
      var idx = this.fs.CreateNode(name, this.fids[fid].inodeid, major, minor);
      var inode = this.fs.GetInode(idx);
      inode.mode = mode;
      inode.uid = this.fids[fid].uid;
      inode.gid = gid;
      Marshall(["Q"], [inode.qid], this.replybuffer, 7);
      this.BuildReply(id, tag, 13);
      this.SendReply(bufchain);
      break;
    case 22:
      var req = Unmarshall(["w"], buffer, state);
      var fid = req[0];
      var inode = this.fs.GetInode(this.fids[fid].inodeid);
      dbg_log("[readlink] fid=" + fid + " name=" + this.fids[fid].dbg_name + " target=" + inode.symlink, LOG_9P);
      size = Marshall(["s"], [inode.symlink], this.replybuffer, 7);
      this.BuildReply(id, tag, size);
      this.SendReply(bufchain);
      break;
    case 72:
      var req = Unmarshall(["w", "s", "w", "w"], buffer, state);
      var fid = req[0];
      var name = req[1];
      var mode = req[2];
      var gid = req[3];
      dbg_log("[mkdir] fid=" + fid + ", name=" + name + ", mode=" + mode + ", gid=" + gid, LOG_9P);
      var idx = this.fs.CreateDirectory(name, this.fids[fid].inodeid);
      var inode = this.fs.GetInode(idx);
      inode.mode = mode | S_IFDIR;
      inode.uid = this.fids[fid].uid;
      inode.gid = gid;
      Marshall(["Q"], [inode.qid], this.replybuffer, 7);
      this.BuildReply(id, tag, 13);
      this.SendReply(bufchain);
      break;
    case 14:
      var req = Unmarshall(["w", "s", "w", "w", "w"], buffer, state);
      var fid = req[0];
      var name = req[1];
      var flags = req[2];
      var mode = req[3];
      var gid = req[4];
      this.bus.send("9p-create", [name, this.fids[fid].inodeid]);
      dbg_log("[create] fid=" + fid + ", name=" + name + ", flags=" + flags + ", mode=" + mode + ", gid=" + gid, LOG_9P);
      var idx = this.fs.CreateFile(name, this.fids[fid].inodeid);
      this.fids[fid].inodeid = idx;
      this.fids[fid].type = FID_INODE;
      this.fids[fid].dbg_name = name;
      var inode = this.fs.GetInode(idx);
      inode.uid = this.fids[fid].uid;
      inode.gid = gid;
      inode.mode = mode | S_IFREG;
      Marshall(["Q", "w"], [inode.qid, this.msize - 24], this.replybuffer, 7);
      this.BuildReply(id, tag, 13 + 4);
      this.SendReply(bufchain);
      break;
    case 52:
      var req = Unmarshall(["w", "b", "w", "d", "d", "w", "s"], buffer, state);
      var fid = req[0];
      var flags = req[2];
      var lock_length = req[4] === 0 ? Infinity : req[4];
      var lock_request = this.fs.DescribeLock(req[1], req[3], lock_length, req[5], req[6]);
      dbg_log("[lock] fid=" + fid + ", type=" + P9_LOCK_TYPES[lock_request.type] + ", start=" + lock_request.start + ", length=" + lock_request.length + ", proc_id=" + lock_request.proc_id);
      var ret = this.fs.Lock(this.fids[fid].inodeid, lock_request, flags);
      Marshall(["b"], [ret], this.replybuffer, 7);
      this.BuildReply(id, tag, 1);
      this.SendReply(bufchain);
      break;
    case 54:
      var req = Unmarshall(["w", "b", "d", "d", "w", "s"], buffer, state);
      var fid = req[0];
      var lock_length = req[3] === 0 ? Infinity : req[3];
      var lock_request = this.fs.DescribeLock(req[1], req[2], lock_length, req[4], req[5]);
      dbg_log("[getlock] fid=" + fid + ", type=" + P9_LOCK_TYPES[lock_request.type] + ", start=" + lock_request.start + ", length=" + lock_request.length + ", proc_id=" + lock_request.proc_id);
      var ret = this.fs.GetLock(this.fids[fid].inodeid, lock_request);
      if (!ret) {
        ret = lock_request;
        ret.type = P9_LOCK_TYPE_UNLCK;
      }
      var ret_length = ret.length === Infinity ? 0 : ret.length;
      size = Marshall(
        ["b", "d", "d", "w", "s"],
        [ret.type, ret.start, ret_length, ret.proc_id, ret.client_id],
        this.replybuffer,
        7
      );
      this.BuildReply(id, tag, size);
      this.SendReply(bufchain);
      break;
    case 24:
      var req = Unmarshall(["w", "d"], buffer, state);
      var fid = req[0];
      var inode = this.fs.GetInode(this.fids[fid].inodeid);
      dbg_log("[getattr]: fid=" + fid + " name=" + this.fids[fid].dbg_name + " request mask=" + req[1], LOG_9P);
      if (!inode || inode.status === STATUS_UNLINKED) {
        dbg_log("getattr: unlinked", LOG_9P);
        this.SendError(tag, "No such file or directory", ENOENT);
        this.SendReply(bufchain);
        break;
      }
      req[0] = req[1];
      req[1] = inode.qid;
      req[2] = inode.mode;
      req[3] = inode.uid;
      req[4] = inode.gid;
      req[5] = inode.nlinks;
      req[6] = inode.major << 8 | inode.minor;
      req[7] = inode.size;
      req[8] = this.BLOCKSIZE;
      req[9] = Math.floor(inode.size / 512 + 1);
      req[10] = inode.atime;
      req[11] = 0;
      req[12] = inode.mtime;
      req[13] = 0;
      req[14] = inode.ctime;
      req[15] = 0;
      req[16] = 0;
      req[17] = 0;
      req[18] = 0;
      req[19] = 0;
      Marshall([
        "d",
        "Q",
        "w",
        "w",
        "w",
        "d",
        "d",
        "d",
        "d",
        "d",
        "d",
        "d",
        // atime
        "d",
        "d",
        // mtime
        "d",
        "d",
        // ctime
        "d",
        "d",
        // btime
        "d",
        "d"
      ], req, this.replybuffer, 7);
      this.BuildReply(id, tag, 8 + 13 + 4 + 4 + 4 + 8 * 15);
      this.SendReply(bufchain);
      break;
    case 26:
      var req = Unmarshall([
        "w",
        "w",
        "w",
        // mode
        "w",
        "w",
        // uid, gid
        "d",
        // size
        "d",
        "d",
        // atime
        "d",
        "d"
        // mtime
      ], buffer, state);
      var fid = req[0];
      var inode = this.fs.GetInode(this.fids[fid].inodeid);
      dbg_log("[setattr]: fid=" + fid + " request mask=" + req[1] + " name=" + this.fids[fid].dbg_name, LOG_9P);
      if (req[1] & P9_SETATTR_MODE) {
        inode.mode = req[2];
      }
      if (req[1] & P9_SETATTR_UID) {
        inode.uid = req[3];
      }
      if (req[1] & P9_SETATTR_GID) {
        inode.gid = req[4];
      }
      if (req[1] & P9_SETATTR_ATIME) {
        inode.atime = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
      }
      if (req[1] & P9_SETATTR_MTIME) {
        inode.mtime = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
      }
      if (req[1] & P9_SETATTR_CTIME) {
        inode.ctime = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
      }
      if (req[1] & P9_SETATTR_ATIME_SET) {
        inode.atime = req[6];
      }
      if (req[1] & P9_SETATTR_MTIME_SET) {
        inode.mtime = req[8];
      }
      if (req[1] & P9_SETATTR_SIZE) {
        await this.fs.ChangeSize(this.fids[fid].inodeid, req[5]);
      }
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 50:
      var req = Unmarshall(["w", "d"], buffer, state);
      var fid = req[0];
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 40:
    // TREADDIR
    case 116:
      var req = Unmarshall(["w", "d", "w"], buffer, state);
      var fid = req[0];
      var offset = req[1];
      var count = req[2];
      var inode = this.fs.GetInode(this.fids[fid].inodeid);
      if (id === 40) dbg_log("[treaddir]: fid=" + fid + " offset=" + offset + " count=" + count, LOG_9P);
      if (id === 116) dbg_log("[read]: fid=" + fid + " (" + this.fids[fid].dbg_name + ") offset=" + offset + " count=" + count + " fidtype=" + this.fids[fid].type, LOG_9P);
      if (!inode || inode.status === STATUS_UNLINKED) {
        dbg_log("read/treaddir: unlinked", LOG_9P);
        this.SendError(tag, "No such file or directory", ENOENT);
        this.SendReply(bufchain);
        break;
      }
      if (this.fids[fid].type === FID_XATTR) {
        if (inode.caps.length < offset + count) count = inode.caps.length - offset;
        for (var i = 0; i < count; i++)
          this.replybuffer[7 + 4 + i] = inode.caps[offset + i];
        Marshall(["w"], [count], this.replybuffer, 7);
        this.BuildReply(id, tag, 4 + count);
        this.SendReply(bufchain);
      } else {
        await this.fs.OpenInode(this.fids[fid].inodeid, void 0);
        const inodeid = this.fids[fid].inodeid;
        count = Math.min(count, this.replybuffer.length - (7 + 4));
        if (inode.size < offset + count) count = inode.size - offset;
        else if (id === 40) {
          count = this.fs.RoundToDirentry(inodeid, offset + count) - offset;
        }
        if (offset > inode.size) {
          count = 0;
        }
        this.bus.send("9p-read-start", [this.fids[fid].dbg_name]);
        const data = await this.fs.Read(inodeid, offset, count);
        this.bus.send("9p-read-end", [this.fids[fid].dbg_name, count]);
        if (data) {
          this.replybuffer.set(data, 7 + 4);
        }
        Marshall(["w"], [count], this.replybuffer, 7);
        this.BuildReply(id, tag, 4 + count);
        this.SendReply(bufchain);
      }
      break;
    case 118:
      var req = Unmarshall(["w", "d", "w"], buffer, state);
      var fid = req[0];
      var offset = req[1];
      var count = req[2];
      const filename = this.fids[fid].dbg_name;
      dbg_log("[write]: fid=" + fid + " (" + filename + ") offset=" + offset + " count=" + count + " fidtype=" + this.fids[fid].type, LOG_9P);
      if (this.fids[fid].type === FID_XATTR) {
        this.SendError(tag, "Setxattr not supported", EOPNOTSUPP);
        this.SendReply(bufchain);
        break;
      } else {
        await this.fs.Write(this.fids[fid].inodeid, offset, count, buffer.subarray(state.offset));
      }
      this.bus.send("9p-write-end", [filename, count]);
      Marshall(["w"], [count], this.replybuffer, 7);
      this.BuildReply(id, tag, 4);
      this.SendReply(bufchain);
      break;
    case 74:
      var req = Unmarshall(["w", "s", "w", "s"], buffer, state);
      var olddirfid = req[0];
      var oldname = req[1];
      var newdirfid = req[2];
      var newname = req[3];
      dbg_log("[renameat]: oldname=" + oldname + " newname=" + newname, LOG_9P);
      var ret = await this.fs.Rename(this.fids[olddirfid].inodeid, oldname, this.fids[newdirfid].inodeid, newname);
      if (ret < 0) {
        let error_message = "";
        if (ret === -ENOENT) error_message = "No such file or directory";
        else if (ret === -EPERM) error_message = "Operation not permitted";
        else if (ret === -ENOTEMPTY) error_message = "Directory not empty";
        else {
          error_message = "Unknown error: " + -ret;
          dbg_assert(false, "[renameat]: Unexpected error code: " + -ret);
        }
        this.SendError(tag, error_message, -ret);
        this.SendReply(bufchain);
        break;
      }
      if (TRACK_FILENAMES) {
        const newidx = this.fs.Search(this.fids[newdirfid].inodeid, newname);
        this.update_dbg_name(newidx, newname);
      }
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 76:
      var req = Unmarshall(["w", "s", "w"], buffer, state);
      var dirfd = req[0];
      var name = req[1];
      var flags = req[2];
      dbg_log("[unlink]: dirfd=" + dirfd + " name=" + name + " flags=" + flags, LOG_9P);
      var fid = this.fs.Search(this.fids[dirfd].inodeid, name);
      if (fid === -1) {
        this.SendError(tag, "No such file or directory", ENOENT);
        this.SendReply(bufchain);
        break;
      }
      var ret = this.fs.Unlink(this.fids[dirfd].inodeid, name);
      if (ret < 0) {
        let error_message = "";
        if (ret === -ENOTEMPTY) error_message = "Directory not empty";
        else if (ret === -EPERM) error_message = "Operation not permitted";
        else {
          error_message = "Unknown error: " + -ret;
          dbg_assert(false, "[unlink]: Unexpected error code: " + -ret);
        }
        this.SendError(tag, error_message, -ret);
        this.SendReply(bufchain);
        break;
      }
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 100:
      var version = Unmarshall(["w", "s"], buffer, state);
      dbg_log("[version]: msize=" + version[0] + " version=" + version[1], LOG_9P);
      if (this.msize !== version[0]) {
        this.msize = version[0];
        this.replybuffer = new Uint8Array(Math.min(MAX_REPLYBUFFER_SIZE, this.msize * 2));
      }
      size = Marshall(["w", "s"], [this.msize, this.VERSION], this.replybuffer, 7);
      this.BuildReply(id, tag, size);
      this.SendReply(bufchain);
      break;
    case 104:
      var req = Unmarshall(["w", "w", "s", "s", "w"], buffer, state);
      var fid = req[0];
      var uid = req[4];
      dbg_log("[attach]: fid=" + fid + " afid=" + h(req[1]) + " uname=" + req[2] + " aname=" + req[3], LOG_9P);
      this.fids[fid] = this.Createfid(0, FID_INODE, uid, "");
      var inode = this.fs.GetInode(this.fids[fid].inodeid);
      Marshall(["Q"], [inode.qid], this.replybuffer, 7);
      this.BuildReply(id, tag, 13);
      this.SendReply(bufchain);
      this.bus.send("9p-attach");
      break;
    case 108:
      var req = Unmarshall(["h"], buffer, state);
      var oldtag = req[0];
      dbg_log("[flush] " + tag, LOG_9P);
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 110:
      var req = Unmarshall(["w", "w", "h"], buffer, state);
      var fid = req[0];
      var nwfid = req[1];
      var nwname = req[2];
      dbg_log("[walk]: fid=" + req[0] + " nwfid=" + req[1] + " nwname=" + nwname, LOG_9P);
      if (nwname === 0) {
        this.fids[nwfid] = this.Createfid(this.fids[fid].inodeid, FID_INODE, this.fids[fid].uid, this.fids[fid].dbg_name);
        Marshall(["h"], [0], this.replybuffer, 7);
        this.BuildReply(id, tag, 2);
        this.SendReply(bufchain);
        break;
      }
      var wnames = [];
      for (var i = 0; i < nwname; i++) {
        wnames.push("s");
      }
      var walk = Unmarshall(wnames, buffer, state);
      var idx = this.fids[fid].inodeid;
      var offset = 7 + 2;
      var nwidx = 0;
      dbg_log("walk in dir " + this.fids[fid].dbg_name + " to: " + walk.toString(), LOG_9P);
      for (var i = 0; i < nwname; i++) {
        idx = this.fs.Search(idx, walk[i]);
        if (idx === -1) {
          dbg_log("Could not find: " + walk[i], LOG_9P);
          break;
        }
        offset += Marshall(["Q"], [this.fs.GetInode(idx).qid], this.replybuffer, offset);
        nwidx++;
        this.fids[nwfid] = this.Createfid(idx, FID_INODE, this.fids[fid].uid, walk[i]);
      }
      Marshall(["h"], [nwidx], this.replybuffer, 7);
      this.BuildReply(id, tag, offset - 7);
      this.SendReply(bufchain);
      break;
    case 120:
      var req = Unmarshall(["w"], buffer, state);
      dbg_log("[clunk]: fid=" + req[0], LOG_9P);
      if (this.fids[req[0]] && this.fids[req[0]].inodeid >= 0) {
        await this.fs.CloseInode(this.fids[req[0]].inodeid);
        this.fids[req[0]].inodeid = -1;
        this.fids[req[0]].type = FID_NONE;
      }
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 32:
      var req = Unmarshall(["w", "s", "d", "w"], buffer, state);
      var fid = req[0];
      var name = req[1];
      var attr_size = req[2];
      var flags = req[3];
      dbg_log("[txattrcreate]: fid=" + fid + " name=" + name + " attr_size=" + attr_size + " flags=" + flags, LOG_9P);
      this.fids[fid].type = FID_XATTR;
      this.BuildReply(id, tag, 0);
      this.SendReply(bufchain);
      break;
    case 30:
      var req = Unmarshall(["w", "w", "s"], buffer, state);
      var fid = req[0];
      var newfid = req[1];
      var name = req[2];
      dbg_log("[xattrwalk]: fid=" + req[0] + " newfid=" + req[1] + " name=" + req[2], LOG_9P);
      this.SendError(tag, "Setxattr not supported", EOPNOTSUPP);
      this.SendReply(bufchain);
      break;
    default:
      dbg_log("Error in Virtio9p: Unknown id " + id + " received", LOG_9P);
      dbg_assert(false);
      break;
  }
};
function Virtio9pHandler(handle_fn, cpu) {
  this.handle_fn = handle_fn;
  this.tag_bufchain = /* @__PURE__ */ new Map();
  this.configspace_tagname = [104, 111, 115, 116, 57, 112];
  this.configspace_taglen = this.configspace_tagname.length;
  this.virtio = init_virtio(
    cpu,
    this.configspace_taglen,
    this.configspace_tagname,
    async (bufchain) => {
      const reqbuf = new Uint8Array(bufchain.length_readable);
      bufchain.get_next_blob(reqbuf);
      var reqheader = Unmarshall(["w", "b", "h"], reqbuf, { offset: 0 });
      var reqtag = reqheader[2];
      this.tag_bufchain.set(reqtag, bufchain);
      this.handle_fn(reqbuf, (replybuf) => {
        var replyheader = Unmarshall(["w", "b", "h"], replybuf, { offset: 0 });
        var replytag = replyheader[2];
        const bufchain2 = this.tag_bufchain.get(replytag);
        if (!bufchain2) {
          console.error("No bufchain found for tag: " + replytag);
          return;
        }
        bufchain2.set_next_blob(replybuf);
        this.virtqueue.push_reply(bufchain2);
        this.virtqueue.flush_replies();
        this.tag_bufchain.delete(replytag);
      });
    }
  );
  this.virtqueue = this.virtio.queues[0];
}
Virtio9pHandler.prototype.get_state = function() {
  var state = [];
  state[0] = this.configspace_tagname;
  state[1] = this.configspace_taglen;
  state[2] = this.virtio;
  state[3] = this.tag_bufchain;
  return state;
};
Virtio9pHandler.prototype.set_state = function(state) {
  this.configspace_tagname = state[0];
  this.configspace_taglen = state[1];
  this.virtio.set_state(state[2]);
  this.virtqueue = this.virtio.queues[0];
  this.tag_bufchain = state[3];
};
Virtio9pHandler.prototype.reset = function() {
  this.virtio.reset();
};
function Virtio9pProxy(url, cpu) {
  this.socket = void 0;
  this.cpu = cpu;
  this.send_queue = [];
  this.url = url;
  this.reconnect_interval = 1e4;
  this.last_connect_attempt = Date.now() - this.reconnect_interval;
  this.send_queue_limit = 64;
  this.destroyed = false;
  this.tag_bufchain = /* @__PURE__ */ new Map();
  this.configspace_tagname = [104, 111, 115, 116, 57, 112];
  this.configspace_taglen = this.configspace_tagname.length;
  this.virtio = init_virtio(
    cpu,
    this.configspace_taglen,
    this.configspace_tagname,
    async (bufchain) => {
      const reqbuf = new Uint8Array(bufchain.length_readable);
      bufchain.get_next_blob(reqbuf);
      const reqheader = Unmarshall(["w", "b", "h"], reqbuf, { offset: 0 });
      const reqtag = reqheader[2];
      this.tag_bufchain.set(reqtag, bufchain);
      this.send(reqbuf);
    }
  );
  this.virtqueue = this.virtio.queues[0];
}
Virtio9pProxy.prototype.get_state = function() {
  var state = [];
  state[0] = this.configspace_tagname;
  state[1] = this.configspace_taglen;
  state[2] = this.virtio;
  state[3] = this.tag_bufchain;
  return state;
};
Virtio9pProxy.prototype.set_state = function(state) {
  this.configspace_tagname = state[0];
  this.configspace_taglen = state[1];
  this.virtio.set_state(state[2]);
  this.virtqueue = this.virtio.queues[0];
  this.tag_bufchain = state[3];
};
Virtio9pProxy.prototype.reset = function() {
  this.virtio.reset();
};
Virtio9pProxy.prototype.handle_message = function(e) {
  const replybuf = new Uint8Array(e.data);
  const replyheader = Unmarshall(["w", "b", "h"], replybuf, { offset: 0 });
  const replytag = replyheader[2];
  const bufchain = this.tag_bufchain.get(replytag);
  if (!bufchain) {
    console.error("Virtio9pProxy: No bufchain found for tag: " + replytag);
    return;
  }
  bufchain.set_next_blob(replybuf);
  this.virtqueue.push_reply(bufchain);
  this.virtqueue.flush_replies();
  this.tag_bufchain.delete(replytag);
};
Virtio9pProxy.prototype.handle_close = function(e) {
  if (!this.destroyed) {
    this.connect();
    setTimeout(this.connect.bind(this), this.reconnect_interval);
  }
};
Virtio9pProxy.prototype.handle_open = function(e) {
  for (var i = 0; i < this.send_queue.length; i++) {
    this.send(this.send_queue[i]);
  }
  this.send_queue = [];
};
Virtio9pProxy.prototype.handle_error = function(e) {
};
Virtio9pProxy.prototype.destroy = function() {
  this.destroyed = true;
  if (this.socket) {
    this.socket.close();
  }
};
Virtio9pProxy.prototype.connect = function() {
  if (typeof WebSocket === "undefined") {
    return;
  }
  if (this.socket) {
    var state = this.socket.readyState;
    if (state === 0 || state === 1) {
      return;
    }
  }
  var now = Date.now();
  if (this.last_connect_attempt + this.reconnect_interval > now) {
    return;
  }
  this.last_connect_attempt = Date.now();
  try {
    this.socket = new WebSocket(this.url);
  } catch (e) {
    console.error(e);
    return;
  }
  this.socket.binaryType = "arraybuffer";
  this.socket.onopen = this.handle_open.bind(this);
  this.socket.onmessage = this.handle_message.bind(this);
  this.socket.onclose = this.handle_close.bind(this);
  this.socket.onerror = this.handle_error.bind(this);
};
Virtio9pProxy.prototype.send = function(data) {
  if (!this.socket || this.socket.readyState !== 1) {
    this.send_queue.push(data);
    if (this.send_queue.length > 2 * this.send_queue_limit) {
      this.send_queue = this.send_queue.slice(-this.send_queue_limit);
    }
    this.connect();
  } else {
    this.socket.send(data);
  }
};
Virtio9pProxy.prototype.change_proxy = function(url) {
  this.url = url;
  if (this.socket) {
    this.socket.onclose = function() {
    };
    this.socket.onerror = function() {
    };
    this.socket.close();
    this.socket = void 0;
  }
};

// src/kernel.js
var LINUX_BOOT_HDR_SETUP_SECTS = 497;
var LINUX_BOOT_HDR_SYSSIZE = 500;
var LINUX_BOOT_HDR_VIDMODE = 506;
var LINUX_BOOT_HDR_BOOT_FLAG = 510;
var LINUX_BOOT_HDR_HEADER = 514;
var LINUX_BOOT_HDR_VERSION = 518;
var LINUX_BOOT_HDR_TYPE_OF_LOADER = 528;
var LINUX_BOOT_HDR_LOADFLAGS = 529;
var LINUX_BOOT_HDR_CODE32_START = 532;
var LINUX_BOOT_HDR_RAMDISK_IMAGE = 536;
var LINUX_BOOT_HDR_RAMDISK_SIZE = 540;
var LINUX_BOOT_HDR_HEAP_END_PTR = 548;
var LINUX_BOOT_HDR_CMD_LINE_PTR = 552;
var LINUX_BOOT_HDR_INITRD_ADDR_MAX = 556;
var LINUX_BOOT_HDR_KERNEL_ALIGNMENT = 560;
var LINUX_BOOT_HDR_RELOCATABLE_KERNEL = 564;
var LINUX_BOOT_HDR_MIN_ALIGNMENT = 565;
var LINUX_BOOT_HDR_XLOADFLAGS = 566;
var LINUX_BOOT_HDR_CMDLINE_SIZE = 568;
var LINUX_BOOT_HDR_PAYLOAD_OFFSET = 584;
var LINUX_BOOT_HDR_PAYLOAD_LENGTH = 588;
var LINUX_BOOT_HDR_PREF_ADDRESS = 600;
var LINUX_BOOT_HDR_INIT_SIZE = 608;
var LINUX_BOOT_HDR_CHECKSUM1 = 43605;
var LINUX_BOOT_HDR_CHECKSUM2 = 1400005704;
var LINUX_BOOT_HDR_TYPE_OF_LOADER_NOT_ASSIGNED = 255;
var LINUX_BOOT_HDR_LOADFLAGS_LOADED_HIGH = 1 << 0;
var LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG = 1 << 5;
var LINUX_BOOT_HDR_LOADFLAGS_KEEP_SEGMENTS = 1 << 6;
var LINUX_BOOT_HDR_LOADFLAGS_CAN_USE_HEAPS = 1 << 7;
function load_kernel(mem8, bzimage, initrd, cmdline) {
  dbg_log("Trying to load kernel of size " + bzimage.byteLength);
  const KERNEL_HIGH_ADDRESS = 1048576;
  const INITRD_ADDRESS = 64 << 20;
  const quiet = false;
  const bzimage8 = new Uint8Array(bzimage);
  const bzimage16 = new Uint16Array(bzimage);
  const bzimage32 = new Uint32Array(bzimage);
  const setup_sects = bzimage8[LINUX_BOOT_HDR_SETUP_SECTS] || 4;
  const syssize = bzimage32[LINUX_BOOT_HDR_SYSSIZE >> 2] << 4;
  const vidmode = bzimage16[LINUX_BOOT_HDR_VIDMODE >> 1];
  const checksum1 = bzimage16[LINUX_BOOT_HDR_BOOT_FLAG >> 1];
  if (checksum1 !== LINUX_BOOT_HDR_CHECKSUM1) {
    dbg_log("Bad checksum1: " + h(checksum1));
    return;
  }
  const checksum2 = bzimage16[LINUX_BOOT_HDR_HEADER >> 1] | bzimage16[LINUX_BOOT_HDR_HEADER + 2 >> 1] << 16;
  if (checksum2 !== LINUX_BOOT_HDR_CHECKSUM2) {
    dbg_log("Bad checksum2: " + h(checksum2));
    return;
  }
  const protocol = bzimage16[LINUX_BOOT_HDR_VERSION >> 1];
  dbg_assert(protocol >= 514);
  const flags = bzimage8[LINUX_BOOT_HDR_LOADFLAGS];
  dbg_assert(flags & LINUX_BOOT_HDR_LOADFLAGS_LOADED_HIGH);
  const flags2 = bzimage16[LINUX_BOOT_HDR_XLOADFLAGS >> 1];
  const initrd_addr_max = bzimage32[LINUX_BOOT_HDR_INITRD_ADDR_MAX >> 2];
  const kernel_alignment = bzimage32[LINUX_BOOT_HDR_KERNEL_ALIGNMENT >> 2];
  const relocatable_kernel = bzimage8[LINUX_BOOT_HDR_RELOCATABLE_KERNEL];
  const min_alignment = bzimage8[LINUX_BOOT_HDR_MIN_ALIGNMENT];
  const cmdline_size = protocol >= 518 ? bzimage32[LINUX_BOOT_HDR_CMDLINE_SIZE >> 2] : 255;
  const payload_offset = bzimage32[LINUX_BOOT_HDR_PAYLOAD_OFFSET >> 2];
  const payload_length = bzimage32[LINUX_BOOT_HDR_PAYLOAD_LENGTH >> 2];
  const pref_address = bzimage32[LINUX_BOOT_HDR_PREF_ADDRESS >> 2];
  const pref_address_high = bzimage32[LINUX_BOOT_HDR_PREF_ADDRESS + 4 >> 2];
  const init_size = bzimage32[LINUX_BOOT_HDR_INIT_SIZE >> 2];
  dbg_log("kernel boot protocol version: " + h(protocol));
  dbg_log("flags=" + h(flags) + " xflags=" + h(flags2));
  dbg_log("code32_start=" + h(bzimage32[LINUX_BOOT_HDR_CODE32_START >> 2]));
  dbg_log("initrd_addr_max=" + h(initrd_addr_max));
  dbg_log("kernel_alignment=" + h(kernel_alignment));
  dbg_log("relocatable=" + relocatable_kernel);
  dbg_log("min_alignment=" + h(min_alignment));
  dbg_log("cmdline max=" + h(cmdline_size));
  dbg_log("payload offset=" + h(payload_offset) + " size=" + h(payload_length));
  dbg_log("pref_address=" + h(pref_address_high) + ":" + h(pref_address));
  dbg_log("init_size=" + h(init_size));
  const real_mode_segment = 32768;
  const base_ptr = real_mode_segment << 4;
  const heap_end = 57344;
  const heap_end_ptr = heap_end - 512;
  bzimage8[LINUX_BOOT_HDR_TYPE_OF_LOADER] = LINUX_BOOT_HDR_TYPE_OF_LOADER_NOT_ASSIGNED;
  const new_flags = (quiet ? flags | LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG : flags & ~LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG) & ~LINUX_BOOT_HDR_LOADFLAGS_KEEP_SEGMENTS | LINUX_BOOT_HDR_LOADFLAGS_CAN_USE_HEAPS;
  bzimage8[LINUX_BOOT_HDR_LOADFLAGS] = new_flags;
  bzimage16[LINUX_BOOT_HDR_HEAP_END_PTR >> 1] = heap_end_ptr;
  bzimage16[LINUX_BOOT_HDR_VIDMODE >> 1] = 65535;
  dbg_log("heap_end_ptr=" + h(heap_end_ptr));
  cmdline += "\0";
  dbg_assert(cmdline.length < cmdline_size);
  const cmd_line_ptr = base_ptr + heap_end;
  dbg_log("cmd_line_ptr=" + h(cmd_line_ptr));
  bzimage32[LINUX_BOOT_HDR_CMD_LINE_PTR >> 2] = cmd_line_ptr;
  for (let i = 0; i < cmdline.length; i++) {
    mem8[cmd_line_ptr + i] = cmdline.charCodeAt(i);
  }
  const prot_mode_kernel_start = (setup_sects + 1) * 512;
  dbg_log("prot_mode_kernel_start=" + h(prot_mode_kernel_start));
  const real_mode_kernel = new Uint8Array(bzimage, 0, prot_mode_kernel_start);
  const protected_mode_kernel = new Uint8Array(bzimage, prot_mode_kernel_start);
  let ramdisk_address = 0;
  let ramdisk_size = 0;
  if (initrd) {
    ramdisk_address = INITRD_ADDRESS;
    ramdisk_size = initrd.byteLength;
    dbg_assert(KERNEL_HIGH_ADDRESS + protected_mode_kernel.length < ramdisk_address);
    mem8.set(new Uint8Array(initrd), ramdisk_address);
  }
  bzimage32[LINUX_BOOT_HDR_RAMDISK_IMAGE >> 2] = ramdisk_address;
  bzimage32[LINUX_BOOT_HDR_RAMDISK_SIZE >> 2] = ramdisk_size;
  dbg_assert(base_ptr + real_mode_kernel.length < 655360);
  mem8.set(real_mode_kernel, base_ptr);
  mem8.set(protected_mode_kernel, KERNEL_HIGH_ADDRESS);
  return {
    name: "genroms/kernel.bin",
    data: make_linux_boot_rom(real_mode_segment, heap_end)
  };
}
function make_linux_boot_rom(real_mode_segment, heap_end) {
  const SIZE = 512;
  const data8 = new Uint8Array(SIZE);
  const data16 = new Uint16Array(data8.buffer);
  data16[0] = 43605;
  data8[2] = SIZE / 512;
  let i = 3;
  data8[i++] = 250;
  data8[i++] = 184;
  data8[i++] = real_mode_segment >> 0;
  data8[i++] = real_mode_segment >> 8;
  data8[i++] = 142;
  data8[i++] = 192;
  data8[i++] = 142;
  data8[i++] = 216;
  data8[i++] = 142;
  data8[i++] = 224;
  data8[i++] = 142;
  data8[i++] = 232;
  data8[i++] = 142;
  data8[i++] = 208;
  data8[i++] = 188;
  data8[i++] = heap_end >> 0;
  data8[i++] = heap_end >> 8;
  data8[i++] = 234;
  data8[i++] = 0;
  data8[i++] = 0;
  data8[i++] = real_mode_segment + 32 >> 0;
  data8[i++] = real_mode_segment + 32 >> 8;
  dbg_assert(i < SIZE);
  const checksum_index = i;
  data8[checksum_index] = 0;
  let checksum = 0;
  for (let i2 = 0; i2 < data8.length; i2++) {
    checksum += data8[i2];
  }
  data8[checksum_index] = -checksum;
  return data8;
}

// src/cpu.js
function CPU(bus, wm, stop_idling) {
  this.stop_idling = stop_idling;
  this.wm = wm;
  this.wasm_patch();
  this.create_jit_imports();
  const memory = this.wm.exports.memory;
  this.wasm_memory = memory;
  this.memory_size = view(Uint32Array, memory, 812, 1);
  this.wasm_logical_memory_size = view(Uint32Array, memory, 1132, 1);
  this.mem8 = new Uint8Array(0);
  this.mem32s = new Int32Array(this.mem8.buffer);
  this.segment_is_null = view(Uint8Array, memory, 724, 8);
  this.segment_offsets = view(Int32Array, memory, 736, 8);
  this.segment_limits = view(Uint32Array, memory, 768, 8);
  this.segment_access_bytes = view(Uint8Array, memory, 512, 8);
  this.protected_mode = view(Int32Array, memory, 800, 1);
  this.idtr_size = view(Int32Array, memory, 564, 1);
  this.idtr_offset = view(Int32Array, memory, 568, 1);
  this.gdtr_size = view(Int32Array, memory, 572, 1);
  this.gdtr_offset = view(Int32Array, memory, 576, 1);
  this.tss_size_32 = view(Int32Array, memory, 1128, 1);
  this.page_fault = view(Uint32Array, memory, 540, 8);
  this.cr = view(Int32Array, memory, 580, 8);
  this.cpl = view(Uint8Array, memory, 612, 1);
  this.is_32 = view(Int32Array, memory, 804, 1);
  this.stack_size_32 = view(Int32Array, memory, 808, 1);
  this.in_hlt = view(Uint8Array, memory, 616, 1);
  this.last_virt_eip = view(Int32Array, memory, 620, 1);
  this.eip_phys = view(Int32Array, memory, 624, 1);
  this.sysenter_cs = view(Int32Array, memory, 636, 1);
  this.sysenter_esp = view(Int32Array, memory, 640, 1);
  this.sysenter_eip = view(Int32Array, memory, 644, 1);
  this.prefixes = view(Int32Array, memory, 648, 1);
  this.flags = view(Int32Array, memory, 120, 1);
  this.flags_changed = view(Int32Array, memory, 100, 1);
  this.last_op_size = view(Int32Array, memory, 96, 1);
  this.last_op1 = view(Int32Array, memory, 104, 1);
  this.last_result = view(Int32Array, memory, 112, 1);
  this.current_tsc = view(Uint32Array, memory, 960, 2);
  this.devices = {};
  this.instruction_pointer = view(Int32Array, memory, 556, 1);
  this.previous_ip = view(Int32Array, memory, 560, 1);
  this.apic_enabled = view(Uint8Array, memory, 548, 1);
  this.acpi_enabled = view(Uint8Array, memory, 552, 1);
  this.memory_map_read8 = [];
  this.memory_map_write8 = [];
  this.memory_map_read32 = [];
  this.memory_map_write32 = [];
  this.bios = {
    main: null,
    vga: null
  };
  this.instruction_counter = view(Uint32Array, memory, 664, 1);
  this.reg32 = view(Int32Array, memory, 64, 8);
  this.fpu_st = view(Int32Array, memory, 1152, 4 * 8);
  this.fpu_stack_empty = view(Uint8Array, memory, 816, 1);
  this.fpu_stack_empty[0] = 255;
  this.fpu_stack_ptr = view(Uint8Array, memory, 1032, 1);
  this.fpu_stack_ptr[0] = 0;
  this.fpu_control_word = view(Uint16Array, memory, 1036, 1);
  this.fpu_control_word[0] = 895;
  this.fpu_status_word = view(Uint16Array, memory, 1040, 1);
  this.fpu_status_word[0] = 0;
  this.fpu_ip = view(Int32Array, memory, 1048, 1);
  this.fpu_ip[0] = 0;
  this.fpu_ip_selector = view(Int32Array, memory, 1052, 1);
  this.fpu_ip_selector[0] = 0;
  this.fpu_opcode = view(Int32Array, memory, 1044, 1);
  this.fpu_opcode[0] = 0;
  this.fpu_dp = view(Int32Array, memory, 1056, 1);
  this.fpu_dp[0] = 0;
  this.fpu_dp_selector = view(Int32Array, memory, 1060, 1);
  this.fpu_dp_selector[0] = 0;
  this.reg_xmm32s = view(Int32Array, memory, 832, 8 * 4);
  this.mxcsr = view(Int32Array, memory, 824, 1);
  this.sreg = view(Uint16Array, memory, 668, 8);
  this.dreg = view(Int32Array, memory, 684, 8);
  this.reg_pdpte = view(Int32Array, memory, 968, 8);
  this.svga_dirty_bitmap_min_offset = view(Uint32Array, memory, 716, 1);
  this.svga_dirty_bitmap_max_offset = view(Uint32Array, memory, 720, 1);
  this.fw_value = [];
  this.fw_pointer = 0;
  this.option_roms = [];
  this.io = void 0;
  this.bus = bus;
  this.set_tsc(0, 0);
  if (false) {
    this.seen_code = {};
    this.seen_code_uncompiled = {};
  }
}
CPU.prototype.mmap_read8 = function(addr) {
  const value = this.memory_map_read8[addr >>> MMAP_BLOCK_BITS](addr);
  dbg_assert(value >= 0 && value <= 255);
  return value;
};
CPU.prototype.mmap_write8 = function(addr, value) {
  dbg_assert(value >= 0 && value <= 255);
  this.memory_map_write8[addr >>> MMAP_BLOCK_BITS](addr, value);
};
CPU.prototype.mmap_write16 = function(addr, value) {
  var fn = this.memory_map_write8[addr >>> MMAP_BLOCK_BITS];
  dbg_assert(value >= 0 && value <= 65535);
  fn(addr, value & 255);
  fn(addr + 1 | 0, value >> 8);
};
CPU.prototype.mmap_read32 = function(addr) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  return this.memory_map_read32[aligned_addr](addr);
};
CPU.prototype.mmap_write32 = function(addr, value) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  this.memory_map_write32[aligned_addr](addr, value);
};
CPU.prototype.mmap_write64 = function(addr, value0, value1) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  dbg_assert(aligned_addr === addr + 7 >>> MMAP_BLOCK_BITS);
  var write_func32 = this.memory_map_write32[aligned_addr];
  write_func32(addr, value0);
  write_func32(addr + 4, value1);
};
CPU.prototype.mmap_write128 = function(addr, value0, value1, value2, value3) {
  var aligned_addr = addr >>> MMAP_BLOCK_BITS;
  dbg_assert(aligned_addr === addr + 12 >>> MMAP_BLOCK_BITS);
  var write_func32 = this.memory_map_write32[aligned_addr];
  write_func32(addr, value0);
  write_func32(addr + 4, value1);
  write_func32(addr + 8, value2);
  write_func32(addr + 12, value3);
};
CPU.prototype.swap_page_in = function(gpa, for_writing) {
  if (this._swap_page_in_hook) {
    return this._swap_page_in_hook(gpa, for_writing) | 0;
  }
  return -1;
};
CPU.prototype.write_blob = function(blob, offset) {
  dbg_assert(blob && blob.length >= 0);
  if (blob.length) {
    dbg_assert(!this.in_mapped_range(offset));
    dbg_assert(!this.in_mapped_range(offset + blob.length - 1));
    this.jit_dirty_cache(offset, offset + blob.length);
    this.mem8.set(blob, offset);
  }
};
CPU.prototype.read_blob = function(offset, length) {
  if (length) {
    dbg_assert(!this.in_mapped_range(offset));
    dbg_assert(!this.in_mapped_range(offset + length - 1));
  }
  return this.mem8.subarray(offset, offset + length);
};
CPU.prototype.clear_opstats = function() {
  new Uint8Array(this.wasm_memory.buffer, 32768, 131072).fill(0);
  this.wm.exports["profiler_init"]();
};
CPU.prototype.create_jit_imports = function() {
  const jit_imports = /* @__PURE__ */ Object.create(null);
  jit_imports["m"] = this.wm.exports["memory"];
  for (const name of Object.keys(this.wm.exports)) {
    if (name.startsWith("_") || name.startsWith("zstd") || name.endsWith("_js")) {
      continue;
    }
    jit_imports[name] = this.wm.exports[name];
  }
  this.jit_imports = jit_imports;
};
CPU.prototype.wasm_patch = function() {
  const get_optional_import = (name) => this.wm.exports[name];
  const get_import = (name) => {
    const f = get_optional_import(name);
    console.assert(f, "Missing import: " + name);
    return f;
  };
  this.reset_cpu = get_import("reset_cpu");
  this.getiopl = get_import("getiopl");
  this.get_eflags = get_import("get_eflags");
  this.handle_irqs = get_import("handle_irqs");
  this.main_loop = get_import("main_loop");
  this.set_jit_config = get_import("set_jit_config");
  this.read8 = get_import("read8");
  this.read16 = get_import("read16");
  this.read32s = get_import("read32s");
  this.write8 = get_import("write8");
  this.write16 = get_import("write16");
  this.write32 = get_import("write32");
  this.in_mapped_range = get_import("in_mapped_range");
  this.fpu_load_tag_word = get_import("fpu_load_tag_word");
  this.fpu_load_status_word = get_import("fpu_load_status_word");
  this.fpu_get_sti_f64 = get_import("fpu_get_sti_f64");
  this.translate_address_system_read = get_import("translate_address_system_read_js");
  this.get_seg_cs = get_import("get_seg_cs");
  this.get_real_eip = get_import("get_real_eip");
  this.clear_tlb = get_import("clear_tlb");
  this.full_clear_tlb = get_import("full_clear_tlb");
  this.update_state_flags = get_import("update_state_flags");
  this.set_tsc = get_import("set_tsc");
  this.store_current_tsc = get_import("store_current_tsc");
  this.set_cpuid_level = get_import("set_cpuid_level");
  this.device_raise_irq = get_import("device_raise_irq");
  this.device_lower_irq = get_import("device_lower_irq");
  this.apic_timer = get_import("apic_timer");
  if (false) {
    this.jit_force_generate_unsafe = get_optional_import("jit_force_generate_unsafe");
  }
  this.jit_clear_cache = get_import("jit_clear_cache_js");
  this.jit_dirty_cache = get_import("jit_dirty_cache");
  this.codegen_finalize_finished = get_import("codegen_finalize_finished");
  this.allocate_memory = get_import("allocate_memory");
  this.zero_memory = get_import("zero_memory");
  this.is_memory_zeroed = get_import("is_memory_zeroed");
  this.svga_allocate_memory = get_import("svga_allocate_memory");
  this.svga_allocate_dest_buffer = get_import("svga_allocate_dest_buffer");
  this.svga_fill_pixel_buffer = get_import("svga_fill_pixel_buffer");
  this.svga_mark_dirty = get_import("svga_mark_dirty");
  this.get_pic_addr_master = get_import("get_pic_addr_master");
  this.get_pic_addr_slave = get_import("get_pic_addr_slave");
  this.get_apic_addr = get_import("get_apic_addr");
  this.get_ioapic_addr = get_import("get_ioapic_addr");
  this.zstd_create_ctx = get_import("zstd_create_ctx");
  this.zstd_get_src_ptr = get_import("zstd_get_src_ptr");
  this.zstd_free_ctx = get_import("zstd_free_ctx");
  this.zstd_read = get_import("zstd_read");
  this.zstd_read_free = get_import("zstd_read_free");
  this.smp_init = get_optional_import("smp_init");
  this.smp_cpu_loop = get_optional_import("smp_cpu_loop");
  this.smp_is_enabled = get_optional_import("smp_is_enabled");
  this.smp_cpu_count = get_optional_import("smp_cpu_count");
  this.smp_start_ap = get_optional_import("smp_start_ap");
  this.apic_mmio_read = get_optional_import("apic_mmio_read");
  this.apic_mmio_write = get_optional_import("apic_mmio_write");
  this.ioapic_mmio_read = get_optional_import("ioapic_mmio_read");
  this.ioapic_mmio_write = get_optional_import("ioapic_mmio_write");
  this.ioapic_set_irq = get_optional_import("ioapic_set_irq");
  this.set_current_cpu_id = get_optional_import("set_current_cpu_id");
};
CPU.prototype.jit_force_generate = function(addr) {
  if (!this.jit_force_generate_unsafe) {
    dbg_assert(false, "Not supported in this wasm build: jit_force_generate_unsafe");
    return;
  }
  this.jit_force_generate_unsafe(addr);
};
CPU.prototype.jit_clear_func = function(index) {
  dbg_assert(index >= 0 && index < WASM_TABLE_SIZE);
  this.wm.wasm_table.set(index + WASM_TABLE_OFFSET, null);
};
CPU.prototype.jit_clear_all_funcs = function() {
  const table = this.wm.wasm_table;
  for (let i = 0; i < WASM_TABLE_SIZE; i++) {
    table.set(WASM_TABLE_OFFSET + i, null);
  }
};
CPU.prototype.get_state = function() {
  var state = [];
  state[0] = this.memory_size[0];
  state[1] = new Uint8Array([...this.segment_is_null, ...this.segment_access_bytes]);
  state[2] = this.segment_offsets;
  state[3] = this.segment_limits;
  state[4] = this.protected_mode[0];
  state[5] = this.idtr_offset[0];
  state[6] = this.idtr_size[0];
  state[7] = this.gdtr_offset[0];
  state[8] = this.gdtr_size[0];
  state[9] = this.page_fault[0];
  state[10] = this.cr;
  state[11] = this.cpl[0];
  state[13] = this.is_32[0];
  state[16] = this.stack_size_32[0];
  state[17] = this.in_hlt[0];
  state[18] = this.last_virt_eip[0];
  state[19] = this.eip_phys[0];
  state[22] = this.sysenter_cs[0];
  state[23] = this.sysenter_eip[0];
  state[24] = this.sysenter_esp[0];
  state[25] = this.prefixes[0];
  state[26] = this.flags[0];
  state[27] = this.flags_changed[0];
  state[28] = this.last_op1[0];
  state[30] = this.last_op_size[0];
  state[37] = this.instruction_pointer[0];
  state[38] = this.previous_ip[0];
  state[39] = this.reg32;
  state[40] = this.sreg;
  state[41] = this.dreg;
  state[42] = this.reg_pdpte;
  this.store_current_tsc();
  state[43] = this.current_tsc;
  state[45] = this.devices.virtio_9p;
  state[46] = this.get_state_apic();
  state[47] = this.devices.rtc;
  state[48] = this.devices.pci;
  state[49] = this.devices.dma;
  state[50] = this.devices.acpi;
  state[52] = this.devices.vga;
  state[53] = this.devices.ps2;
  state[54] = this.devices.uart0;
  state[55] = this.devices.fdc;
  if (!this.devices.ide.secondary) {
    if (this.devices.ide.primary?.master.is_atapi) {
      state[56] = this.devices.ide.primary;
    } else {
      state[57] = this.devices.ide.primary;
    }
  } else {
    state[85] = this.devices.ide;
  }
  state[58] = this.devices.pit;
  state[59] = this.devices.net;
  state[60] = this.get_state_pic();
  state[61] = this.devices.sb16;
  state[62] = this.fw_value;
  state[63] = this.get_state_ioapic();
  state[64] = this.tss_size_32[0];
  state[66] = this.reg_xmm32s;
  state[67] = this.fpu_st;
  state[68] = this.fpu_stack_empty[0];
  state[69] = this.fpu_stack_ptr[0];
  state[70] = this.fpu_control_word[0];
  state[71] = this.fpu_ip[0];
  state[72] = this.fpu_ip_selector[0];
  state[73] = this.fpu_dp[0];
  state[74] = this.fpu_dp_selector[0];
  state[75] = this.fpu_opcode[0];
  const { packed_memory, bitmap } = this.pack_memory();
  state[77] = packed_memory;
  state[78] = new Uint8Array(bitmap.get_buffer());
  state[79] = this.devices.uart1;
  state[80] = this.devices.uart2;
  state[81] = this.devices.uart3;
  state[82] = this.devices.virtio_console;
  state[83] = this.devices.virtio_net;
  state[84] = this.devices.virtio_balloon;
  state[86] = this.last_result;
  state[87] = this.fpu_status_word;
  state[88] = this.mxcsr;
  state[89] = this.devices.ahci;
  return state;
};
CPU.prototype.get_state_pic = function() {
  const pic_size = 13;
  const pic = new Uint8Array(this.wasm_memory.buffer, this.get_pic_addr_master(), pic_size);
  const pic_slave = new Uint8Array(this.wasm_memory.buffer, this.get_pic_addr_slave(), pic_size);
  const state = [];
  const state_slave = [];
  state[0] = pic[0];
  state[1] = pic[1];
  state[2] = pic[2];
  state[3] = pic[3];
  state[4] = pic[4];
  state[5] = state_slave;
  state[6] = pic[6];
  state[7] = pic[7];
  state[8] = pic[8];
  state[9] = pic[9];
  state[10] = pic[10];
  state[11] = pic[11];
  state[12] = pic[12];
  state_slave[0] = pic_slave[0];
  state_slave[1] = pic_slave[1];
  state_slave[2] = pic_slave[2];
  state_slave[3] = pic_slave[3];
  state_slave[4] = pic_slave[4];
  state_slave[5] = null;
  state_slave[6] = pic_slave[6];
  state_slave[7] = pic_slave[7];
  state_slave[8] = pic_slave[8];
  state_slave[9] = pic_slave[9];
  state_slave[10] = pic_slave[10];
  state_slave[11] = pic_slave[11];
  state_slave[12] = pic_slave[12];
  return state;
};
CPU.prototype.get_state_apic = function() {
  const APIC_STRUCT_SIZE = 4 * 46;
  return new Uint8Array(this.wasm_memory.buffer, this.get_apic_addr(), APIC_STRUCT_SIZE);
};
CPU.prototype.get_state_ioapic = function() {
  const IOAPIC_STRUCT_SIZE = 4 * 52;
  return new Uint8Array(this.wasm_memory.buffer, this.get_ioapic_addr(), IOAPIC_STRUCT_SIZE);
};
CPU.prototype.set_state = function(state) {
  this.memory_size[0] = state[0];
  if (this.mem8.length !== this.memory_size[0]) {
    console.warn("Note: Memory size mismatch. we=" + this.mem8.length + " state=" + this.memory_size[0]);
  }
  if (state[1].length === 8) {
    this.segment_is_null.set(state[1]);
    this.segment_access_bytes.fill(128 | 3 << 5 | 16 | 2);
    this.segment_access_bytes[REG_CS] = 128 | 3 << 5 | 16 | 8 | 2;
  } else if (state[1].length === 16) {
    this.segment_is_null.set(state[1].subarray(0, 8));
    this.segment_access_bytes.set(state[1].subarray(8, 16));
  } else {
    dbg_assert("Unexpected cpu segment state length:" + state[1].length);
  }
  this.segment_offsets.set(state[2]);
  this.segment_limits.set(state[3]);
  this.protected_mode[0] = state[4];
  this.idtr_offset[0] = state[5];
  this.idtr_size[0] = state[6];
  this.gdtr_offset[0] = state[7];
  this.gdtr_size[0] = state[8];
  this.page_fault[0] = state[9];
  this.cr.set(state[10]);
  this.cpl[0] = state[11];
  this.is_32[0] = state[13];
  this.stack_size_32[0] = state[16];
  this.in_hlt[0] = state[17];
  this.last_virt_eip[0] = state[18];
  this.eip_phys[0] = state[19];
  this.sysenter_cs[0] = state[22];
  this.sysenter_eip[0] = state[23];
  this.sysenter_esp[0] = state[24];
  this.prefixes[0] = state[25];
  this.flags[0] = state[26];
  this.flags_changed[0] = state[27];
  this.last_op1[0] = state[28];
  this.last_op_size[0] = state[30];
  this.instruction_pointer[0] = state[37];
  this.previous_ip[0] = state[38];
  this.reg32.set(state[39]);
  this.sreg.set(state[40]);
  this.dreg.set(state[41]);
  state[42] && this.reg_pdpte.set(state[42]);
  this.set_tsc(state[43][0], state[43][1]);
  this.devices.virtio_9p && this.devices.virtio_9p.set_state(state[45]);
  state[46] && this.set_state_apic(state[46]);
  this.devices.rtc && this.devices.rtc.set_state(state[47]);
  this.devices.dma && this.devices.dma.set_state(state[49]);
  this.devices.acpi && this.devices.acpi.set_state(state[50]);
  this.devices.vga && this.devices.vga.set_state(state[52]);
  this.devices.ps2 && this.devices.ps2.set_state(state[53]);
  this.devices.uart0 && this.devices.uart0.set_state(state[54]);
  this.devices.fdc && this.devices.fdc.set_state(state[55]);
  if (state[56] || state[57]) {
    const ide_config = [[void 0, void 0], [void 0, void 0]];
    if (state[56]) {
      ide_config[0][0] = { is_cdrom: true, buffer: this.devices.cdrom.buffer };
    } else {
      ide_config[0][0] = { is_cdrom: false, buffer: this.devices.ide.primary.master.buffer };
    }
    this.devices.ide = new IDEController(this, this.devices.ide.bus, ide_config);
    this.devices.cdrom = state[56] ? this.devices.ide.primary.master : void 0;
    this.devices.ide.primary.set_state(state[56] || state[57]);
  } else if (state[85]) {
    this.devices.ide.set_state(state[85]);
  }
  this.devices.pci && this.devices.pci.set_state(state[48]);
  this.devices.pit && this.devices.pit.set_state(state[58]);
  this.devices.net && this.devices.net.set_state(state[59]);
  this.set_state_pic(state[60]);
  this.devices.sb16 && this.devices.sb16.set_state(state[61]);
  this.devices.uart1 && this.devices.uart1.set_state(state[79]);
  this.devices.uart2 && this.devices.uart2.set_state(state[80]);
  this.devices.uart3 && this.devices.uart3.set_state(state[81]);
  this.devices.virtio_console && this.devices.virtio_console.set_state(state[82]);
  this.devices.virtio_net && this.devices.virtio_net.set_state(state[83]);
  this.devices.virtio_balloon && this.devices.virtio_balloon.set_state(state[84]);
  this.devices.ahci && this.devices.ahci.set_state(state[89]);
  this.fw_value = state[62];
  state[63] && this.set_state_ioapic(state[63]);
  this.tss_size_32[0] = state[64];
  this.reg_xmm32s.set(state[66]);
  this.fpu_st.set(state[67]);
  this.fpu_stack_empty[0] = state[68];
  this.fpu_stack_ptr[0] = state[69];
  this.fpu_control_word[0] = state[70];
  this.fpu_ip[0] = state[71];
  this.fpu_ip_selector[0] = state[72];
  this.fpu_dp[0] = state[73];
  this.fpu_dp_selector[0] = state[74];
  this.fpu_opcode[0] = state[75];
  if (state[86] !== void 0) this.last_result = state[86];
  if (state[87] !== void 0) this.fpu_status_word = state[87];
  if (state[88] !== void 0) this.mxcsr = state[88];
  const bitmap = new Bitmap(state[78].buffer);
  const packed_memory = state[77];
  this.unpack_memory(bitmap, packed_memory);
  this.update_state_flags();
  this.full_clear_tlb();
  this.jit_clear_cache();
};
CPU.prototype.set_state_pic = function(state) {
  const pic_size = 13;
  const pic = new Uint8Array(this.wasm_memory.buffer, this.get_pic_addr_master(), pic_size);
  const pic_slave = new Uint8Array(this.wasm_memory.buffer, this.get_pic_addr_slave(), pic_size);
  pic[0] = state[0];
  pic[1] = state[1];
  pic[2] = state[2];
  pic[3] = state[3];
  pic[4] = state[4];
  const state_slave = state[5];
  pic[6] = state[6];
  pic[7] = state[7];
  pic[8] = state[8];
  pic[9] = state[9];
  pic[10] = state[10];
  pic[11] = state[11];
  pic[12] = state[12];
  pic_slave[0] = state_slave[0];
  pic_slave[1] = state_slave[1];
  pic_slave[2] = state_slave[2];
  pic_slave[3] = state_slave[3];
  pic_slave[4] = state_slave[4];
  pic_slave[6] = state_slave[6];
  pic_slave[7] = state_slave[7];
  pic_slave[8] = state_slave[8];
  pic_slave[9] = state_slave[9];
  pic_slave[10] = state_slave[10];
  pic_slave[11] = state_slave[11];
  pic_slave[12] = state_slave[12];
};
CPU.prototype.set_state_apic = function(state) {
  const APIC_STRUCT_SIZE = 4 * 46;
  const IOAPIC_CONFIG_MASKED2 = 1 << 16;
  if (state instanceof Array) {
    const apic = new Int32Array(this.wasm_memory.buffer, this.get_apic_addr(), APIC_STRUCT_SIZE >> 2);
    apic[0] = state[0];
    apic[1] = state[1];
    apic[2] = state[2];
    apic[3] = state[3];
    apic[4] = state[4];
    apic[8] = state[6];
    apic[9] = state[7];
    apic[10] = state[8];
    apic[11] = state[9];
    apic[12] = state[10];
    apic[13] = state[11];
    apic[14] = state[12];
    apic[15] = state[13];
    apic.set(state[15], 16);
    apic.set(state[15], 24);
    apic.set(state[16], 32);
    apic[40] = state[17];
    apic[41] = state[18];
    apic[42] = state[19];
    apic[43] = state[20];
    apic[44] = state[21];
    apic[45] = state[22] || IOAPIC_CONFIG_MASKED2;
  } else {
    const apic = new Uint8Array(this.wasm_memory.buffer, this.get_apic_addr(), APIC_STRUCT_SIZE);
    dbg_assert(state instanceof Uint8Array);
    dbg_assert(state.length === apic.length);
    apic.set(state);
  }
};
CPU.prototype.set_state_ioapic = function(state) {
  const IOAPIC_STRUCT_SIZE = 4 * 52;
  if (state instanceof Array) {
    dbg_assert(state[0].length === 24);
    dbg_assert(state[1].length === 24);
    dbg_assert(state.length === 6);
    const ioapic = new Int32Array(this.wasm_memory.buffer, this.get_ioapic_addr(), IOAPIC_STRUCT_SIZE >> 2);
    ioapic.set(state[0], 0);
    ioapic.set(state[1], 24);
    ioapic[48] = state[2];
    ioapic[49] = state[3];
    ioapic[50] = state[4];
    ioapic[51] = state[5];
  } else {
    const ioapic = new Uint8Array(this.wasm_memory.buffer, this.get_ioapic_addr(), IOAPIC_STRUCT_SIZE);
    dbg_assert(state instanceof Uint8Array);
    dbg_assert(state.length === ioapic.length);
    ioapic.set(state);
  }
};
CPU.prototype.pack_memory = function() {
  dbg_assert((this.mem8.length & 4095) === 0);
  const page_count = this.mem8.length >> 12;
  const nonzero_pages = [];
  for (let page = 0; page < page_count; page++) {
    if (!this.is_memory_zeroed(page << 12, 4096)) {
      nonzero_pages.push(page);
    }
  }
  const bitmap = new Bitmap(page_count);
  const packed_memory = new Uint8Array(nonzero_pages.length << 12);
  for (const [i, page] of nonzero_pages.entries()) {
    bitmap.set(page, 1);
    const offset = page << 12;
    const page_contents = this.mem8.subarray(offset, offset + 4096);
    packed_memory.set(page_contents, i << 12);
  }
  return { bitmap, packed_memory };
};
CPU.prototype.unpack_memory = function(bitmap, packed_memory) {
  const page_count = this.memory_size[0] >> 12;
  let packed_page = 0;
  for (let page = 0; page < page_count; page++) {
    if (bitmap.get(page)) {
      const offset = packed_page << 12;
      const view2 = packed_memory.subarray(offset, offset + 4096);
      this.mem8.set(view2, page << 12);
      packed_page++;
    }
  }
};
CPU.prototype.reboot_internal = function() {
  this.reset_cpu();
  this.fw_value = [];
  if (this.devices.virtio_9p) {
    this.devices.virtio_9p.reset();
  }
  if (this.devices.virtio_console) {
    this.devices.virtio_console.reset();
  }
  if (this.devices.virtio_net) {
    this.devices.virtio_net.reset();
  }
  if (this.devices.ps2) {
    this.devices.ps2.reset();
  }
  this.load_bios();
};
CPU.prototype.reset_memory = function() {
  this.mem8.fill(0);
};
CPU.prototype.create_memory = function(size, minimum_size) {
  if (size < minimum_size) {
    size = minimum_size;
    dbg_log("Rounding memory size up to " + size, LOG_CPU);
  } else if ((size | 0) < 0) {
    size = Math.pow(2, 31) - MMAP_BLOCK_SIZE;
    dbg_log("Rounding memory size down to " + size, LOG_CPU);
  }
  size = (size - 1 | MMAP_BLOCK_SIZE - 1) + 1 | 0;
  dbg_assert((size | 0) > 0);
  dbg_assert((size & MMAP_BLOCK_SIZE - 1) === 0);
  console.assert(this.memory_size[0] === 0, "Expected uninitialised memory");
  this.memory_size[0] = size;
  const memory_offset = this.allocate_memory(size);
  this.mem8 = view(Uint8Array, this.wasm_memory, memory_offset, size);
  this.mem32s = view(Uint32Array, this.wasm_memory, memory_offset, size >> 2);
};
CPU.prototype.init = function(settings, device_bus) {
  this.create_memory(
    settings.memory_size || 64 * 1024 * 1024,
    settings.initrd ? 64 * 1024 * 1024 : 1024 * 1024
  );
  if (settings.disable_jit) {
    this.set_jit_config(0, 1);
  }
  settings.cpuid_level && this.set_cpuid_level(settings.cpuid_level);
  this.acpi_enabled[0] = +settings.acpi;
  this._logical_memory_size = settings.logical_memory_size || this.memory_size[0];
  this.wasm_logical_memory_size[0] = this._logical_memory_size;
  this.reset_cpu();
  if (this.smp_init) {
    const cpu_count = settings.cpu_count | 0 || 1;
    this.smp_init(cpu_count);
    dbg_log("SMP initialised: " + cpu_count + " CPU(s)");
  }
  var io = new IO(this);
  if (this.apic_mmio_read && this.apic_mmio_write) {
    const apic_mmio_read = this.apic_mmio_read;
    const apic_mmio_write = this.apic_mmio_write;
    io.mmap_register(
      4276092928,
      131072,
      // read8: byte reads from LAPIC — extract the relevant byte from the 32-bit reg
      function(addr) {
        return apic_mmio_read(addr & ~3) >>> 8 * (addr & 3) & 255;
      },
      // write8: not used for LAPIC (registers are 32-bit only), ignore
      function(addr, value) {
      },
      // read32: direct 32-bit access
      function(addr) {
        return apic_mmio_read(addr) | 0;
      },
      // write32: direct 32-bit access
      function(addr, value) {
        apic_mmio_write(addr, value);
      }
    );
    dbg_log("LAPIC MMIO registered at 0xFEE00000");
  } else {
    register_lapic_mmio(this, io);
  }
  if (this.ioapic_mmio_read && this.ioapic_mmio_write) {
    const ioapic_mmio_read = this.ioapic_mmio_read;
    const ioapic_mmio_write = this.ioapic_mmio_write;
    io.mmap_register(
      4273995776,
      131072,
      function(addr) {
        return ioapic_mmio_read(addr & ~3) >>> 8 * (addr & 3) & 255;
      },
      function(addr, value) {
      },
      function(addr) {
        return ioapic_mmio_read(addr) | 0;
      },
      function(addr, value) {
        ioapic_mmio_write(addr, value);
      }
    );
    dbg_log("I/O APIC MMIO registered at 0xFEC00000");
  }
  this.io = io;
  this.bios.main = settings.bios;
  this.bios.vga = settings.vga_bios;
  this.load_bios();
  if (settings.bzimage) {
    const option_rom = load_kernel(this.mem8, settings.bzimage, settings.initrd, settings.cmdline || "");
    if (option_rom) {
      this.option_roms.push(option_rom);
    }
  }
  io.register_read(179, this, function() {
    dbg_log("port 0xB3 read");
    return 0;
  });
  var a20_byte = 0;
  io.register_read(146, this, function() {
    return a20_byte;
  });
  io.register_write(146, this, function(out_byte) {
    a20_byte = out_byte;
  });
  io.register_read(1297, this, function() {
    if (this.fw_pointer < this.fw_value.length) {
      return this.fw_value[this.fw_pointer++];
    } else {
      dbg_assert(false, "config port: Read past value");
      return 0;
    }
  });
  io.register_write(1296, this, void 0, function(value) {
    dbg_log("bios config port, index=" + h(value));
    function i32(x) {
      return new Uint8Array(Int32Array.of(x).buffer);
    }
    function to_be16(x) {
      return x >> 8 | x << 8 & 65280;
    }
    function to_be32(x) {
      return x << 24 | x << 8 & 16711680 | x >> 8 & 65280 | x >>> 24;
    }
    this.fw_pointer = 0;
    if (value === FW_CFG_SIGNATURE) {
      this.fw_value = i32(FW_CFG_SIGNATURE_QEMU);
    } else if (value === FW_CFG_ID) {
      this.fw_value = i32(0);
    } else if (value === FW_CFG_RAM_SIZE) {
      this.fw_value = i32(this._logical_memory_size || this.memory_size[0]);
    } else if (value === FW_CFG_NB_CPUS) {
      this.fw_value = i32(1);
    } else if (value === FW_CFG_MAX_CPUS) {
      this.fw_value = i32(1);
    } else if (value === FW_CFG_NUMA) {
      this.fw_value = new Uint8Array(16);
    } else if (value === FW_CFG_FILE_DIR) {
      const buffer_size = 4 + 64 * this.option_roms.length;
      const buffer32 = new Int32Array(buffer_size);
      const buffer8 = new Uint8Array(buffer32.buffer);
      buffer32[0] = to_be32(this.option_roms.length);
      for (let i = 0; i < this.option_roms.length; i++) {
        const { name, data } = this.option_roms[i];
        const file_struct_ptr = 4 + 64 * i;
        dbg_assert(FW_CFG_FILE_START + i < 65536);
        buffer32[file_struct_ptr + 0 >> 2] = to_be32(data.length);
        buffer32[file_struct_ptr + 4 >> 2] = to_be16(FW_CFG_FILE_START + i);
        dbg_assert(name.length < 64 - 8);
        for (let j = 0; j < name.length; j++) {
          buffer8[file_struct_ptr + 8 + j] = name.charCodeAt(j);
        }
      }
      this.fw_value = buffer8;
    } else if (value >= FW_CFG_CUSTOM_START && value < FW_CFG_FILE_START) {
      this.fw_value = i32(0);
    } else if (value >= FW_CFG_FILE_START && value - FW_CFG_FILE_START < this.option_roms.length) {
      const i = value - FW_CFG_FILE_START;
      this.fw_value = this.option_roms[i].data;
    } else {
      dbg_log("Warning: Unimplemented fw index: " + h(value));
      this.fw_value = i32(0);
    }
  });
  if (false) {
    io.register_write(128, this, function(out_byte) {
    });
    io.register_read(128, this, function() {
      return 255;
    });
    io.register_write(233, this, function(out_byte) {
    });
  }
  this.devices = {};
  if (settings.load_devices) {
    this.devices.pci = new PCI(this);
    if (this.acpi_enabled[0]) {
      this.devices.acpi = new ACPI(this);
    }
    this.devices.rtc = new RTC(this);
    this.fill_cmos(this.devices.rtc, settings);
    this.devices.dma = new DMA(this);
    this.devices.vga = new VGAScreen(this, device_bus, settings.screen, settings.vga_memory_size || 8 * 1024 * 1024);
    this.devices.ps2 = new PS2(this, device_bus);
    this.devices.uart0 = new UART(this, 1016, device_bus);
    if (settings.uart1) {
      this.devices.uart1 = new UART(this, 760, device_bus);
    }
    if (settings.uart2) {
      this.devices.uart2 = new UART(this, 1e3, device_bus);
    }
    if (settings.uart3) {
      this.devices.uart3 = new UART(this, 744, device_bus);
    }
    this.devices.fdc = new FloppyController(this, settings.fda, settings.fdb);
    const ide_config = [[void 0, void 0], [void 0, void 0]];
    if (settings.hda) {
      ide_config[0][0] = { buffer: settings.hda };
      ide_config[0][1] = { buffer: settings.hdb };
    }
    ide_config[1][0] = { is_cdrom: true, buffer: settings.cdrom };
    this.devices.ide = new IDEController(this, device_bus, ide_config);
    this.devices.cdrom = this.devices.ide.secondary.master;
    this.devices.ahci = new AHCIController(this, device_bus, {
      ahci_disk_size: settings.ahci_disk_size || 0,
      hda: settings.ahci_hda || null
    });
    this.devices.pit = new PIT(this, device_bus);
    if (settings.net_device.type === "ne2k") {
      this.devices.net = new Ne2k(this, device_bus, settings.preserve_mac_from_state_image, settings.mac_address_translation);
    } else if (settings.net_device.type === "virtio") {
      this.devices.virtio_net = new VirtioNet(this, device_bus, settings.preserve_mac_from_state_image, settings.net_device.mtu);
    }
    if (settings.fs9p) {
      this.devices.virtio_9p = new Virtio9p(settings.fs9p, this, device_bus);
    } else if (settings.handle9p) {
      this.devices.virtio_9p = new Virtio9pHandler(settings.handle9p, this);
    } else if (settings.proxy9p) {
      this.devices.virtio_9p = new Virtio9pProxy(settings.proxy9p, this);
    }
    if (settings.virtio_console) {
      this.devices.virtio_console = new VirtioConsole(this, device_bus);
    }
    if (settings.virtio_balloon) {
      this.devices.virtio_balloon = new VirtioBalloon(this, device_bus);
    }
    if (true) {
      this.devices.sb16 = new SB16(this, device_bus);
    }
  }
  if (settings.multiboot) {
    dbg_log("loading multiboot", LOG_CPU);
    const option_rom = this.load_multiboot_option_rom(settings.multiboot, settings.initrd, settings.cmdline);
    if (option_rom) {
      if (this.bios.main) {
        dbg_log("adding option rom for multiboot", LOG_CPU);
        this.option_roms.push(option_rom);
      } else {
        dbg_log("loaded multiboot without bios", LOG_CPU);
        this.reg32[REG_EAX] = this.io.port_read32(244);
      }
    }
  }
  this.debug_init();
};
CPU.prototype.load_multiboot = function(buffer) {
  if (this.bios.main) {
    dbg_assert(false, "load_multiboot not supported with BIOS");
  }
  const option_rom = this.load_multiboot_option_rom(buffer, void 0, "");
  if (option_rom) {
    dbg_log("loaded multiboot", LOG_CPU);
    this.reg32[REG_EAX] = this.io.port_read32(244);
  }
};
CPU.prototype.load_multiboot_option_rom = function(buffer, initrd, cmdline) {
  dbg_log("Trying multiboot from buffer of size " + buffer.byteLength, LOG_CPU);
  const ELF_MAGIC2 = 1179403647;
  const MULTIBOOT_HEADER_MAGIC = 464367618;
  const MULTIBOOT_HEADER_MEMORY_INFO = 2;
  const MULTIBOOT_HEADER_ADDRESS = 65536;
  const MULTIBOOT_BOOTLOADER_MAGIC = 732803074;
  const MULTIBOOT_SEARCH_BYTES = 8192;
  const MULTIBOOT_INFO_STRUCT_LEN = 116;
  const MULTIBOOT_INFO_CMDLINE = 4;
  const MULTIBOOT_INFO_MODS = 8;
  const MULTIBOOT_INFO_MEM_MAP = 64;
  if (buffer.byteLength < MULTIBOOT_SEARCH_BYTES) {
    var buf32 = new Int32Array(MULTIBOOT_SEARCH_BYTES / 4);
    new Uint8Array(buf32.buffer).set(new Uint8Array(buffer));
  } else {
    var buf32 = new Int32Array(buffer, 0, MULTIBOOT_SEARCH_BYTES / 4);
  }
  for (var offset = 0; offset < MULTIBOOT_SEARCH_BYTES; offset += 4) {
    if (buf32[offset >> 2] === MULTIBOOT_HEADER_MAGIC) {
      var flags = buf32[offset + 4 >> 2];
      var checksum = buf32[offset + 8 >> 2];
      var total = MULTIBOOT_HEADER_MAGIC + flags + checksum | 0;
      if (total) {
        dbg_log("Multiboot checksum check failed", LOG_CPU);
        continue;
      }
    } else {
      continue;
    }
    dbg_log("Multiboot magic found, flags: " + h(flags >>> 0, 8), LOG_CPU);
    dbg_assert((flags & ~MULTIBOOT_HEADER_ADDRESS & ~3) === 0, "TODO");
    var cpu = this;
    this.io.register_read(244, this, function() {
      return 0;
    }, function() {
      return 0;
    }, function() {
      const multiboot_info_addr = 31744;
      let multiboot_data = multiboot_info_addr + MULTIBOOT_INFO_STRUCT_LEN;
      let info = 0;
      if (cmdline) {
        info |= MULTIBOOT_INFO_CMDLINE;
        cpu.write32(multiboot_info_addr + 16, multiboot_data);
        cmdline += "\0";
        const encoder = new TextEncoder();
        const cmdline_utf8 = encoder.encode(cmdline);
        cpu.write_blob(cmdline_utf8, multiboot_data);
        multiboot_data += cmdline_utf8.length;
      }
      {
        const reported_mem = cpu._logical_memory_size || cpu.memory_size[0];
        info |= 1;
        cpu.write32(multiboot_info_addr + 4, 640);
        cpu.write32(
          multiboot_info_addr + 8,
          Math.max(0, reported_mem - 1024 * 1024) >> 10
        );
      }
      if (flags & MULTIBOOT_HEADER_MEMORY_INFO) {
        info |= MULTIBOOT_INFO_MEM_MAP;
        let multiboot_mmap_count = 0;
        cpu.write32(multiboot_info_addr + 44, 0);
        cpu.write32(multiboot_info_addr + 48, multiboot_data);
        const reported_size = cpu._logical_memory_size || cpu.memory_size[0];
        let start = 0;
        let was_memory = false;
        for (let addr = 0; addr < MMAP_MAX; addr += MMAP_BLOCK_SIZE) {
          const has_handler = cpu.memory_map_read8[addr >>> MMAP_BLOCK_BITS] !== void 0;
          const is_ram = addr < reported_size && (!has_handler || addr >= cpu.memory_size[0]);
          if (was_memory && !is_ram) {
            cpu.write32(multiboot_data, 20);
            cpu.write32(multiboot_data + 4, start);
            cpu.write32(multiboot_data + 8, 0);
            cpu.write32(multiboot_data + 12, addr - start);
            cpu.write32(multiboot_data + 16, 0);
            cpu.write32(multiboot_data + 20, 1);
            multiboot_data += 24;
            multiboot_mmap_count += 24;
            was_memory = false;
          } else if (!was_memory && is_ram) {
            start = addr;
            was_memory = true;
          }
        }
        if (was_memory) {
          cpu.write32(multiboot_data, 20);
          cpu.write32(multiboot_data + 4, start);
          cpu.write32(multiboot_data + 8, 0);
          cpu.write32(multiboot_data + 12, reported_size - start);
          cpu.write32(multiboot_data + 16, 0);
          cpu.write32(multiboot_data + 20, 1);
          multiboot_data += 24;
          multiboot_mmap_count += 24;
        }
        cpu.write32(multiboot_info_addr + 44, multiboot_mmap_count);
      }
      let entrypoint = 0;
      let top_of_load = 0;
      if (flags & MULTIBOOT_HEADER_ADDRESS) {
        dbg_log("Multiboot specifies its own address table", LOG_CPU);
        var header_addr = buf32[offset + 12 >> 2];
        var load_addr = buf32[offset + 16 >> 2];
        var load_end_addr = buf32[offset + 20 >> 2];
        var bss_end_addr = buf32[offset + 24 >> 2];
        var entry_addr = buf32[offset + 28 >> 2];
        dbg_log("header=" + h(header_addr, 8) + " load=" + h(load_addr, 8) + " load_end=" + h(load_end_addr, 8) + " bss_end=" + h(bss_end_addr, 8) + " entry=" + h(entry_addr, 8));
        dbg_assert(load_addr <= header_addr);
        var file_start = offset - (header_addr - load_addr);
        if (load_end_addr === 0) {
          var length = void 0;
        } else {
          dbg_assert(load_end_addr >= load_addr);
          var length = load_end_addr - load_addr;
        }
        const blob = new Uint8Array(buffer, file_start, length);
        cpu.write_blob(blob, load_addr);
        entrypoint = entry_addr | 0;
        top_of_load = Math.max(load_end_addr, bss_end_addr);
      } else if (buf32[0] === ELF_MAGIC2) {
        dbg_log("Multiboot image is in elf format", LOG_CPU);
        const elf = read_elf(buffer);
        entrypoint = elf.header.entry;
        for (const program of elf.program_headers) {
          if (program.type === 0) {
          } else if (program.type === 1) {
            dbg_assert(program.filesz <= program.memsz);
            if (program.paddr + program.memsz < cpu.memory_size[0]) {
              if (program.filesz) {
                const blob = new Uint8Array(buffer, program.offset, program.filesz);
                cpu.write_blob(blob, program.paddr);
              }
              top_of_load = Math.max(top_of_load, program.paddr + program.memsz);
              dbg_log("prg load " + program.paddr + " to " + (program.paddr + program.memsz), LOG_CPU);
              if (entrypoint === elf.header.entry && program.vaddr <= entrypoint && program.vaddr + program.memsz > entrypoint) {
                entrypoint = entrypoint - program.vaddr + program.paddr;
              }
            } else {
              dbg_log("Warning: Skipped loading section, paddr=" + h(program.paddr) + " memsz=" + program.memsz, LOG_CPU);
            }
          } else if (program.type === 2 || // dynamic
          program.type === 3 || // interp
          program.type === 4 || // note
          program.type === 6 || // phdr
          program.type === 7 || // tls
          program.type === 1685382480 || // gnu_eh_frame
          program.type === 1685382481 || // gnu_stack
          program.type === 1685382482 || // gnu_relro
          program.type === 1685382483) {
            dbg_log("skip load type " + program.type + " " + program.paddr + " to " + (program.paddr + program.memsz), LOG_CPU);
          } else {
            dbg_assert(false, "unimplemented elf section type: " + h(program.type));
          }
        }
      } else {
        dbg_assert(false, "Not a bootable multiboot format");
      }
      if (initrd) {
        info |= MULTIBOOT_INFO_MODS;
        cpu.write32(multiboot_info_addr + 20, 1);
        cpu.write32(multiboot_info_addr + 24, multiboot_data);
        var ramdisk_address = top_of_load;
        if ((ramdisk_address & 4095) !== 0) {
          ramdisk_address = (ramdisk_address & ~4095) + 4096;
        }
        dbg_log("ramdisk address " + ramdisk_address);
        var ramdisk_top = ramdisk_address + initrd.byteLength;
        cpu.write32(multiboot_data, ramdisk_address);
        cpu.write32(multiboot_data + 4, ramdisk_top);
        cpu.write32(multiboot_data + 8, 0);
        cpu.write32(multiboot_data + 12, 0);
        multiboot_data += 16;
        dbg_assert(ramdisk_top < cpu.memory_size[0]);
        cpu.write_blob(new Uint8Array(initrd), ramdisk_address);
      }
      cpu.write32(multiboot_info_addr, info);
      cpu.reg32[REG_EBX] = multiboot_info_addr;
      cpu.cr[0] = 1;
      cpu.protected_mode[0] = 1;
      cpu.flags[0] = FLAGS_DEFAULT;
      cpu.is_32[0] = 1;
      cpu.stack_size_32[0] = 1;
      for (var i2 = 0; i2 < 6; i2++) {
        cpu.segment_is_null[i2] = 0;
        cpu.segment_offsets[i2] = 0;
        cpu.segment_limits[i2] = 4294967295;
        cpu.sreg[i2] = 45058;
      }
      cpu.instruction_pointer[0] = cpu.get_seg_cs() + entrypoint | 0;
      cpu.update_state_flags();
      dbg_log("Starting multiboot kernel at:", LOG_CPU);
      cpu.dump_state();
      cpu.dump_regs_short();
      return MULTIBOOT_BOOTLOADER_MAGIC;
    });
    this.io.register_write_consecutive(
      244,
      this,
      function(value) {
        console.log("Test exited with code " + h(value, 2));
        throw "HALT";
      },
      function() {
      },
      function() {
      },
      function() {
      }
    );
    for (let i2 = 0; i2 <= 15; i2++) {
      let handle_write = function(value) {
        dbg_log("kvm-unit-test: Set irq " + h(i2) + " to " + h(value, 2));
        if (value) {
          this.device_raise_irq(i2);
        } else {
          this.device_lower_irq(i2);
        }
      };
      this.io.register_write(8192 + i2, this, handle_write, handle_write, handle_write);
    }
    const SIZE = 512;
    const data8 = new Uint8Array(SIZE);
    const data16 = new Uint16Array(data8.buffer);
    data16[0] = 43605;
    data8[2] = SIZE / 512;
    let i = 3;
    data8[i++] = 102;
    data8[i++] = 229;
    data8[i++] = 244;
    dbg_assert(i < SIZE);
    const checksum_index = i;
    data8[checksum_index] = 0;
    let rom_checksum = 0;
    for (let i2 = 0; i2 < data8.length; i2++) {
      rom_checksum += data8[i2];
    }
    data8[checksum_index] = -rom_checksum;
    return {
      name: "genroms/multiboot.bin",
      data: data8
    };
  }
  dbg_log("Multiboot header not found", LOG_CPU);
};
CPU.prototype.fill_cmos = function(rtc, settings) {
  var boot_order = settings.boot_order || BOOT_ORDER_CD_FIRST;
  rtc.cmos_write(CMOS_BIOS_BOOTFLAG1, 1 | boot_order >> 4 & 240);
  rtc.cmos_write(CMOS_BIOS_BOOTFLAG2, boot_order & 255);
  rtc.cmos_write(CMOS_MEM_BASE_LOW, 640 & 255);
  rtc.cmos_write(CMOS_MEM_BASE_HIGH, 640 >> 8);
  var reported_mem = this._logical_memory_size || this.memory_size[0];
  var memory_above_1m = 0;
  if (reported_mem >= 1024 * 1024) {
    memory_above_1m = reported_mem - 1024 * 1024 >> 10;
    memory_above_1m = Math.min(memory_above_1m, 65535);
  }
  rtc.cmos_write(CMOS_MEM_OLD_EXT_LOW, memory_above_1m & 255);
  rtc.cmos_write(CMOS_MEM_OLD_EXT_HIGH, memory_above_1m >> 8 & 255);
  rtc.cmos_write(CMOS_MEM_EXTMEM_LOW, memory_above_1m & 255);
  rtc.cmos_write(CMOS_MEM_EXTMEM_HIGH, memory_above_1m >> 8 & 255);
  var memory_above_16m = 0;
  if (reported_mem >= 16 * 1024 * 1024) {
    memory_above_16m = reported_mem - 16 * 1024 * 1024 >> 16;
    memory_above_16m = Math.min(memory_above_16m, 65535);
  }
  rtc.cmos_write(CMOS_MEM_EXTMEM2_LOW, memory_above_16m & 255);
  rtc.cmos_write(CMOS_MEM_EXTMEM2_HIGH, memory_above_16m >> 8 & 255);
  rtc.cmos_write(CMOS_MEM_HIGHMEM_LOW, 0);
  rtc.cmos_write(CMOS_MEM_HIGHMEM_MID, 0);
  rtc.cmos_write(CMOS_MEM_HIGHMEM_HIGH, 0);
  rtc.cmos_write(CMOS_EQUIPMENT_INFO, 47);
  rtc.cmos_write(CMOS_BIOS_SMP_COUNT, 0);
  if (settings.fastboot) rtc.cmos_write(63, 1);
};
CPU.prototype.load_bios = function() {
  var bios = this.bios.main;
  var vga_bios = this.bios.vga;
  if (!bios) {
    dbg_log("Warning: No BIOS");
    return;
  }
  dbg_assert(bios instanceof ArrayBuffer);
  var data = new Uint8Array(bios), start = 1048576 - bios.byteLength;
  this.write_blob(data, start);
  if (vga_bios) {
    dbg_assert(vga_bios instanceof ArrayBuffer);
    var vga_bios8 = new Uint8Array(vga_bios);
    this.write_blob(vga_bios8, 786432);
    this.io.mmap_register(
      4272947200,
      1048576,
      function(addr) {
        addr = addr - 4272947200 | 0;
        if (addr < vga_bios8.length) {
          return vga_bios8[addr];
        } else {
          return 0;
        }
      },
      function(addr, value) {
        dbg_assert(false, "Unexpected write to VGA rom");
      }
    );
  } else {
    dbg_log("Warning: No VGA BIOS");
  }
  this.io.mmap_register(
    4293918720,
    1048576,
    function(addr) {
      addr &= 1048575;
      return this.mem8[addr];
    }.bind(this),
    function(addr, value) {
      addr &= 1048575;
      this.mem8[addr] = value;
    }.bind(this)
  );
};
CPU.prototype.codegen_finalize = function(wasm_table_index, start, state_flags, ptr, len) {
  ptr >>>= 0;
  len >>>= 0;
  dbg_assert(wasm_table_index >= 0 && wasm_table_index < WASM_TABLE_SIZE);
  const code = new Uint8Array(this.wasm_memory.buffer, ptr, len);
  if (false) {
    if (DUMP_GENERATED_WASM && !this.seen_code[start]) {
      this.dump_wasm(code);
      const DUMP_ASSEMBLY = false;
      if (DUMP_ASSEMBLY) {
        let end = 0;
        if ((start ^ end) & ~4095) {
          dbg_log("truncated disassembly start=" + h(start >>> 0) + " end=" + h(end >>> 0));
          end = (start | 4095) + 1;
        }
        dbg_assert(end >= start);
        const buffer = new Uint8Array(end - start);
        for (let i = start; i < end; i++) {
          buffer[i - start] = this.read8(i);
        }
        this.debug_dump_code(this.is_32[0] ? 1 : 0, buffer, start);
      }
    }
    this.seen_code[start] = (this.seen_code[start] || 0) + 1;
    if (this.test_hook_did_generate_wasm) {
      this.test_hook_did_generate_wasm(code);
    }
  }
  const SYNC_COMPILATION = false;
  if (SYNC_COMPILATION) {
    const module2 = new WebAssembly.Module(code);
    const result2 = new WebAssembly.Instance(module2, { "e": this.jit_imports });
    const f = result2.exports["f"];
    this.wm.wasm_table.set(wasm_table_index + WASM_TABLE_OFFSET, f);
    this.codegen_finalize_finished(wasm_table_index, start, state_flags);
    if (this.test_hook_did_finalize_wasm) {
      this.test_hook_did_finalize_wasm(code);
    }
    return;
  }
  const result = WebAssembly.instantiate(code, { "e": this.jit_imports }).then((result2) => {
    const f = result2.instance.exports["f"];
    this.wm.wasm_table.set(wasm_table_index + WASM_TABLE_OFFSET, f);
    this.codegen_finalize_finished(wasm_table_index, start, state_flags);
    if (this.test_hook_did_finalize_wasm) {
      this.test_hook_did_finalize_wasm(code);
    }
  }).catch((err) => {
    if (false) {
      console.log(err);
      debugger;
    }
  });
};
CPU.prototype.log_uncompiled_code = function(start, end) {
  if (true) {
    return;
  }
  if ((this.seen_code_uncompiled[start] || 0) < 100) {
    this.seen_code_uncompiled[start] = (this.seen_code_uncompiled[start] || 0) + 1;
    end += 8;
    if ((start ^ end) & ~4095) {
      dbg_log("truncated disassembly start=" + h(start >>> 0) + " end=" + h(end >>> 0));
      end = (start | 4095) + 1;
    }
    if (end < start) end = start;
    dbg_assert(end >= start);
    const buffer = new Uint8Array(end - start);
    for (let i = start; i < end; i++) {
      buffer[i - start] = this.read8(i);
    }
    dbg_log("Uncompiled code:");
    this.debug_dump_code(this.is_32[0] ? 1 : 0, buffer, start);
  }
};
CPU.prototype.dump_function_code = function(block_ptr, count) {
  if (true) {
    return;
  }
  const SIZEOF_BASIC_BLOCK_IN_DWORDS = 7;
  const mem32 = new Int32Array(this.wasm_memory.buffer);
  dbg_assert((block_ptr & 3) === 0);
  const is_32 = this.is_32[0];
  for (let i = 0; i < count; i++) {
    const struct_start = (block_ptr >> 2) + i * SIZEOF_BASIC_BLOCK_IN_DWORDS;
    const start = mem32[struct_start + 0];
    const end = mem32[struct_start + 1];
    const is_entry_block = mem32[struct_start + 6] & 65280;
    const buffer = new Uint8Array(end - start);
    for (let i2 = start; i2 < end; i2++) {
      buffer[i2 - start] = this.read8(this.translate_address_system_read(i2));
    }
    dbg_log("---" + (is_entry_block ? " entry" : ""));
    this.debug_dump_code(is_32 ? 1 : 0, buffer, start);
  }
};
CPU.prototype.run_hardware_timers = function(acpi_enabled, now) {
  const pit_time = this.devices.pit.timer(now, false);
  const rtc_time = this.devices.rtc.timer(now, false);
  let acpi_time = 100;
  let apic_time = 100;
  if (acpi_enabled) {
    acpi_time = this.devices.acpi.timer(now);
    apic_time = this.apic_timer(now);
  }
  if (this.smp_cpu_loop && this.smp_cpu_count && this.smp_is_enabled && this.smp_is_enabled()) {
    const cpu_count = this.smp_cpu_count();
    for (let cpu_id = 1; cpu_id < cpu_count; cpu_id++) {
      if (this.set_current_cpu_id) this.set_current_cpu_id(cpu_id);
      this.smp_cpu_loop(cpu_id);
    }
    if (this.set_current_cpu_id) this.set_current_cpu_id(0);
  }
  return Math.min(pit_time, rtc_time, acpi_time, apic_time);
};
CPU.prototype.debug_init = function() {
  if (true) return;
  if (this.io) {
    var seabios_debug = "";
    this.io.register_write(1026, this, handle);
    this.io.register_write(1280, this, handle);
  }
  function handle(out_byte) {
    if (out_byte === 10) {
      dbg_log(seabios_debug, LOG_BIOS);
      seabios_debug = "";
    } else {
      seabios_debug += String.fromCharCode(out_byte);
    }
  }
};
CPU.prototype.dump_stack = function(start, end) {
  if (true) return;
  var esp = this.reg32[REG_ESP];
  dbg_log("========= STACK ==========");
  if (end >= start || end === void 0) {
    start = 5;
    end = -5;
  }
  for (var i = start; i > end; i--) {
    var line = "    ";
    if (!i) line = "=>  ";
    line += h(i, 2) + " | ";
    dbg_log(line + h(esp + 4 * i, 8) + " | " + h(this.read32s(esp + 4 * i) >>> 0));
  }
};
CPU.prototype.debug_get_state = function(where) {
  if (true) return;
  var mode = this.protected_mode[0] ? "prot" : "real";
  var vm = this.flags[0] & FLAG_VM ? 1 : 0;
  var flags = this.get_eflags();
  var iopl = this.getiopl();
  var cpl = this.cpl[0];
  var cs_eip = h(this.sreg[REG_CS], 4) + ":" + h(this.get_real_eip() >>> 0, 8);
  var ss_esp = h(this.sreg[REG_SS], 4) + ":" + h(this.reg32[REG_ES] >>> 0, 8);
  var op_size = this.is_32[0] ? "32" : "16";
  var if_ = this.flags[0] & FLAG_INTERRUPT ? 1 : 0;
  var flag_names = {
    [FLAG_CARRY]: "c",
    [FLAG_PARITY]: "p",
    [FLAG_ADJUST]: "a",
    [FLAG_ZERO]: "z",
    [FLAG_SIGN]: "s",
    [FLAG_TRAP]: "t",
    [FLAG_INTERRUPT]: "i",
    [FLAG_DIRECTION]: "d",
    [FLAG_OVERFLOW]: "o"
  };
  var flag_string = "";
  for (var i = 0; i < 16; i++) {
    if (flag_names[1 << i]) {
      if (flags & 1 << i) {
        flag_string += flag_names[1 << i];
      } else {
        flag_string += " ";
      }
    }
  }
  return "mode=" + mode + "/" + op_size + " paging=" + +((this.cr[0] & CR0_PG) !== 0) + " pae=" + +((this.cr[4] & CR4_PAE) !== 0) + " iopl=" + iopl + " cpl=" + cpl + " if=" + if_ + " cs:eip=" + cs_eip + " cs_off=" + h(this.get_seg_cs() >>> 0, 8) + " flgs=" + h(this.get_eflags() >>> 0, 6) + " (" + flag_string + ") ss:esp=" + ss_esp + " ssize=" + +this.stack_size_32[0] + (where ? " in " + where : "");
};
CPU.prototype.dump_state = function(where) {
  if (true) return;
  dbg_log(this.debug_get_state(where), LOG_CPU);
};
CPU.prototype.get_regs_short = function() {
  if (true) return;
  var r32 = {
    "eax": REG_EAX,
    "ecx": REG_ECX,
    "edx": REG_EDX,
    "ebx": REG_EBX,
    "esp": REG_ESP,
    "ebp": REG_EBP,
    "esi": REG_ESI,
    "edi": REG_EDI
  }, r32_names = ["eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi"], s = { "cs": REG_CS, "ds": REG_DS, "es": REG_ES, "fs": REG_FS, "gs": REG_GS, "ss": REG_SS }, line1 = "", line2 = "";
  for (var i = 0; i < 4; i++) {
    line1 += r32_names[i] + "=" + h(this.reg32[r32[r32_names[i]]] >>> 0, 8) + " ";
    line2 += r32_names[i + 4] + "=" + h(this.reg32[r32[r32_names[i + 4]]] >>> 0, 8) + " ";
  }
  line1 += "  ds=" + h(this.sreg[REG_DS], 4) + " es=" + h(this.sreg[REG_ES], 4) + " fs=" + h(this.sreg[REG_FS], 4);
  line2 += "  gs=" + h(this.sreg[REG_GS], 4) + " cs=" + h(this.sreg[REG_CS], 4) + " ss=" + h(this.sreg[REG_SS], 4);
  return [line1, line2];
};
CPU.prototype.dump_regs_short = function() {
  if (true) return;
  var lines = this.get_regs_short();
  dbg_log(lines[0], LOG_CPU);
  dbg_log(lines[1], LOG_CPU);
};
CPU.prototype.dump_gdt_ldt = function() {
  if (true) return;
  dbg_log("gdt: (len = " + h(this.gdtr_size[0]) + ")");
  dump_table(this.translate_address_system_read(this.gdtr_offset[0]), this.gdtr_size[0]);
  dbg_log("\nldt: (len = " + h(this.segment_limits[REG_LDTR]) + ")");
  dump_table(this.translate_address_system_read(this.segment_offsets[REG_LDTR]), this.segment_limits[REG_LDTR]);
  function dump_table(addr, size) {
    for (var i = 0; i < size; i += 8, addr += 8) {
      var base = this.read16(addr + 2) | this.read8(addr + 4) << 16 | this.read8(addr + 7) << 24, limit = this.read16(addr) | (this.read8(addr + 6) & 15) << 16, access = this.read8(addr + 5), flags = this.read8(addr + 6) >> 4, flags_str = "", dpl = access >> 5 & 3;
      if (!(access & 128)) {
        flags_str += "NP ";
      } else {
        flags_str += " P ";
      }
      if (access & 16) {
        if (flags & 4) {
          flags_str += "32b ";
        } else {
          flags_str += "16b ";
        }
        if (access & 8) {
          flags_str += "X ";
          if (access & 4) {
            flags_str += "C ";
          }
        } else {
          flags_str += "R ";
        }
        flags_str += "RW ";
      } else {
        flags_str += "sys: " + h(access & 15);
      }
      if (flags & 8) {
        limit = limit << 12 | 4095;
      }
      dbg_log(h(i & ~7, 4) + " " + h(base >>> 0, 8) + " (" + h(limit >>> 0, 8) + " bytes) " + flags_str + ";  dpl = " + dpl + ", a = " + access.toString(2) + ", f = " + flags.toString(2));
    }
  }
};
CPU.prototype.dump_idt = function() {
  if (true) return;
  for (var i = 0; i < this.idtr_size[0]; i += 8) {
    var addr = this.translate_address_system_read(this.idtr_offset[0] + i), base = this.read16(addr) | this.read16(addr + 6) << 16, selector = this.read16(addr + 2), type = this.read8(addr + 5), line, dpl = type >> 5 & 3;
    if ((type & 31) === 5) {
      line = "task gate ";
    } else if ((type & 31) === 14) {
      line = "intr gate ";
    } else if ((type & 31) === 15) {
      line = "trap gate ";
    } else {
      line = "invalid   ";
    }
    if (type & 128) {
      line += " P";
    } else {
      line += "NP";
    }
    dbg_log(h(i >> 3, 4) + " " + h(base >>> 0, 8) + ", " + h(selector, 4) + "; " + line + ";  dpl = " + dpl + ", t = " + type.toString(2));
  }
};
CPU.prototype.dump_page_structures = function() {
  var pae = !!(this.cr[4] & CR4_PAE);
  if (pae) {
    dbg_log("PAE enabled");
    for (var i = 0; i < 4; i++) {
      var addr = this.cr[3] + 8 * i;
      var dword = this.read32s(addr);
      if (dword & 1) {
        this.dump_page_directory(dword & 4294963200, true, i << 30);
      }
    }
  } else {
    dbg_log("PAE disabled");
    this.dump_page_directory(this.cr[3], false, 0);
  }
};
CPU.prototype.dump_page_directory = function(pd_addr, pae, start) {
  if (true) return;
  function load_page_entry(dword_entry, pae2, is_directory) {
    if (true) return;
    if (!(dword_entry & 1)) {
      return false;
    }
    var size = (dword_entry & 128) === 128, address;
    if (size && !is_directory) {
      address = dword_entry & (pae2 ? 4292870144 : 4290772992);
    } else {
      address = dword_entry & 4294963200;
    }
    return {
      size,
      global: (dword_entry & 256) === 256,
      accessed: (dword_entry & 32) === 32,
      dirty: (dword_entry & 64) === 64,
      cache_disable: (dword_entry & 16) === 16,
      user: (dword_entry & 4) === 4,
      read_write: (dword_entry & 2) === 2,
      address: address >>> 0
    };
  }
  var n = pae ? 512 : 1024;
  var entry_size = pae ? 8 : 4;
  var pd_shift = pae ? 21 : 22;
  for (var i = 0; i < n; i++) {
    var addr = pd_addr + i * entry_size, dword = this.read32s(addr), entry = load_page_entry(dword, pae, true);
    if (!entry) {
      continue;
    }
    var flags = "";
    flags += entry.size ? "S " : "  ";
    flags += entry.accessed ? "A " : "  ";
    flags += entry.cache_disable ? "Cd " : "  ";
    flags += entry.user ? "U " : "  ";
    flags += entry.read_write ? "Rw " : "   ";
    if (entry.size) {
      dbg_log("=== " + h(start + (i << pd_shift) >>> 0, 8) + " -> " + h(entry.address >>> 0, 8) + " | " + flags);
      continue;
    } else {
      dbg_log("=== " + h(start + (i << pd_shift) >>> 0, 8) + " | " + flags);
    }
    for (var j = 0; j < n; j++) {
      var sub_addr = entry.address + j * entry_size;
      dword = this.read32s(sub_addr);
      var subentry = load_page_entry(dword, pae, false);
      if (subentry) {
        flags = "";
        flags += subentry.cache_disable ? "Cd " : "   ";
        flags += subentry.user ? "U " : "  ";
        flags += subentry.read_write ? "Rw " : "   ";
        flags += subentry.global ? "G " : "  ";
        flags += subentry.accessed ? "A " : "  ";
        flags += subentry.dirty ? "Di " : "   ";
        dbg_log("# " + h(start + (i << pd_shift | j << 12) >>> 0, 8) + " -> " + h(subentry.address, 8) + " | " + flags + "        (at " + h(sub_addr, 8) + ")");
      }
    }
  }
};
CPU.prototype.get_memory_dump = function(start, count) {
  if (true) return;
  if (start === void 0) {
    start = 0;
    count = this.memory_size[0];
  } else if (count === void 0) {
    count = start;
    start = 0;
  }
  return this.mem8.slice(start, start + count).buffer;
};
CPU.prototype.memory_hex_dump = function(addr, length) {
  if (true) return;
  length = length || 4 * 16;
  var line, byt;
  for (var i = 0; i < length >> 4; i++) {
    line = h(addr + (i << 4), 5) + "   ";
    for (var j = 0; j < 16; j++) {
      byt = this.read8(addr + (i << 4) + j);
      line += h(byt, 2) + " ";
    }
    line += "  ";
    for (j = 0; j < 16; j++) {
      byt = this.read8(addr + (i << 4) + j);
      line += byt < 33 || byt > 126 ? "." : String.fromCharCode(byt);
    }
    dbg_log(line);
  }
};
CPU.prototype.used_memory_dump = function() {
  if (true) return;
  var width = 128, height = 16, block_size = this.memory_size[0] / width / height | 0, row;
  for (var i = 0; i < height; i++) {
    row = h(i * width * block_size, 8) + " | ";
    for (var j = 0; j < width; j++) {
      var used = this.mem32s[(i * width + j) * block_size] > 0;
      row += used ? "X" : " ";
    }
    dbg_log(row);
  }
};
CPU.prototype.debug_interrupt = function(interrupt_nr) {
};
CPU.prototype.debug_dump_code = function(is_32, buffer, start) {
  if (true) return;
  if (!this.capstone_decoder) {
    let cs = window.cs;
    if (typeof __require === "function") {
      cs = __require("./capstone-x86.min.js");
    }
    if (cs === void 0) {
      dbg_log("Warning: Missing capstone library, disassembly not available");
      return;
    }
    this.capstone_decoder = [
      new cs.Capstone(cs.ARCH_X86, cs.MODE_16),
      new cs.Capstone(cs.ARCH_X86, cs.MODE_32)
    ];
  }
  if (buffer instanceof Array) {
    buffer = new Uint8Array(buffer);
  }
  try {
    const instructions = this.capstone_decoder[+is_32].disasm(buffer, start);
    instructions.forEach(function(instr) {
      dbg_log(h(instr.address >>> 0) + ": " + pads(instr.bytes.map((x) => h(x, 2).slice(-2)).join(" "), 20) + " " + instr.mnemonic + " " + instr.op_str);
    });
    dbg_log("");
  } catch (e) {
    dbg_log("Could not disassemble: " + Array.from(buffer).map((x) => h(x, 2)).join(" "));
  }
};
CPU.prototype.dump_wasm = function(buffer) {
  if (true) return;
  if (this.wabt === void 0) {
    if (typeof __require === "function") {
      this.wabt = __require("./libwabt.cjs");
    } else {
      this.wabt = new window.WabtModule();
    }
    if (this.wabt === void 0) {
      dbg_log("Warning: Missing libwabt, wasm dump not available");
      return;
    }
  }
  buffer = buffer.slice();
  try {
    var module2 = this.wabt.readWasm(buffer, { readDebugNames: false });
    module2.generateNames();
    module2.applyNames();
    const result = module2.toText({ foldExprs: true, inlineExport: true });
    dbg_log(result);
  } catch (e) {
    dump_file(buffer, "failed.wasm");
    console.log(e.toString());
  } finally {
    if (module2) {
      module2.destroy();
    }
  }
};

// src/state.js
var STATE_VERSION = 6;
var STATE_MAGIC = 2255914614 | 0;
var STATE_INDEX_MAGIC = 0;
var STATE_INDEX_VERSION = 1;
var STATE_INDEX_TOTAL_LEN = 2;
var STATE_INDEX_INFO_LEN = 3;
var STATE_INFO_BLOCK_START = 16;
var ZSTD_MAGIC = 4247762216;
function StateLoadError(msg) {
  this.message = msg;
}
StateLoadError.prototype = new Error();
var CONSTRUCTOR_TABLE = {
  "Map": Map,
  "Uint8Array": Uint8Array,
  "Int8Array": Int8Array,
  "Uint16Array": Uint16Array,
  "Int16Array": Int16Array,
  "Uint32Array": Uint32Array,
  "Int32Array": Int32Array,
  "Float32Array": Float32Array,
  "Float64Array": Float64Array
};
function save_object(obj, saved_buffers) {
  if (typeof obj !== "object" || obj === null) {
    dbg_assert(typeof obj !== "function");
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((x) => save_object(x, saved_buffers));
  }
  if (obj instanceof Map) {
    return {
      "__state_type__": "Map",
      "args": Array.from(obj.entries()).map(([k, v]) => [
        save_object(k, saved_buffers),
        save_object(v, saved_buffers)
      ])
    };
  }
  if (obj.constructor === Object) {
    console.log(obj);
    dbg_assert(obj.constructor !== Object, "Expected non-object");
  }
  if (obj.BYTES_PER_ELEMENT) {
    var buffer = new Uint8Array(obj.buffer, obj.byteOffset, obj.length * obj.BYTES_PER_ELEMENT);
    const constructor = obj.constructor.name.replace("bound ", "");
    dbg_assert(CONSTRUCTOR_TABLE[constructor]);
    return {
      "__state_type__": constructor,
      "buffer_id": saved_buffers.push(buffer) - 1
    };
  }
  if (false) {
    console.log("Object without get_state: ", obj);
  }
  var state = obj.get_state();
  var result = [];
  for (var i = 0; i < state.length; i++) {
    var value = state[i];
    dbg_assert(typeof value !== "function");
    result[i] = save_object(value, saved_buffers);
  }
  return result;
}
function restore_buffers(obj, buffers) {
  if (typeof obj !== "object" || obj === null) {
    dbg_assert(typeof obj !== "function");
    return obj;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = restore_buffers(obj[i], buffers);
    }
    return obj;
  }
  const type = obj["__state_type__"];
  dbg_assert(type !== void 0);
  const constructor = CONSTRUCTOR_TABLE[type];
  dbg_assert(constructor, "Unkown type: " + type);
  if (obj["args"] !== void 0) {
    return new constructor(obj["args"]);
  }
  const buffer = buffers[obj["buffer_id"]];
  return new constructor(buffer);
}
function save_state(cpu) {
  var saved_buffers = [];
  var state = save_object(cpu, saved_buffers);
  var buffer_infos = [];
  var total_buffer_size = 0;
  for (var i = 0; i < saved_buffers.length; i++) {
    var len = saved_buffers[i].byteLength;
    buffer_infos[i] = {
      offset: total_buffer_size,
      length: len
    };
    total_buffer_size += len;
    total_buffer_size = total_buffer_size + 3 & ~3;
  }
  var info_object = JSON.stringify({
    "buffer_infos": buffer_infos,
    "state": state
  });
  var info_block = new TextEncoder().encode(info_object);
  var buffer_block_start = STATE_INFO_BLOCK_START + info_block.length;
  buffer_block_start = buffer_block_start + 3 & ~3;
  var total_size = buffer_block_start + total_buffer_size;
  var result = new ArrayBuffer(total_size);
  var header_block = new Int32Array(
    result,
    0,
    STATE_INFO_BLOCK_START / 4
  );
  new Uint8Array(result, STATE_INFO_BLOCK_START, info_block.length).set(info_block);
  var buffer_block = new Uint8Array(
    result,
    buffer_block_start
  );
  header_block[STATE_INDEX_MAGIC] = STATE_MAGIC;
  header_block[STATE_INDEX_VERSION] = STATE_VERSION;
  header_block[STATE_INDEX_TOTAL_LEN] = total_size;
  header_block[STATE_INDEX_INFO_LEN] = info_block.length;
  for (var i = 0; i < saved_buffers.length; i++) {
    var buffer = saved_buffers[i];
    dbg_assert(buffer.constructor === Uint8Array);
    buffer_block.set(buffer, buffer_infos[i].offset);
  }
  dbg_log("State: json size " + (info_block.byteLength >> 10) + "k");
  dbg_log("State: Total buffers size " + (buffer_block.byteLength >> 10) + "k");
  return result;
}
function restore_state(cpu, state) {
  state = new Uint8Array(state);
  function read_state_header(state2, check_length) {
    const len = state2.length;
    if (len < STATE_INFO_BLOCK_START) {
      throw new StateLoadError("Invalid length: " + len);
    }
    const header_block = new Int32Array(state2.buffer, state2.byteOffset, 4);
    if (header_block[STATE_INDEX_MAGIC] !== STATE_MAGIC) {
      throw new StateLoadError("Invalid header: " + h(header_block[STATE_INDEX_MAGIC] >>> 0));
    }
    if (header_block[STATE_INDEX_VERSION] !== STATE_VERSION) {
      throw new StateLoadError(
        "Version mismatch: dump=" + header_block[STATE_INDEX_VERSION] + " we=" + STATE_VERSION
      );
    }
    if (check_length && header_block[STATE_INDEX_TOTAL_LEN] !== len) {
      throw new StateLoadError(
        "Length doesn't match header: real=" + len + " header=" + header_block[STATE_INDEX_TOTAL_LEN]
      );
    }
    return header_block[STATE_INDEX_INFO_LEN];
  }
  function read_info_block(info_block_buffer) {
    const info_block = new TextDecoder().decode(info_block_buffer);
    return JSON.parse(info_block);
  }
  if (new Uint32Array(state.buffer, 0, 1)[0] === ZSTD_MAGIC) {
    const ctx = cpu.zstd_create_ctx(state.length);
    new Uint8Array(cpu.wasm_memory.buffer, cpu.zstd_get_src_ptr(ctx) >>> 0, state.length).set(state);
    let ptr = cpu.zstd_read(ctx, 16);
    const header_block = new Uint8Array(cpu.wasm_memory.buffer, ptr >>> 0, 16);
    const info_block_len = read_state_header(header_block, false);
    cpu.zstd_read_free(ptr, 16);
    ptr = cpu.zstd_read(ctx, info_block_len);
    const info_block_buffer = new Uint8Array(cpu.wasm_memory.buffer, ptr >>> 0, info_block_len);
    const info_block_obj = read_info_block(info_block_buffer);
    cpu.zstd_read_free(ptr, info_block_len);
    let state_object = info_block_obj["state"];
    const buffer_infos = info_block_obj["buffer_infos"];
    const buffers = [];
    let position = STATE_INFO_BLOCK_START + info_block_len;
    for (const buffer_info of buffer_infos) {
      const front_padding = (position + 3 & ~3) - position;
      const CHUNK_SIZE = 1 * 1024 * 1024;
      if (buffer_info.length > CHUNK_SIZE) {
        const ptr2 = cpu.zstd_read(ctx, front_padding) >>> 0;
        cpu.zstd_read_free(ptr2, front_padding);
        const buffer = new Uint8Array(buffer_info.length);
        buffers.push(buffer.buffer);
        let have = 0;
        while (have < buffer_info.length) {
          const remaining = buffer_info.length - have;
          dbg_assert(remaining >= 0);
          const to_read = Math.min(remaining, CHUNK_SIZE);
          const ptr3 = cpu.zstd_read(ctx, to_read);
          buffer.set(new Uint8Array(cpu.wasm_memory.buffer, ptr3 >>> 0, to_read), have);
          cpu.zstd_read_free(ptr3, to_read);
          have += to_read;
        }
      } else {
        const ptr2 = cpu.zstd_read(ctx, front_padding + buffer_info.length);
        const offset = (ptr2 >>> 0) + front_padding;
        buffers.push(cpu.wasm_memory.buffer.slice(offset, offset + buffer_info.length));
        cpu.zstd_read_free(ptr2, front_padding + buffer_info.length);
      }
      position += front_padding + buffer_info.length;
    }
    state_object = restore_buffers(state_object, buffers);
    cpu.set_state(state_object);
    cpu.zstd_free_ctx(ctx);
  } else {
    const info_block_len = read_state_header(state, true);
    if (info_block_len < 0 || info_block_len + 12 >= state.length) {
      throw new StateLoadError("Invalid info block length: " + info_block_len);
    }
    const info_block_buffer = state.subarray(STATE_INFO_BLOCK_START, STATE_INFO_BLOCK_START + info_block_len);
    const info_block_obj = read_info_block(info_block_buffer);
    let state_object = info_block_obj["state"];
    const buffer_infos = info_block_obj["buffer_infos"];
    let buffer_block_start = STATE_INFO_BLOCK_START + info_block_len;
    buffer_block_start = buffer_block_start + 3 & ~3;
    const buffers = buffer_infos.map((buffer_info) => {
      const offset = buffer_block_start + buffer_info.offset;
      return state.buffer.slice(offset, offset + buffer_info.length);
    });
    state_object = restore_buffers(state_object, buffers);
    cpu.set_state(state_object);
  }
}

// src/main.js
function v86(bus, wasm) {
  this.running = false;
  this.stopping = false;
  this.idle = true;
  this.tick_counter = 0;
  this.worker = null;
  this.cpu = new CPU(bus, wasm, () => {
    this.idle && this.next_tick(0);
  });
  this.bus = bus;
  this.register_yield();
}
v86.prototype.run = function() {
  this.stopping = false;
  if (!this.running) {
    this.running = true;
    this.bus.send("emulator-started");
  }
  this.next_tick(0);
};
v86.prototype.do_tick = function() {
  if (this.stopping || !this.running) {
    this.stopping = this.running = false;
    this.bus.send("emulator-stopped");
    return;
  }
  this.idle = false;
  const t = this.cpu.main_loop();
  this.next_tick(t);
};
v86.prototype.next_tick = function(t) {
  const tick = ++this.tick_counter;
  this.idle = true;
  this.yield(t, tick);
};
v86.prototype.yield_callback = function(tick) {
  if (tick === this.tick_counter) {
    this.do_tick();
  }
};
v86.prototype.stop = function() {
  if (this.running) {
    this.stopping = true;
  }
};
v86.prototype.destroy = function() {
  this.unregister_yield();
};
v86.prototype.restart = function() {
  this.cpu.reset_cpu();
  this.cpu.load_bios();
};
v86.prototype.init = function(settings) {
  this.cpu.init(settings, this.bus);
  this.bus.send("emulator-ready");
};
if (typeof process !== "undefined") {
  v86.prototype.yield = function(t, tick) {
    if (t < 1) {
      global.setImmediate((tick2) => this.yield_callback(tick2), tick);
    } else {
      setTimeout((tick2) => this.yield_callback(tick2), t, tick);
    }
  };
  v86.prototype.register_yield = function() {
  };
  v86.prototype.unregister_yield = function() {
  };
} else if (globalThis["scheduler"] && typeof globalThis["scheduler"]["postTask"] === "function" && location.href.includes("use-scheduling-api")) {
  v86.prototype.yield = function(t, tick) {
    t = Math.max(0, t);
    globalThis["scheduler"]["postTask"](() => this.yield_callback(tick), { delay: t });
  };
  v86.prototype.register_yield = function() {
  };
  v86.prototype.unregister_yield = function() {
  };
} else if (typeof Worker !== "undefined") {
  let the_worker = function() {
    let timeout;
    globalThis.onmessage = function(e) {
      const t = e.data.t;
      timeout = timeout && clearTimeout(timeout);
      if (t < 1) postMessage(e.data.tick);
      else timeout = setTimeout(() => postMessage(e.data.tick), t);
    };
  };
  v86.prototype.register_yield = function() {
    const url = URL.createObjectURL(new Blob(["(" + the_worker.toString() + ")()"], { type: "text/javascript" }));
    this.worker = new Worker(url);
    this.worker.onmessage = (e) => this.yield_callback(e.data);
    URL.revokeObjectURL(url);
  };
  v86.prototype.yield = function(t, tick) {
    this.worker.postMessage({ t, tick });
  };
  v86.prototype.unregister_yield = function() {
    this.worker && this.worker.terminate();
    this.worker = null;
  };
} else {
  v86.prototype.yield = function(t) {
    setTimeout(() => {
      this.do_tick();
    }, t);
  };
  v86.prototype.register_yield = function() {
  };
  v86.prototype.unregister_yield = function() {
  };
}
v86.prototype.save_state = function() {
  return save_state(this.cpu);
};
v86.prototype.restore_state = function(state) {
  return restore_state(this.cpu, state);
};
if (typeof performance === "object" && performance.now) {
  v86.microtick = performance.now.bind(performance);
} else if (typeof __require === "function") {
  const { performance: performance2 } = __require("perf_hooks");
  v86.microtick = performance2.now.bind(performance2);
} else if (typeof process === "object" && process.hrtime) {
  v86.microtick = function() {
    var t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  };
} else {
  v86.microtick = Date.now;
}

// src/browser/print_stats.js
function stats_to_string(cpu) {
  return print_misc_stats(cpu) + print_instruction_counts(cpu);
}
function print_misc_stats(cpu) {
  let text = "";
  const stat_names = [
    "COMPILE",
    "COMPILE_SKIPPED_NO_NEW_ENTRY_POINTS",
    "COMPILE_WRONG_ADDRESS_SPACE",
    "COMPILE_CUT_OFF_AT_END_OF_PAGE",
    "COMPILE_WITH_LOOP_SAFETY",
    "COMPILE_PAGE",
    "COMPILE_PAGE/COMPILE",
    "COMPILE_BASIC_BLOCK",
    "COMPILE_DUPLICATED_BASIC_BLOCK",
    "COMPILE_WASM_BLOCK",
    "COMPILE_WASM_LOOP",
    "COMPILE_DISPATCHER",
    "COMPILE_ENTRY_POINT",
    "COMPILE_WASM_TOTAL_BYTES",
    "COMPILE_WASM_TOTAL_BYTES/COMPILE_PAGE",
    "RUN_INTERPRETED",
    "RUN_INTERPRETED_NEW_PAGE",
    "RUN_INTERPRETED_PAGE_HAS_CODE",
    "RUN_INTERPRETED_PAGE_HAS_ENTRY_AFTER_PAGE_WALK",
    "RUN_INTERPRETED_NEAR_END_OF_PAGE",
    "RUN_INTERPRETED_DIFFERENT_STATE",
    "RUN_INTERPRETED_DIFFERENT_STATE_CPL3",
    "RUN_INTERPRETED_DIFFERENT_STATE_FLAT",
    "RUN_INTERPRETED_DIFFERENT_STATE_IS32",
    "RUN_INTERPRETED_DIFFERENT_STATE_SS32",
    "RUN_INTERPRETED_MISSED_COMPILED_ENTRY_RUN_INTERPRETED",
    "RUN_INTERPRETED_STEPS",
    "RUN_FROM_CACHE",
    "RUN_FROM_CACHE_STEPS",
    "RUN_FROM_CACHE_STEPS/RUN_FROM_CACHE",
    "RUN_FROM_CACHE_STEPS/RUN_INTERPRETED_STEPS",
    "DIRECT_EXIT",
    "INDIRECT_JUMP",
    "INDIRECT_JUMP_NO_ENTRY",
    "NORMAL_PAGE_CHANGE",
    "NORMAL_FALLTHRU",
    "NORMAL_FALLTHRU_WITH_TARGET_BLOCK",
    "NORMAL_BRANCH",
    "NORMAL_BRANCH_WITH_TARGET_BLOCK",
    "CONDITIONAL_JUMP",
    "CONDITIONAL_JUMP_PAGE_CHANGE",
    "CONDITIONAL_JUMP_EXIT",
    "CONDITIONAL_JUMP_FALLTHRU",
    "CONDITIONAL_JUMP_FALLTHRU_WITH_TARGET_BLOCK",
    "CONDITIONAL_JUMP_BRANCH",
    "CONDITIONAL_JUMP_BRANCH_WITH_TARGET_BLOCK",
    "DISPATCHER_SMALL",
    "DISPATCHER_LARGE",
    "LOOP",
    "LOOP_SAFETY",
    "CONDITION_OPTIMISED",
    "CONDITION_UNOPTIMISED",
    "CONDITION_UNOPTIMISED_PF",
    "CONDITION_UNOPTIMISED_UNHANDLED_L",
    "CONDITION_UNOPTIMISED_UNHANDLED_LE",
    "FAILED_PAGE_CHANGE",
    "SAFE_READ_FAST",
    "SAFE_READ_SLOW_PAGE_CROSSED",
    "SAFE_READ_SLOW_NOT_VALID",
    "SAFE_READ_SLOW_NOT_USER",
    "SAFE_READ_SLOW_IN_MAPPED_RANGE",
    "SAFE_WRITE_FAST",
    "SAFE_WRITE_SLOW_PAGE_CROSSED",
    "SAFE_WRITE_SLOW_NOT_VALID",
    "SAFE_WRITE_SLOW_NOT_USER",
    "SAFE_WRITE_SLOW_IN_MAPPED_RANGE",
    "SAFE_WRITE_SLOW_READ_ONLY",
    "SAFE_WRITE_SLOW_HAS_CODE",
    "SAFE_READ_WRITE_FAST",
    "SAFE_READ_WRITE_SLOW_PAGE_CROSSED",
    "SAFE_READ_WRITE_SLOW_NOT_VALID",
    "SAFE_READ_WRITE_SLOW_NOT_USER",
    "SAFE_READ_WRITE_SLOW_IN_MAPPED_RANGE",
    "SAFE_READ_WRITE_SLOW_READ_ONLY",
    "SAFE_READ_WRITE_SLOW_HAS_CODE",
    "PAGE_FAULT",
    "TLB_MISS",
    "MAIN_LOOP",
    "MAIN_LOOP_IDLE",
    "DO_MANY_CYCLES",
    "CYCLE_INTERNAL",
    "INVALIDATE_ALL_MODULES_NO_FREE_WASM_INDICES",
    "INVALIDATE_MODULE_WRITTEN_WHILE_COMPILED",
    "INVALIDATE_MODULE_UNUSED_AFTER_OVERWRITE",
    "INVALIDATE_MODULE_DIRTY_PAGE",
    "INVALIDATE_PAGE_HAD_CODE",
    "INVALIDATE_PAGE_HAD_ENTRY_POINTS",
    "DIRTY_PAGE_DID_NOT_HAVE_CODE",
    "RUN_FROM_CACHE_EXIT_SAME_PAGE",
    "RUN_FROM_CACHE_EXIT_NEAR_END_OF_PAGE",
    "RUN_FROM_CACHE_EXIT_DIFFERENT_PAGE",
    "CLEAR_TLB",
    "FULL_CLEAR_TLB",
    "TLB_FULL",
    "TLB_GLOBAL_FULL",
    "MODRM_SIMPLE_REG",
    "MODRM_SIMPLE_REG_WITH_OFFSET",
    "MODRM_SIMPLE_CONST_OFFSET",
    "MODRM_COMPLEX",
    "SEG_OFFSET_OPTIMISED",
    "SEG_OFFSET_NOT_OPTIMISED",
    "SEG_OFFSET_NOT_OPTIMISED_ES",
    "SEG_OFFSET_NOT_OPTIMISED_FS",
    "SEG_OFFSET_NOT_OPTIMISED_GS",
    "SEG_OFFSET_NOT_OPTIMISED_NOT_FLAT"
  ];
  let j = 0;
  const stat_values = {};
  for (let i = 0; i < stat_names.length; i++) {
    const name = stat_names[i];
    let value;
    if (name.includes("/")) {
      j++;
      const [left, right] = name.split("/");
      value = stat_values[left] / stat_values[right];
    } else {
      const stat = stat_values[name] = cpu.wm.exports["profiler_stat_get"](i - j);
      value = stat >= 1e8 ? Math.round(stat / 1e6) + "m" : stat >= 1e5 ? Math.round(stat / 1e3) + "k" : stat;
    }
    text += name + "=" + value + "\n";
  }
  text += "\n";
  const tlb_entries = cpu.wm.exports["get_valid_tlb_entries_count"]();
  const global_tlb_entries = cpu.wm.exports["get_valid_global_tlb_entries_count"]();
  const nonglobal_tlb_entries = tlb_entries - global_tlb_entries;
  text += "TLB_ENTRIES=" + tlb_entries + " (" + global_tlb_entries + " global, " + nonglobal_tlb_entries + " non-global)\n";
  text += "WASM_TABLE_FREE=" + cpu.wm.exports["jit_get_wasm_table_index_free_list_count"]() + "\n";
  text += "JIT_CACHE_SIZE=" + cpu.wm.exports["jit_get_cache_size"]() + "\n";
  text += "FLAT_SEGMENTS=" + cpu.wm.exports["has_flat_segmentation"]() + "\n";
  text += "wasm memory size: " + (cpu.wasm_memory.buffer.byteLength >> 20) + "m\n";
  text += "Config:\n";
  text += "JIT_DISABLED=" + cpu.wm.exports["get_jit_config"](0) + "\n";
  text += "MAX_PAGES=" + cpu.wm.exports["get_jit_config"](1) + "\n";
  text += "JIT_USE_LOOP_SAFETY=" + Boolean(cpu.wm.exports["get_jit_config"](2)) + "\n";
  text += "MAX_EXTRA_BASIC_BLOCKS=" + cpu.wm.exports["get_jit_config"](3) + "\n";
  return text;
}
function print_instruction_counts(cpu) {
  return [
    print_instruction_counts_offset(cpu, false, false, false, false),
    print_instruction_counts_offset(cpu, true, false, false, false),
    print_instruction_counts_offset(cpu, false, true, false, false),
    print_instruction_counts_offset(cpu, false, false, true, false),
    print_instruction_counts_offset(cpu, false, false, false, true)
  ].join("\n\n");
}
function print_instruction_counts_offset(cpu, compiled, jit_exit, unguarded_register, wasm_size) {
  let text = "";
  const counts = [];
  const label = compiled ? "compiled" : jit_exit ? "jit exit" : unguarded_register ? "unguarded register" : wasm_size ? "wasm size" : "executed";
  for (let opcode = 0; opcode < 256; opcode++) {
    for (let fixed_g = 0; fixed_g < 8; fixed_g++) {
      for (const is_mem of [false, true]) {
        const count = cpu.wm.exports["get_opstats_buffer"](compiled, jit_exit, unguarded_register, wasm_size, opcode, false, is_mem, fixed_g);
        counts.push({ opcode, count, is_mem, fixed_g });
        const count_0f = cpu.wm.exports["get_opstats_buffer"](compiled, jit_exit, unguarded_register, wasm_size, opcode, true, is_mem, fixed_g);
        counts.push({ opcode: 3840 | opcode, count: count_0f, is_mem, fixed_g });
      }
    }
  }
  let total = 0;
  const prefixes = /* @__PURE__ */ new Set([
    38,
    46,
    54,
    62,
    100,
    101,
    102,
    103,
    240,
    242,
    243
  ]);
  for (const { count, opcode } of counts) {
    if (!prefixes.has(opcode)) {
      total += count;
    }
  }
  if (total === 0) {
    return "";
  }
  const per_opcode = new Uint32Array(256);
  const per_opcode0f = new Uint32Array(256);
  for (const { opcode, count } of counts) {
    if ((opcode & 65280) === 3840) {
      per_opcode0f[opcode & 255] += count;
    } else {
      per_opcode[opcode & 255] += count;
    }
  }
  text += "------------------\n";
  text += "Total: " + total + "\n";
  const factor = total > 1e7 ? 1e3 : 1;
  const max_count = Math.max.apply(
    Math,
    counts.map(({ count }) => Math.round(count / factor))
  );
  const pad_length = String(max_count).length;
  text += `Instruction counts ${label} (in ${factor}):
`;
  for (let i = 0; i < 256; i++) {
    text += i.toString(16).padStart(2, "0") + ":" + pads(Math.round(per_opcode[i] / factor), pad_length);
    if (i % 16 === 15)
      text += "\n";
    else
      text += " ";
  }
  text += "\n";
  text += `Instruction counts ${label} (0f, in ${factor}):
`;
  for (let i = 0; i < 256; i++) {
    text += (i & 255).toString(16).padStart(2, "0") + ":" + pads(Math.round(per_opcode0f[i] / factor), pad_length);
    if (i % 16 === 15)
      text += "\n";
    else
      text += " ";
  }
  text += "\n";
  const top_counts = counts.filter(({ count }) => count).sort(({ count: count1 }, { count: count2 }) => count2 - count1);
  for (const { opcode, is_mem, fixed_g, count } of top_counts.slice(0, 200)) {
    const opcode_description = opcode.toString(16) + "_" + fixed_g + (is_mem ? "_m" : "_r");
    text += opcode_description + ":" + (count / total * 100).toFixed(2) + " ";
  }
  text += "\n";
  return text;
}

// src/browser/speaker.js
var DAC_QUEUE_RESERVE = 0.2;
var AUDIOBUFFER_MINIMUM_SAMPLING_RATE = 8e3;
function SpeakerAdapter(bus) {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.AudioContext && !window["webkitAudioContext"]) {
    console.warn("Web browser doesn't support Web Audio API");
    return;
  }
  var SpeakerDAC = window.AudioWorklet ? SpeakerWorkletDAC : SpeakerBufferSourceDAC;
  this.bus = bus;
  this.audio_context = window.AudioContext ? new AudioContext() : new webkitAudioContext();
  this.mixer = new SpeakerMixer(bus, this.audio_context);
  this.pcspeaker = new PCSpeaker(bus, this.audio_context, this.mixer);
  this.dac = new SpeakerDAC(bus, this.audio_context, this.mixer);
  this.pcspeaker.start();
  bus.register("emulator-stopped", function() {
    this.audio_context.suspend();
  }, this);
  bus.register("emulator-started", function() {
    this.audio_context.resume();
  }, this);
  bus.register("speaker-confirm-initialized", function() {
    bus.send("speaker-has-initialized");
  }, this);
  bus.send("speaker-has-initialized");
}
SpeakerAdapter.prototype.destroy = function() {
  this.audio_context && this.audio_context.close();
  this.audio_context = null;
  this.dac && this.dac.node_processor && this.dac.node_processor.port.close();
  this.dac = null;
};
function SpeakerMixer(bus, audio_context) {
  this.audio_context = audio_context;
  this.sources = /* @__PURE__ */ new Map();
  this.volume_both = 1;
  this.volume_left = 1;
  this.volume_right = 1;
  this.gain_left = 1;
  this.gain_right = 1;
  this.node_treble_left = this.audio_context.createBiquadFilter();
  this.node_treble_right = this.audio_context.createBiquadFilter();
  this.node_treble_left.type = "highshelf";
  this.node_treble_right.type = "highshelf";
  this.node_treble_left.frequency.setValueAtTime(2e3, this.audio_context.currentTime);
  this.node_treble_right.frequency.setValueAtTime(2e3, this.audio_context.currentTime);
  this.node_bass_left = this.audio_context.createBiquadFilter();
  this.node_bass_right = this.audio_context.createBiquadFilter();
  this.node_bass_left.type = "lowshelf";
  this.node_bass_right.type = "lowshelf";
  this.node_bass_left.frequency.setValueAtTime(200, this.audio_context.currentTime);
  this.node_bass_right.frequency.setValueAtTime(200, this.audio_context.currentTime);
  this.node_gain_left = this.audio_context.createGain();
  this.node_gain_right = this.audio_context.createGain();
  this.node_merger = this.audio_context.createChannelMerger(2);
  this.input_left = this.node_treble_left;
  this.input_right = this.node_treble_right;
  this.node_treble_left.connect(this.node_bass_left);
  this.node_bass_left.connect(this.node_gain_left);
  this.node_gain_left.connect(this.node_merger, 0, 0);
  this.node_treble_right.connect(this.node_bass_right);
  this.node_bass_right.connect(this.node_gain_right);
  this.node_gain_right.connect(this.node_merger, 0, 1);
  this.node_merger.connect(this.audio_context.destination);
  bus.register("mixer-connect", function(data) {
    var source_id = data[0];
    var channel = data[1];
    this.connect_source(source_id, channel);
  }, this);
  bus.register("mixer-disconnect", function(data) {
    var source_id = data[0];
    var channel = data[1];
    this.disconnect_source(source_id, channel);
  }, this);
  bus.register("mixer-volume", function(data) {
    var source_id = data[0];
    var channel = data[1];
    var decibels = data[2];
    var gain = Math.pow(10, decibels / 20);
    var source = source_id === MIXER_SRC_MASTER ? this : this.sources.get(source_id);
    if (source === void 0) {
      dbg_assert(false, "Mixer set volume - cannot set volume for undefined source: " + source_id);
      return;
    }
    source.set_volume(gain, channel);
  }, this);
  bus.register("mixer-gain-left", function(decibels) {
    this.gain_left = Math.pow(10, decibels / 20);
    this.update();
  }, this);
  bus.register("mixer-gain-right", function(decibels) {
    this.gain_right = Math.pow(10, decibels / 20);
    this.update();
  }, this);
  function create_gain_handler(audio_node) {
    return function(decibels) {
      audio_node.gain.setValueAtTime(decibels, this.audio_context.currentTime);
    };
  }
  bus.register("mixer-treble-left", create_gain_handler(this.node_treble_left), this);
  bus.register("mixer-treble-right", create_gain_handler(this.node_treble_right), this);
  bus.register("mixer-bass-left", create_gain_handler(this.node_bass_left), this);
  bus.register("mixer-bass-right", create_gain_handler(this.node_bass_right), this);
}
SpeakerMixer.prototype.add_source = function(source_node, source_id) {
  var source = new SpeakerMixerSource(
    this.audio_context,
    source_node,
    this.input_left,
    this.input_right
  );
  dbg_assert(!this.sources.has(source_id), "Mixer add source - overwritting source: " + source_id);
  this.sources.set(source_id, source);
  return source;
};
SpeakerMixer.prototype.connect_source = function(source_id, channel) {
  var source = this.sources.get(source_id);
  if (source === void 0) {
    dbg_assert(false, "Mixer connect - cannot connect undefined source: " + source_id);
    return;
  }
  source.connect(channel);
};
SpeakerMixer.prototype.disconnect_source = function(source_id, channel) {
  var source = this.sources.get(source_id);
  if (source === void 0) {
    dbg_assert(false, "Mixer disconnect - cannot disconnect undefined source: " + source_id);
    return;
  }
  source.disconnect(channel);
};
SpeakerMixer.prototype.set_volume = function(value, channel) {
  if (channel === void 0) {
    channel = MIXER_CHANNEL_BOTH;
  }
  switch (channel) {
    case MIXER_CHANNEL_LEFT:
      this.volume_left = value;
      break;
    case MIXER_CHANNEL_RIGHT:
      this.volume_right = value;
      break;
    case MIXER_CHANNEL_BOTH:
      this.volume_both = value;
      break;
    default:
      dbg_assert(false, "Mixer set master volume - unknown channel: " + channel);
      return;
  }
  this.update();
};
SpeakerMixer.prototype.update = function() {
  var net_gain_left = this.volume_both * this.volume_left * this.gain_left;
  var net_gain_right = this.volume_both * this.volume_right * this.gain_right;
  this.node_gain_left.gain.setValueAtTime(net_gain_left, this.audio_context.currentTime);
  this.node_gain_right.gain.setValueAtTime(net_gain_right, this.audio_context.currentTime);
};
function SpeakerMixerSource(audio_context, source_node, destination_left, destination_right) {
  this.audio_context = audio_context;
  this.connected_left = true;
  this.connected_right = true;
  this.gain_hidden = 1;
  this.volume_both = 1;
  this.volume_left = 1;
  this.volume_right = 1;
  this.node_splitter = audio_context.createChannelSplitter(2);
  this.node_gain_left = audio_context.createGain();
  this.node_gain_right = audio_context.createGain();
  source_node.connect(this.node_splitter);
  this.node_splitter.connect(this.node_gain_left, 0);
  this.node_gain_left.connect(destination_left);
  this.node_splitter.connect(this.node_gain_right, 1);
  this.node_gain_right.connect(destination_right);
}
SpeakerMixerSource.prototype.update = function() {
  var net_gain_left = this.connected_left * this.gain_hidden * this.volume_both * this.volume_left;
  var net_gain_right = this.connected_right * this.gain_hidden * this.volume_both * this.volume_right;
  this.node_gain_left.gain.setValueAtTime(net_gain_left, this.audio_context.currentTime);
  this.node_gain_right.gain.setValueAtTime(net_gain_right, this.audio_context.currentTime);
};
SpeakerMixerSource.prototype.connect = function(channel) {
  var both = !channel || channel === MIXER_CHANNEL_BOTH;
  if (both || channel === MIXER_CHANNEL_LEFT) {
    this.connected_left = true;
  }
  if (both || channel === MIXER_CHANNEL_RIGHT) {
    this.connected_right = true;
  }
  this.update();
};
SpeakerMixerSource.prototype.disconnect = function(channel) {
  var both = !channel || channel === MIXER_CHANNEL_BOTH;
  if (both || channel === MIXER_CHANNEL_LEFT) {
    this.connected_left = false;
  }
  if (both || channel === MIXER_CHANNEL_RIGHT) {
    this.connected_right = false;
  }
  this.update();
};
SpeakerMixerSource.prototype.set_volume = function(value, channel) {
  if (channel === void 0) {
    channel = MIXER_CHANNEL_BOTH;
  }
  switch (channel) {
    case MIXER_CHANNEL_LEFT:
      this.volume_left = value;
      break;
    case MIXER_CHANNEL_RIGHT:
      this.volume_right = value;
      break;
    case MIXER_CHANNEL_BOTH:
      this.volume_both = value;
      break;
    default:
      dbg_assert(false, "Mixer set volume - unknown channel: " + channel);
      return;
  }
  this.update();
};
SpeakerMixerSource.prototype.set_gain_hidden = function(value) {
  this.gain_hidden = value;
};
function PCSpeaker(bus, audio_context, mixer) {
  this.node_oscillator = audio_context.createOscillator();
  this.node_oscillator.type = "square";
  this.node_oscillator.frequency.setValueAtTime(440, audio_context.currentTime);
  this.mixer_connection = mixer.add_source(this.node_oscillator, MIXER_SRC_PCSPEAKER);
  this.mixer_connection.disconnect();
  bus.register("pcspeaker-enable", function() {
    mixer.connect_source(MIXER_SRC_PCSPEAKER);
  }, this);
  bus.register("pcspeaker-disable", function() {
    mixer.disconnect_source(MIXER_SRC_PCSPEAKER);
  }, this);
  bus.register("pcspeaker-update", function(data) {
    var counter_mode = data[0];
    var counter_reload = data[1];
    var frequency = 0;
    var beep_enabled = counter_mode === 3;
    if (beep_enabled) {
      frequency = OSCILLATOR_FREQ * 1e3 / counter_reload;
      frequency = Math.min(frequency, this.node_oscillator.frequency.maxValue);
      frequency = Math.max(frequency, 0);
    }
    this.node_oscillator.frequency.setValueAtTime(frequency, audio_context.currentTime);
  }, this);
}
PCSpeaker.prototype.start = function() {
  this.node_oscillator.start();
};
function SpeakerWorkletDAC(bus, audio_context, mixer) {
  this.bus = bus;
  this.audio_context = audio_context;
  this.enabled = false;
  this.sampling_rate = 48e3;
  function worklet() {
    const RENDER_QUANTUM = 128;
    const MINIMUM_BUFFER_SIZE = 2 * RENDER_QUANTUM;
    const QUEUE_RESERVE = 1024;
    function sinc(x) {
      if (x === 0) return 1;
      x *= Math.PI;
      return Math.sin(x) / x;
    }
    var EMPTY_BUFFER = [
      new Float32Array(MINIMUM_BUFFER_SIZE),
      new Float32Array(MINIMUM_BUFFER_SIZE)
    ];
    function DACProcessor() {
      var self2 = Reflect.construct(AudioWorkletProcessor, [], DACProcessor);
      self2.kernel_size = 3;
      self2.queue_data = new Array(1024);
      self2.queue_start = 0;
      self2.queue_end = 0;
      self2.queue_length = 0;
      self2.queue_size = self2.queue_data.length;
      self2.queued_samples = 0;
      self2.source_buffer_previous = EMPTY_BUFFER;
      self2.source_buffer_current = EMPTY_BUFFER;
      self2.source_samples_per_destination = 1;
      self2.source_block_start = 0;
      self2.source_time = 0;
      self2.source_offset = 0;
      self2.port.onmessage = (event) => {
        switch (event.data.type) {
          case "queue":
            self2.queue_push(event.data.value);
            break;
          case "sampling-rate":
            self2.source_samples_per_destination = event.data.value / sampleRate;
            break;
        }
      };
      return self2;
    }
    Reflect.setPrototypeOf(DACProcessor.prototype, AudioWorkletProcessor.prototype);
    Reflect.setPrototypeOf(DACProcessor, AudioWorkletProcessor);
    DACProcessor.prototype["process"] = DACProcessor.prototype.process = function(inputs, outputs, parameters) {
      for (var i = 0; i < outputs[0][0].length; i++) {
        var sum0 = 0;
        var sum1 = 0;
        var start = this.source_offset - this.kernel_size + 1;
        var end = this.source_offset + this.kernel_size;
        for (var j = start; j <= end; j++) {
          var convolute_index = this.source_block_start + j;
          sum0 += this.get_sample(convolute_index, 0) * this.kernel(this.source_time - j);
          sum1 += this.get_sample(convolute_index, 1) * this.kernel(this.source_time - j);
        }
        if (isNaN(sum0) || isNaN(sum1)) {
          sum0 = sum1 = 0;
          this.dbg_log("ERROR: NaN values! Ignoring for now.");
        }
        outputs[0][0][i] = sum0;
        outputs[0][1][i] = sum1;
        this.source_time += this.source_samples_per_destination;
        this.source_offset = Math.floor(this.source_time);
      }
      var samples_needed_per_block = this.source_offset;
      samples_needed_per_block += this.kernel_size + 2;
      this.source_time -= this.source_offset;
      this.source_block_start += this.source_offset;
      this.source_offset = 0;
      this.ensure_enough_data(samples_needed_per_block);
      return true;
    };
    DACProcessor.prototype.kernel = function(x) {
      return sinc(x) * sinc(x / this.kernel_size);
    };
    DACProcessor.prototype.get_sample = function(index, channel) {
      if (index < 0) {
        index += this.source_buffer_previous[0].length;
        return this.source_buffer_previous[channel][index];
      } else {
        return this.source_buffer_current[channel][index];
      }
    };
    DACProcessor.prototype.ensure_enough_data = function(needed) {
      var current_length = this.source_buffer_current[0].length;
      var remaining = current_length - this.source_block_start;
      if (remaining < needed) {
        this.prepare_next_buffer();
        this.source_block_start -= current_length;
      }
    };
    DACProcessor.prototype.prepare_next_buffer = function() {
      if (this.queued_samples < MINIMUM_BUFFER_SIZE && this.queue_length) {
        this.dbg_log("Not enough samples - should not happen during midway of playback");
      }
      this.source_buffer_previous = this.source_buffer_current;
      this.source_buffer_current = this.queue_shift();
      var sample_count = this.source_buffer_current[0].length;
      if (sample_count < MINIMUM_BUFFER_SIZE) {
        var queue_pos = this.queue_start;
        var buffer_count = 0;
        while (sample_count < MINIMUM_BUFFER_SIZE && buffer_count < this.queue_length) {
          sample_count += this.queue_data[queue_pos][0].length;
          queue_pos = queue_pos + 1 & this.queue_size - 1;
          buffer_count++;
        }
        var new_big_buffer_size = Math.max(sample_count, MINIMUM_BUFFER_SIZE);
        var new_big_buffer = [
          new Float32Array(new_big_buffer_size),
          new Float32Array(new_big_buffer_size)
        ];
        new_big_buffer[0].set(this.source_buffer_current[0]);
        new_big_buffer[1].set(this.source_buffer_current[1]);
        var new_big_buffer_pos = this.source_buffer_current[0].length;
        for (var i = 0; i < buffer_count; i++) {
          var small_buffer = this.queue_shift();
          new_big_buffer[0].set(small_buffer[0], new_big_buffer_pos);
          new_big_buffer[1].set(small_buffer[1], new_big_buffer_pos);
          new_big_buffer_pos += small_buffer[0].length;
        }
        this.source_buffer_current = new_big_buffer;
      }
      this.pump();
    };
    DACProcessor.prototype.pump = function() {
      if (this.queued_samples / this.source_samples_per_destination < QUEUE_RESERVE) {
        this.port.postMessage(
          {
            type: "pump"
          }
        );
      }
    };
    DACProcessor.prototype.queue_push = function(item) {
      if (this.queue_length < this.queue_size) {
        this.queue_data[this.queue_end] = item;
        this.queue_end = this.queue_end + 1 & this.queue_size - 1;
        this.queue_length++;
        this.queued_samples += item[0].length;
        this.pump();
      }
    };
    DACProcessor.prototype.queue_shift = function() {
      if (!this.queue_length) {
        return EMPTY_BUFFER;
      }
      var item = this.queue_data[this.queue_start];
      this.queue_data[this.queue_start] = null;
      this.queue_start = this.queue_start + 1 & this.queue_size - 1;
      this.queue_length--;
      this.queued_samples -= item[0].length;
      return item;
    };
    DACProcessor.prototype.dbg_log = function(message) {
      if (false) {
        this.port.postMessage(
          {
            type: "debug-log",
            value: message
          }
        );
      }
    };
    registerProcessor("dac-processor", DACProcessor);
  }
  var worklet_string = worklet.toString();
  var worklet_code_start = worklet_string.indexOf("{") + 1;
  var worklet_code_end = worklet_string.lastIndexOf("}");
  var worklet_code = worklet_string.substring(worklet_code_start, worklet_code_end);
  if (false) {
    worklet_code = "var DEBUG = true;\n" + worklet_code;
  }
  var worklet_blob = new Blob([worklet_code], { type: "application/javascript" });
  var worklet_url = URL.createObjectURL(worklet_blob);
  this.node_processor = null;
  this.node_output = this.audio_context.createGain();
  this.audio_context.audioWorklet.addModule(worklet_url).then(() => {
    URL.revokeObjectURL(worklet_url);
    this.node_processor = new AudioWorkletNode(
      this.audio_context,
      "dac-processor",
      {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: {},
        processorOptions: {}
      }
    );
    this.node_processor.port.postMessage(
      {
        type: "sampling-rate",
        value: this.sampling_rate
      }
    );
    this.node_processor.port.onmessage = (event) => {
      switch (event.data.type) {
        case "pump":
          this.pump();
          break;
        case "debug-log":
          dbg_log("SpeakerWorkletDAC - Worklet: " + event.data.value);
          break;
      }
    };
    this.node_processor.connect(this.node_output);
  });
  this.mixer_connection = mixer.add_source(this.node_output, MIXER_SRC_DAC);
  this.mixer_connection.set_gain_hidden(3);
  bus.register("dac-send-data", function(data) {
    this.queue(data);
  }, this);
  bus.register("dac-enable", function(enabled) {
    this.enabled = true;
  }, this);
  bus.register("dac-disable", function() {
    this.enabled = false;
  }, this);
  bus.register("dac-tell-sampling-rate", function(rate) {
    dbg_assert(rate > 0, "Sampling rate should be nonzero");
    this.sampling_rate = rate;
    if (!this.node_processor) {
      return;
    }
    this.node_processor.port.postMessage(
      {
        type: "sampling-rate",
        value: rate
      }
    );
  }, this);
  if (false) {
    this.debugger = new SpeakerDACDebugger(this.audio_context, this.node_output);
  }
}
SpeakerWorkletDAC.prototype.queue = function(data) {
  if (!this.node_processor) {
    return;
  }
  if (false) {
    this.debugger.push_queued_data(data);
  }
  this.node_processor.port.postMessage(
    {
      type: "queue",
      value: data
    },
    [data[0].buffer, data[1].buffer]
  );
};
SpeakerWorkletDAC.prototype.pump = function() {
  if (!this.enabled) {
    return;
  }
  this.bus.send("dac-request-data");
};
function SpeakerBufferSourceDAC(bus, audio_context, mixer) {
  this.bus = bus;
  this.audio_context = audio_context;
  this.enabled = false;
  this.sampling_rate = 22050;
  this.buffered_time = 0;
  this.rate_ratio = 1;
  this.node_lowpass = this.audio_context.createBiquadFilter();
  this.node_lowpass.type = "lowpass";
  this.node_output = this.node_lowpass;
  this.mixer_connection = mixer.add_source(this.node_output, MIXER_SRC_DAC);
  this.mixer_connection.set_gain_hidden(3);
  bus.register("dac-send-data", function(data) {
    this.queue(data);
  }, this);
  bus.register("dac-enable", function(enabled) {
    this.enabled = true;
    this.pump();
  }, this);
  bus.register("dac-disable", function() {
    this.enabled = false;
  }, this);
  bus.register("dac-tell-sampling-rate", function(rate) {
    dbg_assert(rate > 0, "Sampling rate should be nonzero");
    this.sampling_rate = rate;
    this.rate_ratio = Math.ceil(AUDIOBUFFER_MINIMUM_SAMPLING_RATE / rate);
    this.node_lowpass.frequency.setValueAtTime(rate / 2, this.audio_context.currentTime);
  }, this);
  if (false) {
    this.debugger = new SpeakerDACDebugger(this.audio_context, this.node_output);
  }
}
SpeakerBufferSourceDAC.prototype.queue = function(data) {
  if (false) {
    this.debugger.push_queued_data(data);
  }
  var sample_count = data[0].length;
  var block_duration = sample_count / this.sampling_rate;
  var buffer;
  if (this.rate_ratio > 1) {
    var new_sample_count = sample_count * this.rate_ratio;
    var new_sampling_rate = this.sampling_rate * this.rate_ratio;
    buffer = this.audio_context.createBuffer(2, new_sample_count, new_sampling_rate);
    var buffer_data0 = buffer.getChannelData(0);
    var buffer_data1 = buffer.getChannelData(1);
    var buffer_index = 0;
    for (var i = 0; i < sample_count; i++) {
      for (var j = 0; j < this.rate_ratio; j++, buffer_index++) {
        buffer_data0[buffer_index] = data[0][i];
        buffer_data1[buffer_index] = data[1][i];
      }
    }
  } else {
    buffer = this.audio_context.createBuffer(2, sample_count, this.sampling_rate);
    if (buffer.copyToChannel) {
      buffer.copyToChannel(data[0], 0);
      buffer.copyToChannel(data[1], 1);
    } else {
      buffer.getChannelData(0).set(data[0]);
      buffer.getChannelData(1).set(data[1]);
    }
  }
  var source = this.audio_context.createBufferSource();
  source.buffer = buffer;
  source.connect(this.node_lowpass);
  source.addEventListener("ended", this.pump.bind(this));
  var current_time = this.audio_context.currentTime;
  if (this.buffered_time < current_time) {
    dbg_log("Speaker DAC - Creating/Recreating reserve - shouldn't occur frequently during playback");
    this.buffered_time = current_time;
    var target_silence_duration = DAC_QUEUE_RESERVE - block_duration;
    var current_silence_duration = 0;
    while (current_silence_duration <= target_silence_duration) {
      current_silence_duration += block_duration;
      this.buffered_time += block_duration;
      setTimeout(() => this.pump(), current_silence_duration * 1e3);
    }
  }
  source.start(this.buffered_time);
  this.buffered_time += block_duration;
  setTimeout(() => this.pump(), 0);
};
SpeakerBufferSourceDAC.prototype.pump = function() {
  if (!this.enabled) {
    return;
  }
  if (this.buffered_time - this.audio_context.currentTime > DAC_QUEUE_RESERVE) {
    return;
  }
  this.bus.send("dac-request-data");
};
function SpeakerDACDebugger(audio_context, source_node) {
  this.audio_context = audio_context;
  this.node_source = source_node;
  this.node_processor = null;
  this.node_gain = this.audio_context.createGain();
  this.node_gain.gain.setValueAtTime(0, this.audio_context.currentTime);
  this.node_gain.connect(this.audio_context.destination);
  this.is_active = false;
  this.queued_history = [];
  this.output_history = [];
  this.queued = [[], []];
  this.output = [[], []];
}
SpeakerDACDebugger.prototype.start = function(duration_ms) {
  this.is_active = true;
  this.queued = [[], []];
  this.output = [[], []];
  this.queued_history.push(this.queued);
  this.output_history.push(this.output);
  this.node_processor = this.audio_context.createScriptProcessor(1024, 2, 2);
  this.node_processor.onaudioprocess = (event) => {
    this.output[0].push(event.inputBuffer.getChannelData(0).slice());
    this.output[1].push(event.inputBuffer.getChannelData(1).slice());
  };
  this.node_source.connect(this.node_processor);
  this.node_processor.connect(this.node_gain);
  setTimeout(() => {
    this.stop();
  }, duration_ms);
};
SpeakerDACDebugger.prototype.stop = function() {
  this.is_active = false;
  this.node_source.disconnect(this.node_processor);
  this.node_processor.disconnect();
  this.node_processor = null;
};
SpeakerDACDebugger.prototype.push_queued_data = function(data) {
  if (this.is_active) {
    this.queued[0].push(data[0].slice());
    this.queued[1].push(data[1].slice());
  }
};
SpeakerDACDebugger.prototype.download_txt = function(history_id, channel) {
  var txt = this.output_history[history_id][channel].map((v) => v.join(" ")).join(" ");
  dump_file(txt, "dacdata.txt");
};
SpeakerDACDebugger.prototype.download_csv = function(history_id) {
  var buffers = this.output_history[history_id];
  var csv_rows = [];
  for (var buffer_id = 0; buffer_id < buffers[0].length; buffer_id++) {
    for (var i = 0; i < buffers[0][buffer_id].length; i++) {
      csv_rows.push(`${buffers[0][buffer_id][i]},${buffers[1][buffer_id][i]}`);
    }
  }
  dump_file(csv_rows.join("\n"), "dacdata.csv");
};

// src/browser/network.js
function NetworkAdapter(url, bus, id) {
  this.bus = bus;
  this.socket = void 0;
  this.id = id || 0;
  this.send_queue = [];
  this.url = url;
  this.reconnect_interval = 1e4;
  this.last_connect_attempt = Date.now() - this.reconnect_interval;
  this.send_queue_limit = 64;
  this.destroyed = false;
  this.bus.register("net" + this.id + "-send", function(data) {
    this.send(data);
  }, this);
}
NetworkAdapter.prototype.handle_message = function(e) {
  if (this.bus) {
    this.bus.send("net" + this.id + "-receive", new Uint8Array(e.data));
  }
};
NetworkAdapter.prototype.handle_close = function(e) {
  if (!this.destroyed) {
    this.connect();
    setTimeout(this.connect.bind(this), this.reconnect_interval);
  }
};
NetworkAdapter.prototype.handle_open = function(e) {
  for (var i = 0; i < this.send_queue.length; i++) {
    this.send(this.send_queue[i]);
  }
  this.send_queue = [];
};
NetworkAdapter.prototype.handle_error = function(e) {
};
NetworkAdapter.prototype.destroy = function() {
  this.destroyed = true;
  if (this.socket) {
    this.socket.close();
  }
};
NetworkAdapter.prototype.connect = function() {
  if (typeof WebSocket === "undefined") {
    return;
  }
  if (this.socket) {
    var state = this.socket.readyState;
    if (state === 0 || state === 1) {
      return;
    }
  }
  var now = Date.now();
  if (this.last_connect_attempt + this.reconnect_interval > now) {
    return;
  }
  this.last_connect_attempt = Date.now();
  try {
    this.socket = new WebSocket(this.url);
  } catch (e) {
    console.error(e);
    return;
  }
  this.socket.binaryType = "arraybuffer";
  this.socket.onopen = this.handle_open.bind(this);
  this.socket.onmessage = this.handle_message.bind(this);
  this.socket.onclose = this.handle_close.bind(this);
  this.socket.onerror = this.handle_error.bind(this);
};
NetworkAdapter.prototype.send = function(data) {
  if (!this.socket || this.socket.readyState !== 1) {
    this.send_queue.push(data);
    if (this.send_queue.length > 2 * this.send_queue_limit) {
      this.send_queue = this.send_queue.slice(-this.send_queue_limit);
    }
    this.connect();
  } else {
    this.socket.send(data);
  }
};
NetworkAdapter.prototype.change_proxy = function(url) {
  this.url = url;
  if (this.socket) {
    this.socket.onclose = function() {
    };
    this.socket.onerror = function() {
    };
    this.socket.close();
    this.socket = void 0;
  }
};

// src/browser/fake_network.js
var ETHERTYPE_IPV4 = 2048;
var ETHERTYPE_ARP = 2054;
var ETHERTYPE_IPV6 = 34525;
var IPV4_PROTO_ICMP = 1;
var IPV4_PROTO_TCP = 6;
var IPV4_PROTO_UDP = 17;
var UNIX_EPOCH = (/* @__PURE__ */ new Date("1970-01-01T00:00:00Z")).getTime();
var NTP_EPOCH = (/* @__PURE__ */ new Date("1900-01-01T00:00:00Z")).getTime();
var NTP_EPOC_DIFF = UNIX_EPOCH - NTP_EPOCH;
var TWO_TO_32 = Math.pow(2, 32);
var DHCP_MAGIC_COOKIE = 1669485411;
var V86_ASCII = [118, 56, 54];
var TCP_STATE_CLOSED = "closed";
var TCP_STATE_SYN_RECEIVED = "syn-received";
var TCP_STATE_SYN_SENT = "syn-sent";
var TCP_STATE_SYN_PROBE = "syn-probe";
var TCP_STATE_ESTABLISHED = "established";
var TCP_STATE_FIN_WAIT_1 = "fin-wait-1";
var TCP_STATE_CLOSE_WAIT = "close-wait";
var TCP_STATE_FIN_WAIT_2 = "fin-wait-2";
var TCP_STATE_LAST_ACK = "last-ack";
var TCP_STATE_CLOSING = "closing";
var TCP_DYNAMIC_PORT_START = 49152;
var TCP_DYNAMIC_PORT_END = 65535;
var TCP_DYNAMIC_PORT_RANGE = TCP_DYNAMIC_PORT_END - TCP_DYNAMIC_PORT_START;
var ETH_HEADER_SIZE = 14;
var ETH_PAYLOAD_OFFSET = ETH_HEADER_SIZE;
var MTU_DEFAULT2 = 1500;
var ETH_TRAILER_SIZE = 4;
var IPV4_HEADER_SIZE = 20;
var IPV4_PAYLOAD_OFFSET = ETH_PAYLOAD_OFFSET + IPV4_HEADER_SIZE;
var UDP_HEADER_SIZE = 8;
var UDP_PAYLOAD_OFFSET = IPV4_PAYLOAD_OFFSET + UDP_HEADER_SIZE;
var TCP_HEADER_SIZE = 20;
var TCP_PAYLOAD_OFFSET = IPV4_PAYLOAD_OFFSET + TCP_HEADER_SIZE;
var ICMP_HEADER_SIZE = 4;
var DEFAULT_DOH_SERVER = "cloudflare-dns.com";
function a2ethaddr(bytes) {
  return [0, 1, 2, 3, 4, 5].map((i) => bytes[i].toString(16)).map((x) => x.length === 1 ? "0" + x : x).join(":");
}
function iptolong(parts) {
  return parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3];
}
var GrowableRingbuffer = class {
  /**
   * @param {number} initial_capacity
   * @param {number} maximum_capacity
   */
  constructor(initial_capacity, maximum_capacity) {
    initial_capacity = Math.min(initial_capacity, 16);
    this.maximum_capacity = maximum_capacity ? Math.max(maximum_capacity, initial_capacity) : 0;
    this.tail = 0;
    this.head = 0;
    this.length = 0;
    this.buffer = new Uint8Array(initial_capacity);
  }
  /**
   * @param {Uint8Array} src_array
   */
  write(src_array) {
    const src_length = src_array.length;
    const total_length = this.length + src_length;
    let capacity = this.buffer.length;
    if (capacity < total_length) {
      dbg_assert(capacity > 0);
      while (capacity < total_length) {
        capacity *= 2;
      }
      if (this.maximum_capacity && capacity > this.maximum_capacity) {
        throw new Error("stream capacity overflow in GrowableRingbuffer.write(), package dropped");
      }
      const new_buffer = new Uint8Array(capacity);
      this.peek(new_buffer);
      this.tail = 0;
      this.head = this.length;
      this.buffer = new_buffer;
    }
    const buffer = this.buffer;
    const new_head = this.head + src_length;
    if (new_head > capacity) {
      const i_split = capacity - this.head;
      buffer.set(src_array.subarray(0, i_split), this.head);
      buffer.set(src_array.subarray(i_split));
    } else {
      buffer.set(src_array, this.head);
    }
    this.head = new_head % capacity;
    this.length += src_length;
  }
  /**
   * @param {Uint8Array} dst_array
   */
  peek(dst_array) {
    const length = Math.min(this.length, dst_array.length);
    if (length) {
      const buffer = this.buffer;
      const capacity = buffer.length;
      const new_tail = this.tail + length;
      if (new_tail > capacity) {
        const buf_len_left = new_tail % capacity;
        const buf_len_right = capacity - this.tail;
        dst_array.set(buffer.subarray(this.tail));
        dst_array.set(buffer.subarray(0, buf_len_left), buf_len_right);
      } else {
        dst_array.set(buffer.subarray(this.tail, new_tail));
      }
    }
    return length;
  }
  /**
   * @param {number} length
   */
  remove(length) {
    if (length > this.length) {
      length = this.length;
    }
    if (length) {
      this.tail = (this.tail + length) % this.buffer.length;
      this.length -= length;
    }
    return length;
  }
};
function create_eth_encoder_buf(mtu = MTU_DEFAULT2) {
  const ETH_FRAME_SIZE = ETH_HEADER_SIZE + mtu + ETH_TRAILER_SIZE;
  const IPV4_PAYLOAD_SIZE = mtu - IPV4_HEADER_SIZE;
  const UDP_PAYLOAD_SIZE = IPV4_PAYLOAD_SIZE - UDP_HEADER_SIZE;
  const eth_frame = new Uint8Array(ETH_FRAME_SIZE);
  const buffer = eth_frame.buffer;
  const offset = eth_frame.byteOffset;
  return {
    eth_frame,
    eth_frame_view: new DataView(buffer),
    eth_payload_view: new DataView(buffer, offset + ETH_PAYLOAD_OFFSET, mtu),
    ipv4_payload_view: new DataView(buffer, offset + IPV4_PAYLOAD_OFFSET, IPV4_PAYLOAD_SIZE),
    udp_payload_view: new DataView(buffer, offset + UDP_PAYLOAD_OFFSET, UDP_PAYLOAD_SIZE),
    text_encoder: new TextEncoder()
  };
}
function view_set_array(offset, data, view2, out) {
  out.eth_frame.set(data, view2.byteOffset + offset);
  return data.length;
}
function view_set_zeros(offset, length, view2, out) {
  out.eth_frame.fill(0, view2.byteOffset + offset, view2.byteOffset + offset + length);
}
function view_set_string(offset, str, view2, out) {
  return out.text_encoder.encodeInto(str, out.eth_frame.subarray(view2.byteOffset + offset)).written;
}
function calc_inet_checksum(length, checksum, view2, out) {
  const uint16_end = view2.byteOffset + (length & ~1);
  const eth_frame = out.eth_frame;
  for (let i = view2.byteOffset; i < uint16_end; i += 2) {
    checksum += eth_frame[i] << 8 | eth_frame[i + 1];
  }
  if (length & 1) {
    checksum += eth_frame[uint16_end] << 8;
  }
  while (checksum >>> 16) {
    checksum = (checksum & 65535) + (checksum >>> 16);
  }
  return ~checksum & 65535;
}
function make_packet(out, spec) {
  dbg_assert(spec.eth);
  out.eth_frame.fill(0);
  return out.eth_frame.subarray(0, write_eth(spec, out));
}
function handle_fake_tcp(packet, adapter) {
  const tuple = `${packet.ipv4.src.join(".")}:${packet.tcp.sport}:${packet.ipv4.dest.join(".")}:${packet.tcp.dport}`;
  if (packet.tcp.syn && !packet.tcp.ack) {
    if (adapter.tcp_conn[tuple]) {
      dbg_log("SYN to already opened port", LOG_FETCH);
      delete adapter.tcp_conn[tuple];
    }
    let conn = new TCPConnection(adapter);
    conn.state = TCP_STATE_SYN_RECEIVED;
    conn.tuple = tuple;
    conn.last = packet;
    conn.hsrc = packet.eth.dest;
    conn.psrc = packet.ipv4.dest;
    conn.sport = packet.tcp.dport;
    conn.hdest = packet.eth.src;
    conn.dport = packet.tcp.sport;
    conn.pdest = packet.ipv4.src;
    adapter.bus.pair.send("tcp-connection", conn);
    if (adapter.on_tcp_connection) {
      adapter.on_tcp_connection(conn, packet);
    }
    if (adapter.tcp_conn[tuple]) return;
  }
  if (!adapter.tcp_conn[tuple]) {
    dbg_log(`I dont know about ${tuple}, so resetting`, LOG_FETCH);
    let bop = packet.tcp.ackn;
    if (packet.tcp.fin || packet.tcp.syn) bop += 1;
    let reply = {};
    reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
    reply.ipv4 = {
      proto: IPV4_PROTO_TCP,
      src: packet.ipv4.dest,
      dest: packet.ipv4.src
    };
    reply.tcp = {
      sport: packet.tcp.dport,
      dport: packet.tcp.sport,
      seq: bop,
      ackn: packet.tcp.seq + (packet.tcp.syn ? 1 : 0),
      winsize: packet.tcp.winsize,
      rst: true,
      ack: packet.tcp.syn
    };
    adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
    return true;
  }
  adapter.tcp_conn[tuple].process(packet);
}
function handle_fake_dns_static(packet, adapter) {
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
  reply.ipv4 = {
    proto: IPV4_PROTO_UDP,
    src: adapter.router_ip,
    dest: packet.ipv4.src
  };
  reply.udp = { sport: 53, dport: packet.udp.sport };
  let answers = [];
  let flags = 32768;
  flags |= 384;
  for (let i = 0; i < packet.dns.questions.length; ++i) {
    let q = packet.dns.questions[i];
    switch (q.type) {
      case 1:
        answers.push({
          name: q.name,
          type: q.type,
          class: q.class,
          ttl: 600,
          data: [192, 168, 87, 1]
        });
        break;
      default:
    }
  }
  reply.dns = {
    id: packet.dns.id,
    flags,
    questions: packet.dns.questions,
    answers
  };
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
  return true;
}
function handle_fake_dns_doh(packet, adapter) {
  const fetch_url = `https://${adapter.doh_server || DEFAULT_DOH_SERVER}/dns-query`;
  const fetch_opts = {
    method: "POST",
    headers: [["content-type", "application/dns-message"]],
    body: packet.udp.data
  };
  fetch(fetch_url, fetch_opts).then(async (resp) => {
    const reply = {
      eth: {
        ethertype: ETHERTYPE_IPV4,
        src: adapter.router_mac,
        dest: packet.eth.src
      },
      ipv4: {
        proto: IPV4_PROTO_UDP,
        src: adapter.router_ip,
        dest: packet.ipv4.src
      },
      udp: {
        sport: 53,
        dport: packet.udp.sport,
        data: new Uint8Array(await resp.arrayBuffer())
      }
    };
    adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
  });
  return true;
}
function handle_fake_dns(packet, adapter) {
  if (adapter.dns_method === "static") {
    return handle_fake_dns_static(packet, adapter);
  } else {
    return handle_fake_dns_doh(packet, adapter);
  }
}
function handle_fake_ntp(packet, adapter) {
  let now = Date.now();
  let now_n = now + NTP_EPOC_DIFF;
  let now_n_f = TWO_TO_32 * (now_n % 1e3 / 1e3);
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
  reply.ipv4 = {
    proto: IPV4_PROTO_UDP,
    src: packet.ipv4.dest,
    dest: packet.ipv4.src
  };
  reply.udp = { sport: 123, dport: packet.udp.sport };
  let flags = 0 << 6 | 4 << 3 | 4;
  reply.ntp = Object.assign({}, packet.ntp);
  reply.ntp.flags = flags;
  reply.ntp.poll = 10;
  reply.ntp.ori_ts_i = packet.ntp.trans_ts_i;
  reply.ntp.ori_ts_f = packet.ntp.trans_ts_f;
  reply.ntp.rec_ts_i = now_n / 1e3;
  reply.ntp.rec_ts_f = now_n_f;
  reply.ntp.trans_ts_i = now_n / 1e3;
  reply.ntp.trans_ts_f = now_n_f;
  reply.ntp.stratum = 2;
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
  return true;
}
function handle_fake_dhcp(packet, adapter) {
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
  reply.ipv4 = {
    proto: IPV4_PROTO_UDP,
    src: adapter.router_ip,
    dest: adapter.vm_ip
  };
  reply.udp = { sport: 67, dport: 68 };
  reply.dhcp = {
    htype: 1,
    hlen: 6,
    hops: 0,
    xid: packet.dhcp.xid,
    secs: 0,
    flags: 0,
    ciaddr: 0,
    yiaddr: iptolong(adapter.vm_ip),
    siaddr: iptolong(adapter.router_ip),
    giaddr: iptolong(adapter.router_ip),
    chaddr: packet.dhcp.chaddr
  };
  let options = [];
  let fix = packet.dhcp.options.find(function(x) {
    return x[0] === 53;
  });
  if (fix && fix[2] === 3) packet.dhcp.op = 3;
  if (packet.dhcp.op === 1) {
    reply.dhcp.op = 2;
    options.push(new Uint8Array([53, 1, 2]));
  }
  if (packet.dhcp.op === 3) {
    reply.dhcp.op = 2;
    options.push(new Uint8Array([53, 1, 5]));
    options.push(new Uint8Array([51, 4, 8, 0, 0, 0]));
  }
  let router_ip = [adapter.router_ip[0], adapter.router_ip[1], adapter.router_ip[2], adapter.router_ip[3]];
  options.push(new Uint8Array([1, 4, 255, 255, 255, 0]));
  if (adapter.masquerade) {
    options.push(new Uint8Array([3, 4].concat(router_ip)));
    options.push(new Uint8Array([6, 4].concat(router_ip)));
  }
  options.push(new Uint8Array([54, 4].concat(router_ip)));
  options.push(new Uint8Array([60, 3].concat(V86_ASCII)));
  options.push(new Uint8Array([255, 0]));
  reply.dhcp.options = options;
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
}
function handle_fake_networking(data, adapter) {
  let packet = {};
  parse_eth(data, packet);
  if (packet.ipv4) {
    if (packet.tcp) {
      handle_fake_tcp(packet, adapter);
    } else if (packet.udp) {
      if (packet.dns) {
        handle_fake_dns(packet, adapter);
      } else if (packet.dhcp) {
        handle_fake_dhcp(packet, adapter);
      } else if (packet.ntp) {
        handle_fake_ntp(packet, adapter);
      } else if (packet.udp.dport === 8) {
        handle_udp_echo(packet, adapter);
      }
    } else if (packet.icmp && packet.icmp.type === 8) {
      handle_fake_ping(packet, adapter);
    }
  } else if (packet.arp && packet.arp.oper === 1 && packet.arp.ptype === ETHERTYPE_IPV4) {
    arp_whohas(packet, adapter);
  }
}
function parse_eth(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let ethertype = view2.getUint16(12);
  let eth = {
    ethertype,
    dest: data.subarray(0, 6),
    dest_s: a2ethaddr(data.subarray(0, 6)),
    src: data.subarray(6, 12),
    src_s: a2ethaddr(data.subarray(6, 12))
  };
  o.eth = eth;
  let payload = data.subarray(ETH_HEADER_SIZE, data.length);
  if (ethertype === ETHERTYPE_IPV4) {
    parse_ipv4(payload, o);
  } else if (ethertype === ETHERTYPE_ARP) {
    parse_arp(payload, o);
  } else if (ethertype === ETHERTYPE_IPV6) {
    dbg_log("Unimplemented: ipv6");
  } else {
    dbg_log("Unknown ethertype: " + h(ethertype), LOG_FETCH);
  }
}
function write_eth(spec, out) {
  const view2 = out.eth_frame_view;
  view_set_array(0, spec.eth.dest, view2, out);
  view_set_array(6, spec.eth.src, view2, out);
  view2.setUint16(12, spec.eth.ethertype);
  let len = ETH_HEADER_SIZE;
  if (spec.arp) {
    len += write_arp(spec, out);
  } else if (spec.ipv4) {
    len += write_ipv4(spec, out);
  }
  return len;
}
function parse_arp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let hlen = data[4];
  let plen = data[5];
  let arp = {
    htype: view2.getUint16(0),
    ptype: view2.getUint16(2),
    oper: view2.getUint16(6),
    sha: data.subarray(8, 14),
    spa: data.subarray(14, 18),
    tha: data.subarray(18, 24),
    tpa: data.subarray(24, 28)
  };
  o.arp = arp;
}
function write_arp(spec, out) {
  const view2 = out.eth_payload_view;
  view2.setUint16(0, spec.arp.htype);
  view2.setUint16(2, spec.arp.ptype);
  view2.setUint8(4, spec.arp.sha.length);
  view2.setUint8(5, spec.arp.spa.length);
  view2.setUint16(6, spec.arp.oper);
  view_set_array(8, spec.arp.sha, view2, out);
  view_set_array(14, spec.arp.spa, view2, out);
  view_set_array(18, spec.arp.tha, view2, out);
  view_set_array(24, spec.arp.tpa, view2, out);
  return 28;
}
function parse_ipv4(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let version = data[0] >> 4 & 15;
  let ihl = data[0] & 15;
  let tos = view2.getUint8(1);
  let len = view2.getUint16(2);
  let ttl = view2.getUint8(8);
  let proto = view2.getUint8(9);
  let ip_checksum = view2.getUint16(10);
  let ipv4 = {
    version,
    ihl,
    tos,
    len,
    ttl,
    proto,
    ip_checksum,
    src: data.subarray(12, 12 + 4),
    dest: data.subarray(16, 16 + 4)
  };
  if (Math.max(len, 46) !== data.length) {
    dbg_log(`ipv4 Length mismatch: ${len} != ${data.length}`, LOG_FETCH);
  }
  o.ipv4 = ipv4;
  let ipdata = data.subarray(ihl * 4, len);
  if (proto === IPV4_PROTO_ICMP) {
    parse_icmp(ipdata, o);
  } else if (proto === IPV4_PROTO_TCP) {
    parse_tcp(ipdata, o);
  } else if (proto === IPV4_PROTO_UDP) {
    parse_udp(ipdata, o);
  }
}
function write_ipv4(spec, out) {
  const view2 = out.eth_payload_view;
  const ihl = IPV4_HEADER_SIZE >> 2;
  const version = 4;
  let len = IPV4_HEADER_SIZE;
  if (spec.icmp) {
    len += write_icmp(spec, out);
  } else if (spec.udp) {
    len += write_udp(spec, out);
  } else if (spec.tcp) {
    len += write_tcp(spec, out);
  }
  view2.setUint8(0, version << 4 | ihl & 15);
  view2.setUint8(1, spec.ipv4.tos || 0);
  view2.setUint16(2, len);
  view2.setUint16(4, spec.ipv4.id || 0);
  view2.setUint8(6, 2 << 5);
  view2.setUint8(8, spec.ipv4.ttl || 32);
  view2.setUint8(9, spec.ipv4.proto);
  view2.setUint16(10, 0);
  view_set_array(12, spec.ipv4.src, view2, out);
  view_set_array(16, spec.ipv4.dest, view2, out);
  view2.setUint16(10, calc_inet_checksum(IPV4_HEADER_SIZE, 0, view2, out));
  return len;
}
function parse_icmp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let icmp = {
    type: view2.getUint8(0),
    code: view2.getUint8(1),
    checksum: view2.getUint16(2),
    data: data.subarray(4)
  };
  o.icmp = icmp;
}
function write_icmp(spec, out) {
  const view2 = out.ipv4_payload_view;
  view2.setUint8(0, spec.icmp.type);
  view2.setUint8(1, spec.icmp.code);
  view2.setUint16(2, 0);
  const data_length = view_set_array(ICMP_HEADER_SIZE, spec.icmp.data, view2, out);
  const total_length = ICMP_HEADER_SIZE + data_length;
  view2.setUint16(2, calc_inet_checksum(total_length, 0, view2, out));
  return total_length;
}
function parse_udp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let udp = {
    sport: view2.getUint16(0),
    dport: view2.getUint16(2),
    len: view2.getUint16(4),
    checksum: view2.getUint16(6),
    data: data.subarray(8),
    data_s: new TextDecoder().decode(data.subarray(8))
  };
  if (udp.dport === 67 || udp.sport === 67) {
    parse_dhcp(data.subarray(8), o);
  } else if (udp.dport === 53 || udp.sport === 53) {
    parse_dns(data.subarray(8), o);
  } else if (udp.dport === 123) {
    parse_ntp(data.subarray(8), o);
  }
  o.udp = udp;
}
function write_udp(spec, out) {
  const view2 = out.ipv4_payload_view;
  let total_length = UDP_HEADER_SIZE;
  if (spec.dhcp) {
    total_length += write_dhcp(spec, out);
  } else if (spec.dns) {
    total_length += write_dns(spec, out);
  } else if (spec.ntp) {
    total_length += write_ntp(spec, out);
  } else {
    total_length += view_set_array(0, spec.udp.data, out.udp_payload_view, out);
  }
  view2.setUint16(0, spec.udp.sport);
  view2.setUint16(2, spec.udp.dport);
  view2.setUint16(4, total_length);
  view2.setUint16(6, 0);
  const pseudo_header = (spec.ipv4.src[0] << 8 | spec.ipv4.src[1]) + (spec.ipv4.src[2] << 8 | spec.ipv4.src[3]) + (spec.ipv4.dest[0] << 8 | spec.ipv4.dest[1]) + (spec.ipv4.dest[2] << 8 | spec.ipv4.dest[3]) + IPV4_PROTO_UDP + total_length;
  view2.setUint16(6, calc_inet_checksum(total_length, pseudo_header, view2, out));
  return total_length;
}
function parse_dns(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let dns = {
    id: view2.getUint16(0),
    flags: view2.getUint16(2),
    questions: [],
    answers: []
  };
  let qdcount = view2.getUint16(4);
  let ancount = view2.getUint16(6);
  let nscount = view2.getUint16(8);
  let arcount = view2.getUint16(10);
  let offset = 12;
  function read_dstr() {
    let o2 = [];
    let len;
    do {
      len = view2.getUint8(offset);
      o2.push(new TextDecoder().decode(data.subarray(offset + 1, offset + 1 + len)));
      offset += len + 1;
    } while (len > 0);
    return o2;
  }
  for (let i = 0; i < qdcount; i++) {
    dns.questions.push({
      name: read_dstr(),
      type: view2.getInt16(offset),
      class: view2.getInt16(offset + 2)
    });
    offset += 4;
  }
  for (let i = 0; i < ancount; i++) {
    let ans = {
      name: read_dstr(),
      type: view2.getInt16(offset),
      class: view2.getUint16(offset + 2),
      ttl: view2.getUint32(offset + 4)
    };
    offset += 8;
    let rdlen = view2.getUint16(offset);
    offset += 2;
    ans.data = data.subarray(offset, offset + rdlen);
    offset += rdlen;
    dns.answers.push(ans);
  }
  o.dns = dns;
}
function write_dns(spec, out) {
  const view2 = out.udp_payload_view;
  view2.setUint16(0, spec.dns.id);
  view2.setUint16(2, spec.dns.flags);
  view2.setUint16(4, spec.dns.questions.length);
  view2.setUint16(6, spec.dns.answers.length);
  let offset = 12;
  for (let i = 0; i < spec.dns.questions.length; ++i) {
    let q = spec.dns.questions[i];
    for (let s of q.name) {
      const n_written = view_set_string(offset + 1, s, view2, out);
      view2.setUint8(offset, n_written);
      offset += 1 + n_written;
    }
    view2.setUint16(offset, q.type);
    offset += 2;
    view2.setUint16(offset, q.class);
    offset += 2;
  }
  function write_reply(a) {
    for (let s of a.name) {
      const n_written = view_set_string(offset + 1, s, view2, out);
      view2.setUint8(offset, n_written);
      offset += 1 + n_written;
    }
    view2.setUint16(offset, a.type);
    offset += 2;
    view2.setUint16(offset, a.class);
    offset += 2;
    view2.setUint32(offset, a.ttl);
    offset += 4;
    view2.setUint16(offset, a.data.length);
    offset += 2;
    offset += view_set_array(offset, a.data, view2, out);
  }
  for (let i = 0; i < spec.dns.answers.length; ++i) {
    let a = spec.dns.answers[i];
    write_reply(a);
  }
  return offset;
}
function parse_dhcp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let bootpo = data.subarray(44, 44 + 192);
  let dhcp = {
    op: view2.getUint8(0),
    htype: view2.getUint8(1),
    hlen: view2.getUint8(2),
    hops: view2.getUint8(3),
    xid: view2.getUint32(4),
    secs: view2.getUint16(8),
    flags: view2.getUint16(10),
    ciaddr: view2.getUint32(12),
    yiaddr: view2.getUint32(16),
    siaddr: view2.getUint32(20),
    giaddr: view2.getUint32(24),
    chaddr: data.subarray(28, 28 + 16),
    magic: view2.getUint32(236),
    options: []
  };
  let options = data.subarray(240);
  for (let i = 0; i < options.length; ++i) {
    let start = i;
    let op = options[i];
    if (op === 0) continue;
    ++i;
    let len = options[i];
    i += len;
    dhcp.options.push(options.subarray(start, start + len + 2));
  }
  o.dhcp = dhcp;
  o.dhcp_options = dhcp.options;
}
function write_dhcp(spec, out) {
  const view2 = out.udp_payload_view;
  view2.setUint8(0, spec.dhcp.op);
  view2.setUint8(1, spec.dhcp.htype);
  view2.setUint8(2, spec.dhcp.hlen);
  view2.setUint8(3, spec.dhcp.hops);
  view2.setUint32(4, spec.dhcp.xid);
  view2.setUint16(8, spec.dhcp.secs);
  view2.setUint16(10, spec.dhcp.flags);
  view2.setUint32(12, spec.dhcp.ciaddr);
  view2.setUint32(16, spec.dhcp.yiaddr);
  view2.setUint32(20, spec.dhcp.siaddr);
  view2.setUint32(24, spec.dhcp.giaddr);
  view_set_array(28, spec.dhcp.chaddr, view2, out);
  view2.setUint32(236, DHCP_MAGIC_COOKIE);
  let offset = 240;
  for (let o of spec.dhcp.options) {
    offset += view_set_array(offset, o, view2, out);
  }
  return offset;
}
function parse_ntp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  o.ntp = {
    flags: view2.getUint8(0),
    stratum: view2.getUint8(1),
    poll: view2.getUint8(2),
    precision: view2.getUint8(3),
    root_delay: view2.getUint32(4),
    root_disp: view2.getUint32(8),
    ref_id: view2.getUint32(12),
    ref_ts_i: view2.getUint32(16),
    ref_ts_f: view2.getUint32(20),
    ori_ts_i: view2.getUint32(24),
    ori_ts_f: view2.getUint32(28),
    rec_ts_i: view2.getUint32(32),
    rec_ts_f: view2.getUint32(36),
    trans_ts_i: view2.getUint32(40),
    trans_ts_f: view2.getUint32(44)
  };
}
function write_ntp(spec, out) {
  const view2 = out.udp_payload_view;
  view2.setUint8(0, spec.ntp.flags);
  view2.setUint8(1, spec.ntp.stratum);
  view2.setUint8(2, spec.ntp.poll);
  view2.setUint8(3, spec.ntp.precision);
  view2.setUint32(4, spec.ntp.root_delay);
  view2.setUint32(8, spec.ntp.root_disp);
  view2.setUint32(12, spec.ntp.ref_id);
  view2.setUint32(16, spec.ntp.ref_ts_i);
  view2.setUint32(20, spec.ntp.ref_ts_f);
  view2.setUint32(24, spec.ntp.ori_ts_i);
  view2.setUint32(28, spec.ntp.ori_ts_f);
  view2.setUint32(32, spec.ntp.rec_ts_i);
  view2.setUint32(36, spec.ntp.rec_ts_f);
  view2.setUint32(40, spec.ntp.trans_ts_i);
  view2.setUint32(44, spec.ntp.trans_ts_f);
  return 48;
}
function parse_tcp(data, o) {
  let view2 = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let tcp = {
    sport: view2.getUint16(0),
    dport: view2.getUint16(2),
    seq: view2.getUint32(4),
    ackn: view2.getUint32(8),
    doff: view2.getUint8(12) >> 4,
    winsize: view2.getUint16(14),
    checksum: view2.getUint16(16),
    urgent: view2.getUint16(18)
  };
  let flags = view2.getUint8(13);
  tcp.fin = !!(flags & 1);
  tcp.syn = !!(flags & 2);
  tcp.rst = !!(flags & 4);
  tcp.psh = !!(flags & 8);
  tcp.ack = !!(flags & 16);
  tcp.urg = !!(flags & 32);
  tcp.ece = !!(flags & 64);
  tcp.cwr = !!(flags & 128);
  o.tcp = tcp;
  let offset = tcp.doff * 4;
  o.tcp_data = data.subarray(offset);
}
function write_tcp(spec, out) {
  const view2 = out.ipv4_payload_view;
  let flags = 0;
  let tcp = spec.tcp;
  if (tcp.fin) flags |= 1;
  if (tcp.syn) flags |= 2;
  if (tcp.rst) flags |= 4;
  if (tcp.psh) flags |= 8;
  if (tcp.ack) flags |= 16;
  if (tcp.urg) flags |= 32;
  if (tcp.ece) flags |= 64;
  if (tcp.cwr) flags |= 128;
  let doff = TCP_HEADER_SIZE;
  if (tcp.options) {
    if (tcp.options.mss) {
      view2.setUint8(doff, 2);
      view2.setUint8(doff + 1, 4);
      view2.setUint16(doff + 2, tcp.options.mss);
      doff += 4;
    }
  }
  let total_length = Math.ceil(doff / 4) * 4;
  if (tcp.options && total_length - doff > 0) {
    view_set_zeros(doff, total_length - doff, view2, out);
  }
  view2.setUint16(0, tcp.sport);
  view2.setUint16(2, tcp.dport);
  view2.setUint32(4, tcp.seq);
  view2.setUint32(8, tcp.ackn);
  view2.setUint8(12, total_length >> 2 << 4);
  view2.setUint8(13, flags);
  view2.setUint16(14, tcp.winsize);
  view2.setUint16(16, 0);
  view2.setUint16(18, tcp.urgent || 0);
  if (spec.tcp_data) {
    total_length += view_set_array(TCP_HEADER_SIZE, spec.tcp_data, view2, out);
  }
  const pseudo_header = (spec.ipv4.src[0] << 8 | spec.ipv4.src[1]) + (spec.ipv4.src[2] << 8 | spec.ipv4.src[3]) + (spec.ipv4.dest[0] << 8 | spec.ipv4.dest[1]) + (spec.ipv4.dest[2] << 8 | spec.ipv4.dest[3]) + IPV4_PROTO_TCP + total_length;
  view2.setUint16(16, calc_inet_checksum(total_length, pseudo_header, view2, out));
  return total_length;
}
function fake_tcp_connect(dport, adapter) {
  const vm_ip_str = adapter.vm_ip.join(".");
  const router_ip_str = adapter.router_ip.join(".");
  const sport_0 = Math.random() * TCP_DYNAMIC_PORT_RANGE | 0;
  let sport, tuple, sport_i = 0;
  do {
    sport = TCP_DYNAMIC_PORT_START + (sport_0 + sport_i) % TCP_DYNAMIC_PORT_RANGE;
    tuple = `${vm_ip_str}:${dport}:${router_ip_str}:${sport}`;
  } while (++sport_i < TCP_DYNAMIC_PORT_RANGE && adapter.tcp_conn[tuple]);
  if (adapter.tcp_conn[tuple]) {
    throw new Error("pool of dynamic TCP port numbers exhausted, connection aborted");
  }
  let conn = new TCPConnection(adapter);
  conn.tuple = tuple;
  conn.hsrc = adapter.router_mac;
  conn.psrc = adapter.router_ip;
  conn.sport = sport;
  conn.hdest = adapter.vm_mac;
  conn.dport = dport;
  conn.pdest = adapter.vm_ip;
  adapter.tcp_conn[tuple] = conn;
  conn.connect();
  return conn;
}
function fake_tcp_probe(dport, adapter) {
  return new Promise((res, rej) => {
    let handle = fake_tcp_connect(dport, adapter);
    handle.state = TCP_STATE_SYN_PROBE;
    handle.on("probe", res);
  });
}
function TCPConnection(adapter) {
  this.mtu = adapter.mtu || MTU_DEFAULT2;
  const IPV4_PAYLOAD_SIZE = this.mtu - IPV4_HEADER_SIZE;
  const TCP_PAYLOAD_SIZE = IPV4_PAYLOAD_SIZE - TCP_HEADER_SIZE;
  this.state = TCP_STATE_CLOSED;
  this.net = adapter;
  this.send_buffer = new GrowableRingbuffer(2048, 0);
  this.send_chunk_buf = new Uint8Array(TCP_PAYLOAD_SIZE);
  this.in_active_close = false;
  this.delayed_send_fin = false;
  this.delayed_state = void 0;
  this.events_handlers = {};
}
TCPConnection.prototype.on = function(event, handler) {
  this.events_handlers[event] = handler;
};
TCPConnection.prototype.emit = function(event, ...args) {
  if (!this.events_handlers[event]) return;
  this.events_handlers[event].apply(this, args);
};
TCPConnection.prototype.ipv4_reply = function() {
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: this.hsrc, dest: this.hdest };
  reply.ipv4 = {
    proto: IPV4_PROTO_TCP,
    src: this.psrc,
    dest: this.pdest
  };
  reply.tcp = {
    sport: this.sport,
    dport: this.dport,
    winsize: this.winsize,
    ackn: this.ack,
    seq: this.seq,
    ack: true
  };
  return reply;
};
TCPConnection.prototype.packet_reply = function(packet, tcp_options) {
  const reply_tcp = {
    sport: packet.tcp.dport,
    dport: packet.tcp.sport,
    winsize: packet.tcp.winsize,
    ackn: this.ack,
    seq: this.seq
  };
  if (tcp_options) {
    for (const opt in tcp_options) {
      reply_tcp[opt] = tcp_options[opt];
    }
  }
  const reply = this.ipv4_reply();
  reply.tcp = reply_tcp;
  return reply;
};
TCPConnection.prototype.connect = function() {
  this.seq = 1338;
  this.ack = 1;
  this.start_seq = 0;
  this.winsize = 64240;
  if (this.state !== TCP_STATE_SYN_PROBE) {
    this.state = TCP_STATE_SYN_SENT;
  }
  let reply = this.ipv4_reply();
  reply.ipv4.id = 2345;
  reply.tcp = {
    sport: this.sport,
    dport: this.dport,
    seq: 1337,
    ackn: 0,
    winsize: 0,
    syn: true
  };
  this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
};
TCPConnection.prototype.accept = function(packet = void 0) {
  packet = packet || this.last;
  this.net.tcp_conn[this.tuple] = this;
  this.seq = 1338;
  this.ack = packet.tcp.seq + 1;
  this.start_seq = packet.tcp.seq;
  this.winsize = packet.tcp.winsize;
  let reply = this.ipv4_reply();
  reply.tcp = {
    sport: this.sport,
    dport: this.dport,
    seq: 1337,
    ackn: this.ack,
    winsize: packet.tcp.winsize,
    syn: true,
    ack: true,
    options: {
      mss: this.mtu - TCP_HEADER_SIZE - IPV4_HEADER_SIZE
    }
  };
  this.state = TCP_STATE_ESTABLISHED;
  this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
};
TCPConnection.prototype.process = function(packet) {
  this.last = packet;
  if (this.state === TCP_STATE_CLOSED) {
    const reply = this.packet_reply(packet, { rst: true });
    this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
    return;
  } else if (packet.tcp.rst) {
    if (this.state === TCP_STATE_SYN_PROBE) {
      this.emit("probe", false);
      this.release();
      return;
    }
    this.on_close();
    this.release();
    return;
  } else if (packet.tcp.syn) {
    if (this.state === TCP_STATE_SYN_SENT && packet.tcp.ack) {
      this.ack = packet.tcp.seq + 1;
      this.start_seq = packet.tcp.seq;
      this.last_received_ackn = packet.tcp.ackn;
      const reply = this.ipv4_reply();
      this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
      this.state = TCP_STATE_ESTABLISHED;
      this.emit("connect");
    } else if (this.state === TCP_STATE_SYN_PROBE && packet.tcp.ack) {
      this.emit("probe", true);
      const reply = this.packet_reply(packet, { rst: true });
      this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
      this.release();
    } else {
      dbg_log(`TCP[${this.tuple}]: WARNING: unexpected SYN packet dropped`, LOG_FETCH);
    }
    if (packet.tcp_data.length) {
      dbg_log(`TCP[${this.tuple}]: WARNING: ${packet.tcp_data.length} bytes of unexpected SYN packet payload dropped`, LOG_FETCH);
    }
    return;
  }
  if (packet.tcp.ack) {
    if (this.state === TCP_STATE_SYN_RECEIVED) {
      this.state = TCP_STATE_ESTABLISHED;
    } else if (this.state === TCP_STATE_FIN_WAIT_1) {
      if (!packet.tcp.fin) {
        this.state = TCP_STATE_FIN_WAIT_2;
      }
    } else if (this.state === TCP_STATE_CLOSING || this.state === TCP_STATE_LAST_ACK) {
      this.release();
      return;
    }
  }
  if (this.last_received_ackn === void 0) {
    this.last_received_ackn = packet.tcp.ackn;
  } else {
    const n_ack = packet.tcp.ackn - this.last_received_ackn;
    if (n_ack > 0) {
      this.last_received_ackn = packet.tcp.ackn;
      this.send_buffer.remove(n_ack);
      this.seq += n_ack;
      this.pending = false;
      if (this.delayed_send_fin && !this.send_buffer.length) {
        this.delayed_send_fin = false;
        this.state = this.delayed_state;
        const reply = this.ipv4_reply();
        reply.tcp.fin = true;
        this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
        return;
      }
    } else if (n_ack < 0) {
      dbg_log(`TCP[${this.tuple}]: ERROR: ack underflow (pkt=${packet.tcp.ackn} last=${this.last_received_ackn}), resetting`, LOG_FETCH);
      const reply = this.packet_reply(packet, { rst: true });
      this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
      this.on_close();
      this.release();
      return;
    }
  }
  if (packet.tcp.fin) {
    if (this.ack !== packet.tcp.seq) {
      dbg_log(`TCP[${this.tuple}]: WARNING: closing connection in state "${this.state}" with invalid seq (${this.ack} != ${packet.tcp.seq})`, LOG_FETCH);
    }
    ++this.ack;
    const reply = this.packet_reply(packet, {});
    if (this.state === TCP_STATE_ESTABLISHED) {
      reply.tcp.ack = true;
      this.state = TCP_STATE_CLOSE_WAIT;
      this.on_shutdown();
    } else if (this.state === TCP_STATE_FIN_WAIT_1) {
      if (packet.tcp.ack) {
        this.release();
      } else {
        this.state = TCP_STATE_CLOSING;
      }
      reply.tcp.ack = true;
    } else if (this.state === TCP_STATE_FIN_WAIT_2) {
      this.release();
      reply.tcp.ack = true;
    } else {
      this.release();
      this.on_close();
      reply.tcp.rst = true;
    }
    this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
  } else if (this.ack !== packet.tcp.seq) {
    if (this.ack !== packet.tcp.seq + 1) {
      dbg_log(`Packet seq was wrong ex: ${this.ack} ~${this.ack - this.start_seq} pk: ${packet.tcp.seq} ~${this.start_seq - packet.tcp.seq} (${this.ack - packet.tcp.seq}) = ${this.name}`, LOG_FETCH);
    }
    const reply = this.packet_reply(packet, { ack: true });
    this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
  } else if (packet.tcp.ack && packet.tcp_data.length > 0) {
    this.ack += packet.tcp_data.length;
    const reply = this.ipv4_reply();
    this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
    this.emit("data", packet.tcp_data);
  }
  this.pump();
};
TCPConnection.prototype.write = function(data) {
  if (!this.in_active_close) {
    this.send_buffer.write(data);
  }
  this.pump();
};
TCPConnection.prototype.writev = function(data_array) {
  if (!this.in_active_close) {
    for (const data of data_array) {
      this.send_buffer.write(data);
    }
  }
  this.pump();
};
TCPConnection.prototype.close = function() {
  if (!this.in_active_close) {
    this.in_active_close = true;
    let next_state;
    if (this.state === TCP_STATE_ESTABLISHED || this.state === TCP_STATE_SYN_RECEIVED) {
      next_state = TCP_STATE_FIN_WAIT_1;
    } else if (this.state === TCP_STATE_CLOSE_WAIT) {
      next_state = TCP_STATE_LAST_ACK;
    } else {
      if (this.state !== TCP_STATE_SYN_SENT) {
        dbg_log(`TCP[${this.tuple}]: active close in unexpected state "${this.state}"`, LOG_FETCH);
      }
      this.release();
      return;
    }
    if (this.send_buffer.length || this.pending) {
      this.delayed_send_fin = true;
      this.delayed_state = next_state;
    } else {
      this.state = next_state;
      const reply = this.ipv4_reply();
      reply.tcp.fin = true;
      this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
    }
  }
  this.pump();
};
TCPConnection.prototype.on_shutdown = function() {
  this.emit("shutdown");
};
TCPConnection.prototype.on_close = function() {
  this.emit("close");
};
TCPConnection.prototype.release = function() {
  if (this.net.tcp_conn[this.tuple]) {
    this.state = TCP_STATE_CLOSED;
    delete this.net.tcp_conn[this.tuple];
  }
};
TCPConnection.prototype.pump = function() {
  if (this.send_buffer.length && !this.pending) {
    const data = this.send_chunk_buf;
    const n_ready = this.send_buffer.peek(data);
    const reply = this.ipv4_reply();
    reply.tcp.psh = true;
    reply.tcp_data = data.subarray(0, n_ready);
    this.net.receive(make_packet(this.net.eth_encoder_buf, reply));
    this.pending = true;
  }
};
function arp_whohas(packet, adapter) {
  let packet_subnet = iptolong(packet.arp.tpa) & 4294967040;
  let router_subnet = iptolong(adapter.router_ip) & 4294967040;
  if (!adapter.masquerade) {
    if (packet_subnet !== router_subnet) {
      return;
    }
  }
  if (packet_subnet === router_subnet) {
    if (packet.arp.tpa[3] > 99) return;
  }
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_ARP, src: adapter.router_mac, dest: packet.eth.src };
  reply.arp = {
    htype: 1,
    ptype: ETHERTYPE_IPV4,
    oper: 2,
    sha: adapter.router_mac,
    spa: packet.arp.tpa,
    tha: packet.eth.src,
    tpa: packet.arp.spa
  };
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
}
function handle_fake_ping(packet, adapter) {
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
  reply.ipv4 = {
    proto: IPV4_PROTO_ICMP,
    src: packet.ipv4.dest,
    dest: packet.ipv4.src
  };
  reply.icmp = {
    type: 0,
    code: packet.icmp.code,
    data: packet.icmp.data
  };
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
}
function handle_udp_echo(packet, adapter) {
  let reply = {};
  reply.eth = { ethertype: ETHERTYPE_IPV4, src: adapter.router_mac, dest: packet.eth.src };
  reply.ipv4 = {
    proto: IPV4_PROTO_UDP,
    src: packet.ipv4.dest,
    dest: packet.ipv4.src
  };
  reply.udp = {
    sport: packet.udp.dport,
    dport: packet.udp.sport,
    data: new TextEncoder().encode(packet.udp.data_s)
  };
  adapter.receive(make_packet(adapter.eth_encoder_buf, reply));
}

// src/browser/fetch_network.js
function FetchNetworkAdapter(bus, config) {
  config = config || {};
  this.bus = bus;
  this.id = config.id || 0;
  this.router_mac = new Uint8Array((config.router_mac || "52:54:0:1:2:3").split(":").map(function(x) {
    return parseInt(x, 16);
  }));
  this.router_ip = new Uint8Array((config.router_ip || "192.168.86.1").split(".").map(function(x) {
    return parseInt(x, 10);
  }));
  this.vm_ip = new Uint8Array((config.vm_ip || "192.168.86.100").split(".").map(function(x) {
    return parseInt(x, 10);
  }));
  this.masquerade = config.masquerade === void 0 || !!config.masquerade;
  this.vm_mac = new Uint8Array(6);
  this.dns_method = config.dns_method || "static";
  this.doh_server = config.doh_server;
  this.tcp_conn = {};
  this.mtu = config.mtu;
  this.eth_encoder_buf = create_eth_encoder_buf(this.mtu);
  this.fetch = (...args) => fetch(...args);
  this.cors_proxy = config.cors_proxy;
  this.bus.register("net" + this.id + "-mac", function(mac) {
    this.vm_mac = new Uint8Array(mac.split(":").map(function(x) {
      return parseInt(x, 16);
    }));
  }, this);
  this.bus.register("net" + this.id + "-send", function(data) {
    this.send(data);
  }, this);
  this.bus.register("tcp-connection", (conn) => {
    if (conn.sport === 80) {
      conn.on("data", on_data_http);
      conn.accept();
    }
  }, this);
}
FetchNetworkAdapter.prototype.destroy = function() {
};
FetchNetworkAdapter.prototype.connect = function(port) {
  return fake_tcp_connect(port, this);
};
FetchNetworkAdapter.prototype.tcp_probe = function(port) {
  return fake_tcp_probe(port, this);
};
async function on_data_http(data) {
  this.read = this.read || "";
  this.read += new TextDecoder().decode(data);
  if (this.read && this.read.indexOf("\r\n\r\n") !== -1) {
    let offset = this.read.indexOf("\r\n\r\n");
    let headers = this.read.substring(0, offset).split(/\r\n/);
    let data2 = this.read.substring(offset + 4);
    this.read = "";
    let first_line = headers[0].split(" ");
    let target;
    if (/^https?:/.test(first_line[1])) {
      target = new URL(first_line[1]);
    } else {
      target = new URL("http://host" + first_line[1]);
    }
    if (typeof window !== "undefined" && target.protocol === "http:" && window.location.protocol === "https:") {
      target.protocol = "https:";
    }
    let req_headers = new Headers();
    for (let i = 1; i < headers.length; ++i) {
      const header = this.net.parse_http_header(headers[i]);
      if (!header) {
        console.warn('The request contains an invalid header: "%s"', headers[i]);
        this.net.respond_text_and_close(this, 400, "Bad Request", `Invalid header in request: ${headers[i]}`);
        return;
      }
      if (header.key.toLowerCase() === "host") target.host = header.value;
      else req_headers.append(header.key, header.value);
    }
    if (!this.net.cors_proxy && /^\d+\.external$/.test(target.hostname)) {
      dbg_log("Request to localhost: " + target.href, LOG_FETCH);
      const localport = parseInt(target.hostname.split(".")[0], 10);
      if (!isNaN(localport) && localport > 0 && localport < 65536) {
        target.protocol = "http:";
        target.hostname = "localhost";
        target.port = localport.toString(10);
      } else {
        console.warn('Unknown port for localhost: "%s"', target.href);
        this.net.respond_text_and_close(this, 400, "Bad Request", `Unknown port for localhost: ${target.href}`);
        return;
      }
    }
    dbg_log("HTTP Dispatch: " + target.href, LOG_FETCH);
    this.name = target.href;
    let opts = {
      method: first_line[0],
      headers: req_headers
    };
    if (["put", "post"].indexOf(opts.method.toLowerCase()) !== -1) {
      opts.body = data2;
    }
    const fetch_url = this.net.cors_proxy ? this.net.cors_proxy + encodeURIComponent(target.href) : target.href;
    const encoder = new TextEncoder();
    let response_started = false;
    let handler = (resp) => {
      let resp_headers = new Headers(resp.headers);
      resp_headers.delete("content-encoding");
      resp_headers.delete("keep-alive");
      resp_headers.delete("content-length");
      resp_headers.delete("transfer-encoding");
      resp_headers.set("x-was-fetch-redirected", `${!!resp.redirected}`);
      resp_headers.set("x-fetch-resp-url", resp.url);
      resp_headers.set("connection", "close");
      this.write(this.net.form_response_head(resp.status, resp.statusText, resp_headers));
      response_started = true;
      if (resp.body && resp.body.getReader) {
        const resp_reader = resp.body.getReader();
        const pump = ({ value, done }) => {
          if (value) {
            this.write(value);
          }
          if (done) {
            this.close();
          } else {
            return resp_reader.read().then(pump);
          }
        };
        resp_reader.read().then(pump);
      } else {
        resp.arrayBuffer().then((buffer) => {
          this.write(new Uint8Array(buffer));
          this.close();
        });
      }
    };
    this.net.fetch(fetch_url, opts).then(handler).catch((e) => {
      console.warn("Fetch Failed: " + fetch_url + "\n" + e);
      if (!response_started) {
        this.net.respond_text_and_close(this, 502, "Fetch Error", `Fetch ${fetch_url} failed:

${e.stack || e.message}`);
      }
      this.close();
    });
  }
}
FetchNetworkAdapter.prototype.fetch = async function(url, options) {
  if (this.cors_proxy) url = this.cors_proxy + encodeURIComponent(url);
  try {
    const resp = await fetch(url, options);
    const ab = await resp.arrayBuffer();
    return [resp, ab];
  } catch (e) {
    console.warn("Fetch Failed: " + url + "\n" + e);
    return [
      {
        status: 502,
        statusText: "Fetch Error",
        headers: new Headers({ "Content-Type": "text/plain" })
      },
      new TextEncoder().encode(`Fetch ${url} failed:

${e.stack}`).buffer
    ];
  }
};
FetchNetworkAdapter.prototype.form_response_head = function(status_code, status_text, headers) {
  let lines = [
    `HTTP/1.1 ${status_code} ${status_text}`
  ];
  for (const [key, value] of headers.entries()) {
    lines.push(`${key}: ${value}`);
  }
  return new TextEncoder().encode(lines.join("\r\n") + "\r\n\r\n");
};
FetchNetworkAdapter.prototype.respond_text_and_close = function(conn, status_code, status_text, body) {
  const headers = new Headers({
    "content-type": "text/plain",
    "content-length": body.length.toString(10),
    "connection": "close"
  });
  conn.writev([this.form_response_head(status_code, status_text, headers), new TextEncoder().encode(body)]);
  conn.close();
};
FetchNetworkAdapter.prototype.parse_http_header = function(header) {
  const parts = header.match(/^([^:]*):(.*)$/);
  if (!parts) {
    dbg_log("Unable to parse HTTP header", LOG_FETCH);
    return;
  }
  const key = parts[1];
  const value = parts[2].trim();
  if (key.length === 0) {
    dbg_log("Header key is empty, raw header", LOG_FETCH);
    return;
  }
  if (value.length === 0) {
    dbg_log("Header value is empty", LOG_FETCH);
    return;
  }
  if (!/^[\w-]+$/.test(key)) {
    dbg_log("Header key contains forbidden characters", LOG_FETCH);
    return;
  }
  if (!/^[\x20-\x7E]+$/.test(value)) {
    dbg_log("Header value contains forbidden characters", LOG_FETCH);
    return;
  }
  return { key, value };
};
FetchNetworkAdapter.prototype.send = function(data) {
  handle_fake_networking(data, this);
};
FetchNetworkAdapter.prototype.receive = function(data) {
  this.bus.send("net" + this.id + "-receive", new Uint8Array(data));
};

// src/browser/wisp_network.js
function WispNetworkAdapter(wisp_url, bus, config) {
  this.register_ws(wisp_url);
  this.last_stream = 1;
  this.connections = { 0: { congestion: 0 } };
  this.congested_buffer = [];
  config = config || {};
  this.bus = bus;
  this.id = config.id || 0;
  this.router_mac = new Uint8Array((config.router_mac || "52:54:0:1:2:3").split(":").map(function(x) {
    return parseInt(x, 16);
  }));
  this.router_ip = new Uint8Array((config.router_ip || "192.168.86.1").split(".").map(function(x) {
    return parseInt(x, 10);
  }));
  this.vm_ip = new Uint8Array((config.vm_ip || "192.168.86.100").split(".").map(function(x) {
    return parseInt(x, 10);
  }));
  this.masquerade = config.masquerade === void 0 || !!config.masquerade;
  this.vm_mac = new Uint8Array(6);
  this.dns_method = config.dns_method || "doh";
  this.doh_server = config.doh_server;
  this.tcp_conn = {};
  this.mtu = config.mtu;
  this.eth_encoder_buf = create_eth_encoder_buf(this.mtu);
  this.bus.register("net" + this.id + "-mac", function(mac) {
    this.vm_mac = new Uint8Array(mac.split(":").map(function(x) {
      return parseInt(x, 16);
    }));
  }, this);
  this.bus.register("net" + this.id + "-send", function(data) {
    this.send(data);
  }, this);
}
WispNetworkAdapter.prototype.register_ws = function(wisp_url) {
  this.wispws = new WebSocket(wisp_url.replace("wisp://", "ws://").replace("wisps://", "wss://"));
  this.wispws.binaryType = "arraybuffer";
  this.wispws.onmessage = (event) => {
    this.process_incoming_wisp_frame(new Uint8Array(event.data));
  };
  this.wispws.onclose = () => {
    setTimeout(() => {
      this.register_ws(wisp_url);
    }, 1e4);
  };
};
WispNetworkAdapter.prototype.send_packet = function(data, type, stream_id) {
  if (this.connections[stream_id]) {
    if (this.connections[stream_id].congestion > 0) {
      if (type === "DATA") {
        this.connections[stream_id].congestion--;
      }
      this.wispws.send(data);
    } else {
      this.connections[stream_id].congested = true;
      this.congested_buffer.push({ data, type });
    }
  }
};
WispNetworkAdapter.prototype.process_incoming_wisp_frame = function(frame) {
  const view2 = new DataView(frame.buffer);
  const stream_id = view2.getUint32(1, true);
  switch (frame[0]) {
    case 1:
      dbg_log("Server sent client-only packet CONNECT", LOG_NET);
      break;
    case 2:
      if (this.connections[stream_id])
        this.connections[stream_id].data_callback(frame.slice(5));
      else
        throw new Error("Got a DATA packet but stream not registered. ID: " + stream_id);
      break;
    case 3:
      if (this.connections[stream_id]) {
        this.connections[stream_id].congestion = view2.getUint32(5, true);
      }
      if (this.connections[stream_id].congested) {
        const buffer = this.congested_buffer.slice(0);
        this.congested_buffer.length = 0;
        this.connections[stream_id].congested = false;
        for (const packet of buffer) {
          this.send_packet(packet.data, packet.type, stream_id);
        }
      }
      break;
    case 4:
      if (this.connections[stream_id])
        this.connections[stream_id].close_callback(view2.getUint8(5));
      delete this.connections[stream_id];
      break;
    case 5:
      dbg_log("got a wisp V2 upgrade request, ignoring", LOG_NET);
      break;
    default:
      dbg_log("Wisp server returned unknown packet: " + frame[0], LOG_NET);
  }
};
WispNetworkAdapter.prototype.send_wisp_frame = function(frame_obj) {
  let full_packet;
  let view2;
  switch (frame_obj.type) {
    case "CONNECT":
      const hostname_buffer = new TextEncoder().encode(frame_obj.hostname);
      full_packet = new Uint8Array(5 + 1 + 2 + hostname_buffer.length);
      view2 = new DataView(full_packet.buffer);
      view2.setUint8(0, 1);
      view2.setUint32(1, frame_obj.stream_id, true);
      view2.setUint8(5, 1);
      view2.setUint16(6, frame_obj.port, true);
      full_packet.set(hostname_buffer, 8);
      this.connections[frame_obj.stream_id] = {
        data_callback: frame_obj.data_callback,
        close_callback: frame_obj.close_callback,
        congestion: this.connections[0].congestion
      };
      break;
    case "DATA":
      full_packet = new Uint8Array(5 + frame_obj.data.length);
      view2 = new DataView(full_packet.buffer);
      view2.setUint8(0, 2);
      view2.setUint32(1, frame_obj.stream_id, true);
      full_packet.set(frame_obj.data, 5);
      break;
    case "CLOSE":
      full_packet = new Uint8Array(5 + 1);
      view2 = new DataView(full_packet.buffer);
      view2.setUint8(0, 4);
      view2.setUint32(1, frame_obj.stream_id, true);
      view2.setUint8(5, frame_obj.reason);
      break;
    default:
      dbg_log("Client tried to send unknown packet: " + frame_obj.type, LOG_NET);
  }
  this.send_packet(full_packet, frame_obj.type, frame_obj.stream_id);
};
WispNetworkAdapter.prototype.destroy = function() {
  if (this.wispws) {
    this.wispws.onmessage = null;
    this.wispws.onclose = null;
    this.wispws.close();
    this.wispws = null;
  }
};
WispNetworkAdapter.prototype.on_tcp_connection = function(conn, packet) {
  conn.stream_id = this.last_stream++;
  conn.on("data", (data) => {
    if (data.length !== 0) {
      this.send_wisp_frame({
        type: "DATA",
        stream_id: conn.stream_id,
        data
      });
    }
  });
  conn.on_close = () => {
    this.send_wisp_frame({
      type: "CLOSE",
      stream_id: conn.stream_id,
      reason: 2
      // 0x02: Voluntary stream closure
    });
  };
  conn.on_shutdown = conn.on_close;
  this.send_wisp_frame({
    type: "CONNECT",
    stream_id: conn.stream_id,
    hostname: packet.ipv4.dest.join("."),
    port: conn.sport,
    data_callback: (data) => {
      conn.write(data);
    },
    close_callback: (data) => {
      conn.close();
    }
  });
  conn.accept();
  return true;
};
WispNetworkAdapter.prototype.send = function(data) {
  handle_fake_networking(data, this);
};
WispNetworkAdapter.prototype.receive = function(data) {
  this.bus.send("net" + this.id + "-receive", new Uint8Array(data));
};

// src/browser/keyboard.js
var SHIFT_SCAN_CODE = 42;
var SCAN_CODE_RELEASE = 128;
var PLATFOM_WINDOWS = typeof window !== "undefined" && window.navigator.platform.toString().toLowerCase().search("win") >= 0;
function KeyboardAdapter(bus) {
  var keys_pressed = {}, deferred_event = null, deferred_keydown = false, deferred_timeout_id = 0, keyboard = this;
  this.emu_enabled = true;
  const charmap = new Uint16Array([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0x08: backspace, tab, enter
    14,
    15,
    0,
    0,
    0,
    28,
    0,
    0,
    // 0x10: shift, ctrl, alt, pause, caps lock
    42,
    29,
    56,
    0,
    58,
    0,
    0,
    0,
    // 0x18: escape
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    // 0x20: spacebar, page down/up, end, home, arrow keys, ins, del
    57,
    57417,
    57425,
    57423,
    57415,
    57419,
    57416,
    57421,
    80,
    0,
    0,
    0,
    0,
    82,
    83,
    0,
    // 0x30: numbers
    11,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    // 0x3B: ;= (firefox only)
    0,
    39,
    0,
    13,
    0,
    0,
    // 0x40
    0,
    // 0x41: letters
    30,
    48,
    46,
    32,
    18,
    33,
    34,
    35,
    23,
    36,
    37,
    38,
    50,
    49,
    24,
    25,
    16,
    19,
    31,
    20,
    22,
    47,
    17,
    45,
    21,
    44,
    // 0x5B: Left Win, Right Win, Menu
    57435,
    57436,
    57437,
    0,
    0,
    // 0x60: keypad
    82,
    79,
    80,
    81,
    75,
    76,
    77,
    71,
    72,
    73,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0x70: F1 to F12
    59,
    60,
    61,
    62,
    63,
    64,
    65,
    66,
    67,
    68,
    87,
    88,
    0,
    0,
    0,
    0,
    // 0x80
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0x90: Numlock
    69,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0xA0: - (firefox only)
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    12,
    0,
    0,
    // 0xB0
    // ,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    39,
    13,
    51,
    12,
    52,
    53,
    // 0xC0
    // `
    41,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0xD0
    // [']\
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    26,
    43,
    27,
    40,
    0,
    // 0xE0
    // Apple key on Gecko, Right alt
    57435,
    57400,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ]);
  const asciimap = { 8: 8, 10: 13, 32: 32, 39: 222, 44: 188, 45: 189, 46: 190, 47: 191, 48: 48, 49: 49, 50: 50, 51: 51, 52: 52, 53: 53, 54: 54, 55: 55, 56: 56, 57: 57, 59: 186, 61: 187, 91: 219, 92: 220, 93: 221, 96: 192, 97: 65, 98: 66, 99: 67, 100: 68, 101: 69, 102: 70, 103: 71, 104: 72, 105: 73, 106: 74, 107: 75, 108: 76, 109: 77, 110: 78, 111: 79, 112: 80, 113: 81, 114: 82, 115: 83, 116: 84, 117: 85, 118: 86, 119: 87, 120: 88, 121: 89, 122: 90 };
  const asciimap_shift = { 33: 49, 34: 222, 35: 51, 36: 52, 37: 53, 38: 55, 40: 57, 41: 48, 42: 56, 43: 187, 58: 186, 60: 188, 62: 190, 63: 191, 64: 50, 65: 65, 66: 66, 67: 67, 68: 68, 69: 69, 70: 70, 71: 71, 72: 72, 73: 73, 74: 74, 75: 75, 76: 76, 77: 77, 78: 78, 79: 79, 80: 80, 81: 81, 82: 82, 83: 83, 84: 84, 85: 85, 86: 86, 87: 87, 88: 88, 89: 89, 90: 90, 94: 54, 95: 189, 123: 219, 124: 220, 125: 221, 126: 192 };
  var codemap = {
    "Escape": 1,
    "Digit1": 2,
    "Digit2": 3,
    "Digit3": 4,
    "Digit4": 5,
    "Digit5": 6,
    "Digit6": 7,
    "Digit7": 8,
    "Digit8": 9,
    "Digit9": 10,
    "Digit0": 11,
    "Minus": 12,
    "Equal": 13,
    "Backspace": 14,
    "Tab": 15,
    "KeyQ": 16,
    "KeyW": 17,
    "KeyE": 18,
    "KeyR": 19,
    "KeyT": 20,
    "KeyY": 21,
    "KeyU": 22,
    "KeyI": 23,
    "KeyO": 24,
    "KeyP": 25,
    "BracketLeft": 26,
    "BracketRight": 27,
    "Enter": 28,
    "ControlLeft": 29,
    "KeyA": 30,
    "KeyS": 31,
    "KeyD": 32,
    "KeyF": 33,
    "KeyG": 34,
    "KeyH": 35,
    "KeyJ": 36,
    "KeyK": 37,
    "KeyL": 38,
    "Semicolon": 39,
    "Quote": 40,
    "Backquote": 41,
    "ShiftLeft": 42,
    "Backslash": 43,
    "KeyZ": 44,
    "KeyX": 45,
    "KeyC": 46,
    "KeyV": 47,
    "KeyB": 48,
    "KeyN": 49,
    "KeyM": 50,
    "Comma": 51,
    "Period": 52,
    "Slash": 53,
    "IntlRo": 53,
    "ShiftRight": 54,
    "NumpadMultiply": 55,
    "AltLeft": 56,
    "Space": 57,
    "CapsLock": 58,
    "F1": 59,
    "F2": 60,
    "F3": 61,
    "F4": 62,
    "F5": 63,
    "F6": 64,
    "F7": 65,
    "F8": 66,
    "F9": 67,
    "F10": 68,
    "NumLock": 69,
    "ScrollLock": 70,
    "Numpad7": 71,
    "Numpad8": 72,
    "Numpad9": 73,
    "NumpadSubtract": 74,
    "Numpad4": 75,
    "Numpad5": 76,
    "Numpad6": 77,
    "NumpadAdd": 78,
    "Numpad1": 79,
    "Numpad2": 80,
    "Numpad3": 81,
    "Numpad0": 82,
    "NumpadDecimal": 83,
    "IntlBackslash": 86,
    "F11": 87,
    "F12": 88,
    "NumpadEnter": 57372,
    "ControlRight": 57373,
    "NumpadDivide": 57397,
    //"PrintScreen": 0x0063,
    "AltRight": 57400,
    "Home": 57415,
    "ArrowUp": 57416,
    "PageUp": 57417,
    "ArrowLeft": 57419,
    "ArrowRight": 57421,
    "End": 57423,
    "ArrowDown": 57424,
    "PageDown": 57425,
    "Insert": 57426,
    "Delete": 57427,
    "MetaLeft": 57435,
    "OSLeft": 57435,
    "MetaRight": 57436,
    "OSRight": 57436,
    "ContextMenu": 57437
  };
  this.bus = bus;
  this.destroy = function() {
    if (typeof window !== "undefined") {
      window.removeEventListener("keyup", keyup_handler, false);
      window.removeEventListener("keydown", keydown_handler, false);
      window.removeEventListener("blur", blur_handler, false);
      window.removeEventListener("input", input_handler, false);
    }
  };
  this.init = function() {
    if (typeof window === "undefined") {
      return;
    }
    this.destroy();
    window.addEventListener("keyup", keyup_handler, false);
    window.addEventListener("keydown", keydown_handler, false);
    window.addEventListener("blur", blur_handler, false);
    window.addEventListener("input", input_handler, false);
  };
  this.init();
  this.simulate_press = function(code) {
    var ev = { keyCode: code };
    handler(ev, true);
    handler(ev, false);
  };
  this.simulate_char = function(chr) {
    var code = chr.charCodeAt(0);
    if (code in asciimap) {
      this.simulate_press(asciimap[code]);
    } else if (code in asciimap_shift) {
      send_to_controller(SHIFT_SCAN_CODE);
      this.simulate_press(asciimap_shift[code]);
      send_to_controller(SHIFT_SCAN_CODE | SCAN_CODE_RELEASE);
    } else {
      console.log("ascii -> keyCode not found: ", code, chr);
    }
  };
  function may_handle(e) {
    if (e.shiftKey && e.ctrlKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 75)) {
      return false;
    }
    if (!keyboard.emu_enabled) {
      return false;
    }
    if (e.target) {
      return e.target.classList.contains("phone_keyboard") || e.target.nodeName !== "INPUT" && e.target.nodeName !== "TEXTAREA";
    } else {
      return true;
    }
  }
  function translate(e) {
    if (e.code !== void 0) {
      var code = codemap[e.code];
      if (code !== void 0) {
        return code;
      }
    }
    return charmap[e.keyCode];
  }
  function keyup_handler(e) {
    if (!e.altKey && keys_pressed[56]) {
      handle_code(56, false);
    }
    return handler(e, false);
  }
  function keydown_handler(e) {
    if (!e.altKey && keys_pressed[56]) {
      handle_code(56, false);
    }
    return handler(e, true);
  }
  function blur_handler(e) {
    var keys = Object.keys(keys_pressed), key;
    for (var i = 0; i < keys.length; i++) {
      key = +keys[i];
      if (keys_pressed[key]) {
        handle_code(key, false);
      }
    }
    keys_pressed = {};
  }
  function input_handler(e) {
    if (!keyboard.bus) {
      return;
    }
    if (!may_handle(e)) {
      return;
    }
    switch (e.inputType) {
      case "insertText":
        for (var i = 0; i < e.data.length; i++) {
          keyboard.simulate_char(e.data[i]);
        }
        break;
      case "insertLineBreak":
        keyboard.simulate_press(13);
        break;
      case "deleteContentBackward":
        keyboard.simulate_press(8);
        break;
    }
  }
  function handler(e, keydown) {
    if (!keyboard.bus) {
      return;
    }
    if (!may_handle(e)) {
      return;
    }
    if (e.code === "" || e.key === "Process" || e.key === "Unidentified" || e.keyCode === 229) {
      return;
    }
    e.preventDefault && e.preventDefault();
    if (PLATFOM_WINDOWS) {
      if (deferred_event) {
        clearTimeout(deferred_timeout_id);
        if (!(e.getModifierState && e.getModifierState("AltGraph") && deferred_keydown === keydown && deferred_event.code === "ControlLeft" && e.code === "AltRight")) {
          handle_event(deferred_event, deferred_keydown);
        }
        deferred_event = null;
      }
      if (e.code === "ControlLeft") {
        deferred_event = e;
        deferred_keydown = keydown;
        deferred_timeout_id = setTimeout(() => {
          handle_event(deferred_event, deferred_keydown);
          deferred_event = null;
        }, 10);
        return false;
      }
    }
    handle_event(e, keydown);
    return false;
  }
  function handle_event(e, keydown) {
    var code = translate(e);
    if (!code) {
      console.log("Missing char in map: keyCode=" + (e.keyCode || -1).toString(16) + " code=" + e.code);
      return;
    }
    handle_code(code, keydown, e.repeat);
  }
  function handle_code(code, keydown, is_repeat) {
    if (keydown) {
      if (keys_pressed[code] && !is_repeat) {
        handle_code(code, false);
      }
    } else {
      if (!keys_pressed[code]) {
        return;
      }
    }
    keys_pressed[code] = keydown;
    if (!keydown) {
      code |= 128;
    }
    if (code > 255) {
      send_to_controller(code >> 8);
      send_to_controller(code & 255);
    } else {
      send_to_controller(code);
    }
  }
  function send_to_controller(code) {
    keyboard.bus.send("keyboard-code", code);
  }
}

// src/browser/mouse.js
function MouseAdapter(bus, screen_container) {
  const SPEED_FACTOR = 1;
  var left_down = false, right_down = false, middle_down = false, last_x = 0, last_y = 0, mouse = this;
  this.enabled = false;
  this.emu_enabled = true;
  this.bus = bus;
  this.bus.register("mouse-enable", function(enabled) {
    this.enabled = enabled;
  }, this);
  this.is_running = false;
  this.bus.register("emulator-stopped", function() {
    this.is_running = false;
  }, this);
  this.bus.register("emulator-started", function() {
    this.is_running = true;
  }, this);
  this.destroy = function() {
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("touchstart", touch_start_handler, false);
    window.removeEventListener("touchend", touch_end_handler, false);
    window.removeEventListener("touchmove", mousemove_handler, false);
    window.removeEventListener("mousemove", mousemove_handler, false);
    window.removeEventListener("mousedown", mousedown_handler, false);
    window.removeEventListener("mouseup", mouseup_handler, false);
    window.removeEventListener("wheel", mousewheel_handler, { passive: false });
  };
  this.init = function() {
    if (typeof window === "undefined") {
      return;
    }
    this.destroy();
    window.addEventListener("touchstart", touch_start_handler, false);
    window.addEventListener("touchend", touch_end_handler, false);
    window.addEventListener("touchmove", mousemove_handler, false);
    window.addEventListener("mousemove", mousemove_handler, false);
    window.addEventListener("mousedown", mousedown_handler, false);
    window.addEventListener("mouseup", mouseup_handler, false);
    window.addEventListener("wheel", mousewheel_handler, { passive: false });
  };
  this.init();
  function is_child(child, parent) {
    while (child.parentNode) {
      if (child === parent) {
        return true;
      }
      child = child.parentNode;
    }
    return false;
  }
  function may_handle(e) {
    if (!mouse.enabled || !mouse.emu_enabled) {
      return false;
    }
    const MOVE_MOUSE_WHEN_OVER_SCREEN_ONLY = true;
    if (MOVE_MOUSE_WHEN_OVER_SCREEN_ONLY) {
      var parent = screen_container || document.body;
      return document.pointerLockElement || is_child(e.target, parent);
    } else {
      if (e.type === "mousemove" || e.type === "touchmove") {
        return true;
      }
      if (e.type === "mousewheel" || e.type === "DOMMouseScroll") {
        return is_child(e.target, parent);
      }
      return !e.target || e.target.nodeName !== "INPUT" && e.target.nodeName !== "TEXTAREA";
    }
  }
  function touch_start_handler(e) {
    if (may_handle(e)) {
      var touches = e["changedTouches"];
      if (touches && touches.length) {
        var touch = touches[touches.length - 1];
        last_x = touch.clientX;
        last_y = touch.clientY;
      }
    }
  }
  function touch_end_handler(e) {
    if (left_down || middle_down || right_down) {
      mouse.bus.send("mouse-click", [false, false, false]);
      left_down = middle_down = right_down = false;
    }
  }
  function mousemove_handler(e) {
    if (!mouse.bus) {
      return;
    }
    if (!may_handle(e)) {
      return;
    }
    if (!mouse.is_running) {
      return;
    }
    var delta_x = 0;
    var delta_y = 0;
    var touches = e["changedTouches"];
    if (touches) {
      if (touches.length) {
        var touch = touches[touches.length - 1];
        delta_x = touch.clientX - last_x;
        delta_y = touch.clientY - last_y;
        last_x = touch.clientX;
        last_y = touch.clientY;
        e.preventDefault();
      }
    } else {
      if (typeof e["movementX"] === "number") {
        delta_x = e["movementX"];
        delta_y = e["movementY"];
      } else if (typeof e["webkitMovementX"] === "number") {
        delta_x = e["webkitMovementX"];
        delta_y = e["webkitMovementY"];
      } else if (typeof e["mozMovementX"] === "number") {
        delta_x = e["mozMovementX"];
        delta_y = e["mozMovementY"];
      } else {
        delta_x = e.clientX - last_x;
        delta_y = e.clientY - last_y;
        last_x = e.clientX;
        last_y = e.clientY;
      }
    }
    delta_x *= SPEED_FACTOR;
    delta_y *= SPEED_FACTOR;
    delta_y = -delta_y;
    mouse.bus.send("mouse-delta", [delta_x, delta_y]);
    if (screen_container) {
      const absolute_x = e.pageX - screen_container.offsetLeft;
      const absolute_y = e.pageY - screen_container.offsetTop;
      mouse.bus.send("mouse-absolute", [
        absolute_x,
        absolute_y,
        screen_container.offsetWidth,
        screen_container.offsetHeight
      ]);
    }
  }
  function mousedown_handler(e) {
    if (may_handle(e)) {
      click_event(e, true);
    }
  }
  function mouseup_handler(e) {
    if (may_handle(e)) {
      click_event(e, false);
    }
  }
  function click_event(e, down) {
    if (!mouse.bus) {
      return;
    }
    if (e.which === 1) {
      left_down = down;
    } else if (e.which === 2) {
      middle_down = down;
    } else if (e.which === 3) {
      right_down = down;
    } else {
      dbg_log("Unknown event.which: " + e.which);
    }
    mouse.bus.send("mouse-click", [left_down, middle_down, right_down]);
    e.preventDefault();
  }
  function mousewheel_handler(e) {
    if (!may_handle(e)) {
      return;
    }
    var delta_x = e.wheelDelta || -e.detail;
    var delta_y = 0;
    if (delta_x < 0) {
      delta_x = -1;
    } else if (delta_x > 0) {
      delta_x = 1;
    }
    mouse.bus.send("mouse-wheel", [delta_x, delta_y]);
    e.preventDefault();
  }
}

// src/browser/serial.js
function TextAreaAdapter(element) {
  var serial = this;
  this.enabled = true;
  this.text = "";
  this.text_new_line = false;
  this.last_update = 0;
  this.destroy = function() {
    this.enabled = false;
    element.removeEventListener("keypress", keypress_handler, false);
    element.removeEventListener("keydown", keydown_handler, false);
    element.removeEventListener("paste", paste_handler, false);
    window.removeEventListener("mousedown", window_click_handler, false);
  };
  this.init = function() {
    this.destroy();
    this.enabled = true;
    element.style.display = "block";
    element.addEventListener("keypress", keypress_handler, false);
    element.addEventListener("keydown", keydown_handler, false);
    element.addEventListener("paste", paste_handler, false);
    window.addEventListener("mousedown", window_click_handler, false);
  };
  this.init();
  this.show_char = function(chr) {
    if (chr === "\b") {
      this.text = this.text.slice(0, -1);
      this.update();
    } else if (chr === "\r") {
    } else {
      this.text += chr;
      if (chr === "\n") {
        this.text_new_line = true;
      }
      this.update();
    }
  };
  this.update = function() {
    var now = Date.now();
    var delta = now - this.last_update;
    if (delta < 16) {
      if (this.update_timer === void 0) {
        this.update_timer = setTimeout(() => {
          this.update_timer = void 0;
          var now2 = Date.now();
          dbg_assert(now2 - this.last_update >= 15);
          this.last_update = now2;
          this.render();
        }, 16 - delta);
      }
    } else {
      if (this.update_timer !== void 0) {
        clearTimeout(this.update_timer);
        this.update_timer = void 0;
      }
      this.last_update = now;
      this.render();
    }
  };
  this.render = function() {
    element.value = this.text;
    if (this.text_new_line) {
      this.text_new_line = false;
      element.scrollTop = 1e9;
    }
  };
  this.send_char = function(chr_code) {
  };
  function may_handle(e) {
    if (!serial.enabled) {
      return false;
    }
    return true;
  }
  function keypress_handler(e) {
    if (!may_handle(e)) {
      return;
    }
    var chr = e.which;
    serial.send_char(chr);
    e.preventDefault();
  }
  function keydown_handler(e) {
    var chr = e.which;
    if (chr === 8) {
      serial.send_char(127);
      e.preventDefault();
    } else if (chr === 9) {
      serial.send_char(9);
      e.preventDefault();
    }
  }
  function paste_handler(e) {
    if (!may_handle(e)) {
      return;
    }
    var data = e.clipboardData.getData("text/plain");
    for (var i = 0; i < data.length; i++) {
      serial.send_char(data.charCodeAt(i));
    }
    e.preventDefault();
  }
  function window_click_handler(e) {
    if (e.target !== element) {
      element.blur();
    }
  }
}
function SerialAdapter(element, bus) {
  var adapter = Reflect.construct(TextAreaAdapter, [element], SerialAdapter);
  adapter.send_char = function(chr_code) {
    bus.send("serial0-input", chr_code);
  };
  bus.register("serial0-output-byte", function(byte) {
    var chr = String.fromCharCode(byte);
    adapter.show_char && adapter.show_char(chr);
  }, adapter);
  return adapter;
}
Reflect.setPrototypeOf(SerialAdapter.prototype, TextAreaAdapter.prototype);
Reflect.setPrototypeOf(SerialAdapter, TextAreaAdapter);
function VirtioConsoleAdapter(element, bus) {
  var adapter = Reflect.construct(TextAreaAdapter, [element], VirtioConsoleAdapter);
  adapter.send_char = function(chr_code) {
    bus.send("virtio-console0-input-bytes", new Uint8Array([chr_code]));
  };
  const decoder = new TextDecoder();
  bus.register("virtio-console0-output-bytes", function(bytes) {
    for (const chr of decoder.decode(bytes)) {
      adapter.show_char && adapter.show_char(chr);
    }
  }, adapter);
  return adapter;
}
Reflect.setPrototypeOf(VirtioConsoleAdapter.prototype, TextAreaAdapter.prototype);
Reflect.setPrototypeOf(VirtioConsoleAdapter, TextAreaAdapter);
function XtermJSAdapter(element, xterm_lib) {
  this.element = element;
  var term = this.term = new xterm_lib({
    "logLevel": "off",
    "convertEol": "true"
  });
  this.destroy = function() {
    this.on_data_disposable && this.on_data_disposable["dispose"]();
    term["dispose"]();
  };
}
XtermJSAdapter.prototype.show = function() {
  this.term && this.term.open(this.element);
};
function SerialAdapterXtermJS(element, bus, xterm_lib) {
  if (!xterm_lib) {
    return;
  }
  var adapter = Reflect.construct(XtermJSAdapter, [element, xterm_lib], SerialAdapterXtermJS);
  bus.register("serial0-output-byte", function(utf8_byte) {
    adapter.term.write(Uint8Array.of(utf8_byte));
  }, adapter);
  const utf8_encoder = new TextEncoder();
  adapter.on_data_disposable = adapter.term["onData"](function(data_str) {
    for (const utf8_byte of utf8_encoder.encode(data_str)) {
      bus.send("serial0-input", utf8_byte);
    }
  });
  return adapter;
}
Reflect.setPrototypeOf(SerialAdapterXtermJS.prototype, XtermJSAdapter.prototype);
Reflect.setPrototypeOf(SerialAdapterXtermJS, XtermJSAdapter);
function VirtioConsoleAdapterXtermJS(element, bus, xterm_lib) {
  if (!xterm_lib) {
    return;
  }
  var adapter = Reflect.construct(XtermJSAdapter, [element, xterm_lib], VirtioConsoleAdapterXtermJS);
  bus.register("virtio-console0-output-bytes", function(utf8_bytes) {
    adapter.term.write(utf8_bytes);
  }, adapter);
  const utf8_encoder = new TextEncoder();
  adapter.on_data_disposable = adapter.term["onData"](function(data_str) {
    bus.send("virtio-console0-input-bytes", utf8_encoder.encode(data_str));
  });
  return adapter;
}
Reflect.setPrototypeOf(VirtioConsoleAdapterXtermJS.prototype, XtermJSAdapter.prototype);
Reflect.setPrototypeOf(VirtioConsoleAdapterXtermJS, XtermJSAdapter);

// src/browser/inbrowser_network.js
function InBrowserNetworkAdapter(bus, config) {
  const id = config.id || 0;
  this.bus = bus;
  this.bus_send_msgid = `net${id}-send`;
  this.bus_recv_msgid = `net${id}-receive`;
  this.channel = new BroadcastChannel(`v86-inbrowser-${id}`);
  this.is_open = true;
  this.nic_to_hub_fn = (eth_frame) => {
    this.channel.postMessage(eth_frame);
  };
  this.bus.register(this.bus_send_msgid, this.nic_to_hub_fn, this);
  this.hub_to_nic_fn = (ev) => {
    this.bus.send(this.bus_recv_msgid, ev.data);
  };
  this.channel.addEventListener("message", this.hub_to_nic_fn);
}
InBrowserNetworkAdapter.prototype.destroy = function() {
  if (this.is_open) {
    this.bus.unregister(this.bus_send_msgid, this.nic_to_hub_fn);
    this.channel.removeEventListener("message", this.hub_to_nic_fn);
    this.channel.close();
    this.is_open = false;
  }
};

// src/browser/starter.js
function V86(options) {
  if (typeof options.log_level === "number") {
    set_log_level(options.log_level);
  }
  this.cpu_is_running = false;
  this.cpu_exception_hook = function(n) {
  };
  const bus = Bus.create();
  this.bus = bus[0];
  this.emulator_bus = bus[1];
  var cpu;
  var wasm_memory;
  const wasm_table = new WebAssembly.Table({ element: "anyfunc", initial: WASM_TABLE_SIZE + WASM_TABLE_OFFSET });
  const wasm_shared_funcs = {
    "cpu_exception_hook": (n) => this.cpu_exception_hook(n),
    "run_hardware_timers": function(a, t) {
      return cpu.run_hardware_timers(a, t);
    },
    "cpu_event_halt": () => {
      this.emulator_bus.send("cpu-event-halt");
    },
    "abort": function() {
      dbg_assert(false);
    },
    "microtick": v86.microtick,
    "get_rand_int": function() {
      return get_rand_int();
    },
    "stop_idling": function() {
      return cpu.stop_idling();
    },
    "io_port_read8": function(addr) {
      return cpu.io.port_read8(addr);
    },
    "io_port_read16": function(addr) {
      return cpu.io.port_read16(addr);
    },
    "io_port_read32": function(addr) {
      return cpu.io.port_read32(addr);
    },
    "io_port_write8": function(addr, value) {
      cpu.io.port_write8(addr, value);
    },
    "io_port_write16": function(addr, value) {
      cpu.io.port_write16(addr, value);
    },
    "io_port_write32": function(addr, value) {
      cpu.io.port_write32(addr, value);
    },
    "mmap_read8": function(addr) {
      return cpu.mmap_read8(addr);
    },
    "mmap_read32": function(addr) {
      return cpu.mmap_read32(addr);
    },
    "mmap_write8": function(addr, value) {
      cpu.mmap_write8(addr, value);
    },
    "mmap_write16": function(addr, value) {
      cpu.mmap_write16(addr, value);
    },
    "mmap_write32": function(addr, value) {
      cpu.mmap_write32(addr, value);
    },
    "mmap_write64": function(addr, value0, value1) {
      cpu.mmap_write64(addr, value0, value1);
    },
    "mmap_write128": function(addr, value0, value1, value2, value3) {
      cpu.mmap_write128(addr, value0, value1, value2, value3);
    },
    // Demand-paging hook: called from do_page_walk when GPA >= PAGED_THRESHOLD.
    // Delegates to cpu._swap_page_in_hook (set by do86/linux-vm.ts after emulator-loaded).
    // for_writing: non-zero when the TLB entry is for a write — page store marks it dirty.
    // Returns the WASM byte offset of the hot frame, or -1 if paging is not enabled.
    "swap_page_in": function(gpa, for_writing) {
      return cpu.swap_page_in(gpa, for_writing);
    },
    "log_from_wasm": function(offset, len) {
      const str = read_sized_string_from_mem(wasm_memory, offset, len);
      dbg_log(str, LOG_CPU);
    },
    "console_log_from_wasm": function(offset, len) {
      const str = read_sized_string_from_mem(wasm_memory, offset, len);
      console.error(str);
    },
    "dbg_trace_from_wasm": function() {
      dbg_trace(LOG_CPU);
    },
    "codegen_finalize": (wasm_table_index, start, state_flags, ptr, len) => {
      cpu.codegen_finalize(wasm_table_index, start, state_flags, ptr, len);
    },
    "jit_clear_func": (wasm_table_index) => cpu.jit_clear_func(wasm_table_index),
    "jit_clear_all_funcs": () => cpu.jit_clear_all_funcs(),
    "__indirect_function_table": wasm_table
  };
  let wasm_fn = options.wasm_fn;
  if (!wasm_fn) {
    wasm_fn = (env) => {
      return new Promise((resolve) => {
        let v86_bin = false ? "v86-debug.wasm" : "v86.wasm";
        let v86_bin_fallback = "v86-fallback.wasm";
        if (options.wasm_path) {
          v86_bin = options.wasm_path;
          v86_bin_fallback = v86_bin.replace("v86.wasm", "v86-fallback.wasm");
        } else if (typeof window === "undefined" && typeof __dirname === "string") {
          v86_bin = __dirname + "/" + v86_bin;
          v86_bin_fallback = __dirname + "/" + v86_bin_fallback;
        } else {
          v86_bin = "build/" + v86_bin;
          v86_bin_fallback = "build/" + v86_bin_fallback;
        }
        load_file(v86_bin, {
          done: async (bytes) => {
            try {
              const { instance } = await WebAssembly.instantiate(bytes, env);
              this.wasm_source = bytes;
              resolve(instance.exports);
            } catch (err) {
              load_file(v86_bin_fallback, {
                done: async (bytes2) => {
                  const { instance } = await WebAssembly.instantiate(bytes2, env);
                  this.wasm_source = bytes2;
                  resolve(instance.exports);
                }
              });
            }
          },
          progress: (e) => {
            this.emulator_bus.send("download-progress", {
              file_index: 0,
              file_count: 1,
              file_name: v86_bin,
              lengthComputable: e.lengthComputable,
              total: e.total,
              loaded: e.loaded
            });
          }
        });
      });
    };
  }
  wasm_fn({ "env": wasm_shared_funcs }).then((exports) => {
    wasm_memory = exports.memory;
    exports["rust_init"]();
    const emulator = this.v86 = new v86(this.emulator_bus, { exports, wasm_table });
    cpu = emulator.cpu;
    this.continue_init(emulator, options);
  });
  this.zstd_worker = null;
  this.zstd_worker_request_id = 0;
}
V86.prototype.continue_init = async function(emulator, options) {
  this.bus.register("emulator-stopped", function() {
    this.cpu_is_running = false;
    this.screen_adapter.pause();
  }, this);
  this.bus.register("emulator-started", function() {
    this.cpu_is_running = true;
    this.screen_adapter.continue();
  }, this);
  var settings = {};
  const boot_order = options.boot_order ? options.boot_order : options.fda ? BOOT_ORDER_FD_FIRST : options.hda ? BOOT_ORDER_HD_FIRST : BOOT_ORDER_CD_FIRST;
  settings.acpi = options.acpi;
  settings.ahci_disk_size = options.ahci_disk_size;
  settings.disable_jit = options.disable_jit;
  settings.load_devices = true;
  settings.memory_size = options.memory_size || 64 * 1024 * 1024;
  settings.vga_memory_size = options.vga_memory_size || 8 * 1024 * 1024;
  settings.logical_memory_size = options.logical_memory_size || settings.memory_size;
  settings.boot_order = boot_order;
  settings.fastboot = options.fastboot || false;
  settings.fda = void 0;
  settings.fdb = void 0;
  settings.uart1 = options.uart1;
  settings.uart2 = options.uart2;
  settings.uart3 = options.uart3;
  settings.cmdline = options.cmdline;
  settings.preserve_mac_from_state_image = options.preserve_mac_from_state_image;
  settings.mac_address_translation = options.mac_address_translation;
  settings.cpuid_level = options.cpuid_level;
  settings.virtio_balloon = options.virtio_balloon;
  settings.virtio_console = !!options.virtio_console;
  const relay_url = options.network_relay_url || options.net_device && options.net_device.relay_url;
  if (relay_url) {
    if (relay_url === "fetch") {
      this.network_adapter = new FetchNetworkAdapter(this.bus, options.net_device);
    } else if (relay_url === "inbrowser") {
      this.network_adapter = new InBrowserNetworkAdapter(this.bus, options.net_device);
    } else if (relay_url.startsWith("wisp://") || relay_url.startsWith("wisps://")) {
      this.network_adapter = new WispNetworkAdapter(relay_url, this.bus, options.net_device);
    } else {
      this.network_adapter = new NetworkAdapter(relay_url, this.bus);
    }
  }
  settings.net_device = options.net_device || { type: "ne2k" };
  const screen_options = options.screen || {};
  if (options.screen_container) {
    screen_options.container = options.screen_container;
  }
  if (!options.disable_keyboard) {
    this.keyboard_adapter = new KeyboardAdapter(this.bus);
  }
  if (!options.disable_mouse) {
    this.mouse_adapter = new MouseAdapter(this.bus, screen_options.container);
  }
  if (screen_options.container) {
    this.screen_adapter = new ScreenAdapter(screen_options, () => this.v86.cpu.devices.vga && this.v86.cpu.devices.vga.screen_fill_buffer());
  } else {
    this.screen_adapter = new DummyScreenAdapter(screen_options);
  }
  settings.screen = this.screen_adapter;
  settings.screen_options = screen_options;
  settings.serial_console = options.serial_console || { type: "none" };
  if (options.serial_container_xtermjs) {
    settings.serial_console.type = "xtermjs";
    settings.serial_console.container = options.serial_container_xtermjs;
  } else if (options.serial_container) {
    settings.serial_console.type = "textarea";
    settings.serial_console.container = options.serial_container;
  }
  if (settings.serial_console?.type === "xtermjs") {
    const xterm_lib = settings.serial_console.xterm_lib || window["Terminal"];
    this.serial_adapter = new SerialAdapterXtermJS(settings.serial_console.container, this.bus, xterm_lib);
  } else if (settings.serial_console?.type === "textarea") {
    this.serial_adapter = new SerialAdapter(settings.serial_console.container, this.bus);
  }
  const virtio_console_settings = options.virtio_console && typeof options.virtio_console === "boolean" ? { type: "none" } : options.virtio_console;
  if (virtio_console_settings?.type === "xtermjs") {
    const xterm_lib = virtio_console_settings.xterm_lib || window["Terminal"];
    this.virtio_console_adapter = new VirtioConsoleAdapterXtermJS(virtio_console_settings.container, this.bus, xterm_lib);
  } else if (virtio_console_settings?.type === "textarea") {
    this.virtio_console_adapter = new VirtioConsoleAdapter(virtio_console_settings.container, this.bus);
  }
  if (!options.disable_speaker) {
    this.speaker_adapter = new SpeakerAdapter(this.bus);
  }
  function put_on_settings(name, buffer) {
    switch (name) {
      case "hda":
        settings.hda = buffer;
        break;
      case "hdb":
        settings.hdb = buffer;
        break;
      case "cdrom":
        settings.cdrom = buffer;
        break;
      case "fda":
        settings.fda = buffer;
        break;
      case "fdb":
        settings.fdb = buffer;
        break;
      case "multiboot":
        settings.multiboot = buffer.buffer;
        break;
      case "bzimage":
        settings.bzimage = buffer.buffer;
        break;
      case "initrd":
        settings.initrd = buffer.buffer;
        break;
      case "bios":
        settings.bios = buffer.buffer;
        break;
      case "vga_bios":
        settings.vga_bios = buffer.buffer;
        break;
      case "initial_state":
        settings.initial_state = buffer.buffer;
        break;
      case "fs9p_json":
        settings.fs9p_json = buffer;
        break;
      default:
        dbg_assert(false, name);
    }
  }
  var files_to_load = [];
  const add_file = (name, file) => {
    if (!file) {
      return;
    }
    if (file.get && file.set && file.load) {
      files_to_load.push({
        name,
        loadable: file
      });
      return;
    }
    if (name === "bios" || name === "vga_bios" || name === "initial_state" || name === "multiboot" || name === "bzimage" || name === "initrd") {
      file.async = false;
    }
    if (name === "fda" || name === "fdb") {
      file.async = false;
    }
    if (file.url && !file.async) {
      files_to_load.push({
        name,
        url: file.url,
        size: file.size
      });
    } else {
      files_to_load.push({
        name,
        loadable: buffer_from_object(file, this.zstd_decompress_worker.bind(this))
      });
    }
  };
  if (options.state) {
    console.warn("Warning: Unknown option 'state'. Did you mean 'initial_state'?");
  }
  add_file("bios", options.bios);
  add_file("vga_bios", options.vga_bios);
  add_file("cdrom", options.cdrom);
  add_file("hda", options.hda);
  add_file("hdb", options.hdb);
  add_file("fda", options.fda);
  add_file("fdb", options.fdb);
  add_file("initial_state", options.initial_state);
  add_file("multiboot", options.multiboot);
  add_file("bzimage", options.bzimage);
  add_file("initrd", options.initrd);
  if (options.filesystem && options.filesystem.handle9p) {
    settings.handle9p = options.filesystem.handle9p;
  } else if (options.filesystem && options.filesystem.proxy_url) {
    settings.proxy9p = options.filesystem.proxy_url;
  } else if (options.filesystem) {
    var fs_url = options.filesystem.basefs;
    var base_url = options.filesystem.baseurl;
    let file_storage = new MemoryFileStorage();
    if (base_url) {
      file_storage = new ServerFileStorageWrapper(file_storage, base_url, this.zstd_decompress.bind(this));
    }
    settings.fs9p = this.fs9p = new FS(file_storage);
    if (fs_url) {
      dbg_assert(base_url, "Filesystem: baseurl must be specified");
      var size;
      if (typeof fs_url === "object") {
        size = fs_url.size;
        fs_url = fs_url.url;
      }
      dbg_assert(typeof fs_url === "string");
      files_to_load.push({
        name: "fs9p_json",
        url: fs_url,
        size,
        as_json: true
      });
    }
  }
  var starter = this;
  var total = files_to_load.length;
  var cont = function(index) {
    if (index === total) {
      Promise.resolve().then(done.bind(this));
      return;
    }
    var f = files_to_load[index];
    if (f.loadable) {
      f.loadable.onload = function(e) {
        put_on_settings.call(this, f.name, f.loadable);
        cont(index + 1);
      }.bind(this);
      f.loadable.load();
    } else {
      load_file(f.url, {
        done: function(result) {
          if (f.url.endsWith(".zst") && f.name !== "initial_state") {
            dbg_assert(f.size, "A size must be provided for compressed images");
            result = this.zstd_decompress(f.size, new Uint8Array(result));
          }
          put_on_settings.call(this, f.name, f.as_json ? result : new SyncBuffer(result));
          cont(index + 1);
        }.bind(this),
        progress: function progress(e) {
          if (e.target.status === 200) {
            starter.emulator_bus.send("download-progress", {
              file_index: index,
              file_count: total,
              file_name: f.url,
              lengthComputable: e.lengthComputable,
              total: e.total || f.size,
              loaded: e.loaded
            });
          } else {
            starter.emulator_bus.send("download-error", {
              file_index: index,
              file_count: total,
              file_name: f.url,
              request: e.target
            });
          }
        },
        as_json: f.as_json
      });
    }
  }.bind(this);
  cont(0);
  async function done() {
    if (settings.fs9p && settings.fs9p_json) {
      if (!settings.initial_state) {
        settings.fs9p.load_from_json(settings.fs9p_json);
        if (options.bzimage_initrd_from_filesystem) {
          const { bzimage_path, initrd_path } = this.get_bzimage_initrd_from_filesystem(settings.fs9p);
          dbg_log("Found bzimage: " + bzimage_path + " and initrd: " + initrd_path);
          const [initrd, bzimage] = await Promise.all([
            settings.fs9p.read_file(initrd_path),
            settings.fs9p.read_file(bzimage_path)
          ]);
          put_on_settings.call(this, "initrd", new SyncBuffer(initrd.buffer));
          put_on_settings.call(this, "bzimage", new SyncBuffer(bzimage.buffer));
        }
      } else {
        dbg_log("Filesystem basefs ignored: Overridden by state image");
      }
    } else {
      dbg_assert(
        !options.bzimage_initrd_from_filesystem || settings.initial_state,
        "bzimage_initrd_from_filesystem: Requires a filesystem"
      );
    }
    this.serial_adapter && this.serial_adapter.show && this.serial_adapter.show();
    this.virtio_console_adapter && this.virtio_console_adapter.show && this.virtio_console_adapter.show();
    this.v86.init(settings);
    if (settings.initial_state) {
      emulator.restore_state(settings.initial_state);
      settings.initial_state = void 0;
    }
    if (options.autostart) {
      this.v86.run();
    }
    this.emulator_bus.send("emulator-loaded");
  }
};
V86.prototype.zstd_decompress = function(decompressed_size, src) {
  const cpu = this.v86.cpu;
  dbg_assert(!this.zstd_context);
  this.zstd_context = cpu.zstd_create_ctx(src.length);
  new Uint8Array(cpu.wasm_memory.buffer).set(src, cpu.zstd_get_src_ptr(this.zstd_context));
  const ptr = cpu.zstd_read(this.zstd_context, decompressed_size);
  const result = cpu.wasm_memory.buffer.slice(ptr, ptr + decompressed_size);
  cpu.zstd_read_free(ptr, decompressed_size);
  cpu.zstd_free_ctx(this.zstd_context);
  this.zstd_context = null;
  return result;
};
V86.prototype.zstd_decompress_worker = async function(decompressed_size, src) {
  if (!this.zstd_worker) {
    let the_worker = function() {
      let wasm;
      globalThis.onmessage = function(e) {
        if (!wasm) {
          const env = Object.fromEntries([
            "cpu_exception_hook",
            "run_hardware_timers",
            "cpu_event_halt",
            "microtick",
            "get_rand_int",
            "stop_idling",
            "io_port_read8",
            "io_port_read16",
            "io_port_read32",
            "io_port_write8",
            "io_port_write16",
            "io_port_write32",
            "mmap_read8",
            "mmap_read32",
            "mmap_write8",
            "mmap_write16",
            "mmap_write32",
            "mmap_write64",
            "mmap_write128",
            "codegen_finalize",
            "jit_clear_func",
            "jit_clear_all_funcs"
          ].map((f) => [f, () => console.error("zstd worker unexpectedly called " + f)]));
          env["__indirect_function_table"] = new WebAssembly.Table({ element: "anyfunc", initial: 1024 });
          env["abort"] = () => {
            throw new Error("zstd worker aborted");
          };
          env["log_from_wasm"] = env["console_log_from_wasm"] = (off, len) => {
            console.log(read_sized_string_from_mem(wasm.exports.memory.buffer, off, len));
          };
          env["dbg_trace_from_wasm"] = () => console.trace();
          wasm = new WebAssembly.Instance(new WebAssembly.Module(e.data), { "env": env });
          return;
        }
        const { src: src2, decompressed_size: decompressed_size2, id } = e.data;
        const exports = wasm.exports;
        const zstd_context = exports["zstd_create_ctx"](src2.length);
        new Uint8Array(exports.memory.buffer).set(src2, exports["zstd_get_src_ptr"](zstd_context));
        const ptr = exports["zstd_read"](zstd_context, decompressed_size2);
        const result = exports.memory.buffer.slice(ptr, ptr + decompressed_size2);
        exports["zstd_read_free"](ptr, decompressed_size2);
        exports["zstd_free_ctx"](zstd_context);
        postMessage({ result, id }, [result]);
      };
    };
    const url = URL.createObjectURL(new Blob(["(" + the_worker.toString() + ")()"], { type: "text/javascript" }));
    this.zstd_worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.zstd_worker.postMessage(this.wasm_source, [this.wasm_source]);
  }
  return new Promise((resolve) => {
    const id = this.zstd_worker_request_id++;
    const done = async (e) => {
      if (e.data.id === id) {
        this.zstd_worker.removeEventListener("message", done);
        dbg_assert(decompressed_size === e.data.result.byteLength);
        resolve(e.data.result);
      }
    };
    this.zstd_worker.addEventListener("message", done);
    this.zstd_worker.postMessage({ src, decompressed_size, id }, [src.buffer]);
  });
};
V86.prototype.get_bzimage_initrd_from_filesystem = function(filesystem) {
  const root = (filesystem.read_dir("/") || []).map((x) => "/" + x);
  const boot = (filesystem.read_dir("/boot/") || []).map((x) => "/boot/" + x);
  let initrd_path;
  let bzimage_path;
  for (const f of [].concat(root, boot)) {
    const old = /old/i.test(f) || /fallback/i.test(f);
    const is_bzimage = /vmlinuz/i.test(f) || /bzimage/i.test(f);
    const is_initrd = /initrd/i.test(f) || /initramfs/i.test(f);
    if (is_bzimage && (!bzimage_path || !old)) {
      bzimage_path = f;
    }
    if (is_initrd && (!initrd_path || !old)) {
      initrd_path = f;
    }
  }
  if (!initrd_path || !bzimage_path) {
    console.log("Failed to find bzimage or initrd in filesystem. Files:");
    console.log(root.join(" "));
    console.log(boot.join(" "));
  }
  return { initrd_path, bzimage_path };
};
V86.prototype.run = async function() {
  this.v86.run();
};
V86.prototype.stop = async function() {
  if (!this.cpu_is_running) {
    return;
  }
  await new Promise((resolve) => {
    const listener = () => {
      this.remove_listener("emulator-stopped", listener);
      resolve();
    };
    this.add_listener("emulator-stopped", listener);
    this.v86.stop();
  });
};
V86.prototype.destroy = async function() {
  await this.stop();
  this.v86.destroy();
  this.keyboard_adapter && this.keyboard_adapter.destroy();
  this.network_adapter && this.network_adapter.destroy();
  this.mouse_adapter && this.mouse_adapter.destroy();
  this.screen_adapter && this.screen_adapter.destroy();
  this.serial_adapter && this.serial_adapter.destroy();
  this.speaker_adapter && this.speaker_adapter.destroy();
  this.virtio_console_adapter && this.virtio_console_adapter.destroy();
};
V86.prototype.restart = function() {
  this.v86.restart();
};
V86.prototype.add_listener = function(event, listener) {
  this.bus.register(event, listener, this);
};
V86.prototype.remove_listener = function(event, listener) {
  this.bus.unregister(event, listener);
};
V86.prototype.restore_state = async function(state) {
  dbg_assert(arguments.length === 1);
  this.v86.restore_state(state);
};
V86.prototype.save_state = async function() {
  dbg_assert(arguments.length === 0);
  return this.v86.save_state();
};
V86.prototype.get_instruction_counter = function() {
  if (this.v86) {
    return this.v86.cpu.instruction_counter[0] >>> 0;
  } else {
    return 0;
  }
};
V86.prototype.is_running = function() {
  return this.cpu_is_running;
};
V86.prototype.set_fda = async function(file) {
  const fda = this.v86.cpu.devices.fdc.drives[0];
  if (file.url && !file.async) {
    await new Promise((resolve) => {
      load_file(file.url, {
        done: (result) => {
          fda.insert_disk(new SyncBuffer(result));
          resolve();
        }
      });
    });
  } else {
    const image = buffer_from_object(file, this.zstd_decompress_worker.bind(this));
    image.onload = () => {
      fda.insert_disk(image);
    };
    await image.load();
  }
};
V86.prototype.set_fdb = async function(file) {
  const fdb = this.v86.cpu.devices.fdc.drives[1];
  if (file.url && !file.async) {
    await new Promise((resolve) => {
      load_file(file.url, {
        done: (result) => {
          fdb.insert_disk(new SyncBuffer(result));
          resolve();
        }
      });
    });
  } else {
    const image = buffer_from_object(file, this.zstd_decompress_worker.bind(this));
    image.onload = () => {
      fdb.insert_disk(image);
    };
    await image.load();
  }
};
V86.prototype.eject_fda = function() {
  this.v86.cpu.devices.fdc.drives[0].eject_disk();
};
V86.prototype.eject_fdb = function() {
  this.v86.cpu.devices.fdc.drives[1].eject_disk();
};
V86.prototype.get_disk_fda = function() {
  return this.v86.cpu.devices.fdc.drives[0].get_buffer();
};
V86.prototype.get_disk_fdb = function() {
  return this.v86.cpu.devices.fdc.drives[1].get_buffer();
};
V86.prototype.set_cdrom = async function(file) {
  if (file.url && !file.async) {
    load_file(file.url, {
      done: (result) => {
        this.v86.cpu.devices.cdrom.set_cdrom(new SyncBuffer(result));
      }
    });
  } else {
    const image = buffer_from_object(file, this.zstd_decompress_worker.bind(this));
    image.onload = () => {
      this.v86.cpu.devices.cdrom.set_cdrom(image);
    };
    await image.load();
  }
};
V86.prototype.eject_cdrom = function() {
  this.v86.cpu.devices.cdrom.eject();
};
V86.prototype.keyboard_send_scancodes = async function(codes, delay) {
  for (var i = 0; i < codes.length; i++) {
    this.bus.send("keyboard-code", codes[i]);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }
};
V86.prototype.keyboard_send_keys = async function(codes, delay) {
  for (var i = 0; i < codes.length; i++) {
    this.keyboard_adapter.simulate_press(codes[i]);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }
};
V86.prototype.keyboard_send_text = async function(string, delay) {
  for (var i = 0; i < string.length; i++) {
    this.keyboard_adapter.simulate_char(string[i]);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  }
};
V86.prototype.screen_make_screenshot = function() {
  if (this.screen_adapter) {
    return this.screen_adapter.make_screenshot();
  }
  return null;
};
V86.prototype.screen_set_scale = function(sx, sy) {
  if (this.screen_adapter) {
    this.screen_adapter.set_scale(sx, sy);
  }
};
V86.prototype.screen_go_fullscreen = function() {
  if (!this.screen_adapter) {
    return;
  }
  var elem = document.getElementById("screen_container");
  if (!elem) {
    return;
  }
  var fn = elem["requestFullScreen"] || elem["webkitRequestFullscreen"] || elem["mozRequestFullScreen"] || elem["msRequestFullScreen"];
  if (fn) {
    fn.call(elem);
    var focus_element = document.getElementsByClassName("phone_keyboard")[0];
    focus_element && focus_element.focus();
  }
  try {
    navigator.keyboard.lock();
  } catch (e) {
  }
  this.lock_mouse();
};
V86.prototype.lock_mouse = async function() {
  const elem = document.body;
  try {
    await elem.requestPointerLock({
      unadjustedMovement: true
    });
  } catch (e) {
    await elem.requestPointerLock();
  }
};
V86.prototype.mouse_set_enabled = function(enabled) {
  if (this.mouse_adapter) {
    this.mouse_adapter.emu_enabled = enabled;
  }
};
V86.prototype.mouse_set_status = V86.prototype.mouse_set_enabled;
V86.prototype.keyboard_set_enabled = function(enabled) {
  if (this.keyboard_adapter) {
    this.keyboard_adapter.emu_enabled = enabled;
  }
};
V86.prototype.keyboard_set_status = V86.prototype.keyboard_set_enabled;
V86.prototype.serial0_send = function(data) {
  for (var i = 0; i < data.length; i++) {
    this.bus.send("serial0-input", data.charCodeAt(i));
  }
};
V86.prototype.serial_send_bytes = function(serial, data) {
  for (var i = 0; i < data.length; i++) {
    this.bus.send("serial" + serial + "-input", data[i]);
  }
};
V86.prototype.serial_set_modem_status = function(serial, status) {
  this.bus.send("serial" + serial + "-modem-status-input", status);
};
V86.prototype.serial_set_carrier_detect = function(serial, status) {
  this.bus.send("serial" + serial + "-carrier-detect-input", status);
};
V86.prototype.serial_set_ring_indicator = function(serial, status) {
  this.bus.send("serial" + serial + "-ring-indicator-input", status);
};
V86.prototype.serial_set_data_set_ready = function(serial, status) {
  this.bus.send("serial" + serial + "-data-set-ready-input", status);
};
V86.prototype.serial_set_clear_to_send = function(serial, status) {
  this.bus.send("serial" + serial + "-clear-to-send-input", status);
};
V86.prototype.create_file = async function(file, data) {
  dbg_assert(arguments.length === 2);
  var fs = this.fs9p;
  if (!fs) {
    return;
  }
  var parts = file.split("/");
  var filename = parts[parts.length - 1];
  var path_infos = fs.SearchPath(file);
  var parent_id = path_infos.parentid;
  var not_found = filename === "" || parent_id === -1;
  if (!not_found) {
    await fs.CreateBinaryFile(filename, parent_id, data);
  } else {
    return Promise.reject(new FileNotFoundError());
  }
};
V86.prototype.read_file = async function(file) {
  dbg_assert(arguments.length === 1);
  var fs = this.fs9p;
  if (!fs) {
    return;
  }
  const result = await fs.read_file(file);
  if (result) {
    return result;
  } else {
    return Promise.reject(new FileNotFoundError());
  }
};
V86.prototype.automatically = function(steps) {
  const run = (steps2) => {
    const step = steps2[0];
    if (!step) {
      return;
    }
    const remaining_steps = steps2.slice(1);
    if (step.sleep) {
      setTimeout(() => run(remaining_steps), step.sleep * 1e3);
      return;
    }
    if (step.vga_text) {
      this.wait_until_vga_screen_contains(step.vga_text).then(() => run(remaining_steps));
      return;
    }
    if (step.keyboard_send) {
      if (Array.isArray(step.keyboard_send)) {
        this.keyboard_send_scancodes(step.keyboard_send);
      } else {
        dbg_assert(typeof step.keyboard_send === "string");
        this.keyboard_send_text(step.keyboard_send);
      }
      run(remaining_steps);
      return;
    }
    if (step.call) {
      step.call();
      run(remaining_steps);
      return;
    }
    dbg_assert(false, step);
  };
  run(steps);
};
V86.prototype.wait_until_vga_screen_contains = async function(expected, options) {
  const match_multi = Array.isArray(expected);
  const timeout_msec = options?.timeout_msec || 0;
  const changed_rows = /* @__PURE__ */ new Set();
  const screen_put_char = (args) => changed_rows.add(args[0]);
  const contains_expected = (screen_line, pattern) => pattern.test ? pattern.test(screen_line) : screen_line.startsWith(pattern);
  const screen_lines = [];
  this.add_listener("screen-put-char", screen_put_char);
  for (const screen_line of this.screen_adapter.get_text_screen()) {
    if (match_multi) {
      screen_lines.push(screen_line.trimRight());
    } else if (contains_expected(screen_line, expected)) {
      this.remove_listener("screen-put-char", screen_put_char);
      return true;
    }
  }
  let succeeded = false;
  const end = timeout_msec ? performance.now() + timeout_msec : 0;
  loop: while (!end || performance.now() < end) {
    if (match_multi) {
      let screen_height = screen_lines.length;
      while (screen_height > 0 && screen_lines[screen_height - 1] === "") {
        screen_height--;
      }
      const screen_offset = screen_height - expected.length;
      if (screen_offset >= 0) {
        let matches = true;
        for (let i = 0; i < expected.length && matches; i++) {
          matches = contains_expected(screen_lines[screen_offset + i], expected[i]);
        }
        if (matches) {
          succeeded = true;
          break;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const row of changed_rows) {
      const screen_line = this.screen_adapter.get_text_row(row);
      if (match_multi) {
        screen_lines[row] = screen_line.trimRight();
      } else if (contains_expected(screen_line, expected)) {
        succeeded = true;
        break loop;
      }
    }
    changed_rows.clear();
  }
  this.remove_listener("screen-put-char", screen_put_char);
  return succeeded;
};
V86.prototype.read_memory = function(offset, length) {
  return this.v86.cpu.read_blob(offset, length);
};
V86.prototype.write_memory = function(blob, offset) {
  this.v86.cpu.write_blob(blob, offset);
};
V86.prototype.set_serial_container_xtermjs = function(element, xterm_lib = window["Terminal"]) {
  this.serial_adapter && this.serial_adapter.destroy && this.serial_adapter.destroy();
  this.serial_adapter = new SerialAdapterXtermJS(element, this.bus, xterm_lib);
  this.serial_adapter.show();
};
V86.prototype.set_virtio_console_container_xtermjs = function(element, xterm_lib = window["Terminal"]) {
  this.virtio_console_adapter && this.virtio_console_adapter.destroy && this.virtio_console_adapter.destroy();
  this.virtio_console_adapter = new VirtioConsoleAdapterXtermJS(element, this.bus, xterm_lib);
  this.virtio_console_adapter.show();
};
V86.prototype.get_instruction_stats = function() {
  return stats_to_string(this.v86.cpu);
};
function FileExistsError(message) {
  this.message = message || "File already exists";
}
FileExistsError.prototype = Error.prototype;
function FileNotFoundError(message) {
  this.message = message || "File not found";
}
FileNotFoundError.prototype = Error.prototype;
Object.defineProperty(V86, "microtick", {
  get: function() {
    return v86.microtick;
  },
  set: function(fn) {
    v86.microtick = fn;
  },
  enumerable: true,
  configurable: true
});
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports["V86"] = V86;
} else if (typeof window !== "undefined") {
  window["V86"] = V86;
} else if (typeof importScripts === "function") {
  self["V86"] = V86;
}
export {
  V86
};
//# sourceMappingURL=libv86.mjs.map
