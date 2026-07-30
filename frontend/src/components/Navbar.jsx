import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link } from 'react-router-dom';
import { Plus, IndianRupee, Settings as SettingsIcon, LogOut, User, ClipboardList, Menu, Download } from 'lucide-react';
import { useAuth } from '../lib/auth';
import NotificationBell from './NotificationBell';
import Swal from 'sweetalert2';

const Navbar = ({ onRecordPayment }) => {
  const { user, logout } = useAuth();
  const isEngineer = user?.role === 'engineer' || user?.role === 'draftsman';
  const isDraftsman = user?.role === 'draftsman';
  const isAccount = user?.role === 'account';
  const isAdmin = user?.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        !event.target.closest('#mobile-drawer')
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (menuOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const menuContent = (
    <>
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--cc-border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>{user?.name || user?.username}</p>
        <p className="text-xs truncate uppercase" style={{ color: 'var(--cc-text-muted)' }}>{user?.role}</p>
      </div>

      {/* Navigation links (visible only on mobile/tablet) */}
      <div className="lg:hidden border-b pb-2 mb-2 px-2 flex flex-col gap-2 mt-2" style={{ borderColor: 'var(--cc-border)' }}>
        {isEngineer ? (
          <Link to="/site-visits/new" className="btn btn-accent w-full justify-start text-sm" onClick={() => setMenuOpen(false)}>
            <Plus size={16} className="mr-2" /> New Inspection
          </Link>
        ) : (
          <>
            <Link to="/projects/new" className="btn btn-outline w-full justify-start text-sm" onClick={() => setMenuOpen(false)}>
              <Plus size={16} className="mr-2" /> New Project
            </Link>
            <button onClick={() => { setMenuOpen(false); onRecordPayment(); }} className="btn btn-accent w-full justify-start text-sm">
              <IndianRupee size={16} className="mr-2" /> Record Payment
            </button>
          </>
        )}
      </div>

      <div className="lg:hidden border-b pb-1 mb-1" style={{ borderColor: 'var(--cc-border)' }}>
        {isEngineer ? (
          <>
            <NavLink to="/site-visits" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Site Visits</NavLink>
            <NavLink to="/projects" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Projects</NavLink>
            <NavLink to="/tasks" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Tasks</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Projects</NavLink>
            <NavLink to="/tasks" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Tasks</NavLink>
            <NavLink to="/audits" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Audits</NavLink>
            <NavLink to="/documents" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Documents</NavLink>
            {!isAccount && (
              <NavLink to="/site-visits" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Site Visits</NavLink>
            )}
            <NavLink to="/clients" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Clients</NavLink>
            <NavLink to="/architects" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Architects</NavLink>
            <NavLink to="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Settings</NavLink>
            <NavLink to="/invoices" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Invoices</NavLink>
            <NavLink to="/quotations" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Quotation</NavLink>
            <NavLink to="/sales-orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Sales Orders</NavLink>
          </>
        )}
      </div>
      
      <div className="mt-auto pt-1 pb-1">
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="block w-full text-left px-4 py-2 text-sm text-emerald-700 font-semibold hover:bg-emerald-50 flex items-center gap-2"
          >
            <Download size={14} /> Install App
          </button>
        )}
        <Link
          to="/profile"
          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          onClick={() => setMenuOpen(false)}
        >
          <User size={14} /> Profile
        </Link>
        <button
          onClick={() => {
            setMenuOpen(false);
            Swal.fire({
              title: 'Log Out',
              text: 'Are you sure you want to sign out?',
              icon: 'question',
              showCancelButton: true,
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#d33',
              confirmButtonText: 'Yes, log out'
            }).then((result) => {
              if (result.isConfirmed) {
                logout();
              }
            });
          }}
          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b" style={{ borderColor: 'var(--cc-border)' }} data-testid="main-navbar">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <Link to={isEngineer ? '/site-visits' : '/'} className="flex items-center gap-3 group" data-testid="brand-logo">
            <img src="/logo.jpg" alt="Creator Consultant" className="h-8 sm:h-9 w-auto object-contain flex-shrink-0" />
            <div className="leading-tight hidden sm:block flex-shrink-0">
              <div className="font-head font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>CREATOR</div>
              <div className="font-head font-medium text-[10px] tracking-[0.25em]" style={{ color: 'var(--cc-accent)' }}>CONSULTANT</div>
            </div>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
          {isEngineer ? (
            <>
              <NavLink to="/site-visits" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1" />Site Visits</NavLink>
              <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
              <NavLink to="/tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-tasks">Tasks</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
              <NavLink to="/tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-tasks">Tasks</NavLink>
              <NavLink to="/audits" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-audits">Audits</NavLink>
              <NavLink to="/documents" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-documents">Documents</NavLink>
              {!isAccount && (
                <NavLink to="/site-visits" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1" />Site Visits</NavLink>
              )}
              <NavLink to="/clients" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-clients">Clients</NavLink>
              <NavLink to="/architects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-architects">Architects</NavLink>
              <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-settings"><SettingsIcon size={14} className="inline mr-1" />Settings</NavLink>
              <NavLink to="/invoices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-invoices">Invoices</NavLink>
              <NavLink to="/quotations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-quotations">Quotation</NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-1 sm:gap-2">
            {isEngineer ? (
              <Link to="/site-visits/new" className="btn btn-accent btn-sm" data-testid="btn-nav-new-site-visit">
                <Plus size={14} /> <span>New Inspection</span>
              </Link>
            ) : (
              <>
                <Link to="/projects/new" className="btn btn-outline btn-sm px-3" data-testid="btn-nav-new-project">
                  <Plus size={16} /> <span>New Project</span>
                </Link>
                <button onClick={onRecordPayment} className="btn btn-accent btn-sm px-3" data-testid="btn-nav-record-payment">
                  <IndianRupee size={16} /> <span>Record Payment</span>
                </button>
              </>
            )}
          </div>
          {user && (
            <>
              <NotificationBell />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn btn-outline btn-sm flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 p-0 flex-shrink-0"
                  title="Menu"
                  data-testid="btn-profile-menu"
                >
                  <Menu size={16} className="lg:hidden" />
                  <User size={16} className="hidden lg:block" />
                </button>
                {menuOpen && (
                  <>
                    {/* Desktop Dropdown */}
                    <div className="hidden lg:flex absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 border z-50 flex-col" style={{ borderColor: 'var(--cc-border)' }}>
                      {menuContent}
                    </div>

                    {/* Mobile Drawer (Escapes the header containing block) */}
                    {typeof document !== 'undefined' && createPortal(
                      <div className="fixed inset-0 z-50 lg:hidden" style={{ zIndex: 9999 }}>
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
                        <div id="mobile-drawer" className="fixed inset-y-0 right-0 w-64 bg-white shadow-2xl flex flex-col py-2 overflow-y-auto" style={{ borderColor: 'var(--cc-border)' }}>
                          {menuContent}
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
