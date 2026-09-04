import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import ColumnFilterDropdown from '../components/ColumnFilterDropdown';
import {
  Plus, Trash2, CheckSquare, Square, Calculator, Pencil, ArrowLeft, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, X } from 'lucide-react';
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

const TaskFormModal = ({ open, onClose, onSaved, editing, users = [], projects = [], audits = [], currentUser }) => {
  const projectList = Array.isArray(projects) ? projects : (projects?.data || []);
  const auditList = Array.isArray(audits) ? audits : (audits?.data || []);
  const userList = Array.isArray(users) ? users : (users?.data || []);

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
        const proj = projectList.find((p) => p.id === pid);
        if (proj) nf.site_location = proj.site_location || '';
      } else if (val.startsWith('audit_')) {
        const aid = val.replace('audit_', '');
        nf.audit_id = aid;
        const aud = auditList.find((a) => a.id === aid);
        if (aud) nf.site_location = aud.address || '';
      }
      return nf;
    });
  };

  const combinedOptions = [
    ...projectList.map(p => ({
      value: `proj_${p.id}`,
      label: p.job_no ? `(Project) ${p.name} (Job: ${p.job_no})` : (p.project_code ? `(Project) ${p.name} (${p.project_code})` : `(Project) ${p.name}`)
    })),
    ...auditList.map(a => ({
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
              {userList.filter(u => u.role === 'admin' || u.role === 'account' || u.role === 'accountant').map((u) => (
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
  const [totalAll, setTotalAll] = useState(0);
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
  const [viewTask, setViewTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [statusFilters, setStatusFilters] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [assignedByFilter, setAssignedByFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ project_numbers: [], assigned_to: [], assigned_by: [], statuses: [] });
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
        api.get('/tasks/paginated', {
          params: {
            page,
            limit,
            q: debouncedSearch,
            category: 'accounting',
            status: statusFilters.length > 0 ? statusFilters.join(',') : undefined,
            project_code: projectFilter || undefined,
            assigned_to: assignedToFilter || undefined,
            assigned_by: assignedByFilter || undefined,
            sort_by: sortBy,
            sort_dir: sortDir
          }
        }),
        api.get('/projects'),
        api.get('/audits'),
        api.get('/auth/users/directory'),
        api.get('/tasks/filter-options', { params: { category: 'accounting' } })
      ];
      const [tasksRes, projRes, auditRes, usersRes, filterOptRes] = await Promise.all(calls);
      setTasks(tasksRes.data.data || []);
      setTotal(tasksRes.data.total || 0);
      setTotalAll(tasksRes.data.total_all || tasksRes.data.total || 0);
      setTotalPending(tasksRes.data.total_pending || 0);
      setTotalInProgress(tasksRes.data.total_in_progress || 0);
      setTotalDone(tasksRes.data.total_done || 0);
      setTotalCancelled(tasksRes.data.total_cancelled || 0);
      setProjects(projRes.data);
      setAudits(auditRes.data);
      if (usersRes) setUsers(usersRes.data);
      if (filterOptRes?.data) setFilterOptions(filterOptRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, statusFilters, projectFilter, assignedToFilter, assignedByFilter, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  // Options for Column Filter Dropdowns
  const projectOptions = useMemo(() => {
    const serverOpts = filterOptions.project_numbers || [];
    const projOpts = (projects || []).map(p => p.name || p.job_no || p.project_code).filter(Boolean);
    const auditOpts = (audits || []).map(a => a.audit_offer || a.audit_code).filter(Boolean);
    const taskOpts = tasks.flatMap(t => [t.project_name, t.project_code, t.audit_code, t.audit_offer_no]).filter(Boolean);
    const unique = Array.from(new Set([...serverOpts, ...projOpts, ...auditOpts, ...taskOpts])).filter(Boolean).sort();
    return unique;
  }, [filterOptions.project_numbers, projects, audits, tasks]);

  const assignedToOptions = useMemo(() => {
    const list = [...(filterOptions.assigned_to || [])];
    const existingVals = new Set(list.map(x => (x.value || '').toLowerCase()));
    (users || []).forEach(u => {
      const val = u.username || u.id;
      if (val && !existingVals.has(val.toLowerCase())) {
        list.push({ value: val, label: u.name || u.username });
        existingVals.add(val.toLowerCase());
      }
    });
    return list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [filterOptions.assigned_to, users]);

  const assignedByOptions = useMemo(() => {
    const list = [...(filterOptions.assigned_by || [])];
    const existingVals = new Set(list.map(x => (x.value || '').toLowerCase()));
    (users || []).forEach(u => {
      const val = u.username || u.id;
      if (val && !existingVals.has(val.toLowerCase())) {
        list.push({ value: val, label: u.name || u.username });
        existingVals.add(val.toLowerCase());
      }
    });
    return list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [filterOptions.assigned_by, users]);

  const statusOptions = useMemo(() => [
    { value: 'pending', label: 'Pending' },
    { value: 'follow up required', label: 'Follow Up Required' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' }
  ], []);

  const hasActiveFilters = Boolean(projectFilter || assignedToFilter || assignedByFilter || statusFilters.length > 0);

  const clearAllFilters = () => {
    setProjectFilter('');
    setAssignedToFilter('');
    setAssignedByFilter('');
    setStatusFilters([]);
    setPage(1);
  };

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

            {/* Clickable Status Cards / Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 ml-14 uppercase text-xs font-bold mt-2">
              <button
                type="button"
                onClick={() => {
                  setStatusFilters([]);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.length === 0
                    ? 'bg-[#10B981] text-white border-[#10B981] ring-2 ring-emerald-600/50 scale-105 font-extrabold'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Show all accounting tasks"
              >
                <span>{totalAll || total} ALL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilters(prev => (prev.length === 1 && prev[0] === 'pending') ? [] : ['pending']);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.includes('pending')
                    ? 'ring-2 ring-red-500 scale-105 shadow-md font-extrabold'
                    : 'hover:brightness-95 opacity-85 hover:opacity-100'
                }`}
                style={{ background: '#FEF2F2', color: '#991B1B', borderColor: '#F87171' }}
                title="Filter by Pending status"
              >
                <span>{totalPending} PENDING</span>
                {statusFilters.includes('pending') && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilters(prev => (prev.length === 1 && prev[0] === 'follow up required') ? [] : ['follow up required']);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.includes('follow up required')
                    ? 'ring-2 ring-amber-500 scale-105 shadow-md font-extrabold'
                    : 'hover:brightness-95 opacity-85 hover:opacity-100'
                }`}
                style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FBBF24' }}
                title="Filter by Follow Up Required status"
              >
                <span>{totalInProgress} FOLLOW UP REQUIRED</span>
                {statusFilters.includes('follow up required') && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilters(prev => (prev.length === 1 && prev[0] === 'done') ? [] : ['done']);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.includes('done')
                    ? 'ring-2 ring-emerald-500 scale-105 shadow-md font-extrabold'
                    : 'hover:brightness-95 opacity-85 hover:opacity-100'
                }`}
                style={{ background: '#D1FAE5', color: '#065F46', borderColor: '#34D399' }}
                title="Filter by Done status"
              >
                <span>{totalDone} DONE</span>
                {statusFilters.includes('done') && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilters(prev => (prev.length === 1 && prev[0] === 'cancelled') ? [] : ['cancelled']);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.includes('cancelled')
                    ? 'ring-2 ring-gray-500 scale-105 shadow-md font-extrabold'
                    : 'hover:brightness-95 opacity-85 hover:opacity-100'
                }`}
                style={{ background: '#F3F4F6', color: '#374151', borderColor: '#9CA3AF' }}
                title="Filter by Cancelled status"
              >
                <span>{totalCancelled} CANCELLED</span>
                {statusFilters.includes('cancelled') && <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse" />}
              </button>
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

      {/* Active Filters Bar */}
      {hasActiveFilters && (
        <div className="flex items-center flex-wrap gap-2 mb-4 p-2.5 bg-gray-50/80 border border-gray-200 rounded-lg text-xs">
          <span className="text-gray-500 font-semibold uppercase tracking-wider text-[11px]">Active Filters:</span>
          {projectFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              Project / Audit: <span className="font-bold">{projectFilter}</span>
              <button type="button" onClick={() => { setProjectFilter(''); setPage(1); }} className="hover:text-red-600 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {assignedByFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-medium">
              Assign By: <span className="font-bold">{assignedByOptions.find(o => o.value.toLowerCase() === assignedByFilter.toLowerCase())?.label || assignedByFilter}</span>
              <button type="button" onClick={() => { setAssignedByFilter(''); setPage(1); }} className="hover:text-red-600 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {assignedToFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium">
              Assign To: <span className="font-bold">{assignedToOptions.find(o => o.value.toLowerCase() === assignedToFilter.toLowerCase())?.label || assignedToFilter}</span>
              <button type="button" onClick={() => { setAssignedToFilter(''); setPage(1); }} className="hover:text-red-600 ml-0.5"><X size={12} /></button>
            </span>
          )}
          {statusFilters.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
              Status: <span className="font-bold capitalize">{statusFilters.join(', ')}</span>
              <button type="button" onClick={() => { setStatusFilters([]); setPage(1); }} className="hover:text-red-600 ml-0.5"><X size={12} /></button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-red-600 hover:text-red-800 hover:underline ml-auto font-semibold"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card text-center py-12" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-14" style={{ color: 'var(--cc-text-muted)' }}>
          <Calculator size={34} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <div className="font-semibold text-sm">No accounting tasks found</div>
          <div className="text-xs mt-1">{hasActiveFilters ? 'Try adjusting your filters or click "Clear All".' : 'Click "New Task" to create the first one.'}</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="cc-table" data-testid="accounting-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }} className="hidden sm:table-cell text-center">Sr No</th>
                  
                  {/* Project / Audit */}
                  <th className="hidden md:table-cell">
                    <div className="flex items-center justify-between gap-1.5">
                      <div 
                        className="cursor-pointer select-none inline-flex items-center flex-1 hover:text-[var(--cc-dark-green)]" 
                        onClick={() => toggleSort('project_name')}
                      >
                        <span>Project / Audit</span>
                        <SortIcon col="project_name" />
                      </div>
                      <ColumnFilterDropdown
                        title="Project / Audit"
                        type="project"
                        options={projectOptions}
                        value={projectFilter}
                        onChange={(val) => { setProjectFilter(val); setPage(1); }}
                        align="left"
                      />
                    </div>
                  </th>

                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('site_location')}>Site <SortIcon col="site_location" /></th>
                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('contact_name')}>Contact Name <SortIcon col="contact_name" /></th>
                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('contact_no')}>Contact No. <SortIcon col="contact_no" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('work')}>Work <SortIcon col="work" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('created_at')}>Assign Date <SortIcon col="created_at" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('follow_up_date')}>Follow Up Date <SortIcon col="follow_up_date" /></th>

                  {/* Assign By */}
                  <th className="hidden md:table-cell">
                    <div className="flex items-center justify-between gap-1.5">
                      <div 
                        className="cursor-pointer select-none inline-flex items-center flex-1 hover:text-[var(--cc-dark-green)]" 
                        onClick={() => toggleSort('created_by_username')}
                      >
                        <span>Assign By</span>
                        <SortIcon col="created_by_username" />
                      </div>
                      <ColumnFilterDropdown
                        title="Assign By"
                        type="user"
                        options={assignedByOptions}
                        value={assignedByFilter}
                        onChange={(val) => { setAssignedByFilter(val); setPage(1); }}
                        align="right"
                      />
                    </div>
                  </th>

                  {/* Assign To */}
                  <th className="hidden md:table-cell">
                    <div className="flex items-center justify-between gap-1.5">
                      <div 
                        className="cursor-pointer select-none inline-flex items-center flex-1 hover:text-[var(--cc-dark-green)]" 
                        onClick={() => toggleSort('assigned_to_username')}
                      >
                        <span>Assign To</span>
                        <SortIcon col="assigned_to_username" />
                      </div>
                      <ColumnFilterDropdown
                        title="Assign To"
                        type="user"
                        options={assignedToOptions}
                        value={assignedToFilter}
                        onChange={(val) => { setAssignedToFilter(val); setPage(1); }}
                        align="right"
                      />
                    </div>
                  </th>

                  {/* Status */}
                  <th className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div 
                        className="cursor-pointer select-none inline-flex items-center hover:text-[var(--cc-dark-green)]" 
                        onClick={() => toggleSort('status')}
                      >
                        <span>Status</span>
                        <SortIcon col="status" />
                      </div>
                      <ColumnFilterDropdown
                        title="Status"
                        type="status"
                        options={statusOptions}
                        value={statusFilters.length === 1 ? statusFilters[0] : ''}
                        onChange={(val) => { setStatusFilters(val ? [val] : []); setPage(1); }}
                        align="right"
                      />
                    </div>
                  </th>

                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task, idx) => {
                  const canEdit = true;
                  return (
                    <tr key={task.id} style={{ opacity: task.status === 'done' || task.status === 'cancelled' ? 0.55 : 1, transition: 'opacity 0.2s' }} data-testid={`acc-task-row-${task.id}`}>
                      <td className="font-mono-data text-xs text-center hidden sm:table-cell" style={{ color: 'var(--cc-text-muted)' }}>{(page - 1) * limit + idx + 1}</td>
                      <td className="hidden md:table-cell">
                        {task.project_id ? (
                          <Link to={`/projects/${task.project_id}`} className="font-medium text-xs link-underline line-clamp-2" style={{ color: 'var(--cc-dark-green)' }} title={task.project_name || task.project_code}>
                            {task.project_name || task.project_code || '—'}
                          </Link>
                        ) : task.audit_id ? (
                          <Link to={`/audits/${task.audit_id}`} className="font-medium text-xs link-underline line-clamp-2" style={{ color: 'var(--cc-dark-green)' }} title={task.project_name || task.audit_code}>
                            {task.project_name || task.audit_code || '—'}
                          </Link>
                        ) : (
                          <div className="font-medium text-xs line-clamp-2" style={{ color: 'var(--cc-dark-green)' }}>
                            {task.project_name || task.project_code || task.audit_code || '—'}
                          </div>
                        )}
                        {task.job_no ? (
                          <div className="text-[10px] font-mono-data text-gray-500">Job {task.job_no}</div>
                        ) : task.audit_code ? (
                          <div className="text-[10px] font-mono-data text-gray-500">{task.audit_code}</div>
                        ) : task.project_code && task.project_code !== task.project_name ? (
                          <div className="text-[10px] font-mono-data text-gray-400">{task.project_code}</div>
                        ) : null}
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
                          disabled={!canEdit}
                          title={!canEdit ? "Read-only: Assigned to another user" : "Change Status"}
                          className={`text-xs font-semibold py-1 pl-2 pr-6 rounded-full border appearance-none outline-none transition-all shadow-sm ${!canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer focus:ring-2 focus:ring-offset-1'}`}
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
                            onClick={() => setViewTask(task)} 
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors" 
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            onClick={() => { setEditing(task); setModalOpen(true); }} 
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" 
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            onClick={() => handleDelete(task)} 
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" 
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-gray-100 bg-white">
            <Pagination page={page} setPage={setPage} limit={limit} total={total} />
          </div>
        </div>
      )}

      {/* View Task Modal */}
      <Modal open={!!viewTask} onClose={() => setViewTask(null)} title="Task Details">
        {viewTask && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Project / Audit</div>
                <div className="font-medium text-emerald-800">
                  {viewTask.project_name || viewTask.project_code || viewTask.audit_code || '—'}
                  {viewTask.job_no && <span className="text-xs font-normal text-gray-500 ml-2">(Job: {viewTask.job_no})</span>}
                  {viewTask.audit_code && <span className="text-xs font-normal text-gray-500 ml-2">({viewTask.audit_code})</span>}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Site Location</div>
                <div className="text-sm font-medium">{viewTask.site_location || '—'}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Contact Name</div>
                <div className="text-sm">{viewTask.contact_name || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Contact No.</div>
                <div className="text-sm">{viewTask.contact_no || '—'}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500">Work</div>
              <div className="text-sm font-bold">{viewTask.work || '—'}</div>
            </div>

            {viewTask.notes && (
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Notes</div>
                <div className="text-sm bg-gray-50 p-3 rounded">{viewTask.notes}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Assign Date</div>
                <div className="text-sm">{viewTask.created_at ? new Date(viewTask.created_at).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Follow Up Date</div>
                <div className="text-sm">{viewTask.follow_up_date ? new Date(viewTask.follow_up_date).toLocaleDateString() : '—'}</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500">Assignments & Status</div>
              <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-24">Assign By:</span>
                  <span className="text-sm">{viewTask.created_by_username || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-24">Assign To:</span>
                  <AssigneeChip task={viewTask} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-24">Status:</span>
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={
                    viewTask.status === 'done' ? { background: '#D1FAE5', color: '#065F46' } :
                    viewTask.status === 'follow up required' ? { background: '#DBEAFE', color: '#1D4ED8' } :
                    viewTask.status === 'cancelled' ? { background: '#F3F4F6', color: '#374151' } :
                    { background: '#FEF2F2', color: '#991B1B' }
                  }>{viewTask.status || 'pending'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setViewTask(null)} className="btn btn-outline">Close</button>
            </div>
          </div>
        )}
      </Modal>

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
