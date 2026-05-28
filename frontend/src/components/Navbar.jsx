import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Plus, IndianRupee, Settings as SettingsIcon, LogOut, User, ClipboardList } from 'lucide-react';
import { useAuth } from '../lib/auth';

const Navbar = ({ onRecordPayment }) => {
  const { user, logout } = useAuth();
  const isEngineer = user?.role === 'engineer';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b" style={{ borderColor: 'var(--cc-border)' }} data-testid="main-navbar">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <Link to={isEngineer ? '/site-visits' : '/'} className="flex items-center gap-3 group" data-testid="brand-logo">
          <img src="/logo.jpg" alt="Creator Consultant" className="h-9 w-auto object-contain" />
          <div className="leading-tight hidden sm:block">
            <div className="font-head font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>CREATOR</div>
            <div className="font-head font-medium text-[10px] tracking-[0.25em]" style={{ color: 'var(--cc-accent)' }}>CONSULTANT</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          {isEngineer ? (
            <>
              <NavLink to="/site-visits" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1"/>Site Visits</NavLink>
              <NavLink to="/projects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
              <NavLink to="/audits" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-audits">Audits</NavLink>
              <NavLink to="/documents" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-documents">Documents</NavLink>
              <NavLink to="/site-visits" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1"/>Site Visits</NavLink>
              <NavLink to="/clients" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-clients">Clients</NavLink>
              <NavLink to="/architects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-architects">Architects</NavLink>
              <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-settings"><SettingsIcon size={14} className="inline mr-1" />Settings</NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEngineer ? (
            <Link to="/site-visits/new" className="btn btn-accent btn-sm" data-testid="btn-nav-new-site-visit">
              <Plus size={14} /> <span className="hidden sm:inline">New Inspection</span>
            </Link>
          ) : (
            <>
              <Link to="/projects/new" className="btn btn-outline hidden sm:inline-flex" data-testid="btn-nav-new-project">
                <Plus size={16} /> New Project
              </Link>
              <button onClick={onRecordPayment} className="btn btn-accent hidden sm:inline-flex" data-testid="btn-nav-record-payment">
                <IndianRupee size={16} /> Record Payment
              </button>
            </>
          )}
          {user && (
            <>
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }} data-testid="navbar-user-info">
                <User size={12} />
                <span className="text-xs font-mono-data">{user.username}</span>
                {user.role === 'admin' && <span className="badge badge-settled" style={{ fontSize: '9px', padding: '1px 6px' }}>admin</span>}
                {user.role === 'engineer' && <span className="badge badge-pending" style={{ fontSize: '9px', padding: '1px 6px', background: '#0E7490', color: 'white' }}>engineer</span>}
              </div>
              <button
                onClick={logout}
                className="btn btn-outline btn-sm"
                title={`Sign out ${user.username}`}
                data-testid="btn-logout"
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile bottom nav for engineer */}
      {isEngineer && (
        <div className="md:hidden border-t flex" style={{ borderColor: 'var(--cc-border)' }}>
          <NavLink to="/site-visits" className={({isActive}) => `flex-1 text-center py-2 text-xs ${isActive ? 'font-bold' : ''}`} style={({isActive}) => ({ color: isActive ? 'var(--cc-dark-green)' : 'var(--cc-text-muted)' })} data-testid="mobile-nav-visits">
            <ClipboardList size={16} className="mx-auto mb-0.5"/> Visits
          </NavLink>
          <NavLink to="/projects" className={({isActive}) => `flex-1 text-center py-2 text-xs ${isActive ? 'font-bold' : ''}`} style={({isActive}) => ({ color: isActive ? 'var(--cc-dark-green)' : 'var(--cc-text-muted)' })} data-testid="mobile-nav-projects">
            Projects
          </NavLink>
        </div>
      )}
    </header>
  );
};

export default Navbar;
