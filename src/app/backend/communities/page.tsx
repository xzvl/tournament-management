'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedTable, Column } from '@/components/EnhancedTable';

interface Community {
  community_id: number;
  name: string;
  short_name: string;
  location?: string;
  city?: string;
  province?: string;
  logo?: string;
  cover?: string;
  to_id?: number;
  organizer_username?: string;
  organizer_name?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  user_id: number;
  username: string;
  name: string;
  email: string;
  user_role: string;
  created_at: string;
}

interface CommunityForm {
  community_id?: number;
  name: string;
  short_name: string;
  location: string;
  city: string;
  province: string;
  to_id: number | '';
}

interface User {
  user_id: number;
  username: string;
  role: string;
  user_role: string;
}

export default function CommunitiesManagement() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState<CommunityForm>({
    name: '',
    short_name: '',
    location: '',
    city: '',
    province: '',
    to_id: ''
  });

  useEffect(() => {
    checkAuthAndLoadCommunities();
  }, []);

  const checkAuthAndLoadCommunities = async () => {
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
      if (authData.user.role !== 'admin' && authData.user.user_role !== 'admin') {
        router.push('/backend');
        return;
      }

      setCurrentUser(authData.user);
      await Promise.all([loadCommunities(), loadUsers()]);

    } catch (error) {
      console.error('Auth error:', error);
      router.push('/backend/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommunities = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/communities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setCommunities(data.communities || []);
      } else {
        setError('Failed to load communities: ' + data.error);
        setCommunities([]);
      }
    } catch (error) {
      setError('Network error loading communities');
      setCommunities([]);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      console.log('Loading users with token:', token ? 'present' : 'missing');
      
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('Users API response status:', response.status);
      const data = await response.json();
      console.log('Users API response data:', data);

      if (data.success) {
        setUsers(data.users || []);
        console.log('Users loaded:', data.users?.length || 0);
      } else {
        console.error('Failed to load users:', data.error);
        setUsers([]);
      }
    } catch (error) {
      console.error('Network error loading users:', error);
      setUsers([]);
    }
  };

  const handleEditCommunity = (community: Community) => {
    handleOpenModal(community);
  };

  const handleDeleteCommunity = (community: Community) => {
    setDeleteConfirm(community.community_id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const communityColumns: Column<Community>[] = [
    {
      key: 'name',
      label: 'Community',
      sortable: true,
      searchable: true,
      render: (_, community) => (
        <div className="flex items-center">
          {community.logo && (
            <img 
              src={community.logo} 
              alt={community.name}
              className="h-10 w-10 rounded-lg object-cover mr-3"
            />
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{community.name}</div>
            <div className="text-sm text-gray-500">{community.short_name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      searchable: true,
      render: (_, community) => {
        const locationParts = [community.city, community.province, community.location].filter(Boolean);
        return locationParts.join(', ') || '-';
      }
    },
    {
      key: 'organizer_name',
      label: 'Organizer',
      sortable: true,
      filterable: true,
      render: (_, community) => community.organizer_name || community.organizer_username || 'Not assigned'
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (date) => formatDate(date)
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'to_id' ? (value === '' ? '' : parseInt(value)) : value
    }));
  };

  const handleOpenModal = (community?: Community) => {
    if (community) {
      setFormData({
        community_id: community.community_id,
        name: community.name,
        short_name: community.short_name,
        location: community.location || '',
        city: community.city || '',
        province: community.province || '',
        to_id: community.to_id || ''
      });
      setIsEditing(true);
    } else {
      setFormData({
        name: '',
        short_name: '',
        location: '',
        city: '',
        province: '',
        to_id: ''
      });
      setIsEditing(false);
    }
    setShowModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setFormData({
      name: '',
      short_name: '',
      location: '',
      city: '',
      province: '',
      to_id: ''
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    // Basic validation
    if (!formData.name || !formData.short_name) {
      setError('Community name and short name are required');
      setIsSaving(false);
      return;
    }

    const token = localStorage.getItem('authToken');

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch('/api/communities', {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        if (isEditing) {
          setCommunities(communities.map(community => 
            community.community_id === formData.community_id ? data.community : community
          ));
          setSuccess('Community updated successfully!');
        } else {
          setCommunities([data.community, ...communities]);
          setSuccess('Community created successfully!');
        }
        handleCloseModal();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save community');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (communityId: number) => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/communities?community_id=${communityId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setCommunities(communities.filter(community => community.community_id !== communityId));
        setSuccess('Community deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete community');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin backend-spinner rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading communities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Communities Management</h1>
              <p className="text-gray-600 mt-1">Manage all communities in the system</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Community
              </button>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Communities Table */}
        <EnhancedTable
          data={communities}
          columns={communityColumns}
          onEdit={handleEditCommunity}
          onDelete={handleDeleteCommunity}
          searchPlaceholder="Search communities by name, location, or organizer..."
          emptyMessage="No communities found"
        />

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center pb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  {isEditing ? 'Edit Community' : 'Add New Community'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Community Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter community name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="short_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Short Name *
                    </label>
                    <input
                      type="text"
                      id="short_name"
                      name="short_name"
                      value={formData.short_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., CBW, CRE"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter city"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-1">
                      Province
                    </label>
                    <input
                      type="text"
                      id="province"
                      name="province"
                      value={formData.province}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter province"
                    />
                  </div>

                  <div>
                    <label htmlFor="to_id" className="block text-sm font-medium text-gray-700 mb-1">
                      Organizer {users && `(${users.length} available)`}
                    </label>
                    <select
                      id="to_id"
                      name="to_id"
                      value={formData.to_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select organizer...</option>
                      {users && users.length > 0 ? (
                        users.map((user) => (
                          <option key={user.user_id} value={user.user_id}>
                            {user.username} - {user.name} ({user.user_role})
                          </option>
                        ))
                      ) : (
                        <option disabled>Loading users...</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the user who will organize this community
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location Description
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Detailed location description"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : (isEditing ? 'Update Community' : 'Create Community')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <h3 className="text-lg font-medium text-gray-900">Delete Community</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this community? This action cannot be undone and may affect associated judges and tournaments.
                  </p>
                </div>
                <div className="flex justify-center space-x-3 mt-4">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}