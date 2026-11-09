# Hanomi native build. `make win` cross-compiles hanomi.exe with mingw-w64; `make headless` builds the Linux QA backend.
WARN = -Wall -Wno-unused -Wno-misleading-indentation -Wno-sign-compare -Wno-parentheses -Wno-narrowing -Wno-missing-field-initializers
SRC = src/main.cpp $(wildcard src/*.h) res/assets.bin res/PixelifySans.ttf
win: build/hanomi.exe
build/hanomi.exe: $(SRC) res/hanomi.rc
	mkdir -p build
	x86_64-w64-mingw32-windres res/hanomi.rc -O coff -o build/hanomi_res.o
	x86_64-w64-mingw32-g++-posix -std=gnu++17 -O2 -s -mwindows -static -static-libgcc -static-libstdc++ $(WARN) src/main.cpp build/hanomi_res.o -o $@ -lwinmm -lgdi32 -luser32 -lshell32
headless: build/hanomi_headless
build/hanomi_headless: $(SRC)
	mkdir -p build
	g++ -std=gnu++17 -O2 -DHEADLESS $(WARN) src/main.cpp -o $@ -lpthread
clean:
	rm -rf build
.PHONY: win headless clean
