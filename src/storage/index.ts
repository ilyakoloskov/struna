import { StrunaDatabase } from './db'
import { createRepository } from './repository'

/** Хранилище приложения (одна база на всё приложение) */
export const repository = createRepository(new StrunaDatabase())

export { requestPersistentStorage } from './repository'
export type { StoredTrack, TrackFormat } from './db'
