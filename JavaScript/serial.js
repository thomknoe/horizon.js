let serial;
let port;
let reader;
let listening = false;
let recognition;
let bleDevice;
let bleServer;
let bleService;
let bleCharacteristic;

window.addEventListener("DOMContentLoaded", () => {
  const connectBleBtn = document.getElementById("connect-ble");
  connectBleBtn.addEventListener("click", async () => {
    try {
      bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["19b10000-e8f2-537e-4f6c-d104768a1214"] }],
      });

      bleServer = await bleDevice.gatt.connect();
      bleService = await bleServer.getPrimaryService(
        "19b10000-e8f2-537e-4f6c-d104768a1214"
      );
      bleCharacteristic = await bleService.getCharacteristic(
        "19b10001-e8f2-537e-4f6c-d104768a1214"
      );

      console.log("BLE Connected to Nano BLE!");
    } catch (err) {
      console.error("BLE Connection Error:", err);
    }
  });
});

async function reconnectBLEIfNeeded() {
  if (!bleDevice) {
    console.error("No BLE device available to reconnect.");
    return;
  }

  if (bleDevice.gatt.connected) {
    console.log("BLE already connected — no need to reconnect.");
    return;
  }

  try {
    console.log("BLE disconnected. Trying to reconnect...");
    bleServer = await bleDevice.gatt.connect();
    bleService = await bleServer.getPrimaryService(
      "19b10000-e8f2-537E-4f6c-d104768a1214"
    );
    bleCharacteristic = await bleService.getCharacteristic(
      "19b10001-e8f2-537E-4f6c-d104768a1214"
    );

    console.log("BLE reconnected successfully!");
  } catch (err) {
    console.error("Failed to reconnect to BLE device:", err);
  }
}

async function sendBLECommand(command) {
  if (!bleCharacteristic) {
    console.warn("BLE characteristic not available.");
    return;
  }

  if (!bleDevice.gatt.connected) {
    console.warn("BLE GATT disconnected. Trying to reconnect...");
    await reconnectBLEIfNeeded();
  }

  try {
    const encoder = new TextEncoder();
    await bleCharacteristic.writeValue(encoder.encode(command + "\n"));
    console.log(`Sent to BLE: ${command}`);
  } catch (err) {
    console.error("Error sending BLE command:", err);
  }
}

function capColor([r, g, b]) {
  return [Math.min(r, 120), Math.min(g, 120), Math.min(b, 120)];
}

async function sendGradientToNano(topRGB, botRGB) {
  if (!bleCharacteristic || !bleDevice.gatt.connected) {
    await reconnectBLEIfNeeded();
  }

  const encoder = new TextEncoder();

  // 🔒 Cap RGB values
  const top = capColor(topRGB);
  const bot = capColor(botRGB);

  const topCmd = `TOP:${top[0]},${top[1]},${top[2]}`;
  const botCmd = `BOT:${bot[0]},${bot[1]},${bot[2]}`;

  try {
    await bleCharacteristic.writeValue(encoder.encode(topCmd + "\\n"));
    console.log(`Sent to BLE: ${topCmd}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await bleCharacteristic.writeValue(encoder.encode(botCmd + "\\n"));
    console.log(`Sent to BLE: ${botCmd}`);
  } catch (err) {
    console.error("Error sending gradient to BLE:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect-arduino");
  connectBtn.addEventListener("click", async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      listenToSerial();
    } catch (err) {
      console.error("Serial connection error:", err);
    }
  });
});

async function listenToSerial() {
  const decoder = new TextDecoderStream();
  const inputDone = port.readable.pipeTo(decoder.writable);
  const inputStream = decoder.readable;
  reader = inputStream.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) handleSerialInput(value.trim());
  }

  reader.releaseLock();
}

function handleSerialInput(message) {
  const input = document.getElementById("location-input");

  if ((message === "L" || message === "1") && !listening) {
    listening = true;
    input.classList.add("speaking");
    input.value = "";
    startVoiceRecognition();
  }

  if ((message === "N" || message === "0") && listening) {
    listening = false;
    stopVoiceRecognition();
    input.classList.remove("speaking");
  }
}

function startVoiceRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Your browser does not support voice recognition.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const input = document.getElementById("location-input");
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    fetchLocation();
  };

  recognition.onerror = (event) => {
    console.error("Speech error:", event.error);
  };

  recognition.start();
}

function stopVoiceRecognition() {
  if (recognition) recognition.stop();
}
