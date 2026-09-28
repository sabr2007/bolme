# AGENTS.md — «Ночной поезд» (команда bolme)

Инструкция для людей и ИИ-агентов (Codex, Claude Code, Cursor…), которые меняют этот репозиторий.
Прочитай целиком, прежде чем что-то генерировать: GPU стоит денег, а грабли ниже уже стоили нам часа.

- Прод: https://bolme.vercel.app — **деплоится сам при пуше в `main`** (Vercel подключён к GitHub).
- Сценарий: [`docs/SCENARIO.md`](docs/SCENARIO.md) · архитектура: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · для жюри: [`README.md`](README.md).
- Дедлайн хакатона: **30.09, 15:00 (Астана)**. Жюри смотрит историю коммитов — никаких `push --force` и переписывания истории.

## Шпаргалка

```bash
npm install && npm run dev            # http://localhost:5173 (?mock=1 — виртуальное лицо, ?debug=1 — пороги жестов)
npm test                              # unit: жесты, подсказки, граф сюжета
npx tsc -b                            # типы
npx playwright test --project=journey # весь путь пользователя на виртуальном лице (~5 мин)
npm run build                         # то же, что делает Vercel

HF_TOKEN=hf_xxx tools/brev/up.sh      # поднять H100 + ComfyUI + Wan 2.2 (модели в RAM), открыть туннель :8188
python3.12 tools/comfy/render_clips.py content/clips.json --only trust   # перегенерировать клип
tools/brev/down.sh                    # стереть модели и токен, ОСТАНОВИТЬ сервер (обязательно!)
```

## Карта репозитория

| Путь | Что там |
|---|---|
| `src/face/` | камера + MediaPipe Face Landmarker, поворот головы, `mockFaceSource.ts` (виртуальное лицо для тестов) |
| `src/features/` | признаки мимики относительно нейтрального лица зрителя, калибровка |
| `src/gestures/` | жесты (`definitions.ts` — пороги и тексты подсказок), трекер (чистый редьюсер), качество кадра |
| `src/mood/` | пассивный слой: страх / радость / скука |
| `src/story/` | `nightTrain.ts` — сюжет (сцены, развилки, реплики), `ticketCheck.ts` — обучение |
| `src/screens/`, `src/components/`, `src/player/` | экраны, UI, плеер клипов с бесшовным переключением |
| `content/keyframes.json` + `content/keyframes/*.jpg` | промпты и сами опорные кадры (GPT Image) |
| `content/clips.json` | промпты, сиды и кадры для каждого видеоклипа (Wan 2.2) |
| `public/media/*.mp4` | клипы для сайта (веб-версии ~1 МБ) — имена совпадают с `media('…')` в `nightTrain.ts` |
| `tools/imagegen/` | генерация кадров через Codex CLI |
| `tools/comfy/` | рендер клипов на удалённом ComfyUI, склейка mp4 на сервере |
| `tools/brev/` | поднять / настроить / погасить GPU-сервер на NVIDIA Brev |
| `e2e/` | Playwright: `journey` (виртуальное лицо), `face` (видео лица), `no-face` |
| `gen/` | локальные рабочие файлы: мастера клипов, последние кадры — **в git не попадает** |

## Правила

1. Коммиты маленькие и по смыслу, формат `feat: …` / `fix: …` / `docs: …` / `chore: …` / `test: …`. Пушим в `main` → прод обновится сам через ~1 мин.
2. Перед пушем: `npm test`, `npx tsc -b`; если менялся UI или сюжет — `npx playwright test --project=journey`.
3. **Секреты не коммитить**: HF-токен, `.env*`, `.vercel/` (уже в `.gitignore`). Токен передаётся на сервер только через `tools/brev/up.sh` и стирается `down.sh`.
4. В `public/media` кладём только веб-версии клипов (их делает `render_clips.py`). Мастера (2–4 МБ) лежат в `gen/masters`.
5. Меняешь сюжет или реплики — правь **и** `src/story/nightTrain.ts`, **и** `docs/SCENARIO.md`. Тест `src/story/story.test.ts` проверяет, что граф цел и все 4 концовки достижимы.
6. Код: TypeScript strict, маленькие модули, трекер жестов и настроение — чистые функции (новое состояние, без мутаций), без `console.log`.
7. После работы на GPU — **всегда** `tools/brev/down.sh`. Сервер H100 стоит $4.62/час, даже если ничего не делает.

## Как устроен контент

**Стиль A — стоп-моушн (как у студии Laika).** Этот хвост добавляется к каждому промпту кадра:

> Stop-motion animation film still. Handcrafted miniature set and clay puppets with visible fingerprints, felt and wool costumes, glass bead eyes, slightly uneven handmade surfaces and tiny props. Practical miniature lighting, shallow depth of field, 35mm cinematic lens, light atmospheric haze. Eerie but whimsical dark fairy tale mood, muted teal shadows and warm amber lamp light.

К промптам клипов добавляется начало `Stop-motion puppet animation, handcrafted miniature set.`

**Конвейер:** промпт кадра (`content/keyframes.json`) → **GPT Image через Codex CLI** → `content/keyframes/<имя>.jpg` → промпт движения (`content/clips.json`) → **Wan 2.2 на H100** (ComfyUI) → мастер `gen/masters/<клип>.mp4` → веб-версия `public/media/<клип>.mp4`.

**Персонажи держатся одинаковыми за счёт референсов:** в `keyframes.json` у кадра есть `refs` — картинки, которые прикладываются к запросу (Проводница → `kf-conductor-door.jpg`, старик → `kf-hub2-stranger.jpg`).

**Бесшовность — опорные кадры (hub).** Если у клипа есть `end`, Wan генерирует видео между двумя заданными кадрами. Петли ожидания (`start == end`) и клипы-ответы начинаются с одного и того же кадра развилки, поэтому переключение не видно. **Если меняешь опорный кадр, перегенерируй все клипы, где он используется:**

| Кадр | Где используется |
|---|---|
| `kf-conductor-door.jpg` | ticket-idle (петля), wake (старт) |
| `kf-hub1-corridor.jpg` | corridor (петля), corridor-idle (петля), vestibule (старт перехода), dining (старт перехода) |
| `kf-vestibule.jpg` | vestibule (финальный кадр) |
| `kf-dining.jpg` | dining (финальный кадр) |
| `kf-hub2-stranger.jpg` | stranger (петля), stranger-idle (петля), trust, refuse, lights-out (старт перехода) |
| `kf-hub3-dark-door.jpg` | lights-out (финальный кадр), lights-out-idle (петля), call-out (старт перехода) |
| `kf-callout.jpg` | call-out (финальный кадр), end-conductor (старт перехода) |
| `kf-end-conductor.jpg` | end-conductor (финальный кадр) |
| `kf-end-dream.jpg`, `kf-end-forever.jpg`, `kf-end-station.jpg` | одноимённые финалы |
| `kf-intro-train.jpg` | intro-train (фон интро) |
| `kf-intro-window.jpg` | intro-window (запасной, в интерфейсе пока не используется) |

Клипы: 81 кадр, 16 fps (~5 с), на сайте играют на скорости 0.85. Сиды зафиксированы в `clips.json` — тот же сид и промпт дадут тот же результат, другой сид даст новый дубль.

## Рецепт: поменять видео-момент

### 0. Один раз подготовить машину

- `brev` CLI: `brew install brevdev/homebrew-brev/brev` (macOS) — или см. https://docs.nvidia.com/brev. Затем `brev login`, кредиты: `brev redeem <код>` или в консоли brev.nvidia.com → Billing.
- `ffmpeg`, `python3.12` (скрипты используют только стандартную библиотеку), `ssh`/`scp`.
- Для новых кадров — Codex CLI с включённой генерацией картинок: `codex features list | grep image_generation` → `true`. Нет Codex — подойдёт любой генератор, главное: 16:9, стиль A, сохранить как `content/keyframes/<имя>.jpg` (~1280 px по ширине).
- Токен Hugging Face (read) — https://huggingface.co/settings/tokens. Не обязателен, но без него загрузки иногда встают.

### 1. Решить, что менять

- **Не нравится движение** (картинка ок) → правь `prompt` или `seed` клипа в `content/clips.json`, GPU нужен.
- **Не нравится картинка** → правь `prompt` кадра в `content/keyframes.json`, генерируй кадр (шаг 2), потом перерендери все клипы с этим кадром (таблица выше).
- **Только текст / реплики / развилки** → GPU не нужен: `src/story/nightTrain.ts` + `docs/SCENARIO.md`.

### 2. Новый опорный кадр (без GPU, ~1.5 мин на кадр, можно 5 параллельно)

```bash
python3.12 tools/imagegen/codex_images.py content/keyframes.json content/keyframes --jpg --force --only kf-dining
open content/keyframes/kf-dining.jpg     # посмотреть глазами до рендера видео
```

### 3. Поднять GPU (10–20 мин в первый раз)

```bash
HF_TOKEN=hf_xxx tools/brev/up.sh          # имя инстанса по умолчанию motion-gen
```

Скрипт создаёт Nebius H100 80 GB, ставит ComfyUI, качает Wan 2.2 **в оперативную память** (~40 ГБ за ~1 мин), запускает ComfyUI в tmux и пробрасывает `http://127.0.0.1:8188`. Лог на сервере: `ssh motion-gen tail -f /dev/shm/setup.log`.

### 4. Рендер (≈1.5–2 мин на клип, всё встаёт в очередь сразу)

```bash
python3.12 tools/comfy/render_clips.py content/clips.json --only vestibule,dining
```

Результат: мастер в `gen/masters/`, веб-версия сразу в `public/media/`, последний кадр в `gen/lastframes/` (из него можно начать следующий клип-продолжение). Проверь глазами: `open gen/masters/dining.mp4` и `npm run dev`.

### 5. Погасить GPU — сразу, как закончил

```bash
tools/brev/down.sh                # стирает модели и токен, останавливает сервер
tools/brev/down.sh motion-gen --delete   # удалить совсем (остановленный всё равно платит за диск ~$0.46/день)
```

### 6. Проверить и отправить

```bash
npm test && npx tsc -b && npx playwright test --project=journey
git add content public/media && git commit -m "feat: new dining car clip" && git push
```

Через ~1 минуту проверь https://bolme.vercel.app.

## Бюджет и время (по факту нашего прогона)

| Что | Время | Деньги |
|---|---|---|
| H100 (Nebius через Brev) | — | $4.62/час |
| Первый запуск `up.sh` | 10–20 мин | ~$1 |
| Один клип Wan 2.2 (81 кадр, 1280×720) | 1.5–2 мин | ~$0.15 |
| Весь фильм (19 клипов) | ~40 мин | ~$3 |
| Опорный кадр в Codex | 80–100 с | в рамках подписки ChatGPT |

Мы потратили ~$10 из $50, из них половина — отладка граблей ниже.

## Грабли (агенту — обязательно)

1. **Диск инстанса медленный.** После ~100 ГБ записи сетевой диск Nebius падает до ~60 МБ/с, процессы висят в состоянии `D`, загрузки «встают на 98%». Поэтому модели и выходы ComfyUI живут в `/dev/shm` (RAM 200 ГБ). После `brev stop` RAM пустая — `up.sh` просто скачает модели заново.
2. `brev create --min-disk 250` — это **фильтр**, а не размер диска: всё равно дадут ~116 ГБ.
3. `brev exec "... &"` убивает фоновые процессы, когда сессия закрывается. Для долгих задач: `ssh <инстанс>` + `tmux new-session -d …` или `setsid nohup`.
4. `brev exec` / `brev copy` медленные и падают. После `brev login` работает обычный `ssh motion-gen` / `scp` (алиас пишет `brev refresh`).
5. Канал до сервера ~300 КБ/с: **никогда не качай кадры по одному**. `render_clips.py` склеивает mp4 на сервере (`remote_mux.py` через PyAV) и тянет один файл.
6. `huggingface_hub` 2.x ломает ComfyUI (`huggingface-hub>=1.5.0,<2.0 is required`) — в `server_setup.sh` стоит пин `<2`.
7. Узел `SaveVideo` в свежем ComfyUI устроен по-новому (dynamic combo), поэтому графы в `tools/comfy/graphs.py` сохраняют PNG-кадры, а mp4 собирается на сервере.
8. Анонимные загрузки с Hugging Face могут вставать — используй HF-токен (заголовок `Authorization` в `aria2c`).
9. `pkill -f "python main.py"` убивает твою же SSH-команду, если строка совпала. Пиши шаблон как `"[m]ain.py --listen"`.
10. Codex CLI: `-i` принимает несколько файлов, поэтому перед промптом нужен `--`; запускать с закрытым stdin (`stdin=DEVNULL`), иначе он молча ждёт ввод. Оба случая уже учтены в `codex_images.py`.
11. `apt` может минутами висеть на триггере `man-db` — `server_setup.sh` его отключает.
12. Порт 8188 может держать старый туннель: `pkill -f "8188:127.0.0.1:8188"` и заново `up.sh` (или `ssh -f -N -L 8188:127.0.0.1:8188 motion-gen`).

## Тестовое лицо (для `npx playwright test --project=face`)

Реалистичное синтетическое «видео с веб-камеры» лежит в `e2e/assets/` (кадр + три клипа: улыбка, нахмуриться, поворот головы). Перегенерация: `content/testface-image.json` (Codex) и `content/testface-clips.json` (`render_clips.py … --publish-dir e2e/assets`). Сборка видео для Chrome: `npm run e2e:fixture`.
