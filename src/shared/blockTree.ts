import type { Block } from '../types'

export interface BlockNode extends Block {
  children: BlockNode[]
}

/** 将扁平 blocks 按 parentId + order 构建为树（深度优先遍历用） */
export function buildBlockTree(blocks: Block[]): BlockNode[] {
  const nodes = new Map<string, BlockNode>()
  for (const block of blocks) {
    nodes.set(block.id, { ...block, children: [] })
  }

  const roots: BlockNode[] = []

  for (const block of blocks) {
    const node = nodes.get(block.id)!
    if (block.parentId === null) {
      roots.push(node)
    } else {
      const parent = nodes.get(block.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  }

  const sortByOrder = (list: BlockNode[]) => {
    list.sort((a, b) => a.order - b.order)
    list.forEach((n) => sortByOrder(n.children))
  }
  sortByOrder(roots)
  return roots
}

/** 深度优先扁平列表（用于拖拽排序与层级校正） */
export function flattenBlockTree(blocks: Block[]): Block[] {
  const tree = buildBlockTree(blocks)
  const out: Block[] = []

  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      const { children, ...block } = node
      out.push(block)
      walk(children)
    }
  }

  walk(tree)
  return out
}
