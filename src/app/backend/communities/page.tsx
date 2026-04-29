'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendAuthAdmin } from '@/hooks/useBackendAuth';
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

export default function CommunitiesManagement() {
  const router = useRouter();
  const { user: authUser, isLoading: authLoading } = useBackendAuthAdmin();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Update current user when authUser changes
  useEffect(() => {
    setCurrentUser((authUser as unknown as User) || null);
  }, [authUser]);

  // Load communities after auth is verified
  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      router.push('/backend/login');
      return;
    }

    loadCommunities();
  }, [authUser, authLoading, router]);

  const loadCommunities = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
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
      console.error('Error loading communities:', error);
      setError('Failed to load communities');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCommunity = (community: Community) => {
    router.push(`/backend/communities/${community.community_id}`);
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
                onClick={() => router.push('/backend/communities/add')}
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