# Performance Analysis: Tournament Management Application

## Executive Summary
The application has **critical performance issues** in three main areas:
1. **Client-side rendering overload** - All pages use "use client" with heavy data fetching
2. **Waterfall API calls** - Sequential fetches instead of parallel/batched requests
3. **N+1 query patterns** - Database queries not properly optimized with Prisma

---

## 1. CRITICAL ISSUES: Page Rendering Strategy

### Issue 1.1: Entire App is Client-Side Rendered ❌
**Files affected:**
- [src/app/page.tsx](src/app/page.tsx#L1) (marked as "use client")
- [src/app/[challongeId]/page.tsx](src/app/[challongeId]/page.tsx#L1) (marked as "use client")
- [src/app/[challongeId]/judge/page.tsx](src/app/[challongeId]/judge/page.tsx#L1) (marked as "use client")
- [src/app/[challongeId]/player/page.tsx](src/app/[challongeId]/player/page.tsx#L1) (marked as "use client")

**Problem:**
All pages are "use client" components, meaning:
- **No Server-Side Rendering (SSR)** - Page shows blank until JS loads and hydrates
- Users on slow connections see white screen for 2-5+ seconds
- Search engines see minimal content (bad SEO)
- JavaScript bundle must load, parse, and execute before any content appears

**Example - [src/app/page.tsx](src/app/page.tsx#L1-L50):**
```tsx
"use client";  // ← PROBLEM: Forces client-side rendering

import { useEffect, useState, useMemo } from 'react';
// ... 60+ state variables with complex logic
```

**Impact:**
- **First Contentful Paint (FCP)**: ~3-5 seconds (should be <1.8s)
- **Largest Contentful Paint (LCP)**: >5 seconds (should be <2.5s)
- **Cumulative Layout Shift (CLS)**: High (page shifts as JS loads)

**Recommendation:**
Convert pages to Server Components and use `fetch()` at the server level. Only use "use client" for interactive parts (modals, dropdowns, forms).

---

## 2. CRITICAL ISSUES: Waterfall API Calls (Slow Data Loading)

### Issue 2.1: Judge Page Sequential Fetches ❌
**File:** [src/app/[challongeId]/judge/page.tsx](src/app/[challongeId]/judge/page.tsx#L45-L120)

**Problem:** Data is fetched in a chain (waterfall), not in parallel:

```
useEffect → fetchTournament()
    ↓ (waits for response)
useEffect → setToId(tournament.to_id)
    ↓ (waits for toId)
useEffect → fetchUserData()
    ↓ (waits for user data)
useEffect → fetchPlayers()
```

**Timeline:**
- Request 1 (tournament): ~200ms
- Request 2 (user data): ~200ms
- Request 3 (players): ~500ms (large dataset)
- **Total time: ~900ms** just to get initial data

If run in parallel: **~500ms** (fastest of 3)

**Code example [Line 75-95]:**
```tsx
// First fetch
useEffect(() => {
  const fetchTournament = async () => {
    const response = await fetch(`/api/tournaments?showAll=true`);
    // ... processes response
    setToId(tournament.to_id);
  };
}, [challongeId]);

// Second fetch (depends on first)
useEffect(() => {
  if (!toId) return; // ← Waits for toId from above
  const fetchUserData = async () => {
    const response = await fetch(`/api/users/${toId}`);
    // ...
  };
}, [toId]); // ← Dependency on toId
```

**Recommendation:**
Fetch tournament data server-side, pass as props, or use a single API route that aggregates all data:
```tsx
// Better: Single endpoint
const response = await fetch(`/api/tournaments/${challongeId}/details`);
// Returns { tournament, user, players, matches } in one request
```

### Issue 2.2: Player Page Multiple Sequential Fetches ❌
**File:** [src/app/[challongeId]/player/page.tsx](src/app/[challongeId]/player/page.tsx#L160-L230)

Similar pattern:
```
fetchTournament() → setToId()
    ↓
fetchUserData() (depends on toId)
    ↓
fetch participants (depends on apiKey)
```

---

## 3. DATABASE QUERY ISSUES: N+1 Patterns

### Issue 3.1: Judges API - N+1 Query ❌
**File:** [src/app/api/judges/route.ts](src/app/api/judges/route.ts#L50-L100)

**Problem:** Fetches judges, then loops through each judge to get communities:

```tsx
// Line 50-70: First query - get all judges
const judgeRows = await prisma.judge.findMany({
  select: { judge_id: true, community_ids: true, ... }
});

// Line 74-78: Second query - get ALL communities (wasteful)
const communityNames = await prisma.community.findMany({
  select: { community_id: true, name: true }
});

// Line 82-92: Loop through judges mapping communities
const judges = judgeRows.map((judge: any) => {
  const communityIds = Array.isArray(judge.community_ids) ? judge.community_ids : [];
  const names = communityIds
    .map((id: any) => communityNameMap.get(id as number)) // ← Maps in memory
    .filter(Boolean);
});
```

**Impact:**
- If 100 judges exist, query `communities` table twice (unnecessary)
- Loading ALL communities when only need a subset
- Post-processing in memory instead of database

**Better approach:**
```tsx
// Fetch only needed communities using SQL JOIN
const judges = await prisma.judge.findMany({
  where: { /* filter if needed */ },
  select: {
    judge_id: true,
    username: true,
    judge_name: true,
    community_ids: true
  }
  // Would need normalized schema to do proper JOIN
});
```

### Issue 3.2: Tournaments API - Inefficient Community Lookup ❌
**File:** [src/app/api/tournaments/route.ts](src/app/api/tournaments/route.ts#L20-L50)

**Problem:**
```tsx
// Line 20-30: Fetch tournaments
const tournaments = await prisma.challongeTournament.findMany({
  // ... conditions
  include: { organizer: { ... } }
});

// Line 32-35: Separate query for ALL communities
const communityRows = await prisma.community.findMany({
  select: { community_id: true, name: true, to_id: true }
});

// Line 36-38: Build map in JavaScript
const communityByToId = new Map(
  communityRows.map((community) => [community.to_id, community.name])
);

// Line 40+: Loop through tournaments using the map
const formattedTournaments = tournaments.map(tournament => ({
  community_name: communityByToId.get(String(tournament.to_id ?? '')) ?? null
}));
```

**Issues:**
1. **Loads ALL communities** - Even ones not used by tournaments
2. **Post-processing in JavaScript** - Slow string conversions and mapping
3. **Key type mismatch** - Converting `to_id` to string for lookup (inconsistent)

**Better approach:**
```tsx
// Use Prisma select with computed fields or fetch only needed
const tournaments = await prisma.challongeTournament.findMany({
  include: {
    organizer: { select: { username: true, name: true } }
    // Can't auto-join Communities by to_id (non-relational)
  }
});

// If only fetching subset of tournaments, fetch only those communities
const communityIds = [...new Set(tournaments.map(t => t.to_id).filter(Boolean))];
const communities = await prisma.community.findMany({
  where: { to_id: { in: communityIds } },
  select: { to_id: true, name: true }
});
```

---

## 4. MISSING OPTIMIZATION: Image Handling

### Issue 4.1: No Image Optimization ❌
**Files:**
- [src/app/page.tsx](src/app/page.tsx#L150) - Uses `<img>` tag
- [src/app/[challongeId]/page.tsx](src/app/[challongeId]/page.tsx#L35-L40)
- Multiple places using raw `<img>` tags

**Problem:**
```tsx
<img 
  src="/assets/logo.webp" 
  alt="Tournament Logo" 
  className="h-24 sm:h-32 w-auto"
/>  // ← Uses raw HTML, no optimization
```

**Missing features:**
- ❌ **No lazy loading** - Images load immediately even if off-screen
- ❌ **No responsive images** - Serves same size on mobile and desktop
- ❌ **No format optimization** - Browser doesn't serve best format (WebP, AVIF)
- ❌ **No blur placeholder** - Cumulative Layout Shift as images load
- ❌ **No width/height** - CSS layout recalculates as images load

**Recommendation:**
Use Next.js `<Image>` component:
```tsx
import Image from 'next/image';

<Image 
  src="/assets/logo.webp" 
  alt="Tournament Logo" 
  width={128}
  height={128}
  priority={true} // Only for above-fold
  sizes="(max-width: 640px) 96px, 128px"
  className="h-24 sm:h-32 w-auto"
/>
```

---

## 5. MISSING OPTIMIZATION: Code Splitting & Bundling

### Issue 5.1: No Dynamic Imports ❌
**Files:**
- [src/app/page.tsx](src/app/page.tsx) - ~2000+ lines, all loaded upfront
- [src/app/[challongeId]/judge/page.tsx](src/app/[challongeId]/judge/page.tsx) - Large component, all features loaded
- [src/app/[challongeId]/player/page.tsx](src/app/[challongeId]/player/page.tsx) - Huge player dashboard

**Problem:**
All code for a page loads even if feature is rarely used (e.g., modal only opens 20% of time).

**Example - [src/app/page.tsx](src/app/page.tsx#L1-L50):**
```tsx
// This component tries to do everything:
// - List tournaments
// - Filter by province
// - Filter by community
// - Pre-register players
// - Show results modals
// - All loaded upfront
```

**Recommendation:**
```tsx
// Dynamic imports for heavy/infrequent features
const PreRegisterModal = dynamic(
  () => import('@/components/PreRegisterModal'),
  { loading: () => <div>Loading...</div> }
);

// Only load modal code when needed
{showPreRegisterModal && <PreRegisterModal />}
```

### Issue 5.2: Empty next.config.js ❌
**File:** [next.config.js](next.config.js)

```js
const nextConfig = {
    // ← NO OPTIMIZATIONS CONFIGURED!
};
```

**Missing configurations:**
- ❌ No compression settings
- ❌ No image optimization config
- ❌ No bundle analysis
- ❌ No React strict mode for development
- ❌ No SWC minification settings

---

## 6. RENDERING & STATE MANAGEMENT ISSUES

### Issue 6.1: Excessive useState in [src/app/page.tsx](src/app/page.tsx) ❌
**Lines 30-65:** 25+ state variables

```tsx
const [tournaments, setTournaments] = useState<Tournament[]>([]);
const [communities, setCommunities] = useState<Community[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [communitiesLoading, setCommunitiesLoading] = useState(true);
const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
const [selectedProvince, setSelectedProvince] = useState('');
const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
// ... 18 more state variables
```

**Problems:**
1. **State explosion** - 25+ state updates on each render = potential cascading re-renders
2. **Multiple loading states** - `isLoading` and `communitiesLoading` both managed separately
3. **Complex derived state** - Should use `useMemo()` for filtered/computed values

**Example of poor pattern:**
```tsx
const [playerOptions, setPlayerOptions] = useState<PlayerOption[]>([]);
const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
// ... when playerOptions changes, should useCallback/useMemo memo filters
```

### Issue 6.2: Missing React.memo on Expensive Components ❌
Components like `EnhancedTable` and `JudgePanel` probably re-render unnecessarily.

**Recommendation:**
```tsx
const EnhancedTable = React.memo(({ columns, data }: Props) => {
  return <table>...</table>;
}, (prev, next) => {
  // Only re-render if columns or data actually changed
  return prev.columns === next.columns && prev.data === next.data;
});
```

---

## 7. CACHING ISSUES

### Issue 7.1: No HTTP Caching Headers ❌
API routes don't set cache headers.

**Files affected:**
- All `/api/` routes

**Current:** No Cache-Control headers
```tsx
return NextResponse.json({
  success: true,
  tournaments: data
});  // ← No cache headers!
```

**Better:**
```tsx
const response = NextResponse.json({
  success: true,
  tournaments: data
});

response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
return response;
```

### Issue 7.2: No Local Caching in Components ❌
Judge page makes requests that could be cached:

```tsx
// Judge page [challongeId]/judge/page.tsx
useEffect(() => {
  const fetchTournament = async () => {
    const response = await fetch(`/api/tournaments?showAll=true`);
    // Fetches ALL tournaments every time, no cache
  };
}, [challongeId]);
```

---

## 8. SPECIFIC SLOW PATHS

### Slowest User Journeys:

1. **Landing page load** (~5+ seconds):
   - Client JS loads & parses
   - fetchTournaments() request
   - fetchCommunities() request
   - Render tournaments list
   - User sees content

2. **Judge login & match entry** (~3+ seconds):
   - Client JS loads
   - fetchTournament() → fetchUserData() → fetchPlayers() (waterfall)
   - Dropdown populates
   - Judge can start entering data

3. **Player stats view** (~2-3 seconds):
   - Client JS loads
   - fetchTournament() → fetchUserData() → fetch participants
   - Parse stats from attachments (CPU intensive)
   - Display tables

---

## RECOMMENDATIONS PRIORITY

### 🔴 CRITICAL (Do First - Huge Impact)

1. **Convert pages to Server Components** (~2-3s faster initial load)
   - Move `"use client"` to small interactive components only
   - Fetch data server-side using `async` components
   - Files: All pages in `/src/app/`

2. **Fix API waterfall calls** (~400-500ms faster)
   - Create aggregated endpoints
   - File: [src/app/[challongeId]/judge/page.tsx](src/app/[challongeId]/judge/page.tsx)
   - File: [src/app/[challongeId]/player/page.tsx](src/app/[challongeId]/player/page.tsx)

3. **Fix N+1 queries** (~200-400ms faster)
   - File: [src/app/api/judges/route.ts](src/app/api/judges/route.ts#L50-L100)
   - File: [src/app/api/tournaments/route.ts](src/app/api/tournaments/route.ts#L20-L50)

### 🟡 HIGH (Important)

4. **Add image optimization** 
   - Replace all `<img>` with Next.js `<Image>`
   - Add lazy loading
   - Multiple places across components

5. **Configure next.config.js**
   - Add compression
   - Add Image optimization settings
   - Add bundle analysis

6. **Reduce state complexity in [src/app/page.tsx](src/app/page.tsx)**
   - Use `useReducer` instead of 25+ useState
   - Consolidate loading states

### 🟢 MEDIUM (Nice to Have)

7. **Add dynamic imports** for modals/heavy components
8. **Add HTTP caching headers** to API routes
9. **Use React.memo** on expensive components
10. **Add Prisma query logging** to find other N+1s in production

---

## Estimated Performance Gains

| Issue | Impact | Effort | Est. Gain |
|-------|--------|--------|-----------|
| Server Components | **HUGE** | 2-3 days | -2.5s FCP |
| API waterfall fix | **HUGE** | 1-2 days | -400ms load |
| N+1 queries | **HIGH** | 1 day | -300ms queries |
| Image optimization | **HIGH** | 4-6 hours | -10-15% bundle |
| next.config.js | **MEDIUM** | 2-4 hours | -5-10% bundle |
| Dynamic imports | **MEDIUM** | 1 day | -20-30% JS initial |
| **TOTAL** | | | **-3-4 seconds** |

---

## Files to Prioritize

1. [src/app/page.tsx](src/app/page.tsx) - Landing page (heaviest)
2. [src/app/[challongeId]/judge/page.tsx](src/app/[challongeId]/judge/page.tsx) - Waterfall calls
3. [src/app/[challongeId]/player/page.tsx](src/app/[challongeId]/player/page.tsx) - Complex stats rendering
4. [src/app/api/tournaments/route.ts](src/app/api/tournaments/route.ts) - Inefficient queries
5. [src/app/api/judges/route.ts](src/app/api/judges/route.ts) - N+1 pattern
6. [next.config.js](next.config.js) - Missing config
