import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, XCircle, CreditCard, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type TxnStatus = 'pending' | 'confirmed' | 'failed'
type TxnType = 'add_funds' | 'spend'

interface AdminTransaction {
  id: string
  amount: number
  type: TxnType
  status: TxnStatus
  note: string | null
  created_at: string
  user_name: string
  user_email: string
  user_phone: string
}

type TransactionRow = Omit<AdminTransaction, 'user_name' | 'user_email' | 'user_phone'> & {
  profiles?: {
    full_name: string | null
    email: string | null
    phone: string | null
  } | null
}

const STATUS_CONFIG: Record<TxnStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  confirmed: { label: 'Confirmed', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  failed: { label: 'Failed', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
}

export default function AdminBilling() {
  const [txns, setTxns] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<TxnStatus | 'all'>('pending')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchTxns = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, profiles!inner(full_name, email, phone)')
      .order('created_at', { ascending: false })
      .limit(200)

    setTxns(((data ?? []) as TransactionRow[]).map(t => ({
      ...t,
      user_name: t.profiles?.full_name ?? '—',
      user_email: t.profiles?.email ?? '—',
      user_phone: t.profiles?.phone ?? '—',
    })))
    setLoading(false)
  }

  useEffect(() => { fetchTxns() }, [])

  const updateStatus = async (id: string, status: TxnStatus) => {
    setUpdating(id)
    await supabase.from('transactions').update({ status }).eq('id', id)
    await fetchTxns()
    setUpdating(null)
  }

  const filtered = txns.filter(t => filter === 'all' || t.status === filter)

  // Platform billing summary
  const totalCollected = txns.filter(t => t.status === 'confirmed' && t.type === 'add_funds').reduce((a, t) => a + t.amount, 0)
  const totalPending = txns.filter(t => t.status === 'pending' && t.type === 'add_funds').reduce((a, t) => a + t.amount, 0)
  const totalSpent = txns.filter(t => t.status === 'confirmed' && t.type === 'spend').reduce((a, t) => a + t.amount, 0)

  return (
    <>
      <Helmet><title>Billing — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing</h1>
          <p className="text-slate-400 text-sm mt-1">Confirm or reject client fund requests</p>
        </div>

        {/* Summary cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Total collected', value: `₹${totalCollected.toLocaleString('en-IN')}`, color: 'text-green-400' },
            { label: 'Pending confirmation', value: `₹${totalPending.toLocaleString('en-IN')}`, color: 'text-amber-400' },
            { label: 'Total ad spend', value: `₹${totalSpent.toLocaleString('en-IN')}`, color: 'text-brand-400' },
          ].map(card => (
            <div key={card.label} className="glass rounded-xl p-5">
              <p className="text-slate-500 text-xs mb-1">{card.label}</p>
              <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['pending', 'confirmed', 'failed', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-4 py-2 text-sm rounded-xl transition-all capitalize',
                filter === s ? 'bg-brand-600 text-white' : 'glass text-slate-400 hover:text-white'
              )}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              {s === 'pending' && txns.filter(t => t.status === 'pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-dark-950 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {txns.filter(t => t.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transactions */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <CreditCard size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No transactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(txn => {
              const isCredit = txn.type === 'add_funds'
              const cfg = STATUS_CONFIG[txn.status]
              const isUpdating = updating === txn.id
              return (
                <div key={txn.id} className="glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isCredit ? 'bg-green-600/10' : 'bg-red-600/10')}>
                    {isCredit
                      ? <ArrowDownCircle size={20} className="text-green-400" />
                      : <ArrowUpCircle size={20} className="text-red-400" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-white font-semibold">
                        {isCredit ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                      </p>
                      <span className={cn('text-xs px-2.5 py-0.5 rounded-full border', cfg.color)}>{cfg.label}</span>
                    </div>
                    <p className="text-slate-400 text-sm">{txn.user_name} · {txn.user_phone}</p>
                    <p className="text-slate-600 text-xs">
                      {txn.user_email} · {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {txn.note && <p className="text-slate-600 text-xs mt-1 truncate">{txn.note}</p>}
                  </div>

                  {txn.status === 'pending' && isCredit && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateStatus(txn.id, 'confirmed')}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/30 hover:bg-green-500/10 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} />
                        {isUpdating ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => updateStatus(txn.id, 'failed')}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        {isUpdating ? '…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
