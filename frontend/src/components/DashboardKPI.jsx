import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Wallet, CircleDollarSign, FileText, ClipboardList } from 'lucide-react';
import { formatINR } from '../lib/format';

const KPICard = ({ label, value, icon: Icon, accent, delay = 0, testId, sub }) => (
  <div
    className="card p-5 kpi-enter"
    style={{ animationDelay: `${delay}ms` }}
    data-testid={testId}
  >
    <div className="flex items-start justify-between mb-3">
      <span className="text-xs font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--cc-text-muted)' }}>{label}</span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accent + '20' }}>
        <Icon size={16} color={accent} />
      </div>
    </div>
    <div className="font-mono-data text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>
      {value}
    </div>
    {sub && (
      <div className="mt-1.5 text-[11px]" style={{ color: 'var(--cc-text-muted)' }} data-testid={`${testId}-sub`}>
        {sub}
      </div>
    )}
  </div>
);

const DashboardKPI = ({ stats, svStats, hideSiteVisits = false }) => {
  if (!stats) {
    return (
      <div className={`grid grid-cols-1 ${hideSiteVisits ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-4 mb-6`}>
        {(hideSiteVisits ? [0, 1, 2, 3] : [0, 1, 2, 3, 4]).map((i) => (
          <div key={i} className="card p-5 animate-pulse h-[110px]" />
        ))}
      </div>
    );
  }

  const svValue = svStats ? `${svStats.draft} / ${svStats.submitted}` : '—';
  const svSub = svStats
    ? `${svStats.draft} draft · ${svStats.submitted} submitted (last ${svStats.days || 7} days)`
    : 'Loading…';

  return (
    <div className={`grid grid-cols-2 ${hideSiteVisits ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-4 mb-6`}>
      <KPICard
        label="Total Quoted"
        value={formatINR(stats.total_quoted)}
        icon={FileText}
        accent="#0A2E1F"
        delay={0}
        testId="kpi-total-quoted"
      />
      <KPICard
        label="Total Received"
        value={formatINR(stats.total_received)}
        icon={ArrowDownRight}
        accent="#10B981"
        delay={80}
        testId="kpi-total-received"
      />
      <KPICard
        label="Total Outstanding"
        value={formatINR(stats.total_outstanding)}
        icon={ArrowUpRight}
        accent="#DC2626"
        delay={160}
        testId="kpi-total-outstanding"
      />
      <KPICard
        label="Projects"
        value={`${stats.total_projects}`}
        icon={Wallet}
        accent="#0A2E1F"
        delay={240}
        testId="kpi-total-projects"
      />
      {!hideSiteVisits && (
        <div className="card p-5 kpi-enter" style={{ animationDelay: '320ms' }} data-testid="kpi-site-visits">
          <div className="flex items-start justify-between mb-3">
            <Link to="/site-visits" className="text-xs font-semibold tracking-[0.12em] uppercase hover:underline" style={{ color: 'var(--cc-text-muted)' }}>Site Visits (7d)</Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0E749020' }}>
              <ClipboardList size={16} color="#0E7490" />
            </div>
          </div>
          <div className="font-mono-data text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>
            {svValue}
          </div>
          {svStats && (
            <div className="mt-1.5 text-[11px] flex items-center gap-1 flex-wrap" data-testid="kpi-site-visits-sub">
              <Link to="/site-visits?status=draft" className="hover:underline font-semibold" style={{ color: svStats.draft > 0 ? '#92400E' : 'var(--cc-text-muted)' }} data-testid="kpi-sv-draft-link">{svStats.draft} draft</Link>
              <span style={{ color: 'var(--cc-text-muted)' }}>·</span>
              <Link to="/site-visits?status=submitted" className="hover:underline font-semibold" style={{ color: svStats.submitted > 0 ? '#065F46' : 'var(--cc-text-muted)' }} data-testid="kpi-sv-submitted-link">{svStats.submitted} submitted</Link>
              <span style={{ color: 'var(--cc-text-muted)' }}>(last {svStats.days || 7} days)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardKPI;
