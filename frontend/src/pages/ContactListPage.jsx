import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'react-toastify';
import { Plus, Search, Eye, FileText, ArrowUpDown, ArrowUp, ArrowDown, List, RefreshCw, MoreHorizontal, Filter, X, ChevronDown, Menu, MessageSquare, Heart, LayoutDashboard, Kanban, File, Trash2 } from 'lucide-react';

const SORTABLE_COLUMNS = {
  created_at: 'Last Updated On',
  id: 'ID',
  first_name: 'Full Name',
  emails: 'Email Address',
  status: 'Status',
  numbers: 'Phone'
};

const ContactListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
    
  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [frappeFilterField, setFrappeFilterField] = useState('ID');
  const [frappeFilterOp, setFrappeFilterOp] = useState('Equals');
  const [frappeFilterVal, setFrappeFilterVal] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  
  const handleDelete = async (item) => {
    
    try {
      // Convert component name to endpoint by taking the prefix
      const routePrefix = window.location.pathname; 
      await api.delete(`${routePrefix}/${item.id}`);
      toast.success('Deleted successfully');
      load();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to delete');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit, search: debouncedSearch };
      if (statusFilter) params.status = statusFilter;
      if (frappeFilterVal && frappeFilterField && frappeFilterOp) {
        params.filterField = frappeFilterField;
        params.filterOp = frappeFilterOp;
        params.filterVal = frappeFilterVal;
      }

      const r = await api.get('/contacts', { params });
      setContacts(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearch, statusFilter]);

  const sortedContacts = useMemo(() => {
    const arr = [...contacts];
    if (!sortBy) return arr;
    arr.sort((a, b) => {
      const va = a[sortBy] || '';
      const vb = b[sortBy] || '';
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [contacts, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const totalPages = Math.ceil(total / limit);
  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) return;
    try {
      const routePrefix = window.location.pathname;
      const results = await Promise.allSettled(selectedItems.map(id => api.delete(`${routePrefix}/${encodeURIComponent(id)}`)));
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      if (failed.length === 0) {
        import('react-toastify').then(m => m.toast.success(`${successful.length} items have been deleted`));
      } else if (successful.length > 0) {
        import('react-toastify').then(m => m.toast.warning(`${successful.length} deleted, ${failed.length} failed (some items cannot be deleted)`));
      } else {
        import('react-toastify').then(m => m.toast.error(`Failed to delete items (they might not be deletable)`));
      }
      
      setSelectedItems([]);
      if (typeof load === 'function') load();
      else if (typeof fetchOpportunityTypes === 'function') fetchOpportunityTypes();
      else if (typeof fetchCampaigns === 'function') fetchCampaigns();
      else if (typeof fetchEmailTemplates === 'function') fetchEmailTemplates();
    } catch (err) {
      console.error(err);
      import('react-toastify').then(m => m.toast.error('An error occurred during deletion'));
      if (typeof load === 'function') load();
      else if (typeof fetchOpportunityTypes === 'function') fetchOpportunityTypes();
      else if (typeof fetchCampaigns === 'function') fetchCampaigns();
      else if (typeof fetchEmailTemplates === 'function') fetchEmailTemplates();
    }
  };



  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block whitespace-nowrap bg-white border border-gray-200 shadow-lg text-gray-700 text-xs py-1.5 px-3 rounded z-50">
              Toggle Sidebar <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border border-gray-200">Ctrl+K</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Contact</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            
            <button onClick={() => load()} className="p-1.5 text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 rounded-md transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
            
            <Link to="/contacts/new" className="flex items-center gap-1 px-4 py-1.5 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm ml-1 transition-colors">
              <Plus size={14}/> Add Contact
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white">
          
          {/* Top Filter Bar */}
          <div className="flex flex-col mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="ID" value={search} onChange={e=>setSearch(e.target.value)} className="w-24 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              <input type="text" placeholder="Full Name" className="w-32 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              
              <div className="flex-1"></div>
              
              

              
            </div>
          </div>

          {/* Table */}
          <div className="bg-white overflow-x-auto mt-2 border border-gray-100 rounded-lg">
            <table className="w-full text-left text-[13px] whitespace-nowrap min-w-[700px]">
              <thead className="bg-[#111827] text-white">
                <tr>
                  <th className="px-4 py-3 w-8"><input type="checkbox" className="rounded-sm border-gray-300" checked={sortedContacts.length > 0 && selectedItems.length === sortedContacts.length} onChange={(e) => setSelectedItems(e.target.checked ? sortedContacts.map(i => i.id) : [])} /></th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('full_name')}>
                    <div className="flex items-center gap-1">Full Name {sortBy === 'full_name' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('email_address')}>
                    <div className="flex items-center gap-1">Email Address {sortBy === 'email_address' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-1">Status {sortBy === 'status' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('phone')}>
                    <div className="flex items-center gap-1">Phone {sortBy === 'phone' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('id')}>
                    <div className="flex items-center gap-1">ID {sortBy === 'id' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>Last Updated On</span> {selectedItems.length > 0 ? (
                        <button onClick={handleBulkDelete} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors flex items-center justify-center">
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <Trash2 size={14} className="opacity-20"/>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && page === 1 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td>
                  </tr>
                ) : sortedContacts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-400 text-sm">No contacts found</td>
                  </tr>
                ) : (
                  sortedContacts.map((c) => {
                    const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ');
                    const primaryEmail = c.emails.find(e => e.is_primary)?.email_id || c.emails[0]?.email_id || '';
                    const primaryPhone = c.numbers.find(n => n.is_primary_phone || n.is_primary_mobile)?.number || c.numbers[0]?.number || '';
                  
    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded-sm border-gray-300" checked={selectedItems.includes(item.id)} onChange={(e) => { e.stopPropagation(); setSelectedItems(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)); }} /></td>
                        <td className="px-3 py-2 text-gray-700 font-medium">{fullName || c.id}</td>
                        <td className="px-3 py-2 text-gray-600">{primaryEmail}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${c.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></span> {c.status}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{primaryPhone}</td>
                        <td className="px-3 py-2 text-gray-500">{c.id}</td>
                        <td className="px-3 py-2 text-gray-500 flex justify-end">
                          <div className="flex items-center gap-3 text-[12px] opacity-70 hover:opacity-100 transition-opacity">
                            <span>1 d</span>
                            <button 
                            className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 0 && (
            <div className="flex flex-col sm:flex-row-reverse justify-between items-center py-4 gap-4 mt-2 border-t border-gray-100 mt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <div className="text-gray-700 text-[13px] font-medium min-w-[32px] text-center">
                  {page}
                </div>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactListPage;
