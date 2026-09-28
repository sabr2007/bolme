/**
 * Clips are fetched ahead of time into blob URLs, so switching a <video> to the next clip does not
 * wait for the network. Only the clips reachable from the current scene are prefetched.
 */
const cache = new Map<string, Promise<string>>()

export function prefetch(src: string): Promise<string> {
  const existing = cache.get(src)
  if (existing) return existing
  const pending = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`${src}: HTTP ${response.status}`)
      return response.blob()
    })
    .then((blob) => URL.createObjectURL(blob))
    .catch((error: unknown) => {
      cache.delete(src)
      console.warn('prefetch failed, falling back to streaming', error)
      return src
    })
  cache.set(src, pending)
  return pending
}

/** Blob URL when the clip is already prefetched, otherwise the network URL (still plays, just later). */
export function resolveMedia(src: string): Promise<string> {
  return cache.get(src) ?? Promise.resolve(src)
}
