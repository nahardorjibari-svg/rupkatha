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
import { AttendancePunch } from '../pages/attendance/AttendancePunch';
import { StaffInfo } from '../pages/hr/StaffInfo';
import { MonthlyAttendanceReport } from '../pages/hr/MonthlyAttendanceReport';
import { StaffMonthSheet } from '../pages/hr/StaffMonthSheet';
import { LinePlanPage } from '../pages/planning/LinePlanPage';
import { OrdersPage } from '../pages/merchandising/OrdersPage';
import { CostingPage } from '../pages/merchandising/CostingPage';
import { MaterialBookingPage } from '../pages/merchandising/MaterialBookingPage';
import { CuttingPage } from '../pages/production/CuttingPage';
import { QcPage } from '../pages/production/QcPage';
import { OutsideProcessPage } from '../pages/production/OutsideProcessPage';
import { AccountsPage } from '../pages/accounts/AccountsPage';
import { CommercialPage } from '../pages/commercial/CommercialPage';
import { ShipmentInvoicePage } from '../pages/commercial/ShipmentInvoicePage';
import { MerchandisingReportsPage } from '../pages/reports/MerchandisingReportsPage';
import { ManagementPnlPage } from '../pages/reports/ManagementPnlPage';
import { StoreDashboard } from '../pages/store/StoreDashboard';
import { StoreItemsPage } from '../pages/store/StoreItemsPage';
import { StoreGrnPage } from '../pages/store/StoreGrnPage';
import { StoreIssuePage } from '../pages/store/StoreIssuePage';
import { StoreLedgerPage } from '../pages/store/StoreLedgerPage';
import { StorePlaceholderPage } from '../pages/store/StorePlaceholderPage';
import { StoreProtectedRoute } from '../components/store/StoreProtectedRoute';
import { LineDashboardAll } from '../pages/linedash/LineDashboardAll';
import { LineDashboardBoard } from '../pages/linedash/LineDashboardBoard';
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

        {/* Merchandising & Planning Module Routes (Protected by requiredModule="merchandising") */}
        <Route path="/merchandising" element={<Navigate to="/merchandising/orders" replace />} />
        <Route
          path="/merchandising/orders"
          element={
            <ProtectedRoute
              requiredModule="merchandising"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/merchandising/costing"
          element={
            <ProtectedRoute
              requiredModule="merchandising"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <CostingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/merchandising/bookings"
          element={
            <ProtectedRoute
              requiredModule="merchandising"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <MaterialBookingPage />
            </ProtectedRoute>
          }
        />
        <Route path="/planning" element={<Navigate to="/planning/lineplan" replace />} />
        <Route path="/admin/planning" element={<Navigate to="/planning/lineplan" replace />} />
        <Route path="/admin/planning/lineplan" element={<Navigate to="/planning/lineplan" replace />} />
        <Route
          path="/planning/lineplan"
          element={
            <ProtectedRoute
              requiredModule="merchandising"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <LinePlanPage />
            </ProtectedRoute>
          }
        />

        {/* Cutting Production Module Route (Protected by requiredModule="cutting") */}
        <Route path="/admin/cutting" element={<Navigate to="/production/cutting" replace />} />
        <Route
          path="/production/cutting"
          element={
            <ProtectedRoute
              requiredModule="cutting"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <CuttingPage />
            </ProtectedRoute>
          }
        />

        {/* Quality Control (QC) Module Route (Protected by requiredModule="qc") */}
        <Route path="/admin/qc" element={<Navigate to="/production/qc" replace />} />
        <Route
          path="/production/qc"
          element={
            <ProtectedRoute
              requiredModule="qc"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <QcPage />
            </ProtectedRoute>
          }
        />

        {/* Outside Process (Washing, Printing, Embroidery) Module Route */}
        <Route path="/admin/washing" element={<Navigate to="/production/outside-process" replace />} />
        <Route
          path="/production/outside-process"
          element={
            <ProtectedRoute
              requiredModule="washing_print_emb"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <OutsideProcessPage />
            </ProtectedRoute>
          }
        />

        {/* Accounts & Actual Costing Module Route (Protected by requiredModule="accounts") */}
        <Route path="/admin/accounts" element={<Navigate to="/accounts" replace />} />
        <Route
          path="/accounts"
          element={
            <ProtectedRoute
              requiredModule="accounts"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <AccountsPage />
            </ProtectedRoute>
          }
        />

        {/* Commercial & LC Module Route (Protected by requiredModule="commercial") */}
        <Route path="/admin/commercial" element={<Navigate to="/commercial" replace />} />
        <Route
          path="/commercial"
          element={
            <ProtectedRoute
              requiredModule="commercial"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <CommercialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/commercial/shipments"
          element={
            <ProtectedRoute
              requiredModule="commercial"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <ShipmentInvoicePage />
            </ProtectedRoute>
          }
        />

        {/* Reports & Analytics Routes */}
        <Route
          path="/reports/merchandising"
          element={
            <ProtectedRoute
              requiredModule="merchandising_reports"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <MerchandisingReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/pnl"
          element={
            <ProtectedRoute
              requiredModule="management_pnl"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <ManagementPnlPage />
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

        {/* Line Dashboard Enterprise TV Boards (Protected by requiredModule="sewing") */}
        <Route path="/linedash" element={<Navigate to="/linedash/all" replace />} />
        <Route
          path="/linedash/all"
          element={
            <ProtectedRoute
              requiredModule="sewing"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <LineDashboardAll />
            </ProtectedRoute>
          }
        />
        <Route
          path="/linedash/:line"
          element={
            <ProtectedRoute
              requiredModule="sewing"
              deniedToastMessage="Access denied / আপনার এই পেইজে প্রবেশের অনুমতি নেই"
            >
              <LineDashboardBoard />
            </ProtectedRoute>
          }
        />

        {/* Finishing Module Redirects (Merged into Sewing) */}
        <Route path="/finishing" element={<Navigate to="/sewing/report" replace />} />
        <Route path="/finishing/*" element={<Navigate to="/sewing/report" replace />} />
        <Route path="/admin/finishing" element={<Navigate to="/sewing/report" replace />} />
        <Route path="/admin/finishing/*" element={<Navigate to="/sewing/report" replace />} />

        {/* Attendance Module Route (Protected by requiredModule="attendance") */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute requiredModule="attendance">
              <AttendancePunch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={<Navigate to="/attendance" replace />}
        />

        {/* HR & Payroll Module Routes (Protected by requiredModule="hr_payroll") */}
        <Route
          path="/hr"
          element={<Navigate to="/hr/staff" replace />}
        />
        <Route
          path="/admin/hr"
          element={<Navigate to="/hr/staff" replace />}
        />
        <Route
          path="/hr/staff"
          element={
            <ProtectedRoute requiredModule="hr_payroll">
              <StaffInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hr/staff"
          element={<Navigate to="/hr/staff" replace />}
        />
        <Route
          path="/hr/attendance"
          element={
            <ProtectedRoute requiredModule="hr_payroll">
              <MonthlyAttendanceReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hr/attendance"
          element={<Navigate to="/hr/attendance" replace />}
        />
        <Route
          path="/hr/attendance/:id"
          element={
            <ProtectedRoute requiredModule="hr_payroll">
              <StaffMonthSheet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hr/attendance/:id"
          element={<Navigate to="/hr/attendance/:id" replace />}
        />

        {/* Store & Inventory Module Routes (Role-based access via StoreProtectedRoute) */}
        <Route path="/store" element={<Navigate to="/store/dashboard" replace />} />
        <Route path="/admin/store" element={<Navigate to="/store/dashboard" replace />} />
        <Route
          path="/store/dashboard"
          element={
            <StoreProtectedRoute>
              <StoreDashboard />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/items"
          element={
            <StoreProtectedRoute>
              <StoreItemsPage />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/grn"
          element={
            <StoreProtectedRoute>
              <StoreGrnPage />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/issue"
          element={
            <StoreProtectedRoute>
              <StoreIssuePage />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/issues"
          element={
            <StoreProtectedRoute>
              <StoreIssuePage />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/transfer"
          element={
            <StoreProtectedRoute>
              <StorePlaceholderPage
                title="Stock Transfers"
                titleBn="স্টক স্থানান্তর"
                description="Inter-unit (Knit ↔ Woven) and warehouse transfer notes will be available in Part 2."
                descriptionBn="নিট ও উভেন ইউনিটের মধ্যে মালামাল স্থানান্তর মডিউল পরবর্তী ধাপে যুক্ত হবে।"
              />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/adjustment"
          element={
            <StoreProtectedRoute>
              <StorePlaceholderPage
                title="Stock Adjustments"
                titleBn="স্টক সমন্বয়"
                description="Physical inventory reconciliation and stock adjustment approvals will be available in Part 2."
                descriptionBn="ফিজিক্যাল ইনভেন্টরি অডিট ও স্টক সমন্বয় মডিউল পরবর্তী ধাপে যুক্ত হবে।"
              />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/ledger"
          element={
            <StoreProtectedRoute>
              <StoreLedgerPage />
            </StoreProtectedRoute>
          }
        />
        <Route
          path="/store/reports"
          element={
            <StoreProtectedRoute>
              <StorePlaceholderPage
                title="Store Reports"
                titleBn="স্টোর রিপোর্ট"
                description="Valuation, slow-moving stock, and supplier GRN analytics reports will be available in Part 2."
                descriptionBn="স্টক মূল্যায়ন ও সরবরাহকারী বিশ্লেষণ রিপোর্ট পরবর্তী ধাপে যুক্ত হবে।"
              />
            </StoreProtectedRoute>
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
