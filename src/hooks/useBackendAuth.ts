import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AuthUser {
  user_id: number;
  username: string;
  name?: string;
  user_role: string;
  role?: string;
}

interface Community {
  community_id: number;
  name: string;
  logo?: string;
}

// Cache auth data to avoid redundant API calls
const authCache = {
  user: null as AuthUser | null,
  community: null as Community | null,
  timestamp: 0,
  ttl: 60000, // 1 minute cache
};

/**
 * Hook for backend authentication with caching
 * Prevents redundant API calls when multiple pages/components use it
 */
export function useBackendAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const verifyAuth = useCallback(async () => {
    const token = localStorage.getItem('authToken');

    if (!token) {
      setUser(null);
      setCommunity(null);
      setIsLoading(false);
      router.push('/backend/login');
      return;
    }

    try {
      // Check if cached data is still valid
      const now = Date.now();
      if (
        authCache.user &&
        authCache.timestamp &&
        now - authCache.timestamp < authCache.ttl
      ) {
        // Use cached data
        if (isMountedRef.current) {
          setUser(authCache.user);
          setCommunity(authCache.community);
          setIsLoading(false);
        }
        return;
      }

      // Fetch fresh data in parallel
      const [authRes, communityRes] = await Promise.all([
        fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/community', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const authData = await authRes.json();
      const communityData = await communityRes.json();

      if (!authData.success) {
        localStorage.removeItem('authToken');
        if (isMountedRef.current) {
          setUser(null);
          setCommunity(null);
          setError('Authentication failed');
        }
        router.push('/backend/login');
        return;
      }

      // Update cache
      authCache.user = authData.user;
      authCache.community = communityData.success ? communityData.data : null;
      authCache.timestamp = now;

      if (isMountedRef.current) {
        setUser(authData.user);
        setCommunity(communityData.success ? communityData.data : null);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to verify authentication');
        setUser(null);
        setCommunity(null);
      }
      console.error('Auth verification error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const clearCache = useCallback(() => {
    authCache.user = null;
    authCache.community = null;
    authCache.timestamp = 0;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    clearCache();
    setUser(null);
    setCommunity(null);
    router.push('/backend/login');
  }, [router, clearCache]);

  return {
    user,
    community,
    isLoading,
    error,
    logout,
    clearCache,
  };
}

/**
 * Hook for checking if user is admin (uses useBackendAuth internally)
 */
export function useBackendAuthAdmin() {
  const { user, isLoading, error } = useBackendAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || (user.user_role !== 'admin' && user.role !== 'admin'))) {
      router.push('/backend');
    }
  }, [user, isLoading, router]);

  return { user, isLoading, error };
}

/**
 * Clear cache when logging out from any page
 */
export function clearAuthCache() {
  authCache.user = null;
  authCache.community = null;
  authCache.timestamp = 0;
}
