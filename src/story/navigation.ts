import type { Scene, Story } from './types'

/** Clips the viewer may need next from this scene (idle loop + every branch), for prefetching. */
export function upcomingClips(story: Story, scene: Scene): string[] {
  const nextIds = scene.kind === 'linear' ? [scene.next]
    : scene.kind === 'choice' ? scene.choice.options.map((o) => o.next)
    : []
  const sources = [
    ...(scene.kind === 'choice' ? [scene.choice.idle.src] : []),
    ...nextIds.map((id) => story.scenes[id]?.clip.src),
  ]
  return [...new Set(sources.filter((src): src is string => typeof src === 'string'))]
}
