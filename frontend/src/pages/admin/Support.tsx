import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { LifeBuoy, Send, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type TicketStatus = 'open' | 'in_progress' | 'resolved'
type TicketPriority = 'low' | 'medium' | 'high'

interface AdminTicket {
  id: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  user_name: string
  user_email: string
  last_reply_at: string | null
}

type TicketRow = Omit<AdminTicket, 'user_name' | 'user_email'> & {
  profiles?: {
    full_name: string | null
    email: string | null
  } | null
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

export default function AdminSupport() {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<AdminTicket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const fetchTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, profiles!inner(full_name, email)')
      .order('created_at', { ascending: false })

    setTickets(((data ?? []) as TicketRow[]).map(t => ({
      ...t,
      user_name: t.profiles?.full_name ?? '—',
      user_email: t.profiles?.email ?? '—',
    })))
    setLoading(false)
  }

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }

  useEffect(() => { fetchTickets() }, [])

  const openTicket = async (ticket: AdminTicket) => {
    setActiveTicket(ticket)
    await fetchMessages(ticket.id)
    // Mark as in_progress when admin opens
    if (ticket.status === 'open') {
      await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', ticket.id)
      await fetchTickets()
    }
  }

  const handleReply = async () => {
    if (!reply.trim() || !activeTicket) return
    setSending(true)
    await supabase.from('ticket_messages').insert({
      ticket_id: activeTicket.id,
      sender: 'admin',
      content: reply.trim(),
    })
    await supabase.from('support_tickets').update({ last_reply_at: new Date().toISOString() }).eq('id', activeTicket.id)
    setReply('')
    await fetchMessages(activeTicket.id)
    setSending(false)
  }

  const updateTicketStatus = async (status: TicketStatus) => {
    if (!activeTicket) return
    setUpdatingStatus(true)
    await supabase.from('support_tickets').update({ status }).eq('id', activeTicket.id)
    setActiveTicket(prev => prev ? { ...prev, status } : null)
    await fetchTickets()
    setUpdatingStatus(false)
  }

  const filtered = tickets.filter(t => filter === 'all' || t.status === filter)

  return (
    <>
      <Helmet><title>Support — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {activeTicket ? (
          // Thread view
          <div className="flex flex-col h-[calc(100vh-12rem)]">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-3">
                <button onClick={() => { setActiveTicket(null); fetchTickets() }} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                  <ArrowLeft size={15} /> Back
                </button>
                <div>
                  <p className="text-white font-semibold">{activeTicket.title}</p>
                  <p className="text-slate-500 text-xs">{activeTicket.user_name} · {activeTicket.user_email}</p>
                </div>
              </div>

              {/* Status controls */}
              <div className="flex gap-2">
                {(['open', 'in_progress', 'resolved'] as TicketStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s]
                  return (
                    <button
                      key={s}
                      onClick={() => updateTicketStatus(s)}
                      disabled={updatingStatus || activeTicket.status === s}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-40',
                        activeTicket.status === s ? cfg.color : 'text-slate-500 border-white/10 hover:text-white hover:border-white/20'
                      )}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 glass rounded-2xl p-4 overflow-y-auto space-y-4 mb-4">
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex', msg.sender === 'admin' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
                    msg.sender === 'admin'
                      ? 'bg-violet-600/20 text-white rounded-br-sm'
                      : 'bg-white/5 text-slate-300 rounded-bl-sm'
                  )}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={cn('text-xs mt-1', msg.sender === 'admin' ? 'text-violet-400/70' : 'text-slate-600')}>
                      {msg.sender === 'admin' ? 'You (Admin)' : activeTicket.user_name} · {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply box */}
            {activeTicket.status !== 'resolved' && (
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Reply as LeadPilot team…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
                  className="flex-1 bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="w-11 h-11 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-white">Support</h1>
              <p className="text-slate-400 text-sm mt-1">Manage all client support tickets</p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
              {(['open', 'in_progress', 'resolved', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    'px-4 py-2 text-sm rounded-xl transition-all',
                    filter === s ? 'bg-brand-600 text-white' : 'glass text-slate-400 hover:text-white'
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                  {s !== 'all' && tickets.filter(t => t.status === s).length > 0 && (
                    <span className="ml-1.5 bg-white/10 text-xs px-1.5 py-0.5 rounded-full">
                      {tickets.filter(t => t.status === s).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <LifeBuoy size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-white font-semibold">No tickets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(ticket => {
                  const cfg = STATUS_CONFIG[ticket.status]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className="w-full glass rounded-xl p-5 flex items-center gap-4 text-left hover:border-white/15 transition-all"
                    >
                      <div className="w-9 h-9 bg-violet-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <LifeBuoy size={17} className="text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-medium truncate">{ticket.title}</p>
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0', cfg.color)}>
                            <Icon size={10} />{cfg.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs">
                          {ticket.user_name} · Priority: <span className={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</span> · {new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
    </>
  )
}
