// FastLedVis - Curated Example Sketches (.ino)
// Includes 1D strips, 2D matrices, circular rings, and a non-FastLED sketch for rejection testing.

const FASTLED_PRESETS = [
  {
    id: "mapped_zone_crossfader",
    name: "Custom 2D Map: 34-LED Zone Crossfader (MAP[34])",
    category: "2D Coord Map",
    description: "34-LED WS2812B PROGMEM 2D coordinate map with Rotating Half-and-Half, Concentric Wipe, 4-Quadrant Stepper, and 3s crossfades.",
    code: `#include <FastLED.h>

#define NUM_LEDS            34
#define DATA_PIN            3     // Data pin mapped to 3
#define LED_TYPE            WS2812B
#define COLOR_ORDER         GRB
#define BRIGHTNESS          250   // Max brightness set to 250
#define PATTERN_DURATION    60    // Cycle interval in seconds
#define CROSSFADE_MS        3000  // Smooth transition duration (3 seconds)

CRGB leds[NUM_LEDS];
CRGB bufferA[NUM_LEDS];
CRGB bufferB[NUM_LEDS];

enum Zone { FRONT = 1, REAR = 2, LEFT = 4, RIGHT = 8 };

struct LEDPoint {
  uint8_t x;     
  uint8_t y;     
  uint8_t zone;  
};

const LEDPoint PROGMEM MAP[NUM_LEDS] = {
  { 255, 175, REAR  | RIGHT }, { 255,  22, FRONT | RIGHT }, { 250,  10, FRONT | RIGHT }, 
  { 198,   2, FRONT | RIGHT }, { 114,   3, FRONT | LEFT  }, {  29,   0, FRONT | LEFT  }, 
  {   0,  44, FRONT | LEFT  }, {   0, 128, REAR  | LEFT  }, {   4, 212, REAR  | LEFT  }, 
  {  45, 251, REAR  | LEFT  }, { 126, 255, REAR  | LEFT  }, { 208, 255, REAR  | RIGHT }, 
  { 248, 218, REAR  | RIGHT }, { 240, 134, REAR  | RIGHT }, { 243,  48, FRONT | RIGHT }, 
  { 176,  19, FRONT | RIGHT }, {  92,  21, FRONT | LEFT  }, {  24,  51, FRONT | LEFT  }, 
  {  19, 129, REAR  | LEFT  }, {  17, 173, REAR  | LEFT  }, {  40, 221, REAR  | LEFT  }, 
  {  85, 234, REAR  | LEFT  }, { 167, 240, REAR  | RIGHT }, { 228, 235, REAR  | RIGHT }, 
  { 222, 170, REAR  | RIGHT }, { 225,  85, FRONT | RIGHT }, { 200,  39, FRONT | RIGHT }, 
  { 116,  40, FRONT | LEFT  }, {  54,  59, FRONT | LEFT  }, {  45,  93, FRONT | LEFT  }, 
  {  46, 178, REAR  | LEFT  }, {  65, 205, REAR  | LEFT  }, { 141, 221, REAR  | RIGHT }, 
  { 195, 215, REAR  | RIGHT }
};

inline uint8_t getX(uint8_t index) { return pgm_read_byte(&MAP[index].x); }
inline uint8_t getY(uint8_t index) { return pgm_read_byte(&MAP[index].y); }

uint8_t gHue = 0; 

// --- PATTERN 1: ROTATING SOLID HALF-AND-HALF ---
void patternRotatingSolidHalf(CRGB* target) {
  static uint8_t angle = 0;
  EVERY_N_MILLISECONDS(60) { angle++; }

  CRGB color1 = CHSV(gHue, 255, 255);
  CRGB color2 = CHSV(gHue + 128, 255, 255);

  int16_t cosVal = (int16_t)cos8(angle) - 128;
  int16_t sinVal = (int16_t)sin8(angle) - 128;

  for (uint8_t i = 0; i < NUM_LEDS; i++) {
    int16_t dx = (int16_t)getX(i) - 128;
    int16_t dy = (int16_t)getY(i) - 128;

    int32_t dot = (dx * cosVal) + (dy * sinVal);
    target[i] = (dot >= 0) ? color1 : color2;
  }
}

// --- PATTERN 2: SLOW OUTSIDE-IN CONCENTRIC COLOR WIPE ---
void patternOutsideInConcentricWipe(CRGB* target) {
  static uint8_t currentHue = 0;
  static uint8_t nextHue = 85;
  static int16_t radiusCutoff = 150;

  EVERY_N_MILLISECONDS(100) {
    radiusCutoff--;
    
    if (radiusCutoff < 0) {
      currentHue = nextHue;
      nextHue += 85;
      radiusCutoff = 150;
    }
  }

  CRGB colorCurrent = CHSV(currentHue, 255, 255);
  CRGB colorNext    = CHSV(nextHue, 255, 255);

  for (uint8_t i = 0; i < NUM_LEDS; i++) {
    int16_t dx = (int16_t)getX(i) - 128;
    int16_t dy = (int16_t)getY(i) - 128;
    uint16_t dist = sqrt16((dx * dx) + (dy * dy));

    target[i] = (dist >= radiusCutoff) ? colorNext : colorCurrent;
  }
}

// --- PATTERN 3: 4-QUADRANT SOLID BLOCK STEPPER ---
void patternQuadrantSolidBlocks(CRGB* target) {
  static uint8_t stepOffset = 0;
  
  EVERY_N_SECONDS(4) {
    stepOffset = (stepOffset + 1) % 4;
  }

  CRGB palette[4] = {
    CHSV(gHue, 255, 255),
    CHSV(gHue + 64, 255, 255),
    CHSV(gHue + 128, 255, 255),
    CHSV(gHue + 192, 255, 255)
  };

  for (uint8_t i = 0; i < NUM_LEDS; i++) {
    uint8_t zone = pgm_read_byte(&MAP[i].zone);
    uint8_t quadrant = 0;

    if ((zone & FRONT) && (zone & LEFT))  quadrant = 0;
    if ((zone & FRONT) && (zone & RIGHT)) quadrant = 1;
    if ((zone & REAR)  && (zone & RIGHT)) quadrant = 2;
    if ((zone & REAR)  && (zone & LEFT))  quadrant = 3;

    target[i] = palette[(quadrant + stepOffset) % 4];
  }
}

// --- PATTERN DISPATCHER & CROSS-FADE ENGINE ---
typedef void (*PatternFunc)(CRGB*);
PatternFunc patternList[] = { 
  patternRotatingSolidHalf, 
  patternOutsideInConcentricWipe, 
  patternQuadrantSolidBlocks 
};

uint8_t currentPatternIndex = 0;
uint8_t nextPatternIndex = 1;
bool isCrossfading = false;
unsigned long crossfadeStartTime = 0;

void setup() {
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
}

void loop() {
  EVERY_N_MILLISECONDS(50) { gHue++; }

  // Trigger smooth pattern change every 60 seconds
  EVERY_N_SECONDS(PATTERN_DURATION) {
    if (!isCrossfading) {
      isCrossfading = true;
      crossfadeStartTime = millis();
      nextPatternIndex = (currentPatternIndex + 1) % (sizeof(patternList) / sizeof(patternList[0]));
    }
  }

  if (isCrossfading) {
    unsigned long elapsed = millis() - crossfadeStartTime;

    if (elapsed >= CROSSFADE_MS) {
      // Transition complete
      isCrossfading = false;
      currentPatternIndex = nextPatternIndex;
      patternList[currentPatternIndex](leds);
    } else {
      // Render active patterns to separate buffers and cross-fade
      patternList[currentPatternIndex](bufferA);
      patternList[nextPatternIndex](bufferB);

      uint8_t blendAmount = map(elapsed, 0, CROSSFADE_MS, 0, 255);

      for (uint8_t i = 0; i < NUM_LEDS; i++) {
        leds[i] = blend(bufferA[i], bufferB[i], blendAmount);
      }
    }
  } else {
    patternList[currentPatternIndex](leds);
  }

  FastLED.show();
}`
  },
  {
    id: "rainbow_glitter",
    name: "DemoReel: Rainbow + Glitter (1D Strip)",
    category: "1D Strip",
    description: "60-LED WS2812B strip running FastLED fill_rainbow, beatsin8 breathing, and random8 white glitter.",
    code: `#include <FastLED.h>

#define DATA_PIN    6
#define LED_TYPE    WS2812B
#define COLOR_ORDER GRB
#define NUM_LEDS    60
#define BRIGHTNESS  180

CRGB leds[NUM_LEDS];
uint8_t gHue = 0;

void setup() {
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 1500);
  Serial.begin(115200);
  Serial.println("FastLED Rainbow + Glitter initialized on Pin 6");
}

void addGlitter(fract8 chanceOfGlitter) {
  if (random8() < chanceOfGlitter) {
    leds[random16(NUM_LEDS)] += CRGB::White;
  }
}

void loop() {
  // Slowly cycle the base rainbow hue
  EVERY_N_MILLISECONDS(20) {
    gHue++;
  }

  // Fill strip with moving rainbow and subtle beatsin8 brightness wave
  fill_rainbow(leds, NUM_LEDS, gHue, 7);
  addGlitter(80);

  // Add a secondary traveling pulse using beatsin16
  uint16_t pos = beatsin16(18, 0, NUM_LEDS - 1);
  leds[pos] += CRGB(120, 180, 255);

  FastLED.show();
  FastLED.delay(16);
}`
  },
  {
    id: "fire2012",
    name: "Fire2012 by Mark Kriegsman (1D Strip)",
    category: "1D Strip",
    description: "Classic 1D fire simulation using qsub8 cooling, qadd8 heat diffusion, random8 sparking, and HeatColor().",
    code: `#include <FastLED.h>

#define LED_PIN     5
#define COLOR_ORDER GRB
#define CHIPSET     WS2812B
#define NUM_LEDS    60
#define BRIGHTNESS  220
#define FRAMES_PER_SECOND 60

#define COOLING  55
#define SPARKING 120

bool gReverseDirection = false;
CRGB leds[NUM_LEDS];

void setup() {
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(BRIGHTNESS);
  Serial.println("Fire2012 simulation started (60 LEDs)");
}

void Fire2012() {
  // Array of temperature readings at each simulation cell
  static byte heat[NUM_LEDS];

  // Step 1. Cool down every cell a little
  for (int i = 0; i < NUM_LEDS; i++) {
    heat[i] = qsub8(heat[i], random8(0, ((COOLING * 10) / NUM_LEDS) + 2));
  }

  // Step 2. Heat from each cell drifts 'up' and diffuses a little
  for (int k = NUM_LEDS - 1; k >= 2; k--) {
    heat[k] = (heat[k - 1] + heat[k - 2] + heat[k - 2]) / 3;
  }

  // Step 3. Randomly ignite new 'sparks' of heat near the bottom
  if (random8() < SPARKING) {
    int y = random8(7);
    heat[y] = qadd8(heat[y], random8(160, 255));
  }

  // Step 4. Map from heat cells to LED colors
  for (int j = 0; j < NUM_LEDS; j++) {
    CRGB color = HeatColor(heat[j]);
    int pixelnumber;
    if (gReverseDirection) {
      pixelnumber = (NUM_LEDS - 1) - j;
    } else {
      pixelnumber = j;
    }
    leds[pixelnumber] = color;
  }
}

void loop() {
  Fire2012();
  FastLED.show();
  FastLED.delay(1000 / FRAMES_PER_SECOND);
}`
  },
  {
    id: "cylon_scanner",
    name: "Cylon / Dual Sinelon Scanner (1D Strip)",
    category: "1D Strip",
    description: "48-LED APA102 (DotStar) dual-pin strip with smooth fadeToBlackBy phosphor trails and opposing harmonic scanners.",
    code: `#include <FastLED.h>

#define NUM_LEDS    48
#define DATA_PIN    11
#define CLOCK_PIN   13
#define COLOR_ORDER BGR
#define BRIGHTNESS  200

CRGB leds[NUM_LEDS];
uint8_t gHue = 0;

void setup() {
  FastLED.addLeds<APA102, DATA_PIN, CLOCK_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  Serial.println("APA102 Dual-Scanner initialized (DATA=11, CLK=13)");
}

void loop() {
  // Dim existing pixels to create smooth motion trails
  fadeToBlackBy(leds, NUM_LEDS, 22);

  // Primary scanner sweeps back and forth with beatsin16
  int pos1 = beatsin16(24, 0, NUM_LEDS - 1);
  leds[pos1] += CHSV(gHue, 240, 255);

  // Secondary harmonic scanner 90 degrees out of phase
  int pos2 = beatsin16(24, 0, NUM_LEDS - 1, 0, 16384);
  leds[pos2] += CHSV(gHue + 128, 220, 255);

  // Center core pulse
  blur1d(leds, NUM_LEDS, 32);

  EVERY_N_MILLISECONDS(15) {
    gHue++;
  }

  FastLED.show();
  FastLED.delay(16);
}`
  },
  {
    id: "matrix_plasma",
    name: "2D Matrix: Serpentine Plasma (16x16)",
    category: "2D Matrix",
    description: "256-LED (16x16) serpentine WS2812B matrix using XY(x,y) mapping, sin8 interference waves, and PartyColors_p palette.",
    code: `#include <FastLED.h>

#define MATRIX_WIDTH  16
#define MATRIX_HEIGHT 16
#define NUM_LEDS      256
#define DATA_PIN      4
#define LED_TYPE      WS2812B
#define COLOR_ORDER   GRB
#define BRIGHTNESS    160
#define SERPENTINE    true

CRGB leds[NUM_LEDS];
uint16_t t = 0;

uint16_t XY(uint8_t x, uint8_t y) {
  if (x >= MATRIX_WIDTH || y >= MATRIX_HEIGHT) return 0;
  if (SERPENTINE && (y & 1)) {
    return (y * MATRIX_WIDTH) + (MATRIX_WIDTH - 1 - x);
  }
  return (y * MATRIX_WIDTH) + x;
}

void setup() {
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 2500);
  Serial.println("16x16 Serpentine Matrix Plasma active");
}

void loop() {
  t += 3;

  for (uint8_t y = 0; y < MATRIX_HEIGHT; y++) {
    for (uint8_t x = 0; x < MATRIX_WIDTH; x++) {
      uint8_t v1 = sin8(x * 18 + t);
      uint8_t v2 = cos8(y * 18 - t);
      uint8_t v3 = sin8((x + y) * 12 + (t >> 1));
      uint8_t index = (v1 + v2 + v3) / 3;
      leds[XY(x, y)] = ColorFromPalette(PartyColors_p, index + (t >> 2), 255, LINEARBLEND);
    }
  }

  FastLED.show();
  FastLED.delay(16);
}`
  },
  {
    id: "matrix_fire",
    name: "2D Matrix: Arcade Cyber Pulse & Radar (16x16)",
    category: "2D Matrix",
    description: "16x16 LED matrix displaying concentric radial shockwaves and LavaColors_p heat rings.",
    code: `#include <FastLED.h>

#define MATRIX_WIDTH  16
#define MATRIX_HEIGHT 16
#define NUM_LEDS      256
#define DATA_PIN      7
#define LED_TYPE      WS2812B
#define COLOR_ORDER   GRB
#define BRIGHTNESS    190
#define SERPENTINE    true

CRGB leds[NUM_LEDS];
uint8_t phase = 0;

uint16_t XY(uint8_t x, uint8_t y) {
  if (SERPENTINE && (y % 2 == 1)) {
    return (y * MATRIX_WIDTH) + (MATRIX_WIDTH - 1 - x);
  }
  return (y * MATRIX_WIDTH) + x;
}

void setup() {
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
}

void loop() {
  phase -= 4;
  uint8_t cx = beatsin8(17, 4, 11);
  uint8_t cy = beatsin8(23, 4, 11);

  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < MATRIX_WIDTH; x++) {
      int dx = (x - cx) * 16;
      int dy = (y - cy) * 16;
      uint8_t dist = sqrt(dx * dx + dy * dy);
      uint8_t wave = sin8(dist * 2 + phase);
      leds[XY(x, y)] = ColorFromPalette(LavaColors_p, wave, wave, LINEARBLEND);
    }
  }

  FastLED.show();
  FastLED.delay(20);
}`
  },
  {
    id: "pacifica_ocean",
    name: "Ocean Bioluminescence Waves (72 LEDs)",
    category: "1D Strip",
    description: "High-density 72-LED SK6812 strip blending OceanColors_p waves with inoise8 shimmer.",
    code: `#include <FastLED.h>

#define DATA_PIN    4
#define LED_TYPE    SK6812
#define COLOR_ORDER GRB
#define NUM_LEDS    72
#define BRIGHTNESS  200

CRGB leds[NUM_LEDS];
uint16_t sTime = 0;

void setup() {
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, 1800);
}

void loop() {
  sTime += 6;
  uint8_t waveSpeed = beatsin8(10, 4, 12);

  for (int i = 0; i < NUM_LEDS; i++) {
    uint8_t noiseVal = inoise8(i * 25, sTime);
    uint8_t waveVal = sin8(i * waveSpeed + (sTime >> 1));
    uint8_t palIdx = (noiseVal + waveVal) >> 1;
    leds[i] = ColorFromPalette(OceanColors_p, palIdx, 230, LINEARBLEND);
    if (waveVal > 242) {
      leds[i] += CRGB(60, 90, 110);
    }
  }

  FastLED.show();
  FastLED.delay(16);
}`
  },
  {
    id: "ring_spinner",
    name: "NeoPixel 24-LED Circular Ring",
    category: "Circular Ring",
    description: "24-LED circular NeoPixel ring with dual counter-rotating comets and rainbow phase offset.",
    code: `#include <FastLED.h>

#define RING_LEDS   24
#define NUM_LEDS    24
#define DATA_PIN    3
#define LED_TYPE    NEOPIXEL
#define BRIGHTNESS  210

CRGB leds[NUM_LEDS];
uint8_t stepIndex = 0;
uint8_t baseHue = 0;

void setup() {
  FastLED.addLeds<NEOPIXEL, DATA_PIN>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  Serial.println("24-LED NeoPixel Ring active on Pin 3");
}

void loop() {
  fadeToBlackBy(leds, NUM_LEDS, 42);

  uint8_t cw = stepIndex % NUM_LEDS;
  uint8_t ccw = (NUM_LEDS - 1) - (stepIndex % NUM_LEDS);

  leds[cw] += CHSV(baseHue, 255, 255);
  leds[ccw] += CHSV(baseHue + 96, 255, 255);

  EVERY_N_MILLISECONDS(35) {
    stepIndex++;
    baseHue += 3;
  }

  FastLED.show();
  FastLED.delay(16);
}`
  },
  {
    id: "rejected_blink",
    name: "Non-FastLED Sketch (Test Rejection)",
    category: "Rejection Test",
    description: "Standard Arduino Blink sketch using digitalWrite() without FastLED — tests automatic non-FastLED rejection.",
    code: `// Standard Arduino Blink Sketch (No FastLED library used)
// FastLedVis will automatically reject this sketch during verification.

const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
}`
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FASTLED_PRESETS };
}
