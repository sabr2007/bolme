import type { MoodLabel } from '../mood/mood'
import { resolveLine, type Line, type LineContext, type Scene, type Story } from './types'

/** Screenplay: docs/SCENARIO.md. Keep both in sync. */

const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}.mp4`

const CHOICE_TIMEOUT_MS = 12000
const HIDE_DURATION_S = 5

const byMood = (calm: string, variants: Partial<Record<MoodLabel, string>>): Line =>
  ({ mood }: LineContext) => variants[mood] ?? calm

const afterVestibule = (vestibule: string, dining: string): Line =>
  ({ visited }: LineContext) => (visited.has('vestibule') ? vestibule : dining)

const STRANGER_GREETING = afterVestibule(
  'Это вы открывали тамбур? Зря. Там холодно…',
  'Вы из ресторана? Значит, мой чай вы уже видели.',
)

const LIGHTS_OUT_CLIP = {
  src: media('lights-out'),
  subtitles: [
    { at: 0.8, until: 3.0, text: 'Свет гаснет. По вагону кто-то идёт…' },
    { at: 3.1, until: 5.0, text: '«Пассажир… Ваш билет».' },
  ],
} as const

const HIDE_CLIP = {
  src: null,
  durationS: HIDE_DURATION_S,
  subtitles: [
    { at: 0.8, until: 2.8, text: 'Шаги проходят мимо…' },
    { at: 3.0, until: 5.0, text: '«Я запомнила ваше лицо».' },
  ],
} as const

const CALL_OUT_CLIP = {
  src: media('call-out'),
  subtitles: [{ at: 0.6, until: 4.8, text: 'Дверь отъезжает. За ней — Проводница с фонарём.' }],
} as const

function lightsOut(id: string, hideNext: string, callOutNext: string): Scene {
  return {
    id,
    station: 'Темнота',
    kind: 'choice',
    clip: LIGHTS_OUT_CLIP,
    choice: {
      prompt: 'Спрячься — закрой глаза. Или окликни того, кто идёт.',
      idle: { src: media('lights-out-idle') },
      options: [
        { gesture: 'eyesClosed', meaning: 'Спрятаться', next: hideNext },
        { gesture: 'surprise', meaning: 'Окликнуть', next: callOutNext },
      ],
      timeoutMs: CHOICE_TIMEOUT_MS,
      fallback: (mood) => (mood.fear > 0.35 ? hideNext : callOutNext),
    },
  }
}

const scenes: readonly Scene[] = [
  {
    id: 'wake',
    station: 'Купе',
    kind: 'linear',
    next: 'corridor',
    clip: {
      src: media('wake'),
      subtitles: [
        {
          at: 0.3,
          until: 2.6,
          text: byMood('Не спится? Этот поезд не останавливается до рассвета.', {
            fear: 'Не бойтесь. Здесь никто не кусается. Почти никто.',
            joy: 'Весёлый пассажир. Редкость для этого поезда.',
            boredom: 'Скучаете? Это ненадолго.',
          }),
        },
        { at: 2.7, until: 5.0, text: 'Прогуляйтесь… Только окна не открывайте.' },
      ],
    },
  },
  {
    id: 'corridor',
    station: 'Коридор',
    kind: 'choice',
    clip: { src: media('corridor') },
    choice: {
      prompt: 'Слева кто-то стучит. Справа пахнет чаем. Куда пойдёшь?',
      idle: { src: media('corridor-idle') },
      options: [
        { gesture: 'turnLeft', meaning: 'На стук', next: 'vestibule' },
        { gesture: 'turnRight', meaning: 'На свет', next: 'dining' },
      ],
      timeoutMs: CHOICE_TIMEOUT_MS,
      fallback: (mood) => (mood.boredom > 0.5 ? 'vestibule' : 'dining'),
    },
  },
  {
    id: 'vestibule',
    station: 'Тамбур',
    kind: 'linear',
    next: 'stranger',
    clip: {
      src: media('vestibule'),
      subtitles: [
        { at: 0.4, until: 3.2, text: 'Стучат снаружи. На полном ходу.' },
        { at: 3.6, until: 5.0, text: '…Показалось?' },
      ],
    },
  },
  {
    id: 'dining',
    station: 'Вагон-ресторан',
    kind: 'linear',
    next: 'stranger',
    clip: {
      src: media('dining'),
      subtitles: [{ at: 0.5, until: 4.8, text: 'Вагон пуст. Только один стакан ещё горячий.' }],
    },
  },
  {
    id: 'stranger',
    station: 'Попутчик',
    kind: 'choice',
    clip: {
      src: media('stranger'),
      subtitles: [
        {
          at: 0.3,
          until: 2.8,
          text: (ctx) =>
            ctx.mood === 'fear' ? 'Не бойтесь. Я здесь давно. Слишком давно.' : resolveLine(STRANGER_GREETING, ctx),
        },
        { at: 2.9, until: 5.0, text: 'Выпьете со мной?' },
      ],
    },
    choice: {
      prompt: '«Вы же мне доверяете?»',
      idle: { src: media('stranger-idle') },
      options: [
        { gesture: 'smile', meaning: 'Довериться', next: 'trust' },
        { gesture: 'frown', meaning: 'Отказаться', next: 'refuse' },
      ],
      timeoutMs: CHOICE_TIMEOUT_MS,
      fallback: (mood) => (mood.joy > 0.3 ? 'trust' : 'refuse'),
    },
  },
  {
    id: 'trust',
    station: 'Чай',
    kind: 'linear',
    next: 'lightsOutAfterTrust',
    clip: {
      src: media('trust'),
      subtitles: [{ at: 0.4, until: 4.8, text: 'Этот поезд везёт тех, кто не решил, куда едет. Я вот так и не решил.' }],
    },
  },
  {
    id: 'refuse',
    station: 'Отказ',
    kind: 'linear',
    next: 'lightsOutAfterRefuse',
    clip: {
      src: media('refuse'),
      subtitles: [{ at: 0.4, until: 4.8, text: 'Правильно. Здесь никому нельзя доверять. Даже мне.' }],
    },
  },
  lightsOut('lightsOutAfterTrust', 'hideAfterTrust', 'callOutAfterTrust'),
  lightsOut('lightsOutAfterRefuse', 'hideAfterRefuse', 'callOutAfterRefuse'),
  { id: 'hideAfterTrust', station: 'Закрытые глаза', kind: 'linear', next: 'endDream', clip: HIDE_CLIP },
  { id: 'hideAfterRefuse', station: 'Закрытые глаза', kind: 'linear', next: 'endForever', clip: HIDE_CLIP },
  { id: 'callOutAfterTrust', station: 'Оклик', kind: 'linear', next: 'endConductor', clip: CALL_OUT_CLIP },
  { id: 'callOutAfterRefuse', station: 'Оклик', kind: 'linear', next: 'endStation', clip: CALL_OUT_CLIP },
  {
    id: 'endDream',
    station: 'Дом',
    kind: 'ending',
    clip: { src: media('end-dream') },
    ending: {
      id: 'dream',
      title: 'Просто сон',
      epilogue: afterVestibule(
        'Ты открываешь глаза дома. Всё как прежде. Только на тумбочке — пустой стакан в подстаканнике, а на оконном стекле — отпечаток ладони. Снаружи.',
        'Ты открываешь глаза дома. Всё как прежде. Только на тумбочке — пустой стакан в подстаканнике и билет на поезд, которого нет в расписании.',
      ),
    },
  },
  {
    id: 'endConductor',
    station: 'Фонарь',
    kind: 'ending',
    clip: {
      src: media('end-conductor'),
      subtitles: [{ at: 0.4, until: 4.8, text: '«Вы не испугались и не отказали старику. Такие здесь нужны».' }],
    },
    ending: {
      id: 'conductor',
      title: 'Новый проводник',
      epilogue: 'Теперь ты встречаешь тех, кто не решил, куда едет. Старик сошёл на рассвете — впервые за сорок лет.',
    },
  },
  {
    id: 'endForever',
    station: 'Без остановок',
    kind: 'ending',
    clip: { src: media('end-forever') },
    ending: {
      id: 'forever',
      title: 'Вечный пассажир',
      epilogue: 'Поезд идёт дальше. Ты так и не решил, куда едешь. Скоро в купе сядет новый пассажир — предложи ему чаю.',
    },
  },
  {
    id: 'endStation',
    station: 'Станция',
    kind: 'ending',
    clip: {
      src: media('end-station'),
      subtitles: [{ at: 0.5, until: 3.0, text: '«Ваша станция».' }],
    },
    ending: {
      id: 'station',
      title: 'Станция, которой нет',
      epilogue: 'Ты никому не поверил, но и не спрятался. Твоя станция — та, которую ты выбрал сам.',
    },
  },
]

export const NIGHT_TRAIN: Story = {
  title: 'Ночной поезд',
  start: 'wake',
  scenes: Object.fromEntries(scenes.map((scene) => [scene.id, scene])),
}

export const ENDING_COUNT = scenes.filter((s) => s.kind === 'ending').length

/** The three axes of the passenger profile on the result ticket. */
export function passengerProfile(visited: ReadonlySet<string>): readonly string[] {
  return [
    visited.has('vestibule') ? 'Пошёл на стук' : 'Пошёл на свет',
    visited.has('trust') ? 'Доверился' : 'Не поверил',
    visited.has('callOutAfterTrust') || visited.has('callOutAfterRefuse') ? 'Окликнул' : 'Спрятался',
  ]
}
