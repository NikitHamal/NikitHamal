// Hanomi native — skeletal rigs. Humanoid: pelvis/torso/head/2x(arm 2-bone IK)/2x(leg 2-bone IK) + spring-driven hair & scarf.
// Quadruped: spine, neck/head, 4x(2-bone IK legs, diagonal gait), tail & ear secondary motion. Everything is posed per frame in float space
// then rasterised (shaded capsules, selective outline) into a small buffer -> pixel-perfect at any animation phase.
#pragma once
#include "art.h"

enum Act_ { ACT_NONE, ACT_SWING, ACT_CHOP, ACT_THRUST, ACT_SHOOT, ACT_BEND, ACT_EAT, ACT_CAST, ACT_PICK };
struct Look { u32 skin = 0xf2c9a0, hair = 0x2a1c24, top = 0xe8789a, bottom = 0x3a4a7a, accent = 0xf2c24a, shoe = 0x3a2a2a; int hairStyle = 2; int hat = 0; bool scarf = false, armor = false; int kind = 0; float scale = 1; u32 eye = 0x20161c; };
struct RigState { float t = 0, walkT = 0, speed = 0, actP = -1, roll = -1, hurt = 0, dead = 0, aim = 0, vx = 0, vy = 0, charge = 0; int dir = 0, act = ACT_NONE, wl = 0, held = 0; bool moving = false, fish = false, sprint = false, sleep = false; };

struct Chain { float x[5], y[5]; bool init = false; };
static void chainUpdate(Chain& c, int n, float ax, float ay, float len, float vx, float vy, float dt, float wind, float grav = 0.55f) {
  if (!c.init) { for (int i = 0; i < n; i++) { c.x[i] = ax; c.y[i] = ay + i * len; } c.init = true; }
  float px = ax, py = ay;
  for (int i = 0; i < n; i++) {
    float dx = -vx * 0.045f + wind, dy = grav, l = std::hypot(dx, dy); if (l < 0.01f) l = 1; dx /= l; dy /= l;
    float tx = px + dx * len, ty = py + dy * len, k = clampf(dt * 16, 0, 1); c.x[i] += (tx - c.x[i]) * k; c.y[i] += (ty - c.y[i]) * k;
    float ex = c.x[i] - px, ey = c.y[i] - py, d = std::hypot(ex, ey); if (d > len * 1.15f) { c.x[i] = px + ex / d * len * 1.15f; c.y[i] = py + ey / d * len * 1.15f; }
    px = c.x[i]; py = c.y[i];
  }
}
static void ik2(float hx, float hy, float fx, float fy, float a, float b, float bend, float& kx, float& ky, float& ex, float& ey) {
  float dx = fx - hx, dy = fy - hy, d = std::hypot(dx, dy); float maxd = a + b - 0.05f; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; } if (d < 0.2f) { d = 0.2f; dx = 0; dy = 0.2f; }
  float c = clampf((a * a + d * d - b * b) / (2 * a * d), -1, 1), ang = std::acos(c), base = std::atan2(dy, dx);
  kx = hx + std::cos(base + bend * ang) * a; ky = hy + std::sin(base + bend * ang) * a; ex = hx + dx; ey = hy + dy;
}
// cel-shaded capsule: light from the upper-left
static void scap(float x0, float y0, float x1, float y1, float r, u32 base, float lit = 1.f) {
  int xa = (int)std::floor(std::min(x0, x1) - r), xb = (int)std::ceil(std::max(x0, x1) + r), ya = (int)std::floor(std::min(y0, y1) - r), yb = (int)std::ceil(std::max(y0, y1) + r);
  float dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  for (int j = ya; j <= yb; j++) for (int i = xa; i <= xb; i++) {
    float px = i + .5f - x0, py = j + .5f - y0, t = l2 > 0 ? clampf((px * dx + py * dy) / l2, 0, 1) : 0, ex = px - dx * t, ey = py - dy * t, d2 = ex * ex + ey * ey;
    if (d2 > r * r) continue; float u = (-ex * 0.7f - ey * 0.7f) / r; float k = std::round(clampf(u * 1.7f, -1.6f, 1.2f)); putpx(i, j, ramp(HEX(base & 0xFFFFFF), k * 0.8f * lit));
  }
}
static void sellipse(float cx, float cy, float rx, float ry, u32 base, float lit = 1.f, u32 sd = 0) {
  for (int j = (int)std::floor(cy - ry); j <= (int)std::ceil(cy + ry); j++) for (int i = (int)std::floor(cx - rx); i <= (int)std::ceil(cx + rx); i++) {
    float dx = (i + .5f - cx) / rx, dy = (j + .5f - cy) / ry, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
    float u = -(dx * 0.6f + dy * 0.8f); float k = std::round(clampf(u * 1.7f, -1.6f, 1.2f)); if (d2 > 0.82f && u < 0.1f) k -= 0.3f; putpx(i, j, ramp(HEX(base & 0xFFFFFF), k * 0.8f * lit));
  }
}
static void blitRot(const Img& s, float px, float py, float gx, float gy, float ang, bool mirror = false) {
  float c = std::cos(ang), sn = std::sin(ang); int R = 20;
  for (int y = (int)py - R; y <= (int)py + R; y++) for (int x = (int)px - R; x <= (int)px + R; x++) {
    float dx = x + .5f - px, dy = y + .5f - py; float ux = dx * c + dy * sn + gx, uy = -dx * sn + dy * c + gy; if (mirror) ux = (s.w - 1) - ux + 0;
    u32 col = s.get((int)std::floor(ux), (int)std::floor(uy)); if (ca(col)) putpx(x, y, col);
  }
}

struct HumanRig {
  Look look; Chain hair, scarf; float blink = 2, lookT = 0, lookX = 0, tgtLook = 0, footDust = 0;
  void update(float dt, const RigState& s) {
    float wind = std::sin(s.t * 1.7f) * 0.25f; float sx = 0, sy = 0; (void)sx; (void)sy;
    int d = s.dir; float ax = d == 1 ? -2.2f : d == 3 ? 2.2f : 0, ay = -15.5f;
    float vx = s.moving ? (d == 1 ? 40 : d == 3 ? -40 : 0) * (s.sprint ? 1.5f : 1) : 0, vy = s.moving ? (d == 0 ? 40 : d == 2 ? -40 : 0) : 0; (void)ax; (void)ay;
    chainUpdate(scarf, 4, 0, -14.5f, 1.8f, vx + s.vx * 0.f, vy, dt, wind + (d == 1 ? -0.5f : d == 3 ? 0.5f : 0) * (s.moving ? 1 : 0.3f));
    chainUpdate(hair, 3, 0, -17.f, 1.9f, vx, vy, dt, wind * 0.5f, 0.7f);
    blink -= dt; if (blink < -0.13f) blink = frandr(2.5f, 5.5f);
    lookT -= dt; if (lookT <= 0) { lookT = frandr(2, 5); tgtLook = s.moving ? 0 : (frand() < 0.5f ? 0 : (frand() < 0.5f ? -1.f : 1.f)); }
    lookX += (tgtLook - lookX) * clampf(dt * 8, 0, 1);
  }
  // Draws the figure with feet at (ox,oy) in buffer space.
  void render(const RigState& s, float ox, float oy) {
    const Look& L = look; int dir = s.dir; bool flipL = dir == 3; int d = flipL ? 1 : dir; bool side = d == 1, front = d == 0, back = d == 2;
    float sgn = 1; (void)sgn;
    float ph = s.walkT * TAU, spd = s.speed; bool mv = s.moving && !s.sleep;
    float breath = std::sin(s.t * 2.4f) * 0.35f, bob = mv ? -std::fabs(std::sin(ph)) * (0.7f + 0.4f * spd) : breath * 0.5f;
    float lean = (mv ? 0.9f * std::min(1.5f, spd) : 0) + (s.act == ACT_BEND ? 2.2f : 0) + (s.act == ACT_SWING || s.act == ACT_CHOP ? 0.6f : 0);
    float hipY = oy - 6.5f + bob + (s.act == ACT_BEND ? 1.4f : 0) + (s.act == ACT_SHOOT ? 0.4f : 0);
    float shY = hipY - 6.1f + breath * 0.4f + (s.act == ACT_BEND ? 1.5f : 0);
    float twist = mv && side ? 0 : mv ? std::sin(ph) * 0.5f : 0;
    float fx = side ? 1.f : 0.f, fy = front ? 1.f : back ? -1.f : 0.f; // facing vector (screen)
    float torsoX = ox + (side ? lean * 0.6f : twist) + (side ? 0 : 0), headX = torsoX + (side ? lean * 0.4f + 0.3f : lookX * 0.8f);
    float headY = shY - 4.3f + (mv ? -bob * 0.25f : 0) + (s.act == ACT_BEND ? 1.6f : 0) + (s.act == ACT_EAT && std::fmod(s.t * 6, 1) < 0.5f ? 0.5f : 0);
    if (s.hurt > 0) { headX += (hash2((int)(s.t * 60), 3) - 0.5f) * 1.2f; }
    /* --- legs --- */
    float lx[2], ly[2], kx[2], ky[2], hx[2], hy[2]; float stride = mv ? (spd > 1.2f ? 4.6f : 3.6f) : 0;
    for (int i = 0; i < 2; i++) {
      float p = ph + i * PI; float s1 = std::sin(p), lift = mv ? std::max(0.f, std::cos(p)) * (spd > 1.2f ? 2.8f : 2.0f) : 0;
      if (side) { hx[i] = torsoX + (i ? 0.7f : -0.7f); hy[i] = hipY + (i ? 0.3f : 0); lx[i] = hx[i] + s1 * stride + (i ? 0.5f : -0.5f); ly[i] = oy - lift; }
      else { hx[i] = torsoX + (i ? 1.8f : -1.8f); hy[i] = hipY; lx[i] = hx[i] + (i ? 0.4f : -0.4f); ly[i] = oy + (front ? s1 * stride * 0.5f : -s1 * stride * 0.5f) - lift * (front ? 1 : 0.8f); }
      if (s.roll >= 0) { lx[i] = hx[i] + (i ? 1.5f : -1.5f); ly[i] = hipY + 2.5f; }
      float ex, ey; ik2(hx[i], hy[i], lx[i], ly[i], 3.5f, 3.4f, side ? (i ? 1.f : 1.f) : 0.2f * (i ? 1 : -1), kx[i], ky[i], ex, ey); lx[i] = ex; ly[i] = ey;
      if (side) { /* knee bends forward */ float mx = (hx[i] + lx[i]) * 0.5f, my = (hy[i] + ly[i]) * 0.5f; (void)mx; (void)my; }
    }
    auto drawLeg = [&](int i) {
      u32 pc = L.kind == 3 ? mixc(HEX(L.bottom), HEX(0x4a5a3a), 0.3f) : L.bottom; float rr = 1.75f;
      scap(hx[i], hy[i], kx[i], ky[i], rr, pc); scap(kx[i], ky[i], lx[i], ly[i], rr - 0.15f, pc);
      float fl = side ? 1.9f : 1.2f; // foot / shoe
      scap(lx[i] - 0.4f, ly[i] - 0.6f, lx[i] + (side ? fl : 0.4f), ly[i] - 0.3f + (front ? 0.5f : 0), 1.3f, L.shoe);
    };
    /* --- arms --- */
    float shx[2], shy[2], hdx[2], hdy[2], elx[2], ely[2]; int ni = 0; (void)ni;
    float aimA = 0; // action hand angle in dir-space
    float handAng = 0; bool useAng = false; bool twoHand = false;
    for (int i = 0; i < 2; i++) {
      float p = ph + (i ? 0 : PI), sw = mv ? std::sin(p) * (spd > 1.2f ? 4.2f : 3.0f) : 0;
      shx[i] = torsoX + (side ? (i ? 0.9f : -0.9f) : (i ? 3.4f : -3.4f)); shy[i] = shY + 0.8f;
      float hxx, hyy;
      if (side) { hxx = shx[i] + sw + (i ? 0.7f : -0.7f); hyy = shy[i] + 5.2f - std::fabs(sw) * 0.15f; }
      else { hxx = shx[i] + (i ? 0.9f : -0.9f); hyy = shy[i] + 5.0f + (front ? sw * 0.5f : -sw * 0.5f); }
      if (L.kind == 3 && !s.dead) { /* zombie reach */ hxx = shx[i] + fx * (4.5f) + (side ? 0 : (i ? 1 : -1)); hyy = shy[i] + 1.5f + fy * 4.5f + std::sin(s.t * 3 + i) * 0.8f; }
      else if (s.sleep) { hxx = shx[i] + (i ? 1 : -1); hyy = shy[i] + 4; }
      hdx[i] = hxx; hdy[i] = hyy;
    }
    int near = side ? 1 : 1; int far = 0; (void)near; (void)far;
    float p = s.actP; int act = s.act; bool acting = p >= 0 && act != ACT_NONE; float tr = 0;
    auto ease = [](float t) { t = clampf(t, 0, 1); return t * t * (3 - 2 * t); };
    float ang = 0, drawAng = 0; bool showTrail = false; float trailA0 = 0, trailA1 = 0;
    int mainHand = side ? 1 : 1; // the right hand (screen) holds the item
    const ItemDef* held = s.held ? &ITEMS[s.held] : nullptr;
    if (s.fish) { act = ACT_CAST; acting = true; p = p < 0 ? 0.9f : p; }
    if (acting) {
      static const float WA[4] = {-0.5f, -2.3f, -2.7f, -2.3f}, SA[4] = {2.6f, 0.55f, -0.4f, 0.55f}; // windup / strike angles per dir (screen radians)
      int dd = d; float a_w = WA[dd], a_s = SA[dd]; if (act == ACT_CHOP || act == ACT_PICK) { a_w = dd == 0 ? -1.3f : dd == 2 ? -1.8f : -2.7f; a_s = dd == 0 ? 1.8f : dd == 2 ? -1.4f : 0.9f; }
      if (act == ACT_SWING || act == ACT_CHOP || act == ACT_PICK) {
        float a0 = dd == 1 ? -0.4f : dd == 0 ? 0.9f : dd == 2 ? -0.9f : 0.5f;
        if (p < 0.28f) ang = a0 + (a_w - a0) * ease(p / 0.28f); else if (p < 0.58f) { ang = a_w + (a_s - a_w) * ease((p - 0.28f) / 0.3f); showTrail = true; trailA1 = ang; trailA0 = a_w + (a_s - a_w) * ease(std::max(0.f, (p - 0.28f) / 0.3f - 0.4f)); }
        else ang = a_s + (a0 - a_s) * ease((p - 0.58f) / 0.42f) * 0.7f;
        useAng = true; handAng = ang; drawAng = ang;
        float R = 4.3f; hdx[mainHand] = shx[mainHand] + std::cos(ang) * R; hdy[mainHand] = shy[mainHand] + std::sin(ang) * R + (p > 0.28f && p < 0.58f ? 0.f : 0.f);
        hdx[1 - mainHand] = shx[1 - mainHand] + (side ? -1.0f : -1.8f) + std::cos(ang) * 1.2f; hdy[1 - mainHand] = shy[1 - mainHand] + 3.5f;
      } else if (act == ACT_THRUST) {
        float e = p < 0.3f ? -ease(p / 0.3f) * 0.8f : p < 0.5f ? -0.8f + ease((p - 0.3f) / 0.2f) * 4.8f : 4.0f - ease((p - 0.5f) / 0.5f) * 4.0f; float fa = side ? 0 : front ? 1.5708f : -1.5708f; ang = fa;
        hdx[mainHand] = shx[mainHand] + fx * (2.5f + e) + (side ? 0 : 1.0f); hdy[mainHand] = shy[mainHand] + 2.5f + fy * (2.5f + e); useAng = true; handAng = fa; drawAng = fa;
        hdx[1 - mainHand] = hdx[mainHand] - fx * 3.0f - (side ? 0 : 2.5f); hdy[1 - mainHand] = hdy[mainHand] - fy * 3.0f; twoHand = true;
      } else if (act == ACT_SHOOT) {
        float a = s.aim; float draw = p < 0.65f ? ease(p / 0.65f) : 1 - ease((p - 0.65f) / 0.1f); if (p > 0.75f) draw = 0; float R = 6.2f;
        hdx[mainHand] = shx[mainHand] + std::cos(a) * R; hdy[mainHand] = shy[mainHand] + std::sin(a) * R; hdx[1 - mainHand] = shx[1 - mainHand] + std::cos(a) * (R - 5.5f * draw); hdy[1 - mainHand] = shy[1 - mainHand] + std::sin(a) * (R - 5.5f * draw) + 0.4f; handAng = a; useAng = true; drawAng = a; tr = draw; twoHand = true;
      } else if (act == ACT_BEND) {
        float e = std::sin(clampf(p, 0, 1) * PI); hdx[mainHand] = shx[mainHand] + fx * (3.5f * e + 1) + (side ? 0 : 1); hdy[mainHand] = shy[mainHand] + 4 + e * 3.5f + (fy > 0 ? 2.f : 0); hdx[1 - mainHand] = shx[1 - mainHand] + fx * 2 * e; hdy[1 - mainHand] = shy[1 - mainHand] + 4 + e * 3;
      } else if (act == ACT_EAT) {
        float e = std::sin(clampf(p, 0, 1) * PI); hdx[mainHand] = lerpf(hdx[mainHand], headX + fx * 2.0f + (side ? 0 : 1.4f), e); hdy[mainHand] = lerpf(hdy[mainHand], headY + 2.4f, e);
      } else if (act == ACT_CAST) {
        float a = p < 0.35f ? -0.3f + (-2.5f + 0.3f) * (1 - ease(p / 0.35f)) * 0.f - 2.4f * (1 - ease(p / 0.35f)) : -0.3f - 0.6f * ease((p - 0.35f) / 0.65f); if (s.fish) a = -0.9f + std::sin(s.t * 2) * 0.05f;
        hdx[mainHand] = shx[mainHand] + std::cos(a) * 4.5f * (side ? 1 : 0.4f) + (side ? 0 : 1); hdy[mainHand] = shy[mainHand] + std::sin(a) * 4.5f + 1; hdx[1 - mainHand] = hdx[mainHand] - fx * 2.5f; hdy[1 - mainHand] = hdy[mainHand] + 1.4f; useAng = true; handAng = a; drawAng = a; twoHand = true;
      }
    } else if (held && !s.sleep && L.kind != 3) { // idle carry: item hand a little raised
      hdy[mainHand] -= 0.8f; hdx[mainHand] += fx * 1.3f; if (held->kind == K_TOOL || held->kind == K_WEAPON) { useAng = true; handAng = side ? -0.9f : front ? 0.9f : -2.2f; drawAng = handAng + (mv ? std::sin(ph) * 0.12f : std::sin(s.t * 2) * 0.03f); }
    }
    for (int i = 0; i < 2; i++) { float ex, ey; ik2(shx[i], shy[i], hdx[i], hdy[i], 3.0f, 3.0f, side ? -1.f : (i ? 0.7f : -0.7f) * (front ? 1 : -1), elx[i], ely[i], ex, ey); hdx[i] = ex; hdy[i] = ey; }
    auto drawArm = [&](int i) {
      u32 sleeve = L.kind == 3 ? mixc(HEX(L.top), HEX(0x5a6a42), 0.4f) : L.armor ? HEX(L.top) : L.top; float sx2 = shx[i], sy2 = shy[i];
      scap(sx2, sy2, elx[i], ely[i], 1.55f, sleeve); scap(elx[i], ely[i], hdx[i], hdy[i], 1.4f, L.armor ? 0x6a6a76 : L.skin); if (L.armor) scap(elx[i], ely[i], hdx[i], hdy[i], 1.6f, 0x5a4a5a);
      putpx((int)std::floor(hdx[i]), (int)std::floor(hdy[i]), ramp(HEX(L.skin), 0.5f));
    };
    /* --- held item --- */
    auto drawHeld = [&](bool behind) {
      if (!held || (s.dead > 0)) return; const Img& ic = ART.icon[s.held]; float hx2 = hdx[mainHand], hy2 = hdy[mainHand];
      if (held->kind == K_TOOL || held->kind == K_WEAPON) {
        if (held->tool == TL_BOW) { // bow arc + string + nocked arrow
          float a = useAng ? handAng : (side ? 0 : front ? 1.57f : -1.57f); float draw = s.actP >= 0 && s.act == ACT_SHOOT ? tr : 0; float nx = -std::sin(a), ny = std::cos(a);
          float px0 = hx2 + std::cos(a) * 0.5f, py0 = hy2 + std::sin(a) * 0.5f; float tx[2], ty[2];
          for (int k = 0; k < 2; k++) { float sgn2 = k ? 1.f : -1.f; tx[k] = px0 + nx * 6.5f * sgn2 - std::cos(a) * 1.4f; ty[k] = py0 + ny * 6.5f * sgn2 - std::sin(a) * 1.4f; }
          for (int k = 0; k <= 12; k++) { float t = k / 12.f - 0.5f; float bx = px0 + nx * t * 13 + std::cos(a) * (1.5f - t * t * 8), by = py0 + ny * t * 13 + std::sin(a) * (1.5f - t * t * 8); putpx((int)std::floor(bx), (int)std::floor(by), HEX(k % 3 ? 0x8a5a34 : 0x6b4428)); }
          float stx = px0 - std::cos(a) * (1.4f + draw * 5.5f), sty = py0 - std::sin(a) * (1.4f + draw * 5.5f); line((int)tx[0], (int)ty[0], (int)stx, (int)sty, HEX(0xe8e0d0)); line((int)tx[1], (int)ty[1], (int)stx, (int)sty, HEX(0xe8e0d0));
          if (draw > 0.05f || s.actP < 0) { line((int)stx, (int)sty, (int)(px0 + std::cos(a) * 7), (int)(py0 + std::sin(a) * 7), HEX(0x8a5a34)); putpx((int)(px0 + std::cos(a) * 8), (int)(py0 + std::sin(a) * 8), HEX(0xdfe3ee)); }
          return; }
        float a = useAng ? drawAng : -0.9f; float rot = a - (-0.82f); bool mir = false; (void)mir;
        if (held->tool == TL_SPEAR) { rot = a + 0.82f - 1.65f + 0.82f; rot = a - (-0.82f); }
        blitRot(ic, hx2, hy2, 3.5f, 13.5f, rot);
      } else { // carried items: little icon held up
        int sz = 10; blitScaled(ic, (int)std::round(hx2 - sz / 2.f + fx * 1), (int)std::round(hy2 - sz + 2), sz, sz);
      }
      (void)behind;
    };
    /* --- torso --- */
    auto drawTorso = [&]() {
      u32 top = L.top; if (L.kind == 3) top = mixc(HEX(L.top), HEX(0x5a6a42), 0.45f);
      float tw = side ? 2.6f : 3.7f, bw = side ? 2.5f : 3.1f;
      for (int j = 0; j < 8; j++) { float y = shY + j * 0.95f + (-0.4f); float f = j / 7.f; float hw2 = lerpf(tw, bw, f) + (j == 0 ? -0.5f : 0); float cx2 = torsoX + (side ? lerpf(lean * 0.5f, 0, f) : 0);
        for (int i = (int)std::floor(cx2 - hw2); i < (int)std::ceil(cx2 + hw2); i++) { float u = (i + .5f - cx2) / hw2; float k = -u * 0.9f + (1 - f) * 0.2f; u32 c = ramp(HEX(top), std::round(clampf(k * 1.4f, -1.4f, 1.2f)) * 0.8f);
          if (j >= 5) c = ramp(HEX(L.bottom == 0 ? top : top), -0.2f - u * 0.5f); if (L.armor) { c = ramp(HEX(L.top), std::round(clampf(k * 1.6f, -1.6f, 1.4f)) * 0.8f); if (j % 2 == 1 && j < 6) c = ramp(c, -0.7f); } putpx(i, (int)std::floor(y), c); } }
      // sash / obi
      float oy2 = shY + 5.1f; for (int i = (int)std::floor(torsoX - bw - 0.3f); i < (int)std::ceil(torsoX + bw + 0.3f); i++) { u32 c = ramp(HEX(L.accent), ((i - torsoX) < 0 ? 0.6f : -0.6f)); putpx(i, (int)std::floor(oy2), c); putpx(i, (int)std::floor(oy2) + 1, ramp(c, -0.6f)); }
      if (front) { // collar V
        line((int)std::floor(torsoX - 1.6f), (int)std::floor(shY - 0.3f), (int)std::floor(torsoX), (int)std::floor(shY + 2), HEX(0xf6eee0)); line((int)std::floor(torsoX + 1.6f), (int)std::floor(shY - 0.3f), (int)std::floor(torsoX), (int)std::floor(shY + 2), HEX(0xe8dccc)); }
      if (side) putpx((int)std::floor(torsoX + 1), (int)std::floor(oy2 + 1), ramp(HEX(L.accent), -1));
      if (back && L.kind != 3) { // bow of the sash
        putpx((int)std::floor(torsoX - 1), (int)std::floor(oy2 + 1), ramp(HEX(L.accent), 0.5f)); putpx((int)std::floor(torsoX + 1), (int)std::floor(oy2 + 1), ramp(HEX(L.accent), -0.5f)); putpx((int)std::floor(torsoX), (int)std::floor(oy2 + 2), ramp(HEX(L.accent), -0.9f)); }
      if (L.kind == 3) { putpx((int)torsoX - 2, (int)(shY + 6), 0); frect((int)torsoX + 1, (int)(shY + 3), 2, 1, HEX(0x3a2a22)); frect((int)torsoX - 2, (int)(shY + 5), 1, 2, HEX(0x7a2a2a)); }
    };
    /* --- head --- */
    auto drawHead = [&]() {
      float cx2 = headX, cy2 = headY; u32 skin = L.skin, hair = L.hair; if (L.kind == 3) skin = 0x8fb070;
      // back hair mass (long styles)
      if (L.hairStyle == 1 || L.hairStyle == 2) { if (!front) { sellipse(cx2 - (side ? 1.2f : 0), cy2 + 0.5f, side ? 3.6f : 4.4f, 4.4f, hair); } if (L.hairStyle == 1 && front) { scap(cx2 - 3.8f, cy2 - 1, cx2 - 3.6f, cy2 + 4.5f, 1.2f, hair); scap(cx2 + 3.8f, cy2 - 1, cx2 + 3.6f, cy2 + 4.5f, 1.2f, hair); } }
      sellipse(cx2, cy2, 4.1f, 4.0f, skin);
      // ears
      if (front || back) { putpx((int)std::floor(cx2 - 4.2f), (int)std::floor(cy2 + 0.6f), ramp(HEX(skin), -0.6f)); putpx((int)std::floor(cx2 + 4.2f), (int)std::floor(cy2 + 0.6f), ramp(HEX(skin), -0.6f)); }
      bool blinkNow = s.sleep || s.dead > 0.2f || (blink < 0 && blink > -0.13f);
      u32 eye = L.kind == 3 ? 0xd83a3a : L.eye;
      if (front) {
        for (int e = -1; e <= 1; e += 2) { int ex = (int)std::floor(cx2 + e * 1.75f + lookX * 0.4f - (e > 0 ? 0 : 0.5f)), ey = (int)std::floor(cy2 + 0.7f); if (blinkNow) hline(ex, ey + 1, 2, ramp(HEX(skin), -1.6f)); else { frect(ex, ey, 1, 2, HEX(eye)); putpx(ex, ey, HEX(L.kind == 3 ? 0xff8a8a : 0x4a3a50)); putpx(ex + 1, ey, HEX(0xffffff)); } }
        putpx((int)std::floor(cx2 - 3.0f), (int)std::floor(cy2 + 2.3f), mixc(HEX(skin), HEX(0xf08a8a), 0.55f)); putpx((int)std::floor(cx2 + 2.4f), (int)std::floor(cy2 + 2.3f), mixc(HEX(skin), HEX(0xf08a8a), 0.55f));
        if (L.kind == 3) frect((int)std::floor(cx2 - 1), (int)std::floor(cy2 + 2.9f), 3, 1, HEX(0x3a1a1a)); else if (s.act == ACT_EAT && std::fmod(s.t * 6, 1) < 0.5f) frect((int)std::floor(cx2 - 0.5f), (int)std::floor(cy2 + 2.6f), 2, 1, HEX(0x7a3a3a)); else putpx((int)std::floor(cx2), (int)std::floor(cy2 + 2.9f), ramp(HEX(skin), -1.6f));
      } else if (side) {
        int ex = (int)std::floor(cx2 + 1.9f), ey = (int)std::floor(cy2 + 0.7f); if (blinkNow) hline(ex - 1, ey + 1, 2, ramp(HEX(skin), -1.6f)); else { frect(ex, ey, 1, 2, HEX(eye)); putpx(ex, ey, HEX(0x4a3a50)); putpx(ex - 1, ey, HEX(0xffffff)); }
        putpx((int)std::floor(cx2 + 4.0f), (int)std::floor(cy2 + 1.5f), ramp(HEX(skin), 0.4f)); putpx((int)std::floor(cx2 + 1.0f), (int)std::floor(cy2 + 2.6f), mixc(HEX(skin), HEX(0xf08a8a), 0.55f));
        if (L.kind == 3) frect((int)std::floor(cx2 + 2), (int)std::floor(cy2 + 2.9f), 2, 1, HEX(0x3a1a1a)); else putpx((int)std::floor(cx2 + 2.6f), (int)std::floor(cy2 + 3.0f), ramp(HEX(skin), -1.6f));
      }
      // hair cap / bangs
      if (L.hairStyle != 5) {
        if (back) sellipse(cx2, cy2 - 0.3f, 4.3f, 4.2f, hair);
        else if (front) { sellipse(cx2, cy2 - 2.0f, 4.4f, 2.8f, hair); for (int i = -4; i <= 3; i++) { int h = 1 + ((i * 7 + 3) & 1) + (std::abs(i) > 2 ? 2 : 0); vline((int)std::floor(cx2) + i, (int)std::floor(cy2 - 1), h, ramp(HEX(hair), (i & 1) ? 0.4f : -0.3f)); } putpx((int)std::floor(cx2 - 2), (int)std::floor(cy2 - 4), ramp(HEX(hair), 1.8f)); putpx((int)std::floor(cx2 - 1), (int)std::floor(cy2 - 4), ramp(HEX(hair), 1.3f)); }
        else { sellipse(cx2 - 0.9f, cy2 - 1.2f, 3.9f, 3.6f, hair); for (int i = 0; i < 3; i++) vline((int)std::floor(cx2 + 1) + i, (int)std::floor(cy2 - 2), 2 - (i == 2 ? 1 : 0), ramp(HEX(hair), -0.3f)); putpx((int)std::floor(cx2 - 2), (int)std::floor(cy2 - 4), ramp(HEX(hair), 1.7f)); }
      } else if (L.hairStyle == 5) putpx((int)std::floor(cx2 - 1), (int)std::floor(cy2 - 3), ramp(HEX(skin), 1.4f));
      if (L.hairStyle == 3) { scap(cx2 - (side ? 1.5f : 0), cy2 - 4.0f, cx2 - (side ? 1.8f : 0), cy2 - 6.2f, 1.3f, hair); }
      if (L.hairStyle == 4) { sellipse(cx2 - (side ? 2.f : 0), cy2 - 5, 2.2f, 2.0f, hair); }
      if (L.hairStyle == 2) { // ponytail on spring chain
        float ax2 = cx2 + (side ? -3.2f : (front ? 3.2f : -3.2f)), ay2 = cy2 - 2.0f; float px = ax2, py = ay2; for (int i = 0; i < 3; i++) { float nx2 = ax2 + (hair_x(i) - hair_x(-1)), ny2 = ay2 + (hair_y(i) - hair_y(-1)); scap(px, py, nx2, ny2, 1.5f - i * 0.25f, hair); px = nx2; py = ny2; } putpx((int)std::floor(ax2), (int)std::floor(ay2), HEX(L.accent)); }
      // hats
      if (L.hat == 1) { // kasa (straw cone)
        for (int j = 0; j < 6; j++) { float w = 1.5f + j * 1.6f; for (int i = (int)std::floor(cx2 - w); i < (int)std::ceil(cx2 + w); i++) putpx(i, (int)std::floor(cy2 - 5.5f + j), ramp(HEX(0xe0c070), (i < cx2 ? 0.5f : -0.6f) + (j % 2 ? -0.3f : 0.2f))); } hline((int)std::floor(cx2 - 8.4f), (int)std::floor(cy2 + 0.5f), 17, ramp(HEX(0xa88a40), -0.6f));
      } else if (L.hat == 2) { // kabuto helmet
        for (int j = 0; j < 4; j++) { float w = 4.6f - j * 0.3f; for (int i = (int)std::floor(cx2 - w); i < (int)std::ceil(cx2 + w); i++) putpx(i, (int)std::floor(cy2 - 4.4f + j), ramp(HEX(0x5a5a68), (i < cx2 ? 0.8f : -0.6f) + (j == 0 ? 0.8f : 0))); } hline((int)std::floor(cx2 - 5.2f), (int)std::floor(cy2 - 0.6f), 11, HEX(0x3a3a48)); frect((int)std::floor(cx2 - 0.6f), (int)std::floor(cy2 - 6.4f), 2, 3, HEX(0xf2c24a)); putpx((int)std::floor(cx2 - 2.6f), (int)std::floor(cy2 - 6), HEX(0xf2c24a)); putpx((int)std::floor(cx2 + 2.2f), (int)std::floor(cy2 - 6), HEX(0xf2c24a));
      }
    };
    /* --- compose --- */
    auto drawScarf = [&](bool frontLayer) {
      if (!L.scarf) return; float ax2 = torsoX + (side ? -1.5f : 0), ay2 = shY - 0.5f; u32 c = L.accent; (void)frontLayer;
      if (!back) { hline((int)std::floor(torsoX - 2.8f), (int)std::floor(shY - 0.8f), 6, ramp(HEX(c), 0.5f)); hline((int)std::floor(torsoX - 2.4f), (int)std::floor(shY + 0.2f), 5, ramp(HEX(c), -0.5f)); }
      float px = ax2, py = ay2; for (int i = 0; i < 4; i++) { float nx = ax2 + scarf.x[i] - 0, ny = ay2 + (scarf.y[i] + 14.5f); scap(px, py, nx, ny, 1.15f - i * 0.12f, c, 0.9f); px = nx; py = ny; }
    };
    bool kw = L.kind == 3;
    if (s.sleep) { /* lying down handled by caller rotation */ }
    // shadows of far limbs (dark) first
    int farI = 0, nearI = 1;
    if (side) {
      drawHeldBehind = false;
      drawArm(farI); drawLeg(farI); drawTorso(); drawScarf(false); drawLeg(nearI); drawHead(); drawArm(nearI); drawHeld(false);
      if (twoHand) {}
    } else if (front) { drawLeg(0); drawLeg(1); drawTorso(); drawScarf(true); drawArm(0); drawHead(); drawArm(1); drawHeld(false); }
    else { drawHeld(true); drawLeg(0); drawLeg(1); drawTorso(); drawArm(0); drawArm(1); drawScarf(true); drawHead(); }
    (void)kw;
    // slash trail
    if (showTrail) { float R = 11.f; for (int k = 0; k < 14; k++) { float t = k / 13.f; float a = trailA0 + (trailA1 - trailA0) * t; for (int rr = 0; rr < 3; rr++) putpx((int)std::floor(shx[mainHand] + std::cos(a) * (R + rr * 1.3f)), (int)std::floor(shy[mainHand] + std::sin(a) * (R + rr * 1.3f)), withA(0xFFF8E8, (int)(40 + 180 * t * (rr == 1 ? 1 : 0.6f)))); } }
    (void)flipL;
  }
  bool drawHeldBehind = false;
  float hair_x(int i) { return i < 0 ? 0 : hair.x[i]; } float hair_y(int i) { return i < 0 ? -17.f : hair.y[i]; }

  // Public: render the character at world feet (wx,wy) onto T.
  void draw(const RigState& s, int wx, int wy, int cutRows = 0, bool flash = false) {
    static Img buf(56, 56); std::fill(buf.p.begin(), buf.p.end(), 0u); Img* old = T; T = &buf; float ox = 28, oy = 46;
    RigState st = s; if (s.dir == 3) {} render(st, ox, oy); // render in dir-space (mirrors for dir 3)
    T = old;
    // outline pass
    Img o = buf; outlineImg(o, HEX(0x1c1424));
    bool mirror = s.dir == 3; Img* src = &o;
    if (s.roll >= 0) { // curl up and spin
      Img r(56, 56); float a = s.roll * TAU * (mirror ? -1 : 1), c = std::cos(a), sn = std::sin(a); float cy = oy - 9; for (int y = 0; y < 56; y++) for (int x = 0; x < 56; x++) { float dx = x + .5f - 28, dy = y + .5f - cy; float ux = dx * c + dy * sn + 28, uy = -dx * sn + dy * c + cy + 0; u32 col = o.get((int)std::floor(ux), (int)std::floor(uy)); r.p[y * 56 + x] = col; }
      o = r; }
    if (s.dead > 0) { Img r(56, 56); float a = std::min(1.f, s.dead) * 1.5708f * (mirror ? -1 : 1); float c = std::cos(a), sn = std::sin(a); for (int y = 0; y < 56; y++) for (int x = 0; x < 56; x++) { float dx = x + .5f - 28, dy = y + .5f - oy; float ux = dx * c + dy * sn + 28, uy = -dx * sn + dy * c + oy; u32 col = o.get((int)std::floor(ux), (int)std::floor(uy)); r.p[y * 56 + x] = col; } o = r; if (s.dead > 1) for (auto& q : o.p) if (q >> 24) q = withA(q, (int)(255 * std::max(0.f, 1.f - (s.dead - 1) * 1.1f))); }
    int bx = wx - 28, by = wy - 46; int rows = cutRows > 0 ? 56 - cutRows : 56;
    for (int j = 0; j < rows; j++) for (int i = 0; i < 56; i++) { u32 c = src->p[j * 56 + (mirror ? 55 - i : i)]; if (!(c >> 24)) continue; if (flash) c = mixc(c, HEX(0xffffff), 0.75f); putpx(bx + i, by + j, c); }
  }
};

/* ============================ quadruped / animal rig ============================ */
struct AniSpec {
  const char* name; u32 body, belly, mark, hoof, nose; float len, height, legL, headR, neck, bodyR; int features; // features bitset below
};
enum { AF_SPOTS = 1, AF_HORNS = 2, AF_WOOL = 4, AF_SNOUT = 8, AF_ANTLERS = 16, AF_TUSKS = 32, AF_BUSHY = 64, AF_LONGEAR = 128, AF_CURL = 256, AF_FLOP = 512, AF_UDDER = 1024, AF_WOLF = 2048, AF_DOG = 4096, AF_FACE = 8192 };
static const AniSpec ANISPEC[] = {
  {"cow", 0xf4f0ea, 0xe0d8d0, 0x2e2630, 0x4a3a3a, 0xf0a0a8, 15, 11, 5.5f, 4.6f, 4, 5.2f, AF_SPOTS | AF_HORNS | AF_UDDER},
  {"sheep", 0xf2eee4, 0xe0dcd0, 0x3a3236, 0x3a3236, 0x4a4246, 11, 9, 4.5f, 3.4f, 3, 4.6f, AF_WOOL | AF_FACE},
  {"pig", 0xf0a8b0, 0xe08a98, 0xd8788a, 0x8a4a58, 0xe08a98, 12, 8, 3.5f, 3.8f, 2.5f, 4.4f, AF_SNOUT | AF_CURL | AF_FLOP},
  {"deer", 0xb8803c, 0xe8d4a8, 0xf4ecd8, 0x3a2a20, 0x3a2a20, 14, 11, 8.5f, 3.2f, 6, 3.6f, AF_SPOTS | AF_ANTLERS},
  {"boar", 0x5a4234, 0x7a5a44, 0x2a1e18, 0x2a1e18, 0x3a2a22, 13, 9, 4.f, 4.0f, 2.5f, 4.8f, AF_TUSKS | AF_SNOUT | AF_BUSHY},
  {"fox", 0xe07a2a, 0xf8f0e0, 0x2a1c14, 0x2a1c14, 0x1a1210, 10, 7, 4.f, 3.0f, 2.5f, 3.0f, AF_BUSHY | AF_LONGEAR},
  {"wolf", 0x7a7e8a, 0xc8ccd4, 0x3a3e48, 0x2a2a30, 0x1a1a1e, 14, 10, 6.f, 3.4f, 3.5f, 3.6f, AF_WOLF | AF_LONGEAR | AF_BUSHY},
  {"dog", 0x2a2630, 0xf4f0ea, 0xc8782a, 0x2a2630, 0x1a1418, 12, 9, 4.5f, 3.6f, 3.0f, 3.6f, AF_DOG | AF_FLOP},
  {"rabbit", 0xc8a888, 0xf4ecdc, 0xf4ecdc, 0x7a5a44, 0xf0a0a8, 7, 6, 2.5f, 2.6f, 1.5f, 2.8f, AF_LONGEAR | AF_FLOP},
};
inline int aniIndex(const std::string& k) { for (int i = 0; i < 9; i++) if (k == ANISPEC[i].name) return i; return 0; }
struct AniState { float t = 0, walkT = 0, speed = 0; bool moving = false; int pose = 0; float graze = 0, hurt = 0, dead = 0, wag = 0, hop = 0; bool shorn = false, baby = false, sleeping = false; float headLook = 0; int seed = 0; float pant = 0; };
struct AnimalRig {
  Chain tail; float earT = 0;
  void update(float dt, const AniState& s, const AniSpec& sp) { chainUpdate(tail, 4, 0, 0, 1.6f, s.moving ? 22 : 0, 0, dt, 0.f, 0.f); (void)sp; }
  // side view facing right; feet on y=oy. Returns nothing; draws to T.
  void render(const AniState& s, const AniSpec& sp, float ox, float oy) {
    float ph = s.walkT * TAU; bool mv = s.moving; float bob = mv ? -std::fabs(std::sin(ph)) * 0.6f : std::sin(s.t * 2.1f) * 0.25f;
    float L = sp.len, legL = sp.legL, bodyY = oy - legL - sp.bodyR * 0.55f + bob + (s.sleeping ? legL * 0.85f : 0); float bodyR = sp.bodyR; bool dog = sp.features & AF_DOG, wolf = sp.features & AF_WOLF;
    bool rabbit = std::string(sp.name) == "rabbit"; if (rabbit) { float hp = s.hop; bodyY -= std::sin(clampf(hp, 0, 1) * PI) * 5; }
    float bx0 = ox - L * 0.32f, bx1 = ox + L * 0.32f; // rump, chest
    float pitch = mv ? std::sin(ph * 2) * 0.35f : 0; (void)pitch;
    // legs: diagonal gait. order: far-hind, far-fore, near-hind, near-fore
    float lxp[4], lyp[4], hxp[4], hyp[4], kxp[4], kyp[4]; static const float PO[4] = {0.5f, 0.0f, 0.0f, 0.5f}; // hind-far, fore-far, hind-near, fore-near phase offsets (turns)
    float stride = mv ? (s.speed > 1.2f ? 4.2f : 2.6f) * (0.6f + L / 20) : 0; if (rabbit) stride = 0;
    for (int i = 0; i < 4; i++) {
      bool fore = i == 1 || i == 3; float hx = fore ? bx1 - 0.8f : bx0 + 0.8f, hy = bodyY + bodyR * 0.55f; float p = ph + PO[i] * TAU; float lift = mv ? std::max(0.f, std::cos(p)) * 2.2f : 0;
      float fx2 = hx + (mv ? std::sin(p) * stride : 0) + (i < 2 ? -0.6f : 0.4f), fy2 = oy - lift; if (s.sleeping) { fx2 = hx + (fore ? 3 : -2); fy2 = oy; } if (rabbit) { fx2 = hx + (fore ? 2.5f : -2); fy2 = oy - std::sin(clampf(s.hop, 0, 1) * PI) * 2; if (!fore && s.hop > 0) fx2 = hx - 1; }
      if (s.graze > 0 && fore) {}
      float ex, ey; ik2(hx, hy, fx2, fy2, legL * 0.52f, legL * 0.52f, fore ? -1.f : 1.f, kxp[i], kyp[i], ex, ey); hxp[i] = hx; hyp[i] = hy; lxp[i] = ex; lyp[i] = ey;
    }
    u32 legc = (sp.features & AF_WOOL) ? sp.mark : (dog ? sp.body : sp.body); if (sp.features & AF_WOLF) legc = ramp(HEX(sp.body), -0.4f); if (std::string(sp.name) == "fox") legc = sp.mark; if (std::string(sp.name) == "deer") legc = ramp(HEX(sp.body), -0.2f);
    auto leg = [&](int i, bool far) { u32 c = far ? ramp(HEX(legc), -1.1f) : HEX(legc); float r = rabbit ? 1.3f : std::max(1.1f, sp.bodyR * 0.26f); scap(hxp[i], hyp[i], kxp[i], kyp[i], r, c, 0.9f); scap(kxp[i], kyp[i], lxp[i], lyp[i], r * 0.82f, c, 0.9f); scap(lxp[i] - 0.3f, lyp[i] - 0.4f, lxp[i] + 0.7f, lyp[i], r * 0.8f, far ? ramp(HEX(sp.hoof), -0.5f) : HEX(sp.hoof)); };
    float tailBase = bx0 - 1.0f, tailY = bodyY - bodyR * 0.3f; float headX = bx1 + sp.neck * 0.8f + 1.0f, headY = bodyY - bodyR * 0.5f - sp.neck * 0.55f + (mv ? std::sin(ph * 2) * 0.3f : 0);
    if (s.graze > 0) { float g = smoothf(std::min(1.f, s.graze * 4)); headY = lerpf(headY, oy - sp.headR * 0.9f, g); headX += g * 1.5f; headY += std::sin(s.t * 9) * 0.3f * g; }
    if (s.sleeping) { headY = bodyY + 1.5f; headX = bx1 + 1; }
    if (dog || wolf) { headY += 1.2f; }
    // far legs
    leg(0, true); leg(1, true);
    // tail
    { float wag = dog ? std::sin(s.t * (s.wag > 0 ? 18 : 3)) * (s.wag > 0 ? 3.0f : 0.5f) : 0; float tx = tailBase, ty = tailY; u32 tc = (sp.features & AF_BUSHY) ? sp.body : sp.body;
      if (std::string(sp.name) == "cow" || std::string(sp.name) == "deer") { scap(tx, ty, tx - 1.2f, ty + 3.8f + std::sin(s.t * 3) * 0.5f, 0.7f, ramp(HEX(tc), -0.5f)); if (std::string(sp.name) == "cow") fcircle(tx - 1.2f, ty + 4.4f, 1.1f, HEX(sp.mark)); }
      else if (sp.features & AF_CURL) { for (int k = 0; k < 5; k++) putpx((int)std::floor(tx - 0.5f - (k & 1) - (k > 2 ? 0 : 0)), (int)std::floor(ty - k * 0.9f + 1), HEX(sp.nose)); putpx((int)std::floor(tx - 1), (int)std::floor(ty - 3.5f), HEX(sp.nose)); }
      else if (sp.features & AF_BUSHY) { float len2 = std::string(sp.name) == "fox" ? 5.5f : 4.5f; float ex2 = tx - len2 + wag * 0.3f - (mv ? 1 : 0) + std::sin(s.t * 2.2f) * 0.8f, ey2 = ty + 1.5f + (mv ? -1.f : 1.5f); scap(tx, ty, ex2, ey2, std::string(sp.name) == "fox" ? 1.9f : 1.5f, tc); if (std::string(sp.name) == "fox") fcircle(ex2 - 0.3f, ey2 + 0.2f, 1.2f, HEX(0xfff4e8)); }
      else if (dog) { float ex2 = tx - 3.4f + wag * 0.2f, ey2 = ty - 2.5f + wag; scap(tx, ty, ex2, ey2, 1.1f, HEX(sp.mark == 0 ? sp.body : sp.body)); fcircle(ex2, ey2, 1.1f, HEX(sp.belly)); }
      else if (rabbit) fcircle(tx - 0.8f, ty + 0.5f, 1.8f, HEX(0xfff8f0)); else if (sp.features & AF_WOOL) { sellipse(tx - 0.5f, ty + 0.3f, 1.8f, 1.6f, sp.body); }
      else scap(tx, ty, tx - 2.5f, ty + 1.8f, 0.8f, HEX(tc)); }
    // body
    if (sp.features & AF_WOOL) { if (!s.shorn) { for (int k = 0; k < 7; k++) { float a = k / 7.f * TAU; float px = ox + std::cos(a) * L * 0.27f, py = bodyY + std::sin(a) * bodyR * 0.55f; sellipse(px, py, 3.2f, 3.0f, sp.body, 1.0f); } sellipse(ox, bodyY, L * 0.3f, bodyR * 0.8f, sp.body, 1.0f); for (int k = 0; k < 5; k++) putpx((int)(ox - 4 + k * 2), (int)(bodyY - 2 + (k & 1) * 3), ramp(HEX(sp.body), -0.9f)); }
      else { sellipse(ox, bodyY, L * 0.36f, bodyR * 0.62f, 0xe8b8a0, 0.9f); } }
    else { sellipse(ox, bodyY, L * 0.5f, bodyR * 0.74f, sp.body); if (!rabbit) { for (int j = 0; j < 3; j++) for (int i = -(int)(L * 0.3f); i < (int)(L * 0.3f); i++) if ((i + j) % 2 == 0 || true) {} sellipse(ox + 0.5f, bodyY + bodyR * 0.45f, L * 0.36f, bodyR * 0.3f, sp.belly, 0.9f); } }
    if (sp.features & AF_SPOTS) { if (std::string(sp.name) == "cow") { u32 sd = s.seed; sellipse(ox - 2 + (sd & 1) * 2, bodyY - 1.5f, 3.2f, 2.3f, sp.mark, 0.9f); sellipse(ox + 4, bodyY + 1, 2.2f, 1.9f, sp.mark, 0.9f); sellipse(ox - 6, bodyY + 1.5f, 1.6f, 1.6f, sp.mark, 0.9f); } else { for (int k = 0; k < 6; k++) putpx((int)(ox - 5 + k * 2), (int)(bodyY - 2 + (k % 3)), HEX(sp.mark)); } }
    if (dog) { // saddle patch & tan markings
      sellipse(ox - 1.5f, bodyY - 1.8f, 4.8f, 2.4f, 0x2a2630); sellipse(ox + 5.5f, bodyY + 0.5f, 1.8f, 2.5f, sp.belly); sellipse(ox + 3.5f, bodyY + 2, 2.2f, 1.2f, sp.mark); }
    if (wolf) { sellipse(ox - 1, bodyY - 2, 5.5f, 2.2f, sp.mark); }
    if (sp.features & AF_BUSHY && std::string(sp.name) == "boar") { for (int k = 0; k < 7; k++) { int x = (int)(ox - 5 + k * 1.6f); putpx(x, (int)(bodyY - bodyR * 0.74f) - 1 + (k & 1), HEX(0x2a1e18)); } }
    if (sp.features & AF_UDDER) fellipse(ox - 2.5f, bodyY + bodyR * 0.8f, 2.0f, 1.2f, HEX(0xf4a0a8));
    // neck + head
    float hr = sp.headR; u32 hc = sp.body; if (std::string(sp.name) == "cow") hc = sp.body;
    if (!rabbit) scap(bx1 - 1.5f, bodyY - 0.5f, headX - 0.8f, headY + 0.5f, std::max(1.8f, bodyR * 0.42f), sp.body, 1.0f);
    if (dog || wolf) { /* muzzle */ sellipse(headX, headY, hr * 0.95f, hr * 0.9f, hc); sellipse(headX + hr * 0.95f, headY + 0.9f, hr * 0.8f, hr * 0.5f, dog ? 0xf4f0ea : (wolf ? 0xc8ccd4 : hc)); fcircle(headX + hr * 1.7f, headY + 0.4f, 0.9f, HEX(sp.nose)); if (s.pant > 0 || s.wag > 0) { fellipse(headX + hr * 1.1f, headY + 2.3f + std::sin(s.t * 14) * 0.3f, 0.9f, 1.3f, HEX(0xe8587a)); } }
    else if (std::string(sp.name) == "fox") { sellipse(headX, headY, hr * 0.95f, hr * 0.85f, hc); sellipse(headX + hr * 0.8f, headY + 0.8f, hr * 0.85f, hr * 0.5f, 0xf8f0e0); putpx((int)(headX + hr * 1.6f), (int)(headY + 0.5f), HEX(0x1a1210)); }
    else if (rabbit) { sellipse(ox + L * 0.38f, bodyY - 1.5f, hr, hr * 0.9f, hc); putpx((int)(ox + L * 0.38f + hr), (int)(bodyY - 0.8f), HEX(sp.nose)); }
    else { sellipse(headX, headY, hr * 0.9f, hr * 0.85f, hc); sellipse(headX + hr * 0.75f, headY + hr * 0.35f, hr * 0.62f, hr * 0.5f, std::string(sp.name) == "cow" ? 0xf0a0a8 : (sp.features & AF_SNOUT) ? sp.nose : (std::string(sp.name) == "sheep" ? 0x4a4246 : sp.belly)); if (sp.features & AF_SNOUT) { putpx((int)(headX + hr * 1.2f), (int)(headY + hr * 0.4f), HEX(0x3a1a22)); putpx((int)(headX + hr * 1.2f), (int)(headY + hr * 0.4f + 1), HEX(0x3a1a22)); } }
    if (sp.features & AF_WOOL && !s.shorn) { sellipse(headX - 0.8f, headY - hr * 0.7f, hr * 0.8f, hr * 0.5f, sp.body); }
    float ex = rabbit ? ox + L * 0.38f : headX, ey = rabbit ? bodyY - 2.0f : headY - 0.4f;
    // eye (blinks)
    bool blink = std::fmod(s.t + s.seed * 0.37f, 4.1f) > 3.95f || s.sleeping || s.dead > 0; if (blink) hline((int)(ex + hr * 0.2f), (int)(ey), 2, HEX(0x1a1420)); else { putpx((int)(ex + hr * 0.3f), (int)(ey), HEX(0x14101a)); putpx((int)(ex + hr * 0.3f), (int)(ey - 1), HEX(0x2a2430)); putpx((int)(ex + hr * 0.3f) + 1, (int)(ey - 1), HEX(0xffffff)); if (std::string(sp.name) == "sheep" || std::string(sp.name) == "cow") {} }
    // ears
    float flick = std::sin(s.t * 3 + s.seed) > 0.96f ? 1.f : 0.f; float ey2 = headY - hr * 0.8f;
    if (sp.features & AF_LONGEAR) { float elen = rabbit ? 6.5f : 3.5f; float exr = (rabbit ? ox + L * 0.38f : headX) - 0.5f, eyr = rabbit ? bodyY - 3.2f : ey2; scap(exr, eyr, exr - (rabbit ? 1.2f : 0.8f) + flick, eyr - elen, rabbit ? 1.1f : 1.2f, hc, 1); if (rabbit) scap(exr, eyr - 1, exr - 1.2f + flick, eyr - elen + 1, 0.5f, 0xf0a0a8); else { putpx((int)exr, (int)(eyr - elen + 1), HEX(0x2a1c14)); } scap(exr + 1.6f, eyr, exr + 1.2f, eyr - elen + 0.5f, rabbit ? 1.0f : 1.1f, ramp(HEX(hc), -0.7f), 1); }
    else if (sp.features & AF_FLOP) { scap(headX - 1.2f, ey2 + 1, headX - 2.2f, ey2 + 4 + flick, 1.5f, dog ? 0x2a2630 : ramp(HEX(hc), -0.6f)); }
    else if (std::string(sp.name) == "cow") { scap(headX - 1.2f, ey2 + 1, headX - 4, ey2 + 1.5f + flick, 1.2f, hc); scap(headX - 0.5f, ey2 + 0.3f, headX - 0.5f, ey2 - 2.4f, 0.9f, 0xf4f0ea); scap(headX + 1.5f, ey2 + 0.3f, headX + 2.3f, ey2 - 2.2f, 0.9f, 0xf4f0ea); }
    else scap(headX - 1.5f, ey2 + 1, headX - 3.4f, ey2 + 2.2f + flick, 1.2f, std::string(sp.name) == "sheep" ? 0x3a3236 : ramp(HEX(hc), -0.6f));
    if (sp.features & AF_ANTLERS) { for (int k = 0; k < 2; k++) { float ax2 = headX - 0.5f + k * 1.5f; line((int)ax2, (int)ey2, (int)ax2 - 1 + k * 2, (int)ey2 - 6, HEX(0xd8c8a0)); line((int)ax2 - 1 + k * 2, (int)ey2 - 4, (int)ax2 + 2 + k * 2, (int)ey2 - 6, HEX(0xe8dcb8)); line((int)ax2 - 1 + k * 2, (int)ey2 - 2, (int)ax2 - 3 + k * 2, (int)ey2 - 4, HEX(0xc8b890)); } }
    if (sp.features & AF_TUSKS) { putpx((int)(headX + hr * 1.0f), (int)(headY + hr * 0.7f), HEX(0xf4f0e0)); putpx((int)(headX + hr * 1.1f), (int)(headY + hr * 0.7f) - 1, HEX(0xf4f0e0)); }
    if (sp.features & AF_HORNS) {}
    // near legs
    leg(2, false); leg(3, false);
    if (s.hurt > 0) {}
  }
  void draw(const AniState& s, int idx, int wx, int wy, bool flipLeft, bool flash = false, int cutRows = 0, float scale = 1.f) {
    const AniSpec& sp = ANISPEC[idx]; static Img buf(64, 56); std::fill(buf.p.begin(), buf.p.end(), 0u); Img* old = T; T = &buf; float ox = 32, oy = 48; render(s, sp, ox, oy); T = old;
    Img o = buf; outlineImg(o, HEX(0x1c1424));
    if (s.dead > 0) { Img r(64, 56); float a = std::min(1.f, s.dead) * 1.5708f; float c = std::cos(a), sn = std::sin(a); for (int y = 0; y < 56; y++) for (int x = 0; x < 64; x++) { float dx = x + .5f - 32, dy = y + .5f - oy; u32 col = o.get((int)std::floor(dx * c + dy * sn + 32), (int)std::floor(-dx * sn + dy * c + oy)); r.p[y * 64 + x] = col; } o = r; }
    int dw = (int)std::round(64 * scale), dh = (int)std::round(56 * scale); int bx = wx - dw / 2, by = wy - (int)std::round(oy * scale); int rows = cutRows > 0 ? dh - cutRows : dh;
    for (int j = 0; j < rows; j++) for (int i = 0; i < dw; i++) { int si = i * 64 / dw, sj = j * 56 / dh; u32 c = o.p[sj * 64 + (flipLeft ? 63 - si : si)]; if (!(c >> 24)) continue; if (flash) c = mixc(c, HEX(0xffffff), 0.75f); putpx(bx + i, by + j, c); }
  }
};
