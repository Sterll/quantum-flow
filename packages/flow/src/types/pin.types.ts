export type PinType =
  | 'exec'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | (string & {}) // custom types via namespacing

export interface FlowPin {
  id: string
  type: PinType
  label: string
  optional?: boolean
  defaultValue?: unknown
}
