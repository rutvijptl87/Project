import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import RecordPaymentModal from './components/RecordPaymentModal';
import ProjectsPage from './pages/ProjectsPage';
import ClientsPage from './pages/ClientsPage';
import ArchitectsPage from './pages/ArchitectsPage';
import ArchitectDetailPage from './pages/ArchitectDetailPage';
import ClientDetailPage from './pages/ClientDetailPage';
import AuditsPage from './pages/AuditsPage';
import ProjectFormPage from './pages/ProjectFormPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './lib/auth';
import { UndoProvider } from './lib/undo';

const SplashLoading = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A2E1F' }}>
    <div className="text-emerald-200 text-sm" data-testid="auth-loading">Loading…</div>
  </div>
);

const ProtectedApp = () => {
  const { user, loading } = useAuth();
  const [showPayModal, setShowPayModal] = useState(false);

  if (loading) return <SplashLoading />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      {user ? (
        <Route
          path="/*"
          element={
            <UndoProvider>
              <div className="min-h-screen" style={{ background: '#FBFCFB' }}>
                <Navbar onRecordPayment={() => setShowPayModal(true)} />
                <Routes>
                  <Route path="/" element={<ProjectsPage showPayModal={showPayModal} setShowPayModal={setShowPayModal} />} />
                  <Route path="/audits" element={<AuditsPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/clients/:id" element={<ClientDetailPage />} />
                  <Route path="/architects" element={<ArchitectsPage />} />
                  <Route path="/architects/:id" element={<ArchitectDetailPage />} />
                  <Route path="/projects/new" element={<ProjectFormPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                <RecordPaymentModalWrapper
                  show={showPayModal}
                  onClose={() => setShowPayModal(false)}
                  onSaved={() => {}}
                />
              </div>
            </UndoProvider>
          }
        />
      ) : (
        <Route path="/*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedApp />
      </BrowserRouter>
    </AuthProvider>
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
