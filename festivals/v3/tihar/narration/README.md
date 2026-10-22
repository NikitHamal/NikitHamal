# Tihar narration

- `script_ne_plain.txt`: all lines as plain paragraphs. Record them in **one continuous take** (the same way as the Dashain Kaanchi take) and push it as `tihar/narration/all.mp3`.
- `script_v3_expressive.txt`: the same lines with ElevenLabs v3 audio tags.

Import a continuous take:

    ELEVEN_KEY=... FILM_DIR=festivals/v3/tihar python festivals/v3/tools/split_take.py festivals/v3/tihar/narration/all.mp3

Forced alignment cuts each line in the pause before it and gives word-exact caption timings. Then re-run `tihar_build.sh`; the keyframes are reused, so only the composite and the score are redone.

The current first cut is ElevenLabs v3, premade voice George, speaking Nepali; every line was checked with Scribe. Credit "Voice: ElevenLabs".
