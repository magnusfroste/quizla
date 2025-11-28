import { supabase } from "@/integrations/supabase/client";

export interface AppConfig {
  free_max_collections: number;
  free_max_materials_total: number;
  free_max_materials_per_collection: number;
  free_max_quizzes_per_collection: number;
  student_max_collections: number;
  student_max_materials_total: number;
  student_max_quizzes_per_collection: number;
  student_price_sek: number;
  pro_price_sek: number;
}

interface ConfigRow {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const configService = {
  async getAll(): Promise<AppConfig> {
    const { data, error } = await (supabase as any)
      .from('app_config')
      .select('key, value');

    if (error) throw error;

    const config: Record<string, number> = {};
    (data as ConfigRow[])?.forEach((row) => {
      config[row.key] = parseInt(row.value, 10);
    });

    return {
      free_max_collections: config.free_max_collections ?? 3,
      free_max_materials_total: config.free_max_materials_total ?? 20,
      free_max_materials_per_collection: config.free_max_materials_per_collection ?? 10,
      free_max_quizzes_per_collection: config.free_max_quizzes_per_collection ?? 2,
      student_max_collections: config.student_max_collections ?? 20,
      student_max_materials_total: config.student_max_materials_total ?? 200,
      student_max_quizzes_per_collection: config.student_max_quizzes_per_collection ?? 10,
      student_price_sek: config.student_price_sek ?? 49,
      pro_price_sek: config.pro_price_sek ?? 99,
    };
  },

  async get(key: string): Promise<string | null> {
    const { data, error } = await (supabase as any)
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) return null;
    return data?.value ?? null;
  },

  async update(key: string, value: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await (supabase as any)
      .from('app_config')
      .update({ value, updated_by: user?.id })
      .eq('key', key);

    if (error) throw error;
  },

  async getAllRaw(): Promise<ConfigRow[]> {
    const { data, error } = await (supabase as any)
      .from('app_config')
      .select('*')
      .order('key');

    if (error) throw error;
    return data || [];
  },
};
