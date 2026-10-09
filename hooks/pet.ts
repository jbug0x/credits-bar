// O bichinho: um personagem original desenhado com caracteres simples, no estilo da barra.
// Só funções puras, para trocar o visual (ou testar) sem tocar no código do motor.
export type PetState = 'idle' | 'sleep' | 'work' | 'tired' | 'scared' | 'party' | 'poked'

export type PetMemory = {
  working: boolean
  lastActive: number
  partyUntil: number
  // quantas vezes foi cutucado (escolhe a reação) e até quando dura a reação atual
  pokes: number
  pokedUntil: number
}

export const PET_SLEEP_AFTER_MS = 60_000
export const POKE_MS = 3200
// Colunas que o corpo ocupa; o painel deixa ele passear pelo espaço que sobrar.
export const PET_WIDTH = 9

// O que ele está fazendo agora. Um cutucão vence tudo; depois comemorar, o medo e o cansaço
// (pelo limite mais apertado) e o trabalho. Sem nada acontecendo ele fica de boa, e depois de
// um minuto pega no sono.
export function petState(
  pet: PetMemory,
  now: number,
  maxUsedPercent: number,
  alerts: { low: number; high: number } = { low: 80, high: 95 }
): PetState {
  if (now < pet.pokedUntil) return 'poked'
  if (now < pet.partyUntil) return 'party'
  if (maxUsedPercent >= alerts.high) return 'scared'
  if (maxUsedPercent >= alerts.low) return 'tired'
  if (pet.working) return 'work'
  if (now - pet.lastActive > PET_SLEEP_AFTER_MS) return 'sleep'

  return 'idle'
}

const EYES: Record<Exclude<PetState, 'poked'>, string> = {
  idle: '•ᴗ•',
  sleep: '-ᴗ-',
  work: '•_•',
  tired: 'ˇ_ˇ',
  scared: '°o°',
  party: '^ᴗ^'
}

// As reações ao clique, uma por cutucão, em rodízio. Cada uma tem dois quadros (rosto e enfeite).
export const REACTIONS: { faces: [string, string]; aside: [string, string] }[] = [
  { faces: ['(>ᴗ<)', '(>ᴗ<)'], aside: ['♥', '♥ ♥'] }, // cócegas
  { faces: ['\\(^ᴗ^)/', '(^ᴗ^)'], aside: ['♪', '♫'] }, // comemora
  { faces: ['(•ᴗ•)/', '(•ᴗ•) /'], aside: ['!', '!!'] }, // acena
  { faces: ['(•ᴗ•)♥', '(^ᴗ^)♥'], aside: ['♥', '·'] }, // carinho
  { faces: ['(@ᴗ@)', '(@_@)'], aside: ['~', '≈'] } // tontura
]
export const REACTION_COUNT = REACTIONS.length

// Um enfeite ao lado da cabeça, um por humor, alternando com o quadro.
function aside(state: Exclude<PetState, 'poked'>, frame: number): string {
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

// Onde o bichinho de boa está, de 0 a `range`: passeia para a direita, descansa, volta e
// descansa. `isMoving` diz se está no meio do passeio.
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

export type PetStage = {
  // coluna do bichinho (cada linha já vem com o recuo aplicado, menos o `face`)
  x: number
  // linha do ar: antena brilhando, Zs, corações, confete...
  air: string
  // o rosto, que vira o rótulo do botão clicável
  face: string
}

// O palco do bichinho. Passeia quando está de boa, balança quando está cansado, treme de medo,
// cochila com Zs, e reage ao clique com `pokes` escolhendo qual das reações.
export function petStage(state: PetState, frame: number, range = 0, pokes = 0): PetStage {
  const mid = Math.floor(range / 2)
  const odd = frame % 2 === 1
  let x = mid

  if (state === 'idle') x = wander(frame, range).x
  if (state === 'tired') x = Math.max(0, mid + (frame % 4 < 2 ? 0 : 1))
  if (state === 'scared') x = Math.max(0, mid + [0, 1, 0, -1][frame % 4]!)

  if (state === 'poked') {
    const reaction = REACTIONS[pokes % REACTION_COUNT]!
    const i = odd ? 1 : 0

    return { x, air: `${pad(x + 3)}${reaction.aside[i]}`, face: reaction.faces[i] }
  }

  const blink = state === 'idle' && frame % 7 === 6
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const twinkle = odd ? '✦' : '✻'
  const face = state === 'party' ? `\\(${EYES.party})/` : `(${eyes})`
  const tail = aside(state, frame)
  const crown = state === 'sleep' ? '' : twinkle

  return { x, air: `${pad(x + 3)}${crown}${crown && tail ? ' ' : ''}${tail}`.trimEnd(), face }
}

// O chão do palco: pedrinhas, uma florzinha e uma bolinha, só enfeite.
export function petFloor(width: number): string {
  const w = Math.max(8, width)
  const cells = Array.from({ length: w }, (_, i) => (i % 3 === 0 ? '.' : i % 3 === 1 ? ' ' : '˙'))
  cells[Math.min(w - 1, 3)] = '✿'
  cells[Math.max(0, w - 4)] = 'o'

  return cells.join('')
}

// Um bichinho de uma linha para a faixa acima do prompt.
export function petMini(state: PetState, frame: number, pokes = 0): string {
  if (state === 'poked') {
    const reaction = REACTIONS[pokes % REACTION_COUNT]!
    const i = frame % 2

    return `${reaction.faces[i]} ${reaction.aside[i]}`
  }

  const blink = state === 'idle' && frame % 6 === 5
  const eyes = blink ? '-ᴗ-' : EYES[state]
  const tail = aside(state, frame)

  return state === 'party' ? `\\(${EYES.party})/ ${tail}` : `(${eyes}) ${tail}`.trimEnd()
}
