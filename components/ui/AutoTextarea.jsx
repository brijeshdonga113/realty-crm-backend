'use client'
import { useRef, useEffect, forwardRef, useCallback } from 'react'

function getScrollParent(el) {
  let node = el.parentElement
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node
    node = node.parentElement
  }
  return document.scrollingElement || document.documentElement
}

function resizeToContent(el) {
  if (!el) return
  // Setting height to 'auto' collapses the field for a frame. If the field is
  // mid-viewport, that jump scrolls the next edit control into view. Pin the
  // nearest scroll container so the caret stays put.
  const scroller = getScrollParent(el)
  const top = scroller.scrollTop
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
  scroller.scrollTop = top
}

const AutoTextarea = forwardRef(function AutoTextarea({ value, onChange, style, ...rest }, externalRef) {
  const internalRef = useRef(null)

  const setRef = useCallback((node) => {
    internalRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef) externalRef.current = node
  }, [externalRef])

  useEffect(() => {
    resizeToContent(internalRef.current)
  }, [value])

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={onChange}
      rows={1}
      style={{ overflow: 'hidden', overflowAnchor: 'none', minHeight: '2.25rem', ...style }}
      {...rest}
    />
  )
})

export default AutoTextarea
