import { useState, type ReactNode } from 'react'
import { Activity, ArrowRight, BadgeCheck, Bell, Building2, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, FileText, Filter, Globe2, LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { Brand } from './Brand'
import { TaxonomyManager } from './admin/TaxonomyManager'
import { QualityReviewPanel } from './admin/QualityReviewPanel'
import { AnalyticsDashboard } from './admin/AnalyticsDashboard'
import { TaxonomyFeedbackPanel } from './admin/TaxonomyFeedbackPanel'
import './dashboards.css'

type Theme = 'light' | 'dark'
type ThemeProps = { theme: Theme; onToggleTheme: () => void }
type Props = ThemeProps & { onSignOut: () => Promise<void> }
const journey = [
  { label: 'Business verification', state: 'Complete', done: true },
  { label: 'Annual plan', state: 'Active until 14 Oct 2026', done: true },
  { label: 'Business information', state: 'Needs your attention', done: false },
  { label: 'BHA review', state: 'Starts after you submit', done: false },
  { label: 'Public business page', state: 'Not published', done: false },
]
const queue = [
  { name: 'The Terrace Accra', kind: 'Hotel', place: 'Accra, Ghana', status: 'QUALITY_REVIEW', age: '2 hours ago', initials: 'TA', tone: 'green' },
  { name: 'Northstar Health', kind: 'Health Clinic', place: 'Lagos, Nigeria', status: 'INFORMATION_RECEIVED', age: 'Yesterday', initials: 'NH', tone: 'blue' },
  { name: 'Moyo Studio', kind: 'Architecture Studio', place: 'Nairobi, Kenya', status: 'VERIFICATION_REVIEW', age: 'Yesterday', initials: 'MS', tone: 'orange' },
  { name: 'Savanna Collective', kind: 'Agricultural Producer', place: 'Tamale, Ghana', status: 'AI_PAGE_GENERATING', age: '2 days ago', initials: 'SC', tone: 'violet' },
]

function ThemeToggle({ theme, onToggleTheme }: ThemeProps) {
  const next = theme === 'light' ? 'dark' : 'light'
  return <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>{next === 'dark' ? '◐' : '☼'}</button>
}

function Sidebar({ active, close, onSignOut }: { active: string; close: () => void; onSignOut: () => Promise<void> }) {
  return <aside className="dash-sidebar">
    <Brand className="sidebar-brand" href="/" />
    <div className="sidebar-workspace"><span className="workspace-avatar">TG</span><span><b>Tech Groomers Africa</b><small>Business Hub Africa</small></span><ChevronDown size={14} /></div>
    <span className="sidebar-label">WORKSPACE</span>
    <nav className="sidebar-nav" aria-label="Dashboard navigation">
      <a className={active === 'overview' ? 'active' : ''} href="/dashboard"><LayoutDashboard size={17} /> Overview</a>
      <a href="/dashboard#business"><Building2 size={17} /> My business</a>
      <a href="/dashboard#subscription"><CircleDollarSign size={17} /> Subscription</a>
      <a href="/dashboard#bookings"><CalendarDays size={17} /> Bookings <span className="nav-count">2</span></a>
    </nav>
    <span className="sidebar-label admin-label">ADMINISTRATION</span>
    <nav className="sidebar-nav"><a className={active === 'admin' ? 'active' : ''} href="/admin"><ShieldCheck size={17} /> Admin dashboard</a><a href="/admin#taxonomy"><Settings size={17} /> Taxonomy</a></nav>
    <div className="sidebar-bottom"><div className="support-card"><Sparkles size={15} /><b>Need a hand?</b><span>Your BHA team is here to help.</span><a href="mailto:support@businesshub.africa">Contact support <ArrowRight size={13} /></a></div><button className="sidebar-logout" type="button" onClick={() => void onSignOut()}><LogOut size={16} /> Sign out</button></div>
    <button className="sidebar-dismiss" type="button" aria-label="Close menu" onClick={close}><X size={19} /></button>
  </aside>
}

function Header({ title, theme, onToggleTheme, onMenu }: ThemeProps & { title: string; onMenu: () => void }) {
  return <header className="dash-topbar"><button className="mobile-dash-menu" type="button" onClick={onMenu} aria-label="Open dashboard menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Business Hub Africa</span><span>/</span><b>{title}</b></div><div className="topbar-actions"><button className="icon-action" type="button" aria-label="Notifications"><Bell size={17} /><i /></button><ThemeToggle theme={theme} onToggleTheme={onToggleTheme} /><span className="topbar-avatar">AO</span></div></header>
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`status-badge status-${tone}`}><i />{children}</span>
}

function Layout({ active, title, theme, onToggleTheme, onSignOut, children }: Props & { active: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <div className={`dashboard-shell ${open ? 'sidebar-open' : ''}`}><Sidebar active={active} close={() => setOpen(false)} onSignOut={onSignOut} />{open && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />}<div className="dash-main"><Header title={title} theme={theme} onToggleTheme={onToggleTheme} onMenu={() => setOpen(true)} />{children}</div></div>
}

function PreviewNote({ children }: { children: string }) {
  return <div className="dashboard-preview-note"><Sparkles size={15} /><b>Dashboard preview</b><span>{children}</span></div>
}

export function BusinessDashboard({ theme, onToggleTheme, onSignOut }: Props) {
  return <Layout active="overview" title="Business dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut}>
    <main className="dash-content">
      <div className="dash-page-heading"><div><div className="page-kicker">MONDAY, 12 OCTOBER 2026 <i /> BUSINESS OWNER</div><h1>Good morning, Amara</h1><p>Here’s what’s happening with your business on BHA.</p></div><button className="secondary-button" type="button"><MoreHorizontal size={17} /> More</button></div>
      <PreviewNote>Connect owner accounts to show your business data here.</PreviewNote>
      <section className="welcome-banner" id="business"><span className="welcome-mark"><Building2 size={23} /></span><div className="welcome-copy"><div className="welcome-line"><h2>The Terrace Accra</h2><Badge tone="verified">Verified</Badge></div><p>Hotel <i /> Accra, Ghana</p><span>Your profile is taking shape. Complete the details below to get your page ready for review.</span></div><a className="outline-button" href="/business/the-terrace-accra">Preview business page <ArrowRight size={14} /></a></section>
      <section className="metric-grid owner-metrics"><article className="metric-card"><span className="metric-heading">PROFILE COMPLETION <MoreHorizontal size={16} /></span><strong>68<span>%</span></strong><div className="meter"><i style={{ width: '68%' }} /></div><small>3 of 5 sections complete</small></article><article className="metric-card"><span className="metric-heading">PAGE VISITORS <b className="trend-up">+18%</b></span><strong>248</strong><small>Last 30 days</small><span className="mini-bars">{[22, 37, 28, 48, 39, 55, 35, 67, 50, 77, 61].map((height, index) => <i key={index} style={{ height }} />)}</span></article><article className="metric-card"><span className="metric-heading">ENQUIRIES <Activity size={15} /></span><strong>12</strong><small>4 need a reply</small><a className="metric-link" href="/dashboard#enquiries">View enquiries <ArrowRight size={13} /></a></article><article className="metric-card"><span className="metric-heading">SUBSCRIPTION <CircleDollarSign size={15} /></span><strong className="metric-plan">Booking</strong><small>Renews 14 Oct 2026</small><a className="metric-link" href="/dashboard#subscription">Manage plan <ArrowRight size={13} /></a></article></section>
      <section className="dashboard-columns"><article className="dashboard-panel journey-panel"><div className="panel-heading"><div><span className="panel-eyebrow">YOUR BHA JOURNEY</span><h2>On the way to go-live</h2></div><a href="/dashboard#business">View profile <ArrowRight size={14} /></a></div><div className="journey-list">{journey.map((step, index) => <div className={`journey-step ${step.done ? 'is-complete' : index === 2 ? 'is-current' : ''}`} key={step.label}><span className="journey-indicator">{step.done ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><div><b>{step.label}</b><span>{step.state}</span></div>{index === 2 && <a className="step-action" href="/dashboard#business">Continue <ArrowRight size={13} /></a>}</div>)}</div><div className="journey-footer"><span><Clock3 size={14} /> Your page stays private until BHA approves it.</span><b>2 / 5</b></div></article>
        <article className="dashboard-panel plan-panel" id="subscription"><div className="panel-heading"><div><span className="panel-eyebrow">YOUR SUBSCRIPTION</span><h2>Business Visibility + Booking</h2></div><Badge tone="active">Active</Badge></div><div className="plan-amount"><strong>$13</strong><span>USD / year</span><del>$65</del></div><div className="plan-detail"><span>Launch offer applied</span><span>Next payment <b>14 Oct 2026</b></span></div><div className="plan-progress"><i /></div><div className="plan-progress-labels"><span>Started 14 Oct 2025</span><span>2 days remaining</span></div><button className="panel-action" type="button">Manage subscription <ArrowRight size={14} /></button></article></section>
      <section className="dashboard-panel activity-panel" id="bookings"><div className="panel-heading"><div><span className="panel-eyebrow">RECENT ACTIVITY</span><h2>Keep things moving</h2></div><button className="plain-action" type="button">View all <ArrowRight size={14} /></button></div><div className="activity-list"><article><span className="activity-icon activity-green"><CalendarDays size={16} /></span><div><b>New booking request</b><span>Kwame Mensah · 2 guests · 18 Oct</span></div><span className="activity-time">24 MIN AGO</span><Badge tone="new">New</Badge></article><article><span className="activity-icon activity-blue"><FileText size={16} /></span><div><b>Business details saved</b><span>Your profile changes are up to date.</span></div><span className="activity-time">YESTERDAY</span><Badge>Saved</Badge></article><article><span className="activity-icon activity-orange"><Users size={16} /></span><div><b>New customer enquiry</b><span>“Do you have availability for a team retreat?”</span></div><span className="activity-time">2 DAYS AGO</span><Badge tone="new">Reply</Badge></article></div></section>
      <div className="dashboard-footnote"><ShieldCheck size={14} /> Your business details are visible only to you and the BHA review team until approved.</div>
    </main>
  </Layout>
}

export function AdminDashboard({ theme, onToggleTheme, onSignOut }: Props) {
  const [activeFilter, setActiveFilter] = useState('All reviews')
  const [search, setSearch] = useState('')
  const visibleQueue = queue.filter((business) => {
    const textMatch = `${business.name} ${business.kind} ${business.place}`.toLowerCase().includes(search.toLowerCase())
    const filterMatch = activeFilter === 'All reviews' || (activeFilter === 'Verification' ? business.status.includes('VERIFICATION') : activeFilter === 'Page review' ? business.status === 'QUALITY_REVIEW' : activeFilter === 'Information' ? business.status === 'INFORMATION_RECEIVED' : true)
    return textMatch && filterMatch
  })
  return <Layout active="admin" title="Admin dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut}>
    <main className="dash-content admin-content">
      <div className="dash-page-heading"><div><div className="page-kicker">BUSINESS HUB AFRICA <i /> OPERATIONS</div><h1>Good morning, BHA team</h1><p>Here’s the health of your business network today.</p></div><button className="secondary-button" type="button"><CalendarDays size={15} /> Last 30 days <ChevronDown size={13} /></button></div>
      <PreviewNote>Sample operations data. Admin metrics require authenticated Supabase views.</PreviewNote>
      <section className="admin-metric-grid"><article className="admin-stat"><span>Total businesses <Building2 size={16} /></span><strong>1,284</strong><small><b>+8.4%</b> vs. last month</small><div className="sparkline">{[18, 25, 20, 34, 30, 40, 35, 54, 46, 61, 52, 69, 63, 82].map((height, index) => <i key={index} style={{ height }} />)}</div></article><article className="admin-stat"><span>Verified businesses <BadgeCheck size={16} /></span><strong>942</strong><small><b>73.4%</b> of all businesses</small><div className="stat-bar"><i style={{ width: '73%' }} /></div></article><article className="admin-stat"><span>Pages awaiting review <Clock3 size={16} /></span><strong>18</strong><small><b className="warning-text">6 overdue</b> · oldest 3 days</small><div className="stat-bar warning-bar"><i style={{ width: '42%' }} /></div></article><article className="admin-stat"><span>Live businesses <Globe2 size={16} /></span><strong>816</strong><small><b>+42</b> published this month</small><div className="stat-bar"><i style={{ width: '64%' }} /></div></article></section>
      <section className="admin-secondary-metrics">{[['Verification pending', '27', '8 more than last week'], ['Payment pending', '14', '5 checkouts active'], ['Information pending', '36', 'Awaiting business owners'], ['Renewals due', '22', 'Next 30 days'], ['Failed payments', '3', 'Requires follow-up'], ['Expired / suspended', '11', 'Review account status']].map(([label, value, note]) => <article key={label}><span>{label}</span><b>{value}</b><small>{note}</small></article>)}</section>
      <section className="dashboard-panel review-panel"><div className="panel-heading"><div><span className="panel-eyebrow">WORK QUEUE <b className="queue-count">18</b></span><h2>Businesses that need a look</h2></div><button className="plain-action" type="button">Open all applications <ArrowRight size={14} /></button></div><div className="queue-toolbar"><div className="filter-tabs">{['All reviews', 'Verification', 'Page review', 'Information'].map((filter) => <button className={activeFilter === filter ? 'selected' : ''} onClick={() => setActiveFilter(filter)} type="button" key={filter}>{filter}</button>)}</div><label className="queue-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses" /></label><button className="filter-button" type="button" aria-label="More filters"><Filter size={15} /></button></div><div className="queue-table"><div className="queue-row queue-header"><span>BUSINESS</span><span>LOCATION</span><span>APPLICATION STATUS</span><span>RECEIVED</span><span /></div>{visibleQueue.map((business) => <article className="queue-row" key={business.name}><div className="queue-business"><span className={`queue-avatar avatar-${business.tone}`}>{business.initials}</span><span><b>{business.name}</b><small>{business.kind}</small></span></div><span className="queue-location"><Globe2 size={13} />{business.place}</span><span className={`status-badge status-${business.status === 'QUALITY_REVIEW' ? 'review' : business.status.includes('VERIFICATION') ? 'verification' : business.status === 'AI_PAGE_GENERATING' ? 'generating' : 'information'}`}><i />{business.status.replaceAll('_', ' ')}</span><span className="queue-time">{business.age}</span><button className="row-more" type="button" aria-label={`Review ${business.name}`}><ArrowRight size={16} /></button></article>)}{visibleQueue.length === 0 && <div className="queue-empty">No applications match this view.</div>}</div><div className="queue-footer"><span>Showing {visibleQueue.length} of 18 applications</span><button type="button">View work queue <ArrowRight size={14} /></button></div></section>
      <section className="admin-bottom-grid"><article className="dashboard-panel lifecycle-panel"><div className="panel-heading"><div><span className="panel-eyebrow">BUSINESS LIFECYCLE</span><h2>Where applications stand</h2></div><button className="plain-action" type="button">Full report <ArrowRight size={14} /></button></div><div className="lifecycle-bars">{[['Verification', '27', 'stage-verify', '35%'], ['Payment pending', '14', 'stage-payment', '20%'], ['Information received', '36', 'stage-info', '48%'], ['AI page generation', '9', 'stage-ai', '14%'], ['Quality review', '18', 'stage-review', '27%']].map(([label, value, tone, width]) => <div className="lifecycle-item" key={label}><span><i className={`stage-dot ${tone}`} />{label}</span><b>{value}</b><div><i style={{ width }} /></div></div>)}</div></article><article className="dashboard-panel admin-tools"><div className="panel-heading"><div><span className="panel-eyebrow">QUICK ACCESS</span><h2>Operations tools</h2></div></div><a href="/admin#taxonomy"><span><Settings size={16} /></span><div><b>Manage taxonomy</b><small>Industries, business types, countries</small></div><ArrowRight size={15} /></a><a href="/admin#plans"><span><CircleDollarSign size={16} /></span><div><b>Plans & promotions</b><small>Pricing, launch offers, renewals</small></div><ArrowRight size={15} /></a><a href="/admin#audit"><span><Activity size={16} /></span><div><b>Audit log</b><small>Recent admin actions</small></div><ArrowRight size={15} /></a></article></section>

      <section id="taxonomy" className="dashboard-panel taxonomy-panel">
        <div className="panel-heading"><div><span className="panel-eyebrow">TAXONOMY FOUNDATION <i /> PHASE 1</span><h2>Category & Subcategory Management</h2></div></div>
        <TaxonomyManager />
      </section>

      <section id="quality-review" className="dashboard-panel review-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">QUALITY REVIEW <i /> PHASE 3</span><h2>Page Review & Approval</h2></div></div>
        <QualityReviewPanel />
      </section>

      <section id="analytics" className="dashboard-panel analytics-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">ANALYTICS <i /> PHASE 5</span><h2>Search & Category Insights</h2></div></div>
        <AnalyticsDashboard />
      </section>

      <section id="feedback" className="dashboard-panel feedback-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">GOVERNANCE <i /> PHASE 5</span><h2>Taxonomy Feedback</h2></div></div>
        <TaxonomyFeedbackPanel />
      </section>
      <div className="dashboard-footnote"><ShieldCheck size={14} /> All verification, payment, and publication decisions are recorded in the BHA audit log.</div>
    </main>
  </Layout>
}
