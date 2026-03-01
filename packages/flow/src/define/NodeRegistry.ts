import type { NodeDefinitionWithFactory } from './defineNode'

export class NodeRegistry {
  private definitions: Map<string, NodeDefinitionWithFactory> = new Map()

  register(definition: NodeDefinitionWithFactory): void {
    this.definitions.set(definition.type, definition)
  }

  registerMany(definitions: NodeDefinitionWithFactory[]): void {
    for (const def of definitions) this.register(def)
  }

  unregister(type: string): void {
    this.definitions.delete(type)
  }

  has(type: string): boolean {
    return this.definitions.has(type)
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

  getCategories(): Map<string, NodeDefinitionWithFactory[]> {
    const categories = new Map<string, NodeDefinitionWithFactory[]>()
    for (const def of this.definitions.values()) {
      const slashIndex = def.type.indexOf('/')
      const ns = slashIndex > 0 ? def.type.slice(0, slashIndex) : 'default'
      if (!categories.has(ns)) categories.set(ns, [])
      categories.get(ns)!.push(def)
    }
    return categories
  }
}
