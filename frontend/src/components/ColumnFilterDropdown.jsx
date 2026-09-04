import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search, Filter } from 'lucide-react';

const statusBadgeStyles = {
  'pending': { bg: '#FEF2F2', text: '#991B1B', border: '#F87171' },
  'in progress': { bg: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  'follow up required': { bg: '#FFFBEB', text: '#B45309', border: '#FBBF24' },
  'done': { bg: '#D1FAE5', text: '#065F46', border: '#34D399' },
  'cancelled': { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
};

/**
 * Reusable Column Header Dropdown Filter Component
 */
const ColumnFilterDropdown = ({
  title,
  options = [],
  value = '',
  onChange,
  align = 'right',
  type = 'default',
  testId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const isActive = Boolean(value);

  // Normalize options into { value, label } array
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return {
        value: opt.value ?? opt.label ?? '',
        label: opt.label ?? opt.value ?? ''
      };
    });
  }, [options]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (val) => {
    if (value === val) {
      // clicking selected value clears filter
      onChange('');
    } else {
      onChange(val);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center rounded p-1 transition-all duration-150 ${
          isActive
            ? 'bg-emerald-100 text-emerald-800 shadow-xs ring-1 ring-emerald-400 font-semibold'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        }`}
        title={isActive ? `Filtered by: "${value}" (Click to change)` : `Filter by ${title}`}
        data-testid={testId || `filter-dropdown-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <ChevronDown size={13} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {isActive && (
          <span className="w-1.5 h-1.5 ml-0.5 rounded-full bg-emerald-600 animate-pulse" />
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-1.5 w-60 sm:w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1.5 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100`}
          style={{ minWidth: '13rem', maxHeight: '22rem' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-gray-50/70">
            <span className="font-semibold text-gray-700 uppercase tracking-wider text-[11px] truncate">
              Filter: {title}
            </span>
            {isActive && (
              <button
                type="button"
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 hover:underline font-medium text-[11px] flex items-center gap-0.5"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Search box (if > 5 options) */}
          {normalizedOptions.length > 5 && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${title}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-gray-800"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-48 py-1">
            {/* "All" Option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-gray-100 ${
                !value ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-gray-700'
              }`}
            >
              <span className="truncate italic">All (Show All)</span>
              {!value && <Check size={13} className="text-emerald-600 shrink-0 ml-2" />}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-gray-400 italic">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.toLowerCase() === opt.value.toLowerCase() || value === opt.value;
                const statusStyle = type === 'status' ? statusBadgeStyles[opt.value.toLowerCase()] : null;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors hover:bg-gray-100 ${
                      isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-gray-700'
                    }`}
                    title={opt.label}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {statusStyle ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          style={{
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            borderColor: statusStyle.border,
                          }}
                        >
                          {opt.label}
                        </span>
                      ) : type === 'project' ? (
                        <span className="font-mono-data text-xs text-emerald-700 truncate">{opt.label}</span>
                      ) : (
                        <span className="truncate text-xs">{opt.label}</span>
                      )}
                    </div>
                    {isSelected && <Check size={13} className="text-emerald-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnFilterDropdown;
