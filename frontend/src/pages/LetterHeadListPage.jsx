import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Settings, Filter, RefreshCw, FileText, ArrowUpDown, Trash2, X } from 'lucide-react';

const LetterHeadListPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const limit = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/letter-heads/paginated', { params: { page, limit, search } });
      setData(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load letter heads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(data.map(item => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.length} letter heads?`)) return;
    try {
      const results = await Promise.allSettled(
        selectedItems.map(id => api.delete(`/letter-heads/${encodeURIComponent(id)}`))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      if (failed.length === 0) {
        toast.success(`${successful.length} letter heads deleted`);
      } else if (successful.length > 0) {
        toast.warning(`${successful.length} deleted, ${failed.length} failed`);
      } else {
        toast.error('Failed to delete letter heads');
      }
      
      setSelectedItems([]);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during deletion');
      fetchData();
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortBy] || '';
    let bVal = b[sortBy] || '';
    if (sortBy === 'status') {
      aVal = a.disabled ? 'Disabled' : 'Enabled';
      bVal = b.disabled ? 'Disabled' : 'Enabled';
    } else if (sortBy === 'default') {
      aVal = a.is_default ? 'Default' : '';
      bVal = b.is_default ? 'Default' : '';
    }
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1);
  });




  return (

    <div className="min-h-screen bg-gray-50/30 flex flex-col font-sans w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100 sticky top-16 z-10 gap-3 w-full">
        <div className="flex items-center gap-3">
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
            <Settings size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Letter Head</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            List View <span className="text-gray-400 ml-1">▼</span>
          </button>
          <button onClick={fetchData} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => navigate('/letter-heads/new')} className="ml-2 h-8 px-4 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-md shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={16} />
            Add Letter Head
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 flex flex-col bg-white m-4 border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center justify-between p-2 border-b border-gray-100">
            <div className="flex-1 max-w-sm">
              <input 
                type="text" 
                placeholder="ID"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-8 bg-gray-50 border border-gray-200 rounded-md px-3 text-[13px] focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 px-3 text-[13px] text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded flex items-center gap-1.5 transition-colors">
                <Filter size={14} /> Filter
              </button>
              <button className="h-8 px-3 text-[13px] text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200 rounded flex items-center gap-1.5 transition-colors">
                Last Updated On
              </button>
            </div>
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="h-8 px-3 text-[13px] text-red-600 hover:bg-red-50 border border-red-200 rounded flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Trash2 size={14} /> Delete ({selectedItems.length})
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-400 text-sm">Loading...</div>
            ) : sortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="text-gray-300" size={32} />
                </div>
                <div className="text-[14px] text-gray-600 mb-4">You haven't created a Letter Head yet</div>
                <button onClick={() => navigate('/letter-heads/new')} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-[13px] font-medium rounded-md transition-colors shadow-sm">
                  Create your first Letter Head
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-[12px] font-medium w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300" 
                        checked={sortedData.length > 0 && selectedItems.length === sortedData.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-[12px] font-medium cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1">Name {sortBy === 'name' ? <ArrowUpDown size={12} className="text-gray-600"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                    </th>
                    <th className="px-4 py-3 text-[12px] font-medium w-32 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleSort('status')}>
                      <div className="flex items-center gap-1">Status {sortBy === 'status' ? <ArrowUpDown size={12} className="text-gray-600"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                    </th>
                    <th className="px-4 py-3 text-[12px] font-medium w-32 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleSort('default')}>
                      <div className="flex items-center gap-1">Default {sortBy === 'default' ? <ArrowUpDown size={12} className="text-gray-600"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer group transition-colors" onClick={() => navigate(`/letter-heads/${item.id}`)}>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-blue-600 hover:underline">{item.name}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">
                        {item.disabled ? <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium">Disabled</span> : <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs font-medium">Enabled</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">
                        {item.is_default && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium border border-blue-100">Default</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 flex items-center">
            <div className="flex gap-1">
              <button className="px-2 py-1 text-[12px] font-medium text-gray-600 bg-gray-100 rounded">20</button>
              <button className="px-2 py-1 text-[12px] text-gray-500 hover:bg-gray-50 rounded">100</button>
              <button className="px-2 py-1 text-[12px] text-gray-500 hover:bg-gray-50 rounded">500</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LetterHeadListPage;
