import { useMemo } from 'react'
import { GraphStore } from '../model/GraphStore'
import type { FlowGraph } from '../types'
import type { Validator } from '../model/Validator'

export interface UseGraphStoreOptions {
  initialGraph?: FlowGraph
  validator?: Validator
}

export function useGraphStore(options?: UseGraphStoreOptions): GraphStore {
  return useMemo(() => {
    const store = new GraphStore({ validator: options?.validator })
    if (options?.initialGraph) {
      store.importGraph(options.initialGraph)
    }
    return store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
