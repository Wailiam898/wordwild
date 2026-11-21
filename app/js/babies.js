// The Wordlings: 34 baby chicks, all drawn in code in one soft style.
// Round and fluffy, big shiny eyes, rosy cheeks, tiny wings and beak, pastel colours. Each has its own
// fluff colour, breed features (silkie fluff, crest, feathery feet, comb) and sometimes one small accessory.
// Keyed by the Wordling's name (names never change, so old saves keep every creature).
let uid = 0;
const INK = '#3a2d4a';
const mix = (a, b, t) => {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const lite = (c, t = .35) => mix(c, '#ffffff', t);
const dark = (c, t = .22) => mix(c, '#5a3a6a', t);
const el = (x, y, rx, ry, f, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`;
const ci = (x, y, r, f, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
const ln = (d, col, w = 4, extra = '') => `<path d="${d}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const mirror = s => `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;

const ROUND = 'M100 62 C146 62 166 98 164 130 C162 164 136 184 100 184 C64 184 38 164 36 130 C34 98 54 62 100 62 Z';
const WIDE = 'M100 70 C152 70 176 104 174 136 C172 168 142 184 100 184 C58 184 28 168 26 136 C24 104 48 70 100 70 Z';
const TALL = 'M100 54 C142 54 160 92 158 128 C156 164 132 184 100 184 C68 184 44 164 42 128 C40 92 58 54 100 54 Z';

const nose = (c = '#ff8fa8', y = 128, w = 8) => `<path d="M${100 - w} ${y} Q100 ${y - 5} ${100 + w} ${y} Q100 ${y + 10} ${100 - w} ${y}Z" fill="${c}"/>`;
const smile = (y = 138, w = 9) => ln(`M${100 - w} ${y} Q${100 - w / 2} ${y + 8} 100 ${y} Q${100 + w / 2} ${y + 8} ${100 + w} ${y}`, INK, 3.4);
const whisk = (y = 134) => [[-1, 0], [1, 0]].map(([s]) => [-6, 0, 6].map(dy =>
  ln(`M${100 + s * 30} ${y + dy} L${100 + s * 54} ${y + dy * 2.2 - 2}`, 'rgba(58,45,74,.45)', 2.2)).join('')).join('');
const wingPair = (c, y = 136) => `${el(37, y, 11, 19, c, `transform="rotate(16 37 ${y})"`)}${el(163, y, 11, 19, c, `transform="rotate(-16 163 ${y})"`)}`;
const pawPair = c => `${el(70, 176, 15, 10, c)}${el(130, 176, 15, 10, c)}`;
const roundEar = (x, y, r, c, inner) => `${ci(x, y, r, c)}${ci(x, y + 1, r * .56, inner)}`;
const tri = (pts, c) => `<path d="M${pts.map(p => p.join(' ')).join(' L')} Z" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`;

// eyes: big, glossy and set low and wide apart, which is what makes a baby face look cute.
const eyes = (y = 114, dx = 23, rx = 10.5, ry = 12.5) => [100 - dx, 100 + dx].map(x => `
  <g class="eye">${el(x, y, rx, ry, INK, 'class="pupil"')}${ci(x + 3.5, y - 4.5, 4.2, '#fff')}${ci(x - 3.5, y + 5, 2, '#fff', 'opacity=".85"')}</g>`).join('');
const blush = (y = 132, dx = 41) => `${el(100 - dx, y, 9, 5.5, '#ff8fa8', 'opacity=".5"')}${el(100 + dx, y, 9, 5.5, '#ff8fa8', 'opacity=".5"')}`;


const RED = '#ff6f7f';
// ---- breed features ----
const CREST = {
  tuft: c => ln('M92 64 Q86 46 97 38 M101 63 Q102 42 113 37 M109 65 Q119 50 127 51', c, 7),
  swoop: c => ln('M96 64 Q92 40 120 42', c, 8),
  topknot: c => [[100, 52, 15], [86, 58, 11], [114, 58, 11]].map(([x, y, r]) => ci(x, y, r, c)).join(''),
  comb: () => [[90, 62], [100, 57], [110, 62]].map(([x, y]) => ci(x, y, 7, RED)).join(''),
  mohawk: c => [[78, 68], [88, 60], [100, 56], [112, 60], [122, 68]].map(([x, y], k) => `<path d="M${x - 7} ${y + 10} Q${x} ${y - 20 - (k % 2) * 4} ${x + 7} ${y + 10}Z" fill="${c}"/>`).join(''),
  curl: c => ln('M100 64 Q100 46 112 46 Q122 48 118 58 Q114 64 108 58', c, 6),
  pom: c => ci(100, 52, 16, c) + ci(96, 48, 5, 'rgba(255,255,255,.55)'),
  none: () => '',
};
// pieces of fluff around the edge (silkie / frizzle): drawn behind the body
const puffRing = (c, n = 11) => Array.from({ length: n }, (_, k) => {
  const a = Math.PI * (0.92 + 1.16 * k / (n - 1)); const x = 100 + Math.cos(a) * 62, y = 124 + Math.sin(a) * 60;
  return ci(x, y, 17, c);
}).join('');
const featherFeet = c => [[58, 186], [76, 188], [124, 188], [142, 186]].map(([x, y]) => el(x, y, 6, 11, c, `transform="rotate(${x < 100 ? -28 : 28} ${x} ${y})"`)).join('');
const speckles = c => [[66, 86], [134, 92], [52, 124], [148, 132], [76, 152], [124, 156], [100, 78], [58, 150], [142, 108]].map(([x, y], k) => el(x, y, 3.4, 2.6, c, `opacity=".7" transform="rotate(${k * 40} ${x} ${y})"`)).join('');
const stripes = c => ln('M90 66 L93 80 M100 64 L100 80 M110 66 L107 80', c, 5) + ln('M40 112 l14 5 M38 132 l16 3 M42 150 l14 -3 M160 112 l-14 5 M162 132 l-16 3 M158 150 l-14 -3', c, 5);
const zig = c => ln('M54 150 l10 -9 l10 9 l10 -9 l10 9 l10 -9 l10 9 l10 -9 l10 9', c, 4.5);
const cheekPuffs = c => ci(46, 132, 17, c) + ci(154, 132, 17, c);
const beak = (c, big) => big
  ? `<path d="M86 124 Q100 114 114 124 Q100 150 86 124Z" fill="${c}"/><path d="M92 126 Q100 122 108 126" stroke="rgba(255,255,255,.55)" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
  : `<path d="M91 125 Q100 118 109 125 Q100 142 91 125Z" fill="${c}"/><path d="M95 126 Q100 123 105 126" stroke="rgba(255,255,255,.55)" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

// ---- accessories (sparingly) ----
const bow = (c = '#ff8fb0') => `<path d="M136 72 L118 62 L118 84 Z M136 72 L154 62 L154 84 Z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>${ci(136, 72, 6, dark(c, .25))}`;
const starclip = () => `<path d="M138 66 l4 9.5 10 1 -7.5 6.5 2.5 10 -9 -5.5 -9 5.5 2.5 -10 -7.5 -6.5 10 -1Z" fill="#ffd95a" stroke="#f0b72a" stroke-width="2.5" stroke-linejoin="round"/>`;
const flower = (c = '#ff9cc2') => [0, 72, 144, 216, 288].map(a => ci(136 + Math.cos(a * Math.PI / 180) * 9, 70 + Math.sin(a * Math.PI / 180) * 9, 7, c)).join('') + ci(136, 70, 6, '#ffe36e');
const glasses = (c = '#3a2d4a') => `${ci(77, 114, 18, 'rgba(255,255,255,.18)', `stroke="${c}" stroke-width="4"`)}${ci(123, 114, 18, 'rgba(255,255,255,.18)', `stroke="${c}" stroke-width="4"`)}${ln('M95 112 Q100 108 105 112', c, 4)}`;
const scarf = (c = '#ff6f7f') => `<path d="M46 146 Q100 170 154 146 L152 160 Q100 184 48 160Z" fill="${c}"/><path d="M126 164 L132 190 L146 184 L140 160Z" fill="${dark(c, .15)}"/>` + ln('M62 156 L66 164 M86 164 L88 172', 'rgba(255,255,255,.5)', 3);
const bandana = (c = '#5aa9ff') => `<path d="M48 144 Q100 160 152 144 L100 192Z" fill="${c}"/>${ci(86, 158, 3, '#fff')}${ci(114, 158, 3, '#fff')}${ci(100, 172, 3, '#fff')}`;
const partyhat = (c = '#ff8fb0') => `<path d="M100 18 L78 66 L122 66Z" fill="${c}"/><path d="M90 44 L110 44 M84 56 L116 56" stroke="#fff" stroke-width="4" stroke-linecap="round"/>${ci(100, 16, 7, '#ffd95a')}`;
const cap = (c = '#5aa9ff') => `<path d="M56 76 Q60 46 100 46 Q140 46 144 76Z" fill="${c}"/><path d="M110 70 Q150 64 160 78 Q134 80 110 78Z" fill="${dark(c, .2)}"/>${ci(100, 46, 5, dark(c, .2))}`;
const crown = () => `<path d="M72 68 L74 40 L88 56 L100 36 L112 56 L126 40 L128 68Z" fill="#ffd95a" stroke="#f0b72a" stroke-width="3.5" stroke-linejoin="round"/>${ci(100, 40, 4, '#ff6f7f')}`;
const leaf = () => ln('M100 66 Q98 50 106 40', '#5fbf73', 4) + `<path d="M106 42 Q92 30 80 40 Q92 52 106 42Z" fill="#7be08f"/><path d="M106 42 Q122 28 134 38 Q120 52 106 42Z" fill="#5fcf82"/>`;
const ACC = { bow, starclip, flower, glasses, scarf, bandana, partyhat, cap, crown, leaf };
const HATS_ON_TOP = ['partyhat', 'cap', 'crown', 'leaf'];

// c: fluff, b: belly, w: wings (darker), beak, ft: feet; crest; fx: breed features; acc: accessory (and its colour)
const mk = (desc, c, o = {}) => ({ animal: desc, c, b: o.b || lite(c, .6), w: o.w || dark(c, .12), beak: o.beak || '#ff9a3c', ft: o.ft || '#ffab4a', crest: o.crest || 'tuft', cc: o.cc, fx: o.fx || [], acc: o.acc, ac: o.ac, big: o.big, s: o.s });

const ANIMALS = {
  Tap: mk('classic yellow chick', '#ffd75e', { w: '#ffc83f' }),
  Dimp: mk('cream chick with dimples', '#fff1c9', { crest: 'comb', fx: ['dimples'], w: '#f6dfa6' }),
  Tog: mk('brown chick', '#d9ac7c', { crest: 'comb', w: '#c48f5e', beak: '#e8893c' }),
  Nip: mk('grey chick', '#cfd3e3', { crest: 'swoop', cc: '#aab0c9', w: '#b1b7d0' }),
  Kit: mk('peach chick with a pink bow', '#ffcfae', { crest: 'tuft', cc: '#ffb98c', acc: 'bow', w: '#ffb98c' }),
  Pud: mk('speckled buff chick', '#ffe3a6', { crest: 'tuft', cc: '#f3c765', fx: ['speckle'], w: '#f3c765' }),
  Bun: mk('white silkie chick with a top-knot', '#ffffff', { crest: 'topknot', b: '#fff6fb', w: '#efe6f6', fx: ['silkie'], cc: '#ffffff' }),
  Fluff: mk('extra-fluffy cream silkie chick', '#fff4dc', { crest: 'pom', cc: '#fff4dc', w: '#f3e3c0', fx: ['silkie', 'cheeks'], ft: '#ffbf7a' }),
  Biff: mk('black chick with a tiny comb', '#6d6783', { crest: 'comb', b: '#8a84a3', w: '#575070', beak: '#ffb347', ft: '#ffb347' }),
  Jiv: mk('striped chick in a blue bandana', '#ffdd88', { crest: 'tuft', cc: '#d99a45', fx: ['stripes'], acc: 'bandana', ac: '#5aa9ff', w: '#eec168' }),
  Zib: mk('grey-and-white striped chick', '#f1f0fa', { crest: 'tuft', cc: '#8f8aa8', fx: ['stripes'], w: '#dcd9ee', ft: '#9a95b4', beak: '#c9b8a0' }),
  Shog: mk('shaggy brown chick with feathery feet', '#cf9a6a', { crest: 'tuft', cc: '#b0784a', fx: ['silkie', 'featherFeet'], w: '#b8854f', beak: '#e8893c' }),
  Thing: mk('lavender chick with round glasses', '#d9cdf5', { crest: 'tuft', cc: '#bba9ea', acc: 'glasses', w: '#c3b3ee' }),
  Chomp: mk('orange chick with a big beak', '#ffb773', { crest: 'tuft', big: true, cc: '#ff9d48', w: '#f5a05a', beak: '#ff7a3c', ft: '#ff7a3c' }),
  Sheen: mk('silvery shiny chick with a star clip', '#e3e9f6', { crest: 'swoop', cc: '#c7d1ea', acc: 'starclip', w: '#c7d1ea', fx: ['shine'] }),
  Bright: mk('sunshine-yellow chick with a flower', '#ffee6a', { crest: 'tuft', cc: '#ffd23a', acc: 'flower', ac: '#ff9cc2', w: '#ffd23a' }),
  Zoom: mk('racing chick in a blue cap', '#ffe27a', { crest: 'none', acc: 'cap', ac: '#5aa9ff', w: '#ffcf4a' }),
  Burp: mk('mint-green chick', '#bff0c6', { crest: 'tuft', cc: '#92dca0', w: '#98e0a8' }),
  Boing: mk('bouncy peach chick with a pom-pom', '#ffd3b5', { crest: 'pom', cc: '#ff9d7a', w: '#ffb998' }),
  Frizz: mk('frizzled cream chick with curly feathers', '#fff0d2', { crest: 'curl', cc: '#e9c98a', fx: ['frizzle'], w: '#f0d49a' }),
  Stomp: mk('big brown chick with feathery feet', '#b98558', { crest: 'comb', fx: ['featherFeet'], w: '#9e6c42', beak: '#e8893c', big: true }),
  Zigzag: mk('zigzag-striped chick', '#ffe08f', { crest: 'tuft', cc: '#d9923c', fx: ['zig'], w: '#f0c45e' }),
  Giggly: mk('pink chick in a party hat', '#ffc9dc', { crest: 'none', acc: 'partyhat', ac: '#8fc9ff', w: '#ffaecb' }),
  Blimp: mk('round blue-grey chick', '#bfd6f2', { crest: 'tuft', cc: '#9dbbe6', w: '#9dbbe6', s: 'WIDE' }),
  Sprout: mk('green-tinged chick with a leaf sprout', '#e6f5a8', { crest: 'none', acc: 'leaf', w: '#cfe582' }),
  Peachy: mk('peach chick with a white flower', '#ffc3a1', { crest: 'tuft', cc: '#ffa77a', acc: 'flower', ac: '#ffffff', w: '#ffa77a' }),
  Twirl: mk('cream chick with a curl and red scarf', '#fff3d6', { crest: 'curl', cc: '#e9c98a', acc: 'scarf', ac: '#ff6f7f', w: '#f3dca8' }),
  Squawk: mk('red-orange chick with a comb', '#ff9a78', { crest: 'comb', big: true, w: '#f27d58', beak: '#ffc24a', ft: '#ffc24a' }),
  Shelly: mk('speckled egg-coloured chick', '#f6e7d4', { crest: 'tuft', cc: '#e0c4a0', fx: ['speckle2'], w: '#e0c4a0' }),
  Blaze: mk('orange chick with a flame-like mohawk', '#ffb35c', { crest: 'mohawk', cc: '#ff6a3d', w: '#ff9a3c', beak: '#ff7a3c' }),
  Spike: mk('dark chick with a spiky mohawk', '#8a7a9c', { crest: 'mohawk', cc: '#4a3f68', w: '#6f6082', b: '#a99bbb', beak: '#ffb347', ft: '#ffb347' }),
  Zoomer: mk('grey chick in goggles and a blue scarf', '#d4d8e6', { crest: 'swoop', cc: '#aab0c9', acc: 'glasses', ac: '#ff8a3d', fx: ['scarfBlue'], w: '#b6bcd2' }),
  Whizz: mk('buzzing yellow chick with a star clip', '#fff06a', { crest: 'mohawk', cc: '#ffd23a', acc: 'starclip', w: '#ffd23a', fx: ['wings2'] }),
  Starlight: mk('golden chick with a crown', '#ffe9a0', { crest: 'none', acc: 'crown', w: '#ffd35a', b: '#fff8d8', fx: ['sparkle'] }),
};

// Eggshell left on a newly hatched chick: a cap on the head and a few pieces by the feet.
function shellBits(hue) {
  const sh = `hsl(${hue} 80% 95%)`, rim = `hsl(${hue} 55% 78%)`;
  const cap = `<g transform="rotate(-14 100 52)"><path d="M54 70 C54 44 76 30 100 30 C124 30 146 44 146 70 L134 60 L124 74 L112 58 L100 74 L88 58 L76 74 L66 60 Z" fill="${sh}" stroke="${rim}" stroke-width="3" stroke-linejoin="round"/>`
    + `<ellipse cx="84" cy="44" rx="10" ry="5" fill="#fff" opacity=".8" transform="rotate(-25 84 44)"/></g>`;
  const piece = (x, y, r) => `<path d="M${x - 16} ${y} L${x - 9} ${y - 10} L${x - 2} ${y - 2} L${x + 6} ${y - 12} L${x + 14} ${y - 2} L${x + 18} ${y} Q${x} ${y + 14} ${x - 16} ${y}Z" fill="${sh}" stroke="${rim}" stroke-width="2.5" stroke-linejoin="round" transform="rotate(${r} ${x} ${y})"/>`;
  return { cap, feet: piece(34, 190, -10) + piece(168, 191, 12) };
}

export const animalOf = name => (ANIMALS[name] ? ANIMALS[name].animal : 'baby chick');
export const ANIMAL_NAMES = Object.keys(ANIMALS);

// opts.shell: show the eggshell (opts.hue picks the shell tint, matching the egg that hatched).
export function babySVG(name, silhouette = false, opts = {}) {
  const A = ANIMALS[name] || ANIMALS.Tap;
  const id = 'b' + (uid++);
  const fx = A.fx;
  const shape = A.s === 'WIDE' ? WIDE : ROUND;
  const cc = A.cc || dark(A.c, .1);
  const sh = opts.shell ? shellBits(opts.hue ?? 50) : null;
  const label = silhouette ? 'Not hatched yet' : `${name} the ${A.animal}`;
  const back = (fx.includes('silkie') ? puffRing(lite(A.c, .12)) : '') + (fx.includes('frizzle') ? puffRing(lite(A.c, .05), 15) : '');
  const front = (fx.includes('stripes') ? stripes(cc) : '') + (fx.includes('speckle') ? speckles(cc) : '') + (fx.includes('speckle2') ? speckles('#a9825e') : '')
    + (fx.includes('zig') ? zig(cc) : '') + (fx.includes('cheeks') ? cheekPuffs(lite(A.c, .15)) : '')
    + (fx.includes('shine') ? [[60, 100], [140, 150], [70, 150]].map(([x, y]) => `<path d="M${x} ${y - 6} l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="#fff"/>`).join('') : '')
    + (fx.includes('sparkle') ? [[48, 96], [152, 96], [150, 158]].map(([x, y]) => `<path d="M${x} ${y - 8} l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5z" fill="#fff" stroke="#ffd95a" stroke-width="1.5"/>`).join('') : '');
  const wings = (fx.includes('wings2')
    ? `${el(34, 112, 14, 22, 'rgba(206,236,255,.9)', 'transform="rotate(-24 34 112)"')}${el(166, 112, 14, 22, 'rgba(206,236,255,.9)', 'transform="rotate(24 166 112)"')}` : '') + wingPair(A.w);
  const crest = HATS_ON_TOP.includes(A.acc) ? '' : CREST[A.crest](cc);
  const acc = A.acc ? ACC[A.acc](A.ac) : '';
  const scarfBlue = fx.includes('scarfBlue') ? scarf('#6fa8ff') : '';
  return `<svg class="wl-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}"${silhouette ? ' style="filter:brightness(0);opacity:.22"' : ''}>
  <defs><radialGradient id="${id}b" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="${lite(A.c, .5)}"/><stop offset=".55" stop-color="${A.c}"/><stop offset="1" stop-color="${mix(A.c, '#8a6aa8', .28)}"/></radialGradient></defs>
  <ellipse cx="100" cy="192" rx="56" ry="7" fill="#000" opacity=".14"/>
  <g class="wl-body">
    ${back}
    ${el(70, 184, 17, 9, A.ft)}${el(130, 184, 17, 9, A.ft)}${fx.includes('featherFeet') ? featherFeet(A.w) : ''}
    <path d="${shape}" fill="url(#${id}b)"/>
    <ellipse cx="100" cy="158" rx="40" ry="24" fill="${A.b}" opacity=".9"/>
    ${front}${wings}
    <ellipse cx="76" cy="80" rx="15" ry="6.5" fill="#fff" opacity=".4" transform="rotate(-22 76 80)"/>
    ${eyes(114)}
    ${blush(132, fx.includes('dimples') ? 44 : 41)}${fx.includes('dimples') ? `${ln('M54 140 Q58 144 62 140', '#e9a0a8', 3)}${ln('M138 140 Q142 144 146 140', '#e9a0a8', 3)}` : ''}
    ${beak(A.beak, A.big)}
    ${crest}${scarfBlue}${acc}
    ${sh ? sh.feet + sh.cap : ''}
  </g>
</svg>`;
}
