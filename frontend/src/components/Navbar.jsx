import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Plus, IndianRupee, Settings as SettingsIcon, Lock, Unlock } from 'lucide-react';
import { useAuth } from '../lib/auth';

const Navbar = ({ onRecordPayment }) => {
  const { passwordSet, unlocked } = useAuth() || {};
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b" style={{ borderColor: 'var(--cc-border)' }} data-testid="main-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group" data-testid="brand-logo">
          <img src="/logo.jpg" alt="Creator Consultant" className="h-10 w-auto object-contain" />
          <div className="leading-tight hidden sm:block">
            <div className="font-head font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>CREATOR</div>
            <div className="font-head font-medium text-[10px] tracking-[0.25em]" style={{ color: 'var(--cc-accent)' }}>CONSULTANT</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
          <NavLink to="/offers" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-offers">Offers</NavLink>
          <NavLink to="/clients" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-clients">Clients</NavLink>
          <NavLink to="/architects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-architects">Architects</NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-settings"><SettingsIcon size={14} className="inline mr-1" />Settings</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {passwordSet && (
            <Link
              to="/settings"
              className="hidden md:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
              title={unlocked ? 'Unlocked — click to manage' : 'Locked — click will prompt password on edits'}
              style={unlocked
                ? { background: '#D1FAE5', color: '#065F46', border: '1px solid #34D399' }
                : { background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
              data-testid="navbar-lock-indicator"
            >
              {unlocked ? <Unlock size={11}/> : <Lock size={11}/>}
              {unlocked ? 'Unlocked' : 'Locked'}
            </Link>
          )}
          <Link to="/projects/new" className="btn btn-outline" data-testid="btn-nav-new-project">
            <Plus size={16} /> New Project
          </Link>
          <button onClick={onRecordPayment} className="btn btn-accent" data-testid="btn-nav-record-payment">
            <IndianRupee size={16} /> Record Payment
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
