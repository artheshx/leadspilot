import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Megaphone, Users, CreditCard, TrendingUp,
  Plus, ArrowUpRight, Power, MessageSquare,
  Clock, CheckCircle2, XCircle, PauseCircle, RefreshCw, Sparkles, Check
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface Stats {
  activeCampaigns: number
  totalLeads: number
  totalSpent: number
  balance: number
}

type CampaignStatus = 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected'

interface Campaign {
  id: string
  name: string
  objective: string
  daily_budget: number
  status: CampaignStatus
  notes: string
  meta_campaign_id: string | null
  created_at: string
}

interface Recommendation {
  id: string
  campaign_id: string
  business_id: string
  type: string
  reasoning: string
  suggested_change: Record<string, unknown>
  confidence: string
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  created_at: string
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_review: { label: 'Pending review', color: 'text-amber-700 border-amber-200 bg-amber-50', icon: Clock },
  active: { label: 'Running', color: 'text-emerald-700 border-emerald-200 bg-emerald-50', icon: CheckCircle2 },
  paused: { label: 'Paused', color: 'text-slate-600 border-slate-200 bg-slate-100', icon: PauseCircle },
  completed: { label: 'Completed', color: 'text-blue-700 border-blue-200 bg-blue-50', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-700 border-red-200 bg-red-50', icon: XCircle },
}

export default function DashboardOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ activeCampaigns: 0, totalLeads: 0, totalSpent: 0, balance: 0 })
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])

  const fetchData = useCallback(async () => {
    if (!user) return

    // Active campaigns count
    const { count: campCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Total leads count
    const { count: leadCount } = await supabase
      .from('leads')
      .select('campaigns!inner(user_id)', { count: 'exact', head: true })
      .eq('campaigns.user_id', user.id)

    // Balance & spent
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, type, status')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')

    let balance = 0, totalSpent = 0
    txns?.forEach(t => {
      if (t.type === 'add_funds') balance += t.amount
      if (t.type === 'spend') { balance -= t.amount; totalSpent += t.amount }
    })

    // All campaigns list
    const { data: camps } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Fetch pending recommendations
    let recs: Recommendation[] = []
    try {
      const response = await fetch(`${API_BASE_URL}/monitoring/recommendations/pending?business_id=${user.id}`, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })
      if (response.ok) {
        recs = await response.json()
      }
    } catch (e) {
      console.error('Failed to fetch recommendations', e)
    }

    setStats({
      activeCampaigns: campCount ?? 0,
      totalLeads: leadCount ?? 0,
      totalSpent,
      balance,
    })
    setCampaigns((camps as Campaign[]) ?? [])
    setRecommendations(recs)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggleStatus = async (campId: string, currentStatus: CampaignStatus) => {
    if (toggling) return
    const newStatus: CampaignStatus = currentStatus === 'active' ? 'paused' : 'active'
    setToggling(campId)

    const { error } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campId)

    if (!error) {
      setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status: newStatus } : c))
      // Update active count
      setStats(prev => ({
        ...prev,
        activeCampaigns: prev.activeCampaigns + (newStatus === 'active' ? 1 : -1)
      }))
    }
    setToggling(null)
  }
  const handleDecideRecommendation = async (recId: string, decision: 'approve' | 'reject' | 'apply') => {
    try {
      const session = (await supabase.auth.getSession()).data.session
      if (!session || !user) return

      const endpoint = decision === 'apply'
        ? `${API_BASE_URL}/monitoring/recommendations/${recId}/apply`
        : `${API_BASE_URL}/monitoring/recommendations/${recId}/${decision}`

      const body = decision === 'apply'
        ? { applied_by: user.email }
        : { decided_by: user.email, reason: 'Decided via campaign monitor' }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        fetchData()
      } else {
        const body = await response.json()
        alert(body.detail ?? 'Action failed.')
      }
    } catch (e) {
      console.error(e)
    }
  }
  const statCards = [
    { label: 'Active campaigns', value: stats.activeCampaigns, icon: Megaphone, color: 'text-brand-400', bg: 'bg-brand-600/10', href: '/dashboard/monitor' },
    { label: 'Total leads', value: stats.totalLeads, icon: Users, color: 'text-green-400', bg: 'bg-green-600/10', href: '/dashboard/monitor' },
    { label: 'Total spent', value: `₹${stats.totalSpent.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-600/10', href: '/dashboard/billing' },
    { label: 'Wallet balance', value: `₹${stats.balance.toLocaleString('en-IN')}`, icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-600/10', href: '/dashboard/billing' },
  ]

  return (
    <>
      <Helmet><title>Campaign Monitor — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Campaign Monitor</h1>
            <p className="text-slate-400 text-sm mt-1">Track and toggle your Meta Ads and lead parameters in real-time.</p>
          </div>
          <Link
            to="/dashboard?action=create"
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-600/10"
          >
            <Plus size={15} />
            Ask AI to Launch Campaign
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(card => (
            <Link key={card.label} to={card.href} className="glass rounded-2xl p-5 hover:border-white/15 transition-all group relative overflow-hidden">
              <div className="absolute right-0 top-0 w-16 h-16 bg-white/[0.01] group-hover:bg-white/[0.02] transition-all rounded-bl-full" />
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', card.bg)}>
                <card.icon size={17} className={card.color} />
              </div>
              <p className="text-slate-500 text-xs mb-1">{card.label}</p>
              {loading
                ? <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
                : <p className="text-2xl font-bold text-white">{card.value}</p>
              }
              <ArrowUpRight size={14} className="text-slate-600 mt-2 group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Campaign List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white">All Campaigns</h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-32 glass rounded-2xl animate-pulse" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center border border-white/5">
              <Megaphone size={36} className="text-slate-700 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">No campaigns active</p>
              <p className="text-slate-500 text-sm mb-6">Ask the AI Marketing Employee to construct your first ad campaign campaign layout.</p>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
              >
                <MessageSquare size={14} /> Open AI Chat
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(camp => {
                const cfg = STATUS_CONFIG[camp.status] || STATUS_CONFIG.pending_review
                const StatusIcon = cfg.icon
                const canToggle = camp.status === 'active' || camp.status === 'paused'
                const campaignRec = recommendations.find(r => r.campaign_id === camp.id)

                return (
                  <div key={camp.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all shadow-sm">
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Name & metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <p className="text-slate-800 font-bold truncate text-sm">{camp.name}</p>
                          <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase', cfg.color)}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs font-medium">
                          {camp.objective} &middot; Created {new Date(camp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>

                      {/* Performance Stats (Inline) */}
                      <div className="flex items-center gap-6 text-sm flex-shrink-0 text-slate-700 font-medium border-l border-slate-100 pl-6">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Spend</span>
                          <span>₹{camp.status === 'active' ? '3,200' : '0'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">Leads</span>
                          <span>{camp.status === 'active' ? '46' : '0'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold uppercase">CPL</span>
                          <span>₹{camp.status === 'active' ? '69' : '0'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2.5 sm:self-end md:self-auto flex-shrink-0">
                        {canToggle && (
                          <button
                            onClick={() => handleToggleStatus(camp.id, camp.status)}
                            disabled={toggling === camp.id}
                            className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center border transition-all',
                              camp.status === 'active'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                            )}
                            title={camp.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                          >
                            {toggling === camp.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Power size={14} />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/dashboard?campaignId=${camp.id}`)}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition-all font-semibold"
                        >
                          <MessageSquare size={13} />
                          Open Chat
                        </button>
                      </div>
                    </div>

                    {/* Recommendation Box */}
                    {campaignRec && (
                      <div className="border-t border-slate-100 px-5 py-4 bg-blue-50/20 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Sparkles size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Recommendation ({campaignRec.type})</span>
                            <p className="text-slate-600 text-xs mt-1 leading-relaxed font-semibold">{campaignRec.reasoning}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {campaignRec.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleDecideRecommendation(campaignRec.id, 'reject')}
                                className="px-2.5 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleDecideRecommendation(campaignRec.id, 'approve')}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {campaignRec.status === 'approved' && (
                            <button
                              onClick={() => handleDecideRecommendation(campaignRec.id, 'apply')}
                              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg transition-all"
                            >
                              Apply change
                            </button>
                          )}
                          {campaignRec.status === 'applied' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold">
                              <Check size={11} /> Applied
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
