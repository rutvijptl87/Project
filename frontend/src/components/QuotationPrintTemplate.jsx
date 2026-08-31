import React, { forwardRef } from 'react';
import { format } from 'date-fns';

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  let path = url;
  if (!path.startsWith('/') && !path.startsWith('api/')) {
    path = `/api/uploads/test-images/${path}`;
  } else if (path.startsWith('api/')) {
    path = `/${path}`;
  }
  const backendUrl = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
  if (backendUrl) {
    return `${backendUrl}${path}`;
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === '3000') {
      return `${protocol}//${hostname}:8000${path}`;
    }
  }
  return path;
};

const getSiteAddressText = (form, siteAddresses = []) => {
  if (form.site_address_text && typeof form.site_address_text === 'string' && !form.site_address_text.startsWith('SADDR-') && !form.site_address_text.startsWith('ADDR-')) {
    return form.site_address_text.replace(/<br\s*\/?>/gi, ', ').replace(/\n+/g, ', ').trim();
  }

  const targetId = form.site_address || form.site_address_id;
  if (targetId && Array.isArray(siteAddresses) && siteAddresses.length > 0) {
    const found = siteAddresses.find(a => a.id === targetId || a.name === targetId);
    if (found) {
      const parts = [
        found.address_line1,
        found.address_line2,
        found.city,
        found.state ? (found.state.includes('-') ? found.state.split('-')[1] : found.state) : null,
        found.postal_code ? `PIN Code: ${found.postal_code}` : null,
        found.country
      ];
      return parts.filter(Boolean).map(p => String(p).trim()).filter(Boolean).join(', ');
    }
  }

  if (typeof form.site_address_display === 'string' && !form.site_address_display.startsWith('SADDR-') && !form.site_address_display.startsWith('ADDR-')) {
    return form.site_address_display.replace(/<br\s*\/?>/gi, ', ').replace(/\n+/g, ', ').trim();
  }

  if (typeof form.site_address === 'string' && !form.site_address.startsWith('SADDR-') && !form.site_address.startsWith('ADDR-')) {
    return form.site_address.replace(/<br\s*\/?>/gi, ', ').replace(/\n+/g, ', ').trim();
  }

  return '';
};

const renderRichText = (htmlContent, extraClass = 'mb-8') => {
  if (!htmlContent) return null;
  const isHtml = /<[a-z][\s\S]*>/i.test(htmlContent);
  return (
    <div
      className={`text-black text-[12px] leading-relaxed break-words [overflow-wrap:break-word] [word-break:normal] [&_*]:[word-break:normal] [&_*]:[overflow-wrap:break-word] [&_p]:mb-0 [&_p]:my-0 [&_p]:min-h-[1.2em] max-w-full ${extraClass} ${
        isHtml
          ? '[&_p]:max-w-full [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ul]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_ol]:max-w-full [&_li]:mb-0 [&_li]:max-w-full [&_h1]:text-[16px] [&_h1]:font-bold [&_h1]:my-1.5 [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:my-1 [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:my-1 [&_h4]:text-[12px] [&_h4]:font-bold [&_h4]:my-0.5 [&_h5]:text-[12px] [&_h5]:font-bold [&_h5]:my-0.5 [&_h6]:text-[11px] [&_h6]:font-bold [&_h6]:my-0.5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-1 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline'
          : 'whitespace-pre-wrap'
      }`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

const QuotationPrintTemplate = forwardRef(({ form, letterHead, printHeading, termsHTML, client, items, siteAddresses = [], jobSubTypes = [] }, ref) => {
  const footerImage = letterHead?.footer_image || letterHead?.image;
  const isLumpsum = Boolean(form?.is_lumpsum === true || form?.is_lumpsum === 'true' || form?.is_lumpsum === 1);
  const siteAddr = getSiteAddressText(form, siteAddresses || form?.siteAddresses);

  const checkIsDesign = () => {
    const jt = (form.job_type || '').trim().toLowerCase();
    const jst = (form.job_sub_type || '').trim().toLowerCase();
    if (jt.includes('design') || jst.includes('design')) return true;
    const allSubTypes = (jobSubTypes && jobSubTypes.length > 0) ? jobSubTypes : (form?.jobSubTypes || []);
    if (form.job_sub_type && Array.isArray(allSubTypes)) {
      const found = allSubTypes.find(s => s.name === form.job_sub_type);
      if (found && (found.parent_job_type_name || '').toLowerCase().includes('design')) {
        return true;
      }
    }
    return false;
  };

  const isDesign = checkIsDesign();

  return (
    <div ref={ref} className="bg-white text-black text-[12px] leading-relaxed relative shadow-md border border-gray-200 rounded-sm" style={{ width: '794px', minHeight: '1123px', padding: '40px 48px', fontFamily: '"Open Sans", sans-serif', boxSizing: 'border-box' }}>
      
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap');`}
      </style>

      {/* Header */}
      <div className="flex justify-between items-start mb-10 text-[15px] font-bold">
        <div>{form.quotation_no || form.id || 'DRAFT'}</div>
        <div>Date: {form.transaction_date ? format(new Date(form.transaction_date), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy')}</div>
      </div>

      {/* To */}
      <div className="mb-6 text-[12px]">
        <div className="font-bold mb-1">To,</div>
        <div className="font-bold">{client?.name || client?.client_name || form.client_name || 'Client Name'},</div>
        {(client?.address || client?.billing_address || form.address_display) && (
          <div className="whitespace-pre-wrap mt-2 leading-relaxed">
            {client?.address || client?.billing_address || form.address_display}
          </div>
        )}
      </div>

      {/* Subject */}
      <div className="mb-6 flex items-start text-[12px]">
        <span className="font-bold mr-2 whitespace-nowrap">Subject:</span>
        <span className="font-bold">
          {form.subject ? (
            form.subject.toLowerCase().startsWith('proposal for') ? form.subject : `Proposal for ${form.subject}`
          ) : (
            (() => {
              const components = isDesign
                ? [form.job_sub_type || form.job_type, siteAddr]
                : [form.job_sub_type || form.job_type, client?.name || client?.client_name || form.client_name, siteAddr];
              return `Proposal for ${components.filter(Boolean).join(' - ')}`;
            })()
          )}
        </span>
      </div>

      {/* Greetings */}
      {renderRichText(form.greetings, 'mb-8')}

      {/* Pricing Details */}
      <div className="mb-4 text-[15px] font-bold">
        Pricing Details-
      </div>
      <table className="w-full border-collapse border border-black text-[12px] mb-6">
        <thead className="bg-white">
          {isLumpsum ? (
            <tr>
              <th className="border border-black px-4 py-2 w-16 text-center font-bold">Sr</th>
              <th className="border border-black px-4 py-2 text-left font-bold">Description</th>
              <th className="border border-black px-4 py-2 w-32 text-center font-bold">Amount</th>
            </tr>
          ) : (
            <tr>
              <th className="border border-black px-4 py-2 w-16 text-center font-bold">Sr</th>
              <th className="border border-black px-4 py-2 text-left font-bold">Description</th>
              <th className="border border-black px-4 py-2 w-24 text-center font-bold">Number</th>
              <th className="border border-black px-4 py-2 w-24 text-center font-bold">Rate</th>
              <th className="border border-black px-4 py-2 w-32 text-center font-bold">Amount</th>
            </tr>
          )}
        </thead>
        <tbody>
          {(() => {
            const validItems = (items || []).filter(item => {
              const code = String(item?.item_code || '').trim();
              const name = String(item?.item_name || '').trim();
              const desc = String(item?.description || '').trim();
              return Boolean(code || name || desc);
            });
            return validItems.map((item, index) => {
              const qty = item.number ?? item.qty ?? 0;
              const rate = item.rate ?? 0;
              const calcAmt = Number(qty) * Number(rate);
              const itemAmt = (item.amount && Number(item.amount) > 0) ? Number(item.amount) : (item.taxable_value && Number(item.taxable_value) > 0 ? Number(item.taxable_value) : calcAmt);
              
              const renderDescription = () => {
                const text = String(item.item_code || item.item_name || item.description || '').trim();
                const isHtml = text.startsWith('<');
                return isHtml ? (
                  <div className="font-normal break-words [overflow-wrap:break-word] [word-break:normal] [&_*]:[word-break:normal] [&_*]:whitespace-normal" dangerouslySetInnerHTML={{ __html: text }} />
                ) : (
                  <div className="font-normal break-words [overflow-wrap:break-word] [word-break:normal]">{text}</div>
                );
              };

              return isLumpsum ? (
                <tr key={index}>
                  <td className="border border-black px-4 py-2 text-center">{index + 1}</td>
                  <td className="border border-black px-4 py-2">
                    {renderDescription()}
                  </td>
                  <td className="border border-black px-4 py-2 text-center font-normal">{itemAmt ? Number(itemAmt).toLocaleString('en-IN') : '0'}</td>
                </tr>
              ) : (
                <tr key={index}>
                  <td className="border border-black px-4 py-2 text-center">{index + 1}</td>
                  <td className="border border-black px-4 py-2">
                    {renderDescription()}
                  </td>
                  <td className="border border-black px-4 py-2 text-center font-normal">{qty}</td>
                  <td className="border border-black px-4 py-2 text-center font-normal">{rate ? Number(rate).toLocaleString('en-IN') : '0'}</td>
                  <td className="border border-black px-4 py-2 text-center font-normal">{itemAmt ? Number(itemAmt).toLocaleString('en-IN') : '0'}</td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>

      <div className="text-[15px] font-bold mb-4">
        GST (18%): Rs {(form.total_taxes_and_charges || 0).toLocaleString('en-IN')}
      </div>
      <div className="text-[15px] font-bold mb-4">
        Grand Total (Inclusive of GST): Rs {(form.grand_total || 0).toLocaleString('en-IN')}
      </div>
      <div className="text-[15px] font-bold mb-10">
        Amount in Words: {(() => {
          const rawWords = form.amount_in_words || form.in_words || '';
          if (!rawWords) return '';
          return rawWords.startsWith('INR') ? rawWords : `INR ${rawWords}`;
        })()}
      </div>

      

      {form.scope_of_work_details && renderRichText(form.scope_of_work_details, 'mb-8')}

      {/* Test Table Intro */}
      <div className="text-[12px] font-bold mb-1">
        We shall carry out this survey & submit the report. Our professional fees will be as follows.
      </div>
      <div className="text-[12px] font-bold mb-6">
        The cost includes NDT (Advance Test)
      </div>

      <div className="text-[12px] font-bold mb-4">
        Following work is included -
      </div>

      <table className="w-full border-collapse border border-black text-[12px] mb-10">
        <thead className="bg-white">
          <tr>
            <th className="border border-black px-4 py-2 w-16 text-center font-bold">Sr</th>
            <th className="border border-black px-4 py-2 text-left font-bold">Test</th>
            <th className="border border-black px-4 py-2 w-32 text-center font-bold">Points</th>
          </tr>
        </thead>
        <tbody>
          {form.test_details && form.test_details.length > 0 ? form.test_details.map((test, index) => (
            <tr key={index}>
              <td className="border border-black px-4 py-2 text-center">{index + 1}</td>
              <td className="border border-black px-4 py-2 font-normal">{test.test_name}</td>
              <td className="border border-black px-4 py-2 text-center">{test.points || 0}</td>
            </tr>
          )) : (
            <tr><td colSpan="3" className="border border-black p-4 text-center">No tests specified</td></tr>
          )}
        </tbody>
      </table>

      {/* Payment Schedule */}
      <div className="font-bold text-[15px] mb-4 mt-8">Payment Schedule</div>
      <table className="w-full border-collapse border border-black text-[12px] mb-10">
        <thead className="bg-white">
          <tr>
            <th className="border border-black px-4 py-2 w-16 text-center font-bold">Sr</th>
            <th className="border border-black px-4 py-2 text-left font-bold">Payment Term</th>
            <th className="border border-black px-4 py-2 text-center font-bold">Invoice Portion</th>
            <th className="border border-black px-4 py-2 text-right font-bold">Payment Amount</th>
          </tr>
        </thead>
        <tbody>
          {form.payment_schedule && form.payment_schedule.length > 0 ? form.payment_schedule.map((sch, index) => {
            const rawAmt = sch.payment_amount ?? sch.amount ?? sch.value;
            let finalAmt = 0;
            if (rawAmt !== undefined && rawAmt !== null && rawAmt !== '' && !isNaN(Number(rawAmt)) && Number(rawAmt) > 0) {
              finalAmt = Number(rawAmt);
            } else if (sch.invoice_portion) {
              const portion = parseFloat(String(sch.invoice_portion).replace(/[^0-9.]/g, ''));
              const total = form.grand_total || form.rounded_total || form.net_total || 0;
              if (!isNaN(portion) && total > 0) {
                finalAmt = (portion / 100) * total;
              }
            }
            return (
              <tr key={index}>
                <td className="border border-black px-4 py-2 text-center">{index + 1}</td>
                <td className="border border-black px-4 py-2 font-normal">{sch.payment_term}</td>
                <td className="border border-black px-4 py-2 text-center">{sch.invoice_portion !== undefined && sch.invoice_portion !== null ? (String(sch.invoice_portion).includes('%') ? sch.invoice_portion : `${sch.invoice_portion}%`) : ''}</td>
                <td className="border border-black px-4 py-2 text-right font-normal">
                  {finalAmt ? finalAmt.toLocaleString('en-IN') : (rawAmt !== undefined && rawAmt !== null && rawAmt !== '' ? Number(rawAmt).toLocaleString('en-IN') : '')}
                </td>
              </tr>
            );
          }) : (
            <tr><td colSpan="4" className="border border-black p-4 text-center">No payment schedule specified</td></tr>
          )}
        </tbody>
      </table>

      {/* Terms & Conditions */}
      <div className="font-bold text-[15px] mb-4 mt-8">Terms & Conditions</div>
      {termsHTML && renderRichText(termsHTML, 'mb-12')}

      {/* Sign off and Bank Details */}
      <div className="flex justify-between items-start mt-8 text-[12px] mb-12 page-break-inside-avoid">
        <div>
          <div className="mb-12">Thanking You,<br/>Yours faithfully,</div>
          <div className="font-bold mt-16">M/S. CREATOR RCC CONSULTANT LLP</div>
          <div className="font-bold">Mr. Rutvij Patel</div>
          <div>Consulting Structural Engineer</div>
        </div>
        
        <div className="border border-black p-4 w-[350px]">
          <div className="font-bold mb-3">KOTAK BANK,</div>
          <div className="font-normal text-[12px] mb-2">CREATOR RCC CONSULTANT LLP</div>
          <div className="font-normal text-[12px] mb-2">A/C - 9987076241</div>
          <div className="font-normal text-[12px] mb-2">IFSC - KKBK0001360</div>
          <div className="font-normal text-[12px]">Branch - Airoli, Sector 6</div>
        </div>
      </div>

      {/* Tests with Photos at the very end */}
      {form.test_details && form.test_details.length > 0 && (
        <div className="break-before-page pt-8">
          <div className="font-bold underline text-[15px] mb-8">Tests to be Done</div>
          {form.test_details.map((test, idx) => (
            <div key={idx} className="mb-10 page-break-inside-avoid">
              <div className="font-bold underline text-[15px] mb-4">{test.test_name}</div>
              {test.test_description && renderRichText(test.test_description, 'mb-4')}
              {test.test_image && (
                <div className="mt-3 flex justify-start">
                  <img
                    src={getImageUrl(test.test_image)}
                    alt={test.test_name}
                    style={{
                      maxWidth: '450px',
                      maxHeight: '280px',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain'
                    }}
                    className="rounded border border-gray-300 shadow-sm"
                    onError={(e) => {
                      if (!e.target.dataset.triedFallback && test.test_image) {
                        e.target.dataset.triedFallback = 'true';
                        const fname = test.test_image.split('/').pop();
                        const base = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
                        const hostBase = base || (typeof window !== 'undefined' && window.location.port === '3000' ? `${window.location.protocol}//${window.location.hostname}:8000` : '');
                        const fallbackPath = `/api/uploads/test-images/${fname}`;
                        e.target.src = hostBase ? `${hostBase}${fallbackPath}` : fallbackPath;
                      } else {
                        e.target.style.display = 'none';
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer is now handled dynamically on every page via jsPDF in QuotationCreatePage */}
    </div>
  );
});

export default QuotationPrintTemplate;
