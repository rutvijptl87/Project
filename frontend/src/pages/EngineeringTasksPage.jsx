import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Pagination from '../components/Pagination';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import CreatableSearchableSelect from '../components/CreatableSearchableSelect';
import ColumnFilterDropdown from '../components/ColumnFilterDropdown';

const WORK_OPTIONS = [
  { value: 'Foundation Plan', label: 'Foundation Plan' },
  { value: 'Basement Floor Plan', label: 'Basement Floor Plan' },
  { value: 'Plinth Beam Plan', label: 'Plinth Beam Plan' },
  { value: '1st Floor Plan', label: '1st Floor Plan' },
  { value: '2nd Floor Plan', label: '2nd Floor Plan' },
  { value: 'Typical Floor Plan', label: 'Typical Floor Plan' },
  { value: 'Terrace Floor Plan', label: 'Terrace Floor Plan' },
  { value: 'Column Details', label: 'Column Details' },
  { value: 'UG Tank', label: 'UG Tank' },
  { value: 'OHT/LMR Details', label: 'OHT/LMR Details' },
  { value: 'All Set Drawing for Tender/Submission', label: 'All Set Drawing for Tender/Submission' },
  { value: 'Quantity', label: 'Quantity' }
];
import {
  Plus, Trash2, CheckSquare, Square, HardHat, Pencil, ArrowLeft, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';


/* ─── Assignee chip ─── */
const AssigneeChip = ({ task }) => {
  if (!task.assigned_to_username) {
    return <span style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>—</span>;
  }
  const bg = task.assigned_to_color || '#0A2E1F';
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
  project_id: '', site_location: '', work: '', description: '',
  start_date: '', due_date: '', assigned_to_user_id: '',
};

const TaskFormModal = ({ open, onClose, onSaved, editing, users = [], projects = [], currentUser }) => {
  const projectList = Array.isArray(projects) ? projects : (projects?.data || []);
  const userList = Array.isArray(users) ? users : (users?.data || []);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        project_id: editing.project_id || '',
        site_location: editing.site_location || '',
        work: editing.work || '',
        description: editing.description || '',
        start_date: editing.start_date ? editing.start_date.slice(0, 10) : '',
        due_date: editing.due_date ? editing.due_date.slice(0, 10) : '',
        assigned_to_user_id: editing.assigned_to_user_id || '',
      });
    } else {
      setForm({ ...emptyForm });
    }
    setError('');
  }, [open, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleProjectChange = (pid) => {
    set('project_id', pid);
    if (pid) {
      const proj = projectList.find((p) => p.id === pid);
      if (proj) set('site_location', proj.site_location || '');
    } else {
      set('site_location', '');
    }
  };

  const workCharCount = form.work.length;
  const descCharCount = form.description.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.work.trim()) { setError('Work / Task description is required'); return; }
    if (workCharCount > 50) { setError('Work cannot exceed 50 characters'); return; }
    if (descCharCount > 120) { setError('Description cannot exceed 120 characters'); return; }
    setSaving(true);
    try {
      const payload = {
        category: 'engineering',
        project_id: form.project_id || null,
        audit_id: null,
        site_location: form.site_location.trim(),
        work: form.work.trim(),
        description: form.description.trim(),
        start_date: form.start_date || null,
        due_date: form.due_date || null,
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
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Engineering Task' : 'New Engineering Task'} testId="eng-task-modal">
      <form onSubmit={handleSubmit} className="space-y-3">

        <div>
          <label className="label">Project Number</label>
          <SearchableSelect
            options={projectList.map(p => ({
              value: p.id,
              label: p.job_no ? `${p.job_no} – ${p.name}` : `${p.project_code} – ${p.name}`
            }))}
            value={form.project_id}
            onChange={(val) => handleProjectChange(val)}
            placeholder="— Search or Select Project —"
          />
        </div>

        <div>
          <label className="label">
            Site Location
            {form.project_id && (
              <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--cc-accent)' }}>
                (auto-filled from project)
              </span>
            )}
          </label>
          <input className="input" value={form.site_location} onChange={(e) => set('site_location', e.target.value)} placeholder="e.g. Plot 44, Sector 4, Navi Mumbai" data-testid="eng-task-site" />
        </div>

        <div>
          <label className="label flex justify-between items-end">
            <span>Work <span style={{ color: '#DC2626' }}>*</span></span>
            <span className={`text-[10px] font-normal ${workCharCount > 50 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{workCharCount}/50 chars</span>
          </label>
          <CreatableSearchableSelect 
            options={WORK_OPTIONS}
            value={form.work}
            onChange={(val) => set('work', val)}
            placeholder="Select or type work description..."
          />
        </div>

        <div>
          <label className="label flex justify-between items-end">
            <span>Description <span className="text-xs font-normal" style={{ color: 'var(--cc-text-muted)' }}>(optional)</span></span>
            <span className={`text-[10px] font-normal ${descCharCount > 120 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{descCharCount}/120 chars</span>
          </label>
          <textarea className="textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Additional details, instructions, references…" data-testid="eng-task-desc" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" min={editing ? undefined : new Date().toISOString().split('T')[0]} className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} data-testid="eng-task-start-date" />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" min={editing ? undefined : new Date().toISOString().split('T')[0]} className="input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} data-testid="eng-task-due-date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assign By</label>
            <input className="input" value={editing ? (editing.created_by_username || '—') : (currentUser?.username || '')} disabled style={{ backgroundColor: 'var(--cc-bg)', cursor: 'not-allowed', color: 'var(--cc-text-muted)' }} />
          </div>
          <div>
            <label className="label">Assign To</label>
            <select className="select" value={form.assigned_to_user_id} onChange={(e) => set('assigned_to_user_id', e.target.value)} data-testid="eng-task-assignee">
              <option value="">— Unassigned —</option>
              {userList.filter(u => u.role === 'admin' || u.role === 'engineer' || u.role === 'draftsman').map((u) => (
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
          <button type="submit" disabled={saving || !form.work.trim() || workCharCount > 50 || descCharCount > 120} className="btn btn-primary" data-testid="eng-task-save">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ─── Main Page ─── */
const EngineeringTasksPage = () => {
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
            category: 'engineering',
            status: statusFilters.length > 0 ? statusFilters.join(',') : undefined,
            project_code: projectFilter || undefined,
            assigned_to: assignedToFilter || undefined,
            assigned_by: assignedByFilter || undefined,
            sort_by: sortBy,
            sort_dir: sortDir
          }
        }), 
        api.get('/projects'), 
        api.get('/auth/users/directory'),
        api.get('/tasks/filter-options', { params: { category: 'engineering' } })
      ];
      const [tasksRes, projRes, usersRes, filterOptRes] = await Promise.all(calls);
      setTasks(tasksRes.data.data || []);
      setTotal(tasksRes.data.total || 0);
      setTotalAll(tasksRes.data.total_all || tasksRes.data.total || 0);
      setTotalPending(tasksRes.data.total_pending || 0);
      setTotalInProgress(tasksRes.data.total_in_progress || 0);
      setTotalDone(tasksRes.data.total_done || 0);
      setTotalCancelled(tasksRes.data.total_cancelled || 0);
      setProjects(projRes.data);
      if (usersRes) setUsers(usersRes.data);
      if (filterOptRes?.data) setFilterOptions(filterOptRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedSearch, statusFilters, projectFilter, assignedToFilter, assignedByFilter, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  // Options for Column Filter Dropdowns
  const projectOptions = useMemo(() => {
    const serverOpts = filterOptions.project_numbers || [];
    const projOpts = (projects || []).map(p => p.job_no || p.project_code).filter(Boolean);
    const taskOpts = tasks.map(t => t.project_code).filter(Boolean);
    const unique = Array.from(new Set([...serverOpts, ...projOpts, ...taskOpts])).filter(Boolean).sort();
    return unique;
  }, [filterOptions.project_numbers, projects, tasks]);

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
    { value: 'in progress', label: 'In Progress' },
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
      if (oldStatus === 'in progress') setTotalInProgress(p => Math.max(0, p - 1));
      if (oldStatus === 'done') setTotalDone(d => Math.max(0, d - 1));
      if (oldStatus === 'cancelled') setTotalCancelled(c => Math.max(0, c - 1));

      if (resStatus === 'pending') setTotalPending(p => p + 1);
      if (resStatus === 'in progress') setTotalInProgress(p => p + 1);
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
      if (status === 'in progress') setTotalInProgress(p => Math.max(0, p - 1));
      if (status === 'done') setTotalDone(d => Math.max(0, d - 1));
      if (status === 'cancelled') setTotalCancelled(c => Math.max(0, c - 1));
      toast.success('Task has been deleted.');
    } catch (err) { 
      toast.error(err?.response?.data?.detail || 'Delete failed');
    }
  };



  const sortedTasks = tasks;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="engineering-tasks-page">

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
              <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: '#0A2E1F', flexShrink: 0 }}>
                <HardHat size={20} color="#fff" />
              </div>
              <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
                Engineering Tasks
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
                    ? 'bg-[#0A2E1F] text-white border-[#0A2E1F] ring-2 ring-emerald-600/50 scale-105 font-extrabold'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Show all engineering tasks"
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
                  setStatusFilters(prev => (prev.length === 1 && prev[0] === 'in progress') ? [] : ['in progress']);
                  setPage(1);
                }}
                className={`badge cursor-pointer select-none transition-all duration-150 px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-xs hover:shadow ${
                  statusFilters.includes('in progress')
                    ? 'ring-2 ring-amber-500 scale-105 shadow-md font-extrabold'
                    : 'hover:brightness-95 opacity-85 hover:opacity-100'
                }`}
                style={{ background: '#FFFBEB', color: '#B45309', borderColor: '#FBBF24' }}
                title="Filter by In-Progress status"
              >
                <span>{totalInProgress} IN-PROGRESS</span>
                {statusFilters.includes('in progress') && <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />}
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
                {['pending', 'in progress', 'done', 'cancelled'].map(opt => (
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
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn btn-primary h-10 flex-shrink-0" data-testid="btn-new-eng-task">
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
              Project: <span className="font-bold">{projectFilter}</span>
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
          <HardHat size={34} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <div className="font-semibold text-sm">No engineering tasks found</div>
          <div className="text-xs mt-1">{hasActiveFilters ? 'Try adjusting your filters or click "Clear All".' : 'Click "New Task" to create the first one.'}</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="cc-table" data-testid="engineering-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }} className="hidden sm:table-cell text-center">Sr No</th>
                  
                  {/* Project Number */}
                  <th className="hidden md:table-cell">
                    <div className="flex items-center justify-between gap-1.5">
                      <div 
                        className="cursor-pointer select-none inline-flex items-center flex-1 hover:text-[var(--cc-dark-green)]" 
                        onClick={() => toggleSort('project_code')}
                      >
                        <span>Project Number</span>
                        <SortIcon col="project_code" />
                      </div>
                      <ColumnFilterDropdown
                        title="Project Number"
                        type="project"
                        options={projectOptions}
                        value={projectFilter}
                        onChange={(val) => { setProjectFilter(val); setPage(1); }}
                        align="left"
                      />
                    </div>
                  </th>

                  <th className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('site_location')}>Site Location <SortIcon col="site_location" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('work')}>Work <SortIcon col="work" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('start_date')}>Start Date <SortIcon col="start_date" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('due_date')}>Due Date <SortIcon col="due_date" /></th>

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
                  const canEdit = isAdmin || task.assigned_to_user_id === user?.id || task.created_by_user_id === user?.id || !task.assigned_to_user_id;
                  return (
                    <tr key={task.id} style={{ opacity: task.status === 'done' || task.status === 'cancelled' ? 0.55 : 1, transition: 'opacity 0.2s' }} data-testid={`eng-task-row-${task.id}`}>
                      <td className="font-mono-data text-xs text-center hidden sm:table-cell" style={{ color: 'var(--cc-text-muted)' }}>{(page - 1) * limit + idx + 1}</td>
                      <td className="font-mono-data text-xs font-medium hidden md:table-cell" style={{ color: 'var(--cc-dark-green)' }}>{task.project_code || '—'}</td>
                      <td className="hidden lg:table-cell"><div className="text-xs max-w-[180px]">{task.site_location || <span style={{ color: 'var(--cc-text-muted)' }}>—</span>}</div></td>
                      <td>
                        <div className="font-medium text-sm leading-snug" style={{ color: 'var(--cc-text)' }}>{task.work}</div>
                        <ExpandableDescription text={task.description} />
                      </td>
                      <td className="font-mono-data text-xs hidden md:table-cell" style={{ color: 'var(--cc-text-muted)' }}>
                        {task.start_date ? new Date(task.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="font-mono-data text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
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
                                (task.status === 'in progress') ? { background: '#DBEAFE', color: '#1D4ED8', borderColor: '#93C5FD' } :
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
                          <option value="in progress" style={{ background: '#fff', color: '#1D4ED8' }}>In Progress</option>
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
                          {canEdit && (
                            <button 
                              onClick={() => { setEditing(task); setModalOpen(true); }} 
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" 
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {isAdmin && (
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
                <div className="text-xs font-semibold mb-1 text-gray-500">Project Code</div>
                <div className="font-medium text-emerald-800">{viewTask.project_code || '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Site Location</div>
                <div className="text-sm font-medium">{viewTask.site_location || '—'}</div>
              </div>
            </div>
            
            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500">Work</div>
              <div className="text-sm font-bold">{viewTask.work}</div>
            </div>

            {viewTask.description && (
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Description</div>
                <div className="text-sm bg-gray-50 p-3 rounded">{viewTask.description}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Start Date</div>
                <div className="text-sm">{viewTask.start_date ? new Date(viewTask.start_date).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Due Date</div>
                <div className="text-sm">{viewTask.due_date ? new Date(viewTask.due_date).toLocaleDateString() : '—'}</div>
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
                    viewTask.status === 'in progress' ? { background: '#DBEAFE', color: '#1D4ED8' } :
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
        currentUser={user}
      />

    </div>
  );
};

export default EngineeringTasksPage;
