/**
 * Generates the default illustrated landscape artwork in public/images.
 * These are placeholders until the owner uploads real (consented) photography.
 * Run: npx tsx scripts/generate-scenes.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Scene = {
  name: string; sky: [string, string, string]; sun?: { x: number; y: number; r: number; color: string; glow?: string };
  ridges: { base: number; amp: number; rough: number; color: string; snow?: string; seed: number }[];
  water?: { y: number; color: string; shine: string }; trees?: { color: string; y: number; count: number; seed: number; scale: number }[];
  stars?: boolean; mist?: string; lights?: string; road?: string; tent?: string; paddler?: string;
};

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function ridge(w: number, h: number, base: number, amp: number, rough: number, seed: number) {
  const r = rng(seed); const pts: [number, number][] = []; const n = 48;
  let y = base; const peaks = Array.from({ length: 4 }, () => r() * w);
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const peak = peaks.reduce((m, p) => Math.max(m, 1 - Math.min(Math.abs(x - p) / (w * 0.22), 1)), 0);
    y = base - amp * peak ** 1.6 - (r() - 0.5) * rough;
    pts.push([x, y]);
  }
  return { d: `M0,${h} L` + pts.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(" L") + ` L${w},${h} Z`, pts };
}

function snowCap(pts: [number, number][], base: number, amp: number) {
  const thresh = base - amp * 0.62; const segs: string[] = [];
  let cur: [number, number][] = [];
  for (const p of pts) { if (p[1] < thresh) cur.push(p); else if (cur.length) { segs.push(cap(cur, thresh)); cur = []; } }
  if (cur.length) segs.push(cap(cur, thresh));
  return segs.join("");
  function cap(c: [number, number][], t: number) {
    const top = c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
    const back = [...c].reverse().map(([x, y], i) => `${x.toFixed(1)},${(Math.min(t, y + 14 + (i % 3) * 7)).toFixed(1)}`).join(" L");
    return `<path d="M${top} L${back} Z"/>`;
  }
}

function tree(x: number, y: number, s: number) {
  return `<path d="M${x},${y - 46 * s} L${x + 9 * s},${y - 26 * s} L${x + 5 * s},${y - 26 * s} L${x + 13 * s},${y - 10 * s} L${x + 7 * s},${y - 10 * s} L${x + 15 * s},${y} L${x - 15 * s},${y} L${x - 7 * s},${y - 10 * s} L${x - 13 * s},${y - 10 * s} L${x - 5 * s},${y - 26 * s} L${x - 9 * s},${y - 26 * s} Z"/>`;
}

function render(sc: Scene, w = 1600, h = 1000) {
  const parts: string[] = [];
  parts.push(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.sky[0]}"/><stop offset="0.55" stop-color="${sc.sky[1]}"/><stop offset="1" stop-color="${sc.sky[2]}"/></linearGradient>`
    + (sc.sun?.glow ? `<radialGradient id="glow"><stop offset="0" stop-color="${sc.sun.glow}" stop-opacity="0.7"/><stop offset="1" stop-color="${sc.sun.glow}" stop-opacity="0"/></radialGradient>` : "")
    + (sc.mist ? `<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sc.mist}" stop-opacity="0"/><stop offset="1" stop-color="${sc.mist}" stop-opacity="0.55"/></linearGradient>` : "")
    + `</defs>`);
  parts.push(`<rect width="${w}" height="${h}" fill="url(#sky)"/>`);
  if (sc.stars) { const r = rng(7); for (let i = 0; i < 90; i++) parts.push(`<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.45).toFixed(0)}" r="${(r() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`); }
  if (sc.sun) {
    if (sc.sun.glow) parts.push(`<circle cx="${sc.sun.x * w}" cy="${sc.sun.y * h}" r="${sc.sun.r * 5}" fill="url(#glow)"/>`);
    parts.push(`<circle cx="${sc.sun.x * w}" cy="${sc.sun.y * h}" r="${sc.sun.r}" fill="${sc.sun.color}"/>`);
  }
  sc.ridges.forEach((r, i) => {
    const { d, pts } = ridge(w, h, r.base * h, r.amp * h, r.rough, r.seed);
    parts.push(`<path d="${d}" fill="${r.color}"/>`);
    if (r.snow) parts.push(`<g fill="${r.snow}" opacity="0.95">${snowCap(pts, r.base * h, r.amp * h)}</g>`);
    if (sc.mist && i === 1) parts.push(`<rect y="${h * 0.35}" width="${w}" height="${h * 0.35}" fill="url(#mist)"/>`);
  });
  if (sc.water) {
    parts.push(`<rect y="${sc.water.y * h}" width="${w}" height="${h}" fill="${sc.water.color}"/>`);
    const r = rng(3); for (let i = 0; i < 26; i++) { const y = sc.water.y * h + 12 + r() * (h * (1 - sc.water.y) - 20); const x = r() * w; const len = 40 + r() * 160;
      parts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${len.toFixed(0)}" height="2.5" rx="1.2" fill="${sc.water.shine}" opacity="${(0.25 + r() * 0.45).toFixed(2)}"/>`); }
  }
  if (sc.road) parts.push(`<path d="M${w * 0.44},${h} C${w * 0.5},${h * 0.85} ${w * 0.56},${h * 0.8} ${w * 0.52},${h * 0.7} L${w * 0.535},${h * 0.7} C${w * 0.6},${h * 0.8} ${w * 0.62},${h * 0.88} ${w * 0.66},${h} Z" fill="${sc.road}"/>`);
  for (const t of sc.trees ?? []) { const r = rng(t.seed); const g: string[] = [];
    for (let i = 0; i < t.count; i++) { const x = r() * w; const s = t.scale * (0.6 + r() * 0.8); g.push(tree(x, t.y * h + r() * 30, s)); }
    parts.push(`<g fill="${t.color}">${g.join("")}</g>`); }
  if (sc.tent) parts.push(`<g transform="translate(${w * 0.62},${h * 0.86})"><path d="M-70,0 L0,-80 L70,0 Z" fill="${sc.tent}"/><path d="M-14,0 L0,-34 L14,0 Z" fill="#ffd9a0"/><circle cx="-130" cy="-6" r="10" fill="#ffb347" opacity="0.9"/></g>`);
  if (sc.paddler) parts.push(`<g transform="translate(${w * 0.36},${(sc.water?.y ?? 0.7) * h + 70})" fill="${sc.paddler}"><path d="M-80,0 Q0,16 80,0 Q0,8 -80,0 Z"/><circle cx="0" cy="-30" r="8"/><rect x="-5" y="-22" width="10" height="20" rx="4"/><rect x="-50" y="-40" width="4" height="70" rx="2" transform="rotate(-40)"/></g>`);
  if (sc.lights) { const r = rng(11); for (let i = 0; i < 40; i++) parts.push(`<circle cx="${(r() * w).toFixed(0)}" cy="${(h * 0.78 + r() * h * 0.12).toFixed(0)}" r="${(1.5 + r() * 2.5).toFixed(1)}" fill="${sc.lights}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated landscape">${parts.join("")}</svg>`;
}

const scenes: Scene[] = [
  { name: "hero", sky: ["#f3c99b", "#e9a77c", "#a96d63"], sun: { x: 0.7, y: 0.36, r: 70, color: "#fff1d6", glow: "#ffd9a8" }, mist: "#f6dcc0",
    ridges: [{ base: 0.6, amp: 0.36, rough: 10, color: "#9b7a86", snow: "#f7e7e1", seed: 4 }, { base: 0.7, amp: 0.25, rough: 14, color: "#6d5a6e", seed: 9 },
      { base: 0.8, amp: 0.18, rough: 18, color: "#3d4250", seed: 13 }, { base: 0.92, amp: 0.1, rough: 10, color: "#1d2a27", seed: 21 }],
    trees: [{ color: "#13201c", y: 0.98, count: 70, seed: 5, scale: 2.4 }] },
  { name: "snow-forest", sky: ["#c9dceb", "#e6eef3", "#f5f7f8"], sun: { x: 0.25, y: 0.25, r: 46, color: "#fff9ee", glow: "#ffffff" },
    ridges: [{ base: 0.55, amp: 0.3, rough: 8, color: "#a9bccb", snow: "#ffffff", seed: 2 }, { base: 0.72, amp: 0.18, rough: 10, color: "#8ea4b3", snow: "#f4f8fb", seed: 6 },
      { base: 0.9, amp: 0.06, rough: 6, color: "#f2f6f8", seed: 12 }], trees: [{ color: "#3e5a52", y: 0.82, count: 40, seed: 3, scale: 1.4 }, { color: "#23382f", y: 0.98, count: 30, seed: 8, scale: 2.6 }] },
  { name: "sunrise-ridge", sky: ["#2d3d66", "#c76f6f", "#f5b57a"], sun: { x: 0.52, y: 0.62, r: 58, color: "#ffe2a8", glow: "#ffb877" },
    ridges: [{ base: 0.66, amp: 0.22, rough: 10, color: "#6b4f6e", seed: 31 }, { base: 0.76, amp: 0.16, rough: 12, color: "#3e3553", seed: 33 }],
    water: { y: 0.78, color: "#5a4a6c", shine: "#ffc995" }, trees: [{ color: "#1b1a2a", y: 0.8, count: 22, seed: 4, scale: 2.2 }] },
  { name: "forest-falls", sky: ["#bcd3c4", "#dbe7dc", "#eef3ea"], mist: "#ffffff",
    ridges: [{ base: 0.5, amp: 0.3, rough: 10, color: "#8aa799", seed: 41 }, { base: 0.66, amp: 0.25, rough: 14, color: "#557a68", seed: 43 }, { base: 0.86, amp: 0.15, rough: 16, color: "#2f5444", seed: 45 }],
    trees: [{ color: "#2a4a3b", y: 0.75, count: 50, seed: 9, scale: 1.6 }, { color: "#15291f", y: 1.0, count: 36, seed: 10, scale: 3.2 }] },
  { name: "snow-peak", sky: ["#5c86b8", "#9cbfe0", "#e3eef7"], sun: { x: 0.82, y: 0.18, r: 38, color: "#fffdf3", glow: "#ffffff" },
    ridges: [{ base: 0.62, amp: 0.5, rough: 6, color: "#6d87a3", snow: "#ffffff", seed: 51 }, { base: 0.78, amp: 0.25, rough: 10, color: "#4f6880", snow: "#eef4f9", seed: 53 },
      { base: 0.92, amp: 0.08, rough: 6, color: "#f4f8fb", seed: 55 }], trees: [{ color: "#28403c", y: 0.98, count: 26, seed: 6, scale: 2.4 }] },
  { name: "lake-dusk", sky: ["#1f2b4a", "#5b5b84", "#d99a8b"], sun: { x: 0.3, y: 0.56, r: 30, color: "#ffd2b0", glow: "#ffb59a" }, stars: true,
    ridges: [{ base: 0.6, amp: 0.2, rough: 8, color: "#3b3f63", seed: 61 }], water: { y: 0.64, color: "#2b3356", shine: "#f3b8a0" },
    trees: [{ color: "#121a2c", y: 0.66, count: 46, seed: 12, scale: 1.4 }] },
  { name: "beach-sunrise", sky: ["#f7d6a8", "#f3b78c", "#e99a84"], sun: { x: 0.5, y: 0.6, r: 64, color: "#fff2d2", glow: "#ffe0aa" },
    ridges: [{ base: 0.6, amp: 0.18, rough: 8, color: "#b48a8e", snow: "#f5e3df", seed: 71 }], water: { y: 0.66, color: "#c98b83", shine: "#fff0d0" },
    paddler: "#3a2b33" },
  { name: "coast-road", sky: ["#9ec7d9", "#cfe3e8", "#f1efe4"],
    ridges: [{ base: 0.55, amp: 0.25, rough: 8, color: "#8fb0b5", snow: "#f7fbfb", seed: 81 }, { base: 0.7, amp: 0.15, rough: 12, color: "#5f8a83", seed: 83 }],
    water: { y: 0.72, color: "#4f8a9a", shine: "#e7f4f6" }, trees: [{ color: "#2a4e3f", y: 0.74, count: 20, seed: 13, scale: 1.8 }] },
  { name: "alpine-bowl", sky: ["#3a69a6", "#88b4dd", "#e7f1fa"], sun: { x: 0.2, y: 0.2, r: 36, color: "#fffef7", glow: "#ffffff" },
    ridges: [{ base: 0.58, amp: 0.42, rough: 5, color: "#7d97b5", snow: "#ffffff", seed: 91 }, { base: 0.76, amp: 0.3, rough: 8, color: "#e9f0f7", seed: 93 },
      { base: 0.95, amp: 0.12, rough: 6, color: "#ffffff", seed: 95 }], trees: [{ color: "#2d4a48", y: 0.95, count: 16, seed: 15, scale: 2 }] },
  { name: "fjord-paddle", sky: ["#9fb7c9", "#c8d8e0", "#e9eef0"], mist: "#ffffff",
    ridges: [{ base: 0.48, amp: 0.3, rough: 8, color: "#7b95a5", snow: "#f6f9fb", seed: 101 }, { base: 0.6, amp: 0.22, rough: 10, color: "#4f6d79", seed: 103 }],
    water: { y: 0.62, color: "#46687a", shine: "#dbe8ef" }, trees: [{ color: "#263f43", y: 0.63, count: 40, seed: 16, scale: 1.2 }], paddler: "#c8553b" },
  { name: "evening-lights", sky: ["#1b2140", "#3b3463", "#a0607a"], stars: true,
    ridges: [{ base: 0.58, amp: 0.22, rough: 8, color: "#2e2d52", snow: "#cfc9e3", seed: 111 }, { base: 0.76, amp: 0.1, rough: 6, color: "#1a1c33", seed: 113 }],
    water: { y: 0.84, color: "#1f2344", shine: "#ffcf7a" }, lights: "#ffd27a" },
  { name: "lake-camp", sky: ["#0f1a33", "#26365f", "#5d6a8f"], stars: true, sun: { x: 0.78, y: 0.2, r: 26, color: "#f4f1e6", glow: "#cfd8f0" },
    ridges: [{ base: 0.56, amp: 0.3, rough: 8, color: "#34446a", snow: "#dfe6f3", seed: 121 }, { base: 0.72, amp: 0.15, rough: 10, color: "#1f2b48", seed: 123 }],
    water: { y: 0.74, color: "#1c2745", shine: "#cfd8f0" }, trees: [{ color: "#0c1324", y: 0.76, count: 34, seed: 17, scale: 1.8 }], tent: "#d9703f" },
  { name: "valley-road", sky: ["#e7d6b7", "#efe4cc", "#f3eee2"], sun: { x: 0.18, y: 0.3, r: 44, color: "#fff6e0", glow: "#ffe9bd" },
    ridges: [{ base: 0.56, amp: 0.26, rough: 8, color: "#a7b39b", snow: "#f8f6ef", seed: 131 }, { base: 0.7, amp: 0.14, rough: 12, color: "#7d9670", seed: 133 },
      { base: 0.84, amp: 0.06, rough: 6, color: "#b6c08f", seed: 135 }], road: "#5f5a52", trees: [{ color: "#3f5d3b", y: 0.78, count: 18, seed: 18, scale: 1.4 }] },
  { name: "alpine-lake", sky: ["#4b86b4", "#9ccbe0", "#e8f4f4"], sun: { x: 0.8, y: 0.18, r: 34, color: "#fffef5", glow: "#ffffff" },
    ridges: [{ base: 0.5, amp: 0.36, rough: 6, color: "#738aa0", snow: "#ffffff", seed: 141 }, { base: 0.62, amp: 0.18, rough: 10, color: "#4e6b70", snow: "#e6eff2", seed: 143 }],
    water: { y: 0.64, color: "#2fa3a0", shine: "#d6f5f1" }, trees: [{ color: "#1e3b33", y: 0.67, count: 30, seed: 19, scale: 1.4 }, { color: "#13261f", y: 1.0, count: 14, seed: 20, scale: 3 }] },
];

const outDir = resolve(__dirname, "../public/images");
mkdirSync(resolve(outDir, "scenes"), { recursive: true });
for (const s of scenes) {
  const file = s.name === "hero" ? resolve(outDir, "hero.svg") : resolve(outDir, "scenes", `${s.name}.svg`);
  writeFileSync(file, s.name === "hero" ? render(s, 2400, 1400) : render(s));
}
console.log(`Generated ${scenes.length} scenes`);
