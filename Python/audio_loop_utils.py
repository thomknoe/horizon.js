from pydub import AudioSegment

def remove_fades(input_path: str, output_path: str):
    """Load audio file and export without applying any fades."""
    audio = AudioSegment.from_file(input_path, format="mp3")

    audio.export(output_path, format="mp3")
    print(f"Saved fade-free version to {output_path}")
    return output_path

def make_loopable(input_path: str, output_path: str, crossfade_duration_ms=3000):
    audio = AudioSegment.from_file(input_path, format="mp3")

    trimmed = audio[500:-500]

    looped = trimmed.append(trimmed, crossfade=crossfade_duration_ms)

    looped.export(output_path, format="mp3")
    print(f"Saved smooth-loop version to {output_path}")
    return output_path

def export_as_wav(input_path: str, output_path: str):
    audio = AudioSegment.from_file(input_path, format="mp3")
    audio.export(output_path, format="wav")
    print(f"Exported {output_path} as WAV")
    return output_path

if __name__ == "__main__":
    fade_free = remove_fades("ambient_effect.mp3", "no_fade.mp3")
    loopable = make_loopable(fade_free, "ambient_loop.mp3", crossfade_duration_ms=2000)
    export_as_wav(loopable, "ambient_loop.wav")
