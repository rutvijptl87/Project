import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import RecordPaymentModal from './components/RecordPaymentModal';
import ProjectsPage from './pages/ProjectsPage';
import ClientsPage from './pages/ClientsPage';
import ArchitectsPage from './pages/ArchitectsPage';
import ArchitectDetailPage from './pages/ArchitectDetailPage';
import ClientDetailPage from './pages/ClientDetailPage';
import ProjectFormPage from './pages/ProjectFormPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const [showPayModal, setShowPayModal] = useState(false);
  const [globalRefreshTick, setGlobalRefreshTick] = useState(0);

  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: '#FBFCFB' }}>
        <Navbar onRecordPayment={() => setShowPayModal(true)} />

        <Routes>
          <Route path="/" element={<ProjectsPage showPayModal={showPayModal} setShowPayModal={setShowPayModal} />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/architects" element={<ArchitectsPage />} />
          <Route path="/architects/:id" element={<ArchitectDetailPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>

        {/* Global payment modal usable from navbar on any page */}
        <RecordPaymentModalWrapper
          show={showPayModal}
          onClose={() => setShowPayModal(false)}
          onSaved={() => setGlobalRefreshTick((t) => t + 1)}
        />
      </div>
    </BrowserRouter>
  );
}

// Wrapper: only renders when triggered from navbar (projects page handles its own too)
const RecordPaymentModalWrapper = ({ show, onClose, onSaved }) => {
  const isProjectsPage = window.location.pathname === '/';
  if (isProjectsPage) return null; // ProjectsPage handles the modal itself
  return (
    <RecordPaymentModal
      open={show}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
};

export default App;
