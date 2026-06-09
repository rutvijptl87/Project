import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatMonthLabel = (key) => {
  // key = "YYYY-MM"
  const [y, m] = key.split('-');
  const mi = parseInt(m, 10) - 1;
  const yy = String(y).slice(2);
  return `${MONTH_LABELS[mi] || m} '${yy}`;
};

const compactINR = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${v}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const proj = payload.find((p) => p.dataKey === 'project_amount')?.value || 0;
  const aud = payload.find((p) => p.dataKey === 'audit_amount')?.value || 0;
  const total = proj + aud;
  return (
    <div className="rounded-lg border shadow-md px-3 py-2 text-xs" style={{ background: '#fff', borderColor: 'var(--cc-border)' }}>
      <div className="font-semibold mb-1" style={{ color: 'var(--cc-dark-green)' }}>{label}</div>
      <div className="flex justify-between gap-4"><span style={{ color: 'var(--cc-text-muted)' }}>Projects</span><span className="font-mono-data">{formatINR(proj)}</span></div>
      <div className="flex justify-between gap-4"><span style={{ color: 'var(--cc-text-muted)' }}>Audits</span><span className="font-mono-data">{formatINR(aud)}</span></div>
      <div className="flex justify-between gap-4 border-t mt-1 pt-1 font-semibold" style={{ borderColor: 'var(--cc-border)', color: 'var(--cc-dark-green)' }}>
        <span>Total</span><span className="font-mono-data">{formatINR(total)}</span>
      </div>
    </div>
  );
};

const CHART_MARGIN = { top: 4, right: 6, left: 0, bottom: 4 };
const AXIS_TICK = { fontSize: 9, fill: '#6B7280' };
const AXIS_LINE = { stroke: '#E5E7EB' };
const TOOLTIP_CURSOR = { fill: 'rgba(16, 185, 129, 0.08)' };
const LEGEND_STYLE = { fontSize: 10 };
const BAR_RADIUS_FLAT = [0, 0, 0, 0];
const BAR_RADIUS_TOP = [4, 4, 0, 0];
const CONTAINER_STYLE = { width: '100%', height: 160 };

const MonthlyRevenueChart = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(12);

  const isAccount = user?.role === 'account';

  useEffect(() => {
    if (isAccount) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get('/dashboard/monthly-revenue', { params: { months: range } })
      .then((r) => {
        if (cancelled) return;
        const rows = (r.data?.months || []).map((m) => ({
          ...m,
          label: formatMonthLabel(m.month),
        }));
        setData(rows);
        setTotal(r.data?.total_received || 0);
      })
      .catch(() => { setData([]); setTotal(0); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, isAccount]);

  if (isAccount) return null;

  const hasAny = data.some((d) => (d.total || 0) > 0);

  return (
    <div className="card p-3 mb-4" data-testid="monthly-revenue-card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-head text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <TrendingUp size={14}/> Monthly Revenue
          </h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Last {range} mo</div>
            <div className="font-mono-data text-lg font-semibold" style={{ color: 'var(--cc-dark-green)' }} data-testid="monthly-revenue-total">{formatINR(total)}</div>
          </div>
          <select
            className="select select-sm"
            value={range}
            onChange={(e) => setRange(parseInt(e.target.value, 10))}
            data-testid="monthly-revenue-range"
            style={{ width: 110, fontSize: 11 }}
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
      </div>

      <div style={CONTAINER_STYLE} data-testid="monthly-revenue-chart">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
        ) : !hasAny ? (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            No payments recorded in the last {range} months yet.
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} tickFormatter={compactINR} width={48} />
              <Tooltip content={<CustomTooltip />} cursor={TOOLTIP_CURSOR} />
              <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" />
              <Bar dataKey="project_amount" stackId="a" name="Projects" fill="#10B981" radius={BAR_RADIUS_FLAT} />
              <Bar dataKey="audit_amount" stackId="a" name="Audits" fill="#0A2E1F" radius={BAR_RADIUS_TOP} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default MonthlyRevenueChart;
