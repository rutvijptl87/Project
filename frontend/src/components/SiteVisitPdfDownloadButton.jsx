import React from 'react';
import { FileText } from 'lucide-react';

const BACKEND = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Site-Visit PDF download — uses direct `window.location.href = url` which is
 * the most universally-supported download trigger.
 *
 * How it works:
 *  - Backend serves the PDF with `Content-Disposition: attachment`
 *  - When the browser navigates to such a URL, it downloads the file and
 *    STAYS on the current page (no actual navigation happens for attachments)
 *  - This is rock-solid across every browser, every device, every extension,
 *    popup blocker, PWA standalone mode, etc.
 *  - No async, no axios, no blob URL, no download attribute, no target=_blank
 */
const SiteVisitPdfDownloadButton = ({ visit, variant = 'primary' }) => {
  const url = visit.public_token
    ? `${BACKEND}/api/site-visits/public/${visit.public_token}/pdf`
    : `${BACKEND}/api/site-visits/${visit.id}/pdf`;

  const handleClick = () => {
    window.location.href = url;
  };

  const className = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-outline btn-sm'}`;
  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      data-testid="btn-download-pdf"
    >
      <FileText size={variant === 'primary' ? 14 : 13} />
      {variant === 'primary' && <span> Download PDF</span>}
    </button>
  );
};

export default SiteVisitPdfDownloadButton;
