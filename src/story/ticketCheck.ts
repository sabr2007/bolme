import type { GestureId } from '../gestures/types'

/** "Проверка билета": the in-world tutorial. The conductor asks for each gesture once. */
export interface TicketStep {
  readonly id: string
  readonly line: string
  /** the big, plain instruction under the conductor's line */
  readonly action: string
  readonly gesture: GestureId | 'calibrate'
}

export const TICKET_STEPS: readonly TicketStep[] = [
  { id: 'calibrate', line: 'Пассажир, проснитесь. Посмотрите на меня… Билет не нужен — я запомню ваше лицо.', action: 'Посмотрите в камеру спокойно', gesture: 'calibrate' },
  { id: 'smile', line: 'Улыбнитесь. Мне нужно знать, что вы живой.', action: 'Улыбнитесь', gesture: 'smile' },
  { id: 'frown', line: 'А теперь нахмурьтесь. Как контролёр.', action: 'Нахмурьтесь', gesture: 'frown' },
  { id: 'left', line: 'Посмотрите налево…', action: 'Поверните голову влево', gesture: 'turnLeft' },
  { id: 'right', line: '…теперь направо.', action: 'Поверните голову вправо', gesture: 'turnRight' },
  { id: 'surprise', line: 'Удивитесь. Здесь это пригодится.', action: 'Удивитесь', gesture: 'surprise' },
  { id: 'eyes', line: 'И закройте глаза. Досчитайте до двух.', action: 'Закройте глаза на 2 секунды', gesture: 'eyesClosed' },
]

export const TICKET_ACCEPTED_LINE = 'Билет принят. Приятной поездки.'
export const STEP_TIMEOUT_LINE = 'Ладно. Поверю на слово.'
/** Nobody gets stuck: after this the conductor moves on by herself. */
export const STEP_TIMEOUT_MS = 20000
export const STEP_PRAISE_MS = 900
