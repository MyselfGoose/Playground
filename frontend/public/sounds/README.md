# Sound assets (optional)

Playground plays **synthesized chimes** by default via the Web Audio API (`soundSynth.js`) — no files required.

To override an event with your own recording:

1. Add `success.mp3` (or `.ogg`) here.
2. Register it in `SOUND_FILE_URLS` inside `src/lib/sound/soundManager.js`.

Until registered, the built-in success chime is used automatically.
