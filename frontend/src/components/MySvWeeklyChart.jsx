import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { Calendar, ClipboardList } from 'lucide-react';

const monthOptions = () => {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    out.push({ v, label });
  }
  return out;
};

const MySvWeeklyChart = () => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/my-sv-weekly', { params: { month } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  if (loading && !data) {
    return <div className="card p-4 animate-pulse h-[180px]" data-testid="my-sv-weekly-loading" />;
  }
  if (!data) return null;

  const total = data.total || 0;

  return (
    <div className="card p-4 mb-4" data-testid="my-sv-weekly-chart">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
        <div>
          <h3 className="font-head text-base font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <ClipboardList size={16}/> My Visits This Month
          </h3>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            <strong style={{ color: total > 0 ? 'var(--cc-dark-green)' : 'var(--cc-text-muted)' }}>{total}</strong> visits across the weeks.
            {data.by_project?.length > 0 && (
              <span className="ml-2">Top project: <strong>{data.by_project[0].project_code}</strong> ({data.by_project[0].count})</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} style={{ color: 'var(--cc-text-muted)' }}/>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="select select-sm"
            data-testid="my-sv-weekly-month"
          >
            {monthOptions().map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ width: '100%', height: 140 }}>
        <ResponsiveContainer>
          <BarChart data={data.weeks || []} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#737373' }} />
            <YAxis tick={{ fontSize: 11, fill: '#737373' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--cc-border)' }}
              cursor={{ fill: 'rgba(16,185,129,0.08)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="draft" stackId="a" fill="#FCD34D" name="Draft" radius={[0, 0, 0, 0]} />
            <Bar dataKey="submitted" stackId="a" fill="#10B981" name="Submitted" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MySvWeeklyChart;
