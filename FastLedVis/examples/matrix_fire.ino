#include <FastLED.h>

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
}
