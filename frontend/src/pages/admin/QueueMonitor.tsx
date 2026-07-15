import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { RefreshCw, Info } from 'lucide-react'
import { adminGet, AdminApiError } from '@/lib/adminApi'

interface QueueJob {
  id: string
  task: string
  payload: string | null
  status: 'running' | 'completed' | 'failed'
  retries: number
  started_at: string
  finished_at: string | null
  error: string | null
}

export default function AdminQueueMonitor() {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await adminGet<QueueJob[]>('/queue')
      setJobs(rows)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load queue jobs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const runningCount = jobs.filter(j => j.status === 'running').length
  const completedCount = jobs.filter(j => j.status === 'completed').length
  const failedCount = jobs.filter(j => j.status === 'failed').length

  const formatTimestamp = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
  }

  return (
    <>
      <Helmet><title>Background Jobs Monitor — LeadPilot Admin</title></Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Background Jobs & Queue Monitor</h1>
            <p className="text-slate-500 text-sm mt-1">Reads from the ai_job_log table — real infrastructure, populated only by jobs that are actually logged.</p>
          </div>
          <button onClick={load} disabled={loading} className="py-2 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-[11px] leading-relaxed">
            This codebase has no background job queue (no Celery/Redis/RQ) — creative generation, campaign
            publishing, and knowledge base processing currently run synchronously inside each request, in
            their existing service modules. This page is real (not mocked) but will show "no jobs logged
            yet" until a producer starts writing to <code>ai_job_log</code> — see the completion report for
            what that would require.
          </p>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jobs Running</span>
            <span className="text-2xl font-bold text-blue-600 block mt-1">{runningCount}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jobs Completed</span>
            <span className="text-2xl font-bold text-emerald-600 block mt-1">{completedCount}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Jobs Failed</span>
            <span className="text-2xl font-bold text-red-500 block mt-1">{failedCount}</span>
          </div>
        </div>

        {/* Queue Ledger */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Queue Execution Log</span>
            <span className="text-[10px] text-slate-400 font-semibold">{jobs.length} job{jobs.length === 1 ? '' : 's'} logged</span>
          </div>

          <div className="divide-y divide-slate-100">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No jobs logged yet.</div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-50/20 transition-all">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400 font-mono font-semibold">#{job.id.slice(0, 8)}</span>
                      <span className="text-sm font-semibold text-slate-800">{job.task}</span>
                    </div>
                    {job.payload && <p className="text-xs text-slate-500 font-medium truncate">{job.payload}</p>}
                    <p className="text-[10px] text-slate-400">Started: {formatTimestamp(job.started_at)} &middot; Retries: {job.retries}</p>
                    {job.error && <p className="text-[10px] text-red-500">{job.error}</p>}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 md:self-center self-end">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                      job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      job.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {job.status}
                    </span>
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
