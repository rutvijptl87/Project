import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Settings, Filter, RefreshCw, FileText , X } from 'lucide-react';

const PrintHeadingListPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/print-headings/paginated', { params: { page, limit, search } });
      setData(res.data.data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load print headings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);
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

    <div className="min-h-screen bg-gray-50/30 flex flex-col font-sans">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors">
            <Settings size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Print Heading</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            List View <span className="text-gray-400 ml-1">▼</span>
          </button>
          <button onClick={fetchData} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => navigate('/print-headings/new')} className="ml-2 h-8 px-4 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-md shadow-sm transition-colors flex items-center gap-1.5">
            <Plus size={16} />
            Add Print Heading
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
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full text-gray-400 text-sm">Loading...</div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <FileText className="text-gray-300" size={32} />
                </div>
                <div className="text-[14px] text-gray-600 mb-4">You haven't created a Print Heading yet</div>
                <button onClick={() => navigate('/print-headings/new')} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-[13px] font-medium rounded-md transition-colors shadow-sm">
                  Create your first Print Heading
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-[12px] font-medium w-10 text-center"><input type="checkbox" className="rounded border-gray-300" /></th>
                    <th className="px-4 py-3 text-[12px] font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('id')}>
                    <div className="flex items-center gap-1">ID {sortBy === 'id' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                    <th className="px-4 py-3 text-[12px] font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('print_heading')}>
                    <div className="flex items-center gap-1">Print Heading {sortBy === 'print_heading' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                    <th className="px-4 py-3 text-[12px] font-medium cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('description')}>
                    <div className="flex items-center gap-1">Description {sortBy === 'description' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                    <th className="px-4 py-3 text-[12px] font-medium text-right w-24 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => toggleSort('2_of_2')}>
                    <div className="flex items-center gap-1">2 of 2 {sortBy === '2_of_2' ? <ArrowUpDown size={12} className="text-gray-300"/> : <ArrowUpDown size={12} className="opacity-20"/>}</div>
                  </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer group transition-colors" onClick={() => navigate(`/print-headings/${item.id}`)}>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{item.print_heading}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-blue-600 hover:underline">{item.print_heading}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-500">{item.description}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-400 text-right">1y</td>
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

export default PrintHeadingListPage;
