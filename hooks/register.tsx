import type { Register, SessionRateLimit } from 'claude-code'

import { describeScene, drawScene, seasonOf, SEASONS } from './scene'
import type { Season } from './scene'

const PLUGIN = 'season-meter'
const SCENE = 'season'
const WINDOW_MS = 5 * 60 * 60 * 1000
const REDRAW_MS = 5 * 60 * 1000

// The last reading of the 5-hour window, shared by the hooks below.
let percentUsed = 0
let resetsAt: number | undefined
let hasReading = false
// What `/season` asked to see in place of the live reading.
let preview: { season?: Season; percent?: number } | undefined

function take(limits: readonly SessionRateLimit[]): void {
  const window = limits.find(limit => limit.kind === 'five_hour')

  if (window === undefined) {
    return
  }
  hasReading = true
  percentUsed = window.percentUsed
  resetsAt = window.resetsAt === undefined ? undefined : Date.parse(window.resetsAt)
}

// What to draw at `now`: the preview, else the live reading, emptied once the
// window has reset and no newer reading has come.
function sceneAt(now: number, hemisphere: string) {
  const hasReset = resetsAt !== undefined && !Number.isNaN(resetsAt) && now >= resetsAt
  const livePercent = hasReset ? 0 : percentUsed
  const left = resetsAt === undefined || Number.isNaN(resetsAt) || hasReset ? WINDOW_MS : resetsAt - now

  return {
    season: preview?.season ?? seasonOf(new Date(now).getMonth(), hemisphere),
    percent: preview?.percent ?? livePercent,
    resetProgress: 1 - Math.min(1, Math.max(0, left / WINDOW_MS)),
  }
}

export const register: Register = (on, options) => {
  const hemisphere = options.hemisphere === 'south' ? 'south' : 'north'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'season',
      description: 'Preview the seasonal backdrop: /season fall 80, /season 40, /season live',
      argumentHint: '[winter|spring|summer|fall] [0-100] | live',
      immediate: true,
    })
    take((await $.session.usage()).rateLimits)

    const set = await $.theme.set({ backdrop: { scene: SCENE, glass: { blur: 14, opacity: 0.72 } } })

    if (!set.isDrawn) {
      $.ui.log(`${PLUGIN}: ${set.reason}`)
    }
    // The sun keeps sinking between readings.
    $.clock.every(REDRAW_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('session.measure', ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      take(e.rateLimits)
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  on('command.run', { command: 'season' }, async ($, e) => {
    const words = e.args.toLowerCase().split(/\s+/).filter(word => word !== '')
    const now = await $.clock.now()

    if (words.includes('live') || words.includes('off')) {
      preview = undefined
    } else if (words.length > 0) {
      const season = SEASONS.find(one => words.includes(one))
      const number = words.map(word => Number(word.replace('%', ''))).find(value => !Number.isNaN(value))

      if (season === undefined && number === undefined) {
        return {
          text: 'Try /season fall 80, /season 40, or /season live to go back to the real reading.',
          isTextDisplayOnly: true,
        }
      }
      preview = {
        season: season ?? preview?.season,
        percent: number === undefined ? preview?.percent : Math.min(100, Math.max(0, number)),
      }
    }
    $.ui.invalidate('ui.render')

    const shown = sceneAt(now, hemisphere)
    const source = preview !== undefined ? 'preview' : hasReading ? 'live' : 'no reading of the session limit yet'

    return {
      text: `Backdrop: ${shown.season} at ${Math.round(shown.percent)}% (${source}).`,
      isTextDisplayOnly: true,
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (e.props.plugin !== PLUGIN || e.props.scene !== SCENE) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const shown = sceneAt(await $.clock.now(), hemisphere)

    return <Svg source={drawScene(shown)} alt={describeScene(shown)} />
  })
}
