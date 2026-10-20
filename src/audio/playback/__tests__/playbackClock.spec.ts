import { describe, expect, it } from 'vitest'
import { PlaybackClock } from '../playbackClock'

describe('PlaybackClock', () => {
  it('темп 100 %: время трека = прошедшее время', () => {
    const clock = new PlaybackClock(1)
    clock.start(10, 5)
    expect(clock.songTime(12)).toBeCloseTo(7)
    expect(clock.contextTime(8)).toBeCloseTo(13)
  })

  it('темп 50 %: секунда трека — две секунды реального времени', () => {
    const clock = new PlaybackClock(0.5)
    clock.start(10, 0)
    expect(clock.songTime(14)).toBeCloseTo(2)
    expect(clock.contextTime(3)).toBeCloseTo(16)
  })

  it('петля: ноты следующего прохода планируются заранее, позиция переключается ровно на границе', () => {
    const clock = new PlaybackClock(1)
    clock.start(0, 0)
    // Петля 4…8 с заходом с 2: дойдя до 8, продолжаем с 2
    const at = clock.scheduleWrap(8, 2)
    expect(at).toBeCloseTo(8)
    // Пока граница не пройдена — старая позиция
    expect(clock.songTime(7.9)).toBeCloseTo(7.9)
    expect(clock.pass).toBe(0)
    // Ноты нового прохода уже ставятся на время после границы
    expect(clock.contextTime(2)).toBeCloseTo(8)
    expect(clock.contextTime(4)).toBeCloseTo(10)
    // После границы — новый проход
    expect(clock.songTime(8.5)).toBeCloseTo(2.5)
    expect(clock.pass).toBe(1)
    expect(clock.hasPendingWrap).toBe(false)
  })

  it('удар, сыгранный до перехода, остаётся в прошлом проходе', () => {
    const clock = new PlaybackClock(1)
    clock.start(0, 0)
    clock.scheduleWrap(8, 2)
    clock.songTime(8.2) // переход совершён
    expect(clock.songTimeAt(7.95)).toBeCloseTo(7.95)
    expect(clock.songTimeAt(8.1)).toBeCloseTo(2.1)
  })

  it('петля на замедленном темпе', () => {
    const clock = new PlaybackClock(0.75)
    clock.start(0, 0)
    const at = clock.scheduleWrap(3, 0)
    expect(at).toBeCloseTo(4)
    expect(clock.songTime(5)).toBeCloseTo(0.75)
  })
})
