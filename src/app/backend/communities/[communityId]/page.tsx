'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface User {
  user_id: number;
  username: string;
  name: string;
  user_role: string;
}

interface CommunityForm {
  community_id?: number;
  name: string;
  short_name: string;
  location: string;
  city: string;
  province: string;
  to_id: string | '';
}

export default function EditCommunityPage() {
  const router = useRouter();
  const params = useParams();
  const communityId = Number(params.communityId);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<CommunityForm>({
    community_id: communityId,
    name: '',
    short_name: '',
    location: '',
    city: '',
    province: '',
    to_id: ''
  });

  useEffect(() => {
    checkAuthAndLoadCommunity();
  }, [communityId]);

  const checkAuthAndLoadCommunity = async () => {
    const token = localStorage.getItem('authToken');

    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      const authResponse = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const authData = await authResponse.json();

      if (!authData.success) {
        localStorage.removeItem('authToken');
        router.push('/backend/login');
        return;
      }

      if (authData.user.role !== 'admin' && authData.user.user_role !== 'admin') {
        router.push('/backend');
        return;
      }

      await Promise.all([loadUsers(token), loadCommunity(token)]);
    } catch (loadError) {
      console.error('Auth error:', loadError);
      router.push('/backend/login');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async (token: string) => {
    try {
      const response = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
      } else {
        setUsers([]);
      }
    } catch (loadError) {
      console.error('Network error loading users:', loadError);
      setUsers([]);
    }
  };

  const loadCommunity = async (token: string) => {
    if (!Number.isFinite(communityId)) {
      setError('Invalid community ID');
      return;
    }

    try {
      const response = await fetch(`/api/communities/${communityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success && data.community) {
        setFormData({
          community_id: data.community.community_id,
          name: data.community.name || '',
          short_name: data.community.short_name || '',
          location: data.community.location || '',
          city: data.community.city || '',
          province: data.community.province || '',
          to_id: data.community.to_id || ''
        });
      } else {
        setError(data.error || 'Failed to load community');
      }
    } catch (loadError) {
      console.error('Load community error:', loadError);
      setError('Network error');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    if (!formData.name || !formData.short_name) {
      setError('Community name and short name are required');
      setIsSaving(false);
      return;
    }

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch('/api/communities', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          community_id: communityId
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Community updated successfully!');
        setTimeout(() => router.push('/backend/communities'), 1200);
      } else {
        setError(data.error || 'Failed to update community');
      }
    } catch (saveError) {
      console.error('Save error:', saveError);
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin backend-spinner rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Community</h1>
              <p className="text-gray-600">Update the community details and organizer.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/backend/communities')}
              className="backend-no-red text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Communities
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Community Details</h2>
            <p className="text-gray-600 mt-1">Manage the community information.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Community Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Manila Beyblade Masters"
                  required
                />
              </div>

              <div>
                <label htmlFor="short_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Short Name/Abbreviation *
                </label>
                <input
                  type="text"
                  id="short_name"
                  name="short_name"
                  value={formData.short_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., MBM"
                  required
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SM Mall of Asia"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Manila"
                />
              </div>

              <div>
                <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">
                  Province/State
                </label>
                <input
                  type="text"
                  id="province"
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Metro Manila"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="to_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Organizer
                </label>
                <select
                  id="to_id"
                  name="to_id"
                  value={formData.to_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select organizer...</option>
                  {users.length > 0 ? (
                    users.map(user => (
                      <option key={user.user_id} value={String(user.user_id)}>
                        {user.username} - {user.name} ({user.user_role})
                      </option>
                    ))
                  ) : (
                    <option disabled>No users available</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select the user who will organize this community.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Update Community'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
