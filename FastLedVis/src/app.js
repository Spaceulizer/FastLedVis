// FastLedVis - Main Application Controller & Hardware Canvas Renderer

(function () {
  // Application State
  const state = {
    currentPresetId: "mapped_zone_crossfader",
    code: "",
    scanResult: null,
    simulator: null,
    simState: null,
    compileError: null,
    isPlaying: true,
    speedMultiplier: 1.0,
    peakCurrentMa: 0,
    measuredFps: 60,

    // Hardware Override & Optical Workbench Settings
    topologyOverride: "auto", // "auto", "1d_strip", "2d_matrix", "ring", "arch"
    stripWrapMode: "wrap",    // "wrap" (multi-row workbench) or "linear" (single horizontal)
    matrixWidthOverride: null,
    matrixHeightOverride: null,
    matrixWiringOverride: "auto", // "auto", "serpentine", "progressive"
    pcbColor: "black",        // "black", "white", "copper"
    diffuserMode: "raw",      // "raw" (SMD 5050), "silicone" (diffused tube), "baffle" (matrix grid)
    bloomIntensity: 0.75,     // 0.0 .. 1.0
    ambientRoom: "dark",      // "dark" or "lit"
    showWiring: true,
    showIndices: true,
    zoom: 1.0,
    panX: 0,
    panY: 0,

    // Interactive Pixel Inspector
    hoveredLedIndex: null,
    lockedLedIndex: null,
    pixelScreenPositions: [], // [{ index, x, y, r, gx, gy }]
    activeLeftTab: "specs"    // "specs" | "wiring" | "serial"
  };

  // DOM Elements
  let els = {};
  let rafId = null;
  let lastFrameTime = performance.now();
  let simAccumulatorMs = 0;
  let fpsFrameCounter = 0;
  let fpsLastCheck = performance.now();

  function cacheElements() {
    els = {
      presetSelect: document.getElementById("presetSelect"),
      scanRunBtn: document.getElementById("scanRunBtn"),
      uploadBtn: document.getElementById("uploadBtn"),
      fileInput: document.getElementById("sketchFileInput"),
      downloadInoBtn: document.getElementById("downloadInoBtn"),
      copySpecsBtn: document.getElementById("copySpecsBtn"),

      validationBadge: document.getElementById("validationBadge"),
      validationDot: document.getElementById("validationDot"),
      validationText: document.getElementById("validationText"),

      codeEditor: document.getElementById("codeEditor"),
      lineNumbers: document.getElementById("lineNumbers"),
      editorLineCount: document.getElementById("editorLineCount"),
      presetDescText: document.getElementById("presetDescText"),

      rejectionBanner: document.getElementById("rejectionBanner"),
      rejectionTitle: document.getElementById("rejectionTitle"),
      rejectionDetail: document.getElementById("rejectionDetail"),
      loadValidPresetBtn: document.getElementById("loadValidPresetBtn"),

      tabBtnSpecs: document.getElementById("tabBtnSpecs"),
      tabBtnWiring: document.getElementById("tabBtnWiring"),
      tabBtnSerial: document.getElementById("tabBtnSerial"),
      tabPaneSpecs: document.getElementById("tabPaneSpecs"),
      tabPaneWiring: document.getElementById("tabPaneWiring"),
      tabPaneSerial: document.getElementById("tabPaneSerial"),

      specsGrid: document.getElementById("specsGrid"),
      findingsList: document.getElementById("findingsList"),
      wiringDiagramBox: document.getElementById("wiringDiagramBox"),
      serialOutputBox: document.getElementById("serialOutputBox"),
      transpiledPreviewBox: document.getElementById("transpiledPreviewBox"),
      clearSerialBtn: document.getElementById("clearSerialBtn"),

      playPauseBtn: document.getElementById("playPauseBtn"),
      playPauseIcon: document.getElementById("playPauseIcon"),
      playPauseLabel: document.getElementById("playPauseLabel"),
      stepFrameBtn: document.getElementById("stepFrameBtn"),
      resetSimBtn: document.getElementById("resetSimBtn"),
      skipTimeBtn: document.getElementById("skipTimeBtn"),
      speedSelect: document.getElementById("speedSelect"),

      topologySelect: document.getElementById("topologySelect"),
      matrixConfigBar: document.getElementById("matrixConfigBar"),
      matrixWInput: document.getElementById("matrixWInput"),
      matrixHInput: document.getElementById("matrixHInput"),
      matrixWiringSelect: document.getElementById("matrixWiringSelect"),
      stripWrapSelect: document.getElementById("stripWrapSelect"),

      pcbSelect: document.getElementById("pcbSelect"),
      diffuserSelect: document.getElementById("diffuserSelect"),
      bloomSlider: document.getElementById("bloomSlider"),
      bloomValueLabel: document.getElementById("bloomValueLabel"),
      toggleWiringBtn: document.getElementById("toggleWiringBtn"),
      toggleIndicesBtn: document.getElementById("toggleIndicesBtn"),
      toggleAmbientBtn: document.getElementById("toggleAmbientBtn"),
      zoomInBtn: document.getElementById("zoomInBtn"),
      zoomOutBtn: document.getElementById("zoomOutBtn"),
      zoomResetBtn: document.getElementById("zoomResetBtn"),

      canvasContainer: document.getElementById("canvasContainer"),
      canvas: document.getElementById("ledViewport"),
      waveformCanvas: document.getElementById("waveformCanvas"),

      telemetryCurrent: document.getElementById("telemetryCurrent"),
      telemetryWatts: document.getElementById("telemetryWatts"),
      telemetryPeak: document.getElementById("telemetryPeak"),
      telemetryPsuBadge: document.getElementById("telemetryPsuBadge"),
      telemetryFrame: document.getElementById("telemetryFrame"),
      telemetryMillis: document.getElementById("telemetryMillis"),
      telemetryFps: document.getElementById("telemetryFps"),
      telemetryBrightness: document.getElementById("telemetryBrightness"),

      pixelProbeCard: document.getElementById("pixelProbeCard"),
      probeTitle: document.getElementById("probeTitle"),
      probeSwatch: document.getElementById("probeSwatch"),
      probeRgbText: document.getElementById("probeRgbText"),
      probeWireOrderText: document.getElementById("probeWireOrderText"),
      probeHexText: document.getElementById("probeHexText"),
      probeCoordText: document.getElementById("probeCoordText"),
      probeCurrentText: document.getElementById("probeCurrentText"),
      unlockProbeBtn: document.getElementById("unlockProbeBtn"),

      toastBox: document.getElementById("toastBox")
    };
  }

  function showToast(msg, type = "info") {
    if (!els.toastBox) return;
    els.toastBox.textContent = msg;
    els.toastBox.className =
      "fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium transition-all duration-200 border " +
      (type === "error"
        ? "bg-red-950/95 border-red-500/60 text-red-200"
        : type === "success"
        ? "bg-emerald-950/95 border-emerald-500/60 text-emerald-200"
        : "bg-slate-900/95 border-slate-700 text-slate-100");
    els.toastBox.style.opacity = "1";
    els.toastBox.style.pointerEvents = "auto";
    clearTimeout(els.toastBox._timer);
    els.toastBox._timer = setTimeout(() => {
      els.toastBox.style.opacity = "0";
      els.toastBox.style.pointerEvents = "none";
    }, 2800);
  }

  function updateLineNumbers() {
    const lines = (els.codeEditor.value || "").split("\n").length;
    els.editorLineCount.textContent = `${lines} lines`;
    let html = "";
    for (let i = 1; i <= lines; i++) {
      html += `<div>${i}</div>`;
    }
    els.lineNumbers.innerHTML = html;
  }

  function populatePresets() {
    els.presetSelect.innerHTML = "";
    FASTLED_PRESETS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `[${p.category}] ${p.name}`;
      els.presetSelect.appendChild(opt);
    });
  }

  function loadPreset(presetId) {
    const preset = FASTLED_PRESETS.find((p) => p.id === presetId) || FASTLED_PRESETS[0];
    state.currentPresetId = preset.id;
    els.presetSelect.value = preset.id;
    els.codeEditor.value = preset.code;
    els.presetDescText.textContent = preset.description;
    state.topologyOverride = "auto";
    els.topologySelect.value = "auto";
    state.lockedLedIndex = null;
    state.hoveredLedIndex = null;
    updateLineNumbers();
    scanAndCompileSketch();
  }

  function getActiveTopology() {
    if (state.topologyOverride !== "auto") return state.topologyOverride;
    if (state.scanResult && state.scanResult.valid && state.scanResult.specs) {
      return state.scanResult.specs.topology || "1d_strip";
    }
    return "1d_strip";
  }

  function scanAndCompileSketch() {
    const rawCode = els.codeEditor.value;
    state.code = rawCode;
    state.compileError = null;
    state.peakCurrentMa = 0;

    const scan = scanFastLEDSketch(rawCode);
    state.scanResult = scan;

    if (!scan.valid) {
      state.simulator = null;
      state.simState = null;
      renderValidationState(false, scan.rejectedReason);
      renderSpecsPanel();
      renderWiringDiagram();
      renderSerialPanel("");
      drawHardwareFrame();
      drawWaveform();
      return;
    }

    // Sync matrix dimension inputs with scanned specs if not manually overridden
    els.matrixWInput.value = scan.specs.matrixWidth || 16;
    els.matrixHInput.value = scan.specs.matrixHeight || 16;
    state.matrixWidthOverride = scan.specs.matrixWidth || 16;
    state.matrixHeightOverride = scan.specs.matrixHeight || 16;

    try {
      const transpiled = transpileFastLEDSketch(rawCode, scan.specs);
      const sim = createFastLEDSimulator(transpiled, scan.specs);
      state.simulator = sim;
      state.simState = sim.step(0);
      if (state.simState && state.simState.runtimeError) {
        renderValidationState(false, state.simState.runtimeError, true);
      } else {
        renderValidationState(true, null);
      }
      renderSpecsPanel();
      renderWiringDiagram();
      renderSerialPanel(transpiled);
      updateTopologyToolbarVisibility();
      updateTelemetryUI();
      drawHardwareFrame();
      drawWaveform();
    } catch (err) {
      state.compileError = err.message || String(err);
      state.simulator = null;
      state.simState = null;
      renderValidationState(false, state.compileError, true);
      renderSpecsPanel();
      renderWiringDiagram();
      renderSerialPanel("");
      drawHardwareFrame();
    }
  }

  function renderValidationState(isValid, reason, isCompileErr = false) {
    if (isValid) {
      const s = state.scanResult.specs;
      els.validationBadge.className =
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/90 border border-emerald-500/50 text-emerald-300";
      els.validationDot.className = "w-2 h-2 rounded-full bg-emerald-400 led-status-dot";
      els.validationText.textContent = `FASTLED VERIFIED • ${s.numLeds} LEDs (${s.chipset})`;
      els.rejectionBanner.classList.add("hidden");
    } else {
      els.validationBadge.className =
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/90 border border-red-500/60 text-red-300";
      els.validationDot.className = "w-2 h-2 rounded-full bg-red-400 led-status-dot";
      els.validationText.textContent = isCompileErr
        ? "SKETCH SYNTAX ERROR"
        : "REJECTED — NO FASTLED DETECTED";
      els.rejectionBanner.classList.remove("hidden");
      els.rejectionTitle.textContent = isCompileErr
        ? "Arduino Sketch Transpilation / Syntax Error"
        : "Sketch Rejected: FastLED Library Required";
      els.rejectionDetail.textContent = reason;
    }
  }

  function renderSpecsPanel() {
    const scan = state.scanResult;
    if (!scan || !scan.valid || !scan.specs) {
      els.specsGrid.innerHTML = `
        <div class="col-span-2 sm:col-span-3 p-4 rounded-lg bg-red-950/30 border border-red-800/50 text-xs text-red-300">
          No valid FastLED hardware specifications extracted. Include <code class="code-font text-red-200">#include &lt;FastLED.h&gt;</code> and <code class="code-font text-red-200">FastLED.addLeds&lt;...&gt;(leds, NUM_LEDS)</code> in your sketch.
        </div>
      `;
      els.findingsList.innerHTML = "";
      return;
    }

    const s = scan.specs;
    const cards = [
      {
        label: "Strip Length",
        val: `${s.numLeds} LEDs`,
        sub: `Array: ${s.ledArrayName}[${s.numLeds}]`,
        accent: "text-cyan-300"
      },
      {
        label: "LED Chipset",
        val: s.chipset,
        sub: s.isSPI ? "4-Wire SPI (Data + Clock)" : "3-Wire Clockless",
        accent: "text-emerald-300"
      },
      {
        label: "MCU Wiring Pins",
        val: s.clockPin ? `D${s.dataPin} / CLK D${s.clockPin}` : `Pin D${s.dataPin}`,
        sub: s.clockPin ? "DATA_PIN + CLOCK_PIN" : "Single DATA_PIN",
        accent: "text-amber-300"
      },
      {
        label: "Color Order",
        val: s.colorOrder,
        sub: `Subpixel: ${s.colorOrder.split("").join("·")}`,
        accent: "text-purple-300"
      },
      {
        label: "Brightness Cap",
        val: `${s.brightness} / 255`,
        sub: `${Math.round((s.brightness / 255) * 100)}% Max Output`,
        accent: "text-sky-300"
      },
      {
        label: "Detected Layout",
        val:
          s.topology === "custom_map"
            ? `2D Coord Map (${s.numLeds})`
            : s.topology === "2d_matrix"
            ? `${s.matrixWidth}×${s.matrixHeight} Matrix`
            : s.topology === "ring"
            ? `${s.numLeds}-LED Ring`
            : "1D Linear Strip",
        sub:
          s.topology === "2d_matrix"
            ? s.serpentine
              ? "Serpentine (Zig-Zag)"
              : "Progressive Rows"
            : "Continuous Addressable",
        accent: "text-pink-300"
      }
    ];

    els.specsGrid.innerHTML = cards
      .map(
        (c) => `
      <div class="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 flex flex-col justify-between">
        <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">${c.label}</span>
        <div class="text-sm font-bold ${c.accent} code-font mt-0.5 truncate">${c.val}</div>
        <span class="text-[11px] text-slate-400 truncate mt-0.5">${c.sub}</span>
      </div>
    `
      )
      .join("");

    els.findingsList.innerHTML = scan.findings
      .map(
        (f) => `
      <div class="flex items-center justify-between py-1.5 px-2.5 rounded bg-slate-900/50 border border-slate-800/60 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 code-font text-[10px]">L${f.line}</span>
          <span class="text-slate-300 font-medium truncate">${f.key}:</span>
          <span class="text-cyan-300 code-font truncate">${f.value}</span>
        </div>
        <span class="text-[11px] text-slate-400 hidden sm:inline ml-2 shrink-0">${f.detail}</span>
      </div>
    `
      )
      .join("");
  }

  function renderWiringDiagram() {
    const scan = state.scanResult;
    if (!scan || !scan.valid || !scan.specs) {
      els.wiringDiagramBox.innerHTML = `<div class="text-xs text-slate-400 p-3">Load a valid FastLED sketch to generate the physical wiring schematic.</div>`;
      return;
    }
    const s = scan.specs;
    const maxTheoreticalAmps = ((s.numLeds * 60) / 1000).toFixed(2);
    const brightnessScaledAmps = (((s.numLeds * 60) * (s.brightness / 255)) / 1000).toFixed(2);
    const needsPowerInjection = s.numLeds > 60;

    els.wiringDiagramBox.innerHTML = `
      <div class="space-y-3 text-xs">
        <div class="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div class="font-semibold text-slate-200 mb-2 flex items-center justify-between">
            <span>Physical Workbench Hookup Guide (${s.chipset})</span>
            <span class="code-font text-[11px] text-emerald-400">${s.numLeds} Pixels</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="p-2 rounded bg-slate-950 border border-red-900/50">
              <div class="text-[10px] uppercase text-red-400 font-bold">Power (+5V Rail)</div>
              <div class="text-slate-200 font-medium mt-0.5">5V DC PSU → Strip <code class="code-font text-red-300">+5V / VCC</code></div>
              <div class="text-[11px] text-slate-400 mt-0.5">Place 1000µF 6.3V+ capacitor across +5V &amp; GND at strip input.</div>
            </div>
            <div class="p-2 rounded bg-slate-950 border border-emerald-900/50">
              <div class="text-[10px] uppercase text-emerald-400 font-bold">Data Signal (${s.isSPI ? "SPI Dual-Wire" : "Single-Wire"})</div>
              <div class="text-slate-200 font-medium mt-0.5">MCU <code class="code-font text-emerald-300">Pin D${s.dataPin}</code> → 330Ω → <code class="code-font text-emerald-300">DIN</code></div>
              <div class="text-[11px] text-slate-400 mt-0.5">${
                s.clockPin
                  ? `Clock: MCU <code class="code-font text-amber-300">Pin D${s.clockPin}</code> → <code class="code-font text-amber-300">CI / CLK</code>`
                  : "300–470Ω series resistor prevents first-pixel ringing."
              }</div>
            </div>
            <div class="p-2 rounded bg-slate-950 border border-slate-700">
              <div class="text-[10px] uppercase text-slate-400 font-bold">Common Ground (GND)</div>
              <div class="text-slate-200 font-medium mt-0.5">MCU <code class="code-font">GND</code> + PSU <code class="code-font">V-</code> → Strip <code class="code-font">GND</code></div>
              <div class="text-[11px] text-slate-400 mt-0.5">Always tie Microcontroller GND and LED PSU GND together.</div>
            </div>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="font-semibold text-slate-200">Power Budget Estimate</div>
            <div class="text-[11px] text-slate-400">
              Full White (100%): <strong class="text-slate-200">${maxTheoreticalAmps} A</strong> • At Brightness ${s.brightness}/255: <strong class="text-cyan-300">${brightnessScaledAmps} A</strong>
              ${s.maxMilliamps ? ` • Sketch Software Limit: <strong class="text-emerald-300">${(s.maxMilliamps / 1000).toFixed(2)} A</strong>` : ""}
            </div>
          </div>
          <span class="px-2.5 py-1 rounded text-[11px] font-medium shrink-0 ${
            needsPowerInjection
              ? "bg-amber-950/90 border border-amber-600/50 text-amber-300"
              : "bg-emerald-950/90 border border-emerald-600/50 text-emerald-300"
          }">
            ${
              needsPowerInjection
                ? `⚡ >60 LEDs (${s.numLeds}): Inject +5V/GND at both ends`
                : `✓ Single-end 5V feed sufficient (${s.numLeds} LEDs)`
            }
          </span>
        </div>
      </div>
    `;
  }

  function renderSerialPanel(transpiledCode) {
    if (transpiledCode !== undefined) {
      els.transpiledPreviewBox.textContent = transpiledCode || "// No transpiled output";
    }
    if (!state.simState || !state.simState.serialLogs || state.simState.serialLogs.length === 0) {
      els.serialOutputBox.textContent = "// Serial Monitor ready (9600 / 115200 baud)\n// Waiting for Serial.println() output...";
    } else {
      els.serialOutputBox.textContent = state.simState.serialLogs.join("\n");
    }
  }

  function switchLeftTab(tabName) {
    state.activeLeftTab = tabName;
    const tabs = [
      { id: "specs", btn: els.tabBtnSpecs, pane: els.tabPaneSpecs },
      { id: "wiring", btn: els.tabBtnWiring, pane: els.tabPaneWiring },
      { id: "serial", btn: els.tabBtnSerial, pane: els.tabPaneSerial }
    ];
    tabs.forEach((t) => {
      if (t.id === tabName) {
        t.btn.className =
          "px-3 py-1.5 text-xs font-semibold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40";
        t.pane.classList.remove("hidden");
      } else {
        t.btn.className =
          "px-3 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent";
        t.pane.classList.add("hidden");
      }
    });
  }

  function updateTopologyToolbarVisibility() {
    const topo = getActiveTopology();
    if (topo === "2d_matrix") {
      els.matrixConfigBar.classList.remove("hidden");
      els.stripWrapSelect.classList.add("hidden");
    } else if (topo === "1d_strip") {
      els.matrixConfigBar.classList.add("hidden");
      els.stripWrapSelect.classList.remove("hidden");
    } else {
      els.matrixConfigBar.classList.add("hidden");
      els.stripWrapSelect.classList.add("hidden");
    }
  }

  function updateTelemetryUI() {
    if (!state.simState || !state.scanResult || !state.scanResult.valid) {
      els.telemetryCurrent.textContent = "0 mA";
      els.telemetryWatts.textContent = "0.00 W";
      els.telemetryPeak.textContent = "0 mA";
      els.telemetryFrame.textContent = "0";
      els.telemetryMillis.textContent = "0 ms";
      els.telemetryBrightness.textContent = "0 / 255";
      return;
    }

    const st = state.simState;
    if (st.currentMa > state.peakCurrentMa) {
      state.peakCurrentMa = st.currentMa;
    }

    els.telemetryCurrent.textContent =
      st.currentMa >= 1000 ? `${(st.currentMa / 1000).toFixed(2)} A (${st.currentMa} mA)` : `${st.currentMa} mA`;
    els.telemetryWatts.textContent = `${st.watts} W`;
    els.telemetryPeak.textContent =
      state.peakCurrentMa >= 1000
        ? `${(state.peakCurrentMa / 1000).toFixed(2)} A`
        : `${state.peakCurrentMa} mA`;
    els.telemetryFrame.textContent = String(st.frameCount);
    els.telemetryMillis.textContent = `${st.simMillis} ms`;
    els.telemetryFps.textContent = `${state.measuredFps} FPS`;
    els.telemetryBrightness.textContent = `${st.brightness} / 255`;

    // PSU recommendation badge
    if (st.currentMa <= 500) {
      els.telemetryPsuBadge.textContent = "USB 500mA Safe";
      els.telemetryPsuBadge.className =
        "px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/90 border border-emerald-500/40 text-emerald-300";
    } else if (st.currentMa <= 2000) {
      els.telemetryPsuBadge.textContent = "5V 2A+ External PSU";
      els.telemetryPsuBadge.className =
        "px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/90 border border-amber-500/40 text-amber-300";
    } else {
      els.telemetryPsuBadge.textContent = "High Load: 5V 5A+ PSU";
      els.telemetryPsuBadge.className =
        "px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/90 border border-red-500/40 text-red-300";
    }

    // Update serial logs if serial tab is open
    if (state.activeLeftTab === "serial") {
      renderSerialPanel();
    }

    // Update active pixel probe if hovering or locked
    updatePixelProbeUI();
  }

  function formatSubpixelOrder(r, g, b, order = "GRB") {
    const map = { R: r, G: g, B: b };
    const chars = (order || "GRB").toUpperCase().split("");
    return chars.map((c) => `${c}:${map[c] ?? 0}`).join(" ");
  }

  function updatePixelProbeUI() {
    const activeIdx = state.lockedLedIndex !== null ? state.lockedLedIndex : state.hoveredLedIndex;
    if (
      activeIdx === null ||
      !state.simState ||
      !state.simState.leds ||
      activeIdx < 0 ||
      activeIdx >= state.simState.leds.length
    ) {
      els.probeTitle.textContent = "Hover or click any LED to inspect";
      els.probeSwatch.style.backgroundColor = "#1e293b";
      els.probeSwatch.style.boxShadow = "none";
      els.probeRgbText.textContent = "CRGB(0, 0, 0)";
      els.probeWireOrderText.textContent = "—";
      els.probeHexText.textContent = "#000000";
      els.probeCoordText.textContent = "—";
      els.probeCurrentText.textContent = "1.0 mA (idle)";
      els.unlockProbeBtn.classList.add("hidden");
      return;
    }

    const px = state.simState.leds[activeIdx];
    const s = state.scanResult.specs;
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);
    const rOut = Math.round(px.r * bScale);
    const gOut = Math.round(px.g * bScale);
    const bOut = Math.round(px.b * bScale);

    const hex =
      "#" +
      [px.r, px.g, px.b]
        .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

    const posObj = state.pixelScreenPositions[activeIdx];
    const coordLabel = posObj && posObj.coordLabel ? posObj.coordLabel : `Strip Index #${activeIdx}`;
    const ledMa = (1.0 + ((rOut + gOut + bOut) / 255.0) * 20.0).toFixed(1);

    els.probeTitle.textContent =
      state.lockedLedIndex !== null
        ? `🔒 Locked: ${s.ledArrayName}[${activeIdx}]`
        : `Inspecting: ${s.ledArrayName}[${activeIdx}]`;
    els.probeSwatch.style.backgroundColor = `rgb(${px.r}, ${px.g}, ${px.b})`;
    els.probeSwatch.style.boxShadow = `0 0 12px rgba(${px.r}, ${px.g}, ${px.b}, 0.8)`;
    els.probeRgbText.textContent = `CRGB(${px.r}, ${px.g}, ${px.b})`;
    els.probeWireOrderText.textContent = `${s.colorOrder} Wire: [${formatSubpixelOrder(px.r, px.g, px.b, s.colorOrder)}]`;
    els.probeHexText.textContent = hex;
    els.probeCoordText.textContent = coordLabel;
    els.probeCurrentText.textContent = `${ledMa} mA`;

    if (state.lockedLedIndex !== null) {
      els.unlockProbeBtn.classList.remove("hidden");
    } else {
      els.unlockProbeBtn.classList.add("hidden");
    }
  }

  /**
   * Maps raw LED RGB + master brightness into optical screen display color (applying visual gamma so low values remain visible like real LEDs).
   */
  function getOpticalDisplayRGB(px, brightnessScale) {
    const rLin = (px.r * brightnessScale) / 255.0;
    const gLin = (px.g * brightnessScale) / 255.0;
    const bLin = (px.b * brightnessScale) / 255.0;

    // Real addressable LEDs emit bright point light even at duty cycle 5/255; apply perceptual curve
    const gamma = 0.68;
    const rDisp = Math.min(255, Math.round(Math.pow(rLin, gamma) * 255));
    const gDisp = Math.min(255, Math.round(Math.pow(gLin, gamma) * 255));
    const bDisp = Math.min(255, Math.round(Math.pow(bLin, gamma) * 255));
    const intensity = Math.max(rDisp, gDisp, bDisp) / 255.0;
    return { r: rDisp, g: gDisp, b: bDisp, intensity };
  }

  function getPcbColors() {
    if (state.pcbColor === "white") {
      return {
        body: "#e2e8f0",
        border: "#94a3b8",
        silk: "#334155",
        pad: "#d97706",
        packageBg: "#f8fafc",
        packageStroke: "#cbd5e1"
      };
    }
    if (state.pcbColor === "copper") {
      return {
        body: "#451a03",
        border: "#b45309",
        silk: "#fde68a",
        pad: "#f59e0b",
        packageBg: "#1e293b",
        packageStroke: "#78350f"
      };
    }
    // Default Black PCB
    return {
      body: "#111827",
      border: "#334155",
      silk: "#94a3b8",
      pad: "#eab308",
      packageBg: "#1e293b",
      packageStroke: "#475569"
    };
  }

  /**
   * Renders the physical hardware visualization onto the main HTML5 Canvas.
   */
  function drawHardwareFrame() {
    const canvas = els.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const rect = els.canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(260, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    state.pixelScreenPositions = [];

    // If sketch is rejected or invalid, draw a clear hardware diagnostic screen on the workbench
    if (!state.scanResult || !state.scanResult.valid || !state.simState) {
      drawRejectedWorkbenchOverlay(ctx, width, height);
      ctx.restore();
      return;
    }

    // Apply user pan & zoom around center
    ctx.translate(width / 2 + state.panX, height / 2 + state.panY);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-width / 2, -height / 2);

    const topo = getActiveTopology();
    if (topo === "custom_map") {
      drawCustomCoordMapHardware(ctx, width, height);
    } else if (topo === "2d_matrix") {
      draw2DMatrixHardware(ctx, width, height);
    } else if (topo === "ring") {
      drawCircularRingHardware(ctx, width, height);
    } else if (topo === "arch") {
      drawArchPerimeterHardware(ctx, width, height);
    } else {
      draw1DStripHardware(ctx, width, height);
    }

    ctx.restore();
  }

  function drawRejectedWorkbenchOverlay(ctx, w, h) {
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;

    // Draw unpowered ghost LED strip in background
    const ghostCount = 12;
    const pitch = 38;
    const stripW = ghostCount * pitch + 24;
    const sx = cx - stripW / 2;
    const sy = cy - 75;

    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx, sy, stripW, 34, 6);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < ghostCount; i++) {
      const lx = sx + 18 + i * pitch;
      const ly = sy + 17;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(lx - 8, ly - 8, 16, 16);
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    }

    // Diagnostic Card
    const cardW = Math.min(w - 32, 460);
    const cardH = 126;
    ctx.fillStyle = "rgba(28, 10, 18, 0.92)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - 22, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      state.compileError ? "⚠️ Arduino Sketch Syntax / Compile Error" : "⛔ Sketch Rejected — No FastLED Code Detected",
      cx,
      cy + 8
    );

    ctx.fillStyle = "#fecaca";
    ctx.font = "12px Inter, sans-serif";
    const msg =
      state.compileError ||
      "FastLedVis requires #include <FastLED.h> and FastLED.addLeds<...>(leds, NUM_LEDS).";
    ctx.fillText(msg.slice(0, 68) + (msg.length > 68 ? "..." : ""), cx, cy + 34);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px JetBrains Mono, monospace";
    ctx.fillText("Hardware output unpowered (0 mA) • Select a FastLED preset or add FastLED.h", cx, cy + 62);
    ctx.restore();
  }

  /**
   * Draws an individual SMD 5050 LED package + optical glow at (x, y) with radius/size `size`.
   */
  function drawSMD5050Diode(ctx, x, y, size, dispColor, pcb, index, coordLabel) {
    const half = size / 2;

    // Record screen-space hitbox (adjusted for zoom/pan in hit tester)
    state.pixelScreenPositions[index] = {
      index,
      x,
      y,
      r: Math.max(half, 8),
      coordLabel
    };

    const isHovered = state.hoveredLedIndex === index;
    const isLocked = state.lockedLedIndex === index;

    if (state.diffuserMode === "raw") {
      // SMD 5050 Package Housing
      ctx.fillStyle = pcb.packageBg;
      ctx.strokeStyle = pcb.packageStroke;
      ctx.lineWidth = Math.max(0.75, size * 0.06);
      ctx.fillRect(x - half, y - half, size, size);
      ctx.strokeRect(x - half, y - half, size, size);

      // Unlit phosphor cavity
      ctx.beginPath();
      ctx.arc(x, y, size * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
    } else if (state.diffuserMode === "baffle") {
      // Egg-crate diffuser cell
      const cellHalf = half * 1.18;
      ctx.fillStyle = `rgba(${dispColor.r}, ${dispColor.g}, ${dispColor.b}, ${0.22 + dispColor.intensity * 0.72})`;
      ctx.strokeStyle = "#090d16";
      ctx.lineWidth = Math.max(1.5, size * 0.14);
      ctx.fillRect(x - cellHalf, y - cellHalf, cellHalf * 2, cellHalf * 2);
      ctx.strokeRect(x - cellHalf, y - cellHalf, cellHalf * 2, cellHalf * 2);
    }

    // Optical Bloom / Halo
    if (dispColor.intensity > 0.02 && state.bloomIntensity > 0.01) {
      const bloomRadius =
        size *
        (state.diffuserMode === "silicone" ? 2.2 : state.diffuserMode === "baffle" ? 1.35 : 1.75) *
        (0.4 + state.bloomIntensity * 0.9);
      const grad = ctx.createRadialGradient(x, y, size * 0.1, x, y, bloomRadius);
      const alpha = Math.min(0.85, dispColor.intensity * state.bloomIntensity * 0.78);
      grad.addColorStop(0, `rgba(${dispColor.r}, ${dispColor.g}, ${dispColor.b}, ${alpha})`);
      grad.addColorStop(0.45, `rgba(${dispColor.r}, ${dispColor.g}, ${dispColor.b}, ${alpha * 0.38})`);
      grad.addColorStop(1, `rgba(${dispColor.r}, ${dispColor.g}, ${dispColor.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, bloomRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active Emitter Core
    ctx.beginPath();
    const coreRadius = state.diffuserMode === "silicone" ? size * 0.48 : size * 0.35;
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    if (dispColor.intensity > 0.01) {
      ctx.fillStyle = `rgb(${dispColor.r}, ${dispColor.g}, ${dispColor.b})`;
    } else {
      ctx.fillStyle = "#1e293b";
    }
    ctx.fill();

    // Bright center hotspot for high-intensity LEDs
    if (dispColor.intensity > 0.55) {
      ctx.beginPath();
      ctx.arc(x, y, coreRadius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${(dispColor.intensity - 0.5) * 0.9})`;
      ctx.fill();
    }

    // Selection / Hover Ring
    if (isHovered || isLocked) {
      ctx.beginPath();
      ctx.arc(x, y, half + 4, 0, Math.PI * 2);
      ctx.strokeStyle = isLocked ? "#22d3ee" : "#f8fafc";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /**
   * 1D Linear / Multi-Row Wrapped Strip Renderer
   */
  function draw1DStripHardware(ctx, w, h) {
    const leds = state.simState.leds;
    const count = leds.length;
    const specs = state.scanResult.specs;
    const pcb = getPcbColors();
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);

    const wrapMode = els.stripWrapSelect.value || "wrap";
    const cols =
      wrapMode === "linear"
        ? count
        : count <= 24
        ? count
        : count <= 60
        ? Math.min(count, 20)
        : Math.min(count, 24);
    const rows = Math.ceil(count / cols);

    const availW = w - 120;
    const availH = h - 100;
    const pitchX = Math.max(12, Math.min(44, Math.floor(availW / Math.max(1, cols))));
    const diodeSize = Math.max(7, Math.min(20, Math.floor(pitchX * 0.54)));
    const stripHeight = Math.max(16, Math.floor(diodeSize * 1.65));
    const rowGap = Math.max(stripHeight + 18, Math.min(68, Math.floor(availH / Math.max(1, rows))));

    const totalW = cols * pitchX;
    const totalH = (rows - 1) * rowGap + stripHeight;
    const startX = (w - totalW) / 2;
    const startY = (h - totalH) / 2;

    // Draw MCU Input Lead if showWiring is active
    if (state.showWiring) {
      drawMcuHeaderBox(ctx, startX - 52, startY + stripHeight / 2, specs);
    }

    // Draw PCB Strip Segments per row
    for (let r = 0; r < rows; r++) {
      const rowLeds = Math.min(cols, count - r * cols);
      const segW = rowLeds * pitchX + 18;
      const ry = startY + r * rowGap;
      const rx = r % 2 === 1 && wrapMode === "wrap" ? startX + (cols - rowLeds) * pitchX - 9 : startX - 9;

      // PCB Track Base
      ctx.fillStyle = pcb.body;
      ctx.strokeStyle = pcb.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(rx, ry, segW, stripHeight, 5);
      ctx.fill();
      ctx.stroke();

      // Silicone Neon Diffuser Overlay (background pass)
      if (state.diffuserMode === "silicone") {
        ctx.fillStyle = "rgba(241, 245, 249, 0.12)";
        ctx.beginPath();
        ctx.roundRect(rx, ry - 2, segW, stripHeight + 4, 8);
        ctx.fill();
      }

      // Draw Jumper Turnaround Wire to next row
      if (state.showWiring && r < rows - 1) {
        const isEven = r % 2 === 0;
        const turnX = isEven ? rx + segW : rx;
        const turnY1 = ry + stripHeight / 2;
        const turnY2 = ry + rowGap + stripHeight / 2;
        ctx.save();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(turnX, turnY1);
        ctx.bezierCurveTo(
          turnX + (isEven ? 26 : -26),
          turnY1,
          turnX + (isEven ? 26 : -26),
          turnY2,
          turnX,
          turnY2
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw each LED diode & copper pads
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols);
      const cInRow = i % cols;
      const isReversedRow = wrapMode === "wrap" && r % 2 === 1;
      const c = isReversedRow ? cols - 1 - cInRow : cInRow;

      const x = startX + c * pitchX + pitchX / 2;
      const y = startY + r * rowGap + stripHeight / 2;

      // Copper solder pads & silk-screen data arrow between pixels
      if (state.showWiring && pitchX >= 22) {
        const padX = x - pitchX / 2;
        ctx.fillStyle = pcb.pad;
        ctx.fillRect(padX - 1.5, y - stripHeight * 0.36, 3, 2.5);
        ctx.fillRect(padX - 1.5, y - 1.2, 3, 2.5);
        ctx.fillRect(padX - 1.5, y + stripHeight * 0.36 - 2.5, 3, 2.5);

        // Direction arrow
        ctx.fillStyle = pcb.silk;
        ctx.font = "8px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isReversedRow ? "←" : "→", x + (isReversedRow ? -pitchX * 0.32 : pitchX * 0.32), y + 3);
      }

      const disp = getOpticalDisplayRGB(leds[i], bScale);
      drawSMD5050Diode(ctx, x, y, diodeSize, disp, pcb, i, `1D Strip • Pixel #${i}`);

      // Index labels
      if (state.showIndices && pitchX >= 18) {
        if (count <= 72 || i % 2 === 0 || i === count - 1) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "9px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(String(i), x, y + stripHeight / 2 + 11);
        }
      }
    }
  }

  /**
   * 2D LED Matrix Panel Renderer (Serpentine or Progressive Row-Major)
   */
  /**
   * 2D Custom Coordinate Map Renderer (plots LEDs using their exact MAP[i].x and MAP[i].y 0..255 coordinates)
   */
  function drawCustomCoordMapHardware(ctx, w, h) {
    const leds = state.simState.leds;
    const count = leds.length;
    const specs = state.scanResult.specs;
    const pcb = getPcbColors();
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);
    const customMap = state.simState.customMap;

    if (!customMap || customMap.length === 0) {
      draw1DStripHardware(ctx, w, h);
      return;
    }

    const boardSize = Math.max(200, Math.min(w - 110, h - 64));
    const pad = 28;
    const innerSize = boardSize - pad * 2;
    const bx = (w - boardSize) / 2;
    const by = (h - boardSize) / 2;

    // Draw Coordinate PCB Frame
    ctx.fillStyle = pcb.body;
    ctx.strokeStyle = pcb.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, boardSize, boardSize, 12);
    ctx.fill();
    ctx.stroke();

    // Draw Quadrant Crosshairs (Center = 128, 128)
    const midX = bx + pad + (128 / 255) * innerSize;
    const midY = by + pad + (128 / 255) * innerSize;
    ctx.save();
    ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, by + 10);
    ctx.lineTo(midX, by + boardSize - 10);
    ctx.moveTo(bx + 10, midY);
    ctx.lineTo(bx + boardSize - 10, midY);
    ctx.stroke();

    // Quadrant Labels (FRONT/REAR/LEFT/RIGHT)
    ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
    ctx.font = "600 9px JetBrains Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("FRONT | LEFT", bx + 12, by + 16);
    ctx.fillText("REAR  | LEFT", bx + 12, by + boardSize - 10);
    ctx.textAlign = "right";
    ctx.fillText("FRONT | RIGHT", bx + boardSize - 12, by + 16);
    ctx.fillText("REAR  | RIGHT", bx + boardSize - 12, by + boardSize - 10);
    ctx.restore();

    const diodeSize = Math.max(10, Math.min(18, Math.floor(boardSize / 21)));

    // Compute screen coordinates for each mapped LED
    const pts = [];
    for (let i = 0; i < count; i++) {
      const m = customMap[i] || { x: (i / Math.max(1, count - 1)) * 255, y: 128, zone: 0 };
      const mx = Math.max(0, Math.min(255, Number(m.x) || 0));
      const my = Math.max(0, Math.min(255, Number(m.y) || 0));
      const sx = bx + pad + (mx / 255.0) * innerSize;
      const sy = by + pad + (my / 255.0) * innerSize;
      pts.push({ sx, sy, mx, my, zone: m.zone });
    }

    if (state.showWiring && pts.length > 0) {
      drawMcuHeaderBox(ctx, bx - 38, pts[0].sy, specs);
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].sx, pts[i].sy);
        else ctx.lineTo(pts[i].sx, pts[i].sy);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < count; i++) {
      const p = pts[i];
      const disp = getOpticalDisplayRGB(leds[i], bScale);
      const zoneNames = [];
      if (p.zone & 1) zoneNames.push("FRONT");
      if (p.zone & 2) zoneNames.push("REAR");
      if (p.zone & 4) zoneNames.push("LEFT");
      if (p.zone & 8) zoneNames.push("RIGHT");
      const zoneStr = zoneNames.length ? ` [${zoneNames.join("|")}]` : "";
      drawSMD5050Diode(
        ctx,
        p.sx,
        p.sy,
        diodeSize,
        disp,
        pcb,
        i,
        `MAP[${i}] (${p.mx}, ${p.my})${zoneStr}`
      );

      if (state.showIndices) {
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "8px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(i), p.sx, p.sy + diodeSize / 2 + 9);
      }
    }
  }

  function draw2DMatrixHardware(ctx, w, h) {
    const leds = state.simState.leds;
    const count = leds.length;
    const specs = state.scanResult.specs;
    const pcb = getPcbColors();
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);

    const mw = Math.max(2, Math.min(64, parseInt(els.matrixWInput.value, 10) || specs.matrixWidth || 16));
    const mh = Math.max(2, Math.min(64, parseInt(els.matrixHInput.value, 10) || specs.matrixHeight || 16));

    const wiringMode = els.matrixWiringSelect.value;
    const isSerpentine =
      wiringMode === "auto" ? specs.serpentine !== false : wiringMode === "serpentine";

    const availW = w - 90;
    const availH = h - 80;
    const cellPitch = Math.max(10, Math.min(36, Math.floor(Math.min(availW / mw, availH / mh))));
    const diodeSize = Math.max(6, Math.floor(cellPitch * 0.62));

    const boardW = mw * cellPitch + 24;
    const boardH = mh * cellPitch + 24;
    const boardX = (w - boardW) / 2;
    const boardY = (h - boardH) / 2;

    // Matrix PCB Backing Panel
    ctx.fillStyle = pcb.body;
    ctx.strokeStyle = pcb.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, 8);
    ctx.fill();
    ctx.stroke();

    // Mounting Holes in PCB corners
    const holeOffsets = [
      [boardX + 7, boardY + 7],
      [boardX + boardW - 7, boardY + 7],
      [boardX + 7, boardY + boardH - 7],
      [boardX + boardW - 7, boardY + boardH - 7]
    ];
    holeOffsets.forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#070a12";
      ctx.strokeStyle = pcb.pad;
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();
    });

    const originX = boardX + 12;
    const originY = boardY + 12;

    if (state.showWiring) {
      drawMcuHeaderBox(ctx, boardX - 46, originY + cellPitch / 2, specs);
    }

    // Draw Serpentine / Progressive Data Trace Path if showWiring is enabled
    if (state.showWiring) {
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const maxPlot = Math.min(count, mw * mh);
      for (let idx = 0; idx < maxPlot; idx++) {
        const py = Math.floor(idx / mw);
        const colInRow = idx % mw;
        const px = isSerpentine && py % 2 === 1 ? mw - 1 - colInRow : colInRow;
        const cx = originX + px * cellPitch + cellPitch / 2;
        const cy = originY + py * cellPitch + cellPitch / 2;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw Matrix Cells
    const totalCells = mw * mh;
    for (let idx = 0; idx < totalCells; idx++) {
      const py = Math.floor(idx / mw);
      const colInRow = idx % mw;
      const px = isSerpentine && py % 2 === 1 ? mw - 1 - colInRow : colInRow;

      const cx = originX + px * cellPitch + cellPitch / 2;
      const cy = originY + py * cellPitch + cellPitch / 2;

      if (idx < count) {
        const disp = getOpticalDisplayRGB(leds[idx], bScale);
        drawSMD5050Diode(
          ctx,
          cx,
          cy,
          diodeSize,
          disp,
          pcb,
          idx,
          `Matrix (${px}, ${py}) • Index #${idx}`
        );

        if (state.showIndices && cellPitch >= 22) {
          ctx.fillStyle = "rgba(148, 163, 184, 0.72)";
          ctx.font = "8px JetBrains Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(String(idx), cx, cy + cellPitch * 0.44);
        }
      } else {
        // Unpopulated cell if NUM_LEDS < mw * mh
        ctx.fillStyle = "rgba(30, 41, 59, 0.35)";
        ctx.fillRect(cx - diodeSize / 2, cy - diodeSize / 2, diodeSize, diodeSize);
      }
    }
  }

  /**
   * Circular NeoPixel Ring Renderer
   */
  function drawCircularRingHardware(ctx, w, h) {
    const leds = state.simState.leds;
    const count = leds.length;
    const specs = state.scanResult.specs;
    const pcb = getPcbColors();
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.min(w, h) * 0.38;
    const ringRadius = Math.max(65, maxRadius);
    const trackThickness = Math.max(24, Math.min(42, Math.floor((2 * Math.PI * ringRadius) / Math.max(12, count) * 0.85)));
    const diodeSize = Math.max(8, Math.min(20, Math.floor(trackThickness * 0.52)));

    // Annular PCB Ring Track
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius + trackThickness / 2, 0, Math.PI * 2);
    ctx.arc(cx, cy, Math.max(12, ringRadius - trackThickness / 2), 0, Math.PI * 2, true);
    ctx.fillStyle = pcb.body;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = pcb.border;
    ctx.stroke();
    ctx.restore();

    if (state.showWiring) {
      drawMcuHeaderBox(ctx, cx - ringRadius - trackThickness / 2 - 58, cy - ringRadius * 0.6, specs);
    }

    for (let i = 0; i < count; i++) {
      // Index 0 at top (-90 deg), clockwise
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * ringRadius;
      const y = cy + Math.sin(angle) * ringRadius;
      const deg = Math.round(((i / count) * 360) % 360);

      const disp = getOpticalDisplayRGB(leds[i], bScale);
      drawSMD5050Diode(ctx, x, y, diodeSize, disp, pcb, i, `Ring ${deg}° • Pixel #${i}`);

      if (state.showIndices && (count <= 48 || i % 2 === 0)) {
        const labelR = ringRadius + trackThickness / 2 + 12;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i), lx, ly);
      }
    }
  }

  /**
   * 3-Sided Desk / Monitor Perimeter Arch Renderer
   */
  function drawArchPerimeterHardware(ctx, w, h) {
    const leds = state.simState.leds;
    const count = leds.length;
    const specs = state.scanResult.specs;
    const pcb = getPcbColors();
    const bScale = (state.simState.brightness / 255.0) * (state.simState.powerThrottleScale || 1.0);

    // Split LEDs into Left (25%), Top (50%), Right (25%)
    const leftCount = Math.max(1, Math.round(count * 0.25));
    const rightCount = Math.max(1, Math.round(count * 0.25));
    const topCount = Math.max(1, count - leftCount - rightCount);

    const frameW = Math.min(w - 110, 560);
    const frameH = Math.min(h - 90, 320);
    const fx = (w - frameW) / 2;
    const fy = (h - frameH) / 2 + 10;

    // Draw Monitor / Desk Bezel Backdrop
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = pcb.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(fx, fy, frameW, frameH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PERIMETER / AMBILIGHT FRAME VIEW", w / 2, fy + frameH / 2);

    const diodeSize = Math.max(7, Math.min(16, Math.floor(frameW / Math.max(12, topCount) * 0.55)));

    for (let i = 0; i < count; i++) {
      let x = fx;
      let y = fy;
      let segLabel = "";

      if (i < leftCount) {
        // Left edge: bottom to top
        const t = leftCount > 1 ? i / (leftCount - 1) : 0.5;
        x = fx + 14;
        y = fy + frameH - 18 - t * (frameH - 36);
        segLabel = "Left Edge";
      } else if (i < leftCount + topCount) {
        // Top edge: left to right
        const idxTop = i - leftCount;
        const t = topCount > 1 ? idxTop / (topCount - 1) : 0.5;
        x = fx + 28 + t * (frameW - 56);
        y = fy + 14;
        segLabel = "Top Edge";
      } else {
        // Right edge: top to bottom
        const idxRight = i - leftCount - topCount;
        const t = rightCount > 1 ? idxRight / (rightCount - 1) : 0.5;
        x = fx + frameW - 14;
        y = fy + 18 + t * (frameH - 36);
        segLabel = "Right Edge";
      }

      const disp = getOpticalDisplayRGB(leds[i], bScale);
      drawSMD5050Diode(ctx, x, y, diodeSize, disp, pcb, i, `${segLabel} • Pixel #${i}`);
    }
  }

  /**
   * Draws a compact MCU wiring header block connected to LED #0.
   */
  function drawMcuHeaderBox(ctx, x, y, specs) {
    ctx.save();
    const boxW = 44;
    const boxH = 38;
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 8px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("MCU", x, y - 6);
    ctx.fillStyle = "#34d399";
    ctx.fillText(`D${specs.dataPin}→DIN`, x, y + 5);
    ctx.fillStyle = "#f87171";
    ctx.fillText("5V/GND", x, y + 14);

    // Wire line from MCU box to strip entry
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + boxW / 2, y);
    ctx.lineTo(x + boxW / 2 + 22, y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws the real-time RGB channel spatial waveform bar along the bottom of the visualizer.
   */
  function drawWaveform() {
    const c = els.waveformCanvas;
    if (!c) return;
    const ctx = c.getContext("2d");
    const rect = c.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(36, Math.floor(rect.height));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    if (!state.simState || !state.simState.leds || !state.scanResult || !state.scanResult.valid) {
      return;
    }

    const leds = state.simState.leds;
    const n = leds.length;
    const bScale = state.simState.brightness / 255.0;

    const channels = [
      { key: "r", stroke: "rgba(248, 113, 113, 0.85)" },
      { key: "g", stroke: "rgba(52, 211, 153, 0.85)" },
      { key: "b", stroke: "rgba(56, 189, 248, 0.85)" }
    ];

    channels.forEach((ch) => {
      ctx.beginPath();
      ctx.strokeStyle = ch.stroke;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? (i / (n - 1)) * (w - 8) + 4 : w / 2;
        const val = (leds[i][ch.key] * bScale) / 255.0;
        const y = h - 4 - val * (h - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }

  /**
   * Main RequestAnimationFrame Loop
   */
  function animationLoop(now) {
    const dtReal = Math.min(100, now - lastFrameTime);
    lastFrameTime = now;

    fpsFrameCounter++;
    if (now - fpsLastCheck >= 500) {
      state.measuredFps = Math.min(60, Math.round((fpsFrameCounter * 1000) / (now - fpsLastCheck)));
      fpsFrameCounter = 0;
      fpsLastCheck = now;
    }

    if (state.isPlaying && state.simulator && state.scanResult && state.scanResult.valid) {
      simAccumulatorMs += dtReal * state.speedMultiplier;
      const targetStepMs = Math.max(8, state.simState ? state.simState.frameDelayMs : 16);

      if (simAccumulatorMs >= targetStepMs) {
        const steps = Math.min(3, Math.floor(simAccumulatorMs / targetStepMs));
        for (let s = 0; s < steps; s++) {
          state.simState = state.simulator.step(targetStepMs);
        }
        simAccumulatorMs %= targetStepMs;
        updateTelemetryUI();
        drawHardwareFrame();
        drawWaveform();
      }
    }

    rafId = requestAnimationFrame(animationLoop);
  }

  function togglePlayPause() {
    state.isPlaying = !state.isPlaying;
    updatePlayPauseButtonUI();
  }

  function updatePlayPauseButtonUI() {
    if (state.isPlaying) {
      els.playPauseLabel.textContent = "Pause";
      els.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>`;
      els.stepFrameBtn.disabled = true;
      els.stepFrameBtn.classList.add("opacity-40", "cursor-not-allowed");
    } else {
      els.playPauseLabel.textContent = "Play";
      els.playPauseIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
      els.stepFrameBtn.disabled = false;
      els.stepFrameBtn.classList.remove("opacity-40", "cursor-not-allowed");
    }
  }

  function stepSingleFrame() {
    if (state.isPlaying || !state.simulator) return;
    state.simState = state.simulator.step();
    updateTelemetryUI();
    drawHardwareFrame();
    drawWaveform();
  }

  function resetSimulation() {
    if (!state.simulator) return;
    state.peakCurrentMa = 0;
    state.simState = state.simulator.reset();
    updateTelemetryUI();
    drawHardwareFrame();
    drawWaveform();
    showToast("Simulation reset to setup() initial state", "info");
  }

  function findHitLedIndex(clientX, clientY) {
    const rect = els.canvas.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    // Invert pan & zoom transform around canvas center
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const localX = (rawX - cx - state.panX) / state.zoom + cx;
    const localY = (rawY - cy - state.panY) / state.zoom + cy;

    let closestIdx = null;
    let minDist = Infinity;

    for (let i = 0; i < state.pixelScreenPositions.length; i++) {
      const p = state.pixelScreenPositions[i];
      if (!p) continue;
      const dx = localX - p.x;
      const dy = localY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= p.r * 1.45 && dist < minDist) {
        minDist = dist;
        closestIdx = p.index;
      }
    }
    return closestIdx;
  }

  function setupEventListeners() {
    els.presetSelect.addEventListener("change", (e) => {
      loadPreset(e.target.value);
    });

    els.scanRunBtn.addEventListener("click", () => {
      scanAndCompileSketch();
      if (state.scanResult && state.scanResult.valid) {
        showToast(
          `Scanned ${state.scanResult.specs.numLeds} LEDs (${state.scanResult.specs.chipset} on Pin D${state.scanResult.specs.dataPin})`,
          "success"
        );
      } else {
        showToast("Sketch rejected — FastLED not detected", "error");
      }
    });

    els.loadValidPresetBtn.addEventListener("click", () => {
      loadPreset("mapped_zone_crossfader");
      showToast("Loaded valid FastLED Rainbow + Glitter sketch", "success");
    });

    let autoCompileTimer = null;
    els.codeEditor.addEventListener("input", () => {
      updateLineNumbers();
      clearTimeout(autoCompileTimer);
      autoCompileTimer = setTimeout(() => {
        scanAndCompileSketch();
      }, 400);
    });

    els.codeEditor.addEventListener("paste", () => {
      setTimeout(() => {
        updateLineNumbers();
        scanAndCompileSketch();
        if (state.scanResult && state.scanResult.valid && (!state.simState || !state.simState.runtimeError)) {
          showToast(
            `Auto-scanned ${state.scanResult.specs.numLeds} LEDs (${state.scanResult.specs.chipset})`,
            "success"
          );
        }
      }, 40);
    });

    els.codeEditor.addEventListener("scroll", () => {
      els.lineNumbers.scrollTop = els.codeEditor.scrollTop;
    });

    els.codeEditor.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        scanAndCompileSketch();
        showToast("Sketch re-scanned and updated", "success");
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const start = els.codeEditor.selectionStart;
        const end = els.codeEditor.selectionEnd;
        const val = els.codeEditor.value;
        els.codeEditor.value = val.substring(0, start) + "  " + val.substring(end);
        els.codeEditor.selectionStart = els.codeEditor.selectionEnd = start + 2;
      }
    });

    // Upload .ino / .cpp sketch file
    els.uploadBtn.addEventListener("click", () => {
      els.fileInput.click();
    });

    els.fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        els.codeEditor.value = String(ev.target.result || "");
        els.presetDescText.textContent = `Uploaded sketch: ${file.name}`;
        updateLineNumbers();
        scanAndCompileSketch();
        showToast(`Loaded ${file.name}`, state.scanResult.valid ? "success" : "error");
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    // Download .ino file
    els.downloadInoBtn.addEventListener("click", () => {
      const blob = new Blob([els.codeEditor.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.currentPresetId || "fastled_sketch"}.ino`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Downloaded Arduino .ino sketch file", "success");
    });

    // Copy extracted hardware specs JSON
    els.copySpecsBtn.addEventListener("click", () => {
      const payload = state.scanResult
        ? JSON.stringify(state.scanResult.specs || { valid: false, reason: state.scanResult.rejectedReason }, null, 2)
        : "{}";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload);
        } else {
          const ta = document.createElement("textarea");
          ta.value = payload;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        showToast("Copied scanned hardware specifications JSON to clipboard", "success");
      } catch (_) {
        showToast("Copied hardware specifications", "info");
      }
    });

    // Left panel tabs
    els.tabBtnSpecs.addEventListener("click", () => switchLeftTab("specs"));
    els.tabBtnWiring.addEventListener("click", () => switchLeftTab("wiring"));
    els.tabBtnSerial.addEventListener("click", () => {
      switchLeftTab("serial");
      renderSerialPanel();
    });

    els.clearSerialBtn.addEventListener("click", () => {
      if (state.simState && state.simState.serialLogs) {
        state.simState.serialLogs.length = 0;
      }
      renderSerialPanel();
      showToast("Cleared Serial Monitor output", "info");
    });

    // Playback & Simulation Controls
    els.playPauseBtn.addEventListener("click", togglePlayPause);
    els.stepFrameBtn.addEventListener("click", stepSingleFrame);
    els.resetSimBtn.addEventListener("click", resetSimulation);
    els.skipTimeBtn.addEventListener("click", () => {
      if (!state.simulator) return;
      state.simState = state.simulator.step(15000);
      updateTelemetryUI();
      drawHardwareFrame();
      drawWaveform();
      showToast("Advanced simulated clock by +15.0 seconds", "info");
    });
    els.speedSelect.addEventListener("change", (e) => {
      state.speedMultiplier = parseFloat(e.target.value) || 1.0;
    });

    // Hardware & Optical Controls
    els.topologySelect.addEventListener("change", (e) => {
      state.topologyOverride = e.target.value;
      updateTopologyToolbarVisibility();
      drawHardwareFrame();
    });

    els.stripWrapSelect.addEventListener("change", () => {
      drawHardwareFrame();
    });

    els.matrixWInput.addEventListener("change", () => drawHardwareFrame());
    els.matrixHInput.addEventListener("change", () => drawHardwareFrame());
    els.matrixWiringSelect.addEventListener("change", () => drawHardwareFrame());

    els.pcbSelect.addEventListener("change", (e) => {
      state.pcbColor = e.target.value;
      drawHardwareFrame();
    });

    els.diffuserSelect.addEventListener("change", (e) => {
      state.diffuserMode = e.target.value;
      drawHardwareFrame();
    });

    els.bloomSlider.addEventListener("input", (e) => {
      state.bloomIntensity = parseInt(e.target.value, 10) / 100.0;
      els.bloomValueLabel.textContent = `${e.target.value}%`;
      drawHardwareFrame();
    });

    els.toggleWiringBtn.addEventListener("click", () => {
      state.showWiring = !state.showWiring;
      els.toggleWiringBtn.classList.toggle("bg-cyan-500/20", state.showWiring);
      els.toggleWiringBtn.classList.toggle("text-cyan-300", state.showWiring);
      els.toggleWiringBtn.classList.toggle("border-cyan-500/40", state.showWiring);
      drawHardwareFrame();
    });

    els.toggleIndicesBtn.addEventListener("click", () => {
      state.showIndices = !state.showIndices;
      els.toggleIndicesBtn.classList.toggle("bg-cyan-500/20", state.showIndices);
      els.toggleIndicesBtn.classList.toggle("text-cyan-300", state.showIndices);
      els.toggleIndicesBtn.classList.toggle("border-cyan-500/40", state.showIndices);
      drawHardwareFrame();
    });

    els.toggleAmbientBtn.addEventListener("click", () => {
      state.ambientRoom = state.ambientRoom === "dark" ? "lit" : "dark";
      els.canvasContainer.className =
        "relative flex-1 min-h-[290px] overflow-hidden select-none " +
        (state.ambientRoom === "dark" ? "workbench-grid-bg" : "workbench-lit-bg");
      els.toggleAmbientBtn.textContent = state.ambientRoom === "dark" ? "🌙 Dark Lab" : "☀️ Lit Bench";
      drawHardwareFrame();
    });

    els.zoomInBtn.addEventListener("click", () => {
      state.zoom = Math.min(3.0, +(state.zoom + 0.2).toFixed(2));
      drawHardwareFrame();
    });

    els.zoomOutBtn.addEventListener("click", () => {
      state.zoom = Math.max(0.5, +(state.zoom - 0.2).toFixed(2));
      drawHardwareFrame();
    });

    els.zoomResetBtn.addEventListener("click", () => {
      state.zoom = 1.0;
      state.panX = 0;
      state.panY = 0;
      drawHardwareFrame();
    });

    // Canvas Mouse Interaction (Pixel Probe + Pan/Zoom)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;

    els.canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX - state.panX;
      dragStartY = e.clientY - state.panY;
    });

    window.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const nx = e.clientX - dragStartX;
        const ny = e.clientY - dragStartY;
        if (Math.abs(nx - state.panX) > 3 || Math.abs(ny - state.panY) > 3) {
          dragMoved = true;
        }
        state.panX = nx;
        state.panY = ny;
        drawHardwareFrame();
        return;
      }

      if (e.target === els.canvas) {
        const idx = findHitLedIndex(e.clientX, e.clientY);
        if (idx !== state.hoveredLedIndex) {
          state.hoveredLedIndex = idx;
          els.canvas.style.cursor = idx !== null ? "pointer" : "grab";
          updatePixelProbeUI();
          drawHardwareFrame();
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (isDragging && !dragMoved && e.target === els.canvas) {
        const hit = findHitLedIndex(e.clientX, e.clientY);
        if (hit !== null) {
          state.lockedLedIndex = state.lockedLedIndex === hit ? null : hit;
          updatePixelProbeUI();
          drawHardwareFrame();
        }
      }
      isDragging = false;
    });

    els.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        state.zoom = Math.max(0.5, Math.min(3.0, +(state.zoom + delta).toFixed(2)));
        drawHardwareFrame();
      },
      { passive: false }
    );

    els.unlockProbeBtn.addEventListener("click", () => {
      state.lockedLedIndex = null;
      updatePixelProbeUI();
      drawHardwareFrame();
    });

    window.addEventListener("resize", () => {
      drawHardwareFrame();
      drawWaveform();
    });
  }

  function initApp() {
    cacheElements();
    populatePresets();
    setupEventListeners();
    updatePlayPauseButtonUI();
    loadPreset("mapped_zone_crossfader");
    if (rafId) cancelAnimationFrame(rafId);
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(animationLoop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
