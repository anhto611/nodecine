/**
 * A diorama: a scene drawn in code, the way a shadow-puppet play or a paper cut tells a story — a sky,
 * hills in layers, water or fields, buildings, people and boats cut as dark silhouettes, all moving a
 * little. It is for the moment no picture shows: a battle, a journey, a scene from the chronicles.
 *
 * The storyboard writer only fills values, so the drawing happens in the page, from keywords: `setting`,
 * `time`, `cast`, `props` and `action` (Vietnamese first, English accepted, accents optional). The same
 * values always draw the same picture: everything random is seeded from the values' own text, and every
 * motion is a plain tween on the paused timeline — a setter tween where a path is computed — so a seek
 * with events suppressed lands on the same frame as a play.
 *
 * The runtime below is browser JavaScript in ES5, written as a real function so a syntax slip fails the
 * build rather than a render, and inlined into the page with `Function.prototype.toString`. It draws one
 * SVG whose height is 1080 units and whose width follows the box, so the part fills a 16:9 frame or a
 * 9:16 one. Positioned things sit in an outer `<g transform>` and move by an inner `<g>`: GSAP's x/y on
 * a `<g>` that carries a transform attribute replaces its translate.
 *
 * Regions. `region` says whose world the scene is — our side's people and the setting's buildings,
 * trees and hills — and `foeRegion` the other side's when it differs: East Asia (the default, the
 * prototype's look), medieval Europe and Byzantium, the Ottoman Middle East, and ancient Rome. Each
 * region cuts its own hats, weapons, banners, buildings and ships from the same paper, so a film that
 * mixes two of them still looks like one film.
 *
 * Layers. The same runtime draws the whole diorama or one layer of it: `backdrop` (sky, terrain, water,
 * the setting's buildings), `props` (ships, buildings, stakes, cannons, elephants), `cast` (the people)
 * and `fx` (arrows, smoke, fire, the tide's foam, rain and mist). A layer reads only its own values and
 * seeds its own random stream from them, and every layer takes the same palette from `time`, so the
 * four mounted over one another in one box line up and match. The diorama is the four in one SVG.
 */

function dioramaScene(host, v, cfg) {
  if (!host || !host.querySelector) return null;
  cfg = cfg || {};
  var LAY = cfg.layers || { back: 1, props: 1, cast: 1, fx: 1 };
  var KEYS = cfg.keys || null;
  var cam = host.querySelector('.' + (cfg.cam || 'dio-cam')) || host;
  var H = 1080;
  var bw = host.clientWidth;
  var bh = host.clientHeight;
  var W = bw > 0 && bh > 0 ? Math.round((H * bw) / bh) : 1920;
  W = Math.max(600, Math.min(2600, W));
  var KS = Math.max(0.48, Math.min(1, Math.pow(W / 1920, 0.7)));
  var DEF = cfg.defaults || {};
  /* A layer reads only the values it declares; anything else is the neutral default. */
  var val = function (k) {
    var mine = !KEYS || KEYS.indexOf(k) >= 0;
    return mine && v && v[k] != null ? String(v[k]).trim() : String(DEF[k] == null ? '' : DEF[k]);
  };
  var SET = val('setting');
  var TIME = val('time');
  var CAST = val('cast');
  var PROPS = val('props');
  var ACT = val('action');
  var REG = val('region');
  var FREG = val('foeRegion');

  /* ---------- words ---------- */
  function low(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return s.normalize ? s.normalize('NFC') : s;
  }
  function bare(s) {
    s = low(s);
    if (s.normalize) s = s.normalize('NFD');
    return s.replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  }
  function pad(s) {
    return (
      ' ' +
      s
        .replace(/[^0-9a-zÀ-ɏḀ-ỿ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() +
      ' '
    );
  }
  /** Whether the text holds one of the words: a word written bare matches with or without accents, a word with accents or a leading "=" matches exactly. */
  function has(text, words) {
    var L = pad(low(text));
    var B = pad(bare(text));
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var exact = w.charAt(0) === '=';
      if (exact) w = w.slice(1);
      if (exact || w !== bare(w)) {
        if (L.indexOf(' ' + w + ' ') >= 0) return true;
      } else if (B.indexOf(' ' + w + ' ') >= 0) return true;
    }
    return false;
  }
  function list(s) {
    var parts = String(s || '').split(/[,;\n|]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) if (parts[i].trim()) out.push(parts[i].trim());
    return out;
  }
  var NUMS = {
    một: 1,
    mot: 1,
    hai: 2,
    ba: 3,
    bốn: 4,
    bon: 4,
    tư: 4,
    năm: 5,
    sáu: 6,
    sau: 6,
    bảy: 7,
    bay: 7,
    tám: 8,
    tam: 8,
    chín: 9,
    chin: 9,
    mười: 10,
    muoi: 10,
    vài: 3,
    vai: 3,
    nhiều: 6,
    nhieu: 6,
    đông: 7,
    many: 6,
    several: 3,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    a: 1,
    an: 1,
    one: 1,
  };
  function countOf(item) {
    var L = low(item);
    var m = /(?:^|\s)[x×]\s*(\d+)/.exec(L) || /(\d+)\s*[x×](?:\s|$)/.exec(L) || /(?:^|\s)(\d+)(?:\s|$)/.exec(L);
    if (m) return Math.max(1, Math.min(10, parseInt(m[1], 10) || 1));
    var first = L.split(/\s+/)[0];
    return NUMS[first] || 1;
  }

  /* ---------- regions ---------- */
  function regionOf(s) {
    if (!s) return '';
    if (
      has(s, [
        'chau au',
        'europe',
        'european',
        'europe medieval',
        'medieval',
        'trung co',
        'byzantine',
        'byzantium',
        'dong la ma',
        'phuong tay',
        'tay au',
        'christian',
        'constantinople',
        'frank',
        'franks',
        'crusader',
        'crusaders',
        'thap tu chinh',
      ])
    )
      return 'eu';
    if (
      has(s, [
        'trung dong',
        'middle east',
        'ottoman',
        'ottomans',
        'turk',
        'turks',
        'turkish',
        'tho nhi ky',
        'ba tu',
        'persia',
        'persian',
        'arab',
        'arabs',
        'arabia',
        'a rap',
        'islam',
        'islamic',
        'hoi giao',
        'muslim',
        'egypt',
        'ai cap',
        'mamluk',
      ])
    )
      return 'me';
    if (has(s, ['la ma co dai', 'la ma', 'ancient rome', 'rome', 'roman', 'romans', 'co dai', 'hy lap', 'greek', 'greece', 'ancient', 'antiquity'])) return 'ro';
    if (has(s, ['a dong', 'east asia', 'asia', 'viet nam', 'vietnam', 'dai viet', 'trung hoa', 'trung quoc', 'china', 'chinese', 'nhat ban', 'japan', 'han quoc', 'korea', 'mong co', 'mongol'])) return 'ea';
    return '';
  }
  var RG = regionOf(REG) || 'ea';
  var FRG = regionOf(FREG) || RG;

  /* ---------- seeded random: one generator, one stream per layer, each seeded from that layer's own values ---------- */
  function hashOf(s) {
    var h = 7;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647;
    return h;
  }
  function gen(seed) {
    var s = seed % 4294967296;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
  var hB = hashOf([SET, TIME, RG].join('|'));
  var hP = hashOf([PROPS, SET, TIME, RG, FRG, ACT].join('|'));
  var hC = hashOf([CAST, SET, TIME, RG, FRG, ACT].join('|'));
  var hF = hashOf([ACT, TIME, SET].join('|'));
  var RB = gen(hB);
  var RP = gen(hP);
  var RC = gen(hC);
  var RF = gen(hF);
  var CUR = RB;
  function rnd() {
    return CUR();
  }
  function rr(a, b) {
    return a + (b - a) * rnd();
  }

  /* ---------- what the values ask for ---------- */
  var S = {
    river: has(SET, ['song', 'river', 'stream', 'suoi', 'estuary', 'cua song', 'ben song']),
    sea: has(SET, ['bien', 'sea', 'ocean', 'vinh', 'coast', 'bo bien', 'cua bien']),
    mountains: has(SET, ['nui', 'mountain', 'mountains', 'hill', 'hills', 'doi', 'karst', 'deo', 'pass']),
    village: has(SET, ['lang', 'village', 'xom', 'ban', 'thon', 'lang que']),
    citadel: has(SET, ['thanh', 'citadel', 'fort', 'fortress', 'castle', 'kinh thanh', 'thanh tri', 'wall', 'walls', 'thanh luy']),
    forest: has(SET, ['rung', 'forest', 'jungle', 'woods', 'rung nui']),
    fields: has(SET, ['dong', 'field', 'fields', 'paddy', 'paddies', 'ruong', 'dong lua', 'rice', 'dong bang', 'plain']),
    palace: has(SET, ['cung dien', 'cung', 'palace', 'dien', 'hoang cung', 'kinh do', 'court', 'trieu dinh']),
  };
  var T = has(TIME, ['dem', 'night', 'toi', 'khuya', 'trang', 'moon', 'nua dem', 'midnight', 'moonlight'])
    ? 'night'
    : has(TIME, ['binh minh', 'dawn', 'sunrise', 'ban mai', 'rang dong', 'sang som', 'daybreak'])
      ? 'dawn'
      : has(TIME, ['hoang hon', 'dusk', 'sunset', 'chieu', 'chieu ta', 'evening', 'xe chieu', 'twilight'])
        ? 'dusk'
        : has(TIME, ['ngay', 'day', 'trua', 'noon', 'sang', 'morning', 'daylight', 'ban ngay', 'afternoon', 'midday'])
          ? 'day'
          : 'dusk';
  var RAIN = has(TIME, ['=mưa', '=mua', 'rain', 'raining', 'rainy', 'bao', 'storm', 'giong', 'mua bao', 'mua phun']) || has(SET, ['=mưa', 'rain', 'storm']);
  var MIST = has(TIME, ['suong', 'mist', 'misty', 'fog', 'foggy', 'suong mu', 'haze', 'hazy', 'mu']) || has(SET, ['suong', 'mist', 'fog']);
  var A = {
    tide: has(ACT, ['trieu rut', 'nuoc rut', 'tide', 'tide falls', 'low tide', 'ebb', 'rut', 'nuoc trieu', 'trieu']),
    advance: has(ACT, ['tien quan', 'tien', 'advance', 'advancing', 'march', 'marching', 'hanh quan', 'di chuyen', 'xuat quan', 'xung phong', 'charge', 'truy kich', 'tien len']),
    battle: has(ACT, ['giao chien', 'chien dau', 'battle', 'fight', 'fighting', 'combat', 'ban ten', 'arrows', 'danh nhau', 'clash', 'giao tranh', 'tan cong', 'attack', 'danh', 'tran']),
    burn: has(ACT, ['=cháy', '=chay', 'burning', 'burn', 'burns', 'fire', 'hoa cong', '=đốt', 'dot chay', 'thieu', 'boc chay', 'chay ruc']),
  };

  /* The people: a comma list of "[count] kind [pose]". "giặc:" (or any other name before a colon) starts the other side's list; "ta:" goes back. */
  var OURS = ['ta', 'quan ta', 'ben ta', 'phe ta', 'us', 'ours', 'our side', 'dai viet', 'viet', 'quan nha', 'nghia quan'];
  var FOE_NAMES = [
    'nguyen',
    'mong',
    'mong co',
    'nguyen mong',
    'quan nguyen',
    'tong',
    'quan tong',
    'minh',
    'quan minh',
    'thanh',
    'quan thanh',
    'nam han',
    'han',
    'xiem',
    'phap',
    'chiem thanh',
    'chiem',
    'ngo',
    'luong',
    'tan',
    'tuy',
    'duong',
    'yuan',
    'mongol',
    'mongols',
    'song',
    'ming',
    'qing',
    'them',
    'other side',
    'ottoman',
    'ottomans',
    'turk',
    'turks',
    'tho nhi ky',
    'quan tho',
    'arab',
    'arabs',
    'persian',
    'persians',
    'crusader',
    'crusaders',
    'thap tu chinh',
    'gaul',
    'gauls',
    'carthage',
    'barbarian',
    'barbarians',
  ];
  var FOE_IN = ['giac', 'dich', 'enemy', 'enemies', 'foe', 'foes', 'xam luoc', 'ke thu', 'invader', 'invaders'];
  var KINDS = [
    ['cavalry', ['ky binh', 'ky si', 'cavalry', 'horseman', 'horsemen', 'rider', 'riders', 'cuoi ngua', 'ky']],
    ['king', ['vua', 'king', 'kings', 'emperor', 'hoang de', 'thien tu', 'quoc vuong', 'thuong hoang', 'hoang thuong', 'chua', 'sultan', 'sultans', 'caesar', 'sa hoang', 'tsar']],
    [
      'general',
      ['tuong', 'tuong quan', 'chu tuong', 'dai tuong', 'general', 'generals', 'commander', 'chi huy', 'nguyen soai', 'thong linh', 'tuong linh', 'thu linh', 'leader', 'pasha', 'pa sa', 'centurion', 'legate'],
    ],
    [
      'mandarin',
      [
        '=quan',
        'quan lai',
        'quan van',
        'mandarin',
        'mandarins',
        'official',
        'officials',
        'minister',
        'ministers',
        'su gia',
        'envoy',
        'thai su',
        'thua tuong',
        'si phu',
        'nho si',
        'scholar',
        'vizier',
        'te tuong',
        'senator',
        'senators',
        'nguyen lao',
        'quy toc',
        'noble',
        'nobles',
      ],
    ],
    [
      'monk',
      [
        'nha su',
        'su',
        'thien su',
        'monk',
        'monks',
        'nha tu',
        'su thay',
        'thay tu',
        'dao si',
        'priest',
        'priests',
        'tu si',
        'linh muc',
        'giam muc',
        'thuong phu',
        'bishop',
        'bishops',
        'patriarch',
        'imam',
        'imams',
        'giao si',
        'cleric',
        'clerics',
        'dervish',
      ],
    ],
    ['child', ['tre em', 'tre', 'tre con', 'be', 'em be', 'child', 'children', 'kid', 'kids', 'thieu nhi', 'chu be', 'boy', 'boys']],
    ['woman', ['phu nu', 'nu', 'co gai', 'thieu nu', '=bà', '=mẹ', 'woman', 'women', 'lady', 'ladies', 'girl', 'girls', 'cung nu', 'hoang hau', 'cong chua', 'queen', 'princess', 'nu tuong']],
    [
      'soldier',
      [
        'linh',
        '=quân',
        'binh',
        'binh si',
        'chien binh',
        'soldier',
        'soldiers',
        'troop',
        'troops',
        'warrior',
        'warriors',
        'cung thu',
        'archer',
        'archers',
        'bo binh',
        'dan binh',
        'quan si',
        've si',
        'guard',
        'guards',
        'thuy binh',
        'hiep si',
        'knight',
        'knights',
        'janissary',
        'janissaries',
        'legionary',
        'legionaries',
        'le duong',
        'man at arms',
        'men at arms',
      ],
    ],
    [
      'villager',
      ['dan', 'dan lang', 'nong dan', 'nguoi dan', 'villager', 'villagers', 'peasant', 'peasants', 'farmer', 'farmers', 'nguoi', 'ngu dan', 'fisherman', 'tho', 'people', 'man', 'men', 'dan phu'],
    ],
  ];
  var POSES = [
    ['flag', ['gio co', 'cam co', 'phat co', 'vay co', '=cờ', '=co', 'flag', 'flags', 'banner', 'banners', 'ho co']],
    ['sword', ['gio kiem', 'kiem', 'guom', 'sword', 'swords', 'vung kiem', 'rut kiem', 'blade', 'dao']],
    ['point', ['chi tay', 'chi huong', 'chi duong', 'point', 'points', 'pointing', '=chỉ', '=chi']],
    ['bow', ['cui', 'cui dau', 'lay', 'bow', 'bows', 'bowing', 'kneel', 'kneeling', 'quy', 'cui chao', 'chao', 'vai lay']],
    ['walk', ['di', 'buoc', 'tien', 'tien len', 'walk', 'walks', 'walking', 'march', 'marching', 'chay', 'run', 'running', 'hanh quan', 'di bo']],
  ];
  function pick(item, table, dflt) {
    for (var i = 0; i < table.length; i++) if (has(item, table[i][1])) return table[i][0];
    return dflt;
  }
  var cast = { ours: [], foe: [] };
  (function () {
    var items = list(CAST);
    var side = 'ours';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var m = /^([^:]*):(.*)$/.exec(it);
      if (m && (has(m[1], FOE_IN) || has(m[1], FOE_NAMES))) {
        side = 'foe';
        it = m[2];
      } else if (m && has(m[1], OURS)) {
        side = 'ours';
        it = m[2];
      } else if (m) it = m[1] + ' ' + m[2];
      if (!it.trim()) continue;
      var sd = has(it, FOE_IN) ? 'foe' : side;
      var n = countOf(it);
      var core = low(it).replace(/chỉ huy|chi huy/g, ' tướng ');
      var kind = pick(core, KINDS, sd === 'foe' ? 'soldier' : 'villager');
      var pose = pick(core, POSES, 'stand');
      var lead = kind === 'cavalry' && has(core, KINDS[2][1]);
      for (var j = 0; j < n && cast[sd].length < 14; j++) cast[sd].push({ kind: kind, pose: pose, foe: sd === 'foe', lead: lead, n: cast[sd].length, rg: sd === 'foe' ? FRG : RG });
    }
  })();

  var PROPK = [
    [
      'sailship',
      ['thuyen buom', 'tau buom', 'sailing ship', 'sailing ships', 'sailship', 'sailships', 'carrack', 'carracks', 'caravel', 'caravels', 'galleon', 'galleons', 'dhow', 'dhows', 'thuyen buon', 'merchant ship'],
    ],
    [
      'warship',
      ['thuyen chien', 'chien thuyen', 'tau chien', 'warship', 'warships', 'junk', 'junks', 'thuyen giac', 'thuyen lau', 'lau thuyen', 'ship', 'ships', 'chien ham', 'thuyen lon', 'dai thuyen'],
    ],
    ['boat', ['thuyen nhe', 'thuyen', 'ghe', 'xuong', 'boat', 'boats', 'canoe', 'canoes', 'thuyen nho', 'mang', 'thuyen con']],
    ['stakes', ['bai coc', 'coc', 'coc go', 'coc nhon', 'stakes', 'stake', 'pikes', 'bai coc go']],
    ['cannon', ['dai phao', 'phao', 'phao thanh', 'dai bac', 'sung dai bac', 'cannon', 'cannons', 'bombard', 'bombards', 'canon']],
    ['elephant', ['voi chien', '=voi', 'elephant', 'elephants', 'war elephant', 'war elephants', 'tuong binh']],
    ['fire', ['=lửa', '=lua', 'fire', 'fires', 'duoc', 'bo duoc', 'torch', 'torches', 'bonfire', 'campfire', 'lua trai', 'dong lua']],
    ['dome', ['mai vom', 'vom', 'dome', 'domes', 'domed', 'hagia sophia', 'aya sofya', 'pantheon', 'stupa', 'bao thap']],
    ['mosque', ['nha tho hoi giao', 'thanh duong hoi giao', 'mosque', 'mosques', 'minaret', 'minarets']],
    ['church', ['nha tho', 'church', 'churches', 'cathedral', 'basilica', 'vuong cung thanh duong', 'nha nguyen', 'chapel', 'tu vien', 'monastery']],
    ['mosque', ['thanh duong']],
    ['tower', ['thap', 'tower', 'towers', 'thap canh', 'watchtower', 'thap chuong', 'belfry']],
    ['palace', ['cung dien', 'palace', 'dien', 'hoang cung', 'cung']],
    ['wall', ['thanh', 'tuong thanh', 'wall', 'walls', 'citadel', 'cong thanh', 'gate', 'fort', 'thanh luy', 'thanh tri']],
    ['temple', ['chua', 'den', 'dinh', 'mieu', 'temple', 'temples', 'pagoda', 'shrine', 'chua chien']],
    ['house', ['nha', 'nha san', 'house', 'houses', 'hut', 'huts', 'mai nha', 'nha tranh', 'cottage']],
    ['tent', ['leu', 'trai', 'tent', 'tents', 'camp', 'doanh trai', 'trai quan', 'leu trai']],
    ['horse', ['ngua', 'horse', 'horses', 'chien ma', 'ngua chien']],
    ['banners', ['=cờ', '=co', 'co hieu', 'co xi', 'banner', 'banners', 'flag', 'flags', 'la co', 'co bay', 'tinh ky']],
    ['trees', ['cay', 'tree', 'trees', 'tre', 'bamboo', 'dua', 'palm', 'palms', 'luy tre', 'rung cay', 'cay da', 'banyan', 'cay cau', 'cay coi']],
  ];
  var props = [];
  (function () {
    var items = list(PROPS);
    var side = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var m = /^([^:]*):(.*)$/.exec(it);
      if (m && (has(m[1], FOE_IN) || has(m[1], FOE_NAMES))) {
        side = 'foe';
        it = m[2];
      } else if (m && has(m[1], OURS)) {
        side = 'ours';
        it = m[2];
      } else if (m) it = m[1] + ' ' + m[2];
      if (!it.trim()) continue;
      var kind = pick(it, PROPK, '');
      if (!kind) continue;
      var sd = has(it, FOE_IN) ? 'foe' : side;
      props.push({ kind: kind, n: Math.min(kind === 'stakes' ? 1 : 6, countOf(it)), side: sd });
    }
  })();
  function propsOf(kind) {
    var out = [];
    for (var i = 0; i < props.length; i++) if (props[i].kind === kind) out.push(props[i]);
    return out;
  }
  function countProp(kind) {
    var c = 0;
    var ps = propsOf(kind);
    for (var i = 0; i < ps.length; i++) c += ps[i].n;
    return c;
  }
  var anySet = false;
  for (var sk in S) if (S[sk]) anySet = true;
  if (!anySet) S.river = S.mountains = true;
  var waterProps = countProp('warship') + countProp('sailship') + countProp('boat') + countProp('stakes') > 0;
  if (waterProps && !S.river && !S.sea) S.river = true;
  var WATER = S.river || S.sea;
  if (A.tide && !WATER) A.tide = false;

  /* ---------- colours ---------- */
  var PAL = {
    dusk: {
      sky: ['#240c2a', 0, '#5d1730', 0.24, '#b23a2c', 0.46, '#e9792f', 0.62, '#ffbd5c', 0.72, '#ffe2a0', 0.76],
      sun: ['#fff6d6', '#ffd27a', '#ffb04a'],
      sx: 0.66,
      sy: 620,
      sr: 150,
      glow: '#ffab4a',
      go: 0.42,
      drift: 46,
      cloud: '#ff9a55',
      co: 0.38,
      cloud2: '#7d2232',
      co2: 0.55,
      far: '#8a3346',
      fo: 0.72,
      mid: '#4f1a2b',
      near: '#2a0e18',
      water: ['#f4a24a', '#b9452e', '#3b1020'],
      front: ['#d9652f', '#7a2328', '#2a0a14'],
      shine: '#ffe6a6',
      wave: '#ffd38a',
      ink: '#150a08',
      reed: '#0d0605',
      batten: '#e88a45',
      port: '#ffb35c',
      flag: '#c21f1a',
      flagE: '#3a3150',
      bird: '#2a0f12',
      ground: ['#6a2a34', '#2a0e18'],
      paddy: ['#ffb877', '#7a2f36'],
      mist: '#ffc89a',
      smoke: '#2a1612',
      lit: true,
    },
    dawn: {
      sky: ['#1f2547', 0, '#4b4373', 0.22, '#9b6a8e', 0.44, '#e39a8f', 0.6, '#ffc9a0', 0.7, '#fff0d6', 0.77],
      sun: ['#fffdf2', '#ffe7b8', '#ffc58a'],
      sx: 0.3,
      sy: 660,
      sr: 120,
      glow: '#ffc89a',
      go: 0.4,
      drift: -40,
      cloud: '#ffc2a6',
      co: 0.45,
      cloud2: '#6d5a8a',
      co2: 0.5,
      far: '#9a86a8',
      fo: 0.75,
      mid: '#5e4c72',
      near: '#2a2236',
      water: ['#ffd2a8', '#a77a98', '#2c2440'],
      front: ['#e8a890', '#6a4f72', '#1e1830'],
      shine: '#fff4dc',
      wave: '#ffe2c8',
      ink: '#1b1526',
      reed: '#120e1a',
      batten: '#e8b49a',
      port: '#ffd9a0',
      flag: '#c8261e',
      flagE: '#3e3a58',
      bird: '#2c2238',
      ground: ['#6a5878', '#2a2236'],
      paddy: ['#ffd8b4', '#6f5f86'],
      mist: '#ffe4dc',
      smoke: '#3a3046',
      lit: false,
    },
    day: {
      sky: ['#2f6fae', 0, '#5d97cf', 0.3, '#9cc4e4', 0.58, '#d4e6ee', 0.72, '#eef2ea', 0.78],
      sun: ['#ffffff', '#fff6d0', '#ffe9a0'],
      sx: 0.74,
      sy: 210,
      sr: 72,
      glow: '#fff3c4',
      go: 0.5,
      drift: 0,
      cloud: '#ffffff',
      co: 0.78,
      cloud2: '#cfe0ec',
      co2: 0.7,
      far: '#7fa2b4',
      fo: 0.8,
      mid: '#4d7470',
      near: '#22382e',
      water: ['#bfe0ea', '#5f9db4', '#1c4352'],
      front: ['#7fb8c8', '#33697c', '#122c38'],
      shine: '#ffffff',
      wave: '#eaf6fa',
      ink: '#14201a',
      reed: '#0e1812',
      batten: '#9fb8a8',
      port: '#d8c890',
      flag: '#c8241c',
      flagE: '#2c3442',
      bird: '#1d2a30',
      ground: ['#6f9a63', '#22382e'],
      paddy: ['#d8ecf0', '#5a8a7a'],
      mist: '#ffffff',
      smoke: '#3a3a3a',
      lit: false,
    },
    night: {
      sky: ['#03050c', 0, '#0a1226', 0.35, '#18254a', 0.62, '#2a3b66', 0.74, '#3a4c78', 0.78],
      sun: ['#fffbea', '#f2ecd2', '#d8d2b8'],
      sx: 0.74,
      sy: 250,
      sr: 64,
      glow: '#9fb4ff',
      go: 0.35,
      drift: -10,
      cloud: '#3a4a78',
      co: 0.55,
      cloud2: '#1a2444',
      co2: 0.7,
      far: '#2c3a62',
      fo: 0.85,
      mid: '#18223f',
      near: '#0a0f1e',
      water: ['#4a5c8c', '#1c2850', '#070b18'],
      front: ['#334477', '#141c3a', '#05070f'],
      shine: '#e8ecff',
      wave: '#9fb0e0',
      ink: '#04060c',
      reed: '#03050a',
      batten: '#5a6a98',
      port: '#ffcf7a',
      flag: '#a8201a',
      flagE: '#454d70',
      bird: '#000000',
      ground: ['#1c2848', '#0a0f1e'],
      paddy: ['#5a6c9c', '#141c34'],
      mist: '#8090c0',
      smoke: '#4a4a58',
      lit: true,
    },
  };
  function hx(c) {
    c = c.replace('#', '');
    return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)];
  }
  function mix(a, b, t) {
    var x = hx(a);
    var y = hx(b);
    var o = '#';
    for (var i = 0; i < 3; i++) {
      var c = Math.round(x[i] + (y[i] - x[i]) * t);
      o += (c < 16 ? '0' : '') + c.toString(16);
    }
    return o;
  }
  var P = {};
  var src = PAL[T];
  for (var pk in src) P[pk] = src[pk];
  P.sunO = 1;
  if (RAIN) {
    var gray = T === 'night' ? '#1c2230' : '#6b7280';
    var sky = [];
    for (var si = 0; si < P.sky.length; si += 2) sky.push(mix(P.sky[si], gray, 0.5), P.sky[si + 1]);
    P.sky = sky;
    P.sunO = 0.18;
    P.cloud = mix(P.cloud2, gray, 0.35);
    P.co = 0.85;
    P.cloud2 = mix(P.cloud2, '#000000', 0.25);
    P.co2 = 0.85;
    P.far = mix(P.far, gray, 0.4);
    P.mid = mix(P.mid, gray, 0.2);
    P.water = [mix(P.water[0], gray, 0.5), mix(P.water[1], gray, 0.35), P.water[2]];
    P.front = [mix(P.front[0], gray, 0.45), mix(P.front[1], gray, 0.3), P.front[2]];
    P.paddy = [mix(P.paddy[0], gray, 0.45), P.paddy[1]];
    P.shine = mix(P.shine, gray, 0.6);
  }
  var FIRE = ['#e2491c', '#ff9a2e', '#ffe08a'];
  /* Each region's banner colour, and the gold, the pale and the ivory its emblems are cut in. */
  var FLAGS = { ea: P.flag, eu: mix('#55308c', P.flag, 0.15), me: mix('#c42a1c', P.flag, 0.3), ro: mix('#a8261c', P.flag, 0.3) };
  var dimE = T === 'night' ? 0.32 : 0.04;
  var EMB = mix('#f2cd6a', P.ink, dimE);
  var PALE = mix('#f4ecd8', P.ink, dimE);
  var IVORY = mix('#efe2c2', P.ink, T === 'night' ? 0.42 : 0.12);
  function flagCol(rg, foe) {
    return foe && rg === RG ? P.flagE : FLAGS[rg] || P.flag;
  }

  /* ---------- drawing ---------- */
  var uid = 0;
  var AN = [];
  var FP = [];
  var EL = {};
  var NO = typeof window !== 'undefined' ? (window.__dioN = (window.__dioN || 0) + 1) : 1;
  var ID = 'dio' + NO + '_';
  function key() {
    return 'k' + ++uid;
  }
  function dk(k) {
    return ' data-d="' + k + '"';
  }
  function E(k) {
    return EL[k];
  }
  function f1(x) {
    return Math.round(x * 10) / 10;
  }
  function at(x, y, s, flip) {
    s = s == null ? 1 : s;
    return ' transform="translate(' + f1(x) + ',' + f1(y) + ')' + (s !== 1 || flip ? ' scale(' + (flip ? -s : s).toFixed(3) + ',' + s.toFixed(3) + ')' : '') + '"';
  }
  function Pa(d, a) {
    return '<path d="' + d + '"' + (a || '') + '/>';
  }
  function Ln(x1, y1, x2, y2, w, c) {
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) + '" stroke="' + (c || 'currentColor') + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }
  function Ci(cx, cy, r, a) {
    return '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '"' + (a || '') + '/>';
  }
  function Fl(c, o) {
    return ' fill="' + c + '"' + (o != null && o !== 1 ? ' opacity="' + o + '"' : '');
  }
  function G(inner, a) {
    return '<g' + (a || '') + '>' + inner + '</g>';
  }
  function Rc(x, y, w, h, a) {
    return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '"' + (a || '') + '/>';
  }

  /** A tween on an element this layer drew; an element another layer owns is not on the page, and is skipped. */
  function tw(tl, el, a, b, pos) {
    if (el) tl.fromTo(el, a, b, pos);
  }
  function merlons(x0, x1, y, mw, step, mh, a) {
    var o = '';
    for (var x = x0; x <= x1 - mw + 0.5; x += step) o += Rc(x, y - mh, mw, mh + 1, a);
    return o;
  }
  /* Emblems, drawn at unit size about their centre and scaled into place. */
  function star5(cx, cy, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      var rad = i % 2 ? r * 0.45 : r;
      d += (i ? ' L' : 'M') + f1(cx + Math.cos(a) * rad) + ',' + f1(cy + Math.sin(a) * rad);
    }
    return Pa(d + ' Z');
  }
  function cross(cx, cy, s, c) {
    return G(Rc(-2.6, -11, 5.2, 22) + Rc(-9, -5.5, 18, 5.2), at(cx, cy, s) + (c ? Fl(c) : ''));
  }
  function crescent(cx, cy, s, c, bg) {
    return G(Ci(0, 0, 10, Fl(c)) + Ci(4, -1, 8.4, Fl(bg)) + G(star5(10.5, 0, 3.8), Fl(c)), at(cx, cy, s));
  }
  /** A crescent finial, horns up, for a dome or a tent: a cut shape, so it needs no ground to sit on. */
  function finial(x, y, s) {
    s = s || 1;
    return Pa('M' + f1(x - 6 * s) + ',' + f1(y - 8 * s) + ' A' + f1(9 * s) + ',' + f1(9 * s) + ' 0 1,0 ' + f1(x + 6 * s) + ',' + f1(y - 8 * s) + ' A' + f1(7 * s) + ',' + f1(7 * s) + ' 0 1,1 ' + f1(x - 6 * s) + ',' + f1(y - 8 * s) + ' Z');
  }
  function eagle(cx, cy, s, c) {
    return G(
      Pa('M-4,-6 L4,-6 L5,8 L0,14 L-5,8 Z') +
        Pa('M-4,-4 L-17,-13 L-15,-7 L-18,-4 L-14,0 L-16,4 L-5,5 Z') +
        Pa('M4,-4 L17,-13 L15,-7 L18,-4 L14,0 L16,4 L5,5 Z') +
        Pa('M-3,-6 L-7,-12 L-4,-14 L-1,-8 Z') +
        Pa('M3,-6 L7,-12 L4,-14 L1,-8 Z') +
        Ci(-6.5, -13.5, 2.6) +
        Ci(6.5, -13.5, 2.6) +
        Pa('M-3,-20 L3,-20 L2,-16 L-2,-16 Z'),
      at(cx, cy, s) + Fl(c),
    );
  }
  /** The eagle of a Roman standard, wings raised, on top of its pole. */
  function aquila(x, y, s) {
    return G(Pa('M0,-6 L-16,-26 L-10,-4 Z') + Pa('M0,-6 L16,-26 L10,-4 Z') + Ci(0, -12, 5) + Rc(-4, -6, 8, 10), at(x, y, s || 1) + Fl(EMB));
  }
  // A banner's cloth, hanging from a pole at (x, y), w by h, in the side's region: the East Asian
  // pennant of the prototype; a European banner with a cross, or the double-headed eagle (alt); an
  // Ottoman swallowtail with the crescent and star; a Roman vexillum hanging from its crossbar.
  function cloth(x, y, w, h, rg, foe, alt) {
    var c = flagCol(rg, foe);
    if (rg === 'me')
      return (
        Pa('M' + f1(x) + ',' + f1(y) + ' L' + f1(x + w) + ',' + f1(y + h * 0.06) + ' L' + f1(x + w * 0.78) + ',' + f1(y + h * 0.5) + ' L' + f1(x + w) + ',' + f1(y + h * 0.96) + ' L' + f1(x) + ',' + f1(y + h) + ' Z', Fl(c)) +
        crescent(x + w * 0.34, y + h * 0.5, h / 30, PALE, c)
      );
    if (rg === 'eu')
      return (
        Pa(
          'M' + f1(x) + ',' + f1(y) + ' Q' + f1(x + w * 0.5) + ',' + f1(y - h * 0.08) + ' ' + f1(x + w) + ',' + f1(y + h * 0.04) + ' L' + f1(x + w * 0.97) + ',' + f1(y + h) + ' Q' + f1(x + w * 0.5) + ',' + f1(y + h * 0.9) + ' ' + f1(x) + ',' + f1(y + h) + ' Z',
          Fl(c),
        ) + (alt ? eagle(x + w * 0.48, y + h * 0.5, h / 34, EMB) : cross(x + w * 0.46, y + h * 0.5, h / 30, EMB))
      );
    if (rg === 'ro')
      return (
        Ln(x - w * 0.36, y, x + w * 0.36, y, 5) +
        Rc(x - w * 0.3, y, w * 0.6, h * 1.15, Fl(c)) +
        Rc(x - w * 0.3, y + h * 1.15, w * 0.6, 6, Fl(EMB)) +
        Rc(x - w * 0.2, y + h * 0.2, w * 0.4, 4, Fl(EMB)) +
        Ci(x, y + h * 0.68, h * 0.17, ' fill="none" stroke="' + EMB + '" stroke-width="4"') +
        aquila(x, y - 6, h / 50)
      );
    return Pa('M' + f1(x) + ',' + f1(y) + ' L' + f1(x + w) + ',' + f1(y + h * 0.13) + ' Q' + f1(x + w * 0.85) + ',' + f1(y + h * 0.55) + ' ' + f1(x + w) + ',' + f1(y + h) + ' L' + f1(x) + ',' + f1(y + h * 0.88) + ' Z', Fl(c));
  }

  /** A repeating to-and-fro on the timeline, bounded by the scene's length. */
  function loop(tl, el, a, b, p, origin, delay, D) {
    if (!el) return;
    delay = delay || 0;
    if (origin) {
      if (origin.indexOf('%') >= 0) {
        a.transformOrigin = origin;
        b.transformOrigin = origin;
      } else {
        a.svgOrigin = origin;
        b.svgOrigin = origin;
      }
    }
    b.duration = p;
    b.ease = 'sine.inOut';
    b.yoyo = true;
    b.repeat = Math.max(0, Math.floor((D - delay) / p) - 1);
    tl.fromTo(el, a, b, delay);
  }
  /** A computed motion: a setter the tween drives, so a seek with events suppressed still draws it. */
  function proc(tl, start, dur, fn, rep) {
    var o = { _p: 0 };
    Object.defineProperty(o, 'p', {
      get: function () {
        return this._p;
      },
      set: function (x) {
        this._p = x;
        fn(x);
      },
    });
    var to = { p: 1, duration: dur, ease: 'none' };
    if (rep) to.repeat = rep;
    tl.fromTo(o, { p: 0 }, to, start);
  }

  /* Hills: the karst towers of the prototype, or rolling hills where there are no mountains. */
  function karst(seed, base, minH, maxH, count, x0, x1, dip) {
    var r = gen(seed);
    var step = (x1 - x0) / count;
    var d = 'M' + x0 + ',' + (H + 40) + ' L' + x0 + ',' + base;
    for (var i = 0; i < count; i++) {
      var a = x0 + i * step;
      var w = step * (0.7 + r() * 0.5);
      var hh = minH + r() * (maxH - minH);
      if (dip && Math.abs(a + w * 0.45 - dip.x) < dip.w) hh *= dip.k;
      var top = base - hh;
      var lean = (r() - 0.5) * w * 0.25;
      d += ' C' + f1(a + w * 0.05) + ',' + f1(base - hh * 0.35) + ' ' + f1(a + w * 0.12 + lean) + ',' + f1(top) + ' ' + f1(a + w * 0.45 + lean) + ',' + f1(top);
      d += ' C' + f1(a + w * 0.78 + lean) + ',' + f1(top) + ' ' + f1(a + w * 0.9) + ',' + f1(base - hh * 0.4) + ' ' + f1(a + w) + ',' + f1(base - r() * 30);
    }
    return d + ' L' + x1 + ',' + base + ' L' + x1 + ',' + (H + 40) + ' Z';
  }
  function hills(seed, base, minH, maxH, count, x0, x1) {
    var r = gen(seed);
    var step = (x1 - x0) / count;
    var d = 'M' + x0 + ',' + (H + 40) + ' L' + x0 + ',' + base;
    for (var i = 0; i < count; i++) {
      var a = x0 + i * step;
      var hh = minH + r() * (maxH - minH);
      d += ' C' + f1(a + step * 0.25) + ',' + f1(base - hh) + ' ' + f1(a + step * 0.6) + ',' + f1(base - hh) + ' ' + f1(a + step) + ',' + f1(base - r() * 8);
    }
    return d + ' L' + x1 + ',' + base + ' L' + x1 + ',' + (H + 40) + ' Z';
  }
  /** Islands rising from the sea: a few karst clusters with water between them. */
  function islands(seed, base, minH, maxH) {
    var r = gen(seed);
    var d = '';
    var x = -60 + r() * 120;
    while (x < W + 60) {
      var w = 140 + r() * 260;
      d += karst(Math.floor(r() * 1e6), base, minH, maxH, 1 + Math.floor(r() * 3), x, x + w) + ' ';
      x += w + 120 + r() * 420;
    }
    return d;
  }

  /* Mountains outside East Asia: ranges with sharper peaks, not karst towers; and headlands in the sea. */
  function ridge(seed, base, minH, maxH, count, x0, x1, dip) {
    var r = gen(seed);
    var step = (x1 - x0) / count;
    var d = 'M' + x0 + ',' + (H + 40) + ' L' + x0 + ',' + base;
    for (var i = 0; i < count; i++) {
      var a = x0 + i * step;
      var hh = minH + r() * (maxH - minH);
      var px = a + step * (0.35 + r() * 0.3);
      if (dip && Math.abs(px - dip.x) < dip.w) hh *= dip.k;
      var py = base - hh;
      var sh = 0.45 + r() * 0.25;
      d += ' Q' + f1(a + step * 0.12) + ',' + f1(base - hh * 0.3) + ' ' + f1(a + (px - a) * 0.55) + ',' + f1(base - hh * sh);
      d += ' L' + f1(px - step * 0.05) + ',' + f1(py + hh * 0.07) + ' L' + f1(px) + ',' + f1(py) + ' L' + f1(px + step * 0.06) + ',' + f1(py + hh * 0.1);
      d += ' Q' + f1(px + (a + step - px) * 0.5) + ',' + f1(base - hh * (sh - 0.12)) + ' ' + f1(a + step) + ',' + f1(base - hh * 0.12 * r());
    }
    return d + ' L' + x1 + ',' + base + ' L' + x1 + ',' + (H + 40) + ' Z';
  }
  function headlands(seed, base, minH, maxH) {
    var r = gen(seed);
    var d = '';
    var x = -60 + r() * 120;
    while (x < W + 60) {
      var w = 240 + r() * 380;
      var hh = minH + r() * (maxH - minH);
      var pk = x + w * (0.3 + r() * 0.4);
      d += 'M' + f1(x) + ',' + (base + 2) + ' Q' + f1(x + (pk - x) * 0.45) + ',' + f1(base - hh * 0.92) + ' ' + f1(pk) + ',' + f1(base - hh);
      d += ' Q' + f1(pk + (x + w - pk) * 0.55) + ',' + f1(base - hh * 0.9) + ' ' + f1(x + w) + ',' + (base + 2) + ' Z ';
      x += w + 140 + r() * 380;
    }
    return d;
  }

  /* A curved roof: the eaves turn up at both ends, the ridge carries a finial at each end. */
  function roof(w, h, y0) {
    return (
      Pa(
        'M' +
          f1(-w - 24) +
          ',' +
          f1(y0 - 18) +
          ' Q' +
          f1(-w * 0.55) +
          ',' +
          f1(y0 + 2) +
          ' ' +
          f1(-w * 0.42) +
          ',' +
          f1(y0 - h) +
          ' L' +
          f1(w * 0.42) +
          ',' +
          f1(y0 - h) +
          ' Q' +
          f1(w * 0.55) +
          ',' +
          f1(y0 + 2) +
          ' ' +
          f1(w + 24) +
          ',' +
          f1(y0 - 18) +
          ' L' +
          f1(w) +
          ',' +
          f1(y0 + 6) +
          ' L' +
          f1(-w) +
          ',' +
          f1(y0 + 6) +
          ' Z',
      ) +
      Pa('M' + f1(-w * 0.42) + ',' + f1(y0 - h + 2) + ' l-10,-22 l18,12 Z') +
      Pa('M' + f1(w * 0.42) + ',' + f1(y0 - h + 2) + ' l10,-22 l-18,12 Z')
    );
  }
  var LIT = P.lit ? P.port : null;
  var MID_INK = mix(P.ink, P.far, 0.3);
  function windowLit(x, y, w, h) {
    return LIT ? Rc(x, y, w, h, Fl(LIT, 0.85)) : '';
  }

  /* ---------- fire ---------- */
  function fire(x, y, s, noFP, L) {
    var k1 = key();
    var k2 = key();
    var k3 = key();
    var kg = key();
    if (!noFP) FP.push({ x: x, y: y, s: s, L: L || 'fx' });
    AN.push(function (tl, D) {
      loop(tl, E(k1), { scaleY: 0.92, skewX: -4 }, { scaleY: 1.1, skewX: 5 }, 0.23, '0 0', 0, D);
      loop(tl, E(k2), { scaleY: 1.06, skewX: 4 }, { scaleY: 0.88, skewX: -5 }, 0.17, '0 0', 0.05, D);
      loop(tl, E(k3), { scaleY: 0.9 }, { scaleY: 1.18 }, 0.13, '0 0', 0, D);
      loop(tl, E(kg), { opacity: 0.7 }, { opacity: 1 }, 0.31, '', 0, D);
    });
    return (
      '<g' +
      at(x, y, s) +
      '>' +
      Ci(0, -50, 190, dk(kg) + ' fill="url(#' + ID + 'fg)"') +
      G(Pa('M-46,0 Q-60,-70 -22,-120 Q-20,-80 -2,-70 Q-6,-130 22,-178 Q24,-110 44,-84 Q60,-50 46,0 Z', Fl(FIRE[0])), dk(k1)) +
      G(Pa('M-30,0 Q-40,-50 -12,-92 Q-8,-60 4,-52 Q4,-100 20,-128 Q22,-80 34,-56 Q42,-30 30,0 Z', Fl(FIRE[1])), dk(k2)) +
      G(Pa('M-16,0 Q-20,-34 -2,-62 Q4,-40 10,-34 Q16,-20 16,0 Z', Fl(FIRE[2])), dk(k3)) +
      '</g>'
    );
  }

  /* ---------- buildings, in local units: centred on x, standing on y = 0 ---------- */
  function house(burn) {
    var o = '';
    var posts = [-82, -42, 38, 78];
    for (var i = 0; i < posts.length; i++) o += Rc(posts[i], -72, 8, 72);
    o += Rc(-100, -80, 200, 9) + Rc(-84, -142, 168, 64) + windowLit(-20, -124, 40, 30);
    o += Pa('M-124,-128 L-66,-238 L66,-238 L124,-128 L108,-118 L-108,-118 Z') + Pa('M-66,-238 l-12,-16 l20,6 Z') + Pa('M66,-238 l12,-16 l-20,6 Z');
    o += Ln(104, 0, 88, -80, 4) + Ln(118, 0, 102, -80, 4);
    return { svg: o, w: 260, fire: burn ? [[0, -150, 0.8]] : [] };
  }
  function temple(burn) {
    var o =
      Rc(-124, -18, 248, 18) +
      Rc(-84, -98, 168, 82) +
      windowLit(-22, -70, 44, 52) +
      roof(112, 46, -98) +
      Rc(-58, -152, 116, 52) +
      roof(82, 40, -152) +
      Rc(-34, -198, 68, 44) +
      roof(56, 34, -198) +
      Ln(0, -228, 0, -264, 5) +
      Ci(0, -270, 8);
    return {
      svg: o,
      w: 290,
      fire: burn
        ? [
            [-40, -110, 0.8],
            [30, -170, 0.7],
          ]
        : [],
    };
  }
  function palace(burn) {
    var o = Pa('M-300,0 L-276,-44 L276,-44 L300,0 Z') + Rc(-210, -136, 420, 94);
    if (LIT) for (var i = -3; i <= 3; i++) o += Rc(i * 56 - 14, -116, 28, 60, Fl(LIT, 0.8));
    o += roof(240, 54, -136) + Rc(-140, -200, 280, 66) + roof(170, 60, -200) + Ci(0, -268, 12) + Pa('M-12,-262 Q0,-292 12,-262 Z');
    o += G(Rc(-40, -80, 80, 80) + roof(56, 34, -80), at(-300, 0)) + G(Rc(-40, -80, 80, 80) + roof(56, 34, -80), at(300, 0));
    return {
      svg: o,
      w: 640,
      fire: burn
        ? [
            [-120, -150, 1],
            [110, -210, 0.9],
          ]
        : [],
    };
  }
  function tent(foe, burn) {
    var o =
      Pa('M-104,0 Q-62,-52 -12,-150 L0,-172 L12,-150 Q62,-52 104,0 Z') +
      Pa('M-24,0 L0,-74 L24,0 Z', Fl(LIT || mix(P.ink, P.mid, 0.5))) +
      Ln(0, -172, 0, -224, 5) +
      Pa('M0,-224 L46,-214 L0,-200 Z', Fl(foe ? P.flagE : P.flag));
    return { svg: o, w: 230, fire: burn ? [[0, -60, 0.8]] : [] };
  }
  function wallSpan(x0, x1, burn) {
    var hW = 124;
    var o = Rc(x0, -hW, x1 - x0, hW);
    for (var x = x0 + 6; x < x1 - 14; x += 34) o += Rc(x, -hW - 18, 18, 20);
    var cx = (x0 + x1) / 2;
    o += Rc(cx - 104, -170, 208, 170) + Pa('M' + f1(cx - 40) + ',0 L' + f1(cx - 40) + ',-72 Q' + f1(cx) + ',-122 ' + f1(cx + 40) + ',-72 L' + f1(cx + 40) + ',0 Z', Fl(LIT || mix(P.ink, P.mid, 0.45)));
    o += G(Rc(-82, -226, 164, 56) + windowLit(-50, -214, 100, 30) + roof(112, 48, -226) + Rc(-50, -280, 100, 40) + roof(72, 36, -280), at(cx, 0));
    var towers = [x0 + 44, x1 - 44];
    for (var i = 0; i < towers.length; i++) o += G(Rc(-40, -190, 80, 190) + windowLit(-12, -170, 24, 26) + roof(56, 38, -190), at(towers[i], 0));
    return {
      svg: o,
      fire: burn
        ? [
            [cx - 30, -240, 1.1],
            [towers[0], -200, 0.8],
            [towers[1], -200, 0.8],
          ]
        : [],
    };
  }
  /* ---------- the other regions' buildings, in the same local units ---------- */
  var DOOR = LIT || mix(P.ink, P.mid, 0.45);
  function archLit(x, y, w, h) {
    return LIT ? Pa('M' + f1(x) + ',' + f1(y + h) + ' L' + f1(x) + ',' + f1(y + w * 0.5) + ' Q' + f1(x + w * 0.5) + ',' + f1(y - w * 0.35) + ' ' + f1(x + w) + ',' + f1(y + w * 0.5) + ' L' + f1(x + w) + ',' + f1(y + h) + ' Z', Fl(LIT, 0.85)) : '';
  }
  function archDoor(cx, w, h, pointed) {
    var x0 = cx - w / 2;
    var x1 = cx + w / 2;
    return Pa(
      'M' + f1(x0) + ',0 L' + f1(x0) + ',' + f1(-h + w * 0.5) + (pointed ? ' Q' + f1(x0) + ',' + f1(-h + w * 0.1) + ' ' + f1(cx) + ',' + f1(-h) + ' Q' + f1(x1) + ',' + f1(-h + w * 0.1) + ' ' + f1(x1) + ',' + f1(-h + w * 0.5) : ' Q' + f1(cx) + ',' + f1(-h - w * 0.2) + ' ' + f1(x1) + ',' + f1(-h + w * 0.5)) + ' L' + f1(x1) + ',0 Z',
      Fl(DOOR),
    );
  }
  function domeShape(cx, base, r, hgt) {
    return Pa('M' + f1(cx - r) + ',' + f1(base) + ' Q' + f1(cx - r) + ',' + f1(base - hgt) + ' ' + f1(cx) + ',' + f1(base - hgt - 2) + ' Q' + f1(cx + r) + ',' + f1(base - hgt) + ' ' + f1(cx + r) + ',' + f1(base) + ' Z');
  }
  function minaret(x, h) {
    return (
      Rc(x - 18, -44, 36, 44) +
      Rc(x - 13, -h, 26, h) +
      Rc(x - 22, -h * 0.74, 44, 10) +
      Rc(x - 19, -h * 0.9, 38, 8) +
      Pa('M' + f1(x - 13) + ',' + f1(-h) + ' L' + f1(x) + ',' + f1(-h - 76) + ' L' + f1(x + 13) + ',' + f1(-h) + ' Z') +
      Ln(x, -h - 74, x, -h - 92, 3) +
      finial(x, -h - 96, 0.7)
    );
  }
  function houseW(rg, burn) {
    var o;
    if (rg === 'eu') o = Rc(-78, -118, 156, 118) + Pa('M-98,-112 L0,-214 L98,-112 Z') + Rc(40, -200, 20, 56) + windowLit(-52, -92, 22, 30) + windowLit(30, -92, 22, 30) + windowLit(-9, -170, 18, 22) + archDoor(0, 28, 56);
    else if (rg === 'me') o = Rc(-86, -124, 172, 124) + Rc(-92, -134, 184, 12) + domeShape(0, -132, 34, 52) + Ln(0, -184, 0, -204, 3) + archLit(-58, -98, 24, 40) + archLit(34, -98, 24, 40) + archDoor(0, 32, 66, true);
    else o = Rc(-100, -104, 200, 104) + Rc(-110, -112, 220, 10) + Pa('M-118,-108 L0,-156 L118,-108 Z') + windowLit(-72, -82, 22, 30) + windowLit(50, -82, 22, 30) + archDoor(0, 30, 60);
    return { svg: o, w: rg === 'ro' ? 250 : 220, fire: burn ? [[0, -150, 0.8]] : [] };
  }
  function church(burn) {
    var o = Rc(-120, -150, 196, 150) + Pa('M-132,-146 L-22,-220 L88,-146 Z');
    o += Rc(76, -292, 68, 292) + Pa('M70,-290 L110,-396 L150,-290 Z') + Ln(110, -394, 110, -444, 6) + Ln(94, -424, 126, -424, 6);
    o += archLit(-100, -122, 20, 58) + archLit(-6, -122, 20, 58) + archLit(98, -262, 24, 40) + (LIT ? Ci(-22, -178, 13, Fl(LIT, 0.85)) : '') + archDoor(-52, 34, 70);
    return {
      svg: o,
      w: 300,
      fire: burn
        ? [
            [-30, -170, 0.9],
            [110, -300, 0.7],
          ]
        : [],
    };
  }
  function mosque(burn) {
    var o = Rc(-130, -128, 260, 128) + Pa('M-130,-128 Q-128,-180 -66,-184 L-66,-128 Z') + Pa('M130,-128 Q128,-180 66,-184 L66,-128 Z');
    o += Rc(-84, -178, 168, 24) + domeShape(0, -176, 96, 118) + Ln(0, -294, 0, -316, 4) + finial(0, -320);
    o += minaret(-178, 360) + minaret(178, 360);
    for (var i = -2; i <= 2; i++) o += archLit(i * 44 - 8, -106, 16, 34);
    if (LIT) for (var j = -3; j <= 3; j++) o += Rc(j * 22 - 4, -172, 8, 12, Fl(LIT, 0.8));
    o += archDoor(0, 40, 92, true);
    return { svg: o, w: 420, fire: burn ? [[0, -200, 1]] : [] };
  }
  function templeRo(burn) {
    var o = LIT ? Rc(-120, -190, 240, 150, Fl(LIT, 0.4)) : '';
    o += Rc(-160, -26, 320, 26) + Rc(-146, -42, 292, 18);
    for (var i = 0; i < 6; i++) o += Rc(-128 + i * 48, -196, 16, 156);
    o += Rc(-150, -222, 300, 28) + Pa('M-160,-220 L0,-286 L160,-220 Z');
    return { svg: o, w: 330, fire: burn ? [[0, -230, 0.9]] : [] };
  }
  function domeOf(rg, burn) {
    var o;
    var w;
    if (rg === 'eu' || rg === 'me') {
      // The great church of a capital: a dome on a ring of windows, half-domes, buttress towers.
      o = Rc(-280, -150, 560, 150) + Rc(-304, -214, 48, 214) + Rc(256, -214, 48, 214) + Pa('M-308,-214 L-280,-248 L-252,-214 Z') + Pa('M252,-214 L280,-248 L308,-214 Z');
      o += Pa('M-252,-150 Q-250,-234 -150,-240 L-150,-150 Z') + Pa('M252,-150 Q250,-234 150,-240 L150,-150 Z');
      o += Rc(-150, -262, 300, 36) + domeShape(0, -260, 162, 140);
      if (LIT) for (var i = -6; i <= 6; i++) o += Rc(i * 22 - 5, -255, 10, 20, Fl(LIT, 0.85));
      for (var j = -4; j <= 4; j++) if (j) o += archLit(j * 56 - 10, -120, 20, 50);
      o += archDoor(0, 46, 96);
      if (rg === 'eu') o += Ln(0, -400, 0, -450, 6) + Ln(-16, -432, 16, -432, 6);
      else o += Ln(0, -400, 0, -424, 5) + finial(0, -430, 1.3) + minaret(-340, 430) + minaret(340, 430);
      w = rg === 'eu' ? 640 : 760;
    } else if (rg === 'ea') {
      // A stupa: a bell of brick on two terraces, a spire of rings.
      o = Rc(-150, -30, 300, 30) + Rc(-118, -62, 236, 34) + domeShape(0, -60, 104, 156) + Rc(-26, -246, 52, 30) + Rc(-32, -252, 64, 8) + Pa('M-14,-250 L0,-370 L14,-250 Z');
      for (var k = 0; k < 5; k++) o += Rc(-14 + k * 2.2, -272 - k * 18, 28 - k * 4.4, 5);
      w = 310;
    } else {
      // The Pantheon: a drum and a low dome behind a pedimented porch.
      o = Rc(-170, -200, 340, 200) + Rc(-176, -214, 352, 16) + domeShape(0, -212, 168, 116);
      o += (LIT ? Rc(-130, -170, 260, 150, Fl(LIT, 0.4)) : '') + Rc(-150, -192, 300, 20) + Pa('M-160,-190 L0,-250 L160,-190 Z');
      w = 360;
    }
    return {
      svg: o,
      w: w,
      fire: burn
        ? [
            [-160, -200, 1],
            [80, -300, 0.9],
          ]
        : [],
    };
  }
  function towerOf(rg, burn) {
    var o;
    var top;
    if (rg === 'eu') {
      o = Rc(-46, -300, 92, 300) + Rc(-58, -322, 116, 24) + merlons(-58, 58, -322, 15, 25.25, 22) + archLit(-8, -256, 16, 36) + archLit(-8, -170, 16, 36);
      top = -320;
    } else if (rg === 'me') {
      o = Rc(-50, -320, 100, 320) + Rc(-60, -330, 120, 14) + Pa('M-62,-328 L0,-436 L62,-328 Z') + Ln(0, -434, 0, -456, 4) + finial(0, -460, 0.8) + archLit(-9, -280, 18, 34) + archLit(-9, -190, 18, 34);
      top = -330;
    } else if (rg === 'ea') {
      o = Rc(-70, -20, 140, 20);
      var y = -20;
      var ww = 62;
      for (var i = 0; i < 5; i++) {
        o += Rc(-ww * 0.72, y - 56, ww * 1.44, 56) + roof(ww, 22, y - 56) + windowLit(-10, y - 44, 20, 26);
        y -= 74;
        ww *= 0.84;
      }
      o += Ln(0, y + 12, 0, y - 40, 5) + Ci(0, y - 46, 7);
      top = y;
    } else {
      o = Rc(-56, -280, 112, 280) + merlons(-56, 56, -280, 16, 24, 22) + windowLit(-10, -240, 20, 30) + windowLit(-10, -160, 20, 30);
      top = -290;
    }
    return { svg: o, w: rg === 'ea' ? 200 : 150, fire: burn ? [[0, top + 10, 0.8]] : [] };
  }
  function palaceW(rg, burn) {
    var o = Pa('M-310,0 L-296,-30 L296,-30 L310,0 Z');
    if (rg === 'eu') {
      o += Rc(-230, -168, 460, 140);
      for (var i = -4; i <= 4; i++) o += archLit(i * 48 - 12, -140, 24, 56);
      o += Rc(-90, -196, 180, 30) + domeShape(0, -194, 96, 88) + Ln(0, -284, 0, -318, 5) + Ln(-12, -306, 12, -306, 5);
      o += domeShape(-160, -166, 40, 44) + domeShape(160, -166, 40, 44);
      for (var s = -1; s <= 1; s += 2) o += G(Rc(-38, -262, 76, 262) + merlons(-44, 44, -262, 14, 24, 20) + archLit(-8, -220, 16, 30), at(s * 262, 0));
    } else if (rg === 'me') {
      o += Rc(-250, -124, 500, 96);
      for (var j = -4; j <= 4; j++) o += domeShape(j * 54, -122, 24, 30);
      o += Rc(-62, -170, 124, 48) + domeShape(0, -168, 66, 78) + finial(0, -258);
      o += Rc(180, -320, 56, 296) + Pa('M168,-318 L208,-414 L248,-318 Z') + archLit(196, -282, 24, 30);
      for (var m = -4; m <= 3; m++) o += archLit(m * 52 + 14, -100, 18, 34);
      o += G(archDoor(0, 56, 86, true), at(0, -28));
    } else {
      o += Rc(-290, -50, 580, 22);
      for (var k = 0; k < 12; k++) o += Rc(-272 + k * 48.5, -214, 16, 164);
      o += Rc(-292, -238, 584, 26) + Pa('M-302,-236 L0,-322 L302,-236 Z');
    }
    return {
      svg: o,
      w: 640,
      fire: burn
        ? [
            [-120, -170, 1],
            [110, -220, 0.9],
          ]
        : [],
    };
  }
  function tentW(rg, foe, burn) {
    var o;
    if (rg === 'eu') {
      o = Pa('M-96,0 L-96,-84 L0,-186 L96,-84 L96,0 Z');
      for (var i = 0; i < 8; i++) o += Pa('M' + (-96 + i * 24) + ',-86 q12,24 24,0 Z');
      o += Pa('M-22,0 L0,-74 L22,0 Z', Fl(DOOR)) + Ln(0, -186, 0, -238, 5) + cloth(0, -238, 48, 28, rg, foe);
    } else if (rg === 'me') {
      o = Pa('M-112,0 L-106,-66 Q-92,-150 0,-180 Q92,-150 106,-66 L112,0 Z');
      for (var j = 0; j < 9; j++) o += Pa('M' + (-108 + j * 24) + ',-68 q12,22 24,0 Z');
      o += Pa('M-24,0 L0,-80 L24,0 Z', Fl(DOOR)) + Ln(0, -180, 0, -206, 4) + Ci(0, -210, 7) + finial(0, -222, 0.8);
    } else {
      o = Pa('M-104,0 L-80,-112 L80,-112 L104,0 Z') + Pa('M-26,0 L0,-82 L26,0 Z', Fl(DOOR)) + Ln(70, -112, 70, -214, 5) + cloth(70, -200, 44, 26, rg, foe);
    }
    return { svg: o, w: 230, fire: burn ? [[0, -60, 0.8]] : [] };
  }
  function wallW(rg, x0, x1, burn) {
    var cx = (x0 + x1) / 2;
    var hW = rg === 'eu' ? 150 : rg === 'me' ? 136 : 130;
    var o = Rc(x0, -hW, x1 - x0, hW);
    if (rg === 'me') for (var mx = x0 + 4; mx < x1 - 14; mx += 30) o += Pa('M' + f1(mx) + ',' + -hW + ' L' + f1(mx) + ',' + (-hW - 12) + ' Q' + f1(mx + 8) + ',' + (-hW - 28) + ' ' + f1(mx + 16) + ',' + (-hW - 12) + ' L' + f1(mx + 16) + ',' + -hW + ' Z');
    else o += merlons(x0, x1, -hW, 16, 30, 20);
    var towers = [];
    for (var tx = x0 + 70; tx < x1 - 50; tx += 250) if (Math.abs(tx - cx) > 230) towers.push(tx);
    var fires = [];
    for (var i = 0; i < towers.length; i++) {
      var t = towers[i];
      var th = 220 + (i % 2) * 30;
      o += Rc(t - 44, -th, 88, th) + windowLit(t - 8, -th + 44, 16, 26);
      if (rg === 'me') o += Pa('M' + f1(t - 54) + ',' + (-th + 2) + ' L' + f1(t) + ',' + (-th - 92) + ' L' + f1(t + 54) + ',' + (-th + 2) + ' Z');
      else o += Rc(t - 52, -th - 6, 104, 12) + merlons(t - 52, t + 52, -th - 6, 15, 25, 20);
      if (i % 2 === 0) fires.push([t, -th - 10, 0.8]);
    }
    // The gate: two great towers and an arch.
    for (var g = -1; g <= 1; g += 2) {
      var gx = cx + g * 110;
      o += Rc(gx - 50, -280, 100, 280) + windowLit(gx - 9, -240, 18, 28);
      if (rg === 'me') o += Pa('M' + f1(gx - 60) + ',-278 L' + f1(gx) + ',-380 L' + f1(gx + 60) + ',-278 Z');
      else o += Rc(gx - 58, -286, 116, 12) + merlons(gx - 58, gx + 58, -286, 15, 25.25, 22);
    }
    o += Rc(cx - 62, -200, 124, 200) + G(archDoor(0, 76, 140, rg === 'me'), at(cx, 0));
    if (rg === 'eu') {
      // The outer wall, lower and in front, darker: the double line of a great city.
      var outer = mix(MID_INK, P.ink, 0.45);
      var oa = Fl(outer);
      o += Rc(x0 - 40, -78, x1 - x0 + 80, 78, oa) + merlons(x0 - 40, x1 + 40, -78, 14, 26, 16, oa);
      for (var j = 0; j < towers.length; j++) o += Rc(towers[j] + 100, -118, 56, 118, oa) + merlons(towers[j] + 96, towers[j] + 160, -118, 13, 21, 16, oa);
      o += G(archDoor(0, 60, 70), at(cx, 0));
    }
    fires.push([cx, -300, 1.1]);
    return { svg: o, fire: burn ? fires : [] };
  }

  function palm(h, lean) {
    var tx = lean;
    var ty = -h;
    var o = Pa('M-9,0 Q' + f1(lean * 0.3 - 4) + ',' + f1(-h * 0.5) + ' ' + f1(tx - 3) + ',' + f1(ty) + ' L' + f1(tx + 4) + ',' + f1(ty) + ' Q' + f1(lean * 0.3 + 12) + ',' + f1(-h * 0.5) + ' 9,0 Z');
    var k = key();
    var fr = '';
    var angs = [-170, -140, -110, -75, -40, -10, 18];
    for (var i = 0; i < angs.length; i++) {
      var a = (angs[i] * Math.PI) / 180;
      var L = 120 + (i % 2) * 22;
      var ex = tx + Math.cos(a) * L;
      var ey = ty + Math.sin(a) * L * 0.45 + 46;
      var cx = tx + Math.cos(a) * L * 0.5;
      var cy = ty + Math.sin(a) * L * 0.5 - 30;
      fr += Pa('M' + f1(tx) + ',' + f1(ty) + ' Q' + f1(cx) + ',' + f1(cy) + ' ' + f1(ex) + ',' + f1(ey) + ' Q' + f1(cx) + ',' + f1(cy + 20) + ' ' + f1(tx) + ',' + f1(ty + 10) + ' Z');
    }
    var p = 1.5 + rnd() * 0.6;
    AN.push(function (tl, D) {
      loop(tl, E(k), { rotation: -2 }, { rotation: 3 }, p, f1(tx) + ' ' + f1(ty), 0, D);
    });
    return o + G(fr, dk(k));
  }
  function bamboo(h) {
    var k = key();
    var o = '';
    var stalks = 6;
    for (var i = 0; i < stalks; i++) {
      var bx = (i - stalks / 2) * 9;
      var lean = (i - stalks / 2) * 26 + rr(-10, 10);
      var hh = h * (0.75 + rnd() * 0.3);
      o += Pa(
        'M' + f1(bx - 3) + ',0 Q' + f1(bx + lean * 0.2) + ',' + f1(-hh * 0.6) + ' ' + f1(bx + lean) + ',' + f1(-hh) + ' Q' + f1(bx + lean * 0.2 + 6) + ',' + f1(-hh * 0.6) + ' ' + f1(bx + 3) + ',0 Z',
      );
      for (var j = 0; j < 7; j++) {
        var t = 0.45 + j * 0.08;
        var lx = bx + lean * t * t;
        var ly = -hh * t;
        var dir = j % 2 ? 1 : -1;
        o += Pa('M' + f1(lx) + ',' + f1(ly) + ' q' + 16 * dir + ',-8 ' + 36 * dir + ',6 q' + -18 * dir + ',0 ' + -36 * dir + ',-3 Z');
      }
    }
    var p = 1.3 + rnd() * 0.5;
    AN.push(function (tl, D) {
      loop(tl, E(k), { skewX: -2 }, { skewX: 4 }, p, '50% 100%', 0, D);
    });
    return G(o, dk(k));
  }

  /* Trees of the other regions: the cypress, the oak, the umbrella pine. */
  function cypress(h) {
    var k = key();
    var o = Rc(-5, -h * 0.1, 10, h * 0.1) + Pa('M-4,' + f1(-h * 0.06) + ' Q-34,' + f1(-h * 0.4) + ' -10,' + f1(-h * 0.84) + ' Q0,' + f1(-h * 1.02) + ' 10,' + f1(-h * 0.84) + ' Q34,' + f1(-h * 0.4) + ' 4,' + f1(-h * 0.06) + ' Z');
    var p = 1.6 + rnd() * 0.6;
    AN.push(function (tl, D) {
      loop(tl, E(k), { skewX: -1.5 }, { skewX: 2.5 }, p, '50% 100%', 0, D);
    });
    return G(o, dk(k));
  }
  function oak(h) {
    var k = key();
    var trunk = Pa('M-12,0 Q-6,' + f1(-h * 0.3) + ' -16,' + f1(-h * 0.54) + ' L16,' + f1(-h * 0.54) + ' Q6,' + f1(-h * 0.3) + ' 12,0 Z');
    var cr =
      Ci(0, -h * 0.72, h * 0.25) +
      Ci(-h * 0.22, -h * 0.6, h * 0.19) +
      Ci(h * 0.22, -h * 0.62, h * 0.2) +
      Ci(-h * 0.11, -h * 0.86, h * 0.17) +
      Ci(h * 0.13, -h * 0.87, h * 0.16) +
      Ci(h * 0.31, -h * 0.74, h * 0.13) +
      Ci(-h * 0.31, -h * 0.73, h * 0.12);
    var p = 1.8 + rnd() * 0.6;
    AN.push(function (tl, D) {
      loop(tl, E(k), { rotation: -1.2 }, { rotation: 1.6 }, p, '0 ' + f1(-h * 0.5), 0, D);
    });
    return trunk + G(cr, dk(k));
  }
  function pine(h) {
    var k = key();
    var trunk = Pa('M-9,0 Q-4,' + f1(-h * 0.5) + ' 20,' + f1(-h * 0.8) + ' L30,' + f1(-h * 0.78) + ' Q8,' + f1(-h * 0.5) + ' 9,0 Z');
    var cx = 25;
    var cy = -h * 0.8;
    var rw = h * 0.44;
    var cr = Pa(
      'M' + f1(cx - rw) + ',' + f1(cy + 4) + ' Q' + f1(cx - rw * 0.85) + ',' + f1(cy - h * 0.15) + ' ' + f1(cx - rw * 0.2) + ',' + f1(cy - h * 0.17) + ' Q' + f1(cx + rw * 0.3) + ',' + f1(cy - h * 0.23) + ' ' + f1(cx + rw * 0.8) + ',' + f1(cy - h * 0.12) + ' Q' + f1(cx + rw * 1.1) + ',' + f1(cy - h * 0.04) + ' ' + f1(cx + rw) + ',' + f1(cy + 6) + ' Q' + f1(cx) + ',' + f1(cy - h * 0.03) + ' ' + f1(cx - rw) + ',' + f1(cy + 4) + ' Z',
    );
    var p = 1.9 + rnd() * 0.5;
    AN.push(function (tl, D) {
      loop(tl, E(k), { rotation: -1 }, { rotation: 1.5 }, p, f1(cx) + ' ' + f1(cy), 0, D);
    });
    return trunk + G(cr, dk(k));
  }
  /* A region's two trees: 1 is the broad one (palm, oak, pine), 0 the narrow one (bamboo, cypress). */
  function treeOf(rg, broad, h, lean) {
    if (broad) return rg === 'eu' ? oak(h * 0.85) : rg === 'ro' ? pine(h * 0.9) : palm(h, lean);
    return rg === 'ea' ? bamboo(h) : cypress(h);
  }
  var TREE_W = { ea: [120, 160], eu: [80, 200], me: [80, 160], ro: [80, 220] };

  /* ---------- ships: drawn facing left, standing on the waterline at y = 0 ---------- */
  function junk() {
    var sail = function (x, h, w) {
      var o = '<g transform="translate(' + x + ',-40)">' + Pa('M0,0 L0,' + -h + ' Q' + w * 0.6 + ',' + (-h - 18) + ' ' + w + ',' + (-h + 10) + ' L' + w * 0.92 + ',-6 Z');
      for (var i = 0; i < 6; i++) o += Ln(2, (-h * (i + 1)) / 7, w * 0.95, (-h * (i + 1)) / 7 + 4, 3, P.batten).replace('/>', ' opacity=".55"/>');
      return o + Rc(-4, -h - 30, 8, h + 34) + '</g>';
    };
    var o = Pa('M-260,-40 Q-250,30 -150,46 L170,46 Q250,34 300,-58 L300,-110 L210,-110 L210,-58 L-200,-58 Q-240,-58 -260,-40 Z') + Pa('M200,-110 L320,-110 L320,-140 L200,-140 Z');
    o += sail(-170, 230, 170) + sail(10, 290, 200) + sail(190, 170, 120) + Pa('M14,-370 L84,-360 L14,-346 Z', Fl(mix(P.ink, P.flag, 0.25)));
    for (var i = 0; i < 9; i++) o += Rc(-200 + i * 44, -50, 6, 12, Fl(P.port, 0.85));
    return {
      svg: o,
      fire: [
        [-90, -56, 1.3],
        [150, -110, 1.1],
      ],
    };
  }
  /** A square sail bellied from its yard at (x, top); an emblem in the side's colour when `emb` is set. */
  function sailSq(x, top, w, h, emb) {
    var o =
      Ln(x - w * 0.56, top, x + w * 0.56, top, 7) +
      Pa(
        'M' + f1(x - w / 2) + ',' + f1(top + 4) + ' Q' + f1(x) + ',' + f1(top - 8) + ' ' + f1(x + w / 2) + ',' + f1(top + 4) + ' Q' + f1(x + w * 0.6) + ',' + f1(top + h * 0.55) + ' ' + f1(x + w * 0.46) + ',' + f1(top + h) + ' Q' + f1(x) + ',' + f1(top + h + 14) + ' ' + f1(x - w * 0.46) + ',' + f1(top + h) + ' Q' + f1(x - w * 0.6) + ',' + f1(top + h * 0.55) + ' ' + f1(x - w / 2) + ',' + f1(top + 4) + ' Z',
      );
    if (emb) o += cross(x, top + h * 0.52, h / 70, emb);
    return o;
  }
  /** A lateen sail: a long yard slanting up toward the stern, the sail a triangle under it. */
  function lateen(x, top, w, h) {
    var ax = x - w * 0.62;
    var ay = top + h * 0.7;
    var bx = x + w * 0.42;
    var cx = x + w * 0.2;
    var cy = top + h;
    return (
      Ln(ax - 14, ay + 9, bx + 10, top - 6, 6) +
      Pa('M' + f1(ax) + ',' + f1(ay) + ' L' + f1(bx) + ',' + f1(top) + ' Q' + f1(cx + w * 0.16) + ',' + f1(top + h * 0.55) + ' ' + f1(cx) + ',' + f1(cy) + ' Q' + f1(x - w * 0.22) + ',' + f1(top + h * 0.96) + ' ' + f1(ax) + ',' + f1(ay) + ' Z')
    );
  }
  /** A galley, or with three banks of oars a trireme: a long low hull with a ram, oars along it. */
  function galley(rg, foe) {
    var o = Pa('M-340,-34 L-280,-40 Q-210,26 -100,30 L190,30 Q262,22 292,-40 Q306,-92 276,-124 Q292,-80 266,-56 L-250,-60 L-276,-50 Z') + Rc(-250, -78, 512, 18);
    var banks = rg === 'ro' ? 3 : 1;
    for (var b = 0; b < banks; b++) for (var i = 0; i < 15; i++) o += Ln(-226 + i * 31 + b * 10, -36 + b * 12, -248 + i * 31 + b * 10, 38 + b * 10, 4);
    if (rg === 'me') o += Rc(-24, -360, 8, 300) + lateen(-20, -350, 260, 250) + Rc(-194, -290, 8, 230) + lateen(-190, -280, 170, 180);
    else if (rg === 'ro') o += Rc(-14, -330, 9, 270) + sailSq(-10, -320, 230, 200, null) + Ci(-300, -26, 5, Fl(PALE));
    else o += Rc(-24, -362, 9, 302) + sailSq(-20, -340, 210, 210, flagCol(rg, foe)) + Rc(-194, -292, 8, 232) + sailSq(-190, -280, 140, 150, null);
    o += Ln(248, -60, 248, -190, 5) + cloth(248, -190, 70, 40, rg, foe);
    return {
      svg: o,
      fire: [
        [-90, -80, 1.2],
        [150, -84, 1],
      ],
    };
  }
  /** A ship under sail: a carrack in Europe, a lateen-rigged ship in the Middle East, a merchant ship in Rome. */
  function sailer(rg, foe) {
    var o;
    if (rg === 'eu') {
      o = Pa('M-300,-118 L-252,-66 Q-178,28 -40,34 L150,34 Q236,22 266,-70 L282,-178 L176,-178 L170,-112 L-190,-112 L-210,-150 L-300,-150 Z') + Ln(-296, -140, -400, -212, 7);
      o += Rc(-154, -382, 8, 272) + Rc(6, -472, 10, 360) + Rc(206, -360, 7, 184);
      o += sailSq(-150, -360, 150, 150, null) + sailSq(10, -452, 190, 120, null) + sailSq(10, -310, 250, 180, flagCol(rg, foe)) + lateen(210, -350, 150, 160);
      o += Pa('M11,-472 L100,-464 L11,-454 Z', Fl(flagCol(rg, foe)));
    } else if (rg === 'me') {
      o = Pa('M-300,-70 L-250,-50 Q-180,26 -40,32 L160,32 Q240,20 270,-60 L284,-142 L190,-142 L184,-82 L-260,-82 Z') + Rc(-250, -96, 440, 14);
      o += Rc(-104, -382, 8, 300) + lateen(-100, -372, 300, 290) + Rc(124, -322, 8, 240) + lateen(128, -312, 220, 220);
      o += Ln(250, -142, 250, -232, 5) + cloth(250, -232, 64, 38, rg, foe);
    } else if (rg === 'ro') {
      o = Pa('M-280,-60 Q-262,22 -100,30 L170,30 Q268,10 286,-84 Q300,-156 248,-178 Q282,-128 258,-74 L-266,-62 Z') + Rc(-250, -74, 470, 14);
      o += Rc(-6, -362, 10, 300) + sailSq(0, -340, 250, 220, null) + Pa('M-40,-368 L40,-368 L0,-418 Z') + Ln(-250, -60, -322, -172, 6) + sailSq(-312, -170, 64, 64, null);
    } else {
      return junk();
    }
    return {
      svg: o,
      fire: [
        [-110, -130, 1.2],
        [170, -180, 1],
      ],
    };
  }
  function shipOf(type, rg, foe) {
    if (rg === 'ea') return junk();
    return type === 'sail' ? sailer(rg, foe) : galley(rg, foe);
  }
  function boat(foe, rg) {
    var o = Pa('M-150,-14 Q-120,14 -40,16 L90,16 Q150,12 175,-24 L160,-14 Z');
    var oars = [];
    var rowers = [-100, -55, -10, 35, 80];
    for (var i = 0; i < rowers.length; i++) {
      var k = key();
      oars.push(k);
      o += '<g transform="translate(' + rowers[i] + ',-14)">' + Ci(0, -34, 7) + Pa('M-7,-28 Q0,-30 7,-28 L9,0 L-9,0 Z') + G(Ln(0, -20, 34, 34, 7), dk(k)) + '</g>';
    }
    var kb = key();
    o += Ln(150, -14, 150, -120, 7) + G(rg && rg !== 'ea' ? cloth(150, -120, 60, 36, rg, foe) : Pa('M150,-120 L210,-112 L196,-98 L210,-84 L150,-90 Z', Fl(foe ? P.flagE : P.flag)), dk(kb));
    return { svg: o, oars: oars, banner: kb };
  }

  /* ---------- people ---------- */
  var ROBE = { king: 1, mandarin: 1, monk: 1 };
  /* What a person wears on the head, outside East Asia, in the figure's own units (the head is a circle of 20 at 0,-232). */
  function hatOf(kind, rg, f) {
    var odd = f.n % 2 === 1;
    var beard = Pa('M-14,-226 Q0,-188 14,-226 Z');
    if (rg === 'ea') {
      if (kind === 'soldier') return Pa('M-30,-236 Q0,-262 30,-236 L26,-230 L-26,-230 Z');
      return Pa('M-50,-224 L0,-272 L50,-224 Q0,-216 -50,-224 Z');
    }
    if (rg === 'eu') {
      if (kind === 'soldier') return Pa('M-22,-232 Q-22,-256 0,-278 Q22,-256 22,-232 L24,-226 L-24,-226 Z') + Pa('M-22,-230 L-27,-196 L27,-196 L22,-230 Z');
      if (kind === 'general') return Pa('M-23,-212 L-23,-246 Q0,-266 23,-246 L23,-212 Z') + Pa('M-27,-250 L27,-250 L24,-242 L-24,-242 Z');
      if (kind === 'king') return Pa('M-22,-246 L-25,-274 L-15,-259 L-8,-280 L0,-261 L8,-280 L15,-259 L25,-274 L22,-246 Z') + Ln(-21, -246, -24, -220, 3) + Ln(21, -246, 24, -220, 3) + beard;
      if (kind === 'mandarin') return Pa('M-30,-242 L30,-242 L26,-235 L-26,-235 Z') + Pa('M-18,-242 Q-18,-268 0,-270 Q18,-268 18,-242 Z') + beard;
      if (kind === 'monk') return Pa('M-19,-246 L-21,-278 L21,-278 L19,-246 Z') + Pa('M-21,-274 L-32,-194 L-15,-198 L-13,-250 Z') + Pa('M-15,-226 Q0,-180 15,-226 Z');
      if (kind === 'woman') return Pa('M-23,-232 Q-24,-258 0,-259 Q24,-258 23,-232 L30,-186 L-32,-180 Z') + Pa('M-22,-246 L22,-246 L22,-240 L-22,-240 Z');
      if (kind === 'child') return '';
      return odd ? Pa('M-40,-236 L40,-236 L35,-229 L-35,-229 Z') + Pa('M-20,-236 Q-18,-262 0,-263 Q18,-262 20,-236 Z') : Pa('M-23,-228 Q-25,-258 0,-259 Q25,-258 23,-228 L27,-198 L-27,-198 Z') + Pa('M-19,-250 Q-46,-246 -54,-212 L-45,-210 Q-38,-236 -15,-243 Z');
    }
    if (rg === 'me') {
      if (kind === 'soldier') return Pa('M-22,-240 L22,-240 L21,-228 L-21,-228 Z') + Pa('M-18,-240 L-13,-300 Q0,-310 13,-300 L18,-240 Z') + Pa('M-11,-296 Q-48,-280 -44,-206 L-33,-208 Q-33,-264 -5,-288 Z');
      if (kind === 'general') return Pa('M-27,-234 Q-36,-274 0,-280 Q36,-274 27,-234 Z') + beard;
      if (kind === 'king') return Pa('M-31,-234 Q-44,-288 0,-294 Q44,-288 31,-234 Z') + Pa('M-11,-290 Q0,-322 11,-290 Z') + beard;
      if (kind === 'mandarin') return Pa('M-25,-234 Q-31,-252 -22,-262 L-17,-304 Q0,-312 17,-304 L22,-262 Q31,-252 25,-234 Z') + beard;
      if (kind === 'monk') return Pa('M-15,-250 L-11,-308 Q0,-314 11,-308 L15,-250 Z') + Pa('M-25,-232 Q-27,-256 0,-258 Q27,-256 25,-232 Z') + Pa('M-15,-226 Q0,-180 15,-226 Z');
      if (kind === 'woman') return Pa('M-24,-232 Q-27,-264 0,-264 Q27,-264 24,-232 L36,-176 L-38,-170 Z');
      if (kind === 'child') return Pa('M-13,-244 L-11,-264 L11,-264 L13,-244 Z');
      return odd ? Pa('M-25,-234 Q-30,-266 0,-268 Q30,-266 25,-234 Z') + beard : Pa('M-17,-244 L-14,-274 L14,-274 L17,-244 Z') + Ln(14, -272, 25, -246, 3);
    }
    if (kind === 'soldier' || kind === 'general')
      return (
        Pa('M-22,-230 Q-23,-262 0,-263 Q23,-262 22,-230 L28,-226 L28,-216 L19,-218 L19,-230 Z') +
        Pa('M-22,-234 L-36,-220 L-22,-214 Z') +
        (kind === 'soldier' ? Pa('M-22,-258 Q0,-298 26,-262 L19,-256 Q0,-282 -16,-254 Z') : '')
      );
    if (kind === 'king') {
      var wr = '';
      for (var i = 0; i < 6; i++) {
        var a = Math.PI * (1.05 + i * 0.18);
        var lx = Math.cos(a) * 22;
        var ly = -238 + Math.sin(a) * 16;
        wr += Pa('M' + f1(lx) + ',' + f1(ly) + ' q' + f1(-6 + i * 2) + ',-11 ' + f1(4 + i * 0.4) + ',-14 q-1,9 ' + f1(-4 - i * 0.4) + ',14 Z');
      }
      return Pa('M-22,-238 Q0,-250 22,-238 L22,-232 Q0,-244 -22,-232 Z') + wr;
    }
    if (kind === 'monk' || kind === 'woman') return Pa('M-24,-226 Q-27,-264 0,-266 Q27,-264 24,-226 L32,-190 L-32,-190 Z');
    if (kind === 'villager' && odd) return Pa('M-19,-244 Q0,-282 19,-244 Z');
    return '';
  }
  /* A general's plume or crest outside East Asia, and the point it sways about. */
  var PLUME = {
    eu: ['M0,-254 Q-8,-300 -44,-316 Q-14,-290 -8,-252 Z', '-4 -252'],
    me: ['M4,-276 Q16,-312 34,-326 Q18,-298 10,-274 Z', '6 -276'],
    ro: ['M-32,-258 Q0,-306 32,-258 L25,-251 Q0,-290 -25,-251 Z', '0 -262'],
  };
  /* The garment, outside East Asia: a surcoat, a kaftan, a tunic and its armour skirt; robes stay the prototype's. */
  function torsoOf(kind, rg) {
    if (kind === 'woman') return Pa('M-22,-192 Q0,-202 22,-192 L44,-8 L-44,-8 Z');
    if (kind === 'soldier') {
      if (rg === 'eu') return Pa('M-34,-74 L-24,-192 Q0,-204 24,-192 L34,-74 Z');
      if (rg === 'me') return Pa('M-38,-44 L-24,-192 Q0,-204 24,-192 L38,-44 Z') + Rc(-27, -128, 54, 12);
      return Pa('M-30,-96 L-24,-190 Q0,-204 24,-190 L30,-96 Z') + Pa('M-36,-104 L36,-104 L40,-76 L-40,-76 Z');
    }
    if (rg === 'eu') return Pa('M-30,-72 L-24,-192 Q0,-204 24,-192 L30,-72 Z');
    if (rg === 'me') return Pa('M-34,-34 L-24,-192 Q0,-204 24,-192 L34,-34 Z') + Rc(-26, -130, 52, 10);
    return Pa('M-28,-86 L-24,-192 Q0,-204 24,-192 L28,-86 Z') + Rc(-26, -134, 52, 8);
  }
  function figure(f, opt) {
    var kind = f.kind;
    var pose = f.pose;
    var foe = f.foe;
    var rg = f.rg || 'ea';
    var ea = rg === 'ea';
    var flagC = flagCol(rg, foe);
    var kb = key();
    var kup = key();
    var kl1 = key();
    var kl2 = key();
    var ka1 = key();
    var ka2 = key();
    var kc = null;
    var kp = null;
    var kf = null;
    var plumeO = foe ? '-6 -256' : '2 -268';
    var robe = !!ROBE[kind] || (kind === 'woman' && !ea);
    var legs1;
    var legs2;
    if (robe) {
      legs1 = Pa('M-30,0 L-28,-14 L-6,-14 L-4,0 Z');
      legs2 = Pa('M8,0 L8,-14 L28,-14 L34,0 Z');
    } else if (kind === 'woman') {
      legs1 = Pa('M-18,0 L-11,-112 L1,-112 L-3,0 Z');
      legs2 = Pa('M3,0 L-1,-112 L11,-112 L19,0 Z');
    } else {
      legs1 = Pa('M-24,0 L-16,-96 L-2,-96 L-6,0 Z');
      legs2 = Pa('M6,0 L4,-96 L18,-96 L26,0 Z');
    }
    var head = Ci(0, -232, 20) + Pa('M-6,-214 L6,-214 L5,-200 L-5,-200 Z');
    var body = '';
    if (!ea) {
      if (kind === 'general') {
        kc = key();
        kp = key();
        body += G(Pa('M-30,-196 Q-70,-120 -96,-20 Q-50,-6 -16,-30 L-10,-190 Z'), dk(kc));
        body += Pa('M-38,-92 L-30,-196 Q0,-212 30,-196 L38,-92 Q0,-80 -38,-92 Z') + Pa('M-46,-100 L46,-100 L54,-64 L-54,-64 Z');
      } else if (kind === 'king') body += Pa('M-30,-196 Q0,-212 30,-196 L42,-70 L64,-6 L-64,-6 L-42,-70 Z');
      else if (kind === 'mandarin') body += Pa('M-28,-196 Q0,-210 28,-196 L38,-60 L52,-6 L-52,-6 L-38,-60 Z');
      else if (kind === 'monk') body += Pa('M-30,-196 Q0,-210 30,-196 L40,-60 L46,-8 L-46,-8 L-40,-60 Z');
      else body += torsoOf(kind, rg);
      // What tells the culture at a glance besides the hat: a sash of rank, a shield, a sword at the hip, a cross on the chest.
      if (rg === 'ro' && (kind === 'king' || kind === 'mandarin')) body += Pa('M-28,-192 L-12,-198 L36,-66 L20,-60 Z', Fl(kind === 'king' ? flagC : PALE));
      if (rg === 'eu' && kind === 'monk') body += cross(0, -150, 1.2, EMB);
      if (rg === 'eu' && kind === 'king') body += Pa('M-34,-120 L34,-120 L38,-104 L-38,-104 Z', Fl(EMB));
      if (rg === 'me' && (kind === 'soldier' || kind === 'general')) body += Pa('M-16,-112 Q-30,-70 -62,-46 L-56,-38 Q-22,-62 -6,-108 Z');
      if (kind === 'soldier' && rg === 'eu')
        body += f.n % 2 === 0 ? Pa('M8,-204 Q32,-214 56,-204 L56,-152 Q50,-110 32,-80 Q14,-110 8,-152 Z') + cross(32, -164, 1.25, flagC) : Ci(32, -150, 33) + Ci(32, -150, 9, Fl(flagC));
      if (kind === 'soldier' && rg === 'ro') body += Pa('M8,-208 Q32,-216 56,-208 L56,-84 Q32,-76 8,-84 Z') + Rc(28, -204, 8, 116, Fl(flagC)) + Ci(32, -146, 9, Fl(EMB));
      body += kind === 'woman' ? Ci(0, -228, 18) + Pa('M-6,-212 L6,-212 L5,-198 L-5,-198 Z') : head;
      body += hatOf(kind, rg, f);
      if (kp) {
        body += G(Pa(PLUME[rg][0]), dk(kp));
        plumeO = PLUME[rg][1];
      }
    } else if (kind === 'general') {
      kc = key();
      kp = key();
      body += G(Pa('M-30,-196 Q-70,-120 -96,-20 Q-50,-6 -16,-30 L-10,-190 Z'), dk(kc));
      body += Pa('M-38,-92 L-30,-196 Q0,-212 30,-196 L38,-92 Q0,-80 -38,-92 Z') + Pa('M-46,-100 L46,-100 L54,-64 L-54,-64 Z') + head;
      body += foe ? Pa('M-28,-240 Q0,-252 28,-240 L28,-228 L-28,-228 Z') + Pa('M-20,-242 Q0,-288 20,-242 Z') + Pa('M-3,-282 L0,-306 L3,-282 Z') : Pa('M-24,-238 Q0,-276 24,-238 L20,-232 L-20,-232 Z');
      body += G(foe ? Pa('M-6,-262 Q-46,-262 -62,-212 Q-38,-244 -4,-250 Z') : Pa('M0,-270 Q18,-320 52,-336 Q30,-300 8,-268 Z'), dk(kp));
    } else if (kind === 'king') {
      body += Pa('M-30,-196 Q0,-212 30,-196 L42,-70 L64,-6 L-64,-6 L-42,-70 Z') + head;
      body += foe
        ? Pa('M-30,-242 L30,-242 L28,-230 L-28,-230 Z') + Pa('M-22,-242 Q0,-304 22,-242 Z') + Ci(0, -300, 6)
        : Pa('M-20,-244 L-22,-262 L22,-262 L20,-244 Z') +
          Pa('M-40,-262 L40,-262 L38,-272 L-38,-272 Z') +
          Ln(-36, -266, -36, -238, 3) +
          Ln(36, -266, 36, -238, 3) +
          Ln(-28, -266, -28, -244, 3) +
          Ln(28, -266, 28, -244, 3);
    } else if (kind === 'mandarin') {
      body += Pa('M-28,-196 Q0,-210 28,-196 L38,-60 L52,-6 L-52,-6 L-38,-60 Z') + head;
      body += foe
        ? Pa('M-26,-242 L26,-242 L24,-232 L-24,-232 Z') + Pa('M-22,-242 Q0,-272 22,-242 Z') + Ci(0, -272, 6)
        : Pa('M-20,-238 Q-20,-264 0,-266 Q20,-264 20,-238 Z') + Pa('M-18,-254 L-60,-266 Q-67,-260 -60,-253 L-18,-245 Z') + Pa('M18,-254 L60,-266 Q67,-260 60,-253 L18,-245 Z');
    } else if (kind === 'monk') {
      body += Pa('M-30,-196 Q0,-210 30,-196 L40,-60 L46,-8 L-46,-8 L-40,-60 Z') + Ci(0, -234, 21) + Pa('M-6,-214 L6,-214 L5,-200 L-5,-200 Z');
    } else if (kind === 'woman') {
      body += Pa('M-22,-116 L-20,-190 Q0,-200 20,-190 L22,-116 Z') + Pa('M8,-122 L32,-30 L12,-28 L0,-120 Z') + Pa('M-8,-122 L-32,-30 L-12,-28 L0,-120 Z');
      body += Ci(0, -228, 18) + Pa('M-6,-212 L6,-212 L5,-198 L-5,-198 Z') + Pa('M-12,-234 Q-28,-200 -20,-160 L-12,-166 Q-16,-206 -4,-230 Z') + Pa('M-46,-222 L0,-266 L46,-222 Q0,-214 -46,-222 Z');
    } else if (kind === 'villager' || kind === 'child') {
      body += Pa('M-28,-104 L-24,-192 Q0,-204 24,-192 L28,-104 Z') + head;
      body += kind === 'child' ? Ci(-10, -252, 6) + Ci(0, -256, 6) + Ci(10, -252, 6) : Pa('M-50,-224 L0,-272 L50,-224 Q0,-216 -50,-224 Z');
    } else {
      body += Pa('M-30,-92 L-24,-190 Q0,-204 24,-190 L30,-92 Z') + head;
      body += foe
        ? Pa('M-27,-240 L27,-240 L25,-231 L-25,-231 Z') + Pa('M-20,-240 Q-21,-268 0,-271 Q21,-268 20,-240 Z') + Pa('M-3,-268 L0,-292 L3,-268 Z') + Pa('M-20,-236 L-32,-204 L-14,-210 Z')
        : Pa('M-30,-236 Q0,-262 30,-236 L26,-230 L-26,-230 Z');
    }
    var back = Pa('M-22,-184 L-36,-120 L-27,-116 L-14,-178 Z');
    if (kind === 'general') back = Pa('M-30,-190 L-44,-120 L-34,-116 L-20,-186 Z') + Ln(-40, -118, -12, -40, 7);
    if (robe) back = Pa('M-24,-188 Q-52,-160 -50,-118 L-30,-116 Q-30,-150 -16,-178 Z');
    var front;
    var carry = ea && kind === 'villager' && f.n % 2 === 1 && pose === 'stand';
    var armS = Pa('M22,-180 L40,-120 L32,-116 L16,-170 Z');
    var armU = Pa('M22,-190 L50,-258 L61,-252 L32,-180 Z');
    if (pose === 'flag') {
      kf = key();
      front = Pa('M22,-190 L64,-224 L70,-214 L28,-178 Z') + Ln(70, -140, 70, -470, 7) + G(ea ? Pa('M70,-470 L190,-458 Q170,-430 190,-402 L70,-410 Z', Fl(flagC)) : cloth(70, -470, 120, 64, rg, foe), dk(kf));
    } else if (!ea && pose === 'sword' && rg !== 'eu') front = armU + (rg === 'me' ? Pa('M50,-258 Q62,-330 108,-374 Q76,-322 61,-254 Z') : Ln(56, -256, 78, -326, 9)) + Ln(44, -262, 68, -250, 6);
    else if (!ea && kind === 'soldier' && pose !== 'point' && pose !== 'bow' && pose !== 'sword') {
      if (rg === 'me') front = armS + Ln(38, 20, 38, -352, 7) + Pa('M38,-346 Q66,-340 70,-306 Q52,-322 38,-318 Z') + Pa('M34,-352 L38,-384 L42,-352 Z');
      else if (rg === 'ro') front = armS + Ln(38, 20, 38, -300, 7) + Ln(38, -300, 38, -368, 3.5) + Pa('M33,-366 L38,-394 L43,-366 Z');
      else front = armS + Ln(38, 20, 38, -364, 7) + Pa('M30,-362 L38,-408 L46,-362 Z');
    } else if (!ea && kind === 'monk' && pose === 'stand') {
      var hand = Pa('M24,-188 L44,-128 L36,-122 L18,-178 Z');
      if (rg === 'eu') front = hand + Ln(42, 8, 42, -334, 6) + Ln(24, -302, 60, -302, 6);
      else if (rg === 'me') front = hand + Ln(42, 8, 42, -296, 6) + Ci(42, -300, 8);
      else front = hand + Ln(42, 8, 42, -270, 6) + Pa('M39,-268 Q38,-314 66,-310 Q78,-300 66,-290 Q60,-300 50,-294 Q47,-282 47,-268 Z');
    } else if (!ea && kind === 'king' && pose === 'stand' && rg === 'eu') front = Pa('M24,-188 Q58,-162 56,-122 L34,-118 Q36,-150 18,-176 Z') + Ln(48, -120, 60, -270, 6) + cross(61, -284, 0.9);
    else if (!ea && kind === 'villager' && f.n % 2 === 1 && pose === 'stand')
      front = armS + Ln(40, 16, 40, -300, 5) + (rg === 'eu' ? Ln(28, -300, 52, -300, 4) + Ln(28, -300, 28, -334, 3) + Ln(40, -300, 40, -340, 3) + Ln(52, -300, 52, -334, 3) : '');
    else if (pose === 'point') front = Pa('M22,-192 L98,-206 L100,-194 L24,-178 Z') + Ci(103, -200, 7);
    else if (pose === 'sword') front = Pa('M22,-190 L50,-258 L61,-252 L32,-180 Z') + Ln(56, -256, 92, -372, 6) + Ln(44, -262, 68, -250, 6);
    else if (pose === 'bow') front = Pa('M20,-188 L46,-146 L38,-138 L14,-176 Z') + Ci(44, -142, 7);
    else if (kind === 'soldier') front = Pa('M22,-180 L40,-120 L32,-116 L16,-170 Z') + Ln(38, 20, 38, -360, 7) + Pa('M30,-360 L38,-400 L46,-360 Z');
    else if (kind === 'general') front = Pa('M24,-188 L44,-124 L35,-120 L18,-178 Z') + Ln(40, -122, 80, -26, 7) + Ln(28, -130, 52, -114, 6);
    else if (kind === 'king' || kind === 'mandarin') front = Pa('M24,-188 Q58,-162 56,-122 L34,-118 Q36,-150 18,-176 Z') + Pa('M42,-120 L50,-176 L58,-174 L50,-118 Z');
    else if (kind === 'monk') front = Pa('M24,-188 L44,-128 L36,-122 L18,-178 Z') + Ln(42, 8, 42, -320, 6) + '<circle cx="42" cy="-334" r="14" fill="none" stroke="currentColor" stroke-width="5"/>';
    else if (carry)
      front =
        Pa('M22,-186 L42,-198 L46,-190 L26,-176 Z') +
        Ln(-96, -196, 96, -196, 6) +
        Ln(-84, -196, -96, -112, 2.5) +
        Ln(-84, -196, -72, -112, 2.5) +
        Ln(84, -196, 72, -112, 2.5) +
        Ln(84, -196, 96, -112, 2.5) +
        Pa('M-108,-114 L-60,-114 L-66,-78 L-102,-78 Z') +
        Pa('M60,-114 L108,-114 L102,-78 L66,-78 Z');
    else front = Pa('M22,-184 L36,-120 L27,-116 L14,-178 Z');
    var up = G(back, dk(ka2)) + body + G(front, dk(ka1));
    var svg = '<g' + dk(kb) + '>' + G(legs1, dk(kl1)) + G(legs2, dk(kl2)) + '<g' + (pose === 'bow' ? ' transform="rotate(24 0 -100)"' : '') + '>' + G(up, dk(kup)) + '</g></g>';
    var r0 = rnd();
    var r1 = rnd();
    AN.push(function (tl, D) {
      var walk = opt.walk && pose !== 'bow';
      loop(tl, E(kup), { scaleY: 1 }, { scaleY: 1.014 }, 1.7 + r0 * 0.7, '0 -96', r1 * 0.6, D);
      if (kc) loop(tl, E(kc), { skewX: 0 }, { skewX: -8 }, 0.8 + r0 * 0.2, '-12 -190', 0, D);
      if (kp) loop(tl, E(kp), { rotation: 0 }, { rotation: foe ? 9 : -10 }, 0.7 + r1 * 0.2, plumeO, 0, D);
      if (kf) loop(tl, E(kf), { skewY: 0, scaleX: 1 }, { skewY: -6, scaleX: 0.93 }, opt.battle ? 0.36 : 0.55, '70 -440', r0 * 0.3, D);
      var arm = E(ka1);
      if (pose === 'flag' && opt.raise) tw(tl, arm, { rotation: 28, svgOrigin: '26 -190' }, { rotation: 0, svgOrigin: '26 -190', duration: 1.1, ease: 'back.out(1.6)' }, 0.9 + r1 * 0.4);
      else if (pose === 'sword') loop(tl, arm, { rotation: opt.battle ? -12 : 0 }, { rotation: opt.battle ? 20 : -6 }, opt.battle ? 0.42 : 1.1, '24 -186', r0 * 0.3, D);
      else if (pose === 'point') loop(tl, arm, { rotation: 0 }, { rotation: -5 }, 1.3, '24 -186', r0 * 0.4, D);
      else if (opt.battle && kind === 'soldier' && pose === 'stand') loop(tl, arm, { rotation: 0 }, { rotation: -16 }, 0.45 + r0 * 0.1, '20 -176', r1 * 0.4, D);
      else if (walk && pose !== 'flag' && !carry) loop(tl, arm, { rotation: -9 }, { rotation: 11 }, 0.5, '20 -184', 0, D);
      if (walk) {
        if (!robe) {
          loop(tl, E(kl1), { rotation: -16 }, { rotation: 16 }, 0.5, '-9 -96', 0, D);
          loop(tl, E(kl2), { rotation: 16 }, { rotation: -16 }, 0.5, '11 -96', 0, D);
          loop(tl, E(ka2), { rotation: 10 }, { rotation: -10 }, 0.5, '-20 -184', 0, D);
        }
        loop(tl, E(kb), { y: 0 }, { y: -5 }, 0.25, '', 0, D);
        tw(tl, E(kb), { x: 0 }, { x: opt.dist, duration: D, ease: opt.advance ? 'power1.inOut' : 'none' }, 0);
      }
    });
    return svg;
  }
  function horse(f, opt, rider) {
    var kb = key();
    var kfl = key();
    var kbl = key();
    var kn = key();
    var kt = key();
    var kr = key();
    var kf = null;
    var foe = f.foe;
    var o = G(Pa('M52,-70 L60,-36 L56,0 L66,0 L70,-36 L66,-72 Z') + Pa('M70,-70 L84,-38 L86,0 L96,0 L94,-40 L82,-74 Z'), dk(kfl));
    o += G(Pa('M-80,-70 L-86,-36 L-80,0 L-70,0 L-74,-38 L-64,-72 Z') + Pa('M-62,-70 L-58,-36 L-66,0 L-56,0 L-46,-36 L-48,-72 Z'), dk(kbl));
    o += G(Pa('M-100,-104 Q-140,-90 -132,-24 Q-120,-62 -96,-90 Z'), dk(kt));
    o += Pa('M-96,-112 C-60,-128 30,-128 62,-118 L72,-112 C80,-90 76,-74 64,-66 C30,-58 -40,-58 -78,-64 C-100,-70 -112,-92 -96,-112 Z');
    o += G(
      Pa('M46,-118 C58,-150 76,-180 98,-196 L104,-212 L112,-198 C126,-190 140,-172 152,-158 C156,-150 150,-143 142,-145 C130,-150 118,-152 106,-148 C96,-130 86,-110 76,-96 Z') +
        Pa('M50,-126 C60,-156 74,-176 92,-190 L84,-178 L78,-170 L72,-160 L66,-150 Z'),
      dk(kn),
    );
    o = G(o, ' transform="scale(1.5)"');
    if (rider) {
      var r = '';
      r += Pa('M-20,-126 L24,-118 L30,-76 L16,-74 L10,-104 L-18,-108 Z') + Pa('M-24,-122 L-18,-210 Q-2,-222 14,-210 L18,-122 Z') + Ci(-2, -246, 18) + Pa('M-8,-228 L4,-228 L3,-214 L-7,-214 Z');
      if (f.rg && f.rg !== 'ea') r += G(hatOf(f.lead ? 'general' : 'soldier', f.rg, f) + (f.lead && PLUME[f.rg] ? Pa(PLUME[f.rg][0]) : ''), ' transform="translate(-2,-14)"');
      else if (f.lead)
        r += foe
          ? Pa('M-28,-254 Q-2,-264 24,-254 L24,-244 L-28,-244 Z') + Pa('M-20,-256 Q-2,-298 16,-256 Z') + Pa('M-5,-292 L-2,-314 L1,-292 Z')
          : Pa('M-26,-252 Q-2,-290 22,-252 L18,-246 L-22,-246 Z') + Pa('M-2,-284 Q16,-334 50,-350 Q28,-314 6,-282 Z');
      else
        r += foe
          ? Pa('M-27,-254 L23,-254 L21,-245 L-25,-245 Z') + Pa('M-20,-254 Q-20,-282 -2,-285 Q18,-282 18,-254 Z') + Pa('M-5,-282 L-2,-304 L1,-282 Z')
          : Pa('M-30,-250 Q-2,-276 26,-250 L22,-244 L-26,-244 Z');
      if (f.pose === 'flag') {
        kf = key();
        r += Pa('M8,-204 L44,-232 L50,-222 L14,-192 Z') + Ln(50, -150, 50, -470, 7) + G(f.rg && f.rg !== 'ea' ? cloth(50, -470, 120, 64, f.rg, foe) : Pa('M50,-470 L170,-458 Q150,-430 170,-402 L50,-410 Z', Fl(foe ? P.flagE : P.flag)), dk(kf));
      } else if (f.pose === 'sword') r += Pa('M8,-204 L36,-266 L47,-260 L18,-194 Z') + Ln(42, -264, 80, -380, 6);
      else r += Pa('M8,-202 L40,-160 L32,-154 L4,-190 Z') + Ln(-70, -60, 120, -340, 7) + Pa('M112,-346 L134,-372 L124,-336 Z');
      o += G(G(r, dk(kr)), ' transform="translate(0,-64)"');
    }
    var r0 = rnd();
    AN.push(function (tl, D) {
      var moving = opt.walk;
      if (moving) {
        loop(tl, E(kfl), { rotation: -22 }, { rotation: 18 }, 0.36, '64 -72', 0, D);
        loop(tl, E(kbl), { rotation: 18 }, { rotation: -16 }, 0.36, '-62 -72', 0, D);
        loop(tl, E(kb), { y: 0 }, { y: -8 }, 0.18, '', 0, D);
        tw(tl, E(kb), { x: 0 }, { x: opt.dist, duration: D, ease: opt.advance ? 'power1.inOut' : 'none' }, 0);
      } else loop(tl, E(kfl), { rotation: 0 }, { rotation: -10 }, 0.9 + r0 * 0.3, '64 -72', 1 + r0, D);
      loop(tl, E(kn), { rotation: -2 }, { rotation: 5 }, moving ? 0.36 : 1.1 + r0 * 0.3, '60 -110', 0, D);
      loop(tl, E(kt), { rotation: -4 }, { rotation: 8 }, 0.9 + r0 * 0.4, '-98 -100', 0, D);
      if (rider) loop(tl, E(kr), { rotation: 0 }, { rotation: moving ? 3 : 1.5 }, moving ? 0.36 : 1.6, '0 -120', 0, D);
      if (kf) loop(tl, E(kf), { skewY: 0, scaleX: 1 }, { skewY: -6, scaleX: 0.93 }, opt.battle ? 0.36 : 0.55, '50 -440', 0, D);
    });
    return '<g' + dk(kb) + '>' + o + '</g>';
  }
  /* A war elephant: a caparison in the side's colour, a howdah in its region's style, a driver on its neck, and riders taken from the cast. */
  function elephant(f, opt, riders) {
    var foe = f.foe;
    var rg = f.rg || 'ea';
    var kb = key();
    var kl = [key(), key(), key(), key()];
    var kh = key();
    var ke = key();
    var kt = key();
    var ear = mix(opt.ink || P.ink, P.mid, 0.2);
    var legs = [
      ['M-112,-150 L-116,0 L-82,0 L-78,-150 Z', '-95 -150'],
      ['M-76,-150 L-72,0 L-38,0 L-40,-150 Z', '-58 -150'],
      ['M72,-150 L68,0 L102,0 L106,-150 Z', '88 -150'],
      ['M106,-150 L110,0 L144,0 L140,-150 Z', '124 -150'],
    ];
    var o = '';
    for (var i = 0; i < 4; i++) o += G(Pa(legs[i][0]), dk(kl[i]));
    o += G(Pa('M-142,-232 Q-170,-190 -162,-130 L-154,-132 Q-158,-186 -134,-224 Z'), dk(kt));
    o += Pa('M-136,-136 C-162,-200 -152,-292 -60,-320 C10,-338 112,-324 152,-282 C172,-252 168,-190 152,-148 C122,-116 -100,-110 -136,-136 Z');
    o += G(
      Pa('M126,-300 C162,-332 224,-314 236,-264 C244,-230 234,-196 222,-170 C212,-138 214,-98 226,-64 C232,-46 248,-38 258,-46 L266,-36 C246,-20 222,-28 208,-58 C194,-100 194,-142 198,-178 L150,-170 Z') +
        Pa('M210,-176 Q240,-156 272,-182 Q244,-166 216,-188 Z', Fl(IVORY)),
      dk(kh),
    );
    o += G(Pa('M166,-296 C132,-300 116,-238 132,-196 C144,-176 174,-198 182,-234 Z', Fl(ear)), dk(ke));
    var fc = flagCol(rg, foe);
    o += Pa('M-96,-318 L76,-324 L92,-226 Q0,-206 -110,-226 Z', Fl(fc)) + Pa('M-110,-226 Q0,-206 92,-226 L91,-214 Q0,-194 -109,-214 Z', Fl(EMB));
    if (rg === 'eu') o += cross(-8, -270, 1.6, EMB);
    else if (rg === 'me') o += crescent(-8, -270, 1.6, PALE, fc);
    var rid = '';
    for (var r = 0; r < riders.length; r++) rid += G(figure(riders[r], { walk: false, battle: opt.battle, raise: false, ink: opt.ink }), at(-30 + r * 56, -322, 0.82));
    o += rid + Rc(-80, -394, 150, 74) + Rc(-86, -400, 162, 10);
    if (!riders.length) {
      if (rg === 'ea') o += Ln(-72, -400, -72, -452, 5) + Ln(64, -400, 64, -452, 5) + roof(78, 28, -452);
      else if (rg === 'me') o += Ln(-72, -400, -72, -448, 5) + Ln(64, -400, 64, -448, 5) + domeShape(-4, -446, 78, 56) + finial(-4, -508, 0.8);
      else o += merlons(-86, 76, -400, 16, 29, 20);
    }
    // The driver, sitting on the neck with a goad.
    var dr = { kind: 'villager', n: 0, rg: rg };
    o += G(Pa('M-24,-100 L-24,-192 Q0,-204 24,-192 L24,-100 Z') + Pa('M-18,-104 L30,-40 L44,-48 L4,-108 Z') + Ci(0, -232, 20) + hatOf(rg === 'ea' ? 'villager' : rg === 'eu' ? 'soldier' : 'villager', rg, dr) + Ln(20, -170, 86, -120, 6), at(118, -258, 0.6));
    var r0 = rnd();
    AN.push(function (tl, D) {
      var moving = opt.walk;
      if (moving) {
        for (var j = 0; j < 4; j++) loop(tl, E(kl[j]), { rotation: j === 0 || j === 3 ? -9 : 9 }, { rotation: j === 0 || j === 3 ? 9 : -9 }, 0.7, legs[j][1], 0, D);
        loop(tl, E(kb), { y: 0 }, { y: -6 }, 0.35, '', 0, D);
        tw(tl, E(kb), { x: 0 }, { x: opt.dist, duration: D, ease: opt.advance ? 'power1.inOut' : 'none' }, 0);
      }
      loop(tl, E(kh), { rotation: -1.5 }, { rotation: 2.5 }, moving ? 0.7 : 1.6 + r0 * 0.4, '170 -250', 0, D);
      loop(tl, E(ke), { scaleX: 1 }, { scaleX: 0.86 }, 1.1 + r0 * 0.4, '180 -250', 0.3, D);
      loop(tl, E(kt), { rotation: -6 }, { rotation: 8 }, 1 + r0 * 0.3, '-136 -228', 0, D);
    });
    return '<g' + dk(kb) + '>' + o + '</g>';
  }
  /* A siege bombard on its wooden bed, the barrel raised toward the other side. In a battle it fires: a flash, a recoil, and smoke. */
  var GUNSMOKE = mix(P.smoke, P.mist, 0.45);
  function cannon(f, opt, g) {
    var kbar = key();
    var kfl = key();
    // The carriage: a trail sloping to the axle, one great spoked wheel; the barrel rests above the axle.
    var o = Pa('M-186,0 L-180,-16 L10,-108 L28,-92 Z') + Rc(-30, -130, 70, 26);
    var wheel = Ci(0, 0, 62, ' fill="none" stroke="currentColor" stroke-width="12"') + Ci(0, 0, 14);
    for (var sp = 0; sp < 4; sp++) wheel += Ln(Math.cos((sp * Math.PI) / 4) * 58, Math.sin((sp * Math.PI) / 4) * 58, -Math.cos((sp * Math.PI) / 4) * 58, -Math.sin((sp * Math.PI) / 4) * 58, 7);
    o += G(wheel, at(10, -62));
    var barrel =
      Pa('M-164,-152 L118,-166 L128,-174 L146,-174 L146,-78 L128,-78 L118,-86 L-164,-100 Q-188,-126 -164,-152 Z') + Rc(-112, -160, 14, 68) + Rc(-22, -164, 14, 76) + Rc(66, -168, 14, 84) + Pa('M-150,-154 L-150,-178 L-130,-178 L-130,-154 Z');
    var flash = Pa('M146,-126 L184,-152 L176,-136 L222,-126 L176,-116 L184,-100 Z', Fl(FIRE[1])) + Ci(158, -126, 18, Fl(FIRE[2]));
    o += '<g transform="rotate(-9 0 -126)"><g' + dk(kbar) + '>' + barrel + '<g' + dk(kfl) + ' opacity="0">' + flash + '</g></g></g>';
    if (opt.battle) {
      var ph = rnd();
      var cyc = 2.6 + rnd() * 0.6;
      for (var p = 0; p < 4; p++) puffAt(g.L, g.x, g.y, g.s * (1.2 - p * 0.15), cyc, GUNSMOKE, 150, 0.7, g.dir, (ph + p * 0.06) % 1, 1.8);
      AN.push(function (tl, D) {
        var eb = E(kbar);
        var ef = E(kfl);
        if (!eb || !ef) return;
        proc(
          tl,
          0,
          cyc,
          function (pp) {
            var q = (pp + ph) % 1;
            var rx = q < 0.05 ? -22 * (q / 0.05) : -22 * Math.max(0, 1 - (q - 0.05) / 0.35);
            eb.setAttribute('transform', 'translate(' + f1(rx) + ',0)');
            ef.setAttribute('opacity', q < 0.1 ? f1(1 - q / 0.1) : '0');
          },
          Math.max(0, Math.floor(D / cyc) - 1),
        );
      });
    }
    return o;
  }
  function banners(n, foe, x0, x1, y, s, rg) {
    var o = '';
    for (var i = 0; i < n; i++) {
      var x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
      var hh = 450 + (i % 2) * 46;
      var k = key();
      o +=
        '<g' +
        at(x, y, s, foe) +
        '>' +
        Ln(0, 20, 0, -hh, 7) +
        Pa('M0,' + -hh + ' l-8,-22 l16,0 Z') +
        G(rg && rg !== 'ea' ? cloth(0, -hh + 6, 100, 60, rg, foe, i % 2 === 1) : Pa('M0,' + (-hh + 6) + ' L100,' + (-hh + 14) + ' Q86,' + (-hh + 40) + ' 100,' + (-hh + 66) + ' L0,' + (-hh + 60) + ' Z', Fl(foe ? P.flagE : P.flag)), dk(k)) +
        '</g>';
      (function (k, hh, i) {
        AN.push(function (tl, D) {
          loop(tl, E(k), { skewY: 0, scaleX: 1 }, { skewY: -7, scaleX: 0.9 }, A.battle ? 0.34 : 0.5 + (i % 3) * 0.07, '0 ' + (-hh + 30), i * 0.11, D);
        });
      })(k, hh, i);
    }
    return o;
  }
  function reeds(x0, x1, count, hMin, hMax, col) {
    var r = gen(hB + Math.round(x0));
    var o = '';
    for (var i = 0; i < count; i++) {
      var x = x0 + ((x1 - x0) * i) / count + r() * 12;
      var h = hMin + r() * (hMax - hMin);
      var bend = 20 + r() * 40;
      var k = key();
      o += Pa(
        'M' +
          f1(x) +
          ',' +
          (H + 4) +
          ' Q' +
          f1(x + 4) +
          ',' +
          f1(H - h * 0.6) +
          ' ' +
          f1(x + bend) +
          ',' +
          f1(H - h) +
          ' Q' +
          f1(x + 10) +
          ',' +
          f1(H - h * 0.55) +
          ' ' +
          f1(x + 8) +
          ',' +
          (H + 4) +
          ' Z',
        dk(k) + Fl(col),
      );
      (function (k, i) {
        var p = 0.9 + (i % 5) * 0.12;
        AN.push(function (tl, D) {
          loop(tl, E(k), { skewX: 0 }, { skewX: i % 2 ? -6 : -10 }, p, '50% 100%', (i % 7) * 0.08, D);
        });
      })(k, i);
    }
    return o;
  }

  /* ---------- the stage ---------- */
  var HZ = WATER ? 728 : 742;
  var MB = WATER ? HZ + 8 : 778;
  var MS = (WATER ? 0.5 : 0.72) * KS;
  var FY = WATER ? 752 : 842;
  var defs = '';
  var puffs = [];
  var smokeFx = '';
  var smokeP = '';
  /** A puff of smoke, rising and spreading on a loop; `dir` sends it forward for a side facing left. */
  function puffAt(L, x, y, s, cyc, color, rise, op, dir, ph, grow) {
    var k = key();
    puffs.push({ k: k, x: x, y: y, s: s, cyc: cyc, rise: rise, op: op, ph: ph == null ? puffs.length * 0.37 : ph, dir: dir || 1, grow: grow || 1 });
    var c = '<circle' + dk(k) + ' cx="' + f1(x) + '" cy="' + f1(y) + '" r="10" fill="' + color + '" opacity="0"/>';
    if (L === 'fx') smokeFx += c;
    else smokeP += c;
  }
  var stops = '';
  for (var gi = 0; gi < P.sky.length; gi += 2) stops += '<stop offset="' + P.sky[gi + 1] + '" stop-color="' + P.sky[gi] + '"/>';
  defs += '<linearGradient id="' + ID + 'sky" x1="0" y1="0" x2="0" y2="1">' + stops + '</linearGradient>';
  defs += '<radialGradient id="' + ID + 'sun"><stop offset="0" stop-color="' + P.sun[0] + '"/><stop offset=".46" stop-color="' + P.sun[1] + '"/><stop offset=".7" stop-color="' + P.sun[2] + '"/><stop offset=".72" stop-color="' + P.sun[2] + '" stop-opacity="0"/></radialGradient>';
  defs += '<radialGradient id="' + ID + 'glow"><stop offset="0" stop-color="' + P.glow + '" stop-opacity="' + P.go + '"/><stop offset="1" stop-color="' + P.glow + '" stop-opacity="0"/></radialGradient>';
  defs += '<linearGradient id="' + ID + 'water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.water[0] + '"/><stop offset=".35" stop-color="' + P.water[1] + '"/><stop offset="1" stop-color="' + P.water[2] + '"/></linearGradient>';
  defs += '<linearGradient id="' + ID + 'front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.front[0] + '" stop-opacity=".96"/><stop offset=".5" stop-color="' + P.front[1] + '"/><stop offset="1" stop-color="' + P.front[2] + '"/></linearGradient>';
  defs += '<linearGradient id="' + ID + 'ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.ground[0] + '"/><stop offset="1" stop-color="' + P.ground[1] + '"/></linearGradient>';
  defs += '<linearGradient id="' + ID + 'mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.mist + '" stop-opacity="0"/><stop offset=".5" stop-color="' + P.mist + '" stop-opacity=".9"/><stop offset="1" stop-color="' + P.mist + '" stop-opacity="0"/></linearGradient>';
  defs += '<filter id="' + ID + 'soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>';
  defs += '<radialGradient id="' + ID + 'fg"><stop offset="0" stop-color="#ffb04a" stop-opacity=".55"/><stop offset=".45" stop-color="#ff7a2a" stop-opacity=".22"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>';

  // The sky, and what hangs in it.
  CUR = RB;
  var skyS = Rc(-300, -200, W + 600, H + 400, ' fill="url(#' + ID + 'sky)"');
  if (A.burn) {
    defs += '<linearGradient id="' + ID + 'hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a1a" stop-opacity="0"/><stop offset="1" stop-color="#ff6a1a" stop-opacity=".55"/></linearGradient>';
    var khz = key();
    skyS += Rc(-300, HZ - 520, W + 600, 540, dk(khz) + ' fill="url(#' + ID + 'hz)"');
    AN.push(function (tl, D) {
      loop(tl, E(khz), { opacity: 0.7 }, { opacity: 1 }, 0.9, '', 0, D);
    });
  }
  if (T === 'night') {
    var stars = '';
    var twk = [];
    for (var st = 0; st < 110; st++) {
      var sxp = rr(-100, W + 100);
      var syp = rr(-40, HZ - 220) * (0.4 + 0.6 * rnd());
      if (st < 14) {
        var kst = key();
        twk.push(kst);
        stars += Ci(sxp, syp, rr(1.6, 2.6), dk(kst) + Fl('#f4f0ff'));
      } else stars += Ci(sxp, syp, rr(0.7, 1.8), Fl('#e8ecff', f1(rr(0.35, 0.9))));
    }
    skyS += G(stars, RAIN ? ' opacity=".2"' : '');
    AN.push(function (tl, D) {
      for (var i = 0; i < twk.length; i++) loop(tl, E(twk[i]), { opacity: 1 }, { opacity: 0.25 }, 0.7 + (i % 4) * 0.23, '', (i % 5) * 0.2, D);
    });
  }
  var kSun = key();
  var sunX = P.sx * W;
  var sunCore =
    T === 'night'
      ? Ci(0, 0, P.sr, Fl(P.sun[1])) + Ci(-P.sr * 0.3, -P.sr * 0.2, P.sr * 0.22, Fl(P.sun[2], 0.5)) + Ci(P.sr * 0.25, P.sr * 0.3, P.sr * 0.16, Fl(P.sun[2], 0.45)) + Ci(P.sr * 0.35, -P.sr * 0.35, P.sr * 0.1, Fl(P.sun[2], 0.4))
      : Ci(0, 0, P.sr, ' fill="url(#' + ID + 'sun)"');
  skyS += '<g' + at(sunX, P.sy) + (P.sunO !== 1 ? ' opacity="' + P.sunO + '"' : '') + '><g' + dk(kSun) + '>' + Ci(0, 0, P.sr * (T === 'night' ? 4 : 2.3), ' fill="url(#' + ID + 'glow)"') + sunCore + '</g></g>';
  var kClouds = key();
  var cl = '';
  var nClouds = RAIN ? 8 : T === 'day' ? 5 : 4;
  for (var ci = 0; ci < nClouds; ci++) {
    var cx0 = rr(-200, W) + (ci * W) / nClouds / 3;
    var cy0 = rr(140, RAIN ? 420 : 380);
    var cw = rr(300, 800) * (RAIN ? 1.4 : 1);
    var two = ci % 2 === 1;
    var ch = RAIN ? rr(30, 70) : rr(16, 40);
    cl += Pa(
      'M' + f1(cx0) + ',' + f1(cy0) + ' Q' + f1(cx0 + cw * 0.22) + ',' + f1(cy0 - ch * 1.6) + ' ' + f1(cx0 + cw * 0.45) + ',' + f1(cy0 - ch * 0.3) + ' Q' + f1(cx0 + cw * 0.68) + ',' + f1(cy0 - ch * 1.3) + ' ' + f1(cx0 + cw) + ',' + f1(cy0) + ' L' + f1(cx0 + cw) + ',' + f1(cy0 + 14) + ' L' + f1(cx0) + ',' + f1(cy0 + 14) + ' Z',
      Fl(two ? P.cloud2 : P.cloud, two ? P.co2 : P.co),
    );
  }
  skyS += G(cl, dk(kClouds));
  var kBirds = null;
  if (T !== 'night' && !RAIN) {
    kBirds = key();
    skyS += G(Pa('M0,0 q12,-12 24,0 q12,-12 24,0') + Pa('M60,30 q10,-10 20,0 q10,-10 20,0') + Pa('M-50,40 q9,-9 18,0 q9,-9 18,0') + Pa('M110,-10 q8,-8 16,0 q8,-8 16,0'), dk(kBirds) + ' fill="none" stroke="' + P.bird + '" stroke-width="3.5" stroke-linecap="round"');
  }

  // The hills, far and middle: karst towers in East Asia, ranges and headlands elsewhere.
  var kFar = key();
  var kMid = key();
  var cnt = Math.max(3, Math.round((9 * W) / 1920));
  var asian = RG === 'ea';
  var farD;
  var midD = '';
  if (S.mountains && !S.sea) {
    var lowSun = P.sy > 450 && P.sunO === 1;
    var dip1 = lowSun ? { x: P.sx * W, w: 230, k: 0.62 } : null;
    var dip2 = lowSun ? { x: P.sx * W, w: 300, k: 0.38 } : null;
    farD = asian ? karst(hB % 997, HZ + 7, 140, 300, cnt, -100, W + 100, dip1) : ridge(hB % 997, HZ + 7, 150, 330, cnt, -100, W + 100, dip1);
    midD = asian ? karst((hB % 991) + 8, HZ + 14, 90, 230, Math.max(3, cnt - 2), -100, W + 100, dip2) : ridge((hB % 991) + 8, HZ + 14, 70, 190, Math.max(3, cnt - 2), -100, W + 100, dip2);
  } else if (S.mountains && S.sea) {
    farD = asian ? islands(hB % 997, HZ + 4, 120, 280) : headlands(hB % 997, HZ + 4, 110, 240);
    midD = asian ? islands((hB % 991) + 5, HZ + 6, 60, 170) : headlands((hB % 991) + 5, HZ + 6, 50, 150);
  } else if (S.sea) farD = '';
  else {
    farD = hills(hB % 997, HZ + 6, 40, 110, cnt, -100, W + 100);
    midD = hills((hB % 991) + 3, HZ + 10, 14, 50, Math.max(3, cnt - 3), -100, W + 100);
  }
  var hillS = '';
  if (farD) hillS += Pa(farD, dk(kFar) + Fl(P.far, P.fo));
  var kMist = [];
  if (MIST) {
    var km1 = key();
    kMist.push(km1);
    hillS += Rc(-300, HZ - 250, W + 600, 170, dk(km1) + ' fill="url(#' + ID + 'mist)" opacity=".55"');
  }
  if (midD) hillS += Pa(midD, dk(kMid) + Fl(P.mid));
  if (S.sea) hillS += Rc(-300, HZ - 40, W + 600, 60, ' fill="url(#' + ID + 'mist)" opacity=".35"');

  // The middle ground: a far bank or the plain, and what stands on it. Each thing belongs to the layer whose value asked for it.
  var forestBand = '';
  if (S.forest) {
    var fr = gen(hB + 17);
    var fb = WATER ? HZ + 4 : HZ + 18;
    var fd = 'M-100,' + (fb + 40) + ' L-100,' + fb;
    var fxp = -100;
    while (fxp < W + 100) {
      var rad = 24 + fr() * 46;
      fd += ' Q' + f1(fxp + rad) + ',' + f1(fb - rad * (2 + fr())) + ' ' + f1(fxp + rad * 2) + ',' + f1(fb - fr() * 14);
      fxp += rad * 2;
    }
    forestBand = Pa(fd + ' L' + f1(fxp) + ',' + (fb + 40) + ' Z', Fl(mix(P.mid, P.near, 0.4)));
  }
  function building(kind, rg, burn, foe) {
    var e = rg === 'ea';
    if (kind === 'house') return e ? house(burn) : houseW(rg, burn);
    if (kind === 'temple') return e ? temple(burn) : rg === 'eu' ? church(burn) : rg === 'me' ? mosque(burn) : templeRo(burn);
    if (kind === 'church') return church(burn);
    if (kind === 'mosque') return mosque(burn);
    if (kind === 'palace') return e ? palace(burn) : palaceW(rg, burn);
    if (kind === 'tent') return e ? tent(foe, burn) : tentW(rg, foe, burn);
    if (kind === 'tower') return towerOf(rg, burn);
    if (kind === 'dome') return domeOf(rg, burn);
    return null;
  }
  var BEHIND = { palace: 1, dome: 1, church: 1, mosque: 1, tower: 1, temple: 1 };
  var midItems = [];
  function addMid(kind, side, L) {
    var rg = side === 'foe' ? FRG : RG;
    var b = kind === 'tree0' || kind === 'tree1' ? null : building(kind, rg, A.burn, side === 'foe');
    midItems.push({ kind: kind, side: side, L: L, b: b, rg: rg, w: b ? b.w : TREE_W[rg][kind === 'tree1' ? 1 : 0] });
  }
  if (S.palace) addMid('palace', '', 'back');
  else if (countProp('palace')) addMid('palace', '', 'props');
  for (var pi = 0; pi < props.length; pi++) {
    var pp = props[pi];
    if (!/^(house|temple|tent|dome|church|mosque|tower)$/.test(pp.kind)) continue;
    for (var pj = 0; pj < pp.n; pj++) addMid(pp.kind, pp.kind === 'tent' ? pp.side || 'ours' : pp.side, 'props');
  }
  if (S.village) {
    for (var vh = countProp('house'); vh < 3; vh++) addMid('house', '', 'back');
    addMid('tree0', '', 'back');
    addMid('tree1', '', 'back');
    addMid('tree0', '', 'back');
  }
  if (countProp('trees') || S.forest) {
    var tn = Math.max(2, countProp('trees') + 1);
    for (var ti = 0; ti < tn; ti++) addMid(ti % 2 ? 'tree1' : 'tree0', '', countProp('trees') ? 'props' : 'back');
  }
  var wallOn = S.citadel || countProp('wall') > 0;
  var wallL = S.citadel ? 'back' : 'props';
  var taken = [];
  function place(item, idx) {
    var hh = item.L === 'back' ? hB : hP;
    var pref = item.side === 'ours' ? 0.36 : item.side === 'foe' ? 0.64 : item.kind === 'palace' ? 0.5 : 0.18 + ((idx * 0.37 + (hh % 13) / 13) % 1) * 0.64;
    var w = item.w * MS;
    var x = pref * W;
    for (var step = 0; step < 60; step++) {
      var cand = x + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 36;
      if (cand < w / 2 - 40 || cand > W - w / 2 + 40) continue;
      var ok = true;
      for (var i = 0; i < taken.length; i++) if (Math.abs(taken[i][0] - cand) < (taken[i][1] + w) / 2 + 10) ok = false;
      if (ok) {
        taken.push([cand, w]);
        return cand;
      }
    }
    taken.push([x, w]);
    return x;
  }
  var midBackL = [];
  var midFrontL = [];
  for (var mj = 0; mj < midItems.length; mj++) {
    var it = midItems[mj];
    var mx = place(it, mj);
    CUR = it.L === 'back' ? RB : RP;
    if (it.b) {
      var behind = wallOn && BEHIND[it.kind];
      var lift = behind ? -64 * MS : 0;
      var bs = '<g' + at(mx, MB + lift, MS) + ' fill="' + MID_INK + '" color="' + MID_INK + '">' + it.b.svg;
      for (var fi = 0; fi < it.b.fire.length; fi++) {
        var bf = it.b.fire[fi];
        bs += fire(bf[0], bf[1], bf[2], true);
        FP.push({ x: mx + bf[0] * MS, y: MB + lift + bf[1] * MS, s: bf[2] * MS, L: it.L });
      }
      bs += '</g>';
      (behind ? midBackL : midFrontL).push([it.L, bs]);
    } else {
      var broad = it.kind === 'tree1';
      var tsc = MS * (broad ? rr(1.1, 1.5) : rr(1.2, 1.6));
      var tflip = broad && rnd() < 0.5;
      midFrontL.push([it.L, '<g' + at(mx, MB + 4, tsc, tflip) + ' fill="' + mix(MID_INK, P.far, 0.12) + '">' + treeOf(it.rg, broad ? 1 : 0, 300, rr(-30, 40)) + '</g>']);
    }
  }
  var wallS = '';
  if (wallOn) {
    CUR = wallL === 'back' ? RB : RP;
    var wx0 = W * (S.citadel ? 0.16 : 0.3);
    var lx0 = (wx0 - W / 2) / MS;
    var lx1 = (W - wx0 - W / 2) / MS;
    var wb = RG === 'ea' ? wallSpan(lx0, lx1, A.burn) : wallW(RG, lx0, lx1, A.burn);
    wallS = '<g' + at(W / 2, MB + 4, MS) + ' fill="' + MID_INK + '" color="' + MID_INK + '">' + wb.svg;
    for (var wf = 0; wf < wb.fire.length; wf++) {
      var wfp = wb.fire[wf];
      wallS += fire(wfp[0], wfp[1], wfp[2], true);
      FP.push({ x: W / 2 + wfp[0] * MS, y: MB + 4 + wfp[1] * MS, s: wfp[2] * MS, L: wallL });
    }
    wallS += '</g>';
  }

  // Water or land.
  CUR = RB;
  var kShine = key();
  var kW1 = key();
  var kW2 = key();
  var groundS = '';
  if (WATER) {
    groundS += Rc(-300, HZ, W + 600, H - HZ + 60, ' fill="url(#' + ID + 'water)"');
    if (!S.sea || S.mountains)
      groundS += Pa('M-300,' + (HZ + 14) + ' L-300,' + (HZ - 3) + ' Q' + f1(W * 0.3) + ',' + (HZ - 8) + ' ' + f1(W * 0.6) + ',' + (HZ - 2) + ' T' + (W + 300) + ',' + (HZ - 4) + ' L' + (W + 300) + ',' + (HZ + 14) + ' Q' + f1(W * 0.5) + ',' + (HZ + 6) + ' -300,' + (HZ + 14) + ' Z', Fl(mix(P.mid, P.near, 0.3)));
    var sh = '';
    for (var li = 0; li < 10; li++) sh += Ln(sunX - 40 + (li % 3) * 30 - 30, HZ + 24 + li * 18, sunX + 30 + (li % 3) * 30 - 30 + li * 6, HZ + 24 + li * 18, 4, P.shine);
    groundS += G(sh, dk(kShine) + (P.sunO !== 1 ? ' opacity=".3"' : ''));
  } else {
    groundS += Rc(-300, HZ, W + 600, H - HZ + 60, ' fill="url(#' + ID + 'ground)"');
    if (S.fields) {
      var rows = 9;
      var fieldS = '';
      var vpx = W * 0.5;
      var vpy = HZ - 260;
      for (var ri = 0; ri < rows; ri++) {
        var y0 = HZ + 8 + (H - HZ) * Math.pow(ri / rows, 1.6);
        var y1 = HZ + 8 + (H - HZ) * Math.pow((ri + 1) / rows, 1.6);
        var gap = 3 + ri * 1.6;
        fieldS += Rc(-300, y0 + gap, W + 600, Math.max(2, y1 - y0 - gap), Fl(mix(P.paddy[0], P.paddy[1], ri / rows), f1(0.75 - ri * 0.03)));
      }
      for (var di = -8; di <= 8; di++) {
        var xb = vpx + di * W * 0.16;
        var t0 = (HZ + 8 - vpy) / (H - vpy);
        fieldS += Ln(vpx + (xb - vpx) * t0, HZ + 8, xb, H + 10, 3 + Math.abs(di) * 0.4, mix(P.ground[1], P.ground[0], 0.3));
      }
      var tufts = '';
      var trr = gen(hB + 29);
      for (var tj = 0; tj < 140; tj++) {
        var ty = HZ + 30 + Math.pow(trr(), 0.7) * (H - HZ - 30);
        var tx = trr() * W;
        var ts = 0.3 + ((ty - HZ) / (H - HZ)) * 1.1;
        tufts += Pa('M' + f1(tx) + ',' + f1(ty) + ' l' + f1(-6 * ts) + ',' + f1(-14 * ts) + ' M' + f1(tx) + ',' + f1(ty) + ' l0,' + f1(-17 * ts) + ' M' + f1(tx) + ',' + f1(ty) + ' l' + f1(6 * ts) + ',' + f1(-14 * ts));
      }
      fieldS += G(tufts, ' fill="none" stroke="' + mix(P.ground[1], P.ground[0], 0.2) + '" stroke-width="2.4" stroke-linecap="round"');
      groundS += fieldS;
    } else {
      var gr = gen(hB + 31);
      for (var gj = 0; gj < 7; gj++) {
        var gy = HZ + 20 + gj * gj * 6.5;
        groundS += Pa('M-100,' + f1(gy) + ' Q' + f1(W * gr()) + ',' + f1(gy - 8 - gr() * 10) + ' ' + (W + 100) + ',' + f1(gy + gr() * 6), ' fill="none" stroke="' + P.ground[1] + '" stroke-width="' + (2 + gj * 0.6) + '" opacity=".35"');
      }
    }
  }

  // The two sides: who stands where, on a rise of their own. Ships, horses, elephants, cannons and banners go with a side.
  CUR = RC;
  var shipList = { ours: [], foe: [] };
  var wsP = propsOf('warship');
  for (var wi = 0; wi < wsP.length; wi++) for (var wn = 0; wn < wsP[wi].n; wn++) (wsP[wi].side === 'ours' ? shipList.ours : shipList.foe).push('war');
  var ssP = propsOf('sailship');
  for (var si2 = 0; si2 < ssP.length; si2++) {
    var sside = ssP[si2].side || (cast.foe.length || FRG !== RG ? 'foe' : 'ours');
    for (var sn = 0; sn < ssP[si2].n; sn++) shipList[sside].push('sail');
  }
  var shipsFoe = shipList.foe.length;
  function sideOfProp(p) {
    if (p.side) return p.side;
    if (p.kind === 'fire' || p.kind === 'elephant') return cast.foe.length && !cast.ours.length ? 'foe' : 'ours';
    if (p.kind === 'cannon') return cast.foe.length || FRG !== RG ? 'foe' : 'ours';
    return 'ours';
  }
  var sides = {};
  function unitOf(f) {
    if (f.kind === 'elephant') return 400;
    if (f.kind === 'cannon') return 340;
    if (f.kind === 'cavalry' || f.kind === 'horse') return 330;
    if (f.kind === 'fire') return 150;
    if (f.kind === 'child') return 78;
    if (f.pose === 'flag') return 150;
    if (f.kind === 'villager' && f.n % 2 === 1 && f.pose === 'stand' && (f.rg || 'ea') === 'ea') return 210;
    if (ROBE[f.kind]) return 128;
    return 112;
  }
  function isLead(f) {
    return f.kind === 'general' || f.kind === 'king' || f.lead;
  }
  function buildSide(name) {
    var foe = name === 'foe';
    var rg = foe ? FRG : RG;
    var people = cast[name].slice();
    var extra = [];
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (!/^(horse|fire|elephant|cannon)$/.test(p.kind) || sideOfProp(p) !== name) continue;
      var many = p.kind === 'horse' ? p.n : Math.min(p.kind === 'fire' ? 2 : 4, p.n);
      for (var j = 0; j < many; j++) extra.push({ kind: p.kind, foe: foe, n: j, pose: 'stand', rg: rg, riders: [] });
    }
    // Each elephant takes a rider from the people on foot: a leader first, then a flag-bearer.
    for (var e0 = 0; e0 < extra.length; e0++) {
      if (extra[e0].kind !== 'elephant') continue;
      var idx = -1;
      for (var a = 0; a < people.length && idx < 0; a++) if (isLead(people[a])) idx = a;
      for (var a2 = 0; a2 < people.length && idx < 0; a2++) if (people[a2].pose === 'flag') idx = a2;
      if (idx >= 0) extra[e0].riders.push(people.splice(idx, 1)[0]);
    }
    var nBanners = 0;
    var bp = propsOf('banners');
    for (var b = 0; b < bp.length; b++) if ((bp[b].side || 'ours') === name) nBanners += Math.max(2, Math.min(5, bp[b].n === 1 ? 3 : bp[b].n));
    if (!people.length && !extra.length && !nBanners) return null;
    var lead = [];
    var rest = [];
    for (var k = 0; k < people.length; k++) (isLead(people[k]) ? lead : rest).push(people[k]);
    var order = lead.concat(rest);
    var other = foe ? cast.ours.length > 0 : cast.foe.length > 0 || shipsFoe > 0;
    var span = (other ? 0.38 : 0.5) * W;
    var cx = foe ? W * 0.8 : W * (WATER ? 0.17 : other ? 0.22 : 0.3);
    var s0 = KS * 0.9;
    var total = 0;
    for (var t = 0; t < order.length; t++) total += unitOf(order[t]);
    for (var e = 0; e < extra.length; e++) total += unitOf(extra[e]);
    var nRows = Math.min(3, Math.max(1, Math.ceil((total * s0) / span)));
    if (nRows > 1) s0 *= nRows === 2 ? 0.92 : 0.84;
    var per = Math.max(1, Math.ceil(order.length / nRows));
    var rowsL = [];
    for (var r = 0; r < nRows; r++) rowsL.push(order.slice(r * per, (r + 1) * per));
    rowsL[0] = rowsL[0].concat(extra);
    if (nBanners && nRows === 1) rowsL.push([]);
    return { foe: foe, rg: rg, cx: cx, span: span, s0: s0, rows: rowsL, banners: nBanners, alone: !!KEYS && KEYS.indexOf('cast') < 0 };
  }
  sides.ours = buildSide('ours');
  sides.foe = buildSide('foe');

  function moundY(x, m) {
    var u = m.foe ? m.cx - x : x - m.cx;
    var d = u / m.hw;
    if (u < 0) return m.top + 26 * Math.min(1, d * d);
    if (d < 1) return m.top + 70 * d * d;
    return m.top + 70 + (u - m.hw) * (WATER ? 2.2 : 1.1);
  }
  function moundPath(m) {
    var edge = m.foe ? W + 300 : -300;
    var dir = m.foe ? -1 : 1;
    var x = edge;
    var d = 'M' + f1(edge) + ',' + (H + 40);
    for (var i = 0; i < 400; i++) {
      var y = moundY(x, m);
      d += ' L' + f1(x) + ',' + f1(Math.min(H + 40, y));
      if (y > H + 40) break;
      x += dir * 24;
    }
    return d + ' L' + f1(x) + ',' + (H + 40) + ' Z';
  }
  var sideL = LAY.cast ? 'cast' : 'props';
  var sideOut = { ours: '', foe: '' };
  var sideInfo = {};
  var OUTER = { horse: 1, elephant: 1 };
  var INNER = { fire: 1, cannon: 1 };
  function drawSide(name) {
    var sd = sides[name];
    if (!sd) return;
    var foe = sd.foe;
    var o = '';
    var walkAll = A.advance;
    var raise = true;
    var info = { cx: sd.cx, top: 0, mounds: [] };
    for (var r = sd.rows.length - 1; r >= 0; r--) {
      var row = sd.rows[r];
      var sr = sd.s0 * (1 - 0.16 * r);
      var arranged = [];
      for (var i = 0; i < row.length; i++) {
        if (OUTER[row[i].kind] || INNER[row[i].kind]) continue;
        if (arranged.length % 2 === 0) arranged.push(row[i]);
        else arranged.unshift(row[i]);
      }
      // A horse or an elephant stands at the outer end of the front row, a fire or a cannon at the inner end.
      for (var h2 = 0; h2 < row.length; h2++) {
        if (!OUTER[row[h2].kind]) continue;
        if (foe) arranged.push(row[h2]);
        else arranged.unshift(row[h2]);
      }
      for (var f2 = 0; f2 < row.length; f2++) {
        if (!INNER[row[f2].kind]) continue;
        if (foe) arranged.unshift(row[f2]);
        else arranged.push(row[f2]);
      }
      var units = [];
      var rowW = 0;
      for (var a = 0; a < arranged.length; a++) {
        var uw = unitOf(arranged[a]) * sr * (isLead(arranged[a]) ? 1.12 : 1);
        units.push(uw);
        rowW += uw;
      }
      if (rowW > sd.span) {
        var shrink = sd.span / rowW;
        sr *= shrink;
        rowW = sd.span;
        for (var u2 = 0; u2 < units.length; u2++) units[u2] *= shrink;
      }
      var cx = sd.cx + (foe ? 1 : -1) * r * 50;
      if (sd.alone && arranged.length) cx += (INNER[arranged[foe ? 0 : arranged.length - 1].kind] ? (foe ? -1 : 1) : foe ? 1 : -1) * (0.19 * W + rowW / 2);
      var startX = cx - rowW / 2;
      if (!foe) startX = Math.max(W * 0.025 + (arranged.length ? units[0] * 0.3 : 0), startX);
      else startX = Math.min(W * 0.975 - rowW, startX);
      var m = { foe: foe, cx: startX + rowW / 2, top: FY - r * (WATER ? 30 : 40), hw: Math.max(220, rowW / 2 + 110) };
      if (r === 0) info.top = m.top;
      info.mounds.push(m);
      var col = r === 0 ? P.near : mix(P.near, P.mid, r === 1 ? 0.45 : 0.7);
      var ink = r === 0 ? P.ink : mix(P.ink, P.mid, r === 1 ? 0.32 : 0.55);
      var g = Pa(moundPath(m), Fl(col));
      if (r === sd.rows.length - 1 && sd.banners) {
        var bspan = Math.min(sd.span, (130 * sd.banners + 160) * KS);
        var bx0 = m.cx - bspan / 2;
        var bx1 = m.cx + bspan / 2;
        g += '<g fill="' + ink + '" color="' + ink + '">' + banners(sd.banners, foe, bx0, bx1, moundY((bx0 + bx1) / 2, m) + 30, sr * 0.9, sd.rg) + '</g>';
      }
      var xCur = startX;
      for (var q = 0; q < arranged.length; q++) {
        var f = arranged[q];
        var xc = xCur + units[q] / 2;
        xCur += units[q];
        var sc = sr * (isLead(f) ? 1.12 : 1) * (f.kind === 'child' ? 0.64 : f.kind === 'woman' ? 0.95 : 1);
        var fy = moundY(xc, m) + 20 * sr;
        var moving = walkAll || f.pose === 'walk';
        var dist = (walkAll ? Math.min(0.1 * W, 26 * 8) : 14 * 8) / sc;
        var opt = { walk: moving && f.kind !== 'fire', dist: dist, battle: A.battle, advance: walkAll, raise: false, ink: ink };
        if (f.kind === 'fire') {
          g += fire(xc, fy - 8 * sr, sr * 0.9, false, sideL);
          continue;
        }
        if (f.pose === 'flag' && isLead(f) && raise && r === 0) {
          opt.raise = true;
          raise = false;
        }
        var big = f.kind === 'cavalry' || f.kind === 'horse' || f.kind === 'elephant' || f.kind === 'cannon';
        var body2;
        if (f.kind === 'cavalry') body2 = horse(f, opt, true);
        else if (f.kind === 'horse') {
          opt.walk = walkAll;
          body2 = horse(f, opt, false);
        } else if (f.kind === 'elephant') {
          opt.walk = walkAll;
          body2 = elephant(f, opt, f.riders || []);
        } else if (f.kind === 'cannon') body2 = cannon(f, opt, { L: sideL, x: xc + (foe ? -1 : 1) * 144 * sc * 0.9, y: fy - 149 * sc * 0.9, s: sc * 0.9, dir: foe ? -1 : 1 });
        else body2 = figure(f, opt);
        g += '<g' + at(xc, fy, big ? sc * 0.9 : sc, foe) + ' fill="' + ink + '" color="' + ink + '">' + body2 + '</g>';
      }
      o += g;
    }
    sideInfo[name] = info;
    sideOut[name] = o;
  }
  drawSide('ours');
  drawSide('foe');

  // On the water: the stakes, the ships, and the boats.
  CUR = RP;
  var kLevel = key();
  var stakesS = '';
  var ships = [];
  var boats = [];
  var boatS = '';
  if (WATER) {
    var nStakes = countProp('stakes');
    if (nStakes) {
      var sr2 = gen(hP + 5);
      var base = A.tide ? 1000 : 905;
      var sx0 = sideInfo.ours ? W * 0.32 : W * 0.12;
      var sx1 = sideInfo.foe ? W * 0.72 : W * 0.98;
      var ns = Math.round(34 * ((sx1 - sx0) / (W * 0.66)));
      for (var sj = 0; sj < ns; sj++) {
        var stx = sx0 + ((sx1 - sx0) * sj) / ns + sr2() * 18;
        var sth = 120 + sr2() * 110;
        var stw = 12 + sr2() * 8;
        var lean = -14 + sr2() * 8;
        var sty = base + sr2() * 40;
        stakesS += '<path transform="translate(' + f1(stx) + ',' + f1(sty) + ') rotate(' + f1(lean) + ')" d="M' + f1(-stw / 2) + ',0 L' + f1(-stw / 2) + ',' + f1(-sth + 26) + ' L0,' + f1(-sth) + ' L' + f1(stw / 2) + ',' + f1(-sth + 26) + ' L' + f1(stw / 2) + ',0 Z"/>';
      }
      stakesS = G(stakesS, Fl(mix(P.ink, P.near, 0.3)));
    }
    var placeShips = function (list, foe) {
      var n = Math.min(6, list.length);
      var rg = foe ? FRG : RG;
      var x0 = foe ? (sideInfo.foe ? 0.4 : 0.47) * W : sideInfo.ours ? 0.54 * W : 0.14 * W;
      var x1 = foe ? (sideInfo.foe ? 0.66 : 0.81) * W : sideInfo.foe || shipList.foe.length ? Math.max(x0, 0.6 * W) : sideInfo.ours ? 0.76 * W : 0.48 * W;
      var scs = [0.78, 1.04, 0.66, 0.9, 0.6, 0.84];
      var shrink = n > 2 ? 2.2 / n + 0.1 : 1;
      for (var i = 0; i < n; i++) {
        var sc = scs[i % scs.length] * KS * Math.min(1, shrink) * (rg === 'ea' ? 1 : 0.82);
        var x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
        var k = key();
        var shp = shipOf(list[i], rg, foe);
        var keel = rg === 'ea' ? 46 : 26;
        var y = 760 - keel * sc - (i % 2) * 4;
        var burnIt = A.burn && foe;
        var inner = shp.svg;
        for (var fz = 0; burnIt && fz < shp.fire.length; fz++) {
          var sf = shp.fire[fz];
          inner += fire(sf[0], sf[1], sf[2], true);
          FP.push({ x: x + (foe ? 1 : -1) * sf[0] * sc, y: y + sf[1] * sc, s: sf[2] * sc, L: 'props' });
        }
        ships.push({ k: k, foe: foe, sc: sc, i: i, svg: '<g' + at(x, y, sc, !foe) + '><g' + dk(k) + '>' + inner + '</g></g>' });
      }
    };
    if (shipList.foe.length) placeShips(shipList.foe, true);
    if (shipList.ours.length) placeShips(shipList.ours, false);
    var nBoatsO = 0;
    var nBoatsF = 0;
    var bP = propsOf('boat');
    for (var bi = 0; bi < bP.length; bi++) {
      if (bP[bi].side === 'foe') nBoatsF += bP[bi].n;
      else nBoatsO += bP[bi].n;
    }
    var placeBoats = function (n, foe) {
      var inner = foe ? (sideInfo.foe ? sideInfo.foe.mounds[sideInfo.foe.mounds.length - 1] : null) : sideInfo.ours ? sideInfo.ours.mounds[sideInfo.ours.mounds.length - 1] : null;
      var edge = foe ? W * 0.88 : W * 0.1;
      if (inner) {
        var xx = inner.cx;
        for (var s = 0; s < 200 && moundY(xx, inner) < 800; s++) xx += foe ? -12 : 12;
        edge = xx + (foe ? -150 : 150);
      }
      for (var i = 0; i < n; i++) {
        var sc = (i % 2 ? 0.86 : 0.98) * KS * (n > 3 ? 0.85 : 1);
        var x = edge + (foe ? -1 : 1) * (i * 230 * KS * (n > 3 ? 0.7 : 1) + (i % 2) * -60);
        var y = 770 + (i % 2) * 48;
        var bt = boat(foe, foe ? FRG : RG);
        var k = key();
        boats.push({ k: k, foe: foe, oars: bt.oars, banner: bt.banner, i: i });
        boatS += '<g' + at(x, y, sc, foe) + '><g' + dk(k) + '>' + bt.svg + '</g></g>';
      }
    };
    if (nBoatsO) placeBoats(Math.min(6, nBoatsO), false);
    if (nBoatsF) placeBoats(Math.min(6, nBoatsF), true);
  }
  var shipsS = '';
  for (var sp = 0; sp < ships.length; sp++) shipsS += ships[sp].svg;

  // The front water, which the tide lowers, and the waves on it: the props layer draws it over its ships, the backdrop when there are none.
  var frontL = LAY.props && (LAY.back || waterProps) ? 'props' : 'back';
  var frontWater = '';
  var wave = function (y, amp) {
    var d = 'M-300,' + y + ' Q-190,' + (y - amp) + ' -80,' + y;
    for (var x = -80; x < W + 900; x += 220) d += ' T' + (x + 220) + ',' + y;
    return d;
  };
  if (WATER) {
    var wy = 760;
    frontWater += Pa(
      'M-300,' + wy + ' Q' + f1(W * 0.104) + ',' + (wy + 30) + ' ' + f1(W * 0.25) + ',' + (wy + 42) + ' T' + f1(W * 0.54) + ',' + (wy + 40) + ' T' + f1(W * 0.83) + ',' + (wy + 44) + ' T' + (W + 300) + ',' + (wy + 38) + ' L' + (W + 300) + ',' + (H + 260) + ' L-300,' + (H + 260) + ' Z',
      ' fill="url(#' + ID + 'front)"',
    );
    frontWater += Pa(wave(774, 12), dk(kW1) + ' fill="none" stroke="' + P.wave + '" stroke-width="3" opacity=".45"');
    frontWater += Pa(wave(830, 14), dk(kW2) + ' fill="none" stroke="' + P.wave + '" stroke-width="3" opacity=".4"');
    if (S.sea) frontWater += Pa(wave(900, 16), ' fill="none" stroke="' + P.wave + '" stroke-width="3" opacity=".3"');
    frontWater = G(frontWater + G(boatS, ' fill="' + P.ink + '" color="' + P.ink + '"'), dk(kLevel));
  }
  // The tide's foam, for an fx layer laid over water another layer drew.
  CUR = RF;
  var kFoam = key();
  var foamS = A.tide && WATER && !LAY[frontL] ? G(Pa(wave(768, 10)) + Pa(wave(800, 12)), dk(kFoam) + ' fill="none" stroke="' + P.wave + '" stroke-width="3.5" opacity=".55"') : '';

  // Reeds and grasses at the foot of the frame.
  CUR = RB;
  var reedS = '';
  if (WATER) {
    if (!sideInfo.foe) reedS += reeds(W * 0.78, W + 60, Math.round(26 * KS), 120, 280, P.reed);
    reedS += reeds(-20, W * 0.07, 10, 120, 280, P.reed);
  } else {
    reedS += reeds(-20, W * 0.1, 12, 50, 150, P.reed);
    reedS += reeds(W * 0.9, W + 40, 12, 50, 150, P.reed);
  }

  // Trees framing the sides, in the region's kinds.
  var frameS = '';
  var kFT = key();
  var frameL = countProp('trees') ? 'props' : 'back';
  if (countProp('trees') || S.forest || S.village) {
    CUR = frameL === 'back' ? RB : RP;
    var leftT = RG === 'ea' || RG === 'me' ? palm(560, 60) : RG === 'eu' ? oak(540) : pine(540);
    frameS += '<g' + at(sideInfo.ours ? W * 0.015 : W * 0.04, H + 30, 1.25 * KS) + ' fill="' + P.reed + '">' + leftT + '</g>';
    if (!sideInfo.foe || S.forest) frameS += '<g' + at(W * 0.975, H + 30, 1.1 * KS) + ' fill="' + P.reed + '">' + (RG === 'ea' ? bamboo(520) : cypress(560)) + '</g>';
  }

  // Free fires that belong to no side; and the fires of buildings whose own layer is not on the page, which the fx layer draws.
  CUR = RP;
  var looseP = '';
  var fireProps = propsOf('fire');
  if (fireProps.length && !sides.ours && !sides.foe) looseP += fire(W * 0.5, WATER ? MB + 6 : FY + 40, 0.9 * KS, false, 'props');
  CUR = RF;
  var looseF = '';
  if (A.burn) for (var lf = 0; lf < FP.length; lf++) if (!LAY[FP[lf].L]) looseF += fire(FP[lf].x, FP[lf].y, FP[lf].s, true);
  if (A.burn && !FP.length) {
    if (WATER) looseF += fire(W * 0.62, MB + 4, 0.8 * KS) + fire(W * 0.74, MB + 2, 0.6 * KS);
    else looseF += fire(W * 0.55, MB + 2, 0.9 * KS) + fire(W * 0.68, MB + 4, 0.7 * KS);
  }

  // What happens: arrows, smoke, embers, rain.
  var overlay = '';
  var arrows = [];
  if (A.battle) {
    var fromO = { x: sideInfo.ours ? sideInfo.ours.cx : W * 0.15, y: (sideInfo.ours ? sideInfo.ours.top : FY) - 240 * KS };
    var toF = sideInfo.foe ? { x: sideInfo.foe.cx, y: sideInfo.foe.top - 140 * KS } : ships.length ? { x: W * 0.66, y: HZ - 90 } : { x: W * 0.78, y: (WATER ? HZ : FY) - 60 };
    var fromF = sideInfo.foe ? { x: sideInfo.foe.cx, y: sideInfo.foe.top - 240 * KS } : ships.length ? { x: W * 0.62, y: HZ - 220 } : null;
    var toO = { x: fromO.x, y: fromO.y + 120 * KS };
    for (var vt = 0.6, vi = 0; vt < 30; vt += 1.7, vi++) {
      var dirO = vi % 2 === 0 || !fromF;
      var a0 = dirO ? fromO : fromF;
      var a1 = dirO ? toF : toO;
      for (var ai = 0; ai < 7; ai++) {
        var ka = key();
        arrows.push({ k: ka, t: vt + ai * 0.07, x0: a0.x + rr(-110, 110), y0: a0.y + rr(-30, 30), x1: a1.x + rr(-170, 170), y1: a1.y + rr(-40, 60), hgt: rr(220, 360) });
        overlay +=
          '<g' + dk(ka) + ' opacity="0"><path d="M-26,0 L18,0" stroke="' + P.ink + '" stroke-width="3.5" stroke-linecap="round"/><path d="M16,-5 L28,0 L16,5 Z" fill="' + P.ink + '"/><path d="M-26,0 l-8,-6 M-26,0 l-8,6" stroke="' + P.ink + '" stroke-width="2.5"/></g>';
      }
    }
  }
  var embers = [];
  if (A.burn || fireProps.length) {
    var fps = FP.slice(0, 8);
    for (var fq = 0; fq < fps.length; fq++) for (var pq = 0; pq < 4; pq++) puffAt('fx', fps[fq].x, fps[fq].y - 150 * fps[fq].s, fps[fq].s, 2.6, P.smoke, 420, A.burn ? 0.55 : 0.35);
    var nE = A.burn ? 36 : 10;
    for (var ei = 0; ei < nE && fps.length; ei++) {
      var src2 = fps[ei % fps.length];
      var ke = key();
      embers.push({ k: ke, x: src2.x + rr(-30, 30) * src2.s, y: src2.y - 80 * src2.s, s: src2.s, ph: rnd(), cyc: rr(1.6, 2.6), sw: rr(10, 30), rise: rr(260, 420) });
      overlay += '<circle' + dk(ke) + ' r="' + f1(rr(2, 4)) + '" fill="#ffc35a" opacity="0"/>';
    }
  }
  if (A.battle) {
    var hits = [];
    if (sideInfo.foe) hits.push({ x: sideInfo.foe.cx, y: sideInfo.foe.top - 60 });
    else if (ships.length) hits.push({ x: W * 0.66, y: HZ - 60 });
    else hits.push({ x: W * 0.78, y: (WATER ? HZ : FY) - 20 });
    if (sideInfo.ours) hits.push({ x: sideInfo.ours.cx + 120, y: sideInfo.ours.top - 40 });
    for (var hq = 0; hq < hits.length; hq++) for (var hp = 0; hp < 4; hp++) puffAt('fx', hits[hq].x + rr(-160, 160), hits[hq].y + rr(-30, 30), KS * rr(0.7, 1.1), rr(2.2, 3.2), mix(P.smoke, P.mist, 0.35), 160, 0.45);
  }
  var glowS = '';
  if (A.burn && FP.length) {
    var gx = 0;
    var gy2 = 0;
    for (var gq = 0; gq < FP.length; gq++) {
      gx += FP[gq].x;
      gy2 += FP[gq].y;
    }
    gx /= FP.length;
    gy2 /= FP.length;
    defs += '<radialGradient id="' + ID + 'burn" gradientUnits="userSpaceOnUse" cx="' + f1(gx) + '" cy="' + f1(gy2) + '" r="' + f1(W * 0.45) + '"><stop offset="0" stop-color="#ff8a2a" stop-opacity=".38"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>';
    var kgl = key();
    glowS = Rc(-300, -200, W + 600, H + 400, dk(kgl) + ' fill="url(#' + ID + 'burn)"');
    AN.push(function (tl, D) {
      loop(tl, E(kgl), { opacity: 0.75 }, { opacity: 1 }, 0.37, '', 0, D);
    });
  }
  var rainS = '';
  var kRain = [];
  if (RAIN) {
    var rp = gen(hF + 77);
    var rl = '';
    var rl2 = '';
    for (var rj = 0; rj < 70; rj++) {
      var rx = rp() * 400;
      var ry = rp() * 354;
      rl += Ln(rx, ry, rx - 10, ry + 46, 2, '#dfe8f0') + Ln(rx + 400, ry, rx + 390, ry + 46, 2, '#dfe8f0') + Ln(rx - 400, ry, rx - 410, ry + 46, 2, '#dfe8f0');
      if (rj < 40) {
        var rx2 = rp() * 520;
        var ry2 = rp() * 448;
        rl2 += Ln(rx2, ry2, rx2 - 16, ry2 + 72, 3, '#eef4fa') + Ln(rx2 + 520, ry2, rx2 + 504, ry2 + 72, 3, '#eef4fa') + Ln(rx2 - 520, ry2, rx2 - 536, ry2 + 72, 3, '#eef4fa');
      }
    }
    defs += '<pattern id="' + ID + 'rain" patternUnits="userSpaceOnUse" width="400" height="400">' + rl + '</pattern>';
    defs += '<pattern id="' + ID + 'rain2" patternUnits="userSpaceOnUse" width="520" height="520">' + rl2 + '</pattern>';
    var kr1 = key();
    var kr2 = key();
    kRain = [kr1, kr2];
    rainS += Rc(-300, -300, W + 600, H + 900, ' fill="' + (T === 'night' ? '#0a0e18' : '#2a3440') + '" opacity=".22"');
    rainS += Rc(-300, -900, W + 600, H + 1800, dk(kr1) + ' fill="url(#' + ID + 'rain)" opacity=".32"');
    rainS += Rc(-300, -1100, W + 600, H + 2200, dk(kr2) + ' fill="url(#' + ID + 'rain2)" opacity=".38"');
  }
  var mistLow = '';
  var mistBack = '';
  if (MIST) {
    var km2 = key();
    var km3 = key();
    kMist.push(km2, km3);
    mistBack = Rc(-300, HZ - 90, W + 600, 170, dk(km2) + ' fill="url(#' + ID + 'mist)" opacity=".6"');
    mistLow = Rc(-300, FY - 60, W + 600, 220, dk(km3) + ' fill="url(#' + ID + 'mist)" opacity=".38"');
  }

  /* ---------- assemble: every piece in depth order, each kept only when its layer is on the page ---------- */
  var kFrontG = key();
  var PARTS = [];
  var put = function (L, s) {
    if (s && LAY[L]) PARTS.push(s);
  };
  put('back', skyS);
  put('back', hillS);
  put('back', groundS);
  put('back', forestBand);
  for (var mb = 0; mb < midBackL.length; mb++) put(midBackL[mb][0], midBackL[mb][1]);
  put(wallL, wallS);
  for (var mf = 0; mf < midFrontL.length; mf++) put(midFrontL[mf][0], midFrontL[mf][1]);
  put('props', stakesS + shipsS ? G(stakesS + shipsS, ' fill="' + P.ink + '" color="' + P.ink + '"') : '');
  put(frontL, frontWater);
  put('fx', foamS);
  put('fx', mistBack);
  put('props', looseP);
  put('fx', looseF);
  put('fx', smokeFx ? G(smokeFx, ' filter="url(#' + ID + 'soft)"') : '');
  put(sideL, sideOut.ours + sideOut.foe ? G(sideOut.ours + sideOut.foe, dk(kFrontG)) : '');
  put(frameL, frameS ? G(frameS, dk(kFT)) : '');
  put('props', smokeP ? G(smokeP, ' filter="url(#' + ID + 'soft)"') : '');
  put('back', reedS ? G(reedS) : '');
  put('fx', mistLow);
  put('fx', glowS);
  put('fx', overlay);
  put('fx', rainS);
  cam.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" style="overflow:hidden"><defs>' + defs + '</defs>' + PARTS.join('') + '</svg>';
  var nodes = cam.querySelectorAll('[data-d]');
  for (var ni = 0; ni < nodes.length; ni++) EL[nodes[ni].getAttribute('data-d')] = nodes[ni];

  /* ---------- motion ---------- */
  AN.push(function (tl, D) {
    // The camera: a slow push in, and every depth drifting at its own speed. Each layer pushes its own camera the same way, so stacked layers stay aligned.
    tl.fromTo(cam, { scale: 1.02, transformOrigin: '45% 70%' }, { scale: 1.09, transformOrigin: '45% 70%', duration: D, ease: 'none' }, 0);
    tw(tl, E(kClouds), { x: 0 }, { x: -90, duration: D, ease: 'none' }, 0);
    tw(tl, E(kFar), { x: 0 }, { x: -24, duration: D, ease: 'none' }, 0);
    tw(tl, E(kMid), { x: 0 }, { x: -50, duration: D, ease: 'none' }, 0);
    tw(tl, E(kFrontG), { x: 0 }, { x: 24, duration: D, ease: 'none' }, 0);
    tw(tl, E(kFT), { x: 0 }, { x: 24, duration: D, ease: 'none' }, 0);
    if (P.drift) tw(tl, E(kSun), { y: 0 }, { y: P.drift, duration: D, ease: 'none' }, 0);
    if (kBirds) tw(tl, E(kBirds), { x: W * 0.22, y: 300 }, { x: W * 0.78, y: 210, duration: D, ease: 'none' }, 0);
    for (var i = 0; i < kMist.length; i++) tw(tl, E(kMist[i]), { x: i % 2 ? -60 : 40 }, { x: i % 2 ? 80 : -90, duration: D, ease: 'none' }, 0);
    if (RAIN) {
      var p1 = 0.32;
      var p2 = 0.24;
      tw(tl, E(kRain[0]), { y: 0 }, { y: 400, duration: p1, ease: 'none', repeat: Math.max(0, Math.floor(D / p1) - 1) }, 0);
      tw(tl, E(kRain[1]), { y: 0 }, { y: 520, duration: p2, ease: 'none', repeat: Math.max(0, Math.floor(D / p2) - 1) }, 0);
    }
    if (WATER) {
      tw(tl, E(kShine), { opacity: 0.9 }, { opacity: 0.35, duration: D, ease: 'none' }, 0);
      tw(tl, E(kW1), { x: 0 }, { x: -440, duration: D, ease: 'none' }, 0);
      tw(tl, E(kW2), { x: -220 }, { x: 0, duration: D, ease: 'none' }, 0);
      if (A.tide) {
        tw(tl, E(kLevel), { y: -20 }, { y: 170, duration: D * 0.58, ease: 'sine.inOut' }, D * 0.13);
        tw(tl, E(kFoam), { y: -20, x: 0 }, { y: 170, x: -220, duration: D * 0.58, ease: 'sine.inOut' }, D * 0.13);
      }
    }
    // The ships: drifting in on the tide and caught on the stakes, pressing forward, or riding at anchor.
    for (var s = 0; s < ships.length; s++) {
      var sh2 = ships[s];
      var el = E(sh2.k);
      var j = sh2.i;
      if (!el) continue;
      if (A.tide && sh2.foe) {
        tl.fromTo(el, { x: -140 - j * 40, y: -20 }, { x: 0, y: 0, duration: D * 0.34, ease: 'sine.out' }, 0);
        tl.to(el, { y: 115 - (j % 2) * 8, duration: D * 0.29, ease: 'sine.inOut' }, D * (0.27 + j * 0.02));
        tl.to(el, { rotation: j % 2 ? 10 : -8, transformOrigin: '50% 100%', duration: D * 0.15, ease: 'power2.out' }, D * (0.56 + j * 0.03));
      } else if (A.advance) {
        tl.fromTo(el, { x: 0 }, { x: -Math.min(260, 0.1 * W) / sh2.sc, duration: D, ease: 'power1.inOut' }, 0);
        loop(tl, el, { rotation: -1 }, { rotation: 1 }, 1.4, '50% 100%', 0, D);
      } else {
        loop(tl, el, { y: 0, rotation: -0.8 }, { y: 6, rotation: 0.8 }, 1.6 + j * 0.2, '50% 100%', j * 0.3, D);
      }
    }
    for (var b = 0; b < boats.length; b++) {
      var bt = boats[b];
      var be = E(bt.k);
      if (!be) continue;
      if (A.tide || A.advance) tl.fromTo(be, { x: -360 - bt.i * 60 }, { x: 180, duration: D, ease: 'power1.out' }, bt.i * 0.3);
      else tl.fromTo(be, { x: -40 }, { x: 60, duration: D, ease: 'none' }, 0);
      loop(tl, be, { y: 0 }, { y: 4 }, 0.84, '', bt.i * 0.2, D);
      for (var o = 0; o < bt.oars.length; o++) loop(tl, E(bt.oars[o]), { rotation: -24 }, { rotation: 22 }, A.tide || A.advance ? 0.42 : 0.7, '0 -20', 0, D);
      loop(tl, E(bt.banner), { skewY: 0 }, { skewY: 7 }, 0.5, '150 -105', bt.i * 0.2, D);
    }
    // Arrows arc across, each drawn by a setter so a seek lands on it.
    for (var a = 0; a < arrows.length; a++) {
      (function (ar) {
        var el2 = E(ar.k);
        if (!el2 || ar.t + 1.1 > D) return;
        proc(tl, ar.t, 1.1, function (p) {
          if (p <= 0 || p >= 1) {
            el2.setAttribute('opacity', '0');
            return;
          }
          var x = ar.x0 + (ar.x1 - ar.x0) * p;
          var y = ar.y0 + (ar.y1 - ar.y0) * p - ar.hgt * 4 * p * (1 - p);
          var dx = ar.x1 - ar.x0;
          var dy = ar.y1 - ar.y0 - ar.hgt * 4 * (1 - 2 * p);
          var ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          el2.setAttribute('transform', 'translate(' + f1(x) + ',' + f1(y) + ') rotate(' + f1(ang) + ') scale(' + KS.toFixed(2) + ')');
          el2.setAttribute('opacity', p < 0.06 ? String(p / 0.06) : '1');
        });
      })(arrows[a]);
    }
    for (var u = 0; u < puffs.length; u++) {
      (function (pf) {
        var el3 = E(pf.k);
        if (!el3) return;
        proc(
          tl,
          0,
          pf.cyc,
          function (p) {
            var q2 = (p + pf.ph) % 1;
            el3.setAttribute('cy', f1(pf.y - q2 * pf.rise * pf.s));
            el3.setAttribute('cx', f1(pf.x + pf.dir * q2 * 90 * pf.s * pf.grow));
            el3.setAttribute('r', f1((26 + q2 * 110) * pf.s));
            el3.setAttribute('opacity', f1((q2 < 0.15 ? q2 / 0.15 : 1 - (q2 - 0.15) / 0.85) * pf.op * 100) / 100);
          },
          Math.max(0, Math.floor(D / pf.cyc) - 1),
        );
      })(puffs[u]);
    }
    for (var e = 0; e < embers.length; e++) {
      (function (em) {
        var el4 = E(em.k);
        if (!el4) return;
        proc(
          tl,
          0,
          em.cyc,
          function (p) {
            var q3 = (p + em.ph) % 1;
            el4.setAttribute('cx', f1(em.x + Math.sin(q3 * 7 + em.ph * 6) * em.sw * em.s + q3 * 70 * em.s));
            el4.setAttribute('cy', f1(em.y - q3 * em.rise * em.s));
            el4.setAttribute('opacity', f1((q3 < 0.1 ? q3 / 0.1 : 1 - q3) * 100) / 100);
          },
          Math.max(0, Math.floor(D / em.cyc) - 1),
        );
      })(embers[e]);
    }
  });

  return {
    width: W,
    play: function (tl, D) {
      D = Math.max(2, Number(D) || 8);
      for (var i = 0; i < AN.length; i++) {
        try {
          AN[i](tl, D);
        } catch (err) {
          /* one broken motion leaves the rest moving */
        }
      }
    },
  };
}

/**
 * What a diorama draws when a value is not given: an empty field by day, nobody in it, nothing
 * happening, in the prototype's East Asian look. Neutral on purpose — a writer may leave the cast or
 * the props out, and whatever is here then turns up in a film about something else entirely.
 */
export const DIORAMA_DEFAULTS = {
  setting: 'đồng',
  time: 'ngày',
  cast: '',
  props: '',
  action: 'yên',
  region: 'á đông',
  foeRegion: '',
};

/** The Bạch Đằng scene the prototype drew: the sample a kit's still and its card show, never a default. */
export const DIORAMA_SAMPLE = {
  setting: 'sông, núi',
  time: 'hoàng hôn',
  cast: 'tướng giơ cờ, 2 lính',
  props: 'thuyền chiến x2, thuyền nhẹ x2, bãi cọc',
  action: 'triều rút',
  region: 'á đông',
  foeRegion: '',
};

/** The keywords each value takes, written once for the variables' labels and for a storyboard guide. */
export const DIORAMA_WORDS = {
  setting: 'sông, biển, núi, làng, thành, rừng, đồng, cung điện',
  time: 'bình minh, ngày, hoàng hôn, đêm; thêm "mưa" hay "sương"',
  region: 'á đông, châu âu (Byzantine, Trung cổ), trung đông (Ottoman), la mã cổ đại',
  kinds: 'tướng, lính, vua, quan, dân, phụ nữ, tu sĩ (nhà sư), trẻ em, kỵ binh',
  poses: 'đứng, giơ cờ, chỉ tay, giơ kiếm, cúi, đi',
  props: 'thuyền chiến, thuyền buồm, thuyền nhẹ, bãi cọc, thành, tháp, mái vòm, nhà thờ, thánh đường, chùa, cung điện, nhà, lều, đại pháo, voi chiến, ngựa, cờ, lửa, cây',
  action: 'triều rút, tiến quân, giao chiến, cháy, yên',
};

const ALL_KEYS = ['setting', 'time', 'cast', 'props', 'action', 'region', 'foeRegion'];

/**
 * The values a diorama reads, as variables: all seven, or the ones a layer takes (`keys`). `samples`
 * overrides the sample of any of them; a key in `optional` is not required, and says it is there to
 * match the layer to the others it is mounted with.
 */
export function dioramaVariables(defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE, keys = ALL_KEYS, optional = []) {
  const all = {
    setting: {
      id: 'setting',
      type: 'string',
      label: 'Where it happens, one or more of: river, sea, mountains, village, citadel, forest, fields, palace (Vietnamese words work too)',
      labels: { vi: `Bối cảnh, một hay vài từ: ${DIORAMA_WORDS.setting} (vd "sông, núi")` },
      default: defaults.setting,
      sample: samples.setting,
      maxLength: 48,
      required: true,
    },
    time: {
      id: 'time',
      type: 'string',
      label: 'When: dawn, day, dusk or night; add "rain" or "mist" for the weather',
      labels: { vi: `Thời điểm: ${DIORAMA_WORDS.time} (vd "đêm, mưa")` },
      default: defaults.time,
      sample: samples.time,
      maxLength: 32,
      required: true,
    },
    cast: {
      id: 'cast',
      type: 'string',
      label:
        'Who is in it, comma separated, each "[count] kind [pose]": general, soldier, king, mandarin, villager, woman, monk (a priest in Europe), child, cavalry; poses stand, flag, point, sword, bow, walk. Our side first, then "enemy: …" for the other side; or empty',
      labels: {
        vi: `Nhân vật, cách nhau dấu phẩy, mỗi mục "[số] loại [tư thế]". Loại: ${DIORAMA_WORDS.kinds}. Tư thế: ${DIORAMA_WORDS.poses}. Phe ta trước, rồi "giặc: …" cho phe bên kia; hoặc để trống`,
      },
      default: defaults.cast,
      sample: samples.cast,
      maxLength: 140,
    },
    props: {
      id: 'props',
      type: 'string',
      label:
        'The things in it, comma separated, "x2" for more, "enemy: …" for the other side\'s: warship, sailing ship, boat, stakes, wall, tower, dome, church, mosque, temple, palace, house, tent, cannon, war elephant, horse, banners, fire, trees; or empty',
      labels: { vi: `Đồ vật, cách nhau dấu phẩy, thêm "x2" để nhân lên, "giặc: …" cho đồ của phe bên kia: ${DIORAMA_WORDS.props}; hoặc để trống` },
      default: defaults.props,
      sample: samples.props,
      maxLength: 120,
    },
    action: {
      id: 'action',
      type: 'string',
      label: 'What happens: tide falls, advance, battle, burning, or calm',
      labels: { vi: `Diễn biến: ${DIORAMA_WORDS.action}` },
      default: defaults.action,
      sample: samples.action,
      maxLength: 32,
    },
    region: {
      id: 'region',
      type: 'string',
      label:
        "Whose world it is — our side's people, the buildings, the trees and hills: east-asia (the default), europe-medieval (Byzantium and medieval Europe), middle-east-ottoman, ancient-rome (Vietnamese words work too)",
      labels: { vi: `Vùng văn hoá của phe ta, nhà cửa và cảnh vật: ${DIORAMA_WORDS.region}; mặc định á đông` },
      default: defaults.region,
      sample: samples.region,
      maxLength: 32,
    },
    foeRegion: {
      id: 'foeRegion',
      type: 'string',
      label: "The other side's world when it differs from ours (\"middle-east-ottoman\" against \"europe-medieval\"), or empty for the same",
      labels: { vi: 'Vùng văn hoá của phe bên kia khi khác phe ta (vd "trung đông" khi phe ta là "châu âu"), hoặc để trống nếu giống' },
      default: defaults.foeRegion,
      sample: samples.foeRegion,
      maxLength: 32,
    },
  };
  return keys.map((key) => {
    const variable = { ...all[key] };
    if (optional.includes(key)) {
      delete variable.required;
      variable.label += ' (to match the backdrop it is mounted over)';
      variable.labels = { vi: `${variable.labels.vi} (để khớp với backdrop bên dưới)` };
    }
    return variable;
  });
}

/**
 * The runtime as the page carries it: each line trimmed, the comments dropped, the lines joined. The
 * source is written with every statement closed by a semicolon, so joining changes nothing it does,
 * and a scene file stays short enough for the inspector to read comfortably.
 */
const RUNTIME = dioramaScene
  .toString()
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//') && !/^\/\*.*\*\/$/.test(line))
  .join(' ');

/** The scene's length where a part is pasted into a block, its own where it is mounted as a component. */
const sceneLength = (seconds) => `(typeof duration!=='undefined'?duration:${seconds})`;

const GRAIN_URL = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .9 0 0 0 0 .8 0 0 0 0 .6 1.2 0 0 0 -.45'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>",
)}")`;

/**
 * The diorama and its four layers. Each is one part — a name, a class prefix, the layers it draws and
 * the values it reads — built the same way, so the published components and the pasted ones cannot
 * drift apart. Only the diorama and the backdrop paint a ground of their own; the other three are
 * transparent, for mounting over a backdrop (or over a picture) in the same box.
 */
const PARTS = {
  diorama: {
    prefix: 'dio',
    layers: null,
    keys: null,
    ground: true,
    role: 'piece',
    description:
      'A shadow-puppet illustration drawn in code, filling its box: a setting, a time of day, the people and things in it, and what happens (the tide falls, an army advances, a battle, a fire), in the culture of its region. Reads the scene’s own setting, time, cast, props, action, region and foeRegion.',
  },
  backdrop: {
    prefix: 'dbk',
    layers: { back: 1 },
    keys: ['setting', 'time', 'region'],
    optional: [],
    ground: true,
    role: 'piece',
    description:
      'The ground of a shadow-puppet scene, filling its box: sky, sun or moon, hills, water or fields, and the setting’s own buildings and trees, in the culture of its region. Mount it first; cast, props and fx go over it with the same time and region.',
  },
  cast: {
    prefix: 'dca',
    layers: { cast: 1 },
    keys: ['cast', 'region', 'foeRegion', 'action', 'time', 'setting'],
    optional: ['time', 'setting'],
    ground: false,
    role: 'piece',
    description:
      'The people of a shadow-puppet scene as paper-cut silhouettes, on a transparent ground: our side on the left, the other side on the right, each on a rise of its own, dressed for its region. Mount it over a backdrop in the same box.',
  },
  props: {
    prefix: 'dpr',
    layers: { props: 1 },
    keys: ['props', 'region', 'foeRegion', 'action', 'time', 'setting'],
    optional: ['time', 'setting'],
    ground: false,
    role: 'piece',
    description:
      'The things of a shadow-puppet scene on a transparent ground: ships, buildings, stakes, cannons, war elephants, horses and banners, in their region’s style. Mount it over a backdrop in the same box.',
  },
  fx: {
    prefix: 'dfx',
    layers: { fx: 1 },
    keys: ['action', 'time', 'setting'],
    optional: ['setting'],
    ground: false,
    role: 'effect',
    description: 'What happens in a shadow-puppet scene, on a transparent ground: arrows in a battle, smoke, fire and embers, the tide’s foam, rain and mist. Mount it last, over the backdrop, props and cast.',
  },
};

function dioramaPart(kind, { seconds = 8, grain = false, vignette = false, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  const spec = PARTS[kind];
  const p = spec.prefix;
  const config = JSON.stringify({ defaults, layers: spec.layers, keys: spec.keys, cam: `${p}-cam` }).replace(/</g, '\\u003c');
  const length = sceneLength(seconds);
  return {
    name: kind,
    role: spec.role,
    description: spec.description,
    css:
      `.${p}{position:absolute;inset:0;display:block;overflow:hidden${spec.ground ? ';background:#150a08' : ''}}.${p}-cam{position:absolute;inset:0;display:block}.${p}-cam svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}` +
      (vignette ? `.${p}-vig{position:absolute;inset:0;background:radial-gradient(ellipse 75% 80% at 50% 50%,transparent 55%,#000000a8 100%)}` : '') +
      (grain ? `.${p}-grain{position:absolute;inset:0;opacity:.12;background-image:${GRAIN_URL};background-size:220px 220px}` : ''),
    markup: `<span class="${p}"><span class="${p}-cam"></span>${vignette ? `<span class="${p}-vig"></span>` : ''}${grain ? `<span class="${p}-grain"></span>` : ''}</span>`,
    variables: dioramaVariables(defaults, samples, spec.keys ?? ALL_KEYS, spec.optional ?? []),
    extraScript: `var ${p}S=null;try{${p}S=(${RUNTIME})(root.querySelector('.${p}'),v,${config});}catch(${p}E){${p}S=null;}`,
    motion:
      `if(${p}S)${p}S.play(tl,${length});` +
      (grain
        ? `var ${p}G=root.querySelector('.${p}-grain');if(${p}G)tl.fromTo(${p}G,{backgroundPosition:'0px 0px'},{backgroundPosition:'1931px 1187px',duration:${length},ease:'steps('+Math.max(12,Math.round(${length}*12))+')'},0);`
        : ''),
  };
}

/**
 * A shadow-puppet diorama filling its box, drawn at run time from the scene's own `setting`, `time`,
 * `cast`, `props`, `action`, `region` and `foeRegion`, and moving over the scene: the camera pushes in,
 * the hills drift, the puppets breathe and their banners wave, and the action plays out (the tide
 * falls, an army advances, arrows fly, cannons fire, a fire burns). `grain` and `vignette` lay the
 * film's texture over it; a scene that has its own grain leaves that off. It is the four layers below
 * drawn as one.
 */
export function diorama({ seconds = 8, grain = true, vignette = true, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  return dioramaPart('diorama', { seconds, grain, vignette, defaults, samples });
}

/** The diorama's ground alone: sky, terrain, water, the setting's buildings and trees. Reads setting, time and region. */
export function dioramaBackdrop({ seconds = 8, grain = false, vignette = false, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  return dioramaPart('backdrop', { seconds, grain, vignette, defaults, samples });
}

/** The diorama's people alone, on a transparent ground. Reads cast, region, foeRegion and action (time and setting to match a backdrop). */
export function dioramaCast({ seconds = 8, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  return dioramaPart('cast', { seconds, defaults, samples });
}

/** The diorama's things alone, on a transparent ground. Reads props, region, foeRegion and action (time and setting to match a backdrop). */
export function dioramaProps({ seconds = 8, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  return dioramaPart('props', { seconds, defaults, samples });
}

/** What happens in the diorama, alone, on a transparent ground. Reads action and time (setting to match a backdrop). */
export function dioramaFx({ seconds = 8, defaults = DIORAMA_DEFAULTS, samples = DIORAMA_SAMPLE } = {}) {
  return dioramaPart('fx', { seconds, defaults, samples });
}
