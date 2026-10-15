// Standard Arduino Blink Sketch (No FastLED library used)
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
}
