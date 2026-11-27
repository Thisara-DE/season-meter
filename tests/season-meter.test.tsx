import { expect, test } from 'claude-code/testing'

import { drawScene, seasonOf, SEASONS } from '../hooks/scene'

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
