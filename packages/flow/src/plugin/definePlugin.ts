import type { FlowPlugin } from './types'

export function definePlugin(plugin: FlowPlugin): () => FlowPlugin {
  if (!plugin.name || plugin.name.trim() === '') {
    throw new Error('Plugin name must not be empty')
  }
  return () => ({ ...plugin })
}
