import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, Search } from 'lucide-react';

export const CustomFrappeSelect = ({ label, value, onChange, options = [], disabled, required, onCreateNew, footerContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  const [showError, setShowError] = useState(false);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleValidate = () => setShowError(true);
    window.addEventListener('validate-forms', handleValidate);
    return () => window.removeEventListener('validate-forms', handleValidate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto focus search input
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    } else {
      // Handled by other useEffect
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getOptText = (opt) => typeof opt === 'string' ? opt : (opt.label || opt.title || opt.name || opt.value || '');



  const displayValue = typeof value === 'object' && value !== null
    ? (value?.label || value?.title || value?.name || '')
    : (options.find(opt => (opt.value || getOptText(opt)) === value) ? getOptText(options.find(opt => (opt.value || getOptText(opt)) === value)) : (value || ''));

  const [localInputValue, setLocalInputValue] = useState(displayValue || '');

  // Keep local input in sync with external value when it changes while NOT open
  useEffect(() => {
    if (!isOpen) {
      setLocalInputValue(displayValue || '');
    }
  }, [displayValue, isOpen]);

  // When searching, we use localInputValue instead of searchQuery
  const filteredOptions = options.filter(opt => {
    const query = (localInputValue || '').toLowerCase().replace(/%/g, '').trim();
    if (!query) return true;
    if (displayValue && localInputValue === displayValue) return true; // Show all if we haven't typed a NEW search query
    
    if (typeof opt === 'string') return opt.toLowerCase().includes(query);
    if (typeof opt === 'number') return String(opt).includes(query);
    if (typeof opt === 'object' && opt !== null) {
      return Object.values(opt).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(query));
    }
    return false;
  });

  return (
    <div className="flex flex-col mb-4 relative" ref={dropdownRef}>
      <label className="text-[12px] text-gray-600 mb-1 font-medium flex items-center tracking-tight">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div 
        className={`w-full bg-gray-50 hover:bg-gray-100 focus-within:bg-white border ${(!value && required && showError) ? 'border-red-400 bg-red-50/20' : 'border-gray-200'} rounded px-3 py-[5px] text-[13px] text-gray-800 cursor-text min-h-[30px] flex items-center justify-between transition-colors`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            if (searchInputRef.current) searchInputRef.current.focus();
          }
        }}
      >
        <input
          ref={searchInputRef}
          type="text"
          value={localInputValue}
          onChange={(e) => {
            setLocalInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay closing to allow clicks on dropdown to register
            // We use the mousedown event listener for closing, but if they just tab away:
            setTimeout(() => {
              if (isOpen && document.activeElement !== searchInputRef.current) {
                 setIsOpen(false);
              }
            }, 100);
          }}
          placeholder="Select..."
          disabled={disabled}
          className="w-full bg-transparent border-0 text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 truncate p-0 h-full"
        />
        {!disabled && <span className="text-[10px] text-gray-400 ml-1 pointer-events-none">▼</span>}
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl z-50 overflow-hidden py-1 max-h-72 flex flex-col">
          <div className="overflow-y-auto flex-1 max-h-48 divide-y divide-gray-50">
            {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => {
              const optTitle = getOptText(opt);
              const optCompany = typeof opt === 'string' ? null : opt.company;
              return (
                <div 
                  key={i} 
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${(opt.value || optTitle) === value ? 'font-bold bg-gray-100/60 text-blue-600' : 'font-medium text-gray-700'}`}
                  onMouseDown={(e) => { e.preventDefault(); onChange(opt.value !== undefined ? opt.value : optTitle); setIsOpen(false); }}
                >
                  <div className="text-[13px]">{optTitle}</div>
                  {optCompany && (
                    <div className="text-[11px] text-gray-400 font-normal mt-0.5">{optTitle} - {optCompany}</div>
                  )}
                </div>
              );
            }) : (
              <div className="px-4 py-3 text-[12px] text-gray-400 text-center italic">No matching options found.</div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50/50">
            {footerContent && (
              <div className="px-3 py-1.5 border-b border-gray-100">
                {footerContent}
              </div>
            )}
            {onCreateNew && (
              typeof onCreateNew === 'function' ? (
                <div 
                  onMouseDown={(e) => { e.preventDefault(); setIsOpen(false); onCreateNew(localInputValue.trim()); }} 
                  className="px-3 py-2 text-[13px] text-gray-800 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus size={14} className="text-gray-800" /> 
                  <span>Create a new {label}</span>
                </div>
              ) : (
                <Link 
                  to={onCreateNew} 
                  onMouseDown={(e) => { e.preventDefault(); setIsOpen(false); }} 
                  className="px-3 py-2 text-[13px] text-gray-800 hover:bg-gray-100 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus size={14} className="text-gray-800" /> 
                  <span>Create a new {label}</span>
                </Link>
              )
            )}
            <div 
              className="px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer font-normal transition-colors" 
              onMouseDown={(e) => { e.preventDefault(); setIsOpen(false); setIsAdvancedSearchOpen(true); }}
            >
              <Search size={14} className="text-gray-600" /> 
              <span>Advanced Search</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Search Modal */}
      {isAdvancedSearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 bg-gray-900/50 backdrop-blur-[1px]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[500px] mx-4 overflow-hidden flex flex-col border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50/80">
              <h2 className="text-base font-semibold text-gray-900">Select {label}</h2>
              <button onClick={() => setIsAdvancedSearchOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="mb-4">
                <label className="text-[12px] font-medium text-gray-700 mb-1 block">Beginning with</label>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-gray-400" />
                  <input 
                    type="text" 
                    value={localInputValue}
                    onChange={e => setLocalInputValue(e.target.value)}
                    placeholder="Search options..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-md pl-9 pr-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-1 block">You can use wildcard %</span>
              </div>
              
              <div className="border border-gray-200 rounded-md overflow-y-auto max-h-[250px] mb-4 divide-y divide-gray-100">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => {
                  const optTitle = getOptText(opt);
                  return (
                    <div 
                      key={idx}
                      onClick={() => { onChange(opt.value !== undefined ? opt.value : optTitle); setIsAdvancedSearchOpen(false); }}
                      className={`px-4 py-2.5 text-[13px] cursor-pointer hover:bg-blue-50 font-medium text-gray-800 transition-colors ${(opt.value || optTitle) === value ? 'bg-gray-100 font-bold text-blue-600' : ''}`}
                    >
                      {optTitle}
                    </div>
                  );
                }) : (
                  <div className="px-4 py-6 text-[13px] text-gray-400 text-center italic">No options found.</div>
                )}
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                {onCreateNew && (
                  typeof onCreateNew === 'function' ? (
                    <button 
                      type="button"
                      onClick={() => { setIsAdvancedSearchOpen(false); onCreateNew(localInputValue.trim()); }}
                      className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Create New {label}
                    </button>
                  ) : (
                    <Link 
                      to={onCreateNew}
                      onClick={() => setIsAdvancedSearchOpen(false)}
                      className="text-[13px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Create New {label}
                    </Link>
                  )
                )}
                <button 
                  onClick={() => setIsAdvancedSearchOpen(false)}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded shadow-sm transition-colors ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
