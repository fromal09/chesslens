export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          chess_username: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          chess_username?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          chess_username?: string | null;
          created_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          user_id: string;
          pgn: string;
          white: string | null;
          black: string | null;
          result: string | null;
          color_played: string | null;
          date: string | null;
          event: string | null;
          site: string | null;
          time_control: string | null;
          white_elo: number | null;
          black_elo: number | null;
          eco: string | null;
          opening_name: string | null;
          termination: string | null;
          total_plies: number | null;
          analysis_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pgn: string;
          white?: string | null;
          black?: string | null;
          result?: string | null;
          color_played?: string | null;
          date?: string | null;
          event?: string | null;
          site?: string | null;
          time_control?: string | null;
          white_elo?: number | null;
          black_elo?: number | null;
          eco?: string | null;
          opening_name?: string | null;
          termination?: string | null;
          total_plies?: number | null;
          analysis_status?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['games']['Insert']>;
      };
      game_stats: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          accuracy: number | null;
          blunders: number | null;
          mistakes: number | null;
          inaccuracies: number | null;
          good_moves: number | null;
          excellent_moves: number | null;
          brilliant_moves: number | null;
          total_moves_analyzed: number | null;
          avg_cp_loss: number | null;
          piece_activity: Json | null;
          squares_visited: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          accuracy?: number | null;
          blunders?: number | null;
          mistakes?: number | null;
          inaccuracies?: number | null;
          good_moves?: number | null;
          excellent_moves?: number | null;
          brilliant_moves?: number | null;
          total_moves_analyzed?: number | null;
          avg_cp_loss?: number | null;
          piece_activity?: Json | null;
          squares_visited?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['game_stats']['Insert']>;
      };
      move_analysis: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          ply: number;
          san: string;
          uci: string;
          fen_before: string;
          fen_after: string;
          cp_before: number | null;
          cp_after: number | null;
          cp_loss: number | null;
          best_uci: string | null;
          classification: string | null;
          eval_source: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          user_id: string;
          ply: number;
          san: string;
          uci: string;
          fen_before: string;
          fen_after: string;
          cp_before?: number | null;
          cp_after?: number | null;
          cp_loss?: number | null;
          best_uci?: string | null;
          classification?: string | null;
          eval_source?: string | null;
        };
        Update: Partial<Database['public']['Tables']['move_analysis']['Insert']>;
      };
    };
  };
};
