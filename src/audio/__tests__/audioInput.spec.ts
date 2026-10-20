import { describe, expect, it } from 'vitest'
import { toInputError } from '../audioInput'

const domError = (name: string, message: string) => new DOMException(message, name)

describe('toInputError', () => {
  it('запрет доступа', () => {
    expect(toInputError(domError('NotAllowedError', 'Permission denied')).code).toBe('denied')
    expect(toInputError(domError('SecurityError', 'x')).code).toBe('denied')
  })

  it('нет входов (в том числе когда Windows закрыла доступ к микрофону)', () => {
    const error = toInputError(domError('NotFoundError', 'Requested device not found'))
    expect(error.code).toBe('not-found')
    expect(error.message).toBe('NotFoundError: Requested device not found')
    expect(toInputError(domError('OverconstrainedError', 'x')).code).toBe('not-found')
  })

  it('устройство занято или заблокировано', () => {
    expect(toInputError(domError('NotReadableError', 'Could not start audio source')).code).toBe(
      'busy',
    )
    expect(toInputError(domError('AbortError', 'x')).code).toBe('busy')
  })

  it('прочее — с текстом браузера', () => {
    const error = toInputError(new TypeError('boom'))
    expect(error.code).toBe('unknown')
    expect(error.message).toBe('TypeError: boom')
  })
})
