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
import InvoicesPage from './pages/InvoicesPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';
import EngineeringTasksPage from './pages/EngineeringTasksPage';
import AccountingTasksPage from './pages/AccountingTasksPage';
import { AuthProvider, useAuth } from './lib/auth';
import { UndoProvider } from './lib/undo';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const SplashLoading = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A2E1F' }}>
    <div className="text-emerald-200 text-sm" data-testid="auth-loading">Loading…</div>
  </div>
);

const ProtectedApp = () => {
  const { user, loading } = useAuth();
  const [showPayModal, setShowPayModal] = useState(false);

  if (loading) return <SplashLoading />;

  const isEngineer = user?.role === 'engineer' || user?.role === 'draftsman';
  const isAccount = user?.role === 'account';

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

                  {/* Site visits — everyone except account role */}
                  {!isAccount && <Route path="/site-visits" element={<SiteVisitsPage />} />}
                  {!isAccount && <Route path="/site-visits/new" element={<SiteVisitFormPage />} />}
                  {!isAccount && <Route path="/site-visits/:id" element={<SiteVisitDetailPage />} />}
                  {!isAccount && <Route path="/site-visits/:id/edit" element={<SiteVisitFormPage />} />}

                  {/* Engineer can also browse projects read-only — admin/draftsman get full app */}
                  {!isEngineer && <Route path="/audits" element={<AuditsPage />} />}
                  {!isEngineer && <Route path="/audits/:id" element={<AuditDetailPage />} />}
                  {!isEngineer && <Route path="/documents" element={<DocumentsPage />} />}
                  {!isEngineer && <Route path="/clients" element={<ClientsPage />} />}
                  {!isEngineer && <Route path="/clients/:id" element={<ClientDetailPage />} />}
                  {!isEngineer && <Route path="/architects" element={<ArchitectsPage />} />}
                  {!isEngineer && <Route path="/architects/:id" element={<ArchitectDetailPage />} />}
                  {!isEngineer && <Route path="/projects/new" element={<ProjectFormPage />} />}
                  {!isEngineer && <Route path="/projects/:id/edit" element={<ProjectFormPage />} />}
                  {isEngineer && <Route path="/projects/new" element={<Navigate to="/projects" replace />} />}
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/projects" element={<ProjectsPage showPayModal={showPayModal} setShowPayModal={setShowPayModal} />} />
                  {!isEngineer && <Route path="/settings" element={<SettingsPage />} />}
                  {!isEngineer && <Route path="/invoices" element={<InvoicesPage />} />}
                  <Route path="/tasks" element={
                    isEngineer ? <Navigate to="/engineering-tasks" replace /> :
                    isAccount ? <Navigate to="/accounting-tasks" replace /> :
                    <TasksPage />
                  } />
                  <Route path="/engineering-tasks" element={
                    isAccount ? <Navigate to="/accounting-tasks" replace /> :
                    <EngineeringTasksPage />
                  } />
                  <Route path="/accounting-tasks" element={
                    isEngineer ? <Navigate to="/engineering-tasks" replace /> :
                    <AccountingTasksPage />
                  } />
                  <Route path="/profile" element={<ProfilePage />} />
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
      <ToastContainer position="top-right" />
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
