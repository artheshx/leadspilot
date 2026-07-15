import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, Palette, Rocket, BarChart3, Users, MessageSquare } from 'lucide-react'

const phases = [
  {
    num: '01',
    title: 'You fill the brief',
    duration: '10 minutes',
    icon: FileText,
    desc: 'Tell us about your business, target audience, monthly budget, and campaign goal. Our onboarding form is designed for non-marketers — plain language, no jargon.',
    points: ['Business details & product description', 'Target city / demographic', 'Monthly ad budget (starting ₹10,000)', 'Campaign goal: leads, calls, walk-ins'],
  },
  {
    num: '02',
    title: 'We build the campaign',
    duration: '24–48 hours',
    icon: Palette,
    desc: 'Our team builds everything from scratch — audience targeting, ad copy, creative assets. You get a preview to approve before anything goes live.',
    points: ['Custom audience targeting', 'Ad copy in Hindi + English', 'Creative design (images/videos)', 'Landing page if required'],
  },
  {
    num: '03',
    title: 'Campaign goes live',
    duration: 'Day 2–3',
    icon: Rocket,
    desc: 'Once you approve, we launch. Your dashboard updates in real-time. Your campaign manager will message you on launch day.',
    points: ['One-click approve in dashboard', 'Live within hours of approval', 'WhatsApp notification on launch', 'First leads usually within 24–48 hours'],
  },
  {
    num: '04',
    title: 'Weekly optimization',
    duration: 'Ongoing',
    icon: BarChart3,
    desc: 'We review performance every week and make data-driven changes. You get a weekly summary in your dashboard and on WhatsApp.',
    points: ['A/B testing creatives', 'Audience refinement', 'Budget reallocation', 'Weekly performance report'],
  },
]

const team = [
  { role: 'Campaign strategist', desc: 'Plans your targeting and campaign structure' },
  { role: 'Copywriter', desc: 'Writes persuasive ad copy that converts' },
  { role: 'Creative designer', desc: 'Designs images and videos for your ads' },
  { role: 'Campaign manager', desc: 'Your dedicated point of contact — always reachable' },
]

export default function HowItWorks() {
  return (
    <>
      <Helmet>
        <title>How It Works — LeadPilot</title>
        <meta name="description" content="See how LeadPilot launches and manages your Meta Ads in 4 simple steps. From brief to leads in 48 hours." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-20 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Simple process</p>
          <h1 className="text-5xl font-bold text-white mb-6">
            From brief to leads<br />
            <span className="text-gradient">in 48 hours</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            You don't need to learn Meta Ads Manager. You don't need to know what CPM, CTR, or ROAS means.
            Just tell us what you sell — we handle everything else.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {phases.map((phase) => (
              <div key={phase.num} className="glass rounded-2xl p-8 flex flex-col md:flex-row gap-8">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 glass-blue rounded-2xl flex items-center justify-center">
                    <phase.icon size={24} className="text-brand-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-brand-400 font-bold text-sm">Step {phase.num}</span>
                    <span className="text-xs text-slate-600 border border-white/10 rounded-full px-3 py-1">{phase.duration}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{phase.title}</h3>
                  <p className="text-slate-400 leading-relaxed mb-5">{phase.desc}</p>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {phase.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-slate-400">
                        <CheckCircle2 size={14} className="text-brand-400 mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team section */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Your team at LeadPilot</h2>
            <p className="text-slate-400">When you sign up, you get a full team — not a single freelancer.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.map((member) => (
              <div key={member.role} className="glass rounded-xl p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center mx-auto mb-3">
                  <Users size={20} className="text-brand-400" />
                </div>
                <h4 className="text-white font-semibold text-sm mb-1">{member.role}</h4>
                <p className="text-slate-500 text-xs leading-relaxed">{member.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <MessageSquare size={32} className="text-brand-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-slate-400 mb-8">Fill the brief in 10 minutes and get your first campaign live within 48 hours.</p>
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
