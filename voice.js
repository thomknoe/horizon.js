window.addEventListener("DOMContentLoaded", () => {
  const voiceBtn = document.getElementById("voice-button");
  const input = document.getElementById("location-input");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.disabled = true;
    voiceBtn.textContent = "Voice not supported";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceBtn.addEventListener("click", () => {
    input.classList.add("speaking");
    input.value = "";
    recognition.start();
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    input.classList.remove("speaking");
    fetchLocation();
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    input.classList.remove("speaking");
  };

  recognition.onend = () => {
    input.classList.remove("speaking");
  };
});
