export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          password_hash: string;
          name: string;
          weight_kg: number | null;
          height_cm: number | null;
          age_years: number | null;
          sex: 'male' | 'female' | null;
          calorie_deficit: number;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          password_hash: string;
          name: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          age_years?: number | null;
          sex?: 'male' | 'female' | null;
          calorie_deficit?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          password_hash?: string;
          name?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          age_years?: number | null;
          sex?: 'male' | 'female' | null;
          calorie_deficit?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_levels: {
        Row: {
          id: number;
          label: string;
          description: string | null;
          multiplier: number;
          multiplier_low: number;
          multiplier_high: number;
        };
        Insert: {
          id: number;
          label: string;
          description?: string | null;
          multiplier: number;
          multiplier_low: number;
          multiplier_high: number;
        };
        Update: {
          id?: number;
          label?: string;
          description?: string | null;
          multiplier?: number;
          multiplier_low?: number;
          multiplier_high?: number;
        };
      };
      daily_activity: {
        Row: {
          id: string;
          resolved_date: string;
          activity_level_id: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resolved_date: string;
          activity_level_id?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          resolved_date?: string;
          activity_level_id?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      entries: {
        Row: {
          id: string;
          raw_text: string;
          created_at: string;
          resolved_date: string;
          explicit_date_in_text: boolean;
        };
        Insert: {
          id?: string;
          raw_text: string;
          created_at?: string;
          resolved_date: string;
          explicit_date_in_text?: boolean;
        };
        Update: {
          id?: string;
          raw_text?: string;
          created_at?: string;
          resolved_date?: string;
          explicit_date_in_text?: boolean;
        };
      };
      entry_items: {
        Row: {
          id: string;
          entry_id: string;
          food_name: string;
          grams: number | null;
          grams_low: number | null;
          grams_high: number | null;
          calories: number;
          calories_low: number;
          calories_high: number;
          protein_g: number;
          protein_low: number;
          protein_high: number;
          carbs_g: number;
          carbs_low: number;
          carbs_high: number;
          fat_g: number;
          fat_low: number;
          fat_high: number;
          saturated_fat_g: number;
          saturated_fat_low: number;
          saturated_fat_high: number;
          unsaturated_fat_g: number;
          unsaturated_fat_low: number;
          unsaturated_fat_high: number;
          fiber_g: number;
          fiber_low: number;
          fiber_high: number;
          sodium_mg: number;
          sodium_low: number;
          sodium_high: number;
          sugar_g: number;
          sugar_low: number;
          sugar_high: number;
          assumptions: Json;
          has_override: boolean;
          override_fields: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          food_name: string;
          grams?: number | null;
          grams_low?: number | null;
          grams_high?: number | null;
          calories: number;
          calories_low: number;
          calories_high: number;
          protein_g: number;
          protein_low: number;
          protein_high: number;
          carbs_g: number;
          carbs_low: number;
          carbs_high: number;
          fat_g: number;
          fat_low: number;
          fat_high: number;
          saturated_fat_g: number;
          saturated_fat_low: number;
          saturated_fat_high: number;
          unsaturated_fat_g: number;
          unsaturated_fat_low: number;
          unsaturated_fat_high: number;
          fiber_g?: number;
          fiber_low?: number;
          fiber_high?: number;
          sodium_mg?: number;
          sodium_low?: number;
          sodium_high?: number;
          sugar_g?: number;
          sugar_low?: number;
          sugar_high?: number;
          assumptions?: Json;
          has_override?: boolean;
          override_fields?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          food_name?: string;
          grams?: number | null;
          grams_low?: number | null;
          grams_high?: number | null;
          calories?: number;
          calories_low?: number;
          calories_high?: number;
          protein_g?: number;
          protein_low?: number;
          protein_high?: number;
          carbs_g?: number;
          carbs_low?: number;
          carbs_high?: number;
          fat_g?: number;
          fat_low?: number;
          fat_high?: number;
          saturated_fat_g?: number;
          saturated_fat_low?: number;
          saturated_fat_high?: number;
          unsaturated_fat_g?: number;
          unsaturated_fat_low?: number;
          unsaturated_fat_high?: number;
          fiber_g?: number;
          fiber_low?: number;
          fiber_high?: number;
          sodium_mg?: number;
          sodium_low?: number;
          sodium_high?: number;
          sugar_g?: number;
          sugar_low?: number;
          sugar_high?: number;
          assumptions?: Json;
          has_override?: boolean;
          override_fields?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      daily_totals: {
        Row: {
          resolved_date: string;
          entry_count: number;
          item_count: number;
          total_calories: number;
          total_calories_low: number;
          total_calories_high: number;
          total_protein: number;
          total_protein_low: number;
          total_protein_high: number;
          total_carbs: number;
          total_carbs_low: number;
          total_carbs_high: number;
          total_fat: number;
          total_fat_low: number;
          total_fat_high: number;
          total_saturated_fat: number;
          total_saturated_fat_low: number;
          total_saturated_fat_high: number;
          total_unsaturated_fat: number;
          total_unsaturated_fat_low: number;
          total_unsaturated_fat_high: number;
          total_fiber: number;
          total_fiber_low: number;
          total_fiber_high: number;
          total_sodium: number;
          total_sodium_low: number;
          total_sodium_high: number;
          total_sugar: number;
          total_sugar_low: number;
          total_sugar_high: number;
        };
      };
    };
    Functions: {
      calculate_bmr: {
        Args: {
          weight_kg: number;
          height_cm: number;
          age_years: number;
          sex: string;
        };
        Returns: number;
      };
    };
  };
}

// Convenience types
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type ActivityLevel = Database['public']['Tables']['activity_levels']['Row'];
export type DailyActivity = Database['public']['Tables']['daily_activity']['Row'];
export type Entry = Database['public']['Tables']['entries']['Row'];
export type EntryItem = Database['public']['Tables']['entry_items']['Row'];
export type DailyTotals = Database['public']['Views']['daily_totals']['Row'];
