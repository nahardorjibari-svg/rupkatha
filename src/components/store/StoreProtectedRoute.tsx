import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessStore } from '../../types/store';
import toast from 'react-hot-toast';

interface StoreProtectedRouteProps {
  children: React.ReactNode;
}

const DeniedRedirect: React.FC = () => {
  const notified = useRef(false);

  useEffect(() => {
    if (!notified.current) {
      notified.current = true;
      toast.error('Access denied: Store & Inventory is restricted to authorized roles.');
    }
  }, []);

  return <Navigate to="/dashboard" replace />;
};

export const StoreProtectedRoute: React.FC<StoreProtectedRouteProps> = ({ children }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B2E33] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#2BA5B5]/15 flex items-center justify-center mb-4">
          <div className="w-6 h-6 border-2 border-[#2BA5B5] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Verifying store access...
        </p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessStore(profile?.role, profile?.is_active)) {
    return <DeniedRedirect />;
  }

  return <>{children}</>;
};

export default StoreProtectedRoute;
