import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { CustomFrappeSelect } from '../components/CustomFrappeSelect';
import NewAddressModal from '../components/NewAddressModal';
import NewSiteAddressModal from '../components/NewSiteAddressModal';
import NewContactModal from '../components/NewContactModal';
import NewTermsAndConditionsModal from '../components/NewTermsAndConditionsModal';
import NewLetterHeadModal from '../components/NewLetterHeadModal';
import NewPrintHeadingModal from '../components/NewPrintHeadingModal';
import NewJobTypeModal from '../components/NewJobTypeModal';
import NewJobSubTypeModal from '../components/NewJobSubTypeModal';
import NewScopeOfWorkModal from '../components/NewScopeOfWorkModal';
import NewTestTemplateModal from '../components/NewTestTemplateModal';
import NewCustomerModal from '../components/NewCustomerModal';
import NewLeadModal from '../components/NewLeadModal';
import NewSalesTaxTemplateModal from '../components/NewSalesTaxTemplateModal';
import NewPriceListModal from '../components/NewPriceListModal';
import NewCurrencyModal from '../components/NewCurrencyModal';
import NewOpportunityTypeModal from '../components/NewOpportunityTypeModal';
import SalesOrderPrintTemplate from '../components/SalesOrderPrintTemplate';
import RichTextEditor from '../components/RichTextEditor';
import html2pdf from 'html2pdf.js';
import { api, API } from '../lib/api';
import { downloadFile } from '../lib/download';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Save, Plus, Trash2, Settings, Edit3, Paperclip, Tag, Share2, UserPlus, Heart, MessageSquare, FileText, ChevronUp, ChevronDown, ChevronRight, Copy , ArrowUpDown} from 'lucide-react';
import { toast } from 'react-toastify';
import { formatINR } from '../lib/format';
import { formatDistanceToNow } from 'date-fns';

import { X } from 'lucide-react';

// Scaled Print Preview — fits the 794px template into any container width using CSS transform
const TEMPLATE_WIDTH = 794;
const ScaledPrintPreview = ({ children }) => {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState('auto');

  const updateScale = useCallback(() => {
    if (containerRef.current && innerRef.current) {
      const available = containerRef.current.clientWidth;
      if (available > 0) {
        const targetWidth = Math.min(TEMPLATE_WIDTH, available - 32);
        const newScale = Math.max(0.3, Math.min(1, targetWidth / TEMPLATE_WIDTH));
        setScale(newScale);
        const naturalHeight = innerRef.current.scrollHeight;
        setScaledHeight(naturalHeight * newScale);
      }
    }
  }, []);

  useEffect(() => {
    updateScale();
    const timer = setTimeout(updateScale, 100);
    const timer2 = setTimeout(updateScale, 500);
    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(updateScale);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      ro.disconnect();
    };
  }, [updateScale]);

  return (
    <div
      ref={containerRef}
      className="w-full relative flex justify-center py-4"
      style={{
        height: scaledHeight !== 'auto' ? `${scaledHeight + 32}px` : 'auto',
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: `${TEMPLATE_WIDTH}px`,
          position: 'absolute',
          top: '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
};



// Reusable Frappe-style Modal
const Modal = ({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-3 sm:p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col mx-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};


// Reusable Frappe-like components for Light Theme
const Section = ({ title, children, defaultExpanded = true, collapsible = false, columns = 2 }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const gridColsClass = columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      {title && (
        <div 
          className={`flex items-center gap-2 mb-4 select-none text-gray-800 ${collapsible ? 'cursor-pointer' : ''}`}
          onClick={() => collapsible && setIsExpanded(!isExpanded)}
        >
          <h3 className="text-base font-semibold">{title}</h3>
          {collapsible && (
            <span className="text-gray-400">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          )}
        </div>
      )}
      {isExpanded && (
        <div className={`grid grid-cols-1 ${gridColsClass} gap-x-12 gap-y-0`}>
          {children}
        </div>
      )}
    </div>
  );
};

const FullSection = ({ title, children, defaultExpanded = true, collapsible = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="mb-8 border-b border-gray-200 pb-6">
      {title && (
        <div 
          className={`flex items-center gap-2 mb-4 select-none text-gray-800 ${collapsible ? 'cursor-pointer' : ''}`}
          onClick={() => collapsible && setIsExpanded(!isExpanded)}
        >
          <h3 className="text-base font-semibold">{title}</h3>
          {collapsible && (
            <span className="text-gray-400">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          )}
        </div>
      )}
      {isExpanded && (
        <div className="w-full">
          {children}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", options = [], disabled = false, required = false, as = "input", helpText = "", onCreateNew }) => (
  <div className="flex flex-col mb-4">
    <label className="text-[12px] text-gray-600 mb-1 font-medium flex items-center justify-between tracking-tight">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
      {onCreateNew && (
        <button type="button" onClick={onCreateNew} className="text-blue-600 hover:underline">Create New</button>
      )}
    </label>
    {as === "select" ? (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded px-3 py-[5px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt.id || opt} value={opt.value || opt.id || opt}>
            {opt.label || opt.name || opt}
          </option>
        ))}
      </select>
    ) : as === "textarea" ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded px-3 py-[5px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
      />
    ) : as === "checkbox" ? (
      <div className="flex items-center gap-2 mt-1">
        <input 
          type="checkbox" 
          checked={value} 
          onChange={e => onChange(e.target.checked)} 
          disabled={disabled}
          className="w-3.5 h-3.5 rounded-sm bg-gray-50 border-gray-300 checked:bg-blue-600 focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
        />
        {helpText && <span className="text-[13px] text-gray-600">{helpText}</span>}
      </div>
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded px-3 py-[5px] text-[13px] text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors disabled:bg-gray-50 disabled:text-gray-500"
      />
    )}
  </div>
);



 


// Helper for Indian Number to Words
function numberToWords(num) {
  if (num === 0) return 'Zero';
  if (!num) return '';
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  
  const numStr = num.toString().split('.')[0]; 
  if (numStr.length > 9) return 'Overflow';
  const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return `INR ${str.trim()} only.`;
}

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch (e) {
    return '';
  }
};

const CustomFrappeItemSelect = ({ label, value, onChange, options, disabled, onCreateNew }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 });

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(Math.max(rect.width, 320), window.innerWidth - 32);
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - popoverWidth - 16);
      }
      setCoords({
        top: rect.bottom + 4,
        left: left,
        width: popoverWidth
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen) {
      const handleScrollOrResize = () => updateCoords();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.item_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (opt.description && opt.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedOpt = options.find(o => o.item_code === value);

  return (
    <div className="relative w-full" ref={buttonRef}>
      <div 
        className={`w-full bg-transparent border-0 focus:ring-0 p-1 font-medium disabled:bg-transparent cursor-pointer min-h-[28px] flex items-center overflow-hidden ${!value ? 'text-gray-400' : 'text-gray-900'}`}
        onClick={handleToggle}
      >
        <span className="truncate block w-full">
          {selectedOpt ? selectedOpt.item_code : (value || 'Select Item...')}
        </span>
      </div>
      
      {isOpen && !disabled && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>
          <div 
            style={{ 
              position: 'fixed', 
              top: `${coords.top}px`, 
              left: `${coords.left}px`, 
              width: `${coords.width}px`,
              zIndex: 9999 
            }} 
            className="bg-white border border-gray-200 rounded-md shadow-2xl overflow-hidden py-1 max-h-[350px] flex flex-col"
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <input 
                type="text" 
                placeholder="Search items..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                <div 
                  key={opt.item_code} 
                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-50 last:border-0 ${opt.item_code === value ? 'bg-gray-50' : ''}`}
                  onClick={() => { onChange(opt.item_code, opt.item_name || '', opt.default_uom || '', opt.description || '', opt.standard_rate || opt.rate || 0); setIsOpen(false); }}
                >
                  <div className="text-[13px] font-bold text-gray-900">{opt.item_code}</div>
                  {opt.description && (
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2" dangerouslySetInnerHTML={{ __html: opt.description }} />
                  )}
                </div>
              )) : (
                <div className="px-4 py-3 text-[12px] text-gray-500 text-center">No items found.</div>
              )}
            </div>
            <div className="border-t border-gray-100 mt-1">
              <button onClick={() => { setIsOpen(false); onCreateNew(); }} className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer font-normal">
                <Plus size={14} className="text-gray-900" /> Create a new {label}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};


const INDIAN_STATES = [
  "01-Jammu and Kashmir", "02-Himachal Pradesh", "03-Punjab", "04-Chandigarh", "05-Uttarakhand", "06-Haryana", "07-Delhi",
  "08-Rajasthan", "09-Uttar Pradesh", "10-Bihar", "11-Sikkim", "12-Arunachal Pradesh", "13-Nagaland", "14-Manipur",
  "15-Mizoram", "16-Tripura", "17-Meghalaya", "18-Assam", "19-West Bengal", "20-Jharkhand", "21-Odisha", "22-Chhattisgarh",
  "23-Madhya Pradesh", "24-Gujarat", "26-Dadra and Nagar Haveli and Daman and Diu", "27-Maharashtra", "28-Andhra Pradesh",
  "29-Karnataka", "30-Goa", "31-Lakshadweep", "32-Kerala", "33-Tamil Nadu", "34-Puducherry", "35-Andaman and Nicobar Islands",
  "36-Telangana", "37-Andhra Pradesh", "38-Ladakh", "96-Other Countries", "97-Other Territory"
];

const SalesOrderCreatePage = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const quotationId = queryParams.get('quotation_id');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [jobSubTypes, setJobSubTypes] = useState([]);
  const [scopeOfWorks, setScopeOfWorks] = useState([]);
  const [taxCategories, setTaxCategories] = useState([]);
  const [salesTaxTemplates, setSalesTaxTemplates] = useState([]);
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState([]);
  const [termsAndConditions, setTermsAndConditions] = useState([]);
  const [letterHeads, setLetterHeads] = useState([]);
  const [printHeadings, setPrintHeadings] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [salesPersons, setSalesPersons] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [testTemplates, setTestTemplates] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [itemsDB, setItemsDB] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [showAddressModal, setShowAddressModal] = useState(null);
  const [showContactModal, setShowContactModal] = useState(null);
  const [showPaymentTermsTemplateModal, setShowPaymentTermsTemplateModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showLetterHeadModal, setShowLetterHeadModal] = useState(false);
  const [showPrintHeadingModal, setShowPrintHeadingModal] = useState(false);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showJobSubTypeModal, setShowJobSubTypeModal] = useState(false);
  const [showScopeOfWorkModal, setShowScopeOfWorkModal] = useState(false);
  const [showTestTemplateModal, setShowTestTemplateModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showSalesTaxTemplateModal, setShowSalesTaxTemplateModal] = useState(false);
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showUOMModal, setShowUOMModal] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [newModalQuery, setNewModalQuery] = useState('');
  const [leads, setLeads] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [siteAddresses, setSiteAddresses] = useState([]);
  const [companyAddresses, setCompanyAddresses] = useState([]);
  const [companyContacts, setCompanyContacts] = useState([]);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showEditRowModal, setShowEditRowModal] = useState(null);
  const [showTestRowModal, setShowTestRowModal] = useState(null);
  const [showTaxesRowModal, setShowTaxesRowModal] = useState(null);
  const [showPaymentRowModal, setShowPaymentRowModal] = useState(null);
  const [newItemForm, setNewItemForm] = useState({
    item_code: '', item_group: '', hsn_sac: '', default_uom: '',
    maintain_stock: false, is_fixed_asset: false, item_name: '', description: ''
  });
  const [selectedItems, setSelectedItems] = useState([]);

  const handleSelectRow = (idx, isSelected) => {
    if (isSelected) {
      setSelectedItems([...selectedItems, idx]);
    } else {
      setSelectedItems(selectedItems.filter(i => i !== idx));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedItems(form.items.map((_, i) => i));
    } else {
      setSelectedItems([]);
    }
  };

  const handleDeleteSelected = () => {
    const newItems = form.items.filter((_, i) => !selectedItems.includes(i));
    setForm({...form, items: newItems});
    setSelectedItems([]);
  };

  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    company: 'Nova Gadget House',
    sales_order_to: 'Lead',
    lead: '',
    client_id: '',
    client_name: '',
    currency: 'INR',
    price_list: 'Standard Selling',
    job_type: '',
    job_sub_type: '',
    greetings: '',
    scope_of_work_template: '',
    scope_of_work_details: '',
    is_lumpsum: false,
    items: [{ item_code: '', description: '', number: 0, rate: 0, is_alternative: false }],
    total_number: 0,
    total_net_weight: 0,
    tax_category: '',
    shipping_rule: 'Standard Shipping',
    incoterm: '',
    site_address: '',
    is_customer_exempted: false,
    taxes: [],
    pricing_rules: [],
    status: 'Draft',
    order_lost_reason: '',
    series: 'SAL-ORD-.YYYY.-',
    customer_address: '',
    contact_person: '',
    shipping_address: '',
    company_address: '',
    company_contact_person: '',
    address_display: '',
    contact_display: '',
    contact_mobile: '',
    contact_email: '',
    gst_category: 'Unregistered',
    payment_terms_template: '',
    terms: '',
    letter_head: '',
    select_print_heading: '',
    is_lumpsum: false,
    disable_rounded_total: false,
    internal_notes: '',
    created_at: null,
    updated_at: null,
    created_by_username: 'Administrator',
    assigned_to: [],
    attachments: [],
    tags: [],
    shared_with: [],
    payment_schedule: [],
    competitors: '',
    utm_campaign: '',
    utm_source: '',
    supplier_sales_order: '',
    territory: '',
    territory_manager: '',
    group_same_items: false,
    test_template: '',
    test_details: []
  });

  // Sidebar UI state
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [newAssign, setNewAssign] = useState('');
  
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [newAttachName, setNewAttachName] = useState('');
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [newShare, setNewShare] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const safeGet = (url) => api.get(url).catch(() => ({ data: [] }));
        const [clientRes, userRes, authRes, jtRes, jstRes, sowRes, itemsRes, taxCatRes, taxTempRes, paymentTempRes, termsAndConditionsRes, letterHeadsRes, printHeadingsRes, competitorsRes, campaignsRes, territoriesRes, salesPersonsRes, leadSourcesRes, testTemplatesRes, leadsRes, uomsRes] = await Promise.all([
          safeGet('/clients'),
          safeGet('/auth/users'),
          safeGet('/auth/me'),
          safeGet('/job-types'),
          safeGet('/job-sub-types'),
          safeGet('/scope-of-works'),
          safeGet('/items'),
          safeGet('/tax-categories'),
          safeGet('/sales-tax-templates'),
          safeGet('/payment-terms-templates'),
          safeGet('/terms-and-conditions'),
          safeGet('/letter-heads'),
          safeGet('/print-headings'),
          safeGet('/competitors'),
          safeGet('/campaigns'),
          safeGet('/territories'),
          safeGet('/sales-persons'),
          safeGet('/lead-sources'),
          safeGet('/test-templates'),
          safeGet('/leads'),
          safeGet('/uoms')
        ]);
        setClients(clientRes.data || []);
        setJobTypes(jtRes.data || []);
        setJobSubTypes(jstRes.data || []);
        setScopeOfWorks(sowRes.data || []);
        setItemsDB(itemsRes.data || []);
        setTaxCategories(taxCatRes.data || []);
        setSalesTaxTemplates(taxTempRes.data || []);
        setPaymentTermsTemplates(paymentTempRes.data || []);
        setTermsAndConditions(termsAndConditionsRes.data || []);
        setLetterHeads(letterHeadsRes.data || []);
        setPrintHeadings(printHeadingsRes.data || []);
        setCompetitors(competitorsRes.data || []);
        setCampaigns(campaignsRes.data || []);
        setTerritories(territoriesRes.data || []);
        setSalesPersons(salesPersonsRes.data || []);
        setLeadSources(leadSourcesRes.data || []);
        setTestTemplates(testTemplatesRes.data || []);
        setLeads(leadsRes.data || []);
        setUoms(uomsRes.data || []);
        
        const loggedInUser = authRes.data;
      } catch (e) {
        console.error(e);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    if (isEdit) {
      fetchSalesOrder();
    }
  }, [isEdit]);

  const activeClient = clients.find(c => (c.name || c.client_name) === form.client_name || c.id === form.client_id) || {
    name: form.client_name,
    address: form.address_display || form.company_address
  };
  const activeLetterHead = letterHeads.find(l => (l.name || l.letter_head_name) === form.letter_head) || letterHeads.find(l => l.is_default) || letterHeads[0];

  const handleDownloadPDF = async () => {
    if (!form.id) {
      toast.error('Please save the sales order first before downloading the PDF.');
      return;
    }
    try {
      toast.info('Generating PDF...');
      await downloadFile(`${API}/sales-orders/${form.id}/pdf`, `Sales_Order-${form.sales_order_no || form.id}.pdf`);
      toast.success('PDF Downloaded Successfully!');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error('Failed to download PDF: ' + (err?.message || 'Unknown error'));
    }
  };

  useEffect(() => {
    if (form.client_id) {
      const client = clients.find(c => c.id === form.client_id);
      if (client) {
        api.get(`/addresses`, { params: { link_name: client.name } }).then(res => {
          setAddresses(res.data.data || []);
        }).catch(() => {});
      }
    } else {
      setAddresses([]);
    }
  }, [form.client_id, clients]);

  useEffect(() => {
    api.get(`/site-addresses`, { params: { limit: 1000 } }).then(res => {
      setSiteAddresses(res.data.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/addresses`, { params: { link_document_type: 'Company', link_name: form.company || 'Creator Consultant' } }).then(res => {
      setCompanyAddresses(res.data.data || []);
    }).catch(() => {});
    api.get(`/contacts`, { params: { link_document_type: 'Company', link_name: form.company || 'Creator Consultant' } }).then(res => {
      setCompanyContacts(res.data.data || []);
    }).catch(() => {});
  }, [form.company]);

  // Effect: When payment_terms_template changes, update payment_schedule
  useEffect(() => {
    if (!form.payment_terms_template) return;
    const template = paymentTermsTemplates.find(t => 
      t.template_name === form.payment_terms_template || 
      t.name === form.payment_terms_template || 
      t.id === form.payment_terms_template
    );
    if (template) {
      const termsList = template.terms || template.schedule || [];
      const totalAmount = calculations?.finalTotal || calculations?.grandTotal || 0;
      updateForm('payment_schedule', termsList.map(t => {
        const portion = Number(t.invoice_portion) || 0;
        const amt = totalAmount > 0 ? (portion / 100) * totalAmount : 0;
        return {
          payment_term: t.payment_term || t.payment_term_name || t.name || '',
          description: t.description || '',
          due_date: t.due_date || '',
          invoice_portion: portion,
          due_date_based_on: t.due_date_based_on || 'Day(s) after invoice date',
          credit_days: t.credit_days || 0,
          payment_amount: Number(amt.toFixed(2))
        };
      }));
    }
  }, [form.payment_terms_template, paymentTermsTemplates]);

  // Effect: When tc_name changes, update terms
  useEffect(() => {
    if (!form.tc_name || isEdit) return;
    const template = termsAndConditions.find(t => t.title === form.tc_name);
    if (template && template.terms) {
      updateForm('terms', template.terms);
    }
  }, [form.tc_name, isEdit, termsAndConditions]);

  const updateForm = (key, val) => {
    if (key === 'site_address') {
      const selectedAddr = (siteAddresses || []).find(a => a.id === val || a.name === val);
      const addrText = selectedAddr
        ? [selectedAddr.address_line1, selectedAddr.address_line2, selectedAddr.city, selectedAddr.state ? (selectedAddr.state.includes('-') ? selectedAddr.state.split('-')[1] : selectedAddr.state) : null, selectedAddr.postal_code ? `PIN Code: ${selectedAddr.postal_code}` : null, selectedAddr.country].filter(Boolean).join(', ')
        : (typeof val === 'string' && !val.startsWith('SADDR-') && !val.startsWith('ADDR-') ? val : '');
      setForm(prev => ({ ...prev, site_address: val, site_address_text: addrText }));
    } else {
      setForm(prev => ({ ...prev, [key]: val }));
    }
  };

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setForm(prev => ({
        ...prev,
        client_id: client.id,
        client_name: client.name,
        client_gstin: client.gstin || '',
        customer_address: client.address ? `${client.name}-Billing` : '',
        address_display: client.address || client.principal_address || '',
        contact_person: client.name || '',
        contact_display: client.name || '',
        place_of_supply: client.place_of_supply || '',
        gst_category: client.gst_type || 'Unregistered',
        contact_mobile: client.phone || '',
        contact_email: client.email || ''
      }));
    } else {
      setForm(prev => ({ ...prev, client_id: '', client_name: '', address_display: '', contact_display: '' }));
    }
  };

  const updateItem = (index, key, val) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [key]: val };
      
      if (!prev.is_lumpsum && (key === 'number' || key === 'rate' || key === 'distributed_discount_amount')) {
        const qty = Number(newItems[index].number) || 0;
        const rate = Number(newItems[index].rate) || 0;
        const taxableValue = Math.max(0, (qty * rate));
        newItems[index].amount = taxableValue;
        newItems[index].taxable_value = taxableValue;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const updateItemFields = (index, fields) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], ...fields };
      
      if (!prev.is_lumpsum) {
        const qty = Number(newItems[index].number) || 0;
        const rate = Number(newItems[index].rate) || 0;
        const taxableValue = Math.max(0, (qty * rate));
        newItems[index].amount = taxableValue;
        newItems[index].taxable_value = taxableValue;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => setForm(prev => ({
    ...prev,
    items: [...prev.items, { item_code: '', description: '', number: 0, rate: 0, is_alternative: false }]
  }));

  const updateTax = (index, key, val) => {
    const newTaxes = [...form.taxes];
    newTaxes[index] = { ...newTaxes[index], [key]: val };
    setForm(prev => ({ ...prev, taxes: newTaxes }));
  };

  const addTax = () => setForm(prev => ({
    ...prev,
    taxes: [...prev.taxes, { charge_type: 'Actual', account_head: '', tax_rate: 0, tax_amount: 0, total: 0 }]
  }));

  const addPricingRule = () => setForm(prev => ({
    ...prev,
    pricing_rules: [...prev.pricing_rules, { pricing_rule: '', item_code: '' }]
  }));
  const updatePricingRule = (index, key, val) => {
    const newRules = [...form.pricing_rules];
    newRules[index] = { ...newRules[index], [key]: val };
    setForm(prev => ({ ...prev, pricing_rules: newRules }));
  };

  const addPaymentSchedule = () => setForm(prev => ({
    ...prev,
    payment_schedule: [...prev.payment_schedule, { payment_term: '', description: '', due_date: '', invoice_portion: 0, payment_amount: 0 }]
  }));
  const updatePaymentSchedule = (index, key, val) => {
    const newSchedule = [...form.payment_schedule];
    newSchedule[index] = { ...newSchedule[index], [key]: val };
    
    const totalAmount = calculations?.finalTotal || calculations?.grandTotal || 0;
    if (key === 'invoice_portion') {
      const portion = Number(val) || 0;
      newSchedule[index].payment_amount = Number(((portion / 100) * totalAmount).toFixed(2));
    } else if (key === 'payment_amount') {
      const amt = Number(val) || 0;
      if (totalAmount > 0) {
        newSchedule[index].invoice_portion = Number(((amt / totalAmount) * 100).toFixed(2));
      }
    }
    
    setForm(prev => ({ ...prev, payment_schedule: newSchedule }));
  };

  // Sidebar Actions
  const handleAddTag = (e) => {
    if (e.key === 'Enter' && newTag.trim()) {
      if (!form.tags.includes(newTag.trim())) {
        setForm(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      }
      setNewTag('');
      setIsTagsOpen(false);
    }
  };
  const removeTag = (tag) => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));

  const handleAddAssign = () => {
    if (newAssign.trim() && !form.assigned_to.includes(newAssign.trim())) {
      setForm(prev => ({ ...prev, assigned_to: [...prev.assigned_to, newAssign.trim()] }));
    }
    setNewAssign('');
    setIsAssignOpen(false);
  };
  const removeAssign = (user) => setForm(prev => ({ ...prev, assigned_to: prev.assigned_to.filter(u => u !== user) }));

  useEffect(() => {
    if (form.tax_category && salesTaxTemplates.length > 0) {
      const match = salesTaxTemplates.find(t => t.tax_category === form.tax_category);
      if (match && form.taxes_and_charges_template !== match.title) {
        handleTaxTemplateChange(match.title);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tax_category, salesTaxTemplates]);

  const handleTaxTemplateChange = (val) => {
    updateForm('taxes_and_charges_template', val);
    if (!val) return;
    const template = salesTaxTemplates.find(t => t.title === val);
    if (template && template.taxes) {
      const newTaxes = template.taxes.map(t => ({
        charge_type: t.charge_type || t.type || 'On Net Total',
        account_head: t.account_head,
        tax_rate: t.tax_rate || t.rate || 0,
        tax_amount: t.amount || t.tax_amount || 0
      }));
      updateForm('taxes', newTaxes);
    }
  };

  const [uploadingAttach, setUploadingAttach] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    if (!files || files.length === 0) return;
    const file = files[0];
    
    setUploadingAttach(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newAttach = {
        id: Date.now().toString(),
        name: res.data.filename || file.name,
        url: res.data.url,
        size: res.data.size || file.size,
        uploaded_at: new Date().toISOString()
      };
      
      const updatedAttachments = [...(form.attachments || []), newAttach];
      const updated = { ...form, attachments: updatedAttachments };
      setForm(updated);
      setIsAttachOpen(false);
      setNewAttachName('');
      toast.success('File uploaded successfully!');
      
      if (isEdit && id) {
        try {
          await api.put(`/sales-orders/${id}`, updated);
        } catch(err) {
          console.error('Failed to sync attachment to backend', err);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploadingAttach(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleLike = async () => {
    const isLiked = form.has_liked || (form.likes_users || []).includes(user?.id || 'me');
    const newLikesUsers = isLiked 
      ? (form.likes_users || []).filter(u => u !== (user?.id || 'me'))
      : [...(form.likes_users || []), user?.id || 'me'];
    const newLikesCount = Math.max(0, newLikesUsers.length);
    const updated = { ...form, has_liked: !isLiked, likes_users: newLikesUsers, likes_count: newLikesCount };
    setForm(updated);
    if (isEdit && id) {
      try {
        await api.put(`/sales-orders/${id}`, updated);
      } catch(e) {}
    }
  };

  const handleToggleFollow = async () => {
    const isFollowing = form.is_following || (form.followers || []).includes(user?.id || 'me');
    const newFollowers = isFollowing
      ? (form.followers || []).filter(u => u !== (user?.id || 'me'))
      : [...(form.followers || []), user?.id || 'me'];
    const updated = { ...form, is_following: !isFollowing, followers: newFollowers };
    setForm(updated);
    if (isEdit && id) {
      try {
        await api.put(`/sales-orders/${id}`, updated);
        toast.success(isFollowing ? 'Unfollowed document' : 'Now following document');
      } catch(e) {}
    } else {
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    const commentObj = {
      id: Date.now().toString(),
      text: newCommentText.trim(),
      user_name: user?.name || form.created_by_username || 'Administrator',
      created_at: new Date().toISOString()
    };
    const updatedComments = [commentObj, ...(form.comments || [])];
    const updated = { ...form, comments: updatedComments };
    setForm(updated);
    setNewCommentText('');
    if (isEdit && id) {
      try {
        await api.put(`/sales-orders/${encodeURIComponent(id)}`, updated);
        toast.success('Comment posted');
      } catch (e) {
        const msg = e.response?.data?.detail || e.message || 'Unknown error';
        toast.error(`Failed to save comment: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
      }
    } else {
      toast.success('Comment added');
    }
  };

  const handleDeleteComment = async (commentId) => {
    const updatedComments = (form.comments || []).filter(c => c.id !== commentId);
    const updated = { ...form, comments: updatedComments };
    setForm(updated);
    if (isEdit && id) {
      try {
        await api.put(`/sales-orders/${id}`, updated);
        toast.success('Comment removed');
      } catch(e) {}
    }
  };

  const handleAddAttach = async () => {
    if (newAttachName.trim()) {
      const newAttach = {
        id: Date.now().toString(),
        name: newAttachName.trim(),
        url: newAttachName.trim().startsWith('http') ? newAttachName.trim() : '#',
        uploaded_at: new Date().toISOString()
      };
      const updatedAttachments = [...(form.attachments || []), newAttach];
      const updated = { ...form, attachments: updatedAttachments };
      setForm(updated);
      if (isEdit && id) {
        try {
          await api.put(`/sales-orders/${id}`, updated);
        } catch(e) {}
      }
    }
    setNewAttachName('');
    setIsAttachOpen(false);
  };
  const removeAttach = async (index) => {
    const updatedAttachments = form.attachments.filter((_, i) => i !== index);
    const updated = { ...form, attachments: updatedAttachments };
    setForm(updated);
    if (isEdit && id) {
      try {
        await api.put(`/sales-orders/${id}`, updated);
      } catch(e) {}
    }
  };

  const handleAddShare = () => {
    if (newShare.trim() && !form.shared_with.includes(newShare.trim())) {
      setForm(prev => ({ ...prev, shared_with: [...prev.shared_with, newShare.trim()] }));
    }
    setNewShare('');
    setIsShareOpen(false);
  };
  const removeShare = (user) => setForm(prev => ({ ...prev, shared_with: prev.shared_with.filter(u => u !== user) }));

  const calculations = useMemo(() => {
    const totalNumber = form.items.reduce((sum, item) => sum + (Number(item.number) || 0), 0);
    const netTotal = form.is_lumpsum 
        ? form.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
        : form.items.reduce((sum, item) => sum + ((Number(item.number) || 0) * (Number(item.rate) || 0)), 0);
    
    let currentTotal = netTotal;
    let totalTaxAmount = 0;
    const computedTaxes = form.taxes.map(tax => {
      let taxAmt = 0;
      if (tax.charge_type === 'Actual') {
        taxAmt = Number(tax.tax_amount) || 0;
      } else if (tax.charge_type === 'On Net Total') {
        taxAmt = netTotal * ((Number(tax.tax_rate) || 0) / 100);
      } else if (tax.charge_type === 'On Previous Row Amount') {
        taxAmt = currentTotal * ((Number(tax.tax_rate) || 0) / 100);
      }
      currentTotal += taxAmt;
      totalTaxAmount += taxAmt;
      return { ...tax, computed_amount: taxAmt, computed_total: currentTotal };
    });

    const activeTaxCategory = taxCategories.find(c => c.title === form.tax_category);
    const isReverseCharge = activeTaxCategory?.is_reverse_charge || form.tax_category === 'Registered Composition';
    const appliedTaxAmount = isReverseCharge ? 0 : totalTaxAmount;

    const grandTotal = Math.max(0, netTotal + appliedTaxAmount);
    const roundedTotal = Math.round(grandTotal);
    const roundingAdjustment = roundedTotal - grandTotal;
    const finalTotal = form.disable_rounded_total ? grandTotal : roundedTotal;
    
    // Compute Tax Breakup (simplified mockup of Frappe logic)
    const taxBreakup = form.items.map(item => {
        const itemNet = form.is_lumpsum ? (Number(item.amount) || 0) : (Number(item.number) || 0) * (Number(item.rate) || 0);
        const itemTax = itemNet > 0 ? (itemNet / netTotal) * totalTaxAmount : 0;
        return {
            item_code: item.item_code,
            taxable_amount: itemNet,
            tax_amount: itemTax
        };
    });
    
    return {
      totalNumber,
      netTotal,
      totalTaxAmount,
      computedTaxes,
      taxBreakup,
      grandTotal,
      roundedTotal,
      roundingAdjustment,
      finalTotal,
      inWords: numberToWords(finalTotal)
    };
  }, [form.items, form.taxes, form.disable_rounded_total, form.is_lumpsum, taxCategories, form.tax_category]);

  // Effect: Sync payment schedule amounts when total amount changes
  useEffect(() => {
    const totalAmount = calculations?.finalTotal || calculations?.grandTotal || 0;
    if (form.payment_schedule && form.payment_schedule.length > 0 && totalAmount > 0) {
      let changed = false;
      const newSchedule = form.payment_schedule.map(schedule => {
        const portion = Number(schedule.invoice_portion) || 0;
        const expectedAmount = Number(((portion / 100) * totalAmount).toFixed(2));
        if (Number(schedule.payment_amount) !== expectedAmount && portion > 0) {
          changed = true;
          return { ...schedule, payment_amount: expectedAmount };
        }
        return schedule;
      });
      if (changed) {
        setForm(prev => ({ ...prev, payment_schedule: newSchedule }));
      }
    }
  }, [calculations?.finalTotal, calculations?.grandTotal]);


  
  const handleTestTemplateSelect = (templateName) => {
    updateForm('test_template', templateName);
    const template = testTemplates.find(t => t.test_name === templateName);
    if (template && template.test_details) {
      // Only auto-fill test rows if both job_type AND job_sub_type are set
      // AND both match the template's values exactly
      const jobTypeMatch = form.job_type && template.job_type && form.job_type === template.job_type;
      const subTypeMatch = form.job_sub_type && template.job_sub_type && form.job_sub_type === template.job_sub_type;
      if (jobTypeMatch && subTypeMatch) {
        updateForm('test_details', template.test_details.map(td => ({
          test_name: td.test_name,
          points: td.points,
          test_image: td.test_image || '',
          test_description: td.test_description || ''
        })));
      }
    }
  };

  
  const updateTestRow = (index, field, value) => {
    const newTests = [...form.test_details];
    newTests[index][field] = value;
    updateForm('test_details', newTests);
  };

  const handleTestImageUpload = (index) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            try {
                const res = await api.post('/test-images/upload', {
                    filename: file.name,
                    base64: base64Data
                });
                if (res.data && res.data.url) {
                    updateTestRow(index, 'test_image', res.data.url);
                    import('react-toastify').then(m => m.toast.success('Image attached successfully'));
                }
            } catch (err) {
                console.error(err);
                import('react-toastify').then(m => m.toast.error('Failed to upload image'));
            }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSave = async (requestedStatus) => {
    window.dispatchEvent(new Event('validate-forms'));
    if (form.sales_order_to === 'Customer' && !form.client_id) {
      toast.error('Customer is required');
      return;
    }
    setSaving(true);
    try {
      const targetStatus = (!isEdit || !id) ? 'Draft' : (requestedStatus || form.status || 'Draft');

      const enrichedItems = (form.items || []).map(item => ({
        ...item,
        amount: form.is_lumpsum ? (Number(item.amount) || 0) : ((Number(item.number) || 0) * (Number(item.rate) || 0)),
      }));
      const enrichedTaxes = (form.taxes || []).map((tax, idx) => ({
        ...tax,
        tax_amount: calculations.computedTaxes[idx]?.computed_amount || 0,
        amount: calculations.computedTaxes[idx]?.computed_amount || 0,
        computed_amount: calculations.computedTaxes[idx]?.computed_amount || 0
      }));
      const payload = {
        ...form,
        status: targetStatus,
        items: enrichedItems,
        taxes: enrichedTaxes,
        net_total: calculations.netTotal,
        sub_total: calculations.netTotal,
        total_taxes_and_charges: calculations.totalTaxAmount,
        grand_total: calculations.grandTotal,
        rounded_total: calculations.roundedTotal,
        total_amount: calculations.finalTotal,
        amount_in_words: calculations.inWords,
      };
      if (isEdit && id) {
        const res = await api.put(`/sales-orders/${id}`, payload);
        toast.success(targetStatus === 'Open' ? 'Sales Order submitted successfully' : 'Sales Order updated');
        setForm(res.data);
      } else {
        const res = await api.post('/sales_orders', payload);
        toast.success('Sales Order created as Draft');
        navigate(`/sales-orders/${res.data.id}`);
      }
      return;
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = form.status === 'Ordered' || form.status === 'Lost' || form.status === 'Cancelled' || isPreviewMode;

  const [collapsedRowSections, setCollapsedRowSections] = useState({ description: false, image: false, quantity: false, discount: false, weight: false });
  const toggleRowSection = (sec) => setCollapsedRowSections(p => ({...p, [sec]: !p[sec]}));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 font-sans">
      <div className="sticky top-16 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sales_orders')} className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              {isEdit ? form.sales_order_no || 'Sales Order' : 'New Sales Order'}
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                form.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                form.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                form.status === 'Ordered' ? 'bg-emerald-100 text-emerald-800' :
                'bg-red-100 text-red-800'
              }`}>
                {form.status}
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPDF} className="px-3 py-1 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors shadow-sm">
            Download PDF
          </button>
          
          {form.status !== 'Cancelled' && form.status !== 'Lost' && !isPreviewMode && (
            <>
              {isEdit && form.status === 'Draft' ? (
                <>
                  <button
                    onClick={() => handleSave('Draft')}
                    disabled={saving}
                    className="px-3 py-1 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleSave('Open')}
                    disabled={saving}
                    className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition-colors ml-1"
                  >
                    Submit
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleSave(form.status || 'Draft')}
                  disabled={saving}
                  className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition-colors"
                >
                  Save
                </button>
              )}
            </>
          )}

          {!isPreviewMode && (
            <button
              onClick={() => setIsPreviewMode(true)}
              className="px-4 py-1 bg-white border border-blue-600 hover:bg-blue-50 text-blue-600 text-sm font-medium rounded shadow-sm transition-colors flex items-center gap-2 ml-1"
            >
              Preview
            </button>
          )}


        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 mt-2 flex flex-col md:flex-row gap-8 items-start">
        
        {/* Left Sidebar */}
        {isEdit && (
          <div className="w-full md:w-64 shrink-0 space-y-8">
            <div className="space-y-4">
               {/* Assigned To */}
               <div>
                 <div className="flex items-center justify-between group cursor-pointer mb-1" onClick={() => setIsAssignOpen(true)}>
                    <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-900 transition-colors">
                       <UserPlus size={16} />
                       <span className="text-[13px] font-medium">Assigned To</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded p-0.5 transition-colors"><Plus size={14}/></button>
                 </div>
                 
                 <Modal title="Assign To" isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)}>
                   <div className="space-y-4">
                     <div className="flex flex-col">
                       <label className="text-xs text-gray-600 mb-1 font-medium">Assign To <span className="text-red-500">*</span></label>
                       <input type="text" value={newAssign} onChange={e => setNewAssign(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAssign()} placeholder="Select User" className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                     </div>
                     <div className="flex flex-col">
                       <label className="text-xs text-gray-600 mb-1 font-medium">Comment</label>
                       <textarea rows={3} placeholder="Add a comment..." className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"></textarea>
                     </div>
                     <div className="flex justify-end pt-2">
                       <button onClick={handleAddAssign} className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-700">Add</button>
                     </div>
                   </div>
                 </Modal>

                 {form.assigned_to.map(user => (
                   <div key={user} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded mb-1 border border-gray-100">
                     <span>{user}</span>
                     <button onClick={() => removeAssign(user)} className="text-red-400 hover:text-red-600">×</button>
                   </div>
                 ))}
               </div>
                        {/* Attachments */}
               <div>
                  <div className="flex items-center justify-between group cursor-pointer mb-1" onClick={() => setIsAttachOpen(true)}>
                     <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-900 transition-colors">
                        <Paperclip size={16} />
                        <span className="text-[13px] font-medium">Attachments</span>
                        {form.attachments && form.attachments.length > 0 && (
                          <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-1.5 py-0.2 rounded-full">{form.attachments.length}</span>
                        )}
                     </div>
                     <button type="button" className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded p-0.5 transition-colors"><Plus size={14}/></button>
                  </div>
                  
                  <Modal title="Attach File" isOpen={isAttachOpen} onClose={() => setIsAttachOpen(false)}>
                    <div className="space-y-4">
                      {/* Real Drag & Drop / Clickable File Upload Area */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e); }}
                        className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer ${uploadingAttach ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                        />
                        <Paperclip className="mx-auto text-gray-400 mb-2" size={26}/>
                        {uploadingAttach ? (
                          <p className="text-sm font-medium text-blue-600 animate-pulse">Uploading file...</p>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-700 mb-1">Click to select file or drag & drop</p>
                            <p className="text-[11px] text-gray-400">PDF, Excel, Word, Images, Zip or any document</p>
                          </>
                        )}
                      </div>

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink mx-3 text-gray-400 text-xs uppercase font-medium">Or enter link / name manually</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newAttachName} 
                          onChange={e => setNewAttachName(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleAddAttach()} 
                          placeholder="e.g. Specification_v2.pdf or URL link" 
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                          disabled={uploadingAttach}
                        />
                        <button 
                          type="button"
                          onClick={handleAddAttach} 
                          disabled={uploadingAttach || !newAttachName.trim()}
                          className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {form.attachments && form.attachments.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Attached Files ({form.attachments.length})</h4>
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {form.attachments.map((att, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded border border-gray-200">
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <Paperclip size={13} className="text-blue-500 shrink-0" />
                                  {att.url && att.url !== '#' ? (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline truncate">
                                      {att.name || att.filename || `Attachment ${idx + 1}`}
                                    </a>
                                  ) : (
                                    <span className="font-medium text-gray-700 truncate">{att.name || att.filename || `Attachment ${idx + 1}`}</span>
                                  )}
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => removeAttach(idx)} 
                                  className="text-gray-400 hover:text-red-600 font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                  title="Remove attachment"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Modal>

                  {form.attachments && form.attachments.length > 0 ? (
                    <div className="space-y-1 pl-1 mt-1">
                      {form.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50/80 hover:bg-blue-50/50 px-2 py-1.5 rounded border border-gray-150 transition-colors">
                          <div className="flex items-center gap-1.5 truncate flex-1 pr-1">
                            <Paperclip size={12} className="text-blue-500 shrink-0" />
                            {file.url && file.url !== '#' ? (
                              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium truncate" title={`Download ${file.name}`}>
                                {file.name || file.filename || `File ${idx + 1}`}
                              </a>
                            ) : (
                              <span className="text-gray-700 font-medium truncate">{file.name || file.filename || `File ${idx + 1}`}</span>
                            )}
                          </div>
                          <button type="button" onClick={() => removeAttach(idx)} className="text-red-400 hover:text-red-600 ml-1 font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
               
               {/* Tags */}
               <div>
                 <div className="flex items-center justify-between group cursor-pointer mb-1" onClick={() => setIsTagsOpen(true)}>
                    <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-900 transition-colors">
                       <Tag size={16} />
                       <span className="text-[13px] font-medium">Tags</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded p-0.5 transition-colors"><Plus size={14}/></button>
                 </div>
                 
                 <Modal title="Add Tags" isOpen={isTagsOpen} onClose={() => setIsTagsOpen(false)}>
                   <div className="space-y-4">
                     <div className="flex flex-col">
                       <label className="text-xs text-gray-600 mb-1 font-medium">Tag Name</label>
                       <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={handleAddTag} placeholder="Type tag and press Enter" className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                     </div>
                   </div>
                 </Modal>

                 <div className="flex flex-wrap gap-1">
                   {form.tags.map(tag => (
                     <span key={tag} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
                       {tag}
                       <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">×</button>
                     </span>
                   ))}
                 </div>
               </div>
               
               {/* Share */}
               <div>
                 <div className="flex items-center justify-between group cursor-pointer mb-1" onClick={() => setIsShareOpen(true)}>
                    <div className="flex items-center gap-2 text-gray-600 group-hover:text-gray-900 transition-colors">
                       <Share2 size={16} />
                       <span className="text-[13px] font-medium">Share</span>
                    </div>
                    <button className="text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded p-0.5 transition-colors"><Plus size={14}/></button>
                 </div>
                 
                 <Modal title="Share With" isOpen={isShareOpen} onClose={() => setIsShareOpen(false)}>
                   <div className="space-y-4">
                     <div className="flex flex-col">
                       <label className="text-xs text-gray-600 mb-1 font-medium">User or Role</label>
                       <input type="text" value={newShare} onChange={e => setNewShare(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddShare()} placeholder="Search by Name or Email" className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" autoFocus />
                     </div>
                     <div className="flex gap-4">
                       <label className="flex items-center gap-2 text-sm text-gray-700">
                         <input type="checkbox" className="rounded-sm text-blue-600" defaultChecked /> Can Read
                       </label>
                       <label className="flex items-center gap-2 text-sm text-gray-700">
                         <input type="checkbox" className="rounded-sm text-blue-600" defaultChecked /> Can Write
                       </label>
                     </div>
                     <div className="flex justify-end pt-2">
                       <button onClick={handleAddShare} className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-700">Share</button>
                     </div>
                   </div>
                 </Modal>

                 {form.shared_with.map(user => (
                   <div key={user} className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded mb-1 border border-gray-100">
                     <span className="truncate">{user}</span>
                     <button onClick={() => removeShare(user)} className="text-red-400 hover:text-red-600 ml-2">×</button>
                   </div>
                 ))}
               </div>
            </div>
            
            {/* <div className="text-[13px] text-gray-600 font-medium">
               Repeats Daily
            </div>
            
            {isEdit && (
            <div className="flex items-center gap-4 text-gray-600 text-[13px] font-medium pt-1">
                <button 
                  type="button"
                  onClick={handleToggleLike}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer ${
                    form.has_liked || (form.likes_users || []).includes(user?.id || 'me')
                      ? 'text-red-600 bg-red-50 font-semibold' 
                      : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                  }`}
                  title={form.has_liked ? 'Unlike' : 'Like'}
                >
                  <Heart size={14} className={form.has_liked || (form.likes_users || []).includes(user?.id || 'me') ? 'fill-red-600 text-red-600' : ''} />
                  <span>{form.likes_count || (form.likes_users || []).length || 0}</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('comments-activity-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-all cursor-pointer"
                  title="View / Add Comments"
                >
                  <MessageSquare size={14} />
                  <span>{(form.comments || []).length || 0}</span>
                </button>

                <button 
                  type="button"
                  onClick={handleToggleFollow}
                  className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    form.is_following || (form.followers || []).includes(user?.id || 'me')
                      ? 'text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {form.is_following || (form.followers || []).includes(user?.id || 'me') ? 'Following ✓' : '+ Follow'}
                </button>
            </div>
            )}
            
            <div className="space-y-4">
                {isEdit ? (
                    <>
                        {form.updated_at && (
                           <p className="text-[12px] text-gray-500 leading-tight">
                               <span className="font-semibold text-gray-800">{form.created_by_username || 'Administrator'}</span> last edited this • {formatDistanceToNow(new Date(form.updated_at), { addSuffix: true })}
                           </p>
                        )}
                        {form.created_at && (
                           <p className="text-[12px] text-gray-500 leading-tight">
                               <span className="font-semibold text-gray-800">{form.created_by_username || 'Administrator'}</span> created this • {formatDistanceToNow(new Date(form.created_at), { addSuffix: true })}
                           </p>
                        )}
                    </>
                ) : (
                   <p className="text-[12px] text-gray-500 leading-tight">
                       You are creating this document.
                   </p>
                )}
            </div> */}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Tab Bar */}
          <div className="flex items-center gap-6 border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap">
            {[
              { id: 'details', label: 'Details' },
              { id: 'address_contact', label: 'Address & Contact' },
              { id: 'terms', label: 'Terms' },
              { id: 'more_info', label: 'More Info' },
              ...(isEdit ? [{ id: 'connections', label: 'Connections' }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 text-[13px] font-medium transition-colors border-b-[3px] ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
  
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {activeTab === 'details' && (
              <>
                <div className="mb-8 border-b border-gray-200 pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 mt-4">
                    <Field label="Series" as="select" options={['SAL-QTN-.YYYY.-']} value={form.series || 'SAL-QTN-.YYYY.-'} onChange={v => updateForm('series', v)} disabled={isReadOnly} required />
                    <Field label="Date" type="date" value={form.transaction_date} onChange={v => updateForm('transaction_date', v)} disabled={isReadOnly} required />

                    <Field 
                      label="Sales Order To" 
                      as="select" 
                      value={form.sales_order_to} 
                      onChange={v => updateForm('sales_order_to', v)}
                      options={['Customer', 'Lead']}
                      disabled={isReadOnly}
                      required
                    />


                    <div className="col-span-1">
                    {form.sales_order_to === 'Lead' ? (
                      <CustomFrappeSelect 
                        label="Lead" 
                        value={form.lead} 
                        onChange={v => updateForm('lead', v)} 
                        options={leads.map(l => typeof l === 'string' ? l : l.lead_name || l.name)}
                        disabled={isReadOnly} 
                        required 
                        onCreateNew={(q) => { setNewModalQuery(typeof q === 'string' ? q : ''); setShowLeadModal(true); }}
                      />
                    ) : (
                      <CustomFrappeSelect 
                        label="Customer" 
                        value={form.client_id} 
                        onChange={handleClientChange}
                        options={clients.map(c => ({ value: c.id, title: c.name, company: c.customer_group }))}
                        disabled={isReadOnly}
                        required
                        onCreateNew={(q) => { setNewModalQuery(typeof q === 'string' ? q : ''); setShowCustomerModal(true); }}
                      />
                    )}
                    </div>
                  </div>
                </div>

                <Section title="Job Details" collapsible={true}>
                <CustomFrappeSelect 
                  label="Job Type" 
                  options={jobTypes.map(jt => jt.name)} 
                  value={form.job_type} 
                  onChange={v => {
                    updateForm('job_type', v);
                    const subTypeObj = jobSubTypes.find(jst => jst.name === form.job_sub_type);
                    const newSubType = (subTypeObj && subTypeObj.parent_job_type_name === v) ? form.job_sub_type : '';
                    if (form.job_sub_type !== newSubType) {
                      updateForm('job_sub_type', newSubType);
                    }
                    
                    const match = jobTypes.find(jt => jt.name === v);
                    if (match && match.greetings) {
                      updateForm('greetings', match.greetings);
                    }
                    
                    const sowMatch = scopeOfWorks.find(sow => sow.job_type_name === v && (!sow.job_sub_type_name || !newSubType || sow.job_sub_type_name === newSubType));
                    if (sowMatch && sowMatch.details) {
                      updateForm('scope_of_work', sowMatch.details);
                    }
                    
                    const testTemplateMatch = testTemplates.find(t => t.job_type === v && (!t.job_sub_type || !newSubType || t.job_sub_type === newSubType));
                    if (testTemplateMatch) {
                      updateForm('test_template', testTemplateMatch.test_name);
                      if (testTemplateMatch.test_details) {
                        updateForm('test_details', testTemplateMatch.test_details.map(td => ({
                          test_name: td.test_name,
                          points: td.points || 0,
                          test_image: td.test_image || '',
                          test_description: td.test_description || ''
                        })));
                      }
                    }
                  }} 
                  disabled={isReadOnly} 
                  required 
                  onCreateNew={(q) => { setNewModalQuery(typeof q === 'string' ? q : ''); setShowJobTypeModal(true); }}
                />
                <CustomFrappeSelect 
                  label="Job Sub Type" 
                  options={jobSubTypes.filter(jst => !form.job_type || jst.parent_job_type_name === form.job_type).map(jst => jst.name)} 
                  value={form.job_sub_type} 
                  onChange={v => {
                    updateForm('job_sub_type', v);
                    const selectedJst = jobSubTypes.find(jst => jst.name === v);
                    const parentJt = selectedJst ? selectedJst.parent_job_type_name : null;
                    const effectiveJt = (parentJt && (!form.job_type || form.job_type !== parentJt)) ? parentJt : form.job_type;
                    if (effectiveJt !== form.job_type && effectiveJt) {
                      updateForm('job_type', effectiveJt);
                    }
                    
                    const sowMatch = scopeOfWorks.find(sow => (sow.job_type_name === effectiveJt || !effectiveJt) && sow.job_sub_type_name === v);
                    if (sowMatch && sowMatch.details) {
                      updateForm('scope_of_work', sowMatch.details);
                    }
                    
                    const testTemplateMatch = testTemplates.find(t => (t.job_type === effectiveJt || !effectiveJt) && t.job_sub_type === v);
                    if (testTemplateMatch) {
                      updateForm('test_template', testTemplateMatch.test_name);
                      if (testTemplateMatch.test_details) {
                        updateForm('test_details', testTemplateMatch.test_details.map(td => ({
                          test_name: td.test_name,
                          points: td.points || 0,
                          test_image: td.test_image || '',
                          test_description: td.test_description || ''
                        })));
                      }
                    }
                  }} 
                  disabled={isReadOnly} 
                  onCreateNew={(q) => { setNewModalQuery(typeof q === 'string' ? q : ''); setShowJobSubTypeModal(true); }}
                />
                </Section>
                
                <FullSection title="Greetings" collapsible={true}>
                  <RichTextEditor 
                    value={form.greetings} 
                    onChange={v => updateForm('greetings', v)} 
                    disabled={isReadOnly} 
                    placeholder="Enter greetings text..."
                  />
                </FullSection>

                <FullSection title="Scope of Work" collapsible={true}>
                  <div className="mb-4 max-w-xl">
                    <Field 
                      label="Scope of Work Template Applied" 
                      value={form.scope_of_work_template || 'Custom'} 
                      disabled={true} 
                    />
                  </div>
                  <RichTextEditor 
                    value={form.scope_of_work_details} 
                    onChange={v => updateForm('scope_of_work_details', v)} 
                    disabled={isReadOnly} 
                    placeholder="Enter scope of work..." 
                  />
                </FullSection>

                {form.job_type && (
                  <FullSection title="Test Details" collapsible={true}>
                  <div className="mb-4 max-w-xl">
                    
                      <CustomFrappeSelect
                        label="Test Template"
                        value={form.test_template}
                        onChange={handleTestTemplateSelect}
                        disabled={isReadOnly}
                        options={testTemplates
                          .filter(t => !t.job_type || t.job_type === form.job_type)
                          .filter(t => !t.job_sub_type || t.job_sub_type === form.job_sub_type)
                          .map(t => ({ value: t.test_name, title: t.test_name }))}
                        footerContent={
                          <span className="text-[11px] text-blue-500">
                            Filters applied for Job Type = {form.job_type || 'empty'}, Job Sub Type = {form.job_sub_type || 'empty'}
                          </span>
                        }
                        onCreateNew={(q) => { setNewModalQuery(typeof q === 'string' ? q : ''); setShowTestTemplateModal(true); }}
                      />
    
                  </div>
                  
                  <div className="mb-2 text-xs font-medium text-gray-600">Tests to be Performed</div>
                  <div className="border border-gray-200 rounded mb-3 overflow-visible">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-[12px] font-medium w-10 text-center"><input type="checkbox" className="rounded-sm border-gray-300" disabled={isReadOnly} /></th>
                          <th className="px-3 py-2 text-[12px] font-medium w-12 text-center">No.</th>
                          <th className="px-3 py-2 text-[12px] font-medium ">Tests <span className="text-red-500">*</span></th>
                          <th className="px-3 py-2 text-[12px] font-medium w-24 text-right">Points <span className="text-red-500">*</span></th>
                          <th className="px-3 py-2 w-10 text-center text-gray-400"><Edit3 size={14} className="mx-auto"/></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {form.test_details.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-3 py-10 text-center text-[12px] text-gray-500">
                              <div className="flex flex-col items-center justify-center text-gray-400">
                                <FileText size={32} strokeWidth={1} className="mb-2 text-gray-300" />
                                <span>No Data</span>
                              </div>
                            </td>
                          </tr>
                        ) : form.test_details.map((test, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-center"><input type="checkbox" className="rounded-sm border-gray-300" disabled={isReadOnly} /></td>
                            <td className="px-3 py-2 text-center text-[13px] text-gray-800">{index + 1}</td>
                            <td className="px-3 py-2 text-[13px] font-semibold text-gray-800">
                              <input 
                                type="text" 
                                value={test.test_name} 
                                onChange={e => {
                                  const newTests = [...form.test_details];
                                  newTests[index].test_name = e.target.value;
                                  updateForm('test_details', newTests);
                                }}
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[13px] font-medium text-gray-800" 
                                placeholder="Test name"
                                disabled={isReadOnly}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                value={test.points} 
                                onChange={e => {
                                  const newTests = [...form.test_details];
                                  newTests[index].points = Number(e.target.value);
                                  updateForm('test_details', newTests);
                                }}
                                className="w-full bg-transparent border-0 focus:ring-0 p-0 text-[13px] font-medium text-gray-800 text-right" 
                                disabled={isReadOnly}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => {
                                setShowTestRowModal(index);
                              }} disabled={isReadOnly} className="text-gray-400 hover:text-gray-600 focus:outline-none">
                                <Edit3 size={14} className="mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isReadOnly && (
                    <button 
                      onClick={() => updateForm('test_details', [...form.test_details, { test_name: '', points: 0 }])}
                      className="px-3 py-1.5 text-[12px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors mb-6"
                    >
                      Add Row
                    </button>
                  )}
                </FullSection>
              )}

                <FullSection title="Pricing Details" collapsible={true}>
                  <div className="mb-4">
                    <Field label="Is Lumpsum" as="checkbox" value={form.is_lumpsum} onChange={v => updateForm('is_lumpsum', v)} />
                  </div>
                  
                  <div className="mb-2 text-xs font-medium text-gray-600">Items</div>
                  <div className="border border-gray-200 rounded mb-3 overflow-visible">
                    <table className="w-full text-left text-[13px] whitespace-nowrap border-collapse">
                      <thead className="bg-[#111827] text-white">
                        <tr>
                          <th className="p-2 w-8 text-center border-r border-gray-200">
                            <input 
                              type="checkbox" 
                              className="w-3.5 h-3.5 rounded-sm bg-white border-gray-300"
                              checked={form.items.length > 0 && selectedItems.length === form.items.length}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                          </th>
                          <th className="p-2 font-medium w-12 text-center">No.</th>
                          <th className="p-2 font-medium min-w-[200px] max-w-[300px]">Item Code</th>
                          {!form.is_lumpsum && <th className="p-2 font-medium w-32 text-right">Number <span className="text-red-500">*</span></th>}
                          {!form.is_lumpsum && <th className="p-2 font-medium w-32 text-right">Rate (INR)</th>}
                          <th className="p-2 font-medium w-32 text-right border-r border-gray-200">Amount (INR)</th>
                          <th className="p-2 w-10 text-center"><Edit3 size={14} className="mx-auto text-gray-400"/></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {form.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-2 text-center border-r border-gray-200">
                              <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 rounded-sm bg-white border-gray-300" 
                                checked={selectedItems.includes(idx)}
                                onChange={(e) => handleSelectRow(idx, e.target.checked)}
                              />
                            </td>
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-1 max-w-[300px]">
                              <CustomFrappeItemSelect
                                label="Item"
                                value={item.item_code}
                                options={itemsDB}
                                disabled={isReadOnly}
                                onChange={(opt) => {
                                  const itemRate = Number(opt.standard_rate) || Number(opt.rate) || 0;
                                  const updateData = {
                                    item_code: opt.item_code,
                                    item_name: opt.item_name || '',
                                    description: opt.description || opt.item_name || opt.item_code,
                                    rate: itemRate,
                                    uom: opt.default_uom || 'Nos',
                                    hsn_sac: opt.hsn_sac || '',
                                    is_nil_exempt: opt.is_nil_exempt || false,
                                    is_non_gst: opt.is_non_gst || false,
                                    image: opt.image || ''
                                  };
                                  if (form.is_lumpsum) {
                                    const existingRow = form.items.find(i => i.item_code === opt.item_code && i.amount > 0);
                                    updateData.amount = existingRow ? Number(existingRow.amount) : (Number(opt.lumpsum_amount) || 0);
                                  }
                                  updateItemFields(idx, updateData);
                                }}
                                onCreateNew={() => setShowNewItemModal(true)}
                              />
                            </td>
                            {!form.is_lumpsum && (
                              <td className="p-1">
                                <input
                                  type="number"
                                  value={item.number}
                                  onChange={(e) => updateItem(idx, 'number', Number(e.target.value))}
                                  disabled={isReadOnly}
                                  className="w-full text-right bg-transparent border-0 focus:ring-0 p-1 disabled:bg-transparent"
                                />
                              </td>
                            )}
                            {!form.is_lumpsum && (
                              <td className="p-1">
                                <input
                                  type="number"
                                  value={item.rate}
                                  onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))}
                                  disabled={isReadOnly}
                                  className="w-full text-right bg-transparent border-0 focus:ring-0 p-1 disabled:bg-transparent"
                                />
                              </td>
                            )}
                            <td className="p-2 text-right font-mono text-gray-800 border-r border-gray-200">
                              {form.is_lumpsum ? (
                                <input
                                  type="number"
                                  value={item.amount || 0}
                                  disabled={isReadOnly}
                                  onChange={(e) => updateItem(idx, 'amount', Number(e.target.value))}
                                  className="w-full text-right bg-transparent border-0 focus:ring-0 p-1 font-mono"
                                />
                              ) : (
                                formatINR((item.number || 0) * (item.rate || 0))
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => setShowEditRowModal(idx)} className="text-gray-400 hover:text-gray-600"><Edit3 size={14} className="mx-auto" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center mb-6">
                    {!isReadOnly ? (
                      <div className="flex gap-2">
                        <button onClick={addItem} className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded">Add Row</button>
                        <button className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded">Add Multiple</button>
                        {selectedItems.length > 0 && (
                          <button onClick={handleDeleteSelected} className="text-[12px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded flex items-center gap-1">
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    ) : <div></div>}
                    <div className="flex gap-4">
                      <button className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded text-gray-700">Download</button>
                      <button className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded text-gray-700">Upload</button>
                    </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-12 mt-6">
                    <div>
                      <Field label="Total Number" value={calculations.totalNumber} disabled={true} />
                    </div>
                    <div>
                      <Field label="Total (INR)" value={formatINR(calculations.netTotal)} disabled={true} />
                    </div>
                  </div>
                </FullSection>
  
                <FullSection title="Taxes and Charges" collapsible={true}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0 mb-8">
                    <div>
                      <CustomFrappeSelect 
                        label="Tax Category"
                        value={form.tax_category}
                        onChange={v => updateForm('tax_category', v)}
                        options={taxCategories.map(c => ({ title: c.title }))}
                        disabled={isReadOnly}
                        onCreateNew={() => window.open('/tax-categories/new', '_blank')}
                      />
                    </div>
                    <div>
                      <CustomFrappeSelect 
                        label="Sales Taxes and Charges Template"
                        value={form.taxes_and_charges_template}
                        onChange={handleTaxTemplateChange}
                        options={salesTaxTemplates
                          .filter(t => !form.tax_category || t.tax_category === form.tax_category)
                          .map(t => ({ title: t.title, company: t.company }))}
                        disabled={isReadOnly}
                        onCreateNew={() => setShowSalesTaxTemplateModal(true)}
                        footerContent={<div className="text-[12px] text-gray-500">Filters applied for <strong>Company</strong> = {form.company || 'Creator Consultant'}, <strong>Docstatus</strong> != 2</div>}
                      />
                    </div>
                  </div>
                  
                  <div className="mb-2 text-xs font-medium text-gray-600">Sales Taxes and Charges</div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto mb-3 bg-white">
                    <table className="w-full text-left text-[13px] whitespace-nowrap">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-center font-medium ">
                            <input type="checkbox" className="rounded-sm border-gray-300" />
                          </th>
                          <th className="px-3 py-2.5 font-medium w-12 text-center">No.</th>
                          <th className="px-3 py-2.5 font-medium ">Type <span className="text-red-500">*</span></th>
                          <th className="px-3 py-2.5 font-medium ">Account Head <span className="text-red-500">*</span></th>
                          <th className="px-3 py-2.5 font-medium text-right">Tax Rate</th>
                          <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                          <th className="px-3 py-2.5 font-medium text-right">Total</th>
                          <th className="px-2 py-2.5 w-10 text-center text-gray-400"><Edit3 size={14} className="mx-auto"/></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {form.taxes.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="px-4 py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center justify-center">
                                  <svg className="w-8 h-8 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  <span className="text-[13px] text-gray-500 font-medium">No Data</span>
                                </div>
                              </td>
                            </tr>
                        ) : form.taxes.map((tax, idx) => {
                          const comp = calculations.computedTaxes[idx];
                          return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="p-2 text-center border-r border-gray-200">
                              <input type="checkbox" className="w-3.5 h-3.5 rounded-sm bg-white border-gray-300" />
                            </td>
                            <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                            <td className="p-1">
                              <select
                                value={tax.charge_type}
                                onChange={(e) => updateTax(idx, 'charge_type', e.target.value)}
                                disabled={isReadOnly}
                                className="w-full bg-transparent border-0 focus:ring-0 p-1 text-[13px]"
                              >
                                <option value="Actual">Actual</option>
                                <option value="On Net Total">On Net Total</option>
                                <option value="On Previous Row Amount">On Previous Row Amount</option>
                              </select>
                            </td>
                            <td className="p-1">
                              <input
                                value={tax.account_head}
                                onChange={(e) => updateTax(idx, 'account_head', e.target.value)}
                                disabled={isReadOnly}
                                className="w-full bg-transparent border-0 focus:ring-0 p-1"
                              />
                            </td>
                            <td className="p-1">
                              {tax.charge_type !== 'Actual' ? (
                              <input
                                type="number"
                                value={tax.tax_rate}
                                onChange={(e) => updateTax(idx, 'tax_rate', Number(e.target.value))}
                                disabled={isReadOnly}
                                className="w-full text-right bg-transparent border-0 focus:ring-0 p-1"
                              />
                              ) : <div className="text-right text-gray-400 p-1">0</div>}
                            </td>
                            <td className="p-1">
                              {tax.charge_type === 'Actual' ? (
                                <input
                                  type="number"
                                  value={tax.tax_amount}
                                  onChange={(e) => updateTax(idx, 'tax_amount', Number(e.target.value))}
                                  disabled={isReadOnly}
                                  className="w-full text-right bg-transparent border-0 focus:ring-0 p-1"
                                />
                              ) : (
                                <div className="text-right font-mono text-gray-800 p-1">{formatINR(comp?.computed_amount || 0)}</div>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono text-gray-800 border-r border-gray-200">
                              {formatINR(comp?.computed_total || 0)}
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => setShowTaxesRowModal(idx)} className="text-gray-400 hover:text-gray-600"><Edit3 size={14} className="mx-auto" /></button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                  {!isReadOnly && (
                    <button onClick={addTax} className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded">
                      Add Row
                    </button>
                  )}
  
                  <div className="grid grid-cols-2 gap-12 mt-2">
                    <div></div>
                    <div>
                      <Field label="Total Taxes and Charges (INR)" value={formatINR(calculations.totalTaxAmount)} disabled={true} />
                    </div>
                  </div>
                </FullSection>
  
                <Section title="Totals" collapsible={true}>
                  <div className="space-y-0"></div>
                  <div className="space-y-0">
                    <Field label="Grand Total (INR)" value={formatINR(calculations.grandTotal)} disabled={true} />
                    <Field label="Rounding Adjustment (INR)" value={formatINR(calculations.roundingAdjustment)} disabled={true} />
                    <Field label="Rounded Total (INR)" value={formatINR(calculations.roundedTotal)} disabled={true} />
                    <Field label="" as="checkbox" helpText="Disable Rounded Total" value={form.disable_rounded_total} onChange={v => updateForm('disable_rounded_total', v)} disabled={isReadOnly} />
                  </div>
                </Section>
  

                

              </>
            )}
  
            {activeTab === 'address_contact' && (
              <>
                <Section title="Billing Address" collapsible={true}>
                  <CustomFrappeSelect 
                    label="Customer Address"
                    value={form.customer_address}
                    onChange={v => updateForm('customer_address', v)}
                    options={addresses.map(addr => ({
                      value: addr.id,
                      title: `${addr.link_name}-${addr.address_type}`,
                      company: `${addr.country}, ${addr.state?.split('-')[1] || addr.state}`
                    }))}
                    disabled={isReadOnly || !form.client_id}
                    onCreateNew={() => setShowAddressModal({ field: 'customer_address', defaultData: { link_document_type: 'Customer', link_name: clients.find(c => c.id === form.client_id)?.name || '', address_type: 'Billing' } })}
                  />
                  <Field label="Contact Person" value={form.contact_person} onChange={v => updateForm('contact_person', v)} disabled={isReadOnly} />
                  
                  {form.customer_address && (
                    <div className="mb-4">
                      <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Address</label>
                      <div className="bg-gray-50 border border-gray-100 rounded-md p-3 text-[13px] text-gray-600 min-h-[140px] whitespace-pre-wrap">
                        {(() => {
                          const addr = addresses.find(a => a.id === form.customer_address);
                          if (!addr) return form.address_display || '';
                          return `${addr.address_title || addr.link_name}\n${addr.address_line1}${addr.address_line2 ? `\n${addr.address_line2}` : ''}\n${addr.city}\n\n${addr.state}, State Code: ${addr.state?.split('-')[0]}\nPIN Code: ${addr.postal_code}\n${addr.country}`;
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {form.contact_person && (
                    <div className="mb-4">
                      <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Contact</label>
                      <div className="bg-gray-50 border border-gray-100 rounded-md p-3 text-[13px] text-gray-600 min-h-[38px] whitespace-pre-wrap">
                        {form.contact_display}
                      </div>
                    </div>
                  )}

                  {form.contact_person ? <Field label="Mobile No" value={form.contact_mobile} onChange={v => updateForm('contact_mobile', v)} disabled={isReadOnly} /> : <div />}
                  {form.contact_person ? <Field label="Email" value={form.contact_email} onChange={v => updateForm('contact_email', v)} disabled={isReadOnly} /> : <div />}
                  <CustomFrappeSelect label="Place of Supply (Code or State)" value={form.place_of_supply || ''} onChange={v => updateForm('place_of_supply', v)} options={INDIAN_STATES} disabled={isReadOnly} />
                </Section>

                <Section title="Site Address Details" collapsible={true}>
                  <CustomFrappeSelect 
                    label="Site Address"
                    value={form.site_address}
                    onChange={v => updateForm('site_address', v)}
                    options={siteAddresses.map(addr => ({
                      value: addr.id,
                      title: addr.title || addr.city,
                      company: `${addr.country}, ${addr.state?.split('-')[1] || addr.state}`
                    }))}
                    disabled={isReadOnly}
                    onCreateNew={() => setShowAddressModal({ field: 'site_address', defaultData: {} })}
                  />
                  {form.site_address && (
                    <div className="mb-4">
                      <label className="text-[12px] font-medium text-gray-600 mb-1.5 block">Site Address Preview</label>
                      <div className="bg-gray-50 border border-gray-100 rounded-md p-3 text-[13px] text-gray-600 min-h-[140px] whitespace-pre-wrap">
                        {(() => {
                          const addr = siteAddresses.find(a => a.id === form.site_address);
                          if (!addr) return '';
                          return `${addr.title ? addr.title + '\n' : ''}${addr.address_line1}${addr.address_line2 ? '\n${addr.address_line2}' : ''}\n${addr.city}\n\n${addr.state}, State Code: ${addr.state?.split('-')[0]}\nPIN Code: ${addr.postal_code}\n${addr.country}`;
                        })()}
                      </div>
                    </div>
                  )}
                </Section>


              </>
            )}
  
            {activeTab === 'terms' && (
              <>
                <Section title="Payment Terms" collapsible={true}>
                  <CustomFrappeSelect
                    label="Payment Terms Template"
                    value={form.payment_terms_template}
                    onChange={v => updateForm('payment_terms_template', v)}
                    options={paymentTermsTemplates.map(t => ({ title: t.template_name, company: '' }))}
                    disabled={isReadOnly}
                    onCreateNew={() => window.open('/payment-terms-templates/new', '_blank')}
                  />
                </Section>
                <FullSection>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-800 text-[13px] font-medium">
                       Payment Schedule
                    </div>
                    <div className="border border-gray-200 rounded overflow-hidden overflow-x-auto mb-3">
                      <table className="w-full text-left text-[13px] whitespace-nowrap border-collapse">
                        <thead className="bg-[#111827] text-white">
                          <tr>
                            <th className="p-2 w-8 text-center border-r border-gray-200"><input type="checkbox" className="w-3.5 h-3.5 rounded-sm bg-white border-gray-300" /></th>
                            <th className="p-2 font-medium w-12 text-center">No.</th>
                            <th className="p-2 font-medium">Payment Term</th>
                            <th className="p-2 font-medium">Description</th>
                            <th className="p-2 font-medium ">Due Date <span className="text-red-500">*</span></th>
                            <th className="p-2 font-medium text-right">Invoice Portion</th>
                            <th className="p-2 font-medium text-right border-r border-gray-200">Payment Amount <span className="text-red-500">*</span></th>
                            <th className="p-2 w-10 text-center"><Edit3 size={14} className="mx-auto text-gray-400"/></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {form.payment_schedule.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="p-8 text-center text-gray-400">
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 border-2 border-gray-300 rounded mb-2 flex items-center justify-center bg-gray-50 flex-col py-1">
                                    <div className="w-4 h-[2px] bg-gray-300 mb-1 rounded"></div>
                                    <div className="w-3 h-[2px] bg-gray-300 rounded"></div>
                                  </div>
                                  No Data
                                </div>
                              </td>
                            </tr>
                          ) : form.payment_schedule.map((schedule, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-2 text-center border-r border-gray-200"><input type="checkbox" className="w-3.5 h-3.5 rounded-sm bg-white border-gray-300" /></td>
                              <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                              <td className="p-1"><input value={schedule.payment_term} onChange={e => updatePaymentSchedule(idx, 'payment_term', e.target.value)} disabled={isReadOnly} className="w-full bg-transparent border-0 focus:ring-0 p-1" /></td>
                              <td className="p-1"><input value={schedule.description} onChange={e => updatePaymentSchedule(idx, 'description', e.target.value)} disabled={isReadOnly} className="w-full bg-transparent border-0 focus:ring-0 p-1" /></td>
                              <td className="p-1"><input type="date" value={schedule.due_date} onChange={e => updatePaymentSchedule(idx, 'due_date', e.target.value)} disabled={isReadOnly} className="w-full bg-transparent border-0 focus:ring-0 p-1" /></td>
                              <td className="p-1"><input type="number" value={schedule.invoice_portion} onChange={e => updatePaymentSchedule(idx, 'invoice_portion', Number(e.target.value))} disabled={isReadOnly} className="w-full text-right bg-transparent border-0 focus:ring-0 p-1" /></td>
                              <td className="p-1 border-r border-gray-200"><input type="number" value={schedule.payment_amount} disabled={isReadOnly} onChange={e => updatePaymentSchedule(idx, 'payment_amount', Number(e.target.value))} className="w-full text-right bg-transparent border-0 focus:ring-0 p-1" /></td>
                              <td className="p-2 text-center"><button onClick={() => setShowPaymentRowModal(idx)} className="text-gray-400 hover:text-gray-600"><Edit3 size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!isReadOnly && (
                      <button onClick={addPaymentSchedule} className="text-[12px] bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded mb-6">
                        Add Row
                      </button>
                    )}
                  </div>
                </FullSection>
                <Section title="Terms and Conditions" collapsible={true}>
                  <CustomFrappeSelect
                    label="Terms"
                    options={termsAndConditions.filter(t => !t.disabled).map(t => ({ value: t.title, label: t.title }))}
                    value={form.tc_name}
                    onChange={v => updateForm('tc_name', v)}
                    disabled={isReadOnly}
                    onCreateNew={() => setShowTermsModal(true)}
                  />
                </Section>
                <FullSection>
                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-600">Term Details</div>
                    <RichTextEditor
                      value={form.terms}
                      onChange={v => updateForm('terms', v)}
                      disabled={isReadOnly}
                      placeholder="Enter terms and conditions..."
                    />
                  </div>
                </FullSection>
              </>
            )}
  
            {activeTab === 'more_info' && (
              <>
                <Section title="Print Settings" collapsible={true}>
                  <CustomFrappeSelect
                    label="Letter Head"
                    options={letterHeads.filter(l => !l.disabled).map(l => ({ value: l.name, label: l.name }))}
                    value={form.letter_head}
                    onChange={v => updateForm('letter_head', v)}
                    disabled={isReadOnly}
                    onCreateNew={() => setShowLetterHeadModal(true)}
                  />
                  <CustomFrappeSelect
                    label="Print Heading"
                    options={printHeadings.map(ph => ({ value: ph.print_heading, label: ph.print_heading }))}
                    value={form.select_print_heading}
                    onChange={v => updateForm('select_print_heading', v)}
                    disabled={isReadOnly}
                    onCreateNew={() => setShowPrintHeadingModal(true)}
                  />
                  <Field label="Group same items" as="checkbox" value={form.group_same_items} onChange={v => updateForm('group_same_items', v)} disabled={isReadOnly} />
                  <div />
                </Section>
              </>
            )}
  
            {activeTab === 'connections' && (
              <div className="py-12 text-center text-gray-500">
                <p>No linked documents yet.</p>
                <p className="text-sm mt-2">Sales Orders and Invoices generated from this sales_order will appear here.</p>
              </div>
            )}
          </div>
          
          {/* Constant Comments & Activity Section - Only visible when viewing/editing existing document */}
          {/* {isEdit && (
          <div id="comments-activity-section" className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" />
              <span>Comments & Activity</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">{(form.comments || []).length}</span>
            </h3>

            <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">
                 {user?.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center">
                <input 
                  type="text" 
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Type a reply / comment and press Enter..." 
                  className="flex-1 bg-white border border-gray-300 rounded-md px-4 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!newCommentText.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus size={14} /> Comment
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 mb-8">
              {(form.comments && form.comments.length > 0) ? (
                form.comments.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 p-3.5 bg-white border border-gray-100 rounded-lg shadow-2xs hover:border-gray-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(c.user_name || 'User').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-900">{c.user_name || 'Administrator'}</span>
                          <span className="text-[11px] text-gray-400">
                            {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : 'Just now'}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-700 whitespace-pre-wrap sm:text-sm leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(c.id)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                      title="Delete comment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50 rounded border border-dashed border-gray-200">
                  No comments yet. Start the conversation above!
                </div>
              )}
            </div>
               
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 mb-6">
                <h3 className="text-base font-semibold text-gray-800">Activity</h3>
                <button type="button" className="text-[12px] bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded flex items-center gap-1 shadow-sm transition-colors text-gray-700">
                    <Plus size={14}/> New Email
                </button>
            </div>
               
            <div className="pl-4 border-l border-gray-200 ml-4 space-y-6 relative">
                {isEdit ? (
                    <>
                        {form.updated_at && (
                            <div className="relative">
                                <div className="absolute w-2 h-2 rounded-full bg-gray-400 -left-[21px] top-1.5 ring-4 ring-white"></div>
                                <p className="text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800">{user?.name || form.created_by_username || 'Administrator'}</span> updated this document
                                </p>
                                <span className="text-[11px] text-gray-400 block mt-0.5">{formatTimeAgo(form.updated_at)}</span>
                            </div>
                        )}
                        {form.created_at && (
                            <div className="relative">
                                <div className="absolute w-2 h-2 rounded-full bg-blue-500 -left-[21px] top-1.5 ring-4 ring-white"></div>
                                <p className="text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800">{form.created_by_username || user?.name || 'Administrator'}</span> created this document
                                </p>
                                <span className="text-[11px] text-gray-400 block mt-0.5">{formatTimeAgo(form.created_at)}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="relative">
                        <div className="absolute w-2 h-2 rounded-full bg-gray-300 -left-[21px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-xs text-gray-500 italic">You are creating this document.</p>
                    </div>
                )}
            </div>
          </div>
          )} */}
          
        </div>
      </div>
      {/* Preview Modal */}
      {isPreviewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-2 sm:p-6 overflow-hidden">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 border-b border-gray-100 shrink-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Preview</h2>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setIsPreviewMode(false)}
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded transition-colors"
                >
                  Back to Edit
                </button>
                {form.status === 'Draft' && (
                  <button
                    onClick={() => {
                       handleSave('Open');
                       setIsPreviewMode(false);
                    }}
                    disabled={saving}
                    className="px-3 sm:px-6 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-medium rounded shadow-sm transition-colors"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-hidden bg-gray-100 flex-1 p-3 sm:p-6 flex justify-center">
              <div className="w-full flex justify-center max-w-4xl">
                <ScaledPrintPreview>
                  <SalesOrderPrintTemplate
                    form={{...form, grand_total: calculations.grandTotal, total_taxes_and_charges: calculations.totalTaxAmount, amount_in_words: calculations.inWords}}
                    letterHead={activeLetterHead}
                    printHeading={form.select_print_heading}
                    termsHTML={form.terms}
                    client={activeClient}
                    items={form.items}
                    siteAddresses={siteAddresses}
                    jobSubTypes={jobSubTypes}
                  />
                </ScaledPrintPreview>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* New Item Modal */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col mx-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">New Item</h2>
              <button onClick={() => setShowNewItemModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">

              <div className="space-y-4">
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Item Code <span className="text-red-500">*</span></label>
                  <input type="text" value={newItemForm.item_code} onChange={e => setNewItemForm({...newItemForm, item_code: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Item Group <span className="text-red-500">*</span></label>
                  <input type="text" value={newItemForm.item_group} onChange={e => setNewItemForm({...newItemForm, item_group: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">HSN/SAC <span className="text-red-500">*</span></label>
                  <input type="text" value={newItemForm.hsn_sac} onChange={e => setNewItemForm({...newItemForm, hsn_sac: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-400" />
                  <p className="text-[11px] text-gray-500 mt-1">You can search code by the description of the category.</p>
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Default Unit of Measure <span className="text-red-500">*</span></label>
                  <input type="text" value={newItemForm.default_uom} onChange={e => setNewItemForm({...newItemForm, default_uom: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="maintain_stock" checked={newItemForm.maintain_stock} onChange={e => setNewItemForm({...newItemForm, maintain_stock: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="maintain_stock" className="text-[13px] text-gray-700">Maintain Stock</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_fixed_asset" checked={newItemForm.is_fixed_asset} onChange={e => setNewItemForm({...newItemForm, is_fixed_asset: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="is_fixed_asset" className="text-[13px] text-gray-700">Is Fixed Asset</label>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-between">
              <button className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors">
                Edit Full Form
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await api.post('/items', newItemForm);
                    setItemsDB([...itemsDB, res.data]);
                    toast.success('Item created');
                    setShowNewItemModal(false);
                    setNewItemForm({
                      item_code: '', item_group: '', hsn_sac: '', default_uom: '',
                      maintain_stock: false, is_fixed_asset: false, item_name: '', description: ''
                    });
                  } catch (e) {
                    toast.error('Failed to create item');
                  }
                }}
                className="px-6 py-2 text-[13px] font-medium text-white bg-gray-900 hover:bg-black rounded shadow-sm transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* Test Row Edit Modal */}
      {showTestRowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white shadow-xl w-full max-w-4xl max-h-[90vh] h-[90vh] overflow-hidden flex flex-col rounded-lg mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50 gap-2 shrink-0">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Editing Row #{showTestRowModal + 1}</h2>
                <button onClick={() => setShowTestRowModal(null)} className="text-gray-400 hover:text-gray-600 sm:hidden p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
                <button 
                  onClick={() => {
                    const newTests = form.test_details.filter((_, i) => i !== showTestRowModal);
                    updateForm('test_details', newTests);
                    setShowTestRowModal(null);
                  }} 
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded flex-shrink-0"
                  title="Delete Row"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => {
                    const newTests = [...(form.test_details || [])];
                    newTests.splice(showTestRowModal + 1, 0, { test_name: '', points: 0, test_description: '', test_image: '' });
                    updateForm('test_details', newTests);
                    setShowTestRowModal(showTestRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Below
                </button>
                <button 
                  onClick={() => {
                    const newTests = [...(form.test_details || [])];
                    newTests.splice(showTestRowModal, 0, { test_name: '', points: 0, test_description: '', test_image: '' });
                    updateForm('test_details', newTests);
                    setShowTestRowModal(showTestRowModal);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Above
                </button>
                <button 
                  onClick={() => {
                    const newTests = [...(form.test_details || [])];
                    const duplicate = JSON.parse(JSON.stringify(newTests[showTestRowModal]));
                    newTests.splice(showTestRowModal + 1, 0, duplicate);
                    updateForm('test_details', newTests);
                    setShowTestRowModal(showTestRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <div className="flex bg-gray-100 rounded ml-1 flex-shrink-0">
                  <button 
                    disabled={showTestRowModal === 0}
                    onClick={() => setShowTestRowModal(showTestRowModal - 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-l border-r border-gray-200"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button 
                    disabled={showTestRowModal === (form.test_details?.length || 1) - 1}
                    onClick={() => setShowTestRowModal(showTestRowModal + 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-r"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <button onClick={() => setShowTestRowModal(null)} className="text-gray-400 hover:text-gray-600 ml-2 hidden sm:block">
                  <X size={20} />
                </button>
              </div>
            </div>

            
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
              <div className="max-w-2xl mb-8">
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Tests <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.test_details[showTestRowModal]?.test_name || ''} 
                    onChange={e => {
                      const newTests = [...form.test_details];
                      newTests[showTestRowModal].test_name = e.target.value;
                      updateForm('test_details', newTests);
                    }} 
                    disabled={isReadOnly}
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  />
                </div>
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Points <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={form.test_details[showTestRowModal]?.points || ''} 
                    onChange={e => {
                      const newTests = [...form.test_details];
                      newTests[showTestRowModal].points = e.target.value;
                      updateForm('test_details', newTests);
                    }} 
                    disabled={isReadOnly}
                    className="w-full bg-gray-50/50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  />
                </div>
                
                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Test Image</label>
                  <button 
                    onClick={() => handleTestImageUpload(showTestRowModal)}
                    disabled={isReadOnly}
                    className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                  >
                    Attach
                  </button>
                  {form.test_details[showTestRowModal]?.test_image && (
                      <div className="mt-2 text-[12px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1" onClick={() => window.open(form.test_details[showTestRowModal].test_image, '_blank')}>
                         <FileText size={14}/> Attached Image
                      </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Test Description</label>
                  <RichTextEditor 
                    value={form.test_details[showTestRowModal]?.test_description || ''} 
                    onChange={v => {
                      const newTests = [...form.test_details];
                      newTests[showTestRowModal].test_description = v;
                      updateForm('test_details', newTests);
                    }} 
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end bg-white items-center">
              <button onClick={() => setShowTestRowModal(null)} className="px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Row Modal */}
      {/* Taxes Row Edit Modal */}
      {showTaxesRowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white shadow-xl w-full max-w-4xl max-h-[90vh] h-[85vh] overflow-hidden flex flex-col rounded-lg mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50 gap-2 shrink-0">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Editing Row #{showTaxesRowModal + 1}</h2>
                <button onClick={() => setShowTaxesRowModal(null)} className="text-gray-400 hover:text-gray-600 sm:hidden p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
                <button 
                  onClick={() => {
                    const newTaxes = form.taxes.filter((_, i) => i !== showTaxesRowModal);
                    updateForm('taxes', newTaxes);
                    setShowTaxesRowModal(null);
                  }} 
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded flex-shrink-0"
                  title="Delete Row"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => {
                    const newTaxes = [...(form.taxes || [])];
                    newTaxes.splice(showTaxesRowModal + 1, 0, { type: 'Actual', account_head: '', tax_rate: 0, amount: 0, total: 0 });
                    updateForm('taxes', newTaxes);
                    setShowTaxesRowModal(showTaxesRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Below
                </button>
                <button 
                  onClick={() => {
                    const newTaxes = [...(form.taxes || [])];
                    newTaxes.splice(showTaxesRowModal, 0, { type: 'Actual', account_head: '', tax_rate: 0, amount: 0, total: 0 });
                    updateForm('taxes', newTaxes);
                    setShowTaxesRowModal(showTaxesRowModal);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Above
                </button>
                <button 
                  onClick={() => {
                    const newTaxes = [...(form.taxes || [])];
                    const duplicate = JSON.parse(JSON.stringify(newTaxes[showTaxesRowModal]));
                    newTaxes.splice(showTaxesRowModal + 1, 0, duplicate);
                    updateForm('taxes', newTaxes);
                    setShowTaxesRowModal(showTaxesRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <div className="flex bg-gray-100 rounded ml-1 flex-shrink-0">
                  <button 
                    disabled={showTaxesRowModal === 0}
                    onClick={() => setShowTaxesRowModal(showTaxesRowModal - 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-l border-r border-gray-200"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button 
                    disabled={showTaxesRowModal === (form.taxes?.length || 1) - 1}
                    onClick={() => setShowTaxesRowModal(showTaxesRowModal + 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-r"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <button onClick={() => setShowTaxesRowModal(null)} className="text-gray-400 hover:text-gray-600 ml-2 hidden sm:block">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Type</label>
                  <select 
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.taxes[showTaxesRowModal]?.type || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newTaxes = [...form.taxes];
                      newTaxes[showTaxesRowModal].type = e.target.value;
                      updateForm('taxes', newTaxes);
                    }}
                  >
                    <option value="Actual">Actual</option>
                    <option value="On Net Total">On Net Total</option>
                    <option value="On Previous Row Amount">On Previous Row Amount</option>
                    <option value="On Previous Row Total">On Previous Row Total</option>
                    <option value="On Item Quantity">On Item Quantity</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Account Head</label>
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.taxes[showTaxesRowModal]?.account_head || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newTaxes = [...form.taxes];
                      newTaxes[showTaxesRowModal].account_head = e.target.value;
                      updateForm('taxes', newTaxes);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Rate</label>
                  <input 
                    type="number"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.taxes[showTaxesRowModal]?.tax_rate || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newTaxes = [...form.taxes];
                      newTaxes[showTaxesRowModal].tax_rate = Number(e.target.value);
                      updateForm('taxes', newTaxes);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Amount</label>
                  <input 
                    type="number"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.taxes[showTaxesRowModal]?.amount || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newTaxes = [...form.taxes];
                      newTaxes[showTaxesRowModal].amount = Number(e.target.value);
                      updateForm('taxes', newTaxes);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Total</label>
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.taxes[showTaxesRowModal]?.total || ''}
                    readOnly
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end bg-white">
              <button onClick={() => setShowTaxesRowModal(null)} className="px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Term Row Edit Modal */}
      {showPaymentRowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white shadow-xl w-full max-w-4xl max-h-[90vh] h-[85vh] overflow-hidden flex flex-col rounded-lg mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50 gap-2 shrink-0">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Editing Row #{showPaymentRowModal + 1}</h2>
                <button onClick={() => setShowPaymentRowModal(null)} className="text-gray-400 hover:text-gray-600 sm:hidden p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
                <button 
                  onClick={() => {
                    const newSch = form.payment_schedule.filter((_, i) => i !== showPaymentRowModal);
                    updateForm('payment_schedule', newSch);
                    setShowPaymentRowModal(null);
                  }} 
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded flex-shrink-0"
                  title="Delete Row"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => {
                    const newSch = [...(form.payment_schedule || [])];
                    newSch.splice(showPaymentRowModal + 1, 0, { payment_term: '', description: '', due_date: '', invoice_portion: 0, payment_amount: 0 });
                    updateForm('payment_schedule', newSch);
                    setShowPaymentRowModal(showPaymentRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Below
                </button>
                <button 
                  onClick={() => {
                    const newSch = [...(form.payment_schedule || [])];
                    newSch.splice(showPaymentRowModal, 0, { payment_term: '', description: '', due_date: '', invoice_portion: 0, payment_amount: 0 });
                    updateForm('payment_schedule', newSch);
                    setShowPaymentRowModal(showPaymentRowModal);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Above
                </button>
                <button 
                  onClick={() => {
                    const newSch = [...(form.payment_schedule || [])];
                    const duplicate = JSON.parse(JSON.stringify(newSch[showPaymentRowModal]));
                    newSch.splice(showPaymentRowModal + 1, 0, duplicate);
                    updateForm('payment_schedule', newSch);
                    setShowPaymentRowModal(showPaymentRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <div className="flex bg-gray-100 rounded ml-1 flex-shrink-0">
                  <button 
                    disabled={showPaymentRowModal === 0}
                    onClick={() => setShowPaymentRowModal(showPaymentRowModal - 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-l border-r border-gray-200"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button 
                    disabled={showPaymentRowModal === (form.payment_schedule?.length || 1) - 1}
                    onClick={() => setShowPaymentRowModal(showPaymentRowModal + 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-r"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <button onClick={() => setShowPaymentRowModal(null)} className="text-gray-400 hover:text-gray-600 ml-2 hidden sm:block">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Payment Term</label>
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.payment_schedule[showPaymentRowModal]?.payment_term || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newSch = [...form.payment_schedule];
                      newSch[showPaymentRowModal].payment_term = e.target.value;
                      updateForm('payment_schedule', newSch);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Description</label>
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.payment_schedule[showPaymentRowModal]?.description || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newSch = [...form.payment_schedule];
                      newSch[showPaymentRowModal].description = e.target.value;
                      updateForm('payment_schedule', newSch);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Due Date</label>
                  <input 
                    type="date"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.payment_schedule[showPaymentRowModal]?.due_date || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newSch = [...form.payment_schedule];
                      newSch[showPaymentRowModal].due_date = e.target.value;
                      updateForm('payment_schedule', newSch);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Invoice Portion (%)</label>
                  <input 
                    type="number"
                    className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.payment_schedule[showPaymentRowModal]?.invoice_portion || ''}
                    onChange={e => {
                      const newSch = [...form.payment_schedule];
                      newSch[showPaymentRowModal].invoice_portion = Number(e.target.value);
                      updateForm('payment_schedule', newSch);
                    }}
                  />
                </div>
                <div>
                  <label className="text-[12px] text-gray-600 mb-1 font-medium block">Payment Amount</label>
                  <input 
                    type="number"
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900"
                    value={form.payment_schedule[showPaymentRowModal]?.payment_amount || ''}
                    disabled={isReadOnly}
                    onChange={e => {
                      const newSch = [...form.payment_schedule];
                      newSch[showPaymentRowModal].payment_amount = Number(e.target.value);
                      updateForm('payment_schedule', newSch);
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end bg-white">
              <button onClick={() => setShowPaymentRowModal(null)} className="px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditRowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] h-[85vh] overflow-hidden flex flex-col mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50 gap-2 shrink-0">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Editing Row #{showEditRowModal + 1}</h2>
                <button onClick={() => setShowEditRowModal(null)} className="text-gray-400 hover:text-gray-600 sm:hidden p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
                <button 
                  onClick={() => {
                    const newItems = form.items.filter((_, i) => i !== showEditRowModal);
                    setForm({ ...form, items: newItems });
                    setShowEditRowModal(null);
                  }} 
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded flex-shrink-0"
                  title="Delete Row"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => {
                    const newItems = [...form.items];
                    newItems.splice(showEditRowModal + 1, 0, { item_code: '', description: '', number: 0, rate: 0, is_alternative: false });
                    setForm({ ...form, items: newItems });
                    setShowEditRowModal(showEditRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Below
                </button>
                <button 
                  onClick={() => {
                    const newItems = [...form.items];
                    newItems.splice(showEditRowModal, 0, { item_code: '', description: '', number: 0, rate: 0, is_alternative: false });
                    setForm({ ...form, items: newItems });
                    setShowEditRowModal(showEditRowModal);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0"
                >
                  Insert Above
                </button>
                <button 
                  onClick={() => {
                    const newItems = [...form.items];
                    const duplicate = JSON.parse(JSON.stringify(newItems[showEditRowModal]));
                    newItems.splice(showEditRowModal + 1, 0, duplicate);
                    setForm({ ...form, items: newItems });
                    setShowEditRowModal(showEditRowModal + 1);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <div className="flex bg-gray-100 rounded ml-1 flex-shrink-0">
                  <button 
                    disabled={showEditRowModal === 0}
                    onClick={() => setShowEditRowModal(showEditRowModal - 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-l border-r border-gray-200"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button 
                    disabled={showEditRowModal === form.items.length - 1}
                    onClick={() => setShowEditRowModal(showEditRowModal + 1)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-r"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
                <button onClick={() => setShowEditRowModal(null)} className="text-gray-400 hover:text-gray-600 ml-2 hidden sm:block">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block -mb-1">item_code</label>
                  <label className="text-[13px] text-gray-600 mb-1 font-medium block">Item Code</label>
                  <CustomFrappeItemSelect
                    label="Item"
                    value={form.items[showEditRowModal].item_code}
                    options={itemsDB}
                    onChange={(opt) => {
                      const itemRate = Number(opt.standard_rate) || Number(opt.rate) || 0;
                      updateItemFields(showEditRowModal, {
                        item_code: opt.item_code,
                        item_name: opt.item_name || '',
                        description: opt.description || opt.item_name || opt.item_code,
                        rate: itemRate,
                        uom: opt.default_uom || 'Nos',
                        hsn_sac: opt.hsn_sac || '',
                        is_nil_exempt: opt.is_nil_exempt || false,
                        is_non_gst: opt.is_non_gst || false,
                        image: opt.image || ''
                      });
                    }}
                    onCreateNew={() => setShowNewItemModal(true)}
                  />
                  <div className="mt-2 text-[12px] text-gray-500">
                    <span className="font-bold block text-gray-700">{form.items[showEditRowModal].item_code}</span>
                    <div className="line-clamp-3 mt-1" dangerouslySetInnerHTML={{ __html: form.items[showEditRowModal].description }} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase tracking-wide block -mb-1">item_name</label>
                  <label className="text-[13px] text-gray-600 mb-1 font-medium block">Item Name <span className="text-red-500">*</span></label>
                  <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900" value={form.items[showEditRowModal].item_code} readOnly />
                </div>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[14px] text-gray-800 font-medium">Description</h3>
                  <span className="text-gray-400"><ChevronDown size={14}/></span>
                </div>
                <div className="mb-2">

                  <RichTextEditor 
                    value={form.items[showEditRowModal].description || ''}
                    onChange={val => updateItem(showEditRowModal, 'description', val)}
                  />
                </div>
                <div className="mt-4">

                  <label className="text-[13px] text-gray-700 mb-1 font-medium block">HSN/SAC</label>
                  <input type="text" className="w-1/2 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" value={form.items[showEditRowModal].hsn_sac || ''} onChange={e => updateItem(showEditRowModal, 'hsn_sac', e.target.value)} />
                </div>
                <div className="mt-4 flex flex-col gap-2">

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.items[showEditRowModal].is_nil_exempt} onChange={e => updateItem(showEditRowModal, 'is_nil_exempt', e.target.checked)} className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-[13px] text-gray-700">Is Nil Rated or Exempted</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.items[showEditRowModal].is_non_gst} onChange={e => updateItem(showEditRowModal, 'is_non_gst', e.target.checked)} className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-[13px] text-gray-700">Is Non GST</span>
                  </label>
                </div>
              </div>

              <div className="mb-6 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[14px] text-gray-800 font-medium">Image</h3>
                  <span className="text-gray-400"><ChevronDown size={14}/></span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 bg-gray-50 border border-gray-100 rounded flex flex-col items-center justify-center text-gray-400 overflow-hidden relative">
                    {form.items[showEditRowModal].image ? (
                      <>
                        <img src={form.items[showEditRowModal].image} alt="Item" className="w-full h-full object-cover" />
                        <button 
                          className="absolute top-1 right-1 bg-white rounded-full p-1 shadow hover:bg-gray-100 text-red-500"
                          onClick={() => updateItem(showEditRowModal, 'image', '')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <span className="text-2xl cursor-pointer border border-gray-400 rounded-full w-8 h-8 flex items-center justify-center">📷</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Upload Image</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 mb-2"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64 = reader.result;
                            try {
                              const res = await api.post('/item-images/upload', { base64, filename: file.name });
                              updateItem(showEditRowModal, 'image', res.data.url);
                              toast.success('Image uploaded successfully');
                            } catch (err) {
                              toast.error('Failed to upload image');
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <p className="text-[11px] text-gray-500">Max size 2MB. Supported formats: JPG, PNG, GIF</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 border-t border-gray-100 pt-6">
                <h3 className="text-[14px] text-gray-800 font-medium mb-4">Quantity and Rate</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Number <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      value={form.items[showEditRowModal].number} 
                      onChange={e => {
                        const qty = Number(e.target.value) || 0;
                        const rate = Number(form.items[showEditRowModal].rate) || 0;
                        const distDisc = Number(form.items[showEditRowModal].distributed_discount_amount) || 0;
                        const taxableValue = Math.max(0, (qty * rate));
                        updateItemFields(showEditRowModal, { 
                          number: qty,
                          taxable_value: taxableValue,
                          amount: taxableValue
                        });
                      }} 
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">UOM <span className="text-red-500">*</span></label>
                    <select 
                      value={form.items[showEditRowModal].uom || ''} 
                      onChange={e => {
                        if (e.target.value === 'CREATE_NEW') {
                          setShowUOMModal(true);
                        } else {
                          updateItem(showEditRowModal, 'uom', e.target.value);
                        }
                      }} 
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select UOM...</option>
                      {uoms.map(u => (
                        <option key={u.id} value={u.uom_name}>{u.uom_name}</option>
                      ))}
                      <option value="CREATE_NEW" className="font-medium text-blue-600">+ Create new UOM</option>
                    </select>
                  </div>
                  <div className="col-start-2">
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">UOM Conversion Factor <span className="text-red-500">*</span></label>
                    <input 
                      type="number" 
                      value={form.items[showEditRowModal].conversion_factor || 1} 
                      onChange={e => updateItem(showEditRowModal, 'conversion_factor', Number(e.target.value) || 1)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" 
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[14px] text-gray-800 font-medium">Discount and Margin</h3>
                  <span className="text-gray-400"><ChevronDown size={14}/></span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  <div className="col-start-2">
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Distributed Discount Amount</label>
                    <input 
                      type="number" 
                      value={form.items[showEditRowModal].distributed_discount_amount || ''} 
                      onChange={e => {
                        const distDisc = Number(e.target.value) || 0;
                        updateItemFields(showEditRowModal, { 
                          distributed_discount_amount: distDisc
                        });
                      }} 
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Rate (INR)</label>
                    <input 
                      type="number" 
                      value={form.items[showEditRowModal].rate} 
                      onChange={e => {
                        const rate = Number(e.target.value) || 0;
                        updateItemFields(showEditRowModal, { 
                          rate
                        });
                      }} 
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Taxable Value</label>
                    <div className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-[13px] text-gray-500">
                      ₹ {(form.items[showEditRowModal].taxable_value || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Amount (INR)</label>
                    <div className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-[13px] text-gray-500">
                      ₹ {(form.items[showEditRowModal].amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-gray-600 mb-1 font-medium block">Item Tax Template</label>
                    <input 
                      type="text" 
                      value={form.items[showEditRowModal].item_tax_template} 
                      onChange={e => updateItem(showEditRowModal, 'item_tax_template', e.target.value)} 
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500" 
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-gray-200 flex justify-between bg-white items-center">
              <div className="flex gap-2">
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Shortcuts:</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Ctrl + Up</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">Ctrl + Down</span>
                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">ESC</span>
              </div>
              <button onClick={() => setShowEditRowModal(null)} className="px-4 py-1.5 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <NewAddressModal 
        open={!!showAddressModal && showAddressModal.field !== 'site_address'} 
        onClose={() => setShowAddressModal(null)}
        defaultData={showAddressModal?.defaultData || {}}
        onSaved={(newAddr) => {
          if (showAddressModal?.field === 'company_address') {
            setCompanyAddresses(prev => [newAddr, ...prev]);
          } else {
            setAddresses(prev => [newAddr, ...prev]);
          }
          if (showAddressModal?.field) {
            updateForm(showAddressModal.field, newAddr.id);
          }
        }}
      />
      
      <NewSiteAddressModal 
        open={!!showAddressModal && showAddressModal.field === 'site_address'} 
        onClose={() => setShowAddressModal(null)}
        defaultData={showAddressModal?.defaultData || {}}
        onSaved={(newAddr) => {
          setSiteAddresses(prev => [newAddr, ...prev]);
          updateForm('site_address', newAddr.id);
        }}
      />

      <NewContactModal
        open={!!showContactModal}
        onClose={() => setShowContactModal(null)}
        defaultData={showContactModal?.defaultData || {}}
        onSaved={(newContact) => {
          setCompanyContacts(prev => [newContact, ...prev]);
          if (showContactModal?.field) {
            updateForm(showContactModal.field, newContact.id);
          }
        }}
      />
      <NewTermsAndConditionsModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onSave={(newTerm) => {
          setTermsAndConditions(prev => [...prev, newTerm]);
          updateForm('tc_name', newTerm.title);
        }}
      />
      <NewLetterHeadModal
        open={showLetterHeadModal}
        onClose={() => setShowLetterHeadModal(false)}
        onSave={(newLH) => {
          setLetterHeads(prev => [...prev, newLH]);
          updateForm('letter_head', newLH.name);
        }}
      />
      <NewPrintHeadingModal
        open={showPrintHeadingModal}
        onClose={() => setShowPrintHeadingModal(false)}
        onSave={(newPH) => {
          setPrintHeadings(prev => [...prev, newPH]);
          updateForm('select_print_heading', newPH.print_heading);
        }}
      />

      <NewJobTypeModal
        open={showJobTypeModal}
        onClose={() => setShowJobTypeModal(false)}
        defaultData={newModalQuery}
        onSaved={(newJt) => {
          setJobTypes(prev => [...prev, newJt]);
          updateForm('job_type', newJt.name);
        }}
      />
      <NewJobSubTypeModal
        open={showJobSubTypeModal}
        onClose={() => setShowJobSubTypeModal(false)}
        defaultData={{ name: newModalQuery, parent_job_type_name: form.job_type }}
        onSaved={(newJst) => {
          setJobSubTypes(prev => [...prev, newJst]);
          updateForm('job_sub_type', newJst.name);
        }}
      />
      <NewScopeOfWorkModal
        open={showScopeOfWorkModal}
        onClose={() => setShowScopeOfWorkModal(false)}
        defaultData={{ name: newModalQuery, job_type_name: form.job_type, job_sub_type_name: form.job_sub_type }}
        onSaved={(newSow) => {
          setScopeOfWorks(prev => [...prev, newSow]);
          updateForm('scope_of_work_details', newSow.details || '');
        }}
      />
      <NewTestTemplateModal
        open={showTestTemplateModal}
        onClose={() => setShowTestTemplateModal(false)}
        defaultData={{ test_name: newModalQuery, job_type: form.job_type, job_sub_type: form.job_sub_type }}
        onSaved={(newTest) => {
          setTestTemplates(prev => [...prev, newTest]);
          updateForm('test_template', newTest.test_name);
        }}
      />
      <NewCustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        defaultData={newModalQuery}
        onSaved={(newC) => {
          setClients(prev => [...prev, newC]);
          updateForm('client_id', newC.id);
        }}
      />
      <NewLeadModal
        open={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        defaultData={newModalQuery}
        onSaved={(newL) => {
          const lName = typeof newL === 'string' ? newL : newL.lead_name || newL.name;
          setLeads(prev => [...prev, lName]);
          updateForm('lead', lName);
        }}
      />
      <NewSalesTaxTemplateModal
        open={showSalesTaxTemplateModal}
        onClose={() => setShowSalesTaxTemplateModal(false)}
        defaultData={{ title: newModalQuery, company: form.company, tax_category: form.tax_category }}
        onSaved={(newTax) => {
          setSalesTaxTemplates(prev => [...prev, newTax]);
          updateForm('taxes_and_charges_template', newTax.title);
        }}
      />

      {/* Hidden Div for PDF Generation */}
      <div style={{ display: 'none' }} id="sales_order-pdf-content">
        <SalesOrderPrintTemplate
          form={{...form, grand_total: calculations.grandTotal, total_taxes_and_charges: calculations.totalTaxAmount, amount_in_words: calculations.inWords}}
          letterHead={activeLetterHead}
          printHeading={form.select_print_heading}
          termsHTML={form.terms}
          client={activeClient}
          items={form.items}
          siteAddresses={siteAddresses}
          jobSubTypes={jobSubTypes}
        />
      </div>

      {/* Cancel Confirm Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl">
            <h3 className="font-semibold mb-2 text-gray-900">Cancel Sales Order</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to cancel this sales order? Its status will be set to Cancelled.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors">No</button>
              <button onClick={async () => {
                try {
                  setSaving(true);
                  const res = await api.post(`/sales-orders/${id}/status`, { status: 'Cancelled' });
                  toast.success('Sales Order cancelled');
                  setForm(res.data || { ...form, status: 'Cancelled' });
                  setShowCancelConfirm(false);
                } catch(e) {
                  toast.error(e.response?.data?.detail || 'Failed to cancel sales order');
                } finally {
                  setSaving(false);
                }
              }} disabled={saving} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded shadow-sm transition-colors">Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      <UOMCreateModal 
        open={showUOMModal} 
        onClose={() => setShowUOMModal(false)}
        defaultData={newModalQuery}
        onSaved={u => {
          setUoms(prev => [...prev, u]);
          if (showEditRowModal !== null) {
            updateItem(showEditRowModal, 'uom', u.uom_name);
          }
        }}
      />
    </div>
  );
};

export default SalesOrderCreatePage;
