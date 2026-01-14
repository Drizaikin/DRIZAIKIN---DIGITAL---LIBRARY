import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './AdminPanel';
import AdminHealthDashboard from './AdminHealthDashboard';

/**
 * AdminRoutes component defines nested routes for the admin section.
 * 
 * Routes:
 * - /admin (index) → AdminPanel component
 * - /admin/health → AdminHealthDashboard component
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      {/* /admin → AdminPanel (Requirement 2.1, 2.3) */}
      <Route index element={<AdminPanel />} />
      
      {/* /admin/health → AdminHealthDashboard (Requirement 2.2, 2.4) */}
      <Route path="health" element={<AdminHealthDashboard />} />
      
      {/* Redirect any unknown admin sub-routes to /admin */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

export default AdminRoutes;
