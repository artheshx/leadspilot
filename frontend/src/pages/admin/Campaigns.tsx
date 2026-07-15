import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, PauseCircle, PlayCircle, Search, Megaphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type CampaignStatus = 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected'

interface AdminCampaign {
  id: string
  name: string
  objective: string
  daily_budget: number
  status: CampaignStatus
  notes: string | null
  created_at: string
  user_name: string
  user_email: string
}

type CampaignRow = Omit<AdminCampaign, 'user_name' | 'user_email'> & {
  profiles?: {
    full_name: string | null
    email: string | null
  } | null
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string }> = {
  pending_review: { label: 'Pending review', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  active: { label: 'Active', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  paused: { label: 'Paused', color: 'text-slate-400 border-white/15 bg-white/5' },
  completed: { label: 'Completed', color: 'text-brand-400 border-brand-500/30 bg-brand-500/10' },
  rejected: { label: 'Rejected', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
}

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('*, profiles!inner(full_name, email)')
      .order('created_at', { ascending: false })

    setCampaigns(((data ?? []) as CampaignRow[]).map(c => ({
      ...c,
      user_name: c.profiles?.full_name ?? '—',
      user_email: c.profiles?.email ?? '—',
    })))
    setLoading(false)
  }

  useEffect(() => { fetchCampaigns() }, [])

  const updateStatus = async (id: string, status: CampaignStatus) => {
    setUpdating(id)
    await supabase.from('campaigns').update({ status }).eq('id', id)
    await fetchCampaigns()
    setUpdating(null)
  }

  const filtered = campaigns.filter(c => {
    const matchFilter = filter === 'all' || c.status === filter
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.user_name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <>
      <Helmet><title>Campaigns — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">Review, approve, and manage all client campaigns</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search campaigns or clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending_review', 'active', 'paused', 'completed', 'rejected'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'px-3 py-2 text-xs rounded-xl transition-all',
                  filter === s ? 'bg-brand-600 text-white' : 'glass text-slate-400 hover:text-white'
                )}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Campaigns list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 glass rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Megaphone size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No campaigns found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(camp => {
              const cfg = STATUS_CONFIG[camp.status]
              const isUpdating = updating === camp.id
              return (
                <div key={camp.id} className="glass rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-white font-semibold">{camp.name}</p>
                        <span className={cn('text-xs px-2.5 py-0.5 rounded-full border', cfg.color)}>{cfg.label}</span>
                      </div>
                      <p className="text-slate-500 text-xs">
                        {camp.user_name} ({camp.user_email}) · {camp.objective} · ₹{camp.daily_budget.toLocaleString('en-IN')}/day
                      </p>
                      {camp.notes && <p className="text-slate-600 text-xs mt-1 truncate">"{camp.notes}"</p>}
                      <p className="text-slate-700 text-xs mt-1">
                        {new Date(camp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      {camp.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => updateStatus(camp.id, 'active')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/30 hover:bg-green-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            {isUpdating ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => updateStatus(camp.id, 'rejected')}
                            disabled={isUpdating}
                            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            {isUpdating ? '…' : 'Reject'}
                          </button>
                        </>
                      )}
                      {camp.status === 'active' && (
                        <button
                          onClick={() => updateStatus(camp.id, 'paused')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 text-xs text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          <PauseCircle size={12} />
                          {isUpdating ? '…' : 'Pause'}
                        </button>
                      )}
                      {camp.status === 'paused' && (
                        <button
                          onClick={() => updateStatus(camp.id, 'active')}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/30 hover:bg-green-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          <PlayCircle size={12} />
                          {isUpdating ? '…' : 'Resume'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
