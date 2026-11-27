// The backdrop's drawing: one SVG per season, filled in step with how much of
// the session limit is used. Pure functions, so the tests can read the output.

export type Season = 'winter' | 'spring' | 'summer' | 'fall'

export const SEASONS: readonly Season[] = ['winter', 'spring', 'summer', 'fall']

export type SceneArgs = {
  season: Season
  /** How much of the session limit is used, 0 to 100. */
  percent: number
  /** How far through the limit's window the clock is, 0 (just reset) to 1. */
  resetProgress: number
}

const W = 1600
const H = 1000
const GROUND = 885

/** The season of a month (0 = January) in a hemisphere. */
export function seasonOf(month: number, hemisphere: string): Season {
  const m = hemisphere === 'south' ? (month + 6) % 12 : month

  if (m === 11 || m <= 1) {
    return 'winter'
  }
  if (m <= 4) {
    return 'spring'
  }
  if (m <= 7) {
    return 'summer'
  }

  return 'fall'
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

// One decimal keeps the markup short.
const n = (v: number): number => Math.round(v * 10) / 10

// A seeded generator, so a redraw puts every flake and leaf where it was.
function rng(seed: number): () => number {
  let s = seed >>> 0

  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Palette = { light: Record<string, string>; dark: Record<string, string> }

// Day colors and night colors for each season. Both halves hold the same names.
const PALETTES: Record<Season, Palette> = {
  winter: {
    light: {
      sky1: '#b9cce0', sky2: '#eaf1f8', orb: '#fff6d8', far: '#b3c5d8', near: '#9db2c8',
      ground: '#dfe8f2', snow: '#ffffff', snow2: '#dbe6f1', pine: '#5d7a78', cabin: '#7a5a48',
      glow: '#ffd98a', flake: '#ffffff', roof: '#4f3a30', smoke: '#f4f7fb', star: '#ffffff',
      xr: '#d8433a', xb: '#3f7fd0', xg: '#f2c14e', coal: '#3a3a40', scarf: '#c8443c', carrot: '#e8832a',
      fence: '#8a6a52',
    },
    dark: {
      sky1: '#0d1626', sky2: '#1e2c44', orb: '#e8edf7', far: '#1a2940', near: '#21334b',
      ground: '#33435b', snow: '#b4c2d8', snow2: '#8496b0', pine: '#132927', cabin: '#241a18',
      glow: '#ffc766', flake: '#dfe8f5', roof: '#150f0e', smoke: '#4a5a74', star: '#dfe8f7',
      xr: '#e2584e', xb: '#5a9be8', xg: '#ffd66b', coal: '#0c0d12', scarf: '#a8382f', carrot: '#c96f22',
      fence: '#2a2019',
    },
  },
  spring: {
    light: {
      sky1: '#cbe6f3', sky2: '#f4fbf3', orb: '#fff3b8', far: '#b7dcae', near: '#94c98a',
      ground: '#7dba72', stem: '#4d8f4a', bud: '#a8cf8a', p1: '#f49ac1', p2: '#ffd166',
      p3: '#b79cf0', p4: '#ffffff', c: '#f2a53a', petal: '#ffc9de', trunk: '#7a5a44', blossom: '#f7b6d0',
      water: '#9fd3ea', duck: '#ffffff', beak: '#f2a53a', wood: '#b08a62',
    },
    dark: {
      sky1: '#0f1b29', sky2: '#1d3340', orb: '#e6ecf5', far: '#1b3832', near: '#1e4436',
      ground: '#1b3b2b', stem: '#2f6e3d', bud: '#3f7a4a', p1: '#b85f8a', p2: '#c79a3a',
      p3: '#7f68c0', p4: '#c9d2dc', c: '#b8741f', petal: '#9a6a80', trunk: '#2a1f1a', blossom: '#a8607f',
      water: '#1f4a5e', duck: '#c9d2dc', beak: '#b8741f', wood: '#3d2f24',
    },
  },
  summer: {
    light: {
      sky1: '#8ecdf0', sky2: '#fde9c4', orb: '#fff2a8', far: '#9fc7a0', near: '#7fb07f',
      ground: '#6c9a63', pole: '#5a4a3e', wire: '#4a4038', bird: '#2f2a2a', house: '#f3ead8', roof: '#b5553f',
      hay: '#e6c463', sun1: '#f5c22e', sunc: '#6b4423', stem: '#4f8a45', cloud: '#ffffff', kite: '#e2574c',
    },
    dark: {
      sky1: '#232c58', sky2: '#8a4f5e', orb: '#f3e7d0', far: '#1d2740', near: '#182033',
      ground: '#121824', pole: '#0b0e15', wire: '#0b0e15', bird: '#080a10', house: '#2a2636', roof: '#1a1420',
      hay: '#4a4030', sun1: '#8a7430', sunc: '#1f150c', stem: '#1f3a2a', cloud: '#5a4a70', kite: '#b8483f',
    },
  },
  fall: {
    light: {
      sky1: '#f0d6b6', sky2: '#fbf0df', orb: '#ffe9b0', far: '#d9b58c', near: '#c99a6b',
      ground: '#a9773f', trunk: '#5a3d2b', pile: '#b8742f', l1: '#c8452c', l2: '#e07b2a',
      l3: '#e8a93a', l4: '#a8522a', l5: '#8f3a26', barn: '#a8402f', barnroof: '#5a3d2b', trim: '#f6ead6',
      pumpkin: '#e8791f', pstem: '#5f7a3a', straw: '#e3c06a', shirt: '#4f6f8f', wood: '#7a5a3c',
    },
    dark: {
      sky1: '#1b131f', sky2: '#3a2430', orb: '#f1e3c8', far: '#2a1d22', near: '#35241e',
      ground: '#2b1d14', trunk: '#170f0b', pile: '#573316', l1: '#8f3220', l2: '#a85a1f',
      l3: '#b0802c', l4: '#753a1e', l5: '#5f271a', barn: '#4a1f18', barnroof: '#170f0b', trim: '#8a7a66',
      pumpkin: '#a8551a', pstem: '#2f3f1f', straw: '#7a6535', shirt: '#24364a', wood: '#2a1f15',
    },
  },
}

// Every motion is slow, and every moving part rests in view with motion off.
const MOTION =
  '@keyframes fall{from{transform:translate(0px,-1000px)}to{transform:translate(60px,1000px)}}' +
  '.fl{animation:fall 30s linear infinite}' +
  '@keyframes drift{from{transform:translate(90px,-280px) rotate(0deg)}to{transform:translate(-240px,760px) rotate(320deg)}}' +
  '.dr{animation:drift 26s linear infinite}' +
  '@keyframes sway{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}' +
  '.sw{animation:sway 7s ease-in-out infinite alternate}' +
  '@keyframes bob{from{transform:translate(0px,0px)}to{transform:translate(0px,-3px)}}' +
  '.bob{animation:bob 3s ease-in-out infinite alternate}' +
  '@keyframes glide{from{transform:translate(-300px,40px)}to{transform:translate(1900px,-60px)}}' +
  '.gl{animation:glide 70s linear infinite}' +
  '@keyframes twinkle{from{opacity:0.45}to{opacity:1}}' +
  '.tw{animation:twinkle 2.4s ease-in-out infinite alternate}'

function styleOf(season: Season): string {
  const palette = PALETTES[season]
  const vars = (colors: Record<string, string>): string =>
    Object.entries(colors)
      .map(([name, color]) => `--${name}:${color}`)
      .join(';')
  const classes = Object.keys(palette.light)
    .map(
      name =>
        `.f-${name}{fill:var(--${name})}` +
        `.t-${name}{stroke:var(--${name});fill:none;stroke-linecap:round}` +
        `.s-${name}{stop-color:var(--${name})}`,
    )
    .join('')

  return (
    `<style>.sm{${vars(palette.light)}}` +
    `@media (prefers-color-scheme: dark){.sm{${vars(palette.dark)}}}` +
    `${classes}${MOTION}</style>`
  )
}

// A filled band of land whose top edge follows `top`.
function ridge(top: (x: number) => number, name: string): string {
  let d = `M0,${H}L0,${n(top(0))}`

  for (let x = 40; x <= W; x += 40) {
    d += `L${x},${n(top(x))}`
  }

  return `<path class="f-${name}" d="${d}L${W},${H}Z"/>`
}

// The sun by day, the moon by night: it sinks as the limit's reset comes near.
function orb(progress: number): string {
  const x = n(170 + 1260 * progress)
  const y = n(130 + 560 * Math.pow(progress, 1.7))

  return (
    `<circle class="f-orb" cx="${x}" cy="${y}" r="92" opacity="0.22"/>` +
    `<circle class="f-orb" cx="${x}" cy="${y}" r="50"/>`
  )
}

// The top of the winter snow at x. It drifts deep against the pines on the left and,
// less so, on the right. Between them it stays shallow, so the snowman, the tree and
// the house show for most of the window and a full drift only reaches the windows.
export function driftTop(f: number, x: number): number {
  const left = (x - 180) / (x < 180 ? 450 : 300)
  const right = (x - 1600) / 170
  const big = Math.exp(-left * left)
  const small = Math.exp(-right * right)
  const waves = (0.4 + 0.6 * Math.max(big, small)) * ((14 + 10 * f) * Math.sin(x / 170 + 1) + 9 * Math.sin(x / 61 + 3))

  return GROUND - f * (480 * big + 300 * small) - Math.pow(f, 1.5) * 50 + waves
}

function winter(f: number): string {
  const random = rng(7)
  const pine = (x: number, h: number): string => {
    let tree = `<rect class="f-cabin" x="${x - 5}" y="${n(GROUND - h * 0.15)}" width="10" height="${n(h * 0.15 + 4)}"/>`

    for (let i = 0; i < 3; i++) {
      const top = GROUND - h + i * h * 0.22
      const half = h * (0.16 + 0.07 * i)
      tree += `<path class="f-pine" d="M${x},${n(top)}L${n(x + half)},${n(top + h * 0.5)}L${n(x - half)},${n(top + h * 0.5)}Z"/>`
    }

    return tree
  }
  const pines = [
    [150, 250], [300, 180], [520, 220], [1010, 170], [1420, 260], [1530, 190],
  ].map(([x, h]) => pine(x ?? 0, h ?? 0))
  // What stands on the ground is slowly snowed in: the fence first, the snowman
  // up to its hat at the end.
  const house =
    '<rect class="f-cabin" x="1226" y="744" width="16" height="44"/>' +
    '<rect class="f-cabin" x="1110" y="800" width="150" height="88"/>' +
    '<path class="f-roof" d="M1094,806L1185,738L1276,806Z"/>' +
    '<path class="f-snow" d="M1112,792L1185,738L1258,792L1248,794L1185,750L1122,794Z"/>' +
    '<rect class="f-roof" x="1172" y="838" width="26" height="50"/>' +
    '<rect class="f-glow" x="1124" y="826" width="30" height="30"/><rect class="f-glow" x="1216" y="826" width="30" height="30"/>' +
    '<path class="t-cabin" stroke-width="2" d="M1139,826V856M1124,841H1154M1231,826V856M1216,841H1246"/>' +
    '<circle class="f-smoke" cx="1236" cy="728" r="9" opacity="0.6"/><circle class="f-smoke" cx="1247" cy="706" r="12" opacity="0.45"/>' +
    '<circle class="f-smoke" cx="1262" cy="680" r="16" opacity="0.3"/>'
  let fence = '<rect class="f-fence" x="324" y="856" width="168" height="5"/><rect class="f-fence" x="324" y="870" width="168" height="5"/>'

  for (let x = 330; x <= 480; x += 30) {
    fence += `<rect class="f-fence" x="${x}" y="848" width="7" height="40"/>`
  }

  const festive = (): string => {
    const x = 860
    const h = 300
    const colors = ['xr', 'xg', 'xb']
    let tree = `<rect class="f-cabin" x="${x - 7}" y="${GROUND - 34}" width="14" height="38"/>`
    let lights = ''

    for (let i = 0; i < 4; i++) {
      const tip = GROUND - h + i * h * 0.19
      const foot = tip + h * 0.4
      const half = h * (0.13 + 0.06 * i)
      tree += `<path class="f-pine" d="M${x},${n(tip)}L${n(x + half)},${n(foot)}L${n(x - half)},${n(foot)}Z"/>`
      for (let k = 0; k < 3 + i; k++) {
        const along = (k + 0.5) / (3 + i)
        const lx = n(x - half * 0.8 + along * half * 1.6)
        const ly = n(foot - 16 + 9 * Math.sin(along * Math.PI))
        lights += `<circle class="tw f-${colors[(i + k) % 3]}" cx="${lx}" cy="${ly}" r="5" style="animation-delay:-${n(((i * 5 + k * 3) % 11) * 0.4)}s"/>`
      }
    }

    let star = ''

    for (let i = 0; i < 10; i++) {
      const reach = i % 2 === 0 ? 17 : 7
      const angle = (i * Math.PI) / 5 - Math.PI / 2
      star += `${i === 0 ? 'M' : 'L'}${n(x + reach * Math.cos(angle))},${n(GROUND - h - 8 + reach * Math.sin(angle))}`
    }

    return `${tree}${lights}<path class="f-xg" d="${star}Z"/>`
  }
  const snowman =
    '<path class="t-cabin" stroke-width="3" d="M640,806L606,786M680,806L714,786M606,786l-8,-10M714,786l8,-10"/>' +
    '<circle class="f-snow" cx="660" cy="853" r="34" style="stroke:var(--snow2);stroke-width:2"/>' +
    '<circle class="f-snow" cx="660" cy="806" r="25" style="stroke:var(--snow2);stroke-width:2"/>' +
    '<circle class="f-snow" cx="660" cy="768" r="18" style="stroke:var(--snow2);stroke-width:2"/>' +
    '<path class="f-scarf" d="M642,780H678V789H672V806H663V789H642Z"/>' +
    '<rect class="f-coal" x="638" y="750" width="44" height="5"/><rect class="f-coal" x="646" y="728" width="28" height="23"/>' +
    '<circle class="f-coal" cx="654" cy="764" r="2.2"/><circle class="f-coal" cx="666" cy="764" r="2.2"/>' +
    '<path class="f-carrot" d="M660,768L676,772L660,775Z"/>' +
    '<circle class="f-coal" cx="660" cy="800" r="2.5"/><circle class="f-coal" cx="660" cy="812" r="2.5"/><circle class="f-coal" cx="660" cy="846" r="2.5"/>'
  const sky = rng(5)
  let stars = ''

  for (let i = 0; i < 36; i++) {
    stars += `<circle class="f-star" cx="${n(sky() * W)}" cy="${n(20 + sky() * 400)}" r="${n(1 + sky() * 1.3)}" opacity="0.7"/>`
  }
  const top = (x: number): number => driftTop(f, x)
  const flakes: string[] = []
  const count = Math.round(40 + f * 170)

  for (let i = 0; i < count; i++) {
    const x = n(random() * W)
    const y = n(random() * H)
    const r = n(1.6 + random() * 3.2)
    const seconds = n(20 + random() * 22)
    const delay = n(random() * 40)
    flakes.push(
      `<circle class="fl f-flake" cx="${x}" cy="${y}" r="${r}" opacity="0.85" style="animation-duration:${seconds}s;animation-delay:-${delay}s"/>`,
    )
  }

  return (
    stars +
    ridge(x => 640 + 40 * Math.sin(x / 260 + 1) + 18 * Math.sin(x / 90), 'far') +
    ridge(x => 760 + 30 * Math.sin(x / 200 + 4) + 12 * Math.sin(x / 70 + 2), 'near') +
    ridge(x => GROUND + 6 * Math.sin(x / 150), 'ground') +
    pines.join('') +
    house +
    fence +
    festive() +
    snowman +
    ridge(x => top(x) - 22 - 10 * Math.sin(x / 120), 'snow2') +
    ridge(top, 'snow') +
    flakes.join('')
  )
}

const LEAF = '<path id="lf" d="M0,-9C7,-6 7,5 0,10C-7,5 -7,-6 0,-9Z"/>'

// The top of the fall leaf pile at x: a mound under the tree. Far from the trunk it
// stays shallow, so the pumpkins go under late and a full pile reaches half way up the barn.
export function pileTop(f: number, x: number): number {
  const away = (x - 1250) / (x < 1250 ? 300 : 450)
  const mound = Math.exp(-away * away)
  const waves = (0.3 + 0.7 * mound) * ((10 + 26 * f) * Math.sin(x / 210 + 2) + (6 + 10 * f) * Math.sin(x / 75))

  return GROUND - f * 415 * mound - Math.pow(f, 1.5) * 85 + waves
}

function fall(f: number): string {
  const random = rng(11)
  const leaf = (x: number, y: number, scale: number): string =>
    `<use href="#lf" class="f-l${1 + Math.floor(random() * 5)}" transform="translate(${n(x)},${n(y)}) rotate(${Math.round(random() * 360)}) scale(${n(scale)})"/>`
  const tree =
    '<path class="f-trunk" d="M1215,890C1225,760 1205,640 1235,520L1265,520C1275,640 1262,760 1290,890Z"/>' +
    '<path class="t-trunk" stroke-width="14" d="M1245,560C1180,470 1100,430 1030,400M1250,540C1300,440 1400,400 1470,360M1248,530C1240,430 1230,340 1250,250M1240,600C1150,570 1080,560 1010,540M1258,600C1340,570 1420,560 1490,520"/>'
  const total = 160
  const fallen = Math.round(f * total)
  const canopy: string[] = []

  for (let i = 0; i < total; i++) {
    const angle = random() * Math.PI * 2
    const reach = Math.sqrt(random())
    const x = 1245 + Math.cos(angle) * 340 * reach
    const y = 380 + Math.sin(angle) * 230 * reach
    const drawn = leaf(x, y, 1.6 + random() * 1.2)

    // The first leaves in the list are the first to fall.
    if (i >= fallen) {
      canopy.push(drawn)
    }
  }

  const top = (x: number): number => pileTop(f, x)
  const pile: string[] = []
  const heaped = Math.round(f * 240)

  for (let i = 0; i < heaped; i++) {
    const x = random() * W
    const edge = top(x)
    const depth = random()
    pile.push(leaf(x, edge - 4 + depth * depth * (H - edge), 1.8 + random() * 1.4))
  }

  // The pile buries these too: the bench first, the pumpkins late, half the barn at the end.
  const barn =
    '<rect class="f-barn" x="230" y="792" width="160" height="96"/>' +
    '<path class="f-barnroof" d="M218,796L246,748L310,722L374,748L402,796Z"/>' +
    '<rect class="f-trim" x="286" y="826" width="48" height="62"/>' +
    '<path class="t-barn" stroke-width="3" d="M286,826L334,888M334,826L286,888"/>' +
    '<rect class="f-trim" x="298" y="762" width="24" height="20"/>'
  const bench =
    '<rect class="f-wood" x="960" y="822" width="104" height="9"/><rect class="f-wood" x="960" y="848" width="104" height="9"/>' +
    '<rect class="f-wood" x="966" y="822" width="7" height="66"/><rect class="f-wood" x="1051" y="822" width="7" height="66"/>'
  const rake =
    '<path class="t-wood" stroke-width="5" d="M1128,888L1196,650"/>' +
    '<path class="t-wood" stroke-width="4" d="M1176,646L1216,656M1178,646l-4,16M1188,649l-4,16M1198,651l-4,16M1208,654l-4,16"/>'
  const pumpkins = [
    [560, 1.2], [612, 0.8], [690, 1.4], [746, 0.9],
  ]
    .map(
      ([x, size]) =>
        `<g transform="translate(${x},${GROUND + 2}) scale(${size})"><rect class="f-pstem" x="-3" y="-44" width="6" height="12"/>` +
        '<ellipse class="f-pumpkin" cx="-12" cy="-18" rx="16" ry="18"/><ellipse class="f-pumpkin" cx="12" cy="-18" rx="16" ry="18"/>' +
        '<ellipse class="f-pumpkin" cx="0" cy="-18" rx="13" ry="19"/>' +
        '<path class="t-barnroof" stroke-width="1.5" opacity="0.35" d="M-8,-35Q-14,-18 -8,-1M8,-35Q14,-18 8,-1"/></g>',
    )
    .join('')
  const scarecrow =
    '<path class="t-wood" stroke-width="7" d="M860,888V716M800,762H920"/>' +
    '<path class="f-shirt" d="M806,752H914V772H884V824H836V772H806Z"/>' +
    '<path class="t-straw" stroke-width="3" d="M800,762l-12,-8M800,762l-14,2M800,762l-10,10M920,762l12,-8M920,762l14,2M920,762l10,10M840,824l-4,14M852,824v14M868,824v14M880,824l4,14"/>' +
    '<circle class="f-straw" cx="860" cy="728" r="20"/>' +
    '<circle class="f-trunk" cx="853" cy="725" r="2.5"/><circle class="f-trunk" cx="867" cy="725" r="2.5"/>' +
    '<path class="t-trunk" stroke-width="2" d="M852,736q8,6 16,0"/>' +
    '<path class="f-trunk" d="M832,712H888L878,708L870,676H850L842,708Z"/>'
  let geese = ''

  for (let i = 0; i <= 3; i++) {
    for (const side of i === 0 ? [0] : [-1, 1]) {
      geese += `<path class="t-trunk" stroke-width="2.5" d="M${651 - 34 * i},${230 + side * 17 * i}q4.5,-6 9,0q4.5,-6 9,0"/>`
    }
  }

  const falling: string[] = []

  if (f > 0.01 && f < 0.995) {
    for (let i = 0; i < 9; i++) {
      const x = n(900 + random() * 600)
      const y = n(320 + random() * 440)
      const seconds = n(18 + random() * 14)
      const delay = n(random() * 30)
      falling.push(
        `<g transform="translate(${x},${y})"><use href="#lf" class="dr f-l${1 + (i % 5)}" style="animation-duration:${seconds}s;animation-delay:-${delay}s" transform="scale(2)"/></g>`,
      )
    }
  }

  return (
    `<defs>${LEAF}</defs>` +
    geese +
    ridge(x => 660 + 36 * Math.sin(x / 240 + 2) + 14 * Math.sin(x / 85), 'far') +
    ridge(x => 780 + 26 * Math.sin(x / 190 + 5) + 10 * Math.sin(x / 66), 'near') +
    ridge(x => GROUND + 6 * Math.sin(x / 150), 'ground') +
    barn +
    bench +
    tree +
    canopy.join('') +
    rake +
    pumpkins +
    scarecrow +
    ridge(top, 'pile') +
    pile.join('') +
    falling.join('')
  )
}

function flowerHeads(): string {
  let defs = ''

  for (let kind = 1; kind <= 4; kind++) {
    let petals = ''

    for (let i = 0; i < 6; i++) {
      petals += `<ellipse class="f-p${kind}" cx="0" cy="-11" rx="6" ry="10" transform="rotate(${i * 60})"/>`
    }
    defs += `<g id="h${kind}">${petals}<circle class="f-c" r="6"/></g>`
  }

  return defs
}

const isInPond = (x: number, y: number): boolean => ((x - 420) / 175) ** 2 + ((y - 852) / 48) ** 2 < 1

// No flower grows in the pond: one that would is moved past its right bank.
// The move is wider than the pond with its margin (350), so it cannot land back inside.
export function clearOfPond(x: number, y: number): number {
  return isInPond(x, y) ? x + 360 : x
}

function spring(f: number): string {
  const random = rng(23)
  const total = 72
  const bloomed = Math.round(f * total)
  const flowers: { y: number; markup: string }[] = []

  for (let i = 0; i < total; i++) {
    const depth = Math.pow(random(), 0.8)
    const spot = random() * W
    const y = n(790 + 200 * depth)
    const x = n(clearOfPond(spot, y))
    const scale = n(0.6 + depth * 0.9)
    const delay = n(random() * 14)
    const kind = 1 + Math.floor(random() * 4)
    // The meadow grows as it blooms: some stay low, some climb the screen.
    const reach = Math.pow(random(), 1.6)
    const tall = n((44 + f * reach * 640) / scale)
    const head =
      i < bloomed
        ? `<use href="#h${kind}" transform="translate(0,${-tall}) scale(${n(1 + f * reach * 0.9)})"/>`
        : `<ellipse class="f-bud" cx="0" cy="${n(-tall - 3)}" rx="4" ry="6"/>`
    const upperLeaf =
      tall > 150 ? `<ellipse class="f-stem" cx="-9" cy="${n(-tall * 0.62)}" rx="9" ry="3.5"/>` : ''

    flowers.push({
      y,
      markup:
        `<g transform="translate(${x},${y}) scale(${scale})"><g class="sw" style="animation-delay:-${delay}s">` +
        `<path class="t-stem" stroke-width="3" d="M0,0Q${n(tall * 0.07)},${n(-tall / 2)} 0,${-tall}"/>` +
        `<ellipse class="f-stem" cx="8" cy="${n(-tall * 0.35)}" rx="8" ry="3"/>${upperLeaf}` +
        `${head}</g></g>`,
    })
  }
  flowers.sort((a, b) => a.y - b.y)

  // Two vines climb the edges, and flower as they go.
  const vine = (x: number, lean: number): string => {
    const reach = f * 800

    if (reach < 30) {
      return ''
    }
    let d = `M${x},${H}`
    let blossoms = ''

    for (let up = 60; up <= reach; up += 60) {
      const y = H - up
      const sway = lean * 26 * Math.sin(up / 90)
      d += `L${n(x + sway)},${y}`
      if (up % 120 === 0) {
        blossoms += `<use href="#h${1 + ((up / 120) % 4)}" transform="translate(${n(x + sway + lean * 16)},${y}) scale(1.5)"/>`
      }
    }

    return `<path class="t-stem" stroke-width="5" d="${d}"/>${blossoms}`
  }
  let rainbow = ''

  for (const [i, color] of ['p1', 'p2', 'bud', 'p3'].entries()) {
    const r = 470 - 20 * i
    rainbow += `<path class="t-${color}" stroke-width="18" opacity="0.3" d="M${520 - r},800A${r},${r} 0 0 1 ${520 + r},800"/>`
  }

  const duck = (x: number, y: number, size: number, facing: number): string =>
    `<g transform="translate(${x},${y}) scale(${facing * size},${size})"><ellipse class="f-duck" cx="0" cy="-8" rx="17" ry="10"/>` +
    '<circle class="f-duck" cx="14" cy="-22" r="8"/><path class="f-beak" d="M21,-23L31,-20L21,-18Z"/><circle class="f-trunk" cx="16" cy="-24" r="1.5"/></g>'
  const pond =
    '<ellipse class="f-water" cx="420" cy="852" rx="150" ry="32"/>' +
    '<ellipse class="f-duck" cx="372" cy="862" rx="46" ry="4" opacity="0.25"/>' +
    duck(396, 856, 1, 1) +
    duck(478, 848, 0.8, -1)
  let fence = '<rect class="f-wood" x="56" y="780" width="252" height="6"/><rect class="f-wood" x="56" y="794" width="252" height="6"/>'

  for (let x = 60; x <= 300; x += 40) {
    fence += `<rect class="f-wood" x="${x}" y="770" width="8" height="38"/>`
  }

  const blossom =
    '<path class="f-trunk" d="M1316,802C1322,740 1314,690 1326,640L1346,640C1352,690 1346,740 1356,802Z"/>' +
    '<path class="t-trunk" stroke-width="9" d="M1334,660C1300,620 1270,600 1240,590M1338,650C1370,610 1400,596 1430,580M1336,646C1334,610 1332,580 1338,550"/>' +
    [[1336, 540, 70], [1270, 580, 58], [1400, 570, 60], [1300, 510, 52], [1376, 506, 54], [1232, 610, 40], [1440, 600, 42]]
      .map(([x, y, r]) => `<circle class="f-blossom" cx="${x}" cy="${y}" r="${r}"/>`)
      .join('') +
    [[1310, 530, 26], [1390, 556, 22], [1262, 574, 20], [1350, 490, 20]]
      .map(([x, y, r]) => `<circle class="f-petal" cx="${x}" cy="${y}" r="${r}" opacity="0.7"/>`)
      .join('')
  const birdhouse =
    '<rect class="f-wood" x="1076" y="700" width="8" height="102"/><rect class="f-wood" x="1058" y="664" width="44" height="40"/>' +
    '<path class="f-trunk" d="M1050,668L1080,640L1110,668Z"/><circle class="f-trunk" cx="1080" cy="682" r="7"/>'
  const petals: string[] = []

  if (f > 0.5) {
    for (let i = 0; i < 12; i++) {
      const x = n(200 + random() * 1300)
      const y = n(150 + random() * 500)
      const seconds = n(20 + random() * 14)
      const delay = n(random() * 30)
      petals.push(
        `<g transform="translate(${x},${y})"><ellipse class="dr f-petal" rx="7" ry="4" style="animation-duration:${seconds}s;animation-delay:-${delay}s"/></g>`,
      )
    }
  }

  return (
    `<defs>${flowerHeads()}</defs>` +
    rainbow +
    ridge(x => 600 + 34 * Math.sin(x / 250 + 3) + 12 * Math.sin(x / 95), 'far') +
    ridge(x => 700 + 22 * Math.sin(x / 180 + 1) + 9 * Math.sin(x / 70), 'near') +
    ridge(x => 790 + 10 * Math.sin(x / 160 + 2), 'ground') +
    pond +
    fence +
    blossom +
    birdhouse +
    vine(46, 1) +
    vine(W - 46, -1) +
    flowers.map(one => one.markup).join('') +
    petals.join('')
  )
}

// A perched bird, its feet at the origin, looking right.
const BIRD =
  '<g id="b"><ellipse cx="0" cy="-16" rx="15" ry="11"/><circle cx="11" cy="-27" r="7.5"/>' +
  '<path d="M17,-29L26,-26L17,-24Z"/><path d="M-11,-12L-29,-1L-23,-15Z"/></g>'

function sunflowerHead(): string {
  let petals = ''

  for (let i = 0; i < 10; i++) {
    petals += `<ellipse class="f-sun1" cx="0" cy="-15" rx="5" ry="9" transform="rotate(${i * 36})"/>`
  }

  return `<g id="sf">${petals}<circle class="f-sunc" r="9"/></g>`
}

function summer(f: number): string {
  const random = rng(31)
  const wires = [230, 420, 610, 800]
  const sag = 70
  const perWire = 13
  const slots: { x: number; y: number }[] = []
  let lines = ''
  let arms = ''

  for (const wire of wires) {
    lines += `<path class="t-wire" stroke-width="3" d="M-20,${wire}Q800,${wire + sag} 1620,${wire}"/>`
    arms += `<rect class="f-pole" x="110" y="${wire + 4}" width="120" height="9"/><rect class="f-pole" x="1370" y="${wire + 4}" width="120" height="9"/>`
    for (let i = 0; i < perWire; i++) {
      const t = 0.05 + ((i + 0.5) / perWire) * 0.9 + (random() - 0.5) * 0.024
      slots.push({ x: -20 + 1640 * t, y: wire + 2 * t * (1 - t) * sag })
    }
  }
  // Shuffle, so the birds land here and there and not in a row.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const held = slots[i]
    const other = slots[j]

    if (held !== undefined && other !== undefined) {
      slots[i] = other
      slots[j] = held
    }
  }

  const landed = Math.round(f * slots.length)
  const birds: string[] = []

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const scale = n(1.25 + random() * 0.5)
    const facing = random() < 0.5 ? -1 : 1
    const delay = n(random() * 6)

    if (slot === undefined || i >= landed) {
      continue
    }
    birds.push(
      `<g transform="translate(${n(slot.x)},${n(slot.y)})"><g${i % 4 === 0 ? ` class="bob" style="animation-delay:-${delay}s"` : ''}>` +
        `<use href="#b" class="f-bird" transform="scale(${n(scale * facing)},${scale})"/></g></g>`,
    )
  }

  const cloud = (x: number, y: number, size: number): string =>
    `<g transform="translate(${x},${y}) scale(${size})" opacity="0.75"><ellipse class="f-cloud" cx="0" cy="0" rx="70" ry="22"/>` +
    '<circle class="f-cloud" cx="-28" cy="-14" r="24"/><circle class="f-cloud" cx="12" cy="-24" r="32"/><circle class="f-cloud" cx="44" cy="-8" r="20"/></g>'
  const clouds = cloud(330, 130, 1.2) + cloud(980, 100, 1) + cloud(1290, 330, 0.8)
  const farm =
    '<rect class="f-house" x="1010" y="846" width="120" height="68"/><path class="f-roof" d="M998,850L1070,800L1142,850Z"/>' +
    '<rect class="f-roof" x="1056" y="874" width="26" height="40"/>' +
    '<rect class="f-orb" x="1022" y="866" width="22" height="22"/><rect class="f-orb" x="1096" y="866" width="22" height="22"/>' +
    '<path class="f-roof" d="M1130,868H1192V876H1130Z"/><rect class="f-house" x="1183" y="876" width="5" height="38"/>'
  let field = ''

  for (const x of [540, 600, 664]) {
    field += `<circle class="f-hay" cx="${x}" cy="886" r="24"/><path class="t-pole" stroke-width="2" opacity="0.4" d="M${x - 12},886a12,12 0 1 1 12,12"/>`
  }
  for (let i = 0; i < 7; i++) {
    const x = 250 + 40 * i
    const tall = 90 + ((i * 37) % 40)
    field +=
      `<path class="t-stem" stroke-width="5" d="M${x},962V${962 - tall}"/>` +
      `<ellipse class="f-stem" cx="${x + 10}" cy="${n(962 - tall * 0.5)}" rx="11" ry="5"/>` +
      `<use href="#sf" transform="translate(${x},${962 - tall}) scale(1.5)"/>`
  }

  const bike =
    '<circle class="t-wire" stroke-width="3" cx="1352" cy="972" r="22"/><circle class="t-wire" stroke-width="3" cx="1408" cy="972" r="22"/>' +
    '<path class="t-wire" stroke-width="3" d="M1352,972L1372,940L1400,940L1408,972M1372,940L1386,972L1352,972M1400,940l-4,-10h10M1372,940l-4,-8h-8"/>'
  const kite =
    '<path class="t-wire" stroke-width="1.5" d="M1210,206Q1150,520 1150,870"/>' +
    '<path class="f-kite" d="M1210,110L1238,150L1210,206L1182,150Z"/>' +
    '<path class="f-kite" d="M1196,300l12,-6v12ZM1180,380l12,-6v12Z"/>'
  const gliders =
    f < 0.995
      ? '<g transform="translate(380,120)"><path class="gl t-bird" stroke-width="3" d="M-14,0q7,-9 14,0q7,-9 14,0"/></g>' +
        '<g transform="translate(300,170)"><path class="gl t-bird" stroke-width="3" style="animation-delay:-31s" d="M-11,0q5,-7 11,0q5,-7 11,0"/></g>'
      : ''

  return (
    `<defs>${BIRD}${sunflowerHead()}</defs>` +
    clouds +
    ridge(x => 830 + 24 * Math.sin(x / 230 + 1) + 10 * Math.sin(x / 80), 'far') +
    ridge(x => 905 + 12 * Math.sin(x / 170 + 4), 'ground') +
    farm +
    field +
    '<rect class="f-pole" x="161" y="150" width="18" height="850"/><rect class="f-pole" x="1421" y="150" width="18" height="850"/>' +
    arms +
    lines +
    bike +
    kite +
    birds.join('') +
    gliders
  )
}

const DRAW: Record<Season, (f: number) => string> = { winter, spring, summer, fall }

/** The whole backdrop as one SVG document. */
export function drawScene(args: SceneArgs): string {
  const f = clamp(args.percent, 0, 100) / 100

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="sm" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    styleOf(args.season) +
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s-sky1"/><stop offset="1" class="s-sky2"/></linearGradient></defs>' +
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
    orb(clamp(args.resetProgress, 0, 1)) +
    DRAW[args.season](f) +
    '</svg>'
  )
}

const FILLING: Record<Season, string> = {
  winter: 'snow piling up',
  spring: 'a meadow coming into bloom',
  summer: 'birds landing on the wires',
  fall: 'leaves falling into a pile',
}

/** What the scene says, for a reader who cannot see it. */
export function describeScene(args: SceneArgs): string {
  return `A ${args.season} scene with ${FILLING[args.season]}: ${Math.round(clamp(args.percent, 0, 100))} percent of the session limit used`
}
