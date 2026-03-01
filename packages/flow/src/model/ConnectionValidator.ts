import type { PinType } from '../types'

const COMPATIBLE_TYPES: Record<string, PinType[]> = {
  exec: ['exec'],
  string: ['string'],
  number: ['number'],
  boolean: ['boolean'],
  object: ['object'],
  array: ['array'],
}

export class ConnectionValidator {
  canConnect(fromType: PinType, toType: PinType): boolean {
    const compatible = COMPATIBLE_TYPES[fromType]
    if (!compatible) {
      return fromType === toType
    }
    return compatible.includes(toType)
  }

  addCompatibility(fromType: PinType, toTypes: PinType[]): void {
    COMPATIBLE_TYPES[fromType] = [...(COMPATIBLE_TYPES[fromType] ?? []), ...toTypes]
  }
}
