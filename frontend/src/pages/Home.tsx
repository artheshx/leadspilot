import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ArrowRight, CheckCircle2, Star, TrendingUp, Target,
  BarChart3, Shield, Zap, Clock, MessageSquare, Play
} from 'lucide-react'

const stats = [
  { value: '2,400+', label: 'Active campaigns' },
  { value: '₹18Cr+', label: 'Ad spend managed' },
  { value: '94%', label: 'Client retention' },
  { value: '3.2x', label: 'Avg ROAS' },
]

const features = [
  {
    icon: Target,
    title: 'Campaign strategy — done for you',
    desc: 'Our experts build your campaign from scratch. Targeting, creatives, copy — everything handled.',
  },
  {
    icon: BarChart3,
    title: 'Real-time reporting dashboard',
    desc: 'See your spend, leads, and ROAS in one clean dashboard. No spreadsheets, no confusion.',
  },
  {
    icon: Zap,
    title: 'Launch in 48 hours',
    desc: 'From signup to live campaign in 2 days. We move fast so your business doesn\'t wait.',
  },
  {
    icon: MessageSquare,
    title: 'Dedicated campaign manager',
    desc: 'A real human is assigned to your account. WhatsApp, calls, updates — always reachable.',
  },
  {
    icon: Shield,
    title: 'Transparent billing',
    desc: 'Add funds, track every rupee. No hidden fees. You see exactly where your money goes.',
  },
  {
    icon: Clock,
    title: 'Weekly optimization',
    desc: 'Your campaigns are reviewed and optimized every week. We never set-and-forget.',
  },
]

const testimonials = [
  {
    name: 'Rajesh Sharma',
    role: 'Owner, Sharma Electronics',
    avatar: 'RS',
    rating: 5,
    text: 'I had no idea how Meta Ads worked. LeadPilot launched my first campaign in 2 days and I got 40 leads in the first week. Unbelievable ROI.',
  },
  {
    name: 'Priya Menon',
    role: 'Founder, FitLife Studio',
    avatar: 'PM',
    rating: 5,
    text: 'Finally an agency that actually explains what they\'re doing. The dashboard shows everything and my campaign manager replies on WhatsApp within minutes.',
  },
  {
    name: 'Arun Gupta',
    role: 'Director, Gupta Builders',
    avatar: 'AG',
    rating: 5,
    text: 'We were spending ₹2L/month with another agency and getting nothing. LeadPilot cut our CPL by 60% in the first month.',
  },
]

const steps = [
  { num: '01', title: 'Tell us about your business', desc: 'Fill a short brief — your product, target audience, and monthly budget.' },
  { num: '02', title: 'We build your campaign', desc: 'Our team sets up targeting, writes ad copy, and designs creatives.' },
  { num: '03', title: 'Review & approve', desc: 'You review everything in your dashboard before we spend a single rupee.' },
  { num: '04', title: 'Launch & optimize', desc: 'Campaign goes live. We monitor daily and optimize weekly for best results.' },
]

export default function Home() {
  return (
    <>
      <Helmet>
        <title>LeadPilot — Launch Meta Ads Without the Learning Curve</title>
        <meta name="description" content="LeadPilot manages your Meta Ads from strategy to results. No Ads Manager. No guesswork. Just leads." />
      </Helmet>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[120px] animate-glow-pulse pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass-blue rounded-full px-4 py-1.5 text-sm text-brand-300 mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Done-for-you Meta Ads platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6 animate-fade-up">
            Launch ads that
            <br />
            <span className="text-gradient">actually work</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up animate-delay-100">
            LeadPilot runs your Meta Ads from start to finish — strategy, creatives, optimization.
            You get a dashboard, a dedicated manager, and real leads. Zero Ads Manager.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-up animate-delay-200">
            <Link
              to="/contact"
              className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-brand-600/30 text-base"
            >
              Start your first campaign
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/how-it-works"
              className="flex items-center gap-2 text-slate-300 hover:text-white border border-white/10 hover:border-white/20 px-8 py-4 rounded-xl transition-all text-base"
            >
              <Play size={16} className="fill-current" />
              See how it works
            </Link>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 animate-fade-up animate-delay-300">
            {['No Ads Manager needed', 'Live in 48 hours', 'Cancel anytime'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-brand-400" />
                {item}
              </span>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div className="mt-20 relative animate-fade-up animate-delay-400">
            <div className="glass border border-white/8 rounded-2xl p-1 max-w-4xl mx-auto glow-blue">
              <div className="bg-dark-800 rounded-xl overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-dark-700 rounded-md px-3 py-1 text-xs text-slate-500 max-w-xs mx-auto text-center">
                      app.leadpilot.in/dashboard
                    </div>
                  </div>
                </div>
                {/* Dashboard content */}
                <div className="p-6 grid grid-cols-4 gap-4">
                  {[
                    { label: 'Active campaigns', value: '3', change: '+1 this month', color: 'text-brand-400' },
                    { label: 'Total leads', value: '284', change: '+47 this week', color: 'text-green-400' },
                    { label: 'Total spent', value: '₹84,200', change: '↓ CPL improving', color: 'text-violet-400' },
                    { label: 'Avg ROAS', value: '3.6x', change: '↑ vs last month', color: 'text-amber-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-dark-700/60 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-2">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-xs text-slate-600 mt-1">{stat.change}</p>
                    </div>
                  ))}
                </div>
                {/* Chart placeholder */}
                <div className="px-6 pb-6">
                  <div className="bg-dark-700/40 rounded-xl p-4 h-32 flex items-end gap-1.5">
                    {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100, 80, 92].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-brand-600/40 rounded-sm hover:bg-brand-500/60 transition-colors"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-3">Everything included</p>
            <h2 className="text-4xl font-bold text-white mb-4">
              Your entire ad operation,<br />managed by experts
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From strategy to optimization — we handle the entire Meta Ads lifecycle so you never have to open Ads Manager.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-6 hover:border-brand-600/30 transition-all group"
              >
                <div className="w-10 h-10 bg-brand-600/15 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-600/25 transition-colors">
                  <feature.icon size={20} className="text-brand-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS TEASER ─── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-3">Simple process</p>
            <h2 className="text-4xl font-bold text-white mb-4">Live in 4 steps</h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              No onboarding calls. No complex setup. We take your brief and go.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-brand-600/30 to-transparent" />

            {steps.map((step, i) => (
              <div key={step.num} className="relative text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-blue text-brand-400 font-bold text-xl mb-4">
                  {step.num}
                </div>
                <h3 className="text-white font-semibold mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-3 text-slate-700">
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-3">Social proof</p>
            <h2 className="text-4xl font-bold text-white mb-4">
              Real businesses, real results
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="glass rounded-2xl p-6 flex flex-col gap-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center text-brand-200 text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="glass rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-600/5 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-brand-400" />
                <span className="text-brand-400 font-semibold text-sm">Join 500+ businesses</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to get your first leads?
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                No Ads Manager. No guesswork. Just tell us about your business and we'll do the rest.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/contact"
                  className="group flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:shadow-xl hover:shadow-brand-600/30"
                >
                  Start your campaign
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/pricing"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  View pricing →
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-xs text-slate-600">
                {['No setup fee', 'No long-term contracts', 'Money-back guarantee'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-brand-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
