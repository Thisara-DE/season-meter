import { expect, test } from 'claude-code/testing'

import { clearOfPond, drawScene, driftTop, pileTop, seasonOf, SEASONS } from '../hooks/scene'

const count = (text: string, part: string): number => text.split(part).length - 1

test('each month falls in its season, in both hemispheres', async () => {
  expect(seasonOf(0, 'north')).toBe('winter')
  expect(seasonOf(3, 'north')).toBe('spring')
  expect(seasonOf(6, 'north')).toBe('summer')
  expect(seasonOf(10, 'north')).toBe('fall')
  expect(seasonOf(11, 'north')).toBe('winter')
  expect(seasonOf(10, 'south')).toBe('spring')
  expect(seasonOf(0, 'south')).toBe('summer')
})

test('every scene is a drawing the backdrop takes, at any fill', async () => {
  for (const season of SEASONS) {
    for (const percent of [0, 37, 100]) {
      const svg = drawScene({ season, percent, resetProgress: 0.5 })

      expect(svg.length < 131072).toBe(true)
      expect(svg.includes('NaN')).toBe(false)
      expect(svg.includes('undefined')).toBe(false)
      expect(svg.includes('<image')).toBe(false)
      expect(svg.includes(String.fromCharCode(92))).toBe(false)
    }
  }
})

test('a scene fills as the limit is used', async () => {
  const at = (season: (typeof SEASONS)[number], percent: number): string =>
    drawScene({ season, percent, resetProgress: 0 })

  // Birds on the wires: none, half, all 52.
  expect(count(at('summer', 0), 'href="#b"')).toBe(0)
  expect(count(at('summer', 50), 'href="#b"')).toBe(26)
  expect(count(at('summer', 100), 'href="#b"')).toBe(52)
  // Snow falls thicker.
  expect(count(at('winter', 100), 'class="fl') > count(at('winter', 0), 'class="fl')).toBe(true)
  // The same reading draws the same scene, so a redraw moves nothing.
  expect(at('fall', 42)).toBe(at('fall', 42))
})

test('each season keeps its details at any fill', async () => {
  const marks: Record<(typeof SEASONS)[number], [string, number][]> = {
    // 18 lights on the Christmas tree, 36 stars, one snowman's nose.
    winter: [['class="tw ', 18], ['class="f-star"', 36], ['class="f-carrot"', 1]],
    // Two ducks have two beaks.
    spring: [['class="f-beak"', 2], ['class="f-water"', 1]],
    // Seven sunflowers in the row; the kite and its two bows.
    summer: [['href="#sf"', 7], ['class="f-kite"', 2]],
    fall: [['class="f-pstem"', 4], ['class="f-shirt"', 1], ['class="f-barn"', 1]],
  }

  for (const season of SEASONS) {
    for (const percent of [0, 50, 100]) {
      const svg = drawScene({ season, percent, resetProgress: 0.5 })

      for (const [mark, times] of marks[season]) {
        expect(count(svg, mark)).toBe(times)
      }
    }
  }
})

test('the snow and the leaves pile up away from the details', async () => {
  const GROUND = 885

  // Nothing has piled up at the start.
  expect(GROUND - pileTop(0, 1250) < 30).toBe(true)
  expect(GROUND - driftTop(0, 180) < 30).toBe(true)
  // A full leaf pile buries the trunk and reaches about half way up the barn (166 high).
  expect(GROUND - pileTop(1, 1250) > 450).toBe(true)
  expect(GROUND - pileTop(1, 310) > 60).toBe(true)
  expect(GROUND - pileTop(1, 310) < 110).toBe(true)
  // A full drift is deep at the pines and leaves the roof (147 high) and the snowman's hat (157) clear.
  expect(GROUND - driftTop(1, 180) > 450).toBe(true)
  expect(GROUND - driftTop(1, 1185) < 100).toBe(true)
  expect(GROUND - driftTop(1, 660) < 130).toBe(true)
})

test('no flower grows in the pond', async () => {
  for (let x = 0; x <= 1600; x += 1) {
    for (const y of [800, 830, 852, 875, 899]) {
      const moved = clearOfPond(x, y)

      // The pond itself: centre (420, 852), 150 by 32.
      expect(((moved - 420) / 150) ** 2 + ((y - 852) / 32) ** 2 >= 1).toBe(true)
      expect(clearOfPond(moved, y)).toBe(moved)
    }
  }
})

test('the backdrop draws the live reading on the desktop app', async ($, on) => {
  on('command.register', () => ({ value: { command: 'season' } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 50 }],
    },
  }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'backdrop' } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.UTC(2026, 6, 15, 12) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'season-meter',
    component: 'Backdrop',
    requestId: 'backdrop',
    surface: 'desktop',
    props: { scene: 'season', plugin: 'season-meter', glass: { blur: 14, opacity: 0.72 } },
  })
  const svg = await ui.find({ type: 'Svg' })

  // July in the north is summer, and half the limit is half the birds.
  expect(count(String(svg?.props?.source), 'href="#b"')).toBe(26)
  await ui.unmount()
})
