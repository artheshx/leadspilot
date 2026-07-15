import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CreditCard, Plus, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'

type TxnType = 'add_funds' | 'spend'
type TxnStatus = 'pending' | 'confirmed' | 'failed'

interface Transaction {
  id: string
  amount: number
  type: TxnType
  status: TxnStatus
  note: string | null
  created_at: string
}

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000]

const STATUS_CONFIG: Record<TxnStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending Approval', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: Clock },
  confirmed: { label: 'Completed', color: 'text-green-400 border-green-500/30 bg-green-500/10', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: XCircle },
}

export default function Billing() {
  const { user } = useAuth()
  const [txns, setTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [amountError, setAmountError] = useState('')
  const [activeTab, setActiveTab] = useState<'wallet' | 'transactions'>('wallet')

  const fetchTxns = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setTxns(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTxns()
  }, [fetchTxns])

  // Compute balance from confirmed txns
  const balance = txns
    .filter(t => t.status === 'confirmed')
    .reduce((acc, t) => t.type === 'add_funds' ? acc + t.amount : acc - t.amount, 0)

  const totalSpent = txns
    .filter(t => t.status === 'confirmed' && t.type === 'spend')
    .reduce((acc, t) => acc + t.amount, 0)

  const handleAddFunds = async () => {
    const amount = selectedAmount ?? Number(customAmount)
    if (!amount || amount < 500) { setAmountError('Minimum amount is ₹500'); return }
    if (amount > 500000) { setAmountError('Maximum amount is ₹5,00,000 per transaction'); return }
    if (!user) return

    setSubmitting(true)
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      amount,
      type: 'add_funds',
      status: 'pending',
      note: `UPI/Bank Topup Request — ₹${amount.toLocaleString('en-IN')}`,
    })
    setSubmitting(false)

    if (!error) {
      setShowModal(false)
      setSelectedAmount(null)
      setCustomAmount('')
      fetchTxns()
    }
  }

  const finalAmount = selectedAmount ?? (customAmount ? Number(customAmount) : null)

  return (
    <>
      <Helmet><title>Campaign Wallet & Billing — LeadPilot</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Wallet & Billing</h1>
            <p className="text-slate-400 text-sm mt-1">Audit campaign funding request flows and ledger balances.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-600/10"
          >
            <Plus size={15} /> Add Funds
          </button>
        </div>

        {/* Section subtabs */}
        <div className="flex border-b border-white/5 pb-2.5 gap-6">
          <button
            onClick={() => setActiveTab('wallet')}
            className={cn(
              'text-sm font-semibold transition-all border-b-2 pb-2',
              activeTab === 'wallet'
                ? 'border-brand-500 text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            Campaign Wallet
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={cn(
              'text-sm font-semibold transition-all border-b-2 pb-2',
              activeTab === 'transactions'
                ? 'border-brand-500 text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            Ledger & Transactions ({txns.length})
          </button>
        </div>

        {activeTab === 'wallet' ? (
          /* Tab 1: Wallet Overview */
          <div className="space-y-6">
            {/* Balance cards */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Wallet Balance', value: `₹${balance.toLocaleString('en-IN')}`, color: 'text-green-400', sub: 'Available Meta ad funds' },
                { label: 'Total spent', value: `₹${totalSpent.toLocaleString('en-IN')}`, color: 'text-brand-400', sub: 'Deducted campaign budget' },
                { label: 'Pending validation', value: `₹${txns.filter(t => t.status === 'pending' && t.type === 'add_funds').reduce((a, t) => a + t.amount, 0).toLocaleString('en-IN')}`, color: 'text-amber-400', sub: 'Awaiting admin approval' },
              ].map(card => (
                <div key={card.label} className="glass rounded-2xl p-5 border border-white/5 shadow-md">
                  <p className="text-slate-500 text-xs mb-2 font-medium uppercase">{card.label}</p>
                  <p className={cn('text-3xl font-bold mb-1.5', card.color)}>{card.value}</p>
                  <p className="text-slate-600 text-xs">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Funding request workflow visual */}
            <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
              <h2 className="text-sm font-bold text-white">Wallet Funding Workflow</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
                {[
                  { step: '1', title: 'Request Funds', desc: 'Create request payload', active: true },
                  { step: '2', title: 'Payment', desc: 'Transfer UPI / Netbank', active: true },
                  { step: '3', title: 'Pending Approval', desc: 'Admin validates UTR', active: true },
                  { step: '4', title: 'Meta Provision', desc: 'Credits Meta Balance', active: false },
                  { step: '5', title: 'Completed', desc: 'Ad campaigns launch', active: false }
                ].map((item) => (
                  <div key={item.step} className="relative flex flex-col items-center bg-dark-800/40 p-3 rounded-xl border border-white/5">
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center font-bold mb-1.5 text-xs',
                      item.active
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-white/5 text-slate-600 border border-white/5'
                    )}>
                      {item.step}
                    </span>
                    <span className="font-semibold text-white block mb-0.5">{item.title}</span>
                    <span className="text-[10px] text-slate-500 leading-tight">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick action trigger box */}
            <div className="glass-blue rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-brand-500/10">
              <div className="space-y-1">
                <p className="text-white font-semibold text-sm">Need to top up your Meta ad accounts?</p>
                <p className="text-slate-400 text-xs">
                  Create a funding request, transfer bank credentials, and the admin panel updates the balance within 2 hours.
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-brand-600/10 flex-shrink-0"
              >
                <Plus size={14} /> Request Fund Topup
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: Ledger and Transactions */
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 glass rounded-xl animate-pulse" />)}
              </div>
            ) : txns.length === 0 ? (
              <div className="glass rounded-2xl p-16 text-center border border-white/5">
                <CreditCard size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No transactions recorded</p>
                <p className="text-slate-500 text-sm">Deductions and add-fund topups appear here.</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
                {txns.map(txn => {
                  const cfg = STATUS_CONFIG[txn.status] || STATUS_CONFIG.pending
                  const StatusIcon = cfg.icon
                  const isCredit = txn.type === 'add_funds'
                  return (
                    <div key={txn.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-all">
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                        isCredit ? 'bg-green-600/10 border border-green-500/10' : 'bg-red-600/10 border border-red-500/10'
                      )}>
                        {isCredit
                          ? <ArrowDownCircle size={17} className="text-green-400" />
                          : <ArrowUpCircle size={17} className="text-red-400" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">
                          {isCredit ? 'Funds Topup' : 'Ad Campaign Spend'}
                        </p>
                        <p className="text-slate-500 text-xs truncate mt-0.5">
                          {txn.note ?? '—'} &middot; {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={cn('text-sm font-bold', isCredit ? 'text-green-400' : 'text-red-400')}>
                          {isCredit ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                        </p>
                        <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border mt-1.5 font-medium uppercase', cfg.color)}>
                          <StatusIcon size={9} />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add funds modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass rounded-3xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-3">
              <h2 className="text-base font-bold text-white">Request ad funds topup</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-1.5 rounded-xl"><X size={16} /></button>
            </div>

            <div className="space-y-5">
              {/* Quick amounts selection */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Select Topup Amount</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => { setSelectedAmount(amt); setCustomAmount(''); setAmountError('') }}
                      className={cn(
                        'py-2.5 rounded-xl text-xs font-semibold transition-all border',
                        selectedAmount === amt
                          ? 'bg-brand-600 border-brand-500/25 text-white shadow-md'
                          : 'glass border-white/5 text-slate-300 hover:text-white hover:border-white/15'
                      )}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount input field */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Or enter Custom amount</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                  <input
                    type="number"
                    placeholder="Minimum ₹500"
                    value={customAmount}
                    onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); setAmountError('') }}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                  />
                </div>
                {amountError && <p className="mt-1 text-xs text-red-400">{amountError}</p>}
              </div>

              {/* Payment instructions display */}
              <div className="bg-dark-800/60 rounded-xl p-4 text-xs text-slate-400 space-y-2 border border-white/5">
                <p className="text-white font-bold text-[11px] uppercase tracking-wide">UPI / Transfer Instructions</p>
                <div className="space-y-1 text-[11px]">
                  <p>UPI ID: <span className="text-white font-medium select-all">leadpilot@upi</span></p>
                  <p>Bank: HDFC Bank &middot; A/C: 1234567890 &middot; IFSC: HDFC0001234</p>
                </div>
                <p className="text-slate-500 leading-relaxed text-[10px] pt-1">
                  Complete the payment, submit the request, and our operations team will credit your wallet balance upon UTR verification.
                </p>
              </div>

              {finalAmount && finalAmount >= 500 && (
                <div className="bg-brand-600/10 border border-brand-600/20 rounded-xl p-3 text-xs text-brand-300 flex items-center justify-between">
                  <span>Confirm topup value:</span>
                  <strong className="text-sm">₹{finalAmount.toLocaleString('en-IN')}</strong>
                </div>
              )}

              {/* Submit actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFunds}
                  disabled={submitting || !finalAmount}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-600/10"
                >
                  {submitting ? 'Creating request...' : 'Confirm payment request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
