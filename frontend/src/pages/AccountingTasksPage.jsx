import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import {
  Plus, Trash2, CheckSquare, Square, Calculator, Pencil, ArrowLeft, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown
, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';


/* ─── Assignee chip ─── */
const AssigneeChip = ({ task }) => {
  if (!task.assigned_to_username) {
    return <span style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>—</span>;
  }
  const bg = task.assigned_to_color || '#10B981';
  const initials = (task.assigned_to_name || task.assigned_to_username || '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12 }}>
      <span
        className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
        style={{ width: 20, height: 20, background: bg, fontSize: 9 }}
      >
        {initials}
      </span>
      <span style={{ color: 'var(--cc-text)' }}>{task.assigned_to_name || task.assigned_to_username}</span>
    </span>
  );
};

/* ─── Expandable Description ─── */
const ExpandableDescription = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 10) {
    return <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{text}</div>;
  }
  const preview = words.slice(0, 10).join(' ') + '... ';
  return (
    <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>
      {expanded ? text : preview}
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="font-medium hover:underline ml-1"
        style={{ color: 'var(--cc-dark-green)' }}
      >
        {expanded ? 'see less' : 'see more'}
      </button>
    </div>
  );
};

/* ─── Form Modal ─── */
const emptyForm = {
  project_id: '', audit_id: '', site_location: '', work: '', notes: '',
  contact_name: '', contact_no: '', follow_up_date: '', assigned_to_user_id: '',
};

const TaskFormModal = ({ open, onClose, onSaved, editing, users, projects, audits, currentUser }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        project_id: editing.project_id || '',
        audit_id: editing.audit_id || '',
        site_location: editing.site_location || '',
        work: editing.work || '',
        notes: editing.notes || '',
        contact_name: editing.contact_name || '',
        contact_no: editing.contact_no || '',
        follow_up_date: editing.follow_up_date ? editing.follow_up_date.slice(0, 10) : '',
        assigned_to_user_id: editing.assigned_to_user_id || '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setError('');
  }, [open, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCombinedChange = (val) => {
    setForm((f) => {
      const nf = { ...f, project_id: '', audit_id: '', site_location: '' };
      if (!val) return nf;

      if (val.startsWith('proj_')) {
        const pid = val.replace('proj_', '');
        nf.project_id = pid;
        const proj = projects.find((p) => p.id === pid);
        if (proj) nf.site_location = proj.site_location || '';
      } else if (val.startsWith('audit_')) {
        const aid = val.replace('audit_', '');
        nf.audit_id = aid;
        const aud = audits.find((a) => a.id === aid);
        if (aud) nf.site_location = aud.address || '';
      }
      return nf;
    });
  };

  const combinedOptions = [
    ...projects.map(p => ({
      value: `proj_${p.id}`,
      label: p.job_no ? `(Project) ${p.job_no} – ${p.name}` : `(Project) ${p.project_code} – ${p.name}`
    })),
    ...audits.map(a => ({
      value: `audit_${a.id}`,
      label: `(Audit) ${a.audit_offer || a.audit_code}`
    }))
  ];
  
  const combinedValue = form.project_id ? `proj_${form.project_id}` : (form.audit_id ? `audit_${form.audit_id}` : '');

  const workCharCount = form.work?.length || 0;
  const descCharCount = form.notes?.length || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.site_location?.trim()) { setError('Site Location is required'); return; }
    if (!form.assigned_to_user_id) { setError('Assign To is required'); return; }

    if (form.contact_no?.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]{10,15}$/;
      if (!phoneRegex.test(form.contact_no.trim())) { setError('Contact No. must be a valid phone number (10-15 digits/symbols)'); return; }
    }

    if (workCharCount > 30) { setError('Work cannot exceed 30 characters'); return; }
    if (descCharCount > 120) { setError('Notes cannot exceed 120 characters'); return; }
    setSaving(true);
    try {
      const payload = {
        category: 'accounting',
        project_id: form.project_id || null,
        audit_id: form.audit_id || null,
        site_location: form.site_location.trim(),
        work: form.work?.trim() || '',
        notes: form.notes?.trim() || '',
        contact_name: form.contact_name?.trim() || '',
        contact_no: form.contact_no?.trim() || '',
        follow_up_date: form.follow_up_date || null,
        assigned_to_user_id: form.assigned_to_user_id || null,
      };
      if (editing) {
        await api.put(`/tasks/${editing.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Accounting Task' : 'New Accounting Task'} testId="acc-task-modal">
      <form onSubmit={handleSubmit} className="space-y-3">

        <div>
          <label className="label">Project OR Audit Number</label>
          <SearchableSelect
            options={combinedOptions}
            value={combinedValue}
            onChange={(val) => handleCombinedChange(val)}
            placeholder="— Search or Select Project / Audit —"
          />
        </div>

        <div>
          <label className="label">
            Site Location <span style={{ color: '#DC2626' }}>*</span>
            {(form.project_id || form.audit_id) && (
              <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--cc-accent)' }}>
                (auto-filled from {form.project_id ? 'project' : 'audit'})
              </span>
            )}
          </label>
          <input className="input" value={form.site_location} onChange={(e) => set('site_location', e.target.value)} placeholder="e.g. Plot 44, Sector 4, Navi Mumbai" data-testid="acc-task-site" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Contact Name <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(optional)</span></label>
            <input className="input" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <div>
            <label className="label">Contact No. <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(optional)</span></label>
            <input 
              className="input" 
              value={form.contact_no} 
              onChange={(e) => {
                const val = e.target.value;
                if (/^[\d\s\-\+\(\)]*$/.test(val)) {
                  set('contact_no', val);
                }
              }} 
              placeholder="e.g. +91 9876543210" 
            />
          </div>
        </div>

        <div>
          <label className="label flex justify-between items-end">
            <span>Work <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(optional)</span></span>
            <span className={`text-[10px] font-normal ${workCharCount > 30 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{workCharCount}/30 chars</span>
          </label>
          <input className="input" value={form.work} onChange={(e) => set('work', e.target.value)} placeholder="Describe what needs to be done…" data-testid="acc-task-work" />
        </div>

        <div>
          <label className="label flex justify-between items-end">
            <span>Notes <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(optional)</span></span>
            <span className={`text-[10px] font-normal ${descCharCount > 120 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{descCharCount}/120 chars</span>
          </label>
          <textarea className="textarea" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional details, instructions, references…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assign Date <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="input bg-gray-50" value={editing?.created_at ? new Date(editing.created_at).toLocaleDateString() : new Date().toLocaleDateString()} disabled />
          </div>
          <div>
            <label className="label">Follow Up Date</label>
            <input type="date" className="input" value={form.follow_up_date} onChange={(e) => set('follow_up_date', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assign By</label>
            <input className="input" value={editing ? (editing.created_by_username || '—') : (currentUser?.username || '')} disabled style={{ backgroundColor: 'var(--cc-bg)', cursor: 'not-allowed', color: 'var(--cc-text-muted)' }} />
          </div>
          <div>
            <label className="label">Assign To <span style={{ color: '#DC2626' }}>*</span></label>
            <select className="select" value={form.assigned_to_user_id} onChange={(e) => set('assigned_to_user_id', e.target.value)} data-testid="acc-task-assignee">
              <option value="">— Unassigned —</option>
              {users.filter(u => u.role === 'admin' || u.role === 'account').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="submit" disabled={saving || !form.site_location?.trim() || !form.assigned_to_user_id || workCharCount > 30 || descCharCount > 120} className="btn btn-primary" data-testid="acc-task-save">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Main Page ─── */
const AccountingTasksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isRestricted = user?.role === 'account' || user?.role === 'engineer' || user?.role === 'draftsman';

  const [tasks, setTasks]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalInProgress, setTotalInProgress] = useState(0);
  const [totalDone, setTotalDone]       = useState(0);
  const [totalCancelled, setTotalCancelled] = useState(0);
  const [page, setPage]         = useState(1);
  const limit = 25;
  const [users, setUsers]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [audits, setAudits]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="inline ml-1 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calls = [
        api.get('/tasks/paginated', { params: { page, limit, q: debouncedSearch, category: 'accounting', status: statusFilters.length > 0 ? statusFilters.join(',') : undefined, sort_by: sortBy, sort_dir: sortDir } }),
        api.get('/projects'),
        api.get('/audits'),
        api.get('/auth/users/directory')
      ];
      const [tasksRes, projRes, auditRes, usersRes] = await Promise.all(calls);
      setTasks(tasksRes.data.data || []);
      setTotal(tasksRes.data.total || 0);
      setTotalPending(tasksRes.data.total_pending || 0);
      setTotalInProgress(tasksRes.data.total_in_progress || 0);
      setTotalDone(tasksRes.data.total_done || 0);
      setTotalCancelled(tasksRes.data.total_cancelled || 0);
      setProjects(projRes.data);
      setAudits(auditRes.data);
      if (usersRes) setUsers(usersRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, statusFilters, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const task = tasks.find(t => t.id === id);
      const oldStatus = task?.status || 'pending';
      const res = await api.put(`/tasks/${id}/status`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...res.data } : t)));
      const resStatus = res.data.status || newStatus;
      
      if (oldStatus === 'pending') setTotalPending(p => Math.max(0, p - 1));
      if (oldStatus === 'follow up required') setTotalInProgress(p => Math.max(0, p - 1));
      if (oldStatus === 'done') setTotalDone(d => Math.max(0, d - 1));
      if (oldStatus === 'cancelled') setTotalCancelled(c => Math.max(0, c - 1));

      if (resStatus === 'pending') setTotalPending(p => p + 1);
      if (resStatus === 'follow up required') setTotalInProgress(p => p + 1);
      if (resStatus === 'done') setTotalDone(d => d + 1);
      if (resStatus === 'cancelled') setTotalCancelled(c => c + 1);
    } catch { toast.error('Failed to update status'); }
  };

  const handleDelete = async (task) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete task "${task.work || task.id}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/tasks/${task.id}`);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setTotal(t => t - 1);
      const status = task.status || 'pending';
      if (status === 'pending') setTotalPending(p => Math.max(0, p - 1));
      if (status === 'follow up required') setTotalInProgress(p => Math.max(0, p - 1));
      if (status === 'done') setTotalDone(d => Math.max(0, d - 1));
      if (status === 'cancelled') setTotalCancelled(c => Math.max(0, c - 1));
      toast.success('Task has been deleted.');
    } catch (err) { 
      toast.error(err?.response?.data?.detail || 'Delete failed');
    }
  };



  const sortedTasks = tasks;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="accounting-tasks-page">

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        
        {/* Title & Badges */}
        <div className="flex items-start gap-4">
          {user?.role !== 'draftsman' && (
            <button onClick={() => navigate('/tasks')} className="btn btn-outline btn-sm mt-1 flex-shrink-0" title="Back to Tasks">
              <ArrowLeft size={14} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: '#10B981', flexShrink: 0 }}>
                <Calculator size={20} color="#fff" />
              </div>
              <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
                Accounting Tasks
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 ml-14 uppercase text-xs font-bold">
              <span className="badge" style={{ background: '#FEF2F2', color: '#991B1B', borderColor: '#F87171' }}>{totalPending} PENDING</span>
              <span className="badge" style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FBBF24' }}>{totalInProgress} FOLLOW UP REQUIRED</span>
              <span className="badge" style={{ background: '#D1FAE5', color: '#065F46', borderColor: '#34D399' }}>{totalDone} DONE</span>
              <span className="badge" style={{ background: '#F3F4F6', color: '#374151', borderColor: '#9CA3AF' }}>{totalCancelled} CANCELLED</span>
            </div>
          </div>
        </div>

        {/* Actions (Search + Filter + New Task) */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              className="input pl-9 h-10 w-full text-sm"
              style={{ borderRadius: '0.5rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative" ref={filterDropdownRef}>
            <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className="btn btn-outline h-10 flex-shrink-0" title="Filter by Status">
              <Filter size={15} /> <span className="hidden sm:inline">Filter</span>
              {statusFilters.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center bg-gray-200 text-gray-700 text-xs font-bold rounded-full w-4 h-4">
                  {statusFilters.length}
                </span>
              )}
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 shadow-xl rounded-lg z-50 py-2">
                <div className="px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</div>
                {['pending', 'follow up required', 'done', 'cancelled'].map(opt => (
                  <label key={opt} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mr-2 rounded border-gray-300 text-[var(--cc-dark-green)] focus:ring-[var(--cc-dark-green)]" 
                      checked={statusFilters.includes(opt)}
                      onChange={() => {
                        setStatusFilters(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
                        setPage(1);
                      }}
                    />
                    <span className="text-sm capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn btn-primary h-10 flex-shrink-0" data-testid="btn-new-acc-task">
            <Plus size={15} /> <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card text-center py-12" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-14" style={{ color: 'var(--cc-text-muted)' }}>
          <Calculator size={34} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <div className="font-semibold text-sm">No accounting tasks yet</div>
          <div className="text-xs mt-1">Click "New Task" to create the first one.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="cc-table" data-testid="accounting-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }} className="hidden sm:table-cell text-center">Sr No</th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('project_code')}>Project / Audit <SortIcon col="project_code" /></th>
                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('site_location')}>Site <SortIcon col="site_location" /></th>
                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('contact_name')}>Contact Name <SortIcon col="contact_name" /></th>
                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('contact_no')}>Contact No. <SortIcon col="contact_no" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('work')}>Work <SortIcon col="work" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('created_at')}>Assign Date <SortIcon col="created_at" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('follow_up_date')}>Follow Up Date <SortIcon col="follow_up_date" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('created_by_username')}>Assign By <SortIcon col="created_by_username" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('assigned_to_username')}>Assign To <SortIcon col="assigned_to_username" /></th>
                  <th className="text-center cursor-pointer select-none" onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task, idx) => (
                  <tr key={task.id} style={{ opacity: task.status === 'done' || task.status === 'cancelled' ? 0.55 : 1, transition: 'opacity 0.2s' }} data-testid={`acc-task-row-${task.id}`}>
                    <td className="font-mono-data text-xs text-center hidden sm:table-cell" style={{ color: 'var(--cc-text-muted)' }}>{(page - 1) * limit + idx + 1}</td>
                    <td className="hidden md:table-cell">
                      <div className="font-mono-data text-xs font-medium" style={{ color: 'var(--cc-dark-green)' }}>{task.project_code || '—'}</div>
                      {task.audit_code && <div className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{task.audit_code}</div>}
                    </td>
                    <td className="hidden lg:table-cell"><div className="text-xs max-w-[180px]">{task.site_location || <span style={{ color: 'var(--cc-text-muted)' }}>—</span>}</div></td>
                    <td className="hidden lg:table-cell font-mono-data text-xs">{task.contact_name || <span style={{ color: 'var(--cc-text-muted)' }}>—</span>}</td>
                    <td className="hidden lg:table-cell font-mono-data text-xs">{task.contact_no || <span style={{ color: 'var(--cc-text-muted)' }}>—</span>}</td>
                    <td>
                      <div className="font-medium text-sm leading-snug" style={{ color: 'var(--cc-text)' }}>{task.work || <span style={{ color: 'var(--cc-text-muted)', fontStyle: 'italic' }}>No work title</span>}</div>
                      <ExpandableDescription text={task.notes} />
                    </td>
                    <td className="font-mono-data text-xs hidden md:table-cell" style={{ color: 'var(--cc-text-muted)' }}>
                      {task.created_at ? new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                      {task.follow_up_date ? new Date(task.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="hidden md:table-cell" style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>
                      {task.created_by_username || '—'}
                    </td>
                    <td className="hidden md:table-cell"><AssigneeChip task={task} /></td>
                    <td className="text-center">
                      <select 
                        className="text-xs font-semibold py-1 pl-2 pr-6 rounded-full border appearance-none outline-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all shadow-sm"
                        style={{
                          ...((task.status === 'done') ? { background: '#D1FAE5', color: '#065F46', borderColor: '#34D399' } : 
                              (task.status === 'follow up required') ? { background: '#DBEAFE', color: '#1D4ED8', borderColor: '#93C5FD' } :
                              (task.status === 'cancelled') ? { background: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' } :
                              { background: '#FEF2F2', color: '#991B1B', borderColor: '#F87171' }),
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 0.4rem center',
                          backgroundSize: '0.8em 0.8em',
                        }}
                        value={task.status || 'pending'}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      >
                        <option value="pending" style={{ background: '#fff', color: '#991B1B' }}>Pending</option>
                        <option value="follow up required" style={{ background: '#fff', color: '#1D4ED8' }}>Follow Up Required</option>
                        <option value="done" style={{ background: '#fff', color: '#065F46' }}>Done</option>
                        <option value="cancelled" style={{ background: '#fff', color: '#374151' }}>Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => { setEditing(task); setModalOpen(true); }} 
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" 
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        {user?.role !== 'draftsman' && (
                          <button 
                            onClick={() => handleDelete(task)} 
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" 
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-gray-100 bg-white">
            <Pagination page={page} setPage={setPage} limit={limit} total={total} />
          </div>
        </div>
      )}

      {/* Modal */}
      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load(); toast.success(editing ? 'Task updated' : 'Task created'); }}
        editing={editing}
        users={users}
        projects={projects}
        audits={audits}
        currentUser={user}
      />

    </div>
  );
};

export default AccountingTasksPage;
