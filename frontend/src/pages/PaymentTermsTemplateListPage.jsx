import React, { useEffect, useState, useMemo } from 'react';
import Pagination from '../components/Pagination';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, ArrowUpDown, RefreshCw, Filter, X, Menu, Trash2, Layers, FileText, CheckCircle } from 'lucide-react';
import Swal from 'sweetalert2';

const PaymentTermsTemplateListPage = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Frappe UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Filter states
  const [frappeFilterField, setFrappeFilterField] = useState('template_name');
  const [frappeFilterOp, setFrappeFilterOp] = useState('like');
  const [frappeFilterVal, setFrappeFilterVal] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState('template_name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
  
  return (
) => clearTimeout(handler);
  }, [search]);

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to delete Payment Terms Template "${item.template_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/payment-terms-templates/${item.id}`);
      toast.success('Template deleted successfully');
      load();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to delete');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit, q: debouncedSearch };
      if (frappeFilterVal && frappeFilterField && frappeFilterOp) {
        params.filterField = frappeFilterField;
        params.filterOp = frappeFilterOp;
        params.filterVal = frappeFilterVal;
      }

      const r = await api.get('/payment-terms-templates/paginated', { params });
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load Templates');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearch]);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (!sortBy) return arr;
    arr.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        cmp = (Number(va) || 0) - (Number(vb) || 0);
      } else {
        cmp = String(va || '').localeCompare(String(vb || ''), undefined, { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans max-w-[1600px] 2xl:max-w-[1920px] mx-auto w-full">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 flex items-center justify-between shadow-sm sticky top-16 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">Payment Terms Templates</h1>
            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{total}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => navigate('/payment-terms')}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm whitespace-nowrap"
          >
            <FileText size={14} className="text-blue-600" />
            <span className="hidden sm:inline">Payment Terms</span> Master
          </button>
          <Link 
            to="/payment-terms-templates/new" 
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-all shadow-sm whitespace-nowrap"
          >
            <Plus size={14} />
            Add Template
          </Link>
        </div>
      </header>

      {/* Toolbar & Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:max-w-md">
          <input
            type="text"
            placeholder="Search Templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={load} 
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Filter Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                frappeFilterVal 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={13} />
              Filter
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-30">
                <div className="text-xs font-semibold text-gray-700 mb-2">Filter Templates</div>
                <div className="space-y-2">
                  <select
                    value={frappeFilterField}
                    onChange={(e) => setFrappeFilterField(e.target.value)}
                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700"
                  >
                    <option value="template_name">Template Name</option>
                  </select>
                  <select
                    value={frappeFilterOp}
                    onChange={(e) => setFrappeFilterOp(e.target.value)}
                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700"
                  >
                    <option value="like">Contains</option>
                    <option value="eq">Equals</option>
                    <option value="neq">Not Equals</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value..."
                    value={frappeFilterVal}
                    onChange={(e) => setFrappeFilterVal(e.target.value)}
                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-700"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setFrappeFilterVal('');
                        setShowFilterMenu(false);
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sort Toggle */}
          <button
            onClick={() => toggleSort('template_name')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown size={13} />
            Sort: {sortBy === 'template_name' ? 'Name' : 'Date'} ({sortDir})
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto min-w-full">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200 text-gray-600 font-medium text-xs">
                <th className="py-3 px-2 sm:px-4 w-12 text-center">No.</th>
                <th 
                  className="py-3 px-2 sm:px-4 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleSort('template_name')}
                >
                  Template Name
                </th>
                <th className="py-3 px-2 sm:px-4 hidden sm:table-cell">Allocate Based On Terms</th>
                <th className="py-3 px-2 sm:px-4 hidden sm:table-cell">Number of Terms</th>
                <th className="py-3 px-2 sm:px-4 text-right hidden md:table-cell">Summary of Schedule</th>
                <th className="py-3 px-2 sm:px-4 w-16 text-center">Action</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      Loading Payment Terms Templates...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-gray-400">
                      <Layers size={32} className="mx-auto mb-2 opacity-30" />
                      <div className="font-medium text-sm text-gray-600 mb-1">No Templates Found</div>
                      <div className="text-xs text-gray-400 mb-4">Create templates to quickly apply schedules to quotations & sales orders</div>
                      <Link 
                        to="/payment-terms-templates/new" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={13} />
                        Add Template
                      </Link>
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((item, idx) => {
                    const termsList = item.terms || [];
                    return (
                      <tr
                        key={item.id}
                        onClick={() => navigate(`/payment-terms-templates/${item.id}`)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 text-center text-gray-400 font-mono">
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.template_name}
                        </td>
                        <td className="py-3 px-4">
                          {item.allocate_payment_based_on_payment_terms ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium border border-green-200">
                              <CheckCircle size={12} /> Yes
                            </span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                            {termsList.length} {termsList.length === 1 ? 'Term' : 'Terms'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 truncate max-w-xs">
                          {termsList.length > 0
                            ? termsList.map(t => `${t.payment_term || 'Term'} (${t.invoice_portion}%)`).join(' + ')
                            : 'No terms set'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => handleDelete(e, item)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} items
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-medium bg-white border border-gray-200 rounded">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
};

export default PaymentTermsTemplateListPage;
