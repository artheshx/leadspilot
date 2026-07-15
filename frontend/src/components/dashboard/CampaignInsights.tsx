import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Eye, MousePointer, IndianRupee, Users, RefreshCw } from 'lucide-react'
import { getCachedInsights } from '@/lib/meta/sync'
import { cn } from '@/lib/utils'

interface Props {
  campaignId: string
  metaCampaignId: string | null
  metricsVisible?: string[]
}

interface Insights {
  impressions: number
  clicks: number
  spend: number
  reach: number
  ctr: number
  cpc: number
  leads: number
  date_start: string
  date_stop: string
  updated_at: string
}

type DatePreset = 'last_7d' | 'last_30d' | 'this_month'

const DATE_LABELS: Record<DatePreset, string> = {
  last_7d: 'Last 7 days',
  last_30d: 'Last 30 days',
  this_month: 'This month',
}

export default function CampaignInsights({ campaignId, metaCampaignId, metricsVisible }: Props) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30d')

  const visible = metricsVisible ?? ['spend', 'impressions', 'clicks', 'leads', 'cpl', 'ctr']

  const isVisible = (metric: string) => visible.includes(metric)

  const cpl = insights && insights.leads > 0
    ? insights.spend / insights.leads
    : null

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    const data = await getCachedInsights(campaignId, datePreset)
    setInsights(data)
    setLoading(false)
  }, [campaignId, datePreset])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  if (!metaCampaignId) {
    return (
      <div className="glass rounded-xl p-5 text-center">
        <TrendingUp size={24} className="text-slate-700 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">Campaign not yet linked to Meta</p>
        <p className="text-slate-600 text-xs mt-1">Metrics will appear once our team connects this campaign</p>
      </div>
    )
  }

  const metrics = [
    { key: 'spend', label: 'Spend', value: insights ? `₹${insights.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—', icon: IndianRupee, color: 'text-amber-400' },
    { key: 'impressions', label: 'Impressions', value: insights ? insights.impressions.toLocaleString('en-IN') : '—', icon: Eye, color: 'text-brand-400' },
    { key: 'clicks', label: 'Clicks', value: insights ? insights.clicks.toLocaleString('en-IN') : '—', icon: MousePointer, color: 'text-violet-400' },
    { key: 'leads', label: 'Leads', value: insights ? insights.leads.toLocaleString('en-IN') : '—', icon: Users, color: 'text-green-400' },
    { key: 'cpl', label: 'Cost per lead', value: cpl ? `₹${cpl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—', icon: TrendingUp, color: 'text-green-400' },
    { key: 'ctr', label: 'CTR', value: insights ? `${insights.ctr.toFixed(2)}%` : '—', icon: MousePointer, color: 'text-brand-400' },
  ].filter(m => isVisible(m.key))

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-400" />
          <h3 className="text-white font-semibold text-sm">Campaign metrics</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Date preset selector */}
          <div className="flex gap-1">
            {(Object.keys(DATE_LABELS) as DatePreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg transition-all',
                  datePreset === preset
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {DATE_LABELS[preset]}
              </button>
            ))}
          </div>
          <button
            onClick={fetchInsights}
            className="p-1.5 text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !insights ? (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">No data yet for this period</p>
          <p className="text-slate-600 text-xs mt-1">Data syncs every few hours from Meta</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {metrics.map(m => (
              <div key={m.key} className="bg-dark-800/60 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <m.icon size={12} className={m.color} />
                  <p className="text-slate-500 text-xs">{m.label}</p>
                </div>
                <p className="text-white font-bold text-xl">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-700 text-xs">
            Last synced: {new Date(insights.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      )}
    </div>
  )
}
