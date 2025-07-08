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
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          address: string
          alias?: string | null
          is_active?: boolean
          tags?: string[]
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          address?: string
          alias?: string | null
          is_active?: boolean
          tags?: string[]
          metadata?: Json | null
          created_at?: string
        }
      }
      tokens: {
        Row: {
          id: string
          address: string
          symbol: string | null
          name: string | null
          metadata: Json | null
          last_seen: string
        }
        Insert: {
          id?: string
          address: string
          symbol?: string | null
          name?: string | null
          metadata?: Json | null
          last_seen?: string
        }
        Update: {
          id?: string
          address?: string
          symbol?: string | null
          name?: string | null
          metadata?: Json | null
          last_seen?: string
        }
      }
      whale_trades: {
        Row: {
          id: number
          wallet_address: string
          coin_address: string
          trade_type: 'BUY' | 'SELL'
          sol_amount: number | null
          token_amount: number | null
          transaction_hash: string
          trade_timestamp: string
        }
        Insert: {
          id?: number
          wallet_address: string
          coin_address: string
          trade_type: 'BUY' | 'SELL'
          sol_amount?: number | null
          token_amount?: number | null
          transaction_hash: string
          trade_timestamp: string
        }
        Update: {
          id?: number
          wallet_address?: string
          coin_address?: string
          trade_type?: 'BUY' | 'SELL'
          sol_amount?: number | null
          token_amount?: number | null
          transaction_hash?: string
          trade_timestamp?: string
        }
      }
      trade_signals: {
        Row: {
          id: string
          coin_address: string
          status: 'OPEN' | 'EXECUTED' | 'EXPIRED'
          trigger_reason: string | null
          metadata: Json | null
          created_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          coin_address: string
          status?: 'OPEN' | 'EXECUTED' | 'EXPIRED'
          trigger_reason?: string | null
          metadata?: Json | null
          created_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          coin_address?: string
          status?: 'OPEN' | 'EXECUTED' | 'EXPIRED'
          trigger_reason?: string | null
          metadata?: Json | null
          created_at?: string
          closed_at?: string | null
        }
      }
      portfolio_trades: {
        Row: {
          id: string
          signal_id: string | null
          trade_mode: 'PAPER' | 'LIVE'
          coin_address: string
          status: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED'
          entry_price: number | null
          high_water_mark_price: number | null
          entry_timestamp: string | null
          exit_price: number | null
          exit_timestamp: string | null
          pnl_usd: number | null
          exit_reason: string | null
        }
        Insert: {
          id?: string
          signal_id?: string | null
          trade_mode: 'PAPER' | 'LIVE'
          coin_address: string
          status?: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED'
          entry_price?: number | null
          high_water_mark_price?: number | null
          entry_timestamp?: string | null
          exit_price?: number | null
          exit_timestamp?: string | null
          pnl_usd?: number | null
          exit_reason?: string | null
        }
        Update: {
          id?: string
          signal_id?: string | null
          trade_mode?: 'PAPER' | 'LIVE'
          coin_address?: string
          status?: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED'
          entry_price?: number | null
          high_water_mark_price?: number | null
          entry_timestamp?: string | null
          exit_price?: number | null
          exit_timestamp?: string | null
          pnl_usd?: number | null
          exit_reason?: string | null
        }
      }
    }
  }
}