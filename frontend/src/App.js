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
import QuotationsPage from './pages/QuotationsPage';
import QuotationCreatePage from './pages/QuotationCreatePage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import SalesOrderCreatePage from './pages/SalesOrderCreatePage';
import JobTypeListPage from './pages/JobTypeListPage';
import JobTypeFormPage from './pages/JobTypeFormPage';
import JobSubTypeListPage from './pages/JobSubTypeListPage';
import JobSubTypeFormPage from './pages/JobSubTypeFormPage';
import ScopeOfWorkListPage from './pages/ScopeOfWorkListPage';
import ScopeOfWorkFormPage from './pages/ScopeOfWorkFormPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import TasksPage from './pages/TasksPage';
import EngineeringTasksPage from './pages/EngineeringTasksPage';
import AccountingTasksPage from './pages/AccountingTasksPage';
import StructuralAuditTasksPage from './pages/StructuralAuditTasksPage';
import TaxCategoryListPage from './pages/TaxCategoryListPage';
import TaxCategoryFormPage from './pages/TaxCategoryFormPage';
import SalesTaxTemplateListPage from './pages/SalesTaxTemplateListPage';
import SalesTaxTemplateFormPage from './pages/SalesTaxTemplateFormPage';
import AddressFormPage from './pages/AddressFormPage';
import AddressListPage from './pages/AddressListPage';
import SiteAddressListPage from './pages/SiteAddressListPage';
import SiteAddressFormPage from './pages/SiteAddressFormPage';
import ContactFormPage from './pages/ContactFormPage';
import ContactListPage from './pages/ContactListPage';
import PaymentTermsTemplateListPage from './pages/PaymentTermsTemplateListPage';
import PaymentTermsTemplateFormPage from './pages/PaymentTermsTemplateFormPage';
import PaymentTermListPage from './pages/PaymentTermListPage';
import PaymentTermFormPage from './pages/PaymentTermFormPage';
import TermsAndConditionsListPage from './pages/TermsAndConditionsListPage';
import TestTemplateListPage from './pages/TestTemplateListPage';
import TestTemplateCreatePage from './pages/TestTemplateCreatePage';
import TermsAndConditionsFormPage from './pages/TermsAndConditionsFormPage';
import LetterHeadListPage from './pages/LetterHeadListPage';
import LetterHeadFormPage from './pages/LetterHeadFormPage';
import PrintHeadingListPage from './pages/PrintHeadingListPage';
import PrintHeadingFormPage from './pages/PrintHeadingFormPage';
import OpportunityTypeListPage from './pages/OpportunityTypeListPage';
import ItemListPage from './pages/ItemListPage';
import ItemFormPage from './pages/ItemFormPage';
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
  const isDraftsman = user?.role === 'draftsman';

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

                  {/* Scope of Work Routes */}
                  {!isEngineer && <Route path="/scope-of-works" element={<ScopeOfWorkListPage />} />}
                  {!isEngineer && <Route path="/scope-of-works/new" element={<ScopeOfWorkFormPage />} />}
                  {!isEngineer && <Route path="/scope-of-works/:id" element={<ScopeOfWorkFormPage />} />}

                  {/* Taxes Routes */}
                  {!isEngineer && <Route path="/tax-categories" element={<TaxCategoryListPage />} />}
                  {!isEngineer && <Route path="/tax-categories/new" element={<TaxCategoryFormPage />} />}
                  {!isEngineer && <Route path="/tax-categories/:id" element={<TaxCategoryFormPage />} />}
                  {!isEngineer && <Route path="/sales-tax-templates" element={<SalesTaxTemplateListPage />} />}
                  {!isEngineer && <Route path="/sales-tax-templates/new" element={<SalesTaxTemplateFormPage />} />}
                  {!isEngineer && <Route path="/sales-tax-templates/:id" element={<SalesTaxTemplateFormPage />} />}
                  {!isEngineer && <Route path="/payment-terms-templates" element={<PaymentTermsTemplateListPage />} />}
                  {!isEngineer && <Route path="/payment-terms-templates/new" element={<PaymentTermsTemplateFormPage />} />}
                  {!isEngineer && <Route path="/payment-terms-templates/:id" element={<PaymentTermsTemplateFormPage />} />}
                  {!isEngineer && <Route path="/payment-terms" element={<PaymentTermListPage />} />}
                  {!isEngineer && <Route path="/payment-terms/new" element={<PaymentTermFormPage />} />}
                  {!isEngineer && <Route path="/payment-terms/:id" element={<PaymentTermFormPage />} />}
                  
                  {!isEngineer && <Route path="/terms-and-conditions" element={<TermsAndConditionsListPage />} />}
                  {!isEngineer && <Route path="/test-templates" element={<TestTemplateListPage />} />}
                  {!isEngineer && <Route path="/test-templates/new" element={<TestTemplateCreatePage />} />}
                  {!isEngineer && <Route path="/test-templates/:id" element={<TestTemplateCreatePage />} />}
                  {!isEngineer && <Route path="/terms-and-conditions/new" element={<TermsAndConditionsFormPage />} />}
                  {!isEngineer && <Route path="/terms-and-conditions/:id" element={<TermsAndConditionsFormPage />} />}

                  {!isEngineer && <Route path="/letter-heads" element={<LetterHeadListPage />} />}
                  {!isEngineer && <Route path="/letter-heads/new" element={<LetterHeadFormPage />} />}
                  {!isEngineer && <Route path="/letter-heads/:id" element={<LetterHeadFormPage />} />}

                  {!isEngineer && <Route path="/print-headings" element={<PrintHeadingListPage />} />}
                  {!isEngineer && <Route path="/print-headings/new" element={<PrintHeadingFormPage />} />}
                  {!isEngineer && <Route path="/print-headings/:id" element={<PrintHeadingFormPage />} />}

                  {!isEngineer && <Route path="/opportunity-types" element={<OpportunityTypeListPage />} />}



                  {!isEngineer && <Route path="/items" element={<ItemListPage />} />}
                  {!isEngineer && <Route path="/items/new" element={<ItemFormPage />} />}
                  {!isEngineer && <Route path="/items/:id" element={<ItemFormPage />} />}

                  {/* Address Routes */}
                  {!isEngineer && <Route path="/addresses" element={<AddressListPage />} />}
                  {!isEngineer && <Route path="/addresses/new" element={<AddressFormPage />} />}
                  {!isEngineer && <Route path="/addresses/:id" element={<AddressFormPage />} />}

                  {/* Site Address Routes */}
                  {!isEngineer && <Route path="/site-addresses" element={<SiteAddressListPage />} />}
                  {!isEngineer && <Route path="/site-addresses/new" element={<SiteAddressFormPage />} />}
                  {!isEngineer && <Route path="/site-addresses/:id" element={<SiteAddressFormPage />} />}

                  {/* Contact Routes */}
                  {!isEngineer && <Route path="/contacts" element={<ContactListPage />} />}
                  {!isEngineer && <Route path="/contacts/new" element={<ContactFormPage />} />}
                  {!isEngineer && <Route path="/contacts/:id" element={<ContactFormPage />} />}

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
                  {!isEngineer && <Route path="/quotations" element={<QuotationsPage />} />}
                  {!isEngineer && <Route path="/quotations/new" element={<QuotationCreatePage />} />}
                  {!isEngineer && <Route path="/quotations/:id" element={<QuotationCreatePage />} />}
                  {!isEngineer && <Route path="/sales-orders" element={<SalesOrdersPage />} />}
                  {!isEngineer && <Route path="/sales-orders/new" element={<SalesOrderCreatePage />} />}
                  {!isEngineer && <Route path="/sales-orders/:id" element={<SalesOrderCreatePage />} />}
                  {!isEngineer && <Route path="/job-types" element={<JobTypeListPage />} />}
                  {!isEngineer && <Route path="/job-types/new" element={<JobTypeFormPage />} />}
                  {!isEngineer && <Route path="/job-types/:id" element={<JobTypeFormPage />} />}
                  {!isEngineer && <Route path="/job-sub-types" element={<JobSubTypeListPage />} />}
                  {!isEngineer && <Route path="/job-sub-types/new" element={<JobSubTypeFormPage />} />}
                  {!isEngineer && <Route path="/job-sub-types/:id" element={<JobSubTypeFormPage />} />}
                  <Route path="/tasks" element={<TasksPage />} />
                  {!isAccount && <Route path="/engineering-tasks" element={<EngineeringTasksPage />} />}
                  {!isEngineer && <Route path="/accounting-tasks" element={<AccountingTasksPage />} />}
                  {!isDraftsman && <Route path="/structural-tasks" element={<StructuralAuditTasksPage />} />}
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
