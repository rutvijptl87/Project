import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Building2, Plus, IndianRupee, Settings as SettingsIcon } from 'lucide-react';

const Navbar = ({ onRecordPayment }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b" style={{ borderColor: 'var(--cc-border)' }} data-testid="main-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="brand-logo">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--cc-dark-green)' }}>
            <Building2 size={20} color="#10B981" />
          </div>
          <div className="leading-tight">
            <div className="font-head font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--cc-dark-green)' }}>CREATOR</div>
            <div className="font-head font-medium text-[10px] tracking-[0.25em]" style={{ color: 'var(--cc-accent)' }}>CONSULTANT</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-projects">Projects</NavLink>
          <NavLink to="/clients" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-clients">Clients</NavLink>
          <NavLink to="/architects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-architects">Architects</NavLink>
          <NavLink to="/settings" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`} data-testid="nav-settings"><SettingsIcon size={14} className="inline mr-1" />Settings</NavLink>
        </nav>

        <div className="flex items-center gap-2">
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
