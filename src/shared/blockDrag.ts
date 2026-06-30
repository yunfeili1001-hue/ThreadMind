import type { Block, BlockLevel } from '../types'

/** 相对拖动起点的横向位移阈值：超过才升/降一级 */
export const LEVEL_DRAG_THRESHOLD_PX = 40

/**
 * 由 startLevel + delta.x 推算目标层级（纯上下拖 delta.x≈0 时层级不变）
 */
export function resolveLevelFromDragDelta(
  startLevel: BlockLevel,
  deltaX: number
): BlockLevel {
  let levelDelta = 0
  if (deltaX > LEVEL_DRAG_THRESHOLD_PX) levelDelta = 1
  else if (deltaX < -LEVEL_DRAG_THRESHOLD_PX) levelDelta = -1

  const next = startLevel + levelDelta
  return Math.min(3, Math.max(1, next)) as BlockLevel
}

/** 往上找最近的 level = block.level - 1 作为 parent */
export function recalcParentIds(flatList: Block[]): Block[] {
  return flatList.map((block, index) => {
    if (block.level === 1) {
      return { ...block, parentId: null }
    }

    const parentLevel = (block.level - 1) as BlockLevel
    let parentId: string | null = null

    for (let i = index - 1; i >= 0; i--) {
      if (flatList[i].level === parentLevel) {
        parentId = flatList[i].id
        break
      }
      if (flatList[i].level < block.level) break
    }

    return { ...block, parentId }
  })
}

export function recalcSiblingOrders(flatList: Block[]): Block[] {
  const orderMap = new Map<string | null, number>()
  return flatList.map((block) => {
    const order = orderMap.get(block.parentId) ?? 0
    orderMap.set(block.parentId, order + 1)
    return { ...block, order }
  })
}

/** 拖动结束后：应用新顺序 + 可选新层级，并重算 parentId / order */
export function applyFlatDragResult(
  blocks: Block[],
  activeId: string,
  reorderedFlat: Block[],
  dragLevel: BlockLevel | null
): Block[] {
  const byId = new Map(blocks.map((b) => [b.id, b]))

  let list: Block[] = reorderedFlat.map((item) => {
    const base = byId.get(item.id)
    if (!base) return item
    const level =
      item.id === activeId && dragLevel !== null ? dragLevel : base.level
    return { ...base, level }
  })

  list = recalcParentIds(list)
  list = recalcSiblingOrders(list)
  return list
}

/** 扁平列表中移动整块子树（保持父子在列表中连续） */
export function moveSubtreeInFlatList(
  flat: Block[],
  activeId: string,
  overId: string
): Block[] {
  if (activeId === overId) return flat

  const from = flat.findIndex((b) => b.id === activeId)
  const overIdx = flat.findIndex((b) => b.id === overId)
  if (from < 0 || overIdx < 0) return flat

  const rootLevel = flat[from].level
  let end = from + 1
  while (end < flat.length && flat[end].level > rootLevel) end++

  const subtree = flat.slice(from, end)
  const rest = [...flat.slice(0, from), ...flat.slice(end)]

  let insertAt = rest.findIndex((b) => b.id === overId)
  if (insertAt < 0) insertAt = rest.length
  else if (overIdx > from) {
    const overLevel = flat[overIdx].level
    let overEnd = overIdx + 1
    while (overEnd < flat.length && flat[overEnd].level > overLevel) overEnd++
    insertAt = overEnd - (end - from)
    insertAt = Math.max(0, Math.min(insertAt, rest.length))
  }

  return [...rest.slice(0, insertAt), ...subtree, ...rest.slice(insertAt)]
}
