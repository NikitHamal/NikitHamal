/* Real browser regression coverage. No engine hooks: interact through UI and
   round-trip the same JSON world format used by import/export. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const server = http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split("?")[0]);
  if (name.endsWith("/")) name += "index.html";
  const file = path.join(root, name);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(data);
  });
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const errors = [];
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p.on("pageerror", (e) => errors.push(e.message));
    const url = `http://127.0.0.1:${server.address().port}/hanomi/`;
    const key = "hanomi.worlds.v1";
    await p.goto(url);
    await p.click("#new");
    await p.fill("#world-name", "Regression Valley");
    await p.fill("#world-seed", "hanomi-integration");
    await p.click("#new-form .primary");
    await p.click('[data-do="close"]');
    async function snapshot() {
      await p.keyboard.press("Escape");
      const s = await p.evaluate(
        (k) => JSON.parse(localStorage.getItem(k))[0],
        key,
      );
      await p.keyboard.press("Escape");
      return s;
    }
    async function restore(s) {
      await p.keyboard.press("Escape");
      await p.click('[data-do="menu"]');
      await p.evaluate(
        ({ key, s }) => localStorage.setItem(key, JSON.stringify([s])),
        { key, s },
      );
      await p.reload();
      await p.click("#continue");
      await p.waitForTimeout(100);
    }
    let s = await snapshot();
    assert.equal(s.name, "Regression Valley");
    // Movement actually changes the serialized player, not just the camera.
    await p.keyboard.down("s");
    await p.waitForTimeout(300);
    await p.keyboard.up("s");
    assert.ok((await snapshot()).player.y > s.player.y + 5);
    console.log("PASS new world, movement, save & resume");
    // Chop one known village tree using the real tool, then craft and place a fence.
    s = await snapshot();
    s.player.x = 896;
    s.player.y = 1028;
    s.player.dx = 0;
    s.player.dy = -1;
    await restore(s);
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press("Space");
      await p.waitForTimeout(360);
    }
    s = await snapshot();
    assert.equal(s.inv.wood, 4);
    assert.ok(s.removed["v-tree1"]);
    await p.keyboard.press("c");
    await p.click('[data-craft="fence"]');
    await p.keyboard.press("Escape");
    s = await snapshot();
    assert.equal(s.inv.fence, 1);
    assert.equal(s.inv.wood, 0);
    s.player.x = 1144;
    s.player.y = 1220;
    s.player.dx = 0;
    s.player.dy = 1;
    await restore(s);
    await p.keyboard.press("b");
    await p.click('[data-place="fence"]');
    await p.keyboard.press("Space");
    s = await snapshot();
    assert.equal(s.inv.fence, 0);
    assert.equal(s.stats.built, 1);
    assert.ok(s.builds.some((b) => b.type === "fence"));
    await restore(s);
    assert.equal((await snapshot()).builds.length, s.builds.length);
    console.log("PASS gathering, crafting, placement & persistence");
    // Plant at the prepared garden, advance serialized world time, harvest.
    s = await snapshot();
    s.player.x = 1000;
    s.player.y = 1260;
    s.player.dx = 0;
    s.player.dy = 1;
    await restore(s);
    await p.keyboard.press("6");
    await p.keyboard.press("Space");
    s = await snapshot();
    assert.equal(s.stats.planted, 1);
    assert.equal(Object.keys(s.crops).length, 1);
    s.elapsed += 80;
    s.player.y = 1288;
    await restore(s);
    await p.keyboard.press("e");
    s = await snapshot();
    assert.equal(s.stats.harvested, 1);
    assert.equal(s.inv.crop, 3);
    console.log("PASS plant, grow & harvest");
    // Fish in the river rather than the protected koi pond.
    s = await snapshot();
    const y = 97,
      river = 94 + Math.sin(y * 0.065) * 8 + Math.sin(y * 0.14) * 2;
    s.player.x = (Math.floor(river) - 5) * 16 + 8;
    s.player.y = y * 16 + 8;
    await restore(s);
    await p.keyboard.press("4");
    await p.keyboard.press("Space");
    await p.waitForFunction(
      () => document.querySelector("#prompt").textContent.includes("A bite!"),
      {},
      { timeout: 8000 },
    );
    await p.keyboard.press("Space");
    s = await snapshot();
    assert.equal(s.stats.fished, 1);
    assert.equal(s.inv.fish, 1);
    console.log("PASS fishing timing & reward");
    // Original dog is live and the original pond renders without JS errors.
    s.player.x = s.dog.x;
    s.player.y = s.dog.y;
    await restore(s);
    await p.keyboard.press("e");
    assert.equal(await p.locator("pixel-dog").count(), 1);
    await p.click('[data-do="pet"]');
    await p.keyboard.press("Escape");
    s = await snapshot();
    assert.equal(s.dog.bond, 1);
    s.player.x = 1208;
    s.player.y = 1088;
    s.dog.x = 1150;
    s.dog.y = 1150;
    await restore(s);
    await p.keyboard.press("e");
    await p.waitForSelector("#pond-overlay:not([hidden])");
    await p.frameLocator("#pond-frame").locator("#pond-c").waitFor();
    await p.waitForTimeout(700);
    await p.click("#close-pond");
    console.log("PASS original dog & koi pond integrations");
    // A raid is a real fight, and an unfinished campaign survives a reload.
    s = await snapshot();
    s.player.x = 1232;
    s.player.y = 1405;
    s.guards = Array.from({ length: 3 }, (_, i) => ({
      x: 1240 + i * 5,
      y: 1410,
      kind: "guard",
      hp: 100,
      cd: 0,
    }));
    await restore(s);
    await p.keyboard.press("e");
    await p.click('[data-raid="amber"]');
    s = await snapshot();
    assert.equal(s.raid.targets.length, 5);
    s.player.x = 1872;
    s.player.y = 1540;
    s.inv.ironSword = 1;
    s.guards.forEach((g, i) => {
      g.x = 1860 + i * 10;
      g.y = 1540;
    });
    await restore(s);
    await p.keyboard.press("5");
    for (let i = 0; i < 20; i++) {
      await p.keyboard.press("Space");
      await p.waitForTimeout(360);
    }
    s = await snapshot();
    assert.equal(s.raid, null);
    assert.equal(s.relations.amber, -30);
    console.log("PASS army, raid combat, campaign save & consequences");
    // Night lighting and a full recovery at the cottage survive the save boundary.
    s = await snapshot();
    s.elapsed = 360;
    s.player.hp = 12;
    s.player.food = 8;
    s.player.x = 1056;
    s.player.y = 1070;
    s.dog.x = 1200;
    s.dog.y = 1200;
    await restore(s);
    assert.equal(await p.locator("#weather").textContent(), "☾");
    await p.keyboard.press("e");
    await p.click('[data-do="sleep"]');
    s = await snapshot();
    assert.ok(s.player.hp > 99);
    assert.ok(s.player.food > 84);
    assert.equal(await p.locator("#weather").textContent(), "☀");
    console.log("PASS day/night cycle & sleep recovery");
    // Export is usable as an import; malformed data is rejected in the UI.
    await p.keyboard.press("Escape");
    const download = p.waitForEvent("download");
    await p.click('[data-do="export"]');
    const file = await download;
    const exported = JSON.parse(fs.readFileSync(await file.path(), "utf8"));
    assert.equal(exported.name, "Regression Valley");
    await p.click('[data-do="menu"]');
    await p.click("#worlds");
    await p.locator("#import-file").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
    await p.locator(".description.danger").waitFor();
    await p.locator("#import-file").setInputFiles({
      name: "world.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await p.waitForFunction(() => !document.querySelector("#hud").hidden);
    assert.equal((await snapshot()).name, "Regression Valley");
    console.log("PASS export, validated import & recovery");
    // Touch layout: the joystick drives actual movement; panels fit the viewport.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(100);
    await p.keyboard.press("Escape");
    await p.click('[data-do="help"]');
    const r = await p.locator("#panel").boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= 390);
    await p.click('[data-do="close"]');
    s = await snapshot();
    const joy = await p.locator("#stick").boundingBox();
    await p.mouse.move(joy.x + 45, joy.y + 45);
    await p.mouse.down();
    await p.mouse.move(joy.x + 75, joy.y + 45);
    await p.waitForTimeout(350);
    await p.mouse.up();
    assert.ok((await snapshot()).player.x > s.player.x + 5);
    console.log("PASS mobile layout & thumbstick");
    assert.deepEqual(errors, []);
    console.log("PASS no browser JavaScript errors");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
