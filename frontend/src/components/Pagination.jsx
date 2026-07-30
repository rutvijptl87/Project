import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';

const Pagination = ({ page, setPage, limit, total }) => {
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col sm:flex-row-reverse justify-between items-center p-4 border-t gap-4" style={{ borderColor: 'var(--cc-border)' }}>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setPage(1)} 
          disabled={page === 1}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="First Page"
        >
          <ChevronsLeft size={16} />
        </button>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={page === 1}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="flex items-center gap-2 mx-1 text-sm">
          <div className="relative inline-flex items-center">
            <select 
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="appearance-none h-8 pl-3 pr-6 rounded bg-gray-100 hover:bg-gray-200 cursor-pointer text-sm font-medium outline-none transition-colors"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        <button 
          onClick={() => setPage(p => p + 1)} 
          disabled={page * limit >= total}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
        <button 
          onClick={() => setPage(totalPages)} 
          disabled={page * limit >= total}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Last Page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
      <div className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>
        Showing {total === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
      </div>
    </div>
  );
};

export default Pagination;
