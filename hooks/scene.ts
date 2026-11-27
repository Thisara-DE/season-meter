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
      glow: '#ffd98a', flake: '#ffffff',
    },
    dark: {
      sky1: '#0d1626', sky2: '#1e2c44', orb: '#e8edf7', far: '#1a2940', near: '#21334b',
      ground: '#33435b', snow: '#b4c2d8', snow2: '#8496b0', pine: '#132927', cabin: '#241a18',
      glow: '#ffc766', flake: '#dfe8f5',
    },
  },
  spring: {
    light: {
      sky1: '#cbe6f3', sky2: '#f4fbf3', orb: '#fff3b8', far: '#b7dcae', near: '#94c98a',
      ground: '#7dba72', stem: '#4d8f4a', bud: '#a8cf8a', p1: '#f49ac1', p2: '#ffd166',
      p3: '#b79cf0', p4: '#ffffff', c: '#f2a53a', petal: '#ffc9de',
    },
    dark: {
      sky1: '#0f1b29', sky2: '#1d3340', orb: '#e6ecf5', far: '#1b3832', near: '#1e4436',
      ground: '#1b3b2b', stem: '#2f6e3d', bud: '#3f7a4a', p1: '#b85f8a', p2: '#c79a3a',
      p3: '#7f68c0', p4: '#c9d2dc', c: '#b8741f', petal: '#9a6a80',
    },
  },
  summer: {
    light: {
      sky1: '#8ecdf0', sky2: '#fde9c4', orb: '#fff2a8', far: '#9fc7a0', near: '#7fb07f',
      ground: '#6c9a63', pole: '#5a4a3e', wire: '#4a4038', bird: '#2f2a2a',
    },
    dark: {
      sky1: '#232c58', sky2: '#8a4f5e', orb: '#f3e7d0', far: '#1d2740', near: '#182033',
      ground: '#121824', pole: '#0b0e15', wire: '#0b0e15', bird: '#080a10',
    },
  },
  fall: {
    light: {
      sky1: '#f0d6b6', sky2: '#fbf0df', orb: '#ffe9b0', far: '#d9b58c', near: '#c99a6b',
      ground: '#a9773f', trunk: '#5a3d2b', pile: '#b8742f', l1: '#c8452c', l2: '#e07b2a',
      l3: '#e8a93a', l4: '#a8522a', l5: '#8f3a26',
    },
    dark: {
      sky1: '#1b131f', sky2: '#3a2430', orb: '#f1e3c8', far: '#2a1d22', near: '#35241e',
      ground: '#2b1d14', trunk: '#170f0b', pile: '#573316', l1: '#8f3220', l2: '#a85a1f',
      l3: '#b0802c', l4: '#753a1e', l5: '#5f271a',
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
  '.gl{animation:glide 70s linear infinite}'

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
  const cabin =
    '<rect class="f-cabin" x="1130" y="815" width="100" height="72"/>' +
    '<rect class="f-cabin" x="1206" y="770" width="14" height="40"/>' +
    '<path class="f-pine" d="M1116,820L1180,770L1244,820Z"/>' +
    '<rect class="f-glow" x="1166" y="838" width="24" height="24"/>'
  const top = (x: number): number =>
    GROUND - f * 560 + (14 + 10 * f) * Math.sin(x / 170 + 1) + 9 * Math.sin(x / 61 + 3)
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
    ridge(x => 640 + 40 * Math.sin(x / 260 + 1) + 18 * Math.sin(x / 90), 'far') +
    ridge(x => 760 + 30 * Math.sin(x / 200 + 4) + 12 * Math.sin(x / 70 + 2), 'near') +
    ridge(x => GROUND + 6 * Math.sin(x / 150), 'ground') +
    pines.join('') +
    cabin +
    ridge(x => top(x) - 22 - 10 * Math.sin(x / 120), 'snow2') +
    ridge(top, 'snow') +
    flakes.join('')
  )
}

const LEAF = '<path id="lf" d="M0,-9C7,-6 7,5 0,10C-7,5 -7,-6 0,-9Z"/>'

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

  const top = (x: number): number =>
    GROUND - f * 500 + (10 + 26 * f) * Math.sin(x / 210 + 2) + (6 + 10 * f) * Math.sin(x / 75)
  const pile: string[] = []
  const heaped = Math.round(f * 240)

  for (let i = 0; i < heaped; i++) {
    const x = random() * W
    const edge = top(x)
    const depth = random()
    pile.push(leaf(x, edge - 4 + depth * depth * (H - edge), 1.8 + random() * 1.4))
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
    ridge(x => 660 + 36 * Math.sin(x / 240 + 2) + 14 * Math.sin(x / 85), 'far') +
    ridge(x => 780 + 26 * Math.sin(x / 190 + 5) + 10 * Math.sin(x / 66), 'near') +
    ridge(x => GROUND + 6 * Math.sin(x / 150), 'ground') +
    tree +
    canopy.join('') +
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

function spring(f: number): string {
  const random = rng(23)
  const total = 72
  const bloomed = Math.round(f * total)
  const flowers: { y: number; markup: string }[] = []

  for (let i = 0; i < total; i++) {
    const depth = Math.pow(random(), 0.8)
    const x = n(random() * W)
    const y = n(790 + 200 * depth)
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
    ridge(x => 600 + 34 * Math.sin(x / 250 + 3) + 12 * Math.sin(x / 95), 'far') +
    ridge(x => 700 + 22 * Math.sin(x / 180 + 1) + 9 * Math.sin(x / 70), 'near') +
    ridge(x => 790 + 10 * Math.sin(x / 160 + 2), 'ground') +
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

  const gliders =
    f < 0.995
      ? '<g transform="translate(380,120)"><path class="gl t-bird" stroke-width="3" d="M-14,0q7,-9 14,0q7,-9 14,0"/></g>' +
        '<g transform="translate(300,170)"><path class="gl t-bird" stroke-width="3" style="animation-delay:-31s" d="M-11,0q5,-7 11,0q5,-7 11,0"/></g>'
      : ''

  return (
    `<defs>${BIRD}</defs>` +
    ridge(x => 830 + 24 * Math.sin(x / 230 + 1) + 10 * Math.sin(x / 80), 'far') +
    ridge(x => 905 + 12 * Math.sin(x / 170 + 4), 'ground') +
    '<rect class="f-pole" x="161" y="150" width="18" height="850"/><rect class="f-pole" x="1421" y="150" width="18" height="850"/>' +
    arms +
    lines +
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
