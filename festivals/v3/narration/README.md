# Narration: re-record with a better voice

The files:
- **`SCRIPT.md`**: every line, with its target length, what to read, the on-screen caption and a delivery note.
- **`NN.txt`**: one line per file, ready to paste into any TTS or to read aloud.
- **`script_ne.txt`**: all lines in one tab-separated file (`NN<TAB>text`), for batch TTS.
- **`script_ne_plain.txt`**: all lines as plain paragraphs, for one long take.

How to drop the new voice in:
1. Put the clips in `takes/` as `01.wav … 21.wav` (`.mp3`, `.m4a` and `.flac` also work). Lines 2 and 22 have no voice.
   - One long take works too: save it as `takes/all.wav` and the tool splits it on silences (one gap per line).
2. Push them to `agent-b/festivals-v3`.
3. `python festivals/v3/tools/import_vo.py` then does the rest:
   - trims silence;
   - converts the clips to `audio/vo/NN.mp3`;
   - measures each length and estimates word timings for the synced captions;
   - rebuilds `timeline.json`.

   Then the film is rebuilt (`cpu_build.sh` on molab). Shots stretch or shrink to fit your pacing.

Tips: one warm, steady male or female documentary voice. Keep about 0.3 s of silence at each end of a clip. Use 44.1 or 48 kHz.
