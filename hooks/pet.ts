// The pet: an original little critter drawn in block characters. Pure functions only, so the
// sprites can be swapped (or tested) without touching the engine code.
export type PetState = 'idle' | 'sleep' | 'work' | 'tired' | 'scared' | 'party'

export type PetMemory = {
  working: boolean
  lastActive: number
  partyUntil: number
}

export const PET_SLEEP_AFTER_MS = 60_000

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

// Three rows, 7 columns of sprite plus the aside. The antenna twinkles, the feet shuffle
// (faster while working or celebrating, still while asleep), and idle blinks now and then.
export function petSprite(state: PetState, frame: number): string[] {
  const twinkle = frame % 2 === 0 ? '✻' : '✦'
  const blink = state === 'idle' && frame % 6 === 5
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const moving = state === 'work' || state === 'party' || state === 'scared'
  const feet = moving && frame % 2 === 1 ? '▀▐ ▌▀' : '▀▌ ▐▀'
  const jump = state === 'party' && frame % 2 === 1

  // Celebrating, every other frame the feet leave the ground.
  const sprite = [
    `   ${state === 'sleep' ? ' ' : twinkle}   `,
    ' ▄███▄ ',
    ` █${eyes}█ `,
    jump ? '       ' : ` ${feet} `
  ]

  // The aside sits on the head row.
  sprite[1] = `${sprite[1]} ${aside(state, frame)}`

  return sprite
}

// A one-line pet for the band above the prompt.
export function petMini(state: PetState, frame: number): string {
  const blink = state === 'idle' && frame % 6 === 5
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const tail = aside(state, frame)

  return state === 'party' ? `\\(${EYES.party})/ ${tail}` : `(${eyes}) ${tail}`.trimEnd()
}
