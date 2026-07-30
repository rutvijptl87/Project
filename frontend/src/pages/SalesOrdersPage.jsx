import React, { useEffect, useState, useMemo } from 'react';
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
  sales_order_no: 'ID',
  client_name: 'Customer Name',
  status: 'Status',
  transaction_date: 'Date',
  grand_total: 'Grand Total',
  title: 'Title',
  most_used: 'Most Used',
  company: 'Company',
  series: 'Series',
  sales_order_to: 'Sales Order To',
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
    case 'Draft': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-100 text-red-700">Draft</span>;
    case 'Open': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-orange-100 text-orange-700">Open</span>;
    case 'Expired': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-gray-100 text-gray-700">Expired</span>;
    case 'Ordered': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-100 text-emerald-700">Ordered</span>;
    case 'Lost': return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-red-100 text-red-700">Lost</span>;
    default: return <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-gray-100 text-gray-700">{status}</span>;
  }
};

const SalesOrdersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sales_orders, setSalesOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({
    id: '', title: '', sales_order_to: '', party: '', date: '', order_type: '', assigned_to: '', created_by: '', tags: ''
  });
  const [debouncedSearchFilters, setDebouncedSearchFilters] = useState({
    id: '', title: '', sales_order_to: '', party: '', date: '', order_type: '', assigned_to: '', created_by: '', tags: ''
  });
  
  // Frappe UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState('List');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
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

  const load = async () => {
    setLoading(true);
    try {
      const params = { 
        page, limit, 
        sortBy, sortDir,
        q_id: debouncedSearchFilters.id,
        q_title: debouncedSearchFilters.title,
        q_sales_order_to: debouncedSearchFilters.sales_order_to,
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

      const r = await api.get('/sales-orders/paginated', { params });
      setSalesOrders(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load sales_orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(sortedSalesOrders.map(q => q.id));
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearchFilters, statusFilter, sortBy, sortDir]);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    return formatActivityDay(dateStr);
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to delete ${item.sales_order_no || item.id}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/sales-orders/${encodeURIComponent(item.id)}`);
      import('react-toastify').then(m => m.toast.success('Deleted successfully'));
      load();
    } catch (err) {
      console.error(err);
      import('react-toastify').then(m => m.toast.error('Failed to delete item'));
    }
  };

  const sortedSalesOrders = sales_orders;

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
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-gray-900 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors">
              <Menu size={20}/>
            </button>
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block whitespace-nowrap bg-white border border-gray-200 shadow-lg text-gray-700 text-xs py-1.5 px-3 rounded z-50">
              Toggle Sidebar <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border border-gray-200">Ctrl+K</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Sales Order</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            
            <button onClick={() => load()} className="p-1.5 text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 rounded-md transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
            
            <Link to="/sales-orders/new" className="flex items-center gap-1 px-4 py-1.5 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm ml-1 transition-colors">
              <Plus size={14}/> Add Sales Order
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`w-56 border-r border-gray-100 bg-white px-5 py-6 flex flex-col gap-6 overflow-y-auto shrink-0 transition-all ${isSidebarOpen ? 'block' : 'hidden'}`}>
           
           <div>
             <h4 className="text-[12px] font-medium text-gray-500 mb-3">Filter By</h4>
             <div className="space-y-3">
                <div className="relative">
                  <div onClick={() => setShowAssignedToMenu(!showAssignedToMenu)} className="flex items-center justify-between w-full text-[13px] bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 text-gray-700 cursor-pointer transition-colors">
                    <span className={searchFilters.assigned_to ? "text-gray-900 font-medium truncate max-w-[120px]" : ""}>{searchFilters.assigned_to || 'Assigned To'}</span> <ArrowUpDown size={12} className="opacity-40 shrink-0"/>
                  </div>
                  {showAssignedToMenu && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 shadow-lg rounded-md p-2 z-20">
                      <input 
                        type="text" 
                        placeholder="Search User..." 
                        value={searchFilters.assigned_to || ''}
                        onChange={e => setSearchFilters({...searchFilters, assigned_to: e.target.value})}
                        className="w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" 
                      />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div onClick={() => setShowCreatedByMenu(!showCreatedByMenu)} className="flex items-center justify-between w-full text-[13px] bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 text-gray-700 cursor-pointer transition-colors">
                    <span className={searchFilters.created_by ? "text-gray-900 font-medium truncate max-w-[120px]" : ""}>{searchFilters.created_by || 'Created By'}</span> <ArrowUpDown size={12} className="opacity-40 shrink-0"/>
                  </div>
                  {showCreatedByMenu && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 shadow-lg rounded-md p-2 z-20">
                      <input 
                        type="text" 
                        placeholder="Search User..." 
                        value={searchFilters.created_by || ''}
                        onChange={e => setSearchFilters({...searchFilters, created_by: e.target.value})}
                        className="w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" 
                      />
                    </div>
                  )}
                </div>
             </div>
           </div>

           <div>
             <h4 className="text-[12px] font-medium text-gray-500 mb-3">Edit Filters</h4>
             <div className="space-y-3">
                <div className="relative">
                  <div onClick={() => setShowTagsMenu(!showTagsMenu)} className="flex items-center justify-between w-full text-[13px] bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 text-gray-700 cursor-pointer transition-colors">
                    <span className={searchFilters.tags ? "text-gray-900 font-medium truncate max-w-[120px]" : ""}>{searchFilters.tags || 'Tags'}</span> <ArrowUpDown size={12} className="opacity-40 shrink-0"/>
                  </div>
                  {showTagsMenu && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 shadow-lg rounded-md p-2 z-20">
                      <input 
                        type="text" 
                        placeholder="Search Tags..." 
                        value={searchFilters.tags || ''}
                        onChange={e => setSearchFilters({...searchFilters, tags: e.target.value})}
                        className="w-full text-[12px] border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500" 
                      />
                    </div>
                  )}
                </div>
                <div onClick={() => setShowTagsColumn(!showTagsColumn)} className="text-[12px] text-gray-500 hover:text-gray-800 cursor-pointer pl-2 select-none">
                  {showTagsColumn ? 'Hide Tags' : 'Show Tags'}
                </div>
             </div>
           </div>
           
           <div>
             <h4 className="text-[12px] font-medium text-gray-500 mb-3">Save Filter</h4>
             <input type="text" placeholder="Filter Name" className="w-full text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 focus:bg-white focus:ring-1 focus:ring-blue-500 placeholder-gray-400 transition-colors" />
           </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white">
          
          {/* Top Filter Bar */}
          <div className="flex flex-col mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="ID" value={searchFilters.id} onChange={e=>setSearchFilters({...searchFilters, id: e.target.value})} className="w-24 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              <input type="text" placeholder="Title" value={searchFilters.title} onChange={e=>setSearchFilters({...searchFilters, title: e.target.value})} className="w-32 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              <input type="text" placeholder="Sales Order To" value={searchFilters.sales_order_to} onChange={e=>setSearchFilters({...searchFilters, sales_order_to: e.target.value})} className="w-32 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              <input type="text" placeholder="Party" value={searchFilters.party} onChange={e=>setSearchFilters({...searchFilters, party: e.target.value})} className="w-32 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              <input type="text" placeholder="Date" value={searchFilters.date} onChange={e=>setSearchFilters({...searchFilters, date: e.target.value})} className="w-28 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
              
              <div className="flex-1"></div>
              
              

              
            </div>
            
            <div className="flex items-center mt-3 gap-2">
              <div className="relative">
                <div onClick={() => setShowOrderTypeMenu(!showOrderTypeMenu)} className="flex items-center justify-between w-36 text-[13px] bg-gray-50 hover:bg-gray-100 rounded-full px-3 py-1.5 text-gray-700 cursor-pointer transition-colors">
                  <span className={searchFilters.order_type ? "text-gray-900 font-medium truncate max-w-[100px]" : "text-gray-400"}>{searchFilters.order_type || 'Order Type'}</span> <ArrowUpDown size={12} className="opacity-40 shrink-0"/>
                </div>
                {showOrderTypeMenu && (
                  <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-gray-200 shadow-lg rounded-md py-1 z-20">
                    {['Sales', 'Maintenance', 'Shopping Cart'].map(type => (
                      <button 
                        key={type}
                        onClick={() => {
                          setSearchFilters({...searchFilters, order_type: type});
                          setShowOrderTypeMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${searchFilters.order_type === type ? 'bg-gray-50 font-medium' : 'text-gray-700'}`}
                      >
                        {type}
                      </button>
                    ))}
                    {searchFilters.order_type && (
                      <button 
                        onClick={() => {
                          setSearchFilters({...searchFilters, order_type: ''});
                          setShowOrderTypeMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 border-t border-gray-100 mt-1"
                      >
                        Clear Filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentView === 'List' ? (
            <>
              {/* Table */}
              <div className="bg-white overflow-hidden mt-2">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 w-8"><input type="checkbox" className="rounded-sm border-gray-300" checked={sortedSalesOrders.length > 0 && selectedIds.length === sortedSalesOrders.length} onChange={handleSelectAll} /></th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('title')}>
                    <div className="flex items-center gap-1">Title {sortBy === 'title' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  {showTagsColumn && <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('tag')}>
                    <div className="flex items-center gap-1">Tag {sortBy === 'tag' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>}
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-1">Status {sortBy === 'status' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('date')}>
                    <div className="flex items-center gap-1">Date {sortBy === 'date' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium text-right cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('grand_total')}>
                    <div className="flex items-center gap-1">Grand Total {sortBy === 'grand_total' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('id')}>
                    <div className="flex items-center gap-1">ID {sortBy === 'id' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  <th className="px-3 py-2 font-medium text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{Math.min(page * limit, total)} of {total}</span> {selectedIds.length > 0 ? (
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
                    <td colSpan={showTagsColumn ? "8" : "7"} className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</td>
                  </tr>
                ) : sortedSalesOrders.length === 0 ? (
                  <tr>
                    <td colSpan={showTagsColumn ? "8" : "7"} className="px-4 py-8 text-center text-gray-400 text-sm">No sales_orders found</td>
                  </tr>
                ) : (
                  sortedSalesOrders.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => navigate(`/sales-orders/${q.id}`)}>
                      <td className="px-3 py-2"><input type="checkbox" className="rounded-sm border-gray-300" checked={selectedIds.includes(q.id)} onChange={(e) => handleSelectOne(e, q.id)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-3 py-2 text-gray-700">{q.client_name}</td>
                      {showTagsColumn && (
                        <td className="px-3 py-2 text-[13px] text-gray-600">
                           {q.tags && q.tags.length > 0 ? q.tags.join(', ') : '-'}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className={`text-[13px] ${q.status === 'Draft' || q.status === 'Lost' || q.status === 'Cancelled' ? 'text-red-500' : 'text-gray-700'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{q.transaction_date?.split('-').reverse().join('-') || ''}</td>
                      <td className="px-3 py-2 text-gray-800 text-right">
                         {formatINR(q.grand_total || 0).replace('₹', '₹ ')}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-[12px] truncate max-w-[120px]">{q.sales_order_no}</td>
                      <td className="px-3 py-2 text-gray-500 flex justify-end" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 text-[12px] transition-opacity">
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
    </div>
  );
}

export default SalesOrdersPage;
