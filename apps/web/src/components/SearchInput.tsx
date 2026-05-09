// apps/web/src/components/SearchInput.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface SearchInputProps {
  initialValue?: string
  placeholder?: string
  paramName?: string
  otherParams?: Record<string, string>
}

export function SearchInput({
  initialValue = '',
  placeholder = 'Search...',
  paramName = 'q',
  otherParams = {},
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue)
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(otherParams)
      if (value) params.set(paramName, value)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    }, 300)
    return () => clearTimeout(timer.current)
  // otherParams object identity is stable when built from searchParams in the server component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pathname, paramName, router])

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 pr-7 w-52"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors text-base leading-none"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
