// Indian rupee formatting helper
export const formatINR = (value, { withSymbol = true, decimals = 2 } = {}) => {
  const num = Number(value || 0);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
  return withSymbol ? `₹\u00A0${formatted}` : formatted;
};

export const formatINRCompact = (value) => {
  const num = Number(value || 0);
  if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹ ${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹ ${(num / 1000).toFixed(1)} K`;
  return `₹ ${num.toFixed(0)}`;
};

export const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export const formatActivityDay = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfDate = new Date(d);
    startOfDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  } catch {
    return iso;
  }
};
