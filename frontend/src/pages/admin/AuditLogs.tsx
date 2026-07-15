import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ShieldCheck, Calendar, RefreshCw } from 'lucide-react'
import { adminGet, AdminApiError } from '@/lib/adminApi'

interface AuditLog {
  id: string
  created_at: string
  actor_email: string | null
  actor_role: string | null
  action: string
  ip_address: string | null
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (q?: string) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await adminGet<AuditLog[]>(`/audit-logs${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      setLogs(rows)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Client-side filter across action + actor, on top of whatever the last
  // server query returned (server-side `q` narrows by action text only).
  const filteredLogs = logs.filter(l =>
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    (l.actor_email ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <>
      <Helmet><title>CRM Audit Logs — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">System Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-1">Chronological history of Admin CRM actions — provider/prompt/config changes, feature flag toggles, knowledge base edits. Written automatically by every mutating Admin CRM endpoint.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-xs flex-1">
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search audit actions, users..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-1.5 text-xs text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => load()} className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:text-slate-700">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                Audit Logging Active
              </div>
            </div>
          </div>

          {/* Timeline list */}
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">Loading audit logs…</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                {logs.length === 0 ? 'No admin actions logged yet — this list fills in as admins use the CRM.' : 'No matching audit logs found.'}
              </div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">{log.action}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {formatTimestamp(log.created_at)}</span>
                      <span>By: <span className="text-slate-600 font-semibold">{log.actor_email ?? 'Unknown'} {log.actor_role ? `(${log.actor_role})` : ''}</span></span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
