// Génère les sources d'icône et d'écran de démarrage depuis assets/logo-source.png (visuel 1536×1024),
// puis : npx capacitor-assets generate --android --ios. Lancer depuis la racine : node assets/generer-icones.mjs
import sharp from "sharp";
const SRC = "assets/logo-source.png";
const FOND = { r: 28, g: 29, b: 33 }; // anthracite uni
const lisse = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));

// Isole les pixels blancs et jaunes du logo (le fond béton devient transparent).
async function extraire(zone) {
  const { data, info } = await sharp(SRC).extract(zone).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const blanc = lisse(Math.min(r, g, b), 150, 215);
    const jaune = lisse(r - b, 70, 130) * lisse(r, 150, 200) * lisse(g, 100, 140);
    const a = Math.max(blanc, jaune);
    out.set([r, g, b, Math.round(a * 255)], i * 4);
    if (a > 0.5) {
      const x = i % info.width, y = Math.floor(i / info.width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  // Supprime les grains isolés du béton : un pixel du logo a toujours beaucoup de voisins opaques.
  const W = info.width, H = info.height, R = 4;
  const opaque = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) opaque[i] = out[i * 4 + 3] > 64 ? 1 : 0;
  const integ = new Uint32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    integ[(y + 1) * (W + 1) + x + 1] = opaque[y * W + x] + integ[y * (W + 1) + x + 1] + integ[(y + 1) * (W + 1) + x] - integ[y * (W + 1) + x];
  minX = 1e9; minY = 1e9; maxX = -1; maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    const n = integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] - integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
    const i = y * W + x;
    if (n < 22) out[i * 4 + 3] = 0;
    else if (out[i * 4 + 3] > 127) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  const pad = 2;
  minX = Math.max(pad, minX); minY = Math.max(pad, minY); maxX = Math.min(info.width - 1 - pad, maxX); maxY = Math.min(info.height - 1 - pad, maxY);
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: Math.max(0, minX - pad), top: Math.max(0, minY - pad), width: maxX - minX + 1 + 2 * pad, height: maxY - minY + 1 + 2 * pad })
    .png().toBuffer();
}

async function placer(logo, taille, ratio, fond) {
  const l = await sharp(logo).resize({ width: Math.round(taille * ratio), height: Math.round(taille * ratio), fit: "inside", kernel: "lanczos3" }).png().toBuffer();
  return sharp({ create: { width: taille, height: taille, channels: 4, background: fond ? { ...FOND, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: l, gravity: "center" }]).png();
}

const symbole = await extraire({ left: 290, top: 345, width: 325, height: 225 });
const complet = await extraire({ left: 290, top: 361, width: 850, height: 197 });
await (await placer(symbole, 1024, 0.78, true)).toFile("assets/icon-only.png");
await (await placer(symbole, 1024, 0.56, false)).toFile("assets/icon-foreground.png"); // zone sûre Android (66 %)
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...FOND, alpha: 1 } } }).png().toFile("assets/icon-background.png");
await (await placer(complet, 2732, 0.5, true)).toFile("assets/splash.png");
await (await placer(complet, 2732, 0.5, true)).toFile("assets/splash-dark.png");
console.log("ok", (await sharp(symbole).metadata()).width, (await sharp(complet).metadata()).width);
