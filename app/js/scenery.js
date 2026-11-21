// Scenery for the seven chick-adventure worlds, drawn in code: a sky strip (sun, clouds, moon, stars) and a ground strip
// (hills, fence, pond water, hay, dunes, ...). Used behind the map and, quietly, behind the lesson activities.
const hill = (d, c, o = 1) => `<path d="${d}" fill="${c}" opacity="${o}"/>`;
const circ = (x, y, r, c, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
const cloud = (x, y, s = 1, c = '#fff', o = .9) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}" fill="${c}"><ellipse cx="0" cy="0" rx="34" ry="14"/><ellipse cx="-18" cy="-9" rx="18" ry="14"/><ellipse cx="10" cy="-13" rx="22" ry="17"/></g>`;
const star = (x, y, r, c = '#fff6a8') => `<path d="M${x} ${y - r} l${r * .3} ${r * .7} ${r * .7} ${r * .3} -${r * .7} ${r * .3} -${r * .3} ${r * .7} -${r * .3} -${r * .7} -${r * .7} -${r * .3} ${r * .7} -${r * .3}z" fill="${c}"/>`;
const fence = (x0, x1, y, c) => {
  let s = '';
  for (let x = x0; x < x1; x += 22) s += `<rect x="${x}" y="${y}" width="9" height="38" rx="3" fill="${c}"/>`;
  return s + `<rect x="${x0 - 4}" y="${y + 9}" width="${x1 - x0 + 8}" height="6" rx="3" fill="${c}"/><rect x="${x0 - 4}" y="${y + 24}" width="${x1 - x0 + 8}" height="6" rx="3" fill="${c}"/>`;
};

// What fills the sky strip (viewBox 400 x 200, anchored to the top of a world).
const SKY = {
  farm: () => circ(330, 70, 34, '#fff3a0', .95) + circ(330, 70, 50, '#fff3a0', .25) + cloud(80, 80, 1) + cloud(220, 130, .7),
  meadow: () => circ(70, 66, 28, '#fff7b0', .95) + cloud(250, 70, 1.1, '#fff', .8) + cloud(340, 140, .6, '#fff', .7),
  pond: () => cloud(90, 70, 1.1) + cloud(300, 100, .8) + circ(350, 50, 24, '#fff3a0', .9),
  loft: () => `<rect x="150" y="40" width="100" height="100" rx="50" fill="#ffe9b0" opacity=".9"/><rect x="146" y="36" width="108" height="108" rx="54" fill="none" stroke="#8a5a2e" stroke-width="9"/><path d="M200 36 V144 M146 90 H254" stroke="#8a5a2e" stroke-width="6"/>`,
  coop: () => cloud(70, 70, 1.3) + cloud(250, 50, 1) + cloud(330, 130, 1.2) + cloud(130, 150, .8),
  shore: () => circ(80, 60, 30, '#fff3a0', .95) + circ(80, 60, 46, '#fff3a0', .25) + cloud(260, 80, .9, '#fff', .85),
  roost: () => circ(310, 70, 34, '#fff6c8', .95) + circ(322, 62, 30, '#4b3f9e', .5) + [[60, 40, 7], [140, 90, 5], [220, 40, 6], [90, 130, 4], [190, 150, 5], [360, 150, 4]].map(([x, y, r]) => star(x, y, r)).join('') + cloud(170, 110, .8, '#ffd6e6', .45),
};
// What fills the ground strip (viewBox 400 x 140, anchored to the bottom of a world).
const GROUND = {
  farm: () => hill('M0 70 Q100 20 200 60 T400 50 V140 H0Z', '#8fdc6a') + hill('M0 100 Q120 60 240 96 T400 90 V140 H0Z', '#5cc457')
    + `<g transform="translate(40 36)"><rect x="0" y="22" width="56" height="42" fill="#d8573c"/><path d="M-6 24 L28 0 L62 24Z" fill="#a8402b"/><rect x="20" y="40" width="16" height="24" fill="#fff3d6"/></g>` + fence(250, 380, 82, '#fff3d6'),
  meadow: () => hill('M0 60 Q90 10 200 55 T400 40 V140 H0Z', '#8bdc6a') + hill('M0 98 Q140 56 260 92 T400 86 V140 H0Z', '#52bd5a')
    + [[40, 100, '#ff9fd0'], [90, 112, '#fff'], [150, 104, '#ffe36e'], [250, 108, '#ff9fd0'], [310, 100, '#fff'], [360, 112, '#ffe36e']].map(([x, y, c]) => circ(x, y, 6, c) + circ(x, y, 2.4, '#f0a020')).join(''),
  pond: () => hill('M0 40 Q100 6 200 38 T400 30 V140 H0Z', '#7fd36a') + hill('M0 70 Q60 56 120 70 T240 70 T360 70 T480 70 V140 H0Z', '#4cc3e6') + hill('M0 100 Q60 88 120 100 T240 100 T360 100 T480 100 V140 H0Z', '#2fa7d6')
    + `<ellipse cx="90" cy="92" rx="24" ry="8" fill="#5fc86a"/><ellipse cx="300" cy="104" rx="22" ry="7" fill="#5fc86a"/><path d="M350 30 V70 M360 24 V70 M340 36 V70" stroke="#7a5a2e" stroke-width="5" stroke-linecap="round"/>`,
  loft: () => hill('M0 80 Q70 40 150 78 T300 70 T400 78 V140 H0Z', '#f5cf5e') + hill('M0 110 Q100 76 210 106 T400 100 V140 H0Z', '#e2b441')
    + [0, 1, 2, 3, 4, 5, 6, 7].map(k => `<path d="M${20 + k * 50} 140 V118" stroke="#b98a2e" stroke-width="3" opacity=".5"/>`).join(''),
  coop: () => hill('M0 80 Q60 40 130 74 T260 70 T400 74 V140 H0Z', '#ffffff', .95) + hill('M0 110 Q80 76 170 106 T330 100 T420 104 V140 H0Z', '#e8f1ff'),
  shore: () => hill('M0 56 Q120 14 240 52 T400 44 V140 H0Z', '#f7dc9c') + hill('M0 92 Q70 80 140 92 T280 92 T420 92 V140 H0Z', '#46c8da') + hill('M0 118 Q70 106 140 118 T280 118 T420 118 V140 H0Z', '#1fa5c0')
    + `<path d="M300 52 q12 -14 24 0 q-12 8 -24 0z M60 62 q10 -12 20 0 q-10 7 -20 0z" fill="#ff9fb8"/>`,
  roost: () => hill('M0 66 Q100 20 210 60 T400 46 V140 H0Z', '#3f5f78') + hill('M0 102 Q120 70 250 98 T400 92 V140 H0Z', '#2d4960')
    + `<g transform="translate(300 62)"><ellipse cx="30" cy="34" rx="38" ry="18" fill="#c9954e"/><ellipse cx="30" cy="26" rx="26" ry="11" fill="#e8b873"/><ellipse cx="22" cy="20" rx="8" ry="10" fill="#fff6e0"/><ellipse cx="38" cy="22" rx="8" ry="10" fill="#fff6e0"/></g>`
    + [[40, 40], [120, 84], [210, 40], [350, 30]].map(([x, y]) => circ(x, y, 3, '#fff6a8', .9)).join(''),
};
const wrap = (vb, align, inner, cls) => `<svg class="${cls}" viewBox="${vb}" preserveAspectRatio="${align} slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export const THEMES = Object.keys(SKY);
export const skySVG = theme => wrap('0 0 400 200', 'xMidYMin', (SKY[theme] || SKY.farm)(), 'scene-sky');
export const groundSVG = theme => wrap('0 0 400 140', 'xMidYMax', (GROUND[theme] || GROUND.farm)(), 'scene-ground');
