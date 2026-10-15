// FastLedVis - Accurate FastLED C++ Standard Library & Hardware Emulation Runtime (v3)

function hsv2rgbRainbow(h, s, v) {
  h = ((Math.floor(Number(h) || 0) % 256) + 256) % 256;
  s = Math.max(0, Math.min(255, Math.floor(Number(s) ?? 255)));
  v = Math.max(0, Math.min(255, Math.floor(Number(v) ?? 255)));

  if (s === 0) return [v, v, v];

  const region = Math.floor(h / 43);
  const remainder = (h - region * 43) * 6;

  const p = (v * (255 - s)) >> 8;
  const q = (v * (255 - ((s * remainder) >> 8))) >> 8;
  const t = (v * (255 - ((s * (255 - remainder)) >> 8))) >> 8;

  switch (region) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

class CHSVVal {
  constructor(h = 0, s = 255, v = 255) {
    if (h instanceof CHSVVal) {
      this.h = h.h;
      this.s = h.s;
      this.v = h.v;
    } else {
      this.h = ((Math.floor(Number(h) || 0) % 256) + 256) % 256;
      this.s = Math.max(0, Math.min(255, Math.floor(Number(s) ?? 255)));
      this.v = Math.max(0, Math.min(255, Math.floor(Number(v) ?? 255)));
    }
  }
  toRGB() {
    return hsv2rgbRainbow(this.h, this.s, this.v);
  }
}

Object.defineProperties(CHSVVal.prototype, {
  hue: { get() { return this.h; }, set(val) { this.h = ((Math.floor(Number(val) || 0) % 256) + 256) % 256; } },
  sat: { get() { return this.s; }, set(val) { this.s = Math.max(0, Math.min(255, Math.floor(Number(val) || 0))); } },
  val: { get() { return this.v; }, set(val) { this.v = Math.max(0, Math.min(255, Math.floor(Number(val) || 0))); } },
  value: { get() { return this.v; }, set(val) { this.v = Math.max(0, Math.min(255, Math.floor(Number(val) || 0))); } }
});

function CHSV(h = 0, s = 255, v = 255) {
  return new CHSVVal(h, s, v);
}

class CRGBVal {
  constructor(r = 0, g = undefined, b = undefined, onMutate = null) {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this._onMutate = onMutate;
    this.__assign(r, g, b);
  }

  _touch() {
    if (this._onMutate) this._onMutate();
  }

  __assign(r, g, b) {
    if (r instanceof CRGBVal) {
      this.r = r.r;
      this.g = r.g;
      this.b = r.b;
    } else if (r instanceof CHSVVal) {
      const [rr, gg, bb] = r.toRGB();
      this.r = rr;
      this.g = gg;
      this.b = bb;
    } else if (Array.isArray(r)) {
      this.r = Math.max(0, Math.min(255, Math.floor(r[0] || 0)));
      this.g = Math.max(0, Math.min(255, Math.floor(r[1] || 0)));
      this.b = Math.max(0, Math.min(255, Math.floor(r[2] || 0)));
    } else if (typeof r === "number" && g === undefined && b === undefined) {
      const hex = Math.floor(r) >>> 0;
      this.r = (hex >> 16) & 0xff;
      this.g = (hex >> 8) & 0xff;
      this.b = hex & 0xff;
    } else {
      this.r = Math.max(0, Math.min(255, Math.floor(Number(r) || 0)));
      this.g = Math.max(0, Math.min(255, Math.floor(Number(g) || 0)));
      this.b = Math.max(0, Math.min(255, Math.floor(Number(b) || 0)));
    }
    this._touch();
    return this;
  }

  setRGB(r, g, b) {
    return this.__assign(r, g, b);
  }

  setHSV(h, s, v) {
    const [r, g, b] = hsv2rgbRainbow(h, s, v);
    this.r = r;
    this.g = g;
    this.b = b;
    this._touch();
    return this;
  }

  setHue(h) {
    return this.setHSV(h, 255, 255);
  }

  setColorCode(code) {
    return this.__assign(code);
  }

  nscale8(scale) {
    const s = Math.max(0, Math.min(255, Math.floor(Number(scale) || 0)));
    this.r = (this.r * s) >> 8;
    this.g = (this.g * s) >> 8;
    this.b = (this.b * s) >> 8;
    this._touch();
    return this;
  }

  nscale8_video(scale) {
    const s = Math.max(0, Math.min(255, Math.floor(Number(scale) || 0)));
    this.r = ((this.r * s) >> 8) + (this.r && s ? 1 : 0);
    this.g = ((this.g * s) >> 8) + (this.g && s ? 1 : 0);
    this.b = ((this.b * s) >> 8) + (this.b && s ? 1 : 0);
    this._touch();
    return this;
  }

  fadeToBlackBy(fadefactor) {
    return this.nscale8(255 - Math.max(0, Math.min(255, Math.floor(Number(fadefactor) || 0))));
  }

  fadeLightBy(fadefactor) {
    return this.nscale8_video(255 - Math.max(0, Math.min(255, Math.floor(Number(fadefactor) || 0))));
  }

  maximizeBrightness(limit = 255) {
    const maxC = Math.max(this.r, this.g, this.b);
    if (maxC > 0) {
      const factor = (limit * 256) / maxC;
      this.r = Math.min(255, (this.r * factor) >> 8);
      this.g = Math.min(255, (this.g * factor) >> 8);
      this.b = Math.min(255, (this.b * factor) >> 8);
      this._touch();
    }
    return this;
  }

  getLuma() {
    return Math.floor(0.299 * this.r + 0.587 * this.g + 0.114 * this.b);
  }

  getAverageLight() {
    return Math.floor((this.r + this.g + this.b) / 3);
  }

  valueOf() {
    return (this.r << 16) | (this.g << 8) | this.b;
  }

  __addAssign(rhs) {
    const other = new CRGBVal(rhs);
    this.r = Math.min(255, this.r + other.r);
    this.g = Math.min(255, this.g + other.g);
    this.b = Math.min(255, this.b + other.b);
    this._touch();
    return this;
  }

  __subAssign(rhs) {
    const other = new CRGBVal(rhs);
    this.r = Math.max(0, this.r - other.r);
    this.g = Math.max(0, this.g - other.g);
    this.b = Math.max(0, this.b - other.b);
    this._touch();
    return this;
  }

  clone() {
    return new CRGBVal(this.r, this.g, this.b);
  }
}

Object.defineProperties(CRGBVal.prototype, {
  red: {
    get() { return this.r; },
    set(v) { this.r = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  },
  green: {
    get() { return this.g; },
    set(v) { this.g = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  },
  blue: {
    get() { return this.b; },
    set(v) { this.b = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  },
  0: {
    get() { return this.r; },
    set(v) { this.r = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  },
  1: {
    get() { return this.g; },
    set(v) { this.g = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  },
  2: {
    get() { return this.b; },
    set(v) { this.b = Math.max(0, Math.min(255, Math.floor(Number(v) || 0))); this._touch(); }
  }
});

function CRGB(r = 0, g, b) {
  return new CRGBVal(r, g, b);
}

const NAMED_COLORS = {
  Black: 0x000000,
  White: 0xffffff,
  Red: 0xff0000,
  Lime: 0x00ff00,
  Green: 0x008000,
  Blue: 0x0000ff,
  Yellow: 0xffff00,
  Cyan: 0x00ffff,
  Aqua: 0x00ffff,
  Magenta: 0xff00ff,
  Fuchsia: 0xff00ff,
  Silver: 0xc0c0c0,
  Gray: 0x808080,
  Grey: 0x808080,
  DarkGray: 0xa9a9a9,
  DarkGrey: 0xa9a9a9,
  LightGray: 0xd3d3d3,
  LightGrey: 0xd3d3d3,
  Maroon: 0x800000,
  DarkRed: 0x8b0000,
  FireBrick: 0xb22222,
  Olive: 0x808000,
  Purple: 0x800080,
  Teal: 0x008080,
  Navy: 0x000080,
  Orange: 0xffa500,
  OrangeRed: 0xff4500,
  DarkOrange: 0xff8c00,
  Coral: 0xff7f50,
  Tomato: 0xff6347,
  Salmon: 0xfa8072,
  Crimson: 0xdc143c,
  HotPink: 0xff69b4,
  DeepPink: 0xff1493,
  Pink: 0xffc0cb,
  LightPink: 0xffb6c1,
  Gold: 0xffd700,
  Goldenrod: 0xdaa520,
  Violet: 0xee82ee,
  Plum: 0xdda0dd,
  Orchid: 0xda70d6,
  Indigo: 0x4b0082,
  BlueViolet: 0x8a2be2,
  DarkViolet: 0x9400d3,
  Amethyst: 0x9966cc,
  MediumPurple: 0x9370db,
  Turquoise: 0x40e0d0,
  MediumTurquoise: 0x48d1cc,
  DarkTurquoise: 0x00ced1,
  PaleTurquoise: 0xafeeee,
  Aquamarine: 0x7fffd4,
  SpringGreen: 0x00ff7f,
  MediumSpringGreen: 0x00fa9a,
  LawnGreen: 0x7cfc00,
  Chartreuse: 0x7fff00,
  GreenYellow: 0xadff2f,
  LimeGreen: 0x32cd32,
  ForestGreen: 0x228b22,
  DarkGreen: 0x006400,
  SeaGreen: 0x2e8b57,
  LightSeaGreen: 0x20b2aa,
  SkyBlue: 0x87ceeb,
  LightSkyBlue: 0x87cefa,
  DeepSkyBlue: 0x00bfff,
  DodgerBlue: 0x1e90ff,
  CornflowerBlue: 0x6495ed,
  SteelBlue: 0x4682b4,
  RoyalBlue: 0x4169e1,
  MediumBlue: 0x0000cd,
  DarkBlue: 0x00008b,
  MidnightBlue: 0x191970,
  Chocolate: 0xd2691e,
  SaddleBrown: 0x8b4513,
  Sienna: 0xa0522d,
  Brown: 0xa52a2a,
  FairyLight: 0xffe42d,
  FairyLightNCC: 0xff9d2a
};

Object.keys(NAMED_COLORS).forEach((name) => {
  Object.defineProperty(CRGB, name, {
    get: () => new CRGBVal(NAMED_COLORS[name])
  });
});

const PALETTES = {
  RainbowColors_p: [
    0xff0000, 0xd52a00, 0xab5500, 0xab7f00,
    0xabab00, 0x56d500, 0x00ff00, 0x00d52a,
    0x00ab55, 0x0056aa, 0x0000ff, 0x2a00d5,
    0x5500ab, 0x7f0081, 0xab0055, 0xd5002b
  ],
  RainbowStripeColors_p: [
    0xff0000, 0x000000, 0xab5500, 0x000000,
    0xabab00, 0x000000, 0x00ff00, 0x000000,
    0x00ab55, 0x000000, 0x0000ff, 0x000000,
    0x5500ab, 0x000000, 0xab0055, 0x000000
  ],
  OceanColors_p: [
    0x191970, 0x00008b, 0x191970, 0x000080,
    0x00008b, 0x0000cd, 0x2e8b57, 0x008080,
    0x5f9ea0, 0x0000ff, 0x008b8b, 0x6495ed,
    0x66cdaa, 0x2e8b57, 0x00ffff, 0x87cefa
  ],
  CloudColors_p: [
    0x0000ff, 0x00008b, 0x00008b, 0x00008b,
    0x00008b, 0x4169e1, 0x4169e1, 0x87ceeb,
    0xadd8e6, 0xffffff, 0xffffff, 0xe0ffff,
    0x87ceeb, 0x4169e1, 0x00008b, 0x00008b
  ],
  LavaColors_p: [
    0x000000, 0x800000, 0x000000, 0x800000,
    0x8b0000, 0x800000, 0x8b0000, 0xb22222,
    0xff0000, 0xff4500, 0xff0000, 0xff8c00,
    0xffff00, 0xffa500, 0xffffff, 0xffffe0
  ],
  ForestColors_p: [
    0x006400, 0x006400, 0x556b2f, 0x006400,
    0x008000, 0x228b22, 0x6b8e23, 0x008000,
    0x2e8b57, 0x66cdaa, 0x32cd32, 0x9acd32,
    0x90ee90, 0x7cfc00, 0x66cdaa, 0x228b22
  ],
  PartyColors_p: [
    0x5500ab, 0x84007c, 0xb5004b, 0xe5001b,
    0xe81700, 0xb84700, 0xab7700, 0xabab00,
    0xab5500, 0xdd2200, 0xf2000e, 0xc2003e,
    0x8f0071, 0x5f00a1, 0x2f00d0, 0x0007f9
  ],
  HeatColors_p: [
    0x000000, 0x330000, 0x660000, 0x990000,
    0xcc0000, 0xff0000, 0xff3300, 0xff6600,
    0xff9900, 0xffcc00, 0xffff00, 0xffff33,
    0xffff66, 0xffff99, 0xffffcc, 0xffffff
  ]
};

function buildCRGBPalette16(...args) {
  if (args.length === 0) {
    return PALETTES.RainbowColors_p.map((c) => new CRGBVal(c));
  }
  if (args.length === 1 && Array.isArray(args[0])) {
    const src = args[0];
    if (src.length === 16) return src.map((c) => new CRGBVal(c));
    return Array.from({ length: 16 }, (_, i) => new CRGBVal(src[i % src.length]));
  }
  const stops = args.map((c) => new CRGBVal(c));
  return Array.from({ length: 16 }, (_, i) => {
    const t = (i / 15) * (stops.length - 1);
    const idx = Math.floor(t);
    const frac = t - idx;
    const c1 = stops[idx];
    const c2 = stops[Math.min(stops.length - 1, idx + 1)];
    return new CRGBVal(
      c1.r + (c2.r - c1.r) * frac,
      c1.g + (c2.g - c1.g) * frac,
      c1.b + (c2.b - c1.b) * frac
    );
  });
}

function createGradientPalette(bytes) {
  if (!Array.isArray(bytes) || bytes.length < 4) {
    return buildCRGBPalette16();
  }
  const stops = [];
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    stops.push({
      pos: Math.max(0, Math.min(255, Number(bytes[i]) || 0)),
      r: Number(bytes[i + 1]) || 0,
      g: Number(bytes[i + 2]) || 0,
      b: Number(bytes[i + 3]) || 0
    });
  }
  if (stops.length === 0) return buildCRGBPalette16();

  return Array.from({ length: 16 }, (_, idx) => {
    const targetPos = Math.round((idx / 15) * 255);
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (targetPos >= stops[s].pos && targetPos <= stops[s + 1].pos) {
        left = stops[s];
        right = stops[s + 1];
        break;
      }
    }
    const span = Math.max(1, right.pos - left.pos);
    const f = Math.max(0, Math.min(1, (targetPos - left.pos) / span));
    return new CRGBVal(
      left.r + (right.r - left.r) * f,
      left.g + (right.g - left.g) * f,
      left.b + (right.b - left.b) * f
    );
  });
}

function createCRGBSetSlice(rawArray, startIdx, endIdx, onMutate) {
  const s = Math.max(0, Math.min(rawArray.length - 1, Math.floor(Number(startIdx) || 0)));
  const e =
    endIdx !== undefined
      ? Math.max(0, Math.min(rawArray.length - 1, Math.floor(Number(endIdx) || 0)))
      : s;
  const step = s <= e ? 1 : -1;
  const sliceLen = Math.abs(e - s) + 1;

  const sliceRefs = [];
  for (let k = 0; k < sliceLen; k++) {
    sliceRefs.push(rawArray[s + k * step]);
  }

  const helper = {
    length: sliceLen,
    size() { return sliceLen; },
    [Symbol.iterator]() {
      return sliceRefs[Symbol.iterator]();
    },
    fill_solid(color) {
      for (let i = 0; i < sliceRefs.length; i++) sliceRefs[i].__assign(color);
      return proxy;
    },
    fill_rainbow(initialhue = 0, deltahue = 5) {
      let h = Math.floor(initialhue) & 0xff;
      for (let i = 0; i < sliceRefs.length; i++) {
        sliceRefs[i].__assign(CHSV(h, 240, 255));
        h = (h + Math.floor(deltahue)) & 0xff;
      }
      return proxy;
    },
    fadeToBlackBy(fade) {
      for (let i = 0; i < sliceRefs.length; i++) sliceRefs[i].fadeToBlackBy(fade);
      return proxy;
    },
    nscale8(scale) {
      for (let i = 0; i < sliceRefs.length; i++) sliceRefs[i].nscale8(scale);
      return proxy;
    }
  };

  const proxy = new Proxy(helper, {
    get(target, prop, receiver) {
      if (prop === "__raw") return sliceRefs;
      if (prop === Symbol.iterator) return () => sliceRefs[Symbol.iterator]();
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          return idx >= 0 && idx < sliceRefs.length ? sliceRefs[idx] : new CRGBVal(0, 0, 0);
        }
      }
      return undefined;
    },
    set(target, prop, value) {
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          if (idx >= 0 && idx < sliceRefs.length) {
            sliceRefs[idx].__assign(value);
          }
          return true;
        }
      }
      return true;
    }
  });

  return proxy;
}

function createCRGBArray(length, onMutate = null) {
  const size = Math.max(1, Math.min(2048, Math.floor(Number(length) || 60)));
  const raw = Array.from({ length: size }, () => new CRGBVal(0, 0, 0, onMutate));
  const dummy = new CRGBVal(0, 0, 0);

  const callableTarget = function (start, end) {
    return createCRGBSetSlice(raw, start, end, onMutate);
  };

  return new Proxy(callableTarget, {
    apply(target, thisArg, argArray) {
      return createCRGBSetSlice(raw, argArray[0], argArray[1], onMutate);
    },
    get(target, prop) {
      if (prop === "__raw") return raw;
      if (prop === Symbol.iterator) return () => raw[Symbol.iterator]();
      if (prop === "length" || prop === "size") return raw.length;
      if (prop === "fill_solid") {
        return (color) => {
          for (let i = 0; i < raw.length; i++) raw[i].__assign(color);
        };
      }
      if (prop === "fill_rainbow") {
        return (initHue = 0, deltaHue = 5) => {
          let h = Math.floor(initHue) & 0xff;
          for (let i = 0; i < raw.length; i++) {
            raw[i].__assign(CHSV(h, 240, 255));
            h = (h + Math.floor(deltaHue)) & 0xff;
          }
        };
      }
      if (prop === "fadeToBlackBy") {
        return (fade) => {
          for (let i = 0; i < raw.length; i++) raw[i].fadeToBlackBy(fade);
        };
      }
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          if (idx >= 0 && idx < raw.length) {
            return raw[idx];
          }
          return dummy;
        }
      }
      return raw[prop];
    },
    set(target, prop, value) {
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          if (idx >= 0 && idx < raw.length) {
            raw[idx].__assign(value);
          }
          return true;
        }
      }
      raw[prop] = value;
      return true;
    }
  });
}

function createNumArray(length) {
  const size = Math.max(1, Math.min(4096, Math.floor(Number(length) || 60)));
  const raw = new Array(size).fill(0);
  return new Proxy(raw, {
    get(target, prop, receiver) {
      if (prop === "length") return target.length;
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          return idx >= 0 && idx < target.length ? target[idx] : 0;
        }
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          if (idx >= 0 && idx < target.length) {
            target[idx] = Math.floor(Number(value) || 0);
          }
          return true;
        }
      }
      return Reflect.set(target, prop, value, receiver);
    }
  });
}

function createNum2DArray(d1, d2) {
  const rows = Math.max(1, Math.min(256, Math.floor(Number(d1) || 16)));
  const cols = Math.max(1, Math.min(256, Math.floor(Number(d2) || 16)));
  const outer = Array.from({ length: rows }, () => createNumArray(cols));
  return new Proxy(outer, {
    get(target, prop, receiver) {
      if (prop === "length") return target.length;
      if (typeof prop === "string") {
        const num = Number(prop);
        if (!Number.isNaN(num)) {
          const idx = Math.floor(num);
          return idx >= 0 && idx < target.length ? target[idx] : target[0];
        }
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

function hashNoise(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function inoise8(x = 0, y = 0, z = 0) {
  const fx = (Number(x) || 0) / 64.0;
  const fy = (Number(y) || 0) / 64.0;
  const fz = (Number(z) || 0) / 64.0;

  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const iz = Math.floor(fz);

  const ux = fx - ix;
  const uy = fy - iy;
  const uz = fz - iz;

  const sx = ux * ux * (3 - 2 * ux);
  const sy = uy * uy * (3 - 2 * uy);
  const sz = uz * uz * (3 - 2 * uz);

  const n000 = hashNoise(ix + iy * 57 + iz * 113);
  const n100 = hashNoise(ix + 1 + iy * 57 + iz * 113);
  const n010 = hashNoise(ix + (iy + 1) * 57 + iz * 113);
  const n110 = hashNoise(ix + 1 + (iy + 1) * 57 + iz * 113);
  const n001 = hashNoise(ix + iy * 57 + (iz + 1) * 113);
  const n101 = hashNoise(ix + 1 + iy * 57 + (iz + 1) * 113);
  const n011 = hashNoise(ix + (iy + 1) * 57 + (iz + 1) * 113);
  const n111 = hashNoise(ix + 1 + (iy + 1) * 57 + (iz + 1) * 113);

  const nx00 = n000 + sx * (n100 - n000);
  const nx10 = n010 + sx * (n110 - n010);
  const nx01 = n001 + sx * (n101 - n001);
  const nx11 = n011 + sx * (n111 - n011);

  const nxy0 = nx00 + sy * (nx10 - nx00);
  const nxy1 = nx01 + sy * (nx11 - nx01);

  const res = nxy0 + sz * (nxy1 - nxy0);
  return Math.max(0, Math.min(255, Math.floor(res * 255)));
}

function inoise16(x = 0, y = 0, z = 0) {
  return inoise8((Number(x) || 0) / 256, (Number(y) || 0) / 256, (Number(z) || 0) / 256) * 257;
}

/**
 * Instantiates a live FastLED Sandbox Session from transpiled JS code and extracted specs.
 */
function createFastLEDSimulator(transpiledCode, specs) {
  let simMillis = 0;
  let frameCount = 0;
  let masterBrightness = specs.brightness ?? 255;
  let maxVolts = specs.maxVolts ?? 5;
  let maxMilliamps = specs.maxMilliamps ?? null;
  let frameDelayMs = 16;
  let lastRuntimeError = null;

  let ledsDirtySinceLastShow = false;
  let showCalledInCurrentLoop = false;
  let loopGuardCounter = 0;
  const pendingFrames = [];

  const crgbArrays = {};
  const staticArrays = {};
  const everyNTimers = {};
  const __staticVars = {};
  const serialLogs = [];

  const markDirty = () => {
    ledsDirtySinceLastShow = true;
  };

  function __getOrCreateCRGBArray(name, size) {
    if (!crgbArrays[name]) {
      crgbArrays[name] = createCRGBArray(size || specs.numLeds || 60, markDirty);
    }
    return crgbArrays[name];
  }

  function __getOrCreateCRGB2DArray(name, d1, d2) {
    const rows = Math.max(1, Math.min(64, Math.floor(Number(d1) || 1)));
    const cols = Math.max(1, Math.min(1024, Math.floor(Number(d2) || 60)));
    const flat = __getOrCreateCRGBArray(name, rows * cols);
    const rawFlat = flat.__raw;
    const rowProxies = Array.from({ length: rows }, (_, r) =>
      createCRGBSetSlice(rawFlat, r * cols, (r + 1) * cols - 1, markDirty)
    );
    return new Proxy(rowProxies, {
      get(target, prop) {
        if (prop === "__raw") return rawFlat;
        if (prop === "length") return rows;
        if (typeof prop === "string") {
          const num = Number(prop);
          if (!Number.isNaN(num)) {
            const idx = Math.floor(num);
            return idx >= 0 && idx < rows ? target[idx] : target[0];
          }
        }
        return target[prop];
      }
    });
  }

  function __createCRGBSet(arr, start, end) {
    if (arr && arr.__raw) {
      return createCRGBSetSlice(arr.__raw, start, end, markDirty);
    }
    return arr;
  }

  function __getStaticArray(key, size) {
    if (!staticArrays[key]) {
      staticArrays[key] = createNumArray(size || specs.numLeds || 60);
    }
    return staticArrays[key];
  }

  function __getStatic2DArray(key, d1, d2) {
    if (!staticArrays[key]) {
      staticArrays[key] = createNum2DArray(d1 || 16, d2 || 16);
    }
    return staticArrays[key];
  }

  function __everyNMillis(id, periodMs) {
    const p = Math.max(1, Number(periodMs) || 1);
    if (everyNTimers[id] === undefined) {
      everyNTimers[id] = simMillis;
      return false;
    }
    if (simMillis - everyNTimers[id] >= p) {
      everyNTimers[id] = simMillis;
      return true;
    }
    return false;
  }

  function __checkLoopGuard() {
    loopGuardCounter++;
    if (loopGuardCounter > 25000 || pendingFrames.length >= 240) {
      return false;
    }
    return true;
  }

  function __addrOfIdx(arr, offset) {
    if (!arr) return arr;
    const off = Math.max(0, Math.floor(Number(offset) || 0));
    if (off === 0) return arr;
    if (arr.__raw) {
      return createCRGBSetSlice(arr.__raw, off, arr.__raw.length - 1, markDirty);
    }
    return arr;
  }

  function __addIdx(arr, idx, val) {
    if (!arr) return;
    const i = Math.floor(Number(idx) || 0);
    const target = arr[i];
    if (target instanceof CRGBVal) {
      target.__addAssign(val);
    } else if (typeof target === "number") {
      arr[i] = target + (Number(val) || 0);
    }
  }

  function __subIdx(arr, idx, val) {
    if (!arr) return;
    const i = Math.floor(Number(idx) || 0);
    const target = arr[i];
    if (target instanceof CRGBVal) {
      target.__subAssign(val);
    } else if (typeof target === "number") {
      arr[i] = target - (Number(val) || 0);
    }
  }

  function __scaleIdx(arr, idx, val) {
    if (!arr) return;
    const i = Math.floor(Number(idx) || 0);
    const target = arr[i];
    if (target instanceof CRGBVal) {
      target.nscale8_video(val);
    }
  }

  const __sizeofArray = (arr) => (arr && arr.length ? arr.length : 1);
  const __sizeof = (x) => (x && x.length ? x.length : 3);
  const memset = (target, val = 0, count = 0) => {
    if (!target) return;
    const len = target.length || count || 0;
    for (let i = 0; i < len; i++) {
      if (target[i] instanceof CRGBVal) {
        target[i].setRGB(val, val, val);
      } else {
        target[i] = val;
      }
    }
  };
  const memcpy = (dst, src, count = 0) => {
    if (!dst || !src) return;
    const len = Math.min(dst.length || 0, src.length || 0);
    for (let i = 0; i < len; i++) {
      dst[i] = src[i];
    }
  };

  // FastLED math & wave library functions
  const qadd8 = (i, j) => Math.min(255, Math.max(0, Math.floor(Number(i) || 0) + Math.floor(Number(j) || 0)));
  const qsub8 = (i, j) => Math.max(0, Math.floor(Number(i) || 0) - Math.floor(Number(j) || 0));
  const scale8 = (i, sc) => ((Math.floor(Number(i) || 0) & 0xff) * (Math.floor(Number(sc) || 0) & 0xff)) >> 8;
  const scale8_video = (i, sc) =>
    (((Math.floor(Number(i) || 0) & 0xff) * (Math.floor(Number(sc) || 0) & 0xff)) >> 8) + (i && sc ? 1 : 0);

  const sin8 = (theta) => {
    const rad = (((Math.floor(Number(theta) || 0) & 0xff) / 256.0) * Math.PI * 2);
    return Math.round((Math.sin(rad) + 1.0) * 127.5);
  };
  const cos8 = (theta) => {
    const rad = (((Math.floor(Number(theta) || 0) & 0xff) / 256.0) * Math.PI * 2);
    return Math.round((Math.cos(rad) + 1.0) * 127.5);
  };
  const sin16 = (theta) => {
    const rad = (((Math.floor(Number(theta) || 0) & 0xffff) / 65536.0) * Math.PI * 2);
    return Math.round(Math.sin(rad) * 32767);
  };
  const cos16 = (theta) => {
    const rad = (((Math.floor(Number(theta) || 0) & 0xffff) / 65536.0) * Math.PI * 2);
    return Math.round(Math.cos(rad) * 32767);
  };

  const triwave8 = (inVal) => {
    let v = Math.floor(Number(inVal) || 0) & 0xff;
    if (v & 0x80) v = 255 - v;
    return (v << 1) & 0xff;
  };
  const quadwave8 = (inVal) => sin8(inVal);
  const cubicwave8 = (inVal) => sin8(inVal);
  const ease8InOutQuad = (val) => {
    let j = Math.floor(Number(val) || 0) & 0xff;
    if (j & 0x80) j = 255 - j;
    const jj = (j * j) >> 7;
    return (Number(val) & 0x80) ? 255 - jj : jj;
  };
  const ease8InOutCubic = (val) => ease8InOutQuad(val);
  const ease8InOutApprox = (val) => ease8InOutQuad(val);
  const lerp8by8 = (a, b, frac) => Math.round(a + ((b - a) * (frac & 0xff)) / 255);
  const lerp16by16 = (a, b, frac) => Math.round(a + ((b - a) * (frac & 0xffff)) / 65535);
  const map8 = (inVal, rangeStart, rangeEnd) =>
    Math.round(rangeStart + ((rangeEnd - rangeStart) * (inVal & 0xff)) / 255);

  const beat16 = (bpm, timebase = 0) => {
    const elapsed = Math.max(0, simMillis - timebase);
    return Math.floor((elapsed * bpm * 65536) / 60000) & 0xffff;
  };
  const beat8 = (bpm, timebase = 0) => beat16(bpm, timebase) >> 8;
  const beat88 = (bpm_88, timebase = 0) => beat16((bpm_88 || 256) / 256.0, timebase);

  const beatsin8 = (bpm, lowest = 0, highest = 255, timebase = 0, phase_offset = 0) => {
    const b = beat8(bpm, timebase);
    const s = sin8(b + phase_offset);
    const range = highest - lowest;
    return lowest + ((s * range) >> 8);
  };

  const beatsin16 = (bpm, lowest = 0, highest = 65535, timebase = 0, phase_offset = 0) => {
    const b = beat16(bpm, timebase);
    const s = (sin16(b + phase_offset) + 32768) & 0xffff;
    const range = highest - lowest;
    return lowest + Math.floor((s * range) / 65535);
  };

  const beatsin88 = (bpm_88, lowest = 0, highest = 65535, timebase = 0, phase_offset = 0) =>
    beatsin16((bpm_88 || 256) / 256.0, lowest, highest, timebase, phase_offset);

  const random8 = (a, b) => {
    if (a === undefined) return Math.floor(Math.random() * 256);
    if (b === undefined) return Math.floor(Math.random() * Math.max(1, a));
    return Math.floor(a + Math.random() * Math.max(1, b - a));
  };
  const random16 = (a, b) => {
    if (a === undefined) return Math.floor(Math.random() * 65536);
    if (b === undefined) return Math.floor(Math.random() * Math.max(1, a));
    return Math.floor(a + Math.random() * Math.max(1, b - a));
  };

  const fill_solid = (targetArray, numToFill, color) => {
    if (!targetArray) return;
    const n = Math.min(targetArray.length, Math.floor(Number(numToFill) || 0));
    for (let i = 0; i < n; i++) {
      targetArray[i] = color;
    }
  };

  const fill_rainbow = (targetArray, numToFill, initialhue, deltahue = 5) => {
    if (!targetArray) return;
    const n = Math.min(targetArray.length, Math.floor(Number(numToFill) || 0));
    let h = Math.floor(Number(initialhue) || 0) & 0xff;
    const dh = Math.floor(Number(deltahue) ?? 5);
    for (let i = 0; i < n; i++) {
      targetArray[i] = CHSV(h, 240, 255);
      h = (h + dh) & 0xff;
    }
  };

  const fill_gradient_RGB = (leds, startpos, startcolor, endpos, endcolor) => {
    if (!leds) return;
    if (endcolor === undefined) {
      const numLeds = Math.min(leds.length, Math.floor(Number(startpos) || 0));
      const c1 = new CRGBVal(startcolor);
      const c2 = new CRGBVal(endpos);
      for (let i = 0; i < numLeds; i++) {
        const t = numLeds > 1 ? i / (numLeds - 1) : 0;
        leds[i] = new CRGBVal(
          c1.r + (c2.r - c1.r) * t,
          c1.g + (c2.g - c1.g) * t,
          c1.b + (c2.b - c1.b) * t
        );
      }
      return;
    }
    const s = Math.max(0, Math.floor(Number(startpos) || 0));
    const e = Math.min(leds.length - 1, Math.floor(Number(endpos) || 0));
    const c1 = new CRGBVal(startcolor);
    const c2 = new CRGBVal(endcolor);
    const span = Math.max(1, e - s);
    for (let i = s; i <= e; i++) {
      const t = (i - s) / span;
      leds[i] = new CRGBVal(
        c1.r + (c2.r - c1.r) * t,
        c1.g + (c2.g - c1.g) * t,
        c1.b + (c2.b - c1.b) * t
      );
    }
  };

  const fill_gradient = (leds, startpos, startcolor, endpos, endcolor) =>
    fill_gradient_RGB(leds, startpos, startcolor, endpos, endcolor);

  const ColorFromPalette = (pal, index, brightness = 255, blendType = 1) => {
    const paletteArr = Array.isArray(pal) && pal.length > 0 ? pal : PALETTES.RainbowColors_p;
    const idx = ((Math.floor(Number(index) || 0) % 256) + 256) % 256;
    const hi4 = (idx >> 4) & 0x0f;
    const lo4 = idx & 0x0f;

    const c1 = new CRGBVal(paletteArr[hi4 % paletteArr.length]);
    const c2 = new CRGBVal(paletteArr[(hi4 + 1) % paletteArr.length]);

    let r = c1.r;
    let g = c1.g;
    let b = c1.b;

    if (blendType !== 0 && lo4 > 0) {
      const f = lo4 / 16.0;
      r = Math.round(c1.r + (c2.r - c1.r) * f);
      g = Math.round(c1.g + (c2.g - c1.g) * f);
      b = Math.round(c1.b + (c2.b - c1.b) * f);
    }

    const br = Math.max(0, Math.min(255, Math.floor(Number(brightness) ?? 255)));
    if (br < 255) {
      r = (r * br) >> 8;
      g = (g * br) >> 8;
      b = (b * br) >> 8;
    }
    return new CRGBVal(r, g, b);
  };

  const fill_palette = (leds, numLeds, startIndex, incIndex, pal, brightness = 255, blendType = 1) => {
    if (!leds) return;
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    let idx = Math.floor(Number(startIndex) || 0) & 0xff;
    for (let i = 0; i < n; i++) {
      leds[i] = ColorFromPalette(pal, idx, brightness, blendType);
      idx = (idx + Math.floor(Number(incIndex) || 0)) & 0xff;
    }
  };

  const nblendPaletteTowardPalette = (currentPal, targetPal, maxChanges = 24) => {
    if (!Array.isArray(currentPal) || !Array.isArray(targetPal)) return;
    for (let i = 0; i < Math.min(currentPal.length, targetPal.length); i++) {
      const c = new CRGBVal(currentPal[i]);
      const t = new CRGBVal(targetPal[i]);
      const step = Math.max(1, Math.floor(maxChanges / 4));
      if (c.r < t.r) c.r = Math.min(t.r, c.r + step);
      else if (c.r > t.r) c.r = Math.max(t.r, c.r - step);
      if (c.g < t.g) c.g = Math.min(t.g, c.g + step);
      else if (c.g > t.g) c.g = Math.max(t.g, c.g - step);
      if (c.b < t.b) c.b = Math.min(t.b, c.b + step);
      else if (c.b > t.b) c.b = Math.max(t.b, c.b - step);
      currentPal[i] = c;
    }
  };

  const HeatColor = (temperature) => {
    const t = Math.max(0, Math.min(255, Math.floor(Number(temperature) || 0)));
    const t192 = Math.floor((t * 191) / 255);
    const heatramp = (t192 & 0x3f) << 2;
    if (t192 & 0x80) {
      return new CRGBVal(255, 255, heatramp);
    } else if (t192 & 0x40) {
      return new CRGBVal(255, heatramp, 0);
    } else {
      return new CRGBVal(heatramp, 0, 0);
    }
  };

  const fadeToBlackBy = (leds, numLeds, fadeBy) => {
    if (!leds) return;
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    for (let i = 0; i < n; i++) {
      leds[i].fadeToBlackBy(fadeBy);
    }
  };

  const fadeLightBy = (leds, numLeds, fadeBy) => {
    if (!leds) return;
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    for (let i = 0; i < n; i++) {
      leds[i].fadeLightBy(fadeBy);
    }
  };

  const fadeUsingColor = (leds, numLeds, colormask) => {
    if (!leds) return;
    const mask = new CRGBVal(colormask);
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    for (let i = 0; i < n; i++) {
      leds[i].r = (leds[i].r * mask.r) >> 8;
      leds[i].g = (leds[i].g * mask.g) >> 8;
      leds[i].b = (leds[i].b * mask.b) >> 8;
    }
    markDirty();
  };

  const nscale8 = (leds, numLeds, scale) => {
    if (!leds) return;
    if (typeof leds === "number") return scale8(leds, numLeds);
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    for (let i = 0; i < n; i++) {
      leds[i].nscale8(scale);
    }
  };

  const blur1d = (leds, numLeds, blur_amount) => {
    if (!leds) return;
    const n = Math.min(leds.length, Math.floor(Number(numLeds) || 0));
    const keep = 255 - Math.floor(blur_amount >> 1);
    const seep = Math.floor(blur_amount >> 2);
    const temp = Array.from({ length: n }, (_, i) => leds[i].clone());
    for (let i = 0; i < n; i++) {
      let r = (temp[i].r * keep) >> 8;
      let g = (temp[i].g * keep) >> 8;
      let b = (temp[i].b * keep) >> 8;
      if (i > 0) {
        r += (temp[i - 1].r * seep) >> 8;
        g += (temp[i - 1].g * seep) >> 8;
        b += (temp[i - 1].b * seep) >> 8;
      }
      if (i < n - 1) {
        r += (temp[i + 1].r * seep) >> 8;
        g += (temp[i + 1].g * seep) >> 8;
        b += (temp[i + 1].b * seep) >> 8;
      }
      leds[i] = new CRGBVal(r, g, b);
    }
  };

  const blur2d = (leds, width, height, blur_amount) => {
    if (!leds) return;
    blur1d(leds, Math.min(leds.length, (Number(width) || 16) * (Number(height) || 16)), blur_amount);
  };

  const blend = (c1, c2, amountOfC2) => {
    const a = new CRGBVal(c1);
    const b = new CRGBVal(c2);
    const f = Math.max(0, Math.min(255, Math.floor(Number(amountOfC2) || 0))) / 255.0;
    return new CRGBVal(
      a.r + (b.r - a.r) * f,
      a.g + (b.g - a.g) * f,
      a.b + (b.b - a.b) * f
    );
  };

  const nblend = (existing, overlay, amount) => {
    if (existing instanceof CRGBVal) {
      const b = blend(existing, overlay, amount);
      existing.__assign(b);
    }
    return existing;
  };

  const hsv2rgb_rainbow = (hsv, rgb) => {
    if (rgb instanceof CRGBVal) {
      rgb.__assign(hsv);
    }
    return new CRGBVal(hsv);
  };
  const hsv2rgb_spectrum = hsv2rgb_rainbow;

  let primaryArray = null;

  function captureSnapshot(delayMsVal) {
    if (!primaryArray || pendingFrames.length >= 240) return;
    const raw = primaryArray.__raw;
    const rgbCopy = raw.map((px) => [px.r, px.g, px.b]);
    pendingFrames.push({
      rgb: rgbCopy,
      delayMs: Math.max(4, Math.min(1000, Math.floor(Number(delayMsVal) || 16))),
      brightness: masterBrightness,
      simMillis
    });
    ledsDirtySinceLastShow = false;
  }

  const FastLED = {
    __addLeds(tplArgs, callArgs) {
      if (callArgs && callArgs[0] && callArgs[0].__raw && !primaryArray) {
        primaryArray = callArgs[0];
      }
      return {
        setCorrection() { return this; },
        setTemperature() { return this; },
        setDither() { return this; }
      };
    },
    setBrightness(b) {
      masterBrightness = Math.max(0, Math.min(255, Math.floor(Number(b) || 0)));
    },
    getBrightness() {
      return masterBrightness;
    },
    show(overrideBrightness) {
      if (overrideBrightness !== undefined) {
        masterBrightness = Math.max(0, Math.min(255, Math.floor(Number(overrideBrightness) || 0)));
      }
      showCalledInCurrentLoop = true;
      captureSnapshot(frameDelayMs);
    },
    clear(writeData = false) {
      Object.values(crgbArrays).forEach((arr) => {
        const raw = arr.__raw || arr;
        for (let i = 0; i < raw.length; i++) {
          raw[i].setRGB(0, 0, 0);
        }
      });
      if (writeData) {
        this.show();
      }
    },
    clearData() {
      this.clear(false);
    },
    showColor(color, overrideBrightness) {
      if (overrideBrightness !== undefined) {
        this.setBrightness(overrideBrightness);
      }
      Object.values(crgbArrays).forEach((arr) => {
        const raw = arr.__raw || arr;
        for (let i = 0; i < raw.length; i++) {
          raw[i].__assign(color);
        }
      });
      this.show();
    },
    delay(ms) {
      const d = Math.max(4, Math.min(1000, Math.floor(Number(ms) || 16)));
      frameDelayMs = d;
      simMillis += d;
      if (ledsDirtySinceLastShow || pendingFrames.length === 0) {
        captureSnapshot(d);
      } else if (pendingFrames.length > 0) {
        pendingFrames[pendingFrames.length - 1].delayMs = d;
        pendingFrames[pendingFrames.length - 1].simMillis = simMillis;
      }
    },
    setMaxPowerInVoltsAndMilliamps(v, ma) {
      maxVolts = Number(v) || 5;
      maxMilliamps = Number(ma) || null;
    },
    setMaxRefreshRate() {},
    setCorrection() {},
    setTemperature() {},
    setDither() {},
    countFPS() {
      return Math.round(1000 / Math.max(1, frameDelayMs));
    },
    size() {
      return primaryArray ? primaryArray.length : specs.numLeds || 60;
    }
  };

  const Serial = {
    begin() {},
    print(msg) {
      if (serialLogs.length < 150) {
        serialLogs.push(`[${simMillis}ms] ${String(msg ?? "")}`);
      }
    },
    println(msg) {
      if (serialLogs.length < 150) {
        serialLogs.push(`[${simMillis}ms] ${String(msg ?? "")}`);
      }
    },
    printf(fmt, ...args) {
      if (serialLogs.length < 150) {
        serialLogs.push(`[${simMillis}ms] ${String(fmt)} ${args.join(" ")}`);
      }
    },
    available() { return 0; },
    read() { return -1; },
    flush() {}
  };

  const delay = (ms) => FastLED.delay(ms);
  const delayMicroseconds = (us) => {
    if (us >= 1000) FastLED.delay(Math.floor(us / 1000));
  };
  const millis = () => simMillis;
  const micros = () => simMillis * 1000;
  const map = (x, in_min, in_max, out_min, out_max) =>
    Math.floor(((x - in_min) * (out_max - out_min)) / (Math.max(1, in_max - in_min)) + out_min);
  const constrain = (x, a, b) => Math.max(a, Math.min(b, x));

  const sandboxEnv = {
    FastLED,
    LEDS: FastLED,
    CRGB,
    CHSV,
    CRGBPalette16: buildCRGBPalette16,
    CRGBPalette32: buildCRGBPalette16,
    CRGBPalette256: buildCRGBPalette16,
    __createGradientPalette: createGradientPalette,
    Serial,
    Serial1: Serial,
    __getOrCreateCRGBArray,
    __getOrCreateCRGB2DArray,
    __createCRGBSet,
    __getStaticArray,
    __getStatic2DArray,
    __staticVars,
    __createNumArray: createNumArray,
    __createNum2DArray: createNum2DArray,
    __everyNMillis,
    __checkLoopGuard,
    __addrOfIdx,
    __addIdx,
    __subIdx,
    __scaleIdx,
    __sizeofArray,
    __sizeof,
    memset,
    memcpy,
    // FastLED Functions
    fill_solid,
    fill_rainbow,
    fill_gradient_RGB,
    fill_gradient,
    fill_palette,
    ColorFromPalette,
    nblendPaletteTowardPalette,
    HeatColor,
    fadeToBlackBy,
    fadeLightBy,
    fadeUsingColor,
    nscale8,
    blur1d,
    blur2d,
    blend,
    nblend,
    hsv2rgb_rainbow,
    hsv2rgb_spectrum,
    qadd8,
    qsub8,
    scale8,
    scale8_video,
    sin8,
    cos8,
    sin16,
    cos16,
    triwave8,
    quadwave8,
    cubicwave8,
    ease8InOutQuad,
    ease8InOutCubic,
    ease8InOutApprox,
    lerp8by8,
    lerp16by16,
    map8,
    beat8,
    beat16,
    beat88,
    beatsin8,
    beatsin16,
    beatsin88,
    inoise8,
    inoise16,
    random8,
    random16,
    random: random16,
    randomSeed: () => {},
    // Arduino helpers & math
    millis,
    micros,
    delay,
    delayMicroseconds,
    yield: () => {},
    map,
    constrain,
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
    sqrt: Math.sqrt,
    pgm_read_byte: (v) => (typeof v === "number" ? v & 0xff : Number(v) || 0),
    pgm_read_word: (v) => (typeof v === "number" ? v & 0xffff : Number(v) || 0),
    pgm_read_dword: (v) => (typeof v === "number" ? v >>> 0 : Number(v) || 0),
    pgm_read_byte_near: (v) => (typeof v === "number" ? v & 0xff : Number(v) || 0),
    pgm_read_word_near: (v) => (typeof v === "number" ? v & 0xffff : Number(v) || 0),
    pgm_read_ptr: (v) => v,
    sqrt16: (x) => Math.floor(Math.sqrt(Math.max(0, Number(x) || 0))),
    sq: (x) => x * x,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    atan2: Math.atan2,
    pow: Math.pow,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    fmod: (a, b) => a % b,
    pinMode: () => {},
    digitalWrite: () => {},
    digitalRead: () => 0,
    analogRead: () => 512,
    analogWrite: () => {},
    Wire: { begin() {}, beginTransmission() {}, write() {}, endTransmission() {}, requestFrom() {}, read() { return 0; } },
    SPI: { begin() {}, end() {}, transfer() { return 0; } },
    EEPROM: { begin() {}, read() { return 0; }, write() {}, commit() {}, get() {}, put() {} },
    WiFi: { mode() {}, begin() {}, status() { return 3; }, localIP() { return "192.168.1.100"; } },
    ESP: { restart() {}, getFreeHeap() { return 163840; } },
    RainbowColors_p: PALETTES.RainbowColors_p,
    RainbowStripeColors_p: PALETTES.RainbowStripeColors_p,
    OceanColors_p: PALETTES.OceanColors_p,
    CloudColors_p: PALETTES.CloudColors_p,
    LavaColors_p: PALETTES.LavaColors_p,
    ForestColors_p: PALETTES.ForestColors_p,
    PartyColors_p: PALETTES.PartyColors_p,
    HeatColors_p: PALETTES.HeatColors_p,
    LINEARBLEND: 1,
    LINEARBLEND_NOWRAP: 2,
    NOBLEND: 0,
    FORWARD_HUES: 0,
    BACKWARD_HUES: 1,
    SHORTEST_HUES: 2,
    LONGEST_HUES: 3,
    TypicalLEDStrip: 0xffb0f0,
    TypicalSMD5050: 0xffb0f0,
    Typical8mmPixel: 0xffe08c,
    TypicalPixelString: 0xffb0f0,
    UncorrectedColor: 0xffffff,
    UncorrectedTemperature: 0xffffff,
    Tungsten40W: 0xffc58f,
    Tungsten100W: 0xffd6aa,
    Halogen: 0xfff1e0,
    CarbonArc: 0xffFAF4,
    HighNoonSun: 0xfffffb,
    DirectSunlight: 0xffffff,
    OvercastSky: 0xc9e2ff,
    ClearBlueSky: 0x409cff,
    HIGH: 1,
    LOW: 0,
    INPUT: 0,
    OUTPUT: 1,
    INPUT_PULLUP: 2,
    INPUT_PULLDOWN: 3,
    LED_BUILTIN: 13,
    NULL: null,
    nullptr: null,
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI
  };

  for (let p = 0; p <= 53; p++) {
    sandboxEnv[`D${p}`] = p;
    sandboxEnv[`GPIO_NUM_${p}`] = p;
  }
  for (let a = 0; a <= 15; a++) {
    sandboxEnv[`A${a}`] = 14 + a;
    sandboxEnv[`PIN_A${a}`] = 14 + a;
  }

  const CHIPSET_NAMES = [
    "WS2812B", "WS2812", "WS2811", "WS2811_400", "WS2813", "WS2815", "NEOPIXEL",
    "SK6812", "SK6812RGBW", "SK6822", "APA102", "APA102C", "DOTSTAR", "WS2801", "LPD8806",
    "LPD6803", "APA104", "APA106", "PL9823", "TM1809", "TM1804", "TM1803",
    "UCS1903", "UCS1903B", "UCS1904", "UCS2903", "SM16703", "SM16716", "P9813",
    "GW6205", "GW6205_400", "SMART_MATRIX", "OCTOWS2811"
  ];
  const COLOR_ORDER_NAMES = ["RGB", "RBG", "GRB", "GBR", "BRG", "BGR"];
  CHIPSET_NAMES.forEach((c) => { sandboxEnv[c] = c; });
  COLOR_ORDER_NAMES.forEach((o) => { sandboxEnv[o] = o; });

  function compileWithAutoStubs() {
    for (let attempt = 0; attempt < 12; attempt++) {
      const envKeys = Object.keys(sandboxEnv);
      const envVals = envKeys.map((k) => sandboxEnv[k]);
      const wrappedBody = `
        ${transpiledCode}
        return {
          setup: typeof setup === "function" ? setup : () => {},
          loop: typeof loop === "function" ? loop : () => {},
          XY: typeof XY === "function" ? XY : null,
          customMap: typeof MAP !== "undefined" && Array.isArray(MAP) ? MAP : null
        };
      `;
      let factory;
      try {
        factory = new Function(...envKeys, wrappedBody);
      } catch (err) {
        throw new Error(`C++ Sketch Syntax Error: ${err.message}`);
      }

      try {
        return factory(...envVals);
      } catch (err) {
        const refMatch = err && err.message && err.message.match(/([A-Za-z_]\w*) is not defined/);
        if (refMatch && !Object.prototype.hasOwnProperty.call(sandboxEnv, refMatch[1])) {
          const sym = refMatch[1];
          sandboxEnv[sym] = 0;
          serialLogs.push(`[Auto-defined constant ${sym} = 0]`);
          continue;
        }
        throw new Error(`Sketch Initialization Error: ${err.message}`);
      }
    }
    throw new Error("Unable to resolve external symbols in sketch.");
  }

  let hooks = compileWithAutoStubs();

  if (!primaryArray) {
    primaryArray = __getOrCreateCRGBArray(specs.ledArrayName || "leds", specs.numLeds || 60);
  }

  // Run setup() with auto-stubbing support for unknown external calls/constants
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      loopGuardCounter = 0;
      hooks.setup();
      pendingFrames.length = 0;
      break;
    } catch (err) {
      const refMatch = err && err.message && err.message.match(/([A-Za-z_]\w*) is not defined/);
      if (refMatch && !Object.prototype.hasOwnProperty.call(sandboxEnv, refMatch[1])) {
        const sym = refMatch[1];
        // Stub as a callable function that returns 0 and has numeric valueOf 0
        const stubFn = () => 0;
        stubFn.valueOf = () => 0;
        sandboxEnv[sym] = stubFn;
        serialLogs.push(`[Auto-stubbed external symbol in setup(): ${sym}]`);
        hooks = compileWithAutoStubs();
        continue;
      }
      lastRuntimeError = `Runtime Error in setup(): ${err.message}`;
      serialLogs.push(`[${lastRuntimeError}]`);
      break;
    }
  }

  function applySnapshotToPrimary(snap) {
    const raw = primaryArray.__raw;
    const len = Math.min(raw.length, snap.rgb.length);
    for (let i = 0; i < len; i++) {
      raw[i].r = snap.rgb[i][0];
      raw[i].g = snap.rgb[i][1];
      raw[i].b = snap.rgb[i][2];
    }
    masterBrightness = snap.brightness;
    frameDelayMs = snap.delayMs;
  }

  return {
    step(customDtMs) {
      if (pendingFrames.length > 0) {
        const nextSnap = pendingFrames.shift();
        applySnapshotToPrimary(nextSnap);
        frameCount++;
        return this.getState();
      }

      showCalledInCurrentLoop = false;
      ledsDirtySinceLastShow = false;
      loopGuardCounter = 0;
      const millisBefore = simMillis;

      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          hooks.loop();
          lastRuntimeError = null;
          break;
        } catch (err) {
          const refMatch = err && err.message && err.message.match(/([A-Za-z_]\w*) is not defined/);
          if (refMatch && !Object.prototype.hasOwnProperty.call(sandboxEnv, refMatch[1])) {
            const sym = refMatch[1];
            const stubFn = () => 0;
            stubFn.valueOf = () => 0;
            sandboxEnv[sym] = stubFn;
            serialLogs.push(`[Auto-stubbed external symbol in loop(): ${sym}]`);
            hooks = compileWithAutoStubs();
            continue;
          }
          lastRuntimeError = `Runtime Error in loop(): ${err.message}`;
          if (serialLogs.length < 150) {
            serialLogs.push(`[${lastRuntimeError}]`);
          }
          break;
        }
      }

      if (pendingFrames.length > 1) {
        const firstSnap = pendingFrames.shift();
        applySnapshotToPrimary(firstSnap);
        frameCount++;
        return this.getState();
      }

      if (pendingFrames.length === 1) {
        const onlySnap = pendingFrames.shift();
        applySnapshotToPrimary(onlySnap);
      }

      if (simMillis === millisBefore) {
        const dt = customDtMs !== undefined && customDtMs > 0 ? customDtMs : frameDelayMs;
        simMillis += dt;
      }

      frameCount++;
      return this.getState();
    },
    reset() {
      simMillis = 0;
      frameCount = 0;
      lastRuntimeError = null;
      pendingFrames.length = 0;
      Object.keys(everyNTimers).forEach((k) => delete everyNTimers[k]);
      Object.keys(__staticVars).forEach((k) => delete __staticVars[k]);
      Object.values(staticArrays).forEach((arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = 0;
      });
      FastLED.clear();
      try {
        loopGuardCounter = 0;
        hooks.setup();
        pendingFrames.length = 0;
      } catch (_) {}
      return this.getState();
    },
    getState() {
      const raw = primaryArray.__raw;
      const bScale = masterBrightness / 255.0;

      let totalMa = raw.length * 1.0;
      for (let i = 0; i < raw.length; i++) {
        const px = raw[i];
        const rOut = px.r * bScale;
        const gOut = px.g * bScale;
        const bOut = px.b * bScale;
        totalMa += ((rOut + gOut + bOut) / 255.0) * 20.0;
      }

      let powerThrottleScale = 1.0;
      if (maxMilliamps && totalMa > maxMilliamps) {
        powerThrottleScale = maxMilliamps / totalMa;
      }

      return {
        leds: raw,
        customMap: hooks && hooks.customMap ? hooks.customMap : null,
        brightness: masterBrightness,
        powerThrottleScale,
        simMillis,
        frameCount,
        frameDelayMs,
        queuedFrames: pendingFrames.length,
        runtimeError: lastRuntimeError,
        currentMa: Math.round(totalMa * powerThrottleScale),
        unthrottledMa: Math.round(totalMa),
        watts: ((totalMa * powerThrottleScale * maxVolts) / 1000).toFixed(2),
        serialLogs
      };
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createFastLEDSimulator,
    CRGB,
    CHSV,
    PALETTES
  };
}
