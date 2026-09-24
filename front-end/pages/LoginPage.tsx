import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircleIcon, UsersIcon, UserIcon, StarIcon } from '../components/icons/IconComponents';
import { Role } from '../types';

interface RoleButtonProps {
  role: Role;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: string;
  onClick: (role: Role) => void;
}

const RoleButton: React.FC<RoleButtonProps> = ({ role, label, icon: Icon, colorClasses, onClick }) => (
  <button
    onClick={() => onClick(role)}
    className={`group flex flex-col items-center justify-center w-full md:w-56 h-48 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 border-2 border-transparent ${colorClasses}`}
  >
    <div className="text-gray-500 dark:text-gray-400 group-hover:text-current transition-colors">
      <Icon className="w-16 h-16" />
    </div>
    <p className="mt-4 text-xl font-bold text-gray-700 dark:text-gray-200 group-hover:text-current transition-colors">{label}</p>
  </button>
);

const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // ✅ added password state
  const [error, setError] = useState('');
  const { login, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleCloseModal = () => {
    if (loading) return;
    setSelectedRole(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    try {
    const loggedInUser = await login(email, password);
    if (loggedInUser) {
      navigate(from, { replace: true });
    } else {
      setError('Invalid email or password');
    }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 py-8">
      <div className="text-center mb-10">
        <div className="flex justify-center items-center gap-2 mb-2">
          <CheckCircleIcon className="w-12 h-12 text-primary-500" />
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">VeriFast</h1>
        </div>
        <h2 className="text-2xl font-semibold text-gray-600 dark:text-gray-300">Choose your role to sign in</h2>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        <RoleButton
          role={Role.Admin}
          label="Admin"
          icon={UsersIcon}
          colorClasses="hover:border-red-500 hover:text-red-500 dark:hover:text-red-400"
          onClick={handleRoleSelect}
        />
        <RoleButton
          role={Role.Premium}
          label="Premium"
          icon={StarIcon}
          colorClasses="hover:border-yellow-500 hover:text-yellow-500 dark:hover:text-yellow-400"
          onClick={handleRoleSelect}
        />
        <RoleButton
          role={Role.User}
          label="User"
          icon={UserIcon}
          colorClasses="hover:border-green-500 hover:text-green-500 dark:hover:text-green-400"
          onClick={handleRoleSelect}
        />
      </div>

      {selectedRole && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300 animate-fade-in"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 m-4 transform animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
              Sign in as {selectedRole}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="sr-only">
                  Your Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading}
                  className="mt-3 group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default LoginPage;
