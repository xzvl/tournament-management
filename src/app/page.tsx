"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Tournament {
  ch_id: number;
  challonge_id: string;
  challonge_name: string;
  challonge_cover?: string;
  tournament_date: string;
  active: boolean;
  community_name?: string;
  organizer_name?: string;
  description?: string;
}

interface Community {
  community_id: number;
  name: string;
  short_name: string;
  location: string;
  city: string;
  province: string;
  logo?: string;
  to_id?: number;
  organizer_username?: string;
  organizer_name?: string;
}

interface PlayerOption {
  player_id: number;
  player_name: string;
  name: string;
}

export default function HomePage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [communitiesLoading, setCommunitiesLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  
  // Province and community filter states
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [provinceSearchTerm, setProvinceSearchTerm] = useState('');
  const [communitySearchTerm, setCommunitySearchTerm] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showCommunityDropdown, setShowCommunityDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playerOptions, setPlayerOptions] = useState<PlayerOption[]>([]);
  const [showPreRegisterModal, setShowPreRegisterModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [preRegisteredPlayers, setPreRegisteredPlayers] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [fullName, setFullName] = useState('');
  const [isKnownPlayer, setIsKnownPlayer] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showCommunitySelect, setShowCommunitySelect] = useState(false);
  const [preRegisterMessage, setPreRegisterMessage] = useState('');
  const [preRegisterError, setPreRegisterError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinResult, setShowJoinResult] = useState(false);
  const [joinResultMessage, setJoinResultMessage] = useState('');
  const [joinResultIsError, setJoinResultIsError] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/tournaments?showAll=true', {
          headers
        });

        const data = await response.json();
        if (data.success) {
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() - 14);
          const end = new Date(now);
          end.setMonth(end.getMonth() + 1);

          const filtered = (data.tournaments || []).filter((tournament: Tournament) => {
            if (!tournament.active || !tournament.tournament_date) return false;
            const tournamentDate = new Date(tournament.tournament_date);
            return tournamentDate >= start && tournamentDate <= end;
          });

          setTournaments(filtered);
        } else {
          setError(data.error || 'Failed to load tournaments');
        }
      } catch (e) {
        setError('Failed to load tournaments');
      } finally {
        setIsLoading(false);
      }
    };

    loadTournaments();
  }, []);

  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/communities', {
          headers
        });

        const data = await response.json();
        if (data.success) {
          setCommunities(data.communities || []);
        }
      } catch (e) {
        console.error('Failed to load communities');
      } finally {
        setCommunitiesLoading(false);
      }
    };

    loadCommunities();
  }, []);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        const data = await response.json();
        if (data.success && Array.isArray(data.players)) {
          setPlayerOptions(data.players);
        }
      } catch (e) {
        console.error('Failed to load players');
      }
    };

    loadPlayers();
  }, []);

  useEffect(() => {
    if (!showJoinResult) return;
    const timer = setTimeout(() => setShowJoinResult(false), 1500);
    return () => clearTimeout(timer);
  }, [showJoinResult]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  const isTournamentLive = (dateString: string) => {
    const start = new Date(dateString);
    return new Date() >= start;
  };

  const filteredPlayerOptions = useMemo(() => {
    const term = playerName.trim().toLowerCase();
    if (!term) return playerOptions;
    return playerOptions.filter((player) => player.player_name.toLowerCase().includes(term));
  }, [playerName, playerOptions]);

  const filteredCommunityOptions = useMemo(() => {
    const term = communityName.trim().toLowerCase();
    if (!term) return communities;
    return communities.filter((community) => community.name.toLowerCase().includes(term));
  }, [communityName, communities]);

  const openPreRegister = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setPlayerName('');
    setFullName('');
    setIsKnownPlayer(false);
    setCommunityName('');
    setSelectedCommunityId(null);
    setPreRegisterMessage('');
    setPreRegisterError('');
    setShowPlayerDropdown(false);
    setShowCommunitySelect(false);
    setShowPreRegisterModal(true);

    try {
      const response = await fetch(`/api/tournaments/${tournament.challonge_id}/pre-register`);
      const data = await response.json();
      if (data.success && Array.isArray(data.players)) {
        setPreRegisteredPlayers(data.players);
      } else {
        setPreRegisteredPlayers([]);
      }
    } catch (e) {
      setPreRegisteredPlayers([]);
    }
  };

  const handleSelectPlayer = (player: PlayerOption) => {
    setPlayerName(player.player_name);
    setFullName(player.name || '');
    setIsKnownPlayer(true);
    setShowPlayerDropdown(false);
  };

  const handleJoinTournament = async () => {
    if (!selectedTournament) return;
    const trimmed = playerName.trim();
    if (!trimmed) {
      setPreRegisterError('Player Name is required');
      return;
    }

    setIsJoining(true);
    setPreRegisterError('');
    setPreRegisterMessage('');

    try {
      const response = await fetch(`/api/tournaments/${selectedTournament.challonge_id}/pre-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: trimmed,
          fullName,
          communityName: communityName.trim(),
          communityId: selectedCommunityId
        })
      });
      const data = await response.json();

      if (data.success) {
        const alreadyJoined = Boolean(data.alreadyJoined);
        setJoinResultMessage(alreadyJoined ? 'Player is already Join' : 'Successfully Join the tournament');
        setJoinResultIsError(alreadyJoined);
        setShowJoinResult(true);
        if (!alreadyJoined) {
          setPreRegisteredPlayers((prev) => [...prev, trimmed]);
        }
        setShowPreRegisterModal(false);
      } else {
        setJoinResultMessage(data.error || 'Failed to join the tournament');
        setJoinResultIsError(true);
        setShowJoinResult(true);
        setShowPreRegisterModal(false);
      }
    } catch (e) {
      setJoinResultMessage('Failed to join the tournament');
      setJoinResultIsError(true);
      setShowJoinResult(true);
      setShowPreRegisterModal(false);
    } finally {
      setIsJoining(false);
    }
  };

  const handleRemovePreRegister = async () => {
    if (!selectedTournament) return;
    const trimmed = playerName.trim();
    if (!trimmed) return;
    setShowRemoveConfirm(true);
  };

  const confirmRemovePreRegister = async () => {
    if (!selectedTournament) return;
    const trimmed = playerName.trim();
    if (!trimmed) return;

    setIsRemoving(true);

    try {
      const response = await fetch(`/api/tournaments/${selectedTournament.challonge_id}/pre-register`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: trimmed })
      });
      const data = await response.json();

      if (data.success) {
        setPreRegisteredPlayers((prev) =>
          prev.filter((player) => player.toLowerCase() !== trimmed.toLowerCase())
        );
      }
    } catch (e) {
      console.error('Failed to remove pre-register');
    } finally {
      setIsRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  const filteredTournaments = useMemo(() => {
    const now = new Date();
    let filtered = tournaments;

    if (activeFilter === 'upcoming') {
      filtered = filtered.filter(tournament => {
        const tournamentDate = new Date(tournament.tournament_date);
        return tournamentDate >= now;
      });
    } else if (activeFilter === 'recent') {
      filtered = filtered.filter(tournament => {
        const tournamentDate = new Date(tournament.tournament_date);
        return tournamentDate < now;
      });
    }

    if (selectedCommunity) {
      filtered = filtered.filter(tournament => 
        tournament.community_name === selectedCommunity.name
      );
    } else if (selectedProvince) {
      const provinceCommunities = communities
        .filter(c => c.province === selectedProvince)
        .map(c => c.name);
      filtered = filtered.filter(tournament => 
        tournament.community_name && provinceCommunities.includes(tournament.community_name)
      );
    }

    return filtered;
  }, [tournaments, activeFilter, selectedCommunity, selectedProvince, communities]);

  const filteredCommunities = useMemo(() => {
    let filtered = communities;
    
    // Filter by province if selected
    if (selectedProvince) {
      filtered = filtered.filter(c => c.province === selectedProvince);
    }
    
    // Filter by specific community if selected
    if (selectedCommunity) {
      filtered = filtered.filter(c => c.community_id === selectedCommunity.community_id);
    }
    
    return filtered;
  }, [communities, selectedProvince, selectedCommunity]);

  return (
    <>
      <main className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top has-sticky-footer bg-no-repeat p-4 sm:p-6 lg:p-8 pb-24 text-white">
      <div className="max-w-6xl mx-auto">
        <section className="mb-12 sm:mb-16">
          <div className="flex flex-col items-center text-center gap-4">
            <img
              src="/assets/logo.webp"
              alt="Beyblade Tournament Management"
              className="h-40 w-auto sm:h-56"
            />
          </div>
        </section>
        <section className="mb-8 sm:mb-10">
          <div className="flex flex-col items-center text-center gap-4">
            <span className="text-sm sm:text-base uppercase tracking-[0.25em] text-white font-bold">
              Beyblade X
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white">
              COMMUNITY <span className="text-red-500">TOURNAMENTS</span>
            </h2>
            <p className="max-w-lg text-sm sm:text-base text-white/80">
              Discover upcoming events, review recent results, and jump into your next competition in seconds.
            </p>
          </div>
        </section>

        <div className="shadow-sm">
          <div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold uppercase tracking-wider">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`relative px-6 py-3 transition ${
                  activeFilter === 'all' 
                    ? 'text-white tab-active' 
                    : 'text-white/60 hover:text-white/90 tab-inactive'
                }`}
              >
                <span className="relative z-10">Show All</span>
              </button>
              <button 
                onClick={() => setActiveFilter('upcoming')}
                className={`relative px-6 py-3 transition ${
                  activeFilter === 'upcoming' 
                    ? 'text-white tab-active' 
                    : 'text-white/60 hover:text-white/90 tab-inactive'
                }`}
              >
                <span className="relative z-10">Upcoming</span>
              </button>
              <button 
                onClick={() => setActiveFilter('recent')}
                className={`relative px-6 py-3 transition ${
                  activeFilter === 'recent' 
                    ? 'text-white tab-active' 
                    : 'text-white/60 hover:text-white/90 tab-inactive'
                }`}
              >
                <span className="relative z-10">Recent</span>
              </button>
              
              <div className="w-px h-8 bg-white/20 mx-2"></div>
              
              {/* Province Dropdown */}
              {mounted && (
              <div className="relative">
                <input
                  type="text"
                  value={provinceSearchTerm || selectedProvince}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProvinceSearchTerm(value);
                    // If field is cleared, clear the selection
                    if (value === '') {
                      setSelectedProvince('');
                      setSelectedCommunity(null);
                      setCommunitySearchTerm('');
                    }
                    setShowProvinceDropdown(true);
                  }}
                  onFocus={() => setShowProvinceDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setShowProvinceDropdown(false);
                      // Reset search term if still has selection
                      if (selectedProvince) {
                        setProvinceSearchTerm('');
                      }
                    }, 200);
                  }}
                  placeholder="All Province"
                  className={`px-4 py-2 bg-transparent border-2 transition-all outline-none text-sm w-48 ${
                    selectedProvince
                      ? 'border-red-500 text-white placeholder-red-300'
                      : 'border-white/30 text-white/80 placeholder-white/40 hover:border-white/50'
                  }`}
                />
                {showProvinceDropdown && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-black/95 border-2 border-white/30 max-h-60 overflow-y-auto z-50">
                    {Array.from(new Set(communities.map(c => c.province).filter(Boolean)))
                      .sort()
                      .filter(province => 
                        provinceSearchTerm === '' || 
                        province.toLowerCase().includes(provinceSearchTerm.toLowerCase())
                      )
                      .map(province => (
                        <div
                          key={province}
                          onClick={() => {
                            setSelectedProvince(province);
                            setProvinceSearchTerm('');
                            setSelectedCommunity(null);
                            setCommunitySearchTerm('');
                            setShowProvinceDropdown(false);
                          }}
                          className="px-4 py-2 text-white/80 hover:bg-red-600 hover:text-white cursor-pointer transition-colors text-sm"
                        >
                          {province}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              )}
              
              {/* Community Dropdown - Shows only when province is selected */}
              {mounted && selectedProvince && (
                <div className="relative">
                  <input
                    type="text"
                    value={communitySearchTerm || (selectedCommunity?.name || '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCommunitySearchTerm(value);
                      // If field is cleared, clear the selection
                      if (value === '') {
                        setSelectedCommunity(null);
                      }
                      setShowCommunityDropdown(true);
                    }}
                    onFocus={() => setShowCommunityDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowCommunityDropdown(false);
                        // Reset search term if still has selection
                        if (selectedCommunity) {
                          setCommunitySearchTerm('');
                        }
                      }, 200);
                    }}
                    placeholder="All Communities"
                    className={`px-4 py-2 bg-transparent border-2 transition-all outline-none text-sm w-56 ${
                      selectedCommunity
                        ? 'border-red-500 text-white placeholder-red-300'
                        : 'border-white/30 text-white/80 placeholder-white/40 hover:border-white/50'
                    }`}
                  />
                  {showCommunityDropdown && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-black/95 border-2 border-white/30 max-h-60 overflow-y-auto z-50">
                      {communities
                        .filter(c => c.province === selectedProvince)
                        .filter(community => 
                          communitySearchTerm === '' || 
                          community.name.toLowerCase().includes(communitySearchTerm.toLowerCase()) ||
                          (community.city && community.city.toLowerCase().includes(communitySearchTerm.toLowerCase()))
                        )
                        .map(community => (
                          <div
                            key={community.community_id}
                            onClick={() => {
                              setSelectedCommunity(community);
                              setCommunitySearchTerm('');
                              setShowCommunityDropdown(false);
                            }}
                            className="px-4 py-2 text-white/80 hover:bg-red-600 hover:text-white cursor-pointer transition-colors text-sm"
                          >
                            <div className="font-semibold">{community.name}</div>
                            {community.city && (
                              <div className="text-xs text-white/60">{community.city}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Clear Button */}
              {(selectedProvince || selectedCommunity) && (
                <button
                  onClick={() => {
                    setSelectedProvince('');
                    setSelectedCommunity(null);
                    setProvinceSearchTerm('');
                    setCommunitySearchTerm('');
                  }}
                  className="px-4 py-2 text-xs text-white/60 hover:text-white border-2 border-white/30 hover:border-white/50 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-8 sm:mt-10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="mt-8 sm:mt-10 p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            </div>
          ) : filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 sm:mt-10 py-6 lg:px-6 animate-fadeIn">
              {filteredTournaments.map((tournament) => (
                <div key={tournament.ch_id} className="bg-[rgb(26,26,26,0.9)] hover:bg-[rgb(26,26,26,0.95)] transition-colors flex flex-col">
                  {tournament.challonge_cover && (
                    <div className="relative">
                      <img 
                        src={tournament.challonge_cover} 
                        alt={tournament.challonge_name}
                        className="w-full h-48 object-cover mb-3"
                      />
                      <span className={`absolute bottom-0 left-0 px-3 py-2 text-sm font-semibold uppercase ${
                        tournament.active 
                          ? 'bg-red-600 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {tournament.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 text-sm text-white/70">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                      </svg>
                      <span className="truncate uppercase">{tournament.community_name ? `${tournament.community_name}` : 'Independent'}</span>
                    </div>
                    
                    <h3 className="font-semibold text-white mb-3 line-clamp-2 text-lg sm:text-xl">{tournament.challonge_name}</h3>
                    
                    <p className="text-sm text-white/70 mb-4 line-clamp-3">{tournament.description || 'Exciting tournament event'}</p>
                    
                    <div className="flex items-center gap-4 mb-4 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                        </svg>
                        <span>{formatDateOnly(tournament.tournament_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.75a.75.75 0 00-1.5 0v4.19l2.72 2.72a.75.75 0 101.06-1.06L10.75 8.94V5.25z" clipRule="evenodd"></path>
                        </svg>
                        <span>{formatTimeOnly(tournament.tournament_date)}</span>
                      </div>
                    </div>
                    
                    {isTournamentLive(tournament.tournament_date) ? (
                      <button
                        onClick={() => router.push(`/${tournament.challonge_id}`)}
                        className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 text-sm font-medium transition-colors"
                      >
                        Get Started
                      </button>
                    ) : (
                      <button
                        onClick={() => openPreRegister(tournament)}
                        className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 text-sm font-medium transition-colors"
                      >
                        Pre-Register
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 sm:p-20 text-center text-white/70">
              <p className="text-base sm:text-lg">No recent or upcoming tournaments found.</p>
            </div>
          )}
        </div>
      </div>

      {showPreRegisterModal && selectedTournament && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowPreRegisterModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-red-500 bg-[#1c1917] p-6 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">Pre-Register</h3>
            <p className="text-sm text-white/70 mb-6">{selectedTournament.challonge_name}</p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Player Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(event) => {
                      setPlayerName(event.target.value);
                      setShowPlayerDropdown(true);
                      const match = playerOptions.find((player) => player.player_name.toLowerCase() === event.target.value.trim().toLowerCase());
                      if (match?.name) {
                        setFullName(match.name);
                        setIsKnownPlayer(true);
                      } else {
                        setFullName('');
                        setIsKnownPlayer(false);
                      }
                    }}
                    onFocus={() => setShowPlayerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 120)}
                    className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:border-red-500 focus:outline-none"
                    placeholder="Select player"
                  />
                  {showPlayerDropdown && filteredPlayerOptions.length > 0 && (
                    <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded border border-white/10 bg-[#121212]">
                      {filteredPlayerOptions.map((player) => (
                        <button
                          key={player.player_id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectPlayer(player);
                          }}
                        >
                          {player.player_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {playerName.trim().length > 0 && preRegisteredPlayers.some((player) => player.toLowerCase() === playerName.trim().toLowerCase()) && (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-300">
                    <span>Player is already Join</span>
                    <button
                      type="button"
                      className="text-white/70 underline hover:text-white"
                      onClick={handleRemovePreRegister}
                    >
                      Remove Me
                    </button>
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  readOnly={isKnownPlayer}
                  onChange={(event) => setFullName(event.target.value)}
                  className={`w-full rounded border px-3 py-2 text-white/80 ${
                    isKnownPlayer
                      ? 'border-white/10 bg-white/5'
                      : 'border-white/20 bg-white/10 focus:border-red-500 focus:outline-none'
                  }`}
                  placeholder="Auto-filled"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Community</label>
                <div className="relative">
                  <input
                    type="text"
                    value={communityName}
                    readOnly
                    onFocus={() => setShowCommunitySelect(true)}
                    onBlur={() => setTimeout(() => setShowCommunitySelect(false), 120)}
                    className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:border-red-500 focus:outline-none"
                    placeholder="Leave blank if none"
                  />
                  {showCommunitySelect && filteredCommunityOptions.length > 0 && (
                    <div className="absolute z-10 mt-2 max-h-48 w-full overflow-y-auto rounded border border-white/10 bg-[#121212]">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setCommunityName('');
                          setSelectedCommunityId(null);
                          setShowCommunitySelect(false);
                        }}
                      >
                        No Community
                      </button>
                      {filteredCommunityOptions.map((community) => (
                        <button
                          key={community.community_id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setCommunityName(community.name);
                            setSelectedCommunityId(community.community_id);
                            setShowCommunitySelect(false);
                          }}
                        >
                          {community.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                onClick={() => setShowPreRegisterModal(false)}
                disabled={isJoining}
              >
                Cancel
              </button>
              <button
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                onClick={handleJoinTournament}
                disabled={isJoining || playerName.trim().length === 0}
              >
                {isJoining ? 'Joining...' : 'Join Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowJoinResult(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-red-500 bg-[#1c1917] p-6 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-red-200">{joinResultMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                className="rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                onClick={() => setShowJoinResult(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowRemoveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-red-500 bg-[#1c1917] p-6 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-white/80">
              Are you sure you want to remove this pre-registration?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemoving}
              >
                No
              </button>
              <button
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                onClick={confirmRemovePreRegister}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Communities Section - Full Width */}
      <section className="mt-20 sm:mt-32 w-full">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <span className="text-sm sm:text-base uppercase tracking-[0.25em] text-white font-bold">
            Our Partners
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold text-white">
            MEET THE <span className="text-red-600">COMMUNITIES</span>
          </h2>
          <p className="max-w-lg text-sm sm:text-base text-white/80">
            Connect with local Beyblade communities and tournaments across the region.
          </p>
        </div>

        {communitiesLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        ) : filteredCommunities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:px-6 animate-fadeIn">
              {filteredCommunities.map((community) => (
                <div key={community.community_id} className="community-card bg-[rgb(26,26,26,0.9)] hover:bg-[rgb(26,26,26,0.95)] transition-colors overflow-hidden relative border-[10px] border-transparent">
                  {/* Halftone Background - Top Left */}
                  <div className="absolute top-0 left-0 w-48 h-48 pointer-events-none opacity-40 z-20">
                    <div className="w-full h-full halftone-bg halftone-top-left"></div>
                  </div>
                  
                  {/* Halftone Background - Bottom Right */}
                  <div className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none opacity-40 z-20">
                    <div className="w-full h-full halftone-bg halftone-bottom-right"></div>
                  </div>
                  
                  {/* Half Slash Background */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute bottom-0 left-0 w-full h-full bg-red-600 transform origin-bottom-left skew-x-[-30deg]"></div>
                  </div>
                  
                  {/* Logo Container with Info - 3:6 aspect ratio */}
                  <div className="aspect-[3/6] bg-black/50 flex flex-col items-center justify-between p-4 relative z-10">
                    {/* Logo */}
                    <div className="flex-1 flex items-center justify-center community-logo-container">
                      {community.logo ? (
                        <img 
                          src={community.logo} 
                          alt={community.name}
                          className="w-[210px] h-auto object-contain"
                        />
                      ) : (
                        <div className="text-center">
                          <p className="text-white/70 text-sm font-semibold uppercase text-center line-clamp-3">{community.name}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Community Info at Bottom */}
                    <div className="w-full flex flex-col items-center gap-2 pb-2">
                      <h3 className="font-semibold text-white text-[1.4rem] line-clamp-2 text-center uppercase tracking-[-1px]">{community.name}</h3>
                      
                      {/* Social Icons */}
                      <div className="flex items-center gap-3">
                        <a href="#" className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </a>
                        <a href="#" className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 sm:p-20 text-center text-white/70">
              <p className="text-base sm:text-lg">No communities found.</p>
            </div>
          )}
        </section>
      </main>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black text-white py-4 px-6 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Left Side - Social Links */}
          <div className="flex items-center gap-6">
            <a 
              href="https://www.facebook.com/xzviel/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/70 hover:text-red-500 transition-colors text-sm uppercase tracking-wider"
            >
              Shop
            </a>
            <a 
              href="https://www.facebook.com/xzviel/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/70 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a 
              href="https://www.youtube.com/@xzviel/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/70 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a 
              href="https://www.tiktok.com/@xzvl4324" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/70 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
            </a>
          </div>

          {/* Right Side - Developer Credit */}
          <div className="text-sm text-white/70">
            System Developed by:{' '}
            <a 
              href="https://www.facebook.com/xzviel/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 transition-colors uppercase tracking-wider font-semibold"
            >
              xzvl
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}