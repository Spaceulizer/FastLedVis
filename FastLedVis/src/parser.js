// FastLedVis - FastLED Arduino Sketch Static Scanner & C++-to-JS Transpiler (v5 - Full Struct, Typedef, Function Pointer & Custom Type Support)

const KNOWN_CHIPSETS = [
  "WS2812B", "WS2812", "WS2811", "WS2811_400", "WS2813", "WS2815", "NEOPIXEL",
  "SK6812", "SK6812RGBW", "SK6822", "APA102", "APA102C", "DOTSTAR", "WS2801", "LPD8806",
  "LPD6803", "APA104", "APA106", "PL9823", "TM1809", "TM1804", "TM1803",
  "UCS1903", "UCS1903B", "UCS1904", "UCS2903", "SM16703", "SM16716", "P9813",
  "GW6205", "GW6205_400", "SMART_MATRIX", "OCTOWS2811"
];

const SPI_CHIPSETS = new Set([
  "APA102", "APA102C", "DOTSTAR", "WS2801", "LPD8806", "LPD6803", "P9813", "SM16716"
]);

const KNOWN_COLOR_ORDERS = new Set([
  "RGB", "RBG", "GRB", "GBR", "BRG", "BGR"
]);

const JS_RESERVED_WORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
  "return", "function", "var", "let", "const", "new", "delete", "typeof", "void",
  "try", "catch", "finally", "throw", "class", "extends", "super", "import", "export",
  "in", "of", "instanceof", "this", "true", "false", "null", "undefined", "NaN", "Infinity"
]);

/**
 * Decodes accidental HTML entities if code was copied from a web forum/HTML page.
 */
function normalizeRawSource(code) {
  let s = String(code || "").replace(/\u00a0/g, " ");
  // Heal markdown-mangled leading '-' lines where `-   type x = expr\n128;` had '-' moved to line start
  s = s.replace(/^\s*-\s+((?:int16_t|int32_t|int|long|unsigned\s+long|float|uint8_t|uint16_t)\s+[A-Za-z_]\w*\s*=\s*[^;\n]+)\r?\n\s*(\d+\s*;)/gm, "  $1 - $2");
  s = s.replace(/^\s*-\s+(unsigned\s+long\s+elapsed\s*=\s*millis\(\))\s*(crossfadeStartTime\s*;)/gm, "  $1 - $2");
  if (/&(?:amp|lt|gt|quot|#39|#x27);/.test(s)) {
    s = s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
      .replace(/&amp;/g, "&");
  }
  return s;
}

/**
 * Strips C/C++ block and line comments while preserving newlines for accurate line numbering.
 */
function stripCommentsPreserveLines(code) {
  let out = "";
  let i = 0;
  const len = code.length;
  let inString = false;
  let stringChar = "";

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < len) {
        out += code[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < len && code[i] !== "\n") {
        i++;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < len && !(code[i] === "*" && code[i + 1] === "/")) {
        if (code[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

function joinBackslashContinuations(code) {
  return code.replace(/\\\r?\n/g, " ");
}

/**
 * Balanced delimiter extractor ('('..')' or '{'..'}') starting at `openIdx`.
 */
function extractBalancedBlock(str, openIdx, openChar = "(", closeChar = ")") {
  if (str[openIdx] !== openChar) return null;
  let depth = 0;
  let inStr = false;
  let strCh = "";
  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "\\" && i + 1 < str.length) {
        i++;
        continue;
      }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strCh = ch;
      continue;
    }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(openIdx + 1, i),
          closeIdx: i
        };
      }
    }
  }
  return null;
}

function extractBalancedParens(str, openParenIdx) {
  return extractBalancedBlock(str, openParenIdx, "(", ")");
}

function replaceMacroCallsBalanced(code, regexPrefix, replacerFn) {
  const re = new RegExp(regexPrefix, "g");
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = re.exec(code)) !== null) {
    const matchStart = match.index;
    const openParenIdx = matchStart + match[0].length - 1;
    if (code[openParenIdx] !== "(") continue;

    const balanced = extractBalancedParens(code, openParenIdx);
    if (!balanced) continue;

    result += code.slice(lastIndex, matchStart);
    result += replacerFn(match[0].slice(0, -1).trim(), balanced.content);
    lastIndex = balanced.closeIdx + 1;
    re.lastIndex = lastIndex;
  }

  result += code.slice(lastIndex);
  return result;
}

function resolveConstantInt(expr, defines, depth = 0) {
  if (expr === undefined || expr === null || depth > 10) return null;
  let s = String(expr).trim().replace(/;$/, "").trim();
  if (!s) return null;

  s = s.replace(/\b([A-Za-z_]\w*)\b/g, (match) => {
    if (Object.prototype.hasOwnProperty.call(defines, match)) {
      const resolved = resolveConstantInt(defines[match].value, defines, depth + 1);
      return resolved !== null ? String(resolved) : defines[match].value;
    }
    return match;
  });

  s = s.replace(/\b(0x[0-9a-fA-F]+|0b[01]+|\d+)[uUlL]+\b/g, "$1");
  s = s.replace(/(\b\d+\.\d*|\B\.\d+|\b\d+)[fF]\b/g, "$1");

  if (/^[0-9a-fA-FxXbB\s+\-*/%()<>&|^~.?:\!]+$/.test(s)) {
    try {
      const val = Function(`"use strict"; return (${s});`)();
      if (typeof val === "number" && Number.isFinite(val)) {
        return Math.floor(val);
      }
    } catch (_) {
      return null;
    }
  }
  return null;
}

function resolveIdentifier(token, defines, depth = 0) {
  if (!token || depth > 10) return token;
  const trimmed = String(token).trim().replace(/;$/, "").trim();
  if (Object.prototype.hasOwnProperty.call(defines, trimmed)) {
    return resolveIdentifier(defines[trimmed].value, defines, depth + 1);
  }
  return trimmed;
}

/**
 * Scans an Arduino sketch to verify FastLED usage and extract hardware specifications.
 */
function scanFastLEDSketch(rawCode) {
  const code = normalizeRawSource(rawCode);
  const cleanCode = joinBackslashContinuations(stripCommentsPreserveLines(code));
  const lines = cleanCode.split("\n");

  const findings = [];
  const warnings = [];
  const defines = {};

  let hasFastLEDHeader = false;
  let headerLine = null;
  let hasAddLeds = false;
  let addLedsLine = null;
  let hasFastLEDSymbols = false;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/#\s*include\s*[<"](?:FastLED|fastspi_led2)\.h[>"]/i.test(line)) {
      hasFastLEDHeader = true;
      headerLine = lineNum;
      findings.push({
        key: "Library Header",
        value: "#include <FastLED.h>",
        line: lineNum,
        detail: "Verified FastLED library header inclusion"
      });
    }
    if (/(?:FastLED|LEDS)\s*\.\s*addLeds\s*</.test(line)) {
      hasAddLeds = true;
      if (!addLedsLine) addLedsLine = lineNum;
    }
    if (
      /\b(?:FastLED|LEDS)\s*\./.test(line) ||
      /\b(?:CRGB|CRGBArray|CRGBSet|CHSV|CRGBPalette16|fill_rainbow|fill_solid|ColorFromPalette|beatsin8|beatsin16)\b/.test(line)
    ) {
      hasFastLEDSymbols = true;
    }
  });

  if (!hasFastLEDHeader && !hasAddLeds && !hasFastLEDSymbols) {
    return {
      valid: false,
      rejectedReason:
        "Sketch Rejected: No FastLED library inclusion (#include <FastLED.h>), FastLED.addLeds<...>(), or CRGB LED definitions found. FastLedVis only visualizes Arduino sketches that use FastLED.",
      specs: null,
      findings: [],
      warnings: [
        "Missing #include <FastLED.h>",
        "Missing FastLED.addLeds<CHIPSET, DATA_PIN>(leds, NUM_LEDS) call"
      ]
    };
  }

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const defMatch = line.match(/^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/);
    if (defMatch) {
      const name = defMatch[1];
      const val = defMatch[2].trim().replace(/;$/, "").trim();
      defines[name] = { value: val, line: lineNum };
    }

    const constMatch = line.match(
      /^\s*(?:const|constexpr|static\s+const|static)?\s*(?:unsigned\s+|signed\s+)?(?:int|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|byte|word|long|short|size_t|bool|boolean)\s+([A-Za-z_]\w*)\s*=\s*([^;,]+)\s*;/
    );
    if (constMatch) {
      const name = constMatch[1];
      const val = constMatch[2].trim();
      if (!defines[name]) {
        defines[name] = { value: val, line: lineNum };
      }
    }
  });

  let ledArrayName = "leds";
  let numLedsFromArray = null;
  let arrayLine = null;
  let arrayDim1 = null;
  let arrayDim2 = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m2d = line.match(/\bCRGB\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]/);
    if (m2d) {
      ledArrayName = m2d[1];
      arrayDim1 = resolveConstantInt(m2d[2], defines) || 1;
      arrayDim2 = resolveConstantInt(m2d[3], defines) || 60;
      numLedsFromArray = arrayDim1 * arrayDim2;
      arrayLine = i + 1;
      break;
    }
    const m1 = line.match(/\bCRGB\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]/);
    const m2 = line.match(/\bCRGBArray\s*<\s*([^>]+)\s*>\s*([A-Za-z_]\w*)/);
    if (m1) {
      ledArrayName = m1[1];
      numLedsFromArray = resolveConstantInt(m1[2], defines);
      arrayLine = i + 1;
      break;
    } else if (m2) {
      ledArrayName = m2[2];
      numLedsFromArray = resolveConstantInt(m2[1], defines);
      arrayLine = i + 1;
      break;
    }
  }

  let chipset = "WS2812B";
  let dataPin = "6";
  let clockPin = null;
  let colorOrder = "GRB";
  let numLedsFromAddLeds = null;
  let colorCorrection = "TypicalLEDStrip";

  const addLedsHeaderRe = /(?:FastLED|LEDS)\s*\.\s*addLeds\s*<\s*([^>]+)\s*>\s*\(/g;
  let headerMatch;
  let totalAddLedsCount = 0;
  let addLedsCalls = 0;

  while ((headerMatch = addLedsHeaderRe.exec(cleanCode)) !== null) {
    const openParenIdx = headerMatch.index + headerMatch[0].length - 1;
    const balanced = extractBalancedParens(cleanCode, openParenIdx);
    if (!balanced) continue;

    addLedsCalls++;
    const tplParams = headerMatch[1].split(",").map((s) => s.trim());
    const callParams = splitTopLevelDeclarators(balanced.content);

    if (addLedsCalls === 1) {
      if (tplParams.length >= 1) {
        chipset = resolveIdentifier(tplParams[0], defines);
      }
      if (tplParams.length === 2) {
        const p1 = resolveIdentifier(tplParams[1], defines);
        dataPin = String(resolveConstantInt(p1, defines) ?? p1);
      } else if (tplParams.length === 3) {
        const p1 = resolveIdentifier(tplParams[1], defines);
        const p2 = resolveIdentifier(tplParams[2], defines);
        dataPin = String(resolveConstantInt(p1, defines) ?? p1);
        if (KNOWN_COLOR_ORDERS.has(p2.toUpperCase())) {
          colorOrder = p2.toUpperCase();
        } else {
          clockPin = String(resolveConstantInt(p2, defines) ?? p2);
        }
      } else if (tplParams.length >= 4) {
        const p1 = resolveIdentifier(tplParams[1], defines);
        const p2 = resolveIdentifier(tplParams[2], defines);
        const p3 = resolveIdentifier(tplParams[3], defines);
        dataPin = String(resolveConstantInt(p1, defines) ?? p1);
        clockPin = String(resolveConstantInt(p2, defines) ?? p2);
        if (KNOWN_COLOR_ORDERS.has(p3.toUpperCase())) {
          colorOrder = p3.toUpperCase();
        }
      }

      if (callParams.length >= 1 && callParams[0]) {
        const rawArr = callParams[0].replace(/^&\s*/, "").trim();
        const baseNameMatch = rawArr.match(/^([A-Za-z_]\w*)/);
        if (baseNameMatch) ledArrayName = baseNameMatch[1];
      }
    }

    if (callParams.length === 2) {
      const cVal = resolveConstantInt(callParams[1], defines);
      if (cVal) totalAddLedsCount += cVal;
    } else if (callParams.length >= 3) {
      const cVal = resolveConstantInt(callParams[2], defines);
      if (cVal) totalAddLedsCount += cVal;
    }
  }

  if (totalAddLedsCount > 0) {
    numLedsFromAddLeds = totalAddLedsCount;
  } else if (addLedsCalls === 0) {
    warnings.push(
      "No explicit FastLED.addLeds<...>() call found; using inferred defaults from #define macros."
    );
  }

  const numLedsMacro =
    defines.NUM_LEDS ||
    defines.LED_COUNT ||
    defines.MAX_LEDS ||
    defines.N_LEDS ||
    defines.RING_LEDS ||
    defines.TOTAL_LEDS ||
    defines.NUM_PIXELS ||
    defines.STRIPE_LENGTH;

  let numLeds =
    numLedsFromArray ||
    numLedsFromAddLeds ||
    (numLedsMacro ? resolveConstantInt(numLedsMacro.value, defines) : null) ||
    60;

  numLeds = Math.max(1, Math.min(1024, numLeds));

  if (addLedsCalls === 0) {
    const pinMacro = defines.DATA_PIN || defines.LED_PIN || defines.PIN || defines.STRIP_PIN;
    if (pinMacro) {
      dataPin = String(resolveConstantInt(pinMacro.value, defines) ?? pinMacro.value);
    }
    const chipMacro = defines.LED_TYPE || defines.CHIPSET || defines.LED_CHIPSET;
    if (chipMacro) {
      chipset = resolveIdentifier(chipMacro.value, defines);
    }
    const orderMacro = defines.COLOR_ORDER;
    if (orderMacro) {
      const ord = resolveIdentifier(orderMacro.value, defines).toUpperCase();
      if (KNOWN_COLOR_ORDERS.has(ord)) colorOrder = ord;
    }
  }

  let brightness = 255;
  let brightnessLine = null;
  const brightCallMatch = cleanCode.match(/(?:FastLED|LEDS)\s*\.\s*setBrightness\s*\(\s*([^)]+)\s*\)/);
  if (brightCallMatch) {
    const bVal = resolveConstantInt(brightCallMatch[1], defines);
    if (bVal !== null) brightness = Math.max(0, Math.min(255, bVal));
  } else if (defines.BRIGHTNESS || defines.MAX_BRIGHTNESS) {
    const bm = defines.BRIGHTNESS || defines.MAX_BRIGHTNESS;
    const bVal = resolveConstantInt(bm.value, defines);
    if (bVal !== null) brightness = Math.max(0, Math.min(255, bVal));
    brightnessLine = bm.line;
  }

  let maxVolts = 5;
  let maxMilliamps = null;
  const powerMatch = cleanCode.match(
    /(?:FastLED|LEDS)\s*\.\s*setMaxPowerInVoltsAndMilliamps\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/
  );
  if (powerMatch) {
    maxVolts = resolveConstantInt(powerMatch[1], defines) || 5;
    maxMilliamps = resolveConstantInt(powerMatch[2], defines) || null;
  }

  const corrMatch = cleanCode.match(/\.setCorrection\s*\(\s*([A-Za-z0-9_]+)\s*\)/);
  if (corrMatch) {
    colorCorrection = corrMatch[1];
  }

  const widthMacro =
    defines.MATRIX_WIDTH || defines.kMatrixWidth || defines.WIDTH || defines.LED_COLS || defines.COLS || defines.X_DIM;
  const heightMacro =
    defines.MATRIX_HEIGHT || defines.kMatrixHeight || defines.HEIGHT || defines.LED_ROWS || defines.ROWS || defines.Y_DIM;

  let matrixWidth = widthMacro ? resolveConstantInt(widthMacro.value, defines) : null;
  let matrixHeight = heightMacro ? resolveConstantInt(heightMacro.value, defines) : null;
  if (!matrixWidth && !matrixHeight && arrayDim1 && arrayDim2 && arrayDim1 > 1 && arrayDim2 > 1) {
    matrixWidth = arrayDim2;
    matrixHeight = arrayDim1;
  }

  const hasXYFunc = /\bXY\s*\(\s*(?:uint8_t|uint16_t|int|byte|char)?\s*\w+\s*,/.test(cleanCode);

  let serpentine = true;
  if (defines.SERPENTINE !== undefined) {
    const sVal = String(defines.SERPENTINE.value).trim().toLowerCase();
    serpentine = sVal === "true" || sVal === "1";
  } else if (defines.kMatrixSerpentineLayout !== undefined) {
    const sVal = String(defines.kMatrixSerpentineLayout.value).trim().toLowerCase();
    serpentine = sVal === "true" || sVal === "1";
  }

  const hasCustomCoordMap = /\bstruct\s+\w+\s*\{[^}]*\bx\b[^}]*\by\b[^}]*\}[\s\S]*?\bMAP\s*\[/.test(cleanCode);
  let topology = "1d_strip";
  if (hasCustomCoordMap) {
    topology = "custom_map";
  } else if ((matrixWidth && matrixHeight && matrixWidth > 1 && matrixHeight > 1) || hasXYFunc) {
    topology = "2d_matrix";
    if (!matrixWidth || !matrixHeight) {
      const side = Math.round(Math.sqrt(numLeds));
      matrixWidth = side;
      matrixHeight = Math.ceil(numLeds / side);
    }
  } else if (
    defines.RING_LEDS ||
    (/\bring\b/i.test(code) && (numLeds === 12 || numLeds === 16 || numLeds === 24 || numLeds === 32 || numLeds === 60))
  ) {
    topology = "ring";
  }

  findings.push({
    key: "LED Count (NUM_LEDS)",
    value: `${numLeds} LEDs`,
    line: numLedsMacro ? numLedsMacro.line : arrayLine || addLedsLine || 1,
    detail: `Array "${ledArrayName}[${numLeds}]"`
  });
  findings.push({
    key: "LED Chipset",
    value: chipset,
    line: addLedsLine || (defines.LED_TYPE ? defines.LED_TYPE.line : 1),
    detail: SPI_CHIPSETS.has(chipset.toUpperCase()) ? "4-Wire SPI Addressable" : "3-Wire Clockless Single-Data"
  });
  findings.push({
    key: "Wiring Pins",
    value: clockPin ? `DATA: ${dataPin}, CLK: ${clockPin}` : `DATA: ${dataPin}`,
    line: defines.DATA_PIN ? defines.DATA_PIN.line : defines.LED_PIN ? defines.LED_PIN.line : addLedsLine || 1,
    detail: clockPin ? "Hardware/Software SPI Pinout" : "Digital PWM/Data Pinout"
  });
  findings.push({
    key: "Color Order",
    value: colorOrder,
    line: defines.COLOR_ORDER ? defines.COLOR_ORDER.line : addLedsLine || 1,
    detail: `Subpixel sequence (${colorOrder.split("").join(" → ")})`
  });
  findings.push({
    key: "Master Brightness",
    value: `${brightness} / 255 (${Math.round((brightness / 255) * 100)}%)`,
    line: brightnessLine || addLedsLine || 1,
    detail: maxMilliamps ? `Power limit: ${maxVolts}V @ ${maxMilliamps}mA` : `Color Profile: ${colorCorrection}`
  });
  findings.push({
    key: "Physical Geometry",
    value:
      topology === "custom_map"
        ? `${numLeds}-LED 2D Coordinate Map (MAP[x,y])`
        : topology === "2d_matrix"
        ? `${matrixWidth}×${matrixHeight} Matrix (${serpentine ? "Serpentine" : "Row-Major"})`
        : topology === "ring"
        ? `${numLeds}-LED Circular Ring`
        : `${numLeds}-LED Linear Strip`,
    line: widthMacro ? widthMacro.line : numLedsMacro ? numLedsMacro.line : 1,
    detail: hasXYFunc ? "Custom XY(x, y) mapping detected in sketch" : "Auto-detected from sketch definitions"
  });

  return {
    valid: true,
    rejectedReason: null,
    specs: {
      numLeds,
      chipset,
      isSPI: SPI_CHIPSETS.has(chipset.toUpperCase()),
      dataPin,
      clockPin,
      colorOrder,
      brightness,
      maxVolts,
      maxMilliamps,
      colorCorrection,
      ledArrayName,
      topology,
      matrixWidth: matrixWidth || 16,
      matrixHeight: matrixHeight || 16,
      serpentine,
      hasXYFunc
    },
    defines,
    findings,
    warnings
  };
}

/**
 * Splits a C++ parameter or declarator list at top-level commas.
 */
function splitTopLevelDeclarators(declStr) {
  const result = [];
  let current = "";
  let depth = 0;
  let inStr = false;
  let strCh = "";

  for (let i = 0; i < declStr.length; i++) {
    const ch = declStr[i];
    if (inStr) {
      current += ch;
      if (ch === "\\" && i + 1 < declStr.length) {
        current += declStr[++i];
        continue;
      }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strCh = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);

    if (ch === "," && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function transpileParams(paramStr) {
  const trimmed = paramStr.trim();
  if (!trimmed || trimmed === "void") return "";

  const parts = splitTopLevelDeclarators(trimmed);
  return parts
    .map((p) => {
      let piece = p.trim();
      if (!piece) return "";
      let defaultVal = null;
      const eqIdx = piece.indexOf("=");
      if (eqIdx !== -1) {
        defaultVal = piece.slice(eqIdx + 1).trim();
        piece = piece.slice(0, eqIdx).trim();
      }
      // Handle function pointer parameter: `void (*fn)(int)` -> `fn`
      const fnPtrMatch = piece.match(/\(\s*\*\s*([A-Za-z_]\w*)\s*\)\s*\([^)]*\)\s*$/);
      if (fnPtrMatch) {
        return defaultVal !== null ? `${fnPtrMatch[1]} = ${defaultVal}` : fnPtrMatch[1];
      }
      piece = piece.replace(/(?:\[\s*[^\]]*\s*\])+\s*$/, "").trim();
      piece = piece.replace(/\(\s*[*&]+\s*([A-Za-z_]\w*)\s*\)/, "$1");
      const idMatch = piece.match(/([A-Za-z_]\w*)\s*$/);
      const varName = idMatch ? idMatch[1] : piece;
      return defaultVal !== null ? `${varName} = ${defaultVal}` : varName;
    })
    .join(", ");
}

/**
 * Generates a JS constructor function for a C++ struct that supports BOTH:
 * - Object initialization: `new StructName({ fieldA: 1 })`
 * - Positional / brace initialization: `StructName(1, 2)` or `StructName([1, 2])`
 * And exposes fields both by name (`inst.fieldA`) and by index (`inst[0]`).
 */
function buildStructConstructorJS(structName, body) {
  const fieldDefs = [];
  body.split(";").forEach((stmt) => {
    const s = stmt.trim();
    if (!s) return;
    // Check for function pointer member: `void (*fn)(...)`
    const fnPtr = s.match(/\(\s*\*\s*([A-Za-z_]\w*)\s*\)\s*\([^)]*\)/);
    if (fnPtr) {
      fieldDefs.push({ name: fnPtr[1], defVal: "null" });
      return;
    }
    if (s.includes("(") && s.includes("{")) return; // skip inline methods
    const eqIdx = s.indexOf("=");
    let declPart = eqIdx !== -1 ? s.slice(0, eqIdx).trim() : s;
    let defVal = eqIdx !== -1 ? s.slice(eqIdx + 1).trim() : "0";
    if (/\bCRGB\b/.test(declPart)) defVal = eqIdx !== -1 ? defVal : "CRGB(0,0,0)";
    declPart = declPart.replace(/(?:\[\s*[^\]]*\s*\])+\s*$/, "").trim();
    const idMatch = declPart.match(/([A-Za-z_]\w*)\s*$/);
    if (idMatch) {
      fieldDefs.push({ name: idMatch[1], defVal });
    }
  });

  const assignments = fieldDefs
    .map((f, idx) => {
      return `this.${f.name} = (isPositional ? args[${idx}] : (initObj && initObj.${f.name} !== undefined ? initObj.${f.name} : undefined)) ?? (${f.defVal}); this[${idx}] = this.${f.name};`;
    })
    .join(" ");

  return `function ${structName}() { const args = Array.from(arguments); if (!(this instanceof ${structName})) return new ${structName}(...args); const isPositional = args.length > 1 || (args.length === 1 && (typeof args[0] !== "object" || args[0] === null || args[0] instanceof CRGB || args[0] instanceof CHSV)); const initObj = (!isPositional && Array.isArray(args[0])) ? null : args[0]; if (Array.isArray(args[0])) { return new ${structName}(...args[0]); } ${assignments} }`;
}

/**
 * Parses and transforms all C++ `typedef struct ...`, `struct Name { ... };`, and `struct OptionalName { ... } varName[] = ...;`
 * using balanced braces `{ ... }` so nested or subsequent `{ ... }` blocks are never mangled.
 */
function transpileStructsBalanced(code, customStructs, structNamesSet) {
  // 1. Handle `typedef struct OptionalName { ... } AliasName;`
  let out = "";
  let idx = 0;
  const typedefStructRe = /\btypedef\s+struct(?:\s+([A-Za-z_]\w*))?\s*\{/g;
  let m;
  while ((m = typedefStructRe.exec(code)) !== null) {
    const startIdx = m.index;
    const openBraceIdx = startIdx + m[0].length - 1;
    const block = extractBalancedBlock(code, openBraceIdx, "{", "}");
    if (!block) continue;

    const afterBrace = code.slice(block.closeIdx + 1);
    const aliasMatch = afterBrace.match(/^\s*([A-Za-z_]\w*)\s*;/);
    if (!aliasMatch) continue;

    const optName = m[1];
    const aliasName = aliasMatch[1];
    customStructs.add(aliasName);
    structNamesSet.add(aliasName);
    if (optName) {
      customStructs.add(optName);
      structNamesSet.add(optName);
    }

    out += code.slice(idx, startIdx);
    out += buildStructConstructorJS(aliasName, block.content);
    if (optName && optName !== aliasName) {
      out += ` var ${optName} = ${aliasName};`;
    }
    idx = block.closeIdx + 1 + aliasMatch[0].length;
    typedefStructRe.lastIndex = idx;
  }
  out += code.slice(idx);
  code = out;

  // 2. Handle `struct OptionalName { ... } [optionalVarDecl];`
  out = "";
  idx = 0;
  let anonCounter = 1;
  const structRe = /\bstruct(?:\s+([A-Za-z_]\w*))?\s*\{/g;
  while ((m = structRe.exec(code)) !== null) {
    const startIdx = m.index;
    const openBraceIdx = startIdx + m[0].length - 1;
    const block = extractBalancedBlock(code, openBraceIdx, "{", "}");
    if (!block) continue;

    const afterBrace = code.slice(block.closeIdx + 1);
    const semiMatch = afterBrace.match(/^\s*;/);
    const inlineVarMatch = afterBrace.match(/^\s*([A-Za-z_]\w*)\s*((?:\[\s*[^\]]*\s*\])*)\s*(?:=\s*\{([\s\S]*?)\}\s*)?;/);

    const structName = m[1] || `__AnonStruct_${anonCounter++}`;
    customStructs.add(structName);
    structNamesSet.add(structName);

    if (semiMatch) {
      out += code.slice(idx, startIdx);
      out += buildStructConstructorJS(structName, block.content);
      idx = block.closeIdx + 1 + semiMatch[0].length;
      structRe.lastIndex = idx;
    } else if (inlineVarMatch) {
      const varName = inlineVarMatch[1];
      const brackets = inlineVarMatch[2];
      const initItems = inlineVarMatch[3];
      out += code.slice(idx, startIdx);
      out += buildStructConstructorJS(structName, block.content) + "\n";
      if (initItems !== undefined) {
        const jsItems = initItems.replace(/\{/g, `${structName}(`).replace(/\}/g, ")");
        out += brackets ? `var ${varName} = [${jsItems}];` : `var ${varName} = ${structName}(${jsItems});`;
      } else {
        out += brackets ? `var ${varName} = [];` : `var ${varName} = new ${structName}();`;
      }
      idx = block.closeIdx + 1 + inlineVarMatch[0].length;
      structRe.lastIndex = idx;
    }
  }
  out += code.slice(idx);
  return out;
}

/**
 * Transpiles an Arduino FastLED C++ sketch into executable JavaScript body for the FastLedVis Sandbox Runtime.
 */
function transpileFastLEDSketch(rawCode, specs) {
  let code = joinBackslashContinuations(stripCommentsPreserveLines(normalizeRawSource(rawCode)));

  // 1. Strip #include, #pragma, #ifdef, #ifndef, #else, #endif, #undef, FASTLED_USING_NAMESPACE
  code = code.replace(/^\s*#\s*(?:include|pragma|ifdef|ifndef|if|elif|else|endif|undef|error|warning).*$/gm, "");
  code = code.replace(/\bFASTLED_USING_NAMESPACE\s*;?/g, "");

  // 2. Strip MCU attribute macros (IRAM_ATTR, ICACHE_RAM_ATTR, FLASHMEM, PROGMEM)
  code = code.replace(/\b(?:PROGMEM|IRAM_ATTR|ICACHE_RAM_ATTR|ICACHE_FLASH_ATTR|FLASHMEM|DMAMEM)\b/g, "");
  code = code.replace(/\bstd\s*::\s*/g, "");
  code = code.replace(/^\s*extern\s+[^;=]+;\s*$/gm, "");
  code = code.replace(/\bextern\s+/g, "");

  // 3. Strip C++ numeric literal suffixes: 0.5f, 1.0F, 1000UL, 255U, 500L
  code = code.replace(/(\b\d+\.\d*|\B\.\d+|\b\d+)[fF]\b/g, "$1");
  code = code.replace(/\b(0x[0-9a-fA-F]+|0b[01]+|\d+)[uUlL]+\b/g, "$1");

  // 4. Transform sizeof(...) expressions before #define macro expansion
  code = code.replace(
    /\bsizeof\s*\(\s*([A-Za-z_]\w*)\s*\)\s*\/\s*sizeof\s*\(\s*[^)]+\s*\)/g,
    "__sizeofArray($1)"
  );
  code = code.replace(/\bsizeof\s*\(\s*([^)]+)\s*\)/g, "__sizeof($1)");

  // 5. Transform #define directives
  code = code.replace(
    /^\s*#\s*define\s+([A-Za-z_]\w*)\(([^)]*)\)\s+(.+)$/gm,
    (_, name, args, body) => {
      if (name === "ARRAY_SIZE") {
        return `var ARRAY_SIZE = (A) => (A ? A.length : 0);`;
      }
      const cleanBody = body.trim().replace(/;$/, "");
      return `var ${name} = (${args}) => (${cleanBody});`;
    }
  );

  code = code.replace(/^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/gm, (_, name, val) => {
    const cleanVal = val.trim().replace(/;$/, "").trim();
    return `var ${name} = ${cleanVal};`;
  });

  code = code.replace(/^\s*#\s*define\s+([A-Za-z_]\w*)\s*$/gm, "var $1 = true;");

  // 6. Transform DEFINE_GRADIENT_PALETTE(name) { ... };
  code = code.replace(
    /\bDEFINE_GRADIENT_PALETTE\s*\(\s*([A-Za-z_]\w*)\s*\)\s*\{([\s\S]*?)\}\s*;?/g,
    (_, name, bytes) => `var ${name} = __createGradientPalette([${bytes}]);`
  );

  const customTypes = new Set();
  const structNamesSet = new Set();
  const structAliasMap = {};
  code = code.replace(/\bfunction\s*<[^>;{}]*>/g, "SimplePatternList");

  // 7. Transform C++ enum declarations: enum OptionalName { A, B = 3, C }; and record OptionalName in customTypes!
  code = code.replace(
    /\benum\s+(?:class\s+)?([A-Za-z_]\w*)?\s*\{([\s\S]*?)\}\s*;/g,
    (_, enumName, body) => {
      if (enumName) customTypes.add(enumName);
      const items = body.split(",").map((s) => s.trim()).filter(Boolean);
      let nextVal = 0;
      const assignments = items.map((item) => {
        const eq = item.indexOf("=");
        if (eq !== -1) {
          const k = item.slice(0, eq).trim();
          const v = item.slice(eq + 1).trim();
          const parsed = parseInt(v, 10);
          if (!Number.isNaN(parsed)) nextVal = parsed + 1;
          return `${k} = (${v})`;
        } else {
          return `${item} = ${nextVal++}`;
        }
      });
      const prefix = enumName
        ? `var ${enumName} = { ${items.map((it, idx) => `${it.split("=")[0].trim()}: ${idx}`).join(", ")} }; `
        : "";
      return assignments.length ? `${prefix}var ${assignments.join(", ")};` : prefix;
    }
  );

  // Also transform scoped enum references `EnumName::VALUE` -> `VALUE`
  customTypes.forEach((tName) => {
    code = code.replace(new RegExp(`\\b${tName}\\s*::\\s*([A-Za-z_]\\w*)`, "g"), "$1");
  });

  // 8. Transform C++ struct & typedef struct definitions using balanced braces
  code = transpileStructsBalanced(code, customTypes, structNamesSet);

  // 9. Extract custom type aliases from `typedef ...;` and `using Alias = ...;` before removing them!
  code = code.replace(/\btypedef\s+([^;]+);/g, (_, body) => {
    const fnPtr = body.match(/\(\s*\*\s*([A-Za-z_]\w*)\s*(?:\[\s*[^\]]*\s*\])?\s*\)/);
    if (fnPtr) {
      customTypes.add(fnPtr[1]);
      return `/* typedef ${fnPtr[1]} */`;
    }
    const cleaned = body.replace(/(?:\[\s*[^\]]*\s*\])+\s*$/, "").trim();
    const parts = cleaned.split(/\s+/);
    const idMatch = cleaned.match(/([A-Za-z_]\w*)\s*$/);
    if (idMatch) {
      const alias = idMatch[1];
      customTypes.add(alias);
      if (parts.length >= 2) {
        const srcType = parts[parts.length - 2].replace(/[*&]/g, "");
        if (structNamesSet.has(srcType)) {
          structNamesSet.add(alias);
          structAliasMap[alias] = structAliasMap[srcType] || srcType;
        }
      }
    }
    return `/* typedef removed */`;
  });

  code = code.replace(/\busing\s+([A-Za-z_]\w*)\s*=\s*[^;]+;/g, (_, aliasName) => {
    customTypes.add(aliasName);
    return `/* using ${aliasName} */`;
  });

  // 10. Transform direct C/C++ function-pointer array & scalar declarations:
  // e.g. `void (*patternList[])() = { rainbow, confetti };` or `void (*const patternList[])(uint8_t) = { ... };`
  code = code.replace(
    /\b(?:const\s+|static\s+)*[A-Za-z_]\w*(?:\s*[*&]+)*\s*\(\s*\*\s*(?:const\s+)?([A-Za-z_]\w*)\s*\[\s*[^\]]*\s*\]\s*\)\s*\([^)]*\)\s*=\s*\{([\s\S]*?)\}\s*;/g,
    (_, name, items) => `var ${name} = [${items}];`
  );
  // Single function pointer variable: `void (*currentPattern)() = rainbow;` or `void (*currentPattern)();`
  code = code.replace(
    /\b(?:const\s+|static\s+)*[A-Za-z_]\w*(?:\s*[*&]+)*\s*\(\s*\*\s*(?:const\s+)?([A-Za-z_]\w*)\s*\)\s*\([^)]*\)\s*(?:=\s*([^;]+))?\s*;/g,
    (_, name, initVal) => `var ${name} = ${initVal !== undefined ? initVal.trim() : "null"};`
  );

  // 11. Transform FastLED.addLeds<...>(...) and LEDS.addLeds<...>(...) with balanced parens
  code = replaceMacroCallsBalanced(
    code,
    "(?:FastLED|LEDS)\\s*\\.\\s*addLeds\\s*<\\s*[^>]+\\s*>\\s*\\(",
    (headerPrefix, argContent) => {
      const tplMatch = headerPrefix.match(/<\s*([^>]+)\s*>/);
      const tpl = tplMatch ? tplMatch[1] : "WS2812B, 6, GRB";
      return `FastLED.__addLeds([${tpl}], [${argContent}])`;
    }
  );

  // 12. Transform EVERY_N_MILLISECONDS / EVERY_N_SECONDS / EVERY_N_MILLIS / EVERY_N_MINUTES / EVERY_N_HOURS
  let timerCounter = 1;
  code = replaceMacroCallsBalanced(
    code,
    "\\bEVERY_N_(?:MILLISECONDS|MILLIS|MILLISECONDS_I|SECONDS|SECONDS_I|MINUTES|MINUTES_I|HOURS|HOURS_I)\\s*\\(",
    (macroName, argContent) => {
      const parts = splitTopLevelDeclarators(argContent);
      const timeExpr = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      let mult = 1;
      if (/^EVERY_N_SECONDS/.test(macroName)) mult = 1000;
      else if (/MINUTES/.test(macroName)) mult = 60000;
      else if (/HOURS/.test(macroName)) mult = 3600000;
      return `if (__everyNMillis(${timerCounter++}, (${timeExpr}) * ${mult}))`;
    }
  );

  // 13. Transform CRGB::ColorName -> CRGB.ColorName, HTMLColorCode:: -> CRGB.
  code = code.replace(/\b(?:CRGB|HTMLColorCode)\s*::\s*([A-Za-z_]\w*)/g, "CRGB.$1");

  // 14. Transform C++ lambdas: `[&](int i) { ... }` or `[=]() { ... }` -> `(i) => { ... }`
  code = code.replace(
    /\[\s*(?:&|=|[A-Za-z0-9_,\s&*=]*)\s*\]\s*(?:\(([^)]*)\))?\s*(?:->\s*[A-Za-z0-9_*&\s]+)?\s*\{/g,
    (_, params) => `(${transpileParams(params || "")}) => {`
  );
  code = code.replace(/\b(?:const\s+|static\s+)*auto\s*[*&]*\s*([A-Za-z_]\w*)\s*=/g, "var $1 =");

  // 15. Transform C++11 range-based for loops: `for (const auto &led : leds)` or `for (CRGB &px : leds)`
  code = code.replace(
    /\bfor\s*\(\s*(?:const\s+|volatile\s+)*(?:auto|CRGB|CHSV|[A-Za-z_]\w*)\s*[*&]*\s*([A-Za-z_]\w*)\s*:\s*([^)]+)\)/g,
    "for (let $1 of $2)"
  );

  // 16. Transform 2D and 1D CRGB array declarations:
  code = code.replace(
    /\b(?:static\s+)?CRGB\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*;/g,
    (_, name, d1, d2) => `var ${name} = __getOrCreateCRGB2DArray("${name}", ${d1}, ${d2});`
  );
  code = code.replace(
    /\b(?:static\s+)?CRGB\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*;/g,
    (_, name, size) => `var ${name} = __getOrCreateCRGBArray("${name}", ${size});`
  );
  code = code.replace(
    /\b(?:static\s+)?CRGBArray\s*<\s*([^>]+)\s*>\s*([A-Za-z_]\w*)\s*;/g,
    (_, size, name) => `var ${name} = __getOrCreateCRGBArray("${name}", ${size});`
  );
  code = code.replace(
    /\bCRGBSet\s+([A-Za-z_]\w*)\s*\(\s*([^)]+)\s*\)\s*;/g,
    (_, name, args) => `var ${name} = __createCRGBSet(${args});`
  );

  // 17. Hoist static arrays and static scalar variables so they persist across loop() calls
  const hoistedStatics = [];
  let staticCounter = 1;

  code = code.replace(
    /\bstatic\s+(?:const\s+)?(?:unsigned\s+|signed\s+)?[A-Za-z_]\w*\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*;/g,
    (_, varName, d1, d2) => {
      const key = `${varName}_2d_${staticCounter++}`;
      return `var ${varName} = __getStatic2DArray("${key}", ${d1}, ${d2});`;
    }
  );

  code = code.replace(
    /\bstatic\s+(?:const\s+)?(?:unsigned\s+|signed\s+)?[A-Za-z_]\w*\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*;/g,
    (_, varName, sizeExpr) => {
      const key = `${varName}_${staticCounter++}`;
      return `var ${varName} = __getStaticArray("${key}", ${sizeExpr});`;
    }
  );

  const cppTypeCore =
    "(?:void|auto|uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t|uint64_t|int64_t|size_t|int|long\\s+int|long\\s+long|long|short\\s+int|short|byte|word|float|double|bool|boolean|char|String|fract8|sfract7|accum88|CRGB|CHSV|CRGBPalette16|CRGBPalette32|CRGBPalette256|TProgmemRGBPalette16|TProgmemRGBPalette32|TProgmemRGBGradientPalettePtr|TProgmemRGBGradientPalette_byte|TBlendType|SimplePatternList|CEveryNMillis|CEveryNSeconds)";
  const customTypesJoined = customTypes.size > 0 ? "|" + Array.from(customTypes).join("|") : "";
  const fullTypePattern = `(?:const\\s+|volatile\\s+|static\\s+|inline\\s+|constexpr\\s+)*(?:unsigned\\s+|signed\\s+|struct\\s+|enum\\s+)*(?:${cppTypeCore}${customTypesJoined})(?:\\s*[*&]+)*`;

  code = code.replace(
    new RegExp(`\\bstatic\\s+(?:const\\s+)?(?:unsigned\\s+|signed\\s+)?(?:${cppTypeCore}${customTypesJoined})\\s*[*&]*\\s*([A-Za-z_]\\w*)\\s*(?:=\\s*([^;]+))?\\s*;`, "g"),
    (_, varName, initExpr) => {
      const initVal = initExpr !== undefined ? initExpr.trim() : "0";
      hoistedStatics.push({ varName, initVal });
      return `if (__staticVars["${varName}"] === undefined) { __staticVars["${varName}"] = (${initVal}); }`;
    }
  );

  // 18. Remove C++ Function Forward Prototypes (including custom return types)
  code = code.replace(
    new RegExp(`^\\s*(?:${fullTypePattern}|[A-Za-z_]\\w*(?:\\s*[*&]+)*)\\s+([A-Za-z_]\\w*)\\s*\\(([^;{}]*)\\)\\s*;\\s*$`, "gm"),
    (fullMatch, fnName, paramInside) => {
      if (JS_RESERVED_WORDS.has(fnName)) return fullMatch;
      if (
        /^\s*(?:CRGB\b|CHSV\b|CRGBPalette16\b|CRGBPalette32\b|CRGBPalette256\b|CEveryN)/.test(fullMatch) &&
        !/\b(?:int|uint8_t|uint16_t|uint32_t|float|double|byte|bool|boolean|char|void|CRGB|CHSV)\b/.test(paramInside)
      ) {
        return fullMatch;
      }
      return `/* prototype ${fnName} removed */`;
    }
  );

  // 19. Transform C++ array declarations with brace initializer (for known AND custom types!)
  code = code.replace(
    new RegExp(
      `\\b(${fullTypePattern}|(?:const\\s+|static\\s+)*[A-Za-z_]\\w*(?:\\s*[*&]+)*)\\s+([A-Za-z_]\\w*)\\s*(?:\\[\\s*[^\\]]*\\s*\\])+\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;`,
      "g"
    ),
    (fullMatch, rawType, name, items) => {
      const baseType = rawType.replace(/\b(?:const|volatile|static|inline|constexpr|unsigned|signed|struct|enum)\b/g, "").replace(/[*&]/g, "").trim();
      if (JS_RESERVED_WORDS.has(baseType) && baseType !== "void") return fullMatch;
      if (structNamesSet.has(baseType)) {
        const ctor = structAliasMap[baseType] || baseType;
        const jsItems = items.replace(/\{/g, `${ctor}(`).replace(/\}/g, ")");
        return `var ${name} = [${jsItems}];`;
      }
      const jsItems = items.replace(/\{/g, "[").replace(/\}/g, "]");
      return `var ${name} = [${jsItems}];`;
    }
  );

  // Also transform brace-initialized variables without `[]` (like `PatternList patternList = { rainbow, confetti };` or `const TProgmemRGBPalette16 pal = { ... };`)
  code = code.replace(
    new RegExp(
      `\\b(${fullTypePattern}|(?:const\\s+|static\\s+)*[A-Za-z_]\\w*(?:\\s*[*&]+)*)\\s+([A-Za-z_]\\w*)\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;`,
      "g"
    ),
    (fullMatch, rawType, name, items) => {
      const baseType = rawType.replace(/\b(?:const|volatile|static|inline|constexpr|unsigned|signed|struct|enum)\b/g, "").replace(/[*&]/g, "").trim();
      if (JS_RESERVED_WORDS.has(baseType) && baseType !== "void") return fullMatch;
      if (structNamesSet.has(baseType)) {
        const ctor = structAliasMap[baseType] || baseType;
        if (/\{[\s\S]*\}/.test(items)) {
          const jsItems = items.replace(/\{/g, `${ctor}(`).replace(/\}/g, ")");
          return `var ${name} = [${jsItems}];`;
        }
        return `var ${name} = ${ctor}(${items});`;
      }
      const jsItems = items.replace(/\{/g, "[").replace(/\}/g, "]");
      return `var ${name} = [${jsItems}];`;
    }
  );

  // 20. Transform C++ 2D and 1D numeric/struct array declarations without initializer
  code = code.replace(
    new RegExp(
      `\\b(${fullTypePattern})\\s+([A-Za-z_]\\w*)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*;`,
      "g"
    ),
    (_, _t, name, d1, d2) => `var ${name} = __createNum2DArray(${d1}, ${d2});`
  );

  code = code.replace(
    new RegExp(`\\b(${fullTypePattern}|(?:const\\s+|static\\s+)*[A-Za-z_]\\w*)\\s+([A-Za-z_]\\w*)\\s*\\[\\s*([^\\]]+)\\s*\\]\\s*;`, "g"),
    (fullMatch, rawType, name, size) => {
      const cleanT = rawType.replace(/\b(?:const|volatile|static|inline|constexpr|unsigned|signed|struct|enum)\b/g, "").replace(/[*&]/g, "").trim();
      if (JS_RESERVED_WORDS.has(cleanT)) return fullMatch;
      if (structNamesSet.has(cleanT)) {
        return `var ${name} = Array.from({ length: (${size}) }, () => new ${cleanT}());`;
      }
      return `var ${name} = __createNumArray(${size});`;
    }
  );

  // 21. Transform C++ function definitions
  code = code.replace(
    new RegExp(
      `\\b(?:${fullTypePattern}|(?:static\\s+|inline\\s+|const\\s+)*[A-Za-z_]\\w*(?:\\s*[*&]+)*)\\s+([A-Za-z_]\\w*)\\s*\\(([^;{}]*)\\)\\s*(?:const\\s*)?\\{`,
      "g"
    ),
    (fullMatch, fnName, params) => {
      if (JS_RESERVED_WORDS.has(fnName) || /^\s*function\b/.test(fullMatch)) {
        return fullMatch;
      }
      return `function ${fnName}(${transpileParams(params)}) {`;
    }
  );

  code = code.replace(
    new RegExp(
      `\\b(?:${fullTypePattern})\\s*[*&]+\\s*([A-Za-z_]\\w*)\\s*\\(([^;{}]*)\\)\\s*(?:const\\s*)?\\{`,
      "g"
    ),
    (fullMatch, fnName, params) => {
      if (JS_RESERVED_WORDS.has(fnName)) return fullMatch;
      return `function ${fnName}(${transpileParams(params)}) {`;
    }
  );

  // 22. Transform C++ constructor-style local declarations
  code = code.replace(
    /\b(CRGB|CHSV|CRGBPalette16|CRGBPalette32|CRGBPalette256)\s+([A-Za-z_]\w*)\s*\(\s*([^;{}]+)\s*\)\s*;/g,
    (_, cls, varName, args) => `var ${varName} = ${cls}(${args});`
  );
  code = code.replace(/\bCRGB\s+([A-Za-z_]\w*)\s*;/g, "var $1 = CRGB(0, 0, 0);");
  code = code.replace(/\bCHSV\s+([A-Za-z_]\w*)\s*;/g, "var $1 = CHSV(0, 0, 0);");
  code = code.replace(/\bCRGBPalette(?:16|32|256)\s+([A-Za-z_]\w*)\s*;/g, "var $1 = RainbowColors_p.slice();");

  // 23. Transform C-style type casts
  code = code.replace(
    /\(\s*(?:const\s+)?(?:unsigned\s+|signed\s+|struct\s+)?(?:uint8_t|int8_t|uint16_t|int16_t|uint32_t|int32_t|size_t|int|long|short|byte|word|float|double|bool|boolean|char|fract8|sfract7|CRGB|CHSV|void)\s*[*&]*\s*\)\s*(?=[A-Za-z0-9_(\-+~!])/g,
    ""
  );

  // 24. Transform scalar & reference declarations ending at `;`
  code = code.replace(
    new RegExp(`\\b(${fullTypePattern})(?:\\s+|(?=\\s*[*&]))\\s*([^;{}]+?)(?=;)`, "g"),
    (fullMatch, typePart, declList) => {
      if (/^\s*(?:return|function|case|delete|typeof|new)\b/.test(fullMatch)) return fullMatch;
      const items = splitTopLevelDeclarators(declList);
      if (items.length === 0) return fullMatch;
      const allValid = items.every((item) => /^[*&]*\s*[A-Za-z_]\w*\s*(?:=|$)/.test(item.trim()));
      if (!allValid) return fullMatch;

      const cleanBaseType = typePart.replace(/\b(?:const|volatile|static|inline|constexpr|unsigned|signed|struct|enum)\b/g, "").replace(/[*&]/g, "").trim();
      const defaultInit = structNamesSet.has(cleanBaseType) ? `new ${cleanBaseType}()` : "0";

      const formatted = items.map((item) => {
        const cleanItem = item.replace(/^[*&]+\s*/, "").trim();
        if (cleanItem.includes("=")) return cleanItem;
        return `${cleanItem} = ${defaultInit}`;
      });
      return `var ${formatted.join(", ")}`;
    }
  );

  // Also handle unknown/custom type scalar or reference variable declarations: `MyType ref = val;` or `MyType &ref = val;`
  code = code.replace(
    /\b(?:const\s+|static\s+|volatile\s+)*([A-Za-z_]\w*)\s*[*&]*\s+([A-Za-z_]\w*)\s*(=\s*[^;]+)?(?=;)/g,
    (fullMatch, typeIdent, varName, rhsPart) => {
      if (JS_RESERVED_WORDS.has(typeIdent) || JS_RESERVED_WORDS.has(varName)) return fullMatch;
      const rhs = rhsPart ? rhsPart.trim() : structNamesSet.has(typeIdent) ? `= new ${typeIdent}()` : "= 0";
      return `var ${varName} ${rhs}`;
    }
  );

  code = code.replace(/\b(?:let|var|static|inline)\s+function\b/g, "function");

  // 25. Transform C++ Address-Of Operator `&leds[i]`, `&leds`, `&var` and Pointer Offset `leds + offset`
  code = code.replace(
    /([(\[,=:?;{}!]|return)\s*&(?![&=])\s*([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\](?!\s*\.)/g,
    "$1 __addrOfIdx($2, $3)"
  );
  code = code.replace(
    /([(\[,=:?;{}!]|return)\s*&(?![&=])\s*(?=[A-Za-z_(])/g,
    "$1 "
  );
  code = code.replace(
    /\b(fill_solid|fill_rainbow|fadeToBlackBy|fadeLightBy|nscale8|blur1d|fill_palette|fill_gradient_RGB|fill_gradient)\s*\(\s*([A-Za-z_]\w*)\s*\+\s*([^,]+)\s*,/g,
    "$1(__addrOfIdx($2, $3),"
  );

  // 26. Transform CRGBArray sub-range assignment: `leds(0, 9) = CRGB::Red;`
  code = code.replace(
    /\b([A-Za-z_]\w*)\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)\s*=\s*([^;]+);/g,
    "$1($2, $3).fill_solid($4);"
  );

  // 27. Transform 1D and 2D indexed compound assignments
  code = code.replace(
    /\b([A-Za-z_]\w*\s*\[\s*[^\]]+\s*\])\s*\[\s*([^\]]+)\s*\]\s*\+=\s*([^;]+);/g,
    "__addIdx($1, $2, $3);"
  );
  code = code.replace(
    /\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\+=\s*([^;]+);/g,
    "__addIdx($1, $2, $3);"
  );
  code = code.replace(
    /\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*-=\s*([^;]+);/g,
    "__subIdx($1, $2, $3);"
  );
  code = code.replace(
    /\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*%=\s*([^;]+);/g,
    "__scaleIdx($1, $2, $3);"
  );
  code = code.replace(
    /\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\|=\s*([^;]+);/g,
    "__addIdx($1, $2, $3);"
  );

  // 28. Inject infinite-loop protection into `while (...) {` loops
  code = code.replace(/\bwhile\s*\(([^)]+)\)\s*\{/g, "while (($1) && __checkLoopGuard()) {");

  // 29. Bind hoisted static scalar variables
  if (hoistedStatics.length > 0) {
    const seen = new Set();
    const bindingLines = [];
    hoistedStatics.forEach(({ varName }) => {
      if (seen.has(varName)) return;
      seen.add(varName);
      bindingLines.push(`var ${varName};`);
    });
    code = code.replace(
      /if \(__staticVars\["([A-Za-z_]\w*)"\] === undefined\) \{ __staticVars\["\1"\] = \(([^;]+)\); \}/g,
      "if ($1 === undefined) { $1 = ($2); }"
    );
    code = bindingLines.join("\n") + "\n" + code;
  }

  // 30. Final Sanitizer Pass
  code = code.replace(/\b(?:var|let|const)\s+(?:const\s+|volatile\s+|unsigned\s+|signed\s+)*[A-Za-z_]\w*\s*[*&]+\s*([A-Za-z_]\w*)/g, "var $1");
  code = code.replace(/\bfor\s*\(\s*(?:var|let|const)\s+[A-Za-z_]\w*\s*[*&]*\s*([A-Za-z_]\w*)\s+of\b/g, "for (let $1 of");
  code = code.replace(/([(\[,=:?;{}!]|\breturn)\s*&(?![&=])\s*([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\](?!\s*\.)/g, "$1 __addrOfIdx($2, $3)");
  code = code.replace(/([(\[,=:?;{}!]|\breturn)\s*&(?![&=])\s*(?=[A-Za-z_(])/g, "$1 ");

  return code;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    scanFastLEDSketch,
    transpileFastLEDSketch,
    stripCommentsPreserveLines
  };
}
