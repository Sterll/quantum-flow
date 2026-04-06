type Handler<T> = (payload: T) => void

export class EventBus<Events extends { [K in keyof Events]: Events[K] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<keyof Events, Set<Handler<any>>>()

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      handler(payload)
    }
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const wrapper: Handler<Events[K]> = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    return this.on(event, wrapper)
  }
}
