
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { JobProvider } from './contexts/JobContext';
import { Role } from './types';

import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SingleTabGuard from './components/auth/SingleTabGuard';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserDashboard from './pages/user/UserDashboard';
import PremiumDashboard from './pages/premium/PremiumDashboard';
import JobMonitorPage from './pages/admin/JobMonitorPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import SMTPManagementPage from './pages/admin/SMTPManagementPage';
import SystemLogsPage from './pages/admin/SystemLogsPage';

const AppRoutes: React.FC = () => {
    const { user } = useAuth();
  
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute allowedRoles={[Role.Admin]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        >
            <Route index element={<Navigate to="jobs" replace />} />
            <Route path="jobs" element={<JobMonitorPage />} />
            <Route path="users" element={<UserManagementPage />} />
            <Route path="smtp" element={<SMTPManagementPage />} />
            <Route path="logs" element={<SystemLogsPage />} />
        </Route>

        <Route 
          path="/premium" 
          element={
            <ProtectedRoute allowedRoles={[Role.Premium]}>
              <PremiumDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/user" 
          element={
            <ProtectedRoute allowedRoles={[Role.User]}>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/" 
          element={
            user ? (
              user.role === Role.Admin ? <Navigate to="/admin" /> :
              user.role === Role.Premium ? <Navigate to="/premium" /> :
              <Navigate to="/user" />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  };

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SingleTabGuard>
        <Router>
            <AuthProvider>
                <JobProvider>
                    <AppRoutes />
                </JobProvider>
            </AuthProvider>
        </Router>
      </SingleTabGuard>
    </ThemeProvider>
  );
};

export default App;
