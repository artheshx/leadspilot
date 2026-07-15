import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { askAiManager, AiManagerError } from '@/lib/aiManager'

interface ChatMessage {
  role: 'user' | 'assistant' | 'error'
  content: string
}

/**
 * The AI Manager, available from anywhere in the dashboard. Every AI action
 * (strategy, creative, landing page, campaign recommendations, support,
 * knowledge base questions, ...) is just a message typed here — the AI
 * Manager backend decides which tool to run. This is intentionally the
 * ONLY chat/AI surface in the dashboard so there's a single, consistent
 * place the frontend talks to the AI Manager from.
 */
export default function AiManagerWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm your LeadPilot AI Manager. Ask me to build a strategy, write ad creative, draft a landing page, check campaign performance, or anything else — I'll handle it." },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setSending(true)
    try {
      const result = await askAiManager(text)
      setMessages(prev => [...prev, { role: 'assistant', content: result.message }])
    } catch (err) {
      const msg = err instanceof AiManagerError ? err.message : 'Something went wrong reaching the AI Manager.'
      setMessages(prev => [...prev, { role: 'error', content: msg }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/30 flex items-center justify-center text-white transition-all"
        aria-label="Open AI Manager"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))] h-[32rem] max-h-[70vh] glass rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <Sparkles size={16} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">AI Manager</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'text-sm rounded-xl px-3 py-2 max-w-[85%]',
                  m.role === 'user'
                    ? 'bg-brand-600 text-white ml-auto'
                    : m.role === 'error'
                    ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                    : 'bg-white/5 text-slate-200'
                )}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Loader2 size={13} className="animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/5 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask the AI Manager anything…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-brand-500/50"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 flex items-center justify-center text-white transition-all flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
