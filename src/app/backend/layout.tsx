'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface User {
  user_role?: string;
}

export default function BackendLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [communityLogo, setCommunityLogo] = useState<string | null>(null);

  const isLoginPage = useMemo(() => pathname === '/backend/login', [pathname]);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setUser(null);
        setCommunityLogo(null);
        return;
      }

      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    };

    const loadCommunityLogo = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setCommunityLogo(null);
        return;
      }

      try {
        const response = await fetch('/api/community', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success && data.data?.logo) {
          setCommunityLogo(data.data.logo);
        } else {
          setCommunityLogo(null);
        }
      } catch {
        setCommunityLogo(null);
      }
    };

    if (!isLoginPage) {
      loadUser();
      loadCommunityLogo();
    }
  }, [isLoginPage]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    router.push('/backend/login');
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  const isAdmin = user?.user_role === 'admin';

  return (
    <div className="backend-shell min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-[#0d0e1b] text-white flex flex-col px-6 py-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3">
          <img src="/assets/logo.webp" alt="BeybladeX" className="w-[25px] h-auto" />
          <span className="text-sm font-semibold uppercase tracking-wide">Dashboard</span>
        </div>

        <div className="mt-8 space-y-3 text-sm">
          <Link href="/backend/" className="block text-white/80 hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/backend/community/" className="block text-white/80 hover:text-white transition-colors">
            Community
          </Link>
          <Link href="/backend/tournaments/" className="block text-white/80 hover:text-white transition-colors">
            Tournaments
          </Link>
          <Link href="/backend/judges/" className="block text-white/80 hover:text-white transition-colors">
            Judges
          </Link>
          {isAdmin ? (
            <span className="block text-white/80">Players</span>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="mt-8 space-y-3 text-sm">
            <Link href="/backend/users/" className="block text-white/80 hover:text-white transition-colors">
              Users
            </Link>
            <Link href="/backend/communities/" className="block text-white/80 hover:text-white transition-colors">
              Communities
            </Link>
          </div>
        ) : null}

        <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
          <Link href="/backend/community/" className="flex items-center gap-2">
            <img
              src={communityLogo || '/assets/logo.webp'}
              alt="Community"
              className="w-[40px] h-[40px] rounded-full object-cover bg-black/20"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/backend/settings/" title="Settings" className="text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.936a7.97 7.97 0 000-1.872l2.037-1.58a.5.5 0 00.121-.638l-1.93-3.341a.5.5 0 00-.607-.22l-2.397.96a8.12 8.12 0 00-1.62-.936l-.36-2.54a.5.5 0 00-.496-.424h-3.86a.5.5 0 00-.496.424l-.36 2.54c-.57.22-1.11.52-1.62.936l-2.397-.96a.5.5 0 00-.607.22l-1.93 3.341a.5.5 0 00.121.638l2.037 1.58a7.97 7.97 0 000 1.872l-2.037 1.58a.5.5 0 00-.121.638l1.93 3.341a.5.5 0 00.607.22l2.397-.96c.51.416 1.05.716 1.62.936l.36 2.54a.5.5 0 00.496.424h3.86a.5.5 0 00.496-.424l.36-2.54c.57-.22 1.11-.52 1.62-.936l2.397.96a.5.5 0 00.607-.22l1.93-3.341a.5.5 0 00-.121-.638l-2.037-1.58zM12 15.5A3.5 3.5 0 1112 8a3.5 3.5 0 010 7.5z"/>
              </svg>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="backend-no-red text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H9a2 2 0 00-2 2v3h2V5h10v14H9v-3H7v3a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
