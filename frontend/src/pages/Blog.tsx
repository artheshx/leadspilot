import { Helmet } from 'react-helmet-async'
import { Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const posts = [
  {
    slug: 'meta-ads-small-business-guide',
    category: 'Guides',
    title: 'Meta Ads for Small Businesses in India: A Complete 2024 Guide',
    excerpt: 'Everything a small business owner in India needs to know about running Facebook and Instagram ads — without the technical jargon.',
    readTime: '8 min read',
    date: 'Dec 10, 2024',
    featured: true,
  },
  {
    slug: 'cpl-vs-roas',
    category: 'Education',
    title: 'CPL vs ROAS: Which Metric Actually Matters for Your Campaign?',
    excerpt: 'The two most important numbers in digital advertising explained simply. And why most agencies report the wrong one.',
    readTime: '5 min read',
    date: 'Dec 5, 2024',
    featured: false,
  },
  {
    slug: 'hindi-ads-convert-better',
    category: 'Case Study',
    title: 'Why Hindi-Language Ads Convert 2.4x Better in Tier-2 Cities',
    excerpt: 'We analysed 600+ campaigns across Madhya Pradesh, Rajasthan, and UP. The data is clear: language matters more than creative quality.',
    readTime: '6 min read',
    date: 'Nov 28, 2024',
    featured: false,
  },
  {
    slug: 'real-estate-meta-ads',
    category: 'Industry',
    title: 'Meta Ads for Real Estate Developers: What Actually Works in 2024',
    excerpt: 'Real estate is one of the hardest verticals for digital ads. Here\'s the exact strategy we use to generate ₹2,000–₹3,000 CPL for builders.',
    readTime: '7 min read',
    date: 'Nov 20, 2024',
    featured: false,
  },
  {
    slug: 'ad-budget-guide-india',
    category: 'Guides',
    title: 'How Much Should Indian Businesses Spend on Meta Ads? (With Examples)',
    excerpt: 'The honest answer to the most common question we get. Includes real budget breakdowns across 6 industries.',
    readTime: '6 min read',
    date: 'Nov 15, 2024',
    featured: false,
  },
  {
    slug: 'whatsapp-lead-ads',
    category: 'Strategy',
    title: 'WhatsApp Lead Ads: The Highest-Converting Format for Indian Businesses',
    excerpt: 'Why Click-to-WhatsApp ads consistently outperform traditional lead forms in India, and how to set them up.',
    readTime: '5 min read',
    date: 'Nov 8, 2024',
    featured: false,
  },
]

const categories = ['All', 'Guides', 'Case Study', 'Industry', 'Strategy', 'Education']

export default function Blog() {
  return (
    <>
      <Helmet>
        <title>Blog — LeadPilot</title>
        <meta name="description" content="Learn Meta Ads strategy, tips, and case studies from the LeadPilot team." />
      </Helmet>

      {/* Hero */}
      <section className="pt-32 pb-16 relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Resources</p>
          <h1 className="text-5xl font-bold text-white mb-6">
            Learn from the <span className="text-gradient">experts</span>
          </h1>
          <p className="text-xl text-slate-400">
            Plain-language guides, case studies, and strategies from the team that manages ₹18Cr+ in annual ad spend.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                cat === 'All'
                  ? 'bg-brand-600 text-white'
                  : 'glass text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Posts grid */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Featured post */}
          {posts.filter(p => p.featured).map(post => (
            <div key={post.slug} className="glass rounded-2xl p-8 mb-8 group hover:border-brand-600/30 transition-all">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-xs font-semibold text-brand-400 bg-brand-600/15 px-3 py-1 rounded-full">{post.category}</span>
                <span className="text-xs text-slate-600 border border-white/10 rounded-full px-3 py-1">Featured</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-brand-300 transition-colors">{post.title}</h2>
              <p className="text-slate-400 leading-relaxed mb-6">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>{post.date}</span>
                  <span className="flex items-center gap-1"><Clock size={12} />{post.readTime}</span>
                </div>
                <Link to={`/blog/${post.slug}`} className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition-colors">
                  Read article <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}

          {/* Regular posts */}
          <div className="grid md:grid-cols-2 gap-6">
            {posts.filter(p => !p.featured).map(post => (
              <div key={post.slug} className="glass rounded-xl p-6 group hover:border-brand-600/30 transition-all flex flex-col">
                <span className="text-xs font-semibold text-brand-400 bg-brand-600/15 px-3 py-1 rounded-full self-start mb-4">{post.category}</span>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-300 transition-colors flex-1">{post.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>{post.date}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{post.readTime}</span>
                  </div>
                  <Link to={`/blog/${post.slug}`} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                    Read →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
