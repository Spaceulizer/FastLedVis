#include <FastLED.h>

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
}
