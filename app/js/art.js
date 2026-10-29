// Vector art: Pip, procedurally generated Wordlings, eggs, the rocket.
let uid = 0;

// mood: 'happy' | 'talk' | 'sad' | 'wow' | 'sleepy'
export function pipSVG(mood = 'happy', hat = '') {
  const id = 'p' + (uid++);
  const mouths = {
    happy: '<path d="M84 128 Q100 144 116 128" stroke="#2a1d5c" stroke-width="5" fill="none" stroke-linecap="round"/>',
    talk: '<g class="pip-mouth"><ellipse cx="100" cy="132" rx="11" ry="9" fill="#2a1d5c"/><ellipse cx="100" cy="137" rx="7" ry="4" fill="#ff7a9c"/></g>',
    wow: '<path d="M82 124 Q100 150 118 124 Z" fill="#2a1d5c"/><path d="M90 136 Q100 146 110 136 Z" fill="#ff7a9c"/>',
    sad: '<path d="M86 136 Q100 124 114 136" stroke="#2a1d5c" stroke-width="5" fill="none" stroke-linecap="round"/>',
    sleepy: '<ellipse cx="100" cy="134" rx="6" ry="5" fill="#2a1d5c"/>',
  };
  const eyes = mood === 'sleepy'
    ? `<path d="M64 104 Q76 112 88 104" stroke="#2a1d5c" stroke-width="5" fill="none" stroke-linecap="round"/>
       <path d="M112 104 Q124 112 136 104" stroke="#2a1d5c" stroke-width="5" fill="none" stroke-linecap="round"/>`
    : `<g class="pip-eyes">
        <ellipse cx="76" cy="102" rx="17" ry="21" fill="#fff"/>
        <ellipse cx="124" cy="102" rx="17" ry="21" fill="#fff"/>
        <circle class="pupil" cx="79" cy="106" r="11" fill="#2a1d5c"/>
        <circle class="pupil" cx="121" cy="106" r="11" fill="#2a1d5c"/>
        <circle cx="83" cy="100" r="4.5" fill="#fff"/>
        <circle cx="125" cy="100" r="4.5" fill="#fff"/>
        <circle cx="75" cy="111" r="2" fill="#fff" opacity=".8"/>
        <circle cx="117" cy="111" r="2" fill="#fff" opacity=".8"/>
       </g>`;
  const hatSvg = hat
    ? `<text x="100" y="${hat === '🕶️' ? 116 : 52}" font-size="${hat === '🕶️' ? 62 : 58}" text-anchor="middle" dominant-baseline="middle">${hat}</text>`
    : '';
  return `<svg class="pip-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${id}b" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#b9a9ff"/><stop offset=".6" stop-color="#8a72ff"/><stop offset="1" stop-color="#5c43e0"/>
    </radialGradient>
    <radialGradient id="${id}s" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff7b0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ffb000"/>
    </radialGradient>
    <filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <ellipse cx="100" cy="188" rx="52" ry="8" fill="#000" opacity=".15"/>
  <g class="pip-body">
    <path class="pip-antenna" d="M100 52 Q96 30 112 18" stroke="#6d55f0" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g class="pip-star">
      <circle cx="113" cy="16" r="13" fill="#ffd23f" filter="url(#${id}g)" opacity=".8"/>
      <path d="M113 4 L116.5 12 L125 12.5 L118.5 18 L120.5 26.5 L113 22 L105.5 26.5 L107.5 18 L101 12.5 L109.5 12 Z" fill="url(#${id}s)" stroke="#e09b00" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
    <path d="M52 72 L40 40 L76 58 Z" fill="#7a62f5"/><path d="M148 72 L160 40 L124 58 Z" fill="#7a62f5"/>
    <path d="M55 68 L48 50 L68 60 Z" fill="#ffb3d1"/><path d="M145 68 L152 50 L132 60 Z" fill="#ffb3d1"/>
    <ellipse cx="62" cy="178" rx="20" ry="11" fill="#4a33c4"/>
    <ellipse cx="138" cy="178" rx="20" ry="11" fill="#4a33c4"/>
    <path d="M100 50 C150 50 172 92 170 128 C168 164 140 182 100 182 C60 182 32 164 30 128 C28 92 50 50 100 50 Z" fill="url(#${id}b)"/>
    <ellipse cx="100" cy="150" rx="44" ry="28" fill="#e6deff" opacity=".9"/>
    <ellipse class="pip-arm l" cx="34" cy="132" rx="12" ry="18" fill="#7a62f5"/>
    <ellipse class="pip-arm r" cx="166" cy="132" rx="12" ry="18" fill="#7a62f5"/>
    <ellipse cx="80" cy="66" rx="20" ry="9" fill="#fff" opacity=".35" transform="rotate(-20 80 66)"/>
    ${eyes}
    <ellipse cx="58" cy="126" rx="10" ry="6" fill="#ff7a9c" opacity=".55"/>
    <ellipse cx="142" cy="126" rx="10" ry="6" fill="#ff7a9c" opacity=".55"/>
    ${mouths[mood] || mouths.happy}
    ${hatSvg}
  </g>
</svg>`;
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

export function wordlingSVG(name, silhouette = false) {
  const L = wordlingLook(name);
  const id = 'w' + (uid++);
  const body = silhouette ? '#000' : `url(#${id}b)`;
  const dark = silhouette ? '#000' : `hsl(${L.hue} 60% 40%)`;
  const belly = `hsl(${L.hue} 90% 88%)`;
  const acc = `hsl(${L.hue2} 85% 60%)`;
  const shapes = [
    'M100 40 C155 40 175 90 172 130 C170 168 140 186 100 186 C60 186 30 168 28 130 C25 90 45 40 100 40 Z',
    'M100 30 C140 30 155 70 155 120 C155 165 135 186 100 186 C65 186 45 165 45 120 C45 70 60 30 100 30 Z',
    'M100 62 C165 62 186 100 184 140 C182 172 150 186 100 186 C50 186 18 172 16 140 C14 100 35 62 100 62 Z',
    'M100 36 C128 36 140 70 156 110 C172 150 150 186 100 186 C50 186 28 150 44 110 C60 70 72 36 100 36 Z',
  ];
  const topY = [40, 30, 62, 36][L.shape];
  const tops = [
    `<path d="M70 ${topY + 14} L60 ${topY - 22} L88 ${topY + 6} Z M130 ${topY + 14} L140 ${topY - 22} L112 ${topY + 6} Z" fill="${silhouette ? '#000' : acc}"/>`,
    `<ellipse cx="72" cy="${topY - 8}" rx="11" ry="30" fill="${dark}" transform="rotate(-15 72 ${topY})"/><ellipse cx="128" cy="${topY - 8}" rx="11" ry="30" fill="${dark}" transform="rotate(15 128 ${topY})"/>`,
    `<path d="M100 ${topY + 4} Q96 ${topY - 20} 112 ${topY - 30}" stroke="${dark}" stroke-width="5" fill="none"/><ellipse cx="118" cy="${topY - 30}" rx="14" ry="8" fill="${silhouette ? '#000' : '#4bd37b'}" transform="rotate(-25 118 ${topY - 30})"/>`,
    `<path d="M76 ${topY + 8} L84 ${topY - 16} L92 ${topY + 2} L100 ${topY - 22} L108 ${topY + 2} L116 ${topY - 16} L124 ${topY + 8} Z" fill="${silhouette ? '#000' : acc}"/>`,
    `<circle cx="100" cy="${topY - 14}" r="12" fill="${silhouette ? '#000' : acc}"/><path d="M100 ${topY + 4} L100 ${topY - 4}" stroke="${dark}" stroke-width="5"/>`,
  ];
  const eyeY = topY + (186 - topY) * 0.38;
  const eyeSets = { 1: [100], 2: [78, 122], 3: [70, 100, 130] }[L.eyes];
  const er = L.eyes === 1 ? 22 : L.eyes === 3 ? 12 : 16;
  const eyes = silhouette ? '' : eyeSets.map(x => `
    <circle cx="${x}" cy="${eyeY}" r="${er}" fill="#fff"/>
    <circle class="pupil" cx="${x + 2}" cy="${eyeY + 3}" r="${er * 0.58}" fill="#22183f"/>
    <circle cx="${x + er * 0.35}" cy="${eyeY - er * 0.3}" r="${er * 0.25}" fill="#fff"/>`).join('');
  const my = eyeY + er + 16;
  const mouth = silhouette ? '' : [
    `<path d="M86 ${my} Q100 ${my + 14} 114 ${my}" stroke="#22183f" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    `<path d="M84 ${my - 2} Q100 ${my + 20} 116 ${my - 2} Z" fill="#22183f"/><path d="M92 ${my + 4} Q100 ${my + 12} 108 ${my + 4} Z" fill="#ff6f91"/>`,
    `<path d="M86 ${my} Q100 ${my + 12} 114 ${my}" stroke="#22183f" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M92 ${my + 3} l4 8 l4 -7 Z" fill="#fff"/>`,
  ][L.mouth];
  const spots = L.spots && !silhouette
    ? `<circle cx="58" cy="140" r="9" fill="${dark}" opacity=".35"/><circle cx="146" cy="128" r="7" fill="${dark}" opacity=".35"/><circle cx="140" cy="158" r="5" fill="${dark}" opacity=".35"/>`
    : '';
  return `<svg class="wl-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="${id}b" cx="38%" cy="32%" r="75%">
    <stop offset="0" stop-color="hsl(${L.hue} 95% 78%)"/><stop offset=".6" stop-color="hsl(${L.hue} 80% 60%)"/><stop offset="1" stop-color="hsl(${L.hue} 70% 45%)"/>
  </radialGradient></defs>
  <ellipse cx="100" cy="192" rx="56" ry="7" fill="#000" opacity="${silhouette ? 0.08 : 0.15}"/>
  <g class="wl-body" ${silhouette ? 'opacity=".22"' : ''}>
    ${tops[L.top]}
    <ellipse cx="70" cy="184" rx="18" ry="9" fill="${dark}"/><ellipse cx="130" cy="184" rx="18" ry="9" fill="${dark}"/>
    <path d="${shapes[L.shape]}" fill="${body}"/>
    ${silhouette ? '' : `<ellipse cx="100" cy="158" rx="40" ry="22" fill="${belly}" opacity=".85"/>`}
    ${spots}${eyes}${mouth}
    ${silhouette ? '' : `<ellipse cx="78" cy="${topY + 22}" rx="16" ry="7" fill="#fff" opacity=".35" transform="rotate(-20 78 ${topY + 22})"/>`}
  </g>
</svg>`;
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

export function rocketSVG() {
  return `<svg class="rocket-svg" viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="rk" x1="0" x2="1"><stop offset="0" stop-color="#e8ecff"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#c3c9f5"/></linearGradient></defs>
  <g class="flame"><path d="M44 178 Q60 230 76 178 Z" fill="#ffb000"/><path d="M50 178 Q60 210 70 178 Z" fill="#fff36b"/></g>
  <path d="M30 150 L8 186 L34 176 Z" fill="#ff5d73"/><path d="M90 150 L112 186 L86 176 Z" fill="#ff5d73"/>
  <path d="M60 6 C92 36 96 100 90 176 L30 176 C24 100 28 36 60 6 Z" fill="url(#rk)" stroke="#7b84d6" stroke-width="2"/>
  <path d="M60 6 C74 20 82 36 86 52 L34 52 C38 36 46 20 60 6 Z" fill="#ff5d73"/>
  <circle cx="60" cy="96" r="20" fill="#5bc8ff" stroke="#7b84d6" stroke-width="5"/>
  <circle cx="54" cy="90" r="6" fill="#fff" opacity=".7"/>
  <rect x="50" y="170" width="20" height="12" rx="3" fill="#7b84d6"/>
</svg>`;
}
