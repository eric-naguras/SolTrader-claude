// Database type definitions generated from Supabase schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tracked_wallets: {
        Row: {
          id: string
          address: string
          alias: string | null
          is_active: boolean
          tags: string[]
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          address: string
          alias?: string | null
          is_active?: boolean
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address?: string
          alias?: string | null
          is_active?: boolean
          tags?: string[]
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      tokens: {
        Row: {
          id: string
          address: string
          symbol: string | null
          name: string | null
          decimals: number
          metadata: Json
          last_seen: string
          created_at: string
        }
        Insert: {
          id?: string
          address: string
          symbol?: string | null
          name?: string | null
          decimals?: number
          metadata?: Json
          last_seen?: string
          created_at?: string
        }
        Update: {
          id?: string
          address?: string
          symbol?: string | null
          name?: string | null
          decimals?: number
          metadata?: Json
          last_seen?: string
          created_at?: string
        }
      }
      whale_trades: {
        Row: {
          id: number
          wallet_id: string
          wallet_address: string
          token_id: string | null
          token_address: string
          trade_type: 'BUY' | 'SELL'
          sol_amount: number | null
          token_amount: number | null
          usd_value: number | null
          price_per_token: number | null
          transaction_hash: string
          block_slot: number | null
          trade_timestamp: string
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          wallet_id: string
          wallet_address: string
          token_id?: string | null
          token_address: string
          trade_type: 'BUY' | 'SELL'
          sol_amount?: number | null
          token_amount?: number | null
          usd_value?: number | null
          price_per_token?: number | null
          transaction_hash: string
          block_slot?: number | null
          trade_timestamp: string
          raw_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          wallet_id?: string
          wallet_address?: string
          token_id?: string | null
          token_address?: string
          trade_type?: 'BUY' | 'SELL'
          sol_amount?: number | null
          token_amount?: number | null
          usd_value?: number | null
          price_per_token?: number | null
          transaction_hash?: string
          block_slot?: number | null
          trade_timestamp?: string
          raw_data?: Json | null
          created_at?: string
        }
      }
      signal_rules: {
        Row: {
          id: string
          name: string
          min_whales: number
          time_window_hours: number
          min_total_sol: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          min_whales?: number
          time_window_hours?: number
          min_total_sol?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          min_whales?: number
          time_window_hours?: number
          min_total_sol?: number
          is_active?: boolean
          created_at?: string
        }
      }
      trade_signals: {
        Row: {
          id: string
          token_id: string | null
          token_address: string
          rule_id: string | null
          status: 'OPEN' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED'
          trigger_reason: string | null
          whale_count: number | null
          total_sol_amount: number | null
          metadata: Json
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          token_id?: string | null
          token_address: string
          rule_id?: string | null
          status?: 'OPEN' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED'
          trigger_reason?: string | null
          whale_count?: number | null
          total_sol_amount?: number | null
          metadata?: Json
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          token_id?: string | null
          token_address?: string
          rule_id?: string | null
          status?: 'OPEN' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED'
          trigger_reason?: string | null
          whale_count?: number | null
          total_sol_amount?: number | null
          metadata?: Json
          created_at?: string
          closed_at?: string | null
        }
      }
      portfolio_trades: {
        Row: {
          id: string
          signal_id: string | null
          token_id: string | null
          token_address: string
          trade_mode: 'PAPER' | 'LIVE'
          status: 'OPEN' | 'CLOSED'
          entry_price: number | null
          entry_sol_amount: number
          entry_token_amount: number | null
          entry_timestamp: string
          current_price: number | null
          high_water_mark: number | null
          exit_price: number | null
          exit_timestamp: string | null
          pnl_sol: number | null
          pnl_percentage: number | null
          exit_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          signal_id?: string | null
          token_id?: string | null
          token_address: string
          trade_mode?: 'PAPER' | 'LIVE'
          status?: 'OPEN' | 'CLOSED'
          entry_price?: number | null
          entry_sol_amount?: number
          entry_token_amount?: number | null
          entry_timestamp?: string
          current_price?: number | null
          high_water_mark?: number | null
          exit_price?: number | null
          exit_timestamp?: string | null
          pnl_sol?: number | null
          pnl_percentage?: number | null
          exit_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          signal_id?: string | null
          token_id?: string | null
          token_address?: string
          trade_mode?: 'PAPER' | 'LIVE'
          status?: 'OPEN' | 'CLOSED'
          entry_price?: number | null
          entry_sol_amount?: number
          entry_token_amount?: number | null
          entry_timestamp?: string
          current_price?: number | null
          high_water_mark?: number | null
          exit_price?: number | null
          exit_timestamp?: string | null
          pnl_sol?: number | null
          pnl_percentage?: number | null
          exit_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notification_log: {
        Row: {
          id: string
          signal_id: string | null
          channel: 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL'
          recipient: string | null
          status: 'PENDING' | 'SENT' | 'FAILED'
          message: string | null
          error_message: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          signal_id?: string | null
          channel: 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL'
          recipient?: string | null
          status?: 'PENDING' | 'SENT' | 'FAILED'
          message?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          signal_id?: string | null
          channel?: 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL'
          recipient?: string | null
          status?: 'PENDING' | 'SENT' | 'FAILED'
          message?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}