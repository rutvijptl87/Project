import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import { ArrowLeft, Phone, Mail, Pencil, FileText, Eye, Compass, IndianRupee, Briefcase, FileSignature, Trash2, ArrowRightLeft, Save, X, MapPin } from 'lucide-react';
import { downloadFile } from '../lib/download';
import { useUndo } from '../lib/undo';
import Modal from '../components/Modal';
import { logger } from '../lib/logger';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

const ArchitectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { schedule } = useUndo();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [moveModal, setMoveModal] = useState(null); // the project being moved, or null
  const [allArchitects, setAllArchitects] = useState([]);
  const [moveQuery, setMoveQuery] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', firm: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [fetchingGstin, setFetchingGstin] = useState(false);

  const handleFetchGSTIN = async () => {
    if (!editForm.gstin || !GSTIN_REGEX.test(editForm.gstin)) {
      toast.error('Invalid GSTIN format');
      return;
    }
    setFetchingGstin(true);
    try {
      const { data } = await api.get(`/clients/verify-gstin/${editForm.gstin}`);
      setEditForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        firm: data.name || prev.firm,
        pan: data.pan || prev.pan,
        place_of_supply: data.place_of_supply || prev.place_of_supply,
        address: data.principal_address || prev.address,
      }));
      toast.success('GSTIN details fetched successfully');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to fetch GSTIN details');
    } finally {
      setFetchingGstin(false);
    }
  };
  // Documents move modal — re-assigns a confirmed/draft document to a different architect
  const [docMove, setDocMove] = useState(null); // {doc, query, busy}
  const [docMoveQuery, setDocMoveQuery] = useState('');
  const [docMoveBusy, setDocMoveBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/architects/${id}`);
      setData(r.data);
    } catch {
      navigate('/architects');
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;
  if (!data) return null;

  const { architect: a, projects, stats } = data;
  const audits = data.audits || [];
  const documents = data.documents || [];
  const visibleProjects = projects.filter((p) => !hiddenIds.has(p.id));
  // Combined project + audit list, sorted newest first.
  const combined = [
    ...visibleProjects.map((p) => ({ ...p, __kind: 'project' })),
    ...audits.map((a) => ({ ...a, __kind: 'audit' })),
  ].sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));

  const handleDelete = (p) => {
    
    setHiddenIds((s) => new Set([...s, p.id]));
    schedule({
      label: `Project ${p.project_code} deleted`,
      onCommit: async () => {
        try { await api.delete(`/projects/${p.id}`); }
        catch (e) { logger.error('Project delete failed:', e); }
        finally { load(); }
      },
      onUndo: () => {
        setHiddenIds((s) => { const n = new Set(s); n.delete(p.id); return n; });
      },
    });
  };

  const openMove = async (p) => {
    setMoveModal(p);
    setMoveQuery('');
    if (allArchitects.length === 0) {
      try {
        const r = await api.get('/architects');
        setAllArchitects(r.data);
      } catch (e) { logger.warn('Failed to load architects for move:', e); }
    }
  };

  const performMove = async (targetArchitectId) => {
    if (!moveModal) return;
    setMoveBusy(true);
    try {
      await api.put(`/projects/${moveModal.id}`, { ...moveModal, architect_id: targetArchitectId || null });
      setMoveModal(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to move project');
    } finally { setMoveBusy(false); }
  };

  const moveTargets = allArchitects.filter((x) => x.id !== a.id);
  const filteredTargets = moveQuery.trim()
    ? moveTargets.filter((x) => {
        const q = moveQuery.toLowerCase();
        return ['name', 'firm', 'phone', 'email'].some((k) => (x[k] || '').toLowerCase().includes(q));
      })
    : moveTargets;

  const openEdit = () => {
    setEditForm({ name: a.name || '', phone: a.phone || '', email: a.email || '', firm: a.firm || '' });
    setEditError('');
    setEditOpen(true);
  };

  // Open the document-move modal (lazy-loads architect list if needed).
  const openDocMove = async (d) => {
    setDocMove(d);
    setDocMoveQuery('');
    if (allArchitects.length === 0) {
      try {
        const r = await api.get('/architects');
        setAllArchitects(r.data);
      } catch (e) { logger.warn('Failed to load architects for doc move:', e); }
    }
  };

  // Reassign the document to a different architect via PUT /documents/:id.
  // We send the full existing payload + the new architect_id so the server
  // doesn't blank out other fields.
  const performDocMove = async (targetArchitectId) => {
    if (!docMove) return;
    setDocMoveBusy(true);
    try {
      const payload = {
        doc_type_id: docMove.doc_type_id,
        doc_number: docMove.doc_number || '',
        document_date: docMove.document_date || null,
        client_id: docMove.client_id || null,
        architect_id: targetArchitectId || null,
        plot_place: docMove.plot_place || '',
        phase: docMove.phase || '',
        number_field: docMove.number_field || '',
        remark: docMove.remark || '',
        contact_person: docMove.contact_person || '',
        mobile: docMove.mobile || '',
        other_comments: docMove.other_comments || '',
        update_date: docMove.update_date || null,
      };
      await api.put(`/documents/${docMove.id}`, payload);
      setDocMove(null);
      load();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e?.response?.data?.detail || 'Failed to move document');
    } finally { setDocMoveBusy(false); }
  };

  const docMoveFilteredTargets = (docMoveQuery.trim()
    ? moveTargets.filter((x) => {
        const q = docMoveQuery.toLowerCase();
        return ['name', 'firm', 'phone', 'email'].some((k) => (x[k] || '').toLowerCase().includes(q));
      })
    : moveTargets);

  const submitEdit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editForm.name.trim()) { setEditError('Name is required'); return; }
    setEditSaving(true);
    try {
      await api.put(`/architects/${a.id}`, editForm);
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err?.response?.data?.detail || 'Failed to save');
    } finally { setEditSaving(false); }
  };

  const deleteArchitect = async () => {
    const linked = projects.length + documents.length;
    const lines = [
      `Are you sure you want to delete architect "${a.name}"?`,
      '',
      linked > 0
        ? `${projects.length} project(s) and ${documents.length} document(s) will be unlinked (not deleted).`
        : 'No projects or documents are linked to this architect.',
      '',
      'This cannot be undone from the architects list.',
    ];
    
    try {
      await api.delete(`/architects/${a.id}`);
      navigate('/architects');
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete architect');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="architect-detail-page">
      <Link to="/architects" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3" data-testid="btn-back">
        <ArrowLeft size={14}/> Back to Architects
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-surface)' }}>
            <Compass size={26} color="var(--cc-accent)"/>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Architect</div>
            <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }} data-testid="architect-name">{a.name}</h1>
            {a.firm && <div className="inline-flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}><Briefcase size={13}/> {a.firm}</div>}
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              {a.phone && (
                <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 link-underline" data-testid="architect-phone">
                  <Phone size={13}/> {a.phone}
                </a>
              )}
              {a.email && (
                <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 link-underline" data-testid="architect-email">
                  <Mail size={13}/> {a.email}
                </a>
              )}
              {a.address && (
                <span className="inline-flex items-center gap-1 text-gray-600" data-testid="architect-address">
                  <MapPin size={13}/> {a.address}
                </span>
              )}
            </div>
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              {a.gstin && (
                <span className="inline-flex items-center gap-1 text-gray-600 font-mono-data text-xs" data-testid="architect-gstin">
                  <strong>GSTIN:</strong> {a.gstin}
                </span>
              )}
              {a.pan && (
                <span className="inline-flex items-center gap-1 text-gray-600 font-mono-data text-xs" data-testid="architect-pan">
                  <strong>PAN:</strong> {a.pan}
                </span>
              )}
              {a.place_of_supply && (
                <span className="inline-flex items-center gap-1 text-gray-600 font-mono-data text-xs" data-testid="architect-pos">
                  <strong>POS:</strong> {a.place_of_supply}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">
          <button onClick={openEdit} className="btn btn-outline" data-testid="btn-edit-architect">
            <Pencil size={14}/> Edit
          </button>
          <button onClick={deleteArchitect} className="btn btn-danger" data-testid="btn-delete-architect">
            <Trash2 size={14}/> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total Work Items" value={`${stats.total_projects} projects · ${stats.total_audits || 0} audits`} />
        <Kpi label="Total Quoted" value={formatINR(stats.total_quoted)} />
        <Kpi label="Received" value={formatINR(stats.total_received)} color="var(--cc-accent)" />
        <Kpi label="Outstanding" value={formatINR(stats.total_outstanding)} color="#DC2626" />
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold" style={{ color: 'var(--cc-dark-green)' }}>
            Projects &amp; Audits for {a.name} ({combined.length})
          </h2>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            {visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} • {audits.length} audit{audits.length !== 1 ? 's' : ''} • {stats.outstanding_count} outstanding • {stats.settled_count} settled
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="architect-projects-table">
            <thead>
              <tr>
                <th>Job No</th>
                <th>Project Name</th>
                <th>Name</th>
                <th className="hidden md:table-cell">Client</th>
                <th className="hidden md:table-cell">Site Location</th>
                <th className="text-right hidden sm:table-cell">Quoted (₹)</th>
                <th className="text-right hidden sm:table-cell">Received (₹)</th>
                <th className="text-right">Outstanding (₹)</th>
                <th className="hidden sm:table-cell text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {combined.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>No projects or audits linked to this architect yet.</td></tr>
              ) : combined.map((p) => p.__kind === 'audit' ? (
                <tr key={`audit-${p.id}`} data-testid={`arch-audit-row-${p.audit_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: '#7C3AED' }}>{p.audit_code}</td>
                  <td><span className="badge" style={{ background: '#EDE9FE', color: '#5B21B6' }}>Audit</span></td>
                  <td className="font-medium">{p.audit_offer || p.notes || '—'}</td>
                  <td className="hidden md:table-cell">{p.client_name || p.client_name_override || <span className="text-gray-400">—</span>}</td>
                  <td className="max-w-[200px] hidden md:table-cell text-gray-400">—</td>
                  <td className="num hidden sm:table-cell">{formatINR(p.total_amount, { withSymbol: false })}</td>
                  <td className="num hidden sm:table-cell">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold text-xs" style={{ color: (p.outstanding_amount || 0) > 0 ? 'var(--cc-accent)' : 'var(--cc-dark-green)' }}>{formatINR(p.outstanding_amount || 0)}</td>
                  <td className="hidden sm:table-cell text-center">
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="grid grid-cols-1 gap-1 w-max mx-auto">
                      <Link to={`/audits/${p.id}`} className="btn btn-outline btn-sm" title="View audit">
                        <Eye size={13}/>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} data-testid={`arch-project-row-${p.project_code}`}>
                  <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.job_no || '—'}</td>
                  <td><span className="badge" style={{ background: '#D1FAE5', color: '#065F46' }}>Project</span></td>
                  <td className="font-medium">{p.name}</td>
                  <td className="hidden md:table-cell">{p.client_name || <span className="text-gray-400">None</span>}</td>
                  <td className="max-w-[200px] hidden md:table-cell"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                  <td className="num hidden sm:table-cell">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                  <td className="num hidden sm:table-cell">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold text-xs" style={{ color: p.outstanding_amount > 0 ? 'var(--cc-accent)' : 'var(--cc-dark-green)' }}>{formatINR(p.outstanding_amount)}</td>
                  <td className="hidden sm:table-cell text-center">
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="grid grid-cols-2 gap-1 w-max mx-auto">
                      <Link to={`/projects/${p.id}`} className="btn btn-outline btn-sm" data-testid={`arch-view-${p.project_code}`} title="View project">
                        <Eye size={13}/>
                      </Link>
                      <button onClick={() => openMove(p)} className="btn btn-outline btn-sm" title="Move to another architect" data-testid={`arch-move-${p.project_code}`}>
                        <ArrowRightLeft size={13}/>
                      </button>
                      <button onClick={() => handleDelete(p)} className="btn btn-danger btn-sm" title="Delete project (60s undo)" data-testid={`arch-delete-${p.project_code}`}>
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

      {/* Documents linked to this architect */}
      <div className="card overflow-hidden mt-6" data-testid="architect-documents-card">
        <div className="p-5 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <FileSignature size={18}/> Documents linked to {a.name} ({documents.length})
          </h2>
          <Link to="/documents" className="btn btn-outline btn-sm" data-testid="architect-go-to-documents">Manage Documents</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="architect-documents-table">
            <thead>
              <tr>
                <th>Document No.</th>
                <th>Type</th>
                <th className="hidden sm:table-cell">Client</th>
                <th className="hidden md:table-cell">Plot / Place</th>
                <th>Date</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No documents linked to this architect yet.</td></tr>
              ) : documents.map((d) => (
                <tr key={d.id} data-testid={`architect-doc-row-${d.id}`}>
                  <td className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{d.doc_number}</td>
                  <td className="text-sm">{d.doc_type_name}</td>
                  <td className="text-sm hidden sm:table-cell">{d.client_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm max-w-[220px] hidden md:table-cell"><div className="line-clamp-2">{d.plot_place || '—'}</div></td>
                  <td className="text-xs font-mono-data">{(d.document_date || '').slice(0, 10) || '—'}</td>
                  <td>
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => openDocMove(d)}
                        className="btn btn-outline btn-sm"
                        title="Move to another architect"
                        data-testid={`architect-doc-move-${d.id}`}
                      >
                        <ArrowRightLeft size={13}/>
                      </button>
                      <button onClick={() => downloadFile(`${API}/documents/${d.id}/pdf`)} className="btn btn-outline btn-sm" title="Download PDF" data-testid={`architect-doc-pdf-${d.id}`}>
                        <FileText size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!moveModal}
        onClose={() => setMoveModal(null)}
        title={moveModal ? `Move ${moveModal.project_code} to another architect` : ''}
        testId="move-project-modal"
      >
        <div className="space-y-3">
          <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Currently assigned to <span className="font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{a.name}</span>. Pick a new architect below.
          </div>
          <input
            className="input"
            value={moveQuery}
            onChange={(e) => setMoveQuery(e.target.value)}
            placeholder="Search architect by name, firm, phone, email…"
            autoFocus
            data-testid="move-project-search"
          />
          <div className="rounded-lg border max-h-80 overflow-y-auto" style={{ borderColor: 'var(--cc-border)' }}>
            <button
              type="button"
              onClick={() => performMove(null)}
              disabled={moveBusy}
              className="w-full text-left px-3 py-2 text-sm italic hover:bg-gray-50 border-b"
              style={{ color: 'var(--cc-text-muted)', borderColor: 'var(--cc-border)' }}
              data-testid="move-project-unassign"
            >
              — Unassign architect (leave blank) —
            </button>
            {filteredTargets.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--cc-text-muted)' }}>No other architects match.</div>
            ) : filteredTargets.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => performMove(x.id)}
                disabled={moveBusy}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                style={{ borderColor: 'var(--cc-border)' }}
                data-testid={`move-project-target-${x.id}`}
              >
                <div className="font-medium">{x.name}{x.firm ? <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--cc-text-muted)' }}>· {x.firm}</span> : null}</div>
                {(x.phone || x.email) && (
                  <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{x.phone}{x.phone && x.email ? ' · ' : ''}{x.email}</div>
                )}
              </button>
            ))}
          </div>
          {moveBusy && <div className="text-xs text-center" style={{ color: 'var(--cc-text-muted)' }}>Moving…</div>}
        </div>
      </Modal>

      <Modal
        open={!!docMove}
        onClose={() => setDocMove(null)}
        title={docMove ? `Move document ${docMove.doc_number} to another architect` : ''}
        testId="move-document-modal"
      >
        <div className="space-y-3">
          <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Currently linked to <span className="font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{a.name}</span>. Pick a new architect below — or unlink the document entirely.
          </div>
          <input
            className="input"
            value={docMoveQuery}
            onChange={(e) => setDocMoveQuery(e.target.value)}
            placeholder="Search architect by name, firm, phone, email…"
            autoFocus
            data-testid="move-document-search"
          />
          <div className="rounded-lg border max-h-80 overflow-y-auto" style={{ borderColor: 'var(--cc-border)' }}>
            <button
              type="button"
              onClick={() => performDocMove(null)}
              disabled={docMoveBusy}
              className="w-full text-left px-3 py-2 text-sm italic hover:bg-gray-50 border-b"
              style={{ color: 'var(--cc-text-muted)', borderColor: 'var(--cc-border)' }}
              data-testid="move-document-unassign"
            >
              — Unlink architect (leave blank) —
            </button>
            {docMoveFilteredTargets.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--cc-text-muted)' }}>No other architects match.</div>
            ) : docMoveFilteredTargets.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => performDocMove(x.id)}
                disabled={docMoveBusy}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                style={{ borderColor: 'var(--cc-border)' }}
                data-testid={`move-document-target-${x.id}`}
              >
                <div className="font-medium">{x.name}{x.firm ? <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--cc-text-muted)' }}>· {x.firm}</span> : null}</div>
                {(x.phone || x.email) && (
                  <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{x.phone}{x.phone && x.email ? ' · ' : ''}{x.email}</div>
                )}
              </button>
            ))}
          </div>
          {docMoveBusy && <div className="text-xs text-center" style={{ color: 'var(--cc-text-muted)' }}>Moving…</div>}
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Architect — ${a.name}`}
        testId="edit-architect-modal"
      >
        <form onSubmit={submitEdit} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              autoFocus
              data-testid="edit-architect-name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input
                className="input font-mono-data"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                data-testid="edit-architect-phone"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                data-testid="edit-architect-email"
              />
            </div>
          </div>
          <div>
            <label className="label">Firm</label>
            <input
              className="input"
              value={editForm.firm}
              onChange={(e) => setEditForm({ ...editForm, firm: e.target.value })}
              data-testid="edit-architect-firm"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={editForm.address || ''}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              data-testid="edit-architect-address"
              placeholder="e.g. 123 Main St"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">GSTIN</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={editForm.gstin || ''}
                  onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                  data-testid="edit-architect-gstin"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  maxLength={15}
                />
                <button type="button" onClick={handleFetchGSTIN} disabled={fetchingGstin || !editForm.gstin} className="btn btn-outline whitespace-nowrap">
                  {fetchingGstin ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">PAN</label>
              <input
                className="input"
                value={editForm.pan || ''}
                onChange={(e) => setEditForm({ ...editForm, pan: e.target.value })}
                data-testid="edit-architect-pan"
                placeholder="e.g. AAAAA0000A"
              />
            </div>
          </div>
          <div>
            <label className="label">Place of Supply (Code or State)</label>
            <input
              className="input"
              value={editForm.place_of_supply || ''}
              onChange={(e) => setEditForm({ ...editForm, place_of_supply: e.target.value })}
              data-testid="edit-architect-pos"
              placeholder="e.g. 27 or Maharashtra"
            />
          </div>
          {editError && <div className="text-sm text-red-600" data-testid="edit-architect-error">{editError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-outline"><X size={13}/> Cancel</button>
            <button type="submit" disabled={editSaving} className="btn btn-primary" data-testid="edit-architect-save">
              <Save size={13}/> {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const Kpi = ({ label, value, color }) => (
  <div className="card p-4">
    <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>{label}</div>
    <div className="font-mono-data text-2xl font-semibold mt-1" style={{ color: color || 'var(--cc-dark-green)' }}>{value}</div>
  </div>
);

export default ArchitectDetailPage;
