# Hanomi native build. `make win` cross-compiles hanomi.exe with mingw-w64; `make headless` builds the Linux QA backend.
CXXFLAGS_COMMON = -std=c++17 -O2 -Wall -Wno-unused -Wno-misleading-indentation -Wno-sign-compare -Wno-parentheses -ffast-math
SRC = src/main.cpp $(wildcard src/*.h)
win: build/hanomi.exe
build/hanomi.exe: $(SRC) res/hanomi.rc
	mkdir -p build
	x86_64-w64-mingw32-windres res/hanomi.rc -O coff -o build/hanomi_res.o
	x86_64-w64-mingw32-g++ -std=c++17 -O2 -s -mwindows -static -static-libgcc -static-libstdc++ -ffast-math -Wall -Wno-unused -Wno-misleading-indentation -Wno-sign-compare -Wno-parentheses src/main.cpp build/hanomi_res.o -o $@ -lwinmm -lgdi32 -luser32 -lshell32
headless: build/hanomi_headless
build/hanomi_headless: $(SRC)
	mkdir -p build
	g++ -std=c++17 -O2 -DHEADLESS -ffast-math -Wall -Wno-unused -Wno-misleading-indentation -Wno-sign-compare -Wno-parentheses src/main.cpp -o $@ -lpthread
clean:
	rm -rf build
.PHONY: win headless clean
