import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SystemConfigProvider } from './contexts/SystemConfigContext';
import ErrorBoundary from './components/ErrorBoundary';

// Auth pages
import ClientLoginPage from './pages/auth/ClientLoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Client pages
import ClientDashboard from './pages/client/Dashboard';
import AccountOverview from './pages/client/AccountOverview';
import TransactionHistory from './pages/client/TransactionHistory';
import DepositFunds from './pages/client/DepositFunds';
import WithdrawFunds from './pages/client/WithdrawFunds';
import TransferFunds from './pages/client/TransferFunds';
import EWalletManagement from './pages/client/EWalletManagement';
import Profile from './pages/client/Profile';
import ReportsAnalytics from './pages/client/ReportsAnalytics';
import Statements from './pages/client/Statements';
import HelpSupport from './pages/client/HelpSupport';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminAnalytics from './pages/admin/Analytics';
import ClientAccountOpening from './pages/admin/ClientAccountOpening';
import ManageUsers from './pages/admin/ManageUsers';
import ManagePasswordResets from './pages/admin/ManagePasswordResets';
import ManageAccounts from './pages/admin/ManageAccounts';
import ManageTransactions from './pages/admin/ManageTransactions';
import ManageDeposits from './pages/admin/ManageDeposits';
import ManageWithdrawals from './pages/admin/ManageWithdrawals';
import ManageCountries from './pages/admin/ManageCountries';
import ManageFAQs from './pages/admin/ManageFAQs';
import ManageSupportRequests from './pages/admin/ManageSupportRequests';
import SystemSettings from './pages/admin/SystemSettings';

// Admin Access
import AdminAccessPage from './pages/auth/AdminAccessPage';

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
  </div>
);

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to={adminOnly ? "/admin-access" : "/client-login"} replace />;

  return <>{children}</>;
};

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

function AppContent() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route path="/client-login" element={<PublicRoute><ClientLoginPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/admin-access" element={<PublicRoute><AdminAccessPage /></PublicRoute>} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Client routes */}
        <Route path="/dashboard" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountOverview /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
        <Route path="/deposit" element={<ProtectedRoute><DepositFunds /></ProtectedRoute>} />
        <Route path="/withdraw" element={<ProtectedRoute><WithdrawFunds /></ProtectedRoute>} />
        <Route path="/transfer" element={<ProtectedRoute><TransferFunds /></ProtectedRoute>} />
        <Route path="/ewallets" element={<ProtectedRoute><EWalletManagement /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsAnalytics /></ProtectedRoute>} />
        <Route path="/statements" element={<ProtectedRoute><Statements /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/client-onboarding" element={<ProtectedRoute adminOnly><ClientAccountOpening /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly><ManageUsers /></ProtectedRoute>} />
        <Route path="/admin/password-resets" element={<ProtectedRoute adminOnly><ManagePasswordResets /></ProtectedRoute>} />
        <Route path="/admin/accounts" element={<ProtectedRoute adminOnly><ManageAccounts /></ProtectedRoute>} />
        <Route path="/admin/deposits" element={<ProtectedRoute adminOnly><ManageDeposits /></ProtectedRoute>} />
        <Route path="/admin/withdrawals" element={<ProtectedRoute adminOnly><ManageWithdrawals /></ProtectedRoute>} />
        <Route path="/admin/transactions" element={<ProtectedRoute adminOnly><ManageTransactions /></ProtectedRoute>} />
        <Route path="/admin/support" element={<ProtectedRoute adminOnly><ManageSupportRequests /></ProtectedRoute>} />
        <Route path="/admin/faqs" element={<ProtectedRoute adminOnly><ManageFAQs /></ProtectedRoute>} />
        <Route path="/admin/countries" element={<ProtectedRoute adminOnly><ManageCountries /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute adminOnly><SystemSettings /></ProtectedRoute>} />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/client-login" replace />} />
        <Route path="*" element={<Navigate to="/client-login" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SystemConfigProvider>
            <AppContent />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { background: '#363636', color: '#fff' },
                success: { duration: 3000, iconTheme: { primary: '#10B981', secondary: '#fff' } },
                error: { duration: 5000, iconTheme: { primary: '#EF4444', secondary: '#fff' } },
              }}
            />
          </SystemConfigProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
