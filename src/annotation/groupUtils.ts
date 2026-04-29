import type { AnnotationNode, NodeType } from './types'

export interface NodeGroup {
  indices: number[]
  label: string
}

export interface SelectedGroup {
  type: NodeType
  nodes: AnnotationNode[]
}

export function nodeLabel(node: AnnotationNode): string {
  const title = node.Title?.Text ?? node.Desc?.Text
  if (title) return title.slice(0, 40) + (title.length > 40 ? '…' : '')
  if (node.Type === 'grenade' && node.GrenadeType) return `Grenade (${node.GrenadeType})`
  return `${node.Type}${node.SubType ? ` (${node.SubType})` : ''}`
}

export function buildNodeGroups(nodes: AnnotationNode[]) {
  const used = new Set<number>()
  const grenadeGroups: NodeGroup[] = []
  const lineGroups: NodeGroup[] = []

  for (let i = 0; i < nodes.length; i++) {
    if (used.has(i)) continue
    const node = nodes[i]
    if (node.Type === 'grenade' && (node.SubType === 'main' || !node.SubType) && node.Id) {
      const indices = [i, ...nodes.map((n, j) => (n.MasterNodeId === node.Id ? j : -1)).filter((j) => j >= 0)]
      indices.forEach((j) => used.add(j))
      grenadeGroups.push({ indices, label: nodeLabel(node) || `Grenade (${node.GrenadeType ?? 'smoke'})` })
    } else if (node.Type === 'line' && (node.SubType === 'main' || !node.SubType) && node.Id) {
      const indices = [i, ...nodes.map((n, j) => (n.MasterNodeId === node.Id ? j : -1)).filter((j) => j >= 0)]
      indices.forEach((j) => used.add(j))
      lineGroups.push({ indices, label: nodeLabel(node) || 'Line' })
    }
  }

  const positionIndices: number[] = []
  const textIndices: number[] = []
  const spotIndices: number[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (used.has(i)) continue
    const { Type } = nodes[i]
    if (Type === 'position') positionIndices.push(i)
    else if (Type === 'text') textIndices.push(i)
    else if (Type === 'spot') spotIndices.push(i)
  }

  return { grenadeGroups, lineGroups, positionIndices, textIndices, spotIndices }
}

export function buildSelectedGroups(
  selectedKeys: Set<number>,
  nodes: AnnotationNode[],
  groups: ReturnType<typeof buildNodeGroups>
): SelectedGroup[] {
  const result: SelectedGroup[] = []
  for (const key of selectedKeys) {
    const grenadeGroup = groups.grenadeGroups.find((g) => g.indices[0] === key)
    if (grenadeGroup) {
      result.push({ type: 'grenade', nodes: grenadeGroup.indices.map((i) => nodes[i]) })
      continue
    }
    const lineGroup = groups.lineGroups.find((g) => g.indices[0] === key)
    if (lineGroup) {
      result.push({ type: 'line', nodes: lineGroup.indices.map((i) => nodes[i]) })
      continue
    }
    const node = nodes[key]
    if (node) result.push({ type: node.Type, nodes: [node] })
  }
  return result
}

function posEq(
  a?: [number, number, number] | null,
  b?: [number, number, number] | null
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function groupMatchesExisting(
  group: SelectedGroup,
  existingGroups: ReturnType<typeof buildNodeGroups>,
  existingNodes: AnnotationNode[]
): boolean {
  if (group.type === 'grenade') {
    const main = group.nodes.find((n) => n.SubType === 'main' || !n.SubType)
    const aim = group.nodes.find((n) => n.SubType === 'aim_target')
    const dest = group.nodes.find((n) => n.SubType === 'destination')
    return existingGroups.grenadeGroups.some((eg) => {
      const eNodes = eg.indices.map((i) => existingNodes[i])
      const eMain = eNodes.find((n) => n.SubType === 'main' || !n.SubType)
      const eAim = eNodes.find((n) => n.SubType === 'aim_target')
      const eDest = eNodes.find((n) => n.SubType === 'destination')
      return (
        posEq(main?.Position, eMain?.Position) &&
        posEq(main?.Angles, eMain?.Angles) &&
        posEq(aim?.Position, eAim?.Position) &&
        posEq(aim?.Angles, eAim?.Angles) &&
        posEq(dest?.Position, eDest?.Position)
      )
    })
  }
  if (group.type === 'line') {
    const inWaypoints = group.nodes.map((n) => n.Position)
    return existingGroups.lineGroups.some((eg) => {
      const eNodes = eg.indices.map((i) => existingNodes[i])
      const eWaypoints = eNodes.map((n) => n.Position)
      if (inWaypoints.length !== eWaypoints.length) return false
      return inWaypoints.every((wp, i) => posEq(wp, eWaypoints[i]))
    })
  }
  const inNode = group.nodes[0]
  if (!inNode) return false
  const bucket =
    group.type === 'position'
      ? existingGroups.positionIndices
      : group.type === 'text'
        ? existingGroups.textIndices
        : existingGroups.spotIndices
  return bucket.some((i) => {
    const en = existingNodes[i]
    return posEq(inNode.Position, en.Position) && posEq(inNode.Angles, en.Angles)
  })
}

export function classifyDuplicates(
  incoming: SelectedGroup[],
  existingNodes: AnnotationNode[]
): { toAdd: SelectedGroup[]; skipped: SelectedGroup[] } {
  const existingGroups = buildNodeGroups(existingNodes)
  const toAdd: SelectedGroup[] = []
  const skipped: SelectedGroup[] = []
  for (const group of incoming) {
    if (groupMatchesExisting(group, existingGroups, existingNodes)) {
      skipped.push(group)
    } else {
      toAdd.push(group)
    }
  }
  return { toAdd, skipped }
}
