import { describe, it, expect, beforeEach } from 'vitest'
import { GraphModel } from '../src/model/GraphModel'

describe('GraphModel', () => {
  let model: GraphModel

  beforeEach(() => {
    model = new GraphModel()
  })

  it('doit ajouter un node', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    expect(model.getNodes()).toHaveLength(1)
  })

  it('doit supprimer un node et ses connexions', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'A', position: { x: 0, y: 0 }, inputs: [{ id: 'in', type: 'exec', label: '' }], outputs: [], data: {} })
    model.addNode({ id: 'n2', type: 'test/node', label: 'B', position: { x: 200, y: 0 }, inputs: [], outputs: [{ id: 'out', type: 'exec', label: '' }], data: {} })
    model.addConnection({ id: 'c1', fromNodeId: 'n2', fromPinId: 'out', toNodeId: 'n1', toPinId: 'in' })
    model.removeNode('n1')
    expect(model.getNodes()).toHaveLength(1)
    expect(model.getConnections()).toHaveLength(0)
  })

  it('doit ajouter une connexion', () => {
    model.addConnection({ id: 'c1', fromNodeId: 'n1', fromPinId: 'out', toNodeId: 'n2', toPinId: 'in' })
    expect(model.getConnections()).toHaveLength(1)
  })

  it('doit déplacer un node', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    model.moveNode('n1', { x: 150, y: 300 })
    expect(model.getNodes()[0].position).toEqual({ x: 150, y: 300 })
  })

  it('doit sérialiser et désérialiser le graph', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    const json = model.serialize()
    const model2 = GraphModel.fromJSON(json)
    expect(model2.getNodes()).toHaveLength(1)
  })
})
