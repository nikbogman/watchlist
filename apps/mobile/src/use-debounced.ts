import { useEffect, useState } from 'react'

/** The value once it has stopped changing for 300ms: waits for a pause in typing before asking the server. */
export function useDebounced<T>(value: T) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 300)
    return () => clearTimeout(id)
  }, [value])
  return debounced
}
