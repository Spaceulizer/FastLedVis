#include <FastLED.h>

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
}
