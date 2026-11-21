// Vector art: Pip (the hero baby chick), the Wordling eggs and chicks, the stepping stones.
import { babySVG } from './babies.js';
let uid = 0;

const INK = '#3a2d4a';
// mood: 'happy' | 'talk' | 'sad' | 'wow' | 'sleepy'
// Pip is the hero chick: a little bigger and more expressive than the Wordlings, drawn in the same soft style.
// Classes kept for the animations: pip-body (idle squash), pip-eyes (blink), pip-mouth (talking beak), pip-wing l/r.
export function pipSVG(mood = 'happy', hat = '') {
  const id = 'p' + (uid++);
  const ln = (d, w = 4, c = INK, extra = '') => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const beakUp = '<path d="M87 123 Q100 112 113 123 Q100 138 87 123Z" fill="#ff9a3c"/><path d="M93 123 Q100 119 107 123" stroke="rgba(255,255,255,.6)" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  const smileL = ln('M78 130 Q84 142 94 134', 3.6) + ln('M122 130 Q116 142 106 134', 3.6);
  const mouths = {
    happy: beakUp + smileL,
    talk: `<g class="pip-mouth"><path d="M90 128 Q100 150 110 128 Z" fill="${INK}"/><ellipse cx="100" cy="140" rx="6.5" ry="3.8" fill="#ff7a9c"/></g>`
      + '<path d="M87 123 Q100 112 113 123 Q100 131 87 123Z" fill="#ff9a3c"/>',
    wow: `<path d="M91 126 Q100 156 109 126 Z" fill="${INK}"/><ellipse cx="100" cy="142" rx="6" ry="3.6" fill="#ff7a9c"/><path d="M87 123 Q100 112 113 123 Q100 131 87 123Z" fill="#ff9a3c"/>`,
    sad: beakUp + ln('M80 142 Q86 132 94 138', 3.6) + ln('M120 142 Q114 132 106 138', 3.6),
    sleepy: beakUp + ln('M92 133 Q100 139 108 133', 3.2),
  };
  const eyeAt = (x, rx, ry) => `${`<ellipse class="pupil" cx="${x}" cy="108" rx="${rx}" ry="${ry}" fill="${INK}"/>`}<circle cx="${x + 4.5}" cy="${108 - 6}" r="5.4" fill="#fff"/><circle cx="${x - 4.5}" cy="${108 + 6.5}" r="2.6" fill="#fff" opacity=".85"/>`;
  const big = mood === 'wow';
  const eyes = mood === 'sleepy'
    ? `<g class="pip-eyes">${ln('M58 108 Q72 120 86 108', 4.6)}${ln('M114 108 Q128 120 142 108', 4.6)}</g>`
    : `<g class="pip-eyes">${eyeAt(72, big ? 15 : 13.5, big ? 19 : 16.5)}${eyeAt(128, big ? 15 : 13.5, big ? 19 : 16.5)}</g>`;
  const brows = mood === 'sad' ? ln('M54 92 L86 82', 4.4, '#d99a2e') + ln('M146 92 L114 82', 4.4, '#d99a2e')
    : mood === 'wow' ? ln('M58 80 Q72 70 86 78', 4.4, '#d99a2e') + ln('M142 80 Q128 70 114 78', 4.4, '#d99a2e')
    : '';
  const extra = mood === 'sad' ? '<path d="M54 120 Q47 134 54 140 Q61 134 54 120Z" fill="#8fd3ff" stroke="#5aa9ff" stroke-width="2"/>'
    : mood === 'wow' ? [[34, 58], [168, 64], [156, 34]].map(([x, y], k) => `<path d="M${x} ${y - 9} l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3z" fill="#fff6a8" stroke="#ffc83f" stroke-width="2" ${k ? '' : 'transform="scale(1.2)" style="transform-box:fill-box;transform-origin:center"'}/>`).join('')
    : mood === 'sleepy' ? `<text x="150" y="56" font-size="30" font-weight="700" fill="#7a62f5" font-family="sans-serif">z</text><text x="166" y="38" font-size="22" font-weight="700" fill="#7a62f5" font-family="sans-serif">z</text>`
    : '';
  const hatSvg = hat
    ? `<text x="100" y="${hat === '🕶️' ? 114 : 50}" font-size="${hat === '🕶️' ? 62 : 58}" text-anchor="middle" dominant-baseline="middle">${hat}</text>`
    : '';
  return `<svg class="pip-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pip the chick">
  <defs>
    <radialGradient id="${id}b" cx="38%" cy="30%" r="78%">
      <stop offset="0" stop-color="#fff9b8"/><stop offset=".5" stop-color="#ffd75e"/><stop offset="1" stop-color="#f2ac3a"/>
    </radialGradient>
  </defs>
  <ellipse cx="100" cy="192" rx="58" ry="7.5" fill="#000" opacity=".15"/>
  <g class="pip-body">
    <ellipse cx="68" cy="185" rx="18" ry="9" fill="#ffab4a"/><ellipse cx="132" cy="185" rx="18" ry="9" fill="#ffab4a"/>
    <path d="M100 46 C152 46 176 90 174 128 C172 166 142 186 100 186 C58 186 28 166 26 128 C24 90 48 46 100 46 Z" fill="url(#${id}b)"/>
    <ellipse cx="100" cy="156" rx="42" ry="26" fill="#fff6d2" opacity=".92"/>
    <g class="pip-wing l"><ellipse cx="29" cy="132" rx="13" ry="22" fill="#ffc83f" transform="rotate(16 29 132)"/></g>
    <g class="pip-wing r"><ellipse cx="171" cy="132" rx="13" ry="22" fill="#ffc83f" transform="rotate(-16 171 132)"/></g>
    <ellipse cx="76" cy="70" rx="18" ry="7.5" fill="#fff" opacity=".45" transform="rotate(-22 76 70)"/>
    ${ln('M92 48 Q86 26 100 20 M101 46 Q104 22 118 20 M110 49 Q124 34 134 38', 7.5, '#f2a82e')}
    ${brows}${eyes}
    <ellipse cx="50" cy="128" rx="11" ry="6.5" fill="#ff8fa8" opacity=".5"/><ellipse cx="150" cy="128" rx="11" ry="6.5" fill="#ff8fa8" opacity=".5"/>
    ${mouths[mood] || mouths.happy}
    ${extra}
    ${hatSvg}
  </g>
</svg>`;
}

// A round stepping stone (a speckled pebble) for the chick to hop on while blending a word.
export function stoneSVG(k = 0) {
  const tints = ['#d9c3a3', '#cfd8b0', '#c8d3e6', '#e6c9b8'];
  const c = tints[k % tints.length];
  return `<svg class="stone-svg" viewBox="0 0 100 64" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="56" rx="42" ry="7" fill="#000" opacity=".16"/>
  <path d="M10 42 C8 22 28 12 50 12 C74 12 92 22 90 42 C88 54 70 58 50 58 C30 58 12 54 10 42Z" fill="${c}"/>
  <path d="M18 30 C24 20 40 17 54 18" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/>
  <circle cx="68" cy="38" r="3.2" fill="#000" opacity=".12"/><circle cx="36" cy="44" r="2.6" fill="#000" opacity=".12"/><circle cx="56" cy="46" r="2" fill="#000" opacity=".12"/></svg>`;
}

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), ((s ^= s >>> 16) >>> 0) / 4294967296); }

export function wordlingLook(name) {
  const r = rng(hash(name) + 11);
  const hue = Math.floor(r() * 360);
  return {
    hue,
    shape: Math.floor(r() * 4),
    eyes: [2, 2, 1, 3][Math.floor(r() * 4)],
    top: Math.floor(r() * 5),
    spots: r() < 0.5,
    mouth: Math.floor(r() * 3),
    hue2: (hue + 140 + Math.floor(r() * 80)) % 360,
  };
}

// The Wordlings are cute baby animals drawn in babies.js (same ids and names as always).
// opts.shell shows a bit of eggshell on a newly hatched one.
export function wordlingSVG(name, silhouette = false, opts = {}) {
  return babySVG(name, silhouette, opts.shell ? { ...opts, hue: wordlingLook(name).hue } : opts);
}

export function eggSVG(name, cracks = 0, golden = false) {
  const L = wordlingLook(name);
  const id = 'e' + (uid++);
  const c1 = golden ? '#fff3a8' : `hsl(${L.hue} 90% 88%)`;
  const c2 = golden ? '#ffc800' : `hsl(${L.hue} 75% 62%)`;
  const crackPaths = [
    'M70 90 L84 102 L76 114 L92 124',
    'M130 80 L118 96 L130 108 L114 120',
    'M60 130 L80 128 L88 142 L106 136 L120 146 L140 138',
  ].slice(0, cracks).map(d => `<path d="${d}" stroke="#3b2a4f" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  return `<svg class="egg-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${id}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
  <ellipse cx="100" cy="206" rx="54" ry="9" fill="#000" opacity=".18"/>
  <path d="M100 18 C150 18 178 100 178 136 C178 180 144 204 100 204 C56 204 22 180 22 136 C22 100 50 18 100 18 Z" fill="url(#${id})"/>
  <circle cx="72" cy="150" r="13" fill="${c2}" opacity=".5"/><circle cx="130" cy="120" r="10" fill="${c2}" opacity=".5"/>
  <circle cx="116" cy="172" r="8" fill="${c2}" opacity=".5"/><circle cx="92" cy="70" r="7" fill="${c2}" opacity=".5"/>
  <ellipse cx="74" cy="66" rx="12" ry="22" fill="#fff" opacity=".6" transform="rotate(20 74 66)"/>
  ${crackPaths}
</svg>`;
}
