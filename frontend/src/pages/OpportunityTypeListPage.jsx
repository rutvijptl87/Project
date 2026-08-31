import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-toastify';
import { Plus, Settings, Filter, RefreshCw, FileText, Trash2 } from 'lucide-react';
import { Heart, MessageSquare } from 'lucide-react';

const OpportunityTypeListPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  
  const handleDelete = async (item) => {
    
    try {
      // Convert component name to endpoint by taking the prefix
      await api.delete(`/opportunity-types/${item.id}`);
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
      const res = await api.get('/opportunity-types');
      // The API returns the array directly
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load opportunity types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);


  const handleBulkDelete = async () => {
    try {
      const results = await Promise.allSettled(selectedItems.map(id => api.delete(`/opportunity-types/${encodeURIComponent(id)}`)));
      
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Opportunity Type</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 text-[13px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md flex items-center gap-2 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            List View
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          
          <button onClick={load} className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <RefreshCw size={14} />
          </button>
          <button className="h-8 px-4 bg-gray-900 hover:bg-black text-white text-[13px] font-medium rounded-md shadow-sm transition-colors flex items-center gap-1.5 ml-2">
            <Plus size={16} />
            Add Opportunity Type
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-gray-100 bg-white p-4 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Filter By</h3>
            <div className="space-y-1">
              <button className="w-full flex items-center justify-between px-2 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                Assigned To
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 9 12 5 16 9"></polyline><polyline points="16 15 12 19 8 15"></polyline></svg>
              </button>
              <button className="w-full flex items-center justify-between px-2 py-1.5 text-[13px] text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                Created By
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 9 12 5 16 9"></polyline><polyline points="16 15 12 19 8 15"></polyline></svg>
              </button>
              <button className="w-full flex items-center justify-start px-2 py-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
                Edit Filters
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tags</h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 9 12 5 16 9"></polyline><polyline points="16 15 12 19 8 15"></polyline></svg>
            </div>
            <button className="w-full flex items-center justify-start px-2 py-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
              Show Tags
            </button>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Save Filter</h3>
            <input 
              type="text" 
              placeholder="Filter Name" 
              className="w-full bg-gray-50 border border-gray-100 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-blue-400 focus:bg-white transition-colors mb-4"
            />
          </div>
          
          <div className="mt-auto">
            <p className="text-[12px] text-gray-400 mb-2 leading-relaxed px-2">
              Switch to Frappe CRM for smarter sales →
            </p>
          </div>
        </div>

        <div className="flex-1 bg-white p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="ID"
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-md pl-3 pr-8 py-1.5 text-[13px] focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 text-[13px] text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-md flex items-center gap-2 transition-colors">
                  <Filter size={14} /> Filter <X size={14} className="text-gray-400 ml-1" />
                </button>
                <button className="h-8 px-3 text-[13px] text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-md flex items-center gap-2 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                  Last Updated On
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#111827] text-white">
                  <tr>
                    <th className="px-4 py-3 w-8"><input type="checkbox" className="rounded-sm border-gray-300" checked={data.length > 0 && selectedItems.length === data.length} onChange={(e) => setSelectedItems(e.target.checked ? data.map(i => i.id) : [])} /></th>
                    <th className="px-4 py-2.5 text-left text-[12px] font-semibold ">ID</th>
                    <th className="px-4 py-2.5 text-left text-[12px] font-semibold ">Description</th>
                    <th className="px-4 py-2.5 text-right text-[12px] font-semibold w-32">
                      <div className="flex items-center justify-end gap-1">
                        {data.length} of {data.length} {selectedItems.length > 0 ? (
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
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">Loading...</td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <FileText size={32} className="mb-2 text-gray-300" />
                          <p className="text-[13px]">No Opportunity Types found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map(item => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-gray-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded-sm border-gray-300" checked={selectedItems.includes(item.id)} onChange={(e) => { e.stopPropagation(); setSelectedItems(prev => e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)); }} /></td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] text-gray-600 line-clamp-1 max-w-md"></div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3 text-[12px] text-gray-400">
                            <span>1 y</span>
                            <MessageSquare size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button 
                            className="flex items-center justify-center p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <button className="px-2 py-1 bg-white border border-gray-200 rounded text-[12px] text-gray-600 font-medium">20</button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded text-[12px] text-gray-600 transition-colors">100</button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded text-[12px] text-gray-600 transition-colors">500</button>
                <button className="px-2 py-1 hover:bg-gray-200 rounded text-[12px] text-gray-600 transition-colors">2500</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const X = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default OpportunityTypeListPage;
