import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, CircleDollarSign, FileText } from 'lucide-react';
import { formatINR } from '../lib/format';

const KPICard = ({ label, value, icon: Icon, accent, delay = 0, testId }) => (
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
  </div>
);

const DashboardKPI = ({ stats }) => {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 animate-pulse h-[110px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
    </div>
  );
};

export default DashboardKPI;
