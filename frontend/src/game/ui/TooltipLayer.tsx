import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HOVER_DELAY = 260
const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 10

function anchorAt(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null
}

export function TooltipLayer() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [, refresh] = useState(0)
  const tooltip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let timer: number | undefined
    const hide = () => { window.clearTimeout(timer); setAnchor(null) }
    const hover = (event: PointerEvent) => {
      const next = anchorAt(event.target)
      if (event.pointerType === 'touch' || next === anchorAt(event.relatedTarget)) return
      hide()
      if (next) timer = window.setTimeout(() => { if (next.isConnected) setAnchor(next) }, HOVER_DELAY)
    }
    const leave = (event: PointerEvent) => {
      if (anchorAt(event.target) !== anchorAt(event.relatedTarget)) hide()
    }
    const focus = (event: FocusEvent) => {
      hide()
      if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) setAnchor(anchorAt(event.target))
    }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', hover)
    document.addEventListener('pointerout', leave)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('keydown', key, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerover', hover)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('keydown', key, true)
    }
  }, [])
  useEffect(() => {
    if (!anchor) return
    const attributes = new MutationObserver(() => refresh(value => value + 1))
    attributes.observe(anchor, { attributeFilter: ['data-tooltip'] })
    return () => attributes.disconnect()
  }, [anchor])
  const text = anchor?.dataset.tooltip
  useLayoutEffect(() => {
    const node = tooltip.current
    if (!anchor || !node) return
    const box = anchor.getBoundingClientRect()
    const center = (box.left + box.right) / 2
    const top = box.top - node.offsetHeight - ANCHOR_GAP
    const left = Math.max(VIEWPORT_MARGIN, Math.min(center - node.offsetWidth / 2, window.innerWidth - node.offsetWidth - VIEWPORT_MARGIN))
    node.dataset.side = top >= VIEWPORT_MARGIN ? 'top' : 'bottom'
    node.style.top = `${Math.min(window.innerHeight - node.offsetHeight - VIEWPORT_MARGIN, top >= VIEWPORT_MARGIN ? top : box.bottom + ANCHOR_GAP)}px`
    node.style.left = `${left}px`
    node.style.setProperty('--tooltip-anchor', `${Math.max(13, Math.min(node.offsetWidth - 13, center - left))}px`)
  }, [anchor, text])
  return text ? createPortal(<div className="game-tooltip" role="tooltip" ref={tooltip}>{text}</div>, document.body) : null
}
