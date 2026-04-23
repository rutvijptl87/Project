/**
 * Trigger a file download in the current tab (no new window/tab needed).
 * Works reliably on both desktop and mobile browsers without producing a
 * leftover blank tab that shows 404.
 */
export const downloadFile = (url, filename = '') => {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  if (filename) a.download = filename;
  else a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
