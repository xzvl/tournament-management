"use client";

import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';

interface ChallongePlayer {
  id: number;
  name: string;
}

interface Match {
  id: number;
  round: number;
  group_id: number | null;
  player1_id: number;
  player2_id: number;
  player1_name: string;
  player2_name: string;
  winner_id: number | null;
  loser_id: number | null;
  scores_csv: string;
  state: string;
  identifier: string;
}

export default function PlayerPage() {
  const params = useParams();
  const challongeId = params.challongeId as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toId, setToId] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [challongeUsername, setChallongeUsername] = useState<string | null>(null);
  const [players, setPlayers] = useState<ChallongePlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<ChallongePlayer | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<'standings' | 'matches'>('matches');
  const [activeMainTab, setActiveMainTab] = useState<'upcoming' | 'recent' | 'group-ranking' | 'group-stage' | 'final-stage'>('upcoming');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [matchAttachmentDescriptions, setMatchAttachmentDescriptions] = useState<Record<number, string[]>>({});
  const [matchAttachmentText, setMatchAttachmentText] = useState<Record<number, string[]>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const playerDropdownRef = useRef<HTMLDivElement>(null);
  const ignoreUrlSyncRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const normalizeName = (value?: string | null) =>
    (value || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const parseFinishStats = (description: string) => {
    const entries: Array<{
      name: string;
      spin: number;
      over: number;
      burst: number;
      extreme: number;
      penalty: number;
    }> = [];

    const normalizedDescription = description
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\s*Finishes\s*[–—-]\s*/i, '');
    const regex = /(?:\d+\.\s*)?([^:]+):\s*\[([^\]]+)\]/g;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(normalizedDescription)) !== null) {
      const rawName = match[1]?.trim() ?? '';
      // Strip leading pipe and any surrounding whitespace
      const name = rawName.replace(/^\|?\s*/, '').replace(/\s*\|?\s*$/, '').trim();
      const statsPart = match[2] ?? '';
      const statMap: Record<string, number> = {};
      statsPart.split(',').forEach((pair) => {
        const [label, value] = pair.split(':').map((v) => v.trim());
        if (!label) return;
        const num = Number(value);
        statMap[normalizeName(label)] = Number.isFinite(num) ? num : 0;
      });

      entries.push({
        name,
        spin: statMap.spin ?? 0,
        over: statMap.over ?? 0,
        burst: statMap.burst ?? 0,
        extreme: statMap.extreme ?? 0,
        penalty: statMap.penalty ?? 0
      });
    }

    return entries;
  };
  const isEditingPlayer = showPlayerDropdown || playerSearchTerm.length > 0;
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = () => {
    if (!scrollContainerRef.current) return;
    isDragging.current = false;
    scrollContainerRef.current.style.cursor = 'grab';
    scrollContainerRef.current.style.userSelect = 'auto';
  };

  const handleMouseUp = () => {
    if (!scrollContainerRef.current) return;
    isDragging.current = false;
    scrollContainerRef.current.style.cursor = 'grab';
    scrollContainerRef.current.style.userSelect = 'auto';
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Multiply by 2 for faster scrolling
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };
  const setPlayerParam = (name: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (name) {
      nextParams.set('player', name);
    } else {
      nextParams.delete('player');
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const paramName = searchParams.get('player');
    if (selectedPlayer) {
      setHighlightedPlayer(selectedPlayer.name);
      if (normalizeName(paramName) !== normalizeName(selectedPlayer.name)) {
        setPlayerParam(selectedPlayer.name);
      } else {
        ignoreUrlSyncRef.current = false;
      }
      return;
    }
    if (!paramName) {
      setHighlightedPlayer(null);
      setPlayerParam(null);
    }
  }, [selectedPlayer, searchParams]);

  useEffect(() => {
    const paramName = searchParams.get('player');
    if (ignoreUrlSyncRef.current) {
      if (!paramName) {
        ignoreUrlSyncRef.current = false;
      }
      return;
    }
    if (isEditingPlayer) return;
    if (!paramName || players.length === 0) return;
    const normalizedParam = normalizeName(paramName);
    const currentSelected = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
    if (normalizedParam === currentSelected) return;
    const matched = players.find((p) => normalizeName(p.name) === normalizedParam);
    if (matched) {
      setSelectedPlayer(matched);
      setPlayerSearchTerm('');
    } else {
      setSelectedPlayer(null);
      setHighlightedPlayer(null);
      setPlayerSearchTerm(paramName);
    }
  }, [players, searchParams, selectedPlayer, isEditingPlayer]);


  useEffect(() => {
    const fetchTournament = async () => {
      try {
        // Query the API endpoint directly with the challongeId
        const response = await fetch(`/api/tournaments?showAll=true`);
        const data = await response.json();
        
        if (data.success && data.tournaments) {
          const tournament = data.tournaments.find((t: any) => t.challonge_id === challongeId);
          if (tournament) {
            setToId(tournament.to_id);
          } else {
            setError('Tournament not found');
          }
        }
      } catch (err) {
        setError('Failed to fetch tournament data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (challongeId) {
      fetchTournament();
    }
  }, [challongeId]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!toId) return;

      try {
        const response = await fetch(`/api/users/${toId}`);
        const data = await response.json();

        if (data.success && data.user) {
          setApiKey(data.user.api_key);
          setChallongeUsername(data.user.challonge_username);
        } else {
          setError('Failed to fetch user data');
        }
      } catch (err) {
        setError('Failed to fetch user data');
        console.error(err);
      }
    };

    if (toId) {
      fetchUserData();
    }
  }, [toId]);

  // Fetch players from Challonge API
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!apiKey || !challongeId) return;

      try {
        const response = await fetch(
          `/api/challonge/participants?challongeId=${challongeId}&apiKey=${apiKey}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.participants) {
            const playersList = data.participants.map((p: any) => ({
              id: p.participant.id,
              name: p.participant.name || p.participant.display_name || 'Unknown Player'
            }));
            setPlayers(playersList);
          }
        } else {
          console.error('Failed to fetch players from Challonge');
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      }
    };

    if (apiKey) {
      fetchPlayers();
    }
  }, [apiKey, challongeId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (playerDropdownRef.current && !playerDropdownRef.current.contains(event.target as Node)) {
        setShowPlayerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter players based on search term
  const filteredPlayers = useMemo(() => {
    if (!playerSearchTerm) return players;
    return players.filter(player =>
      player.name.toLowerCase().includes(playerSearchTerm.toLowerCase())
    );
  }, [players, playerSearchTerm]);

  // Fetch matches when apiKey is available
  useEffect(() => {
    const fetchMatches = async () => {
      if (!apiKey || !challongeId) return;

      try {
        const response = await fetch(
          `/api/challonge/matches?challongeId=${challongeId}&apiKey=${apiKey}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.matches && data.participants) {
            // Build ID to name map: use group_player_ids if group_id in matches is not null, else use participant id
            const pidToName: { [key: number]: string } = {};
            
            data.participants.forEach((p: any) => {
              const participant = p.participant;
              const name = participant.name;
              const participantId = participant.id;
              const groupPlayerIds = participant.group_player_ids || [];
              
              // Map all group player IDs to the name
              if (Array.isArray(groupPlayerIds) && groupPlayerIds.length > 0) {
                groupPlayerIds.forEach((gid: number) => {
                  pidToName[gid] = name;
                });
              }
              
              // Always map participant id as fallback
              pidToName[participantId] = name;
            });
            
            // Map all matches
            const allMatches = data.matches.map((m: any) => {
              const match = m.match;
              const player1Name = pidToName[match.player1_id] || 'TBD';
              const player2Name = pidToName[match.player2_id] || 'TBD';
              
              return {
                id: match.id,
                round: match.round,
                group_id: match.group_id,
                player1_id: match.player1_id,
                player2_id: match.player2_id,
                player1_name: player1Name,
                player2_name: player2Name,
                winner_id: match.winner_id,
                loser_id: match.loser_id,
                scores_csv: match.scores_csv || '',
                state: match.state,
                identifier: match.identifier
              };
            });
            
            setMatches(allMatches);
          }
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
      }
    };

    if (apiKey && challongeId) {
      fetchMatches();
    }
  }, [apiKey, challongeId]);

  // Group stage matches (have group_id)
  const groupStageMatches = useMemo(() => {
    return matches.filter(m => m.group_id !== null && m.group_id !== undefined);
  }, [matches]);

  // Get unique rounds from group stage
  const groupRounds = useMemo(() => {
    const rounds = [...new Set(groupStageMatches.map(m => Math.abs(m.round)))].sort((a, b) => a - b);
    return rounds;
  }, [groupStageMatches]);

  const groupIds = useMemo(() => {
    const ids = [...new Set(groupStageMatches.map((m) => m.group_id).filter((id): id is number => id !== null && id !== undefined))];
    ids.sort((a, b) => a - b);
    return ids;
  }, [groupStageMatches]);

  const groupNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    groupIds.forEach((gid, index) => {
      map[gid] = String.fromCharCode(65 + index);
    });
    return map;
  }, [groupIds]);

  const finalStageMatches = useMemo(() => {
    return matches.filter((m) => m.group_id === null || m.group_id === undefined);
  }, [matches]);


  const upcomingMatches = useMemo(() => {
    const filtered = matches.filter((m) => m.state !== 'complete');
    if (!selectedPlayer) return filtered;
    const name = normalizeName(selectedPlayer.name);
    return filtered.filter(
      (m) => normalizeName(m.player1_name) === name || normalizeName(m.player2_name) === name
    );
  }, [matches, selectedPlayer]);

  const recentMatches = useMemo(() => {
    const filtered = matches.filter((m) => m.state === 'complete');
    const scoped = selectedPlayer
      ? filtered.filter(
          (m) =>
            normalizeName(m.player1_name) === normalizeName(selectedPlayer.name) ||
            normalizeName(m.player2_name) === normalizeName(selectedPlayer.name)
        )
      : filtered;
    return scoped.slice().sort((a, b) => b.id - a.id);
  }, [matches, selectedPlayer]);

  useEffect(() => {
    if (selectedPlayer) {
      if (upcomingMatches.length > 0) {
        setActiveMainTab('upcoming');
        return;
      }
      if (recentMatches.length > 0) {
        setActiveMainTab('recent');
        return;
      }
      if (finalStageMatches.length > 0) {
        setActiveMainTab('final-stage');
      } else {
        setActiveMainTab('group-stage');
      }
      return;
    }

    // When no player is selected, default to final-stage if available, otherwise group-stage
    if (finalStageMatches.length > 0) {
      setActiveMainTab('final-stage');
    } else {
      setActiveMainTab('group-stage');
    }
  }, [selectedPlayer, upcomingMatches.length, recentMatches.length, finalStageMatches.length]);

  useEffect(() => {
    const fetchAttachmentDescriptions = async () => {
      if (!apiKey || !challongeId || recentMatches.length === 0) return;

      const entries = await Promise.all(
        recentMatches.map(async (match) => {
          try {
            const response = await fetch(
              `/api/challonge/attachments?challongeId=${challongeId}&matchId=${match.id}&apiKey=${apiKey}`
            );
            if (!response.ok) return [match.id, [], []] as const;
            const data = await response.json();

            const attachments = Array.isArray(data.attachments) ? data.attachments : [];
            const screenshotAttachments = attachments.filter((item: any) => {
              const desc = item?.match_attachment?.description;
              return typeof desc === 'string' && desc.includes('Match Screenshot');
            });
            const finishAttachments = attachments.filter((item: any) => {
              const desc = item?.match_attachment?.description;
              if (typeof desc !== 'string') return false;
              const normalizedDesc = desc
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (/match screenshot/i.test(normalizedDesc)) return false;
              return /finishes/i.test(normalizedDesc) || /:\s*\[[^\]]+\]/.test(normalizedDesc);
            });

            const assets = screenshotAttachments
              .map((item: any) => item?.match_attachment?.asset_url)
              .filter((asset: unknown): asset is string => typeof asset === 'string' && asset.trim().length > 0);

            const texts = finishAttachments
              .map((item: any) => item?.match_attachment?.description)
              .filter((desc: unknown): desc is string => typeof desc === 'string' && desc.trim().length > 0);

            return [match.id, assets, texts] as const;
          } catch {
            return [match.id, [], []] as const;
          }
        })
      );

      const assetMap: Record<number, string[]> = {};
      const textMap: Record<number, string[]> = {};
      entries.forEach(([matchId, assets, texts]) => {
        if (assets.length > 0) {
          assetMap[matchId] = assets;
        }
        if (texts.length > 0) {
          console.log(`Match ${matchId} finish texts:`, texts);
          textMap[matchId] = texts;
        }
      });

      console.log('All finish textMap:', textMap);
      setMatchAttachmentDescriptions(assetMap);
      setMatchAttachmentText(textMap);
    };

    fetchAttachmentDescriptions();
  }, [recentMatches, apiKey, challongeId]);

  const playerMatchStats = useMemo(() => {
    if (!selectedPlayer) return null;
    const playerName = normalizeName(selectedPlayer.name);
    const completed = matches.filter(
      (match) =>
        match.state === 'complete' &&
        (normalizeName(match.player1_name) === playerName || normalizeName(match.player2_name) === playerName)
    );
    const wins = completed.filter((match) => {
      const isPlayer1 = normalizeName(match.player1_name) === playerName;
      const isPlayer2 = normalizeName(match.player2_name) === playerName;
      return (
        (isPlayer1 && match.winner_id === match.player1_id) ||
        (isPlayer2 && match.winner_id === match.player2_id)
      );
    }).length;
    const totalMatches = completed.length;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    return {
      totalMatches,
      winRate: Number(winRate.toFixed(1))
    };
  }, [matches, selectedPlayer]);

  const playerFinishStats = useMemo(() => {
    if (!selectedPlayer) return null;
    const playerName = normalizeName(selectedPlayer.name);
    const totals = { spin: 0, over: 0, burst: 0, extreme: 0, penalty: 0 };
    const matchesWithStats = new Set<number>();

    console.log('=== Computing stats for:', selectedPlayer.name, '===');
    console.log('matchAttachmentText:', matchAttachmentText);

    Object.entries(matchAttachmentText).forEach(([matchId, descriptions]) => {
      descriptions.forEach((description) => {
        console.log(`\nMatch ${matchId} description:`, description);
        const entries = parseFinishStats(description);
        console.log('Parsed entries:', entries);
        entries.forEach((entry) => {
          const entryNameNorm = normalizeName(entry.name);
          console.log(`  Checking: "${entry.name}" (norm: "${entryNameNorm}") vs "${playerName}"`);
          if (entryNameNorm !== playerName) return;
          console.log(`  ✓ MATCH! Adding:`, entry);
          totals.spin += entry.spin;
          totals.over += entry.over;
          totals.burst += entry.burst;
          totals.extreme += entry.extreme;
          totals.penalty += entry.penalty;
          matchesWithStats.add(Number(matchId));
        });
      });
    });

    console.log('Final totals:', totals);
    return {
      ...totals,
      matchesWithStats: matchesWithStats.size
    };
  }, [matchAttachmentText, selectedPlayer]);

  const finishTotal = useMemo(() => {
    if (!playerFinishStats) return 0;
    return (
      playerFinishStats.spin +
      playerFinishStats.over +
      playerFinishStats.burst +
      playerFinishStats.extreme +
      playerFinishStats.penalty
    );
  }, [playerFinishStats]);

  const selectedGroupId = useMemo(() => {
    if (!selectedPlayer) return null;
    const playerName = normalizeName(selectedPlayer.name);
    const match = groupStageMatches.find(
      (m) => normalizeName(m.player1_name) === playerName || normalizeName(m.player2_name) === playerName
    );
    return match?.group_id ?? null;
  }, [selectedPlayer, groupStageMatches]);

  const selectedGroupMatches = useMemo(() => {
    if (selectedGroupId === null) return [];
    return groupStageMatches.filter((m) => m.group_id === selectedGroupId);
  }, [selectedGroupId, groupStageMatches]);

  const finalStageRounds = useMemo(() => {
    return [...new Set(finalStageMatches.map((m) => Math.abs(m.round)))].sort((a, b) => a - b);
  }, [finalStageMatches]);

  const computeStandings = (matchesForGroup: Match[]) => {
    const stats: Record<string, { wins: number; losses: number; pf: number; pa: number; matches: number; opponents: string[] }> = {};

    matchesForGroup.forEach((match) => {
      if (match.state !== 'complete') return;

      const p1 = match.player1_name || 'Unknown';
      const p2 = match.player2_name || 'Unknown';

      if (!stats[p1]) {
        stats[p1] = { wins: 0, losses: 0, pf: 0, pa: 0, matches: 0, opponents: [] };
      }
      if (!stats[p2]) {
        stats[p2] = { wins: 0, losses: 0, pf: 0, pa: 0, matches: 0, opponents: [] };
      }

      stats[p1].matches += 1;
      stats[p2].matches += 1;
      stats[p1].opponents.push(p2);
      stats[p2].opponents.push(p1);

      const scores = match.scores_csv ? match.scores_csv.split('-') : [];
      const p1Score = scores.length > 0 ? Number(scores[0]) : 0;
      const p2Score = scores.length > 1 ? Number(scores[1]) : 0;

      stats[p1].pf += p1Score;
      stats[p1].pa += p2Score;
      stats[p2].pf += p2Score;
      stats[p2].pa += p1Score;

      if (match.winner_id === match.player1_id) {
        stats[p1].wins += 1;
        stats[p2].losses += 1;
      } else if (match.winner_id === match.player2_id) {
        stats[p2].wins += 1;
        stats[p1].losses += 1;
      }
    });

    const buchholz: Record<string, number> = {};
    Object.keys(stats).forEach((name) => {
      const opponentPoints = stats[name].opponents.reduce((sum, opp) => {
        return sum + (stats[opp]?.pf ?? 0);
      }, 0);
      buchholz[name] = opponentPoints;
    });

    const standings = Object.entries(stats).map(([name, s]) => {
      const diff = s.pf - s.pa;
      const wr = s.matches > 0 ? (s.wins / s.matches) * 100 : 0;
      return {
        name,
        wins: s.wins,
        losses: s.losses,
        pf: s.pf,
        pa: s.pa,
        diff,
        buch: buchholz[name] ?? 0,
        wr: Number(wr.toFixed(1))
      };
    });

    standings.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.diff !== b.diff) return b.diff - a.diff;
      if (a.pf !== b.pf) return b.pf - a.pf;
      return b.buch - a.buch;
    });

    return standings;
  };

  const selectedGroupStandings = useMemo(() => {
    return selectedGroupMatches.length > 0 ? computeStandings(selectedGroupMatches) : [];
  }, [selectedGroupMatches]);

  const groupStandings = useMemo(() => {
    const stats: Record<string, { wins: number; losses: number; pf: number; pa: number; matches: number; opponents: string[] }> = {};

    groupStageMatches.forEach((match) => {
      if (match.state !== 'complete') return;

      const p1 = match.player1_name || 'Unknown';
      const p2 = match.player2_name || 'Unknown';

      if (!stats[p1]) {
        stats[p1] = { wins: 0, losses: 0, pf: 0, pa: 0, matches: 0, opponents: [] };
      }
      if (!stats[p2]) {
        stats[p2] = { wins: 0, losses: 0, pf: 0, pa: 0, matches: 0, opponents: [] };
      }

      stats[p1].matches += 1;
      stats[p2].matches += 1;
      stats[p1].opponents.push(p2);
      stats[p2].opponents.push(p1);

      const scores = match.scores_csv ? match.scores_csv.split('-') : [];
      const p1Score = scores.length > 0 ? Number(scores[0]) : 0;
      const p2Score = scores.length > 1 ? Number(scores[1]) : 0;

      stats[p1].pf += p1Score;
      stats[p1].pa += p2Score;
      stats[p2].pf += p2Score;
      stats[p2].pa += p1Score;

      if (match.winner_id === match.player1_id) {
        stats[p1].wins += 1;
        stats[p2].losses += 1;
      } else if (match.winner_id === match.player2_id) {
        stats[p2].wins += 1;
        stats[p1].losses += 1;
      }
    });

    const buchholz: Record<string, number> = {};
    Object.keys(stats).forEach((name) => {
      const opponentPoints = stats[name].opponents.reduce((sum, opp) => {
        return sum + (stats[opp]?.pf ?? 0);
      }, 0);
      buchholz[name] = opponentPoints;
    });

    const standings = Object.entries(stats).map(([name, s]) => {
      const diff = s.pf - s.pa;
      const wr = s.matches > 0 ? (s.wins / s.matches) * 100 : 0;
      return {
        name,
        wins: s.wins,
        losses: s.losses,
        pf: s.pf,
        pa: s.pa,
        diff,
        buch: buchholz[name] ?? 0,
        wr: Number(wr.toFixed(1))
      };
    });

    standings.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.diff !== b.diff) return b.diff - a.diff;
      if (a.pf !== b.pf) return b.pf - a.pf;
      return b.buch - a.buch;
    });

    return standings;
  }, [groupStageMatches]);

  const playerGroupStats = useMemo(() => {
    if (!selectedPlayer) return null;

    const playerName = normalizeName(selectedPlayer.name);
    const playerMatches = groupStageMatches.filter(
      (match) =>
        normalizeName(match.player1_name) === playerName ||
        normalizeName(match.player2_name) === playerName
    );

    if (playerMatches.length === 0) return null;

    const playerGroupId = playerMatches[0].group_id;
    const groupMatches = groupStageMatches.filter((m) => m.group_id === playerGroupId);
    const standings = computeStandings(groupMatches);
    const playerStanding = standings.find((s) => normalizeName(s.name) === playerName);

    if (!playerStanding) return null;

    const position = standings.findIndex((s) => normalizeName(s.name) === playerName) + 1;

    return {
      position,
      wins: playerStanding.wins,
      losses: playerStanding.losses,
      pf: playerStanding.pf,
      pa: playerStanding.pa,
      diff: playerStanding.diff,
      winRate: playerStanding.wr,
    };
  }, [selectedPlayer, groupStageMatches]);

  const playerFinalStats = useMemo(() => {
    if (!selectedPlayer) return null;

    const playerName = normalizeName(selectedPlayer.name);
    // Final stage matches have no group_id (group_id is null)
    const finalMatches = matches.filter(
      (match) =>
        (match.group_id === null || match.group_id === undefined) &&
        (normalizeName(match.player1_name) === playerName ||
         normalizeName(match.player2_name) === playerName)
    );

    if (finalMatches.length === 0) return null;

    let wins = 0;
    let losses = 0;
    let pf = 0;
    let pa = 0;

    finalMatches.forEach((match) => {
      const scores = match.scores_csv ? match.scores_csv.split('-') : [];
      const p1Score = scores.length > 0 ? Number(scores[0]) : 0;
      const p2Score = scores.length > 1 ? Number(scores[1]) : 0;

      const isPlayer1 = normalizeName(match.player1_name) === playerName;

      if (isPlayer1) {
        pf += p1Score;
        pa += p2Score;
        if (match.winner_id === match.player1_id) wins += 1;
        else if (match.winner_id === match.player2_id) losses += 1;
      } else {
        pf += p2Score;
        pa += p1Score;
        if (match.winner_id === match.player2_id) wins += 1;
        else if (match.winner_id === match.player1_id) losses += 1;
      }
    });

    const diff = pf - pa;
    const total = wins + losses;
    const wr = total > 0 ? (wins / total) * 100 : 0;

    return {
      wins,
      losses,
      pf,
      pa,
      diff,
      winRate: Number(wr.toFixed(1)),
    };
  }, [selectedPlayer, matches]);

  const playerFinalPosition = useMemo(() => {
    if (!selectedPlayer || !playerFinalStats) return null;

    const playerName = normalizeName(selectedPlayer.name);
    const finalMatches = matches.filter(
      (match) =>
        (match.group_id === null || match.group_id === undefined) &&
        match.state === 'complete'
    );

    if (finalMatches.length === 0) return null;

    // Calculate standings from final matches
    const finalStandings = computeStandings(finalMatches);
    const playerFinalStanding = finalStandings.find((s) => normalizeName(s.name) === playerName);

    if (!playerFinalStanding) return null;

    const position = finalStandings.findIndex((s) => normalizeName(s.name) === playerName) + 1;
    return position;
  }, [selectedPlayer, playerFinalStats, matches]);

  const getFinalPositionLabel = (position: number): string => {
    if (position === 1) return 'Champion';
    if (position === 2) return '1st Runner Up';
    if (position === 3) return '2nd Runner Up';
    if (position === 4) return '3rd Runner Up';
    if (position >= 5 && position <= 8) return 'Top 8';
    if (position >= 9 && position <= 16) return 'Top 16';
    if (position >= 17 && position <= 32) return 'Top 32';
    if (position >= 33 && position <= 64) return 'Top 64';
    return 'Participant';
  };

  const getFinalPositionTheme = (position: number): { bg: string; border: string; text: string } => {
    if (position === 1) {
      return { bg: 'bg-yellow-900/40', border: 'border-yellow-600', text: 'text-yellow-400' };
    }
    if (position === 2) {
      return { bg: 'bg-gray-700/40', border: 'border-gray-400', text: 'text-gray-300' };
    }
    if (position === 3) {
      return { bg: 'bg-orange-900/40', border: 'border-orange-600', text: 'text-orange-400' };
    }
    return { bg: 'bg-black/30', border: 'border-[#292524]', text: 'text-white' };
  };

  const isMatchHighlighted = (match: Match) => {
    return (
      highlightedPlayer &&
      (normalizeName(match.player1_name) === normalizeName(highlightedPlayer) ||
        normalizeName(match.player2_name) === normalizeName(highlightedPlayer))
    );
  };

  const getMatchScores = (match: Match) => {
    const scores = match.scores_csv ? match.scores_csv.split('-') : [];
    return {
      player1Score: scores.length > 0 ? scores[0] : '-',
      player2Score: scores.length > 1 ? scores[1] : '-'
    };
  };

  const getFinalStageRoundLabel = (round: number): string => {
    if (round === 0) return 'Placement Match';
    
    // Get the max round from finalStageMatches to determine position from end
    const finalRounds = [...new Set(finalStageMatches.map((m) => Math.abs(m.round)))];
    const maxRound = Math.max(...finalRounds);
    const positionFromEnd = maxRound - Math.abs(round);
    
    switch (positionFromEnd) {
      case 0:
        return 'Finals';
      case 1:
        return 'Semi Finals';
      case 2:
        return 'Quarter Finals';
      case 3:
        return 'Top 16';
      case 4:
        return 'Top 32';
      case 5:
        return 'Top 64';
      case 6:
        return 'Top 128';
      default:
        return `Round ${Math.abs(round)}`;
    }
  };

  const getFinalStageRoundSortKey = (round: number): number => {
    // Sort order: Top 64, Top 32, Quarter Finals, Semi Finals, Placement Match, Finals
    if (round === 0) return 1; // Placement Match
    
    const finalRounds = [...new Set(finalStageMatches.map((m) => Math.abs(m.round)))];
    const maxRound = Math.max(...finalRounds);
    const positionFromEnd = maxRound - Math.abs(round);
    
    switch (positionFromEnd) {
      case 0:
        return 0; // Finals (last)
      case 1:
        return 2; // Semi Finals
      case 2:
        return 3; // Quarter Finals
      case 3:
        return 4; // Top 16
      case 4:
        return 5; // Top 32
      case 5:
        return 6; // Top 64
      case 6:
        return 7; // Top 128
      default:
        return 8;
    }
  };

  const mainTabs = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'recent', label: 'Recent' },
    { key: 'group-ranking', label: 'Group Ranking' },
    { key: 'group-stage', label: 'Group Stage' },
    { key: 'final-stage', label: 'Final Stage' }
  ] as const;

  const visibleTabs = selectedPlayer 
    ? mainTabs 
    : mainTabs.filter(tab => !['upcoming', 'recent', 'group-ranking'].includes(tab.key));

  return (
    <>
      <main className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top bg-no-repeat p-4 sm:p-6 lg:p-8 pb-32 has-sticky-footer text-white">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="bg-[#1c1917] border-2 border-[#292524] p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left Side - Title */}
              <h1 className="text-3xl font-bold">Player Dashboard</h1>

              {/* Right Side - Player Dropdown */}
              {mounted && (
                <div className="relative w-full md:w-80" ref={playerDropdownRef}>
                  <input
                    type="text"
                    placeholder="Select Player"
                    value={selectedPlayer ? selectedPlayer.name : playerSearchTerm}
                    onChange={(e) => {
                      ignoreUrlSyncRef.current = true;
                      setPlayerSearchTerm(e.target.value);
                      setSelectedPlayer(null);
                      setHighlightedPlayer(null);
                      setPlayerParam(null);
                      setShowPlayerDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (selectedPlayer && (e.key === 'Backspace' || e.key === 'Delete')) {
                        e.preventDefault();
                        ignoreUrlSyncRef.current = true;
                        setSelectedPlayer(null);
                        setHighlightedPlayer(null);
                        setPlayerParam(null);
                        setPlayerSearchTerm('');
                        setShowPlayerDropdown(true);
                      }
                    }}
                    onFocus={() => setShowPlayerDropdown(true)}
                    className="w-full px-4 py-2 bg-white/10 border-2 border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  
                  {showPlayerDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-black/95 border-2 border-red-500 rounded max-h-60 overflow-y-auto">
                      {filteredPlayers.length > 0 ? (
                        filteredPlayers.map((player) => (
                          <div
                            key={player.id}
                            onClick={() => {
                              ignoreUrlSyncRef.current = true;
                              setSelectedPlayer(player);
                              setHighlightedPlayer(player.name);
                              setPlayerParam(player.name);
                              setPlayerSearchTerm('');
                              setShowPlayerDropdown(false);
                            }}
                            className="px-4 py-2 hover:bg-red-500/20 cursor-pointer transition-colors text-white border-b border-white/10 last:border-b-0"
                          >
                            {player.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-white/50">
                          {players.length === 0 ? 'Loading players...' : 'No players found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Group Stage Ranking Section - Show when player selected */}
          {selectedPlayer && playerGroupStats && (
            <div className="bg-[#1c1917] border-2 border-[#292524] p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Tournament Ranking</h2>
              <div className="bg-black/30 border border-[#292524] p-6 rounded">
                <div className="grid grid-cols-4 lg:grid-cols-6 gap-4">
                  {playerFinalPosition && (
                    <div className="text-center col-span-2 lg:col-span-1">
                      <div className={`text-xs lg:text-sm mb-2 ${getFinalPositionTheme(playerFinalPosition).text}`}>Final Position</div>
                      <div className={`text-xl lg:text-2xl font-bold ${getFinalPositionTheme(playerFinalPosition).text}`}>{getFinalPositionLabel(playerFinalPosition)}</div>
                    </div>
                  )}
                  <div className={`text-center ${playerFinalPosition ? 'col-span-2 lg:col-span-1' : 'col-span-4 lg:col-span-1'}`}>
                    <div className="text-xs lg:text-sm mb-2 text-white/60">Group Position</div>
                    <div className="text-xl lg:text-2xl font-bold text-white">#{playerGroupStats.position}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs lg:text-sm mb-2 text-white/60">W-L</div>
                    <div className="text-lg md:text-xl lg:text-2xl font-bold text-white">{playerGroupStats.wins}-{playerGroupStats.losses}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs lg:text-sm mb-2 text-white/60">Diff</div>
                    <div className={`text-lg md:text-xl lg:text-2xl font-bold ${playerGroupStats.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {playerGroupStats.diff >= 0 ? '+' : ''}{playerGroupStats.diff}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs lg:text-sm mb-2 text-white/60">PF-PA</div>
                    <div className="text-lg md:text-xl lg:text-2xl font-bold text-white">{playerGroupStats.pf}-{playerGroupStats.pa}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs lg:text-sm mb-2 text-white/60">Win Rate</div>
                    <div className="text-lg md:text-xl lg:text-2xl font-bold text-white">{playerGroupStats.winRate}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Player Statistics Section */}
          {selectedPlayer && (
            <div className="bg-[#1c1917] border-2 border-[#292524] p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Player Statistics</h2>
              <div className="">
                <div className="space-y-3">
                  {([
                    { label: 'Spin Finishes', value: playerFinishStats?.spin ?? 0 },
                    { label: 'Over Finishes', value: playerFinishStats?.over ?? 0 },
                    { label: 'Burst Finishes', value: playerFinishStats?.burst ?? 0 },
                    { label: 'Extreme Finishes', value: playerFinishStats?.extreme ?? 0 },
                    { label: 'Penalty Points', value: playerFinishStats?.penalty ?? 0 }
                  ]).map((item) => (
                    <div key={item.label} className="bg-black/30 border border-[#292524] rounded p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs lg:text-sm text-white/70">
                        <span>{item.label}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded">
                        <div
                          className="h-2 bg-red-500 rounded"
                          style={{ width: `${finishTotal > 0 ? (item.value / finishTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="bg-black/30 border border-[#292524] rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs lg:text-sm text-white/70">
                      <span>Total Matches</span>
                      <span className="text-sm font-semibold text-white">{playerMatchStats?.totalMatches ?? 0}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded">
                      <div className="h-2 bg-red-500 rounded" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="bg-black/30 border border-[#292524] rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs lg:text-sm text-white/70">
                      <span>Win Rate</span>
                      <span className="text-sm font-semibold text-white">{playerMatchStats?.winRate ?? 0}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded">
                      <div
                        className="h-2 bg-red-500 rounded"
                        style={{ width: `${playerMatchStats?.winRate ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Tabs */}
          <div className="bg-[#1c1917] border-2 border-[#292524] p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveMainTab(tab.key)}
                  className={`px-4 py-2 rounded border text-sm font-semibold transition ${
                    activeMainTab === tab.key
                      ? 'bg-red-500/20 border-red-500 text-red-400'
                      : 'bg-black/30 border-[#292524] text-white/70 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Matches */}
          {activeMainTab === 'upcoming' && (
            <div className="space-y-6">
              {/* Final Stage Upcoming Matches */}
              {upcomingMatches.filter(m => m.group_id === null || m.group_id === undefined).length > 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <h2 className="text-2xl font-bold mb-4 text-white">Final Stage</h2>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-[#292524]">
                      <thead className="bg-black/50">
                        <tr className="text-left text-xs md:text-sm uppercase tracking-wider text-white/70">
                          <th className="px-3 py-3 border-b border-[#292524]">Round</th>
                          <th className="px-3 py-3 border-b border-[#292524]">Match</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Score</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Result</th>
                          <th className="px-3 py-3 border-b border-[#292524] w-[30px]">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody className="bg-black/30">
                        {upcomingMatches
                          .filter(m => m.group_id === null || m.group_id === undefined)
                          .map((match) => {
                            const { player1Score, player2Score } = getMatchScores(match);
                            const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                            const isPlayer1 = normalizeName(match.player1_name) === playerName;
                            const isPlayer2 = normalizeName(match.player2_name) === playerName;
                            const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                             (isPlayer2 && match.winner_id === match.player2_id);

                            return (
                              <tr key={match.id} className="border-b border-[#292524] hover:bg-black/50 transition-colors">
                                <td className="px-3 py-3 text-white text-sm">
                                  <span className="text-white text-sm font-semibold">{getFinalStageRoundLabel(match.round)}</span>
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player1_name}
                                  </span>
                                  <span className="text-white/60 mx-2">vs</span>
                                  <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player2_name}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {(isPlayer1 || isPlayer2) && match.winner_id ? (
                                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                                      playerWon 
                                        ? 'bg-green-600 text-green-100' 
                                        : 'bg-red-600 text-red-100'
                                    }`}>
                                      {playerWon ? 'WON' : 'LOST'}
                                    </span>
                                  ) : (
                                    <span className="text-white/40 text-xs">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm text-white/70 w-[30px]">
                                  <span className="text-white/40 text-xs">-</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {upcomingMatches
                      .filter(m => m.group_id === null || m.group_id === undefined)
                      .map((match) => {
                        const { player1Score, player2Score } = getMatchScores(match);
                        const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                        const isPlayer1 = normalizeName(match.player1_name) === playerName;
                        const isPlayer2 = normalizeName(match.player2_name) === playerName;
                        const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                         (isPlayer2 && match.winner_id === match.player2_id);

                        return (
                          <div key={match.id} className="bg-black/30 border border-[#292524] p-4 rounded space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="text-white text-sm font-semibold">{getFinalStageRoundLabel(match.round)}</span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player1_name}
                                </span>
                                <span className="text-white/60 mx-2">vs</span>
                                <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player2_name}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-white/70">
                                <span>
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </span>
                                {(isPlayer1 || isPlayer2) && match.winner_id ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    playerWon 
                                      ? 'bg-green-600 text-green-100' 
                                      : 'bg-red-600 text-red-100'
                                  }`}>
                                    {playerWon ? 'WON' : 'LOST'}
                                  </span>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}

              {/* Group Stage Upcoming Matches */}
              {upcomingMatches.filter(m => m.group_id !== null && m.group_id !== undefined).length > 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <h2 className="text-2xl font-bold mb-4 text-white">Group Stage</h2>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-[#292524]">
                      <thead className="bg-black/50">
                        <tr className="text-left text-xs md:text-sm uppercase tracking-wider text-white/70">
                          <th className="px-3 py-3 border-b border-[#292524]">Round</th>
                          <th className="px-3 py-3 border-b border-[#292524]">Match</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Score</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Result</th>
                          <th className="px-3 py-3 border-b border-[#292524] w-[30px]">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody className="bg-black/30">
                        {upcomingMatches
                          .filter(m => m.group_id !== null && m.group_id !== undefined)
                          .map((match) => {
                            const { player1Score, player2Score } = getMatchScores(match);
                            const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                            const isPlayer1 = normalizeName(match.player1_name) === playerName;
                            const isPlayer2 = normalizeName(match.player2_name) === playerName;
                            const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                             (isPlayer2 && match.winner_id === match.player2_id);

                            return (
                              <tr key={match.id} className="border-b border-[#292524] hover:bg-black/50 transition-colors">
                                <td className="px-3 py-3 text-white text-sm">
                                  Round {Math.abs(match.round)}
                                  {match.group_id && (
                                    <div className="text-xs text-white/60">Group {groupNameMap[match.group_id]}</div>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player1_name}
                                  </span>
                                  <span className="text-white/60 mx-2">vs</span>
                                  <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player2_name}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {(isPlayer1 || isPlayer2) && match.winner_id ? (
                                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                                      playerWon 
                                        ? 'bg-green-600 text-green-100' 
                                        : 'bg-red-600 text-red-100'
                                    }`}>
                                      {playerWon ? 'WON' : 'LOST'}
                                    </span>
                                  ) : (
                                    <span className="text-white/40 text-xs">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm text-white/70 w-[30px]">
                                  <span className="text-white/40 text-xs">-</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {upcomingMatches
                      .filter(m => m.group_id !== null && m.group_id !== undefined)
                      .map((match) => {
                        const { player1Score, player2Score } = getMatchScores(match);
                        const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                        const isPlayer1 = normalizeName(match.player1_name) === playerName;
                        const isPlayer2 = normalizeName(match.player2_name) === playerName;
                        const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                         (isPlayer2 && match.winner_id === match.player2_id);

                        return (
                          <div key={match.id} className="bg-black/30 border border-[#292524] p-4 rounded space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                Round {Math.abs(match.round)}
                                {match.group_id && (
                                  <div className="text-xs text-white/60">Group {groupNameMap[match.group_id]}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player1_name}
                                </span>
                                <span className="text-white/60 mx-2">vs</span>
                                <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player2_name}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-white/70">
                                <span>
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </span>
                                {(isPlayer1 || isPlayer2) && match.winner_id ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    playerWon 
                                      ? 'bg-green-600 text-green-100' 
                                      : 'bg-red-600 text-red-100'
                                  }`}>
                                    {playerWon ? 'WON' : 'LOST'}
                                  </span>
                                ) : (
                                  <span className="text-white/40 text-xs">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}

              {upcomingMatches.length === 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <div className="text-white/60 text-center py-8">No upcoming matches</div>
                </div>
              )}
            </div>
          )}

          {/* Recent Matches */}
          {activeMainTab === 'recent' && (
            <div className="space-y-6">
              {/* Final Stage Recent Matches */}
              {recentMatches.filter(m => m.group_id === null || m.group_id === undefined).length > 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <h2 className="text-2xl font-bold mb-4 text-white">Final Stage</h2>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-[#292524]">
                      <thead className="bg-black/50">
                        <tr className="text-left text-xs md:text-sm uppercase tracking-wider text-white/70">
                          <th className="px-3 py-3 border-b border-[#292524]">Round</th>
                          <th className="px-3 py-3 border-b border-[#292524]">Match</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Score</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Result</th>
                          <th className="px-3 py-3 border-b border-[#292524] w-[30px]">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody className="bg-black/30">
                        {recentMatches
                          .filter(m => m.group_id === null || m.group_id === undefined)
                          .map((match) => {
                            const { player1Score, player2Score } = getMatchScores(match);
                            const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                            const isPlayer1 = normalizeName(match.player1_name) === playerName;
                            const isPlayer2 = normalizeName(match.player2_name) === playerName;
                            const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                             (isPlayer2 && match.winner_id === match.player2_id);
                            
                            return (
                              <tr key={match.id} className="border-b border-[#292524] hover:bg-black/50 transition-colors cursor-pointer" onClick={() => matchAttachmentDescriptions[match.id]?.length && setPreviewImageUrl(matchAttachmentDescriptions[match.id][0])}>
                                <td className="px-3 py-3 text-white text-sm">
                                  <span className="text-white text-sm font-semibold">{getFinalStageRoundLabel(match.round)}</span>
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player1_name}
                                  </span>
                                  <span className="text-white/60 mx-2">vs</span>
                                  <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player2_name}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {(isPlayer1 || isPlayer2) && (
                                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                                      playerWon 
                                        ? 'bg-green-600 text-green-100' 
                                        : 'bg-red-600 text-red-100'
                                    }`}>
                                      {playerWon ? 'WON' : 'LOST'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm text-white/70 w-[30px]">
                                  {matchAttachmentDescriptions[match.id]?.length ? (
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0020.07 7H21a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  ) : (
                                    <span className="text-white/40 text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {recentMatches
                      .filter(m => m.group_id === null || m.group_id === undefined)
                      .map((match) => {
                        const { player1Score, player2Score } = getMatchScores(match);
                        const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                        const isPlayer1 = normalizeName(match.player1_name) === playerName;
                        const isPlayer2 = normalizeName(match.player2_name) === playerName;
                        const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                         (isPlayer2 && match.winner_id === match.player2_id);
                        
                        return (
                          <div key={match.id} className="bg-black/30 border border-[#292524] p-4 rounded space-y-2 cursor-pointer hover:bg-black/50 transition-colors" onClick={() => matchAttachmentDescriptions[match.id]?.length && setPreviewImageUrl(matchAttachmentDescriptions[match.id][0])}>
                            <div className="flex justify-between items-start">
                              <span className="text-white text-sm font-semibold">{getFinalStageRoundLabel(match.round)}</span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player1_name}
                                </span>
                                <span className="text-white/60 mx-2">vs</span>
                                <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player2_name}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-white/70">
                                <span>
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </span>
                                {(isPlayer1 || isPlayer2) && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    playerWon 
                                      ? 'bg-green-600 text-green-100' 
                                      : 'bg-red-600 text-red-100'
                                  }`}>
                                    {playerWon ? 'WON' : 'LOST'}
                                  </span>
                                )}
                              </div>
                              {matchAttachmentDescriptions[match.id]?.length ? (
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0020.07 7H21a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}

              {/* Group Stage Recent Matches */}
              {recentMatches.filter(m => m.group_id !== null && m.group_id !== undefined).length > 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <h2 className="text-2xl font-bold mb-4 text-white">Group Stage</h2>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse border border-[#292524]">
                      <thead className="bg-black/50">
                        <tr className="text-left text-xs md:text-sm uppercase tracking-wider text-white/70">
                          <th className="px-3 py-3 border-b border-[#292524]">Round</th>
                          <th className="px-3 py-3 border-b border-[#292524]">Match</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Score</th>
                          <th className="px-3 py-3 border-b border-[#292524] text-center">Result</th>
                          <th className="px-3 py-3 border-b border-[#292524] w-[30px]">&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody className="bg-black/30">
                        {recentMatches
                          .filter(m => m.group_id !== null && m.group_id !== undefined)
                          .map((match) => {
                            const { player1Score, player2Score } = getMatchScores(match);
                            const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                            const isPlayer1 = normalizeName(match.player1_name) === playerName;
                            const isPlayer2 = normalizeName(match.player2_name) === playerName;
                            const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                             (isPlayer2 && match.winner_id === match.player2_id);
                            
                            return (
                              <tr key={match.id} className="border-b border-[#292524] hover:bg-black/50 transition-colors cursor-pointer" onClick={() => matchAttachmentDescriptions[match.id]?.length && setPreviewImageUrl(matchAttachmentDescriptions[match.id][0])}>
                                <td className="px-3 py-3 text-white text-sm">
                                  Round {Math.abs(match.round)}
                                  {match.group_id && (
                                    <div className="text-xs text-white/60">Group {groupNameMap[match.group_id]}</div>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player1_name}
                                  </span>
                                  <span className="text-white/60 mx-2">vs</span>
                                  <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                    {match.player2_name}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {(isPlayer1 || isPlayer2) && (
                                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                                      playerWon 
                                        ? 'bg-green-600 text-green-100' 
                                        : 'bg-red-600 text-red-100'
                                    }`}>
                                      {playerWon ? 'WON' : 'LOST'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-sm text-white/70 w-[30px]">
                                  {matchAttachmentDescriptions[match.id]?.length ? (
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0020.07 7H21a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  ) : (
                                    <span className="text-white/40 text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {recentMatches
                      .filter(m => m.group_id !== null && m.group_id !== undefined)
                      .map((match) => {
                        const { player1Score, player2Score } = getMatchScores(match);
                        const playerName = selectedPlayer ? normalizeName(selectedPlayer.name) : '';
                        const isPlayer1 = normalizeName(match.player1_name) === playerName;
                        const isPlayer2 = normalizeName(match.player2_name) === playerName;
                        const playerWon = (isPlayer1 && match.winner_id === match.player1_id) || 
                                         (isPlayer2 && match.winner_id === match.player2_id);
                        
                        return (
                          <div key={match.id} className="bg-black/30 border border-[#292524] p-4 rounded space-y-2 cursor-pointer hover:bg-black/50 transition-colors" onClick={() => matchAttachmentDescriptions[match.id]?.length && setPreviewImageUrl(matchAttachmentDescriptions[match.id][0])}>
                            <div className="flex justify-between items-start">
                              Round {Math.abs(match.round)}
                                {match.group_id && (
                                <div className="text-xs text-white/60">Group {groupNameMap[match.group_id]}</div>
                              )}
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className={`font-semibold ${isPlayer1 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player1_name}
                                </span>
                                <span className="text-white/60 mx-2">vs</span>
                                <span className={`font-semibold ${isPlayer2 ? 'text-orange-400' : 'text-white'}`}>
                                  {match.player2_name}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs text-white/70">
                                <span>
                                  <span className={`font-bold ${match.winner_id === match.player1_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player1Score}
                                  </span>
                                  <span className="text-white/60 mx-1">-</span>
                                  <span className={`font-bold ${match.winner_id === match.player2_id ? 'text-green-500' : match.winner_id ? 'text-red-500' : 'text-white/70'}`}>
                                    {player2Score}
                                  </span>
                                </span>
                                {(isPlayer1 || isPlayer2) && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    playerWon 
                                      ? 'bg-green-600 text-green-100' 
                                      : 'bg-red-600 text-red-100'
                                  }`}>
                                    {playerWon ? 'WON' : 'LOST'}
                                  </span>
                                )}
                              </div>
                              {matchAttachmentDescriptions[match.id]?.length ? (
                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0020.07 7H21a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}

              {recentMatches.length === 0 && (
                <div className="bg-[#1c1917] border-2 border-[#292524] p-6">
                  <div className="text-white/60 text-center py-8">No recent matches</div>
                </div>
              )}
            </div>
          )}

          {/* Group Ranking */}
          {activeMainTab === 'group-ranking' && (
            <div className="bg-[#1c1917] border-2 border-[#292524] p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Group Ranking</h2>
              {selectedGroupId !== null ? (
                <div className="overflow-x-auto">
                  <div className="mb-4 text-white/70">Group {groupNameMap[selectedGroupId]}</div>
                  <div className="min-w-max border border-[#292524]">
                    <div className="grid grid-cols-[28px_1fr_50px_50px_60px_60px_50px] md:grid-cols-[40px_1fr_80px_70px_90px_80px_70px] bg-black/50 border-b border-[#292524] text-[0.7rem] md:text-xs uppercase tracking-wider text-white/70">
                      <div className="px-3 py-2">#</div>
                      <div className="px-3 py-2">Player</div>
                      <div className="px-3 py-2 text-center">W-L</div>
                      <div className="px-3 py-2 text-center">Diff</div>
                      <div className="px-3 py-2 text-center">PF-PA</div>
                      <div className="px-3 py-2 text-center">Buch</div>
                      <div className="px-3 py-2 text-center">WR%</div>
                    </div>
                    {selectedGroupStandings.length > 0 ? (
                      selectedGroupStandings.map((row, index) => (
                        <div
                          key={`selected-${row.name}`}
                          className={`grid grid-cols-[28px_1fr_50px_50px_60px_60px_50px] md:grid-cols-[40px_1fr_80px_70px_90px_80px_70px] border-b border-[#292524] text-[0.7rem] md:text-sm transition-all ${
                            normalizeName(highlightedPlayer) === normalizeName(row.name)
                              ? 'bg-red-500/20'
                              : 'bg-black/30'
                          }`}
                        >
                          <div className="px-3 py-2 text-white/70">{index + 1}</div>
                          <div className="px-3 py-2 font-semibold text-white">{row.name}</div>
                          <div className="px-3 py-2 text-center text-white/80">{row.wins}-{row.losses}</div>
                          <div className={`px-3 py-2 text-center font-semibold ${row.diff < 0 ? 'text-red-500' : row.diff > 0 ? 'text-green-500' : 'text-white/80'}`}>{row.diff}</div>
                          <div className="px-3 py-2 text-center text-white/80">{row.pf}-{row.pa}</div>
                          <div className="px-3 py-2 text-center text-white/80">{row.buch}</div>
                          <div className="px-3 py-2 text-center text-white/80">{row.wr}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-white/60 text-center text-sm">No standings yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-white/60 text-center py-8">Select a player to view their group ranking.</div>
              )}
            </div>
          )}

          {/* Group Stage */}
          {activeMainTab === 'group-stage' && (
            <div className="pb-4">
              <div className="flex flex-col gap-6">
                {groupIds.length > 0 ? (
                  groupIds.map((groupId) => {
                    const groupMatches = groupStageMatches.filter((m) => m.group_id === groupId);
                    const groupRoundsForGroup = [...new Set(groupMatches.map((m) => Math.abs(m.round)))].sort((a, b) => a - b);
                    const groupStandings = computeStandings(groupMatches);

                    return (
                      <div key={groupId} className="bg-[#1c1917] border-2 border-[#292524] p-6">
                        <div className="mb-6">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 mb-4">
                            <h2 className="text-xl md:text-2xl font-bold">Group {groupNameMap[groupId]}</h2>
                            <div className="flex gap-3 border-b border-[#292524]">
                              <button
                                onClick={() => setActiveGroupTab('standings')}
                                className={`px-4 py-2 md:px-6 md:py-3 font-semibold uppercase tracking-wider text-xs md:text-sm transition ${
                                  activeGroupTab === 'standings'
                                    ? 'text-red-500 border-b-2 border-red-500'
                                    : 'text-white/60 hover:text-white'
                                }`}
                              >
                                Standings
                              </button>
                              <button
                                onClick={() => setActiveGroupTab('matches')}
                                className={`px-4 py-2 md:px-6 md:py-3 font-semibold uppercase tracking-wider text-xs md:text-sm transition ${
                                  activeGroupTab === 'matches'
                                    ? 'text-red-500 border-b-2 border-red-500'
                                    : 'text-white/60 hover:text-white'
                                }`}
                              >
                                Matches
                              </button>
                            </div>
                          </div>
                        </div>

                        {activeGroupTab === 'standings' && (
                          <div className="overflow-x-auto">
                            <div className="min-w-max border border-[#292524]">
                              <div className="grid grid-cols-[28px_1fr_50px_50px_60px_60px_50px] md:grid-cols-[40px_1fr_80px_70px_90px_80px_70px] bg-black/50 border-b border-[#292524] text-[0.7rem] md:text-xs uppercase tracking-wider text-white/70">
                                <div className="px-3 py-2">#</div>
                                <div className="px-3 py-2">Player</div>
                                <div className="px-3 py-2 text-center">W-L</div>
                                <div className="px-3 py-2 text-center">Diff</div>
                                <div className="px-3 py-2 text-center">PF-PA</div>
                                <div className="px-3 py-2 text-center">Buch</div>
                                <div className="px-3 py-2 text-center">WR%</div>
                              </div>

                              {groupStandings.length > 0 ? (
                                groupStandings.map((row, index) => (
                                  <div
                                    key={`${groupId}-${row.name}`}
                                    onClick={() => {
                                      if (normalizeName(highlightedPlayer) === normalizeName(row.name)) {
                                        ignoreUrlSyncRef.current = true;
                                        setSelectedPlayer(null);
                                        setHighlightedPlayer(null);
                                        setPlayerParam(null);
                                        setPlayerSearchTerm('');
                                        return;
                                      }
                                      const matched = players.find((p) => normalizeName(p.name) === normalizeName(row.name));
                                      ignoreUrlSyncRef.current = true;
                                      if (matched) {
                                        setSelectedPlayer(matched);
                                      } else {
                                        setSelectedPlayer(null);
                                      }
                                      setHighlightedPlayer(row.name);
                                      setPlayerParam(row.name);
                                      setPlayerSearchTerm('');
                                    }}
                                    className={`grid grid-cols-[28px_1fr_50px_50px_60px_60px_50px] md:grid-cols-[40px_1fr_80px_70px_90px_80px_70px] border-b border-[#292524] text-[0.7rem] md:text-sm cursor-pointer transition-all ${
                                      normalizeName(highlightedPlayer) === normalizeName(row.name)
                                        ? 'bg-red-500/20'
                                        : 'bg-black/30 hover:bg-black/50'
                                    }`}
                                  >
                                    <div className="px-3 py-2 text-white/70">{index + 1}</div>
                                    <div className="px-3 py-2 font-semibold text-white">{row.name}</div>
                                    <div className="px-3 py-2 text-center text-white/80">{row.wins}-{row.losses}</div>
                                    <div className={`px-3 py-2 text-center font-semibold ${row.diff < 0 ? 'text-red-500' : row.diff > 0 ? 'text-green-500' : 'text-white/80'}`}>{row.diff}</div>
                                    <div className="px-3 py-2 text-center text-white/80">{row.pf}-{row.pa}</div>
                                    <div className="px-3 py-2 text-center text-white/80">{row.buch}</div>
                                    <div className="px-3 py-2 text-center text-white/80">{row.wr}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-6 text-white/60 text-center text-sm">No standings yet.</div>
                              )}
                            </div>
                          </div>
                        )}

                        {activeGroupTab === 'matches' && (
                          <>
                            {groupRoundsForGroup.length > 0 ? (
                              <div
                                ref={scrollContainerRef}
                                className="overflow-x-auto max-h-[900px] overflow-y-auto cursor-grab"
                                onMouseDown={handleMouseDown}
                                onMouseLeave={handleMouseLeave}
                                onMouseUp={handleMouseUp}
                                onMouseMove={handleMouseMove}
                              >
                                <div className="inline-flex gap-3 min-w-full pb-4">
                                  {groupRoundsForGroup.map((round) => (
                                    <div
                                      key={`${groupId}-${round}`}
                                      className="flex-shrink-0 w-[180px] bg-black/30 border border-[#292524]"
                                    >
                                      <div className="p-2 border-b border-[#292524] bg-black/50">
                                        <h3 className="font-semibold text-white text-center" style={{ fontSize: '0.9rem' }}>
                                          Round {round}
                                        </h3>
                                      </div>
                                      <div className="p-0 space-y-3">
                                        {groupMatches
                                          .filter((m) => Math.abs(m.round) === round)
                                          .map((match) => {
                                            const { player1Score, player2Score } = getMatchScores(match);
                                            return (
                                              <div
                                                key={match.id}
                                                className={`border text-[10px] transition-all h-[50px] w-[180px] flex flex-col ${
                                                  isMatchHighlighted(match)
                                                    ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/30'
                                                    : 'border-[#292524] bg-[#171717]'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-1 px-2 py-0.5 flex-1">
                                                  <span
                                                    className={`font-semibold flex-1 ${
                                                      match.winner_id === match.player1_id
                                                        ? 'text-white'
                                                        : match.state === 'complete'
                                                        ? 'text-white/40'
                                                        : 'text-white'
                                                    }`}
                                                  >
                                                    {match.player1_name}
                                                  </span>
                                                  <span
                                                    className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                                      match.winner_id === match.player1_id
                                                        ? 'bg-red-600 text-white'
                                                        : 'text-white/60 bg-black/30'
                                                    }`}
                                                  >
                                                    {player1Score}
                                                  </span>
                                                </div>
                                                <div className="h-px bg-[#292524]"></div>
                                                <div className="flex items-center justify-between gap-1 px-2 py-0.5 flex-1">
                                                  <span
                                                    className={`font-semibold flex-1 ${
                                                      match.winner_id === match.player2_id
                                                        ? 'text-white'
                                                        : match.state === 'complete'
                                                        ? 'text-white/40'
                                                        : 'text-white'
                                                    }`}
                                                  >
                                                    {match.player2_name}
                                                  </span>
                                                  <span
                                                    className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                                      match.winner_id === match.player2_id
                                                        ? 'bg-red-600 text-white'
                                                        : 'text-white/60 bg-black/30'
                                                    }`}
                                                  >
                                                    {player2Score}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        {groupMatches.filter((m) => Math.abs(m.round) === round).length === 0 && (
                                          <div className="text-white/40 text-xs text-center py-8">No matches</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-white/60 text-center py-8">No group stage matches found</div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-[#1c1917] border-2 border-[#292524] p-6 text-white/60 text-center py-8">
                    {matches.length === 0 ? 'Loading matches...' : 'No group stage matches found'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Final Stage */}
          {activeMainTab === 'final-stage' && (
            <div className="bg-[#1c1917] border-2 border-[#292524] p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Final Stage</h2>
              {finalStageRounds.length > 0 ? (
                <div
                  ref={scrollContainerRef}
                  className="overflow-x-auto max-h-[900px] overflow-y-auto cursor-grab"
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                >
                  <div className="inline-flex gap-3 min-w-full pb-4">
                    {[...finalStageRounds].sort((a, b) => getFinalStageRoundSortKey(b) - getFinalStageRoundSortKey(a)).map((round) => (
                      <div key={`final-${round}`} className="flex-shrink-0 w-[180px] bg-black/30 border border-[#292524]">
                        <div className="p-2 border-b border-[#292524] bg-black/50">
                          <h3 className="font-semibold text-white text-center" style={{ fontSize: '0.9rem' }}>
                            {getFinalStageRoundLabel(round)}
                          </h3>
                        </div>
                        <div className="p-0 space-y-3">
                          {finalStageMatches
                            .filter((m) => Math.abs(m.round) === round)
                            .map((match) => {
                              const { player1Score, player2Score } = getMatchScores(match);
                              return (
                                <div
                                  key={match.id}
                                  className={`border text-[10px] transition-all h-[50px] w-[180px] flex flex-col ${
                                    isMatchHighlighted(match)
                                      ? 'border-red-500 bg-red-500/15 shadow-lg shadow-red-500/30'
                                      : 'border-[#292524] bg-[#171717]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 px-2 py-0.5 flex-1">
                                    <span
                                      className={`font-semibold flex-1 ${
                                        match.winner_id === match.player1_id
                                          ? 'text-white'
                                          : match.state === 'complete'
                                          ? 'text-white/40'
                                          : 'text-white'
                                      }`}
                                    >
                                      {match.player1_name}
                                    </span>
                                    <span
                                      className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                        match.winner_id === match.player1_id
                                          ? 'bg-red-600 text-white'
                                          : 'text-white/60 bg-black/30'
                                      }`}
                                    >
                                      {player1Score}
                                    </span>
                                  </div>
                                  <div className="h-px bg-[#292524]"></div>
                                  <div className="flex items-center justify-between gap-1 px-2 py-0.5 flex-1">
                                    <span
                                      className={`font-semibold flex-1 ${
                                        match.winner_id === match.player2_id
                                          ? 'text-white'
                                          : match.state === 'complete'
                                          ? 'text-white/40'
                                          : 'text-white'
                                      }`}
                                    >
                                      {match.player2_name}
                                    </span>
                                    <span
                                      className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                        match.winner_id === match.player2_id
                                          ? 'bg-red-600 text-white'
                                          : 'text-white/60 bg-black/30'
                                      }`}
                                    >
                                      {player2Score}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          {finalStageMatches.filter((m) => Math.abs(m.round) === round).length === 0 && (
                            <div className="text-white/40 text-xs text-center py-8">No matches</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-white/60 text-center py-8">No final stage matches found</div>
              )}
            </div>
          )}

          {/* Debug Info - Remove later */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border-2 border-red-500 text-red-300 rounded">
              {error}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t-2 border-red-500 backdrop-blur-sm z-40">
        <div className="flex justify-around items-center py-3 px-2 max-w-6xl mx-auto">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32.1-14-32.1-32c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/>
            </svg>
            <span className="text-xs">Home</span>
          </Link>
          
          <button
            onClick={() => window.location.reload()}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V80c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.7 2.6-1.1 5.4-1.1 8.3v112c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-17.6-17.5H176c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-2.2 0-4.2 .4-6.1 1.1z"/>
            </svg>
            <span className="text-xs">Reload</span>
          </button>
          
          <a className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px] -mt-2" href={`/${challongeId}/`}>
            <img alt="Logo" className="h-12" src="/assets/favicon.webp" />
          </a>
          
          <button
            onClick={() => {
              setSelectedPlayer(null);
              setHighlightedPlayer(null);
              setPlayerParam(null);
              setPlayerSearchTerm('');
            }}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M598.6 118.6C611.1 106.1 611.1 85.8 598.6 73.3C586.1 60.8 565.8 60.8 553.3 73.3L361.3 265.3L326.6 230.6C322.4 226.4 316.6 224 310.6 224C298.1 224 288 234.1 288 246.6L288 275.7L396.3 384L425.4 384C437.9 384 448 373.9 448 361.4C448 355.4 445.6 349.6 441.4 345.4L406.7 310.7L598.7 118.7zM373.1 417.4L254.6 298.9C211.9 295.2 169.4 310.6 138.8 341.2L130.8 349.2C108.5 371.5 96 401.7 96 433.2C96 440 103.1 444.4 109.2 441.4L160.3 415.9C165.3 413.4 169.8 420 165.7 423.8L39.3 537.4C34.7 541.6 32 547.6 32 553.9C32 566.1 41.9 576 54.1 576L227.4 576C266.2 576 303.3 560.6 330.8 533.2C361.4 502.6 376.7 460.1 373.1 417.4z"/>
            </svg>
            <span className="text-xs">Clear</span>
          </button>
          
          <button
            onClick={() => router.back()}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 73.4-73.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-128 128z"/>
            </svg>
            <span className="text-xs">Back</span>
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-black border-2 border-red-500 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-red-500 rounded transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImageUrl}
              alt="Match Screenshot"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
