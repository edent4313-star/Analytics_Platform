import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';

// Auth
import { LoginPage } from '@pages/auth/LoginPage';
import { ChangePasswordPage } from '@pages/auth/ChangePasswordPage';
import { OidcCallbackPage } from '@pages/auth/OidcCallbackPage';

// Dashboard
import { DashboardHome } from '@pages/dashboard/DashboardHome';
import { DashboardRenderer } from '@pages/dashboard/DashboardRenderer';

// Profile
import { ProfilePage } from '@pages/profile/ProfilePage';

// Admin
import { AdminHome } from '@pages/admin/AdminHome';
import { UserListPage } from '@pages/admin/users/UserListPage';
import { UserFormPage } from '@pages/admin/users/UserFormPage';
import { RolesPage } from '@pages/admin/roles/RolesPage';
import { PermissionsPage } from '@pages/admin/permissions/PermissionsPage';
import { OrgPage } from '@pages/admin/organization/OrgPage';
import { DataSourcesPage } from '@pages/admin/datasources/DataSourcesPage';
import { DatasetsPage } from '@pages/admin/datasets/DatasetsPage';
import { DashboardDesignerPage } from '@pages/admin/designer/DashboardDesignerPage';
import { DashboardsAdminPage } from '@pages/admin/dashboards/DashboardsAdminPage';
import { ApprovalsPage } from '@pages/admin/approvals/ApprovalsPage';
import { AuditLogsPage } from '@pages/admin/audit/AuditLogsPage';

// Errors
import { NotFoundPage } from '@pages/errors/NotFoundPage';
import { ForbiddenPage } from '@pages/errors/ForbiddenPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/auth/callback" element={<OidcCallbackPage />} />
      </Route>

      {/* ── Authenticated ──────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboards" replace />} />

          <Route path="/dashboards" element={<DashboardHome />} />
          <Route path="/dashboard/:code" element={<DashboardRenderer />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/users" element={<UserListPage />} />
          <Route path="/admin/users/new" element={<UserFormPage />} />
          <Route path="/admin/users/:id" element={<UserFormPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
          <Route path="/admin/permissions" element={<PermissionsPage />} />
          <Route path="/admin/organization" element={<OrgPage />} />
          <Route path="/admin/data-sources" element={<DataSourcesPage />} />
          <Route path="/admin/datasets" element={<DatasetsPage />} />
          <Route path="/admin/designer" element={<DashboardDesignerPage />} />
          <Route path="/admin/designer/:id" element={<DashboardDesignerPage />} />
          <Route path="/admin/dashboards" element={<DashboardsAdminPage />} />
          <Route path="/admin/approvals" element={<ApprovalsPage />} />
          <Route path="/admin/audit" element={<AuditLogsPage />} />

          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
