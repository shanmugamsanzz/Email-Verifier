
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { ChartBarIcon, DocumentTextIcon, ServerIcon, UsersIcon } from '../../components/icons/IconComponents';

const adminNavLinks = [
  { to: '/admin/jobs', label: 'Job Monitor', icon: ChartBarIcon },
  { to: '/admin/users', label: 'User Management', icon: UsersIcon },
  { to: '/admin/smtp', label: 'SMTP Management', icon: ServerIcon },
  { to: '/admin/logs', label: 'System Logs', icon: DocumentTextIcon },
];

const AdminDashboard: React.FC = () => {
    const location = useLocation();
    const currentLink = adminNavLinks.find(link => location.pathname.startsWith(link.to));
    const pageTitle = currentLink ? currentLink.label : 'Admin Dashboard';

    return (
        <DashboardLayout navLinks={adminNavLinks} pageTitle={pageTitle}>
            <Outlet />
        </DashboardLayout>
    );
};

export default AdminDashboard;
