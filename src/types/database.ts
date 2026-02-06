// Database types and interfaces for TypeScript

export interface User {
  user_id: number;
  username: string;
  email: string;
  password: string;
  name: string;
  player_name?: string;
  challonge_username?: string;
  api_key?: string;
  user_role: 'admin' | 'tournament_organizer';
  created_at: Date;
  updated_at: Date;
}

export interface Community {
  community_id: number;
  name: string;
  short_name: string;
  logo?: string;
  cover?: string;
  location?: string;
  province?: string;
  city?: string;
  to_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Player {
  player_id: number;
  username: string;
  password: string;
  name: string;
  player_name: string;
  community_ids: number[];
  created_at: Date;
  updated_at: Date;
}

export interface Judge {
  judge_id: number;
  username: string;
  password: string;
  qr_code?: string;
  judge_name?: string;
  name?: string;
  community_ids: number[];
  created_at: Date;
  updated_at: Date;
}

export interface ChallongeTournament {
  ch_id: number;
  challonge_id: string;
  challonge_url: string;
  challonge_name: string;
  challonge_cover?: string;
  description?: string;
  tournament_date: Date;
  active: boolean;
  total_stadium: number;
  assigned_judge_ids: number[];
  created_at: Date;
  updated_at: Date;
}

export interface PlayerStat {
  stat_id: number;
  challonge_id: string;
  player_id: number;
  match_id: string;
  spin: number;
  burst: number;
  over: number;
  extreme: number;
  penalty: number;
  match_result: 'win' | 'loss' | 'draw';
  stadium_side: 'B Side' | 'X Side';
  match_status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  match_stage?: string;
  created_at: Date;
  updated_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Database query result types
export interface QueryResult {
  affectedRows: number;
  insertId: number;
  warningStatus: number;
}

// Authentication types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

// Tournament management types
export interface MatchSubmission {
  challonge_id: string;
  match_id: string;
  player1_id: number;
  player2_id: number;
  player1_stats: {
    spin: number;
    burst: number;
    over: number;
    extreme: number;
    penalty: number;
    stadium_side: 'B Side' | 'X Side';
  };
  player2_stats: {
    spin: number;
    burst: number;
    over: number;
    extreme: number;
    penalty: number;
    stadium_side: 'B Side' | 'X Side';
  };
  match_stage?: string;
}

// Statistics aggregation types
export interface PlayerStatsSummary {
  player_id: number;
  player_name: string;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  win_percentage: number;
  total_spins: number;
  total_bursts: number;
  total_overs: number;
  total_extremes: number;
  total_penalties: number;
}