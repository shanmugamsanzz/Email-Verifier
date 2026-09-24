
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { SMTPAccount } from '../../types';
import { ServerIcon } from '../../components/icons/IconComponents';

const SMTPManagementPage: React.FC = () => {
  const [accounts, setAccounts] = useState<SMTPAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({ email: '', host: '', port: 587 });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedAccounts = await api.fetchSmtpAccounts();
      setAccounts(fetchedAccounts);
    } catch (error) {
      console.error("Failed to fetch SMTP accounts:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.addSmtpAccount(newAccount);
    setNewAccount({ email: '', host: '', port: 587 });
    setShowAddForm(false);
    fetchAccounts();
  };
  
  const handleDeleteAccount = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this SMTP account?')) {
        await api.deleteSmtpAccount(id);
        // FIX: Called the correct fetch function to refresh the SMTP account list.
        fetchAccounts();
    }
  };

  const getStatusClass = (status: 'Active' | 'Failed') => {
    return status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center"><ServerIcon className="w-6 h-6 mr-2"/> SMTP Account Management</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          {showAddForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddAccount} className="p-4 border rounded-lg dark:border-gray-700 space-y-3">
          <h3 className="font-semibold">New SMTP Account</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="email" placeholder="Email" value={newAccount.email} onChange={e => setNewAccount({...newAccount, email: e.target.value})} required className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
            <input type="text" placeholder="SMTP Host" value={newAccount.host} onChange={e => setNewAccount({...newAccount, host: e.target.value})} required className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
            <input type="number" placeholder="Port" value={newAccount.port} onChange={e => setNewAccount({...newAccount, port: parseInt(e.target.value)})} required className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
          </div>
          <button type="submit" className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Save Account</button>
        </form>
      )}

      {loading ? (
        <p>Loading accounts...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Port</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{acc.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{acc.host}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{acc.port}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(acc.status)}`}>
                      {acc.status}
                    </span>
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                     <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-4">Edit</button>
                     <button onClick={() => handleDeleteAccount(acc.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">Delete</button>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SMTPManagementPage;