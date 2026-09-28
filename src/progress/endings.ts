/** Which endings this browser has already seen. Local only; the app works without storage. */
const KEY = 'night-train:endings'

export function loadEndings(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveEnding(id: string): ReadonlySet<string> {
  const next = new Set([...loadEndings(), id])
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // private mode / blocked storage: the collection just is not remembered
  }
  return next
}
