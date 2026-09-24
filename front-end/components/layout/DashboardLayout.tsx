import React, { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircleIcon, LogoutIcon, SunIcon, MoonIcon } from '../icons/IconComponents';
import { useTheme } from '../../contexts/ThemeContext';

interface NavLinkItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardLayoutProps {
  navLinks: NavLinkItem[];
  children: ReactNode;
  pageTitle: string;
}

const Sidebar: React.FC<{ navLinks: NavLinkItem[] }> = ({ navLinks }) => (
  <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 hidden md:flex md:flex-col">
    <div className="h-16 flex items-center justify-center border-b dark:border-gray-700 flex-shrink-0">
      <CheckCircleIcon className="w-8 h-8 text-primary-500" />
      <span className="ml-2 text-xl font-bold text-gray-800 dark:text-white">VeriFast</span>
    </div>
    <nav className="mt-5 flex-1">
      <ul>
        {navLinks.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to.split('/').length <= 2}
              className={({ isActive }) =>
                `flex items-center px-6 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ${
                  isActive ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 border-r-4 border-primary-500' : ''
                }`
              }
            >
              <link.icon className="w-5 h-5" />
              <span className="ml-4">{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  </aside>
);

const Header: React.FC<{ pageTitle: string }> = ({ pageTitle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex-shrink-0">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white">{pageTitle}</h1>
      <div className="flex items-center space-x-4">
        <span className="text-gray-600 dark:text-gray-300">
          Welcome, <span className="font-medium text-gray-800 dark:text-white">{user?.username}</span>
          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${user?.role === 'Admin' ? 'bg-red-100 text-red-800' : user?.role === 'Premium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{user?.role}</span>
        </span>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle dark and light mode"
        >
          {theme === 'dark' ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-gray-600" />}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          aria-label="Logout"
        >
          <LogoutIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

const Footer: React.FC = () => (
    <footer className="py-4 px-6 text-center text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <p>&copy; {new Date().getFullYear()} <strong>VeriFast</strong>. All rights reserved.</p>
    </footer>
);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ navLinks, children, pageTitle }) => {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <Sidebar navLinks={navLinks} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header pageTitle={pageTitle} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <div className="container mx-auto">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default DashboardLayout;