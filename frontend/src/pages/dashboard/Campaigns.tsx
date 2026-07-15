import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Megaphone, Clock, CheckCircle2, XCircle, PauseCircle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'
import CampaignInsights from '@/components/dashboard/CampaignInsights'

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

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_review: { label: 'Pending review', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: Clock },
  active: { label: 'Active', color: 'text-green-400 border-green-500/30 bg-green-500/10', icon: CheckCircle2 },
  paused: { label: 'Paused', color: 'text-slate-400 border-white/15 bg-white/5', icon: PauseCircle },
  completed: { label: 'Completed', color: 'text-brand-400 border-brand-500/30 bg-brand-500/10', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: XCircle },
}

const OBJECTIVES = ['Lead generation', 'Traffic', 'Conversions', 'Brand awareness', 'App installs', 'Store visits']

export default function Campaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', objective: '', daily_budget: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fetchCampaigns = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setCampaigns(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Campaign name is required'
    if (!form.objective) e.objective = 'Please select an objective'
    if (!form.daily_budget) e.daily_budget = 'Daily budget is required'
    else if (Number(form.daily_budget) < 500) e.daily_budget = 'Minimum daily budget is ₹500'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !user) return
    setSubmitting(true)
    const { error } = await supabase.from('campaigns').insert({
      user_id: user.id,
      name: form.name.trim(),
      objective: form.objective,
      daily_budget: Number(form.daily_budget),
      notes: form.notes.trim(),
      status: 'pending_review',
    })
    setSubmitting(false)
    if (!error) {
      setShowModal(false)
      setForm({ name: '', objective: '', daily_budget: '', notes: '' })
      fetchCampaigns()
    }
  }

  const inputCls = (err?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    err ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
  )

  return (
    <>
      <Helmet><title>Campaigns — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Campaigns</h1>
            <p className="text-slate-400 text-sm mt-1">Your Meta Ads campaigns managed by our team</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all"
          >
            <Plus size={15} />
            New campaign
          </button>
        </div>

        {/* Campaigns list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 glass rounded-2xl animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center">
            <Megaphone size={36} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">No campaigns yet</p>
            <p className="text-slate-500 text-sm mb-6">Create your first campaign brief and our team will get it live within 48 hours.</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
            >
              <Plus size={15} /> Create first campaign
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(camp => {
              const cfg = STATUS_CONFIG[camp.status]
              const StatusIcon = cfg.icon
              return (
                <div key={camp.id} className="glass rounded-2xl overflow-hidden">
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Megaphone size={18} className="text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-white font-semibold truncate">{camp.name}</p>
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border', cfg.color)}>
                          <StatusIcon size={11} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs">
                        {camp.objective} &middot; &#x20b9;{camp.daily_budget.toLocaleString('en-IN')}/day &middot;{' '}
                        {new Date(camp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {camp.notes && <p className="text-slate-600 text-xs mt-1 truncate">{camp.notes}</p>}
                    </div>
                    {camp.status === 'active' && (
                      <button
                        onClick={() => setExpanded(expanded === camp.id ? null : camp.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                      >
                        {expanded === camp.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {expanded === camp.id ? 'Hide metrics' : 'View metrics'}
                      </button>
                    )}
                  </div>
                  {expanded === camp.id && (
                    <div className="border-t border-white/5 p-5">
                      <CampaignInsights
                        campaignId={camp.id}
                        metaCampaignId={camp.meta_campaign_id}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New campaign modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">New campaign brief</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Campaign name *</label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Sale Leads"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Campaign objective *</label>
                <select
                  value={form.objective}
                  onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                  className={cn(inputCls(errors.objective), 'cursor-pointer')}
                >
                  <option value="">Select objective</option>
                  {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {errors.objective && <p className="mt-1 text-xs text-red-400">{errors.objective}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Daily budget (₹) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                  <input
                    type="number"
                    placeholder="1000"
                    min="500"
                    value={form.daily_budget}
                    onChange={e => setForm(f => ({ ...f, daily_budget: e.target.value }))}
                    className={cn(inputCls(errors.daily_budget), 'pl-8')}
                  />
                </div>
                {errors.daily_budget
                  ? <p className="mt-1 text-xs text-red-400">{errors.daily_budget}</p>
                  : <p className="mt-1 text-xs text-slate-600">Minimum ₹500/day</p>
                }
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Additional notes</label>
                <textarea
                  rows={3}
                  placeholder="Target audience, product details, special instructions…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={cn(inputCls(), 'resize-none')}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-white/10 hover:border-white/20 text-slate-300 text-sm font-medium py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium py-3 rounded-xl transition-all"
                >
                  {submitting ? 'Submitting…' : 'Submit brief →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
