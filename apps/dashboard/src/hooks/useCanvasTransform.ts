import { useState, useCallback, useRef, useEffect } from 'react'

interface Transform {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.3
const MAX_SCALE = 3
const ZOOM_SENSITIVITY = 0.001

export function useCanvasTransform(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  // Zoom centered on mouse pointer
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const t = transformRef.current
    const delta = -e.deltaY * ZOOM_SENSITIVITY
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * (1 + delta)))
    const scaleFactor = newScale / t.scale

    // Zoom toward mouse position
    const newX = mouseX - (mouseX - t.x) * scaleFactor
    const newY = mouseY - (mouseY - t.y) * scaleFactor

    setTransform({ x: newX, y: newY, scale: newScale })
  }, [containerRef])

  // Pan with mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with left click on empty space (not on interactive elements)
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-interactive]') || target.closest('button')) return

    isPanning.current = true
    panStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y }
    e.currentTarget.style.cursor = 'grabbing'
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    setTransform(prev => ({
      ...prev,
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    }))
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    isPanning.current = false
    e.currentTarget.style.cursor = 'grab'
  }, [])

  // Zoom in/out from center
  const zoomIn = useCallback(() => {
    setTransform(prev => {
      const container = containerRef.current
      if (!container) return prev
      const rect = container.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const newScale = Math.min(MAX_SCALE, prev.scale * 1.25)
      const scaleFactor = newScale / prev.scale
      return {
        x: cx - (cx - prev.x) * scaleFactor,
        y: cy - (cy - prev.y) * scaleFactor,
        scale: newScale,
      }
    })
  }, [containerRef])

  const zoomOut = useCallback(() => {
    setTransform(prev => {
      const container = containerRef.current
      if (!container) return prev
      const rect = container.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const newScale = Math.max(MIN_SCALE, prev.scale / 1.25)
      const scaleFactor = newScale / prev.scale
      return {
        x: cx - (cx - prev.x) * scaleFactor,
        y: cy - (cy - prev.y) * scaleFactor,
        scale: newScale,
      }
    })
  }, [containerRef])

  // Reset to center
  const resetTransform = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  // Attach wheel listener with passive: false
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [containerRef, handleWheel])

  return {
    transform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetTransform,
    zoomIn,
    zoomOut,
    cssTransform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
  }
}
