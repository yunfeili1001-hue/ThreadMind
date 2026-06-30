import type { BlockLevel } from '../types'

/** rowBody padding-left，与 DragBlock Step 4 规范一致 */
export const ROW_BODY_INDENT_PX: Record<BlockLevel, number> = {
  1: 8,
  2: 20,
  3: 34,
}

/** 展开区 margin-left，与 PRD §6.4 一致 */
export const EXPAND_PANEL_MARGIN_PX: Record<BlockLevel, number> = {
  1: 24,
  2: 38,
  3: 50,
}

export function rowBodyIndentPx(level: BlockLevel): number {
  return ROW_BODY_INDENT_PX[level]
}

export function expandPanelMarginPx(level: BlockLevel): number {
  return EXPAND_PANEL_MARGIN_PX[level]
}
