import { supabase } from "@/integrations/supabase/client";
import type { Material, MaterialAnalysis } from "@/types";

export const materialsService = {
  async getByCollectionId(collectionId: string): Promise<Material[]> {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async upload(
    collectionId: string,
    userId: string,
    file: File,
    materialType: 'content' | 'learning_objectives' | 'reference'
  ): Promise<Material> {
    const timestamp = Date.now();
    const filePath = `${userId}/${collectionId}/${timestamp}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('study-materials')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data, error: insertError } = await supabase
      .from('materials')
      .insert({
        collection_id: collectionId,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: filePath,
        material_type: materialType,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return data;
  },

  async updateType(materialId: string, newType: 'content' | 'learning_objectives' | 'reference'): Promise<void> {
    const { error } = await supabase
      .from('materials')
      .update({ material_type: newType })
      .eq('id', materialId);

    if (error) throw error;
  },

  async delete(materialId: string): Promise<void> {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId);

    if (error) throw error;
  },

  async getAnalyses(collectionId: string): Promise<MaterialAnalysis[]> {
    const { data, error } = await supabase
      .from('material_analysis')
      .select('*')
      .eq('collection_id', collectionId)
      .order('page_number');

    if (error) throw error;
    return (data || []) as MaterialAnalysis[];
  },

  async analyzeMaterials(collectionId: string) {
    const { data, error } = await supabase.functions.invoke('analyze-materials', {
      body: { collectionId },
    });

    if (error) throw error;
    return data;
  },
};
