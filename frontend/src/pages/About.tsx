import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ArrowRight, Target, Heart, Lightbulb, TrendingUp } from 'lucide-react'

const values = [
  { icon: Target, title: 'Results over vanity metrics', desc: 'We measure success in leads, sales, and ROAS — not impressions or reach. If it doesn\'t grow your business, we change the strategy.' },
  { icon: Heart, title: 'We treat your money like our own', desc: 'Every rupee in your ad budget is spent with the same care we\'d apply to our own money. Zero wastage, maximum efficiency.' },
  { icon: Lightbulb, title: 'Transparency always', desc: 'You see everything — every campaign, every spend, every result. No smoke, no mirrors. Just honest reporting.' },
  { icon: TrendingUp, title: 'Continuous improvement', desc: 'We never set-and-forget. Every campaign is reviewed weekly and improved based on data. Your results get better over time.' },
]

const team = [
  { name: 'Vikram Joshi', role: 'Co-founder & CEO', bio: 'Former growth lead at a D2C startup. 7+ years running Meta Ads across 20+ verticals.', avatar: 'VJ' },
  { name: 'Shreya Patel', role: 'Co-founder & COO', bio: 'Ex-agency head. Built and scaled campaign teams from 2 to 25 people. Operations obsessive.', avatar: 'SP' },
  { name: 'Rohan Mehta', role: 'Head of Creative', bio: 'Designed ads that have generated ₹50Cr+ in revenue. Specialises in India-market creatives.', avatar: 'RM' },
  { name: 'Ananya Singh', role: 'Head of Strategy', bio: 'Data scientist turned media buyer. Built our optimisation frameworks from scratch.', avatar: 'AS' },
]

const milestones = [
  { year: '2021', event: 'Founded in Indore with 3 clients and a mission to make ads accessible to every Indian business.' },
  { year: '2022', event: 'Crossed 100 active clients. Launched dashboard v1 — first transparent ad reporting tool in the Indian agency space.' },
  { year: '2023', event: '500+ clients. ₹10Cr in annual ad spend managed. Opened Pune and Delhi offices.' },
  { year: '2024', event: '₹18Cr+ managed. Launched LeadPilot platform — from agency to full SaaS + managed service.' },
]

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Us — LeadPilot</title>
        <meta name="description" content="LeadPilot was founded to make Meta Ads accessible to every Indian business. Learn about our team and mission." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-20 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Our story</p>
          <h1 className="text-5xl font-bold text-white mb-6">
            Built for the <span className="text-gradient">Indian business owner</span>
          </h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            We started LeadPilot because we were frustrated. Great businesses were losing money to bad agencies, 
            opaque dashboards, and "experts" who didn't deliver. We built the solution we wished existed.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What we believe in</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {values.map((v) => (
              <div key={v.title} className="glass rounded-2xl p-6 flex gap-4">
                <div className="w-10 h-10 bg-brand-600/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <v.icon size={20} className="text-brand-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">{v.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Our journey</h2>
          <div className="relative space-y-6">
            <div className="absolute left-16 top-0 bottom-0 w-px bg-white/5" />
            {milestones.map((m) => (
              <div key={m.year} className="flex gap-6 items-start relative">
                <div className="w-12 flex-shrink-0 text-right">
                  <span className="text-brand-400 font-bold text-sm">{m.year}</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-brand-600 mt-1 flex-shrink-0 relative z-10" />
                <p className="text-slate-400 text-sm leading-relaxed pt-0.5">{m.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">The team</h2>
            <p className="text-slate-400">The people who've collectively managed ₹100Cr+ in ad spend.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member) => (
              <div key={member.name} className="glass rounded-2xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-brand-700 flex items-center justify-center text-brand-200 font-bold mx-auto mb-4">
                  {member.avatar}
                </div>
                <h3 className="text-white font-semibold mb-1">{member.name}</h3>
                <p className="text-brand-400 text-xs mb-3">{member.role}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Work with us</h2>
          <p className="text-slate-400 mb-8">Let's grow your business together.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl transition-all"
          >
            Start your campaign <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  )
}
