/* Raum-Tablet-Card – Wandtablet-Dashboard: Licht (Primär/Sekundär), Heizung, Grundriss, Wetter, Raumklima, Statusleiste */
const RTC_VERSION = '1.21.10';
const W = 1280, H = 800;
const NA = ['unavailable', 'unknown'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad3 = n => String(Math.round(n)).padStart(3, '0');
const de = (n, d = 1) => (n == null || isNaN(n)) ? '--' : Number(n).toFixed(d).replace('.', ',');
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '--:--' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const hsCss = (h, s) => { const v = 1, sv = s / 100, l = v * (1 - sv / 2), sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l); return `hsl(${Math.round(h)},${Math.round(sl * 100)}%,${Math.round(l * 100)}%)`; };
const KSTOPS = [[2000, [255, 138, 43]], [2700, [255, 194, 122]], [4000, [255, 241, 220]], [5500, [223, 234, 255]], [6500, [159, 195, 255]]];
const kCss = k => { k = clamp(k, 2000, 6500); for (let i = 1; i < KSTOPS.length; i++) { const [k1, c1] = KSTOPS[i - 1], [k2, c2] = KSTOPS[i]; if (k <= k2) { const t = (k - k1) / (k2 - k1); return `rgb(${c1.map((c, j) => Math.round(c + (c2[j] - c) * t)).join(',')})`; } } return 'rgb(159,195,255)'; };
const hueName = h => ['Rot', 'Orange', 'Gelb', 'Grün', 'Grün', 'Cyan', 'Blau', 'Blau', 'Violett', 'Magenta', 'Pink', 'Rot'][Math.floor(((h % 360) + 15) / 30) % 12];
const kelName = k => k < 3300 ? 'Warmweiß' : k < 5000 ? 'Neutralweiß' : 'Kaltweiß';
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); };

// Lautstärke-Farbe (für alle Kanäle gleich): cyan < 25 % · grün ab 25 % · gelb ab 45 % · orange ab 75 % · rot ab 90 %
// Stützpunkte [Anteil, Farbton], dazwischen kurze weiche Übergänge
const VHUE = [[0, 199], [.22, 199], [.25, 135], [.42, 118], [.45, 54], [.72, 48], [.75, 30], [.87, 26], [.9, 3], [1, 0]];
const volCol = (f, dim = 1) => {
  f = clamp(f, 0, 1);
  let h = 0;
  for (let i = 1; i < VHUE.length; i++) { const [f1, h1] = VHUE[i - 1], [f2, h2] = VHUE[i]; if (f <= f2) { h = h1 + (h2 - h1) * (f - f1) / (f2 - f1); break; } }
  return `hsl(${Math.round(h)},100%,${Math.round(60 * dim)}%)`;
};
// Temperatur-Farbe des Z906: blau < 30 °C · grün ab 30 · gelb ab 50 · orange ab 65 · rot ab 75 °C
const THUE = [[0, 205], [28, 205], [31, 135], [48, 120], [51, 54], [63, 48], [66, 30], [73, 26], [76, 3], [150, 0]];
const tempCol = t => {
  t = clamp(t, 0, 150);
  let h = 0;
  for (let i = 1; i < THUE.length; i++) { const [t1, h1] = THUE[i - 1], [t2, h2] = THUE[i]; if (t <= t2) { h = h1 + (h2 - h1) * (t - t1) / (t2 - t1); break; } }
  return `hsl(${Math.round(h)},100%,60%)`;
};

// Sonnenstand (vereinfachte NOAA-Formel, Genauigkeit < 1°): Höhe in Grad + ob die Sonne steigt
const sunPos = (d, lat, lon) => {
  const R = Math.PI / 180, n = (d.getTime() - 946728000000) / 864e5;
  const g = (357.529 + .98560028 * n) * R, q = 280.459 + .98564736 * n;
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * R, e = (23.439 - 3.6e-7 * n) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ha = (((18.697374558 + 24.06570982441908 * n) * 15 + lon - ra / R) % 360 + 540) % 360 - 180;
  const el = Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha * R)) / R;
  return { el, rising: ha < 0 };
};
// Farbstützpunkte je Sonnenhöhe: [Höhe, Grundton, 4 Aurora-Farben, Intensität]
const SKY_NIGHT = ['#060a18', '#1d3fa8', '#2a86d9', '#1fb8a6', '#5a36c8', .62];
const SKY_DAY = ['#252b35', '#fffaf0', '#cfe8ff', '#fff4d6', '#e8f4ff', .66];
const SKY_UP = [[-18, ...SKY_NIGHT], [-12, '#0a0c20', '#2a3a9c', '#5a4bc8', '#2aa6c0', '#7a3fb8', .62], [-6, '#161228', '#6a3fa8', '#d0588a', '#3a6fd0', '#f07a8a', .66],
  [-1, '#1f1520', '#ff7a4c', '#ffb347', '#c8508a', '#ff9a6a', .7], [4, '#231a13', '#ffc34d', '#ffa53c', '#ffe08a', '#ff8a4c', .66], [12, '#24231f', '#ffeab0', '#ffd88a', '#fff6e0', '#d6ecff', .62], [28, ...SKY_DAY]];
const SKY_DOWN = [[-18, ...SKY_NIGHT], [-12, '#0a0c20', '#3a3aa8', '#6a3fb8', '#2a86d9', '#2a5ac0', .62], [-6, '#170c1e', '#b03a6a', '#7a3ab8', '#ff5a4a', '#3a4ac8', .68],
  [-1, '#26100f', '#ff4a2e', '#ff2d55', '#ff8a3c', '#c03a7a', .74], [4, '#26170f', '#ff9a3c', '#ff6a3c', '#ffc070', '#ff4a4a', .7], [12, '#25201c', '#ffe4a8', '#ffc880', '#fff2d8', '#ffc080', .62], [28, ...SKY_DAY]];
// Umrisse der leuchtenden Aurora-Bänder (Koordinaten 0–100, unten der helle, geschwungene Rand)
const AURORA = [
  'M0 34 C18 12 36 40 56 22 S86 4 100 16 L100 58 C86 74 70 52 52 64 S16 84 0 66 Z',
  'M0 20 C22 2 44 26 64 10 S92 6 100 14 L100 52 C80 66 64 46 44 60 S12 70 0 58 Z',
  'M0 30 C24 18 48 36 70 22 S94 20 100 26 L100 60 C78 74 58 58 38 70 S10 76 0 64 Z',
  'M0 26 C20 8 46 30 68 14 S94 12 100 20 L100 62 C82 78 62 60 40 72 S12 80 0 68 Z',
];
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const x = hex2(a), y = hex2(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const skyAt = (el, rising) => {
  const T = rising ? SKY_UP : SKY_DOWN;
  let i = T.findIndex(s => el <= s[0]);
  if (i === -1) i = T.length - 1;
  const a = T[Math.max(0, i - 1)], b = T[i], t = a === b ? 0 : clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
  const k = t * t * (3 - 2 * t); // weich ein- und auslaufen
  return { base: mixHex(a[1], b[1], k), c: [2, 3, 4, 5].map(j => mixHex(a[j], b[j], k)), i: a[6] + (b[6] - a[6]) * k };
};

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>';
const PWR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/></svg>';
const SVG = p => `<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const IC = {
  prev: SVG('<path d="M6 6h2v12H6zM9.5 12L18 18V6z"/>'),
  play: SVG('<path d="M8 5v14l11-7z"/>'),
  pause: SVG('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
  stop: SVG('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  next: SVG('<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>'),
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
};
const WX_DE = { 'clear-night': 'klar', cloudy: 'bewölkt', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', partlycloudy: 'teils bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'sonnig', windy: 'windig', 'windy-variant': 'windig', exceptional: 'Unwetter' };
// Wettersymbole mit leichter Animation (Strahlen drehen, Wolken ziehen, Regen/Schnee fällt, Blitz flackert)
const SUN = '<g class="wsr"><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M7.5 24.5l2-2M22.5 9.5l2-2" stroke="#ffc34d" stroke-width="2" stroke-linecap="round"/></g><circle class="wsc" cx="16" cy="16" r="6" fill="#ffc34d"/>';
const MOON = '<path class="wmo" d="M17 5a7 7 0 1 0 8.5 8.5A6 6 0 0 1 17 5z" fill="#ffd27a"/><circle class="wst" cx="7" cy="8" r=".9" fill="#fff"/><circle class="wst" cx="25" cy="24" r=".7" fill="#fff" style="animation-delay:-1.3s"/>';
const CLOUD = (y = 0, c = '#9aa3b2') => `<g class="wcl"><path transform="translate(0 ${y})" d="M23 22H10a5.5 5.5 0 1 1 5.2-7.3h.3A4.4 4.4 0 0 1 24 16a3 3 0 0 1-1 6z" fill="${c}"/></g>`;
const drops = (el, n = 3) => [12, 17, 22].slice(0, n).map((x, i) => el(x, i)).join('');
const wxIcon = c => {
  let b;
  switch (c) {
    case 'sunny': b = SUN; break;
    case 'clear-night': b = MOON; break;
    case 'partlycloudy': b = '<g class="wsr" style="transform-origin:12px 12px"><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" stroke="#ffc34d" stroke-width="1.6" stroke-linecap="round"/></g><circle class="wsc" cx="12" cy="12" r="5" fill="#ffc34d"/><g class="wcl"><path d="M24 25H12a5 5 0 1 1 4.8-6.5h.2A4 4 0 0 1 25 19a3 3 0 0 1-1 6z" fill="#b4bcc8"/></g>'; break;
    case 'rainy': case 'pouring': b = drops((x, i) => `<path class="wrn" style="animation-delay:${-i * .37}s" d="M${x} 24l-1 3" stroke="#6fb2ff" stroke-width="2" stroke-linecap="round"/>`) + CLOUD(); break;
    case 'snowy': case 'snowy-rainy': case 'hail': b = drops((x, i) => `<circle class="wsn" style="animation-delay:${-i * .8}s" cx="${x}" cy="26" r="1.6" fill="#fff"/>`) + CLOUD(); break;
    case 'lightning': case 'lightning-rainy': b = CLOUD() + '<path class="wbt" d="M17 22l-3 5h3l-2 4 5-6h-3l2-3z" fill="#ffd166"/>'; break;
    case 'fog': b = '<path class="wfg" d="M6 12h20" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/><path class="wfg" style="animation-direction:alternate-reverse" d="M4 17h24" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/><path class="wfg" d="M7 22h18" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/>'; break;
    case 'windy': case 'windy-variant': b = '<path class="wwd" d="M4 12h15a3 3 0 1 0-3-3M4 18h21a3 3 0 1 1-3 3M4 24h10" stroke="#b4bcc8" stroke-width="2.2" fill="none" stroke-linecap="round"/>'; break;
    default: b = CLOUD();
  }
  return `<svg class="wx" viewBox="0 0 32 32">${b}</svg>`;
};

// Standard-Grundriss (wird durch floorplan.image ersetzt)
const PLAN_SVG = `<svg viewBox="0 0 360 340" width="100%" height="100%" style="display:block">
<defs><pattern id="rtcwood" width="90" height="18" patternUnits="userSpaceOnUse"><rect width="90" height="18" fill="#2c261f"/><rect y="9" width="90" height="9" fill="#2f2821"/><path d="M0 8.5H90M0 17.5H90" stroke="#1f1a15"/><path d="M28 0V9M72 9V18" stroke="#1f1a15"/></pattern>
<radialGradient id="rtclamp"><stop offset="0" stop-color="rgba(255,180,90,.28)"/><stop offset="1" stop-color="rgba(255,180,90,0)"/></radialGradient></defs>
<rect x="20" y="20" width="320" height="300" fill="url(#rtcwood)"/><circle cx="165" cy="170" r="120" fill="url(#rtclamp)"/>
<rect x="78" y="112" width="170" height="130" rx="6" fill="#3a3e48" stroke="#4b505c" stroke-width="2" opacity=".9"/>
<rect x="62" y="252" width="196" height="42" rx="9" fill="#4a4e57" stroke="#5a5f69"/><rect x="62" y="150" width="42" height="144" rx="9" fill="#4a4e57" stroke="#5a5f69"/>
<path d="M110 258h40M160 258h40M210 258h40M68 200v40M68 160v34" stroke="#3b3f47" stroke-width="3" stroke-linecap="round"/>
<rect x="140" y="150" width="76" height="46" rx="5" fill="#5a4632" stroke="#735a41"/><circle cx="160" cy="170" r="5" fill="#3d7a4d"/>
<rect x="270" y="238" width="48" height="48" rx="10" fill="#4a4e57" stroke="#5a5f69"/>
<rect x="148" y="30" width="72" height="14" rx="2" fill="#1c1d20" stroke="#4a4d54"/><rect x="156" y="44" width="56" height="3" fill="#6fb2ff" opacity=".5"/>
<circle cx="312" cy="298" r="12" fill="#2f5e3b"/><circle cx="306" cy="293" r="6" fill="#3f7a4d"/><circle cx="318" cy="302" r="5" fill="#3f7a4d"/>
<rect x="20" y="20" width="320" height="300" fill="none" stroke="#5b5f67" stroke-width="10"/>
</svg>`;

const CSS = `
:host{display:block;position:relative;overflow:hidden;background:#111215;--fz:1}
*{box-sizing:border-box;margin:0}
.stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:top left;overflow:hidden;color:#c9ccd2;padding:14px;line-height:1.2;
  font-family:Rajdhani,'Segoe UI',sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  background-color:#141519;transition:background-color 12s linear}
.stage::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(118deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,0) 30%)}
.blob{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;transition:background 1s}
.sky{position:absolute;inset:-12%;pointer-events:none;transition:opacity 12s linear}
.sky::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.45))}
.wash{position:absolute;left:5%;top:0;width:90%;height:70%;border-radius:50%;filter:blur(90px);opacity:.26;mix-blend-mode:screen;transition:background-color 12s linear}
.au{position:absolute;filter:blur(15px);mix-blend-mode:screen;color:#1d3fa8;transition:color 12s linear,transform var(--td,24s) cubic-bezier(.45,0,.55,1);will-change:transform,opacity}
.au svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.au.a1{left:2%;top:8%;width:72%;height:42%;transform:rotate(-7deg);animation:rtcgl 9s ease-in-out infinite alternate}
.au.a2{left:40%;top:2%;width:62%;height:36%;transform:rotate(6deg);animation:rtcgl 11s ease-in-out -4s infinite alternate}
.au.a3{left:14%;top:36%;width:64%;height:30%;transform:rotate(-3deg);animation:rtcgl2 13s ease-in-out -6s infinite alternate}
.au.a4{left:58%;top:40%;width:44%;height:34%;transform:rotate(11deg);animation:rtcgl2 10s ease-in-out -2s infinite alternate}
.still .au{animation:none}
@keyframes rtcgl{from{opacity:.78}to{opacity:1}}
@keyframes rtcgl2{from{opacity:.55}to{opacity:.92}}
.z{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;gap:14px}
.mono{font-family:'Share Tech Mono',monospace}
.eng{text-shadow:0 1px 0 rgba(255,255,255,.07),0 -1px 0 #000}
.cap{font-size:12px;letter-spacing:2.5px;color:#9a9fa8;font-weight:700;text-transform:uppercase}
.led{width:9px;height:9px;border-radius:50%;flex:none;background:var(--lc,#3a3c41);box-shadow:0 0 8px var(--lc,transparent)}
.acc{color:var(--acc);text-shadow:0 0 10px var(--accg)}
.heat{color:#ff8a4c;text-shadow:0 0 10px rgba(255,120,60,.7)}
[data-act]{cursor:pointer}
.plate{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(50,52,58,var(--pa1,.78)),rgba(24,25,29,var(--pa2,.88)));
  -webkit-backdrop-filter:var(--pbf,none);backdrop-filter:var(--pbf,none);
  border:1px solid rgba(255,255,255,.07);box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 20px 36px rgba(0,0,0,.55)}
.plate::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:linear-gradient(125deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,.02) 28%,rgba(255,255,255,0) 29%)}
.card{padding:16px 18px}
.head{display:flex;align-items:center;gap:10px}.head .t{flex:1;min-width:0}
.head h2{font-size:18px;letter-spacing:2.5px;text-transform:uppercase;color:#e2e4e8;line-height:1.1}
.head p{font-size:11.5px;letter-spacing:1.3px;color:#979ca5;text-transform:uppercase;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grid{flex:1;display:grid;grid-template-columns:404px 404px 416px;grid-template-rows:minmax(0,1fr);gap:14px;min-height:0}
.col{grid-row:1;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;min-height:0}
.mod{display:flex;flex-direction:column;min-height:0}
.mod>.plate{flex:1 1 auto!important;min-height:0!important;height:auto!important;margin-top:0!important}
.xcard{position:relative;min-height:0;overflow:auto;border-radius:20px;scrollbar-width:none}
.xcard>*{display:block;height:100%}
.xerr{padding:14px;border-radius:20px;background:rgba(255,90,90,.12);color:#ff8a8a;font-size:13px}
.strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.strip .rk{height:44px;padding:0 7px;gap:5px;box-shadow:0 4px 0 #0b0b0c,0 6px 10px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1)}.strip .rk:not(.off)>svg{width:15px;height:15px}
.strip .rk::after{left:9px;right:9px;bottom:4px;height:2px}.strip .rk>div:first-of-type{min-width:0}
.strip .rk .nm{font-size:10.5px;letter-spacing:.2px;line-height:1.3;white-space:nowrap}.strip .rk .st{font-size:17px;letter-spacing:1.5px}
.strip .rk .since{font-size:9.5px;line-height:1.15;flex:none}.strip .rk .since b{font-size:12.5px}
.strip .rk.off{gap:7px;padding:0 8px;color:#ff6b6b}.strip .rk.off::after{display:none}.strip .rk.off svg{width:18px;height:18px}
.strip .rk.off .nm{font-size:12px;letter-spacing:1.5px;color:#ff8a8a;white-space:nowrap}
.strip .rk.on{transform:translateY(2px);box-shadow:0 2px 0 #0b0b0c,0 4px 8px rgba(0,0,0,.5),0 0 20px var(--g),inset 0 1px 0 rgba(255,255,255,.1)}
.rk{height:56px;border-radius:13px;position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:0 18px;color:#9a9ea6;
  background:linear-gradient(180deg,#36383d,#222327);box-shadow:0 5px 0 #0b0b0c,0 8px 14px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);transition:transform .08s}
.rk::before{content:"";position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.08),rgba(255,255,255,0) 38%)}
.rk::after{content:"";position:absolute;left:18px;right:18px;bottom:6px;height:3px;border-radius:2px;background:#3a3c41;box-shadow:inset 0 1px 2px #000}
.rk svg{width:26px;height:26px;flex:none}
.rk .nm{font-size:13px;letter-spacing:2.5px;font-weight:700;text-transform:uppercase;color:#9a9ea6;line-height:1}
.rk .st{font-size:22px;letter-spacing:3px;font-weight:700;text-transform:uppercase;line-height:1.05;color:#b5b9c0}
.rk .since{margin-left:auto;text-align:right;font-family:'Share Tech Mono',monospace;font-size:13px;color:#8d929b;line-height:1.25}
.rk .since b{display:block;font-weight:400;font-size:17px;color:#c9ccd2}
.rk.on{transform:translateY(3px);box-shadow:0 2px 0 #0b0b0c,0 4px 8px rgba(0,0,0,.5),0 0 26px var(--g),inset 0 1px 0 rgba(255,255,255,.1)}
.rk.on::after{background:var(--c);box-shadow:0 0 10px var(--c)}
.rk.on svg{color:var(--c);filter:drop-shadow(0 0 5px var(--c))}
.rk.on .st{color:var(--t);text-shadow:0 0 12px var(--g)}
.rk:active{transform:translateY(4px)}
.rk.off{justify-content:center;color:#ff6b6b}
.rk.na{opacity:.5;filter:grayscale(.7)}
.rk.na:active,.na .hk:active,.na .key:active,.na.pmw:active{transform:none}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px;border-radius:13px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.tab{position:relative;height:44px;border-radius:9px;display:flex;align-items:center;gap:9px;padding:0 12px;font-size:14px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#9a9fa8}
.tab small{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:13px;letter-spacing:0;font-weight:400}
.tab.on{color:#f0f1f3;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 3px 0 #0b0b0c,0 5px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12)}
.tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:4px;height:2px;border-radius:1px;background:var(--tc);box-shadow:0 0 6px var(--tc)}
.tab .led{transition:background .3s,box-shadow .3s}
.dwrap{position:relative;flex:none;touch-action:none;cursor:pointer}
.dial{position:absolute;left:0;top:0;width:330px;height:330px;transform-origin:top left}
.dot{position:absolute;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#2a2b2f;box-shadow:inset 0 1px 1px #000}
.skirt{position:absolute;left:30px;top:30px;width:270px;height:270px;border-radius:50%;background:repeating-conic-gradient(#34363b 0 2deg,#0b0b0d 2deg 4deg);box-shadow:0 18px 30px rgba(0,0,0,.85),0 5px 8px rgba(0,0,0,.7),0 0 0 2px #050506,inset 0 0 0 1px rgba(255,255,255,.05)}
.bezel{position:absolute;left:12px;top:12px;width:246px;height:246px;border-radius:50%;background:conic-gradient(from 20deg,#3c3e44,#141518,#4b4e55,#101113,#37393f,#131417,#45484e,#111214,#3c3e44);box-shadow:inset 0 2px 2px rgba(255,255,255,.22),inset 0 -3px 5px rgba(0,0,0,.7),0 0 0 1px #000}
.wheel,.face{position:absolute;left:16px;top:16px;width:214px;height:214px;border-radius:50%;overflow:hidden}
.wheel{background:radial-gradient(circle,rgba(255,255,255,.9) 0%,rgba(255,255,255,.55) 16%,rgba(255,255,255,0) 60%),conic-gradient(from 90deg,#ff3b3b,#ffb03b,#f4ff3b,#3bff6f,#3bf0ff,#3b6fff,#b43bff,#ff3bb7,#ff3b3b);box-shadow:inset 0 0 0 3px #111,inset 0 8px 18px rgba(0,0,0,.75),inset 0 -4px 10px rgba(0,0,0,.4);transition:filter .3s}
.face{background:radial-gradient(circle at 50% 70%,rgba(255,110,50,.35),rgba(0,0,0,0) 60%),radial-gradient(circle at 50% 40%,#23252a,#0c0d0f);box-shadow:inset 0 0 0 3px #111,inset 0 8px 18px rgba(0,0,0,.85)}
.wheel::after,.face::after{content:"";position:absolute;inset:0;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.07) 38%,rgba(255,255,255,0) 40%);pointer-events:none}
.handle{position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;z-index:3;background:radial-gradient(circle,var(--hc) 0 42%,transparent 44%),conic-gradient(from 20deg,#55585f,#16171a,#4a4d53,#121315,#55585f);box-shadow:0 4px 8px rgba(0,0,0,.7),0 0 12px var(--hc)}
.hub{position:absolute;left:50%;top:50%;width:108px;height:108px;margin:-54px 0 0 -54px;border-radius:50%;z-index:2;background:conic-gradient(from 20deg,#44464c,#141518,#50535a,#111214,#3e4046,#131417,#44464c);box-shadow:0 6px 14px rgba(0,0,0,.8),inset 0 1px 1px rgba(255,255,255,.2);display:grid;place-items:center}
.hub .lcd{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;text-align:center;padding:0}
.hub b{font-size:34px;font-weight:400;line-height:1}.hub span{font-size:12px;display:block;opacity:.8;margin-top:2px}
.tlcd{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-family:'Share Tech Mono',monospace;z-index:2}
.tlcd b{font-size:62px;font-weight:400;line-height:1}.tlcd .u{font-size:16px;letter-spacing:3px;opacity:.8}.tlcd .i{font-size:18px;color:#c9ccd2;margin-top:8px;opacity:.9}
.lcd{border-radius:11px;padding:9px 12px;background:linear-gradient(180deg,#110e0a,#060504);box-shadow:inset 0 4px 10px #000,0 1px 0 rgba(255,255,255,.08);font-family:'Share Tech Mono',monospace;position:relative;overflow:hidden}
.lcd::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px),linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,0) 40%);pointer-events:none}
.lcd .row{display:flex;justify-content:space-between;align-items:baseline;gap:6px;white-space:nowrap}
.keys2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.keys4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.hk{height:40px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;color:#9a9ea6;background:linear-gradient(180deg,#34363b,#222327);box-shadow:0 4px 0 #0b0b0c,0 6px 10px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1)}
.hk i{width:14px;height:4px;border-radius:2px;background:#3a3c41;box-shadow:inset 0 1px 2px #000}
.hk.on{transform:translateY(3px);color:#f0f1f3;box-shadow:0 1px 0 #0b0b0c,0 3px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.on i{background:var(--c);box-shadow:0 0 10px var(--c)}
.hk:active{transform:translateY(4px)}
.trow{position:relative;height:273px;margin:16px 0 0}
.tmm{position:absolute;top:208px;left:104px;right:104px;display:flex;justify-content:space-between}
.trow .dwrap{position:absolute;left:50%;top:0;margin-left:-118px}
.pmw{position:absolute;top:43px;width:90px;height:150px;filter:drop-shadow(0 4px 0 #0b0b0c) drop-shadow(0 7px 9px rgba(0,0,0,.55));transition:transform .08s,filter .08s;cursor:pointer}
.pmw:active{transform:translateY(3px);filter:drop-shadow(0 1px 0 #0b0b0c) drop-shadow(0 3px 5px rgba(0,0,0,.5))}
.pmw.l{left:0}.pmw.r{right:0}
.pm{width:100%;height:100%;border-radius:14px;display:flex;align-items:center;font:700 32px Rajdhani,sans-serif;color:#d8dade;background:linear-gradient(180deg,#3a3c42,#222327 55%,#1c1d20);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.pmw.l .pm{padding-left:20px;-webkit-mask:radial-gradient(circle at calc(100% + 94px) 50%,transparent 126px,#000 126.5px);mask:radial-gradient(circle at calc(100% + 94px) 50%,transparent 126px,#000 126.5px)}
.pmw.r .pm{justify-content:flex-end;padding-right:20px;-webkit-mask:radial-gradient(circle at -94px 50%,transparent 126px,#000 126.5px);mask:radial-gradient(circle at -94px 50%,transparent 126px,#000 126.5px)}
.sect{display:flex;justify-content:space-between;margin:0 0 5px}
.slot{height:32px;position:relative;touch-action:none;cursor:pointer}
.slot .groove{position:absolute;left:0;right:0;top:12px;height:8px;border-radius:4px;box-shadow:inset 0 2px 4px #000,0 1px 0 rgba(255,255,255,.07)}
.ticks{position:absolute;left:0;right:0;top:25px;height:7px;background:repeating-linear-gradient(90deg,#4a4d53 0 1px,transparent 1px 10%)}
.fader{position:absolute;top:0;width:22px;height:32px;margin-left:-11px;border-radius:5px;background:linear-gradient(90deg,#9ea1a7,#e9eaec 30%,#c4c6ca 50%,#8d9096 52%,#d6d8db 80%,#8f9298);box-shadow:0 6px 10px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.6)}
.fader::after{content:"";position:absolute;left:50%;top:4px;bottom:4px;width:2px;margin-left:-1px;background:var(--acc);box-shadow:0 0 6px var(--acc)}
.tempg{background:linear-gradient(90deg,#ff8a2b,#ffc27a 30%,#fff1dc 55%,#dfeaff 78%,#9fc3ff);opacity:.85}
.keys8{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.key{height:32px;border-radius:7px;position:relative;background:linear-gradient(180deg,#34363b,#232428);box-shadow:0 4px 0 #0d0d0f,0 6px 10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.key::after{content:"";position:absolute;left:7px;right:7px;top:7px;height:7px;border-radius:3px;background:var(--c);opacity:.35}
.key.on{transform:translateY(3px);box-shadow:0 1px 0 #0d0d0f,0 0 16px var(--c),inset 0 1px 0 rgba(255,255,255,.1)}
.key.on::after{opacity:1;box-shadow:0 0 10px var(--c),0 0 3px #fff}
.dim{opacity:.42}.na{opacity:.45;filter:grayscale(.6)}
.lock{opacity:.25!important;pointer-events:none;filter:grayscale(1)}
.tile{position:relative;overflow:hidden;border-radius:12px;padding:9px 12px;background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05);min-width:0}
.tile .n{font-size:11.5px;letter-spacing:2px;font-weight:700;color:#8a8e96;text-transform:uppercase;display:flex;justify-content:space-between;gap:4px;white-space:nowrap}
.tile .val{font-family:'Share Tech Mono',monospace;font-size:26px;color:#e8e9ec;line-height:1.1;margin-top:3px;white-space:nowrap}
.tile .val small{font-size:13px;color:#8a8e96}
.tile.ht{position:absolute;top:209px;width:90px;padding:8px 10px}.ht.l{left:0}.ht.r{right:0}.ht .val{font-size:22px}
.bar{height:6px;border-radius:3px;margin-top:6px;background:#15161a;box-shadow:inset 0 1px 2px #000;position:relative;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;transition:width .6s}
.fc{display:grid;gap:8px}
.fc>div{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;padding:5px 0 4px;min-height:0;overflow:hidden;border-radius:10px;background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05)}
.fc svg{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-22px 0 0 -23px;z-index:0}
.fc .d,.fc .ft{position:relative;z-index:1;text-shadow:0 0 3px #000,0 0 6px rgba(0,0,0,.9),0 1px 2px #000}
.fc .d{font-size:10.5px;letter-spacing:1.5px;font-weight:700;color:#aeb2b9}.fc .tt{font-size:12px;color:#f0f1f3}.fc .pp{font-size:10px;color:#9fc3ff;margin-top:1px;font-weight:600}
#w-ic svg{width:100%;height:100%;display:block}
.wx .wsr{transform-origin:16px 16px;animation:wxspin 30s linear infinite}
.wx .wsc,.wx .wmo{animation:wxpulse 4s ease-in-out infinite alternate}
.wx .wcl{animation:wxdrift 7s ease-in-out infinite alternate}
.wx .wrn{animation:wxrain 1.1s linear infinite}
.wx .wsn{animation:wxsnow 2.4s linear infinite}
.wx .wbt{animation:wxflash 3.5s linear infinite}
.wx .wfg{animation:wxfog 5s ease-in-out infinite alternate}
.wx .wst{animation:wxtw 2.6s ease-in-out infinite}
.wx .wwd{stroke-dasharray:18 5;animation:wxwind 3s linear infinite}
.calm .wx *{animation:none !important}
@keyframes wxspin{to{transform:rotate(360deg)}}
@keyframes wxpulse{from{opacity:.8}to{opacity:1}}
@keyframes wxdrift{from{transform:translateX(-1.2px)}to{transform:translateX(1.4px)}}
@keyframes wxrain{0%{transform:translateY(-3px);opacity:0}25%{opacity:1}100%{transform:translateY(4px);opacity:0}}
@keyframes wxsnow{0%{transform:translate(0,-3px);opacity:0}30%{opacity:1}100%{transform:translate(1px,4px);opacity:0}}
@keyframes wxflash{0%,80%,86%,100%{opacity:1}83%,90%{opacity:.15}}
@keyframes wxfog{from{transform:translateX(-1.5px)}to{transform:translateX(1.5px)}}
@keyframes wxtw{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes wxwind{to{stroke-dashoffset:-46}}
.planbox{flex:1;min-height:0;margin-top:12px;border-radius:14px;overflow:hidden;background:#0d0f12;container-type:size;box-shadow:inset 0 3px 10px #000,0 1px 0 rgba(255,255,255,.07);position:relative;display:grid;place-items:center}
.planbox::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(150deg,rgba(255,255,255,.07),rgba(255,255,255,0) 35%)}
.planar{position:relative;width:min(100cqw,100cqh * var(--ar));height:min(100cqh,100cqw / var(--ar));container-type:size}
.plrot{position:absolute;left:50%;top:50%;width:100cqw;height:100cqh;transform:translate(-50%,-50%) rotate(var(--rot))}
.plrot.q{width:100cqh;height:100cqw}
.planar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.mk{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#1b1d20;border:2px solid var(--mc);display:grid;place-items:center;font:700 12px Rajdhani,sans-serif;color:var(--mc);box-shadow:0 0 10px var(--mg);z-index:2}
.mk.open{animation:rtcpulse 1.6s infinite}
@keyframes rtcpulse{0%,100%{box-shadow:0 0 6px var(--mg)}50%{box-shadow:0 0 18px var(--mc)}}
.lg3{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px;font-weight:600;color:#aeb2b9;white-space:nowrap;margin-top:12px}
.lg3 div{display:flex;align-items:center;gap:8px;min-width:0}.lg3 span.n{overflow:hidden;text-overflow:ellipsis}
.lg3 b{margin-left:auto;font-family:'Share Tech Mono',monospace;font-weight:400;font-size:13px;color:var(--mc)}
.aud{position:relative;height:100%}
.apage{position:absolute;inset:0;transition:opacity .25s}
#mc[data-view="main"] .adet,#mc[data-view="det"] .amain{opacity:0;pointer-events:none}
.atab{position:absolute;right:96px;top:5px;z-index:5;display:flex;gap:3px;padding:3px;border-radius:9px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05)}
#mc[data-view="det"] .atab{right:0;top:0}
.atab b{font:700 10px Rajdhani,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#9a9fa8;padding:4px 6px;border-radius:6px;cursor:pointer}
#mc[data-view="main"] .atab b[data-v="main"],#mc[data-view="det"] .atab b[data-v="det"]{color:#f0f1f3;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.amain>.hk,.adet>.hk{position:absolute}
.hk.sm{height:24px;font-size:11px;letter-spacing:1.4px;border-radius:7px;gap:6px;box-shadow:0 3px 0 #0b0b0c,0 5px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.sm.on{transform:translateY(2px);box-shadow:0 1px 0 #0b0b0c,0 3px 5px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.sm i{width:10px;height:3px}
.hk.empty{color:#8a8f98}
.alcd{position:absolute;padding:3px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:8px;text-align:center}
.alcd span{font-size:8px;letter-spacing:1.5px;color:#8a8e96;line-height:1}
.alcd b{font-weight:400;font-size:19px;line-height:1;color:#979ca5;text-shadow:0 0 10px currentColor;white-space:nowrap}
.fsl{position:absolute;width:16px;touch-action:none;cursor:pointer}
.fsl .segs{position:absolute;inset:0;display:flex;flex-direction:column-reverse;gap:2px;padding:4px 3px;border-radius:5px;background:linear-gradient(180deg,#141518,#1e1f23);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.07)}
.fsl .segs i{flex:1;border-radius:1px;background:#26282c;transition:background .12s}
.fsl .knob{position:absolute;left:50%;width:30px;height:16px;margin-left:-15px;border-radius:4px;z-index:2;background:conic-gradient(from 20deg,#55585f,#1c1d20,#4a4d53,#16171a,#55585f);box-shadow:0 4px 8px rgba(0,0,0,.85),0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.25);transition:bottom .12s}
.fsl .knob::after{content:"";position:absolute;left:8px;right:8px;top:50%;height:2px;margin-top:-1px;border-radius:1px;background:var(--vc,#3a3c41);box-shadow:0 0 6px var(--vc,transparent)}
.fsl.ro{cursor:default}
.fsl.na{opacity:.4}
.apwf{position:absolute;z-index:2;padding:3px;border-radius:9px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05)}
.apwf b svg{transition:filter .2s}
.apwf b{display:flex;align-items:center;justify-content:center;width:46px;height:20px;border-radius:6px;cursor:pointer;color:#979ca5;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.ainfo{position:absolute;font-size:9.5px;letter-spacing:.6px;line-height:1.4;font-weight:700;color:#8a8e96;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.ainfo b{color:#c9ccd2;font-weight:700}
.adisp{position:absolute;border-radius:4px;padding:5px 8px 4px;display:flex;flex-direction:column;overflow:hidden}
.adisp .ainfo{position:static;text-align:left;font-size:8.5px;letter-spacing:0;padding-bottom:4px;border-bottom:2px solid rgba(90,94,102,.45)}
.ainfo s{display:inline-block;width:2px;height:9px;margin:0 5px;vertical-align:-1px;background:rgba(90,94,102,.6);text-decoration:none}
.adisp .mqw{position:relative;flex:1;overflow:hidden}
.adisp .mq{position:absolute;left:0;top:50%;white-space:nowrap;font-size:16px;line-height:1;color:var(--acc);text-shadow:0 0 10px var(--accg);will-change:transform;transform:translate(var(--mqa,0),-50%)}
.adisp .mq.run{animation:rtcmq var(--mqd,10s) linear infinite}
@keyframes rtcmq{from{transform:translate(var(--mqa,0),-50%)}to{transform:translate(var(--mqx,0),-50%)}}
.mbtn{position:absolute;display:flex;gap:7px}
.mbtn .hk.ic{flex:1;width:auto;height:32px}.mbtn .hk.ic svg{width:16px;height:16px}
.mbtn #m-mute{order:-1;margin-right:7px}
#m-vu .segs i{transition:none}
.apre{position:absolute;display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
.apick{position:absolute;left:0;top:40px;width:100%;z-index:7;padding:10px 12px 12px;border-radius:12px;background:linear-gradient(180deg,rgba(40,42,48,.97),rgba(20,21,25,.98));box-shadow:0 0 0 1px #000,0 12px 30px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12)}
.apick .apo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.apick[hidden],.ppop[hidden]{display:none}
.ppop{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ppbox{width:470px;padding:18px 22px 20px}
.ppsl{display:flex;justify-content:space-around;margin:16px 0 18px}
.ppc{position:relative;width:60px;height:250px}
.ppef{display:flex;align-items:center;gap:8px;margin:0 0 16px}
.ppef .cap{margin-right:4px}
.ppef .hk.sm{flex:1;height:28px}
#pp-e>.hk:first-child{flex:1.7}
.ppbtn{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px}
.cmp .tile .n span{display:none}
.spark{position:absolute;left:8px;right:8px;top:22px;bottom:15px;display:flex;align-items:flex-end;gap:1.5px;opacity:.3;pointer-events:none}
.spark i{flex:1;min-height:1px;border-radius:1.5px 1.5px 0 0}
.tile>:not(.spark){position:relative}
.hk.ic{width:36px;height:36px;flex:none;padding:0}.hk.ic svg{width:18px;height:18px}
.chip{font-size:11.5px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:7px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05);color:#aeb2b9;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none}
.np{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.status{height:66px;flex:none;display:flex;align-items:center;padding:0 18px}
.status .it{display:flex;align-items:center;gap:10px;padding:0 16px;white-space:nowrap;height:42px;border-left:1px solid rgba(0,0,0,.6);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.status .it:first-child{border:0;box-shadow:none;padding-left:0}
.status .s{font-size:11.5px;letter-spacing:1.5px;color:#9a9fa8;font-weight:700;text-transform:uppercase;margin-top:2px}
.status .v{font-size:17px;color:#e6e7ea;font-weight:700;line-height:1;max-width:260px;overflow:hidden;text-overflow:ellipsis}
#s-np .v{max-width:220px}
.status svg{width:26px;height:26px;flex:none}
.lcdtime{font-size:32px;color:#ffb347;padding:3px 14px;border-radius:9px;line-height:1.05;background:linear-gradient(180deg,#1a1206,#0d0903);box-shadow:inset 0 3px 8px #000,0 1px 0 rgba(255,255,255,.08);text-shadow:0 0 12px rgba(255,170,60,.8)}
.av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;margin-left:-8px;border:2px solid #1d1e22}
`;

class RaumTabletCard extends HTMLElement {
  static getStubConfig() { return { lights: { primary: { entity: '' }, secondary: { entity: '' } } }; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tab = 'primary';
    this._last = { primary: {}, secondary: {} };
    this._drag = null;
    this._fc = null;
    if (!document.getElementById('rtc-fonts')) {
      const l = document.createElement('link');
      l.id = 'rtc-fonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap';
      document.head.appendChild(l);
    }
  }

  setConfig(config) {
    if (!config || !config.lights || !config.lights.primary || !config.lights.secondary) throw new Error('lights.primary und lights.secondary sind erforderlich');
    const L = (d, c) => Object.assign({}, d, c);
    this._c = {
      lights: {
        primary: L({ name: 'Primär', subtitle: 'Hauptlicht', color: '#ffb347' }, config.lights.primary),
        secondary: L({ name: 'Sekundär', subtitle: 'Akzentlicht', color: '#a36bff' }, config.lights.secondary),
      },
      favorites: config.favorites || [{ kelvin: 2700 }, { kelvin: 4000 }, { kelvin: 6000 }, { hs: [0, 90] }, { hs: [140, 80] }, { hs: [195, 90] }, { hs: [268, 70] }, { hs: [320, 85] }],
      climate: L({ min: 12, max: 28, title: 'Heizung', subtitle: 'Heizkörper' }, config.climate),
      air: config.air || [],
      // rotate: ganzen Grundriss im Uhrzeigersinn drehen (0/90/180/270), z. B. für ein zweites Tablet an der Gegenwand
      floorplan: (fp => (fp.rot = ((Math.round((Number(fp.rotate) || 0) / 90) * 90) % 360 + 360) % 360, fp))(L({ title: 'Grundriss', aspect: 360 / 340, contacts: [] }, config.floorplan)),
      weather: config.weather,
      alarm: config.alarm,
      persons: config.persons,
      calendar: config.calendar,
      // Audio: Lautstärke (number/input_number oder Mediaplayer) + Mediaplayer-Liste für die Wiedergabe
      media: config.media ? (() => {
        const mm = L({ title: 'Audio', players: [], signal_floor: 15000, detail_timeout: 20, preset_count: 6 }, config.media), COLS = ['#4dc3ff', '#a36bff', '#3ddc84', '#ffb347'];
        // Kanäle: eigene Liste, sonst "volume" als einzelner Kanal, sonst Lautstärke des aktiven Players
        const chs = config.media.channels || (config.media.volume ? [{ name: 'Main', entity: config.media.volume }] : [{ name: 'Main', player: true }]);
        mm.channels = chs.slice(0, 4).map((ch, k) => L({ color: COLS[k], label: String(ch.name || 'CH' + (k + 1)).toUpperCase() }, ch));
        mm.source_names = L({}, config.media.source_names);                  // z. B. "Input 1": "6-Kanal Direkt"
        mm.effect_names = L({ Off: 'Aus' }, config.media.effect_names);
        return mm;
      })() : null,
      bottom_offset: config.bottom_offset || 0,
      // Hintergrund: mode "sun" = Aurora nach Sonnenstand, "off" = klassisch dunkel
      background: L({ mode: 'sun', animate: true, blur: 18, opacity: .52 }, config.background),
      // Modul-Layout: Spalten mit Modulen (light, weather, heating, air, floorplan, audio) oder beliebigen HA-Karten ({ card: {...} })
      // Module ohne eigenen Konfigurationsblock werden nicht angezeigt (auch nicht im Standard-Layout)
      has: { light: true, floorplan: true, heating: !!config.climate, weather: !!config.weather, air: !!(config.air && config.air.length), audio: !!config.media },
      layout: {
        columns: (config.layout && config.layout.columns) || [{ width: 404, modules: ['light', 'weather'] }, { width: 404, modules: ['heating', 'air'] }, { width: 416, modules: ['floorplan', 'audio'] }],
        statusbar: !(config.layout && config.layout.statusbar === false),
      },
    };
    this._rendered = false; this._prev = {};
    // Zuletzt gewählten Reiter wiederherstellen (übersteht Neuladen der Karte)
    try { const t = localStorage.getItem(this._tabKey()); if (t === 'primary' || t === 'secondary') this._tab = t; } catch (e) { /* ohne Speicher weiter */ }
    if (this._built) { this._built = false; this._build(); if (this._hass) this._update(); }
  }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (this._xc) for (const el of Object.values(this._xc)) el.hass = h;
    if (!this._built) this._build();
    if (first || this._fcFor !== this._c.weather) this._subForecast();
    if (first) this._loadAirHist();
    // Nur neu zeichnen, wenn sich eine der verwendeten Entitäten geändert hat;
    // reiner Signalpegel-Wechsel (mehrmals pro Sekunde) aktualisiert nur den VU-Meter
    const ch = this._changed(h), m = this._c.media;
    if (!ch.length) return;
    if (m && m.signal && ch.every(id => id === m.signal)) this._vuIn();
    else this._update();
  }

  _watchIds(h) {
    const c = this._c, ids = [c.lights.primary.entity, c.lights.secondary.entity, c.climate.entity, c.climate.humidity, c.climate.valve, c.weather, c.alarm, c.calendar];
    c.air.forEach(t => ids.push(t.entity));
    if (c.media) ids.push(c.media.mute, c.media.source, c.media.power, c.media.effect, c.media.dolby, c.media.signal, c.media.temperature, c.media.presets, ...(c.media.players || []), ...c.media.channels.map(ch => ch.entity));
    c.floorplan.contacts.forEach(t => ids.push(t.entity, t.tilt));
    (c.persons || Object.keys(h.states).filter(e => e.startsWith('person.'))).forEach(e => ids.push(e));
    for (const t of ['primary', 'secondary']) { const s = h.states[c.lights[t].entity]; if (s && Array.isArray(s.attributes.entity_id)) ids.push(...s.attributes.entity_id); }
    return ids.filter(Boolean);
  }

  _changed(h) {
    this._prev = this._prev || {};
    const out = this._rendered ? [] : ['*'];
    for (const id of this._watchIds(h)) if (this._prev[id] !== h.states[id]) { this._prev[id] = h.states[id]; out.push(id); }
    this._rendered = true;
    return out;
  }

  _tabKey() { return 'raum-tablet-card:tab:' + this._c.lights.primary.entity; }

  _html(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }

  getCardSize() { return 14; }

  connectedCallback() {
    this._tick(); this._clock = setInterval(() => this._tick(), 10000);
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    this._onResize = () => this._fit(); window.addEventListener('resize', this._onResize);
    requestAnimationFrame(() => this._fit());
    if (this._hass && !this._fcUnsub) this._subForecast();
  }
  disconnectedCallback() {
    clearInterval(this._clock); this._ro && this._ro.disconnect();
    if (this._vuRaf) { cancelAnimationFrame(this._vuRaf); this._vuRaf = null; }
    clearTimeout(this._avT);
    window.removeEventListener('resize', this._onResize);
    if (this._fcUnsub) { this._fcUnsub.then(u => u && u()).catch(() => {}); this._fcUnsub = null; }
  }

  // ---------- Aufbau ----------
  _dial(id, kind, size, scale) {
    let dots = '';
    for (let i = 0; i < 41; i++) { const a = (135 + i / 40 * 270) * Math.PI / 180; dots += `<div class="dot" style="left:${165 + 155 * Math.cos(a)}px;top:${165 + 155 * Math.sin(a)}px"></div>`; }
    const inner = kind === 'light'
      ? '<div class="skirt"><div class="bezel"><div class="wheel"></div></div></div><div class="hub"><div class="lcd acc"><div><b class="hv">--</b><span>% HELL</span></div></div></div><div class="handle"></div>'
      : '<div class="skirt"><div class="bezel"><div class="face"><div class="tlcd"><div><div class="u heat">SOLL</div><b class="heat tv">--</b><div class="i ti">IST --</div></div></div></div></div></div>';
    return `<div class="dwrap" id="${id}" style="width:${size}px;height:${size}px"><div class="dial" style="transform:scale(${scale})">${inner}${dots}</div></div>`;
  }

  _build() {
    if (!this._c) return;
    const c = this._c, fp = c.floorplan;
    const favs = c.favorites.map((f, i) => `<div class="key" data-act="fav:${i}" style="--c:${f.kelvin ? kCss(f.kelvin) : hsCss(f.hs[0], f.hs[1])}"></div>`).join('');
    const pw = t => `<div class="rk" id="pw-${t}" data-act="toggle:${t}">${BULB}<div><div class="nm" id="pw-${t}-nm"></div><div class="st" id="pw-${t}-st">--</div></div><div class="since" id="pw-${t}-si"></div></div>`;
    const plan = fp.image ? `<img src="${fp.image}" alt="">` : PLAN_SVG;
    const planHtml = `<div class="plate card" style="flex:1;min-height:0;display:flex;flex-direction:column">
   <div class="head"><span class="led" id="fp-led"></span><div class="t"><h2 class="eng">${fp.title}</h2><p id="fp-sub"></p></div>
    <div class="lcd" style="padding:5px 10px"><span id="fp-sum" class="mono" style="font-size:13px">--</span></div></div>
   <div class="planbox"><div class="planar" style="--ar:${fp.rot % 180 ? 1 / fp.aspect : fp.aspect}"><div class="plrot${fp.rot % 180 ? ' q' : ''}" style="--rot:${fp.rot}deg">${plan}<svg id="ovl" viewBox="0 0 100 ${100 / fp.aspect}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"></svg></div><div id="markers"></div></div></div>
   <div class="lg3" id="legend"></div>
  </div>`;
    // Audio: Übersicht (Main-Regler, Titel, VU-Meter, Temperatur, Presets) + Einstellungen (alle Kanäle, Dolby, Presets bearbeiten)
    const m = c.media, mcol = (m && m.color) || '#4dc3ff';
    const seg = n => '<i></i>'.repeat(n);
    const sl = (id, x, y, h, n, ro) => `<div class="fsl${ro ? ' ro' : ''}" id="${id}" style="left:${x}px;top:${y}px;height:${h}px"><div class="segs">${seg(n)}</div>${ro ? '' : '<b class="knob"></b>'}</div>`;
    const npre = m ? m.preset_count : 0;
    const audioHtml = !m ? '' : `<div class="plate card" id="mc" data-view="main" style="height:232px;flex:none;padding:12px 16px;--acc:${mcol};--accg:${rgba(mcol, .6)}">
    <div class="aud">
     <div class="atab"><b data-v="main" data-act="aview:main">Übersicht</b><b data-v="det" data-act="aview:det">Einstellungen</b></div>
     <div class="apage amain">
      <div class="lcd alcd" style="left:0;top:0;width:40px;height:36px"><span>VOL</span><b id="m-vv" style="font-size:14px">--</b></div>
      ${sl('m-vs0', 12, 44, 164, 36)}
      <div class="apwf" style="left:60px;top:5px"><b id="m-pw" data-act="mpower">${PWR.replace('<svg', '<svg style="width:13px;height:13px"')}</b></div>
      ${m.source ? '<div class="hk sm" data-act="apick:source" style="left:81px;top:46px;width:84px">Quelle</div>' : ''}
      ${m.effect ? '<div class="hk sm" data-act="apick:effect" style="left:175px;top:46px;width:84px">Effekt</div>' : ''}
      <div class="lcd adisp" style="left:52px;top:78px;width:236px;height:54px"><div class="ainfo" id="m-info"></div><div class="mqw"><div class="mq" id="m-title">--</div></div></div>
      <div class="mbtn" style="left:52px;top:140px;width:236px">
       <div class="hk ic" data-act="media:media_previous_track">${IC.prev}</div><div class="hk ic" id="m-pp" data-act="media:media_play_pause">${IC.play}</div>
       <div class="hk ic" data-act="media:media_stop">${IC.stop}</div><div class="hk ic" data-act="media:media_next_track">${IC.next}</div>
       <div class="hk ic" id="m-mute" data-act="mmute" style="--c:#ff5a5a">${IC.vol}</div>
      </div>
      <div class="apre" id="m-pre" style="left:52px;top:180px;width:236px">${Array.from({ length: npre }, (_, i) => `<div class="hk sm" data-act="preset:${i}" style="--c:var(--acc)"><i></i>${i + 1}</div>`).join('')}</div>
      ${m.signal ? `<div class="lcd alcd" style="left:300px;top:0;width:40px;height:36px"><span>SIG</span><b id="m-sig" style="font-size:14px">--</b></div>
      ${sl('m-vu', 312, 44, 164, 36, true)}` : ''}
      ${m.temperature ? `<div class="lcd alcd" style="left:344px;top:0;width:40px;height:36px"><span>TEMP</span><b id="m-tv" style="font-size:14px">--</b></div>
      ${sl('m-tb', 356, 44, 164, 36, true)}` : ''}
     </div>
     <div class="apage adet">
      ${m.channels.map((ch, k) => `<div class="lcd alcd" style="left:${k * 50}px;top:0;width:44px;height:36px"><span>${ch.label}</span><b id="m-dv${k}">--</b></div>${sl('m-ds' + k, k * 50 + 14, 44, 164, 36)}`).join('')}
      ${m.dolby ? '<div class="hk" id="m-dol" data-act="dolby" style="left:212px;top:32px;width:172px;height:32px;--c:#4dc3ff"><i></i>Dolby</div>' : ''}
      <div class="cap eng" style="position:absolute;left:212px;top:78px;font-size:10.5px">Presets bearbeiten</div>
      <div class="apre" style="left:212px;top:96px;width:172px;grid-template-columns:repeat(3,1fr);gap:8px">${Array.from({ length: npre }, (_, i) => `<div class="hk sm" data-act="pedit:${i}" style="height:30px">✎ P${i + 1}</div>`).join('')}</div>
      <div class="ainfo" style="left:212px;top:192px;width:172px;text-align:left;font-size:9px;color:#979ca5">Zurück zur Übersicht nach ${m.detail_timeout} s</div>
     </div>
     <div class="apick" id="m-pick" hidden></div>
    </div>
   </div>`;
    // Preset-Editor als Fenster über dem ganzen Dashboard
    const presetPop = !m ? '' : `<div class="ppop" id="pp" hidden><div class="plate card ppbox" style="--acc:${mcol};--accg:${rgba(mcol, .6)}">
    <div class="head"><span class="led" style="--lc:${mcol}"></span><div class="t"><h2 class="eng" id="pp-t">Preset</h2><p>Lautstärken${m.effect ? ' und Effekt' : ''} einstellen und speichern</p></div></div>
    <div class="ppsl">${m.channels.map((ch, k) => `<div class="ppc"><div class="lcd alcd" style="left:0;top:0;width:60px;height:40px"><span>${ch.label}</span><b id="pp-v${k}">--</b></div>${sl('pp-s' + k, 22, 50, 196, 44)}</div>`).join('')}</div>
    ${m.effect ? '<div class="ppef"><span class="cap eng">Effekt</span><div id="pp-e" style="display:contents"></div></div>' : ''}
    <div class="ppbtn"><div class="hk" data-act="pcur">Aktuelle Werte</div><div class="hk" data-act="pcancel">Abbrechen</div><div class="hk" data-act="psave" style="color:#3ddc84"><i style="background:#3ddc84;box-shadow:0 0 10px #3ddc84"></i>Speichern</div></div>
   </div></div>`;
    // ---------- Module: frei in layout.columns anordenbar ----------
    const MOD = {
      light: `<div class="plate card" id="lc" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between">
   <div style="display:flex;flex-direction:column;gap:12px"><div class="strip">${pw('primary')}
    <div class="rk off" data-act="alloff">${PWR}<div class="nm">Alles aus</div></div>
    ${pw('secondary')}</div>
   <div class="tabs">
    <div class="tab" id="tab-primary" data-act="tab:primary" style="--tc:${c.lights.primary.color}"><span class="led" id="tab-primary-led"></span>${c.lights.primary.name}<small id="tab-primary-v" style="color:${c.lights.primary.color}"></small></div>
    <div class="tab" id="tab-secondary" data-act="tab:secondary" style="--tc:${c.lights.secondary.color}"><span class="led" id="tab-secondary-led"></span>${c.lights.secondary.name}<small id="tab-secondary-v" style="color:${c.lights.secondary.color}"></small></div>
   </div></div>
   <div class="cap" id="l-sub" style="font-size:11px;color:#979ca5"></div>
   <div id="l-body" style="display:flex;gap:16px">
    ${this._dial('ldial', 'light', 176, 0.533)}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px">
     <div class="lcd acc"><div class="row"><span id="l-v" style="font-size:32px;line-height:1">---%</span><span id="l-r" style="font-size:14px"></span></div>
      <div class="row" style="font-size:11.5px;margin-top:5px;opacity:.85"><span id="l-m"></span><span id="l-n"></span></div></div>
     <div class="keys2"><div class="hk" id="l-white" data-act="mode:white" style="--c:var(--acc)"><i></i>Weiß</div><div class="hk" id="l-color" data-act="mode:color" style="--c:var(--acc)"><i></i>Farbe</div></div>
     <div id="f-temp-w"><div class="sect cap eng" style="white-space:nowrap">Farbtemp.<span class="acc mono" id="f-temp-v" style="letter-spacing:1px"></span></div>
      <div class="slot" id="f-temp"><div class="groove tempg"></div><div class="ticks"></div><div class="fader"></div></div></div>
    </div>
   </div>
   <div id="l-bri-w"><div class="sect cap eng">Helligkeit<span class="acc mono" id="f-bri-v" style="letter-spacing:1px"></span></div>
    <div class="slot" id="f-bri"><div class="groove" id="f-bri-g"></div><div class="ticks"></div><div class="fader"></div></div></div>
   <div id="l-fav-w"><div class="cap eng" style="margin:0 0 6px">Lichtfarbe · Favoriten</div><div class="keys8" id="favs">${favs}</div></div>
  </div>`,
      weather: `<div class="plate card" id="wc" style="height:206px;flex:none;padding:8px 16px;display:flex;gap:14px;align-items:center" ${c.weather ? `data-act="more:${c.weather}"` : ''}>
    <div id="wx-head" style="flex:none;width:128px;text-align:center">
     <div id="w-ic" style="width:72px;height:72px;margin:-2px auto 0"></div>
     <div class="mono" id="w-t" style="font-size:32px;color:#eceef1;line-height:1">--</div><div class="cap" id="w-c" style="font-size:10.5px;letter-spacing:1.8px;margin-top:2px">Außen</div>
     <div id="w-d" style="font-size:12.5px;font-weight:600;color:#aeb2b9;line-height:1.35;margin-top:6px"></div>
    </div>
    <div class="fc" id="w-fc" style="flex:1;align-self:stretch;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))"></div>
   </div>`,
      heating: `<div class="plate card" id="hc" style="flex:none;margin-top:auto;display:flex;flex-direction:column">
   <div class="head"><span class="led" style="--lc:#ff8a4c"></span><div class="t"><h2 class="eng">${c.climate.title}</h2><p id="h-sub">${c.climate.subtitle}</p></div>
    <div class="lcd" style="padding:5px 10px"><span class="heat" id="h-badge" style="font-size:14px">--</span></div></div>
   <div class="keys4" style="margin-top:14px;grid-template-columns:repeat(3,1fr)">
    <div class="hk" id="hm-heat" data-act="hvac:heat" style="--c:#ff8a4c"><i></i>Heizen</div>
    <div class="hk" id="hm-boost" data-act="boost" style="--c:#ff8a4c"><i></i>Boost</div><div class="hk" id="hm-off" data-act="hvac:off" style="--c:#4da3ff"><i></i>Aus</div></div>
   <div class="trow" id="trow">
    <div class="pmw l" data-act="temp:-"><div class="pm">−</div></div>${this._dial('tdial', 'thermo', 236, 0.715)}<div class="pmw r" data-act="temp:+"><div class="pm">+</div></div>
    <div class="cap tmm"><span id="t-min"></span><span id="t-max"></span></div>
    <div class="tile ht l"><div class="n">Ist</div><div class="val" id="h-ist">--</div></div>
    <div class="tile ht r"><div class="n">Ventil</div><div class="val" id="h-valve">--</div></div></div>
  </div>`,
      air: `<div class="plate card${c.air.length > 3 ? ' cmp' : ''}" style="padding:9px 16px;height:108px;flex:none">
   <div class="cap eng" style="display:flex;justify-content:space-between">Raumklima · Luftqualität<span id="air-st"></span></div>
   <div id="air" style="display:grid;grid-template-columns:repeat(${Math.max(1, c.air.length)},1fr);gap:8px;margin-top:6px"></div>
  </div>`,
      floorplan: planHtml,
      audio: audioHtml,   // leer ohne media-Block
    };
    // Standardhöhe je Modul: 'fill' = Rest der Spalte, 'auto' = Inhaltshöhe, Zahl = feste Höhe in px
    const MSZ = { light: 'fill', weather: 206, heating: 'auto', air: 108, floorplan: 'fill', audio: 232 };
    const szCss = h => h === 'auto' ? 'flex:none' : typeof h === 'number' ? `height:${h}px;flex:none` : 'flex:1 1 0;min-height:0';
    const used = new Set(), err = t => `<div class="mod"><div class="xerr">${t}</div></div>`;
    this._xcfg = [];
    const item = it => {
      if (typeof it === 'string') it = { module: it };
      if (!it || typeof it !== 'object') return '';
      if (it.card) { const id = 'xc' + this._xcfg.length; this._xcfg.push({ id, card: it.card }); return `<div class="mod xcard" id="${id}" style="${szCss(it.height ?? 'fill')}"></div>`; }
      const n = it.module;
      if (!(n in MOD)) return err(`Unbekanntes Modul: ${n}`);
      if (used.has(n)) return err(`Modul „${n}" ist schon platziert`);
      if (!MOD[n] || !c.has[n]) return '';
      used.add(n);
      return `<div class="mod" style="${szCss(it.height ?? MSZ[n])}">${MOD[n]}</div>`;
    };
    const cols = c.layout.columns.map(col => Array.isArray(col) ? { modules: col } : (col || { modules: [] }));
    const DEFW = [404, 404, 416], noW = !cols.some(x => x.width);
    const gridCols = cols.map((col, i) => col.width ? (typeof col.width === 'number' ? col.width + 'px' : col.width) : noW && cols.length === 3 ? DEFW[i] + 'px' : 'minmax(0,1fr)').join(' ');
    const colsHtml = cols.map((col, i) => `<div class="col" style="grid-column:${i + 1}">${(col.modules || []).map(item).join('')}</div>`).join('');
    // Nicht platzierte Module bleiben unsichtbar im DOM, damit alle Updates ohne Sonderfälle laufen
    const pool = Object.keys(MOD).filter(n => !used.has(n)).map(n => MOD[n]).join('');
    const bg = c.background, sky = bg.mode !== 'off';
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
<div class="stage${bg.animate ? "" : " calm"}" id="stage" style="${sky ? `--pa1:${bg.opacity};--pa2:${Math.min(1, bg.opacity + .1)};--pbf:blur(${bg.blur}px) saturate(1.25)` : 'background:linear-gradient(180deg,#1b1c20,#111215)'}">
 ${sky ? `<div class="sky${bg.animate ? '' : ' still'}" id="sky"><i class="wash" id="wash"></i>${AURORA.map((d, n) => `<i class="au a${n + 1}"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="rtc-ag${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset=".18" stop-color="currentColor" stop-opacity="1"/><stop offset=".45" stop-color="currentColor" stop-opacity=".72"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient><linearGradient id="rtc-ah${n}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".28" stop-color="#fff"/><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="rtc-am${n}"><rect width="100" height="100" fill="url(#rtc-ah${n})"/></mask></defs><path d="${d}" fill="url(#rtc-ag${n})" mask="url(#rtc-am${n})"/></svg></i>`).join('')}</div>` : ''}
 <div class="blob" id="blob1" style="left:-40px;top:80px;width:460px;height:460px"></div>
 ${sky ? '' : `<div class="blob" style="left:420px;top:80px;width:400px;height:420px;background:rgba(255,90,50,.18)"></div>
 <div class="blob" style="right:-60px;top:60px;width:420px;height:460px;background:rgba(80,150,255,.12)"></div>`}
 <div class="z"><div class="grid" style="grid-template-columns:${gridCols}">${colsHtml}</div>

 <div class="status plate"${c.layout.statusbar ? '' : ' style="display:none"'}>
  <div class="it" id="s-al" ${c.alarm ? `data-act="more:${c.alarm}"` : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" id="s-al-ic"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke-linecap="round"/></svg><div><div class="v" id="s-al-v">--</div><div class="s">Alarmanlage</div></div></div>
  <div class="it"><div style="display:flex;padding-left:8px" id="s-av"></div><div><div class="v" id="s-p">--</div><div class="s">Personen zuhause</div></div></div>
  <div class="it"><span class="led" id="s-w-led"></span><div><div class="v" id="s-w">--</div><div class="s">Fenster &amp; Türen</div></div></div>
  <div class="it" ${c.calendar ? `data-act="more:${c.calendar}"` : ''}><span class="led" style="--lc:#6fb2ff"></span><div><div class="v" id="s-cal">--</div><div class="s" id="s-cal-s">Nächster Termin</div></div></div>
  <div class="it" id="s-np" style="display:none"><span class="led" style="--lc:${mcol}"></span><div><div class="v" id="m-np">--</div><div class="s">Wiedergabe</div></div></div>
  <div class="it" style="margin-left:auto;padding-right:0;border:0;box-shadow:none"><div style="text-align:right"><div class="v mono" id="s-date" style="font-weight:400;font-size:18px">--</div><div class="s" id="s-kw"></div></div><div class="lcdtime mono" id="s-time">--:--</div></div>
 </div>
 </div>
 ${presetPop}
 <div style="display:none">${pool}</div>
</div>`;
    const r = this.shadowRoot;
    this.$ = id => r.getElementById(id);
    r.addEventListener('click', e => this._onClick(e));
    this._bindDial(this.$('ldial'), 'light');
    this._bindDial(this.$('tdial'), 'thermo');
    this._bindFader(this.$('f-temp'), 'temp');
    this._bindFader(this.$('f-bri'), 'bri');
    this._built = true;
    if (c.media) this._buildAudio();
    this._mountCards();
    this._tick(); this._fit();
  }

  // Eingebettete HA-Karten (layout-Einträge mit card:) über die Lovelace-Card-Helpers erzeugen
  _mountCards() {
    this._xc = {};
    for (const { id: n, card } of this._xcfg || []) {
      const host = this.$(n), t = { card };
      if (!host) continue;
      const make = async () => {
        try {
          const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
          if (!helpers) { host.innerHTML = '<div class="xerr">Karten-Helfer nicht verfügbar</div>'; return; }
          const el = await helpers.createCardElement(t.card);
          if (this._hass) el.hass = this._hass;
          host.replaceChildren(el); this._xc[n] = el;
        } catch (e) { host.innerHTML = `<div class="xerr">${String(e.message || e)}</div>`; }
      };
      // Benutzerdefinierte Karten, die noch nicht geladen waren, melden sich mit ll-rebuild → neu erzeugen
      host.addEventListener('ll-rebuild', ev => { ev.stopPropagation(); make(); });
      make();
    }
  }

  _fit() {
    if (!this.isConnected || !this.$) return;
    const top = this.getBoundingClientRect().top;
    const h = Math.max(320, window.innerHeight - Math.max(0, top) - this._c.bottom_offset);
    this.style.height = h + 'px';
    const w = this.clientWidth || W;
    const s = Math.min(w / W, h / H);
    this.$('stage').style.transform = `translate(${(w - W * s) / 2}px,${(h - H * s) / 2}px) scale(${s})`;
  }

  // ---------- Bedienung ----------
  _call(d, s, data) {
    if (d === 'light' && s === 'turn_on') this._memo(data);
    return this._hass.callService(d, s, data).catch(e => console.warn('raum-tablet-card', e));
  }

  // Zuletzt gesendete Lichtwerte merken (Modus, Farbe, Farbtemp., Helligkeit) – für Lampen ohne Rückmeldung
  // (z. B. MiLight-Hub: color_mode "unknown", brightness None). Bleibt im Browser über Neuladen erhalten.
  _memo(data) {
    const t = ['primary', 'secondary'].find(x => this._c.lights[x].entity === data.entity_id); if (!t) return;
    const last = this._memLoad(t);
    if (data.hs_color) { last.hs = data.hs_color; last.mode = 'color'; }
    if (data.color_temp_kelvin) { last.k = data.color_temp_kelvin; last.mode = 'white'; }
    if (data.brightness_pct != null) last.bri = data.brightness_pct;
    try { localStorage.setItem('raum-tablet-card:light:' + data.entity_id, JSON.stringify({ hs: last.hs, k: last.k, bri: last.bri, mode: last.mode })); } catch (e) { /* ohne Speicher */ }
  }
  _memLoad(t) {
    const last = this._last[t];
    if (!last._ld) {
      last._ld = true;
      try { const v = JSON.parse(localStorage.getItem('raum-tablet-card:light:' + this._c.lights[t].entity) || 'null'); if (v) for (const k in v) if (last[k] == null && v[k] != null) last[k] = v[k]; } catch (e) { /* ohne Speicher */ }
    }
    return last;
  }
  _more(entityId) { const ev = new Event('hass-more-info', { bubbles: true, composed: true }); ev.detail = { entityId }; this.dispatchEvent(ev); }
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  // immer boolean: classList.toggle(x, undefined) würde sonst bei jedem Update umschalten statt entfernen
  _ok(s) { return !!s && !NA.includes(s.state); }

  _onClick(e) {
    const t = e.target.closest('[data-act]');
    // Offene Quelle/Effekt-Auswahl schließt bei Tipp daneben
    if (this._pickOpen && !(t && /^a(pick|opt):/.test(t.dataset.act))) this._apick(null);
    if (!t || !this._hass) return;
    const [cmd, arg] = t.dataset.act.split(/:(.*)/s);
    const c = this._c, L = c.lights[this._tab], le = L.entity;
    // Nicht verfügbare Entitäten: keine Aktion auslösen
    if ((cmd === 'mode' || cmd === 'fav') && !this._ok(this._st(le))) return;
    if (cmd === 'toggle' && !this._ok(this._st(c.lights[arg].entity))) return;
    if (['hvac', 'boost', 'temp'].includes(cmd) && !this._ok(this._st(c.climate.entity))) return;
    switch (cmd) {
      case 'tab':
        this._tab = arg; this._drag = null;
        try { localStorage.setItem(this._tabKey(), arg); } catch (e) { /* ohne Speicher weiter */ }
        this._update(); break;
      case 'toggle': this._call('light', 'toggle', { entity_id: c.lights[arg].entity }); break;
      case 'alloff': {
        const ids = [c.lights.primary.entity, c.lights.secondary.entity].filter(e => this._ok(this._st(e)));
        if (ids.length) this._call('light', 'turn_off', { entity_id: ids });
        break;
      }
      case 'mode': {
        const s = this._st(le), a = (s && s.attributes) || {}, last = this._last[this._tab];
        if (arg === 'white') this._call('light', 'turn_on', { entity_id: le, color_temp_kelvin: clamp(last.k || 3000, a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500) });
        else this._call('light', 'turn_on', { entity_id: le, hs_color: last.hs || [30, 80] });
        break;
      }
      case 'fav': {
        const f = c.favorites[+arg], s = this._st(le), a = (s && s.attributes) || {};
        this._call('light', 'turn_on', f.kelvin ? { entity_id: le, color_temp_kelvin: clamp(f.kelvin, a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500) } : { entity_id: le, hs_color: f.hs });
        break;
      }
      case 'hvac': this._call('climate', 'set_hvac_mode', { entity_id: c.climate.entity, hvac_mode: arg }); break;
      case 'boost': {
        const s = this._st(c.climate.entity); if (!s) break;
        this._call('climate', 'set_preset_mode', { entity_id: c.climate.entity, preset_mode: s.attributes.preset_mode === 'boost' ? 'none' : 'boost' });
        break;
      }
      case 'temp': {
        const s = this._st(c.climate.entity); if (!this._ok(s)) break;
        // mehrere Klicks sammeln und den Endwert ~1,5 s nach dem letzten Klick einmal senden
        const a = s.attributes, step = a.target_temp_step || 0.5;
        const v = clamp((this._dragActive('temp') ? this._drag.v : (a.temperature || 20)) + (arg === '+' ? step : -step), a.min_temp || 5, a.max_temp || 30);
        this._drag = { kind: 'temp', v, active: false, until: Date.now() + 8000 }; this._updHeat();
        clearTimeout(this._tempT); this._tempT = setTimeout(() => this._call('climate', 'set_temperature', { entity_id: c.climate.entity, temperature: v }), 1500);
        break;
      }
      case 'media': {
        const p = this._player(); if (!p) break;
        this._call('media_player', arg, { entity_id: p.entity_id });
        break;
      }
      case 'mmute': {
        const m = c.media, ms = this._st(m && m.mute), p = this._player();
        if (this._ok(ms)) this._call(ms.entity_id.split('.')[0], 'toggle', { entity_id: ms.entity_id });
        else if (p) this._call('media_player', 'volume_mute', { entity_id: p.entity_id, is_volume_muted: !p.attributes.is_volume_muted });
        break;
      }
      case 'mpower': {
        const pw = this._st(c.media && c.media.power);
        if (this._ok(pw)) this._call(pw.entity_id.split('.')[0], 'toggle', { entity_id: pw.entity_id });
        break;
      }
      case 'aview': this._aview(arg); break;
      case 'apick': this._apick(arg); break;
      case 'aopt': {
        const [kind, opt] = arg.split(/\|(.*)/s), ent = kind === 'source' ? c.media.source : c.media.effect;
        this._call('select', 'select_option', { entity_id: ent, option: opt }); this._apick(null);
        break;
      }
      case 'preset': this._presetApply(+arg); break;
      case 'pedit': this._presetEdit(+arg); break;
      case 'pcur': if (this._pp) { this._pp.v = this._curVols(); this._pp.e = this._curEff(); this._updPop(); } break;
      case 'peff': if (this._pp) { this._pp.e = arg || null; this._updPop(); } break;
      case 'pcancel': this._presetClose(); break;
      case 'psave': if (this._pp) this._presetSave(); break;
      case 'dolby': {
        const s = this._st(c.media && c.media.dolby);
        if (this._ok(s)) this._call(s.entity_id.split('.')[0], 'toggle', { entity_id: s.entity_id });
        break;
      }
      case 'more': this._more(arg); break;
    }
  }

  // Aktiver Mediaplayer: spielt > pausiert > eingeschaltet (Reihenfolge der Liste = Priorität)
  _player() {
    const ps = ((this._c.media && this._c.media.players) || []).map(e => this._st(e)).filter(s => this._ok(s) && s.state !== 'off' && s.state !== 'standby');
    return ps.find(s => s.state === 'playing') || ps.find(s => s.state === 'paused') || ps[0] || null;
  }

  // Kanal-Lautstärke als Anteil 0..1 – aus number/input_number, einem Mediaplayer oder dem aktiven Player
  _chv(k) {
    const ch = this._c.media.channels[k]; if (!ch) return null;
    const s = ch.player ? this._player() : this._st(ch.entity);
    if (!this._ok(s)) return null;
    if (s.entity_id.startsWith('media_player.')) return s.attributes.volume_level != null ? { f: s.attributes.volume_level, player: s } : null;
    const a = s.attributes, mn = a.min ?? 0, mx = a.max ?? 100, v = Number(s.state);
    return isNaN(v) ? null : { f: clamp((v - mn) / (mx - mn), 0, 1), mn, mx, step: a.step || 1, ent: s };
  }

  // Audio: Regler, VU-Meter und Auto-Rückkehr einrichten
  _buildAudio() {
    const m = this._c.media, $ = this.$;
    const drag = (el, onF) => el && el.addEventListener('pointerdown', ev => {
      if (!this._hass) return;
      const calc = e => { const r = el.getBoundingClientRect(); return clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
      el.setPointerCapture(ev.pointerId); ev.preventDefault();
      onF(calc(ev), false);
      const mv = e2 => onF(calc(e2), false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); onF(calc(e2), true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    const setCh = (k, f, final) => {
      if (!this._chv(k)) return;
      this._drag = { kind: 'ch', k, f, active: !final, until: Date.now() + 2000 };
      this._updMedia();
      if (final || Date.now() - (this._sent || 0) > 450) { this._sent = Date.now(); this._commit(); }
    };
    drag($('m-vs0'), (f, fin) => setCh(0, f, fin));
    m.channels.forEach((ch, k) => {
      drag($('m-ds' + k), (f, fin) => setCh(k, f, fin));
      drag($('pp-s' + k), f => { if (!this._pp) return; this._pp.v[k] = Math.round(f * 100); this._updPop(); });
    });
    // Einstellungsseite: jede Berührung verlängert die Zeit bis zur Rückkehr zur Übersicht
    $('mc').addEventListener('pointerdown', () => { if ($('mc').dataset.view === 'det') this._avArm(); });
    // VU-Meter: senkrechter LED-Balken (nur Anzeige)
    const vu = $('m-vu'); if (vu) this._vuSegs = [...vu.querySelectorAll('.segs i')];
  }

  // Ansicht der Audio-Karte umschalten (Übersicht / Einstellungen)
  _aview(v) {
    const mc = this.$('mc'); if (!mc) return;
    mc.dataset.view = v; this._apick(null);
    clearTimeout(this._avT);
    if (v === 'det') this._avArm();
  }
  _avArm() {
    clearTimeout(this._avT);
    this._avT = setTimeout(() => { if (this._pp) this._avArm(); else this._aview('main'); }, (this._c.media.detail_timeout || 20) * 1000);
  }

  // Auswahl für Quelle / Effekt
  _apick(kind) {
    const el = this.$('m-pick'); if (!el) return;
    if (!kind || this._pickOpen === kind) { el.hidden = true; this._pickOpen = null; return; }
    const m = this._c.media, s = this._st(kind === 'source' ? m.source : m.effect); if (!this._ok(s)) return;
    const names = kind === 'source' ? m.source_names : m.effect_names;
    el.innerHTML = `<div class="cap eng">${kind === 'source' ? 'Quelle wählen' : 'Effekt wählen'}</div><div class="apo">${(s.attributes.options || []).map(o => `<div class="hk sm${o === s.state ? ' on' : ''}" data-act="aopt:${kind}|${o}" style="--c:var(--acc)"><i></i>${names[o] || o}</div>`).join('')}</div>`;
    el.hidden = false; this._pickOpen = kind;
  }

  // Lautstärke-Presets: je Preset ein Wert in % pro Kanal (Reihenfolge wie media.channels), optional danach der Effekt,
  // gespeichert als JSON in einem input_text-Helfer, z. B. [37,51,51,10,"4.1"]
  _presets() {
    const m = this._c.media, s = this._st(m.presets);
    let arr = null;
    if (this._ok(s)) { try { arr = JSON.parse(s.state); } catch (e) { arr = null; } }
    else if (!m.presets) { try { arr = JSON.parse(localStorage.getItem('raum-tablet-card:presets') || 'null'); } catch (e) { arr = null; } }
    if (!Array.isArray(arr)) arr = m.preset_defaults || [];
    const n = m.channels.length;
    return Array.from({ length: m.preset_count }, (_, i) => {
      const a = arr[i]; if (!Array.isArray(a) || a.length < n) return null;
      return { v: a.slice(0, n).map(Number), e: typeof a[n] === 'string' && a[n] ? a[n] : null };
    });
  }
  _curEff() { const s = this._st(this._c.media.effect); return this._ok(s) ? s.state : null; }
  // Passt ein Preset zu den aktuellen Reglern (±1 %) und, falls gespeichert, zum aktiven Effekt?
  _presetMatch(p, cur = this._curVols(), eff = this._curEff()) {
    return !!p && p.v.every((x, k) => Math.abs(x - cur[k]) <= 1) && (!p.e || !this._c.media.effect || p.e === eff);
  }
  _curVols() { return this._c.media.channels.map((ch, k) => { const v = this._chv(k); return v ? Math.round(v.f * 100) : 0; }); }
  _presetApply(i) {
    const p = this._presets()[i]; if (!p) { this._presetEdit(i); return; }
    const m = this._c.media, es = this._st(m.effect);
    if (p.e && this._ok(es) && es.state !== p.e && (es.attributes.options || []).includes(p.e)) this._call('select', 'select_option', { entity_id: m.effect, option: p.e });
    m.channels.forEach((ch, k) => {
      const s = this._st(ch.entity); if (!this._ok(s) || s.entity_id.startsWith('media_player.')) return;
      const a = s.attributes, mn = a.min ?? 0, mx = a.max ?? 100, st = a.step || 1;
      this._call(s.entity_id.split('.')[0], 'set_value', { entity_id: s.entity_id, value: Math.round((mn + clamp(p.v[k], 0, 100) / 100 * (mx - mn)) / st) * st });
    });
  }
  _presetEdit(i) {
    const p = this._presets()[i];
    this._pp = { i, v: p ? p.v.slice() : this._curVols(), e: p ? p.e : this._curEff() };
    this.$('pp-t').textContent = `Preset ${i + 1} bearbeiten`;
    this.$('pp').hidden = false; this._updPop();
  }
  _updPop() {
    if (!this._pp) return;
    this._c.media.channels.forEach((ch, k) => {
      const v = clamp(this._pp.v[k], 0, 100), col = this._paintSl(this.$('pp-s' + k), v / 100, true), b = this.$('pp-v' + k);
      b.textContent = Math.round(v); b.style.color = col;
    });
    const pe = this.$('pp-e'), es = this._st(this._c.media.effect);
    if (pe) {
      const names = this._c.media.effect_names, opts = this._ok(es) ? es.attributes.options || [] : [];
      this._html(pe, [['', 'Beibehalten'], ...opts.map(o => [o, names[o] || o])].map(([o, n]) => `<div class="hk sm${(this._pp.e || '') === o ? ' on' : ''}" data-act="peff:${o}" style="--c:var(--acc)"><i></i>${n}</div>`).join(''));
    }
  }
  _presetClose() {
    this._pp = null; this.$('pp').hidden = true;
    if (this.$('mc').dataset.view === 'det') this._avArm();
  }
  _presetSave() {
    const m = this._c.media, all = this._presets();
    all[this._pp.i] = { v: this._pp.v.map(x => Math.round(clamp(x, 0, 100))), e: this._pp.e };
    const json = JSON.stringify(all.map(p => p ? (p.e ? [...p.v, p.e] : p.v) : []));
    if (m.presets) this._call('input_text', 'set_value', { entity_id: m.presets, value: json });
    else { try { localStorage.setItem('raum-tablet-card:presets', json); } catch (e) { /* ohne Speicher weiter */ } }
    this._presetClose();
  }

  // Senkrechten Segment-Regler einfärben: Segmente von unten, Knopf auf Position
  _paintSl(el, f, ok, col = volCol(f)) {
    if (!el) return col;
    const segs = el._segs || (el._segs = [...el.querySelectorAll('.segs i')]), n = ok ? Math.round(f * segs.length) : 0;
    segs.forEach((s, i) => { const on = i < n; s.style.background = on ? col : ''; s.style.boxShadow = on ? `0 0 4px ${col}` : ''; });
    el.classList.toggle('na', !ok);
    const kn = el.querySelector('.knob');
    if (kn) { kn.style.bottom = `calc(${f} * (100% - 16px))`; kn.style.setProperty('--vc', ok ? col : '#3a3c41'); }
    return col;
  }

  // VU-Meter: Pegel aus dem Signal-Sensor, Skala passt sich dynamisch an (steigt sofort, sinkt langsam wieder)
  _vuIn() {
    const m = this._c.media; if (!m || !m.signal || !this._vuSegs) return;
    const s = this._st(m.signal), pw = this._st(m.power), off = this._ok(pw) && pw.state === 'off';
    let v = this._ok(s) && !off ? Number(s.state) : 0; if (isNaN(v) || v < 0) v = 0;
    const V = this._vu || (this._vu = { t: 0, d: 0, pk: 0, pkT: 0, hi: 0, hiT: Date.now(), last: 0 });
    const now = Date.now();
    V.hi = Math.max(v, V.hi * Math.exp(-(now - V.hiT) / 20000)); V.hiT = now; // Spitzenwert klingt über ~20 s ab
    V.t = v;
    const sig = this.$('m-sig');
    if (sig) { sig.textContent = this._ok(s) ? (v >= 100000 ? Math.round(v / 1000) + 'k' : String(Math.round(v))) : '--'; }
    this._vuStart();
  }
  _vuStart() { if (!this._vuRaf && this.isConnected && this._vu) this._vuRaf = requestAnimationFrame(t => this._vuFrame(t)); }
  _vuFrame(now) {
    this._vuRaf = null;
    const V = this._vu, segs = this._vuSegs, m = this._c.media; if (!V || !segs) return;
    const dt = V.last ? Math.min(.1, (now - V.last) / 1000) : 0; V.last = now;
    const max = Math.max(m.signal_floor, V.hi * 1.1), f = clamp(Math.sqrt(V.t / max), 0, 1);
    V.d = f > V.d ? f : Math.max(f, V.d - dt * 1.2);                       // steigt sofort, fällt weich
    if (V.d >= V.pk) { V.pk = V.d; V.pkT = now; } else if (now - V.pkT > 1200) V.pk = Math.max(V.d, V.pk - dt * .6); // Spitzen-LED hält kurz
    const N = segs.length, n = Math.round(V.d * N), pk = V.pk > .01 ? Math.min(N - 1, Math.round(V.pk * (N - 1))) : -1, col = volCol(V.d);
    if (n !== V.n || pk !== V.pki || col !== V.col) {
      segs.forEach((e, i) => { const on = i < n || i === pk, c2 = i === pk && i >= n ? volCol(V.pk) : col; e.style.background = on ? c2 : ''; e.style.boxShadow = on ? `0 0 4px ${c2}` : ''; });
      V.n = n; V.pki = pk; V.col = col;
      const sig = this.$('m-sig'); if (sig) sig.style.color = V.t > 0 ? col : '';
    }
    if (V.d > f + .002 || V.pk > V.d + .002) this._vuStart();
  }

  // Titel für das Display: Serie · Staffel/Folge · Titel, Musik: Interpret – Titel, sonst Film-/Medientitel
  _mediaTitle(p) {
    if (!p) return null;
    const a = p.attributes, pad = n => String(n).padStart(2, '0');
    if (a.media_series_title) return [a.media_series_title, a.media_season != null ? `S${pad(a.media_season)}E${pad(a.media_episode || 0)}` : '', a.media_title].filter(Boolean).join(' · ');
    if (a.media_artist) return `${a.media_artist} – ${a.media_title || ''}`;
    return a.media_title || a.app_name || a.friendly_name || p.entity_id;
  }

  _dragActive(kind) { const d = this._drag; return d && d.kind === kind && (d.active || Date.now() < d.until); }

  _bindDial(el, kind) {
    let zone = null, rect = null;
    const geo = ev => { const k = rect.width / 330; const dx = (ev.clientX - (rect.left + rect.width / 2)) / k, dy = (ev.clientY - (rect.top + rect.height / 2)) / k; return { dist: Math.hypot(dx, dy), ang: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360 }; };
    const ringFrac = ang => { let a = (ang - 135 + 360) % 360; if (a > 270) a = a > 315 ? 0 : 270; return a / 270; };
    const apply = (ev, final) => {
      const g = geo(ev);
      if (kind === 'light') {
        if (zone === 'wheel') this._drag = { kind: 'hs', h: g.ang, s: clamp((g.dist - 54) / 53, 0, 1) * 100, active: !final, until: Date.now() + 2000 };
        else this._drag = { kind: 'bri', v: Math.max(1, Math.round(ringFrac(g.ang) * 100)), active: !final, until: Date.now() + 2000 };
        this._updLight();
      } else {
        const s = this._st(this._c.climate.entity); if (!this._ok(s)) return;
        const [mn, mx] = this._trange(s), step = s.attributes.target_temp_step || 0.5;
        this._drag = { kind: 'temp', v: Math.round((mn + ringFrac(g.ang) * (mx - mn)) / step) * step, active: !final, until: Date.now() + (final ? 8000 : 2500) };
        this._updHeat();
      }
      // Thermostate (Funk, z. B. Homematic IP) vertragen keine schnelle Befehlsfolge –
      // Solltemperatur nur einmal beim Loslassen senden; Licht weiter alle 0,45 s
      if (kind !== 'light' ? final : (final || Date.now() - (this._sent || 0) > 450)) { this._sent = Date.now(); this._commit(); }
    };
    el.addEventListener('pointerdown', ev => {
      if (!this._hass) return;
      if (!this._ok(this._st(kind === 'light' ? this._c.lights[this._tab].entity : this._c.climate.entity))) return;
      rect = el.getBoundingClientRect();
      const g = geo(ev);
      if (kind === 'light' && g.dist < 54) { this._call('light', 'toggle', { entity_id: this._c.lights[this._tab].entity }); return; }
      zone = kind === 'light' && g.dist <= 112 ? 'wheel' : 'ring';
      el.setPointerCapture(ev.pointerId); ev.preventDefault();
      apply(ev, false);
      const mv = e2 => apply(e2, false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); apply(e2, true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  _bindFader(el, kind) {
    const apply = (ev, final) => {
      const r = el.getBoundingClientRect(), f = clamp((ev.clientX - r.left) / r.width, 0, 1);
      if (kind === 'bri') this._drag = { kind: 'bri', v: Math.max(1, Math.round(f * 100)), active: !final, until: Date.now() + 2000 };
      else { const [kmin, kmax] = this._krange(); this._drag = { kind: 'k', v: Math.round((kmin + f * (kmax - kmin)) / 50) * 50, active: !final, until: Date.now() + 2000 }; }
      this._updLight();
      if (final || Date.now() - (this._sent || 0) > 450) { this._sent = Date.now(); this._commit(); }
    };
    el.addEventListener('pointerdown', ev => {
      if (!this._hass || !this._ok(this._st(this._c.lights[this._tab].entity))) return;
      el.setPointerCapture(ev.pointerId); ev.preventDefault(); apply(ev, false);
      const mv = e2 => apply(e2, false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); apply(e2, true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  _commit() {
    const d = this._drag; if (!d) return;
    const le = this._c.lights[this._tab].entity;
    if (d.kind === 'bri') this._call('light', 'turn_on', { entity_id: le, brightness_pct: d.v });
    else if (d.kind === 'k') this._call('light', 'turn_on', { entity_id: le, color_temp_kelvin: d.v });
    else if (d.kind === 'hs') this._call('light', 'turn_on', { entity_id: le, hs_color: [Math.round(d.h), Math.round(d.s)] });
    else if (d.kind === 'temp') this._call('climate', 'set_temperature', { entity_id: this._c.climate.entity, temperature: d.v });
    else if (d.kind === 'ch') {
      const v = this._chv(d.k); if (!v) return;
      if (v.ent) this._call(v.ent.entity_id.split('.')[0], 'set_value', { entity_id: v.ent.entity_id, value: Math.round((v.mn + d.f * (v.mx - v.mn)) / v.step) * v.step });
      else this._call('media_player', 'volume_set', { entity_id: v.player.entity_id, volume_level: Math.round(d.f * 100) / 100 });
    }
  }

  _krange() { const s = this._st(this._c.lights[this._tab].entity), a = (s && s.attributes) || {}; return [a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500]; }
  _trange(s) { const a = s.attributes, c = this._c.climate; return [Math.max(c.min, a.min_temp || c.min), Math.min(c.max, a.max_temp || c.max)]; }

  _subForecast() {
    if (!this._hass || !this._c || !this._c.weather || !this.isConnected) return;
    if (this._fcUnsub) { this._fcUnsub.then(u => u && u()).catch(() => {}); }
    this._fcFor = this._c.weather;
    this._fcUnsub = this._hass.connection.subscribeMessage(m => { this._fc = m.forecast; this._updWeather(); },
      { type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: this._c.weather }).catch(() => null);
  }

  // ---------- Anzeige ----------
  // Aurora-Bänder: jedes Band bekommt immer wieder ein zufälliges neues Ziel (Richtung, Drehung, Streckung)
  // und gleitet per CSS-Übergang dorthin – noch bevor es ankommt, folgt das nächste Ziel, so bleibt es im Fluss
  _auroraMove() {
    const sk = this.$('sky'); if (!sk || sk.classList.contains('still')) return;
    const now = Date.now(), rnd = (a, b) => a + Math.random() * (b - a), BASE = [-7, 6, -3, 11];
    sk.querySelectorAll('.au').forEach((e, n) => {
      if (e._next && now < e._next) return;
      const td = rnd(20, 34);
      e.style.setProperty('--td', `${td.toFixed(1)}s`);
      e.style.transform = `translate(${rnd(-16, 16).toFixed(1)}%,${rnd(-12, 12).toFixed(1)}%) rotate(${(BASE[n] + rnd(-16, 16)).toFixed(1)}deg) scale(${rnd(.82, 1.22).toFixed(2)},${rnd(.8, 1.3).toFixed(2)})`;
      e._next = now + td * rnd(600, 850);
    });
  }

  _tick() {
    if (!this.$ || !this._built) return;
    const d = new Date();
    this.$('s-time').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    this.$('s-date').textContent = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase() + ' ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    this.$('s-kw').textContent = 'KW ' + isoWeek(d);
    this._sky(d);
    this._auroraMove();
    this._loadAirHist();
    // alle 5 min die aktuellen Raumklima-Werte in den eigenen Verlauf schreiben
    if (this._hass && Date.now() - (this._airSampled || 0) > 3e5) {
      this._airSampled = Date.now();
      for (const t of this._c.air) { const s = this._st(t.entity), v = this._ok(s) ? Number(s.state) : NaN; if (!isNaN(v)) this._airRec(t.entity, v); }
      this._updAir();
    }
  }

  // Aurora-Hintergrund nach Sonnenstand: Farben werden stufenlos aus der Sonnenhöhe interpoliert,
  // getrennt für Vormittag (aufsteigend) und Nachmittag (absteigend); CSS-Übergänge glätten dazwischen
  _sky(d) {
    const bg = this._c.background; if (!bg || bg.mode === 'off') return;
    const hc = (this._hass && this._hass.config) || {};
    let { elevation: el, rising } = bg.fixed || {};
    if (el == null) {
      const sun = this._st(bg.sun);
      if (sun && sun.attributes.elevation != null && bg.sun) { el = sun.attributes.elevation; rising = sun.attributes.rising; }
      else ({ el, rising } = sunPos(d, bg.latitude ?? hc.latitude ?? 51, bg.longitude ?? hc.longitude ?? 10));
    }
    const p = skyAt(el, rising), $ = this.$, sk = $('sky'), all = [$('stage'), sk, ...sk.children];
    // Erstes Einfärben ohne Überblendung, danach weiche Übergänge
    if (!this._skyOn) all.forEach(e => { e.style.transition = 'none'; });
    $('stage').style.backgroundColor = p.base;
    $('sky').style.opacity = p.i;
    // Bei hellem Himmel (Tag) die Karten etwas dichter machen, damit graue Beschriftungen lesbar bleiben
    const lum = p.c.reduce((s, c) => s + c.match(/\d+/g).reduce((a, v) => a + +v, 0) / 765, 0) / 4 * p.i;
    const pa = clamp(bg.opacity + Math.max(0, lum - .35) * .5, 0, .95);
    $('stage').style.setProperty('--pa1', pa.toFixed(3)); $('stage').style.setProperty('--pa2', Math.min(1, pa + .1).toFixed(3));
    $('sky').querySelectorAll('.au').forEach((e, n) => { e.style.color = p.c[n]; });
    $('wash').style.backgroundColor = p.c[1];
    if (!this._skyOn) { sk.offsetWidth; all.forEach(e => { e.style.transition = ''; }); this._skyOn = true; }
    this._skyInfo = { el: Math.round(el * 10) / 10, rising };
  }

  _update() {
    if (!this._built || !this._hass) return;
    this._updPower(); this._updLight(); this._updHeat(); this._updPlan(); this._updWeather(); this._updAir(); this._updMedia(); this._updStatus();
  }

  _updMedia() {
    const m = this._c.media; if (!m || !this._built) return;
    const $ = this.$, p = this._player(), ms = this._st(m.mute), src = this._st(m.source), pw = this._st(m.power);
    const eff = this._st(m.effect), dol = this._st(m.dolby), tmp = this._st(m.temperature);
    const pwOff = this._ok(pw) && pw.state === 'off';
    // "Läuft gerade" in der Statusleiste
    let np;
    if (p) np = (p.state === 'playing' ? '▶ ' : p.state === 'paused' ? '❚❚ ' : '● ') + this._mediaTitle(p);
    else np = pwOff ? 'AUSGESCHALTET' : m.players.length ? 'NICHTS AKTIV' : (m.subtitle || 'KEIN PLAYER');
    $('m-np').textContent = np; $('s-np').style.display = p ? '' : 'none';
    $('m-pp').innerHTML = p && p.state === 'playing' ? IC.pause : IC.play;
    $('mc').querySelectorAll('[data-act^="media:"]').forEach(e => e.classList.toggle('na', !p));
    // Titel-Display: Text läuft als Laufschrift von rechts nach links durch
    const tt = pwOff ? 'AUS' : p ? this._mediaTitle(p) : 'KEINE WIEDERGABE', te = $('m-title');
    if (te._t !== tt) {
      te._t = tt; te.textContent = tt; te.classList.remove('run');
      requestAnimationFrame(() => {
        const w = te.scrollWidth, cw = te.parentNode.clientWidth || 196;
        te.style.setProperty('--mqa', `${cw}px`); te.style.setProperty('--mqx', `${-w}px`);
        te.style.setProperty('--mqd', `${((cw + w) / 45).toFixed(1)}s`); te.classList.add('run');
      });
    }
    // Quelle / Effekt / Dolby in der Infozeile des Displays
    const srcN = this._ok(src) ? (m.source_names[src.state] || src.state) : '--', effN = this._ok(eff) ? (m.effect_names[eff.state] || eff.state) : '';
    const dolOn = this._ok(dol) && dol.state === 'on';
    this._html($('m-info'), `Quelle: <b>${srcN}</b>${m.effect ? `<s></s>Effekt: <b>${effN || '--'}</b>` : ''}`);
    // Kanäle: Main-Regler (Übersicht) + alle Regler (Einstellungen), Farbe nach Lautstärke
    m.channels.forEach((ch, k) => {
      const v = this._chv(k);
      let f = v ? v.f : 0;
      if (this._dragActive('ch') && this._drag.k === k) f = this._drag.f;
      const col = volCol(f);
      if (k === 0) { this._paintSl($('m-vs0'), f, !!v, col); const b = $('m-vv'); b.textContent = v ? Math.round(f * 100) : '--'; b.style.color = v ? col : ''; }
      this._paintSl($('m-ds' + k), f, !!v, col);
      const b = $('m-dv' + k); if (b) { b.textContent = v ? Math.round(f * 100) : '--'; b.style.color = v ? col : ''; }
    });
    // Presets: aktives Preset hervorheben, leere gedimmt
    const cur = this._curVols(), curE = this._curEff(), pre = this._presets();
    $('m-pre').querySelectorAll('.hk').forEach((e, i) => {
      const p2 = pre[i];
      e.classList.toggle('empty', !p2);
      e.classList.toggle('on', this._presetMatch(p2, cur, curE));
    });
    // Stumm, Dolby, Netzschalter
    const muted = this._ok(ms) ? ms.state === 'on' : !!(p && p.attributes.is_volume_muted);
    const mk = $('m-mute');
    mk.innerHTML = muted ? IC.mute : IC.vol; mk.classList.toggle('on', muted); mk.style.color = muted ? '#ff6b6b' : '';
    mk.classList.toggle('na', !this._ok(ms) && !p);
    const dk = $('m-dol'); if (dk) { dk.classList.toggle('on', dolOn); dk.classList.toggle('na', !this._ok(dol)); }
    const pk = $('m-pw');
    pk.parentNode.style.display = this._ok(pw) ? '' : 'none';
    const on = this._ok(pw) && pw.state === 'on', col = m.color || '#4dc3ff';
    pk.style.color = on ? col : '#979ca5';
    const pi = pk.querySelector('svg'); if (pi) pi.style.filter = on ? `drop-shadow(0 0 2px ${col}) drop-shadow(0 0 6px ${rgba(col, .75)})` : ''; // nur das Symbol glüht
    // Temperatur des Z906: Balken 0–90 °C in der Temperaturfarbe
    if ($('m-tb')) {
      const t = this._ok(tmp) ? Number(tmp.state) : NaN, ok = !isNaN(t), tc = ok ? tempCol(t) : '#979ca5';
      this._paintSl($('m-tb'), ok ? clamp(t / 90, 0, 1) : 0, ok, tc);
      const tv = $('m-tv'); tv.textContent = ok ? `${Math.round(t)}°C` : '--'; tv.style.color = ok ? tc : '';
    }
    this._vuIn();
    if (this._pickOpen) { const k = this._pickOpen; this._pickOpen = null; this._apick(k); } // Auswahl aktuell halten
  }

  _lightInfo(t) {
    const L = this._c.lights[t], s = this._st(L.entity), a = (s && s.attributes) || {};
    const ok = this._ok(s), on = ok && s.state === 'on';
    const last = this._memLoad(t);
    const repColor = ['hs', 'rgb', 'xy', 'rgbw', 'rgbww'].includes(a.color_mode), repWhite = a.color_mode === 'color_temp';
    // Meldet die Lampe keinen Modus (color_mode unknown/None, z. B. MiLight-Hub ohne Rückmeldung): zuletzt gesendeten Modus zeigen
    const isColor = repColor || (!repWhite && last.mode === 'color');
    if (repColor) last.mode = 'color'; else if (repWhite) last.mode = 'white';
    if (a.color_temp_kelvin) last.k = a.color_temp_kelvin;
    if (a.hs_color && repColor) last.hs = a.hs_color;
    // Licht ist an, meldet aber keine Helligkeit: zuletzt gesetzten Wert zeigen, sonst null ("AN")
    if (a.brightness != null) last.bri = Math.round(a.brightness / 2.55);
    return { L, s, a, ok, on, isColor, bri: !on ? 0 : a.brightness == null ? (last.bri ?? null) : Math.round(a.brightness / 2.55), k: a.color_temp_kelvin || last.k || 3000, hs: (repColor && a.hs_color) || last.hs || [30, 80] };
  }

  _updPower() {
    for (const t of ['primary', 'secondary']) {
      const i = this._lightInfo(t), el = this.$('pw-' + t);
      el.style.setProperty('--c', i.L.color); el.style.setProperty('--g', rgba(i.L.color, .35)); el.style.setProperty('--t', i.L.color);
      el.classList.toggle('on', i.on); el.classList.toggle('na', !i.ok);
      this.$(`pw-${t}-nm`).textContent = i.L.name;
      this.$(`pw-${t}-st`).textContent = !i.ok ? 'n.v.' : i.on ? 'Ein' : 'Aus';
      this.$(`pw-${t}-si`).innerHTML = i.ok ? `seit<b>${hhmm(i.s.last_changed)}</b>` : '';
      this.$(`tab-${t}-v`).textContent = !i.ok ? 'n.v.' : !i.on ? 'AUS' : i.bri == null ? 'AN' : i.bri + '%';
      // Reiter-LED = echter Lichtzustand (an: leuchtet, aus: gedimmt, n.v.: grau)
      const led = this.$(`tab-${t}-led`);
      led.style.background = !i.ok ? '#3a3c41' : i.on ? i.L.color : rgba(i.L.color, .28);
      led.style.boxShadow = i.on ? `0 0 8px ${i.L.color}` : 'none';
      this.$('tab-' + t).classList.toggle('on', this._tab === t);
    }
  }

  _updLight() {
    const i = this._lightInfo(this._tab), $ = this.$, lc = $('lc');
    let { bri, k, hs, isColor } = i;
    if (this._dragActive('bri')) bri = this._drag.v;
    const briNA = bri == null, briPos = briNA ? 100 : bri;   // unbekannte Helligkeit: Anzeige "AN", Regler/Ring voll
    if (this._dragActive('k')) { k = this._drag.v; isColor = false; }
    if (this._dragActive('hs')) { hs = [this._drag.h, this._drag.s]; isColor = true; }
    const acc = i.L.color;
    lc.style.setProperty('--acc', acc); lc.style.setProperty('--accg', rgba(acc, .7));
    this.$('blob1').style.background = i.on ? (isColor ? hsCss(hs[0], hs[1]).replace('hsl', 'hsla').replace(')', ',.26)') : rgba(acc, .26)) : 'rgba(80,80,90,.12)';
    ['l-body', 'l-bri-w', 'l-fav-w'].forEach(id => $(id).classList.toggle('na', !i.ok));
    $('l-sub').textContent = i.L.subtitle + (i.L.entity ? '' : '');
    $('l-v').textContent = !i.ok ? '---%' : briNA ? 'AN' : pad3(bri) + '%';
    $('l-r').textContent = !i.ok ? '' : isColor ? `H${Math.round(hs[0])}°` : `${k}K`;
    $('l-m').textContent = !i.ok ? 'NICHT VERFÜGBAR' : !i.on ? 'AUS' : '▶ ' + (isColor ? hueName(hs[0]) : kelName(k)).toUpperCase();
    const mem = Array.isArray(i.a.entity_id) ? i.a.entity_id : null;
    $('l-n').textContent = !i.ok ? '' : mem ? `${mem.filter(e => (this._st(e) || {}).state === 'on').length}/${mem.length} AN` : (i.on ? 'AN' : 'AUS');
    // Jogdial
    const d = $('ldial');
    d.querySelector('.hv').textContent = i.ok && !briNA ? bri : '--';
    d.querySelectorAll('.dot').forEach((e, n) => { const lit = i.on && n / 40 * 100 <= briPos; e.style.background = lit ? acc : ''; e.style.boxShadow = lit ? `0 0 9px ${rgba(acc, .9)},inset 0 0 2px #fff` : ''; });
    const hd = d.querySelector('.handle'), r = 60 + hs[1] / 100 * 44, a = hs[0] * Math.PI / 180;
    hd.style.display = isColor && i.ok ? '' : 'none';
    hd.style.left = (165 + r * Math.cos(a)) + 'px'; hd.style.top = (165 + r * Math.sin(a)) + 'px';
    hd.style.setProperty('--hc', hsCss(hs[0], hs[1]));
    d.querySelector('.wheel').style.filter = i.on ? '' : 'saturate(.35) brightness(.7)';
    // Tasten
    $('l-white').classList.toggle('on', i.on && !isColor);
    $('l-color').classList.toggle('on', i.on && isColor);
    const sup = i.a.supported_color_modes || [];
    const canK = !sup.length || sup.includes('color_temp');
    const canC = !sup.length || sup.some(x => ['hs', 'rgb', 'xy', 'rgbw', 'rgbww'].includes(x));
    $('l-white').style.display = canK ? '' : 'none';
    $('l-color').style.display = canC ? '' : 'none';
    // Was die Lampe laut HA nicht kann, ist gesperrt (statt bedienbar ohne Wirkung)
    $('f-temp-w').classList.toggle('lock', !canK);
    // Fader
    const [kmin, kmax] = this._krange();
    $('f-temp').querySelector('.fader').style.left = clamp((k - kmin) / (kmax - kmin), 0, 1) * 100 + '%';
    $('f-temp-v').textContent = i.ok ? k + ' K' : '—';
    $('f-temp-w').classList.toggle('dim', isColor || !canK);
    $('f-bri').querySelector('.fader').style.left = briPos + '%';
    $('f-bri-v').textContent = i.ok && !briNA ? bri + ' %' : '—';
    $('f-bri-g').style.background = `linear-gradient(90deg,${rgba(acc, .12)},${acc})`;
    // Favoriten
    $('favs').querySelectorAll('.key').forEach((e, n) => {
      const f = this._c.favorites[n];
      e.classList.toggle('lock', f.kelvin ? !canK : !canC);
      const m = i.on && (f.kelvin ? (!isColor && Math.abs(f.kelvin - k) < 200) : (isColor && Math.abs(((f.hs[0] - hs[0] + 540) % 360) - 180) < 12 && Math.abs(f.hs[1] - hs[1]) < 15));
      e.classList.toggle('on', !!m);
    });
  }

  _updHeat() {
    const c = this._c.climate, s = this._st(c.entity), ok = this._ok(s), a = (s && s.attributes) || {}, $ = this.$;
    $('hc').querySelector('.keys4').classList.toggle('na', !ok);
    $('tdial').classList.toggle('na', !ok);
    $('trow').querySelectorAll('.pmw').forEach(e => e.classList.toggle('na', !ok));
    let tgt = a.temperature;
    if (this._dragActive('temp')) tgt = this._drag.v;
    const [mn, mx] = ok ? this._trange(s) : [c.min, c.max];
    $('t-min').textContent = mn + '°'; $('t-max').textContent = mx + '°';
    const d = $('tdial');
    d.querySelector('.tv').textContent = ok && tgt != null ? de(tgt) + '°' : '--';
    d.querySelector('.ti').textContent = 'IST ' + (ok ? de(a.current_temperature) + '°' : '--');
    const v = ok && tgt != null ? (tgt - mn) / (mx - mn) * 100 : -1;
    const lerp = (x, y, t) => Math.round(x + (y - x) * t);
    d.querySelectorAll('.dot').forEach((e, n) => {
      const f = n / 40, lit = f * 100 <= v && s.state !== 'off';
      const col = f < .5 ? `rgb(${lerp(77, 255, f * 2)},${lerp(163, 160, f * 2)},${lerp(255, 60, f * 2)})` : `rgb(255,${lerp(160, 70, (f - .5) * 2)},${lerp(60, 50, (f - .5) * 2)})`;
      e.style.background = lit ? col : ''; e.style.boxShadow = lit ? `0 0 9px ${col},inset 0 0 2px #fff` : '';
    });
    const boost = a.preset_mode === 'boost';
    ['heat', 'off'].forEach(m => $('hm-' + m).classList.toggle('on', ok && s.state === m && !boost));
    $('hm-boost').classList.toggle('on', ok && boost);
    $('hm-boost').style.display = (a.preset_modes || []).includes('boost') || !ok ? '' : 'none';
    const act = a.hvac_action;
    $('h-badge').textContent = !ok ? 'N.V.' : act === 'heating' ? '▲ HEIZT' : act === 'idle' ? '● BEREIT' : s.state === 'off' ? 'AUS' : boost ? '▲ BOOST' : s.state === 'auto' ? '● AUTO' : '● HEIZEN';
    const val = this._st(c.valve);
    $('h-ist').innerHTML = ok && a.current_temperature != null ? `${de(a.current_temperature)}<small>°C</small>` : '--';
    let vv = this._ok(val) ? Number(val.state) : null;
    if (vv != null && val.attributes.unit_of_measurement !== '%' && vv <= 1) vv *= 100;
    $('h-valve').innerHTML = vv != null && !isNaN(vv) ? `${Math.round(vv)}<small>%</small>` : '--';
  }

  _contact(ct) {
    const o = this._st(ct.entity), t = this._st(ct.tilt);
    const on = s => this._ok(s) && ['on', 'open', 'offen', 'true'].includes(String(s.state).toLowerCase());
    const tilted = s => this._ok(s) && ['tilted', 'gekippt', 'tilt'].includes(String(s.state).toLowerCase());
    if (!this._ok(o) && !this._ok(t)) return 'na';
    if (on(o)) return 'open';
    if (tilted(o) || on(t)) return 'tilt';
    return 'closed';
  }

  // Fenster-/Tür-Symbol im Grundriss. Lokale Koordinaten: Wand entlang x, Raum-Innenseite = +y.
  // rotate: 0 = Wand oben, 90 = Wand rechts, 180 = Wand unten, 270 = Wand links
  _sym(ct, st, col, VH) {
    const L = ct.length || 20, hl = L / 2, x = ct.x, y = ct.y * VH / 100, door = ct.type === 'door';
    const glow = `style="filter:drop-shadow(0 0 1.2px ${col})"`, sw = 1.2;
    let g = this._c.floorplan.image ? '' : `<rect x="${-hl}" y="-1.6" width="${L}" height="3.2" fill="#0d0f12"/>`;
    const wedge = `<path d="M${-hl} .8 L0 ${L * .2} L${hl} .8" fill="${rgba(col, .18)}" stroke="${col}" stroke-width=".5"/>`;
    if (!door) {
      g += `<line x1="${-hl}" y1="0" x2="${hl}" y2="0" stroke="#8fc9ff" stroke-opacity=".3" stroke-width="2.4"/>`;
      if (st === 'open') {
        const a = 55 * Math.PI / 180, q = hl, ex = q * Math.cos(a), ey = q * Math.sin(a);
        g += `<line x1="${-hl}" y1="0" x2="${-hl + ex}" y2="${ey}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" ${glow}/><line x1="${hl}" y1="0" x2="${hl - ex}" y2="${ey}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" ${glow}/>`;
      } else g += `<line x1="${-hl}" y1="0" x2="${hl}" y2="0" stroke="${col}" stroke-width="${sw}" ${glow}/>`;
      if (st === 'tilt') g += wedge;
    } else {
      const a = (st === 'open' ? 70 : 0) * Math.PI / 180;
      g += `<path d="M${hl} 0 A${L} ${L} 0 0 1 ${-hl} ${L}" fill="none" stroke="${col}" stroke-opacity="${st === 'open' ? .55 : .22}" stroke-width=".45" stroke-dasharray="1.4 1.1"/>`;
      g += `<line x1="${-hl}" y1="0" x2="${-hl + L * Math.cos(a)}" y2="${L * Math.sin(a)}" stroke="${col}" stroke-width="${sw + .3}" stroke-linecap="round" ${glow}/>`;
      if (st === 'tilt') g += wedge;
    }
    // hinge: right spiegelt das Scharnier ans rechte Ende, swing: out lässt die Tür nach außen öffnen
    const sx = ct.hinge === 'right' ? -1 : 1, sy = door && ct.swing === 'out' ? -1 : 1;
    return `<g transform="translate(${x} ${y}) rotate(${ct.rotate || 0}) scale(${sx} ${sy})">${g}</g>`;
  }

  _updPlan() {
    const fp = this._c.floorplan, cts = fp.contacts, $ = this.$, VH = 100 / fp.aspect;
    const COL = { closed: ['#3ddc84', 'ZU'], tilt: ['#ffb347', 'GEKIPPT'], open: ['#ff5a5a', 'OFFEN'], na: ['#979ca5', 'N.V.'] };
    let open = 0, tilt = 0, na = 0, mk = '', lg = '', sv = '';
    cts.forEach((ct, n) => {
      const st = this._contact(ct), [col, txt] = COL[st];
      if (st === 'open') open++; if (st === 'tilt') tilt++; if (st === 'na') na++;
      const id = ct.id || ('K' + (n + 1));
      if (ct.symbol !== false) sv += this._sym(ct, st, col, VH);
      // Marker: explizit (label_x/label_y) oder automatisch zur Raum-Innenseite versetzt
      let lx = ct.label_x, ly = ct.label_y;
      if (lx == null || ly == null) {
        const d = ct.label_offset ?? (ct.symbol === false ? 0 : ct.type === 'door' ? (ct.length || 20) * .6 : 7), r = (ct.rotate || 0) * Math.PI / 180;
        lx = ct.x - d * Math.sin(r); ly = (ct.y * VH / 100 + d * Math.cos(r)) / VH * 100;
      }
      // Grundriss gedreht (floorplan.rotate, im Uhrzeigersinn): Marker-Position mitdrehen, Beschriftung bleibt aufrecht
      [lx, ly] = fp.rot === 90 ? [100 - ly, lx] : fp.rot === 180 ? [100 - lx, 100 - ly] : fp.rot === 270 ? [ly, 100 - lx] : [lx, ly];
      mk += `<div class="mk ${st}" data-act="more:${ct.entity}" style="left:${lx}%;top:${ly}%;--mc:${col};--mg:${rgba(col, .45)}">${id}</div>`;
      lg += `<div data-act="more:${ct.entity}" style="--mc:${col}"><span class="led" style="--lc:${col}"></span><span class="n">${id} ${ct.name || ((this._hass.states[ct.entity] || {}).attributes || {}).friendly_name || ''}</span><b>${txt}</b></div>`;
    });
    this._html($('ovl'), sv); this._html($('markers'), mk); this._html($('legend'), lg);
    const sum = open || tilt ? [open ? `${open} OFFEN` : '', tilt ? `${tilt} KIPP` : ''].filter(Boolean).join(' · ') : na === cts.length && cts.length ? 'N.V.' : 'ALLES ZU';
    const col = open ? '#ff5a5a' : tilt ? '#ffb347' : na === cts.length ? '#979ca5' : '#3ddc84';
    $('fp-sum').textContent = sum; $('fp-sum').style.color = col; $('fp-sum').style.textShadow = `0 0 8px ${rgba(col, .6)}`;
    $('fp-led').style.setProperty('--lc', col);
    $('fp-sub').textContent = `Fenster & Türen · ${cts.length} Kontakte${na ? ` · ${na} n.v.` : ''}`;
    this._win = { open, tilt, na, total: cts.length, col };
  }

  _updWeather() {
    if (!this._built) return;
    const s = this._st(this._c.weather), $ = this.$;
    if (!this._ok(s)) { $('w-t').textContent = '--'; $('w-c').textContent = 'Wetter n.v.'; this._html($('w-fc'), ''); return; }
    const a = s.attributes, fc = this._fc || [], t0 = fc[0] || {};
    this._html($('w-ic'), wxIcon(s.state));
    $('w-t').textContent = de(a.temperature) + '°';
    $('w-c').textContent = 'Außen · ' + (WX_DE[s.state] || s.state);
    const parts1 = [], parts2 = [];
    if (t0.temperature != null) parts1.push(`↑${Math.round(t0.temperature)}° ↓${Math.round(t0.templow ?? t0.temperature)}°`);
    if (a.apparent_temperature != null) parts1.push(`gefühlt ${Math.round(a.apparent_temperature)}°`);
    else if (a.humidity != null) parts1.push(`${Math.round(a.humidity)} % rF`);
    if (t0.precipitation_probability != null) parts2.push(`<span style="color:#9fc3ff">☂ ${Math.round(t0.precipitation_probability)} %</span>`);
    else if (t0.precipitation != null) parts2.push(`<span style="color:#9fc3ff">☂ ${de(t0.precipitation)} ${a.precipitation_unit || 'mm'}</span>`);
    if (a.wind_speed != null) parts2.push(`Wind ${Math.round(a.wind_speed)} ${a.wind_speed_unit || 'km/h'}`);
    this._html($('w-d'), parts1.join(' · ') + '<br>' + parts2.join(' · '));
    // Eine Woche in zwei Zeilen: heute + 7 Tage
    this._html($('w-fc'), fc.slice(0, 8).map((f, n) => {
      const day = n === 0 ? 'HEUTE' : new Date(f.datetime).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase();
      const pp = f.precipitation_probability != null ? `☂ ${Math.round(f.precipitation_probability)}%` : f.precipitation ? `☂ ${de(f.precipitation)}` : '';
      return `<div><div class="d">${day}</div>${wxIcon(f.condition)}<div class="ft"><div class="tt mono">${Math.round(f.temperature)}°/${Math.round(f.templow ?? f.temperature)}°</div><div class="pp">${pp || "&nbsp;"}</div></div></div>`;
    }).join(''));
  }

  // Bewertung eines Raumklima-Werts: 0 gut · 2 mäßig · 3 schlecht
  _airLvl(t, v) {
    if (t.range) { const [lo, hi] = t.range; return v >= lo && v <= hi ? 0 : (v >= lo - 10 && v <= hi + 10) ? 2 : 3; }
    const [g, o] = t.levels || [Infinity, Infinity]; return v <= g ? 0 : v <= o ? 2 : 3;
  }

  // Verlauf der Raumklima-Werte (Balken im Kachel-Hintergrund): Stundenmittel aus dem HA-Verlauf, alle 10 min neu
  async _loadAirHist() {
    // nur vorhandene Entitäten abfragen – Platzhalter würden die ganze Abfrage scheitern lassen
    const air = this._c.air.filter(t => t.entity && this._hass && this._hass.states[t.entity]), hrs = this._c.air_history_hours || 24;
    if (!this._hass || !this._hass.callWS || !air.length || Date.now() - (this._airHistAt || 0) < 6e5) return;
    this._airHistAt = Date.now();
    const end = new Date(), start = new Date(end - hrs * 36e5), N = 24, step = (end - start) / N;
    try {
      const r = await this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: air.map(t => t.entity), minimal_response: true, no_attributes: true, significant_changes_only: false });
      const H = {};
      for (const t of air) {
        const pts = (r[t.entity] || []).map(p => [p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated || p.last_changed), Number(p.s ?? p.state)]).filter(p => !isNaN(p[1]));
        let last = null, j = 0;
        H[t.entity] = Array.from({ length: N }, (_, i) => {
          const e = +start + (i + 1) * step; let sum = 0, n = 0;
          while (j < pts.length && pts[j][0] < e) { sum += pts[j][1]; n++; last = pts[j][1]; j++; }
          return n ? sum / n : last;
        });
      }
      this._airHist = H; this._updAir();
    } catch (e) { console.warn('raum-tablet-card: Verlauf aus HA nicht verfügbar – nutze eigenen Verlauf', e); }
  }

  // Eigener Verlauf im Browser als Ersatz, falls HA keinen liefert (Recorder/History aus): Stundenmittel, 48 h
  _airStore() {
    if (!this._airLoc) { try { this._airLoc = JSON.parse(localStorage.getItem('raum-tablet-card:air') || '{}'); } catch (e) { this._airLoc = {}; } }
    return this._airLoc;
  }
  _airRec(id, v) {
    const S = this._airStore(), h = Math.floor(Date.now() / 36e5), b = (S[id] = S[id] || {}), e = b[h] || [0, 0];
    b[h] = [e[0] + v, e[1] + 1];
    for (const k of Object.keys(b)) if (+k < h - 48) delete b[k];
    if (Date.now() - (this._airSaved || 0) > 6e4) { this._airSaved = Date.now(); try { localStorage.setItem('raum-tablet-card:air', JSON.stringify(S)); } catch (e) { /* ohne Speicher weiter */ } }
  }
  _airLocHist(id) {
    const b = this._airStore()[id], h = Math.floor(Date.now() / 36e5);
    return b ? Array.from({ length: 24 }, (_, i) => { const e = b[h - 23 + i]; return e ? e[0] / e[1] : null; }) : null;
  }

  _updAir() {
    const $ = this.$, COL =['#3ddc84', '#c8e06a', '#ffb347', '#ff5a5a'];
    let worst = -1, html = '';
    for (const t of this._c.air) {
      const s = this._st(t.entity), ok = this._ok(s), v = ok ? Number(s.state) : NaN;
      let lvl = -1, txt = 'n.v.';
      if (ok && !isNaN(v)) {
        lvl = this._airLvl(t, v);
        txt = (t.range ? ['optimal', '', 'mäßig', 'schlecht'] : ['gut', '', 'mäßig', 'schlecht'])[lvl];
        worst = Math.max(worst, lvl);
      }
      const col = lvl < 0 ? '#979ca5' : COL[lvl];
      const pct = ok && !isNaN(v) ? clamp(v / (t.max || 100) * 100, 3, 100) : 0;
      const unit = t.unit ?? (s && s.attributes.unit_of_measurement) ?? '';
      // Hintergrund-Balken: automatisch skaliert, Mindestspanne 10 % der Skala, damit Rauschen flach bleibt
      let hist = (this._airHist || {})[t.entity];
      if (!hist || !hist.some(x => x != null)) hist = this._airLocHist(t.entity);
      const hv = (hist || []).filter(x => x != null);
      let spark = '';
      if (hv.length) {
        const mn = Math.min(...hv), rg = Math.max(Math.max(...hv) - mn, (t.max || 100) * .1);
        spark = `<div class="spark">${hist.map(x => x == null ? '<i style="height:0"></i>' : `<i style="height:${(14 + 86 * (x - mn) / rg).toFixed(1)}%;background:${COL[this._airLvl(t, x)]}"></i>`).join('')}</div>`;
      }
      html += `<div class="tile" data-act="more:${t.entity}" style="padding:7px 10px">${spark}<div class="n">${t.name}<span style="color:${col}">${txt}</span></div><div class="val" style="font-size:21px">${ok && !isNaN(v) ? (t.decimals ? de(v, t.decimals) : Math.round(v)) : '--'} <small>${unit}</small></div><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div>`;
    }
    this._html($('air'), html);
    const L = worst < 0 ? ['n.v.', '#979ca5'] : [['● Gut', '● Ok', '● Mäßig', '● Schlecht'][worst], COL[worst]];
    $('air-st').textContent = L[0]; $('air-st').style.color = L[1];
  }

  _updStatus() {
    const $ = this.$, c = this._c;
    // Alarmanlage
    const al = this._st(c.alarm);
    const AL = { disarmed: ['Unscharf', '#9a9ea6'], armed_home: ['Scharf · Zuhause', '#5ee39a'], armed_away: ['Scharf · Abwesend', '#5ee39a'], armed_night: ['Scharf · Nacht', '#5ee39a'], armed_vacation: ['Scharf · Urlaub', '#5ee39a'], armed_custom_bypass: ['Scharf · Benutzer', '#5ee39a'], arming: ['Wird scharf …', '#ffb347'], pending: ['Verzögerung …', '#ffb347'], disarming: ['Wird entschärft …', '#ffb347'], triggered: ['ALARM!', '#ff5a5a'] };
    const [at, ac] = !this._ok(al) ? ['n.v.', '#979ca5'] : (AL[al.state] || [al.state, '#9a9ea6']);
    $('s-al-v').textContent = at; $('s-al-v').style.color = ac;
    $('s-al-ic').style.color = ac; $('s-al-ic').style.filter = `drop-shadow(0 0 4px ${rgba(ac, .7)})`;
    // Personen
    const ids = c.persons || Object.keys(this._hass.states).filter(e => e.startsWith('person.'));
    const ps = ids.map(e => this._st(e)).filter(Boolean);
    const home = ps.filter(p => String(p.state).toLowerCase() === 'home');
    const pal = ['#ffb347', '#a36bff', '#4da3ff', '#3ddc84', '#ff6b9a'];
    this._html($('s-av'), ps.slice(0, 5).map((p, n) => {
      const nm = (p.attributes.friendly_name || '?').trim(), ini = nm.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const h = String(p.state).toLowerCase() === 'home';
      return `<div class="av" data-act="more:${p.entity_id}" style="background:${h ? pal[n % 5] : '#2a2b2f'};color:${h ? '#1b1206' : '#979ca5'}">${ini}</div>`;
    }).join(''));
    $('s-p').textContent = `${home.length} von ${ps.length}`;
    // Fenster
    const w = this._win || { open: 0, tilt: 0, na: 0, total: 0, col: '#979ca5' };
    $('s-w').textContent = w.open || w.tilt ? [w.open ? `${w.open} offen` : '', w.tilt ? `${w.tilt} gekippt` : ''].filter(Boolean).join(' · ') : w.total && w.na === w.total ? 'n.v.' : 'Alles zu';
    $('s-w-led').style.setProperty('--lc', w.col);
    // Termin
    const cal = this._st(c.calendar);
    if (cal && cal.attributes.start_time) {
      const d = new Date(cal.attributes.start_time.replace(' ', 'T'));
      const day = d.toDateString() === new Date().toDateString() ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      $('s-cal').textContent = `${day} ${cal.attributes.all_day ? '' : hhmm(d)} ${cal.attributes.message || ''}`.replace(/\s+/g, ' ').trim();
    } else $('s-cal').textContent = c.calendar ? 'Keine Termine' : '—';
  }
}

if (!customElements.get('raum-tablet-card')) customElements.define('raum-tablet-card', RaumTabletCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'raum-tablet-card', name: 'Raum-Tablet-Card', description: 'Wandtablet-Dashboard: Licht, Heizung, Grundriss, Wetter, Raumklima' });
console.info(`%c RAUM-TABLET-CARD %c ${RTC_VERSION} `, 'background:#ffb347;color:#000;font-weight:700', 'background:#222;color:#ffb347');
