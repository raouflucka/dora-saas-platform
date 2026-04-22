import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FinancialEntities from './pages/FinancialEntities';
import IctProviders from './pages/IctProviders';
import ContractualArrangements from './pages/ContractualArrangements';
import BusinessFunctions from './pages/BusinessFunctions';
import IctServiceAssessments from './pages/IctServiceAssessments';
import IctSupplyChain from './pages/IctSupplyChain';
import ValidationDashboard from './pages/ValidationDashboard';
import ExitStrategies from './pages/ExitStrategies';
import IctServices from './pages/IctServices';
import RoiExport from './pages/RoiExport';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import GeographicRisk from './pages/GeographicRisk';
import RoleGuard from './components/RoleGuard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {

  const { user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const { initializeAuth, loading } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="entities" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><FinancialEntities /></RoleGuard>} />
          <Route path="providers" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><IctProviders /></RoleGuard>} />
          <Route path="contracts" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><ContractualArrangements /></RoleGuard>} />
          <Route path="functions" element={<RoleGuard allowed={['ADMIN', 'ANALYST']} fallback={<Navigate to="/" replace />}><BusinessFunctions /></RoleGuard>} />
          <Route path="assessments" element={<RoleGuard allowed={['ADMIN', 'ANALYST']} fallback={<Navigate to="/" replace />}><IctServiceAssessments /></RoleGuard>} />
          <Route path="supply-chain" element={<RoleGuard allowed={['ADMIN', 'ANALYST']} fallback={<Navigate to="/" replace />}><IctSupplyChain /></RoleGuard>} />
          <Route path="exit-strategies" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><ExitStrategies /></RoleGuard>} />
          <Route path="ict-services" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><IctServices /></RoleGuard>} />
          <Route path="validation" element={<RoleGuard allowed={['ADMIN', 'ANALYST', 'EDITOR']} fallback={<Navigate to="/" replace />}><ValidationDashboard /></RoleGuard>} />
          <Route path="roi-export" element={<RoleGuard allowed={['ADMIN', 'ANALYST']} fallback={<Navigate to="/" replace />}><RoiExport /></RoleGuard>} />
          <Route path="admin" element={<RoleGuard allowed={['ADMIN']} fallback={<Navigate to="/" replace />}><AdminPanel /></RoleGuard>} />
          <Route path="risk-geographic" element={<RoleGuard allowed={['ADMIN']} fallback={<Navigate to="/" replace />}><GeographicRisk /></RoleGuard>} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
