# Next: tiny specialist models (not LLMs)

Each idea is small (≤ 10 MB, most ≤ 2 MB) and trainable on one free GPU in hours. Each runs on-device in the browser or on Android (ONNX Runtime Web, TF Lite, or our own WASM kernel) and can reach state-of-the-art results within its narrow niche. Nepal-specific data is the moat.

| # | idea | model | data | why it can be SOTA / useful |
|---|---|---|---|---|
| 1 | **Learned Devanagari ↔ romanized transliterator** | char-level seq2seq transformer, ~1–2M params | `syubraj/roman2nepali` (2.4M pairs) | Replaces Nik's rule romanizer (60% exact match) with a learned one. It also powers a Nepali keyboard: type `"mero naam"`, get `"मेरो नाम"`. |
| 2 | **Devanagari handwriting OCR** | tiny ViT or ResNet-8, < 1 MB int8 | DHCD (92k images, 46 classes) + synthetic word renders | Character-level accuracy above 99% is achievable. Extend it to word and line OCR with a CTC head for handwritten forms, plus NEB answer-sheet digitization. |
| 3 | **"namaste nik" wake word + keyword spotting** | DS-CNN / BC-ResNet, < 100 KB | self-recorded clips + Common Voice Nepali | Always-on and private, around 1 ms per frame. Voice entry point for Nik and Lami. |
| 4 | **Tiny Nepali text-to-speech** | VITS-lite / Piper-style, 5–15 MB | OpenSLR Nepali TTS corpus | Nik could speak. No good offline Nepali TTS exists. |
| 5 | **Romanized-Nepali toxicity and spam classifier** | 1-D CNN or 2-layer transformer on Nik's tokenizer, < 1 MB | weak labels from user reports; 1–3k hand labels | On-device moderation for Lami Nepal and NEBians forums. Nothing exists for romanized Nepali. |
| 6 | **Spelling normalizer for romanized chat** | char-level denoising model | Nik's slang-noise generator in reverse (`xa → chha`, `tmro → timro`) | Makes search and analytics on user text work. It's also a cleaner front-end for Nik. |
| 7 | **Student knowledge tracing for NEBians** | SAKT/AKT attention model, < 2 MB | NEBians quiz logs (question, correct?, time) | Predicts which topic each student will fail next and recommends practice. This is how commercial adaptive-learning products work. |
| 8 | **Two-tower match recommender for Lami Nepal** | two small MLP towers + ANN index | profile features + chat/accept signals | Ranks profiles by likely mutual interest, not just filters. Retrieval runs in under 10 ms on-device. |
| 9 | **Crop and leaf disease detector** | MobileNetV3 / EfficientNet-lite, 3–5 MB int8 | PlantVillage + photos of Nepali rice, maize and tomato crops | Works offline in villages with no signal, with advice in Nepali. Big social impact. |
| 10 | **Kathmandu air-quality nowcasting** | small temporal CNN / LightGBM | open AQI sensor feeds + weather | 6–24 h PM2.5 forecasts per ward. A public dashboard on the site. |
| 11 | **Landslide and flood risk maps** | gradient boosting on DEM slope, rainfall and soil; U-Net-lite on Sentinel-2 | NASA / ICIMOD open data | Monsoon early warning for hill districts. Small models with good features beat big ones here. |
| 12 | **Tabular in-context learner (TabPFN-style) for small businesses** | ~5M transformer pretrained on synthetic tables | synthetic priors only | Upload a CSV and get instant predictions with no training. Runs in the browser. |
| 13 | **Liquid / tiny-RNN anomaly detector** | CfC (closed-form continuous) network, < 50 KB | phone sensors or server metrics | Detects falls and unusual activity on-device. It's also a fun showcase of continuous-time neural nets. |
| 14 | **Kundali feature → life-event model for AstroWeb** (research only) | interpretable GAM / EBM | anonymized, consented user feedback | Honest science: measure whether the predictions carry any signal. Publish the result either way. |

## Suggested order

1 → 6 → 2 → 5. They reuse Nik's data, tokenizer and WASM runtime, and each one improves Nik or your products directly.
