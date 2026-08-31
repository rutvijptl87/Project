import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Pagination from '../components/Pagination';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';

import {
  Plus, Trash2, CheckSquare, Square, HardHat, Pencil, ArrowLeft, Search, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, X, Save
} from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

/* ─── Assignee chip ─── */
const AssigneeChip = ({ task, isAccountant = false }) => {
  const username = isAccountant ? task.assigned_accountant_username : task.assigned_to_username;
  const name = isAccountant ? task.assigned_accountant_name : task.assigned_to_name;
  const color = isAccountant ? task.assigned_accountant_color : task.assigned_to_color;

  if (!username) {
    return <span style={{ color: 'var(--cc-text-muted)', fontSize: 12 }}>—</span>;
  }
  const bg = color || '#0A2E1F';
  const initials = (name || username || '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12 }}>
      <span
        className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
        style={{ width: 20, height: 20, background: bg, fontSize: 9 }}
      >
        {initials}
      </span>
      <span style={{ color: 'var(--cc-text)' }}>{name || username}</span>
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

/* ─── Main Page ─── */
const StructuralAuditTasksPage = () => {
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
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [users, setUsers] = useState([]);
  const [viewTask, setViewTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

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
      const [tasksRes, usersRes] = await Promise.all([
        api.get('/tasks/paginated', { params: { page, limit, q: debouncedSearch, category: 'structural', status: statusFilters.length > 0 ? statusFilters.join(',') : undefined, sort_by: sortBy, sort_dir: sortDir } }),
        api.get('/auth/users/directory').catch(() => ({ data: [] }))
      ]);
      setTasks(tasksRes.data.data || []);
      setTotal(tasksRes.data.total || 0);
      setTotalPending(tasksRes.data.total_pending || 0);
      setTotalInProgress(tasksRes.data.total_in_progress || 0);
      setTotalDone(tasksRes.data.total_done || 0);
      setTotalCancelled(tasksRes.data.total_cancelled || 0);
      setUsers(usersRes.data || []);
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
      if (oldStatus === 'in progress') setTotalInProgress(p => Math.max(0, p - 1));
      if (oldStatus === 'done') setTotalDone(d => Math.max(0, d - 1));
      if (oldStatus === 'cancelled') setTotalCancelled(c => Math.max(0, c - 1));

      if (resStatus === 'pending') setTotalPending(p => p + 1);
      if (resStatus === 'in progress') setTotalInProgress(p => p + 1);
      if (resStatus === 'done') setTotalDone(d => d + 1);
      if (resStatus === 'cancelled') setTotalCancelled(c => c + 1);
      toast.success('Status updated');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    }
  };



  const openEdit = (task) => {
    setEditTask(task);
    setEditForm({
      description: task.description || '',
      site_visit_date: task.site_visit_date || '',
      preparation_date: task.preparation_date || '',
      submission_date: task.submission_date || '',
      assigned_to_user_id: task.assigned_to_user_id || '',
      assigned_to_accountant_id: task.assigned_to_accountant_id || ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const payload = {
        category: editTask.category,
        project_id: editTask.project_id || null,
        audit_id: editTask.audit_id || null,
        audit_offer_no: editTask.audit_offer_no || '',
        site_location: editTask.site_location || '',
        work: editTask.work,
        start_date: editTask.start_date || null,
        description: editForm.description,
        site_visit_date: editForm.site_visit_date || null,
        preparation_date: editForm.preparation_date || null,
        submission_date: editForm.submission_date || null,
        assigned_to_user_id: editForm.assigned_to_user_id || null,
        assigned_to_accountant_id: editForm.assigned_to_accountant_id || null,
      };
      const res = await api.put(`/tasks/${editTask.id}`, payload);
      setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...res.data } : t));
      setEditTask(null);
      toast.success('Task updated');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update task');
    } finally {
      setEditSaving(false);
    }
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

  const updateTaskPhase = async (taskId, phase, statusVal) => {
    try {
      const res = await api.put(`/tasks/${taskId}/phase`, { phase, status: statusVal });
      setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update phase');
    }
  };

  const getDateStyle = (task, phaseName) => {
    const isDone = task[`${phaseName}_status`] === 'done';
    const completedAt = task[`${phaseName}_completed_at`];
    const deadline = task[`${phaseName}_date`];
    
    if (isDone) {
      return { color: '#059669', fontWeight: 600, opacity: 0.5 };
    }
    
    if (deadline) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const deadlineDate = new Date(deadline);
      deadlineDate.setHours(0,0,0,0);
      if (today > deadlineDate) {
        return { color: '#DC2626', fontWeight: 600 };
      }
    }
    return { color: 'var(--cc-text-muted)' };
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="structural-tasks-page">

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        
        {/* Title & Badges */}
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/tasks')} className="btn btn-outline btn-sm mt-1 flex-shrink-0" title="Back to Tasks">
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
              <HardHat size={20} />
            </div>
            <h1 className="font-head text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--cc-dark-green)' }}>
              Structural Audit Tasks
            </h1>
          </div>
        </div>

        {/* Actions (Search + Filter) */}
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
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card text-center py-12" style={{ color: 'var(--cc-text-muted)' }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="card text-center py-14" style={{ color: 'var(--cc-text-muted)' }}>
          <HardHat size={34} className="mx-auto mb-3" style={{ opacity: 0.2 }} />
          <div className="font-semibold text-sm">No structural tasks yet</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="cc-table" data-testid="structural-tasks-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }} className="hidden sm:table-cell text-center">Sr No</th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('audit_offer_no')}>Audit Offer No <SortIcon col="audit_offer_no" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('description')}>Description <SortIcon col="description" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('site_visit_date')}>Site Visit <SortIcon col="site_visit_date" /></th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('preparation_date')}>Preparation <SortIcon col="preparation_date" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('submission_date')}>Submission <SortIcon col="submission_date" /></th>
                  <th className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('assigned_to_username')}>Assigned To <SortIcon col="assigned_to_username" /></th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task, idx) => {
                  const canEditEngPhase = isAdmin || ((user?.role === 'engineer' || user?.role === 'draftsman') && (task.assigned_to_user_id === user?.id || task.created_by_user_id === user?.id || !task.assigned_to_user_id));
                  const canEditAccPhase = isAdmin || ((user?.role === 'account' || user?.role === 'accountant') && (task.assigned_to_accountant_id === user?.id || task.created_by_user_id === user?.id || !task.assigned_to_accountant_id));
                  const canEditTask = isAdmin || task.assigned_to_user_id === user?.id || task.assigned_to_accountant_id === user?.id || task.created_by_user_id === user?.id || (!task.assigned_to_user_id && !task.assigned_to_accountant_id);

                  return (
                    <tr key={task.id} style={{ opacity: task.status === 'done' || task.status === 'cancelled' ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                      <td className="font-mono-data text-xs text-center hidden sm:table-cell" style={{ color: 'var(--cc-text-muted)' }}>{(page - 1) * limit + idx + 1}</td>
                      <td className="font-mono-data text-xs font-medium hidden md:table-cell" style={{ color: 'var(--cc-dark-green)' }}>{task.audit_offer_no || '—'}</td>
                      <td>
                        <ExpandableDescription text={task.description || task.work} />
                      </td>
                      <td className="font-mono-data text-xs hidden md:table-cell" style={getDateStyle(task, 'site_visit')}>
                        {task.site_visit_date ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={task.site_visit_status === 'done' ? 'opacity-50' : task.site_visit_status === 'cancelled' ? 'opacity-50 text-red-500' : ''}>
                              {new Date(task.site_visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <select
                              value={task.site_visit_status || 'todo'}
                              onChange={(e) => updateTaskPhase(task.id, 'site_visit', e.target.value)}
                              disabled={!canEditEngPhase}
                              title={!canEditEngPhase ? "Read-only: Assigned to another engineer" : "Update Site Visit Phase"}
                              className={`text-[10px] font-semibold py-0.5 pl-1.5 pr-4 rounded border appearance-none outline-none transition-all bg-gray-50 ${!canEditEngPhase ? 'cursor-not-allowed opacity-75' : 'cursor-pointer focus:ring-1 focus:ring-offset-0'}`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='gray'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.2rem center',
                                backgroundSize: '0.8em 0.8em',
                              }}
                            >
                              <option value="todo">To-Do</option>
                              <option value="done">Done</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="font-mono-data text-xs" style={getDateStyle(task, 'preparation')}>
                        {task.preparation_date ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={task.preparation_status === 'done' ? 'opacity-50' : task.preparation_status === 'cancelled' ? 'opacity-50 text-red-500' : ''}>
                              {new Date(task.preparation_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <select
                              value={task.preparation_status || 'todo'}
                              onChange={(e) => updateTaskPhase(task.id, 'preparation', e.target.value)}
                              disabled={!canEditEngPhase}
                              title={!canEditEngPhase ? "Read-only: Assigned to another engineer" : "Update Preparation Phase"}
                              className={`text-[10px] font-semibold py-0.5 pl-1.5 pr-4 rounded border appearance-none outline-none transition-all bg-gray-50 ${!canEditEngPhase ? 'cursor-not-allowed opacity-75' : 'cursor-pointer focus:ring-1 focus:ring-offset-0'}`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='gray'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.2rem center',
                                backgroundSize: '0.8em 0.8em',
                              }}
                            >
                              <option value="todo">To-Do</option>
                              <option value="done">Done</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="font-mono-data text-xs hidden md:table-cell" style={getDateStyle(task, 'submission')}>
                        {task.submission_date ? (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={task.submission_status === 'done' ? 'opacity-50' : task.submission_status === 'cancelled' ? 'opacity-50 text-red-500' : ''}>
                              {new Date(task.submission_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <select
                              value={task.submission_status || 'todo'}
                              onChange={(e) => updateTaskPhase(task.id, 'submission', e.target.value)}
                              disabled={!canEditAccPhase}
                              title={!canEditAccPhase ? "Read-only: Assigned to another accountant" : "Update Submission Phase"}
                              className={`text-[10px] font-semibold py-0.5 pl-1.5 pr-4 rounded border appearance-none outline-none transition-all bg-gray-50 ${!canEditAccPhase ? 'cursor-not-allowed opacity-75' : 'cursor-pointer focus:ring-1 focus:ring-offset-0'}`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='gray'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.2rem center',
                                backgroundSize: '0.8em 0.8em',
                              }}
                            >
                              <option value="todo">To-Do</option>
                              <option value="done">Done</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 font-medium w-8">Eng:</span>
                            <AssigneeChip task={task} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-500 font-medium w-8">Acc:</span>
                            <AssigneeChip task={task} isAccountant={true} />
                          </div>
                        </div>
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
                          {canEditTask && (
                            <button 
                              onClick={() => openEdit(task)} 
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
            <div className="grid grid-cols-1 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              <div>
                <div className="text-xs font-semibold mb-1 text-gray-500">Audit Offer No</div>
                <div className="font-medium text-emerald-800">{viewTask.audit_offer_no || '—'}</div>
              </div>
            </div>
            
            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500">Description</div>
              <div className="text-sm bg-gray-50 p-3 rounded">{viewTask.description || viewTask.work}</div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 border-b pb-4" style={{ borderColor: 'var(--cc-border)' }}>
              {[
                { label: 'Site Visit Date', key: 'site_visit' },
                { label: 'Preparation Date', key: 'preparation' },
                { label: 'Submission Date', key: 'submission' }
              ].map(phase => {
                const dateVal = viewTask[`${phase.key}_date`];
                const status = viewTask[`${phase.key}_status`];
                const completedAt = viewTask[`${phase.key}_completed_at`];
                
                let lateText = null;
                if (dateVal) {
                  const deadline = new Date(dateVal);
                  deadline.setHours(0,0,0,0);
                  
                  if (status === 'done' && completedAt) {
                    // Do nothing for done tasks, they shouldn't show as late
                  } else if ((!status || status === 'todo') && dateVal) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (today > deadline) {
                      const daysLate = Math.ceil((today - deadline) / 86400000);
                      lateText = `CURRENTLY LATE BY ${daysLate} DAY${daysLate !== 1 ? 'S' : ''}`;
                    }
                  }
                }

                return (
                  <div key={phase.key}>
                    <div className="text-xs font-semibold mb-1 text-gray-500">{phase.label}</div>
                    <div className="text-sm">{dateVal ? new Date(dateVal).toLocaleDateString() : '—'}</div>
                    {lateText && <div className="text-[10px] mt-1 font-bold text-red-600">{lateText}</div>}
                    {status === 'done' && <div className="text-[10px] mt-1 font-bold text-emerald-600">✓ COMPLETED</div>}
                    {status === 'cancelled' && <div className="text-[10px] mt-1 font-bold text-gray-500">✗ CANCELLED</div>}
                  </div>
                );
              })}
            </div>
            
            <div>
              <div className="text-xs font-semibold mb-1 text-gray-500">Assignments</div>
              <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-16">Engineer:</span>
                  {viewTask.assigned_to_username ? <AssigneeChip task={viewTask} /> : <span className="text-sm text-gray-400">—</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-16">Accountant:</span>
                  {viewTask.assigned_accountant_username ? <AssigneeChip task={viewTask} isAccountant={true} /> : <span className="text-sm text-gray-400">—</span>}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewTask(null)} className="btn btn-outline">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Task Modal */}
      <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Edit Task">
        {editTask && editForm && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="label">Description <span className="text-red-500">*</span></label>
              <textarea className="textarea" rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} required />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Site Visit Date</label>
                <input type="date" className="input w-full" value={editForm.site_visit_date} onChange={(e) => setEditForm({ ...editForm, site_visit_date: e.target.value })} />
              </div>
              
              <div>
                <label className="label">Preparation Date</label>
                <input type="date" className="input w-full" value={editForm.preparation_date} onChange={(e) => setEditForm({ ...editForm, preparation_date: e.target.value })} />
              </div>
              
              <div>
                <label className="label">Submission Date</label>
                <input type="date" className="input w-full" value={editForm.submission_date} onChange={(e) => setEditForm({ ...editForm, submission_date: e.target.value })} />
              </div>
              
              <div>
                <label className="label">Assign Engineer</label>
                <select className="select" value={editForm.assigned_to_user_id} onChange={(e) => setEditForm({ ...editForm, assigned_to_user_id: e.target.value })}>
                  <option value="">— Unassigned —</option>
                  {(Array.isArray(users) ? users : users?.data || []).filter(u => ['admin', 'engineer', 'draftsman'].includes(u.role)).map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Assign Accountant</label>
                <select className="select" value={editForm.assigned_to_accountant_id} onChange={(e) => setEditForm({ ...editForm, assigned_to_accountant_id: e.target.value })}>
                  <option value="">— Unassigned —</option>
                  {(Array.isArray(users) ? users : users?.data || []).filter(u => ['admin', 'account', 'accountant'].includes(u.role)).map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2 border-t mt-4" style={{ borderColor: 'var(--cc-border)' }}>
              <button type="button" onClick={() => setEditTask(null)} className="btn btn-outline"><X size={13}/> Cancel</button>
              <button type="submit" disabled={editSaving} className="btn btn-primary">
                <Save size={13}/> {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default StructuralAuditTasksPage;
