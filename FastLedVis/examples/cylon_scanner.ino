#include <FastLED.h>

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
}
