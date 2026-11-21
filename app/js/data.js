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
  // y at the end of a word: y2 says ee (happy), y3 says igh (fly). Both are written y.
  y2:  { ipa: 'iː', v: 1, key: 'happy',    e: '😄' },
  ay:  { ipa: 'eɪ', v: 1, key: 'play',     e: '🛝' },
  ou:  { ipa: 'aʊ', v: 1, key: 'cloud',    e: '☁️' },
  ea:  { ipa: 'iː', v: 1, key: 'leaf',     e: '🍃' },
  ie:  { ipa: 'aɪ', v: 1, key: 'pie',      e: '🥧' },
  y3:  { ipa: 'aɪ', v: 1, key: 'fly',      e: '🪰' },
  oy:  { ipa: 'ɔɪ', v: 1, key: 'boy',      e: '👦' },
  ir:  { ipa: 'ɜː', v: 1, key: 'bird',     e: '🐦' },
  er:  { ipa: 'ɜː', v: 1, key: 'fern',     e: '🌿' },
  aw:  { ipa: 'ɔː', v: 1, key: 'paw',      e: '🐾' },
  ew:  { ipa: 'juː', v: 1, key: 'stew',    e: '🍲' },
  // Split vowels: cake is c, a_e, k, then a silent e (the token '_e').
  a_e: { ipa: 'eɪ', v: 1, key: 'cake',     e: '🎂' },
  i_e: { ipa: 'aɪ', v: 1, key: 'bike',     e: '🚲' },
  o_e: { ipa: 'əʊ', v: 1, key: 'bone',     e: '🦴' },
  u_e: { ipa: 'juː', v: 1, key: 'cube',    e: '🧊' },
  wh:  { ipa: 'w',  v: 0, key: 'whale',    e: '🐋' },
  ph:  { ipa: 'f',  v: 0, key: 'dolphin',  e: '🐬' },
};
export const SILENT_E = '_e';
export const isSplit = g => g.length === 3 && g.endsWith('_e');

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
  do:   { tricky: [1, 2] },
  have: { tricky: [3, 4] },
  some: { tricky: [1, 4] },
  come: { tricky: [1, 4] },
  one:  { tricky: [0, 3] },
  were: { tricky: [1, 4] },
  there:{ tricky: [2, 5] },
  what: { tricky: [2, 3] },
  little:{ tricky: [4, 6] },
  here: { tricky: [1, 4] },
  love: { tricky: [1, 4] },
  your: { tricky: [1, 4] },
  water:{ tricky: [1, 2] },
  friend:{ tricky: [2, 4] },
  could:{ tricky: [1, 4] },
  would:{ tricky: [1, 4] },
  two:  { tricky: [1, 3] },
  who:  { tricky: [0, 3] },
  many: { tricky: [1, 2] },
  any:  { tricky: [0, 1] },
  where:{ tricky: [2, 5] },
};

// Words: "word" or "word:emoji". Emoji words can be used in picture games.
// Each lesson's words must be decodable with graphemes taught so far.
export const WORLDS = [
  {
    id: 'sands', name: 'Sunny Farm', theme: 'farm',
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
    id: 'jungle', name: 'Meadow Muddle', theme: 'meadow',
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
    id: 'volcano', name: 'Duck Pond', theme: 'pond',
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
    id: 'caves', name: 'Barn Loft', theme: 'loft',
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
  {
    id: 'clouds', name: 'Cloud Coop', theme: 'coop',
    lessons: [
      { id: 'L20', g: [], focus: 'blends: cr, fl, st…', heart: ['do', 'have'],
        words: 'crab:🦀 drum:🥁 plug:🔌 sled:🛷 swim:🏊 truck:🚚 brush:🪥 clock:🕰️ stop:🛑 clap:👏 grab grin plan glad slip step trip flat',
        story: 'crab' },
      { id: 'L21', g: [], focus: 'end blends: nd, mp, st…', heart: ['some', 'come'],
        words: 'tent:⛺ milk:🥛 gift:🎁 lamp:🪔 hand:✋ mask:🎭 list:📝 skunk:🦨 belt band jump bend lift help best fast lost',
        story: 'tent' },
      { id: 'L22', g: [], focus: 'two-part words', heart: ['one', 'were'],
        words: 'sun|set:🌅 pic|nic:🧺 rab|bit:🐇 kit|ten:🐈 mag|net:🧲 pump|kin:🎃 rock|et:🚀 lap|top:💻 hot|dog:🌭 hel|met:⛑️ den|tist:🦷 zig|zag up|set nap|kin',
        story: 'rocket' },
      { id: 'L23', g: ['y2'], heart: ['there', 'what'],
        words: 'hap|py:😄 pup|py:🐶 bun|ny:🐰 ted|dy:🧸 can|dy:🍬 lolly:🍭 jump|ing:🦘 fish|ing:🎣 sleep|ing:😴 run|ning:🏃 fun|ny silly mud|dy sun|ny',
        story: 'puppy' },
      { id: 'L24', review: true, g: [], heart: [],
        words: 'crab:🦀 drum:🥁 tent:⛺ gift:🎁 milk:🥛 rab|bit:🐇 rock|et:🚀 pump|kin:🎃 hap|py:😄 ted|dy:🧸 truck:🚚 skunk:🦨',
        story: 'windy' },
    ],
  },
  {
    id: 'reef', name: 'Seaside Shells', theme: 'shore',
    lessons: [
      { id: 'L25', g: ['ay', 'ou'], heart: ['little'],
        words: 'play:🛝 hay:🌾 tray:🍱 spray:🧴 cloud:☁️ mouth:👄 shout:📢 couch:🛋️ snout:🐽 sprout:🌱 day say stay way out loud round found',
        story: 'cloud' },
      { id: 'L26', g: ['ea', 'ie', 'y3'], heart: ['here'],
        words: 'leaf:🍃 tea:🍵 seal:🦭 beach:🏖️ peach:🍑 bean:🫘 pie:🥧 tie:👔 fries:🍟 fly:🪰 sky:🌌 cry:😭 spy:🕵️ eat sea dream dry try',
        story: 'beach' },
      { id: 'L27', g: ['oy', 'ir', 'er'], heart: ['love', 'your'],
        words: 'boy:👦 toy:🧸 oys|ter:🦪 bird:🐦 girl:👧 shirt:👕 skirt:👗 first:🥇 let|ter:✉️ lad|der:🪜 but|ter:🧈 ham|mer:🔨 mon|ster:👾 fern:🌿 en|joy dirt stir',
        story: 'monster' },
      { id: 'L28', g: ['aw', 'ew'], heart: ['water', 'friend'],
        words: 'paw:🐾 saw:🪚 claw:🦞 straw:🥤 prawn:🦐 yawn:🥱 hawk:🦅 draw:✏️ stew:🍲 new:🆕 dew:💧 few jaw lawn crawl',
        story: 'prawn' },
      { id: 'L29', review: true, g: [], heart: [],
        words: 'play:🛝 cloud:☁️ leaf:🍃 seal:🦭 pie:🥧 fly:🪰 boy:👦 bird:🐦 let|ter:✉️ paw:🐾 prawn:🦐 stew:🍲',
        story: 'reef' },
    ],
  },
  {
    id: 'space', name: 'Starry Night Roost', theme: 'roost',
    lessons: [
      { id: 'L30', g: ['a_e'], heart: ['could', 'would'],
        words: 'cake:🎂 cape:🦸 tape:📼 gate:🚧 snake:🐍 plane:✈️ grape:🍇 lake:🏞️ skate:⛸️ game:🎮 made name same shake',
        story: 'cake' },
      { id: 'L31', g: ['i_e'], heart: ['two', 'who'],
        words: 'bike:🚲 kite:🪁 five:5️⃣ nine:9️⃣ slide:🛝 smile:😊 pine:🌲 prize:🏆 lime:🍈 hive:🐝 bite ride hide time like',
        story: 'bike' },
      { id: 'L32', g: ['o_e', 'u_e'], heart: ['many', 'any'],
        words: 'bone:🦴 rope:🪢 home:🏠 cone:🍦 globe:🌍 hole:🕳️ nose:👃 cube:🧊 tube:🧪 mule:🫏 dune:🏜️ cute:🥰 stone note hope tune',
        story: 'bone' },
      { id: 'L33', g: ['wh', 'ph'], heart: ['where'],
        words: 'whale:🐋 wheel:🛞 white:⬜ dol|phin:🐬 el|e|phant:🐘 phone:📱 graph:📈 whisk when which while whip',
        story: 'whale' },
      { id: 'L34', review: true, g: [], heart: [],
        words: 'cake:🎂 snake:🐍 bike:🚲 kite:🪁 bone:🦴 cube:🧊 whale:🐋 phone:📱 home:🏠 smile:😊 plane:✈️ globe:🌍',
        story: 'stars' },
    ],
  },
];

// Sentences for the sentence games, decodable at their lesson. "Text.|picture";
// a leading ! marks a silly sentence (for Silly or Sensible?).
export const SENTENCES = {
  L1: ['Pip sits.|🐾', 'Pip taps a tin.|🥫', '!A tin naps.|🥫😴'],
  L2: ['Sam sat.|👦', 'Dad naps.|👨😴', 'I tap the map.|🗺️', 'Sam and Dad sit.|👨‍👦', '!The map naps.|🗺️😴', '!Dad sits in a tin.|👨🥫'],
  L3: ['The dog digs.|🐶⛏️', 'Sam got a dog.|👦🐶', 'A pig naps.|🐷😴', '!The pot digs.|🍲⛏️', '!A pot naps on the dog.|🍲🐶'],
  L4: ['Dad got a map.|👨🗺️', 'The pig digs.|🐷⛏️', 'An ant sat on a pan.|🐜🍳', '!The ant got a pig.|🐜🐷'],
  L5: ['The cat sat on a mat.|🐱', 'Kim got a sock.|👧🧦', 'A cat can nap.|🐱😴', '!A sock can kick.|🧦🦵', '!The cat can pack.|🐱🎒'],
  L6: ['Ten ducks sat in the mud.|🦆🟫', 'Dad gets a cup.|👨☕', 'The pup sat up.|🐶⬆️', '!The sun sat in a cup.|☀️☕', '!A nut can get up.|🥜'],
  L7: ['A hen sat on a bed.|🐔🛏️', 'Rob got a red hat.|👦🎩', 'The bug ran up the rug.|🐛', '!A bus can hop.|🚌', '!The hen got on the bus.|🐔🚌'],
  L8: ['The frog is on a log.|🐸🪵', 'Ben has a red bell.|👦🔔', 'The doll is in his bag.|🪆👜', '!The hill is in a cup.|⛰️☕', '!A log can huff and puff.|🪵💨'],
  L9: ['His dog is fat.|🐶', 'The bus is big.|🚌', 'The fan is on.|🪭', '!The sun is in his bag.|☀️👜'],
  L10: ['She has a jet.|👩✈️', 'He gets wet.|👦💦', 'The vet has a van.|🩺🚐', '!The van can jog.|🚐🏃', '!A web can win.|🕸️🏆'],
  L11: ['The fox is in a box.|🦊📦', 'We zip the bag.|🤐👜', 'The bug can buzz.|🐛', '!The box can quack.|📦🦆', '!Six yaks sit on me.|🐃'],
  L12: ['The fish was in a dish.|🐟🍽️', 'We got chips at the shop.|🍟🏪', 'She has a shell.|👩🐚', '!The ship was in a cup.|🚢☕', '!A chick can chop.|🐥🔪'],
  L13: ['The king can sing.|🤴🎤', 'You can sing a song.|🎵', 'The moth is thin.|🦋', '!A ring can sing.|💍🎤', '!The bath has a wing.|🛁🪽'],
  L14: ['We had fish and chips.|🐟🍟', 'The king has a ship.|🤴🚢', '!The fox sang to the moth.|🦊🦋'],
  L15: ['They see a snail.|🐌', 'The bee is on the tree.|🐝🌳', 'A train is in the rain.|🚂🌧️', '!The sheep is in the mail.|🐑📬', '!A tree can wait for a train.|🌳🚂'],
  L16: ['My goat has a coat.|🐐🧥', 'The light is on at night.|💡🌃', 'A toad sat on the road.|🐸🛣️', '!My boat is in the soap.|⛵🧼', '!A goat can fight the night.|🐐🌃'],
  L17: ['The car is far.|🚗', 'We are at the zoo.|🦒', 'The moon is up at night.|🌙', '!The shark is in the car.|🦈🚗', '!All the stars are in a jar.|⭐🫙'],
  L18: ['She can surf.|🏄', 'Her horn is red.|📯', 'Turn the fork.|🍴', '!The corn can surf.|🌽🏄', '!The storm is in her fork.|⛈️🍴'],
  L19: ['The cow is in the town.|🐄🏘️', 'An owl sat in the tree.|🦉🌳', 'Boil the oil.|🫕', '!The cow has a crown.|🐄👑', '!The coin can hoot.|🪙🦉'],
  L20: ['The crab is on the sand.|🦀', 'Do you have a drum?|🥁', 'Stop the truck!|🛑🚚', 'We swim in the pond.|🏊', '!The clock can swim.|🕰️🏊', '!A sled can clap.|🛷👏'],
  L21: ['Some milk is in the cup.|🥛', 'Come and jump!|🦘', 'The ant is in the tent.|🐜⛺', '!A lamp can jump.|🪔', '!The skunk has a mask.|🦨🎭'],
  L22: ['One rabbit is in the basket.|🐇🧺', 'The kitten has a magnet.|🐈🧲', 'We were at the picnic.|🧺', '!The rabbit is in the pumpkin.|🐇🎃', '!A helmet can sing.|⛑️🎤'],
  L23: ['There is a puppy.|🐶', 'What a funny teddy!|🧸', 'The bunny is jumping.|🐰', '!The lolly is sleeping.|🍭😴', '!A teddy is fishing.|🧸🎣'],
  L24: ['What is in the basket?|🧺', 'The puppy is swimming in the pond.|🐶🏊', '!The kitten is fishing for a pumpkin.|🐈🎃'],
  L25: ['We play out in the sun.|☀️', 'Shout out loud!|📢', 'The pig has a snout.|🐽', '!The couch can shout.|🛋️📢', '!A cloud is in my mouth.|☁️👄'],
  L26: ['We eat a peach on the beach.|🍑🏖️', 'The seal is in the sea.|🦭', 'Here is my pie.|🥧', 'A fly is in the sky.|🪰', '!The pie can fly.|🥧🪰', '!A seal has a tie.|🦭👔'],
  L27: ['The boy has a toy.|👦🧸', 'The girl has a bird.|👧🐦', 'Her sister has a letter.|✉️', '!The monster is in my shirt.|👾👕', '!A bird can stir the butter.|🐦🧈'],
  L28: ['The cat has a paw.|🐱🐾', 'We saw a hawk.|🦅', 'I have a new hat.|🎩', '!The prawn can yawn and draw.|🦐✏️', '!My friend is a straw.|🥤'],
  L29: ['The boy saw a seal at the beach.|👦🦭', 'My friend has a new toy.|🧸', '!The bird is in the stew.|🐦🍲'],
  L30: ['I made a cake.|🎂', 'The snake is in the lake.|🐍🏞️', 'The plane is late.|✈️', '!The cake can skate.|🎂⛸️', '!A gate can shake a snake.|🚧🐍'],
  L31: ['I like my bike.|🚲', 'Five kites are in the sky.|🪁', 'Smile and ride!|😊🚲', '!The bike can smile.|🚲😊', '!Nine limes ride a kite.|🍈🪁'],
  L32: ['The dog has a bone.|🐶🦴', 'We are at home.|🏠', 'The cube is in the tube.|🧊🧪', '!The mule is in the cone.|🫏🍦', '!A globe has a nose.|🌍👃'],
  L33: ['The whale is in the sea.|🐋', 'The dolphin can swim.|🐬', 'Where is the white wheel?|🛞', '!An elephant is on the phone.|🐘📱', '!The whale has a whisk.|🐋🥄'],
  L34: ['The whale and the dolphin play.|🐋🐬', 'I like the white kite.|🪁', '!The snake rides a bike.|🐍🚲'],
};

// Finish My Sentence: the child picks and spells the last word.
export const FRAMES = [
  { id: 'f_got', t: 'I got the', from: 'L3' },
  { id: 'f_has', t: 'Pip has the', from: 'L8' },
  { id: 'f_see', t: 'She can see the', from: 'L15' },
  { id: 'f_saw', t: 'We saw the', from: 'L28' },
  { id: 'f_like', t: 'I like the', from: 'L31' },
];
// Picture words that can't finish "I got the …" (not things).
export const NOT_THINGS = new Set('sit sip sad mad dig red run hot hug up wet win yes zap see down cry spy happy funny smile shout yawn draw stop clap swim jump nap'.split(' '));
export const NAMES = new Set('pip sam dad mum kim ben rob josh mark jess max kate mike rex tim'.split(' '));

// Decodable stories. Each page: text + picture (emoji scene). q: comprehension question.
export const STORIES = {
  pip: { title: 'Pip!', cover: '🐾', pages: [
    { t: 'Pip sat.', pic: '🪨' },
    { t: 'Pip sips.', pic: '🥤' },
    { t: 'Tip, tip, tip.', pic: '💧💧💧' },
    { t: 'Pip naps.', pic: '😴💤' },
  ], qs: [
    { k: 'lit', text: 'What did Pip do at the end?', opts: ['😴', '🥤', '🏃'], a: 0 },
    { k: 'lit', text: 'What did Pip do first?', opts: ['🧘', '🏃', '💃'], a: 0 },
  ] },
  dadsam: { title: 'Dad and Sam', cover: '🍳', pages: [
    { t: 'Sam and Dad sit.', pic: '👨‍👦🪑' },
    { t: 'Dad taps the pan.', pic: '🍳🥄' },
    { t: 'Sam taps the pan.', pic: '🍳👦' },
    { t: 'Tap, tap, tap!', pic: '🥁🎶' },
    { t: 'I nap, said Dad.', pic: '😴' },
  ], qs: [
    { k: 'lit', text: 'What did Sam and Dad tap?', opts: ['🍳', '🚪', '🥁'], a: 0 },
    { k: 'lit', text: 'Who said, I nap?', opts: ['Dad', 'Sam', 'Pip'], a: 0 },
  ] },
  map: { title: 'The Map', cover: '🗺️', pages: [
    { t: 'Pip and Sam sit.', pic: '🏖️' },
    { t: 'Pip taps the map.', pic: '🗺️' },
    { t: 'Tap, tap, tap!', pic: '👆🗺️' },
    { t: 'An ant!', pic: '🐜❗' },
    { t: 'The ant sits in the pan.', pic: '🐜🍳' },
    { t: 'Sam and Pip nap.', pic: '😴💤' },
  ], qs: [
    { k: 'lit', text: 'What sat in the pan?', opts: ['🐶', '🐜', '🗺️'], a: 1 },
    { k: 'lit', text: 'Who tapped the map?', opts: ['Pip', 'Sam', 'Dad'], a: 0 },
  ] },
  dig: { title: 'Dig, Dog, Dig!', cover: '🐶', pages: [
    { t: 'A dog digs.', pic: '🐶⛏️' },
    { t: 'Dig, dig, dig!', pic: '🟫🟫🟫' },
    { t: 'The dog got a pot.', pic: '🐶🍲' },
    { t: 'A pig! A pig in the pot!', pic: '🐷🍲' },
    { t: 'The pig and the dog nod.', pic: '🐷🤝🐶' },
  ], qs: [
    { k: 'lit', text: 'What was in the pot?', opts: ['🐱', '🐷', '🦆'], a: 1 },
    { k: 'lit', text: 'Who dug?', opts: ['🐶', '🐷', '🐱'], a: 0 },
  ] },
  sock: { title: 'The Sock', cover: '🧦', pages: [
    { t: 'Kim got a sock.', pic: '👧🧦' },
    { t: 'The cat got the sock!', pic: '🐱🧦' },
    { t: 'Kim and the cat spin and spin.', pic: '👧🌀🐱' },
    { t: 'Kick, kick, kick!', pic: '🦵🦵🦵' },
    { t: 'Kim and the cat nap on the cot.', pic: '😴🐱🛏️' },
  ], qs: [
    { k: 'lit', text: 'Who took the sock?', opts: ['🐶', '🐱', '🐷'], a: 1 },
    { k: 'lit', text: 'What did Kim and the cat do on the cot?', opts: ['😴', '🏃', '🍽️'], a: 0 },
  ] },
  duck: { title: 'Up, Duck, Up!', cover: '🦆', pages: [
    { t: 'A duck sat in the sun.', pic: '🦆☀️' },
    { t: 'The duck got up.', pic: '🦆⬆️' },
    { t: 'Up, up, up!', pic: '🦆☁️' },
    { t: 'The duck sits in mud!', pic: '🦆🟫' },
    { t: 'The duck sat in a cup.', pic: '🦆☕' },
  ], qs: [
    { k: 'lit', text: 'Where did the duck sit at the end?', opts: ['☕', '🛏️', '🚌'], a: 0 },
    { k: 'lit', text: 'What was in the sky at the start?', opts: ['☀️', '🌙', '🌈'], a: 0 },
  ] },
  bus: { title: 'The Big Bus', cover: '🚌', pages: [
    { t: 'Rob runs to the bus.', pic: '🏃🚌' },
    { t: 'Go, bus, go!', pic: '🚌💨' },
    { t: 'Bump! The bus hits a rock.', pic: '🚌🪨' },
    { t: 'The hat on Rob pops up.', pic: '🎩⬆️' },
    { t: 'No hat! A hen got it!', pic: '🐔🎩' },
  ], qs: [
    { k: 'lit', text: 'Where did the hat land?', opts: ['🐔', '🚌', '🐶'], a: 0 },
    { k: 'lit', text: 'Who ran to the bus?', opts: ['Rob', 'Ben', 'Pip'], a: 0 },
  ] },
  frog: { title: 'Frog on a Log', cover: '🐸', pages: [
    { t: 'A frog sits on a log.', pic: '🐸🪵' },
    { t: 'The log is on a big hill.', pic: '🪵⛰️' },
    { t: 'Puff, puff! It is a big hill.', pic: '🐸💦⛰️' },
    { t: 'The frog fell off the log!', pic: '🐸💫' },
    { t: 'Plop! The frog is in the mud.', pic: '🐸🟫' },
  ], qs: [
    { k: 'lit', text: 'Where did the frog land?', opts: ['🟫', '🌳', '🚌'], a: 0 },
    { k: 'lit', text: 'What did the frog sit on at the start?', opts: ['🪵', '🚌', '🪨'], a: 0 },
  ] },
  hill: { title: 'Up the Hill', cover: '⛰️', pages: [
    { t: 'Ben and his dog run up the hill.', pic: '👦🐶⛰️' },
    { t: 'The sun is hot.', pic: '☀️🔥' },
    { t: 'Ben gets a cup.', pic: '👦☕' },
    { t: 'The dog licks the cup.', pic: '🐶☕' },
    { t: 'Ben and the dog sit on the hill.', pic: '👦🐶⛰️' },
    { t: 'The end!', pic: '🎉' },
  ], qs: [
    { k: 'lit', text: 'Who licked the cup?', opts: ['👦', '🐶', '🐸'], a: 1 },
    { k: 'lit', text: 'What was hot?', opts: ['☀️', '🧊', '🌧️'], a: 0 },
  ] },
  van: { title: 'The Vet Van', cover: '🚐', pages: [
    { t: 'The vet has a van.', pic: '🩺🚐' },
    { t: 'She gets in the van.', pic: '👩‍⚕️🚐' },
    { t: 'A wet dog is sick.', pic: '🐶💦🤒' },
    { t: 'The vet pets him. He wags and wags!', pic: '👩‍⚕️🐶' },
    { t: 'The dog is well.', pic: '🐶😄' },
  ], qs: [
    { k: 'lit', text: 'Who was sick?', opts: ['🐱', '🐶', '🐷'], a: 1 },
    { k: 'lit', text: 'Who has a van?', opts: ['vet', 'pig', 'cat'], a: 0 },
    { k: 'think', text: 'How did the dog feel at the end?', opts: ['😄', '😢', '😠'], a: 0 },
  ] },
  fox: { title: 'Fox in a Box', cover: '🦊', pages: [
    { t: 'A fox is in a box.', pic: '🦊📦' },
    { t: 'Buzz! A bug zips in.', pic: '🐝💨' },
    { t: 'Yell! The fox jumps up.', pic: '🦊❗' },
    { t: 'Quick, fox, quick!', pic: '🦊💨' },
    { t: 'We will get it, said the fox.', pic: '🦊🐝' },
  ], qs: [
    { k: 'lit', text: 'What zipped into the box?', opts: ['🐝', '🐸', '🦆'], a: 0 },
    { k: 'think', text: 'Why did the fox jump up?', opts: ['🐝', '🌧️', '🐟'], a: 0 },
  ] },
  ship: { title: 'The Fish Ship', cover: '🚢', pages: [
    { t: 'Josh has a ship.', pic: '👦🚢' },
    { t: 'The ship gets fish and fish and fish!', pic: '🚢🐟🐟' },
    { t: 'Josh chops the fish.', pic: '🔪🐟' },
    { t: 'The fish is in a dish.', pic: '🐟🍽️' },
    { t: 'Yum! It was a top dish!', pic: '😋🍽️' },
  ], qs: [
    { k: 'lit', text: 'What did Josh put in the dish?', opts: ['🐟', '🍟', '🥜'], a: 0 },
    { k: 'think', text: 'How did Josh feel at the end?', opts: ['😋', '😢', '😴'], a: 0 },
  ] },
  king: { title: 'The King Sings', cover: '🤴', pages: [
    { t: 'The king has a long song.', pic: '🤴🎵' },
    { t: 'He sings and sings.', pic: '🤴🎤' },
    { t: 'The moth sings with him.', pic: '🦋🎵' },
    { t: 'Then a bell rings. Ding!', pic: '🔔' },
    { t: 'You sing! said the king.', pic: '🤴👉' },
  ], qs: [
    { k: 'lit', text: 'Who sang with the king?', opts: ['🦋', '🐶', '🐟'], a: 0 },
    { k: 'lit', text: 'What rang?', opts: ['🔔', '🥁', '📞'], a: 0 },
    { k: 'think', text: 'How did the moth feel when it sang with the king?', opts: ['😊', '😢', '😠'], a: 0 },
  ] },
  quest: { title: 'The Big Quest', cover: '🗺️', pages: [
    { t: 'Pip has a map and a backpack.', pic: '🗺️🎒' },
    { t: 'Pip gets on a ship.', pic: '🚢' },
    { t: 'Then Pip jogs up a hill.', pic: '⛰️' },
    { t: 'A fox and a king wish Pip luck.', pic: '🦊🤴' },
    { t: 'At the top is a chest.', pic: '🧰' },
    { t: 'It is rich with gems!', pic: '💎💎💎' },
  ], qs: [
    { k: 'lit', text: 'What was in the chest?', opts: ['💎', '🐟', '🧦'], a: 0 },
    { k: 'think', text: 'What did Pip do after the ship?', opts: ['🏃', '😴', '🍳'], a: 0 },
  ] },
  snail: { title: 'Snail in the Rain', cover: '🐌', pages: [
    { t: 'It is raining.', pic: '🌧️' },
    { t: 'A snail sits on a tree.', pic: '🐌🌳' },
    { t: 'They see a bee in the rain.', pic: '🐌🐝🌧️' },
    { t: 'The bee is wet and sad.', pic: '🐝😢' },
    { t: 'Sit with me, said the snail. The bee is snug.', pic: '🐌🐝😊' },
  ], qs: [
    { k: 'lit', text: 'Who did the snail help?', opts: ['🐝', '🐑', '🐌'], a: 0 },
    { k: 'think', text: 'Why was the bee sad?', opts: ['💦', '🌞', '🍯'], a: 0 },
  ] },
  goat: { title: 'The Goat Boat', cover: '🐐', pages: [
    { t: 'A goat has a red boat.', pic: '🐐⛵' },
    { t: 'At night the goat gets in the boat.', pic: '🐐⛵🌃' },
    { t: 'A toad sees a light.', pic: '🐸💡' },
    { t: 'My boat! said the goat.', pic: '🐐⛵' },
    { t: 'The goat and the toad float on the pond.', pic: '🐐🐸🌊' },
  ], qs: [
    { k: 'lit', text: 'Who was in the boat with the goat?', opts: ['🐸', '🐄', '🦉'], a: 0 },
    { k: 'lit', text: 'What colour was the boat?', opts: ['🔴', '🔵', '🟢'], a: 0 },
    { k: 'think', text: 'How did the goat feel at the end?', opts: ['😊', '😢', '😠'], a: 0 },
  ] },
  moon: { title: 'Zoom to the Moon', cover: '🌙', pages: [
    { t: 'Pip and Mark are in a car.', pic: '🚗' },
    { t: 'The car is a star car!', pic: '🚗⭐' },
    { t: 'Zoom! Zoom! It is far.', pic: '💨⭐⭐' },
    { t: 'They are on the moon!', pic: '🌙' },
    { t: 'All the stars wink at them.', pic: '⭐⭐⭐' },
  ], qs: [
    { k: 'lit', text: 'Where did the car go?', opts: ['🌙', '🌳', '🏪'], a: 0 },
    { k: 'think', text: 'How did Pip and Mark get to the moon?', opts: ['🚗', '🚲', '🚌'], a: 0 },
  ] },
  storm: { title: 'The Storm', cover: '⛈️', pages: [
    { t: 'A storm hits the farm.', pic: '⛈️🚜' },
    { t: 'The goat runs to the barn.', pic: '🐐🛖' },
    { t: 'Her hat turns and turns.', pic: '👒💨' },
    { t: 'The corn gets wet.', pic: '🌽💦' },
    { t: 'Then the sun is back!', pic: '☀️😄' },
  ], qs: [
    { k: 'lit', text: 'What came back at the end?', opts: ['☀️', '🌧️', '🌙'], a: 0 },
    { k: 'think', text: 'Why did the goat run to the barn?', opts: ['⛈️', '🍎', '🎂'], a: 0 },
  ] },
  crown: { title: 'The Lost Crown', cover: '👑', pages: [
    { t: 'The king lost his crown.', pic: '🤴❓' },
    { t: 'An owl is up in a tree.', pic: '🦉🌳' },
    { t: 'The cow digs in the soil.', pic: '🐄🟫' },
    { t: 'Hoot! The owl points at a coin.', pic: '🦉🪙' },
    { t: 'The crown is in the town!', pic: '👑🏘️' },
    { t: 'Now the king is glad!', pic: '🤴👑🎉' },
  ], qs: [
    { k: 'lit', text: 'Who pointed at the coin?', opts: ['🦉', '🐄', '🐐'], a: 0 },
    { k: 'lit', text: 'What did the king lose?', opts: ['👑', '🐄', '🌳'], a: 0 },
    { k: 'think', text: 'Why was the king sad at the start?', opts: ['no crown', 'no cat', 'no sun'], a: 0 },
  ] },
  crab: { title: 'Crab and Frog', cover: '🦀', pages: [
    { t: 'Crab sits on the sand.', pic: '🦀🏖️' },
    { t: 'Frog hops up with a drum.', pic: '🐸🥁' },
    { t: 'Do you have a drum? said Frog.', pic: '🐸❓' },
    { t: 'No, but I can clap! said Crab.', pic: '🦀👏' },
    { t: 'Frog drums and Crab claps.', pic: '🐸🥁🦀👏' },
    { t: 'It is a big band!', pic: '🎶🎉' },
  ], qs: [
    { k: 'lit', text: 'What did Crab do?', opts: ['👏', '🥁', '🏊'], a: 0 },
    { k: 'think', text: 'Why did Crab clap?', opts: ['no drum', 'a hot sun', 'a big tent'], a: 0 },
  ] },
  tent: { title: 'The Big Tent', cover: '⛺', pages: [
    { t: 'Come and help! said Mum.', pic: '👩⛺' },
    { t: 'We set up the tent.', pic: '⛺🔨' },
    { t: 'Some milk and a gift are in the tent.', pic: '🥛🎁' },
    { t: 'Jump in! said Mum.', pic: '🦘⛺' },
    { t: 'The tent bends in the wind.', pic: '⛺🌬️' },
    { t: 'We sit and sip milk in the tent.', pic: '🥛😊' },
  ], qs: [
    { k: 'lit', text: 'What was in the tent?', opts: ['🥛', '🐟', '🚌'], a: 0 },
    { k: 'think', text: 'Why did the tent bend?', opts: ['🌬️', '🐄', '🍪'], a: 0 },
  ] },
  rocket: { title: 'Rocket Picnic', cover: '🚀', pages: [
    { t: 'Ben has a rocket.', pic: '👦🚀' },
    { t: 'Ben and his kitten get in the rocket.', pic: '👦🐈🚀' },
    { t: 'Up, up, up! It zigzags past the sun.', pic: '🚀☀️' },
    { t: 'They land on the moon.', pic: '🚀🌙' },
    { t: 'One picnic basket. Yum!', pic: '🧺😋' },
    { t: 'The kitten naps in the basket.', pic: '🐈🧺😴' },
  ], qs: [
    { k: 'lit', text: 'Where did the rocket land?', opts: ['🌙', '🌳', '🏪'], a: 0 },
    { k: 'lit', text: 'Who got in the rocket with Ben?', opts: ['🐈', '🐶', '🐸'], a: 0 },
    { k: 'think', text: 'How did Ben feel about the picnic?', opts: ['😋', '😢', '😠'], a: 0 },
  ] },
  puppy: { title: 'Silly Puppy', cover: '🐶', pages: [
    { t: 'There is a puppy in the mud.', pic: '🐶🟫' },
    { t: 'The puppy is muddy!', pic: '🐶💩' },
    { t: 'What a silly puppy!', pic: '🐶🤪' },
    { t: 'The puppy is jumping and running.', pic: '🐶🏃' },
    { t: 'Then the puppy is sleeping on my teddy.', pic: '🐶🧸😴' },
    { t: 'Funny puppy!', pic: '🐶😄' },
  ], qs: [
    { k: 'lit', text: 'Where did the puppy sleep?', opts: ['🧸', '🛁', '🚗'], a: 0 },
    { k: 'think', text: 'Why was the puppy muddy?', opts: ['🟫', '🛁', '🍦'], a: 0 },
  ] },
  windy: { title: 'Windy Hill', cover: '🌬️', pages: [
    { t: 'It is windy on the hill.', pic: '🌬️⛰️' },
    { t: 'Jess has a red flag.', pic: '👧🚩' },
    { t: 'The wind tugs the flag.', pic: '🚩💨' },
    { t: 'Up, up! The flag and Jess lift up!', pic: '👧🚩☁️' },
    { t: 'Jess lands in a big nest.', pic: '👧🪺' },
    { t: 'What a trip!', pic: '😄' },
  ], qs: [
    { k: 'lit', text: 'What did Jess hold?', opts: ['🚩', '🪁', '🎈'], a: 0 },
    { k: 'think', text: 'Why did Jess lift up?', opts: ['🌬️', '🐘', '🍎'], a: 0 },
  ] },
  cloud: { title: 'Play in the Clouds', cover: '☁️', pages: [
    { t: 'Max and Pip play out on a cloud.', pic: '👦☁️' },
    { t: 'They jump up and down.', pic: '⬆️⬇️' },
    { t: 'They shout out loud.', pic: '📢' },
    { t: 'A little cloud floats past.', pic: '☁️💨' },
    { t: 'Stay and play with us! said Max.', pic: '👦☁️' },
    { t: 'The little cloud stays all day.', pic: '☁️😊' },
  ], qs: [
    { k: 'lit', text: 'Who came to play?', opts: ['☁️', '🐶', '🦆'], a: 0 },
    { k: 'lit', text: 'Who played with Pip?', opts: ['Max', 'Ben', 'Rob'], a: 0 },
    { k: 'think', text: 'How did the little cloud feel?', opts: ['😊', '😢', '😠'], a: 0 },
  ] },
  beach: { title: 'At the Beach', cover: '🏖️', pages: [
    { t: 'We go to the beach.', pic: '🏖️' },
    { t: 'A seal sits in the sea.', pic: '🦭🌊' },
    { t: 'We eat peach pie.', pic: '🍑🥧' },
    { t: 'A fly lands on my pie!', pic: '🪰🥧' },
    { t: 'Fly, fly, fly up in the sky!', pic: '🪰🌤️' },
    { t: 'Here is a treat for the seal.', pic: '🐟🦭' },
  ], qs: [
    { k: 'lit', text: 'What landed on the pie?', opts: ['🪰', '🐦', '🦭'], a: 0 },
    { k: 'lit', text: 'What did they eat?', opts: ['🥧', '🍕', '🍦'], a: 0 },
    { k: 'think', text: 'How did the seal feel when it got a treat?', opts: ['😊', '😢', '😠'], a: 0 },
  ] },
  monster: { title: 'The Toy Monster', cover: '👾', pages: [
    { t: 'The boy has a toy monster.', pic: '👦👾' },
    { t: 'The monster has a red shirt.', pic: '👾👕' },
    { t: 'His sister has a bird.', pic: '👧🐦' },
    { t: 'The bird sits on the monster!', pic: '🐦👾' },
    { t: 'Her bird loves the toy.', pic: '🐦💖' },
    { t: 'Now the boy and the girl enjoy the toy.', pic: '👦👧😊' },
  ], qs: [
    { k: 'lit', text: 'Who sat on the monster?', opts: ['🐦', '👦', '🦪'], a: 0 },
    { k: 'think', text: 'How did the bird feel about the toy?', opts: ['😍', '😠', '😢'], a: 0 },
  ] },
  prawn: { title: 'Hawk and Prawn', cover: '🦐', pages: [
    { t: 'A hawk saw a prawn.', pic: '🦅🦐' },
    { t: 'The prawn is in the water.', pic: '🦐🌊' },
    { t: 'The hawk swoops down.', pic: '🦅⬇️' },
    { t: 'The prawn hid in the weed.', pic: '🦐🌿' },
    { t: 'The hawk did not get it.', pic: '🦅❌' },
    { t: 'The prawn has a new friend, a crab.', pic: '🦐🦀' },
  ], qs: [
    { k: 'lit', text: 'Where did the prawn hide?', opts: ['🌿', '🏠', '🚗'], a: 0 },
    { k: 'think', text: 'Why did the hawk not get the prawn?', opts: ['it hid', 'it flew', 'it sang'], a: 0 },
  ] },
  reef: { title: 'Under the Sea', cover: '🐠', pages: [
    { t: 'Pip and a fish swim to the reef.', pic: '🐠🪸' },
    { t: 'They see a seal and a prawn.', pic: '🦭🦐' },
    { t: 'The seal has a toy.', pic: '🦭🧸' },
    { t: 'Splash! Pip and the seal play.', pic: '💦🦭' },
    { t: 'Clouds float up high.', pic: '☁️☁️' },
    { t: 'What a day!', pic: '🌞😄' },
  ], qs: [
    { k: 'lit', text: 'What did the seal have?', opts: ['🧸', '🍕', '🎈'], a: 0 },
    { k: 'think', text: 'How did Pip feel at the reef?', opts: ['😄', '😢', '😠'], a: 0 },
  ] },
  cake: { title: 'The Big Cake', cover: '🎂', pages: [
    { t: 'Kate made a cake.', pic: '👧🎂' },
    { t: 'It was a big cake on a plate.', pic: '🎂🍽️' },
    { t: 'A snake came to the gate.', pic: '🐍🚧' },
    { t: 'Can I have some cake? said the snake.', pic: '🐍❓' },
    { t: 'Kate gave the snake a cake.', pic: '👧🎂🐍' },
    { t: 'The snake ate it all!', pic: '🐍😋' },
  ], qs: [
    { k: 'lit', text: 'Who ate the cake?', opts: ['🐍', '👧', '🐶'], a: 0 },
    { k: 'lit', text: 'Who made the cake?', opts: ['Kate', 'Rex', 'Sam'], a: 0 },
    { k: 'think', text: 'How did the snake feel at the end?', opts: ['😋', '😢', '😠'], a: 0 },
  ] },
  bike: { title: 'Mike Rides', cover: '🚲', pages: [
    { t: 'Mike has a red bike.', pic: '👦🚲' },
    { t: 'He rides it five times.', pic: '🚲5️⃣' },
    { t: 'He rides past a pine tree.', pic: '🚲🌲' },
    { t: 'He can see a kite in the sky.', pic: '🪁' },
    { t: 'Mike smiles.', pic: '😊' },
    { t: 'I like my bike! said Mike.', pic: '👦🚲💖' },
  ], qs: [
    { k: 'lit', text: 'What did Mike see in the sky?', opts: ['🪁', '🚲', '🌲'], a: 0 },
    { k: 'lit', text: 'What colour was the bike?', opts: ['🔴', '🔵', '🟢'], a: 0 },
    { k: 'think', text: 'How did Mike feel about his bike?', opts: ['😍', '😢', '😠'], a: 0 },
  ] },
  bone: { title: 'The Lost Bone', cover: '🦴', pages: [
    { t: 'Rex had a bone.', pic: '🐶🦴' },
    { t: 'He hid it in a hole.', pic: '🐶🕳️' },
    { t: 'Rex went home.', pic: '🐶🏠' },
    { t: 'Then Rex dug and dug. No bone!', pic: '🐶😢' },
    { t: 'A mule saw a bone by a stone.', pic: '🫏🦴🪨' },
    { t: 'Here it is! said the mule.', pic: '🫏🐶🦴' },
  ], qs: [
    { k: 'lit', text: 'Where was the bone?', opts: ['🪨', '🏠', '🍦'], a: 0 },
    { k: 'lit', text: 'Where did Rex hide the bone?', opts: ['🕳️', '🌳', '🏠'], a: 0 },
    { k: 'think', text: 'Why did Rex dig and dig?', opts: ['🦴', '🍦', '🐟'], a: 0 },
  ] },
  whale: { title: 'Whale and Elephant', cover: '🐋', pages: [
    { t: 'A whale and a dolphin play in the sea.', pic: '🐋🐬' },
    { t: 'An elephant comes to the beach.', pic: '🐘🏖️' },
    { t: 'She has a phone.', pic: '🐘📱' },
    { t: 'Splash! The whale sprays her.', pic: '🐋💦🐘' },
    { t: 'Now the elephant is wet!', pic: '🐘💦' },
    { t: 'They all smile.', pic: '🐋🐘🐬😊' },
  ], qs: [
    { k: 'lit', text: 'Who got wet?', opts: ['🐘', '🐋', '🐬'], a: 0 },
    { k: 'think', text: 'Why did the elephant get wet?', opts: ['🐋', '🐬', '🌧️'], a: 0 },
  ] },
  stars: { title: 'Pip and the Stars', cover: '🌟', pages: [
    { t: 'Pip gets in a rocket.', pic: '🚀' },
    { t: 'Zoom! Up and up, past the moon.', pic: '🚀🌙' },
    { t: 'Pip lands on a white star.', pic: '⭐' },
    { t: 'A cute mule waves at Pip.', pic: '🫏👋' },
    { t: 'They eat cake and play games.', pic: '🎂🎮' },
    { t: 'Time to go home! said Pip.', pic: '🏠🌟' },
  ], qs: [
    { k: 'lit', text: 'Who waved at Pip?', opts: ['🫏', '🐋', '🐍'], a: 0 },
    { k: 'think', text: 'Where will Pip go next?', opts: ['🏠', '🌙', '🚌'], a: 0 },
  ] },
};

// Big books for children who have finished every world. They use only sounds and heart words
// taught by the end of World 7, and are opened one at a time (each after the one before it is read).
// tools/build_content.mjs checks them exactly like the lesson stories.
export const BOOKS = {
  hiccup: { title: 'The Hiccup Frog', cover: '🐸', pages: [
    { t: 'Frog sat on a log.', pic: '🐸🪵' },
    { t: 'Frog has the hiccups. Hiccup! Hiccup!', pic: '🐸😳' },
    { t: 'Duck said, Take a big sip! Glug, glug, glug! Hiccup!', pic: '🦆🥤' },
    { t: 'Pig hid in a box. Boo! said Pig. Hiccup!', pic: '🐷📦' },
    { t: 'Hen said, Jump and spin! Frog did a jump and a spin. Hiccup!', pic: '🐔🌀' },
    { t: 'Then Rat sat in a pan and sang a silly song.', pic: '🐀🍳🎵' },
    { t: 'Frog saw Rat in the pan. Ha, ha, ha!', pic: '🐸😂' },
    { t: 'No hiccups! They went away!', pic: '🐸🎉' },
    { t: 'Thank you, silly Rat! said Frog.', pic: '🐀💖' },
  ], qs: [
    { k: 'lit', text: 'What did Frog have?', opts: ['hiccups', 'a hat', 'a bug'], a: 0 },
    { k: 'lit', text: 'Who sat in a pan?', opts: ['🐀', '🐷', '🦆'], a: 0 },
    { k: 'think', text: 'Why did the hiccups go away?', opts: ['😂', '😴', '😢'], a: 0 },
  ] },
  mudbath: { title: 'Max and the Mud', cover: '🐶', pages: [
    { t: 'Max is a dog. Max likes mud.', pic: '🐶🟫' },
    { t: 'Max digs in the mud. Dig, dig, dig!', pic: '🐶⛏️' },
    { t: 'Max sits in the mud. Splish, splash!', pic: '🐶💦' },
    { t: 'Mum sees Max. Yuck! You are a mud dog! said Mum.', pic: '👩😲' },
    { t: 'Max has a bath. Max is not glad.', pic: '🛁🐶' },
    { t: 'Max jumps out. Drip, drip, drip!', pic: '🐶💧' },
    { t: 'Max shakes and shakes. Splash! Mum is wet!', pic: '🐶💦👩' },
    { t: 'Mum and Max are clean. Mum and Max grin.', pic: '👩🐶😊' },
    { t: 'Then Max sees the mud. Max runs to the mud. Dig, dig, dig!', pic: '🐶🟫' },
  ], qs: [
    { k: 'lit', text: 'What did Max like?', opts: ['🟫', '🛁', '🍖'], a: 0 },
    { k: 'lit', text: 'Who got wet when Max shook?', opts: ['Mum', 'Dad', 'Pip'], a: 0 },
    { k: 'think', text: 'What will Max do next?', opts: ['🟫', '🛁', '🛌'], a: 0 },
  ] },
  snailrace: { title: 'Rabbit and Snail', cover: '🐌', pages: [
    { t: 'Rabbit is fast. Snail is not.', pic: '🐇🐌' },
    { t: 'Run up the hill to the tree! said Rabbit. I can win!', pic: '⛰️🌳' },
    { t: 'Get set, go! Zoom! Rabbit runs and runs.', pic: '🐇💨' },
    { t: 'Snail went up, up, up. Rabbit is far, far up.', pic: '🐌⬆️' },
    { t: 'Rabbit sat down in the sun. I can nap, said Rabbit.', pic: '🐇☀️😴' },
    { t: 'Rabbit naps and naps. Snail did not stop.', pic: '🐇💤🐌' },
    { t: 'Rabbit woke up. Where is Snail?', pic: '🐇❓' },
    { t: 'Snail sat at the top, by the tree. Snail got there first!', pic: '🐌🌳🏆' },
    { t: 'You win, Snail! said Rabbit. Rabbit felt sad, but Rabbit had a big grin.', pic: '🐇🐌😊' },
  ], qs: [
    { k: 'lit', text: 'Who won?', opts: ['🐌', '🐇', '🐢'], a: 0 },
    { k: 'lit', text: 'What did Rabbit do in the sun?', opts: ['😴', '🏃', '🍽️'], a: 0 },
    { k: 'think', text: 'Why did Snail win?', opts: ['Rabbit had a nap', 'Snail ran fast', 'Rabbit got a pie'], a: 0 },
  ] },
  wishfish: { title: 'The Wish Fish', cover: '🐠', pages: [
    { t: 'Pip got a fish on a rod.', pic: '🎣🐟' },
    { t: 'Let me go! said the fish. I will make a wish for you.', pic: '🐟✨' },
    { t: 'I wish for a hat, said Pip. Swish! A big, big hat!', pic: '🎩' },
    { t: 'The hat sat on Pip. Pip is in the hat!', pic: '🎩🐾' },
    { t: 'I wish for a bike, said Pip. Swish! It is a little bike.', pic: '🚲' },
    { t: 'I wish for a cake, said Pip. Swish! Splat! A big cake fell on Pip!', pic: '🎂💥' },
    { t: 'Pip is a mess. Yum, said Pip!', pic: '😋🎂' },
    { t: 'I wish you could go back in the sea, said Pip. Swish! The fish went back to the sea.', pic: '🐟🌊' },
    { t: 'Pip sat on the jetty with a hat, a bike and a big cake. What a day!', pic: '🎩🚲🎂' },
  ], qs: [
    { k: 'lit', text: 'What fell on Pip?', opts: ['🎂', '🎩', '🚲'], a: 0 },
    { k: 'lit', text: 'Who said, Let me go?', opts: ['fish', 'pig', 'dog'], a: 0 },
    { k: 'think', text: 'How did Pip feel at the end?', opts: ['😄', '😢', '😠'], a: 0 },
  ] },
  bigbox: { title: 'Sam and the Big Box', cover: '📦', pages: [
    { t: 'Dad got Sam a gift. It was in a big box.', pic: '🎁📦' },
    { t: 'Sam got the gift out. It is a little car.', pic: '🚗' },
    { t: 'Sam sees the box. What can the box be?', pic: '📦❓' },
    { t: 'Sam sat in the box. It is a boat! Splash, splash!', pic: '📦⛵' },
    { t: 'Then the box is a rocket. Three, two, one, zoom!', pic: '📦🚀' },
    { t: 'Then the box is a car. Beep, beep! Sam can drive.', pic: '📦🚗' },
    { t: 'Then the box is a home for the cat. The cat naps in the box.', pic: '🐱📦' },
    { t: 'Do you like the car? said Dad. Yes, said Sam, but I like the box best!', pic: '👨👦📦' },
  ], qs: [
    { k: 'lit', text: 'What did Dad get for Sam?', opts: ['🎁', '🚲', '🍰'], a: 0 },
    { k: 'lit', text: 'Who naps in the box?', opts: ['🐱', '🐶', '🐷'], a: 0 },
    { k: 'think', text: 'Why did Sam like the box best?', opts: ['⛵🚀🚗', '🍰🍪', '🐟🐠'], a: 0 },
  ] },
  nightlight: { title: 'A Light in the Night', cover: '🌃', pages: [
    { t: 'It is night. Pip is in bed, but Pip can not sleep.', pic: '🌃🛏️' },
    { t: 'Tap, tap, tap! What is it? said Pip.', pic: '❓' },
    { t: 'Pip got up. A light! A light in the dark!', pic: '💡' },
    { t: 'Pip went out in the dark. The light went up and down.', pic: '🌃💡' },
    { t: 'It is a little bug with a light on its tail.', pic: '🐛💡' },
    { t: 'Help me, said the bug. I am lost.', pic: '🐛😢' },
    { t: 'Come in, said Pip. Sit on my bed.', pic: '🛏️🐛' },
    { t: 'The bug sat by Pip. Its light is like a little star.', pic: '⭐🐛' },
    { t: 'Pip and the bug went to sleep. Night, night!', pic: '😴🐛' },
  ], qs: [
    { k: 'lit', text: 'Who was lost?', opts: ['🐛', '🐶', '🐷'], a: 0 },
    { k: 'lit', text: 'What did the bug have on its tail?', opts: ['💡', '🔑', '🎈'], a: 0 },
    { k: 'think', text: 'How did the bug feel at the start?', opts: ['😢', '😄', '😴'], a: 0 },
  ] },
  tooth: { title: 'Tim and the Wobbly Tooth', cover: '🦷', pages: [
    { t: 'Tim has a wobbly tooth.', pic: '🦷' },
    { t: 'Tim felt the tooth with his hand. It is up and down.', pic: '🦷↕️' },
    { t: 'I can get it out, said Dad. No, Dad! said Tim.', pic: '👨🙅' },
    { t: 'Mum said, Eat some toast. Tim bit the toast. Crunch!', pic: '🍞😬' },
    { t: 'The tooth is not out. It is still a wobbly tooth.', pic: '🦷❓' },
    { t: 'In the night, Tim had a big yawn. Pop! Out came the tooth!', pic: '🌙🥱🦷' },
    { t: 'Tim sat the tooth in a cup by his bed.', pic: '🦷☕🛏️' },
    { t: 'In the morning, a coin sat in the cup!', pic: '🪙☕' },
    { t: 'Tim has a gap. Tim grins and grins.', pic: '😁' },
  ], qs: [
    { k: 'lit', text: 'What was wobbly?', opts: ['🦷', '🧦', '🐟'], a: 0 },
    { k: 'lit', text: 'What did Tim get in the cup?', opts: ['🪙', '🦷', '🍞'], a: 0 },
    { k: 'think', text: 'How did Tim feel at the end?', opts: ['😁', '😢', '😠'], a: 0 },
  ] },
  whalesong: { title: 'Big Whale, Big Song', cover: '🐋', pages: [
    { t: 'Whale had a big, big song to sing.', pic: '🐋🎵' },
    { t: 'Whale had a big, big gulp.', pic: '🐋🌊' },
    { t: 'Whale sang. Burp! Out came a big, big burp.', pic: '🐋💨' },
    { t: 'The fish had a fright and shot up in the sky.', pic: '🐟😱☁️' },
    { t: 'Oops! said Whale. Let me sing the song.', pic: '🐋🙈' },
    { t: 'Whale had a gulp. Whale sang. Burp! Burp! Burp!', pic: '🐋💨💨' },
    { t: 'Dolphin said, Do not gulp. Sing with a big smile.', pic: '🐬😊' },
    { t: 'Whale sang a long, sweet song. All the fish sat still.', pic: '🐋🎶🐟' },
    { t: 'Then Whale had a little burp. Ha, ha, ha! said all the fish.', pic: '🐟😂' },
  ], qs: [
    { k: 'lit', text: 'What came out when Whale sang?', opts: ['burp', 'hat', 'cat'], a: 0 },
    { k: 'lit', text: 'Who said, Sing with a big smile?', opts: ['🐬', '🐟', '🐙'], a: 0 },
    { k: 'think', text: 'Why did the fish sit still at the end?', opts: ['🎶', '🌧️', '🐙'], a: 0 },
  ] },
};
export const storyOf = id => STORIES[id] || BOOKS[id];
// Audio id of question i of a story or book (the first keeps the id it always had).
export const qid = (id, i) => i ? `q_${id}_${i}` : `q_${id}`;

// Wordlings: one hatches per lesson. Names are decodable by the time they hatch.
export const WORDLINGS = {
  L1: 'Tap', L2: 'Dimp', L3: 'Tog', L4: 'Nip',
  L5: 'Kit', L6: 'Pud', L7: 'Bun', L8: 'Fluff', L9: 'Biff',
  L10: 'Jiv', L11: 'Zib', L12: 'Shog', L13: 'Thing', L14: 'Chomp',
  L15: 'Sheen', L16: 'Bright', L17: 'Zoom', L18: 'Burp', L19: 'Boing',
  L20: 'Frizz', L21: 'Stomp', L22: 'Zigzag', L23: 'Giggly', L24: 'Blimp',
  L25: 'Sprout', L26: 'Peachy', L27: 'Twirl', L28: 'Squawk', L29: 'Shelly',
  L30: 'Blaze', L31: 'Spike', L32: 'Zoomer', L33: 'Whizz', L34: 'Starlight',
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
  intro_stretchy: 'It’s a stretchy sound. Make it long!',
  intro_bouncy: 'It’s a bouncy sound. Keep it short!',
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
  world_done: 'World complete! Bonus game!',
  rest: 'Super reading today! Pip is getting sleepy. Let’s play again tomorrow!',
  arcade_go: 'Ready, set, go!',
  arcade_done: 'Time’s up! Great playing!',
  zoo: 'Tap a Wordling to say hello!',
  shop: 'Pick something for Pip to wear!',
  library: 'Pick a book to read again!',
  speed_go: 'Read the word, then tap its picture. Quick!',
  intro_split: 'This is a split vowel. The e jumps back over a letter and helps the vowel say its name!',
  intro_y: 'At the end of a word, y can make this sound.',
  intro_another: 'Here is another way to write this sound!',
  build_go: 'Put the words in order to make the sentence.',
  build_done: 'You built a sentence!',
  silly_q: 'Read it. Is it silly, or does it make sense?',
  silly_yes: 'That one was silly!',
  silly_no: 'That one makes sense!',
  fix_go: 'Pip wrote a sentence, but it has a mistake. Tap the mistake to fix it!',
  fix_capital: 'A sentence starts with a capital letter.',
  fix_stop: 'A sentence ends with a full stop.',
  fix_more: 'There is one more mistake!',
  dict_listen: 'Listen to the sentence. Then write it!',
  dict_find: 'Find the word',
  dict_first: 'The first word needs a capital letter.',
  dict_end: 'What goes at the end?',
  dict_read: 'You wrote a sentence! Listen.',
  finish_go: 'Finish the sentence! Pick a picture.',
  finish_read: 'Listen to your sentence!',
  memory_go: 'Find the pairs! Match each word to its picture.',
  ladder_go: 'Change one sound to make',
  ladder_pick: 'Which sound do we need?',
  sort_go: 'Which spelling is in this word?',
  chop_go: 'Long words have parts. Tap where to chop the word!',
  chop_read: 'Now read the parts, then the whole word!',
  trace_go: 'Now trace it with your finger. Start at the dot!',
  trace_again: 'Have another go. Start at the dot!',
  trace_watch: 'Watch me. I will show you!',
  trace_next: 'Now the next letter!',
  the_end: 'You finished every world in Wordwild! You are a super reader! Now you can do daily practice, and read the big books!',
  practice_go: 'Daily practice! Let’s read and play!',
  practice_done: 'Great practice! Here is your reward!',
  end_next: 'Tap the star for daily practice. Tap the books to read a big book!',
  book_locked: 'Read the book before this one to open it!',
  bigbooks: 'Big books! Pick one to read.',
  who: 'Who’s playing? Ask a grown-up to type your name.',
  pin_new: 'Make a secret code. Pick four numbers you will remember.',
  pin_again: 'Type it one more time.',
  pin_enter: 'Type your secret code.',
  pin_wrong: 'That’s not the right code. Try again!',
  pin_mismatch: 'Those didn’t match. Let’s pick them again.',
  welcome_back: 'Welcome back!',
  praise1: 'Brilliant!', praise2: 'You got it!', praise3: 'Awesome!', praise4: 'Yes!',
  praise5: 'Amazing!', praise6: 'Super reading!', praise7: 'Nice one!', praise8: 'That’s it!',
  praise9: 'Wow!', praise10: 'Fantastic!', praise11: 'Great blending!', praise12: 'You’re a star!',
  oops1: 'Oops! Try again.', oops2: 'Almost! Have another go.', oops3: 'Hmm, listen again.',
  oops4: 'Not quite. Try again!',
};

// The bonus game after each world (milestone.js): world 1 Chick Run, 2 Feed the Chicks, 3 Hide and Seek, and round again.
export const BONUS_KINDS = ['run', 'feed', 'hide', 'run', 'feed', 'hide', 'run'];
export const BONUS_INFO = {
  run: { icon: '🐥', title: 'Chick Run' },
  feed: { icon: '🌽', title: 'Feed the Chicks' },
  hide: { icon: '🏚️', title: 'Hide and Seek' },
};

// Lines for the bonus games (milestone.js); ids are used as they are (ms_*), voiced by the narrator.
export const MS_LINES = {
  ms_find: 'Find',
  ms_run_go: 'Run, little chick! Peck the corn!',
  ms_feed_go: 'The chicks are hungry! Feed them the right picture!',
  ms_hide_go: 'The chicks are hiding! Can you find them?',
  ms_found_all: 'You found them all! Dance party!',
  ms_surprise: 'Ha ha! A surprise!',
  ms_done: 'Great job, everyone!',
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
  ra_go: 'Read it to me! Tap the microphone.',
  ra_you: 'Listen to you!',
  ra_me: 'Now it’s my turn!',
};

// How the sound is said: held ("mmm") or short and crisp ("t"), never with an added "uh".
export const STRETCHY = new Set(['s', 'ss', 'f', 'ff', 'sh', 'th', 'z', 'zz', 'v', 'm', 'n', 'l', 'll', 'r', 'ng']);
export const BOUNCY = new Set(['p', 't', 'k', 'c', 'ck', 'b', 'd', 'g', 'ch', 'j', 'h', 'x', 'qu']);

export const PRAISE = Array.from({ length: 12 }, (_, i) => 'praise' + (i + 1));
export const OOPS = ['oops1', 'oops2', 'oops3', 'oops4'];

// Helpers shared by the app and the tools.
// Plain spellings for longest-match; split vowels and end-of-word y are found by rule.
const ALL_G = Object.keys(GRAPHEMES).filter(g => !isSplit(g) && !/\d/.test(g)).sort((a, b) => b.length - a.length);

// How a grapheme is shown on its own (a crystal, a bubble) and inside a word (a tile).
export const label = g => g === SILENT_E ? 'e' : isSplit(g) ? g[0] + '‑e' : g.replace(/\d$/, '');
export const tileText = g => g === SILENT_E ? 'e' : isSplit(g) ? g[0] : g.replace(/\d$/, '');
export const spell = seg => seg.map(tileText).join('');

// "word", "word:emoji", "syl|la|bles:emoji".
export function parseWords(str) {
  return str.trim().split(/\s+/).map(tok => {
    const [raw, e] = tok.split(':');
    const syl = raw.split('|');
    return { w: syl.join(''), e: e || null, syl: syl.length > 1 ? syl : null };
  });
}

export function parseSentences(id) {
  return (SENTENCES[id] || []).map((s, k) => {
    const silly = s.startsWith('!');
    const [t, pic] = s.replace(/^!/, '').split('|');
    return { id: `x_${id}_${k}`, t, pic, silly, lesson: id };
  });
}
export const sentenceWords = t => t.replace(/[.?!,]/g, '').split(' ');

// Longest-match segmentation into graphemes, restricted to `allowed` if given.
// Split vowels (cake = c a_e k _e) and a final y (happy = …y2, fly = …y3) are found
// first; until they are taught such words are not decodable.
export function segment(word, allowed) {
  const w = word.toLowerCase();
  const ok = g => !allowed || allowed.has(g);
  const m = w.match(/^(.*[^aeiou]|)([aeiou])(ch|sh|th|[bcdfgklmnprstvz])e$/);
  if (m && GRAPHEMES[m[2] + '_e']) {
    if (!ok(m[2] + '_e')) return null;
    const head = segment(m[1], allowed), mid = segment(m[3], allowed);
    return head && mid ? [...head, m[2] + '_e', ...mid, SILENT_E] : null;
  }
  if (w.length > 1 && w.endsWith('y') && !/[aeiouy]/.test(w[w.length - 2])) {
    const tok = /[aeiou]/.test(w.slice(0, -1)) ? 'y2' : 'y3';
    if (!ok(tok)) return null;
    const head = segment(w.slice(0, -1), allowed);
    return head ? [...head, tok] : null;
  }
  const out = [];
  let i = 0;
  while (i < w.length) {
    const g = ALL_G.find(g => w.startsWith(g, i) && ok(g));
    if (!g) return null;
    out.push(g);
    i += g.length;
  }
  return out;
}

// Graphemes in a segmented word, split into its syllables (by letter count).
export function splitSyllables(seg, syl) {
  const parts = [];
  let k = 0;
  for (const s of syl) {
    const part = [];
    let n = 0;
    while (n < s.length && k < seg.length) { n += tileText(seg[k]).length; part.push(seg[k++]); }
    if (n !== s.length) return null;
    parts.push(part);
  }
  return k === seg.length ? parts : null;
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
