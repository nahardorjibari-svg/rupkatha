import React, { useEffect } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../lib/constants';
import { ROLE_LABELS } from '../lib/constants';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredModule?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredModule }) => {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#2BA5B5]/10 flex items-center justify-center mb-4">
          <div className="w-6 h-6 border-2 border-[#2BA5B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-600">Verifying factory credentials...</p>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdmin = profile?.role === 'admin';

  // For non-admins attempting to access any /admin/* route
  if (!isAdmin && location.pathname.startsWith('/admin')) {
    // Only redirect if they have at least one permission, otherwise they should go to dashboard
    const permissions = profile?.permissions || [];
    if (permissions.length > 0) {
      toast.error('You do not have permission to access administration pages.');
      // Special case: if they have sewing, send to sewing report
      if (permissions.includes('sewing')) {
        return <Navigate to="/sewing/report" replace />;
      }
      // Otherwise send to their first module (would need mapping, but for now /dashboard is safe fallback or first item)
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check role permissions if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role;
    const isAllowed = userRole && allowedRoles.includes(userRole);

    if (!isAllowed) {
      // For non-admins, redirect instead of showing the ShieldAlert page
      if (!isAdmin) {
        toast.error('Access restricted to administrators.');
        return <Navigate to="/dashboard" replace />;
      }

      const currentRoleLabel = userRole ? ROLE_LABELS[userRole]?.en || userRole : 'Operator';

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-soft-lg p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5 ring-8 ring-rose-50/50">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your profile (<strong className="font-semibold text-slate-800">{currentRoleLabel}</strong>) does not have permission to access this section.
            </p>

            <div className="space-y-3">
              <Link
                to="/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F8B8D] hover:bg-[#0b686a] rounded-xl transition-colors shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </Link>

              <button
                type="button"
                onClick={() => signOut()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Check required module permission if specified
  if (requiredModule && !isAdmin) {
    const permissions = profile?.permissions || [];
    if (!permissions.includes(requiredModule)) {
      toast.error(`You do not have access to the ${requiredModule} module.`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
