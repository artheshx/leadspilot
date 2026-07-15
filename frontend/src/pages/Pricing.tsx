import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight, Zap, Building2, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

const plans = [
  {
    name: 'Starter',
    icon: Zap,
    price: '₹4,999',
    period: '/month',
    adBudget: 'Up to ₹25,000 ad spend',
    desc: 'Perfect for small businesses launching their first campaign.',
    color: 'brand',
    popular: false,
    features: [
      '1 active campaign',
      'Campaign setup & strategy',
      'Ad copy (Hindi + English)',
      'Basic creative design',
      '1 target audience',
      'Weekly optimization',
      'Dashboard access',
      'WhatsApp support',
      'Monthly report',
    ],
  },
  {
    name: 'Growth',
    icon: Building2,
    price: '₹9,999',
    period: '/month',
    adBudget: 'Up to ₹75,000 ad spend',
    desc: 'For businesses ready to scale leads and lower CPL.',
    color: 'brand',
    popular: true,
    features: [
      '3 active campaigns',
      'Advanced audience targeting',
      'A/B testing (creatives + copy)',
      'Premium creative design',
      'Up to 3 target audiences',
      'Bi-weekly optimization',
      'Landing page creation',
      'Priority WhatsApp + call support',
      'Weekly report',
      'Dedicated campaign manager',
    ],
  },
  {
    name: 'Scale',
    icon: Crown,
    price: '₹19,999',
    period: '/month',
    adBudget: 'Unlimited ad spend',
    desc: 'For high-growth businesses that need full-scale advertising.',
    color: 'violet',
    popular: false,
    features: [
      'Unlimited active campaigns',
      'Full-funnel strategy',
      'Video ad production',
      'Multiple landing pages',
      'Unlimited target audiences',
      'Daily monitoring',
      'Lead CRM integration',
      'Dedicated account director',
      'Daily reports',
      'Quarterly strategy review',
    ],
  },
]

const faqs = [
  {
    q: 'What\'s included in the management fee?',
    a: 'The monthly fee covers our team\'s time — strategy, creative, optimization, reporting. Your actual ad spend goes directly to Meta. We handle everything else.',
  },
  {
    q: 'How do I add ad budget funds?',
    a: 'You add funds directly in your LeadPilot dashboard via UPI, bank transfer, or card. We manage how it\'s spent on Meta on your behalf.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-in contracts. Cancel from your dashboard before your next billing date and we\'ll stop all campaigns. No questions asked.',
  },
  {
    q: 'Do I need a Meta Business account?',
    a: 'No. We create and manage everything on our Meta Business accounts. You don\'t need to set anything up.',
  },
  {
    q: 'What if I\'m not happy with results?',
    a: 'We offer a 15-day money-back guarantee on the management fee if you\'re not satisfied with our service quality. Ad spend already deployed to Meta is non-refundable.',
  },
]

export default function Pricing() {
  return (
    <>
      <Helmet>
        <title>Pricing — LeadPilot</title>
        <meta name="description" content="Simple, transparent pricing for Meta Ads management. Starting at ₹4,999/month. No hidden fees." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-16 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Transparent pricing</p>
          <h1 className="text-5xl font-bold text-white mb-6">
            No hidden fees.<br />
            <span className="text-gradient">No surprises.</span>
          </h1>
          <p className="text-xl text-slate-400">
            One flat monthly fee for our team. Your ad budget goes 100% to Meta.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'glass rounded-2xl p-8 flex flex-col relative',
                  plan.popular && 'border-brand-500/40 glow-blue-sm scale-105'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Most popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
                    <plan.icon size={20} className="text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{plan.name}</h3>
                    <p className="text-slate-500 text-xs">{plan.adBudget}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period} management fee</span>
                </div>

                <p className="text-slate-400 text-sm mb-6">{plan.desc}</p>

                <Link
                  to="/contact"
                  className={cn(
                    'block text-center font-semibold py-3 rounded-xl transition-all mb-8 text-sm',
                    plan.popular
                      ? 'bg-brand-600 hover:bg-brand-500 text-white hover:shadow-lg hover:shadow-brand-600/30'
                      : 'border border-white/15 hover:border-white/25 text-white hover:bg-white/5'
                  )}
                >
                  Get started
                </Link>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <CheckCircle2 size={14} className="text-brand-400 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-sm mt-8">
            All plans include GST. Ad spend is billed separately via your dashboard balance.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-slate-400 mb-8">Talk to our team. We'll recommend the right plan for your business and budget.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl transition-all"
          >
            Talk to us <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}
