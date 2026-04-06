export interface FlowWaypoint {
  id: string
  x: number
  y: number
}

export interface FlowConnection {
  id: string
  fromNodeId: string
  fromPinId: string
  toNodeId: string
  toPinId: string
  waypoints?: FlowWaypoint[]
}
