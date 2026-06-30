import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyMainMargin,
  clampSidebarWidth,
  loadSidebarWidth,
  saveSidebarWidth,
} from '../../shared/sidebarWidth'
import { SIDEBAR_WIDTH_DEFAULT } from '../../types'

export function useSidebarWidth() {
  const [width, setWidth] = useState(SIDEBAR_WIDTH_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const widthRef = useRef(width)

  widthRef.current = width

  useEffect(() => {
    void loadSidebarWidth().then((w) => {
      setWidth(w)
      applyMainMargin(w)
    })
  }, [])

  useEffect(() => {
    applyMainMargin(width)
  }, [width])

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startWidth = widthRef.current
    setResizing(true)

    const onMove = (ev: PointerEvent) => {
      const next = clampSidebarWidth(startWidth + (startX - ev.clientX))
      setWidth(next)
    }

    const onUp = () => {
      setResizing(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      void saveSidebarWidth(widthRef.current)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [])

  return { width, resizing, startResize }
}
