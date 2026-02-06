'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PlayersResponse {
  success: boolean;
  players?: string[];
  error?: string;
}

interface PlayerOption {
  player_id: number;
  player_name: string;
  name: string;
}

export default function TournamentPreRegisteredPlayers() {
  const params = useParams();
  const router = useRouter();
  const challongeId = params.challongeId as string;
  const [players, setPlayers] = useState<string[]>([]);
  const [playerOptions, setPlayerOptions] = useState<PlayerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const filteredOptions = useMemo(() => {
    const term = playerName.trim().toLowerCase();
    if (!term) return playerOptions;
    return playerOptions.filter((player) => player.player_name.toLowerCase().includes(term));
  }, [playerName, playerOptions]);

  const fetchPlayers = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/backend/login');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${challongeId}/players`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json() as PlayersResponse;

      if (!data.success) {
        setError(data.error || 'Failed to load pre-registered players');
        setPlayers([]);
      } else {
        setPlayers(Array.isArray(data.players) ? data.players : []);
      }
    } catch (err) {
      console.error('Error loading players:', err);
      setError('Failed to load pre-registered players');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (challongeId) {
      fetchPlayers();
    }
  }, [challongeId]);

  const fetchPlayerOptions = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/backend/login');
      return;
    }

    try {
      const response = await fetch('/api/players', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json() as { success: boolean; players?: PlayerOption[]; error?: string };

      if (data.success && Array.isArray(data.players)) {
        setPlayerOptions(data.players);
      } else {
        setPlayerOptions([]);
      }
    } catch (err) {
      console.error('Error loading player options:', err);
      setPlayerOptions([]);
    }
  };

  useEffect(() => {
    fetchPlayerOptions();
  }, []);

  const handleCopy = async () => {
    const text = sortedPlayers.join('\n');
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(text);
        setSuccess('Players copied to clipboard.');
        setTimeout(() => setSuccess(''), 2000);
        return;
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }

    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.setAttribute('readonly', '');
      temp.style.position = 'absolute';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      const success = document.execCommand('copy');
      document.body.removeChild(temp);
      if (!success) {
        throw new Error('execCommand failed');
      }
      setSuccess('Players copied to clipboard.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (fallbackError) {
      console.error('Clipboard fallback error:', fallbackError);
      setError('Failed to copy players');
    }
  };

  const handleAddPlayer = async () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;

    const isExisting = players.some((player) => player.toLowerCase() === trimmed.toLowerCase());
    if (isExisting) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/backend/login');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/tournaments/${challongeId}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ playerName: trimmed })
      });
      const data = await response.json() as PlayersResponse;

      if (!data.success) {
        setError(data.error || 'Failed to add player');
      } else {
        setPlayers(Array.isArray(data.players) ? data.players : []);
        setPlayerName('');
        setShowModal(false);
      }
    } catch (err) {
      console.error('Error adding player:', err);
      setError('Failed to add player');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Registered Players</h1>
              <p className="text-gray-600">Tournament: {challongeId}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                disabled={sortedPlayers.length === 0}
              >
                Copy Players
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Players</h2>
          </div>
          {isLoading ? (
            <div className="p-6 text-gray-500">Loading players...</div>
          ) : sortedPlayers.length === 0 ? (
            <div className="p-6 text-gray-500">No pre-registered players.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedPlayers.map((player) => (
                <li key={player} className="px-4 py-3 text-gray-800">
                  {player}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Player</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Player Name</label>
            <div className="relative">
              <input
                type="text"
                value={playerName}
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  setShowOptions(true);
                }}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 120)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter player name"
              />
              {showOptions && filteredOptions.length > 0 && (
                <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {filteredOptions.map((player) => (
                    <button
                      key={player.player_id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setPlayerName(player.player_name);
                        setShowOptions(false);
                      }}
                    >
                      {player.player_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {playerName.trim().length > 0 && players.some((player) => player.toLowerCase() === playerName.trim().toLowerCase()) && (
              <p className="text-xs text-red-600 mt-2">Player is already in the pre-registered list.</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-green-400"
                disabled={isSaving || playerName.trim().length === 0 || players.some((player) => player.toLowerCase() === playerName.trim().toLowerCase())}
              >
                {isSaving ? 'Adding...' : 'Join Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
