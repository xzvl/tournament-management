"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';

interface ChallongePlayer {
  id: number;
  name: string;
  group_player_ids?: number[];
}

interface Match {
  id: number;
  player1_id: number;
  player2_id: number;
  state: string;
  round: number;
  group_id: number | null;
}

export default function JudgePage() {
  const params = useParams();
  const router = useRouter();
  const challongeId = params.challongeId as string;
  const [isLoading, setIsLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [judgeName, setJudgeName] = useState<string | null>(null);
  const [stadiumNumber, setStadiumNumber] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [challongeUsername, setChallongeUsername] = useState<string | null>(null);
  const [players, setPlayers] = useState<ChallongePlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<ChallongePlayer | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<ChallongePlayer | null>(null);
  const [player1SearchTerm, setPlayer1SearchTerm] = useState('');
  const [player2SearchTerm, setPlayer2SearchTerm] = useState('');
  const [showPlayer1Dropdown, setShowPlayer1Dropdown] = useState(false);
  const [showPlayer2Dropdown, setShowPlayer2Dropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [player1Points, setPlayer1Points] = useState({ spin: 0, over: 0, burst: 0, extreme: 0, penalty: 0 });
  const [player2Points, setPlayer2Points] = useState({ spin: 0, over: 0, burst: 0, extreme: 0, penalty: 0 });
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState<'p1' | 'p2' | null>(null);
  const [confirmStatus, setConfirmStatus] = useState({ p1: false, p2: false });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const player1DropdownRef = useRef<HTMLDivElement>(null);
  const player2DropdownRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    const isLoggedIn = localStorage.getItem(`judgeLoggedIn_${challongeId}`);
    const storedJudgeId = localStorage.getItem(`judgeId_${challongeId}`);
    
    if (!isLoggedIn) {
      router.push(`/${challongeId}/login`);
    } else {
      setJudgeId(storedJudgeId);
      if (storedJudgeId) {
        fetchJudgeDetails(storedJudgeId);
      } else {
        setIsLoading(false);
      }
      
      // Load persisted match data
      try {
        const savedPlayer1 = localStorage.getItem(`matchPlayer1_${challongeId}`);
        const savedPlayer2 = localStorage.getItem(`matchPlayer2_${challongeId}`);
        const savedPlayer1Points = localStorage.getItem(`player1Points_${challongeId}`);
        const savedPlayer2Points = localStorage.getItem(`player2Points_${challongeId}`);
        
        if (savedPlayer1) {
          setSelectedPlayer1(JSON.parse(savedPlayer1));
        }
        if (savedPlayer2) {
          setSelectedPlayer2(JSON.parse(savedPlayer2));
        }
        if (savedPlayer1Points) {
          setPlayer1Points(JSON.parse(savedPlayer1Points));
        }
        if (savedPlayer2Points) {
          setPlayer2Points(JSON.parse(savedPlayer2Points));
        }
      } catch (err) {
        console.error('Error loading persisted match data:', err);
      }
    }
  }, [challongeId, router]);

  // Fetch tournament data to get toId
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const response = await fetch(`/api/tournaments?showAll=true`);
        const data = await response.json();
        
        if (data.success && data.tournaments) {
          const tournament = data.tournaments.find((t: any) => t.challonge_id === challongeId);
          if (tournament) {
            setToId(tournament.to_id);
          } else {
            console.error('Tournament not found');
          }
        }
      } catch (err) {
        console.error('Error fetching tournament:', err);
      }
    };

    if (challongeId) {
      fetchTournament();
    }
  }, [challongeId]);

  // Fetch user data (API key)
  useEffect(() => {
    const fetchUserData = async () => {
      if (!toId) return;

      try {
        const response = await fetch(`/api/users/${toId}`);
        const data = await response.json();

        if (data.success && data.user) {
          setApiKey(data.user.api_key);
          setChallongeUsername(data.user.challonge_username);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (toId) {
      fetchUserData();
    }
  }, [toId]);

  // Fetch players
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!apiKey || !challongeId) {
        
        return;
      }

      setPlayersLoading(true);
      try {
        const response = await fetch(
          `/api/challonge/participants?challongeId=${challongeId}&apiKey=${apiKey}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.participants) {
            const playersList = data.participants.map((p: any) => ({
              id: p.participant.id,
              name: p.participant.name || p.participant.display_name || 'Unknown Player',
              group_player_ids: Array.isArray(p.participant.group_player_ids)
                ? p.participant.group_player_ids
                : []
            }));
            setPlayers(playersList);
          }
        } else {
          
        }
      } catch (err) {
        
      } finally {
        setPlayersLoading(false);
      }
    };

    if (apiKey) {
      fetchPlayers();
    }
  }, [apiKey, challongeId]);

  const fetchMatches = useCallback(async () => {
    if (!apiKey || !challongeId) return;

    try {
      const response = await fetch(
        `/api/challonge/matches?challongeId=${challongeId}&apiKey=${apiKey}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.matches) {
          const allMatches = data.matches.map((m: any) => ({
            id: m.match.id,
            player1_id: m.match.player1_id,
            player2_id: m.match.player2_id,
            state: m.match.state,
            round: m.match.round,
            group_id: m.match.group_id ?? null
          }));
          setMatches(allMatches);
        }
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  }, [apiKey, challongeId]);

  // Fetch matches for upcoming player filtering
  useEffect(() => {
    if (apiKey && challongeId) {
      fetchMatches();
    }
  }, [apiKey, challongeId, fetchMatches]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (player1DropdownRef.current && !player1DropdownRef.current.contains(event.target as Node)) {
        setShowPlayer1Dropdown(false);
      }
      if (player2DropdownRef.current && !player2DropdownRef.current.contains(event.target as Node)) {
        setShowPlayer2Dropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchJudgeDetails = async (jId: string) => {
    try {
      // Fetch judge name
      const nameResponse = await fetch(`/api/judge-name?judgeId=${jId}`);
      const nameData = await nameResponse.json();
      
      if (nameData?.success) {
        setJudgeName(nameData.name);
      }

      // Fetch stadium number
      const stadiumResponse = await fetch(`/api/judge-stadium?judgeId=${jId}&challongeId=${challongeId}`);
      const stadiumData = await stadiumResponse.json();
      
      if (stadiumData?.success) {
        setStadiumNumber(stadiumData.stadiumNumber);
      }
    } catch (error) {
      console.error('Error fetching judge details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingPlayerIdSet = useMemo(() => {
    const set = new Set<number>();
    matches
      .filter((m) => m.state !== 'complete')
      .forEach((m) => {
        if (m.player1_id) set.add(m.player1_id);
        if (m.player2_id) set.add(m.player2_id);
      });
    return set;
  }, [matches]);

  const upcomingPlayers = useMemo(() => {
    if (upcomingPlayerIdSet.size === 0) return [] as ChallongePlayer[];
    return players.filter((player) => {
      const groupIds: number[] = Array.isArray(player.group_player_ids)
        ? player.group_player_ids
        : [];
      if (upcomingPlayerIdSet.has(player.id)) return true;
      return groupIds.some((id) => upcomingPlayerIdSet.has(id));
    });
  }, [players, upcomingPlayerIdSet]);

  const findOpponentForPlayer = (player: ChallongePlayer | null) => {
    if (!player) return null;
    const playerIds = new Set<number>([player.id, ...(player.group_player_ids || [])]);
    const upcomingMatch = matches.find((m) => {
      if (m.state === 'complete') return false;
      const p1Match = m.player1_id && playerIds.has(m.player1_id);
      const p2Match = m.player2_id && playerIds.has(m.player2_id);
      return p1Match || p2Match;
    });

    if (!upcomingMatch) return null;
    const opponentId = playerIds.has(upcomingMatch.player1_id)
      ? upcomingMatch.player2_id
      : upcomingMatch.player1_id;

    if (!opponentId) return null;
    const opponent = players.find((p) => {
      if (p.id === opponentId) return true;
      return (p.group_player_ids || []).includes(opponentId);
    });

    return opponent || null;
  };

  const selectedMatch = useMemo(() => {
    if (!selectedPlayer1 || !selectedPlayer2) return null;
    const p1Ids = new Set<number>([selectedPlayer1.id, ...(selectedPlayer1.group_player_ids || [])]);
    const p2Ids = new Set<number>([selectedPlayer2.id, ...(selectedPlayer2.group_player_ids || [])]);
    return (
      matches.find((m) => {
        if (m.state === 'complete') return false;
        const mP1 = m.player1_id;
        const mP2 = m.player2_id;
        const p1Match = (mP1 && p1Ids.has(mP1)) || (mP2 && p1Ids.has(mP2));
        const p2Match = (mP1 && p2Ids.has(mP1)) || (mP2 && p2Ids.has(mP2));
        return p1Match && p2Match;
      }) || null
    );
  }, [matches, selectedPlayer1, selectedPlayer2]);

  const groupIds = useMemo(() => {
    const ids = [...new Set(matches.map((m) => m.group_id).filter((id): id is number => id !== null))];
    ids.sort((a, b) => a - b);
    return ids;
  }, [matches]);

  const groupNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    groupIds.forEach((gid, index) => {
      map[gid] = String.fromCharCode(65 + index);
    });
    return map;
  }, [groupIds]);

  const handleLogout = () => {
    try {
      localStorage.removeItem(`judgeLoggedIn_${challongeId}`);
      localStorage.removeItem(`judgeId_${challongeId}`);
    } catch {
      // ignore
    }
    handleClear();
    router.push(`/${challongeId}/login`);
  };

  const handleSwitchPlayers = () => {
    const prevPlayer1 = selectedPlayer1;
    const prevPlayer2 = selectedPlayer2;
    const prevPlayer1Points = player1Points;
    const prevPlayer2Points = player2Points;
    
    setSelectedPlayer1(prevPlayer2);
    setSelectedPlayer2(prevPlayer1);
    setPlayer1Points(prevPlayer2Points);
    setPlayer2Points(prevPlayer1Points);
    setPlayer1SearchTerm('');
    setPlayer2SearchTerm('');
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    setSelectedPlayer1(null);
    setSelectedPlayer2(null);
    setPlayer1SearchTerm('');
    setPlayer2SearchTerm('');
    setShowPlayer1Dropdown(false);
    setShowPlayer2Dropdown(false);
    setPlayer1Points({ spin: 0, over: 0, burst: 0, extreme: 0, penalty: 0 });
    setPlayer2Points({ spin: 0, over: 0, burst: 0, extreme: 0, penalty: 0 });
    
    // Clear persisted data
    try {
      localStorage.removeItem(`matchPlayer1_${challongeId}`);
      localStorage.removeItem(`matchPlayer2_${challongeId}`);
      localStorage.removeItem(`player1Points_${challongeId}`);
      localStorage.removeItem(`player2Points_${challongeId}`);
    } catch (err) {
      console.error('Error clearing persisted data:', err);
    }
  };

  const getRoundDisplay = (round: number): string => {
    if (round > 0) {
      return `Round ${round}`;
    }
    const roundMap: Record<number, string> = {
      [-1]: 'Top 64',
      [-2]: 'Top 32',
      [-3]: 'Top 16',
      [-4]: 'Quarter Finals',
      [-5]: 'Semi Finals',
      [-6]: 'Finals'
    };
    return roundMap[round] || `Round ${round}`;
  };

  const getFinalStageRoundLabel = (round: number): string => {
    if (round === 0) return 'Placement Match';

    const finalRounds = [...new Set(matches
      .filter((m) => m.group_id === null)
      .map((m) => Math.abs(m.round))
    )];
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

  const getMatchStageLabel = (match: Match) => {
    if (match.group_id !== null) {
      const groupLabel = groupNameMap[match.group_id] || String(match.group_id);
      return `Group ${groupLabel} ${getRoundDisplay(match.round)}`;
    }

    return getFinalStageRoundLabel(match.round);
  };

  const getPlayer1Total = () => {
    return player1Points.spin * 1 + player1Points.over * 2 + player1Points.burst * 2 + player1Points.extreme * 3 + player1Points.penalty * 1;
  };

  const getPlayer2Total = () => {
    return player2Points.spin * 1 + player2Points.over * 2 + player2Points.burst * 2 + player2Points.extreme * 3 + player2Points.penalty * 1;
  };

  const formatTimestamp = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('-');
  };

  const sanitizeFilenamePart = (value: string) => {
    const cleaned = value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    return cleaned || 'player';
  };

  const getMatchSide = (player: ChallongePlayer | null, match: Match | null) => {
    if (!player || !match) return null;
    const ids = new Set<number>([player.id, ...(player.group_player_ids || [])]);
    if (match.player1_id && ids.has(match.player1_id)) return 'player1';
    if (match.player2_id && ids.has(match.player2_id)) return 'player2';
    return null;
  };

  const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number) => {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  };

  const downscaleCanvas = (canvas: HTMLCanvasElement, scale: number) => {
    const nextCanvas = document.createElement('canvas');
    const nextWidth = Math.max(1, Math.round(canvas.width * scale));
    const nextHeight = Math.max(1, Math.round(canvas.height * scale));
    nextCanvas.width = nextWidth;
    nextCanvas.height = nextHeight;
    const ctx = nextCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    }
    return nextCanvas;
  };

  const captureJudgeScreenshot = useCallback(async () => {
    if (!mainRef.current) return null;
    const canvas = await html2canvas(mainRef.current, {
      useCORS: true,
      scale: 2
    });

    const targetBytes = 150 * 1024;
    let workingCanvas = canvas;
    let quality = 0.85;
    let lastBlob: Blob | null = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const blob = await canvasToJpegBlob(workingCanvas, quality);
      if (!blob) return null;
      lastBlob = blob;
      if (blob.size <= targetBytes) return blob;

      if (quality > 0.55) {
        quality = Math.max(0.5, quality - 0.1);
        continue;
      }

      const scale = Math.max(0.5, Math.sqrt(targetBytes / blob.size) * 0.9);
      workingCanvas = downscaleCanvas(workingCanvas, scale);
      quality = 0.75;
    }

    return lastBlob;
  }, []);

  const createMatchAttachment = useCallback(async (payload: { description: string; file?: File | null }) => {
    if (!apiKey || !challongeId || !selectedMatch) return;
    const formData = new FormData();
    formData.append('challongeId', challongeId);
    formData.append('matchId', String(selectedMatch.id));
    formData.append('apiKey', apiKey);
    formData.append('description', payload.description);
    if (payload.file) {
      formData.append('file', payload.file, payload.file.name);
    }

    const response = await fetch('/api/challonge/attachments', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to create attachment');
    }
  }, [apiKey, challongeId, selectedMatch]);

  const savePlayerStats = useCallback(async (payload: {
    challongeId: string;
    matchId: string;
    matchStage: string | null;
    matchStatus: string;
    players: Array<{
      playerName: string;
      spin: number;
      burst: number;
      over: number;
      extreme: number;
      penalty: number;
      matchResult: 'win' | 'loss' | 'draw';
      stadiumSide: string;
    }>;
  }) => {
    const response = await fetch('/api/player-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to save player stats');
    }
  }, []);

  const updateMatchOnChallonge = useCallback(async (payload: { scoresCsv: string; winnerId: number }) => {
    if (!apiKey || !challongeId || !selectedMatch) return;
    const response = await fetch('/api/challonge/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challongeId,
        apiKey,
        matchId: selectedMatch.id,
        scoresCsv: payload.scoresCsv,
        winnerId: payload.winnerId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to update match');
    }
  }, [apiKey, challongeId, selectedMatch]);

  const handleSubmitConfirmed = useCallback(async () => {
    if (isSaving) return;
    if (!selectedMatch || !selectedPlayer1 || !selectedPlayer2) return;
    if (!apiKey || !challongeId) return;

    const p1Total = getPlayer1Total();
    const p2Total = getPlayer2Total();
    if (p1Total === p2Total) return;

    const p1Side = getMatchSide(selectedPlayer1, selectedMatch);
    const p2Side = getMatchSide(selectedPlayer2, selectedMatch);
    if (!p1Side || !p2Side || p1Side === p2Side) {
      alert('Selected players do not match an upcoming match.');
      return;
    }

    const matchPlayer1Score = p1Side === 'player1' ? p1Total : p2Total;
    const matchPlayer2Score = p1Side === 'player1' ? p2Total : p1Total;
    const winnerSide = p1Total > p2Total ? p1Side : p2Side;
    const winnerId = winnerSide === 'player1' ? selectedMatch.player1_id : selectedMatch.player2_id;

    if (!winnerId) {
      alert('Winner could not be resolved for this match.');
      return;
    }

    const timestampLabel = formatTimestamp(new Date());
    const player1Name = selectedPlayer1.name;
    const player2Name = selectedPlayer2.name;
    const winner = p1Total > p2Total
      ? { name: player1Name, score: p1Total }
      : { name: player2Name, score: p2Total };
    const loser = p1Total > p2Total
      ? { name: player2Name, score: p2Total }
      : { name: player1Name, score: p1Total };

    const matchWinsDescription = `Judge: ${judgeName || 'Judge'} | ${winner.name} defeated ${loser.name} ${winner.score}–${loser.score}. Result confirmed by both players.`;
    const matchFinishesDescription = `Finishes – ${player1Name}: [Spin: ${player1Points.spin}, Over: ${player1Points.over}, Burst: ${player1Points.burst}, Extreme: ${player1Points.extreme}, Penalty: ${player1Points.penalty}] | ${player2Name}: [Spin: ${player2Points.spin}, Over: ${player2Points.over}, Burst: ${player2Points.burst}, Extreme: ${player2Points.extreme}, Penalty: ${player2Points.penalty}]`;
    const screenshotDescription = `Match Screenshot: ${player1Name} vs ${player2Name} - ${timestampLabel}`;
    const screenshotFilename = `match_${selectedMatch.id}_${sanitizeFilenamePart(player1Name)}_vs_${sanitizeFilenamePart(player2Name)}_${timestampLabel}.jpg`;
    const matchStage = getMatchStageLabel(selectedMatch);

    setIsSaving(true);
    setSaveMessage('Saving the match...');
    setShowSubmitConfirm(false);
    setConfirmLoading(null);

    let matchUpdated = false;

    try {
      await updateMatchOnChallonge({
        scoresCsv: `${matchPlayer1Score}-${matchPlayer2Score}`,
        winnerId
      });
      matchUpdated = true;

      await savePlayerStats({
        challongeId,
        matchId: String(selectedMatch.id),
        matchStage,
        matchStatus: 'completed',
        players: [
          {
            playerName: player1Name,
            spin: player1Points.spin,
            burst: player1Points.burst,
            over: player1Points.over,
            extreme: player1Points.extreme,
            penalty: player1Points.penalty,
            matchResult: p1Total > p2Total ? 'win' : 'loss',
            stadiumSide: 'X Side'
          },
          {
            playerName: player2Name,
            spin: player2Points.spin,
            burst: player2Points.burst,
            over: player2Points.over,
            extreme: player2Points.extreme,
            penalty: player2Points.penalty,
            matchResult: p2Total > p1Total ? 'win' : 'loss',
            stadiumSide: 'B Side'
          }
        ]
      });

      await createMatchAttachment({ description: matchWinsDescription });
      await createMatchAttachment({ description: matchFinishesDescription });

      const screenshotBlob = await captureJudgeScreenshot();
      if (screenshotBlob) {
        const screenshotFile = new File([screenshotBlob], screenshotFilename, { type: 'image/jpeg' });
        await createMatchAttachment({ description: screenshotDescription, file: screenshotFile });
      }
    } catch (error) {
      console.error('Error submitting match:', error);
      if (!matchUpdated) {
        
      } else {
        
      }
    } finally {
      if (matchUpdated) {
        await fetchMatches();
        handleClear();
      }
      setIsSaving(false);
      setSaveMessage(null);
      setConfirmStatus({ p1: false, p2: false });
    }
  }, [
    apiKey,
    challongeId,
    captureJudgeScreenshot,
    createMatchAttachment,
    fetchMatches,
    handleClear,
    isSaving,
    judgeName,
    groupNameMap,
    player1Points,
    player2Points,
    savePlayerStats,
    selectedMatch,
    selectedPlayer1,
    selectedPlayer2,
    updateMatchOnChallonge
  ]);

  useEffect(() => {
    if (confirmStatus.p1 && confirmStatus.p2) {
      void handleSubmitConfirmed();
    }
  }, [confirmStatus, handleSubmitConfirmed]);

  // Persist player selections to localStorage
  useEffect(() => {
    try {
      if (selectedPlayer1) {
        localStorage.setItem(`matchPlayer1_${challongeId}`, JSON.stringify(selectedPlayer1));
      } else {
        localStorage.removeItem(`matchPlayer1_${challongeId}`);
      }
    } catch (err) {
      console.error('Error saving player 1:', err);
    }
  }, [selectedPlayer1, challongeId]);

  useEffect(() => {
    try {
      if (selectedPlayer2) {
        localStorage.setItem(`matchPlayer2_${challongeId}`, JSON.stringify(selectedPlayer2));
      } else {
        localStorage.removeItem(`matchPlayer2_${challongeId}`);
      }
    } catch (err) {
      console.error('Error saving player 2:', err);
    }
  }, [selectedPlayer2, challongeId]);

  // Persist points to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`player1Points_${challongeId}`, JSON.stringify(player1Points));
    } catch (err) {
      console.error('Error saving player 1 points:', err);
    }
  }, [player1Points, challongeId]);

  useEffect(() => {
    try {
      localStorage.setItem(`player2Points_${challongeId}`, JSON.stringify(player2Points));
    } catch (err) {
      console.error('Error saving player 2 points:', err);
    }
  }, [player2Points, challongeId]);

  const getPointBoxClass = (isActive: boolean) => (
    `bg-black/60 border rounded p-4 text-center flex items-center justify-center h-[37px] ${
      isActive
        ? 'border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)] bg-red-600/10'
        : 'border-white/10'
    }`
  );

  const getImageFilterStyle = (isActive: boolean) => (
    isActive
      ? { filter: 'brightness(0) saturate(100%) invert(19%) sepia(94%) saturate(4367%) hue-rotate(346deg) brightness(90%) contrast(96%)' }
      : {}
  );

  // Filter players based on search term (upcoming only)
  const filteredPlayers1 = useMemo(() => {
    const source = upcomingPlayers;
    if (!player1SearchTerm) return source;
    return source.filter(player =>
      player.name.toLowerCase().includes(player1SearchTerm.toLowerCase())
    );
  }, [upcomingPlayers, player1SearchTerm]);

  const filteredPlayers2 = useMemo(() => {
    const source = upcomingPlayers;
    if (!player2SearchTerm) return source;
    return source.filter(player =>
      player.name.toLowerCase().includes(player2SearchTerm.toLowerCase())
    );
  }, [upcomingPlayers, player2SearchTerm]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top bg-no-repeat p-4 sm:p-6 lg:p-8 pb-24 text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <span className="uppercase tracking-wider">Verifying access...</span>
        </div>
      </main>
    );
  }

  return (
    <>
      <main ref={mainRef} className="min-h-screen bg-[url('/assets/bg.webp')] bg-cover bg-top bg-no-repeat p-4 sm:p-6 lg:p-8 pb-24 has-sticky-footer text-white">
        <div className="max-w-6xl mx-auto">
          {/* Top Section */}
          <div className="bg-[#1c1917] border-2 border-[#292524] px-[5px] py-[10px] sm:p-6 mb-6 sm:mb-6 mb-[0.2rem]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[0.5rem] md:gap-6 items-start md:items-start">
              {/* Mobile: Center comes first */}
              <div className="md:hidden order-first flex flex-col items-center gap-[0.3rem] md:gap-3 text-center">
                {selectedMatch && selectedMatch.group_id !== null && (
                  <div className="text-xs text-white/50">
                    Group {groupNameMap[selectedMatch.group_id] || selectedMatch.group_id}
                  </div>
                )}
                <div className="px-4 py-2 bg-red-600 text-white font-bold rounded w-full text-[0.8rem] sm:text-base">
                  {selectedMatch ? getRoundDisplay(selectedMatch.round) : 'Match Round'}
                </div>
              </div>

              {/* Left - Player 1 */}
              <div className="flex flex-col gap-2 order-2 md:order-first">
                <div className="relative w-full">
                  <div className="absolute right-[5px] top-[5px] text-[0.5rem] text-white z-[99] uppercase md:relative md:top-auto md:right-auto md:text-xs md:tracking-widest md:text-white/60 md:block">
                    X SIDE
                  </div>
                  {mounted && (
                    <div className="relative w-full" ref={player1DropdownRef}>
                      <input
                        type="text"
                        placeholder="Player 1"
                        value={selectedPlayer1 ? selectedPlayer1.name : player1SearchTerm}
                        onChange={(e) => {
                          setPlayer1SearchTerm(e.target.value);
                          setSelectedPlayer1(null);
                          setShowPlayer1Dropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (selectedPlayer1 && (e.key === 'Backspace' || e.key === 'Delete')) {
                            e.preventDefault();
                            setSelectedPlayer1(null);
                            setPlayer1SearchTerm('');
                            setShowPlayer1Dropdown(true);
                          }
                        }}
                        onFocus={() => setShowPlayer1Dropdown(true)}
                        className="w-full px-4 py-2 bg-white/10 border-2 border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-red-500 transition-colors text-[0.8rem] sm:text-base"
                      />

                      {showPlayer1Dropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-black/95 border-2 border-red-500 rounded max-h-60 overflow-y-auto">
                          {playersLoading ? (
                            <div className="px-4 py-2 text-white/50">Loading players...</div>
                          ) : filteredPlayers1.length > 0 ? (
                            filteredPlayers1.map((player) => (
                              <div
                                key={player.id}
                                onClick={() => {
                                  setSelectedPlayer1(player);
                                  setPlayer1SearchTerm('');
                                  setShowPlayer1Dropdown(false);
                                  const opponent = findOpponentForPlayer(player);
                                  if (opponent) {
                                    setSelectedPlayer2(opponent);
                                    setPlayer2SearchTerm('');
                                  }
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-red-600/30 text-white"
                              >
                                {player.name}
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-white/50">No players found</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Center - Round & Group (Desktop only) */}
              <div className="hidden md:flex flex-col items-center gap-3 text-center">
                {selectedMatch && selectedMatch.group_id !== null && (
                  <div className="text-xs text-white/50">
                    Group {groupNameMap[selectedMatch.group_id] || selectedMatch.group_id}
                  </div>
                )}
                <div className="px-4 py-2 bg-red-600 text-white font-bold rounded w-full md:w-auto text-[0.8rem] sm:text-base">
                  {selectedMatch ? getRoundDisplay(selectedMatch.round) : 'Match Round'}
                </div>
              </div>

              {/* Right - Player 2 */}
              <div className="flex flex-col gap-2 items-end md:items-end order-3 md:order-none">
                <div className="relative w-full">
                  <div className="absolute right-[5px] top-[5px] text-[0.5rem] text-white z-[99] uppercase md:relative md:top-auto md:right-auto md:text-xs md:tracking-widest md:text-white/60 md:block">
                    B SIDE
                  </div>
                  {mounted && (
                    <div className="relative w-full" ref={player2DropdownRef}>
                      <input
                        type="text"
                        placeholder="Player 2"
                        value={selectedPlayer2 ? selectedPlayer2.name : player2SearchTerm}
                        onChange={(e) => {
                          setPlayer2SearchTerm(e.target.value);
                          setSelectedPlayer2(null);
                          setShowPlayer2Dropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (selectedPlayer2 && (e.key === 'Backspace' || e.key === 'Delete')) {
                            e.preventDefault();
                            setSelectedPlayer2(null);
                            setPlayer2SearchTerm('');
                            setShowPlayer2Dropdown(true);
                          }
                        }}
                        onFocus={() => setShowPlayer2Dropdown(true)}
                        className="w-full px-4 py-2 bg-white/10 border-2 border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-red-500 transition-colors text-[0.8rem] sm:text-base"
                      />

                      {showPlayer2Dropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-black/95 border-2 border-red-500 rounded max-h-60 overflow-y-auto">
                          {playersLoading ? (
                            <div className="px-4 py-2 text-white/50">Loading players...</div>
                          ) : filteredPlayers2.length > 0 ? (
                            filteredPlayers2.map((player) => (
                              <div
                                key={player.id}
                                onClick={() => {
                                  setSelectedPlayer2(player);
                                  setPlayer2SearchTerm('');
                                  setShowPlayer2Dropdown(false);
                                  const opponent = findOpponentForPlayer(player);
                                  if (opponent) {
                                    setSelectedPlayer1(opponent);
                                    setPlayer1SearchTerm('');
                                  }
                                }}
                                className="px-4 py-2 cursor-pointer hover:bg-red-600/30 text-white"
                              >
                                {player.name}
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-white/50">No players found</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex gap-[0.8rem] bg-[#1c1917]/90 border-2 border-[#292524] rounded px-[5px] py-[10px] sm:p-6">
            {/* Left Side */}
            <div className="flex flex-col gap-4 max-w-[80px] sm:max-w-none">
              <div className="grid grid-cols-1 gap-[5px]">
                <div className={getPointBoxClass(getPlayer1Total() >= 1)}>
                  {getPlayer1Total() >= 1 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 1)} />}
                </div>
                <div className={getPointBoxClass(getPlayer1Total() >= 2)}>
                  {getPlayer1Total() >= 2 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 2)} />}
                </div>
                <div className={getPointBoxClass(getPlayer1Total() >= 3)}>
                  {getPlayer1Total() >= 3 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 3)} />}
                </div>
                <div className={getPointBoxClass(getPlayer1Total() >= 4)}>
                  {getPlayer1Total() >= 4 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 4)} />}
                </div>
                <div className="grid grid-cols-2 gap-[5px]">
                  <div className={getPointBoxClass(getPlayer1Total() >= 5)}>
                    {getPlayer1Total() >= 5 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 5)} />}
                  </div>
                  <div className={getPointBoxClass(getPlayer1Total() >= 6)}>
                    {getPlayer1Total() >= 6 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer1Total() >= 6)} />}
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-3 gap-[0.3rem]">
                  {[
                    { label: 'Spin', pts: '1PT', key: 'spin' },
                    { label: 'Over', pts: '2PTS', key: 'over' },
                    { label: 'Burst', pts: '2PTS', key: 'burst' },
                    { label: 'Extreme', pts: '3PTS', key: 'extreme' },
                    { label: 'Penalty', pts: '1PT', key: 'penalty' }
                  ].map((item) => (
                    <div key={item.label} className="border border-white/10 rounded p-3 sm:p-3 p-[0.5rem]">
                      <div className={`text-[0.5rem] sm:text-xs uppercase text-white/60 mb-2 sm:mb-2 text-center mb-[0.4rem] ${
                        (item.label === 'Extreme' || item.label === 'Penalty') ? '-tracking-[0.5px] sm:tracking-widest' : 'tracking-widest'
                      }`}>
                        {item.label} [{item.pts}]
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:gap-2 gap-[0.3rem]">
                        <button 
                          disabled={!selectedPlayer1 || !selectedPlayer2}
                          className="px-3 py-1 sm:px-3 sm:py-1 px-[0.5rem] py-[0.15rem] bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setPlayer1Points(prev => ({
                            ...prev,
                            [item.key]: Math.max(0, prev[item.key as keyof typeof prev] - 1)
                          }))}
                        >
                          -
                        </button>
                        <div className="text-[0.8rem] sm:text-lg font-semibold">{player1Points[item.key as keyof typeof player1Points]}</div>
                        <button 
                          disabled={!selectedPlayer1 || !selectedPlayer2}
                          className="px-3 py-1 sm:px-3 sm:py-1 px-[0.5rem] py-[0.15rem] bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setPlayer1Points(prev => ({
                            ...prev,
                            [item.key]: prev[item.key as keyof typeof prev] + 1
                          }))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            {/* Center Side */}
            <div className="flex flex-col gap-4 items-center flex-1">
              <div className="text-white/80">Stadium {stadiumNumber ?? '-'}</div>
              <div className="w-full text-center bg-red-600 text-white font-bold py-2 rounded">
                {judgeName || 'Judge'}
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <div className="bg-green-600/80 text-center py-2 rounded font-bold">X SIDE</div>
                <div className="bg-green-600/80 text-center py-2 rounded font-bold">B SIDE</div>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <div className={`bg-black/60 border rounded p-6 sm:p-6 px-[0.5rem] text-center text-[3.5rem] font-bold ${
                  getPlayer1Total() > getPlayer2Total() 
                    ? 'border-green-500 shadow-[0_0_14px_rgba(34,197,94,0.85)] text-green-500' 
                    : getPlayer1Total() < getPlayer2Total() 
                    ? 'border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)] text-red-500'
                    : 'border-white/10 text-white'
                }`}>{getPlayer1Total()}</div>
                <div className={`bg-black/60 border rounded p-6 sm:p-6 px-[0.5rem] text-center text-[3.5rem] font-bold ${
                  getPlayer2Total() > getPlayer1Total() 
                    ? 'border-green-500 shadow-[0_0_14px_rgba(34,197,94,0.85)] text-green-500' 
                    : getPlayer2Total() < getPlayer1Total() 
                    ? 'border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.85)] text-red-500'
                    : 'border-white/10 text-white'
                }`}>{getPlayer2Total()}</div>
              </div>

              <button
                disabled={getPlayer1Total() === getPlayer2Total() || isSaving}
                className="w-full bg-red-600 hover:bg-red-500 transition-colors text-white font-bold py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
                onClick={() => {
                  setConfirmStatus({ p1: false, p2: false });
                  setConfirmLoading(null);
                  setShowSubmitConfirm(true);
                }}
              >
                Submit Result
              </button>
            </div>

            {/* Right Side */}
            <div className="flex flex-col gap-4 max-w-[80px] sm:max-w-none">
              <div className="grid grid-cols-1 gap-[5px]">
                <div className={getPointBoxClass(getPlayer2Total() >= 1)}>
                  {getPlayer2Total() >= 1 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 1)} />}
                </div>
                <div className={getPointBoxClass(getPlayer2Total() >= 2)}>
                  {getPlayer2Total() >= 2 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 2)} />}
                </div>
                <div className={getPointBoxClass(getPlayer2Total() >= 3)}>
                  {getPlayer2Total() >= 3 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 3)} />}
                </div>
                <div className={getPointBoxClass(getPlayer2Total() >= 4)}>
                  {getPlayer2Total() >= 4 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 4)} />}
                </div>
                <div className="grid grid-cols-2 gap-[5px]">
                  <div className={getPointBoxClass(getPlayer2Total() >= 5)}>
                    {getPlayer2Total() >= 5 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 5)} />}
                  </div>
                  <div className={getPointBoxClass(getPlayer2Total() >= 6)}>
                    {getPlayer2Total() >= 6 && <img src="/assets/x.webp" alt="x" className="h-4 w-6.5" style={getImageFilterStyle(getPlayer2Total() >= 6)} />}
                  </div>
                </div>
              </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-3 gap-[0.3rem]">
                  {[
                    { label: 'Spin', pts: '1PT', key: 'spin' },
                    { label: 'Over', pts: '2PTS', key: 'over' },
                    { label: 'Burst', pts: '2PTS', key: 'burst' },
                    { label: 'Extreme', pts: '3PTS', key: 'extreme' },
                    { label: 'Penalty', pts: '1PT', key: 'penalty' }
                  ].map((item) => (
                    <div key={`right-${item.label}`} className="border border-white/10 rounded p-3 sm:p-3 p-[0.5rem]">
                      <div className={`text-[0.5rem] sm:text-xs uppercase text-white/60 mb-2 sm:mb-2 text-center mb-[0.4rem] ${
                        (item.label === 'Extreme' || item.label === 'Penalty') ? '-tracking-[0.5px] sm:tracking-widest' : 'tracking-widest'
                      }`}>
                        {item.label} [{item.pts}]
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:gap-2 gap-[0.3rem]">
                        <button 
                          disabled={!selectedPlayer1 || !selectedPlayer2}
                          className="px-3 py-1 sm:px-3 sm:py-1 px-[0.5rem] py-[0.15rem] bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setPlayer2Points(prev => ({
                            ...prev,
                            [item.key]: Math.max(0, prev[item.key as keyof typeof prev] - 1)
                          }))}
                        >
                          -
                        </button>
                        <div className="text-[0.8rem] sm:text-lg font-semibold">{player2Points[item.key as keyof typeof player2Points]}</div>
                        <button 
                          disabled={!selectedPlayer1 || !selectedPlayer2}
                          className="px-3 py-1 sm:px-3 sm:py-1 px-[0.5rem] py-[0.15rem] bg-white/10 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => setPlayer2Points(prev => ({
                            ...prev,
                            [item.key]: prev[item.key as keyof typeof prev] + 1
                          }))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t-2 border-red-500 backdrop-blur-sm z-40">
        <div className="flex justify-around items-center py-3 px-2 max-w-6xl mx-auto">
          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
            onClick={handleSwitchPlayers}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M534.6 182.6C547.1 170.1 547.1 149.8 534.6 137.3L470.6 73.3C461.4 64.1 447.7 61.4 435.7 66.4C423.7 71.4 416 83.1 416 96L416 128L256 128C150 128 64 214 64 320C64 337.7 78.3 352 96 352C113.7 352 128 337.7 128 320C128 249.3 185.3 192 256 192L416 192L416 224C416 236.9 423.8 248.6 435.8 253.6C447.8 258.6 461.5 255.8 470.7 246.7L534.7 182.7zM105.4 457.4C92.9 469.9 92.9 490.2 105.4 502.7L169.4 566.7C178.6 575.9 192.3 578.6 204.3 573.6C216.3 568.6 224 556.9 224 544L224 512L384 512C490 512 576 426 576 320C576 302.3 561.7 288 544 288C526.3 288 512 302.3 512 320C512 390.7 454.7 448 384 448L224 448L224 416C224 403.1 216.2 391.4 204.2 386.4C192.2 381.4 178.5 384.2 169.3 393.3L105.3 457.3z"></path>
            </svg>
            <span className="text-xs">Switch</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
            onClick={handleFullscreen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" id="svg-fullscreen" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M128 96C110.3 96 96 110.3 96 128L96 224C96 241.7 110.3 256 128 256C145.7 256 160 241.7 160 224L160 160L224 160C241.7 160 256 145.7 256 128C256 110.3 241.7 96 224 96L128 96zM160 416C160 398.3 145.7 384 128 384C110.3 384 96 398.3 96 416L96 512C96 529.7 110.3 544 128 544L224 544C241.7 544 256 529.7 256 512C256 494.3 241.7 480 224 480L160 480L160 416zM416 96C398.3 96 384 110.3 384 128C384 145.7 398.3 160 416 160L480 160L480 224C480 241.7 494.3 256 512 256C529.7 256 544 241.7 544 224L544 128C544 110.3 529.7 96 512 96L416 96zM544 416C544 398.3 529.7 384 512 384C494.3 384 480 398.3 480 416L480 480L416 480C398.3 480 384 494.3 384 512C384 529.7 398.3 544 416 544L512 544C529.7 544 544 529.7 544 512L544 416z"></path>
            </svg>
            <span className="text-xs">Full</span>
          </button>
          <Link
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px] -mt-2"
            href={`/${challongeId}/`}
            onClick={(event) => {
              event.preventDefault();
              handleClear();
              router.push(`/${challongeId}/`);
            }}
          >
            <img alt="Logo" className="h-12" src="/assets/favicon.webp" />
          </Link>
          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
            onClick={handleClear}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 640 640" fill="currentColor">
              <path d="M598.6 118.6C611.1 106.1 611.1 85.8 598.6 73.3C586.1 60.8 565.8 60.8 553.3 73.3L361.3 265.3L326.6 230.6C322.4 226.4 316.6 224 310.6 224C298.1 224 288 234.1 288 246.6L288 275.7L396.3 384L425.4 384C437.9 384 448 373.9 448 361.4C448 355.4 445.6 349.6 441.4 345.4L406.7 310.7L598.7 118.7zM373.1 417.4L254.6 298.9C211.9 295.2 169.4 310.6 138.8 341.2L130.8 349.2C108.5 371.5 96 401.7 96 433.2C96 440 103.1 444.4 109.2 441.4L160.3 415.9C165.3 413.4 169.8 420 165.7 423.8L39.3 537.4C34.7 541.6 32 547.6 32 553.9C32 566.1 41.9 576 54.1 576L227.4 576C266.2 576 303.3 560.6 330.8 533.2C361.4 502.6 376.7 460.1 373.1 417.4z"></path>
            </svg>
            <span className="text-xs">Clear</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-red-500 transition-colors min-w-[60px]"
            onClick={handleLogout}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" width="22" height="22">
              <path d="M569 337C578.4 327.6 578.4 312.4 569 303.1L425 159C418.1 152.1 407.8 150.1 398.8 153.8C389.8 157.5 384 166.3 384 176L384 256L272 256C245.5 256 224 277.5 224 304L224 336C224 362.5 245.5 384 272 384L384 384L384 464C384 473.7 389.8 482.5 398.8 486.2C407.8 489.9 418.1 487.9 425 481L569 337zM224 160C241.7 160 256 145.7 256 128C256 110.3 241.7 96 224 96L160 96C107 96 64 139 64 192L64 448C64 501 107 544 160 544L224 544C241.7 544 256 529.7 256 512C256 494.3 241.7 480 224 480L160 480C142.3 480 128 465.7 128 448L128 192C128 174.3 142.3 160 160 160L224 160z"></path>
            </svg>
            <span className="text-xs">Logout</span>
          </button>
        </div>
      </div>

      {showSubmitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setShowSubmitConfirm(false);
            setConfirmLoading(null);
            setConfirmStatus({ p1: false, p2: false });
          }}
        >
          <div
            className="w-full max-w-2xl mx-4 bg-[#1c1917] border-2 border-red-500 rounded p-4 sm:p-6 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-white/10 rounded p-4 flex flex-col items-center gap-3">
                <div className="text-sm font-semibold">{selectedPlayer1?.name || 'Player 1'}</div>
                <div className="text-[0.65rem] uppercase tracking-widest text-white/60">Total Score</div>
                <div className="text-4xl font-bold">{getPlayer1Total()}</div>
                <button
                  className="w-full bg-red-600 hover:bg-red-500 transition-colors text-white font-bold py-2 rounded disabled:opacity-50"
                  onClick={() => {
                    setConfirmLoading('p1');
                    setConfirmStatus((prev) => ({ ...prev, p1: true }));
                    setConfirmLoading(null);
                  }}
                  disabled={confirmStatus.p1 || confirmLoading !== null}
                >
                  <span className="inline-flex items-center gap-2">
                    {confirmStatus.p1 ? 'Confirmed' : 'Confirm'}
                    {confirmLoading === 'p1' && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    )}
                  </span>
                </button>
                {!confirmStatus.p2 && confirmStatus.p1 && (
                  <div className="inline-flex items-center">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                  </div>
                )}
              </div>

              <div className="border border-white/10 rounded p-4 flex flex-col items-center gap-3">
                <div className="text-sm font-semibold">{selectedPlayer2?.name || 'Player 2'}</div>
                <div className="text-[0.65rem] uppercase tracking-widest text-white/60">Total Score</div>
                <div className="text-4xl font-bold">{getPlayer2Total()}</div>
                <button
                  className="w-full bg-red-600 hover:bg-red-500 transition-colors text-white font-bold py-2 rounded disabled:opacity-50"
                  onClick={() => {
                    setConfirmLoading('p2');
                    setConfirmStatus((prev) => ({ ...prev, p2: true }));
                    setConfirmLoading(null);
                  }}
                  disabled={confirmStatus.p2 || confirmLoading !== null}
                >
                  <span className="inline-flex items-center gap-2">
                    {confirmStatus.p2 ? 'Confirmed' : 'Confirm'}
                    {confirmLoading === 'p2' && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    )}
                  </span>
                </button>
                {!confirmStatus.p1 && confirmStatus.p2 && (
                  <div className="inline-flex items-center">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                  </div>
                )}
              </div>
            </div>

            <button
              className="mt-4 w-full bg-white/10 hover:bg-white/20 transition-colors text-white font-semibold py-2 rounded disabled:opacity-50"
              onClick={() => {
                setShowSubmitConfirm(false);
                setConfirmStatus({ p1: false, p2: false });
                setConfirmLoading(null);
              }}
              disabled={confirmLoading !== null}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-[#1c1917] border-2 border-red-500 rounded px-6 py-4 text-white font-semibold">
            {saveMessage || 'Saving the match...'}
          </div>
        </div>
      )}
    </>
  );
}
