'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendAuth } from '@/hooks/useBackendAuth';
import { EnhancedTable, Column } from '@/components/EnhancedTable';

interface User {
  user_id: number;
  username: string;
  user_role: string;
}

interface Judge {
  judge_id: number;
  username: string;
  judge_name?: string;
  password?: string;
  community_ids: string;
  community_names?: string;
  created_at: string;
  updated_at: string;
}

interface Community {
  community_id: number;
  name: string;
  short_name?: string;
  location?: string;
  city?: string;
  province?: string;
  created_at: string;
}

interface JudgeForm {
  judge_id?: number;
  username: string;
  password: string;
  judge_name: string;
  community_ids: number[];
}

export default function JudgesManagement() {
  const router = useRouter();
  const { user: authUser, isLoading: authLoading } = useBackendAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrJudge, setQrJudge] = useState<Judge | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrPassword, setQrPassword] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

  const [formData, setFormData] = useState<JudgeForm>({
    username: '',
    password: '',
    judge_name: '',
    community_ids: []
  });

  // Update current user when authUser changes
  useEffect(() => {
    setCurrentUser((authUser as unknown as User) || null);
  }, [authUser]);

  // Load judges and communities in parallel after auth is verified
  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      router.push('/backend/login');
      return;
    }

    loadJudgesAndCommunities();
  }, [authUser, authLoading, router]);

  const loadJudgesAndCommunities = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      // Fetch judges and communities in parallel
      const [judgesRes, communitiesRes] = await Promise.all([
        fetch('/api/judges', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/communities', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const judgesData = await judgesRes.json();
      const communitiesData = await communitiesRes.json();

      if (judgesData.success) {
        setJudges(judgesData.judges);
      }

      if (communitiesData.success) {
        setCommunities(communitiesData.communities);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const generateQr = async () => {
      if (!showQrModal) return;
      setQrLoading(true);
      setQrError('');

      try {
        const response = await fetch('/api/qr/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            judge: {
              judge_id: qrJudge?.judge_id,
              username: qrJudge?.username || '',
              name: qrJudge?.judge_name || ''
            }
          })
        });

        const data = await response.json();
        if (data.success && data.dataUrl) {
          setQrDataUrl(data.dataUrl);
          setQrToken(data.token || null);
          setQrPassword(data.password || null);
        } else {
          setQrError(data.error || 'Failed to generate QR code.');
          setQrDataUrl(null);
          setQrToken(null);
          setQrPassword(null);
        }
      } catch (error) {
        setQrError('Failed to generate QR code.');
        setQrDataUrl(null);
        setQrToken(null);
        setQrPassword(null);
      } finally {
        setQrLoading(false);
      }
    };

    generateQr();
  }, [showQrModal, qrJudge]);

  const handleOpenModal = (judge?: Judge) => {
    if (judge) {
      let communityIds: number[] = [];
      try {
        // Ensure judge.community_ids is a string before processing
        if (typeof judge.community_ids === 'string') {
          // Parse JSON array or handle comma-separated format
          if (judge.community_ids.startsWith('[')) {
            communityIds = JSON.parse(judge.community_ids);
          } else {
            communityIds = judge.community_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        } else if (Array.isArray(judge.community_ids)) {
          // If it's already an array, use it directly
          communityIds = judge.community_ids;
        } else {
          console.warn('Unexpected type for community_ids:', typeof judge.community_ids);
        }
      } catch (e) {
        console.error('Error parsing community_ids:', e);
        // Fallback to treating as an empty array
        communityIds = [];
      }
      
      setFormData({
        judge_id: judge.judge_id,
        username: judge.username,
        password: '', // Don't pre-fill password for security
        judge_name: judge.judge_name || '',
        community_ids: communityIds
      });
      setIsEditing(true);
    } else {
      setFormData({
        username: '',
        password: '',
        judge_name: '',
        community_ids: currentUser?.user_role === 'admin' ? [] : []
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
      username: '', 
      password: '', 
      judge_name: '', 
      community_ids: currentUser?.user_role === 'admin' ? [] : []
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    // Validate communities for admin users
    if (currentUser?.user_role === 'admin' && formData.community_ids.length === 0) {
      setError('Please select at least one community for the judge');
      setIsSaving(false);
      return;
    }

    const token = localStorage.getItem('authToken');

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch('/api/judges', {
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
          setJudges(judges.map(judge => 
            judge.judge_id === formData.judge_id ? data.judge : judge
          ));
          setSuccess('Judge updated successfully!');
        } else {
          setJudges([data.judge, ...judges]);
          setSuccess('Judge created successfully!');
        }
        handleCloseModal();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save judge');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (judgeId: number) => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/judges?judge_id=${judgeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setJudges(judges.filter(judge => judge.judge_id !== judgeId));
        setSuccess('Judge deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete judge');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
      setDeleteConfirm(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCommunityNames = (communityIds: string) => {
    try {
      const ids = JSON.parse(communityIds);
      const assignedCommunities = communities.filter(community => ids.includes(community.community_id));
      return assignedCommunities.map(community => community.name).join(', ') || 'None';
    } catch {
      return 'None';
    }
  };

  const handleEditJudge = (judge: Judge) => {
    handleOpenModal(judge);
  };

  const handleDeleteJudge = (judge: Judge) => {
    setDeleteConfirm(judge.judge_id);
  };

  const handleOpenQr = (judge: Judge) => {
    setQrJudge(judge);
    setQrDataUrl(null);
    setQrToken(null);
    setQrPassword(null);
    setQrError('');
    setShowQrModal(true);
  };

  const handleCloseQr = () => {
    setShowQrModal(false);
    setQrJudge(null);
    setQrDataUrl(null);
    setQrToken(null);
    setQrPassword(null);
    setQrError('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const judgeColumns: Column<Judge>[] = [
    {
      key: 'username',
      label: 'Judge',
      sortable: true,
      searchable: true,
      filterable: false,
      render: (_, judge) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{judge.judge_name || judge.username}</div>
          <div className="text-sm text-gray-500">@{judge.username}</div>
        </div>
      )
    },
    {
      key: 'community_ids',
      label: 'Communities',
      sortable: false,
      searchable: true,
      getFilterValues: (judges) => {
        // Extract all unique community names from judges
        const communityNames = new Set<string>();
        judges.forEach(judge => {
          try {
            const ids = JSON.parse(judge.community_ids);
            const assignedCommunities = communities.filter(community => ids.includes(community.community_id));
            assignedCommunities.forEach(community => {
              communityNames.add(community.name);
            });
          } catch {
            // Ignore parse errors
          }
        });
        return Array.from(communityNames).sort();
      },
      filterValue: (judge, filterValue) => {
        // Check if the judge belongs to the selected community
        try {
          const ids = JSON.parse(judge.community_ids);
          const assignedCommunities = communities.filter(community => ids.includes(community.community_id));
          return assignedCommunities.some(community => community.name.toLowerCase() === filterValue.toLowerCase());
        } catch {
          return false;
        }
      },
      render: (communityIds) => (
        <div className="text-sm text-gray-500">
          {getCommunityNames(communityIds)}
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      filterable: false,
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
                <h1 className="text-2xl font-bold text-gray-900">Judges Management</h1>
                <p className="text-gray-600">Manage judges for your community</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Add Judge
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
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

        {/* Judges Table */}
        <EnhancedTable
          data={judges}
          columns={judgeColumns}
          onEdit={handleEditJudge}
          onDelete={handleDeleteJudge}
          customActions={(judge) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenQr(judge);
              }}
              className="backend-no-red text-indigo-600 hover:text-indigo-900"
            >
              QR Code
            </button>
          )}
          searchPlaceholder="Search judges by username or name..."
          emptyMessage="No judges found"
        />
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isEditing ? 'Edit Judge' : 'Add New Judge'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter judge username"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="judge_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Judge Name
                </label>
                <input
                  type="text"
                  id="judge_name"
                  name="judge_name"
                  value={formData.judge_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter judge's display name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Display name for the judge (optional)
                </p>
              </div>
              
              {currentUser?.user_role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Communities *
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-2">
                    {communities.map((community) => (
                      <label key={community.community_id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={formData.community_ids.includes(community.community_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                community_ids: [...prev.community_ids, community.community_id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                community_ids: prev.community_ids.filter(id => id !== community.community_id)
                              }));
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{community.name}</div>
                          {community.short_name && (
                            <div className="text-xs text-gray-500">({community.short_name})</div>
                          )}
                          {(community.city || community.province) && (
                            <div className="text-xs text-gray-500">
                              {[community.city, community.province].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select which communities this judge can access
                  </p>
                </div>
              )}
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {isEditing ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isEditing ? "Enter new password" : "Enter password"}
                  required={!isEditing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used for judge login access
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Remove
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this judge from your community? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Judge QR Code
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Generate a QR code for {qrJudge?.judge_name || qrJudge?.username}.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-center min-h-[200px] border border-dashed border-gray-300 rounded-lg">
                {qrLoading ? (
                  <div className="animate-spin backend-spinner rounded-full h-10 w-10 border-b-2 border-red-600"></div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="Judge QR Code" className="h-48 w-48" />
                ) : (
                  <p className="text-sm text-gray-500">Generating QR code...</p>
                )}
              </div>

              {qrDataUrl && (
                <div className="text-sm text-gray-700 space-y-1">
                  <div className="font-semibold">Scan to Auto-Login:</div>
                  <div>Username: <span className="font-medium">{qrJudge?.username}</span></div>
                  <div>Password: <span className="font-medium break-all">{qrPassword || 'Loading...'}</span></div>
                  <div className="text-xs text-gray-500">
                    This QR code will automatically log you in as a judge. Token expires in 24 hours.
                  </div>
                </div>
              )}

              {qrError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {qrError}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCloseQr}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`judge-qr-${qrJudge?.username || 'login'}.png`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}