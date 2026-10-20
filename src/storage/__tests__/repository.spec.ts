import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StrunaDatabase, type StoredTrack } from '../db'
import { createRepository } from '../repository'
import { createDemoSong } from '@/domain/tracks/demoSong'
import type { SessionResult } from '@/game/results'

let db: StrunaDatabase
let repo: ReturnType<typeof createRepository>
let counter = 0

beforeEach(() => {
  db = new StrunaDatabase(`test-${++counter}`)
  repo = createRepository(db)
})

afterEach(async () => {
  await db.delete()
})

const track = (id: string, addedAt: number): StoredTrack => ({
  id,
  fileName: `${id}.mid`,
  format: 'midi',
  song: createDemoSong(),
  guitarTrackIndex: 0,
  addedAt,
  source: new Uint8Array([77, 84, 104, 100]).buffer,
})

const result = (id: string, trackId: string, score: number, finishedAt = score): SessionResult =>
  ({ id, trackId, score, finishedAt, trackName: 't' }) as SessionResult

describe('repository', () => {
  it('треки сохраняются целиком и идут новыми сверху', async () => {
    await repo.saveTrack(track('a', 1))
    await repo.saveTrack(track('b', 2))
    const list = await repo.listTracks()
    expect(list.map((t) => t.id)).toEqual(['b', 'a'])
    expect(list[0]!.song.tracks).toHaveLength(3)
    expect(list[0]!.song.tracks[0]!.notes.length).toBeGreaterThan(10)
    expect(new Uint8Array(list[0]!.source!)).toEqual(new Uint8Array([77, 84, 104, 100]))
  })

  it('обновление гитарной дорожки', async () => {
    await repo.saveTrack(track('a', 1))
    await repo.updateTrack('a', { guitarTrackIndex: 2 })
    expect((await repo.listTracks())[0]!.guitarTrackIndex).toBe(2)
  })

  it('результаты: история по треку и лучший счёт', async () => {
    await repo.saveResult(result('r1', 'a', 500, 1))
    await repo.saveResult(result('r2', 'a', 900, 2))
    await repo.saveResult(result('r3', 'b', 300, 3))
    expect((await repo.resultsForTrack('a')).map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(await repo.bestScores()).toEqual(
      new Map([
        ['a', 900],
        ['b', 300],
      ]),
    )
    expect((await repo.getResult('r3'))?.score).toBe(300)
  })

  it('удаление трека удаляет и его результаты', async () => {
    await repo.saveTrack(track('a', 1))
    await repo.saveTrack(track('b', 2))
    await repo.saveResult(result('r1', 'a', 500))
    await repo.saveResult(result('r2', 'b', 700))
    await repo.deleteTrack('a')
    expect((await repo.listTracks()).map((t) => t.id)).toEqual(['b'])
    expect(await repo.getResult('r1')).toBeUndefined()
    expect(await repo.getResult('r2')).toBeDefined()
  })

  it('данные переживают переоткрытие базы', async () => {
    await repo.saveTrack(track('a', 1))
    const name = db.name
    db.close()
    const reopened = new StrunaDatabase(name)
    expect((await createRepository(reopened).listTracks()).map((t) => t.id)).toEqual(['a'])
    db = reopened
  })
})
