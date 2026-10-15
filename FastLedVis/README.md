# FastLedVis
# Made by Gemini Argon 4
**Zero-Wiring Arduino FastLED Sketch Scanner & Optical Hardware Visualizer**  
Repository: [https://github.com/Spaceulizer/FastLedVis](https://github.com/Spaceulizer/FastLedVis)

`FastLedVis` takes an Arduino `.ino` / `.cpp` sketch built with **FastLED**, automatically scans the source code for hardware specifications (`NUM_LEDS`, chipset, `DATA_PIN`, `CLOCK_PIN`, `COLOR_ORDER`, `BRIGHTNESS`, power limits, and 1D/2D/Ring geometry), rejects non-FastLED sketches, and renders a real-time optical and electrical simulation of your physical LED strip or matrix without any wiring required.

## Key Features

- **Automatic FastLED Gatekeeper & Static Specification Scanner**:
  - Verifies `#include <FastLED.h>` and `FastLED.addLeds<...>(...)` calls; automatically rejects non-FastLED sketches with line-level diagnostics.
  - Extracts strip length (`NUM_LEDS`), LED chipset (`WS2812B`, `SK6812`, `APA102`, `NEOPIXEL`, `DOTSTAR`, `WS2811`), `DATA_PIN` / `CLOCK_PIN`, color channel order (`GRB`, `RGB`, `BGR`, etc.), `BRIGHTNESS`, `setMaxPowerInVoltsAndMilliamps()`, and 2D matrix dimensions (`MATRIX_WIDTH`, `MATRIX_HEIGHT`, `SERPENTINE`, `XY(x, y)`).
- **In-Browser FastLED C++ Emulation Runtime**:
  - Executes your sketch's `setup()` and `loop()` functions frame-by-frame.
  - Supports `CRGB`, `CHSV`, named `CRGB::` colors, `fill_rainbow`, `fill_solid`, `fill_gradient_RGB`, `fill_palette`, `ColorFromPalette`, `HeatColor`, `fadeToBlackBy`, `nscale8`, `blur1d`, `beatsin8`, `beatsin16`, `sin8`, `cos8`, `inoise8`, `random8`, `random16`, `qadd8`, `qsub8`, `EVERY_N_MILLISECONDS`, and standard FastLED palettes (`PartyColors_p`, `OceanColors_p`, `LavaColors_p`, `RainbowColors_p`, `HeatColors_p`, `ForestColors_p`, `CloudColors_p`).
- **Hardware-Accurate Workbench Visualization**:
  - **Form Factors**: 1D Linear Strip (Workbench Serpentine Wrap or Straight), 2D LED Matrix Panel (Serpentine Zig-Zag or Progressive Row-Major), Circular NeoPixel Ring, and 3-Sided Monitor/Desk Perimeter Arch.
  - **Optical Realism**: Switch between Raw SMD 5050 LED packages, Silicone Neon Diffuser tubing, and Frosted Matrix Grid Baffles on Black, White, or Copper PCBs.
  - **Electrical Telemetry & Pixel Probe**: Real-time current draw (`mA` / `Amps`), wattage (`W`), USB 500mA vs external 5V PSU load advisor, spatial RGB waveform scope, and click-to-lock LED pixel inspector.

## Quick Start

### Option 1: Open Directly in Browser
Open `index.html` in any modern desktop or mobile browser—no build step required.

### Option 2: Run with Local Static Server or Node Tests
```bash
# Run the automated FastLED parser & runtime test suite
npm test

# Serve locally on http://localhost:8080
npx serve .
```

## Project Structure

```text
FastLedVis/
├── index.html          # Main application entry point
├── styles.css          # Workbench theme and layout styles
├── src/
│   ├── parser.js       # FastLED static scanner & C++-to-JS transpiler
│   ├── runtime.js      # FastLED standard library & hardware emulation engine
│   ├── presets.js      # Built-in FastLED example sketches & rejection test
│   └── app.js          # Workbench UI controller & HTML5 Canvas optical renderer
├── examples/           # Standalone .ino Arduino sketches for testing
└── test.js             # Automated Node.js test suite for parser & simulator
```
