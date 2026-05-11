'use client'
import { useRef, useEffect, forwardRef, useCallback } from 'react'

const AutoTextarea = forwardRef(function AutoTextarea({ value, onChange, style, ...rest }, externalRef) {
  const internalRef = useRef(null)

  const setRef = useCallback((node) => {
    internalRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef) externalRef.current = node
  }, [externalRef])

  useEffect(() => {
    const el = internalRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={onChange}
      rows={1}
      style={{ overflow: 'hidden', minHeight: '2.25rem', ...style }}
      {...rest}
    />
  )
})

export default AutoTextarea
