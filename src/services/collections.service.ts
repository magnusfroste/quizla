import { supabase } from "@/integrations/supabase/client";
import type { Collection, CreateCollectionData } from "@/types";

export const collectionsService = {
  async getAll(): Promise<Collection[]> {
    const { data, error } = await (supabase as any)
      .from('collections')
      .select('*, materials(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Collection | null> {
    const { data, error } = await (supabase as any)
      .from('collections')
      .select('*, materials(id, file_name, mime_type, file_size, storage_path, material_type, created_at, collection_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(input: CreateCollectionData, userId: string): Promise<Collection> {
    const { data, error } = await supabase
      .from('collections')
      .insert({
        title: input.title,
        description: input.description || null,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<CreateCollectionData>): Promise<Collection> {
    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
