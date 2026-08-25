import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from '../common/LoadingSpinner';
import { isUserApproved } from '../../utils/isUserApproved';

export function RequireAuth() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireApprovedForChurchApp() {
  const { user, userLoaded } = useSelector((state) => state.auth);
  if (!userLoaded) return <LoadingSpinner />;
  if (!isUserApproved(user)) {
    return <Navigate to="/pending-approval" replace />;
  }
  return <Outlet />;
}
