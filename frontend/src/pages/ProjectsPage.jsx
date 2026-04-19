import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import DashboardKPI from '../components/DashboardKPI';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { useAuth } from '../lib/auth';
import {
  Plus, Search, Download, Upload, Eye, Pencil, Trash2, IndianRupee,
  FileText, Archive, ArchiveRestore, ArrowUpDown, ArrowUp, ArrowDown,
  Phone, Mail,
} from 'lucide-react';
const SORTABLE_COLUMNS = {
  project_code: 'Project ID',
  name: 'Project Name',
  client_name: 'Client',
  architect_name: 'Architect',
  quoted_amount: 'Quoted',
  received_amount: 'Received',
  outstanding_amount: 'Outstanding',
  status: 'Status',
};

const ProjectsPage = ({ showPayModal, setShowPayModal }) => {
  const navigate = useNavigate();
  const { forceVerify } = useAuth();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payTargetId, setPayTargetId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (showArchived) params.archived_only = true;
      const [p, s] = await Promise.all([
        api.get('/projects', { params }),
        api.get('/dashboard/stats'),
      ]);
      setProjects(p.data);
      setStats(s.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showArchived]);

  const sortedProjects = useMemo(() => {
    if (!sortBy) return projects;
    const arr = [...projects];
    arr.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [projects, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="inline ml-1 opacity-50" />;
    return sortDir === 'asc'
      ? <ArrowUp size={11} className="inline ml-1" />
      : <ArrowDown size={11} className="inline ml-1" />;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const handleArchive = async (id, code) => {
    if (!window.confirm(`Archive project ${code}? It will be hidden from the main list but can be restored.`)) return;
    try {
      await api.post(`/projects/${id}/archive`);
      showToast('Project archived');
      load();
    } catch { showToast('Failed to archive', 'error'); }
  };

  const handleUnarchive = async (id, code) => {
    try {
      await api.post(`/projects/${id}/unarchive`);
      showToast(`Project ${code} restored`);
      load();
    } catch { showToast('Failed to restore', 'error'); }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE project ${code}?\n\nThis will also delete all its payments, quote revisions and activity history. This cannot be undone.`)) return;
    const ok = await forceVerify();
    if (!ok) return;
    try {
      await api.delete(`/projects/${id}`);
      showToast('Project deleted permanently');
      load();
    } catch { showToast('Delete failed', 'error'); }
  };

  const openPay = (id) => { setPayTargetId(id); setShowPayModal(true); };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleExport = () => window.open(`${API}/export/excel`, '_blank');
  const handleInvoice = (id) => window.open(`${API}/projects/${id}/invoice`, '_blank');

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/import/excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { imported } = r.data;
      showToast(`Imported: ${imported.projects} projects, ${imported.clients} clients, ${imported.architects} architects`);
      load();
    } catch (err) {
      showToast('Import failed: ' + (err?.response?.data?.detail || err.message), 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="projects-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--cc-dark-green)' }} data-testid="page-title">
            {showArchived ? 'Archived Projects' : 'All Projects'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>
            {showArchived ? 'Restore or permanently delete archived projects.' : 'Track quotes, payments and receivables in one place.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`btn ${showArchived ? 'btn-primary' : 'btn-outline'}`}
            data-testid="btn-toggle-archived"
          >
            <Archive size={15}/> {showArchived ? 'Back to Active' : 'View Archived'}
          </button>
          {!showArchived && <>
            <button onClick={handleExport} className="btn btn-outline" data-testid="btn-export-excel">
              <Download size={15} /> Export Excel
            </button>
            <button onClick={handleImportClick} disabled={importing} className="btn btn-outline" data-testid="btn-import-excel">
              <Upload size={15} /> {importing ? 'Importing...' : 'Import Historic'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" data-testid="import-file-input" />
            <Link to="/projects/new" className="btn btn-primary" data-testid="btn-new-project">
              <Plus size={15} /> New Project
            </Link>
          </>}
        </div>
      </div>

      {!showArchived && <DashboardKPI stats={stats} />}

      <form onSubmit={handleSearch} className="card p-3 mb-4 flex gap-2" data-testid="search-form">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by project ID, name, client, architect, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="search-input"
          />
        </div>
        <button type="submit" className="btn btn-accent" data-testid="search-btn">Search</button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setTimeout(load, 0); }} className="btn btn-outline" data-testid="search-clear-btn">Clear</button>
        )}
      </form>

      <div className="card overflow-hidden" data-testid="projects-table-card">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="projects-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('project_code')} className="cursor-pointer select-none" data-testid="sort-project_code">Project ID<SortIcon col="project_code"/></th>
                <th onClick={() => toggleSort('name')} className="cursor-pointer select-none" data-testid="sort-name">Project Name<SortIcon col="name"/></th>
                <th onClick={() => toggleSort('client_name')} className="cursor-pointer select-none" data-testid="sort-client_name">Client<SortIcon col="client_name"/></th>
                <th onClick={() => toggleSort('architect_name')} className="cursor-pointer select-none" data-testid="sort-architect_name">Architect<SortIcon col="architect_name"/></th>
                <th>Site Location</th>
                <th onClick={() => toggleSort('quoted_amount')} className="cursor-pointer select-none text-right" data-testid="sort-quoted_amount">Quoted (₹)<SortIcon col="quoted_amount"/></th>
                <th onClick={() => toggleSort('received_amount')} className="cursor-pointer select-none text-right" data-testid="sort-received_amount">Received (₹)<SortIcon col="received_amount"/></th>
                <th onClick={() => toggleSort('outstanding_amount')} className="cursor-pointer select-none text-right" data-testid="sort-outstanding_amount">Outstanding (₹)<SortIcon col="outstanding_amount"/></th>
                <th onClick={() => toggleSort('status')} className="cursor-pointer select-none" data-testid="sort-status">Status<SortIcon col="status"/></th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading projects...</td></tr>
              ) : sortedProjects.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <div className="font-head text-lg font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{showArchived ? 'No archived projects' : 'No projects yet'}</div>
                  <div className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>{showArchived ? 'Archived projects will appear here.' : 'Start by creating your first project.'}</div>
                  {!showArchived && <Link to="/projects/new" className="btn btn-primary inline-flex" data-testid="btn-empty-new-project"><Plus size={15}/> New Project</Link>}
                </td></tr>
              ) : sortedProjects.map((p) => (
                <tr key={p.id} data-testid={`project-row-${p.project_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.project_code}</td>
                  <td className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.offer_type && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={(() => {
                            const t = (p.offer_type || '').toLowerCase();
                            if (t === 'rcc') return { background: '#E0F2FE', color: '#075985', border: '1px solid #7DD3FC' };
                            if (t === 'steel') return { background: '#F3F4F6', color: '#374151', border: '1px solid #9CA3AF' };
                            if (t === 'audit') return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
                            if (t === 'pmc') return { background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD' };
                            return { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' };
                          })()}
                          title={p.offer_code ? `Offer: ${p.offer_code}` : undefined}
                        >
                          {p.offer_type}
                        </span>
                      )}
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    {p.client_name ? (
                      <div>
                        {p.client_id ? (
                          <Link to={`/clients/${p.client_id}`} className="link-underline hover:opacity-80" data-testid={`project-client-${p.project_code}`}>{p.client_name}</Link>
                        ) : (
                          <span data-testid={`project-client-${p.project_code}`}>{p.client_name}</span>
                        )}
                        {(p.client_phone || p.client_email) && (
                          <div className="flex gap-2 mt-0.5">
                            {p.client_phone && (
                              <a href={`tel:${p.client_phone}`} title={`Call ${p.client_phone}`} onClick={(e) => e.stopPropagation()} className="text-xs inline-flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--cc-accent)' }} data-testid={`client-call-${p.project_code}`}>
                                <Phone size={10}/>
                              </a>
                            )}
                            {p.client_email && (
                              <a href={`mailto:${p.client_email}`} title={`Email ${p.client_email}`} onClick={(e) => e.stopPropagation()} className="text-xs inline-flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--cc-accent)' }} data-testid={`client-email-${p.project_code}`}>
                                <Mail size={10}/>
                              </a>
                            )}
                            {p.client_phone && (
                              <a href={`https://wa.me/${String(p.client_phone).replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title={`WhatsApp ${p.client_phone}`} onClick={(e) => e.stopPropagation()} className="text-xs inline-flex items-center gap-1 hover:opacity-70" style={{ color: '#25D366' }} data-testid={`client-whatsapp-${p.project_code}`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-400">None</span>}
                  </td>
                  <td>
                    {p.architect_name ? (
                      <div>
                        {p.architect_id ? (
                          <Link to={`/architects/${p.architect_id}`} className="link-underline hover:opacity-80" data-testid={`project-architect-${p.project_code}`}>{p.architect_name}</Link>
                        ) : (
                          <span data-testid={`project-architect-${p.project_code}`}>{p.architect_name}</span>
                        )}
                        {(p.architect_phone || p.architect_email) && (
                          <div className="flex gap-2 mt-0.5">
                            {p.architect_phone && (
                              <a href={`tel:${p.architect_phone}`} title={`Call ${p.architect_phone}`} onClick={(e) => e.stopPropagation()} className="text-xs inline-flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--cc-accent)' }} data-testid={`architect-call-${p.project_code}`}>
                                <Phone size={10}/>
                              </a>
                            )}
                            {p.architect_email && (
                              <a href={`mailto:${p.architect_email}`} title={`Email ${p.architect_email}`} onClick={(e) => e.stopPropagation()} className="text-xs inline-flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--cc-accent)' }} data-testid={`architect-email-${p.project_code}`}>
                                <Mail size={10}/>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ) : <span className="text-gray-400">None</span>}
                  </td>
                  <td className="max-w-[220px]"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                  <td className="num">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                  <td className="num">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold">{formatINR(p.outstanding_amount, { withSymbol: false })}</td>
                  <td>
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`} data-testid={`status-${p.project_code}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end flex-wrap">
                      {showArchived ? (
                        <>
                          <button onClick={() => handleUnarchive(p.id, p.project_code)} className="btn btn-accent btn-sm" title="Restore" data-testid={`btn-restore-${p.project_code}`}>
                            <ArchiveRestore size={13}/> Restore
                          </button>
                          <button onClick={() => handleDelete(p.id, p.project_code)} className="btn btn-danger btn-sm" title="Delete permanently" data-testid={`btn-delete-${p.project_code}`}>
                            <Trash2 size={13}/>
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => navigate(`/projects/${p.id}`)} className="btn btn-outline btn-sm" title="View" data-testid={`btn-view-${p.project_code}`}>
                            <Eye size={13}/> View
                          </button>
                          <button onClick={() => openPay(p.id)} className="btn btn-accent btn-sm" title="Record Payment" data-testid={`btn-pay-${p.project_code}`}>
                            <IndianRupee size={13}/> Pay
                          </button>
                          <button onClick={() => handleInvoice(p.id)} className="btn btn-outline btn-sm" title="Download Invoice PDF" data-testid={`btn-invoice-${p.project_code}`}>
                            <FileText size={13}/>
                          </button>
                          <button onClick={() => navigate(`/projects/${p.id}/edit`)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-edit-${p.project_code}`}>
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => handleArchive(p.id, p.project_code)} className="btn btn-outline btn-sm" title="Archive" data-testid={`btn-archive-${p.project_code}`}>
                            <Archive size={13}/>
                          </button>
                          <button onClick={() => handleDelete(p.id, p.project_code)} className="btn btn-danger btn-sm" title="Delete permanently" data-testid={`btn-delete-${p.project_code}`}>
                            <Trash2 size={13}/>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecordPaymentModal
        open={showPayModal}
        onClose={() => { setShowPayModal(false); setPayTargetId(null); }}
        defaultProjectId={payTargetId}
        onSaved={() => { showToast('Payment recorded'); load(); }}
      />

      {toast && (
        <div
          className="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50"
          style={{ background: toast.type === 'error' ? '#DC2626' : 'var(--cc-dark-green)', color: '#fff' }}
          data-testid="toast"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
