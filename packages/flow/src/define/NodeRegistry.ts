import type { NodeDefinitionWithFactory } from './defineNode'

export class NodeRegistry {
  private definitions: Map<string, NodeDefinitionWithFactory> = new Map()

  register(definition: NodeDefinitionWithFactory): void {
    this.definitions.set(definition.type, definition)
  }

  registerMany(definitions: NodeDefinitionWithFactory[]): void {
    for (const def of definitions) this.register(def)
  }

  get(type: string): NodeDefinitionWithFactory | undefined {
    return this.definitions.get(type)
  }

  getAll(): NodeDefinitionWithFactory[] {
    return Array.from(this.definitions.values())
  }

  getByNamespace(namespace: string): NodeDefinitionWithFactory[] {
    return this.getAll().filter(d => d.type.startsWith(`${namespace}/`))
  }
}
