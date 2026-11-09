# Hanomi native (C++17, Win32)
Single ~1.6 MB exe: software renderer, embedded sprite atlas exported from the original web art code, embedded Pixelify Sans, waveOut synth, XInput. See ../STATUS.md for architecture and parity notes.
Build: `make win` (needs `g++-mingw-w64-x86-64-posix`) or `make headless` for the Linux QA runner (`./build/hanomi_headless qa/v2.txt outdir [w h]`).
Controls: WASD move, Shift sprint, Space roll, LMB/J use, RMB/E interact, 1-8/wheel hotbar, Tab satchel, M map, N realm, J journal, F11 fullscreen, F2 screenshot.
