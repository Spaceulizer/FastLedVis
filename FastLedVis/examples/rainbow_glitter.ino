#include <FastLED.h>

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
}
