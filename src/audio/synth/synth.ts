import { DEFAULT_A4, midiToFreq } from '@/domain/music/pitch'
import { getAudioContext, resumeAudioContext } from '../context'
import { pluck } from './pluck'

// Проигрывание нот по клику (гриф, круг) в общем AudioContext

const cache = new Map<string, { buffer: AudioBuffer; playbackRate: number }>()

export async function playNote(midi: number, a4 = DEFAULT_A4): Promise<void> {
  const ctx = getAudioContext()
  // Клик — жест пользователя, поэтому контекст запустится
  await resumeAudioContext()

  const cacheKey = `${midi}@${a4}`
  let sound = cache.get(cacheKey)
  if (!sound) {
    const { samples, playbackRate } = pluck(midiToFreq(midi, a4), { sampleRate: ctx.sampleRate })
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.copyToChannel(samples, 0)
    sound = { buffer, playbackRate }
    cache.set(cacheKey, sound)
  }

  const source = ctx.createBufferSource()
  source.buffer = sound.buffer
  source.playbackRate.value = sound.playbackRate
  const gain = ctx.createGain()
  gain.gain.value = 0.6
  source.connect(gain).connect(ctx.destination)
  source.start()
}
