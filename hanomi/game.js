/* Hanomi — dependency-free canvas world. Original procedural artwork by Nikit + Codex.
 * Terrain is cached in 256px chunks; actors and props are culled and depth sorted.
 * A seeded generator + sparse changes keep portable save files small. */
"use strict";
(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s),
    cv = $("#world"),
    ctx = cv.getContext("2d", { alpha: false });
  const TILE = 16,
    N = 144,
    SIZE = N * TILE,
    VERSION = 1,
    SAVEKEY = "hanomi.worlds.v1";
  let W = 640,
    H = 400,
    scale = 3,
    state = null,
    mode = "home",
    clock = 0,
    last = 0,
    acc = 0,
    uiTick = 0,
    saveTick = 0,
    camera = { x: 1030, y: 1030 },
    keys = new Set(),
    stick = { x: 0, y: 0 },
    selected = 0,
    actionCooldown = 0,
    swing = 0,
    fishing = null,
    soundOn = false,
    audio = null,
    toastTimer,
    particles = [],
    enemies = [],
    animals = [],
    npcs = [],
    props = [],
    spatial = new Map(),
    chunks = new Map(),
    tilemap = new Uint8Array(N * N),
    seed = 12345,
    storageOK = true;
  const tools = ["axe", "pickaxe", "hoe", "rod", "sword", "seed"];
  const names = {
    axe: "Axe",
    pickaxe: "Pickaxe",
    hoe: "Hoe",
    rod: "Fishing rod",
    sword: "Sword",
    seed: "Seeds",
    wood: "Timber",
    stone: "Stone",
    ore: "Iron ore",
    berry: "Wild berries",
    fish: "River fish",
    crop: "Turnips",
    meat: "Venison",
    fence: "Palisade",
    torch: "Lantern",
    cabin: "Cottage",
    guard: "Guard",
    feed: "Animal feed",
    chicken: "Hen",
    egg: "Egg",
    coin: "Coins",
    ironSword: "Iron sword",
  };
  const factions = {
    willow: { name: "Willow Commune", x: 34 * 16, y: 47 * 16 },
    amber: { name: "Amber Reach", x: 117 * 16, y: 94 * 16 },
  };
  const recipes = {
    fence: { wood: 4 },
    torch: { wood: 2, ore: 1 },
    cabin: { wood: 30, stone: 20 },
    guard: { wood: 10, ore: 6, coin: 15 },
    feed: { crop: 2 },
    chicken: { wood: 5, coin: 8 },
    ironSword: { wood: 5, ore: 10 },
  };
  const palette = {
    grass: ["#78955a", "#7c995d", "#809b60", "#759257"],
    deep: "#234f46",
    water: "#438981",
    sand: "#c9bb85",
    path: "#c6b583",
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    hash = (x, y, z = seed) => {
      let h = Math.imul(x ^ z, 374761393) ^ Math.imul(y, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
  function rand(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const sprites = {};
  function sprite(name, w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    draw(g);
    sprites[name] = c;
    return c;
  }
  function rect(g, c, x, y, w, h) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function poly(g, c, points) {
    g.fillStyle = c;
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  function ellipse(g, c, x, y, rx, ry) {
    g.fillStyle = c;
    for (let yy = -Math.ceil(ry); yy <= ry; yy++) {
      const extent = Math.floor(
        rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))),
      );
      if (extent > 0)
        g.fillRect(
          Math.round(x) - extent,
          Math.round(y) + yy,
          extent * 2 + 1,
          1,
        );
    }
  }
  function art() {
    for (let variant = 0; variant < 5; variant++)
      sprite("tree" + variant, 64, 84, (g) => {
        const r = rand(variant + 493);
        ellipse(g, "#294f3c66", 32, 72, 28, 9);
        rect(g, "#503d2c", 29, 41, 8, 31);
        rect(g, "#866143", 30, 43, 3, 27);
        poly(g, "#655039", [
          [31, 65],
          [20, 76],
          [28, 75],
          [35, 66],
          [43, 73],
          [40, 65],
        ]);
        const colors =
          variant === 4
            ? ["#516246", "#718153", "#91a166", "#b4ba7e"]
            : ["#244f43", "#326650", "#497b55", "#65935e"];
        for (let i = 0; i < 28; i++) {
          const x = 12 + r() * 39,
            y = 12 + r() * 38;
          ellipse(g, colors[0], x + 1, y + 4, 12, 12);
        }
        for (let i = 0; i < 38; i++) {
          const x = 11 + r() * 42,
            y = 9 + r() * 38;
          ellipse(
            g,
            colors[1 + (i % 3 === 0 ? 1 : 0)],
            x,
            y,
            9 + r() * 4,
            7 + r() * 5,
          );
          if (i % 2 === 0) {
            rect(g, colors[3], x - 3, y - 3, 4, 2);
            rect(g, colors[2], x + 2, y + 2, 5, 2);
          }
        }
      });
    sprite("pine", 50, 88, (g) => {
      ellipse(g, "#254c3f66", 26, 77, 21, 7);
      rect(g, "#624d37", 23, 47, 5, 31);
      for (let i = 0; i < 4; i++) {
        let y = 8 + i * 13;
        poly(g, "#214d42", [
          [25, y],
          [3 + i * 2, y + 34 - i * 2],
          [45 - i * 2, y + 34 - i * 2],
        ]);
        poly(g, "#3b7253", [
          [25, y],
          [7 + i * 2, y + 28 - i * 2],
          [26, y + 24],
        ]);
        rect(g, "#649162", 22 - i * 2, y + 16, 7, 2);
      }
    });
    sprite("sakura", 76, 87, (g) => {
      ellipse(g, "#32513e55", 38, 76, 31, 9);
      rect(g, "#6e4c3c", 35, 38, 7, 35);
      poly(g, "#6e4c3c", [
        [38, 58],
        [18, 37],
        [22, 34],
        [40, 50],
        [57, 33],
        [59, 38],
      ]);
      const r = rand(84);
      for (let i = 0; i < 48; i++) {
        let x = 12 + r() * 52,
          y = 10 + r() * 42;
        ellipse(
          g,
          ["#a66a79", "#cf8c95", "#e8adb0", "#f2c5b9"][i % 4],
          x,
          y,
          9,
          8,
        );
        if (i % 2) rect(g, "#f9d5c5", x - 2, y - 3, 3, 2);
      }
    });
    for (let v = 0; v < 3; v++)
      sprite("house" + v, 100, 110, (g) => {
        ellipse(g, "#2a46374d", 51, 99, 49, 9);
        rect(g, "#554638", 13, 55, 77, 40);
        rect(g, "#d2c18c", 16, 52, 71, 40);
        rect(g, "#aa996c", 16, 83, 71, 10);
        rect(g, "#715441", 16, 52, 5, 43);
        rect(g, "#715441", 82, 52, 5, 43);
        rect(g, "#856343", 16, 69, 71, 3);
        rect(g, "#6c503b", 45, 69, 19, 26);
        rect(g, "#3e3c2d", 49, 74, 12, 22);
        rect(g, "#a17a4c", 49, 74, 2, 21);
        rect(g, "#c5b681", 58, 84, 2, 2);
        for (let x of [25, 68]) {
          rect(g, "#6a503b", x - 2, 62, 14, 15);
          rect(g, "#355b51", x, 64, 10, 10);
          rect(g, "#d3c991", x + 4, 64, 2, 10);
          rect(g, "#b3bd86", x, 67, 10, 2);
          rect(g, "#604e35", x - 2, 77, 14, 3);
          rect(g, "#4f7650", x, 77, 10, 4);
          rect(g, "#e3a18a", x + 2, 76, 2, 3);
        }
        for (let y = 57; y < 92; y += 6) {
          rect(g, "#b7a777", 21, y, 23, 1);
          rect(g, "#bcab7d", 64, y, 17, 1);
        }
        for (let y = 77; y < 95; y += 4) rect(g, "#886442", 52, y, 7, 1);
        rect(g, "#a69c7b", 14, 91, 29, 4);
        for (let x = 15; x < 86; x += 9) rect(g, "#7d8066", x, 92, 1, 3);
        ellipse(g, "#6f573c", 83, 92, 6, 5);
        rect(g, "#aa8b58", 78, 85, 10, 9);
        rect(g, "#605840", 78, 86, 10, 2);
        rect(g, "#605840", 78, 91, 10, 1);
        rect(g, "#59764a", 18, 79, 3, 10);
        rect(g, "#6e8b51", 17, 82, 7, 3);
        rect(g, "#6e8b51", 18, 87, 6, 2);
        rect(g, "#dab28b", 19, 84, 2, 2);
        const roof =
          v === 1
            ? ["#4a5354", "#5d6c65", "#788278"]
            : v === 2
              ? ["#6e5943", "#8f7852", "#aa935d"]
              : ["#794b40", "#a2674d", "#bc8058"];
        poly(g, "#3f3e32", [
          [9, 58],
          [6, 52],
          [27, 16],
          [77, 16],
          [96, 52],
          [94, 58],
        ]);
        poly(g, roof[0], [
          [8, 53],
          [29, 15],
          [75, 15],
          [95, 53],
        ]);
        for (let y = 20; y < 53; y += 5) {
          const pad = (53 - y) * 0.55;
          rect(g, roof[1], 9 + pad, y, 85 - pad * 2, 3);
          for (let x = 15 + pad; x < 90 - pad; x += 11)
            rect(g, roof[2], x + (y % 2) * 3, y, 7, 1);
        }
        rect(g, "#d0a16e", 28, 14, 49, 3);
        rect(g, "#553d32", 7, 53, 89, 4);
        poly(g, "#674b38", [
          [35, 71],
          [54, 51],
          [73, 71],
        ]);
        poly(g, roof[1], [
          [37, 67],
          [54, 49],
          [72, 67],
        ]);
        rect(g, "#d3bc85", 42, 94, 28, 3);
        rect(g, "#a58b61", 39, 98, 34, 3);
        rect(g, "#927b55", 37, 102, 38, 3);
        rect(g, "#686455", 71, 10, 10, 20);
        rect(g, "#a2a18a", 70, 9, 12, 4);
        rect(g, "#484c40", 73, 9, 6, 2);
      });
    sprite("well", 36, 42, (g) => {
      ellipse(g, "#34503d55", 18, 36, 17, 5);
      rect(g, "#a69f7d", 6, 23, 25, 12);
      rect(g, "#6f7769", 8, 31, 21, 6);
      ellipse(g, "#bec0a0", 18, 24, 13, 6);
      ellipse(g, "#294e46", 18, 24, 9, 3);
      rect(g, "#70533a", 8, 8, 3, 20);
      rect(g, "#70533a", 26, 8, 3, 20);
      poly(g, "#9d634b", [
        [2, 12],
        [18, 1],
        [34, 12],
      ]);
      rect(g, "#d49b67", 4, 12, 28, 2);
      rect(g, "#dbbd7b", 17, 12, 1, 12);
    });
    sprite("rock", 28, 24, (g) => {
      ellipse(g, "#3d583b55", 14, 20, 13, 4);
      poly(g, "#65746b", [
        [2, 17],
        [5, 7],
        [12, 2],
        [22, 5],
        [27, 17],
        [22, 21],
        [8, 21],
      ]);
      poly(g, "#94a18a", [
        [5, 7],
        [12, 2],
        [22, 5],
        [19, 13],
        [4, 15],
      ]);
      rect(g, "#b6b89b", 10, 6, 7, 2);
      rect(g, "#7a8976", 19, 14, 6, 3);
    });
    sprite("ore", 28, 24, (g) => {
      g.drawImage(sprites.rock, 0, 0);
      rect(g, "#b9cebc", 7, 8, 5, 4);
      rect(g, "#dae0bc", 8, 8, 2, 2);
      rect(g, "#81999a", 17, 11, 6, 5);
      rect(g, "#bed5ca", 18, 11, 2, 3);
    });
    sprite("berry", 27, 24, (g) => {
      ellipse(g, "#3e5c3e66", 14, 21, 13, 3);
      ellipse(g, "#3a6844", 14, 13, 12, 9);
      ellipse(g, "#5b874b", 11, 10, 9, 6);
      for (let [x, y] of [
        [6, 13],
        [14, 9],
        [19, 15],
        [11, 17],
      ]) {
        rect(g, "#b65e68", x, y, 3, 3);
        rect(g, "#e9a492", x, y, 1, 1);
      }
    });
    sprite("fence", 18, 24, (g) => {
      rect(g, "#614b35", 0, 9, 18, 3);
      rect(g, "#9c8051", 0, 8, 18, 2);
      rect(g, "#614b35", 0, 17, 18, 3);
      rect(g, "#a9905e", 0, 16, 18, 2);
      rect(g, "#6a5238", 2, 4, 3, 19);
      rect(g, "#c0a574", 2, 3, 2, 19);
      rect(g, "#6a5238", 13, 4, 3, 19);
      rect(g, "#c0a574", 13, 3, 2, 19);
    });
    sprite("torch", 16, 34, (g) => {
      rect(g, "#69553c", 7, 12, 3, 20);
      rect(g, "#3e4e3b", 4, 6, 9, 12);
      rect(g, "#c6b37b", 5, 6, 7, 2);
      rect(g, "#e8ba63", 6, 9, 5, 7);
      rect(g, "#ffe7a3", 7, 10, 3, 4);
      rect(g, "#8b7853", 5, 3, 7, 3);
      rect(g, "#8b7853", 8, 1, 2, 3);
    });
    sprite("sign", 28, 32, (g) => {
      rect(g, "#765b3c", 13, 12, 3, 19);
      rect(g, "#624e38", 2, 4, 25, 14);
      rect(g, "#b6a070", 3, 3, 23, 13);
      rect(g, "#d6c28a", 4, 4, 21, 2);
      rect(g, "#796341", 7, 8, 12, 1);
      rect(g, "#796341", 7, 11, 9, 1);
    });
    sprite("campfire", 24, 25, (g) => {
      ellipse(g, "#626e54", 12, 20, 11, 4);
      rect(g, "#614c38", 4, 17, 15, 3);
      poly(g, "#d88446", [
        [7, 18],
        [8, 9],
        [11, 12],
        [15, 3],
        [18, 14],
        [16, 19],
      ]);
      poly(g, "#f3c774", [
        [11, 18],
        [12, 11],
        [15, 14],
        [15, 18],
      ]);
    });
    sprite("crop", 16, 23, (g) => {
      rect(g, "#cab686", 6, 15, 5, 5);
      rect(g, "#d9cda0", 6, 15, 4, 2);
      rect(g, "#455f39", 8, 5, 2, 12);
      poly(g, "#84a650", [
        [8, 12],
        [2, 6],
        [2, 3],
        [7, 5],
        [9, 9],
        [12, 2],
        [15, 2],
        [13, 9],
      ]);
      rect(g, "#b0c56b", 3, 4, 3, 2);
    });
    sprite("sprout", 16, 16, (g) => {
      rect(g, "#40583b", 7, 7, 2, 8);
      rect(g, "#a2b95e", 3, 5, 5, 3);
      rect(g, "#93af58", 9, 3, 4, 4);
    });
    for (const kind of ["player", "npc", "guard", "zombie"])
      for (let f = 0; f < 4; f++)
        sprite(kind + f, 22, 34, (g) => {
          const zombie = kind === "zombie",
            guard = kind === "guard",
            npc = kind === "npc";
          ellipse(g, "#29433366", 11, 31, 8, 3);
          const walk = f % 2 ? 2 : 0;
          rect(g, "#35473b", 6, 24, 4, 7 - walk);
          rect(g, "#35473b", 12, 24, 4, 7);
          rect(g, "#5d4a36", 5, 29 - walk, 5, 3);
          rect(g, "#5d4a36", 12, 29, 5, 3);
          rect(
            g,
            zombie
              ? "#64765b"
              : npc
                ? "#c18e61"
                : guard
                  ? "#8e9990"
                  : "#d5c490",
            5,
            15,
            12,
            11,
          );
          rect(g, zombie ? "#768a60" : "#e2b78c", 3, 17, 3, 7);
          rect(g, zombie ? "#768a60" : "#e2b78c", 17, 17, 3, 7);
          rect(g, "#624f3a", 5, 23, 12, 2);
          rect(g, "#d7bb71", 10, 23, 2, 2);
          rect(g, zombie ? "#90a270" : "#e4bb8c", 6, 5, 10, 10);
          rect(g, zombie ? "#3a5142" : "#553e32", 5, 3, 12, 6);
          rect(g, "#3d3e31", 8, 10, 2, 2);
          rect(g, "#3d3e31", 14, 10, 1, 2);
          if (!zombie) {
            rect(g, "#7d8e5b", 4, 3, 14, 3);
            rect(g, "#aebe7d", 6, 0, 10, 4);
            rect(g, "#7d8e5b", 2, 6, 19, 2);
            rect(g, "#d0ad73", 5, 5, 12, 1);
            if (guard) {
              rect(g, "#778b88", 5, 2, 13, 6);
              rect(g, "#c4c8ab", 8, 1, 7, 2);
              rect(g, "#afc2ba", 19, 13, 2, 17);
              rect(g, "#79694a", 18, 22, 4, 2);
            }
          }
        });
    sprite("deer", 30, 32, (g) => {
      ellipse(g, "#2c503c44", 15, 29, 13, 3);
      rect(g, "#9f7951", 6, 15, 17, 10);
      rect(g, "#c3a270", 7, 15, 14, 6);
      rect(g, "#755d40", 7, 24, 3, 7);
      rect(g, "#755d40", 20, 24, 2, 7);
      rect(g, "#c3a270", 20, 6, 6, 15);
      rect(g, "#dab785", 23, 8, 6, 7);
      rect(g, "#3f4535", 26, 9, 2, 2);
      rect(g, "#836b49", 20, 0, 2, 8);
      rect(g, "#836b49", 18, 2, 6, 2);
      rect(g, "#e7d0a1", 4, 15, 4, 4);
    });
    sprite("chicken", 17, 20, (g) => {
      ellipse(g, "#304e3a44", 8, 17, 8, 3);
      ellipse(g, "#ebe2b8", 8, 11, 7, 5);
      rect(g, "#f4eac6", 11, 5, 5, 8);
      rect(g, "#b8634d", 12, 2, 3, 4);
      rect(g, "#e1b556", 15, 8, 2, 2);
      rect(g, "#3d4433", 14, 7, 1, 1);
      rect(g, "#bda465", 5, 15, 1, 4);
      rect(g, "#bda465", 10, 15, 1, 4);
      rect(g, "#c6c39c", 2, 9, 5, 3);
    });
    sprite("dog", 28, 27, (g) => {
      ellipse(g, "#2b4a3c55", 14, 24, 12, 3);
      rect(g, "#393b35", 6, 13, 16, 8);
      rect(g, "#bd874c", 7, 19, 3, 6);
      rect(g, "#bd874c", 19, 19, 3, 6);
      rect(g, "#3e3b32", 17, 7, 8, 11);
      rect(g, "#2b302c", 16, 5, 3, 9);
      rect(g, "#2b302c", 23, 5, 3, 9);
      rect(g, "#b4814d", 19, 13, 7, 4);
      rect(g, "#e7d8a4", 21, 10, 1, 1);
      rect(g, "#b99565", 16, 17, 7, 2);
      rect(g, "#34382e", 3, 9, 3, 9);
    });
    for (const type of Object.keys(names))
      if (!sprites["icon-" + type])
        sprite("icon-" + type, 20, 20, (g) => {
          if (sprites[type]) {
            const s = sprites[type];
            g.drawImage(s, 0, 0, s.width, s.height, 2, 1, 16, 18);
            return;
          }
          if (
            ["axe", "pickaxe", "hoe", "sword", "ironSword", "rod"].includes(
              type,
            )
          ) {
            rect(g, "#a5814e", 9, 6, 2, 13);
            if (type === "axe") {
              rect(g, "#95aea0", 4, 3, 9, 6);
              rect(g, "#d9dec1", 4, 3, 3, 5);
            } else if (type === "pickaxe") {
              rect(g, "#adc2b0", 3, 3, 14, 3);
              rect(g, "#adc2b0", 3, 5, 2, 4);
            } else if (type === "hoe") {
              rect(g, "#b6bd9d", 4, 3, 9, 4);
            } else if (type === "rod") {
              rect(g, "#a98951", 8, 2, 2, 16);
              rect(g, "#d3d5a6", 10, 2, 7, 1);
              rect(g, "#d3d5a6", 16, 2, 1, 12);
              rect(g, "#d88265", 15, 13, 3, 3);
            } else {
              rect(
                g,
                type === "ironSword" ? "#e3e4c9" : "#b5c6b3",
                9,
                1,
                3,
                12,
              );
              rect(g, "#d3b770", 5, 12, 11, 2);
            }
          } else if (type === "wood") {
            rect(g, "#785a3b", 3, 5, 14, 10);
            rect(g, "#ad8553", 4, 5, 12, 2);
            ellipse(g, "#d0aa70", 5, 10, 4, 5);
            ellipse(g, "#a47b4b", 5, 10, 2, 3);
          } else if (type === "seed") {
            rect(g, "#c2a875", 5, 7, 10, 11);
            rect(g, "#9a7b4b", 7, 5, 6, 3);
            rect(g, "#6d8c47", 8, 10, 4, 4);
          } else if (type === "fish") {
            ellipse(g, "#9ebda7", 10, 10, 6, 3);
            poly(g, "#d7d9aa", [
              [14, 10],
              [19, 6],
              [19, 14],
            ]);
            rect(g, "#354f44", 5, 9, 1, 1);
          } else if (type === "meat") {
            ellipse(g, "#b57965", 10, 10, 7, 5);
            ellipse(g, "#dba08a", 9, 9, 5, 3);
          } else if (type === "coin") {
            ellipse(g, "#b99b51", 10, 11, 6, 7);
            ellipse(g, "#e0c578", 10, 9, 6, 6);
            rect(g, "#a98b43", 9, 6, 2, 7);
          } else {
            ellipse(g, "#d5c790", 10, 11, 6, 5);
            rect(g, "#90a15c", 9, 3, 2, 5);
          }
        });
  }
  art();
  for (let v = 0; v < 5; v++) {
    const g = sprites["tree" + v].getContext("2d"),
      r = rand(v + 112);
    for (let i = 0; i < 160; i++) {
      let x = 8 + r() * 49,
        y = 12 + r() * 40;
      const pixel = g.getImageData(x | 0, y | 0, 1, 1).data;
      if (pixel[3] > 200) {
        rect(g, i % 3 ? "#85a467" : "#3c6d4b", x, y, 2 + (i % 2), 1);
        if (i % 5 === 0) rect(g, "#a7b77b", x, y - 1, 1, 1);
      }
    }
  }
  {
    const g = sprites.sakura.getContext("2d"),
      r = rand(147);
    for (let i = 0; i < 240; i++) {
      let x = 5 + r() * 65,
        y = 5 + r() * 53;
      const p = g.getImageData(x | 0, y | 0, 1, 1).data;
      if (p[3] > 200) {
        rect(
          g,
          ["#efb5b4", "#f7c9bc", "#ce8e9c", "#e2a3a7"][i % 4],
          x,
          y,
          2,
          1,
        );
        if (i % 4 === 0) rect(g, "#f9dac7", x + 1, y - 1, 2, 1);
      }
    }
  }
  sprite("flowers", 20, 20, (g) => {
    for (let i = 0; i < 7; i++) {
      let x = 2 + hash(i, 42) * 16,
        y = 8 + hash(i, 43) * 9;
      rect(g, "#4e794b", x, y, 1, 5);
      rect(g, i % 2 ? "#edcf9c" : "#e9b0a1", x - 1, y, 3, 2);
      rect(g, "#d8b96f", x, y, 1, 1);
    }
  });
  sprite("banner", 24, 45, (g) => {
    rect(g, "#64583d", 5, 2, 3, 40);
    rect(g, "#c7b77e", 4, 1, 5, 3);
    poly(g, "#a45f4d", [
      [8, 5],
      [22, 5],
      [22, 27],
      [15, 23],
      [8, 27],
    ]);
    rect(g, "#ddc18a", 13, 10, 3, 10);
    rect(g, "#ddc18a", 10, 13, 9, 3);
    ellipse(g, "#45613d66", 7, 42, 7, 2);
  });
  for (let f = 0; f < 4; f++)
    sprite("raider" + f, 22, 34, (g) => {
      g.drawImage(sprites["guard" + f], 0, 0);
      rect(g, "#9c6051", 6, 16, 11, 7);
      rect(g, "#ceb077", 10, 17, 3, 5);
    });
  sprite("barrel", 16, 22, (g) => {
    ellipse(g, "#35573c55", 8, 20, 8, 2);
    rect(g, "#98784b", 2, 5, 12, 14);
    rect(g, "#ba9760", 3, 6, 3, 12);
    rect(g, "#6f6247", 2, 8, 12, 2);
    rect(g, "#6f6247", 2, 15, 12, 2);
    ellipse(g, "#d0ac76", 8, 5, 6, 3);
    ellipse(g, "#9a794c", 8, 5, 4, 2);
  });

  function tile(x, y) {
    return x < 0 || y < 0 || x >= N || y >= N ? 2 : tilemap[y * N + x];
  }
  function terrain() {
    tilemap.fill(0);
    chunks.clear();
    const path = (x, y) =>
      Math.abs(x - 72) < 2 ||
      (Math.abs(y - 71) < 2 && x > 48 && x < 104) ||
      (Math.abs(y - 85) < 2 && x > 59 && x < 90);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let t = 0;
        const river = 94 + Math.sin(y * 0.065) * 8 + Math.sin(y * 0.14) * 2;
        const pond = ((x - 83) / 9) ** 2 + ((y - 68) / 7) ** 2;
        const lake = ((x - 34) / 15) ** 2 + ((y - 108) / 11) ** 2;
        let water = Math.abs(x - river) < 3.1 || pond < 1 || lake < 1;
        if (water) t = 2;
        else if (Math.abs(x - river) < 4.5 || pond < 1.25 || lake < 1.17) t = 3;
        else if (path(x, y)) t = 1;
        if (
          (Math.abs(y - 47) < 2 && x >= 32 && x < 73) ||
          (Math.abs(y - 94) < 2 && x > 71 && x < 120)
        )
          t = 1;
        if (
          ((y > 76 && y < 80) || Math.abs(y - 94) < 2) &&
          Math.abs(x - river) < 6
        )
          t = 4;
        if (x > 59 && x < 68 && y > 77 && y < 84) t = 5;
        tilemap[y * N + x] = t;
      }
  }
  function addProp(p) {
    props.push(p);
    const key = ((p.x / 64) | 0) + "," + ((p.y / 64) | 0);
    if (!spatial.has(key)) spatial.set(key, []);
    spatial.get(key).push(p);
  }
  function generate() {
    terrain();
    props = [];
    spatial.clear();
    const r = rand(seed);
    for (let y = 3; y < N - 3; y++)
      for (let x = 3; x < N - 3; x++) {
        if (tile(x, y) !== 0 || Math.abs(x - 72) < 4) continue;
        const village = x > 53 && x < 89 && y > 55 && y < 90;
        const settlement =
          (x > 28 && x < 41 && y > 40 && y < 53) ||
          (x > 110 && x < 125 && y > 87 && y < 101);
        if (settlement) continue;
        const h = r();
        const id = x + "," + y;
        if (village) {
          if (h < 0.028 && !(x > 60 && x < 69 && y > 75 && y < 85))
            addProp({ id, type: "berry", x: x * 16 + 8, y: y * 16 + 8 });
          continue;
        }
        if (h < 0.11)
          addProp({
            id,
            type: y < 40 ? "pine" : "tree" + ((r() * 5) | 0),
            x: x * 16 + 8,
            y: y * 16 + 8,
            hp: 3,
          });
        else if (h < 0.132)
          addProp({
            id,
            type: x < 45 || y < 38 ? "ore" : "rock",
            x: x * 16 + 8,
            y: y * 16 + 8,
            hp: 3,
          });
        else if (h < 0.145)
          addProp({ id, type: "berry", x: x * 16 + 8, y: y * 16 + 8 });
      }
    const fixed = [
      ["house2", 32, 45, "willow-house"],
      ["house1", 38, 47, "willow-house2"],
      ["house0", 114, 92, "amber-house"],
      ["house1", 121, 94, "amber-house2"],
      ["banner", 34, 48, "willow"],
      ["banner", 117, 95, "amber"],
      ["well", 34, 44, "willow-well"],
      ["torch", 115, 94, "amber-light"],
      ["torch", 35, 47, "willow-light"],
      ["house0", 66, 66, "home"],
      ["house1", 76, 59, "workshop"],
      ["house2", 58, 72, "market"],
      ["house0", 77, 87, "council"],
      ["well", 72, 67, "well"],
      ["sakura", 77, 65, "sakura"],
      ["sakura", 61, 61, "sakura2"],
      ["sign", 73, 73, "sign"],
      ["campfire", 75, 75, "fire"],
      ["torch", 70, 71, "lamp1"],
      ["torch", 75, 71, "lamp2"],
      ["torch", 90, 77, "lamp3"],
      ["tree0", 56, 63, "v-tree1"],
      ["tree1", 54, 66, "v-tree2"],
      ["tree2", 62, 57, "v-tree3"],
      ["tree3", 84, 58, "v-tree4"],
      ["tree1", 88, 61, "v-tree5"],
      ["tree0", 55, 81, "v-tree6"],
      ["tree2", 57, 86, "v-tree7"],
      ["tree1", 88, 86, "v-tree8"],
      ["tree3", 86, 89, "v-tree9"],
      ["sakura", 69, 90, "v-tree10"],
    ];
    for (let [type, x, y, id] of fixed)
      addProp({ type, x: x * 16, y: y * 16, id });
    for (let i = 0; i < 22; i++) {
      const x = 61 + hash(i, 11) * 16,
        y = 61 + hash(i, 12) * 26;
      if (tile(x | 0, y | 0) === 0)
        addProp({ type: "flowers", x: x * 16, y: y * 16, id: "flowers" + i });
    }
    for (const [x, y] of [
      [64, 66],
      [57, 72],
      [78, 87],
      [75, 59],
    ])
      addProp({ type: "barrel", x: x * 16, y: y * 16, id: "barrel" + x });
    for (let x = 59; x <= 68; x++)
      for (let y of [76, 84])
        addProp({ type: "fence", x: x * 16, y: y * 16, id: "f" + x + "," + y });
    for (let y = 77; y < 84; y++)
      addProp({ type: "fence", x: 59 * 16, y: y * 16, id: "f59," + y });
    for (const p of state?.builds || [])
      if (p.type !== "henRecord") addProp({ ...p });
    npcs = [
      {
        x: 1168,
        y: 1008,
        name: "Hana",
        role: "gardener",
        kind: "npc",
        homeX: 1168,
        homeY: 1008,
      },
      {
        x: 944,
        y: 1184,
        name: "Ren",
        role: "trader",
        kind: "npc",
        homeX: 944,
        homeY: 1184,
      },
      {
        x: 1232,
        y: 1420,
        name: "Elder Sora",
        role: "elder",
        kind: "npc",
        homeX: 1232,
        homeY: 1420,
      },
    ];
    animals = [];
    for (let i = 0; i < 18; i++) {
      let x = 300 + r() * 1700,
        y = 300 + r() * 1700;
      if (tile((x / 16) | 0, (y / 16) | 0) !== 2)
        animals.push({ id: i, x, y, kind: "deer", a: r() * 6, t: r() * 4 });
    }
    for (let i = 0; i < 4; i++)
      animals.push({
        id: 30 + i,
        x: 1000 + i * 20,
        y: 1365,
        kind: "chicken",
        a: r() * 6,
        t: r() * 4,
      });
    for (const b of state?.builds || [])
      if (b.type === "henRecord")
        animals.push({
          id: b.animalId,
          x: b.x,
          y: b.y,
          kind: "chicken",
          a: 0,
          t: 0,
        });
  }
  function visibleProps(x, y, r = 90) {
    const list = [];
    for (let gy = ((y - r) / 64) | 0; gy <= (y + r) / 64; gy++)
      for (let gx = ((x - r) / 64) | 0; gx <= (x + r) / 64; gx++)
        for (const p of spatial.get(gx + "," + gy) || [])
          if (!removed(p) && Math.abs(p.x - x) < r && Math.abs(p.y - y) < r)
            list.push(p);
    return list;
  }
  function removed(p) {
    return !!state?.removed[p.id];
  }
  function groundChunk(cx, cy) {
    const key = cx + "," + cy;
    if (chunks.has(key)) {
      const cached = chunks.get(key);
      chunks.delete(key);
      chunks.set(key, cached);
      return cached;
    }
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    for (let yy = 0; yy < 16; yy++)
      for (let xx = 0; xx < 16; xx++) {
        let x = cx * 16 + xx,
          y = cy * 16 + yy,
          t = tile(x, y),
          px = xx * 16,
          py = yy * 16,
          h = hash(x, y);
        let color =
          t === 2
            ? palette.water
            : t === 3
              ? palette.sand
              : t === 1
                ? palette.path
                : t === 4
                  ? "#aa8b59"
                  : t === 5
                    ? "#8b7250"
                    : palette.grass[(h * 4) | 0];
        rect(g, color, px, py, 16, 16);
        const r = rand((x + y * N) ^ seed);
        if (t === 2) {
          for (let k = 0; k < 3; k++)
            rect(
              g,
              k === 1 ? "#53978b" : "#3a807b",
              px + r() * 13,
              py + r() * 14,
              (2 + r() * 5) | 0,
              1,
            );
          for (let [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ])
            if (tile(x + dx, y + dy) !== 2) {
              rect(
                g,
                "#91b19b",
                px + (dx === 1 ? 14 : 0),
                py + (dy === 1 ? 14 : 0),
                dx ? 2 : 16,
                dy ? 2 : 16,
              );
            }
        } else if (t === 4) {
          for (let i = 0; i < 16; i += 4) {
            rect(g, "#735b3f", px, py + i, 16, 1);
            rect(g, "#c2a375", px + 2, py + i + 1, 13, 1);
          }
          rect(g, "#d3b97c", px, py, 1, 16);
        } else if (t === 5) {
          for (let i = 2; i < 16; i += 4)
            rect(g, "#65533e", px + 1, py + i, 14, 1);
        } else {
          for (let k = 0; k < 7; k++) {
            let a = r() * 15,
              b = r() * 15;
            rect(
              g,
              t === 0 ? (k % 2 ? "#6c8c50" : "#8aa260") : "#b8a979",
              px + a,
              py + b,
              (1 + r() * 2) | 0,
              1,
            );
          }
          if (t === 0 && h > 0.76) {
            let a = px + 4 + r() * 8,
              b = py + 5 + r() * 7;
            rect(g, "#4e7a46", a, b, 1, 4);
            rect(g, "#60874c", a - 2, b + 1, 2, 1);
          }
          if (t === 0 && h > 0.94) {
            const col = ["#e4d5a1", "#e5b29e", "#bac7a0"][x % 3];
            for (let i = 0; i < 3; i++) {
              let a = px + r() * 14,
                b = py + r() * 14;
              rect(g, col, a, b, 2, 2);
              rect(g, "#c8aa65", a, b, 1, 1);
            }
          }
        }
      }
    chunks.set(key, c);
    if (chunks.size > 70) chunks.delete(chunks.keys().next().value);
    return c;
  }
  function drawSprite(type, x, y, flip = false, alpha = 1) {
    const s = sprites[type];
    if (!s) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(s, -((s.width / 2) | 0), -s.height + 4);
    ctx.restore();
  }
  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#345c46";
    ctx.fillRect(0, 0, W, H);
    let ox = Math.floor(camera.x - W / 2),
      oy = Math.floor(camera.y - H / 2);
    ctx.save();
    ctx.translate(-ox, -oy);
    for (
      let cy = Math.max(0, (oy / 256) | 0);
      cy <= Math.min(8, ((oy + H) / 256) | 0);
      cy++
    )
      for (
        let cx = Math.max(0, (ox / 256) | 0);
        cx <= Math.min(8, ((ox + W) / 256) | 0);
        cx++
      )
        ctx.drawImage(groundChunk(cx, cy), cx * 256, cy * 256);
    // Quiet moving water, koi and lily pads.
    for (let i = 0; i < 14; i++) {
      let x = 1326 + Math.sin(clock * 0.14 + i * 2) * 75,
        y = 1084 + Math.cos(clock * 0.17 + i * 1.9) * 51;
      if (x > ox - 20 && x < ox + W + 20 && y > oy - 20 && y < oy + H + 20) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.cos(clock * 0.14 + i * 2));
        ellipse(ctx, i % 3 ? "#e7bc8c" : "#c5d4bb", 0, 0, 4, 1.5);
        rect(ctx, "#b9684d", -1, -1, 2, 2);
        poly(ctx, "#bcd0ad", [
          [-3, 0],
          [-6, -2],
          [-6, 2],
        ]);
        ctx.restore();
      }
    }
    for (let i = 0; i < 10; i++) {
      let x = 1240 + hash(i, 3) * 150,
        y = 1020 + hash(i, 8) * 100;
      if (tile((x / 16) | 0, (y / 16) | 0) === 2) {
        ellipse(ctx, "#5a9665", x, y, 4, 2);
        if (i % 3 === 0) rect(ctx, "#ecd1b1", x, y - 2, 2, 2);
      }
    }
    const draw = [];
    for (const p of props)
      if (
        !removed(p) &&
        p.x > ox - 65 &&
        p.x < ox + W + 65 &&
        p.y > oy - 10 &&
        p.y < oy + H + 115
      )
        draw.push({
          y: p.y,
          draw: () => {
            drawSprite(p.type, p.x, p.y);
            if (p.type === "torch" && nightAmount() > 0.05)
              glow(p.x, p.y - 20, 26, 0.12);
          },
        });
    if (state) {
      for (const [id, crop] of Object.entries(state.crops)) {
        const [x, y] = id.split(",").map(Number),
          mature = state.elapsed - crop > 70;
        draw.push({
          y: y * 16 + 12,
          draw: () =>
            drawSprite(mature ? "crop" : "sprout", x * 16 + 8, y * 16 + 13),
        });
      }
      for (const a of animals)
        if (
          !state.hunted[a.id] &&
          a.x > ox - 25 &&
          a.x < ox + W + 25 &&
          a.y > oy - 20 &&
          a.y < oy + H + 35
        )
          draw.push({
            y: a.y,
            draw: () => drawSprite(a.kind, a.x, a.y, a.a > Math.PI),
          });
      for (const n of [...npcs, ...state.guards, ...enemies])
        if (
          n.x > ox - 30 &&
          n.x < ox + W + 30 &&
          n.y > oy - 20 &&
          n.y < oy + H + 40
        )
          draw.push({
            y: n.y,
            draw: () => {
              drawSprite(n.kind + (Math.floor(clock * 3) % 4), n.x, n.y);
              if ((n.kind === "zombie" || n.kind === "raider") && n.hp < 3) {
                rect(ctx, "#523e32", n.x - 8, n.y - 37, 16, 2);
                rect(ctx, "#bd986d", n.x - 8, n.y - 37, (16 * n.hp) / 3, 2);
              }
            },
          });
      const p = state.player;
      draw.push({
        y: p.y,
        draw: () => {
          drawSprite(
            "player" + (p.walk ? Math.floor(clock * 9) % 4 : 0),
            p.x,
            p.y,
            p.face < 0,
          );
          if (swing > 0) {
            ctx.save();
            ctx.translate(p.x, p.y - 13);
            ctx.rotate((1 - swing / 0.3) * 2 - 1);
            ctx.drawImage(
              sprites["icon-" + tools[selected]],
              p.face < 0 ? -24 : 9,
              -16,
              20,
              20,
            );
            ctx.restore();
          }
          if (fishing) {
            ctx.strokeStyle = "#ded6a1";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + 5, p.y - 18);
            ctx.lineTo(fishing.x, fishing.y);
            ctx.stroke();
            ellipse(
              ctx,
              clock > fishing.bite ? "#f4d57b" : "#d29b73",
              fishing.x,
              fishing.y + Math.sin(clock * 3),
              2,
              2,
            );
          }
        },
      });
      if (state.dog.follow)
        draw.push({
          y: state.dog.y,
          draw: () =>
            drawSprite("dog", state.dog.x, state.dog.y, state.dog.x > p.x),
        });
      else
        draw.push({
          y: state.dog.y,
          draw: () => drawSprite("dog", state.dog.x, state.dog.y),
        });
    } else {
      draw.push({ y: 1160, draw: () => drawSprite("player0", 1160, 1160) });
      draw.push({ y: 1170, draw: () => drawSprite("dog", 1185, 1170) });
      for (const n of npcs)
        draw.push({ y: n.y, draw: () => drawSprite("npc0", n.x, n.y) });
    }
    draw.sort((a, b) => a.y - b.y);
    for (const d of draw) d.draw();
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      rect(ctx, p.c, p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Petals drift across the valley, but never obscure play.
    if (!reducedMotion)
      for (let i = 0; i < 18; i++) {
        let x = ((i * 127 + clock * 7) % W) + ox,
          y = ((i * 83 + clock * 11) % H) + oy;
        rect(ctx, i % 2 ? "#e2bba177" : "#e9d5ac66", x, y, 2, 1);
      }
    ctx.restore();
    const night = nightAmount();
    if (night) {
      ctx.fillStyle = `rgba(16,29,58,${night * 0.56})`;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(-ox, -oy);
      for (const p of props)
        if (p.type === "torch" || p.type === "campfire")
          glow(p.x, p.y - 12, p.type === "torch" ? 37 : 50, night * 0.25);
      if (state) glow(state.player.x, state.player.y - 10, 42, night * 0.09);
      ctx.restore();
    }
    if (state?.player.hurt > 0) {
      ctx.fillStyle = `rgba(194,75,61,${state.player.hurt * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function glow(x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, `rgba(255,211,116,${a})`);
    g.addColorStop(1, "rgba(255,211,116,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function nightAmount() {
    if (!state) return 0;
    const hour = (8 + state.elapsed / 30) % 24;
    return hour > 18
      ? Math.min(1, (hour - 18) / 2)
      : hour < 6
        ? Math.min(1, (6 - hour) / 2)
        : 0;
  }
  function resize() {
    const ratio = 2;
    W = Math.ceil(innerWidth / ratio);
    H = Math.ceil(innerHeight / ratio);
    cv.width = W;
    cv.height = H;
    scale = innerWidth / W;
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener("resize", resize);
  resize();
  function blocked(x, y) {
    if (x < 32 || y < 32 || x > SIZE - 32 || y > SIZE - 32) return true;
    if (tile((x / 16) | 0, (y / 16) | 0) === 2) return true;
    return visibleProps(x, y, 80).some((p) =>
      p.type.startsWith("house")
        ? Math.abs(p.x - x) < 38 && y < p.y - 7 && y > p.y - 46
        : ["fence", "cabin"].includes(p.type)
          ? Math.abs(p.x - x) < 9 && Math.abs(p.y - y) < 8
          : (p.type.startsWith("tree") ||
              p.type === "pine" ||
              p.type === "sakura" ||
              p.type === "rock" ||
              p.type === "ore" ||
              p.type === "well") &&
            Math.abs(p.x - x) < 8 &&
            Math.abs(p.y - y) < 6,
    );
  }
  function move(a, dx, dy) {
    if (!blocked(a.x + dx, a.y)) a.x += dx;
    if (!blocked(a.x, a.y + dy)) a.y += dy;
  }
  function update(dt) {
    if (mode === "play" || mode === "home") clock += dt;
    if (mode === "home") {
      camera.x = 1140 + Math.sin(clock * 0.05) * 18;
      camera.y = 1110 + Math.cos(clock * 0.04) * 15;
      return;
    }
    if (mode !== "play" || !state) return;
    const p = state.player;
    state.elapsed += dt;
    awardMorning();
    actionCooldown = Math.max(0, actionCooldown - dt);
    swing = Math.max(0, swing - dt);
    p.hurt = Math.max(0, (p.hurt || 0) - dt);
    let dx =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
        stick.x,
      dy =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
        stick.y;
    let len = Math.hypot(dx, dy);
    p.walk = len > 0.1;
    if (len > 0.1) {
      if (fishing) fishing = null;
      const speed = (keys.has("shift") ? 91 : 64) * (p.food < 15 ? 0.7 : 1);
      move(
        p,
        (dx / Math.max(1, len)) * speed * dt,
        (dy / Math.max(1, len)) * speed * dt,
      );
      if (dx) p.face = dx < 0 ? -1 : 1;
      p.dx = dx / len;
      p.dy = dy / len;
    }
    p.food = Math.max(0, p.food - dt * 0.09);
    if (p.food === 0) p.hp = Math.max(1, p.hp - dt * 0.35);
    else if (p.food > 60) p.hp = Math.min(100, p.hp + dt * 0.12);
    camera.x = clamp(
      camera.x + (p.x - camera.x) * Math.min(1, dt * 6),
      W / 2,
      SIZE - W / 2,
    );
    camera.y = clamp(
      camera.y + (p.y - camera.y) * Math.min(1, dt * 6),
      H / 2,
      SIZE - H / 2,
    );
    const dog = state.dog;
    if (dog.follow && dist(dog, p) > 29)
      move(dog, (p.x - dog.x) * dt * 1.7, (p.y - dog.y) * dt * 1.7);
    for (const n of npcs) {
      let tx = n.homeX + Math.sin(clock * 0.15 + n.homeX) * 15,
        ty = n.homeY + Math.cos(clock * 0.15 + n.homeY) * 12;
      move(n, (tx - n.x) * dt * 0.5, (ty - n.y) * dt * 0.5);
    }
    for (const a of animals) {
      if (state.hunted[a.id]) continue;
      a.t -= dt;
      if (a.t < 0) {
        a.t = 2 + hash(a.id, clock | 0) * 4;
        a.a += 1.3;
      }
      let flee = dist(a, p) < 48 && a.kind === "deer";
      if (flee) a.a = Math.atan2(a.y - p.y, a.x - p.x);
      let speed = flee ? 65 : a.kind === "deer" ? 7 : 5;
      move(a, Math.cos(a.a) * speed * dt, Math.sin(a.a) * speed * dt);
    }
    for (const g of state.guards) {
      let target = enemies.find((e) => dist(e, g) < 180);
      if (target) {
        move(g, (target.x - g.x) * dt * 1.4, (target.y - g.y) * dt * 1.4);
        g.cd = (g.cd || 0) - dt;
        if (dist(g, target) < 24 && g.cd <= 0) {
          target.hp--;
          g.cd = 1;
          sparks(target.x, target.y - 10, "#c2c99a");
        }
      } else if (dist(g, p) > 60)
        move(g, (p.x - g.x) * dt * 0.8, (p.y - g.y) * dt * 0.8);
    }
    if (
      nightAmount() > 0.6 &&
      enemies.length < 7 &&
      hash(Math.floor(state.elapsed * 2), 19) > 0.97
    ) {
      const a = clock * 3,
        x = clamp(p.x + Math.cos(a) * 220, 40, SIZE - 40),
        y = clamp(p.y + Math.sin(a) * 220, 40, SIZE - 40);
      if (!blocked(x, y)) enemies.push({ x, y, kind: "zombie", hp: 3, cd: 0 });
    }
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.cd -= dt;
      const victim = state.guards.find((g) => dist(g, e) < 20) || p;
      let d = dist(e, p);
      if (d < 300 && d > 1)
        move(e, ((p.x - e.x) / d) * 22 * dt, ((p.y - e.y) / d) * 22 * dt);
      const barricade = visibleProps(e.x, e.y, 18).find(
        (b) => b.type === "fence" && state.builds.some((k) => k.id === b.id),
      );
      if (barricade && e.cd <= 0) {
        state.damage[barricade.id] = (state.damage[barricade.id] || 0) + 1;
        if (state.damage[barricade.id] > 7) state.removed[barricade.id] = true;
        e.cd = 1;
      }
      if (dist(e, victim) < 19 && e.cd <= 0) {
        victim.hp = (victim.hp ?? 100) - 8;
        victim.hurt = 0.7;
        e.cd = 1.2;
        tone(110, 0.15);
        if (p.hp <= 0) respawn();
      }
    }
    state.guards = state.guards.filter((g) => (g.hp ?? 100) > 0);
    if (state.raid && state.raid.targets.every((e) => e.hp <= 0)) {
      gain("coin", 35);
      gain("ore", 8);
      state.relations[state.raid.nation] -= 30;
      state.raid = null;
      toast(
        "Your company prevailed. +35 coins, +8 iron. The settlement will remember.",
      );
    }
    enemies = enemies.filter(
      (e) =>
        e.hp > 0 &&
        (e.kind === "raider" || (dist(e, p) < 600 && nightAmount() > 0.12)),
    );
    for (const q of particles) {
      q.life -= dt * 1.5;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 20 * dt;
    }
    particles = particles.filter((q) => q.life > 0);
    if (fishing && clock > fishing.bite + 2) {
      fishing = null;
      toast("The fish slipped away. Cast again.");
    }
    uiTick += dt;
    saveTick += dt;
    if (uiTick > 0.2) {
      uiTick = 0;
      updateHUD();
      checkQuests();
    }
    if (saveTick > 20) {
      saveTick = 0;
      save(false);
    }
  }
  function awardMorning() {
    const day = Math.floor((8 + state.elapsed / 30) / 24) + 1;
    const previous = state.lastTributeDay || 1;
    if (day > previous) {
      const allies = Object.values(state.relations).filter(
        (v) => v >= 30,
      ).length;
      if (allies) gain("coin", allies * 5 * (day - previous));
      state.lastTributeDay = day;
    }
  }
  function respawn() {
    const p = state.player;
    p.x = 1150;
    p.y = 1136;
    p.hp = 100;
    p.food = 65;
    state.inv.coin = Math.floor(state.inv.coin * 0.9);
    enemies = state.raid?.targets.filter((e) => e.hp > 0) || [];
    toast(
      "Hana brought you home. You lost a few coins, but your story continues.",
    );
  }
  function sparks(x, y, c) {
    for (let i = 0; i < 8; i++)
      particles.push({
        x,
        y,
        c,
        vx: (Math.random() - 0.5) * 40,
        vy: -Math.random() * 45,
        life: 1,
      });
  }
  function tone(freq = 440, dur = 0.08) {
    if (!soundOn) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator(),
        g = audio.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.05, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();

      o.stop(audio.currentTime + dur);
    } catch {}
  }
  function toast(msg) {
    $("#toast").textContent = msg;
    $("#toast").classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("on"), 3500);
  }
  function nearest() {
    const p = state.player,
      candidates = [];
    for (const n of npcs)
      if (dist(p, n) < 34)
        candidates.push({
          d: dist(p, n),
          kind: "npc",
          data: n,
          label: "Talk to " + n.name,
        });
    if (dist(p, state.dog) < 35)
      candidates.push({
        d: dist(p, state.dog),
        kind: "dog",
        label: "Spend time with Momo",
      });
    for (const b of visibleProps(p.x, p.y, 80)) {
      let d = dist(p, b);
      if (b.type === "banner" && d < 36)
        candidates.push({
          d,
          kind: "council",
          label: "Visit " + factions[b.id].name,
        });
      else if (
        b.type.startsWith("house") &&
        Math.abs(p.x - b.x) < 36 &&
        p.y > b.y - 6 &&
        p.y < b.y + 35
      )
        candidates.push({
          d: 1,
          kind:
            b.id === "home"
              ? "home"
              : b.id === "workshop"
                ? "workshop"
                : b.id === "market"
                  ? "market"
                  : b.id === "council"
                    ? "council"
                    : "home",
          label:
            b.id === "home"
              ? "Enter your cottage"
              : b.id === "workshop"
                ? "Visit the workshop"
                : b.id === "market"
                  ? "Visit the trader"
                  : b.id === "council"
                    ? "Village council"
                    : "Rest at the cottage",
        });
      else if (d < 32 && ["berry", "well", "campfire", "sign"].includes(b.type))
        candidates.push({
          d,
          kind: b.type,
          data: b,
          label:
            b.type === "berry"
              ? "Gather berries"
              : b.type === "well"
                ? "Drink fresh water"
                : b.type === "campfire"
                  ? "Cook by the fire"
                  : "Read the village sign",
        });
    }
    const tx = (p.x / 16) | 0,
      ty = (p.y / 16) | 0;
    for (let y = ty - 1; y <= ty + 1; y++)
      for (let x = tx - 1; x <= tx + 1; x++)
        if (
          state.crops[x + "," + y] !== undefined &&
          state.elapsed - state.crops[x + "," + y] > 70
        )
          candidates.push({
            d: 15,
            kind: "harvest",
            data: x + "," + y,
            label: "Harvest turnips",
          });
    const pondDist = Math.hypot(p.x - 1328, p.y - 1088);
    if (pondDist < 180 && pondDist > 85)
      candidates.push({ d: 30, kind: "pond", label: "Sit by the koi pond" });
    const hen = animals.find((a) => a.kind === "chicken" && dist(a, p) < 28);
    if (hen)
      candidates.push({
        d: dist(hen, p),
        kind: "hen",
        data: hen,
        label: "Care for a hen",
      });
    return candidates.sort((a, b) => a.d - b.d)[0];
  }
  function updateHUD() {
    if (!state) return;
    const h = (8 + state.elapsed / 30) % 24,
      day = Math.floor((8 + state.elapsed / 30) / 24) + 1;
    $("#day").textContent = "Day " + day;
    $("#time").textContent =
      `Spring · ${Math.floor(h) % 12 || 12}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
    $("#weather").textContent = nightAmount() > 0.4 ? "☾" : "☀";
    $("#health").textContent = Math.ceil(state.player.hp);
    $("#food").textContent = Math.ceil(state.player.food);
    const p = state.player;
    $("#region").textContent =
      p.x < 720 && p.y < 900
        ? "WILLOW COMMUNE"
        : p.x > 1760 && p.y > 1360 && p.y < 1700
          ? "AMBER REACH"
          : p.x < 720
            ? "THE MOSSWOOD"
            : p.y < 700
              ? "IRONVEIL HIGHLANDS"
              : p.x > 1570
                ? "AMBER REACH"
                : p.y > 1530
                  ? "STILLWATER WILDS"
                  : "HANOMI VILLAGE";
    const n = nearest();
    $("#prompt").innerHTML = fishing
      ? clock > fishing.bite
        ? "<kbd>SPACE</kbd> A bite! Reel it in!"
        : "Waiting for a bite…"
      : n
        ? "<kbd>E</kbd> " + n.label
        : "";
    $("#hotbar em").textContent = "";
    const seedCount = $("#hotbar button:last-child em");
    if (seedCount) seedCount.textContent = state.inv.seed;
  }
  function gain(type, n = 1) {
    state.inv[type] = (state.inv[type] || 0) + n;
    state.stats[type] = (state.stats[type] || 0) + n;
    tone(570, 0.07);
  }
  function target() {
    const p = state.player;
    return { x: p.x + (p.dx || 0) * 20, y: p.y + (p.dy || 1) * 20 };
  }
  function use() {
    if (mode !== "play" || actionCooldown > 0) return;
    const p = state.player,
      t = tools[selected];
    actionCooldown = 0.3;
    swing = 0.3;
    if (state.place) {
      placeBuild(state.place);
      return;
    }
    if (t === "rod") {
      fish();
      return;
    }
    if (t === "sword") {
      const reach = state.inv.ironSword ? 54 : 40,
        damage = state.inv.ironSword ? 2 : 1;
      let hits = 0;
      for (const e of enemies)
        if (e.hp > 0 && dist(e, p) < reach) {
          e.hp -= damage;
          hits++;
          sparks(e.x, e.y - 12, "#c4bc88");
          if (e.hp <= 0) {
            gain("coin", 3);
            state.stats.defeated++;
          }
        }
      for (const a of animals)
        if (a.kind === "deer" && !state.hunted[a.id] && dist(a, p) < reach) {
          state.hunted[a.id] = true;
          gain("meat", 2);
          hits++;
          sparks(a.x, a.y - 10, "#d0b287");
          toast("Gathered 2 venison. Cook it at the campfire.");
        }
      tone(hits ? 180 : 280);
      return;
    }
    const q = target(),
      tx = clamp((q.x / 16) | 0, 1, N - 2),
      ty = clamp((q.y / 16) | 0, 1, N - 2),
      id = tx + "," + ty;
    if (t === "hoe") {
      if (tile(tx, ty) === 0 || tile(tx, ty) === 5) {
        if (visibleProps(q.x, q.y, 20).some((a) => dist(a, q) < 18)) {
          toast("Clear a little space first.");
          return;
        }
        state.tilled[id] = true;
        tilemap[ty * N + tx] = 5;
        chunks.delete(((tx / 16) | 0) + "," + ((ty / 16) | 0));
        sparks(q.x, q.y, "#ae9467");
        tone(180);
      } else toast("Find a patch of grass to till.");
      return;
    }
    if (t === "seed") {
      if (tile(tx, ty) !== 5) {
        toast("Use your hoe on grass first, then plant a seed.");
        return;
      }
      if (state.crops[id] !== undefined) {
        toast("A turnip is already growing here.");
        return;
      }
      if (state.inv.seed < 1) {
        toast("Hana and Ren have more seeds.");
        return;
      }
      state.inv.seed--;
      state.crops[id] = state.elapsed;
      state.stats.planted++;
      sparks(q.x, q.y, "#c7d392");
      toast("A little beginning. Turnips grow in about a minute.");
      return;
    }
    const b = visibleProps(p.x, p.y, 50)
      .filter(
        (b) =>
          dist(p, b) < 36 &&
          ((t === "axe" && (b.type.startsWith("tree") || b.type === "pine")) ||
            (t === "pickaxe" && ["rock", "ore"].includes(b.type))),
      )
      .sort((a, b) => dist(a, q) - dist(b, q))[0];
    if (!b) {
      toast(
        t === "axe"
          ? "Stand close to a woodland tree to gather timber."
          : "Stand close to a rock or iron deposit to mine.",
      );
      return;
    }
    state.damage[b.id] = (state.damage[b.id] || 0) + 1;
    sparks(b.x, b.y - 15, t === "axe" ? "#c9ac79" : "#b0b69a");
    tone(t === "axe" ? 240 : 430);
    if (state.damage[b.id] >= 3) {
      state.removed[b.id] = true;
      const type = t === "axe" ? "wood" : b.type === "ore" ? "ore" : "stone",
        amount = type === "wood" ? 4 : 3;
      gain(type, amount);
      toast(`+${amount} ${names[type]}`);
    }
  }
  function fish() {
    if (fishing) {
      if (clock >= fishing.bite && clock <= fishing.bite + 2) {
        gain("fish");
        state.stats.fished++;
        toast("A river fish! Cook it or trade it with Ren.");
        sparks(fishing.x, fishing.y, "#c9debc");
      } else toast("A little too soon. Patience, wanderer.");
      fishing = null;
      return;
    }
    const p = state.player;
    let closest = null;
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++) {
        const tx = ((p.x / 16) | 0) + x,
          ty = ((p.y / 16) | 0) + y;
        if (tile(tx, ty) === 2) {
          const q = { x: tx * 16 + 8, y: ty * 16 + 8 },
            d = dist(q, p);
          if (d < 64 && (!closest || d < closest.d)) closest = { ...q, d };
        }
      }
    if (!closest) {
      toast("Cast beside the river or lake.");
      return;
    }
    if (Math.hypot(p.x - 1328, p.y - 1088) < 190) {
      toast("These koi are friends. Fish in the river or Stillwater Lake.");
      return;
    }
    fishing = { ...closest, bite: clock + 2 + Math.random() * 3 };
    toast("Watch the float. Press Space when a fish bites.");
  }
  function interact() {
    if (mode !== "play" || actionCooldown > 0) return;
    const n = nearest();
    if (!n) return;
    switch (n.kind) {
      case "berry":
        state.removed[n.data.id] = true;
        gain("berry", 3);
        toast("+3 wild berries · Eat from your backpack");
        break;
      case "harvest":
        delete state.crops[n.data];
        gain("crop", 3);
        gain("seed", 2);
        state.stats.harvested++;
        toast("+3 turnips, +2 seeds. The garden gives back.");
        break;
      case "well":
        state.player.food = Math.min(100, state.player.food + 8);
        toast("Cool, clear water. +8 nourishment");
        actionCooldown = 1;
        break;
      case "pond":
        openPond();
        break;
      case "dog":
        dogPanel();
        break;
      case "home":
        homePanel();
        break;
      case "workshop":
        craftPanel();
        break;
      case "market":
        tradePanel();
        break;
      case "council":
        councilPanel();
        break;
      case "campfire":
        cookPanel();
        break;
      case "sign":
        panel(
          "A place to begin",
          "Welcome to Hanomi",
          `<p class="description">Follow the lanterns home. The Mosswood lies west, iron sleeps in the northern hills, and the river winds east to Stillwater Lake.</p><p class="description">Tend the garden southwest of the well. Visit Hana for seeds, Ren for trade, and Elder Sora to shape the future of the village.</p><button class="primary" data-do="journal">Open field journal</button>`,
        );
        break;
      case "npc":
        if (n.data.role === "trader") tradePanel();
        else if (n.data.role === "elder") councilPanel();
        else {
          if (!state.gifts.hana) {
            gain("seed", 8);
            state.gifts.hana = true;
          }
          panel(
            "Hana · Village gardener",
            "Every seed is a promise.",
            `<p class="description">“I left you seeds to get started. Take your hoe to the garden southwest of the well. Plant, wander a little, and come back to something growing.”</p><p class="description">“The pond is our quiet place. Sit by it whenever the world feels too big. And Momo? He is already rather fond of you.”</p><button class="primary" data-do="seeds">Trade 2 berries for 5 seeds</button>`,
          );
        }
        break;
      case "hen":
        if ((state.inv.feed || 0) > 0) {
          state.inv.feed--;
          const last = state.eggTimes[n.data.id] ?? -100;
          if (state.elapsed - last > 90) {
            state.eggTimes[n.data.id] = state.elapsed;
            gain("egg", 2);
            toast("A happy hen. +2 eggs");
          } else toast("Fed your hen. Give her a little time to lay again.");
        } else toast("Craft animal feed from 2 turnips, then come back.");
        break;
    }
  }
  function placeBuild(type) {
    const q = target(),
      tx = (q.x / 16) | 0,
      ty = (q.y / 16) | 0,
      x = tx * 16 + 8,
      y = ty * 16 + 8;
    let radius = type === "cabin" ? 60 : 17;
    if (
      (tile(tx, ty) !== 0 && tile(tx, ty) !== 1) ||
      visibleProps(x, y, radius + 50).some(
        (b) =>
          dist({ x, y }, b) < radius + (b.type.startsWith("house") ? 50 : 0),
      )
    ) {
      toast("Find a clear patch of land with room to build.");
      return;
    }
    if (!(state.inv[type] > 0)) {
      state.place = null;
      return;
    }
    const p = {
      id: "built-" + Date.now(),
      type: type === "cabin" ? "house2" : type,
      x,
      y,
    };
    state.inv[type]--;
    state.builds.push(p);
    addProp(p);
    state.stats.built++;
    state.place = null;
    toast(names[type] + " placed. A little more like home.");
    save(false);
  }
  function readSaves() {
    try {
      const a = JSON.parse(localStorage.getItem(SAVEKEY) || "[]");
      return Array.isArray(a) ? a.filter(validWorld) : [];
    } catch {
      storageOK = false;
      return [];
    }
  }
  function save(notify = true) {
    if (!state) return;
    try {
      state.savedAt = Date.now();
      const saves = readSaves().filter((s) => s.id !== state.id);
      saves.unshift(state);
      localStorage.setItem(SAVEKEY, JSON.stringify(saves));
      if (notify) toast("Your story is saved on this device.");
    } catch {
      storageOK = false;
      toast(
        "Device storage is full or unavailable. Export your world to keep it safe.",
      );
    }
  }
  function createWorld(name, worldSeed) {
    const r = rand(worldSeed);
    state = {
      version: VERSION,
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 32) || "My Hanomi",
      seed: worldSeed,
      elapsed: 0,
      player: { x: 1152, y: 1155, hp: 100, food: 100, face: 1, dx: 0, dy: 1 },
      inv: {
        wood: 0,
        stone: 0,
        ore: 0,
        seed: 12,
        berry: 5,
        fish: 0,
        crop: 0,
        meat: 0,
        coin: 12,
        egg: 0,
      },
      removed: {},
      damage: {},
      tilled: {},
      crops: {},
      builds: [],
      guards: [],
      hunted: {},
      gifts: {},
      eggTimes: {},
      quests: {},
      stats: { planted: 0, harvested: 0, fished: 0, defeated: 0, built: 0 },
      dog: { x: 1180, y: 1167, follow: true, bond: 0 },
      relations: { willow: 0, amber: 0 },
      sound: false,
    };
    start();

    save(false);
    welcome();
  }
  function start() {
    seed = state.seed;
    generate();
    for (const id of Object.keys(state.tilled)) {
      const [x, y] = id.split(",").map(Number);
      tilemap[y * N + x] = 5;
    }
    enemies = state.raid?.targets || [];
    particles = [];
    fishing = null;
    selected = 0;
    actionCooldown = 0;
    swing = 0;
    uiTick = 0;
    saveTick = 0;
    state.place = null;
    soundOn = !!state.sound;
    camera = { x: state.player.x, y: state.player.y };
    $("#home").hidden = true;
    $("#hud").hidden = false;
    mode = "play";
    closePanel();
    hotbar();
    updateHUD();
    cv.focus();
  }
  function loadWorld(id) {
    const s = readSaves().find((s) => s.id === id);
    if (!s) return;
    state = structuredClone(s);
    start();

    toast("Welcome back to " + state.name + ".");
  }
  function refreshHome() {
    const a = readSaves();
    $("#continue").hidden = !a.length;
    $("#save-count").textContent = a.length;
  }
  function panel(over, title, html) {
    keys.clear();
    stick.x = stick.y = 0;
    $("#stick i").style.transform = "";
    mode = state ? "panel" : "home";
    $("#panel-body").innerHTML =
      `<div class="overline">${over}</div><h2>${title}</h2>${html}`;
    if (!$("#panel").open) $("#panel").showModal();
  }
  function closePanel() {
    if ($("#panel").open) $("#panel").close();
    if (state) {
      mode = "play";
      cv.focus();
    }
  }
  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function newPanel() {
    panel(
      "Your next chapter",
      "A world with your name on it.",
      `<p class="description">A valley, a cottage, a faithful companion. The rest is yours to discover.</p><form id="new-form"><label for="world-name">World name</label><input id="world-name" maxlength="32" value="My Hanomi" required autocomplete="off"><label for="world-seed">World seed <span style="opacity:.6">· optional</span></label><input id="world-seed" placeholder="A word, a memory, anything" maxlength="64"><button class="primary" type="submit">Let the story begin ↗</button></form><p class="quiet-note">Saved automatically on this device. Export a world any time to take it with you.</p>`,
    );
    $("#new-form").onsubmit = (e) => {
      e.preventDefault();
      let str = $("#world-seed").value || String(Date.now()),
        s = 0;
      for (const c of str) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
      createWorld($("#world-name").value, s);
    };
  }
  function worldsPanel() {
    const saves = readSaves();
    panel(
      "Your little corners of the world",
      "Stories worth coming back to.",
      `${saves.length ? saves.map((s) => `<div class="row"><div><strong>${esc(s.name)}</strong><small>Day ${Math.floor((8 + s.elapsed / 30) / 24) + 1} · ${new Date(s.savedAt).toLocaleDateString()}</small></div><button data-load="${s.id}">Wander on →</button><button class="danger" data-delete="${s.id}" aria-label="Delete ${esc(s.name)}">×</button></div>`).join("") : '<p class="description">Your first story is waiting to be written.</p>'}<button class="primary" data-do="new">Begin a new story</button><button class="text-button" style="color:#586e4d" data-do="import">Import a world file ↗</button><input id="import-file" type="file" accept=".json" hidden>`,
    );
    $("#import-file").onchange = importWorld;
  }
  function welcome() {
    panel(
      "A quiet beginning",
      "Welcome home, wanderer.",
      `<p class="description">This is your little corner of Hanomi. Meet Hana by the well, plant your first turnip, and let Momo show you around. The wilds get restless after dark.</p><div class="welcome-tools"><kbd>W A S D</kbd> or arrows to wander · <kbd>Shift</kbd> to run<br><kbd>E</kbd> meet, gather, rest & interact<br><kbd>Space</kbd> use your selected tool<br><kbd>1–6</kbd> choose tools · <kbd>B</kbd> backpack · <kbd>C</kbd> craft<br><kbd>J</kbd> journal · <kbd>M</kbd> map · <kbd>Esc</kbd> pause</div><p class="quiet-note">On touch screens, use the thumbstick and action buttons. Your world saves every 20 seconds. Export it from the pause menu for a backup.</p><button class="primary" data-do="close">Step into the valley →</button>`,
    );
  }
  function hotbar() {
    const b = $("#hotbar");
    b.innerHTML = "";
    tools.forEach((t, i) => {
      const btn = document.createElement("button");
      btn.className = i === selected ? "active" : "";
      btn.title = names[t] + " (" + (i + 1) + ")";
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("aria-pressed", i === selected);
      btn.innerHTML = `<small>${i + 1}</small><em></em>`;
      const c = sprites["icon-" + t].cloneNode();
      c.getContext("2d").drawImage(sprites["icon-" + t], 0, 0);
      btn.prepend(c);
      btn.onclick = () => {
        selected = i;
        state.place = null;
        fishing = null;
        hotbar();
      };
      b.append(btn);
    });
  }
  function inventory() {
    panel(
      "Travel light, live well",
      "Your backpack",
      `<p class="description">A few good things, gathered along the way.</p><div class="grid">${Object.entries(
        state.inv,
      )
        .filter(([k, v]) => v > 0)
        .map(
          ([k, v]) =>
            `<div class="item"><canvas data-icon="${k}" width="20" height="20"></canvas>${names[k] || k}<b>${v}</b>${["berry", "crop", "fish", "meat", "egg"].includes(k) ? `<div style="margin-top:8px"><button class="pill" data-eat="${k}">Eat · +${{ berry: 12, crop: 20, fish: 15, meat: 10, egg: 15 }[k]}</button></div>` : ["fence", "torch", "cabin"].includes(k) ? `<div style="margin-top:8px"><button class="pill" data-place="${k}">Place</button></div>` : ""}</div>`,
        )
        .join(
          "",
        )}</div><p class="quiet-note">Cook fish and venison at the campfire for a full meal. A fed wanderer heals over time.</p>`,
    );
    icons();
  }
  function icons() {
    document.querySelectorAll("[data-icon]").forEach((c) => {
      const s = sprites["icon-" + c.dataset.icon] || sprites["icon-seed"];
      c.getContext("2d").drawImage(s, 0, 0);
    });
  }
  function craftPanel() {
    panel(
      "Made by your own hands",
      "Make a little something.",
      `<p class="description">Gather timber in the woods and mine iron in the hills. Buildings and fences go into your backpack for placement.</p>${Object.entries(
        recipes,
      )
        .map(
          ([k, r]) =>
            `<div class="row"><div>${names[k]}<small>${Object.entries(r)
              .map(([t, n]) => `${n} ${names[t]} (${state.inv[t] || 0})`)
              .join(
                " · ",
              )}</small></div><button data-craft="${k}" ${Object.entries(r).every(([t, n]) => (state.inv[t] || 0) >= n) ? "" : "disabled"}>${k === "guard" ? "Recruit" : k === "chicken" ? "Adopt" : "Craft"}</button></div>`,
        )
        .join(
          "",
        )}<p class="quiet-note">Guards follow you and defend against the restless. Hens live near your cottage; feed them turnips to collect eggs. Palisades slow the night creatures.</p>`,
    );
  }
  function craft(type) {
    if (type === "guard" && state.guards.length >= 100) {
      toast("Your company has reached 100 guards.");
      return;
    }
    const r = recipes[type];
    if (!r || !Object.entries(r).every(([k, n]) => (state.inv[k] || 0) >= n))
      return;
    for (const [k, n] of Object.entries(r)) state.inv[k] -= n;
    if (type === "guard")
      state.guards.push({
        x: state.player.x + 10,
        y: state.player.y + 10,
        kind: "guard",
        cd: 0,
        hp: 100,
      });
    else if (type === "chicken") {
      const a = {
        id: Date.now(),
        x: state.player.x + 20,
        y: state.player.y,
        kind: "chicken",
        a: 0,
        t: 0,
      };
      animals.push(a);
      state.builds.push({
        id: "hen-" + a.id,
        type: "henRecord",
        x: a.x,
        y: a.y,
        animalId: a.id,
      });
    } else gain(type);
    tone(660);
    craftPanel();
    toast(
      type === "guard"
        ? "A guard has joined you."
        : type === "chicken"
          ? "A new friend for your little flock."
          : names[type] + " crafted.",
    );
  }
  function homePanel() {
    panel(
      "Your cottage",
      "Rest your wandering feet.",
      `<p class="description">A warm bed, a little light in the window. Sleep until morning to restore your health and let the garden grow.</p><button class="primary" data-do="sleep">Sleep until morning ☾</button><button class="text-button" style="color:#5b704f" data-do="save">Save this moment</button>`,
    );
  }
  function dogPanel() {
    panel(
      "Momo · Your faithful shadow",
      "The best kind of company.",
      `<pixel-dog width="190" scale="1.5" breed="rottie" home="70" start="sit" sleep-after="60"></pixel-dog><p class="description">Pet him, toss a ball, or just sit together. The original portfolio pup, right at home in Hanomi.</p><div class="row"><div>Friendship<small>${state.dog.bond} happy moments together</small></div><button data-do="pet">Give a little love ♥</button></div><div class="row"><div>${state.dog.follow ? "Momo is following you" : "Momo is waiting here"}</div><button data-do="dog-toggle">${state.dog.follow ? "Stay here" : "Come along"}</button></div><button class="primary" data-do="dog-feed" ${state.inv.meat < 1 && state.inv.fish < 1 ? "disabled" : ""}>Share a fish or venison</button>`,
    );
  }
  function tradePanel() {
    panel(
      "Ren · The village trader",
      "One good thing for another.",
      `<p class="description">“No treasure quite like an honest harvest. What have you brought today?”</p><p class="overline">Your purse · ${state.inv.coin} coins</p>${[
        ["crop", 3],
        ["fish", 5],
        ["meat", 4],
        ["egg", 3],
        ["ore", 3],
        ["berry", 1],
      ]
        .map(
          ([k, n]) =>
            `<div class="row"><div>${names[k]}<small>${state.inv[k] || 0} in your backpack</small></div><button data-sell="${k}" data-price="${n}" ${state.inv[k] > 0 ? "" : "disabled"}>Sell for ${n} ◉</button></div>`,
        )
        .join(
          "",
        )}<div class="row"><div>5 seeds</div><button data-do="buy-seeds" ${state.inv.coin < 3 ? "disabled" : ""}>Buy for 3 ◉</button></div>`,
    );
  }
  function cookPanel() {
    panel(
      "The village hearth",
      "Something warm to come home to.",
      `<p class="description">Cook a fish, venison, or turnip into a hearty meal. Each meal restores 45 nourishment and 15 health.</p>${["fish", "meat", "crop"].map((k) => `<div class="row"><div>${names[k]}<small>${state.inv[k]} available</small></div><button data-cook="${k}" ${state.inv[k] < 1 ? "disabled" : ""}>Cook & enjoy</button></div>`).join("")}`,
    );
  }
  function councilPanel() {
    panel(
      "Elder Sora · The village council",
      "A village does not grow alone.",
      `<p class="description">“Beyond the river are other settlements. Send gifts to earn their trust, form an alliance, or send your guards on a raid. Every choice leaves a mark.”</p>${[
        ["willow", "Willow Commune", "A peaceful farming settlement"],
        ["amber", "Amber Reach", "A guarded settlement in the east"],
      ]
        .map(([id, n, d]) => {
          const v = state.relations[id];
          return `<div class="row"><div>${n}<small>${d}<br>Trust: ${v} · ${v >= 30 ? "Allied" : v < 0 ? "Hostile" : "Neutral"}</small></div><button data-diplomacy="${id}" ${state.inv.crop < 3 ? "disabled" : ""}>Gift 3 turnips</button></div><div class="row"><small>${v >= 30 ? "Allies send 5 coins with each morning." : "Gifts build trust. Three gifts make an alliance."}</small><button class="danger" data-raid="${id}" ${state.guards.length < 3 || state.raid ? "disabled" : ""}>Raid · 3 guards</button></div>`;
        })
        .join(
          "",
        )}<p class="quiet-note">Raids start a real battle at the settlement. Lead your company there and defeat its five defenders. Guards can fall, and victory damages trust.</p>`,
    );
  }
  const questDefs = [
    [
      "welcome",
      "Meet the gardener",
      "Talk to Hana near the well.",
      (s) => s.gifts.hana,
      5,
    ],
    [
      "roots",
      "Put down roots",
      "Plant 3 seeds in tilled soil.",
      (s) => s.stats.planted >= 3,
      8,
    ],
    [
      "harvest",
      "The first harvest",
      "Harvest a turnip patch.",
      (s) => s.stats.harvested >= 1,
      10,
    ],
    [
      "timber",
      "Into the Mosswood",
      "Gather 12 timber with your axe.",
      (s) => (s.stats.wood || 0) >= 12,
      10,
    ],
    [
      "fish",
      "A patient heart",
      "Catch your first river fish.",
      (s) => s.stats.fished >= 1,
      10,
    ],
    [
      "build",
      "A mark of your own",
      "Place a crafted structure.",
      (s) => s.stats.built >= 1,
      15,
    ],
    [
      "night",
      "A light in the dark",
      "Defeat 3 restless creatures.",
      (s) => s.stats.defeated >= 3,
      20,
    ],
    [
      "ally",
      "A friend beyond the river",
      "Make an alliance with a settlement.",
      (s) => Object.values(s.relations).some((v) => v >= 30),
      30,
    ],
  ];
  function checkQuests() {
    for (const [id, title, , test, reward] of questDefs)
      if (!state.quests[id] && test(state)) {
        state.quests[id] = true;
        gain("coin", reward);
        toast(title + " · Journal milestone +" + reward + " coins");
      }
  }
  function journal() {
    panel(
      "A field guide to your own story",
      "Small beginnings. Big possibilities.",
      `${state.raid ? `<div class="quest">⚑ Rally at ${factions[state.raid.nation].name}<span>Defeat the settlement defenders · ${state.raid.targets.filter((e) => e.hp > 0).length} remaining</span></div>` : ""}${questDefs.map(([id, title, desc, , reward]) => `<div class="quest ${state.quests[id] ? "done" : ""}">${state.quests[id] ? "✓" : "○"} &nbsp;${title}<span>${desc} · ${reward} coins</span></div>`).join("")}<p class="quiet-note">Nothing here is a deadline. Follow the paths, go off the paths, or spend an afternoon by the koi pond.</p>`,
    );
  }
  function mapPanel() {
    panel(
      "The valley & beyond",
      "A place in the world.",
      `<canvas class="map-canvas" id="map" width="432" height="432" aria-label="Map of Hanomi valley"></canvas><div class="legend"><span><i style="background:#f5e8b3"></i>You</span><span><i style="background:#b58456"></i>Cottages</span><span><i style="background:#50928c"></i>Water</span><span><i style="background:#426e4c"></i>Woodland</span></div><p class="quiet-note">North: Ironveil Highlands · Northwest: Willow Commune<br>East: Amber Reach · South: Stillwater Lake</p>`,
    );
    const g = $("#map").getContext("2d");
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        g.fillStyle = [
          "#80965e",
          "#c6b183",
          "#50928c",
          "#bcb481",
          "#a4895b",
          "#8c7150",
        ][tile(x, y)];
        g.fillRect(x * 3, y * 3, 3, 3);
      }
    for (const b of props)
      if (!removed(b)) {
        g.fillStyle = b.type.startsWith("house")
          ? "#ac7851"
          : b.type.includes("tree") || b.type === "pine"
            ? "#426e4c"
            : b.type === "sakura"
              ? "#d9a397"
              : "#8b9671";
        g.fillRect(
          (b.x / SIZE) * 432,
          (b.y / SIZE) * 432,
          b.type.startsWith("house") ? 8 : 2,
          b.type.startsWith("house") ? 6 : 2,
        );
      }
    g.font = "10px sans-serif";
    for (const [id, f] of Object.entries(factions)) {
      const x = (f.x / SIZE) * 432,
        y = (f.y / SIZE) * 432;
      g.fillStyle = "#f3dfb0";
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = "#2e4935";
      g.fillText(f.name, x - 29, y - 8);
    }
    g.fillStyle = "#2e4935";
    g.fillText("Hanomi", 205, 205);
    g.strokeStyle = "#304d39";
    g.lineWidth = 2;
    g.fillStyle = "#fff1b9";
    g.beginPath();
    g.arc(
      (state.player.x / SIZE) * 432,
      (state.player.y / SIZE) * 432,
      4,
      0,
      Math.PI * 2,
    );
    g.fill();
    g.stroke();
  }
  function pause() {
    save(false);
    panel(
      "Take your time",
      esc(state.name),
      `<p class="description">Your world is saved. It will be right here when you return.</p><button class="primary" data-do="close">Return to the valley →</button><div class="row"><div>Gentle sound effects</div><button data-do="sound">${soundOn ? "On" : "Off"}</button></div><div class="row"><div>Keep a copy of your world<small>Move it to another browser or device.</small></div><button data-do="export">Export world</button></div><div class="row"><div>Find your way</div><button data-do="help">Controls</button></div><div class="row"><div>Until next time</div><button data-do="menu">Save & return home</button></div><p class="quiet-note">${storageOK ? "Autosaves every 20 seconds on this device. Clearing browser storage removes local worlds." : "Browser storage unavailable. Export your world before leaving."}</p>`,
    );
  }
  function exportWorld() {
    save(false);
    const blob = new Blob([JSON.stringify(state)], {
        type: "application/json",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.name.replace(/[^a-z0-9_-]/gi, "-") + ".hanomi.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function validWorld(s) {
    const finite = (n, min = -1e7, max = 1e7) =>
      Number.isFinite(n) && n >= min && n <= max;
    const object = (o) => o && typeof o === "object" && !Array.isArray(o);
    const point = (p) =>
      object(p) && finite(p.x, 0, SIZE) && finite(p.y, 0, SIZE);
    const grid = (o) =>
      object(o) &&
      Object.entries(o).length <= N * N &&
      Object.entries(o).every(([k, v]) => {
        const m = /^(\d{1,3}),(\d{1,3})$/.exec(k);
        return (
          m &&
          +m[1] < N &&
          +m[2] < N &&
          (typeof v === "boolean" || finite(v, 0))
        );
      });
    if (
      !object(s) ||
      s.version !== VERSION ||
      typeof s.name !== "string" ||
      !s.name.length ||
      s.name.length > 32 ||
      typeof s.id !== "string" ||
      s.id.length > 80 ||
      !finite(s.seed, 0, 4294967295) ||
      !finite(s.elapsed, 0) ||
      !point(s.player) ||
      !finite(s.player.hp, 0, 100) ||
      !finite(s.player.food, 0, 100)
    )
      return false;
    if (
      !object(s.inv) ||
      !Object.entries(s.inv).every(([k, v]) => k in names && finite(v, 0)) ||
      ![
        "wood",
        "stone",
        "ore",
        "seed",
        "berry",
        "fish",
        "crop",
        "meat",
        "coin",
        "egg",
      ].every((k) => finite(s.inv[k], 0))
    )
      return false;
    if (
      ![
        "removed",
        "damage",
        "hunted",
        "gifts",
        "eggTimes",
        "quests",
        "stats",
        "relations",
      ].every((k) => object(s[k]))
    )
      return false;
    if (
      !grid(s.tilled) ||
      !grid(s.crops) ||
      !["willow", "amber"].every((k) => finite(s.relations[k]))
    )
      return false;
    if (
      !["planted", "harvested", "fished", "defeated", "built"].every((k) =>
        finite(s.stats[k], 0),
      )
    )
      return false;
    if (
      !point(s.dog) ||
      !finite(s.dog.bond, 0) ||
      typeof s.dog.follow !== "boolean"
    )
      return false;
    if (
      !Array.isArray(s.builds) ||
      s.builds.length > 5000 ||
      !s.builds.every(
        (b) =>
          point(b) &&
          typeof b.id === "string" &&
          ["fence", "torch", "house2", "henRecord"].includes(b.type),
      )
    )
      return false;
    if (
      !Array.isArray(s.guards) ||
      s.guards.length > 100 ||
      !s.guards.every(
        (g) => point(g) && g.kind === "guard" && finite(g.hp ?? 100, 0, 100),
      )
    )
      return false;
    if (
      s.raid &&
      (!object(s.raid) ||
        !factions[s.raid.nation] ||
        !Array.isArray(s.raid.targets) ||
        s.raid.targets.length !== 5 ||
        !s.raid.targets.every(
          (t) =>
            point(t) &&
            t.kind === "raider" &&
            finite(t.hp, -10, 5) &&
            finite(t.cd, -1e7, 2),
        ))
    )
      return false;
    return true;
  }
  async function importWorld(e) {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 2000000)
        throw Error("Please choose a Hanomi world smaller than 2 MB.");
      const s = JSON.parse(await file.text());
      if (!validWorld(s))
        throw Error("This file is not a supported Hanomi world.");
      state = s;
      save(false);
      start();

      toast("Your world has arrived safely.");
    } catch (err) {
      const p = document.createElement("p");
      p.className = "description danger";
      p.textContent = err.message;
      $("#panel-body").append(p);
    }
  }
  function openPond() {
    keys.clear();
    mode = "pond";
    $("#pond-overlay").hidden = false;
    $("#pond-frame").src = "pond.html";
  }
  $("#close-pond").onclick = () => {
    $("#pond-overlay").hidden = true;
    $("#pond-frame").src = "about:blank";
    mode = "play";
    cv.focus();
  };
  $("#close-panel").onclick = closePanel;
  $("#panel").addEventListener("cancel", (e) => {
    e.preventDefault();
    closePanel();
  });
  $("#panel-body").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.load) {
      loadWorld(b.dataset.load);
      return;
    }
    if (b.dataset.delete) {
      const id = b.dataset.delete,
        s = readSaves().find((x) => x.id === id);
      panel(
        "This cannot be undone",
        "Leave this story behind?",
        `<p class="description">Delete ${esc(s?.name || "this world")} from this device? Export a copy first if you might return.</p><button class="primary" data-confirm-delete="${id}">Delete this world</button><button class="text-button" style="color:#4d6646" data-do="worlds">Keep it</button>`,
      );
      return;
    }
    if (b.dataset.confirmDelete) {
      localStorage.setItem(
        SAVEKEY,
        JSON.stringify(
          readSaves().filter((s) => s.id !== b.dataset.confirmDelete),
        ),
      );
      refreshHome();
      worldsPanel();
      return;
    }
    if (b.dataset.craft) {
      craft(b.dataset.craft);
      return;
    }
    if (b.dataset.eat) {
      const k = b.dataset.eat;
      if (state.inv[k] > 0) {
        state.inv[k]--;
        state.player.food = Math.min(
          100,
          state.player.food +
            { berry: 12, crop: 20, fish: 15, meat: 10, egg: 15 }[k],
        );
        inventory();
      }
      return;
    }
    if (b.dataset.place) {
      state.place = b.dataset.place;
      closePanel();
      toast(
        "Face a clear patch and press Space to place your " +
          names[state.place].toLowerCase() +
          ".",
      );
      return;
    }
    if (b.dataset.sell) {
      const k = b.dataset.sell;
      if (state.inv[k] > 0) {
        state.inv[k]--;
        gain("coin", Number(b.dataset.price));
        tradePanel();
      }
      return;
    }
    if (b.dataset.cook) {
      const k = b.dataset.cook;
      if (state.inv[k] > 0) {
        state.inv[k]--;
        state.player.food = Math.min(100, state.player.food + 45);
        state.player.hp = Math.min(100, state.player.hp + 15);
        cookPanel();
        toast("A warm meal. +45 nourishment, +15 health");
      }
      return;
    }
    if (b.dataset.diplomacy) {
      if (state.inv.crop >= 3) {
        state.inv.crop -= 3;
        state.relations[b.dataset.diplomacy] += 10;
        councilPanel();
      }
      return;
    }
    if (b.dataset.raid) {
      if (state.guards.length >= 3 && !state.raid) {
        const nation = b.dataset.raid,
          f = factions[nation];
        state.raid = {
          nation,
          targets: Array.from({ length: 5 }, (_, i) => ({
            x: f.x + (i - 2) * 20,
            y: f.y + 30 + (i % 2) * 20,
            kind: "raider",
            hp: 5,
            cd: 0,
          })),
        };
        enemies.push(...state.raid.targets);
        closePanel();
        toast(
          "Rally at " +
            f.name +
            ". Your guards follow you. Find the settlement on your map.",
        );
      }
      return;
    }
    switch (b.dataset.do) {
      case "close":
        closePanel();
        break;
      case "new":
        newPanel();
        break;
      case "worlds":
        worldsPanel();
        break;
      case "import":
        $("#import-file").click();
        break;
      case "journal":
        journal();
        break;
      case "save":
        save();
        break;
      case "sleep": {
        const hour = (8 + state.elapsed / 30) % 24;
        state.elapsed += ((24 - hour + 8) % 24 || 24) * 30;
        state.player.hp = 100;
        state.player.food = 85;
        awardMorning();
        enemies = enemies.filter((e) => e.kind === "raider");
        save(false);
        closePanel();
        updateHUD();
        toast("A new morning. The valley is waking up.");
        break;
      }
      case "pet":
        state.dog.bond++;
        tone(700);
        dogPanel();
        break;
      case "dog-toggle":
        state.dog.follow = !state.dog.follow;
        dogPanel();
        break;
      case "dog-feed": {
        const k = state.inv.fish > 0 ? "fish" : "meat";
        if (state.inv[k] > 0) {
          state.inv[k]--;
          state.dog.bond += 3;
          dogPanel();
        }
        break;
      }
      case "seeds":
        if (state.inv.berry >= 2) {
          state.inv.berry -= 2;
          gain("seed", 5);
          toast("Hana shared 5 more seeds with you.");
          closePanel();
        } else toast("Bring Hana 2 wild berries.");
        break;
      case "buy-seeds":
        if (state.inv.coin >= 3) {
          state.inv.coin -= 3;
          gain("seed", 5);
          tradePanel();
        }
        break;
      case "sound":
        soundOn = !soundOn;
        state.sound = soundOn;
        tone();
        pause();
        break;
      case "export":
        exportWorld();
        break;
      case "help":
        welcome();
        break;
      case "menu":
        save(false);
        state = null;
        mode = "home";
        $("#hud").hidden = true;
        $("#home").hidden = false;
        $("#panel").close();
        refreshHome();
        break;
    }
  });
  $("#new").onclick = newPanel;
  $("#continue").onclick = () => {
    const a = readSaves();
    if (a[0]) loadWorld(a[0].id);
  };
  $("#worlds").onclick = worldsPanel;
  $("#home-help").onclick = () => {
    panel(
      "Your own pace",
      "A little guide to wandering.",
      `<p class="description">Explore with WASD or the arrow keys. Press E to talk, gather, and visit places. Select a tool with 1–6 and use it with Space.</p><p class="description">Plant and harvest, fish the river, build your home, and make friends. After dark, keep your sword close or sleep in your cottage. Your field journal will help you get started.</p><p class="description">No downloads, accounts, or paid assets. Just a little world in your browser.</p><button class="primary" data-do="new">Begin a new story</button>`,
    );
  };
  $("#bag-button").onclick = inventory;
  $("#craft-button").onclick = craftPanel;
  $("#map-button").onclick = mapPanel;
  $("#journal-button").onclick = journal;
  $("#pause-button").onclick = pause;
  addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
      e.preventDefault();
    if (k === "escape") {
      e.preventDefault();
      if (mode === "pond") $("#close-pond").click();
      else if ($("#panel").open) closePanel();
      else if (state) pause();
      return;
    }
    if (mode !== "play") return;
    keys.add(k);
    if (e.repeat) return;
    if (k === "e") interact();
    else if (k === " ") use();
    else if (k === "b") inventory();
    else if (k === "c") craftPanel();
    else if (k === "j") journal();
    else if (k === "m") mapPanel();
    else if (+k >= 1 && +k <= 6) {
      selected = +k - 1;
      state.place = null;
      fishing = null;
      hotbar();
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => {
    keys.clear();
    stick.x = stick.y = 0;
    if (state && mode === "play") pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state) {
      save(false);
      if (mode === "play") pause();
    }
  });
  addEventListener("pagehide", () => save(false));
  cv.addEventListener("pointerdown", (e) => {
    if (mode !== "play" || e.pointerType === "touch") return;
    const p = state.player,
      dx = e.clientX / scale - W / 2,
      dy = e.clientY / scale - H / 2,
      l = Math.hypot(dx, dy);
    if (l) {
      p.dx = dx / l;
      p.dy = dy / l;
      p.face = dx < 0 ? -1 : 1;
    }
    use();
  });
  const stickEl = $("#stick");
  function joy(e) {
    const r = stickEl.getBoundingClientRect(),
      dx = e.clientX - r.left - r.width / 2,
      dy = e.clientY - r.top - r.height / 2,
      l = Math.max(30, Math.hypot(dx, dy));
    stick.x = dx / l;
    stick.y = dy / l;
    $("#stick i").style.transform =
      `translate(${stick.x * 27}px,${stick.y * 27}px)`;
  }
  stickEl.onpointerdown = (e) => {
    stickEl.setPointerCapture(e.pointerId);
    joy(e);
  };
  stickEl.onpointermove = (e) => {
    if (stickEl.hasPointerCapture(e.pointerId)) joy(e);
  };
  function joyEnd() {
    stick.x = stick.y = 0;
    $("#stick i").style.transform = "";
  }
  stickEl.onpointerup = joyEnd;
  stickEl.onpointercancel = joyEnd;
  $("#touch-e").onpointerdown = (e) => {
    e.preventDefault();
    interact();
  };
  $("#touch-use").onpointerdown = (e) => {
    e.preventDefault();
    use();
  };
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    if (!document.hidden) {
      update(dt);
      if (mode === "play" || mode === "home") render();
    }
    requestAnimationFrame(frame);
  }
  seed = 12345;
  generate();
  refreshHome();
  requestAnimationFrame(frame);
})();
