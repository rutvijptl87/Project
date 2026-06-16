import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Plus, IndianRupee, Settings as SettingsIcon, LogOut, User, ClipboardList, MoreHorizontal, Users, Building2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import NotificationBell from './NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const navLinkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

const moreLinkBaseClass = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors';

const Navbar = ({ onRecordPayment }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isEngineer = user?.role === 'engineer';
  const isAccount = user?.role === 'account';
  const moreLinks = isEngineer
    ? []
    : [
        { to: '/clients', label: 'Clients', icon: Users, testId: 'nav-more-clients' },
        { to: '/architects', label: 'Architects', icon: Building2, testId: 'nav-more-architects' },
        { to: '/settings', label: 'Settings', icon: SettingsIcon, testId: 'nav-more-settings' },
        { to: '/profile', label: 'My Profile', icon: User, testId: 'nav-more-profile' },
      ];
  const isMoreActive = moreLinks.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

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
              <NavLink to="/site-visits" className={navLinkClass} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1"/>Site Visits</NavLink>
              <NavLink to="/projects" className={navLinkClass} data-testid="nav-projects">Projects</NavLink>
              <NavLink to="/profile" className={navLinkClass} data-testid="nav-profile"><User size={14} className="inline mr-1"/>Profile</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={navLinkClass} data-testid="nav-projects">Projects</NavLink>
              <NavLink to="/audits" className={navLinkClass} data-testid="nav-audits">Audits</NavLink>
              <NavLink to="/documents" className={navLinkClass} data-testid="nav-documents">Documents</NavLink>
              {!isAccount && (
                <NavLink to="/site-visits" className={navLinkClass} data-testid="nav-site-visits"><ClipboardList size={14} className="inline mr-1"/>Site Visits</NavLink>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`nav-link inline-flex items-center gap-1.5 ${isMoreActive ? 'active' : ''}`}
                  data-testid="nav-more"
                >
                  <MoreHorizontal size={15} />
                  More
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 border-[var(--cc-border)] bg-white p-2 text-[var(--cc-text)] shadow-xl">
                  <DropdownMenuLabel className="px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--cc-text-muted)]">
                    More options
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[var(--cc-border)]" />
                  {moreLinks.map(({ to, label, icon: Icon, testId }) => (
                    <DropdownMenuItem key={to} asChild className="p-0 focus:bg-transparent">
                      <NavLink
                        to={to}
                        className={({ isActive }) => `${moreLinkBaseClass} ${isActive ? 'bg-[var(--cc-surface)] font-semibold text-[var(--cc-dark-green)]' : 'text-[var(--cc-text-muted)] hover:bg-[var(--cc-surface)] hover:text-[var(--cc-dark-green)]'}`}
                        data-testid={testId}
                      >
                        <Icon size={15} />
                        <span>{label}</span>
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
              {user.role === 'admin' && <NotificationBell />}
              <Link to="/profile"
                    className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}
                    title="My Profile"
                    data-testid="navbar-user-info">
                <User size={12} />
                <span className="text-xs font-mono-data">{user.username}</span>
                {user.role === 'admin' && <span className="badge badge-settled" style={{ fontSize: '9px', padding: '1px 6px' }}>admin</span>}
                {user.role === 'engineer' && <span className="badge badge-pending" style={{ fontSize: '9px', padding: '1px 6px', background: '#0E7490', color: 'white' }}>engineer</span>}
                {user.role === 'account' && <span className="badge badge-pending" style={{ fontSize: '9px', padding: '1px 6px', background: '#7C3AED', color: 'white' }}>account</span>}
              </Link>
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
          <NavLink to="/profile" className={({isActive}) => `flex-1 text-center py-2 text-xs ${isActive ? 'font-bold' : ''}`} style={({isActive}) => ({ color: isActive ? 'var(--cc-dark-green)' : 'var(--cc-text-muted)' })} data-testid="mobile-nav-profile">
            <User size={16} className="mx-auto mb-0.5"/> Profile
          </NavLink>
        </div>
      )}
    </header>
  );
};

export default Navbar;
