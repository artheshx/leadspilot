import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { LifeBuoy, Plus, Send, Clock, CheckCircle2, AlertCircle, X, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

type TicketStatus = 'open' | 'in_progress' | 'resolved'
type TicketPriority = 'low' | 'medium' | 'high'

interface Ticket {
  id: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  last_reply_at: string | null
}

interface Message {
  id: string
  ticket_id: string
  sender: 'user' | 'admin'
  content: string
  created_at: string
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: React.ElementType }> = {
  open: { label: 'Open', color: 'text-green-400 border-green-500/30 bg-green-500/10', icon: AlertCircle },
  in_progress: { label: 'In progress', color: 'text-brand-400 border-brand-500/30 bg-brand-500/10', icon: Clock },
  resolved: { label: 'Resolved', color: 'text-slate-400 border-white/15 bg-white/5', icon: CheckCircle2 },
}

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
}

export default function Support() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', priority: 'medium' as TicketPriority, message: '' })
  const [creating, setCreating] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchTickets = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTickets(data ?? [])
    setLoading(false)
  }, [user])

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const openTicket = async (ticket: Ticket) => {
    setActiveTicket(ticket)
    await fetchMessages(ticket.id)
  }

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket || !user) return
    setSending(true)
    await supabase.from('ticket_messages').insert({
      ticket_id: activeTicket.id,
      sender: 'user',
      content: reply.trim(),
    })
    await supabase.from('support_tickets').update({ last_reply_at: new Date().toISOString() }).eq('id', activeTicket.id)
    setReply('')
    await fetchMessages(activeTicket.id)
    setSending(false)
  }

  const validateNew = () => {
    const e: Record<string, string> = {}
    if (!newForm.title.trim()) e.title = 'Subject is required'
    if (!newForm.message.trim()) e.message = 'Message is required'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreateTicket = async () => {
    if (!validateNew() || !user) return
    setCreating(true)
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({ user_id: user.id, title: newForm.title.trim(), status: 'open', priority: newForm.priority })
      .select()
      .single()

    if (ticket) {
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender: 'user',
        content: newForm.message.trim(),
      })
    }

    setCreating(false)
    setShowNewModal(false)
    setNewForm({ title: '', priority: 'medium', message: '' })
    await fetchTickets()
    if (ticket) openTicket(ticket as Ticket)
  }

  const inputCls = (err?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    err ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
  )

  return (
    <>
      <Helmet><title>Support — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Thread view */}
        {activeTicket ? (
          <div className="flex flex-col h-[calc(100vh-12rem)]">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setActiveTicket(null)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{activeTicket.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {(() => { const cfg = STATUS_CONFIG[activeTicket.status]; const Icon = cfg.icon
                    return <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', cfg.color)}><Icon size={10}/>{cfg.label}</span>
                  })()}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 glass rounded-2xl p-4 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-sm">No messages yet</div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
                      msg.sender === 'user'
                        ? 'bg-brand-600/20 text-white rounded-br-sm'
                        : 'bg-white/5 text-slate-300 rounded-bl-sm'
                    )}>
                      <p className="leading-relaxed">{msg.content}</p>
                      <p className={cn('text-xs mt-1', msg.sender === 'user' ? 'text-brand-400/70' : 'text-slate-600')}>
                        {msg.sender === 'user' ? 'You' : 'LeadPilot team'} · {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply box */}
            {activeTicket.status !== 'resolved' && (
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type your reply…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
                  className="flex-1 bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="w-11 h-11 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Support</h1>
                <p className="text-slate-400 text-sm mt-1">Raise a ticket and our team will respond within 2 hours</p>
              </div>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
              >
                <Plus size={15} /> New ticket
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}
              </div>
            ) : tickets.length === 0 ? (
              <div className="glass rounded-2xl p-16 text-center">
                <LifeBuoy size={36} className="text-slate-700 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No tickets yet</p>
                <p className="text-slate-500 text-sm mb-6">Have a question or issue? Our team is here to help.</p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
                >
                  <Plus size={15} /> Open a ticket
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => {
                  const cfg = STATUS_CONFIG[ticket.status]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className="w-full glass rounded-xl p-5 flex items-center gap-4 text-left hover:border-white/15 transition-all"
                    >
                      <div className="w-9 h-9 bg-brand-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <LifeBuoy size={17} className="text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium truncate">{ticket.title}</p>
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0', cfg.color)}>
                            <Icon size={10} />{cfg.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs">
                          Priority: <span className={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</span> ·{' '}
                          {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* New ticket modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNewModal(false)} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">New support ticket</h2>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject *</label>
                <input type="text" placeholder="Brief description of your issue" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} className={inputCls(formErrors.title)} />
                {formErrors.title && <p className="mt-1 text-xs text-red-400">{formErrors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                <select value={newForm.priority} onChange={e => setNewForm(f => ({ ...f, priority: e.target.value as TicketPriority }))} className={cn(inputCls(), 'cursor-pointer')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High — urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Message *</label>
                <textarea rows={4} placeholder="Describe your issue in detail…" value={newForm.message} onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))} className={cn(inputCls(formErrors.message), 'resize-none')} />
                {formErrors.message && <p className="mt-1 text-xs text-red-400">{formErrors.message}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewModal(false)} className="flex-1 border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium py-3 rounded-xl transition-all">Cancel</button>
                <button onClick={handleCreateTicket} disabled={creating} className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium py-3 rounded-xl transition-all">
                  {creating ? 'Creating…' : 'Create ticket →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
