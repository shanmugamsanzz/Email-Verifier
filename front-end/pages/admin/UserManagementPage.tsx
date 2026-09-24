import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { User, Role } from '../../types';
import { UsersIcon, PlusIcon } from '../../components/icons/IconComponents';
import { useAuth } from '../../contexts/AuthContext';

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ username: '', email: '', role: Role.User, password: '', uploadLimit: 1000 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedUsers = await api.fetchUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setError(error instanceof Error ? error.message : 'Unable to load users.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    if (userId === currentUser?.id) {
      alert("You cannot change your own role.");
      return;
    }
    try {
      const updatedUser = await api.updateUserRole(userId, newRole);
      setUsers(users.map(u => (u.id === userId ? updatedUser : u)));
    } catch (error) {
      console.error("Failed to update user role:", error);
      setError(error instanceof Error ? error.message : 'Unable to update role.');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const addedUser = await api.addUser(newUser);
      setUsers(prevUsers => [addedUser, ...prevUsers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setShowAddModal(false);
      setNewUser({ username: '', email: '', role: Role.User, password: '', uploadLimit: 1000 });
    } catch (error) {
      console.error("Failed to add user:", error);
      setError(error instanceof Error ? error.message : 'Unable to add user.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser({ ...user });
    setEditPassword('');
    setError('');
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    setSaving(true);
    try {
      const { id, username, email, uploadLimit } = editingUser;
      const updatedUser = await api.updateUser({ id, username, email, uploadLimit, ...(editPassword ? { password: editPassword } : {}) });
      setUsers(users.map(u => (u.id === editingUser.id ? updatedUser : u)));
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Failed to update user:", error);
      setError(error instanceof Error ? error.message : 'Unable to update user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.deleteUser(userId);
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      } catch (error) {
        console.error("Failed to delete user:", error);
        setError(error instanceof Error ? error.message : 'Unable to delete user.');
      }
    }
  };
  

  const getRoleClass = (role: Role) => {
    switch (role) {
      case Role.Admin: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case Role.Premium: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case Role.User: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold flex items-center"><UsersIcon className="w-6 h-6 mr-2"/> User Management</h2>
          <button
            onClick={() => { setError(''); setShowAddModal(true); }}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center"
          >
            <PlusIcon className="w-5 h-5 mr-1" />
            Add User
          </button>
        </div>

        {error && !showAddModal && !showEditModal && <p role="alert" className="text-red-600">{error}</p>}
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Upload Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Member Since</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleClass(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{user.uploadLimit.toLocaleString()} emails</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleOpenEditModal(user)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200 mr-4">Edit</button>
                      {user.role !== Role.Admin && (
                        <button onClick={() => handleRoleChange(user.id, user.role === Role.User ? Role.Premium : Role.User)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 mr-4">
                          {user.role === Role.User ? 'Upgrade' : 'Downgrade'}
                        </button>
                      )}
                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200" disabled={user.id === currentUser?.id}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add New User</h3>
            <form onSubmit={handleAddUser}>
              {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}
              <div className="space-y-4">
                <label className="block text-sm">Password
                  <input type="password" autoComplete="new-password" minLength={8} maxLength={256} required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </label>
                <label className="block text-sm">Maximum emails per upload
                  <input type="number" min={1} max={10000} step={1} required value={newUser.uploadLimit} onChange={e => setNewUser({...newUser, uploadLimit: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </label>
                <input type="text" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                  <option value={Role.User}>User</option>
                  <option value={Role.Premium}>Premium</option>
                  <option value={Role.Admin}>Admin</option> 
                </select>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">{saving ? 'Saving...' : 'Add User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit User: {editingUser.username}</h3>
            <form onSubmit={handleUpdateUser}>
              {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}
              <div className="space-y-4">
                <label className="block text-sm">Maximum emails per upload
                  <input type="number" min={1} max={10000} step={1} required value={editingUser.uploadLimit} onChange={e => setEditingUser({...editingUser, uploadLimit: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </label>
                <label className="block text-sm">New password (optional)
                  <input type="password" autoComplete="new-password" minLength={8} maxLength={256} value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </label>
                <div>
                  <label htmlFor="edit-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                  <input id="edit-username" type="text" value={editingUser.username} onChange={e => setEditingUser(prev => prev ? { ...prev, username: e.target.value } : null)} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input id="edit-email" type="email" value={editingUser.email} onChange={e => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)} required className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagementPage;
