'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedTable, Column } from '@/components/EnhancedTable';

interface User {
  user_id: number;
  username: string;
  name?: string;
  user_role: string;
  community_id?: number;
}

interface Tournament {
  ch_id: number;
  to_id?: number;
  challonge_id: string;
  challonge_url: string;
  challonge_name: string;
  challonge_cover?: string;
  description?: string;
  tournament_date: string;
  active: boolean;
  total_stadium: number;
  assigned_judge_ids: string;
  community_names?: string;
  participant_count: number;
  organizer_username?: string;
  organizer_name?: string;
  community_name?: string;
  created_at: string;
  updated_at: string;
}

interface Judge {
  judge_id: number;
  username: string;
  judge_name?: string;
  community_ids: string;
}

interface TournamentForm {
  ch_id?: number;
  to_id?: number;
  challonge_id: string;
  challonge_url: string;
  challonge_name: string;
  challonge_cover: string;
  description: string;
  tournament_date: string;
  total_stadium: number;
  assigned_judge_ids: number[];
  active: boolean;
}

export default function TournamentsManagement() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<any>(null); // Keep for backward compatibility
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [syncToChallonge, setSyncToChallonge] = useState(true);
  const [originalChallongeId, setOriginalChallongeId] = useState<string>('');
  const [originalJudgeStadiumMap, setOriginalJudgeStadiumMap] = useState<{ [key: string]: number }>({});
  const router = useRouter();

  const [formData, setFormData] = useState<TournamentForm>({
    challonge_id: '',
    challonge_url: '',
    challonge_name: '',
    challonge_cover: '',
    description: '',
    tournament_date: '',
    total_stadium: 1,
    assigned_judge_ids: [],
    active: true,
    to_id: currentUser?.user_id
  });

  const fetchJudges = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/judges', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setJudges(data.judges);
      }
    } catch (error) {
      console.error('Error fetching judges:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const getUserDisplayName = (user: User): string => {
    // Find the user's community name from tournaments if available
    const userTournaments = tournaments.filter(t => t.to_id === user.user_id);
    if (userTournaments.length > 0 && userTournaments[0].community_name) {
      return `${userTournaments[0].community_name} | TO: ${user.name || user.username}`;
    }
    // Fallback to just the name/username
    return `TO: ${user.name || user.username}`;
  };

  useEffect(() => {
    checkAuthAndLoadTournaments();
    fetchJudges();
  }, []);

  useEffect(() => {
    if (currentUser?.user_role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const checkAuthAndLoadTournaments = async () => {
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

      setCurrentUser(authData.user);
      setUser(authData.user); // For backward compatibility

      // Load tournaments - show only current user's tournaments
      const tournamentsResponse = await fetch('/api/tournaments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const tournamentsData = await tournamentsResponse.json();

      if (tournamentsData.success && tournamentsData.tournaments) {
        setTournaments(tournamentsData.tournaments);
      } else if (tournamentsData.error && tournamentsData.error.includes('community')) {
        // User doesn't have a community - redirect to community setup
        router.push('/backend/community?redirect=tournaments');
        return;
      } else {
        setTournaments([]);
        setError('Failed to load tournaments: ' + (tournamentsData.error || 'Unknown error'));
      }

    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (tournament?: Tournament) => {
    if (tournament) {
      let assignedJudgeIds: number[] = [];
      let judgeStadiumMap: { [key: string]: number } = {};
      try {
        const parsed = JSON.parse(tournament.assigned_judge_ids);
        // If it's an object (judge_id -> stadium_number mapping), extract the keys and store the mapping
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          assignedJudgeIds = Object.keys(parsed).map(id => parseInt(id));
          judgeStadiumMap = parsed;
        } else if (Array.isArray(parsed)) {
          // If it's already an array, use it directly
          assignedJudgeIds = parsed;
          judgeStadiumMap = {};
        }
      } catch (e) {
        console.error('Error parsing assigned_judge_ids:', e);
        assignedJudgeIds = [];
        judgeStadiumMap = {};
      }
      
      setOriginalChallongeId(tournament.challonge_id);
      setOriginalJudgeStadiumMap(judgeStadiumMap);
      
      // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
      let dateTimeValue = '';
      if (tournament.tournament_date) {
        const date = new Date(tournament.tournament_date);
        // Format to YYYY-MM-DDTHH:mm for datetime-local input
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      
      setFormData({
        ch_id: tournament.ch_id,
        to_id: tournament.to_id,
        challonge_id: tournament.challonge_id,
        challonge_url: tournament.challonge_url,
        challonge_name: tournament.challonge_name,
        challonge_cover: tournament.challonge_cover || '',
        description: tournament.description || '',
        tournament_date: dateTimeValue,
        total_stadium: tournament.total_stadium,
        assigned_judge_ids: assignedJudgeIds,
        active: tournament.active
      });
      setIsEditing(true);
    } else {
      setOriginalChallongeId('');
      setOriginalJudgeStadiumMap({});
      setFormData({
        to_id: currentUser?.user_id,
        challonge_id: '',
        challonge_url: '',
        challonge_name: '',
        challonge_cover: '',
        description: '',
        tournament_date: '',
        total_stadium: 1,
        assigned_judge_ids: [],
        active: true
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
      challonge_id: '',
      challonge_url: '',
      challonge_name: '',
      challonge_cover: '',
      description: '',
      tournament_date: '',
      total_stadium: 1,
      assigned_judge_ids: [],
      active: true
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    // Validate required fields
    if (!formData.challonge_id || !formData.challonge_url || !formData.challonge_name || !formData.tournament_date) {
      setError('Please fill in all required fields');
      setIsSaving(false);
      return;
    }

    console.log('Submitting form data:', formData);

    const token = localStorage.getItem('authToken');

    try {
      const method = isEditing ? 'PUT' : 'POST';
      
      // Convert assigned_judge_ids array to object format {judge_id: stadium_number}
      const assignedJudgesObject: { [key: string]: number } = {};
      formData.assigned_judge_ids.forEach(judgeId => {
        const judgeIdStr = judgeId.toString();
        // If editing, preserve existing stadium assignment; otherwise set to 0 (unassigned)
        if (isEditing && originalJudgeStadiumMap[judgeIdStr] !== undefined) {
          assignedJudgesObject[judgeIdStr] = originalJudgeStadiumMap[judgeIdStr];
        } else {
          assignedJudgesObject[judgeIdStr] = 0;
        }
      });
      
      const submitData = {
        ...formData,
        assigned_judge_ids: assignedJudgesObject
      };
      
      const response = await fetch('/api/tournaments', {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      const data = await response.json();

      if (data.success) {
        // Sync to Challonge if checkbox is checked
        if (syncToChallonge) {
          await syncTournamentToChallonge(data.tournament, isEditing, originalChallongeId);
        }

        if (isEditing) {
          setTournaments(tournaments.map(tournament => 
            tournament.ch_id === formData.ch_id ? data.tournament : tournament
          ));
          setSuccess('Tournament updated successfully!');
        } else {
          setTournaments([data.tournament, ...tournaments]);
          setSuccess('Tournament created successfully!');
        }
        handleCloseModal();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save tournament');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tournamentId: number) => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('authToken');

    try {
      const response = await fetch(`/api/tournaments?ch_id=${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setTournaments(tournaments.filter(tournament => tournament.ch_id !== tournamentId));
        setSuccess('Tournament deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to delete tournament');
      }
    } catch (error) {
      setError('Network error');
    } finally {
      setIsSaving(false);
      setDeleteConfirm(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || 0
      }));
    } else {
      // Handle Challonge ID - auto-generate URL
      if (name === 'challonge_id') {
        const newUrl = `https://challonge.com/${value}`;
        setFormData(prev => ({
          ...prev,
          [name]: value,
          challonge_url: newUrl
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    }
  };

  const extractChallongeId = (url: string): string => {
    if (!url) return '';
    
    // Handle various Challonge URL formats:
    // https://challonge.com/fspg6zt9
    // challonge.com/fspg6zt9
    // https://challonge.com/username/fspg6zt9
    // etc.
    
    try {
      const urlObj = new URL(url.includes('://') ? url : 'https://' + url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/').filter(p => p);
      
      // Get the last part which is the tournament ID
      const extracted = parts[parts.length - 1] || '';
      console.log('Extracted Challonge ID:', { url, pathname, parts, extracted });
      return extracted;
    } catch (e) {
      // If URL parsing fails, try to extract the ID as the last path segment
      console.log('URL parsing failed, trying regex:', url);
      const match = url.match(/(?:^|\/\/|\/)([\w-]+)(?:\/$|$)/);
      const extracted = match ? match[1] : '';
      console.log('Regex extracted:', extracted);
      return extracted;
    }
  };

  const syncTournamentToChallonge = async (tournament: Tournament, isUpdate: boolean = false, oldChallongeId: string = '') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/challonge/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tournament: tournament,
          user_id: formData.to_id,
          isUpdate: isUpdate,
          oldChallongeId: oldChallongeId
        })
      });

      const data = await response.json();

      if (!data.success) {
        console.error('Challonge sync error:', data.error);
        setError(`Challonge sync failed: ${data.error || 'Unknown error'}`);
      } else {
        console.log('Successfully synced to Challonge');
      }
    } catch (error) {
      console.error('Challonge sync error:', error);
      setError('Failed to sync with Challonge');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setFormData(prev => ({
          ...prev,
          challonge_cover: data.imageUrl
        }));
        // Reset file input
        e.target.value = '';
      } else {
        setError(data.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Error uploading image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleJudgeSelection = (judgeId: number, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        assigned_judge_ids: [...prev.assigned_judge_ids, judgeId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        assigned_judge_ids: prev.assigned_judge_ids.filter(id => id !== judgeId)
      }));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAssignedJudgeNames = (assignedJudgeIds: string) => {
    try {
      const judgeIds = JSON.parse(assignedJudgeIds);
      const assignedJudges = judges.filter(judge => judgeIds.includes(judge.judge_id));
      return assignedJudges.map(judge => judge.judge_name || judge.username).join(', ') || 'None';
    } catch {
      return 'None';
    }
  };

  const handleEditTournament = (tournament: Tournament) => {
    handleOpenModal(tournament);
  };

  const handleDeleteTournament = (tournament: Tournament) => {
    setDeleteConfirm(tournament.ch_id);
  };

  const tournamentColumns: Column<Tournament>[] = [
    {
      key: 'challonge_name',
      label: 'Tournament',
      sortable: true,
      searchable: true,
      filterable: false,
      render: (_, tournament) => (
        <div className="flex items-center">
          {tournament.challonge_cover && (
            <img 
              src={tournament.challonge_cover} 
              alt={tournament.challonge_name}
              className="h-10 w-10 rounded-lg object-cover mr-3"
            />
          )}
          <div>
            <div className="text-sm font-medium text-gray-900">{tournament.challonge_name}</div>
            {tournament.description && (
              <div className="text-sm text-gray-500 truncate max-w-xs">{tournament.description}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'challonge_id',
      label: 'Challonge ID',
      sortable: true,
      searchable: true,
      filterable: false
    },
    {
      key: 'tournament_date',
      label: 'Date & Time',
      sortable: true,
      filterable: false,
      render: (date) => formatDate(date)
    },
    {
      key: 'active',
      label: 'Status',
      sortable: true,
      filterable: false,
      render: (active) => (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          active 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {active ? 'Active' : 'Inactive'}
        </span>
      )
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
                <h1 className="text-2xl font-bold text-gray-900">Tournaments Management</h1>
                <p className="text-gray-600">Manage your tournaments and Challonge integrations</p>
              </div>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Add Tournament
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

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Tournaments Table */}
        <EnhancedTable
          data={tournaments}
          columns={tournamentColumns}
          onEdit={handleEditTournament}
          onDelete={handleDeleteTournament}
          searchPlaceholder="Search tournaments by name, ID, or description..."
          emptyMessage="No tournaments found"
          customActions={(tournament) => (
            <div className="flex items-center space-x-2">
              <a
                href={`/backend/tournaments/${tournament.challonge_id}/stadium`}
                className="text-gray-600 hover:text-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                Stadiums
              </a>
              <a
                href={`/backend/tournaments/${tournament.challonge_id}/players`}
                className="text-gray-600 hover:text-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                Pre-Registered
              </a>
              <a
                href={`https://challonge.com/${tournament.challonge_id}/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                Settings
              </a>
            </div>
          )}
        />
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {isEditing ? 'Edit Tournament' : 'Create New Tournament'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Challonge API Section */}
                <div className="border-b-2 border-red-200 pb-4 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-900 mb-2">Challonge API Configuration</h3>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={syncToChallonge}
                        onChange={(e) => setSyncToChallonge(e.target.checked)}
                        className="rounded mt-1"
                        id="syncChallonge"
                      />
                      <label htmlFor="syncChallonge" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Sync this on Challonge
                      </label>
                    </div>
                    <p className="text-xs text-red-800 mt-3 leading-relaxed">
                      We are using Challonge API v1. Due to its limited access, the setup is currently configured to <strong>Group Stage: Round Robin</strong>, with tie Breakers Set to <strong>Wins vs Tied Participants &gt; Game/Set Wins &gt; Points Scored</strong>. Please configure this manually in the Challonge settings.
                    </p>
                  </div>
                </div>

                {currentUser?.user_role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organizer *
                    </label>
                    <select
                      name="to_id"
                      value={formData.to_id || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Organizer</option>
                      {users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {getUserDisplayName(user)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    name="challonge_name"
                    value={formData.challonge_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Challonge ID *
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-medium whitespace-nowrap">
                      https://challonge.com/
                    </span>
                    <input
                      type="text"
                      name="challonge_id"
                      value={formData.challonge_id}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-2 border-0 focus:ring-0 focus:outline-none"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter only the tournament ID (e.g., xzsysxtqgf)</p>
                </div>

                {/* Challonge URL - Hidden, auto-generated from ID */}
                <input
                  type="hidden"
                  name="challonge_url"
                  value={formData.challonge_url}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover Image
                  </label>
                  <div className="flex flex-col gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    {isUploadingImage && (
                      <p className="text-sm text-blue-600">Uploading image...</p>
                    )}
                    {formData.challonge_cover && (
                      <div className="flex items-center gap-3">
                        <img 
                          src={formData.challonge_cover}
                          alt="Cover preview"
                          className="h-20 w-20 rounded-lg object-cover border border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, challonge_cover: '' }))}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tournament Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      name="tournament_date"
                      value={formData.tournament_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Stadiums
                    </label>
                    <input
                      type="number"
                      name="total_stadium"
                      value={formData.total_stadium}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Judges
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {judges.length > 0 ? judges.map((judge) => (
                      <label key={judge.judge_id} className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.assigned_judge_ids.includes(judge.judge_id)}
                          onChange={(e) => handleJudgeSelection(judge.judge_id, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">{judge.judge_name || judge.username}</span>
                      </label>
                    )) : (
                      <p className="text-sm text-gray-500">No judges available</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Active Tournament
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                  >
                    {isSaving ? 'Saving...' : (isEditing ? 'Update' : 'Create')} Tournament
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this tournament? This action cannot be undone and will also delete all associated match data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors"
              >
                {isSaving ? 'Deleting...' : 'Delete Tournament'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}