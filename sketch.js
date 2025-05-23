let locationName = "";
let currentUTC = "";
let currentShortTime = "";
let timeClassification = "";
let bgColor;
let nextTopColor, nextBottomColor;

let sunriseTime, sunsetTime;
let gradientGraphic;

let currentTopColor, currentBottomColor;
let currentTemperature = null;
let transitionProgress = 1.0;
let transitioning = false;

let ambientReady = false;
let currentAmbientSound = null;

let transitionOpacity = 0;
let targetOpacity = 255;

let fadingOut = false;
let loading = false;
let pendingLocationInput = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Inter");
  bgColor = color(0);
  let size = min(width, height) * 0.65;
  gradientGraphic = createGraphics(size, size);
  currentTopColor = color(100);
  currentBottomColor = color(30);
}

function draw() {
  background(bgColor);
  if (transitionOpacity !== targetOpacity) {
    let fadeSpeed = targetOpacity > transitionOpacity ? 2.0 : -6.0;
    transitionOpacity = constrain(transitionOpacity + fadeSpeed, 0, 255);
  }

  if (fadingOut && transitionOpacity === 0) {
    fadingOut = false;
    if (pendingLocationInput) {
      startLocationQuery(pendingLocationInput);
      pendingLocationInput = null;
    }
    loading = true;
  }

  if (loading) {
    drawLoadingSpinner();
  } else if (
    sunriseTime &&
    sunsetTime &&
    ambientReady &&
    transitionOpacity > 0
  ) {
    drawVerticalGradient();
  }

  if (transitioning) {
    transitionProgress += 0.01;
    if (transitionProgress >= 1.0) {
      transitionProgress = 1.0;
      transitioning = false;
    }
  }
}

function drawGlowCircle(cx, cy, baseRadius, glowColor, alphaScale = 1.0) {
  noStroke();
  for (let i = 1; i <= 10; i++) {
    let alpha = map(i, 1, 10, 25, 0) * (transitionOpacity / 255) * alphaScale;
    fill(red(glowColor), green(glowColor), blue(glowColor), alpha);
    ellipse(cx, cy, (baseRadius + i * 6) * 2, (baseRadius + i * 6) * 2);
  }
}

function drawVerticalGradient() {
  background(0);
  let size = min(width, height) * 0.75;
  let cx = width / 2;
  let cy = height / 2;
  let topColor = currentTopColor;
  let bottomColor = currentBottomColor;
  let glowColor = lerpColor(topColor, bottomColor, 0.5);
  let glowAlphaBoost = timeClassification === "Night" ? 1.75 : 1.0;

  drawGlowCircle(cx, cy, size / 2, glowColor, glowAlphaBoost);

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.arc(cx, cy, size / 2, 0, TWO_PI);
  drawingContext.clip();

  for (let y = cy - size / 2; y <= cy + size / 2; y++) {
    let inter = map(y, cy - size / 2, cy + size / 2, 0, 1);
    let c = lerpColor(topColor, bottomColor, inter);
    stroke(red(c), green(c), blue(c), transitionOpacity);
    line(cx - size / 2, y, cx + size / 2, y);
  }

  drawingContext.restore();
  pop();
}

function drawLoadingSpinner() {
  let size = min(width, height) * 0.75;
  let cx = width / 2;
  let cy = height / 2;
  let spinnerSize = size * 0.95;
  let angle = millis() / 500;

  push();
  drawingContext.save();
  drawingContext.shadowBlur = 40;
  drawingContext.shadowColor = color(255, 255, 255, 200);
  stroke(255);
  strokeWeight(8);
  noFill();
  translate(cx, cy);
  rotate(angle);
  arc(0, 0, spinnerSize, spinnerSize, 0, PI / 2);
  drawingContext.restore();
  pop();

  push();
  noFill();
  stroke(255, 50);
  strokeWeight(2);
  ellipse(cx, cy, spinnerSize, spinnerSize);
  pop();
}

function fetchLocation() {
  const input = document.getElementById("location-input").value;
  pendingLocationInput = input;
  if (ambientReady && transitionOpacity > 0) {
    fadingOut = true;
    targetOpacity = 0;
  } else {
    loading = true;
    startLocationQuery(input);
  }

  if (currentAmbientSound?.isPlaying()) {
    currentAmbientSound.setVolume(0, 1.0);
    setTimeout(() => {
      currentAmbientSound.stop();
      currentAmbientSound.disconnect();
      currentAmbientSound = null;
    }, 1000);
  }
}

function startLocationQuery(input) {
  const apiKey = null; // Replace with OpenCage API key
  fetch(`https://api.opencagedata.com/geocode/v1/json?q=${input}&key=${apiKey}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.results.length === 0) return;
      const loc = data.results[0];
      const lat = loc.geometry.lat;
      const lng = loc.geometry.lng;
      locationName = loc.formatted;
      fetchSunData(lat, lng);
      generateAmbientFromPrompt(locationName);
    });
}

function fetchSunData(lat, lng) {
  fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`)
    .then((res) => res.json())
    .then((data) => {
      const nowUTC = new Date();
      currentUTC = nowUTC.toUTCString();
      const hours = nowUTC.getUTCHours().toString().padStart(2, "0");
      const minutes = nowUTC.getUTCMinutes().toString().padStart(2, "0");
      const seconds = nowUTC.getUTCSeconds().toString().padStart(2, "0");
      currentShortTime = `${hours}:${minutes}:${seconds} UTC`;

      sunriseTime = new Date(data.results.sunrise);
      sunsetTime = new Date(data.results.sunset);

      let newClassification = "Night";
      const twoHours = 60 * 60 * 1000;
      const sunriseDiff = Math.abs(nowUTC - sunriseTime);
      const sunsetDiff = Math.abs(nowUTC - sunsetTime);

      if (sunriseDiff <= twoHours) newClassification = "Sunrise";
      else if (sunsetDiff <= twoHours) newClassification = "Sunset";
      else if (nowUTC >= sunriseTime && nowUTC <= sunsetTime)
        newClassification = "Day";

      if (newClassification !== timeClassification) {
        timeClassification = newClassification;
      }

      updateInfo();
    });
}

function startGradientTransition() {
  requestGradientForLocation(
    locationName,
    timeClassification,
    currentTemperature
  );
}

function requestGradientForLocation(location, time, temp) {
  return fetch("http://127.0.0.1:5000/generate-gradient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location,
      time,
      temperature: temp,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        nextTopColor = color(...data.topColor);
        nextBottomColor = color(...data.bottomColor);

        transitionOpacity = 0;
        setTimeout(() => {
          currentTopColor = nextTopColor;
          currentBottomColor = nextBottomColor;
          targetOpacity = 255;

          sendGradientToNano(data.topColor, data.bottomColor);

          if (
            ["day", "night", "sunrise", "sunset"].includes(
              timeClassification.toLowerCase()
            )
          ) {
            playToneByTimeType(timeClassification.toLowerCase());
          }
        }, 50);
      } else {
        console.warn("Gradient generation failed, using fallback.");
      }
    })
    .catch((err) => {
      console.error("Gradient fetch error:", err);
    });
}

function fetchTemperature(lat, lng) {
  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
  )
    .then((res) => res.json())
    .then((data) => {
      if (data.current_weather) {
        currentTemperature = data.current_weather.temperature;
      }
    })
    .catch((err) => console.error("Weather fetch error:", err));
}

async function generateAmbientFromPrompt(locationName) {
  try {
    await sendBLECommand("LOADING");

    const promptRes = await fetch(
      "http://127.0.0.1:5000/generate-sound-prompt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: locationName,
          time: timeClassification,
        }),
      }
    );

    const promptData = await promptRes.json();
    if (promptData.status !== "success") throw new Error(promptData.message);
    const richPrompt = promptData.prompt;

    const audioRes = await fetch("http://127.0.0.1:5000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: richPrompt, duration: 8 }),
    });

    const audioData = await audioRes.json();
    if (audioData.status !== "success") throw new Error(audioData.message);

    loadSound(audioData.file, async (loadedSound) => {
      currentAmbientSound?.stop();
      currentAmbientSound?.disconnect();

      currentAmbientSound = loadedSound;
      currentAmbientSound.setLoop(true);
      currentAmbientSound.setVolume(0);

      await reconnectBLEIfNeeded();
      await sendBLECommand("STOP");

      setTimeout(() => {
        currentAmbientSound.play();
        currentAmbientSound.setVolume(1.0, 50.0);
      }, 4000);

      transitionOpacity = 0;
      ambientReady = true;
      loading = false;
      targetOpacity = 255;

      startGradientTransition();
      document.getElementById("location-info").classList.add("visible");
    });
  } catch (err) {
    console.error("Ambient generation error:", err);
    await sendBLECommand("STOP");
  }
}

async function sendToArduino(name, timeString) {
  if (!port) return;
  const writer = port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(`NAME:${name}\n`));
    await writer.write(
      new TextEncoder().encode(`TIME:${timeClassification}\n`)
    );
  } finally {
    writer.releaseLock();
  }
}

function updateInfo() {
  sendToArduino(locationName, currentShortTime);
  const info = document.getElementById("location-info");
  info.innerHTML = `
    <strong>${locationName}</strong><br/>
    UTC Time: ${currentUTC}<br/>
    Time of Day: ${timeClassification}
  `;
}
