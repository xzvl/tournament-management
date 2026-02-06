"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TournamentPage() {
  const params = useParams();
  const router = useRouter();
  const challongeId = params.challongeId as string;
  const [userType, setUserType] = useState<'judge' | 'player' | null>(null);

  const handleUserTypeSelection = (type: 'judge' | 'player') => {
    if (type === 'player') {
      router.push(`/${challongeId}/player`);
    } else if (type === 'judge') {
      // Check if judge is already logged in
      const judgeLoggedIn = localStorage.getItem(`judgeLoggedIn_${challongeId}`);
      if (judgeLoggedIn === 'true') {
        router.push(`/${challongeId}/judge`);
      } else {
        router.push(`/${challongeId}/login`);
      }
    }
  };

  return (
    <>
      <main className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top bg-no-repeat p-4 sm:p-6 lg:p-8 pb-24 text-white flex items-center justify-center">
        <div className="red-cool-border flex flex-col items-center gap-6 p-8">
          {/* Logo */}
            <div className="mb-4">
              <img 
                src="/assets/logo.webp" 
                alt="Tournament Logo" 
                className="h-24 sm:h-32 w-auto"
              />
            </div>
            
            {/* What are you? */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wider text-center">
              What are you?
            </h1>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
              <button
                onClick={() => handleUserTypeSelection('player')}
                className="flex-1 px-6 py-4 bg-white/10 hover:bg-red-600 text-white font-bold uppercase tracking-wider transition-colors border-2 border-white/30 hover:border-red-600"
              >
                I&apos;m a Player
              </button>
              
              <button
                onClick={() => handleUserTypeSelection('judge')}
                className="flex-1 px-6 py-4 bg-white/10 hover:bg-red-600 text-white font-bold uppercase tracking-wider transition-colors border-2 border-white/30 hover:border-red-600"
              >
                I&apos;m a Judge
              </button>
            </div>
            
            {/* Go back to home button */}
            <Link href="/" className="w-full max-w-lg">
              <button className="w-full px-6 py-3 bg-transparent hover:bg-white/10 text-white/70 hover:text-white font-semibold uppercase tracking-wider transition-colors border-2 border-white/30 hover:border-white/50">
                Go back to home
              </button>
            </Link>
        </div>
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