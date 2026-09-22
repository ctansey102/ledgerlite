export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";
export type NormalBalance = "debit" | "credit";
export type CashFlowSection = "operating" | "investing" | "financing" | "cash";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          cash_flow_section: string | null;
          code: string;
          created_at: string;
          id: string;
          is_contra: boolean;
          name: string;
          normal_balance: string;
          type: string;
          user_id: string;
        };
        Insert: {
          cash_flow_section?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          is_contra?: boolean;
          name: string;
          normal_balance: string;
          type: string;
          user_id: string;
        };
        Update: {
          cash_flow_section?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_contra?: boolean;
          name?: string;
          normal_balance?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          created_at: string;
          description: string;
          entered_by: string;
          entry_date: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          entered_by: string;
          entry_date: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          entered_by?: string;
          entry_date?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_entered_by_fkey";
            columns: ["entered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_lines: {
        Row: {
          account_id: string;
          credit: number;
          debit: number;
          entry_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          credit?: number;
          debit?: number;
          entry_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          credit?: number;
          debit?: number;
          entry_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey";
            columns: ["entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_lines_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          role?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          role?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];
export type JournalLine = Database["public"]["Tables"]["journal_lines"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
