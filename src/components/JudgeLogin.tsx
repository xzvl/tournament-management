"use client";

import { useState } from 'react';

interface JudgeLoginProps {
  challongeId: string;
  onLogin: (success: boolean) => void;
  onBack: () => void;
}

export default function JudgeLogin({ challongeId, onLogin, onBack }: JudgeLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/judge-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, challongeId }),
      });

      const data = await response.json();
      
      if (data.success) {
        onLogin(true);
      } else {
        setError(data.message || 'Invalid password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="xzvl-theme flex items-center justify-center p-4">
      <div className="xzvl-card p-8 max-w-md w-full relative z-10">
        <div className="tournament-header">
          <div className="xzvl-logo">
            XZVL
          </div>
          <h1 className="tournament-title">
            Judge Access
          </h1>
          <p className="tournament-subtitle">Tournament: {challongeId}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Judge Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-800 font-medium"
              placeholder="Enter judge password"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center">{error}</div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full xzvl-btn-primary disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Login as Judge'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="xzvl-btn-secondary"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}