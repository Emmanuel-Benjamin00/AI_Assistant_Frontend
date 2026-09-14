import { useEffect, useState } from 'react'

const SLOW_REQUEST_MS = 5_000

/** True once `active` has stayed true for `delayMs` (e.g. the backend is waking up). */
export function useSlowFlag(active, delayMs = SLOW_REQUEST_MS) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setSlow(true), delayMs)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active, delayMs])
  return active && slow
}
