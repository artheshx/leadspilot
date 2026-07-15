import { useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (val: string) => void
  error?: string
  disabled?: boolean
}

export default function OtpInput({ value, onChange, error, disabled }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').split('').slice(0, 6)

  const focusNext = (index: number) => {
    inputs.current[Math.min(index + 1, 5)]?.focus()
  }
  const focusPrev = (index: number) => {
    inputs.current[Math.max(index - 1, 0)]?.focus()
  }

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return
    const next = digits.map((d, i) => (i === index ? char : d))
    onChange(next.join('').replace(/\s/g, ''))
    if (char) focusNext(index)
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') focusPrev(index)
      const next = digits.map((d, i) => (i === index ? ' ' : d))
      onChange(next.join('').replace(/\s/g, ''))
    } else if (e.key === 'ArrowLeft') focusPrev(index)
    else if (e.key === 'ArrowRight') focusNext(index)
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    inputs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div>
      <div className="flex gap-2.5 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i]?.trim() ?? ''}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'w-11 h-12 text-center text-lg font-bold rounded-xl border bg-dark-800 text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500',
              error ? 'border-red-500/50' : 'border-white/10 focus:border-brand-500',
              disabled && 'opacity-50 cursor-not-allowed',
              digits[i]?.trim() && 'border-brand-500/40 bg-brand-600/10'
            )}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}
