'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendAuth } from '@/hooks/useBackendAuth';

interface User {
  user_id: number;
  username: string;
  name: string;
  user_role: string;
}

export default function BackendDashboard() {
  const router = useRouter();
  const { user, isLoading, logout } = useBackendAuth();

  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin backend-spinner rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Backend Dashboard</h1>
              <p className="text-gray-600">Beyblade Tournament Management System</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.user_role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome back, {user.name}!
          </h2>
          <p className="text-gray-600">
            Manage tournaments, players, and judges from your {user.user_role === 'tournament_organizer' ? 'organizer' : user.user_role} dashboard.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Users Card - Admin Only */}
          {user.user_role === 'admin' && (
            <div 
              onClick={() => router.push('/backend/users')}
              className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Users</h3>
                  <p className="text-gray-600">Manage users</p>
                </div>
              </div>
            </div>
          )}

          {/* Communities Card - Admin Only */}
          {user.user_role === 'admin' && (
            <div 
              onClick={() => router.push('/backend/communities')}
              className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Communities</h3>
                  <p className="text-gray-600">Manage all communities</p>
                </div>
              </div>
            </div>
          )}

          {/* Tournaments Card */}
          <div 
            onClick={() => router.push('/backend/tournaments')}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Tournaments</h3>
                <p className="text-gray-600">Manage tournaments</p>
              </div>
            </div>
          </div>

          {/* Community Card */}
          <div 
            onClick={() => router.push('/backend/community')}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">My Community</h3>
                <p className="text-gray-600">Manage community</p>
              </div>
            </div>
          </div>

          {/* Players Card - Admin Only */}
          {user.user_role === 'admin' && (
            <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Players</h3>
                  <p className="text-gray-600">Player management</p>
                </div>
              </div>
            </div>
          )}

          {/* Judges Card */}
          <div 
            onClick={() => router.push('/backend/judges')}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Judges</h3>
                <p className="text-gray-600">Judge management</p>
              </div>
            </div>
          </div>

          {/* Settings Card */}
          <div 
            onClick={() => router.push('/backend/settings')}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
                <p className="text-gray-600">Account settings</p>
              </div>
            </div>
          </div>


        </div>

        {/* Tournaments Section */}
        <TournamentsSection user={user} router={router} />

      </main>
    </div>
  );
}

// Tournaments Section Component
function TournamentsSection({ user, router }: { user: User; router: any }) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      const token = localStorage.getItem('authToken');
      
      try {
        // Fetch all tournaments for the dashboard overview
        const response = await fetch('/api/tournaments?showAll=true', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success && data.tournaments) {
          // Filter tournaments to show upcoming and 1 week past tournaments
          const now = new Date();
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(now.getDate() - 14);

          const filteredTournaments = data.tournaments.filter((tournament: any) => {
            const tournamentDate = new Date(tournament.tournament_date);
            return tournamentDate >= twoWeeksAgo;
          });
          
          setTournaments(filteredTournaments);
        }
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournaments();
  }, []);

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

  const isSameDay = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  };

  const getTournamentStatusLabel = (dateString: string) => {
    const now = new Date();
    const start = new Date(dateString);
    const isToday = isSameDay(now, start);

    if (isToday && now >= start) return 'On Going';
    if (isToday) return 'Today';
    if (now < start) return 'Upcoming';
    return 'Recent';
  };

  const isPreRegisterClosed = (tournament: any) => {
    const cutoff = tournament.pre_register_cutoff || tournament.tournament_date;
    return new Date() >= new Date(cutoff);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">All Tournaments</h2>
        <p className="text-sm text-gray-600">All upcoming tournaments and recent events from the past two weeks</p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="animate-spin backend-spinner rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
        </div>
      ) : tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {tournaments.map((tournament) => (
            <div key={tournament.ch_id} className="bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col rounded-lg overflow-hidden border">
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
                    {tournament.active ? getTournamentStatusLabel(tournament.tournament_date) : 'Inactive'}
                  </span>
                </div>
              )}

              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                  </svg>
                  <span className="truncate uppercase text-gray-900">{tournament.community_name ? `${tournament.community_name}` : 'Independent'}</span>
                </div>

                <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 text-lg sm:text-xl">{tournament.challonge_name}</h3>

                <p className="text-sm text-gray-700 mb-4 line-clamp-3">{tournament.description || 'Exciting tournament event'}</p>

                <div className="flex items-center gap-4 mb-4 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                    </svg>
                    <span className="text-gray-900">{formatDateOnly(tournament.tournament_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.75a.75.75 0 00-1.5 0v4.19l2.72 2.72a.75.75 0 101.06-1.06L10.75 8.94V5.25z" clipRule="evenodd"></path>
                    </svg>
                    <span className="text-gray-900">{formatTimeOnly(tournament.tournament_date)}</span>
                  </div>
                </div>

                {isPreRegisterClosed(tournament) ? (
                  <button
                    onClick={() => router.push(`/${tournament.challonge_id}`)}
                    className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 text-sm font-medium transition-colors rounded"
                  >
                    Get Started
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/backend/tournaments/${tournament.challonge_id}/players`)}
                    className="mt-auto w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 text-sm font-medium transition-colors rounded"
                  >
                    Pre-Register
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          <p>No recent or upcoming tournaments found.</p>
        </div>
      )}
    </div>
  );
}