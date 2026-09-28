import type { Features } from '../features/features'
import type { GestureDef, GestureId } from './types'

/** Tunable thresholds, all relative to the viewer's calibrated neutral face. */
export const T = {
  turnDeg: 18,
  eyesOnlyGaze: 0.45,
  eyesOnlyMaxYawDeg: 8,
  smile: 0.4,
  smileSquint: 0.12,
  frownGuardSmile: 0.3,
  browDown: 0.3,
  browDownEachSide: 0.15,
  browUp: 0.35,
  jawOpen: 0.2,
  eyesClosed: 0.5,
} as const

const secondsText = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',')

const ONE_BROW_HINT = 'Сведи обе брови — сейчас хмурится только одна'

/** One brow is clearly lowered while the other stays up: mean is ok-ish, but it is not a frown. */
function isOneSidedFrown(f: Features): boolean {
  const strongerSide = 2 * f.browDown - f.browDownMin
  return strongerSide >= T.browDown && f.browDownMin < T.browDownEachSide
}

const turn = (id: 'turnLeft' | 'turnRight', sign: 1 | -1, side: string): GestureDef => ({
  id,
  label: `Голова ${side}`,
  instruction: `Поверни голову ${side}`,
  holdMs: 500,
  parts: [
    {
      id: 'yaw',
      measure: (f) => sign * f.yaw,
      min: T.turnDeg,
      hint: (f) => `Поверни голову ${side} сильнее — ещё примерно ${Math.max(1, Math.ceil(T.turnDeg - sign * f.yaw))}°`,
    },
  ],
  confusers: [
    {
      id: 'eyes-only',
      test: (f) => f.gazeAside >= T.eyesOnlyGaze && Math.abs(f.yaw) < T.eyesOnlyMaxYawDeg,
      hint: 'Ты смотришь в сторону только глазами — поверни всю голову',
    },
  ],
})

export const GESTURES: Readonly<Record<GestureId, GestureDef>> = {
  turnLeft: turn('turnLeft', 1, 'влево'),
  turnRight: turn('turnRight', -1, 'вправо'),

  smile: {
    id: 'smile',
    label: 'Улыбка',
    instruction: 'Улыбнись — искренне, глазами тоже',
    holdMs: 700,
    parts: [
      { id: 'mouth', measure: (f) => f.smile, min: T.smile, hint: () => 'Улыбнись шире — подними уголки губ' },
      {
        id: 'eyes',
        measure: (f) => f.squint,
        min: T.smileSquint,
        hint: () => 'Улыбка только губами — прищурь глаза, улыбнись по-настоящему',
      },
    ],
  },

  frown: {
    id: 'frown',
    label: 'Нахмуриться',
    instruction: 'Нахмурься — сведи брови',
    holdMs: 700,
    parts: [
      {
        id: 'brows',
        measure: (f) => f.browDown,
        min: T.browDown,
        hint: (f) => (isOneSidedFrown(f) ? ONE_BROW_HINT : 'Нахмурься сильнее — опусти брови к переносице'),
      },
      {
        id: 'both-brows',
        measure: (f) => f.browDownMin,
        min: T.browDownEachSide,
        hint: () => ONE_BROW_HINT,
      },
      { id: 'no-smile', measure: (f) => f.smile, max: T.frownGuardSmile, hint: () => 'Убери улыбку — нахмурься всерьёз' },
    ],
  },

  surprise: {
    id: 'surprise',
    label: 'Удивление',
    instruction: 'Удивись — подними брови и приоткрой рот',
    holdMs: 600,
    parts: [
      {
        id: 'brows-up',
        measure: (f) => f.browUp,
        min: T.browUp,
        hint: (f) => (f.jawOpen >= T.jawOpen ? 'Рот уже открыт — теперь подними брови' : 'Подними брови выше'),
      },
      {
        id: 'mouth-open',
        measure: (f) => f.jawOpen,
        min: T.jawOpen,
        hint: (f) => (f.browUp >= T.browUp ? 'Брови подняты — теперь приоткрой рот' : 'Приоткрой рот'),
      },
    ],
  },

  eyesClosed: {
    id: 'eyesClosed',
    label: 'Закрыть глаза',
    instruction: 'Закрой глаза и не открывай 2 секунды',
    holdMs: 2000,
    parts: [
      { id: 'lids', measure: (f) => f.eyesClosed, min: T.eyesClosed, hint: () => 'Закрой глаза полностью — не щурься' },
    ],
    releasedEarlyHint: (heldMs) => `Ты подсмотрел через ${secondsText(heldMs)} с — держи глаза закрытыми 2 секунды`,
  },
}
