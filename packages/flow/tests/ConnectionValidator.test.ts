import { describe, it, expect } from 'vitest'
import { ConnectionValidator } from '../src/model/ConnectionValidator'

describe('ConnectionValidator', () => {
  const validator = new ConnectionValidator()

  it('exec → exec : valide', () => {
    expect(validator.canConnect('exec', 'exec')).toBe(true)
  })

  it('string → string : valide', () => {
    expect(validator.canConnect('string', 'string')).toBe(true)
  })

  it('string → number : invalide', () => {
    expect(validator.canConnect('string', 'number')).toBe(false)
  })

  it('exec → string : invalide', () => {
    expect(validator.canConnect('exec', 'string')).toBe(false)
  })

  it('object → object : valide', () => {
    expect(validator.canConnect('object', 'object')).toBe(true)
  })
})
