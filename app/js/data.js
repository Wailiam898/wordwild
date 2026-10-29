// Wordwild curriculum. Systematic synthetic phonics: every word and story uses only
// graphemes (and heart words) taught by that lesson. tools/validate.mjs enforces this.

// Grapheme -> IPA (Kokoro en-gb symbols), type, and a key picture word for the intro.
export const GRAPHEMES = {
  s:   { ipa: 's',  v: 0, key: 'sun',      e: '☀️' },
  a:   { ipa: 'a',  v: 1, key: 'apple',    e: '🍎' },
  t:   { ipa: 't',  v: 0, key: 'tiger',    e: '🐯' },
  p:   { ipa: 'p',  v: 0, key: 'pig',      e: '🐷' },
  i:   { ipa: 'ɪ',  v: 1, key: 'insect',   e: '🐛' },
  n:   { ipa: 'n',  v: 0, key: 'nest',     e: '🪺' },
  m:   { ipa: 'm',  v: 0, key: 'moon',     e: '🌙' },
  d:   { ipa: 'd',  v: 0, key: 'dog',      e: '🐶' },
  g:   { ipa: 'ɡ',  v: 0, key: 'goat',     e: '🐐' },
  o:   { ipa: 'ɒ',  v: 1, key: 'octopus',  e: '🐙' },
  c:   { ipa: 'k',  v: 0, key: 'cat',      e: '🐱' },
  k:   { ipa: 'k',  v: 0, key: 'kite',     e: '🪁' },
  ck:  { ipa: 'k',  v: 0, key: 'duck',     e: '🦆' },
  e:   { ipa: 'ɛ',  v: 1, key: 'egg',      e: '🥚' },
  u:   { ipa: 'ʌ',  v: 1, key: 'umbrella', e: '☂️' },
  r:   { ipa: 'ɹ',  v: 0, key: 'rabbit',   e: '🐰' },
  h:   { ipa: 'h',  v: 0, key: 'hat',      e: '🎩' },
  b:   { ipa: 'b',  v: 0, key: 'ball',     e: '⚽' },
  f:   { ipa: 'f',  v: 0, key: 'fish',     e: '🐟' },
  l:   { ipa: 'l',  v: 0, key: 'lion',     e: '🦁' },
  ff:  { ipa: 'f',  v: 0, key: 'puff',     e: '💨' },
  ll:  { ipa: 'l',  v: 0, key: 'bell',     e: '🔔' },
  ss:  { ipa: 's',  v: 0, key: 'hiss',     e: '🐍' },
  j:   { ipa: 'dʒ', v: 0, key: 'jellyfish',e: '🪼' },
  v:   { ipa: 'v',  v: 0, key: 'van',      e: '🚐' },
  w:   { ipa: 'w',  v: 0, key: 'web',      e: '🕸️' },
  x:   { ipa: 'ks', v: 0, key: 'fox',      e: '🦊' },
  y:   { ipa: 'j',  v: 0, key: 'yoyo',     e: '🪀' },
  z:   { ipa: 'z',  v: 0, key: 'zebra',    e: '🦓' },
  zz:  { ipa: 'z',  v: 0, key: 'buzz',     e: '🐝' },
  qu:  { ipa: 'kw', v: 0, key: 'queen',    e: '👸' },
  ch:  { ipa: 'tʃ', v: 0, key: 'chick',    e: '🐥' },
  sh:  { ipa: 'ʃ',  v: 0, key: 'ship',     e: '🚢' },
  th:  { ipa: 'θ',  v: 0, key: 'thumb',    e: '👍' },
  ng:  { ipa: 'ŋ',  v: 0, key: 'ring',     e: '💍' },
  ai:  { ipa: 'eɪ', v: 1, key: 'rain',     e: '🌧️' },
  ee:  { ipa: 'iː', v: 1, key: 'tree',     e: '🌳' },
  igh: { ipa: 'aɪ', v: 1, key: 'night',    e: '🌃' },
  oa:  { ipa: 'əʊ', v: 1, key: 'boat',     e: '⛵' },
  oo:  { ipa: 'uː', v: 1, key: 'moon',     e: '🌙' },
  ar:  { ipa: 'ɑː', v: 1, key: 'car',      e: '🚗' },
  or:  { ipa: 'ɔː', v: 1, key: 'fork',     e: '🍴' },
  ur:  { ipa: 'ɜː', v: 1, key: 'turtle',   e: '🐢' },
  ow:  { ipa: 'aʊ', v: 1, key: 'cow',      e: '🐄' },
  oi:  { ipa: 'ɔɪ', v: 1, key: 'coin',     e: '🪙' },
};

// Heart words: the tricky letters (index range) get a heart.
export const HEART = {
  the:  { tricky: [2, 3] },
  i:    { tricky: [0, 1] },
  to:   { tricky: [1, 2] },
  is:   { tricky: [1, 2] },
  no:   { tricky: [1, 2] },
  go:   { tricky: [1, 2] },
  he:   { tricky: [1, 2] },
  she:  { tricky: [2, 3] },
  we:   { tricky: [1, 2] },
  me:   { tricky: [1, 2] },
  be:   { tricky: [1, 2] },
  was:  { tricky: [1, 3] },
  you:  { tricky: [1, 3] },
  they: { tricky: [2, 4] },
  all:  { tricky: [0, 1] },
  are:  { tricky: [2, 3] },
  my:   { tricky: [1, 2] },
  her:  { tricky: [1, 3] },
  said: { tricky: [1, 3] },
  has:  { tricky: [2, 3] },
  his:  { tricky: [2, 3] },
};

// Words: "word" or "word:emoji". Emoji words can be used in picture games.
// Each lesson's words must be decodable with graphemes taught so far.
export const WORLDS = [
  {
    id: 'sands', name: 'Sunny Sands', theme: 'sands',
    lessons: [
      { id: 'L1', g: ['s', 'a', 't', 'p', 'i', 'n'], heart: [],
        words: 'tap:🚰 pin:📌 pan:🍳 nap:😴 sit:🧘 ant:🐜 sip:🥤 sat tin it in an pit tip nip pat spin snap',
        story: 'pip' },
      { id: 'L2', g: ['m', 'd'], heart: ['the', 'i', 'said'],
        words: 'map:🗺️ man:👨 dad:👨‍👧 sad:😢 mad:😠 mat dip dim pad mid did and mist',
        story: 'dadsam' },
      { id: 'L3', g: ['g', 'o'], heart: ['to'],
        words: 'dog:🐶 pig:🐷 pot:🍲 dot:⚫ dig:⛏️ tag:🏷️ top on not nod got pod gas',
        story: 'dig' },
      { id: 'L4', review: true, g: [], heart: [],
        words: 'tap:🚰 pin:📌 pan:🍳 nap:😴 ant:🐜 map:🗺️ sad:😢 sip:🥤 dog:🐶 pig:🐷 pot:🍲 dig:⛏️',
        story: 'map' },
    ],
  },
  {
    id: 'jungle', name: 'Jungle Jumble', theme: 'jungle',
    lessons: [
      { id: 'L5', g: ['c', 'k', 'ck'], heart: [],
        words: 'cat:🐱 can:🥫 cap:🧢 sock:🧦 sick:🤒 kid:🧒 kick cot kit tick pick sack dock',
        story: 'sock' },
      { id: 'L6', g: ['e', 'u'], heart: [],
        words: 'net:🥅 pen:🖊️ ten:🔟 sun:☀️ cup:☕ nut:🥜 duck:🦆 up:⬆️ mud gum pet peg tuck',
        story: 'duck' },
      { id: 'L7', g: ['r', 'h', 'b'], heart: ['no', 'go'],
        words: 'rat:🐀 red:🔴 run:🏃 hat:🎩 hot:🔥 hug:🤗 hen:🐔 bus:🚌 bat:🦇 bed:🛏️ bag:👜 bug:🐛 cab:🚕 tub:🛁 rock:🪨 rug hut bun rib',
        story: 'bus' },
      { id: 'L8', g: ['f', 'l', 'ff', 'll', 'ss'], heart: ['is', 'has', 'his'],
        words: 'fan:🪭 fog:🌫️ log:🪵 leg:🦵 lip:👄 bell:🔔 doll:🪆 hill:⛰️ kiss:💋 frog:🐸 flag:🚩 fin fun lid let off puff mess hiss fell',
        story: 'frog' },
      { id: 'L9', review: true, g: [], heart: [],
        words: 'dog:🐶 cat:🐱 sun:☀️ bus:🚌 frog:🐸 duck:🦆 hat:🎩 bed:🛏️ bell:🔔 sock:🧦 pig:🐷 cup:☕',
        story: 'hill' },
    ],
  },
  {
    id: 'volcano', name: 'Volcano Valley', theme: 'volcano',
    lessons: [
      { id: 'L10', g: ['j', 'v', 'w'], heart: ['he', 'she'],
        words: 'jet:✈️ jam:🍯 van:🚐 vet:🩺 web:🕸️ wet:💦 win:🏆 wig jug job wag twig',
        story: 'van' },
      { id: 'L11', g: ['x', 'y', 'z', 'zz', 'qu'], heart: ['we', 'me', 'be'],
        words: 'fox:🦊 box:📦 yes:✅ yak:🐃 zip:🤐 zap:⚡ buzz:🐝 quiz:❓ six wax yell fizz quick quack',
        story: 'fox' },
      { id: 'L12', g: ['ch', 'sh'], heart: ['was'],
        words: 'chip:🍟 chick:🐥 ship:🚢 shop:🏪 fish:🐟 dish:🍽️ shell:🐚 cash:💵 chop chin much rich shed shut',
        story: 'ship' },
      { id: 'L13', g: ['th', 'ng'], heart: ['you'],
        words: 'ring:💍 king:🤴 wing:🪽 bath:🛁 song:🎵 sing:🎤 thin thick moth path with long thing',
        story: 'king' },
      { id: 'L14', review: true, g: [], heart: [],
        words: 'fox:🦊 fish:🐟 ship:🚢 king:🤴 chip:🍟 jet:✈️ web:🕸️ box:📦 buzz:🐝 shell:🐚 ring:💍 van:🚐',
        story: 'quest' },
    ],
  },
  {
    id: 'caves', name: 'Crystal Caves', theme: 'caves',
    lessons: [
      { id: 'L15', g: ['ai', 'ee'], heart: ['they'],
        words: 'rain:🌧️ snail:🐌 train:🚂 mail:📬 tree:🌳 bee:🐝 feet:🦶 sheep:🐑 seed:🌱 see:👀 tail wait green',
        story: 'snail' },
      { id: 'L16', g: ['igh', 'oa'], heart: ['my'],
        words: 'night:🌃 light:💡 boat:⛵ goat:🐐 coat:🧥 road:🛣️ toad:🐸 soap:🧼 high right fight',
        story: 'goat' },
      { id: 'L17', g: ['oo', 'ar'], heart: ['are', 'all'],
        words: 'moon:🌙 boot:🥾 spoon:🥄 zoo:🦒 car:🚗 star:⭐ farm:🚜 shark:🦈 jar:🫙 food roof park',
        story: 'moon' },
      { id: 'L18', g: ['or', 'ur'], heart: ['her'],
        words: 'fork:🍴 corn:🌽 storm:⛈️ horn:📯 burn:🔥 surf:🏄 church:⛪ turn hurt sort',
        story: 'storm' },
      { id: 'L19', g: ['ow', 'oi'], heart: [],
        words: 'cow:🐄 owl:🦉 crown:👑 coin:🪙 town:🏘️ down:⬇️ oil soil boil point',
        story: 'crown' },
    ],
  },
];

// Decodable stories. Each page: text + picture (emoji scene). q: comprehension question.
export const STORIES = {
  pip: { title: 'Pip!', cover: '🐾', pages: [
    { t: 'Pip sat.', pic: '🪨' },
    { t: 'Pip sips.', pic: '🥤' },
    { t: 'Tip, tip, tip.', pic: '💧💧💧' },
    { t: 'Pip naps.', pic: '😴💤' },
  ], q: { text: 'What did Pip do at the end?', opts: ['😴', '🥤', '🏃'], a: 0 } },
  dadsam: { title: 'Dad and Sam', cover: '🍳', pages: [
    { t: 'Sam and Dad sit.', pic: '👨‍👦🪑' },
    { t: 'Dad taps the pan.', pic: '🍳🥄' },
    { t: 'Sam taps the pan.', pic: '🍳👦' },
    { t: 'Tap, tap, tap!', pic: '🥁🎶' },
    { t: 'I nap, said Dad.', pic: '😴' },
  ], q: { text: 'What did Sam and Dad tap?', opts: ['🍳', '🚪', '🥁'], a: 0 } },
  map: { title: 'The Map', cover: '🗺️', pages: [
    { t: 'Pip and Sam sit.', pic: '🏖️' },
    { t: 'Pip taps the map.', pic: '🗺️' },
    { t: 'Tap, tap, tap!', pic: '👆🗺️' },
    { t: 'An ant!', pic: '🐜❗' },
    { t: 'The ant sits in the pan.', pic: '🐜🍳' },
    { t: 'Sam and Pip nap.', pic: '😴💤' },
  ], q: { text: 'What sat in the pan?', opts: ['🐶', '🐜', '🗺️'], a: 1 } },
  dig: { title: 'Dig, Dog, Dig!', cover: '🐶', pages: [
    { t: 'A dog digs.', pic: '🐶⛏️' },
    { t: 'Dig, dig, dig!', pic: '🟫🟫🟫' },
    { t: 'The dog got a pot.', pic: '🐶🍲' },
    { t: 'A pig! A pig in the pot!', pic: '🐷🍲' },
    { t: 'The pig and the dog nod.', pic: '🐷🤝🐶' },
  ], q: { text: 'What was in the pot?', opts: ['🐱', '🐷', '🦆'], a: 1 } },
  sock: { title: 'The Sock', cover: '🧦', pages: [
    { t: 'Kim got a sock.', pic: '👧🧦' },
    { t: 'The cat got the sock!', pic: '🐱🧦' },
    { t: 'Kim and the cat spin and spin.', pic: '👧🌀🐱' },
    { t: 'Kick, kick, kick!', pic: '🦵🦵🦵' },
    { t: 'Kim and the cat nap on the cot.', pic: '😴🐱🛏️' },
  ], q: { text: 'Who took the sock?', opts: ['🐶', '🐱', '🐷'], a: 1 } },
  duck: { title: 'Up, Duck, Up!', cover: '🦆', pages: [
    { t: 'A duck sat in the sun.', pic: '🦆☀️' },
    { t: 'The duck got up.', pic: '🦆⬆️' },
    { t: 'Up, up, up!', pic: '🦆☁️' },
    { t: 'The duck sits in mud!', pic: '🦆🟫' },
    { t: 'The duck sat in a cup.', pic: '🦆☕' },
  ], q: { text: 'Where did the duck sit at the end?', opts: ['☕', '🛏️', '🚌'], a: 0 } },
  bus: { title: 'The Big Bus', cover: '🚌', pages: [
    { t: 'Rob runs to the bus.', pic: '🏃🚌' },
    { t: 'Go, bus, go!', pic: '🚌💨' },
    { t: 'Bump! The bus hits a rock.', pic: '🚌🪨' },
    { t: 'The hat on Rob pops up.', pic: '🎩⬆️' },
    { t: 'No hat! A hen got it!', pic: '🐔🎩' },
  ], q: { text: 'Where did the hat land?', opts: ['🐔', '🚌', '🐶'], a: 0 } },
  frog: { title: 'Frog on a Log', cover: '🐸', pages: [
    { t: 'A frog sits on a log.', pic: '🐸🪵' },
    { t: 'The log is on a big hill.', pic: '🪵⛰️' },
    { t: 'Puff, puff! It is a big hill.', pic: '🐸💦⛰️' },
    { t: 'The frog fell off the log!', pic: '🐸💫' },
    { t: 'Plop! The frog is in the mud.', pic: '🐸🟫' },
  ], q: { text: 'Where did the frog land?', opts: ['🟫', '🌳', '🚌'], a: 0 } },
  hill: { title: 'Up the Hill', cover: '⛰️', pages: [
    { t: 'Ben and his dog run up the hill.', pic: '👦🐶⛰️' },
    { t: 'The sun is hot.', pic: '☀️🔥' },
    { t: 'Ben gets a cup.', pic: '👦☕' },
    { t: 'The dog licks the cup.', pic: '🐶☕' },
    { t: 'Ben and the dog sit on the hill.', pic: '👦🐶⛰️' },
    { t: 'The end!', pic: '🎉' },
  ], q: { text: 'Who licked the cup?', opts: ['👦', '🐶', '🐸'], a: 1 } },
  van: { title: 'The Vet Van', cover: '🚐', pages: [
    { t: 'The vet has a van.', pic: '🩺🚐' },
    { t: 'She gets in the van.', pic: '👩‍⚕️🚐' },
    { t: 'A wet dog is sick.', pic: '🐶💦🤒' },
    { t: 'The vet pets him. He wags and wags!', pic: '👩‍⚕️🐶' },
    { t: 'The dog is well.', pic: '🐶😄' },
  ], q: { text: 'Who was sick?', opts: ['🐱', '🐶', '🐷'], a: 1 } },
  fox: { title: 'Fox in a Box', cover: '🦊', pages: [
    { t: 'A fox is in a box.', pic: '🦊📦' },
    { t: 'Buzz! A bug zips in.', pic: '🐝💨' },
    { t: 'Yell! The fox jumps up.', pic: '🦊❗' },
    { t: 'Quick, fox, quick!', pic: '🦊💨' },
    { t: 'We will get it, said the fox.', pic: '🦊🐝' },
  ], q: { text: 'What zipped into the box?', opts: ['🐝', '🐸', '🦆'], a: 0 } },
  ship: { title: 'The Fish Ship', cover: '🚢', pages: [
    { t: 'Josh has a ship.', pic: '👦🚢' },
    { t: 'The ship gets fish and fish and fish!', pic: '🚢🐟🐟' },
    { t: 'Josh chops the fish.', pic: '🔪🐟' },
    { t: 'The fish is in a dish.', pic: '🐟🍽️' },
    { t: 'Yum! It was a top dish!', pic: '😋🍽️' },
  ], q: { text: 'What did Josh put in the dish?', opts: ['🐟', '🍟', '🥜'], a: 0 } },
  king: { title: 'The King Sings', cover: '🤴', pages: [
    { t: 'The king has a long song.', pic: '🤴🎵' },
    { t: 'He sings and sings.', pic: '🤴🎤' },
    { t: 'The moth sings with him.', pic: '🦋🎵' },
    { t: 'Then a bell rings. Ding!', pic: '🔔' },
    { t: 'You sing! said the king.', pic: '🤴👉' },
  ], q: { text: 'Who sang with the king?', opts: ['🦋', '🐶', '🐟'], a: 0 } },
  quest: { title: 'The Big Quest', cover: '🗺️', pages: [
    { t: 'Pip has a map and a backpack.', pic: '🗺️🎒' },
    { t: 'Pip gets on a ship.', pic: '🚢' },
    { t: 'Then Pip jogs up a hill.', pic: '⛰️' },
    { t: 'A fox and a king wish Pip luck.', pic: '🦊🤴' },
    { t: 'At the top is a chest.', pic: '🧰' },
    { t: 'It is rich with gems!', pic: '💎💎💎' },
  ], q: { text: 'What was in the chest?', opts: ['💎', '🐟', '🧦'], a: 0 } },
  snail: { title: 'Snail in the Rain', cover: '🐌', pages: [
    { t: 'It is raining.', pic: '🌧️' },
    { t: 'A snail sits on a tree.', pic: '🐌🌳' },
    { t: 'They see a bee in the rain.', pic: '🐌🐝🌧️' },
    { t: 'The bee is wet and sad.', pic: '🐝😢' },
    { t: 'Sit with me, said the snail. The bee is snug.', pic: '🐌🐝😊' },
  ], q: { text: 'Who did the snail help?', opts: ['🐝', '🐑', '🐌'], a: 0 } },
  goat: { title: 'The Goat Boat', cover: '🐐', pages: [
    { t: 'A goat has a red boat.', pic: '🐐⛵' },
    { t: 'At night the goat gets in the boat.', pic: '🐐⛵🌃' },
    { t: 'A toad sees a light.', pic: '🐸💡' },
    { t: 'My boat! said the goat.', pic: '🐐⛵' },
    { t: 'The goat and the toad float on the pond.', pic: '🐐🐸🌊' },
  ], q: { text: 'Who was in the boat with the goat?', opts: ['🐸', '🐄', '🦉'], a: 0 } },
  moon: { title: 'Zoom to the Moon', cover: '🌙', pages: [
    { t: 'Pip and Mark are in a car.', pic: '🚗' },
    { t: 'The car is a star car!', pic: '🚗⭐' },
    { t: 'Zoom! Zoom! It is far.', pic: '💨⭐⭐' },
    { t: 'They are on the moon!', pic: '🌙' },
    { t: 'All the stars wink at them.', pic: '⭐⭐⭐' },
  ], q: { text: 'Where did the car go?', opts: ['🌙', '🌳', '🏪'], a: 0 } },
  storm: { title: 'The Storm', cover: '⛈️', pages: [
    { t: 'A storm hits the farm.', pic: '⛈️🚜' },
    { t: 'The goat runs to the barn.', pic: '🐐🛖' },
    { t: 'Her hat turns and turns.', pic: '👒💨' },
    { t: 'The corn gets wet.', pic: '🌽💦' },
    { t: 'Then the sun is back!', pic: '☀️😄' },
  ], q: { text: 'What came back at the end?', opts: ['☀️', '🌧️', '🌙'], a: 0 } },
  crown: { title: 'The Lost Crown', cover: '👑', pages: [
    { t: 'The king lost his crown.', pic: '🤴❓' },
    { t: 'An owl is up in a tree.', pic: '🦉🌳' },
    { t: 'The cow digs in the soil.', pic: '🐄🟫' },
    { t: 'Hoot! The owl points at a coin.', pic: '🦉🪙' },
    { t: 'The crown is in the town!', pic: '👑🏘️' },
    { t: 'Now the king is glad!', pic: '🤴👑🎉' },
  ], q: { text: 'Who pointed at the coin?', opts: ['🦉', '🐄', '🐐'], a: 0 } },
};

// Wordlings: one hatches per lesson. Names are decodable by the time they hatch.
export const WORDLINGS = {
  L1: 'Tap', L2: 'Dimp', L3: 'Tog', L4: 'Nip',
  L5: 'Kit', L6: 'Pud', L7: 'Bun', L8: 'Fluff', L9: 'Biff',
  L10: 'Jiv', L11: 'Zib', L12: 'Shog', L13: 'Thing', L14: 'Chomp',
  L15: 'Sheen', L16: 'Bright', L17: 'Zoom', L18: 'Burp', L19: 'Boing',
};

// Things Pip can wear, bought with gems.
export const HATS = [
  { id: 'none', e: '', cost: 0 },
  { id: 'bow', e: '🎀', cost: 10 },
  { id: 'flower', e: '🌸', cost: 10 },
  { id: 'cap', e: '🧢', cost: 20 },
  { id: 'glasses', e: '🕶️', cost: 25 },
  { id: 'party', e: '🥳', cost: 30, face: true },
  { id: 'tophat', e: '🎩', cost: 35 },
  { id: 'grad', e: '🎓', cost: 45 },
  { id: 'helmet', e: '⛑️', cost: 50 },
  { id: 'crown', e: '👑', cost: 80 },
];

// Narrator and Pip lines. Keys are referenced as audio ids.
export const LINES = {
  welcome: 'Welcome to Wordwild!',
  map_tap: 'Tap the glowing egg to play!',
  intro_this: 'This sound is',
  intro_like: 'like in',
  intro_say: 'Say it with me!',
  intro_find: 'Can you find it?',
  pop_go: 'Pop the bubbles that say',
  pop_more: 'Now pop',
  blend_tap: 'Tap each sound, then slide your finger to blend it!',
  blend_which: 'What did you read? Pick the picture.',
  forge_build: 'Build the word',
  forge_listen: 'Listen to the sounds again.',
  pip_which: 'Tap the sound Pip got wrong.',
  pip_judge: 'Did Pip read it right?',
  pip_was_right: 'Pip was right!',
  pip_listen: 'Listen. It says',
  heart_intro: 'This is a heart word. Part of it is tricky, so we learn it by heart.',
  heart_says: 'It says',
  heart_find: 'Find the heart word',
  story_start: 'Story time! Read each page. Tap a word if you get stuck.',
  story_done: 'You read the whole book! It goes in your library.',
  egg_hatch: 'Your egg is hatching! Tap it, tap it!',
  egg_meet: 'Meet your new Wordling!',
  lesson_done: 'Lesson complete!',
  rest: 'Super reading today! Pip is getting sleepy. Let’s play again tomorrow!',
  arcade_go: 'Ready, set, go!',
  arcade_done: 'Time’s up! Great playing!',
  zoo: 'Tap a Wordling to say hello!',
  shop: 'Pick something for Pip to wear!',
  library: 'Pick a book to read again!',
  speed_go: 'Read the word, then tap its picture. Quick!',
  praise1: 'Brilliant!', praise2: 'You got it!', praise3: 'Awesome!', praise4: 'Yes!',
  praise5: 'Amazing!', praise6: 'Super reading!', praise7: 'Nice one!', praise8: 'That’s it!',
  praise9: 'Wow!', praise10: 'Fantastic!', praise11: 'Great blending!', praise12: 'You’re a star!',
  oops1: 'Oops! Try again.', oops2: 'Almost! Have another go.', oops3: 'Hmm, listen again.',
  oops4: 'Not quite. Try again!',
};

export const PIP_LINES = {
  hi: 'Hi! I’m Pip! Let’s read words and find Wordlings together!',
  try: 'Ooh, can I read it? I think it says',
  ask: 'Did I get it right?',
  thanks: 'Oh! Thank you! Now I get it. It says',
  yay: 'Yay! I got it right!',
  sleepy: 'Yawn! I’m sleepy. See you tomorrow!',
  wow: 'Woohoo!',
  egg: 'An egg! What’s inside?',
};

export const PRAISE = Array.from({ length: 12 }, (_, i) => 'praise' + (i + 1));
export const OOPS = ['oops1', 'oops2', 'oops3', 'oops4'];

// Helpers shared by the app and the tools.
const ALL_G = Object.keys(GRAPHEMES).sort((a, b) => b.length - a.length);

export function parseWords(str) {
  return str.trim().split(/\s+/).map(tok => {
    const [w, e] = tok.split(':');
    return { w, e: e || null };
  });
}

// Longest-match segmentation into graphemes, restricted to `allowed` if given.
export function segment(word, allowed) {
  const out = [];
  let i = 0;
  const w = word.toLowerCase();
  while (i < w.length) {
    const g = ALL_G.find(g => w.startsWith(g, i) && (!allowed || allowed.has(g)));
    if (!g) return null;
    out.push(g);
    i += g.length;
  }
  return out;
}

export function allLessons() {
  const out = [];
  WORLDS.forEach((wd, wi) => wd.lessons.forEach(l => out.push({ ...l, world: wd.id, wi })));
  return out;
}

// Graphemes and heart words known by the end of each lesson.
export function knownAt(lessonIndex) {
  const g = new Set(), h = new Set();
  allLessons().slice(0, lessonIndex + 1).forEach(l => {
    l.g.forEach(x => g.add(x));
    l.heart.forEach(x => h.add(x));
  });
  return { g, h };
}
