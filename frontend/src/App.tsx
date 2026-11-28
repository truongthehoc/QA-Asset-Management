import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AssetStatusProvider } from './contexts/AssetStatusContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { DialogProvider } from './contexts/DialogContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoveryPage } from './pages/DiscoveryPage';
import { DiscoveryApprovePage } from './pages/DiscoveryApprovePage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetCreatePage } from './pages/AssetCreatePage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { AssetQrPublicPage } from './pages/AssetQrPublicPage';
import { TransfersPage } from './pages/TransfersPage';
import { TransferActionPage } from './pages/TransferActionPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { MaintenanceCreatePage } from './pages/MaintenanceCreatePage';
import { MaintenanceDetailPage } from './pages/MaintenanceDetailPage';
import { DisposalCreatePage } from './pages/DisposalCreatePage';
import { InventoryPage } from './pages/InventoryPage';
import { SoftwarePage } from './pages/SoftwarePage';
import { SoftwareLicenseCreatePage } from './pages/SoftwareLicenseCreatePage';
import { SoftwareLicenseDetailPage } from './pages/SoftwareLicenseDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { AssetCategoriesPage } from './pages/admin/AssetCategoriesPage';
import { AssetTypesPage } from './pages/admin/AssetTypesPage';
import { AssetStatusesPage } from './pages/admin/AssetStatusesPage';
import { LocationsPage } from './pages/admin/LocationsPage';
import { SuppliersPage } from './pages/admin/SuppliersPage';
import { EmployeesPage } from './pages/admin/EmployeesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RolesPage } from './pages/admin/RolesPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AgentManagementPage } from './pages/admin/AgentManagementPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SoftwareInfoPage } from './pages/SoftwareInfoPage';
import { ContractsPage } from './pages/ContractsPage';
import { ContractCreatePage } from './pages/ContractCreatePage';
import { ContractDetailPage } from './pages/ContractDetailPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-ink-secondary">Đang khởi tạo phiên làm việc...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

export function App() {
  return (
    <BrandingProvider>
    <DialogProvider>
    <AuthProvider>
      <AssetStatusProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/qr/:code" element={<AssetQrPublicPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/discovery" element={<ProtectedRoute><DiscoveryPage /></ProtectedRoute>} />
          <Route path="/discovery/approve/:id" element={<ProtectedRoute><DiscoveryApprovePage /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><AssetsPage /></ProtectedRoute>} />
          <Route path="/assets/new" element={<ProtectedRoute><AssetCreatePage /></ProtectedRoute>} />
          <Route path="/assets/:id" element={<ProtectedRoute><AssetDetailPage /></ProtectedRoute>} />
          <Route path="/transfers" element={<ProtectedRoute><TransfersPage /></ProtectedRoute>} />
          <Route path="/transfers/new" element={<ProtectedRoute><TransferActionPage /></ProtectedRoute>} />
          <Route path="/maintenance" element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
          <Route path="/maintenance/new" element={<ProtectedRoute><MaintenanceCreatePage /></ProtectedRoute>} />
          <Route path="/maintenance/disposals/new" element={<ProtectedRoute><DisposalCreatePage /></ProtectedRoute>} />
          <Route path="/maintenance/:id" element={<ProtectedRoute><MaintenanceDetailPage /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/software" element={<ProtectedRoute><SoftwarePage /></ProtectedRoute>} />
          <Route path="/software/licenses/new" element={<ProtectedRoute><SoftwareLicenseCreatePage /></ProtectedRoute>} />
          <Route path="/software/licenses/:id" element={<ProtectedRoute><SoftwareLicenseDetailPage /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute><ContractsPage /></ProtectedRoute>} />
          <Route path="/contracts/new" element={<ProtectedRoute><ContractCreatePage /></ProtectedRoute>} />
          <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetailPage /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><SoftwareInfoPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

          {/* Danh mục & Quản trị - tách riêng từng trang theo SRS Mục 14.10 */}
          <Route path="/admin" element={<Navigate to="/admin/departments" replace />} />
          <Route path="/admin/departments" element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
          <Route path="/admin/asset-categories" element={<ProtectedRoute><AssetCategoriesPage /></ProtectedRoute>} />
          <Route path="/admin/asset-types" element={<ProtectedRoute><AssetTypesPage /></ProtectedRoute>} />
          <Route path="/admin/asset-statuses" element={<ProtectedRoute><AssetStatusesPage /></ProtectedRoute>} />
          <Route path="/admin/locations" element={<ProtectedRoute><LocationsPage /></ProtectedRoute>} />
          <Route path="/admin/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
          <Route path="/admin/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin/agent-management" element={<ProtectedRoute><AgentManagementPage /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AssetStatusProvider>
    </AuthProvider>
    </DialogProvider>
    </BrandingProvider>
  );
}

export default App;
