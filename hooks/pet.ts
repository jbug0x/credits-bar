// The pet: an original little critter drawn in plain characters. Pure functions only, so the
// sprites can be swapped (or tested) without touching the engine code.
export type PetState = 'idle' | 'sleep' | 'work' | 'tired' | 'scared' | 'party'

export type PetMemory = {
  working: boolean
  lastActive: number
  partyUntil: number
}

export const PET_SLEEP_AFTER_MS = 60_000
// Columns the body takes; the panel lets it wander through whatever width is left.
export const PET_WIDTH = 11

// What the pet is doing now. Celebrating wins, then fear and tiredness (from the tightest
// limit), then work; with nothing going on it idles, and after a minute it falls asleep.
export function petState(
  pet: PetMemory,
  now: number,
  maxUsedPercent: number,
  alerts: { low: number; high: number } = { low: 80, high: 95 }
): PetState {
  if (now < pet.partyUntil) return 'party'
  if (maxUsedPercent >= alerts.high) return 'scared'
  if (maxUsedPercent >= alerts.low) return 'tired'
  if (pet.working) return 'work'
  if (now - pet.lastActive > PET_SLEEP_AFTER_MS) return 'sleep'

  return 'idle'
}

const EYES: Record<PetState, string> = {
  idle: '•ᴗ•',
  sleep: '-ᴗ-',
  work: '•_•',
  tired: 'ˇ_ˇ',
  scared: '°o°',
  party: '^ᴗ^'
}

// A short thing floating beside the head, one per state, flipping with the frame.
function aside(state: PetState, frame: number): string {
  const odd = frame % 2 === 1
  switch (state) {
    case 'sleep':
      return odd ? 'Z' : 'z'
    case 'work':
      return odd ? '..' : '.'
    case 'tired':
      return odd ? "'" : ' '
    case 'scared':
      return odd ? '!!' : '!'
    case 'party':
      return odd ? '♪' : '♫'
    default:
      return ''
  }
}

// Where the idle pet is, 0..range: it strolls to the right, rests, strolls back, rests.
// `isMoving` says whether it is mid-stroll (the feet shuffle only then).
export function wander(frame: number, range: number): { x: number; isMoving: boolean } {
  if (range <= 0) return { x: 0, isMoving: false }
  const pause = 5
  const cycle = 2 * range + 2 * pause
  let t = frame % cycle

  if (t < pause) return { x: 0, isMoving: false }
  t -= pause
  if (t < range) return { x: t + 1 > range ? range : t + 1, isMoving: true }
  t -= range
  if (t < pause) return { x: range, isMoving: false }
  t -= pause

  return { x: Math.max(0, range - t - 1), isMoving: true }
}

const pad = (n: number) => ' '.repeat(Math.max(0, n))

// Five rows. Row 0 is the air (antenna, sleeping Zs, sparkles), rows 1-3 the body, row 4 the
// ground (a keyboard while working). It strolls when idle, types when working, sways when
// tired, trembles when scared, naps with rising Zs and hops with sparkles when celebrating.
// `range` is how many spare columns it may roam.
export function petSprite(state: PetState, frame: number, range = 0): string[] {
  const mid = Math.floor(range / 2)
  let x = mid
  let isMoving = false

  if (state === 'idle') ({ x, isMoving } = wander(frame, range))
  if (state === 'tired') x = Math.max(0, mid + (frame % 4 < 2 ? 0 : 1))
  if (state === 'scared') x = Math.max(0, mid + [0, 1, 0, -1][frame % 4]!)
  if (state === 'party') x = mid

  const blink = state === 'idle' && frame % 7 === 6
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const twinkle = frame % 2 === 0 ? '✻' : '✦'
  const shuffle = (isMoving || state === 'work' || state === 'scared' || state === 'party') && frame % 2 === 1
  const feet = shuffle ? "'-u-u-'" : "'-U-U-'"
  const hop = state === 'party' && frame % 2 === 1

  // The air row.
  let air: string
  if (state === 'sleep') air = ['      z', '     z Z', '    Z  z', '       Z'][frame % 4]!
  else if (state === 'party') air = frame % 2 === 0 ? ' ✦     ✦ ' : '   ✦ ✦   '
  else if (state === 'scared') air = frame % 2 === 0 ? '     !   ' : '    ! !  '
  else air = `     ${twinkle}`

  // Arms up while celebrating.
  const arms = state === 'party' ? ['\\', '/'] : [' ', ' ']
  const face = `${arms[0]}(  ${eyes}  )${arms[1]}`
  const sweat = state === 'tired' ? (frame % 2 === 0 ? '  ,' : ' ') : state === 'scared' ? ' ;' : ''
  const top = `  .-"""-.${sweat}`
  const body = hop ? [top, face, `  ${feet}`, air, ''] : [air, top, face, `  ${feet}`, '']

  // The ground row: a keyboard that clacks while working.
  if (state === 'work' && !hop) body[4] = frame % 2 === 0 ? '  [:.:.:]' : '  [.:.:.]'

  return body.map(row => (row === '' ? '' : pad(x) + row))
}

// A one-line pet for the band above the prompt.
export function petMini(state: PetState, frame: number): string {
  const blink = state === 'idle' && frame % 6 === 5
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const tail = aside(state, frame)

  return state === 'party' ? `\\(${EYES.party})/ ${tail}` : `(${eyes}) ${tail}`.trimEnd()
}
