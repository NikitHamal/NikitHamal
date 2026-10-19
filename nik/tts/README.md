# NikTTS: Nik's voice

A tiny romanized-Nepali text-to-speech model, built from scratch and running entirely in the browser.

| | |
|---|---|
| input | casual romanized Nepali, exactly what Nik writes (numbers are read as Nepali words: `85 → pachasi`) |
| acoustic model | 3.1M params. Transformer encoder/decoder whose FFN is a depthwise conv plus pointwise linears. Alignment is learned without labels by **Monotonic Alignment Search** (Glow-TTS); there is a duration predictor and speaker embeddings |
| vocoder | 3.6M params, **Vocos-style**: a ConvNeXt backbone predicts STFT magnitude and phase, then an inverse FFT. GAN-trained with multi-period and multi-resolution discriminators |
| size | **8.2 MB** for all three ONNX graphs (int8 MatMuls, fp32 depthwise convs) |
| speed | about **11× real time** in the browser on a 2-vCPU VM (1.76 s of audio in 161 ms) |
| runtime | self-hosted onnxruntime-web (WASM). The inverse STFT is in `nik/web/tts.js` and matches `torch.istft` to 2e-8 |
| data | OpenSLR 43, Google's Nepali TTS corpus (CC BY-SA 4.0): 2,064 studio utterances, about 2.3 h. Transcripts go through Nik's own romanizer |

## Train

```bash
bash nik/scripts/kaggle_launch.sh tts          # Kaggle 2x T4: acoustic on GPU0 and vocoder on GPU1 in parallel
bash nik/scripts/kaggle_fetch.sh tts           # (or download out/tts/ and copy it to nik/web/tts/)
```

Locally:

```bash
python nik/tts/prepare.py --root data_tts/ne_np_female --out data_tts/set.pt --lexicon data/raw/lexicon.tsv
python nik/tts/train.py --stage acoustic --data data_tts/set.pt --out nik/runs/tts --minutes 240
python nik/tts/train.py --stage vocoder  --data data_tts/set.pt --out nik/runs/tts --minutes 240
python nik/tts/synth.py --run nik/runs/tts --text "namaste! ma nik ho." --out hello.wav
python nik/tts/export.py --run nik/runs/tts --out nik/web/tts
```

In `/chat`, every Nik reply has a **suna** (listen) button, and settings has an auto-speak option.

## Limits

About 2.3 h of data is small, so expect a clear, slightly "read-aloud" voice rather than an expressive one. The best next upgrades are a second-stage fine-tune of the vocoder on the acoustic model's predicted mels, and more data. Nik's own transcribed speech, with consent, would fit.
