import os
import requests
from openai import OpenAI

from flask import Flask, request, jsonify
from flask_cors import CORS
from audio_loop_utils import remove_fades, make_loopable, export_as_wav

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "static"
CORS(app, supports_credentials=True)

ELEVENLABS_API_KEY = None # Replace with ElevenLabs API key
OPENAI_API_KEY = None # Replace with OPENAI API key

client = OpenAI(api_key=OPENAI_API_KEY)

def generate_sound_effect(prompt, duration=10):
    url = "https://api.elevenlabs.io/v1/sound-generation"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "text": prompt,
        "duration_seconds": duration,
        "output_format": "mp3_44100_128",
        "prompt_influence": 1.0
    }

    response = requests.post(url, headers=headers, json=data)
    if response.status_code != 200:
        raise Exception(f"ElevenLabs API failed: {response.status_code} {response.text}")

    mp3_path = os.path.join(app.config["UPLOAD_FOLDER"], "ambient_effect.mp3")
    with open(mp3_path, "wb") as f:
        f.write(response.content)

    return mp3_path

@app.route("/generate-sound-prompt", methods=["POST", "OPTIONS"])
def generate_sound_prompt():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    try:
        data = request.get_json()
        location = data.get("location", "a natural setting")
        time = data.get("time", "day")

        chat_prompt = f"""
        Write a short ambient sound description for an audio generator (max two sentences).
        The setting is {location} during {time}. Make sure to take into consideration the current weather and season too.
        Focus exclusively on atmospheric elements like weather, distant wildlife, wind, water, or subtle human presence like traffic or cars.
        Avoid mentioning music, instruments, conversations, or melodies entirely.
        The description should be short and straight forward.
        """

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert in designing ambient soundscapes for generative audio systems."},
                {"role": "user", "content": chat_prompt}
            ],
            max_tokens=80,
            temperature=0.9
        )

        text = response.choices[0].message.content.strip()
        res = jsonify({"status": "success", "prompt": text})
        res.headers.add("Access-Control-Allow-Origin", "*")
        return res

    except Exception as e:
        res = jsonify({"status": "error", "message": str(e)})
        res.headers.add("Access-Control-Allow-Origin", "*")
        return res, 500

@app.route("/generate", methods=["POST", "OPTIONS"])
def generate():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    try:
        data = request.get_json()
        prompt = data.get("prompt", "gentle wind in a forest with distant birds")
        duration = data.get("duration", 10)

        raw_path = generate_sound_effect(prompt, duration)
        no_fade_path = remove_fades(raw_path, os.path.join(app.config["UPLOAD_FOLDER"], "no_fade.mp3"))
        looped_path = make_loopable(no_fade_path, os.path.join(app.config["UPLOAD_FOLDER"], "ambient_loop.mp3"))
        wav_path = export_as_wav(looped_path, os.path.join(app.config["UPLOAD_FOLDER"], "ambient_loop.wav"))

        for f in [raw_path, no_fade_path, looped_path]:
            if os.path.exists(f):
                os.remove(f)

        response = jsonify({
            "status": "success",
            "file": "http://127.0.0.1:5000/static/ambient_loop.wav"
        })
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response

    except Exception as e:
        response = jsonify({
            "status": "error",
            "message": str(e)
        })
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500

@app.route("/generate-gradient", methods=["POST", "OPTIONS"])
def generate_gradient():
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        return response

    try:
        data = request.get_json()
        location = data.get("location")
        time = data.get("time")
        temperature = data.get("temperature")
        print(time)
        prompt = f"""
        Generate a pair of RGB colors to represent an abstract atmospheric background gradient.
        The setting is {location} during the {time}, with a temperature of {temperature}°C.
        The gradient should reflect the ambiance of that moment — you can be poetic or environmental in logic, but stay in the realm of color.
        Return a JSON object like: {{
          "topColor": [r, g, b],
          "bottomColor": [r, g, b]
        }}
        """

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You return only JSON gradients given contextual cues. No extra explanation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=100
        )

        import json
        gradient_data = json.loads(response.choices[0].message.content.strip())

        res = jsonify({"status": "success", **gradient_data})
        res.headers.add("Access-Control-Allow-Origin", "*")
        return res

    except Exception as e:
        res = jsonify({"status": "error", "message": str(e)})
        res.headers.add("Access-Control-Allow-Origin", "*")
        return res, 500
    
@app.route("/")
def index():
    return "Ambient Generator API is live!"

if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    app.run(debug=True, port=5000, host="127.0.0.1")
