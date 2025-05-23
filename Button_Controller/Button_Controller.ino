#include <LiquidCrystal.h>

LiquidCrystal lcd(14, 10, 5, 4, 3, 2);

String locationName = "Where would you";
String currentTime = "like to go?";

unsigned long lastScrollTime = 0;
const unsigned long scrollInterval = 400;
int scrollPos = 0;

const int buttonPin = 16;
static int lastButtonState = HIGH;

void setup()
{
  Serial.begin(9600);

  lcd.begin(16, 2);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(locationName);
  lcd.setCursor(0, 1);
  lcd.print(currentTime);

  pinMode(buttonPin, INPUT_PULLUP);
}

void loop()
{
  handleButtonInput();
  handleSerialInput();
  updateDisplay();
}

void handleButtonInput()
{
  int currentButtonState = digitalRead(buttonPin);

  if (currentButtonState != lastButtonState)
  {
    lastButtonState = currentButtonState;

    if (currentButtonState == LOW)
    {
      Serial.println("0");
    }
    else
    {
      Serial.println("1");
    }

    delay(50);
  }
}

void handleSerialInput()
{
  while (Serial.available() > 0)
  {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.startsWith("NAME:"))
    {
      locationName = input.substring(5);
      scrollPos = 0;
    }
    else if (input.startsWith("TIME:"))
    {
      currentTime = input.substring(5);
    }
  }
}

void updateDisplay()
{
  if (millis() - lastScrollTime >= scrollInterval)
  {
    lastScrollTime = millis();
    lcd.clear();

    if (locationName.length() <= 16)
    {
      lcd.setCursor(0, 0);
      lcd.print(locationName);
    }
    else
    {
      String scrollText = locationName + "   ";
      int scrollLength = scrollText.length();

      String displayPart;
      if (scrollPos + 16 <= scrollLength)
      {
        displayPart = scrollText.substring(scrollPos, scrollPos + 16);
      }
      else
      {
        int firstPartLen = scrollLength - scrollPos;
        displayPart = scrollText.substring(scrollPos) + scrollText.substring(0, 16 - firstPartLen);
      }

      lcd.setCursor(0, 0);
      lcd.print(displayPart);

      scrollPos++;
      if (scrollPos >= scrollLength)
      {
        scrollPos = 0;
      }
    }

    lcd.setCursor(0, 1);
    lcd.print(currentTime);
  }
}
