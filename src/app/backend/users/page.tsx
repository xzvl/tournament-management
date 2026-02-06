'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedTable, Column } from '@/components/EnhancedTable';

interface User {
  user_id: number;
  username: string;
  email: string;
  name: string;
  player_name?: string;
  challonge_username?: string;
  api_key?: string;
  user_role: 'admin' | 'tournament_organizer';
  created_at: string;
}

export default function UsersManagement() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: '',
    player_name: '',
    challonge_username: '',
    api_key: '',
    user_role: 'tournament_organizer' as 'admin' | 'tournament_organizer'
  });

  useEffect(() => {
    checkAuthAndLoadUsers();
  }, []);

  const checkAuthAndLoadUsers = async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      // Verify auth and get current user
      const authResponse = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const authData = await authResponse.json();

      if (!authData.success) {
        localStorage.removeItem('authToken');
        router.push('/backend/login');
        return;
      }

      // Check if user is admin
      if (authData.user.user_role !== 'admin') {
        router.push('/backend');
        return;
      }

      setCurrentUser(authData.user);

      // Load users
      const usersResponse = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const usersData = await usersResponse.json();

      if (usersData.success && usersData.users) {
        setUsers(usersData.users);
      } else {
        setUsers([]);
        setError('Failed to load users');
      }

    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setUsers([...users, data.user]);
        setShowCreateModal(false);
        resetForm();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.map(u => u.user_id === editingUser.user_id ? data.user : u));
        setEditingUser(null);
        resetForm();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setUsers(users.filter(u => u.user_id !== userId));
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      name: '',
      player_name: '',
      challonge_username: '',
      api_key: '',
      user_role: 'tournament_organizer'
    });
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      name: user.name,
      player_name: user.player_name || '',
      challonge_username: user.challonge_username || '',
      api_key: user.api_key || '',
      user_role: user.user_role
    });
  };

  const handleEditUser = (user: User) => {
    openEditModal(user);
  };

  const handleDeleteUserAction = (user: User) => {
    if (user.user_id !== currentUser?.user_id) {
      handleDeleteUser(user.user_id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const userColumns: Column<User>[] = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      searchable: true,
      render: (_, user) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          <div className="text-sm text-gray-500">@{user.username}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
          {user.player_name && (
            <div className="text-xs text-blue-600">Player: {user.player_name}</div>
          )}
        </div>
      )
    },
    {
      key: 'user_role',
      label: 'Role',
      sortable: true,
      filterable: true,
      render: (role) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          role === 'admin' 
            ? 'bg-red-100 text-red-800' 
            : 'bg-blue-100 text-blue-800'
        }`}>
          {role === 'tournament_organizer' ? 'Organizer' : 'Admin'}
        </span>
      )
    },
    {
      key: 'challonge_username',
      label: 'Challonge',
      sortable: true,
      filterable: true,
      render: (username) => username || 'Not set'
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date) => formatDate(date)
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin backend-spinner rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-gray-600">Manage system users (Admin Only)</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add New User
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        <EnhancedTable
          data={users}
          columns={userColumns}
          onEdit={handleEditUser}
          onDelete={handleDeleteUserAction}
          searchPlaceholder="Search users by name, username, or email..."
          emptyMessage="No users found"
        />
      </main>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              
              <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.player_name}
                    onChange={(e) => setFormData({...formData, player_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Challonge Username (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.challonge_username}
                    onChange={(e) => setFormData({...formData, challonge_username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Challonge API Key (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.api_key}
                    onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.user_role}
                    onChange={(e) => setFormData({...formData, user_role: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tournament_organizer">Tournament Organizer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingUser(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingUser ? 'Update' : 'Create'} User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}