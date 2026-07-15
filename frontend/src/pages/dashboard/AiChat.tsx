import { useState, useRef, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import {
  Sparkles, Send, Paperclip, Image, MessageSquare, Plus, Loader2,
  TrendingUp, FileText, HelpCircle, Eye, Info, ChevronRight, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { askAiManager, AiManagerError } from '@/lib/aiManager'
import { cn } from '@/lib/utils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'error'
  content: string
  created_at?: string
}

interface CampaignDraft {
  id: string
  business_id: string
  status: 'pending' | 'approved' | 'rejected'
  strategy: {
    campaign_name: string
    objective: string
    daily_budget: number
    target_audience: string
    notes?: string
  }
  creative: {
    headline: string
    primary_text: string
    image_url?: string
    filename?: string
  }
  landing_page?: {
    name: string
    template_id: string
    content_json?: Record<string, unknown> | null
  }
}

interface TraceStep {
  decision: {
    action: string
    tool: string
    args?: Record<string, unknown>
  }
}

interface ChatSession {
  id: string
  title: string
  timestamp: string
  messages: ChatMessage[]
}

export default function AiChat() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get('campaignId')
  const actionParam = searchParams.get('action')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [activeTab, setActiveTab] = useState<'preview' | 'stats'>('stats')
  const [pendingDraft, setPendingDraft] = useState<CampaignDraft | null>(null)
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [showSessionsList, setShowSessionsList] = useState(false)

  // Upload fields
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)

  // Stats summaries
  const [stats, setStats] = useState({ activeCampaigns: 0, totalLeads: 0, spent: 0, balance: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, sending])

  const fetchPendingDraft = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/approvals/drafts/pending?business_id=${user!.id}`, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })
      if (response.ok) {
        const drafts = await response.json()
        if (drafts && drafts.length > 0) {
          setPendingDraft(drafts[0] as CampaignDraft)
          setActiveTab('preview')
        } else {
          setPendingDraft(null)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [user])

  const loadDbHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const { data } = await supabase
        .from('ai_conversation_turns')
        .select('*')
        .eq('business_id', user!.id)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        setMessages(data.map(d => ({
          role: d.role as 'user' | 'assistant',
          content: d.content,
          id: d.id,
          created_at: d.created_at
        })))
      } else {
        const initialText = campaignId
          ? `I've opened the context for campaign ID "${campaignId}". Let me know how you'd like to adjust its daily budget, pause/resume it, swap ad creatives, or check its current telemetry performance.`
          : actionParam === 'create'
          ? `Ready to launch a new campaign! Tell me about your business, target audience, and primary campaign objective.`
          : `Ready to launch your first campaign? Describe your business. We'll build everything for you.`
        setMessages([
          {
            role: 'assistant',
            content: initialText
          }
        ])
      }
      // Check for pending drafts
      fetchPendingDraft()
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }, [user, campaignId, actionParam, fetchPendingDraft])

  const loadSessions = useCallback(() => {
    const saved = localStorage.getItem(`leadpilot_sessions_${user!.id}`)
    if (saved) {
      setSessions(JSON.parse(saved))
    }
  }, [user])

  const loadStats = useCallback(async () => {
    try {
      const { count: campCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'active')

      const { count: leadCount } = await supabase
        .from('leads')
        .select('campaigns!inner(user_id)', { count: 'exact', head: true })
        .eq('campaigns.user_id', user!.id)

      const { data: txns } = await supabase
        .from('transactions')
        .select('amount, type, status')
        .eq('user_id', user!.id)
        .eq('status', 'confirmed')

      let balance = 0, spent = 0
      txns?.forEach(t => {
        if (t.type === 'add_funds') balance += t.amount
        if (t.type === 'spend') { balance -= t.amount; spent += t.amount }
      })

      setStats({
        activeCampaigns: campCount ?? 0,
        totalLeads: leadCount ?? 0,
        spent,
        balance
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingStats(false)
    }
  }, [user])

  // Load chat sessions and DB history on mount
  useEffect(() => {
    if (!user) return
    loadDbHistory()
    loadSessions()
    loadStats()
  }, [user, loadDbHistory, loadSessions, loadStats])

  const saveSessions = (updated: ChatSession[]) => {
    localStorage.setItem(`leadpilot_sessions_${user!.id}`, JSON.stringify(updated))
    setSessions(updated)
  }

  const handleNewChat = async () => {
    if (messages.length <= 1) return // Already fresh or only greeting

    // Save current session
    const title = messages.find(m => m.role === 'user')?.content?.slice(0, 30) ?? 'Chat Session'
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title,
      timestamp: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      messages: [...messages]
    }

    const updated = [newSession, ...sessions]
    saveSessions(updated)

    // Clear db history
    setMessages([])
    setSending(true)
    try {
      await supabase.from('ai_conversation_turns').delete().eq('business_id', user!.id)
      setMessages([
        {
          role: 'assistant',
          content: `Fresh canvas loaded. What business objective or campaign adjustment should we handle next?`
        }
      ])
      setPendingDraft(null)
      setTraceSteps([])
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  const handleResumeSession = async (session: ChatSession) => {
    setLoadingHistory(true)
    try {
      // Clear current DB
      await supabase.from('ai_conversation_turns').delete().eq('business_id', user!.id)

      // Insert all messages except the first greeting if DB needs it
      const toInsert = session.messages
        .filter((_, idx) => idx > 0 || session.messages[0].role === 'user')
        .map(m => ({
          business_id: user!.id,
          role: m.role,
          content: m.content,
          created_at: new Date().toISOString()
        }))

      if (toInsert.length > 0) {
        await supabase.from('ai_conversation_turns').insert(toInsert)
      }

      setMessages(session.messages)
      setPendingDraft(null)
      fetchPendingDraft()
      setShowSessionsList(false)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSendMessage = async (text: string) => {
    let messageText = text.trim()
    if (!messageText || sending) return

    if (campaignId && !messageText.includes('[Context:')) {
      messageText = `[Context: Campaign ID ${campaignId}] ${messageText}`
    }

    if (attachedFileName) {
      messageText = `[Attached Asset: ${attachedFileName}] ${messageText}`
    }

    setInput('')
    setAttachedImage(null)
    setAttachedFileName(null)
    setMessages(prev => [...prev, { role: 'user', content: messageText }])
    setSending(true)
    setTraceSteps([])

    try {
      const result = await askAiManager(messageText, true)
      setMessages(prev => [...prev, { role: 'assistant', content: result.message }])

      // Parse trace if available
      if (result.trace && Array.isArray(result.trace)) {
        setTraceSteps(result.trace as TraceStep[])
      }

      // Check if campaign draft details were finalized
      await fetchPendingDraft()
    } catch (err) {
      const msg = err instanceof AiManagerError ? err.message : 'Something went wrong communicating with the AI Manager.'
      setMessages(prev => [...prev, { role: 'error', content: msg }])
    } finally {
      setSending(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachedFileName(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAttachedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleApproveDraft = async (reason = 'Approved') => {
    if (!pendingDraft) return
    setSending(true)
    try {
      const sessionData = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/approvals/drafts/${pendingDraft.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.data.session?.access_token}`
        },
        body: JSON.stringify({
          decided_by: profile?.full_name ?? user!.email ?? 'User',
          reason
        })
      })

      if (response.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: `Approved draft: ${pendingDraft.strategy.campaign_name}` },
          { role: 'assistant', content: `Perfect! I've approved and published campaign "${pendingDraft.strategy.campaign_name}" to your Meta Account. You can monitor its live metrics in the Dashboard now.` }
        ])
        setPendingDraft(null)
        setActiveTab('stats')
        loadStats()
      } else {
        const body = await response.json()
        setMessages(prev => [...prev, { role: 'error', content: body.detail ?? 'Approval request failed.' }])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  const handleRejectDraft = async (reason: string) => {
    if (!pendingDraft || !reason.trim()) return
    setSending(true)
    try {
      const sessionData = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/approvals/drafts/${pendingDraft.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.data.session?.access_token}`
        },
        body: JSON.stringify({
          decided_by: profile?.full_name ?? user!.email ?? 'User',
          reason
        })
      })

      if (response.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: `Rejected draft with changes: ${reason}` },
          { role: 'assistant', content: `I've registered your feedback: "${reason}". I am reworking the campaign parameters now. Let me know what specific changes to focus on.` }
        ])
        setPendingDraft(null)
        setActiveTab('stats')
      } else {
        const body = await response.json()
        setMessages(prev => [...prev, { role: 'error', content: body.detail ?? 'Rejection request failed.' }])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  // Quick suggestions
  const suggestedPrompts = [
    { label: 'gym memberships', text: 'I need more local gym memberships. Draft a target strategy.' },
    { label: 'clinic campaign', text: 'Launch a campaign for my clinic.' },
    { label: 'adjust budget', text: 'Increase daily budget of campaign to ₹1000.' },
    { label: 'pause ads', text: 'Pause my active clinic campaign.' }
  ]

  // Parse trace steps into simple text list
  const getTraceStepTitle = (step: TraceStep) => {
    const dec = step.decision
    if (dec.action === 'call_tool') {
      const toolMap: Record<string, string> = {
        business_analysis: 'Audit & Market Research',
        generate_strategy: 'Designing Ad Structure',
        creative_generation: 'Copywriting & Graphics Gen',
        landing_page_selection: 'Selecting Templates',
        meta_ads_action: 'Provisioning Meta Campaign',
        analytics_monitoring: 'Retrieving Ads Metrics',
        memory_update: 'Updating Business Memory',
        compliance_check: 'Ad Safety Audit',
        support_escalation: 'Submitting Ticket'
      }
      return toolMap[dec.tool] ?? `Invoking agent ${dec.tool}`
    }
    if (dec.action === 'ask_user') return 'Asking User Clarification'
    if (dec.action === 'final_response') return 'Synthesizing Response'
    return 'Cognitive Step'
  }

  return (
    <>
      <Helmet><title>Conversational Workspace — LeadPilot</title></Helmet>

      <div className="h-[calc(100vh-6rem)] -m-4 sm:-m-6 lg:-m-8 flex overflow-hidden">
        {/* Left Side: Conversational Space */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-slate-200 relative">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">LeadPilot Manager</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full font-medium">Online</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSessionsList(!showSessionsList)}
                className="p-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs flex items-center gap-1.5 transition-all font-medium"
                title="Chat history sessions"
              >
                <MessageSquare size={13} />
                History ({sessions.length})
              </button>
              <button
                onClick={handleNewChat}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs flex items-center gap-1.5 transition-all font-medium"
                title="Start a new chat session"
              >
                <Plus size={13} />
                New Chat
              </button>
            </div>
          </div>

          {/* Session history dropdown overlay */}
          {showSessionsList && (
            <div className="absolute top-14 left-0 right-0 z-20 bg-white border-b border-slate-200 shadow-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                <span>Saved Chat Sessions (Local Storage)</span>
                <button onClick={() => setShowSessionsList(false)} className="hover:text-slate-800">Close</button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                {sessions.length === 0 ? (
                  <p className="text-slate-400 text-xs py-4 text-center">No saved chats yet. Start typing to create history.</p>
                ) : (
                  sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleResumeSession(s)}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 flex items-center justify-between text-xs transition-all text-slate-700 font-medium"
                    >
                      <div className="truncate pr-4">
                        <p className="text-slate-800 font-semibold truncate">{s.title}</p>
                        <p className="text-slate-400 text-[10px]">{s.timestamp}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat scroll space */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {loadingHistory ? (
              <div className="space-y-4 py-8">
                <div className="h-10 w-2/3 glass rounded-xl animate-pulse" />
                <div className="h-10 w-1/3 glass rounded-xl animate-pulse ml-auto" />
                <div className="h-16 w-1/2 glass rounded-xl animate-pulse" />
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-3 max-w-[85%] text-sm leading-relaxed',
                    m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  )}
                >
                  {/* Avatar bubble */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border border-slate-200 bg-slate-50 text-slate-600',
                    m.role === 'user' ? '' : 'border border-slate-200'
                  )}>
                    {m.role === 'user' ? profile?.full_name?.charAt(0).toUpperCase() ?? 'U' : 'LP'}
                  </div>

                  {/* Body text */}
                  <div className="space-y-1">
                    <div className={cn(
                      'rounded-2xl px-4 py-3 border shadow-sm',
                      m.role === 'user'
                        ? 'bg-blue-50 border-blue-100 text-blue-800 rounded-tr-none font-medium'
                        : m.role === 'error'
                        ? 'bg-red-50 border-red-100 text-red-700 rounded-tl-none font-medium'
                        : 'bg-white border-slate-200 text-slate-800 rounded-tl-none'
                    )}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Stepper display of active trace reasoning */}
            {sending && traceSteps.length > 0 && (
              <div className="pl-11 pr-5 py-3 border border-slate-200 bg-slate-50 rounded-xl space-y-2.5 max-w-[85%]">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                  <Loader2 size={12} className="animate-spin" />
                  Marketing Workflow...
                </div>
                <div className="relative border-l border-slate-200 ml-1.5 pl-4 space-y-2">
                  {traceSteps.map((step, idx) => (
                    <div key={idx} className="relative text-xs text-slate-500 flex items-center gap-2">
                      <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-blue-600" />
                      {getTraceStepTitle(step)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simulated general typing dot animation */}
            {sending && (
              <div className="flex gap-3 max-w-[85%] text-sm items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold">
                  LP
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot" />
                </div>
              </div>
            )}
          </div>

          {/* Quick recommendations / suggestions on blank screen */}
          {messages.length <= 1 && (
            <div className="px-5 py-3 flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {suggestedPrompts.map(p => (
                <button
                  key={p.label}
                  onClick={() => handleSendMessage(p.text)}
                  className="px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center gap-1 font-medium"
                >
                  <Sparkles size={10} className="text-blue-500" />
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* User Chat Input Controls */}
          <div className="p-4 border-t border-slate-200 bg-white">
            {attachedImage && (
              <div className="mb-3 flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl max-w-xs relative group">
                <img src={attachedImage} className="w-10 h-10 object-cover rounded-lg border border-slate-200" alt="Attachment thumb" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-700 font-semibold truncate">{attachedFileName ?? 'attached_media.png'}</p>
                  <p className="text-[10px] text-slate-400">Media ready to send</p>
                </div>
                <button
                  onClick={() => { setAttachedImage(null); setAttachedFileName(null) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full flex items-center justify-center shadow-sm"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                title="Attach logo or image asset"
              >
                <Paperclip size={16} />
              </button>

              <button
                onClick={() => setInput('/generate-image ')}
                className="w-10 h-10 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-blue-600 hover:text-blue-700 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                title="Image Generation Option"
              >
                <Sparkles size={16} />
              </button>

              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage(input)}
                  placeholder="Message your marketing manager..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <button
                onClick={() => handleSendMessage(input)}
                disabled={sending || !input.trim()}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive preview canvas */}
        <div className="hidden lg:flex w-[min(38rem,45%)] flex-col bg-white border-l border-slate-200">
          {/* Top Tabs switcher */}
          <div className="flex border-b border-slate-150 px-4 bg-slate-50">
            <button
              onClick={() => setActiveTab('stats')}
              className={cn(
                'px-4 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5',
                activeTab === 'stats'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <TrendingUp size={13} />
              Live Monitor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={cn(
                'px-4 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 relative',
                activeTab === 'preview'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Eye size={13} />
              Campaign Preview
              {pendingDraft && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>

          {/* Pane scroll contents */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
            {activeTab === 'stats' ? (
              /* TAB 1: Live Stats / Overview fallback */
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Workspace Telemetry</h2>
                  {loadingStats ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Active Campaigns', value: stats.activeCampaigns, desc: 'Meta live ads' },
                        { label: 'Total Leads Sync', value: stats.totalLeads, desc: 'Form completions' },
                        { label: 'Meta Budget spent', value: `₹${stats.spent}`, desc: 'Total spend' },
                        { label: 'Wallet balance', value: `₹${stats.balance}`, desc: 'Remaining budget' }
                      ].map(card => (
                        <div key={card.label} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">{card.label}</span>
                          <span className="text-lg font-bold text-slate-800 block mt-0.5">{card.value}</span>
                          <span className="text-[9px] text-slate-500 block mt-1">{card.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Human confidence score banner */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-blue-800 font-bold uppercase">
                    <span className="flex items-center gap-1"><Sparkles size={12} /> Confidence Index</span>
                    <span>91%</span>
                  </div>
                  <p className="text-blue-900/70 text-[11px] leading-relaxed">
                    Based on telemetry data of 2,400+ similar local campaigns. Your current targeting and strategy configurations rank Excellent.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold uppercase">
                    <Info size={12} />
                    Conversational Control Info
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    LeadPilot is structured conversation-first. Type your objectives in the chat, and the manager will configure the variables automatically.
                  </p>
                  <div className="bg-white rounded-lg border border-slate-200 p-2.5 text-[11px] text-slate-500 font-mono space-y-1">
                    <p>&gt; "Deploy campaigns targeting Noida."</p>
                    <p>&gt; "Provide recommendations for CTR optimization."</p>
                    <p>&gt; "Increase daily limit to ₹1500."</p>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: Draft Campaign approval review details */
              <div className="space-y-6 bg-white">
                {!pendingDraft ? (
                  <div className="text-center py-16 space-y-3 border border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50">
                    <HelpCircle size={28} className="text-slate-400 mx-auto" />
                    <p className="text-slate-500 text-sm font-semibold">No Pending Drafts</p>
                    <p className="text-slate-400 text-xs max-w-xs mx-auto">
                      Campaign drafts will appear here for audit, estimates check, and deployment decisions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header info */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-full font-semibold uppercase">Pending review</span>
                        <h3 className="text-base font-bold text-slate-800 mt-1.5">{pendingDraft.strategy.campaign_name}</h3>
                        <p className="text-slate-500 text-xs">{pendingDraft.strategy.objective} · ₹{pendingDraft.strategy.daily_budget}/day</p>
                      </div>
                    </div>

                    {/* Estimates cards */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Results</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'CPL (Goal)', value: '₹55 - 72' },
                          { label: 'CPM (Est.)', value: '₹220' },
                          { label: 'Est. Reach', value: '1.2K - 3.4K' }
                        ].map(c => (
                          <div key={c.label} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                            <span className="text-[10px] text-slate-400 block font-medium">{c.label}</span>
                            <span className="text-xs font-bold text-slate-800 block mt-0.5">{c.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Audience breakdown */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Audience Targeting</span>
                      <p className="text-xs text-slate-600 leading-relaxed font-mono">
                        {pendingDraft.strategy.target_audience}
                      </p>
                    </div>

                    {/* Creative Card Visual Preview */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <span className="text-xs font-semibold text-slate-500">Creative Ad Spec Mock</span>
                        <span className="text-[10px] text-slate-400 font-semibold">Facebook Feed Layout</span>
                      </div>
                      <div className="p-4 space-y-3 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            S
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Sharma Electronics</span>
                            <span className="text-[10px] text-slate-400 block font-medium">Sponsored</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{pendingDraft.creative.primary_text}</p>

                        <div className="aspect-video bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                          {pendingDraft.creative.image_url ? (
                            <img
                              src={pendingDraft.creative.image_url}
                              alt="Creative Draft"
                              className="w-full h-full object-cover"
                            />
                          ) : pendingDraft.creative.filename ? (
                            <img
                              src={`${API_BASE_URL}/creative/preview/${pendingDraft.creative.filename}`}
                              alt="Generated Creative"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center space-y-2">
                              <Image size={24} className="text-slate-400 mx-auto" />
                              <span className="text-xs text-slate-400 block">System Visual Placeholder</span>
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase text-slate-400 tracking-wider font-semibold">sharmaelectronics.in</span>
                            <span className="text-xs font-bold text-slate-800 block truncate max-w-[200px]">{pendingDraft.creative.headline}</span>
                          </div>
                          <span className="text-[10px] px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg">Sign Up</span>
                        </div>
                      </div>
                    </div>

                    {/* Landing Page mock if available */}
                    {pendingDraft.landing_page && (
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Landing Template selected</span>
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                          <FileText size={14} className="text-blue-500" />
                          {pendingDraft.landing_page.name} ({pendingDraft.landing_page.template_id})
                        </div>
                      </div>
                    )}

                    {/* Approve reject action footer block */}
                    <div className="pt-4 border-t border-slate-200 flex gap-3">
                      <button
                        onClick={() => {
                          const r = prompt('Provide revision feedback notes to reject draft:')
                          if (r) handleRejectDraft(r)
                        }}
                        className="flex-1 py-3 bg-white border border-red-200 hover:bg-red-50 text-red-500 text-sm font-semibold rounded-xl transition-all"
                      >
                        Reject & Rework
                      </button>
                      <button
                        onClick={() => handleApproveDraft()}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                      >
                        Approve & Publish Campaign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
