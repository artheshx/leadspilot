import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Shield, ShieldOff, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

interface UserWithMeta extends Profile {
  campaign_count: number
  lead_count: number
  metrics_visible: string[]
}

const ALL_METRICS = ['spend', 'impressions', 'clicks', 'leads', 'cpl', 'ctr']

export default function AdminUsers() {
  const [users, setUsers] = useState<UserWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!profiles) { setLoading(false); return }

    // Get campaign counts per user
    const { data: campCounts } = await supabase
      .from('campaigns')
      .select('user_id')

    // Get metric visibility settings
    const { data: metricSettings } = await supabase
      .from('user_metric_visibility')
      .select('*')

    const campMap: Record<string, number> = {}
    campCounts?.forEach((c: { user_id: string }) => {
      campMap[c.user_id] = (campMap[c.user_id] ?? 0) + 1
    })

    const metricMap: Record<string, string[]> = {}
    metricSettings?.forEach((m: { user_id: string; metric: string }) => {
      if (!metricMap[m.user_id]) metricMap[m.user_id] = []
      metricMap[m.user_id].push(m.metric)
    })

    setUsers(profiles.map((p: Profile) => ({
      ...p,
      campaign_count: campMap[p.id] ?? 0,
      lead_count: 0,
      metrics_visible: metricMap[p.id] ?? ALL_METRICS,
    })))
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const toggleRole = async (user: UserWithMeta) => {
    setToggling(user.id)
    const newRole = user.role === 'admin' ? 'client' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    await fetchUsers()
    setToggling(null)
  }

  const toggleMetric = async (userId: string, metric: string, currentVisible: string[]) => {
    const isOn = currentVisible.includes(metric)
    if (isOn) {
      await supabase.from('user_metric_visibility').delete().eq('user_id', userId).eq('metric', metric)
    } else {
      await supabase.from('user_metric_visibility').upsert({ user_id: userId, metric })
    }
    await fetchUsers()
  }

  const filtered = users.filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  )

  return (
    <>
      <Helmet><title>Users — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} total registered users</p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        {/* Users list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(user => (
              <div key={user.id} className="glass rounded-xl overflow-hidden">
                {/* User row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-brand-700/40 flex items-center justify-center text-brand-200 text-xs font-bold flex-shrink-0">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm">{user.full_name}</p>
                      {user.role === 'admin' && (
                        <span className="text-xs text-violet-400 border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-full">Admin</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">{user.email} · {user.phone}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                    <span>{user.campaign_count} campaigns</span>
                    <span>{new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={toggling === user.id}
                      className={cn(
                        'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all',
                        user.role === 'admin'
                          ? 'text-red-400 border border-red-500/30 hover:bg-red-500/10'
                          : 'text-violet-400 border border-violet-500/30 hover:bg-violet-500/10'
                      )}
                    >
                      {toggling === user.id ? '…' : user.role === 'admin'
                        ? <><ShieldOff size={12} /> Revoke admin</>
                        : <><Shield size={12} /> Make admin</>
                      }
                    </button>
                    <button
                      onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      {expanded === user.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded: metric visibility */}
                {expanded === user.id && (
                  <div className="border-t border-white/5 px-5 py-4 bg-dark-800/30">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Metric visibility for this user</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_METRICS.map(metric => {
                        const isOn = user.metrics_visible.includes(metric)
                        return (
                          <button
                            key={metric}
                            onClick={() => toggleMetric(user.id, metric, user.metrics_visible)}
                            className={cn(
                              'text-xs px-3 py-1.5 rounded-lg border transition-all capitalize',
                              isOn
                                ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                                : 'bg-white/3 border-white/10 text-slate-600 hover:text-slate-400'
                            )}
                          >
                            {metric.toUpperCase()}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-600 mt-2">Toggle which metrics this user can see in their campaign reports</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
