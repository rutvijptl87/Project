import React, { useEffect, useState, useMemo, useRef } from 'react';
import Pagination from '../components/Pagination';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toast } from 'react-toastify';
import { Plus, Search, Eye, FileText, ArrowUpDown, ArrowUp, ArrowDown, List, RefreshCw, MoreHorizontal, Filter, X, ChevronDown, Menu, MessageSquare, Heart, LayoutDashboard, Kanban, File, Trash2 } from 'lucide-react';
import { formatINR, formatActivityDay } from '../lib/format';
import Swal from 'sweetalert2';

const SORTABLE_COLUMNS = {
  created_at: 'Last Updated On',
  quotation_no: 'ID',
  client_name: 'Customer Name',
  status: 'Status',
  transaction_date: 'Date',
  grand_total: 'Grand Total',
  title: 'Title',
  most_used: 'Most Used',
  company: 'Company',
  series: 'Series',
  quotation_to: 'Quotation To',
  party: 'Party',
  order_type: 'Order Type',
  currency: 'Currency',
  exchange_rate: 'Exchange Rate',
  price_list: 'Price List',
  price_list_currency: 'Price List Currency',
  price_list_exchange_rate: 'Price List Exchange Rate',
  rounded_total: 'Rounded Total'
};

const StatusBadge = ({ status }) => {
  switch (status) {
    case 'Draft': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red text-on-red">Draft</span>;
    case 'Open': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-orange text-on-orange">Open</span>;
    case 'Expired': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-light-gray text-on-gray">Expired</span>;
    case 'Ordered': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-green text-on-green">Ordered</span>;
    case 'Lost': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red text-on-red">Lost</span>;
    default: return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-light-gray text-on-gray">{status}</span>;
  }
};

const QuotationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quotations, setQuotations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({
    id: '', title: '', quotation_to: '', party: '', date: '', order_type: '', assigned_to: '', created_by: '', tags: ''
  });
  const [debouncedSearchFilters, setDebouncedSearchFilters] = useState({
    id: '', title: '', quotation_to: '', party: '', date: '', order_type: '', assigned_to: '', created_by: '', tags: ''
  });
  
  // Frappe UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('List');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showOrderTypeMenu, setShowOrderTypeMenu] = useState(false);
  const [showAssignedToMenu, setShowAssignedToMenu] = useState(false);
  const [showCreatedByMenu, setShowCreatedByMenu] = useState(false);
  const [showTagsMenu, setShowTagsMenu] = useState(false);
  const [showTagsColumn, setShowTagsColumn] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [frappeFilterField, setFrappeFilterField] = useState('ID');
  const [frappeFilterOp, setFrappeFilterOp] = useState('Equals');
  const [frappeFilterVal, setFrappeFilterVal] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const [selectedIds, setSelectedIds] = useState([]);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState({ show: false, action: '', title: '' });
  const [assigneeInput, setAssigneeInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const headerRef = useRef(null);



  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
        setShowActionsMenu(false);
        setShowFilterMenu(false);
        setShowSortMenu(false);
        setShowOrderTypeMenu(false);
        setShowAssignedToMenu(false);
        setShowCreatedByMenu(false);
        setShowTagsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
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
      setDebouncedSearchFilters(searchFilters);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchFilters]);


  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(sortedQuotations.map(q => q.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const executeBulkAction = async (action, extraPayload = {}) => {
    try {
      setBulkActionLoading(true);
      await api.post('/quotations/bulk-action', {
        action,
        ids: selectedIds,
        ...extraPayload
      });
      setSelectedIds([]);
      setShowAssignModal(false);
      setShowTagsModal(false);
      setShowConfirmModal({ show: false, action: '', title: '' });
      setShowActionsMenu(false);
      load(); // refresh the list
    } catch (err) {
      alert("Action failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setBulkActionLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { 
        page, limit, 
        sortBy, sortDir,
        q_id: debouncedSearchFilters.id,
        q_title: debouncedSearchFilters.title,
        q_quotation_to: debouncedSearchFilters.quotation_to,
        q_party: debouncedSearchFilters.party,
        q_date: debouncedSearchFilters.date,
        q_order_type: debouncedSearchFilters.order_type,
        q_assigned_to: debouncedSearchFilters.assigned_to,
        q_created_by: debouncedSearchFilters.created_by,
        q_tags: debouncedSearchFilters.tags
      };
      if (statusFilter) params.status = statusFilter;
      if (frappeFilterVal && frappeFilterField && frappeFilterOp) {
        params.filterField = frappeFilterField;
        params.filterOp = frappeFilterOp;
        params.filterVal = frappeFilterVal;
      }

      const r = await api.get('/quotations/paginated', { params });
      setQuotations(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearchFilters, statusFilter, sortBy, sortDir]);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    return formatActivityDay(dateStr);
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to delete ${item.quotation_no || item.id}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/quotations/${encodeURIComponent(item.id)}`);
      import('react-toastify').then(m => m.toast.success('Deleted successfully'));
      load();
    } catch (err) {
      console.error(err);
      import('react-toastify').then(m => m.toast.error('Failed to delete item'));
    }
  };

  const sortedQuotations = quotations;

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
    try {
      const route = window.location.pathname.includes('quotation') ? '/quotations' : '/sales-orders';
      const results = await Promise.allSettled(selectedIds.map(id => api.delete(`${route}/${encodeURIComponent(id)}`)));
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      if (failed.length === 0) {
        import('react-toastify').then(m => m.toast.success(`${successful.length} items have been deleted`));
      } else if (successful.length > 0) {
        import('react-toastify').then(m => m.toast.warning(`${successful.length} deleted, ${failed.length} failed (some items cannot be deleted)`));
      } else {
        import('react-toastify').then(m => m.toast.error(`Failed to delete items (they might not be deletable)`));
      }
      
      setSelectedIds([]);
      load();
    } catch (err) {
      console.error(err);
      import('react-toastify').then(m => m.toast.error('An error occurred during deletion'));
      load();
    }
  };  return (
    <div className="min-h-screen frappe-page flex flex-col font-sans max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-2 sm:gap-4" ref={headerRef}>
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Quotation</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            
            <button onClick={() => load()} className="frappe-btn frappe-btn-default p-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
            
            <div className="relative">
              <button onClick={() => setShowSettingsMenu(!showSettingsMenu)} className="frappe-btn frappe-btn-default text-xs sm:text-sm px-2.5 sm:px-3 py-1.5">
                Quotations Settings <ChevronDown size={14} />
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 sm:w-56 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-20 max-h-80 overflow-y-auto">
                  <Link to="/items" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Item Code List</Link>
                  <Link to="/job-types" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Manage Job Type</Link>
                  <Link to="/job-sub-types" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Manage Job Sub Type</Link>
                  <Link to="/scope-of-works" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Manage Scope of Work</Link>
                  <Link to="/tax-categories" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Tax Category</Link>
                  <Link to="/sales-tax-templates" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Sales Taxes and Charges Template</Link>
                  <Link to="/payment-terms-templates" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Payment Terms Template</Link>
                  <Link to="/payment-terms" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Payment Terms</Link>
                  <Link to="/terms-and-conditions" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Terms and Conditions Template</Link>
                  <Link to="/test-templates" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Test Template</Link>
                  <Link to="/letter-heads" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Letter Head</Link>
                  <Link to="/print-headings" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Print Heading</Link>
                  <Link to="/addresses" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Address</Link>
                  <Link to="/site-addresses" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Site Address</Link>
                  <Link to="/contacts" className="block px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100">Contact</Link>
                </div>
              )}
            </div>
            
            {selectedIds.length > 0 ? (
              <div className="relative">
                <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="flex items-center gap-1 px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors">
                  Actions <ChevronDown size={14}/>
                </button>
                {showActionsMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-50">
                    <button 
                      onClick={() => { if(selectedIds.length === 1) navigate(`/sales-orders/new?quotation_id=${selectedIds[0]}`); }}
                      disabled={selectedIds.length !== 1}
                      className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Sales Order
                    </button>
                    <button 
                      disabled={selectedIds.length !== 1}
                      className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Sales Invoice
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button 
                      onClick={() => { if(selectedIds.length === 1) navigate(`/quotations/${selectedIds[0]}`); }}
                      disabled={selectedIds.length !== 1}
                      className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Edit
                    </button>
                    <button className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Export</button>
                    <button onClick={() => setShowAssignModal(true)} className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Assign To</button>
                    <button onClick={() => setShowConfirmModal({ show: true, action: 'clear_assignment', title: 'Clear Assignment?' })} className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Clear Assignment</button>
                    <button className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Apply Assignment Rule</button>
                    <button onClick={() => setShowTagsModal(true)} className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Add Tags</button>
                    <button 
                      disabled={selectedIds.length !== 1}
                      className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Print
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button onClick={() => setShowConfirmModal({ show: true, action: 'submit', title: 'Submit Quotation(s)?' })} className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Submit</button>
                    <button onClick={() => setShowConfirmModal({ show: true, action: 'cancel', title: 'Cancel Quotation(s)?' })} className="w-full text-left px-4 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button onClick={() => setShowConfirmModal({ show: true, action: 'delete', title: 'Delete Quotation(s)?' })} className="w-full text-left px-4 py-1.5 text-[13px] text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/quotations/new" className="flex items-center gap-1 px-3 sm:px-4 py-1.5 text-xs sm:text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm transition-colors whitespace-nowrap">
                <Plus size={14}/> Add Quotation
              </Link>
            )}

          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto bg-white">

          {currentView === 'List' ? (
            <>
              {/* Responsive Table Wrapper */}
              <div className="bg-white overflow-x-auto min-w-full rounded-lg border border-gray-200 mt-2 shadow-sm">
            <table className="w-full text-left text-xs sm:text-[13px] whitespace-nowrap">
              <thead className="bg-[#111827] text-white">
                <tr>
                  <th className="px-2 sm:px-3 py-3 w-8"><input type="checkbox" className="rounded-sm border-gray-600 bg-gray-800" checked={sortedQuotations.length > 0 && selectedIds.length === sortedQuotations.length} onChange={handleSelectAll} /></th>
                  <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('quotation_to')}>
                    <div className="flex items-center gap-1">Title {sortBy === 'quotation_to' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  {showTagsColumn && <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors hidden md:table-cell" onClick={() => toggleSort('tag')}>
                    <div className="flex items-center gap-1">Tag {sortBy === 'tag' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>}
                  <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-1">Status {sortBy === 'status' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors hidden sm:table-cell" onClick={() => toggleSort('created_at')}>
                    <div className="flex items-center gap-1">Date {sortBy === 'created_at' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors text-right" onClick={() => toggleSort('grand_total')}>
                    <div className="flex items-center justify-end gap-1">{sortBy === 'grand_total' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>} Grand Total (Excl. GST)</div>
                  </th>
                  <th className="px-2 sm:px-3 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors hidden md:table-cell" onClick={() => toggleSort('quotation_no')}>
                    <div className="flex items-center gap-1">ID {sortBy === 'quotation_no' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-2 sm:px-3 py-3 font-medium text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-gray-400 font-normal hidden sm:inline">{Math.min(page * limit, total)} of {total}</span>
                      {selectedIds.length > 0 ? (
                        <button onClick={handleBulkDelete} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors flex items-center justify-center">
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <Trash2 size={14} className="opacity-20 text-gray-500"/>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && page === 1 ? (
                  <tr>
                    <td colSpan={showTagsColumn ? "8" : "7"} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td>
                  </tr>
                ) : sortedQuotations.length === 0 ? (
                  <tr>
                    <td colSpan={showTagsColumn ? "8" : "7"} className="px-4 py-8 text-center text-gray-400 text-sm">No quotations found</td>
                  </tr>
                ) : (
                  sortedQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}>
                      <td className="px-2 sm:px-3 py-2.5"><input type="checkbox" className="rounded-sm border-gray-300" checked={selectedIds.includes(q.id)} onChange={(e) => handleSelectOne(e, q.id)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-700 font-medium">{q.client_name}</td>
                      {showTagsColumn && (
                        <td className="px-2 sm:px-3 py-2.5 text-xs text-gray-600 hidden md:table-cell">
                           {q.tags && q.tags.length > 0 ? q.tags.join(', ') : '-'}
                        </td>
                      )}
                      <td className="px-2 sm:px-3 py-2.5">
                        <span className={`text-xs sm:text-[13px] ${q.status === 'Draft' || q.status === 'Lost' || q.status === 'Cancelled' ? 'text-red-500' : 'text-gray-700'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-600 hidden sm:table-cell">{q.transaction_date?.split('-').reverse().join('-') || ''}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-800 text-right font-medium">
                         {formatINR((q.grand_total || 0) - (q.total_taxes_and_charges || 0)).replace('₹', '₹ ')}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-500 text-xs truncate max-w-[100px] sm:max-w-[120px] hidden md:table-cell">{q.quotation_no}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-gray-500 flex justify-end" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs transition-opacity">
                          <span className="opacity-70 hidden sm:inline">{formatTimeAgo(q.updated_at || q.created_at || q.transaction_date)}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(q); }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200/60 transition-all cursor-pointer text-gray-400 hover:text-red-500 opacity-70 hover:opacity-100"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 border-t border-gray-100 bg-white">
            <Pagination page={page} setPage={setPage} limit={limit} total={total} />
          </div>
          </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-gray-50/50 rounded-lg mt-4 border border-gray-200 border-dashed">
              {currentView === 'Report' && <File size={48} className="text-gray-300 mb-4" />}
              {currentView === 'Dashboard' && <LayoutDashboard size={48} className="text-gray-300 mb-4" />}
              {currentView === 'Kanban' && <Kanban size={48} className="text-gray-300 mb-4" />}
              <h3 className="text-lg font-medium text-gray-900">{currentView} View</h3>
              <p className="text-sm text-gray-500 mt-1">This view is currently under construction or not applicable for this entity.</p>
              <button onClick={() => setCurrentView('List')} className="mt-6 px-4 py-2 bg-white border border-gray-200 shadow-sm text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                Return to List View
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl">
            <h3 className="font-medium mb-3 text-sm">Assign To</h3>
            <input type="text" placeholder="Username..." value={assigneeInput} onChange={e => setAssigneeInput(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAssignModal(false)} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded">Cancel</button>
              <button onClick={() => executeBulkAction('assign', { assignee: assigneeInput })} disabled={bulkActionLoading || !assigneeInput} className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      {showTagsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl">
            <h3 className="font-medium mb-3 text-sm">Add Tags</h3>
            <input type="text" placeholder="Comma separated tags..." value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTagsModal(false)} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded">Cancel</button>
              <button onClick={() => executeBulkAction('add_tags', { tags: tagsInput.split(',').map(t => t.trim()).filter(t => t) })} disabled={bulkActionLoading || !tagsInput} className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50">Add Tags</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl">
            <h3 className="font-medium mb-3 text-sm">{showConfirmModal.title}</h3>
            <p className="text-xs text-gray-500 mb-4">Are you sure you want to perform this action on {selectedIds.length} item(s)?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmModal({ show: false, action: '', title: '' })} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded">Cancel</button>
              <button onClick={() => executeBulkAction(showConfirmModal.action)} disabled={bulkActionLoading} className="px-3 py-1.5 text-xs bg-red-600 text-white hover:bg-red-700 rounded disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default QuotationsPage;
