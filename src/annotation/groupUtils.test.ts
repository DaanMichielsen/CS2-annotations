import { describe, it, expect } from 'vitest'
import { buildNodeGroups, buildSelectedGroups, classifyDuplicates } from './groupUtils'
import type { AnnotationNode } from './types'

function grenade(
  id: string,
  mainPos: [number, number, number],
  aimPos: [number, number, number],
  destPos: [number, number, number]
): AnnotationNode[] {
  return [
    { Type: 'grenade', SubType: 'main', Id: id, Position: mainPos, Angles: [0, 0, 0], GrenadeType: 'smoke' } as AnnotationNode,
    { Type: 'grenade', SubType: 'aim_target', MasterNodeId: id, Id: id + '_aim', Position: aimPos, Angles: [0, 45, 0] } as AnnotationNode,
    { Type: 'grenade', SubType: 'destination', MasterNodeId: id, Id: id + '_dest', Position: destPos } as AnnotationNode,
  ]
}

function posNode(id: string, pos: [number, number, number], angles: [number, number, number]): AnnotationNode {
  return { Type: 'position', Id: id, Position: pos, Angles: angles } as AnnotationNode
}

describe('classifyDuplicates – grenade', () => {
  it('flags a grenade as duplicate when all three positions match existing', () => {
    const nodes = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes }]
    const { toAdd, skipped } = classifyDuplicates(incoming, nodes)
    expect(toAdd).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })

  it('does not flag grenade as duplicate when main position differs', () => {
    const existing = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes: grenade('g2', [101, 200, 0], [0, 0, 64], [300, 400, 0]) }]
    const { toAdd, skipped } = classifyDuplicates(incoming, existing)
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })

  it('does not flag grenade as duplicate when destination position differs', () => {
    const existing = grenade('g1', [100, 200, 0], [0, 0, 64], [300, 400, 0])
    const incoming = [{ type: 'grenade' as const, nodes: grenade('g2', [100, 200, 0], [0, 0, 64], [300, 401, 0]) }]
    const { toAdd, skipped } = classifyDuplicates(incoming, existing)
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })
})

describe('classifyDuplicates – position node', () => {
  it('flags position as duplicate when position and angles match', () => {
    const node = posNode('p1', [10, 20, 0], [0, 90, 0])
    const incoming = [{ type: 'position' as const, nodes: [node] }]
    const { toAdd, skipped } = classifyDuplicates(incoming, [node])
    expect(skipped).toHaveLength(1)
    expect(toAdd).toHaveLength(0)
  })

  it('does not flag position as duplicate when angles differ', () => {
    const existing = posNode('p1', [10, 20, 0], [0, 90, 0])
    const incoming = [{ type: 'position' as const, nodes: [posNode('p2', [10, 20, 0], [0, 91, 0])] }]
    const { toAdd, skipped } = classifyDuplicates(incoming, [existing])
    expect(toAdd).toHaveLength(1)
    expect(skipped).toHaveLength(0)
  })
})

describe('buildSelectedGroups', () => {
  it('returns grenade group for a selected key matching the main node index', () => {
    const nodes = grenade('g1', [0, 0, 0], [1, 1, 1], [2, 2, 2])
    const groups = buildNodeGroups(nodes)
    const result = buildSelectedGroups(new Set([0]), nodes, groups)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('grenade')
    expect(result[0].nodes).toHaveLength(3)
  })

  it('returns individual node for a position type', () => {
    const nodes: AnnotationNode[] = [posNode('p1', [0, 0, 0], [0, 0, 0])]
    const groups = buildNodeGroups(nodes)
    const result = buildSelectedGroups(new Set([0]), nodes, groups)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('position')
    expect(result[0].nodes).toHaveLength(1)
  })
})
