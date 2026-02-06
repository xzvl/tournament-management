"use client";

import { useState, useEffect, useCallback } from 'react';

interface PlayerDashboardProps {
  challongeId: string;
  playerName: string;
  onPlayerLogin: (name: string) => void;
  onLogout: () => void;
}

interface Match {
  id: string;
  player1: string;
  player2: string;
  winner?: string;
  scores: {
    player1: number;
    player2: number;
  };
  status: 'pending' | 'completed';
  timestamp?: number;
}

export default function PlayerDashboard({ challongeId, playerName, onPlayerLogin, onLogout }: PlayerDashboardProps) {
  const [currentName, setCurrentName] = useState(playerName || '');
  const [matches, setMatches] = useState<Match[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, total: 0 });
  const [groupStandings, setGroupStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(!playerName);

  const loadPlayerData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load matches from localStorage (in a real app, this would be from an API)
      const savedMatches = localStorage.getItem(`matches_${challongeId}`);
      let allMatches: Match[] = savedMatches ? JSON.parse(savedMatches) : [];
      
      // Filter matches for this player
      const playerMatches = allMatches.filter(match => 
        match.player1.toLowerCase() === currentName.toLowerCase() || 
        match.player2.toLowerCase() === currentName.toLowerCase()
      );
      
      setMatches(playerMatches);
      
      // Separate upcoming and recent matches
      const upcoming = playerMatches.filter(match => match.status === 'pending');
      const recent = playerMatches.filter(match => match.status === 'completed').slice(-5);
      
      setUpcomingMatches(upcoming);
      setRecentMatches(recent);
      
      // Calculate stats
      const completedMatches = playerMatches.filter(match => match.status === 'completed');
      const wins = completedMatches.filter(match => 
        match.winner?.toLowerCase() === currentName.toLowerCase()
      ).length;
      const losses = completedMatches.length - wins;
      
      setStats({
        wins,
        losses,
        total: completedMatches.length
      });

      // Mock group standings data (would come from Challonge API)
      setGroupStandings([
        { position: 1, player: 'Player A', wins: 5, losses: 0, points: 15 },
        { position: 2, player: currentName || 'You', wins: 3, losses: 2, points: 9 },
        { position: 3, player: 'Player C', wins: 2, losses: 3, points: 6 },
        { position: 4, player: 'Player D', wins: 0, losses: 5, points: 0 },
      ]);
      
    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setLoading(false);
    }
  }, [challongeId, currentName]);

  useEffect(() => {
    loadPlayerData();
  }, [currentName, loadPlayerData]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentName.trim()) {
      onPlayerLogin(currentName.trim());
      setIsEditingName(false);
    }
  };

  const handleEditName = () => {
    setIsEditingName(true);
  };

  return (
    <main className="xzvl-theme min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="top-row" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-accent)'}}>
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center space-x-4">
              <div className="xzvl-logo w-16 h-16 text-xl">
                XZVL
              </div>
              <div>
                <h1 className="text-3xl font-bold" style={{color: 'var(--text-color)'}}>Player Dashboard</h1>
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <form onSubmit={handleNameSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={currentName}
                        onChange={(e) => setCurrentName(e.target.value)}
                        className="px-2 py-1 text-lg border rounded"
                        style={{color: 'var(--text-color)', backgroundColor: 'var(--bg-light)', borderColor: 'var(--border-color)'}}
                        placeholder="Enter your name"
                        autoFocus
                        required
                      />
                      <button type="submit" className="xzvl-btn-primary px-3 py-1 text-sm">Save</button>
                      <button type="button" onClick={() => setIsEditingName(false)} className="xzvl-btn-secondary px-3 py-1 text-sm">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <p className="text-lg" style={{color: 'var(--secondary-color)'}}>
                        Welcome, {currentName || 'Player'}!
                      </p>
                      <button onClick={handleEditName} className="text-sm underline" style={{color: 'var(--primary-color)'}}>
                        {currentName ? 'Edit' : 'Set Name'}
                      </button>
                    </>
                  )}
                </div>
                <p style={{color: 'var(--primary-color)'}}>Tournament: {challongeId}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="xzvl-btn-primary"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="stats-card wins">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{color: 'var(--accent-color)'}}>Wins</h3>
                  <p className="text-4xl font-bold" style={{color: 'var(--text-color)'}}>{stats.wins}</p>
                </div>
                <div className="text-6xl opacity-30">🏆</div>
              </div>
            </div>
            <div className="stats-card losses">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{color: 'var(--error-color)'}}>Losses</h3>
                  <p className="text-4xl font-bold" style={{color: 'var(--text-color)'}}>{stats.losses}</p>
                </div>
                <div className="text-6xl opacity-30">💥</div>
              </div>
            </div>
            <div className="stats-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{color: 'var(--secondary-color)'}}>Total Battles</h3>
                  <p className="text-4xl font-bold" style={{color: 'var(--text-color)'}}>{stats.total}</p>
                </div>
                <div className="text-6xl opacity-30">⚔️</div>
              </div>
            </div>
          </div>

          {/* Group Standings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="xzvl-card p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
                <span className="mr-3">📊</span>
                Group A Standings
              </h2>
              <div className="space-y-3">
                {groupStandings.map((player, index) => (
                  <div 
                    key={index} 
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      player.player === currentName ? 'bg-accent' : ''
                    }`}
                    style={{
                      backgroundColor: player.player === currentName ? 'var(--bg-accent)' : 'var(--bg-light)',
                      borderLeft: player.player === currentName ? '4px solid var(--primary-color)' : 'none'
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl font-bold" style={{color: 'var(--primary-color)'}}>
                        #{player.position}
                      </span>
                      <span className="font-medium" style={{color: 'var(--text-color)'}}>
                        {player.player}
                      </span>
                    </div>
                    <div className="text-sm" style={{color: 'var(--text-secondary)'}}>
                      {player.wins}W - {player.losses}L ({player.points}pts)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="xzvl-card p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
                <span className="mr-3">📈</span>
                Player Statistics
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)'}}>
                  <span style={{color: 'var(--text-secondary)'}}>Win Rate</span>
                  <span className="font-bold text-lg" style={{color: 'var(--accent-color)'}}>
                    {stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)'}}>
                  <span style={{color: 'var(--text-secondary)'}}>Current Streak</span>
                  <span className="font-bold text-lg" style={{color: 'var(--secondary-color)'}}>3W</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)'}}>
                  <span style={{color: 'var(--text-secondary)'}}>Longest Streak</span>
                  <span className="font-bold text-lg" style={{color: 'var(--primary-color)'}}>5W</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)'}}>
                  <span style={{color: 'var(--text-secondary)'}}>Avg. Points/Match</span>
                  <span className="font-bold text-lg" style={{color: 'var(--text-color)'}}>2.8</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming and Recent Matches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="xzvl-card p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
                <span className="mr-3">⏰</span>
                Upcoming Matches
              </h2>
              {upcomingMatches.length === 0 ? (
                <div className="text-center py-8" style={{color: 'var(--text-muted)'}}>
                  <div className="text-4xl mb-2">🎯</div>
                  <p>No upcoming matches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMatches.slice(0, 3).map((match) => (
                    <div key={match.id} className="match-card pending p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold" style={{color: 'var(--text-color)'}}>
                            {match.player1} vs {match.player2}
                          </h4>
                          <p className="text-sm" style={{color: 'var(--text-muted)'}}>Round 1</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-sm font-bold" style={{
                          backgroundColor: 'var(--bg-accent)',
                          color: 'var(--warning-color)'
                        }}>
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="xzvl-card p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
                <span className="mr-3">📜</span>
                Recent Matches
              </h2>
              {recentMatches.length === 0 ? (
                <div className="text-center py-8" style={{color: 'var(--text-muted)'}}>
                  <div className="text-4xl mb-2">🎯</div>
                  <p>No recent matches</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMatches.map((match) => (
                    <div 
                      key={match.id} 
                      className={`match-card p-4 ${
                        match.winner?.toLowerCase() === currentName?.toLowerCase() ? 'win' : 'loss'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold" style={{color: 'var(--text-color)'}}>
                            {match.player1} vs {match.player2}
                          </h4>
                          <p className="text-sm" style={{color: 'var(--text-secondary)'}}>
                            Score: {match.scores.player1} - {match.scores.player2}
                          </p>
                        </div>
                        <div className="text-2xl">
                          {match.winner?.toLowerCase() === currentName?.toLowerCase() ? '🏆' : '💥'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Final Stage */}
          <div className="xzvl-card p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
              <span className="mr-3">👑</span>
              Final Stage - Elimination Bracket
            </h2>
            
            <div className="text-center py-8" style={{color: 'var(--text-muted)'}}>
              <div className="text-4xl mb-4">🏆</div>
              <p className="text-lg mb-2">Tournament Finals</p>
              <p className="text-sm">Elimination bracket will be displayed when group stage is complete</p>
              
              <div className="mt-6 space-y-4">
                {/* Mock bracket visualization */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm" style={{color: 'var(--secondary-color)'}}>Semifinals</h4>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)'}}>
                        <p className="text-sm" style={{color: 'var(--text-color)'}}>Player A vs Player B</p>
                        <p className="text-xs" style={{color: 'var(--text-muted)'}}>TBD</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)'}}>
                        <p className="text-sm" style={{color: 'var(--text-color)'}}>Player C vs Player D</p>
                        <p className="text-xs" style={{color: 'var(--text-muted)'}}>TBD</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <div className="text-2xl" style={{color: 'var(--primary-color)'}}>→</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm" style={{color: 'var(--accent-color)'}}>Grand Final</h4>
                    <div className="p-4 rounded-lg" style={{backgroundColor: 'var(--bg-accent)', border: '2px solid var(--primary-color)'}}>
                      <p className="text-sm font-bold" style={{color: 'var(--text-color)'}}>Winner A vs Winner B</p>
                      <p className="text-xs" style={{color: 'var(--text-muted)'}}>Championship Match</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full Match History */}
          <div className="xzvl-card p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center" style={{color: 'var(--text-color)'}}>
              <span className="mr-3">📚</span>
              Complete Battle History
            </h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent mx-auto"></div>
                <p className="mt-4 font-medium" style={{color: 'var(--text-secondary)'}}>Loading battle data...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12" style={{color: 'var(--text-muted)'}}>
                <div className="text-6xl mb-4">⚔️</div>
                <p className="text-lg">No battles recorded yet.</p>
                <p className="text-sm">Your tournament battles will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`match-card ${
                      match.status === 'completed'
                        ? match.winner?.toLowerCase() === currentName.toLowerCase()
                          ? 'win'
                          : 'loss'
                        : 'pending'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">
                            {match.status === 'completed' 
                              ? match.winner?.toLowerCase() === currentName.toLowerCase() 
                                ? '🏆' 
                                : '💥'
                              : '⏳'
                            }
                          </span>
                            <h4 className="font-bold text-lg" style={{color: 'var(--text-color)'}}>
                            {match.player1} vs {match.player2}
                          </h4>
                        </div>
                        {match.status === 'completed' && (
                          <div className="ml-12">
                              <p className="font-medium" style={{color: 'var(--text-secondary)'}}>
                                Final Score: {match.scores.player1} - {match.scores.player2}
                              </p>
                              {match.winner && (
                                <p className={`font-bold`} style={{
                                  color: match.winner.toLowerCase() === currentName.toLowerCase() 
                                    ? 'var(--accent-color)' 
                                    : 'var(--error-color)'
                                }}>
                                Victor: {match.winner}
                              </p>
                            )}
                          </div>
                        )}
                        {match.timestamp && (
                            <p className="text-xs mt-2 ml-12" style={{color: 'var(--text-muted)'}}>
                              {new Date(match.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                          match.status === 'completed'
                            ? 'bg-gray-200'
                            : 'bg-yellow-200'
                        }`} style={{
                          backgroundColor: match.status === 'completed' 
                            ? 'var(--bg-light)' 
                            : 'var(--bg-accent)',
                          color: 'var(--text-color)'
                        }}>
                        {match.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Action Wrap */}
          <div className="bottom-action-wrap p-6 mt-8" style={{backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-accent)'}}>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Tournament Status</p>
                  <p className="text-lg font-bold" style={{color: 'var(--accent-color)'}}>Group Stage</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>Next Match</p>
                  <p className="text-lg font-bold" style={{color: 'var(--primary-color)'}}>
                    {upcomingMatches.length > 0 ? 'Ready' : 'Waiting'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => window.location.reload()}
                  className="xzvl-btn-secondary flex items-center gap-2 px-4 py-2"
                >
                  <span>🔄</span>
                  Refresh Data
                </button>
                <button 
                  onClick={() => {
                    const tournamentUrl = `http://challonge.com/${challongeId}`;
                    window.open(tournamentUrl, '_blank');
                  }}
                  className="xzvl-btn-primary flex items-center gap-2 px-4 py-2"
                >
                  <span>🌐</span>
                  View on Challonge
                </button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t" style={{borderColor: 'var(--border-color)'}}>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm" style={{color: 'var(--text-muted)'}}>
                <span>🎯 Tournament ID: {challongeId}</span>
                <span>👤 Player: {currentName || 'Not Set'}</span>
                <span>⏰ Last Updated: {new Date().toLocaleTimeString()}</span>
                <span>🏆 XZVL Tournament System</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}