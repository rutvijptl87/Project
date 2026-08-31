import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, API } from '../lib/api';
import { formatINR } from '../lib/format';
import { ArrowLeft, Phone, Mail, Eye, FileText, Users, Building2, FileSignature, Pencil, Trash2, Save, X, ArrowRightLeft, CheckSquare, Download } from 'lucide-react';
import { downloadFile } from '../lib/download';
import Modal from '../components/Modal';
import Swal from 'sweetalert2';

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', company: '', address: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  // Move document → reassign a document to a different client.
  const [docMove, setDocMove] = useState(null);
  const [docMoveQuery, setDocMoveQuery] = useState('');
  const [docMoveBusy, setDocMoveBusy] = useState(false);
  const [allClients, setAllClients] = useState([]);

  // States for collapsed/expanded tasks list per project
  const [projectTasks, setProjectTasks] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});
  const [tasksLoading, setTasksLoading] = useState({});

  const toggleTasks = async (projectId) => {
    const isExpanded = !!expandedProjects[projectId];
    setExpandedProjects(prev => ({ ...prev, [projectId]: !isExpanded }));

    // Fetch tasks if expanding and not already loaded
    if (!isExpanded && !projectTasks[projectId]) {
      setTasksLoading(prev => ({ ...prev, [projectId]: true }));
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId } });
        setProjectTasks(prev => ({ ...prev, [projectId]: r.data || [] }));
      } catch (err) {
        console.error('Failed to load tasks for project', projectId, err);
      } finally {
        setTasksLoading(prev => ({ ...prev, [projectId]: false }));
      }
    }
  };

  const openDocMove = async (d) => {
    setDocMove(d);
    setDocMoveQuery('');
    if (allClients.length === 0) {
      try {
        const r = await api.get('/clients');
        setAllClients(r.data);
      } catch (err) {
        console.error('Failed to load clients for doc-move picker', err);
      }
    }
  };

  const performDocMove = async (targetClientId) => {
    if (!docMove) return;
    setDocMoveBusy(true);
    try {
      const payload = {
        doc_type_id: docMove.doc_type_id,
        doc_number: docMove.doc_number || '',
        document_date: docMove.document_date || null,
        client_id: targetClientId || null,
        architect_id: docMove.architect_id || null,
        plot_place: docMove.plot_place || '',
        phase: docMove.phase || '',
        number_field: docMove.number_field || '',
        remark: docMove.remark || '',
        audit_offer_path: docMove.audit_offer_path || '',
        audit_report_path: docMove.audit_report_path || '',
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

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/clients/${id}`);
      setData(r.data);
    } catch {
      navigate('/clients');
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="max-w-5xl mx-auto p-8">Loading...</div>;
  if (!data) return null;

  const { client: c, projects, stats } = data;
  const audits = data.audits || [];
  const documents = data.documents || [];
  // Combined list of projects + audits so they show in one "work items" table.
  const combined = [
    ...projects.map((p) => ({ ...p, __kind: 'project' })),
    ...audits.map((a) => ({ ...a, __kind: 'audit' })),
  ].sort((x, y) => (y.created_at || '').localeCompare(x.created_at || ''));
  const waPhone = c.phone ? String(c.phone).replace(/[^0-9]/g, '') : '';

  const docMoveTargets = (allClients || []).filter((x) => x.id !== c.id);
  const docMoveFiltered = docMoveQuery.trim()
    ? docMoveTargets.filter((x) => {
        const q = docMoveQuery.toLowerCase();
        return ['name', 'company', 'phone', 'email'].some((k) => (x[k] || '').toLowerCase().includes(q));
      })
    : docMoveTargets;

  const openEdit = () => {
    setEditForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', company: c.company || '', address: c.address || '' });
    setEditError('');
    setEditOpen(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editForm.name.trim()) { setEditError('Name is required'); return; }
    setEditSaving(true);
    try {
      await api.put(`/clients/${c.id}`, editForm);
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err?.response?.data?.detail || 'Failed to save');
    } finally { setEditSaving(false); }
  };

  const deleteClient = async () => {
    const linked = projects.length + documents.length;
    const lines = [
      `Are you sure you want to delete client "${c.name}"?`,
      '',
      linked > 0
        ? `${projects.length} project(s) and ${documents.length} document(s) will be unlinked (not deleted).`
        : 'No projects or documents are linked to this client.',
      '',
      'This cannot be undone from the clients list.',
    ];
    
    try {
      await api.delete(`/clients/${c.id}`);
      navigate('/clients');
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete client');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="client-detail-page">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm mb-4 nav-link pl-2 pr-3" data-testid="btn-back">
        <ArrowLeft size={14}/> Back to Clients
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'var(--cc-surface)' }}>
            <Users size={26} color="var(--cc-accent)"/>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--cc-text-muted)' }}>Client</div>
            <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }} data-testid="client-name">{c.name}</h1>
            {c.company && <div className="inline-flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--cc-text-muted)' }}><Building2 size={13}/> {c.company}</div>}
            <div className="flex gap-4 mt-2 text-sm flex-wrap">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 link-underline" data-testid="client-phone">
                  <Phone size={13}/> {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 link-underline" data-testid="client-email">
                  <Mail size={13}/> {c.email}
                </a>
              )}
              {waPhone && (
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: '#25D366' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              )}
            </div>
            {c.address && <div className="text-xs mt-2" style={{ color: 'var(--cc-text-muted)' }}>{c.address}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto [&_.btn]:w-full sm:[&_.btn]:w-auto">

          <button onClick={openEdit} className="btn btn-outline" data-testid="btn-edit-client">
            <Pencil size={14}/> Edit
          </button>
          <button onClick={deleteClient} className="btn btn-danger" data-testid="btn-delete-client">
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
            Projects &amp; Audits for {c.name} ({combined.length})
          </h2>
          <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
            {projects.length} project{projects.length !== 1 ? 's' : ''} • {audits.length} audit{audits.length !== 1 ? 's' : ''} • {stats.outstanding_count} outstanding • {stats.settled_count} settled
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="client-projects-table">
            <thead>
              <tr>
                <th>Job No</th>
                <th>Type</th>
                <th>Name</th>
                <th className="hidden md:table-cell">Architect</th>
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
                <tr><td colSpan={10} className="text-center py-10" style={{ color: 'var(--cc-text-muted)' }}>No projects or audits linked to this client yet.</td></tr>
              ) : combined.map((p) => p.__kind === 'audit' ? (
                <tr key={`audit-${p.id}`} data-testid={`client-audit-row-${p.audit_code}`}>
                  <td className="font-mono-data font-semibold text-gray-400">—</td>
                  <td><span className="badge" style={{ background: '#EDE9FE', color: '#5B21B6' }}>Audit</span></td>
                  <td className="font-medium">{p.audit_offer || p.notes || '—'}</td>
                  <td className="hidden md:table-cell text-gray-400">—</td>
                  <td className="max-w-[200px] hidden md:table-cell text-gray-400">—</td>
                  <td className="num hidden sm:table-cell">{formatINR(p.total_amount, { withSymbol: false })}</td>
                  <td className="num hidden sm:table-cell">{formatINR(p.received_amount, { withSymbol: false })}</td>
                  <td className="num font-semibold text-xs" style={{ color: (p.outstanding_amount || 0) > 0 ? 'var(--cc-accent)' : 'var(--cc-dark-green)' }}>{formatINR(p.outstanding_amount || 0)}</td>
                  <td className="hidden sm:table-cell text-center">
                    <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-1.5 justify-center">
                      <Link to={`/audits/${p.id}`} className="btn btn-outline btn-sm flex items-center gap-1">
                        <Eye size={13}/> View
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                <React.Fragment key={p.id}>
                  <tr data-testid={`client-project-row-${p.project_code}`}>
                    <td className="font-mono-data font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{p.job_no || '—'}</td>
                    <td><span className="badge" style={{ background: '#D1FAE5', color: '#065F46' }}>Project</span></td>
                    <td className="font-medium">{p.name}</td>
                    <td className="hidden md:table-cell">{p.architect_name || <span className="text-gray-400">None</span>}</td>
                    <td className="max-w-[200px] hidden md:table-cell"><div className="line-clamp-2 text-xs">{p.site_location || '—'}</div></td>
                    <td className="num hidden sm:table-cell">{formatINR(p.quoted_amount, { withSymbol: false })}</td>
                    <td className="num hidden sm:table-cell">{formatINR(p.received_amount, { withSymbol: false })}</td>
                    <td className="num font-semibold text-xs" style={{ color: p.outstanding_amount > 0 ? 'var(--cc-accent)' : 'var(--cc-dark-green)' }}>{formatINR(p.outstanding_amount)}</td>
                    <td className="hidden sm:table-cell text-center">
                      <span className={`badge ${p.status === 'Settled' ? 'badge-settled' : 'badge-outstanding'}`}>{p.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1.5 justify-center">
                        <Link to={`/projects/${p.id}`} className="btn btn-outline btn-sm flex items-center gap-1">
                          <Eye size={13}/> View
                        </Link>
                        <button
                          onClick={() => toggleTasks(p.id)}
                          className="btn btn-outline btn-sm flex items-center gap-1 whitespace-nowrap"
                          data-testid={`btn-tasks-${p.project_code}`}
                        >
                          <CheckSquare size={13}/>
                          {expandedProjects[p.id] ? 'Hide Tasks' : 'Show Tasks'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedProjects[p.id] && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50/50 p-4">
                        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                          <div className="font-head font-bold text-sm mb-3 flex items-center gap-1.5" style={{ color: 'var(--cc-dark-green)' }}>
                            <CheckSquare size={16} /> Linked Tasks for {p.project_code || p.name}
                          </div>
                          {tasksLoading[p.id] ? (
                            <div className="text-xs text-gray-500 py-2">Loading tasks...</div>
                          ) : !projectTasks[p.id] || projectTasks[p.id].length === 0 ? (
                            <div className="text-xs text-gray-400 py-2">No tasks linked to this project.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="cc-table w-full text-xs" style={{ minWidth: '600px' }}>
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th style={{ width: 60 }}>Sr No</th>
                                    <th style={{ width: 100 }}>Category</th>
                                    <th>Work</th>
                                    <th style={{ width: 120 }}>Start Date</th>
                                    <th style={{ width: 120 }}>Due Date</th>
                                    <th>Assign To</th>
                                    <th className="text-center" style={{ width: 110 }}>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectTasks[p.id].map((t, idx) => (
                                    <tr key={t.id} className="hover:bg-gray-50/40">
                                      <td className="font-mono-data text-gray-500">{idx + 1}</td>
                                      <td className="capitalize font-semibold text-gray-700">{t.category || '—'}</td>
                                      <td className="font-medium text-gray-900">{t.work}</td>
                                      <td className="font-mono-data">{t.start_date || '—'}</td>
                                      <td className="font-mono-data">{t.due_date || '—'}</td>
                                      <td>
                                        {t.assigned_to_name || t.assigned_to_username ? (
                                          <span className="inline-flex items-center gap-1.5">
                                            <span
                                              className="rounded-full text-white font-bold flex items-center justify-center text-[9px] flex-shrink-0"
                                              style={{ background: t.assigned_to_color || '#10B981', width: 18, height: 18 }}
                                            >
                                              {(t.assigned_to_name || t.assigned_to_username || '?')[0].toUpperCase()}
                                            </span>
                                            <span>{t.assigned_to_name || t.assigned_to_username}</span>
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        <span
                                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                          style={
                                            t.status === 'done' ? { background: '#D1FAE5', color: '#065F46', borderColor: '#34D399' } : 
                                            (t.status === 'in progress' || t.status === 'in_progress') ? { background: '#DBEAFE', color: '#1D4ED8', borderColor: '#93C5FD' } :
                                            t.status === 'cancelled' ? { background: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' } :
                                            { background: '#FEF2F2', color: '#991B1B', borderColor: '#F87171' }
                                          }
                                        >
                                          {t.status === 'in progress' || t.status === 'in_progress' ? 'In Progress' :
                                           t.status === 'done' ? 'Done' :
                                           t.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documents linked to this client */}
      <div className="card overflow-hidden mt-6" data-testid="client-documents-card">
        <div className="p-5 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--cc-border)' }}>
          <h2 className="font-head text-xl font-bold flex items-center gap-2" style={{ color: 'var(--cc-dark-green)' }}>
            <FileSignature size={18}/> Documents linked to {c.name} ({documents.length})
          </h2>
          <Link to="/documents" className="btn btn-outline btn-sm" data-testid="client-go-to-documents">Manage Documents</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="cc-table" data-testid="client-documents-table">
            <thead>
              <tr>
                <th>Document No.</th>
                <th>Type</th>
                <th className="hidden sm:table-cell">Architect</th>
                <th className="hidden md:table-cell">Plot / Place</th>
                <th>Date</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--cc-text-muted)' }}>No documents linked to this client yet.</td></tr>
              ) : documents.map((d) => (
                <tr key={d.id} data-testid={`client-doc-row-${d.id}`}>
                  <td className="font-mono-data text-xs font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{d.doc_number}</td>
                  <td className="text-sm">{d.doc_type_name}</td>
                  <td className="text-sm hidden sm:table-cell">{d.architect_name || <span className="text-gray-400">—</span>}</td>
                  <td className="text-sm max-w-[220px] hidden md:table-cell"><div className="line-clamp-2">{d.plot_place || '—'}</div></td>
                  <td className="text-xs font-mono-data">{(d.document_date || '').slice(0, 10) || '—'}</td>
                  <td>
                    <div className="grid grid-cols-2 gap-1 w-max mx-auto">
                      <button
                        onClick={() => openDocMove(d)}
                        className="btn btn-outline btn-sm"
                        title="Move to another client"
                        data-testid={`client-doc-move-${d.id}`}
                      >
                        <ArrowRightLeft size={13}/>
                      </button>
                      <button onClick={() => downloadFile(`${API}/documents/${d.id}/pdf`)} className="btn btn-outline btn-sm" title="Download PDF" data-testid={`client-doc-pdf-${d.id}`}>
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
        open={!!docMove}
        onClose={() => setDocMove(null)}
        title={docMove ? `Move document ${docMove.doc_number} to another client` : ''}
        testId="move-document-modal"
      >
        <div className="space-y-3">
          <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
            Currently linked to <span className="font-semibold" style={{ color: 'var(--cc-dark-green)' }}>{c.name}</span>. Pick a new client below — or unlink the document entirely.
          </div>
          <input
            className="input"
            value={docMoveQuery}
            onChange={(e) => setDocMoveQuery(e.target.value)}
            placeholder="Search client by name, company, phone, email…"
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
              — Unlink client (leave blank) —
            </button>
            {docMoveFiltered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--cc-text-muted)' }}>No other clients match.</div>
            ) : docMoveFiltered.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => performDocMove(x.id)}
                disabled={docMoveBusy}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                style={{ borderColor: 'var(--cc-border)' }}
                data-testid={`move-document-target-${x.id}`}
              >
                <div className="font-medium">{x.name}{x.company ? <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--cc-text-muted)' }}>· {x.company}</span> : null}</div>
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
        title={`Edit Client — ${c.name}`}
        testId="edit-client-modal"
      >
        <form onSubmit={submitEdit} className="space-y-3">
          <div>
            <label className="label">Client Name *</label>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus data-testid="edit-client-name"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input font-mono-data" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} data-testid="edit-client-phone"/>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="edit-client-email"/>
            </div>
          </div>
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} data-testid="edit-client-company"/>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="textarea" rows={2} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} data-testid="edit-client-address"/>
          </div>
          {editError && <div className="text-sm text-red-600" data-testid="edit-client-error">{editError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn btn-outline"><X size={13}/> Cancel</button>
            <button type="submit" disabled={editSaving} className="btn btn-primary" data-testid="edit-client-save">
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

export default ClientDetailPage;
