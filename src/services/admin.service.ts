import { supabase } from "@/integrations/supabase/client";

export interface AppStats {
  totalUsers: number;
  totalCollections: number;
  totalQuizzes: number;
  totalAttempts: number;
}

export interface ConfigItem {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export const adminService = {
  async checkIsAdmin(userId: string): Promise<boolean> {
    // Using type assertion since has_role function was just created
    const { data, error } = await (supabase.rpc as any)('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return data === true;
  },

  async getAppStats(): Promise<AppStats> {
    const [usersResult, collectionsResult, quizzesResult, attemptsResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('collections').select('id', { count: 'exact', head: true }),
      supabase.from('quizzes').select('id', { count: 'exact', head: true }),
      supabase.from('attempts').select('id', { count: 'exact', head: true }),
    ]);

    return {
      totalUsers: usersResult.count ?? 0,
      totalCollections: collectionsResult.count ?? 0,
      totalQuizzes: quizzesResult.count ?? 0,
      totalAttempts: attemptsResult.count ?? 0,
    };
  },

  async getConfig(): Promise<ConfigItem[]> {
    const { data, error } = await (supabase as any)
      .from('app_config')
      .select('*')
      .order('key');

    if (error) throw error;
    return data || [];
  },

  async updateConfig(key: string, value: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await (supabase as any)
      .from('app_config')
      .update({ value, updated_by: user?.id })
      .eq('key', key);

    if (error) throw error;
  },
};
