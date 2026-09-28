/**
 * Procedural night-train sound (Web Audio, no audio files): rail rumble, wheel clacks whose tempo follows
 * the viewer's fear, a low drone that opens up with tension and a heartbeat when fear is high.
 */
const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_S = 0.12
const CLACK_SLOW_S = 1.15
const CLACK_FAST_S = 0.5
const HEARTBEAT_FROM = 0.55
const HEARTBEAT_PERIOD_S = 0.85

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = brown ? (last + 0.02 * white) / 1.02 : white
    data[i] = brown ? last * 3.5 : white
  }
  return buffer
}

export class Soundscape {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneGain: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private whiteNoise: AudioBuffer | null = null
  private tension = 0
  private nextClack = 0
  private nextBeat = 0
  private timer: number | null = null

  /** Must be called from a user gesture (browsers block audio until then). */
  start(): void {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3)
    this.master.connect(ctx.destination)
    this.whiteNoise = noiseBuffer(ctx, 1, false)
    this.startRumble(ctx, this.master)
    this.startDrone(ctx, this.master)
    this.nextClack = ctx.currentTime + 0.5
    this.nextBeat = ctx.currentTime
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS)
  }

  setTension(value: number): void {
    this.tension = Math.min(1, Math.max(0, value))
    const ctx = this.ctx
    if (!ctx || !this.droneGain || !this.droneFilter) return
    this.droneGain.gain.setTargetAtTime(0.04 + 0.16 * this.tension, ctx.currentTime, 0.8)
    this.droneFilter.frequency.setTargetAtTime(160 + 900 * this.tension, ctx.currentTime, 0.8)
  }

  /** Three knocks on glass: the conductor waking a bored viewer, or someone outside the train. */
  knock(): void {
    const ctx = this.ctx
    if (!ctx) return
    for (let i = 0; i < 3; i++) this.hit(ctx.currentTime + i * 0.24, 900, 8, 0.9, 0.09)
  }

  /** Soft bell when a gesture is recognized. */
  chime(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    for (const [freq, level] of [[880, 0.07], [1318.5, 0.04]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(level, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4)
      osc.connect(gain).connect(this.master)
      osc.start()
      osc.stop(ctx.currentTime + 1.5)
    }
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    void this.ctx?.close()
    this.ctx = null
  }

  private startRumble(ctx: AudioContext, out: AudioNode): void {
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx, 3, true)
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 170
    const gain = ctx.createGain()
    gain.gain.value = 0.32
    source.connect(filter).connect(gain).connect(out)
    source.start()
  }

  private startDrone(ctx: AudioContext, out: AudioNode): void {
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 160
    this.droneGain = ctx.createGain()
    this.droneGain.gain.value = 0.04
    this.droneFilter.connect(this.droneGain).connect(out)
    for (const [type, freq] of [['sawtooth', 55], ['sawtooth', 55.35], ['sine', 27.5]] as const) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      osc.connect(this.droneFilter)
      osc.start()
    }
  }

  private schedule(): void {
    const ctx = this.ctx
    if (!ctx) return
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_S
    while (this.nextClack < horizon) {
      // "ta-tak": two wheels over a rail joint
      this.hit(this.nextClack, 2000, 1.4, 0.35, 0.035)
      this.hit(this.nextClack + 0.11, 1700, 1.4, 0.28, 0.035)
      this.nextClack += CLACK_SLOW_S - (CLACK_SLOW_S - CLACK_FAST_S) * this.tension
    }
    while (this.nextBeat < horizon) {
      if (this.tension >= HEARTBEAT_FROM) {
        const level = (this.tension - HEARTBEAT_FROM) / (1 - HEARTBEAT_FROM)
        this.thump(this.nextBeat, 0.5 * level)
        this.thump(this.nextBeat + 0.22, 0.35 * level)
      }
      this.nextBeat += HEARTBEAT_PERIOD_S
    }
  }

  private hit(at: number, freq: number, q: number, level: number, decay: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.whiteNoise) return
    const source = ctx.createBufferSource()
    source.buffer = this.whiteNoise
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay * 4)
    source.connect(filter).connect(gain).connect(this.master)
    source.start(at)
    source.stop(at + decay * 4 + 0.05)
  }

  private thump(at: number, level: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master || level <= 0) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(80, at)
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.12)
    gain.gain.setValueAtTime(level, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
    osc.connect(gain).connect(this.master)
    osc.start(at)
    osc.stop(at + 0.25)
  }
}
