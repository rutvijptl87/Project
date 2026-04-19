import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import DashboardKPI from '../components/DashboardKPI';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { Plus, Search, Download, Upload, Eye, CreditCard, Pencil, Trash2, IndianRupee } from 'lucide-react';

const ProjectsPage = ({ showPayModal, setShowPayModal }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payTargetId, setPayTargetId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get('/projects', { params: search ? { search } : {} }),
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Delete project ${code}? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${id}`);
      showToast('Project deleted');
      load();
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const openPay = (id) => {
    setPayTargetId(id);
    setShowPayModal(true);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleExport = () => {
    window.open(`${API}/export/excel`, '_blank');
  };

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="projects-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--cc-dark-green)' }} data-testid="page-title">All Projects</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}>Track quotes, payments and receivables in one place.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
        </div>
      </div>

      <DashboardKPI stats={stats} />

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
          <button
            type="button"
            onClick={() => { setSearch(''); setTimeout(load, 0); }}
            className="btn btn-outline"
            data-testid="search-clear-btn"
          >Clear</button>
        )}
      </form>

      <div className="card overflow-hidden" data-testid="projects-table-card">
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="projects-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Client</th>
                <th>Architect</th>
                <th>Site Location</th>
                <th className="text-right">Quoted (₹)</th>
                <th className="text-right">Received (₹)</th>
                <th className="text-right">Outstanding (₹)</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>Loading projects...</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12">
                  <div className="font-head text-lg font-semibold" style={{ color: 'var(--cc-dark-green)' }}>No projects yet</div>
                  <div className="text-sm mb-4" style={{ color: 'var(--cc-text-muted)' }}>Start by creating your first project.</div>
                  <Link to="/projects/new" className="btn btn-primary inline-flex" data-testid="btn-empty-new-project"><Plus size={15}/> New Project</Link>
                </td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} data-testid={`project-row-${p.project_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.project_code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.client_name ? <span className="link-underline">{p.client_name}</span> : <span className="text-gray-400">None</span>}</td>
                  <td>{p.architect_name ? <span className="link-underline">{p.architect_name}</span> : <span className="text-gray-400">None</span>}</td>
                  <td className="max-w-[220px]"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                  <td className="num">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                  <td className="num">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold">{formatINR(p.outstanding_amount, { withSymbol: false })}</td>
                  <td>
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`} data-testid={`status-${p.project_code}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => navigate(`/projects/${p.id}`)} className="btn btn-outline btn-sm" title="View" data-testid={`btn-view-${p.project_code}`}>
                        <Eye size={13}/> View
                      </button>
                      <button onClick={() => openPay(p.id)} className="btn btn-accent btn-sm" title="Record Payment" data-testid={`btn-pay-${p.project_code}`}>
                        <IndianRupee size={13}/> Pay
                      </button>
                      <button onClick={() => navigate(`/projects/${p.id}/edit`)} className="btn btn-outline btn-sm" title="Edit" data-testid={`btn-edit-${p.project_code}`}>
                        <Pencil size={13}/>
                      </button>
                      <button onClick={() => handleDelete(p.id, p.project_code)} className="btn btn-danger btn-sm" title="Delete" data-testid={`btn-delete-${p.project_code}`}>
                        <Trash2 size={13}/>
                      </button>
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
