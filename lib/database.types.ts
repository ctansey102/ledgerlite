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
export type SubledgerKind =
  | "invoice"
  | "payment"
  | "bill"
  | "disbursement"
  | "acquisition"
  | "depreciation"
  | "disposal"
  | "purchase"
  | "issue"
  | "adjustment"
  | "receipt"
  | "wage";
export type AccountSubledger =
  | "ar"
  | "ap"
  | "fa"
  | "fa_accum"
  | "inv"
  | "cash"
  | "payroll";
export type JournalSource =
  | "manual"
  | "ar"
  | "ap"
  | "fa"
  | "inv"
  | "cash"
  | "payroll";

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
          subledger: string | null;
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
          subledger?: string | null;
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
          subledger?: string | null;
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
      customers: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          sku: string;
          unit_cost: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          sku: string;
          unit_cost?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          sku?: string;
          unit_cost?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_assets: {
        Row: {
          acquisition_date: string;
          asset_tag: string | null;
          cost: number;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          salvage_value: number;
          status: string;
          useful_life_months: number;
          user_id: string;
        };
        Insert: {
          acquisition_date: string;
          asset_tag?: string | null;
          cost: number;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          salvage_value?: number;
          status?: string;
          useful_life_months: number;
          user_id: string;
        };
        Update: {
          acquisition_date?: string;
          asset_tag?: string | null;
          cost?: number;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          salvage_value?: number;
          status?: string;
          useful_life_months?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fixed_assets_user_id_fkey";
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
          source: string;
          source_kind: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          entered_by: string;
          entry_date: string;
          id?: string;
          source?: string;
          source_kind?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          entered_by?: string;
          entry_date?: string;
          id?: string;
          source?: string;
          source_kind?: string | null;
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
      subledger_postings: {
        Row: {
          asset_id: string | null;
          created_at: string;
          credit: number;
          customer_id: string | null;
          debit: number;
          description: string;
          employee_id: string | null;
          id: string;
          inventory_item_id: string | null;
          journal_entry_id: string;
          kind: string;
          posting_date: string;
          quantity: number | null;
          subledger: string;
          user_id: string;
          vendor_id: string | null;
        };
        Insert: {
          asset_id?: string | null;
          created_at?: string;
          credit?: number;
          customer_id?: string | null;
          debit?: number;
          description: string;
          employee_id?: string | null;
          id?: string;
          inventory_item_id?: string | null;
          journal_entry_id: string;
          kind: string;
          posting_date: string;
          quantity?: number | null;
          subledger: string;
          user_id: string;
          vendor_id?: string | null;
        };
        Update: {
          asset_id?: string | null;
          created_at?: string;
          credit?: number;
          customer_id?: string | null;
          debit?: number;
          description?: string;
          employee_id?: string | null;
          id?: string;
          inventory_item_id?: string | null;
          journal_entry_id?: string;
          kind?: string;
          posting_date?: string;
          quantity?: number | null;
          subledger?: string;
          user_id?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subledger_postings_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "fixed_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_journal_entry_id_fkey";
            columns: ["journal_entry_id"];
            isOneToOne: false;
            referencedRelation: "journal_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subledger_postings_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
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
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type FixedAsset = Database["public"]["Tables"]["fixed_assets"]["Row"];
export type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"];
export type JournalLine = Database["public"]["Tables"]["journal_lines"]["Row"];
export type SubledgerPosting =
  Database["public"]["Tables"]["subledger_postings"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
