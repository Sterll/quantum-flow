import { createContext, useContext } from 'react'
import { useFlowEditor, type UseFlowEditorOptions, type FlowEditorAPI } from './useFlowEditor'

const FlowContext = createContext<FlowEditorAPI | null>(null)

export interface FlowProviderProps extends UseFlowEditorOptions {
  children: React.ReactNode
}

export function FlowProvider({ children, ...options }: FlowProviderProps): JSX.Element {
  const editor = useFlowEditor(options)
  return <FlowContext.Provider value={editor}>{children}</FlowContext.Provider>
}

export function useFlowContext(): FlowEditorAPI {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useFlowContext must be used within a FlowProvider')
  }
  return ctx
}
