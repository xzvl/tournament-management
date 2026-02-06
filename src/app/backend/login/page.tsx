'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BackendLogin() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store auth token/session
        localStorage.setItem('authToken', data.token);
        // Redirect to backend dashboard
        router.push('/backend');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top bg-no-repeat p-4 sm:p-6 lg:p-8 pb-24 text-white flex items-center justify-center">
      <div className="red-cool-border flex flex-col items-center gap-6 p-8 w-full max-w-md">
        {/* Logo */}
        <div className="mb-2">
          <img
            src="/assets/logo.webp"
            alt="Tournament Logo"
            className="h-24 sm:h-28 w-auto"
          />
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider">Backend Login</h1>
          <p className="text-white/70 mt-2 text-sm uppercase tracking-widest">Beyblade Tournament Management</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6 w-full">
          {error && (
            <div className="bg-red-500/15 border border-red-500 text-red-200 px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/20 text-white placeholder-white/40 focus:border-red-500 outline-none transition-colors"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-black/40 border-2 border-white/20 text-white placeholder-white/40 focus:border-red-500 outline-none transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-white/10 hover:bg-red-600 text-white font-bold uppercase tracking-wider transition-colors border-2 border-white/30 hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing In...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}