import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, ArrowUpDown, List, RefreshCw, MoreHorizontal, Filter, X, Menu, Trash2 } from 'lucide-react';
import { formatINR } from '../lib/format';
import Pagination from '../components/Pagination';
import Swal from 'sweetalert2';

const ItemListPage = () => {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [frappeFilterField, setFrappeFilterField] = useState('ID');
  const [frappeFilterOp, setFrappeFilterOp] = useState('Equals');
  const [frappeFilterVal, setFrappeFilterVal] = useState('');

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
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to delete ${item.item_code}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/items/${item.id}`);
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
      const params = { page, limit, q: debouncedSearch };
      if (frappeFilterVal && frappeFilterField && frappeFilterOp) {
        params.filterField = frappeFilterField;
        params.filterOp = frappeFilterOp;
        params.filterVal = frappeFilterVal;
      }

      const r = await api.get('/items/paginated', { params });
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load Items');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, debouncedSearch, sortBy, sortDir]);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (!sortBy) return arr;
    arr.sort((a, b) => {
      const va = a[sortBy] || '';
      const vb = b[sortBy] || '';
      let cmp;
      if (typeof va === 'number' || typeof vb === 'number') {
        cmp = (va || 0) - (vb || 0);
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(sortedItems.map(i => i.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectOne = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter(i => i !== id));
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
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Item Code List</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-1.5 text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 rounded-md transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            </button>
            <Link to="/items/new" className="flex items-center gap-1 px-4 py-1.5 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded-md shadow-sm ml-1 transition-colors">
              <Plus size={14}/> Add Item
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white">
          <div className="flex flex-col mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Item Code / Name" value={search} onChange={e=>setSearch(e.target.value)} className="w-48 text-[13px] bg-gray-50 border-0 rounded-full px-3 py-1.5 text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" />
            </div>
          </div>

          <div className="bg-white overflow-hidden mt-2 border border-gray-100 rounded-lg">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : sortedItems.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <List size={32} className="text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm font-medium">No items found</p>
                <Link to="/items/new" className="mt-3 flex items-center gap-1 px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"><Plus size={12}/> Create First Item</Link>
              </div>
            ) : (
              <table className="w-full text-left text-[13px] whitespace-nowrap">
                <thead className="bg-[#111827] text-white">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10 text-center"><input type="checkbox" className="rounded border-gray-500 text-blue-600 bg-transparent focus:ring-blue-500" checked={selectedItems.length === sortedItems.length && sortedItems.length > 0} onChange={handleSelectAll} /></th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('item_code')}>
                      <div className="flex items-center gap-1">Item Code {sortBy === 'item_code' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown size={12} className="opacity-40" />}</div>
                    </th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('item_name')}>
                      <div className="flex items-center gap-1">Item Name {sortBy === 'item_name' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown size={12} className="opacity-40" />}</div>
                    </th>
                    <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('item_group')}>
                      <div className="flex items-center gap-1">Item Group {sortBy === 'item_group' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown size={12} className="opacity-40" />}</div>
                    </th>
                    <th className="px-4 py-3 font-medium">Standard Rate</th>
                    <th className="px-4 py-3 font-medium w-16 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedItems.map(item => (
                    <tr key={item.id} className="cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => navigate(`/items/${item.id}`)}>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={selectedItems.includes(item.id)} onChange={(e) => handleSelectOne(e, item.id)} /></td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.item_code}</td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{item.item_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.item_group}</td>
                      <td className="px-4 py-3 text-gray-600">{formatINR(item.standard_rate)}</td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleDelete(item)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {!loading && sortedItems.length > 0 && (
            <div className="mt-4 border-t border-gray-100 bg-white">
              <Pagination page={page} setPage={setPage} limit={limit} total={total} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemListPage;
