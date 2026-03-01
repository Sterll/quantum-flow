import { describe, it, expect } from 'vitest'
import { History } from '../src/model/History'
import { GraphModel } from '../src/model/GraphModel'

describe('History', () => {
  it('doit permettre un undo après une action', () => {
    const model = new GraphModel()
    const history = new History(model, 50)

    history.snapshot()
    model.addNode({ id: 'n1', type: 'test', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    history.snapshot()

    expect(model.getNodes()).toHaveLength(1)
    history.undo()
    expect(model.getNodes()).toHaveLength(0)
  })

  it('doit permettre un redo après un undo', () => {
    const model = new GraphModel()
    const history = new History(model, 50)

    history.snapshot()
    model.addNode({ id: 'n1', type: 'test', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    history.snapshot()
    history.undo()
    history.redo()

    expect(model.getNodes()).toHaveLength(1)
  })
})
