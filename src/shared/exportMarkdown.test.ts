import { describe, expect, it } from 'vitest'
import type { Block } from '../types'
import {
  blocksToMarkdown,
  getBlockExportBody,
  headingPrefix,
  normalizeUnorderedLists,
} from './exportMarkdown'

function makeBlock(overrides: Partial<Block> & Pick<Block, 'id' | 'title'>): Block {
  return {
    level: 1,
    summary: '',
    collected: [],
    noteContent: '',
    isExpanded: false,
    parentId: null,
    order: 0,
    createdAt: 1,
    ...overrides,
  }
}

describe('normalizeUnorderedLists', () => {
  it('converts unicode bullets to markdown dashes', () => {
    const input = '· React 是库\n  · 组件化思想'
    expect(normalizeUnorderedLists(input)).toBe(
      '- React 是库\n  - 组件化思想'
    )
  })

  it('preserves code blocks', () => {
    const input = '· before\n```js\ncode · not bullet\n```\n· after'
    expect(normalizeUnorderedLists(input)).toBe(
      '- before\n```js\ncode · not bullet\n```\n- after'
    )
  })

  it('preserves ordered lists and headings', () => {
    const input = '# Title\n1. first\n· bullet'
    expect(normalizeUnorderedLists(input)).toBe('# Title\n1. first\n- bullet')
  })
})

describe('blocksToMarkdown', () => {
  it('maps levels to ## / ### / ####', () => {
    expect(headingPrefix(1)).toBe('##')
    expect(headingPrefix(2)).toBe('###')
    expect(headingPrefix(3)).toBe('####')
  })

  it('exports tree with document title and standard bullets', () => {
    const blocks: Block[] = [
      makeBlock({
        id: 'l1',
        title: 'React 简介',
        level: 1,
        summary: '· 前端库\n· 组件化',
        noteContent: '· 前端库\n· 组件化',
        order: 0,
      }),
      makeBlock({
        id: 'l2',
        title: 'Hooks',
        level: 2,
        parentId: 'l1',
        summary: '· useState',
        noteContent: '· useState',
        order: 0,
      }),
    ]

    const md = blocksToMarkdown(blocks)
    expect(md).toContain('# React 简介')
    expect(md).toContain('## React 简介')
    expect(md).toContain('- 前端库')
    expect(md).toContain('### Hooks')
    expect(md).toContain('- useState')
    expect(md).not.toContain('·')
  })
})

describe('getBlockExportBody', () => {
  it('falls back to summary when noteContent is empty', () => {
    const block = makeBlock({
      id: 'a',
      title: 'T',
      summary: '· 要点一',
      noteContent: '',
    })
    expect(getBlockExportBody(block)).toBe('- 要点一')
  })
})
