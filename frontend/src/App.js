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
import AuditDetailPage from './pages/AuditDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import SiteVisitsPage from './pages/SiteVisitsPage';
import SiteVisitFormPage from './pages/SiteVisitFormPage';
import SiteVisitDetailPage from './pages/SiteVisitDetailPage';
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

  const isEngineer = user?.role === 'engineer';

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={isEngineer ? '/site-visits' : '/'} replace /> : <LoginPage />}
      />
      {user ? (
        <Route
          path="/*"
          element={
            <UndoProvider>
              <div className="min-h-screen" style={{ background: '#FBFCFB' }}>
                <Navbar onRecordPayment={() => setShowPayModal(true)} />
                <Routes>
                  {/* Engineer landing: redirect "/" to /site-visits */}
                  {isEngineer ? (
                    <Route path="/" element={<Navigate to="/site-visits" replace />} />
                  ) : (
                    <Route path="/" element={<ProjectsPage showPayModal={showPayModal} setShowPayModal={setShowPayModal} />} />
                  )}

                  {/* Site visits — everyone */}
                  <Route path="/site-visits" element={<SiteVisitsPage />} />
                  <Route path="/site-visits/new" element={<SiteVisitFormPage />} />
                  <Route path="/site-visits/:id" element={<SiteVisitDetailPage />} />
                  <Route path="/site-visits/:id/edit" element={<SiteVisitFormPage />} />

                  {/* Engineer can also browse projects read-only — admin/staff get full app */}
                  {!isEngineer && <Route path="/audits" element={<AuditsPage />} />}
                  {!isEngineer && <Route path="/audits/:id" element={<AuditDetailPage />} />}
                  {!isEngineer && <Route path="/documents" element={<DocumentsPage />} />}
                  {!isEngineer && <Route path="/clients" element={<ClientsPage />} />}
                  {!isEngineer && <Route path="/clients/:id" element={<ClientDetailPage />} />}
                  {!isEngineer && <Route path="/architects" element={<ArchitectsPage />} />}
                  {!isEngineer && <Route path="/architects/:id" element={<ArchitectDetailPage />} />}
                  {!isEngineer && <Route path="/projects/new" element={<ProjectFormPage />} />}
                  {!isEngineer && <Route path="/projects/:id/edit" element={<ProjectFormPage />} />}
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/projects" element={<ProjectsPage showPayModal={showPayModal} setShowPayModal={setShowPayModal} />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to={isEngineer ? '/site-visits' : '/'} replace />} />
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
