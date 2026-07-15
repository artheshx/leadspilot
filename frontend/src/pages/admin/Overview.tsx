import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Users, Megaphone, Globe, CreditCard, TrendingUp, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface PlatformStats {
  totalUsers: number
  totalCampaigns: number
  activeCampaigns: number
  totalLeads: number
  totalFundsCollected: number
  pendingTransactions: number
  openTickets: number
  pendingCampaigns: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0, totalCampaigns: 0, activeCampaigns: 0,
    totalLeads: 0, totalFundsCollected: 0, pendingTransactions: 0,
    openTickets: 0, pendingCampaigns: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: totalUsers },
        { count: totalCampaigns },
        { count: activeCampaigns },
        { count: totalLeads },
        { count: pendingTransactions },
        { count: openTickets },
        { count: pendingCampaigns },
        { data: txns },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('type', 'add_funds'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('transactions').select('amount').eq('status', 'confirmed').eq('type', 'add_funds'),
      ])

      const totalFundsCollected = (txns ?? []).reduce((a: number, t: { amount: number }) => a + t.amount, 0)

      setStats({
        totalUsers: totalUsers ?? 0,
        totalCampaigns: totalCampaigns ?? 0,
        activeCampaigns: activeCampaigns ?? 0,
        totalLeads: totalLeads ?? 0,
        totalFundsCollected,
        pendingTransactions: pendingTransactions ?? 0,
        openTickets: openTickets ?? 0,
        pendingCampaigns: pendingCampaigns ?? 0,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Total users', value: stats.totalUsers, icon: Users, color: 'text-brand-400', bg: 'bg-brand-600/10', href: '/admin/users' },
    { label: 'Total campaigns', value: stats.totalCampaigns, sub: `${stats.activeCampaigns} active`, icon: Megaphone, color: 'text-green-400', bg: 'bg-green-600/10', href: '/admin/campaigns' },
    { label: 'Total leads', value: stats.totalLeads, icon: Globe, color: 'text-violet-400', bg: 'bg-violet-600/10', href: '/admin/leads' },
    { label: 'Funds collected', value: `₹${stats.totalFundsCollected.toLocaleString('en-IN')}`, icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-600/10', href: '/admin/billing' },
  ]

  const alertCards = [
    { label: 'Campaigns pending review', value: stats.pendingCampaigns, href: '/admin/campaigns', urgent: stats.pendingCampaigns > 0 },
    { label: 'Fund requests pending', value: stats.pendingTransactions, href: '/admin/billing', urgent: stats.pendingTransactions > 0 },
    { label: 'Open support tickets', value: stats.openTickets, href: '/admin/support', urgent: stats.openTickets > 0 },
  ]

  return (
    <>
      <Helmet><title>Admin Overview — LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform overview</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time snapshot of LeadPilot activity</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(card => (
            <Link key={card.label} to={card.href} className="glass rounded-2xl p-5 hover:border-white/15 transition-all group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
                <card.icon size={17} className={card.color} />
              </div>
              <p className="text-slate-500 text-xs mb-1">{card.label}</p>
              {loading
                ? <div className="h-7 w-16 bg-white/5 rounded animate-pulse" />
                : <p className="text-2xl font-bold text-white">{card.value}</p>
              }
              {card.sub && <p className="text-xs text-slate-600 mt-0.5">{card.sub}</p>}
              <ArrowUpRight size={14} className="text-slate-600 mt-2 group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Action required */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-violet-400" />
            <h2 className="text-base font-semibold text-white">Action required</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {alertCards.map(card => (
              <Link
                key={card.label}
                to={card.href}
                className={`glass rounded-xl p-5 flex items-center justify-between hover:border-white/15 transition-all ${card.urgent ? 'border-amber-500/20' : ''}`}
              >
                <div>
                  <p className="text-slate-400 text-xs mb-1">{card.label}</p>
                  {loading
                    ? <div className="h-8 w-8 bg-white/5 rounded animate-pulse" />
                    : <p className={`text-3xl font-bold ${card.urgent ? 'text-amber-400' : 'text-slate-600'}`}>{card.value}</p>
                  }
                </div>
                <ArrowUpRight size={18} className={card.urgent ? 'text-amber-400' : 'text-slate-700'} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
