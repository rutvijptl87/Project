import React from 'react';
import { FileText } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Cross-device Site-Visit PDF download.
 *
 * Why a plain `<a href download>` (no JS, no axios, no blob, no target_blank):
 *  - The backend serves the PDF with `Content-Disposition: attachment`, so every
 *    browser (desktop AND mobile) downloads instead of navigating or opening
 *    inline.
 *  - There's no `await` between the user click and the navigation, which is the
 *    only thing mobile browsers (especially installed PWAs) require to honor
 *    the download.
 *  - We use the no-auth public_token URL so the anchor works without any
 *    Authorization header. The token is the same long random one already used
 *    for WhatsApp sharing.
 *
 * If a visit somehow lacks a public_token (legacy data before tokens were
 * lazy-minted), we fall back to the authenticated URL — fine on desktop, may
 * fail on mobile PWA, but those visits are now re-tokenized on read anyway.
 */
const SiteVisitPdfDownloadButton = ({ visit, variant = 'primary' }) => {
  const url = visit.public_token
    ? `${BACKEND}/api/site-visits/public/${visit.public_token}/pdf`
    : `${BACKEND}/api/site-visits/${visit.id}/pdf`;
  const className = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-outline btn-sm'}`;
  return (
    <a
      href={url}
      download={`${visit.visit_code}.pdf`}
      rel="noopener"
      className={className}
      data-testid="btn-download-pdf"
    >
      <FileText size={variant === 'primary' ? 14 : 13} />
      {variant === 'primary' && <span> Download PDF</span>}
    </a>
  );
};

export default SiteVisitPdfDownloadButton;
