const assert = require("assert");
const { FASTLED_PRESETS } = require("./src/presets.js");
const { scanFastLEDSketch, transpileFastLEDSketch } = require("./src/parser.js");
const { createFastLEDSimulator } = require("./src/runtime.js");

console.log("Running FastLedVis test suite...");

for (const preset of FASTLED_PRESETS) {
  const scan = scanFastLEDSketch(preset.code);
  if (preset.id === "rejected_blink") {
    assert.strictEqual(scan.valid, false, "Non-FastLED sketch must be rejected");
    console.log("✓ Rejected non-FastLED sketch:", preset.id);
    continue;
  }

  assert.strictEqual(scan.valid, true, `Preset ${preset.id} should be valid FastLED code`);
  const jsCode = transpileFastLEDSketch(preset.code, scan.specs);
  const sim = createFastLEDSimulator(jsCode, scan.specs);
  let state;
  for (let i = 0; i < 15; i++) {
    state = sim.step();
  }
  const litCount = state.leds.filter((px) => px.r > 0 || px.g > 0 || px.b > 0).length;
  assert.ok(litCount > 0, `Preset ${preset.id} should light up LEDs after 15 frames`);
  console.log(`✓ Verified ${preset.id}: ${ scan.specs.numLeds } LEDs (${ scan.specs.chipset }, Pin D${ scan.specs.dataPin }) -> ${ litCount } lit, ${ state.currentMa } mA`);
}

console.log("All FastLedVis tests passed!");
