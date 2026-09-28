import type { CameraError } from '../face/faceTracker'
import type { EngineStatus } from '../engine/faceEngine'
import './titleScreen.css'

interface TitleScreenProps {
  status: EngineStatus
  error: CameraError | null
  onBoard: () => void
}

const ERROR_TEXT: Readonly<Record<CameraError, string>> = {
  denied: 'Доступ к камере запрещён. Разрешите камеру в адресной строке браузера и нажмите ещё раз.',
  'not-found': 'Камера не найдена. Подключите веб-камеру или откройте ссылку на телефоне.',
  unknown: 'Не удалось включить камеру. Закройте другие приложения, которые её используют, и попробуйте снова.',
}

export function TitleScreen({ status, error, onBoard }: TitleScreenProps) {
  const loading = status === 'loading'
  return (
    <main className="title-screen">
      <div className="title-poster" aria-hidden="true" />
      <section className="title-copy" aria-labelledby="title-heading">
        <p className="title-kicker">Интерактивный мультфильм · 4 концовки · управление лицом</p>
        <h1 id="title-heading">Ночной<br />поезд</h1>
        <p className="title-lede">
          Проводнице не нужен ваш билет — она запомнит ваше лицо. Здесь всё решает мимика: куда вы
          посмотрите, кому улыбнётесь и закроете ли глаза, когда погаснет свет.
        </p>
        <button className="board-button" onClick={onBoard} disabled={loading}>
          {loading ? 'Включаем камеру…' : 'Сесть в поезд'}
        </button>
        {error && <p className="title-error" role="alert">{ERROR_TEXT[error]}</p>}
        <ul className="title-notes">
          <li>Нужна веб-камера — видео не покидает ваш браузер</li>
          <li>Лицо должно быть освещено, лучше — в наушниках</li>
          <li>После старта клавиатура и мышь не понадобятся</li>
        </ul>
      </section>
    </main>
  )
}
