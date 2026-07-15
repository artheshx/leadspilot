import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, TrendingDown, Users } from 'lucide-react'

const cases = [
  {
    client: 'Sharma Electronics',
    industry: 'Retail Electronics',
    location: 'Indore, MP',
    avatar: 'SE',
    color: 'bg-blue-600',
    challenge: 'No online presence. Owner was spending ₹50,000/month on pamphlets with zero tracking.',
    solution: 'Launched Facebook Lead Ads targeting local buyers in 10km radius. Created Hindi-language creatives showing product offers.',
    duration: '3 months',
    metrics: [
      { label: 'Monthly leads', before: '0', after: '120+', up: true },
      { label: 'Cost per lead', before: '—', after: '₹210', up: false },
      { label: 'Monthly ad spend', before: '₹50,000 (pamphlets)', after: '₹20,000 (Meta)', up: false },
      { label: 'Walk-in conversions', before: '—', after: '28%', up: true },
    ],
    quote: 'I was sceptical about digital ads but LeadPilot changed everything. 120 leads in one month was unthinkable before.',
    author: 'Rajesh Sharma, Owner',
  },
  {
    client: 'FitLife Studio',
    industry: 'Fitness & Wellness',
    location: 'Pune, MH',
    avatar: 'FL',
    color: 'bg-green-600',
    challenge: 'New gym launch. No existing client base. Needed 100 members in first 60 days.',
    solution: 'Instagram and Facebook ads targeting fitness-interested 22–35 year olds. Video ads of the facility + limited-time joining offer.',
    duration: '2 months',
    metrics: [
      { label: 'New members', before: '0', after: '134', up: true },
      { label: 'Cost per member', before: '—', after: '₹890', up: false },
      { label: 'ROAS', before: '—', after: '4.2x', up: true },
      { label: 'Instagram followers', before: '120', after: '2,400', up: true },
    ],
    quote: 'We hit our 100-member target in 45 days. The creative team understood our brand instantly.',
    author: 'Priya Menon, Founder',
  },
  {
    client: 'Gupta Builders',
    industry: 'Real Estate',
    location: 'Bhopal, MP',
    avatar: 'GB',
    color: 'bg-amber-600',
    challenge: 'Previous agency spent ₹2L/month, delivered 8 low-quality leads. CPL of ₹25,000.',
    solution: 'Rebuilt targeting from scratch. Focused on income-qualified buyers. Lead forms with qualifying questions to filter serious buyers.',
    duration: '6 months',
    metrics: [
      { label: 'Monthly leads', before: '8', after: '67', up: true },
      { label: 'Cost per lead', before: '₹25,000', after: '₹2,985', up: false },
      { label: 'Lead quality score', before: '2/10', after: '7/10', up: true },
      { label: 'Site visits booked', before: '2/month', after: '18/month', up: true },
    ],
    quote: 'The CPL drop from ₹25,000 to ₹2,985 speaks for itself. And these leads actually pick up the phone.',
    author: 'Arun Gupta, Director',
  },
  {
    client: 'Dr. Mehta Dental',
    industry: 'Healthcare',
    location: 'Ahmedabad, GJ',
    avatar: 'DM',
    color: 'bg-violet-600',
    challenge: 'Private dental clinic dependent entirely on word-of-mouth. Wanted to fill appointment slots consistently.',
    solution: 'Local awareness + lead form ads targeting working professionals 28–50. WhatsApp integration for instant appointment booking.',
    duration: '4 months',
    metrics: [
      { label: 'Monthly appointments', before: '32', after: '89', up: true },
      { label: 'Cost per appointment', before: '—', after: '₹340', up: false },
      { label: 'Slot utilisation', before: '45%', after: '91%', up: true },
      { label: 'Monthly revenue', before: '₹1.8L', after: '₹4.1L', up: true },
    ],
    quote: 'Our calendar is now fully booked 2 weeks in advance. LeadPilot paid for itself within the first month.',
    author: 'Dr. Kavya Mehta, Owner',
  },
]

export default function CaseStudies() {
  return (
    <>
      <Helmet>
        <title>Case Studies — LeadPilot</title>
        <meta name="description" content="Real results from real businesses. See how LeadPilot helped 500+ businesses generate leads with Meta Ads." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-16 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Proof it works</p>
          <h1 className="text-5xl font-bold text-white mb-6">
            Real businesses,<br />
            <span className="text-gradient">real numbers</span>
          </h1>
          <p className="text-xl text-slate-400">
            These aren't hypothetical projections. These are actual results from actual clients — with before/after data.
          </p>
        </div>
      </section>

      {/* Case studies */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {cases.map((c) => (
            <div key={c.client} className="glass rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-8 border-b border-white/5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${c.color} flex items-center justify-center text-white text-sm font-bold`}>
                      {c.avatar}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{c.client}</h2>
                      <p className="text-slate-500 text-sm">{c.industry} · {c.location}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 border border-white/10 rounded-full px-3 py-1">
                    {c.duration} campaign
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Challenge</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{c.challenge}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Our approach</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{c.solution}</p>
                  </div>
                  <blockquote className="border-l-2 border-brand-500 pl-4">
                    <p className="text-slate-300 text-sm italic mb-2">"{c.quote}"</p>
                    <cite className="text-slate-500 text-xs not-italic">— {c.author}</cite>
                  </blockquote>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {c.metrics.map((m) => (
                    <div key={m.label} className="bg-dark-800/60 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-3">{m.label}</p>
                      <div className="flex items-center gap-2 mb-1">
                        {m.up
                          ? <TrendingUp size={14} className="text-green-400" />
                          : <TrendingDown size={14} className="text-green-400" />
                        }
                        <span className="text-white font-bold text-lg">{m.after}</span>
                      </div>
                      {m.before !== '—' && (
                        <p className="text-xs text-slate-600">was {m.before}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Users size={32} className="text-brand-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Your business could be next</h2>
          <p className="text-slate-400 mb-8">Join 500+ businesses generating consistent leads with LeadPilot.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-brand-600/30"
          >
            Start your campaign <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}
