import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Robust cross-device Site-Visit PDF download.
 *
 * Why this is tricky:
 *  - Desktop browsers: a same-tab axios-blob save works best (no popup
 *    blocker, no "PDF opens in new tab" inline behavior).
 *  - Mobile / installed PWA: the axios-then-click flow loses the user
 *    gesture and silently fails. A plain `<a href download target="_blank">`
 *    is the only reliable path.
 *
 * So at click time we detect the device and pick the right strategy.
 */
const SiteVisitPdfDownloadButton = ({ visit, variant = 'primary' }) => {
  const [busy, setBusy] = useState(false);

  const isMobileOrPwa = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const touch = (navigator.maxTouchPoints || 0) > 1;
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true;
    return standalone || (touch && narrow) || /Android|iPhone|iPad|iPod/i.test(ua);
  };

  // Same-tab axios blob save — works on all desktop browsers, no popups.
  const desktopSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Authenticated endpoint, returns the same PDF
      const res = await api.get(`/site-visits/${visit.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${visit.visit_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) {
      // Fall back to opening the public URL in a new tab
      if (visit.public_token) {
        window.open(`${BACKEND}/api/site-visits/public/${visit.public_token}/pdf`, '_blank');
      } else {
        // eslint-disable-next-line no-alert
        alert('Could not download the PDF. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const className = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-outline btn-sm'}`;

  // Mobile / PWA path — plain anchor that fires from the user gesture
  if (isMobileOrPwa() && visit.public_token) {
    return (
      <a
        href={`${BACKEND}/api/site-visits/public/${visit.public_token}/pdf`}
        target="_blank"
        rel="noopener"
        download={`${visit.visit_code}.pdf`}
        className={className}
        data-testid="btn-download-pdf"
      >
        <FileText size={variant === 'primary' ? 14 : 13} />
        {variant === 'primary' && <span> Download PDF</span>}
      </a>
    );
  }

  // Desktop path — same-tab axios blob save (no popups, no inline viewer)
  return (
    <button
      type="button"
      onClick={desktopSave}
      disabled={busy}
      className={className}
      data-testid="btn-download-pdf"
    >
      {busy ? <Loader2 size={variant === 'primary' ? 14 : 13} className="animate-spin" /> : <FileText size={variant === 'primary' ? 14 : 13} />}
      {variant === 'primary' && <span> {busy ? 'Preparing…' : 'Download PDF'}</span>}
    </button>
  );
};

export default SiteVisitPdfDownloadButton;
