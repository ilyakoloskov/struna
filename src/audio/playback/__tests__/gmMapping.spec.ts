import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { getSoundfontNames } from 'smplr'
import { drumGroup, soundfontName } from '../gmMapping'

describe('soundfontName', () => {
  it('все 128 программ GM находят soundfont в smplr', () => {
    const available = new Set(getSoundfontNames())
    const track = new Midi().addTrack()
    const missing: string[] = []
    for (let program = 0; program < 128; program++) {
      track.instrument.number = program
      const name = soundfontName(track.instrument)
      if (!available.has(name)) missing.push(`${program}: ${track.instrument.name} → ${name}`)
    }
    expect(missing).toEqual([])
  })

  it('примеры', () => {
    expect(soundfontName({ name: 'electric guitar (clean)' })).toBe('electric_guitar_clean')
    expect(soundfontName({ name: 'distortion guitar' })).toBe('distortion_guitar')
    expect(soundfontName({ name: 'clavi' })).toBe('clavinet')
  })
})

describe('drumGroup', () => {
  it('основные барабаны', () => {
    expect(drumGroup(36)).toBe('kick')
    expect(drumGroup(38)).toBe('snare-m')
    expect(drumGroup(42)).toBe('hhclosed')
    expect(drumGroup(46)).toBe('hhopen')
    expect(drumGroup(49)).toBe('crash')
    expect(drumGroup(51)).toBe('ride')
  })

  it('неизвестные ноты пропускаются', () => {
    expect(drumGroup(20)).toBeNull()
    expect(drumGroup(81)).toBeNull()
  })
})
