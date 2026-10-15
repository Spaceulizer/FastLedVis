#include <FastLED.h>

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
}
