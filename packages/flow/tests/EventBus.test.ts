import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../src/model/EventBus'

type TestEvents = {
  'item:added': { id: string }
  'item:removed': { id: string }
  'reset': {}
}

describe('EventBus', () => {
  it('on/emit delivers payload to handler', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('on returns unsubscribe function', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    const unsub = bus.on('item:added', handler)
    unsub()
    bus.emit('item:added', { id: 'a' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('off removes a specific handler', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('item:added', handler)
    bus.off('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('once fires handler only once', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.once('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    bus.emit('item:added', { id: 'b' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('multiple handlers on same event all fire', () => {
    const bus = new EventBus<TestEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('item:added', h1)
    bus.on('item:added', h2)
    bus.emit('item:added', { id: 'x' })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('emit on event with no listeners does not throw', () => {
    const bus = new EventBus<TestEvents>()
    expect(() => bus.emit('reset', {})).not.toThrow()
  })
})
