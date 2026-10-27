/**
 * Application Routes Configuration
 * Rupkatha Apparels Ltd. (src/routes/AppRoutes.tsx)
 */
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login';
import { AdminHome } from '../pages/AdminHome';
import { AdminSettings } from '../pages/AdminSettings';
import { Users } from '../pages/Users';
import { Dashboard } from '../pages/Dashboard';
import { SewingReportEntry } from '../pages/sewing/SewingReportEntry';
import { SewingDashboard } from '../pages/sewing/SewingDashboard';
import { SewingReports } from '../pages/sewing/SewingReports';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

export const AppRoutes: React.FC = () => {
  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#0f172a',
            fontSize: '13px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
            padding: '12px 16px',
            fontFamily: 'inherit',
          },
          success: {
            iconTheme: {
              primary: '#0F8B8D',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Admin Overview (Only 'admin' role) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Users Management (Only 'admin' role) */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Protected Admin Settings (Only 'admin' role) */}
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        {/* Sewing Module Routes (Protected by requiredModule="sewing") */}
        <Route
          path="/sewing"
          element={<Navigate to="/sewing/report" replace />}
        />
        <Route
          path="/sewing/report"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingReportEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sewing/report"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingReportEntry />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sewing/dashboard"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sewing/dashboard"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sewing/reports"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sewing/reports"
          element={
            <ProtectedRoute requiredModule="sewing">
              <SewingReports />
            </ProtectedRoute>
          }
        />

        {/* Protected Dashboard Route (All active authenticated factory staff) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Root Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default AppRoutes;
