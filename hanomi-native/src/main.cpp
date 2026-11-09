// Hanomi native — entry point, app loop, Win32 platform (GDI + waveOut + XInput) and a headless QA backend.
#include "ui.h"
#include <chrono>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <mmsystem.h>
#undef IN
#undef OUT
#undef near
#undef far
#endif

static Game* G = nullptr; static bool gQuit = false; static bool gShotReq = false; static std::string gShotPath;
static int gWinW = 1280, gWinH = 720; static float gAcc = 0, gFpsT = 0; static int gFrames = 0;

static void drawCursor() {
  if (!IN.mouseOn || !G) return; int x = (int)IN.mx, y = (int)IN.my; bool game = G->modal == M_NONE;
  if (game && !G->player->dead) { u32 c = 0xFFffffff, d = 0xFF1c1424; for (int i = 2; i <= 4; i++) { putpx(x - i, y, d); putpx(x + i, y, d); putpx(x, y - i, d); putpx(x, y + i, d); } for (int i = 3; i <= 4; i++) { putpx(x - i, y, c); putpx(x + i, y, c); putpx(x, y - i, c); putpx(x, y + i, c); } putpx(x, y, 0xFFf6b8ca); return; }
  static const char* P[] = {"X.......", "XX......", "XWX.....", "XWWX....", "XWWWX...", "XWWWWX..", "XWWXXXX.", "XXWWX...", "..XWWX..", "..XXWX..", "....XX.."}; for (int j = 0; j < 11; j++) for (int i = 0; i < 8; i++) { char ch = P[j][i]; if (ch == 'X') putpx(x + i, y + j, 0xFF1c1424); else if (ch == 'W') putpx(x + i, y + j, 0xFFffe8f0); }
}
static void appInit(const std::string& saveDir) {
  initItems(); Audio::build(); ART.init(); G = new Game(); G->saveDir = saveDir; G->world.init(1); FILE* f = fopen(G->savePath().c_str(), "rb"); if (f) { G->hasSave = true; fclose(f); } G->modal = M_TITLE; Audio::setVolumes(SET.music, SET.sfx); Audio::setMood(0);
  G->viewW = 480; G->viewH = 270;
}
// Compute logical size for a window; returns the integer scale.
static int computeView(int w, int h, int& vw, int& vh) { int sc = std::max(1, (int)std::round(std::sqrt((double)w * h / 129600.0)) + SET.zoom); sc = std::max(1, sc); while (sc > 1 && (w / sc < 320 || h / sc < 180)) sc--; vw = std::max(160, w / sc); vh = std::max(90, h / sc); return sc; }
static void handleKeys() {
  Game& g = *G; int m = g.modal;
  if (IN.p(K_F2)) { gShotReq = true; }
  if (IN.p(K_ESC)) { if (m == M_NONE) g.modal = M_PAUSE; else if (m == M_INV || m == M_CHEST) UI::closeInv(g); else if (m == M_PAUSE || m == M_MAP || m == M_REALM || m == M_GOALS || m == M_TRADE || m == M_DIALOG) g.modal = M_NONE; else if (m == M_SETTINGS || m == M_HELP) g.modal = UI::fromTitle ? M_TITLE : M_PAUSE; }
  if (m == M_TITLE || m == M_DEAD) return;
  if (IN.p(K_TAB)) { if (m == M_INV) UI::closeInv(g); else if (m == M_NONE) { g.modal = M_INV; Audio::play(S_CLICK, 0.5f); } }
  if (IN.p('M')) { if (m == M_MAP) g.modal = M_NONE; else if (m == M_NONE) g.modal = M_MAP; }
  if (IN.p('N')) { if (m == M_REALM) g.modal = M_NONE; else if (m == M_NONE) g.modal = M_REALM; }
  if (IN.p('G')) { if (m == M_GOALS) g.modal = M_NONE; else if (m == M_NONE) g.modal = M_GOALS; }
}
static bool gFullReq = false;
// One frame. Returns the logical screen Img to present.
static Img* appFrame(float dt, int winW, int winH, int& scaleOut) {
  Game& g = *G; int vw, vh; int sc = computeView(winW, winH, vw, vh); scaleOut = sc; g.viewW = vw; g.viewH = vh; g.zoomScale = sc; if (REN.screen.w != vw || REN.screen.h != vh) REN.screen.alloc(vw, vh);
  gFpsT += dt; gFrames++; if (gFpsT >= 0.5f) { g.fps = gFrames / gFpsT; gFpsT = 0; gFrames = 0; }
  handleKeys(); if (UI::fullscreenToggleReq) { UI::fullscreenToggleReq = false; gFullReq = true; } if (IN.p(K_F11)) gFullReq = true;
  if (g.modal == M_TITLE || ((g.modal == M_SETTINGS || g.modal == M_HELP) && UI::fromTitle)) { UI::drawTitle(g, dt); T = &REN.screen; if (g.modal == M_SETTINGS) UI::drawSettings(g); else if (g.modal == M_HELP) UI::drawHelp(g); }
  else {
    gAcc += std::min(dt, 0.1f); int steps = 0; while (gAcc >= 1.f / 60.f && steps < 5) { g.update(1.f / 60.f); gAcc -= 1.f / 60.f; steps++; IN.hit[0] = IN.hit[0]; if (steps == 1) {} }
    REN.drawWorld(g); T = &REN.screen; UI::drawHUD(g);
    switch (g.modal) { case M_INV: UI::drawInventory(g); break; case M_MAP: UI::drawMap(g); break; case M_REALM: UI::drawRealm(g); break; case M_GOALS: UI::drawGoals(g); break; case M_TRADE: UI::drawTrade(g); break; case M_CHEST: UI::drawChest(g); break; case M_DIALOG: UI::drawDialog(g); break; case M_PAUSE: frect(0, 0, vw, vh, 0x60100818); UI::drawPause(g); break; case M_SETTINGS: frect(0, 0, vw, vh, 0x80100818); UI::drawSettings(g); break; case M_HELP: frect(0, 0, vw, vh, 0x80100818); UI::drawHelp(g); break; case M_DEAD: UI::drawDead(g); break; default: break; }
  }
  if (g.modal == M_SETTINGS && G->player == nullptr) {}
  if (g.modal == M_SETTINGS || g.modal == M_HELP) { /* overlay drawn over title as well */ if (g.world.chunks.empty()) {} }
  T = &REN.screen; drawCursor(); if (UI::quitReq) gQuit = true; IN.endFrame(); return &REN.screen;
}
static void writePPM(const Img& im, const std::string& path) { FILE* f = fopen(path.c_str(), "wb"); if (!f) return; fprintf(f, "P6\n%d %d\n255\n", im.w, im.h); std::vector<u8> row(im.w * 3); for (int y = 0; y < im.h; y++) { for (int x = 0; x < im.w; x++) { u32 c = im.p[(size_t)y * im.w + x]; row[x * 3] = cr(c); row[x * 3 + 1] = cg(c); row[x * 3 + 2] = cb(c); } fwrite(row.data(), 1, row.size(), f); } fclose(f); }
static void writeBMP(const Img& im, const std::string& path) { FILE* f = fopen(path.c_str(), "wb"); if (!f) return; int rowB = im.w * 3, pad = (4 - rowB % 4) % 4, size = 54 + (rowB + pad) * im.h; u8 h[54] = {'B', 'M'}; auto w32 = [&](int o, u32 v) { memcpy(h + o, &v, 4); }; w32(2, size); w32(10, 54); w32(14, 40); w32(18, im.w); w32(22, im.h); h[26] = 1; h[28] = 24; w32(34, (rowB + pad) * im.h); fwrite(h, 1, 54, f); std::vector<u8> row(rowB + pad, 0); for (int y = im.h - 1; y >= 0; y--) { for (int x = 0; x < im.w; x++) { u32 c = im.p[(size_t)y * im.w + x]; row[x * 3] = cb(c); row[x * 3 + 1] = cg(c); row[x * 3 + 2] = cr(c); } fwrite(row.data(), 1, row.size(), f); } fclose(f); }

#ifdef _WIN32
/* ================================ Win32 backend ================================ */
static HWND hwnd; static BITMAPINFO bmi; static std::vector<u32> blitBuf; static int gScale = 4, gOffX = 0, gOffY = 0; static bool gFull = false; static RECT gSavedRect; static LONG gSavedStyle;
static HWAVEOUT hwo; static WAVEHDR whdr[4]; static int16_t* abuf[4]; static HANDLE aEvt; static bool aRun = true; static HANDLE aThread;
static DWORD WINAPI audioThread(LPVOID) { while (aRun) { WaitForSingleObject(aEvt, 50); for (int i = 0; i < 4; i++) if (whdr[i].dwFlags & WHDR_DONE) { Audio::mix(abuf[i], 1024); waveOutWrite(hwo, &whdr[i], sizeof(WAVEHDR)); whdr[i].dwFlags &= ~WHDR_DONE; whdr[i].dwFlags |= WHDR_PREPARED; } } return 0; }
static void audioStart() { WAVEFORMATEX wf = {}; wf.wFormatTag = WAVE_FORMAT_PCM; wf.nChannels = 2; wf.nSamplesPerSec = 44100; wf.wBitsPerSample = 16; wf.nBlockAlign = 4; wf.nAvgBytesPerSec = 44100 * 4; aEvt = CreateEvent(nullptr, FALSE, FALSE, nullptr); if (waveOutOpen(&hwo, WAVE_MAPPER, &wf, (DWORD_PTR)aEvt, 0, CALLBACK_EVENT) != MMSYSERR_NOERROR) { hwo = nullptr; return; }
  for (int i = 0; i < 4; i++) { abuf[i] = (int16_t*)calloc(1024 * 2, 2); whdr[i] = {}; whdr[i].lpData = (LPSTR)abuf[i]; whdr[i].dwBufferLength = 1024 * 4; waveOutPrepareHeader(hwo, &whdr[i], sizeof(WAVEHDR)); Audio::mix(abuf[i], 1024); waveOutWrite(hwo, &whdr[i], sizeof(WAVEHDR)); } aThread = CreateThread(nullptr, 0, audioThread, nullptr, 0, nullptr); SetThreadPriority(aThread, THREAD_PRIORITY_ABOVE_NORMAL); }
static void toggleFullscreen() { if (!gFull) { gSavedStyle = GetWindowLong(hwnd, GWL_STYLE); GetWindowRect(hwnd, &gSavedRect); MONITORINFO mi = {sizeof mi}; GetMonitorInfo(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &mi); SetWindowLong(hwnd, GWL_STYLE, WS_POPUP | WS_VISIBLE); SetWindowPos(hwnd, HWND_TOP, mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.right - mi.rcMonitor.left, mi.rcMonitor.bottom - mi.rcMonitor.top, SWP_FRAMECHANGED); gFull = true; } else { SetWindowLong(hwnd, GWL_STYLE, gSavedStyle); SetWindowPos(hwnd, nullptr, gSavedRect.left, gSavedRect.top, gSavedRect.right - gSavedRect.left, gSavedRect.bottom - gSavedRect.top, SWP_FRAMECHANGED | SWP_NOZORDER); gFull = false; } }
static int mapKey(WPARAM vk) { if (vk == VK_SHIFT || vk == VK_LSHIFT || vk == VK_RSHIFT) return K_SHIFT; if (vk > 255) return 0; return (int)vk; }
static LRESULT CALLBACK wndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
  switch (m) {
    case WM_CLOSE: if (G && G->modal != M_TITLE && G->player) G->saveGame(true); gQuit = true; return 0; case WM_DESTROY: PostQuitMessage(0); return 0;
    case WM_SIZE: gWinW = LOWORD(l); gWinH = HIWORD(l); return 0; case WM_ERASEBKGND: return 1;
    case WM_SETCURSOR: if (LOWORD(l) == HTCLIENT) { SetCursor(nullptr); return TRUE; } break;
    case WM_KEYDOWN: case WM_SYSKEYDOWN: { int k = mapKey(w); if (k == VK_F4 && (GetKeyState(VK_MENU) & 0x8000)) { gQuit = true; return 0; } if (!(l & (1 << 30))) IN.hit[k & 255] = true; IN.down[k & 255] = true; if (k == VK_TAB || k == VK_SPACE || (k >= 37 && k <= 40) || k == VK_MENU) return 0; break; }
    case WM_KEYUP: case WM_SYSKEYUP: IN.down[mapKey(w) & 255] = false; break; case WM_KILLFOCUS: memset(IN.down, 0, sizeof IN.down); IN.mdown[0] = IN.mdown[1] = IN.mdown[2] = false; break;
    case WM_MOUSEMOVE: { IN.mx = (float)((short)LOWORD(l) - gOffX) / gScale; IN.my = (float)((short)HIWORD(l) - gOffY) / gScale; IN.mouseOn = true; TRACKMOUSEEVENT t = {sizeof t, TME_LEAVE, h, 0}; TrackMouseEvent(&t); break; } case WM_MOUSELEAVE: IN.mouseOn = false; break;
    case WM_LBUTTONDOWN: IN.mdown[0] = IN.mhit[0] = true; SetCapture(h); break; case WM_LBUTTONUP: IN.mdown[0] = false; ReleaseCapture(); break;
    case WM_RBUTTONDOWN: IN.mdown[2] = IN.mhit[2] = true; break; case WM_RBUTTONUP: IN.mdown[2] = false; break; case WM_MBUTTONDOWN: IN.mdown[1] = IN.mhit[1] = true; break; case WM_MBUTTONUP: IN.mdown[1] = false; break;
    case WM_MOUSEWHEEL: IN.wheel += (short)HIWORD(w) > 0 ? -1 : 1; break;
  }
  return DefWindowProc(h, m, w, l);
}
typedef struct { WORD wButtons; BYTE bLT, bRT; SHORT lx, ly, rx, ry; } XPAD; typedef struct { DWORD pk; XPAD g; } XSTATE; typedef DWORD(WINAPI* XGetState)(DWORD, XSTATE*); static XGetState xGet = nullptr; static bool padPrevA = false, padPrevB = false, padPrevX = false;
static void pollPad() { if (!xGet) return; XSTATE s = {}; if (xGet(0, &s) != 0) return; float lx = s.g.lx / 32767.f, ly = -s.g.ly / 32767.f; if (std::fabs(lx) < 0.22f) lx = 0; if (std::fabs(ly) < 0.22f) ly = 0; IN.padX = lx; IN.padY = ly; bool a = s.g.wButtons & 0x1000, b = s.g.wButtons & 0x2000, x = s.g.wButtons & 0x4000; if (a && !padPrevA) IN.padUse = true; if (x && !padPrevX) IN.padAlt = true; if (b && !padPrevB) IN.padRoll = true; padPrevA = a; padPrevB = b; padPrevX = x; if (s.g.wButtons & 0x0010) IN.hit[K_ESC] = true; if (s.g.wButtons & 0x0020) IN.hit[K_TAB] = true; if ((s.g.wButtons & 0x0100) || s.g.bLT > 100) { } }
int WINAPI WinMain(HINSTANCE hi, HINSTANCE, LPSTR, int) {
  timeBeginPeriod(1); std::string dir; { const char* ap = getenv("APPDATA"); dir = ap ? std::string(ap) + "\\Hanomi" : "."; CreateDirectoryA(dir.c_str(), nullptr); } appInit(dir);
  HMODULE xi = LoadLibraryA("xinput1_4.dll"); if (!xi) xi = LoadLibraryA("xinput9_1_0.dll"); if (xi) xGet = (XGetState)GetProcAddress(xi, "XInputGetState");
  WNDCLASSA wc = {}; wc.lpfnWndProc = wndProc; wc.hInstance = hi; wc.lpszClassName = "HanomiWnd"; wc.hCursor = nullptr; wc.hbrBackground = nullptr; wc.hIcon = LoadIconA(hi, MAKEINTRESOURCEA(1)); RegisterClassA(&wc);
  RECT r = {0, 0, 1280, 720}; AdjustWindowRect(&r, WS_OVERLAPPEDWINDOW, FALSE); hwnd = CreateWindowExA(0, "HanomiWnd", "Hanomi", WS_OVERLAPPEDWINDOW | WS_VISIBLE, CW_USEDEFAULT, CW_USEDEFAULT, r.right - r.left, r.bottom - r.top, nullptr, nullptr, hi, nullptr);
  RECT cr2; GetClientRect(hwnd, &cr2); gWinW = cr2.right; gWinH = cr2.bottom; audioStart(); HDC dc = GetDC(hwnd); LARGE_INTEGER fq, t0; QueryPerformanceFrequency(&fq); QueryPerformanceCounter(&t0); double last = 0; int shotN = 0;
  while (!gQuit) {
    MSG msg; while (PeekMessage(&msg, nullptr, 0, 0, PM_REMOVE)) { if (msg.message == WM_QUIT) gQuit = true; TranslateMessage(&msg); DispatchMessage(&msg); } if (gQuit) break;
    LARGE_INTEGER t1; QueryPerformanceCounter(&t1); double now = (double)(t1.QuadPart - t0.QuadPart) / fq.QuadPart; float dt = (float)(now - last); last = now; if (dt > 0.25f) dt = 0.25f; pollPad();
    int sc; Img* im = appFrame(dt, std::max(gWinW, 160), std::max(gWinH, 90), sc); gScale = sc; gOffX = (gWinW - im->w * sc) / 2; gOffY = (gWinH - im->h * sc) / 2;
    if (gFullReq) { gFullReq = false; toggleFullscreen(); } if (gShotReq) { gShotReq = false; CreateDirectoryA("screenshots", nullptr); char b[64]; snprintf(b, 64, "screenshots\\hanomi_%03d.bmp", shotN++); writeBMP(*im, b); if (G) G->toast("Screenshot saved."); }
    memset(&bmi, 0, sizeof bmi); bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER); bmi.bmiHeader.biWidth = im->w; bmi.bmiHeader.biHeight = -im->h; bmi.bmiHeader.biPlanes = 1; bmi.bmiHeader.biBitCount = 32; bmi.bmiHeader.biCompression = BI_RGB;
    if (gOffX > 0 || gOffY > 0) { RECT a = {0, 0, gWinW, gOffY}, b = {0, gOffY + im->h * sc, gWinW, gWinH}, c = {0, gOffY, gOffX, gOffY + im->h * sc}, d = {gOffX + im->w * sc, gOffY, gWinW, gOffY + im->h * sc}; HBRUSH br = (HBRUSH)GetStockObject(BLACK_BRUSH); FillRect(dc, &a, br); FillRect(dc, &b, br); FillRect(dc, &c, br); FillRect(dc, &d, br); }
    SetStretchBltMode(dc, COLORONCOLOR); StretchDIBits(dc, gOffX, gOffY, im->w * sc, im->h * sc, 0, 0, im->w, im->h, im->p.data(), &bmi, DIB_RGB_COLORS, SRCCOPY);
    QueryPerformanceCounter(&t1); double el = (double)(t1.QuadPart - t0.QuadPart) / fq.QuadPart - now; if (el < 1.0 / 60.0 - 0.0015) Sleep((DWORD)((1.0 / 60.0 - el) * 1000.0 - 1)); while (true) { QueryPerformanceCounter(&t1); double e2 = (double)(t1.QuadPart - t0.QuadPart) / fq.QuadPart - now; if (e2 >= 1.0 / 60.0 - 0.0004) break; }
  }
  aRun = false; if (hwo) { SetEvent(aEvt); WaitForSingleObject(aThread, 200); waveOutReset(hwo); } timeEndPeriod(1); return 0;
}
#else
/* ================================ headless QA backend ================================ */
// Usage: hanomi_headless script.txt outdir      (script commands documented in HANOMI_STATUS.md)
static void say(const char* s) { fprintf(stderr, "%s\n", s); }
int main(int argc, char** argv) {
  std::string script = argc > 1 ? argv[1] : "", out = argc > 2 ? argv[2] : "shots"; int W = 1440, H = 810; { std::string c = "mkdir -p " + out; if (system(c.c_str())) {} } appInit(out); FILE* f = fopen(script.c_str(), "r"); if (!f) { say("no script"); return 1; }
  char line[512]; float t = 0; int fcount = 0; double worst = 0, total = 0; int frames = 0; std::vector<std::string> lines; while (fgets(line, sizeof line, f)) lines.push_back(line); fclose(f);
  auto step = [&](int n) { for (int i = 0; i < n; i++) { int sc; auto t0 = std::chrono::steady_clock::now(); appFrame(1.f / 60.f, W, H, sc); double ms = std::chrono::duration<double, std::milli>(t0 == t0 ? std::chrono::steady_clock::now() - t0 : std::chrono::steady_clock::duration::zero()).count(); worst = std::max(worst, ms); total += ms; frames++; if (gQuit) return; } };
  Game& g = *G; int shot = 0; (void)shot;
  for (auto& L : lines) { char cmd[64] = {0}; char a1[128] = {0}; float f1 = 0, f2 = 0; int n = sscanf(L.c_str(), "%63s %127s %f %f", cmd, a1, &f1, &f2); if (n <= 0 || cmd[0] == '#') continue; std::string c = cmd; { char* e2 = nullptr; double v = strtod(a1, &e2); if (a1[0] && e2 && *e2 == 0) { f2 = f1; f1 = (float)v; } }
    if (c == "wait") step((int)atof(a1)); else if (c == "new") { g.newGame((u32)atoi(a1)); g.modal = M_NONE; } else if (c == "key") { int k = a1[0]; if (!strcmp(a1, "SHIFT")) k = K_SHIFT; else if (!strcmp(a1, "SPACE")) k = K_SPACE; else if (!strcmp(a1, "TAB")) k = K_TAB; else if (!strcmp(a1, "ESC")) k = K_ESC; else if (!strcmp(a1, "LEFT")) k = K_LEFT; else if (!strcmp(a1, "RIGHT")) k = K_RIGHT; else if (!strcmp(a1, "UP")) k = K_UP; else if (!strcmp(a1, "DOWN")) k = K_DOWN; if (f1 > 0) { IN.down[k & 255] = true; } else IN.down[k & 255] = false; }
    else if (c == "tap") { int k = a1[0]; if (!strcmp(a1, "TAB")) k = K_TAB; if (!strcmp(a1, "ESC")) k = K_ESC; if (!strcmp(a1, "SPACE")) k = K_SPACE; IN.hit[k & 255] = true; step(1); } else if (c == "tp") { g.player->x = f1 * TS; g.player->y = f2 * TS; g.camX = g.player->x; g.camY = g.player->y - 8; } else if (c == "chief") { g.activateVillages(); for (auto& e : g.ents) if (e->role == R_CHIEF) { g.player->x = e->x; g.player->y = e->y + 14; g.camX = g.player->x; g.camY = g.player->y; g.player->dir = 2; g.talk(e.get()); break; } }
    else if (c == "tpv") { Village* v = nullptr; for (int rr = 1; rr <= 3 && !v; rr++) for (int ry = -rr; ry <= rr && !v; ry++) for (int rx = -rr; rx <= rr && !v; rx++) { if (std::max(std::abs(rx), std::abs(ry)) != rr) continue; Village* q = g.world.villageForRegion(rx, ry); if (q && !q->home) v = q; } if (v) { g.player->x = v->x * TS; g.player->y = (v->y + 6) * TS; g.camX = g.player->x; g.camY = g.player->y; g.activateVillages(); } }
    else if (c == "time") { g.clock = DAY_LEN * (f1 / 24.f) + (g.day - 1) * DAY_LEN; } else if (c == "day") { g.day = (int)f1; g.clock = DAY_LEN * (g.day - 1) + std::fmod(g.clock, DAY_LEN); } else if (c == "give") { g.add(itm(a1), (int)(f1 > 0 ? f1 : 1)); } else if (c == "sel") { g.sel = (int)f1; } else if (c == "rain") { g.rain = g.rainTarget = f1; } else if (c == "coins") { g.coins = (int)f1; }
    else if (c == "mouse") { IN.mx = f1; IN.my = f2; IN.mouseOn = true; } else if (c == "click") { IN.mdown[0] = true; IN.mhit[0] = true; step(1); IN.mdown[0] = false; } else if (c == "rclick") { IN.mdown[2] = true; IN.mhit[2] = true; step(1); IN.mdown[2] = false; } else if (c == "hold") { IN.mdown[0] = f1 > 0; }
    else if (c == "modal") { g.modal = atoi(a1); } else if (c == "dir") { g.player->dir = atoi(a1); } else if (c == "hp") { g.player->hp = f1; } else if (c == "food") { g.food = f1; }
    else if (c == "spawn") { std::string k = a1; float px = g.player->x + f1 * TS, py = g.player->y + f2 * TS; if (k == "zombie") g.spawnZombie(px, py, (int)0); else if (k == "zombie2") g.spawnZombie(px, py, 2); else if (k == "soldier") g.spawnSoldier(g.home(), px, py, false, true); else if (k == "archer") g.spawnSoldier(g.home(), px, py, true, true); else if (k == "enemy") { Village* v = g.world.villageForRegion(1, 0); g.spawnSoldier(v, px, py, false, false); } else if (k == "dog") { Ent* d = g.spawnAnimal("dog", px, py); d->owned = true; d->persist = true; } else if (k == "chicken") g.spawnChicken(px, py, false); else g.spawnAnimal(k, px, py); }
    else if (c == "set") { int tx = (int)f1, ty = (int)f2; std::string k = a1; int o = k == "tree" ? O_OAK : k == "fire" ? O_CAMPFIRE : k == "torch" ? O_TORCH : k == "bench" ? O_BENCH : k == "chest" ? O_CHEST : k == "crop" ? O_WHEAT : 0; if (k == "water") g.world.set(tx, ty, G_WATER, 0, 0); else g.world.set(tx, ty, -1, -1, o, k == "crop" ? 3 : 0); }
    else if (c == "shot") { std::string p = out + "/" + a1 + ".ppm"; step(1); writePPM(REN.screen, p); fcount++; } else if (c == "perf") { fprintf(stderr, "frames=%d avg=%.2fms worst=%.2fms\n", frames, total / std::max(1, frames), worst); total = 0; frames = 0; worst = 0; }
    else if (c == "audio") { static std::vector<int16_t> buf(44100 * 2 * 3); Audio::play(atoi(a1), 1.f); Audio::mix(buf.data(), 44100 * 3); int pk = 0; double e = 0; for (auto v : buf) { pk = std::max(pk, (int)std::abs(v)); e += (double)v * v; } fprintf(stderr, "audio sfx %s peak=%d rms=%.0f\n", a1, pk, std::sqrt(e / buf.size())); }
    else if (c == "music") { Audio::setMood(atoi(a1)); static std::vector<int16_t> buf(44100 * 2 * 20); Audio::mix(buf.data(), 44100 * 20); int pk = 0; double e = 0; for (auto v : buf) { pk = std::max(pk, (int)std::abs(v)); e += (double)v * v; } fprintf(stderr, "music mood %s peak=%d rms=%.0f\n", a1, pk, std::sqrt(e / buf.size())); if (f1 > 0) { FILE* w = fopen((out + "/music.raw").c_str(), "wb"); fwrite(buf.data(), 2, buf.size(), w); fclose(w); } }
    else if (c == "save") { g.saveGame(); } else if (c == "load") { fprintf(stderr, "load=%d\n", g.loadGame()); } else if (c == "stat") { fprintf(stderr, "hp=%.1f food=%.1f coins=%d ents=%zu chunks=%zu day=%d hour=%.1f goal=%d\n", g.player->hp, g.food, g.coins, g.ents.size(), g.world.chunks.size(), g.day, g.hour(), g.goal); }
  }
  say("done"); (void)t; (void)fcount; return 0;
}
#endif
