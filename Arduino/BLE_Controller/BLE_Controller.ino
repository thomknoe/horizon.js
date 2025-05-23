#include <ArduinoBLE.h>
#include <Adafruit_NeoPixel.h>

#define LED_PIN 6
#define NUM_PIXELS 112
#define SEGMENT_LENGTH 16
#define NUM_STRIPS 7
#define WIDTH 16
#define HEIGHT 7
#define MAX_PERIMETER 64

Adafruit_NeoPixel strip(NUM_PIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

BLEService lightService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLECharacteristic lightCharacteristic("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite, 50);

bool startAnimation = false;
bool loadingAnimation = false;
bool fadeOutGradient = false;
bool fadeInBreathing = false;

unsigned long animationStartTime = 0;
const int totalFadeDuration = 10000;

int perimeterPath[MAX_PERIMETER];
int perimeterLength = 0;

uint32_t bottomColor = 0;
uint32_t topColor = 0;
bool hasTopColor = false;
bool hasBottomColor = false;

float gradientOpacity = 1.0;
float breathingBrightness = 0.0;

void setup()
{
  Serial.begin(9600);

  if (!BLE.begin())
  {
    Serial.println("Starting BLE failed!");
    while (1)
      ;
  }

  BLE.setLocalName("Nano33BLE_Lights");
  BLE.setAdvertisedService(lightService);
  lightService.addCharacteristic(lightCharacteristic);
  BLE.addService(lightService);
  BLE.advertise();

  strip.begin();
  strip.clear();
  strip.show();

  Serial.println("BLE Lights Service Started");

  lightCharacteristic.setEventHandler(BLEWritten, onLightCommand);
  setupPerimeterPath();
}

void loop()
{
  BLE.poll();

  if (fadeOutGradient)
  {
    updateGradientFadeOut();
  }
  else if (startAnimation)
  {
    updateFadeAll();
  }

  if (fadeInBreathing || loadingAnimation)
  {
    updateBreathingAnimation();
  }
}

void clearPixels()
{
  for (int i = 0; i < NUM_PIXELS; i++)
  {
    strip.setPixelColor(i, 0);
  }
  strip.show();
}

void onLightCommand(BLEDevice central, BLECharacteristic characteristic)
{
  String command = "";
  for (int i = 0; i < lightCharacteristic.valueLength(); i++)
  {
    command += (char)lightCharacteristic.value()[i];
  }
  command.trim();
  Serial.print("Received command: ");
  Serial.println(command);

  loadingAnimation = false;
  fadeInBreathing = false;
  fadeOutGradient = false;
  startAnimation = false;
  breathingBrightness = 0;

  if (command == "LOADING")
  {
    if (startAnimation)
    {
      fadeOutGradient = true;
      startAnimation = false;
    }
    else
    {
      startBreathingFadeIn();
    }
    return;
  }

  if (command == "STOP")
  {
    strip.clear();
    strip.show();
    return;
  }

  if (command.startsWith("TOP:"))
  {
    parseGradientColor(command.substring(4), topColor);
    hasTopColor = true;
    return;
  }

  if (command.startsWith("BOT:"))
  {
    parseGradientColor(command.substring(4), bottomColor);
    hasBottomColor = true;
    if (hasTopColor)
    {
      startFadeAll();
    }
    return;
  }

  if (command.length() > 0)
  {
    hasTopColor = false;
    hasBottomColor = false;
    clearPixels();
    setGradientByChar(command.charAt(0));
    gradientOpacity = 0.0;
    startFadeAll();
  }
}

void startFadeAll()
{
  startAnimation = true;
  animationStartTime = millis();
}

void updateFadeAll()
{
  unsigned long currentTime = millis();
  float t = (float)(currentTime - animationStartTime) / totalFadeDuration;
  if (t > 1.0)
    t = 1.0;
  gradientOpacity = t;

  renderGradientWithOpacity(gradientOpacity);

  if (t >= 1.0)
  {
    startAnimation = false;
  }
}

void updateGradientFadeOut()
{
  gradientOpacity -= 0.005;
  if (gradientOpacity <= 0.0)
  {
    gradientOpacity = 0.0;
    fadeOutGradient = false;
    startBreathingFadeIn();
  }
  else
  {
    renderGradientWithOpacity(gradientOpacity);
  }
}

void renderGradientWithOpacity(float opacity)
{
  for (int row = 0; row < SEGMENT_LENGTH; row++)
  {
    float rowLerp = (float)row / (SEGMENT_LENGTH - 1);
    uint32_t targetColor = lerpColor(bottomColor, topColor, rowLerp);
    uint32_t faded = fadeColor(targetColor, opacity);

    for (int stripIndex = 0; stripIndex < NUM_STRIPS; stripIndex++)
    {
      int pixelIndex = (stripIndex % 2 == 0)
                           ? stripIndex * SEGMENT_LENGTH + row
                           : stripIndex * SEGMENT_LENGTH + (SEGMENT_LENGTH - 1 - row);

      if (pixelIndex < NUM_PIXELS)
      {
        strip.setPixelColor(pixelIndex, faded);
      }
    }
  }
  strip.show();
}

void startBreathingFadeIn()
{
  fadeInBreathing = true;
  breathingBrightness = 0.0;
}

void updateBreathingAnimation()
{
  if (fadeInBreathing && breathingBrightness < 1.0)
  {
    breathingBrightness += 0.005;
    if (breathingBrightness >= 1.0)
    {
      breathingBrightness = 1.0;
      fadeInBreathing = false;
      loadingAnimation = true;
    }
  }

  unsigned long now = millis();
  float period = 3000.0;
  float t = (now % (unsigned long)period) / period;
  float wave = 0.5 * (1.0 + sin(2 * PI * t));
  float scaled = wave * breathingBrightness;
  uint8_t brightness = (uint8_t)(scaled * 180);

  strip.clear();
  for (int i = 0; i < perimeterLength; i++)
  {
    strip.setPixelColor(perimeterPath[i], strip.Color(brightness, brightness, brightness));
  }
  strip.show();
}

void setupPerimeterPath()
{
  perimeterLength = 0;
  for (int x = 0; x < WIDTH; x++)
    perimeterPath[perimeterLength++] = getPixelIndex(0, x);
  for (int y = 1; y < HEIGHT - 1; y++)
    perimeterPath[perimeterLength++] = getPixelIndex(y, WIDTH - 1);
  for (int x = WIDTH - 1; x >= 0; x--)
    perimeterPath[perimeterLength++] = getPixelIndex(HEIGHT - 1, x);
  for (int y = HEIGHT - 2; y > 0; y--)
    perimeterPath[perimeterLength++] = getPixelIndex(y, 0);
}

int getPixelIndex(int row, int col)
{
  return (row % 2 == 0) ? (row * WIDTH + col) : (row * WIDTH + (WIDTH - 1 - col));
}

void setGradientByChar(char c)
{
  switch (c)
  {
  case 'D':
    bottomColor = strip.Color(80, 60, 40);
    topColor = strip.Color(40, 80, 100);
    break;
  case 'N':
    bottomColor = strip.Color(20, 0, 40);
    topColor = strip.Color(1, 0, 4);
    break;
  case 'S':
    bottomColor = strip.Color(140, 50, 50);
    topColor = strip.Color(180, 120, 90);
    break;
  case 'E':
    bottomColor = strip.Color(180, 120, 60);
    topColor = strip.Color(120, 60, 100);
    break;
  default:
    bottomColor = strip.Color(50, 50, 50);
    topColor = strip.Color(100, 100, 100);
    break;
  }
}

void parseGradientColor(String str, uint32_t &targetColor)
{
  int idx1 = str.indexOf(',');
  int idx2 = str.indexOf(',', idx1 + 1);
  if (idx1 == -1 || idx2 == -1)
    return;

  int r = constrain(str.substring(0, idx1).toInt(), 0, 180);
  int g = constrain(str.substring(idx1 + 1, idx2).toInt(), 0, 180);
  int b = constrain(str.substring(idx2 + 1).toInt(), 0, 180);

  targetColor = strip.Color(r, g, b);
}

uint32_t fadeColor(uint32_t color, float t)
{
  const float maxBrightness = 180.0;
  float r = ((color >> 16) & 0xFF) * t;
  float g = ((color >> 8) & 0xFF) * t;
  float b = (color & 0xFF) * t;

  float maxVal = max(max(r, g), b);
  if (maxVal > maxBrightness)
  {
    float scale = maxBrightness / maxVal;
    r *= scale;
    g *= scale;
    b *= scale;
  }

  return strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b);
}

uint32_t lerpColor(uint32_t c1, uint32_t c2, float t)
{
  const float maxBrightness = 180.0;
  float r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
  float r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;

  float r = r1 + (r2 - r1) * t;
  float g = g1 + (g2 - g1) * t;
  float b = b1 + (b2 - b1) * t;

  float maxVal = max(max(r, g), b);
  if (maxVal > maxBrightness)
  {
    float scale = maxBrightness / maxVal;
    r *= scale;
    g *= scale;
    b *= scale;
  }

  return strip.Color((uint8_t)r, (uint8_t)g, (uint8_t)b);
}