export interface PinTypeInfo {
  color: string
  label?: string
}

const BUILTIN_DEFAULTS: Record<string, PinTypeInfo> = {
  exec:    { color: '#71717a', label: 'Exec' },
  string:  { color: '#a78bfa', label: 'String' },
  number:  { color: '#34d399', label: 'Number' },
  boolean: { color: '#fbbf24', label: 'Boolean' },
  object:  { color: '#60a5fa', label: 'Object' },
  array:   { color: '#f472b6', label: 'Array' },
}

const FALLBACK_COLOR = '#6b7280'

export class PinTypeRegistry {
  private types = new Map<string, PinTypeInfo>()

  constructor() {
    for (const [type, info] of Object.entries(BUILTIN_DEFAULTS)) {
      this.types.set(type, { ...info })
    }
  }

  register(type: string, info: PinTypeInfo): void {
    this.types.set(type, { ...info })
  }

  get(type: string): PinTypeInfo | undefined {
    return this.types.get(type)
  }

  getColor(type: string): string {
    return this.types.get(type)?.color ?? FALLBACK_COLOR
  }

  getAll(): Map<string, PinTypeInfo> {
    return new Map(this.types)
  }
}
