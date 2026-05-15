import { api } from './api';

/**
 * Trigger an authenticated file download in the current tab.
 * Uses axios (which carries the JWT) to fetch the file as a Blob,
 * then saves it via a temporary anchor element.
 *
 * Why not <a href>? Browser-driven navigation can't add the
 * `Authorization: Bearer <token>` header, so the backend would
 * reject the request with 401 "Not authenticated".
 */
export const downloadFile = async (url, filename = '') => {
  // `url` may be absolute (`${API}/projects/.../invoice`) or relative.
  // Strip the API base if present so axios's baseURL doesn't double up.
  let relative = url;
  if (api?.defaults?.baseURL && url.startsWith(api.defaults.baseURL)) {
    relative = url.slice(api.defaults.baseURL.length);
  }

  const response = await api.get(relative, { responseType: 'blob' });

  // Use the server-supplied filename if any, else what we were asked to use.
  let resolvedName = filename;
  if (!resolvedName) {
    const disp = response.headers['content-disposition'] || '';
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disp);
    if (m && m[1]) resolvedName = decodeURIComponent(m[1]);
  }
  if (!resolvedName) resolvedName = 'download';

  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data]);
  const blobUrl = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = resolvedName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Release the blob URL after the click registers
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
};
