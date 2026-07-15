import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { adminGet, AdminApiError } from '@/lib/adminApi'

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded'
  latency_ms: number
  detail: string
}

export default function AdminSystemHealth() {
  const [checking, setChecking] = useState(false)
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const runChecks = async () => {
    setChecking(true)
    setError(null)
    try {
      const result = await adminGet<{ checks: HealthCheck[] }>('/system-health')
      setChecks(result.checks)
      setLastChecked(new Date())
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to run system health checks.')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { runChecks() }, [])

  const allHealthy = checks.length > 0 && checks.every(c => c.status === 'healthy')
  const degradedCount = checks.filter(c => c.status === 'degraded').length

  return (
    <>
      <Helmet><title>System Health Status — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">System Integration Health</h1>
            <p className="text-slate-500 text-sm mt-1">Live status checks for the backend server, database, LLM provider, Meta/WhatsApp config, and local storage — probed on every load, not cached fake data.</p>
          </div>

          <button
            onClick={runChecks}
            disabled={checking}
            className="py-2 px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 self-start sm:self-center"
          >
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Diagnosing...' : 'Refresh Health Checks'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Diagnostic Checklist */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Services Integrations Ledger</span>
            {checks.length > 0 && (
              <span className={`text-[10px] font-semibold flex items-center gap-1 ${allHealthy ? 'text-emerald-600' : 'text-amber-600'}`}>
                {allHealthy ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {allHealthy ? 'All integrations operating normally' : `${degradedCount} integration${degradedCount === 1 ? '' : 's'} need attention`}
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {checks.length === 0 && !checking ? (
              <div className="p-8 text-center text-sm text-slate-400">No checks run yet.</div>
            ) : (
              checks.map((service, index) => (
                <div key={index} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/30 transition-all">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-slate-800 block">{service.name}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{service.detail}</span>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0 sm:self-center self-end">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Response Latency</span>
                      <span className="text-xs text-slate-700 font-semibold">{service.latency_ms}ms</span>
                    </div>

                    <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                      service.status === 'healthy'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {lastChecked && (
          <p className="text-[10px] text-slate-400">Last checked: {lastChecked.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        )}
      </div>
    </>
  )
}
