'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Stadium {
  stadium_number: number;
  judge_id: number | null;
  judge_name: string;
  judge_username: string;
}

interface Judge {
  judge_id: number;
  username: string;
  judge_name?: string;
}

interface Tournament {
  ch_id: number;
  challonge_id: string;
  challonge_name: string;
  challonge_url: string;
  challonge_cover?: string;
  description?: string;
  tournament_date: string;
  total_stadium: number;
  assigned_judge_ids: string;
}

export default function StadiumManagement() {
  const router = useRouter();
  const params = useParams();
  const challongeId = params.challongeId as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [challongeId]);

  useEffect(() => {
    if (hasUnsavedChanges && tournament) {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      const timer = setTimeout(() => {
        handleSave();
      }, 1000);
      setAutoSaveTimer(timer);
    }
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [hasUnsavedChanges, tournament]);

  const checkAuthAndLoadData = async () => {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      // Verify auth
      const authResponse = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const authData = await authResponse.json();

      if (!authData.success) {
        localStorage.removeItem('authToken');
        router.push('/backend/login');
        return;
      }

      // Load tournament data first, then load judges
      await loadTournamentData(token);

    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTournamentData = async (token: string) => {
    const response = await fetch('/api/tournaments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      const tournamentData = data.tournaments.find(
        (t: Tournament) => t.challonge_id === challongeId
      );

      if (tournamentData) {
        setTournament(tournamentData);
        initializeStadiums(tournamentData);
        // Load judges after tournament is set
        await loadJudges(token, tournamentData);
      } else {
        setError('Tournament not found');
      }
    }
  };

  const loadJudges = async (token: string, tournamentData: Tournament) => {
    const response = await fetch('/api/judges', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success) {
      // Parse assigned_judge_ids to get the mapping
      let judgeStadiumMap: { [key: string]: number } = {};
      try {
        judgeStadiumMap = JSON.parse(tournamentData.assigned_judge_ids);
      } catch (e) {
        console.error('Error parsing assigned_judge_ids:', e);
        judgeStadiumMap = {};
      }
      
      // Get all judge IDs from the mapping
      const assignedJudgeIds = Object.keys(judgeStadiumMap).map(id => parseInt(id));
      
      // Only show judges that are assigned to this tournament
      const filteredJudges = data.judges.filter((judge: Judge) => 
        assignedJudgeIds.includes(judge.judge_id)
      );
      
      setJudges(filteredJudges);
      
      // Update stadium assignments with judge names
      setStadiums(prev => prev.map(stadium => {
        if (stadium.judge_id) {
          const judge = filteredJudges.find((j: Judge) => j.judge_id === stadium.judge_id);
          if (judge) {
            return {
              ...stadium,
              judge_name: judge.judge_name || '',
              judge_username: judge.username
            };
          }
        }
        return stadium;
      }));
    }
  };

  const initializeStadiums = (tournamentData: Tournament) => {
    const stadiumsArray: Stadium[] = [];
    
    // Parse the judge-to-stadium mapping
    let judgeStadiumMap: { [key: string]: number } = {};
    try {
      judgeStadiumMap = JSON.parse(tournamentData.assigned_judge_ids);
    } catch (e) {
      console.error('Error parsing assigned_judge_ids:', e);
      judgeStadiumMap = {};
    }
    
    // Create a reverse map: stadium_number -> judge info
    const stadiumJudgeMap: { [key: number]: { judge_id: number } } = {};
    Object.entries(judgeStadiumMap).forEach(([judgeId, stadiumNum]) => {
      stadiumJudgeMap[stadiumNum] = { judge_id: parseInt(judgeId) };
    });
    
    for (let i = 1; i <= tournamentData.total_stadium; i++) {
      const assignedJudge = stadiumJudgeMap[i];
      
      stadiumsArray.push({
        stadium_number: i,
        judge_id: assignedJudge ? assignedJudge.judge_id : null,
        judge_name: '',
        judge_username: ''
      });
    }

    setStadiums(stadiumsArray);
  };

  const handleJudgeAssignment = (stadiumNumber: number, judgeId: string) => {
    const selectedJudge = judges.find(j => j.judge_id.toString() === judgeId);
    
    setStadiums(prev => prev.map(stadium => {
      if (stadium.stadium_number === stadiumNumber) {
        return {
          ...stadium,
          judge_id: judgeId ? parseInt(judgeId) : null,
          judge_name: selectedJudge?.judge_name || '',
          judge_username: selectedJudge?.username || ''
        };
      }
      return stadium;
    }));
  };

  const handleDragStart = (e: React.DragEvent, judge: Judge) => {
    e.dataTransfer.setData('judge', JSON.stringify(judge));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, stadiumNumber: number) => {
    e.preventDefault();
    const judgeData = e.dataTransfer.getData('judge');
    
    if (judgeData) {
      const judge = JSON.parse(judgeData) as Judge;
      
      // Remove judge from any previous stadium and add to new stadium
      setStadiums(prev => prev.map(stadium => {
        if (stadium.judge_id === judge.judge_id) {
          return {
            ...stadium,
            judge_id: null,
            judge_name: '',
            judge_username: ''
          };
        }
        if (stadium.stadium_number === stadiumNumber) {
          return {
            ...stadium,
            judge_id: judge.judge_id,
            judge_name: judge.judge_name || '',
            judge_username: judge.username
          };
        }
        return stadium;
      }));
      setHasUnsavedChanges(true);
    }
  };

  const handleRemoveJudge = (stadiumNumber: number) => {
    setStadiums(prev => prev.map(stadium => {
      if (stadium.stadium_number === stadiumNumber) {
        return {
          ...stadium,
          judge_id: null,
          judge_name: '',
          judge_username: ''
        };
      }
      return stadium;
    }));
    setHasUnsavedChanges(true);
  };

  const isJudgeAssigned = (judgeId: number) => {
    return stadiums.some(s => s.judge_id === judgeId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');
    setHasUnsavedChanges(false);

    const token = localStorage.getItem('authToken');

    try {
      if (!tournament) {
        setError('Tournament data not loaded');
        setIsSaving(false);
        return;
      }

      // Create judge-to-stadium mapping
      const judgeStadiumMap: { [key: string]: number } = {};
      
      stadiums.forEach(stadium => {
        if (stadium.judge_id) {
          judgeStadiumMap[stadium.judge_id.toString()] = stadium.stadium_number;
        }
      });

      // Save the mapping to the database - send only the fields we want to update
      const response = await fetch('/api/tournaments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ch_id: tournament.ch_id,
          challonge_id: tournament.challonge_id,
          challonge_url: tournament.challonge_url || `https://challonge.com/${tournament.challonge_id}`,
          challonge_name: tournament.challonge_name,
          challonge_cover: tournament.challonge_cover || null,
          description: tournament.description || null,
          tournament_date: tournament.tournament_date,
          total_stadium: tournament.total_stadium,
          assigned_judge_ids: judgeStadiumMap,
          active: true
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Stadium assignments saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to save stadium assignments');
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Failed to save stadium assignments');
      setHasUnsavedChanges(true);
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

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h2>
        </div>
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
                <h1 className="text-2xl font-bold text-gray-900">Stadium Management</h1>
                <p className="text-gray-600">{tournament.challonge_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-amber-600 text-sm font-medium animate-pulse">Saving...</span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Now' : 'Saved'}
              </button>
            </div>
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

        {/* Stadium Grid */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Stadiums</h2>
            <p className="text-sm text-gray-600 mt-1">Drag and drop judges onto stadiums to assign them</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {stadiums.map((stadium) => (
              <div
                key={stadium.stadium_number}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stadium.stadium_number)}
                className={`
                  relative p-4 rounded-lg border-2 border-dashed transition-all cursor-pointer
                  ${stadium.judge_id 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 bg-gray-50 hover:border-red-400 hover:bg-red-50'
                  }
                `}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-2">
                    <span className="inline-flex items-center justify-center h-12 w-12 backend-rounded bg-red-600 text-white font-bold text-lg">
                      {stadium.stadium_number}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Stadium {stadium.stadium_number}</p>
                  
                  {stadium.judge_id ? (
                    <div className="mt-2">
                      <div
                        draggable
                        onDragStart={(e) => {
                          const judge = judges.find(j => j.judge_id === stadium.judge_id);
                          if (judge) {
                            handleDragStart(e, judge);
                          }
                        }}
                        className="bg-white rounded-lg p-2 shadow-sm border border-green-200 cursor-move hover:shadow-md transition-shadow"
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {stadium.judge_name || stadium.judge_username}
                        </p>
                        <button
                          onClick={() => handleRemoveJudge(stadium.stadium_number)}
                          className="backend-no-red mt-1 text-xs text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Drop judge here</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Available Judges */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Available Judges</h2>
            <p className="text-sm text-gray-600 mt-1">Drag judges to assign them to stadiums</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {judges.map((judge) => {
              const assigned = isJudgeAssigned(judge.judge_id);
              return (
                <div
                  key={judge.judge_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, judge)}
                  className={`
                    p-3 rounded-lg border-2 text-center transition-all
                    ${assigned 
                      ? 'border-green-300 bg-green-50 cursor-move hover:shadow-md' 
                      : 'border-red-300 bg-red-50 hover:bg-red-100 cursor-move hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 backend-rounded flex items-center justify-center text-white font-semibold mb-2 ${
                      assigned ? 'bg-red-600' : 'bg-red-600'
                    }`}>
                      {(judge.judge_name || judge.username).charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate w-full">
                      {judge.judge_name || judge.username}
                    </p>
                    {assigned && (
                      <span className="text-xs text-green-600 mt-1">Assigned</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {judges.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No judges available</p>
            </div>
          )}
        </div>

        {/* Stadium Setup Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tournament Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tournament ID</p>
              <p className="font-medium">{tournament.challonge_id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Stadiums</p>
              <p className="font-medium">{tournament.total_stadium}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Stadium Setup</h3>
              <p className="mt-1 text-sm text-red-700">
                Assigned: {stadiums.filter(s => s.judge_id).length} / {stadiums.length}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
