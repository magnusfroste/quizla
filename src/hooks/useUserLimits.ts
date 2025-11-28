import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { configService, AppConfig } from "@/services/config.service";
import { subscriptionService, UserPlan } from "@/services/subscription.service";
import { supabase } from "@/integrations/supabase/client";

interface UserUsage {
  collections: number;
  materialsTotal: number;
  materialsPerCollection: Record<string, number>;
  quizzesPerCollection: Record<string, number>;
}

interface UserLimits {
  maxCollections: number;
  maxMaterialsTotal: number;
  maxMaterialsPerCollection: number;
  maxQuizzesPerCollection: number;
}

export function useUserLimits() {
  const { user } = useAuth();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => configService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['user-plan', user?.id],
    queryFn: () => subscriptionService.getUserPlan(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['user-usage', user?.id],
    queryFn: async (): Promise<UserUsage> => {
      if (!user?.id) {
        return { collections: 0, materialsTotal: 0, materialsPerCollection: {}, quizzesPerCollection: {} };
      }

      // Get collection count
      const { count: collectionCount } = await supabase
        .from('collections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get all user's collections with their materials count
      const { data: collections } = await (supabase as any)
        .from('collections')
        .select('id, materials(count)')
        .eq('user_id', user.id);

      // Get quizzes per collection
      const { data: quizzes } = await (supabase as any)
        .from('quizzes')
        .select('collection_id')
        .in('collection_id', collections?.map((c: any) => c.id) || []);

      const materialsPerCollection: Record<string, number> = {};
      const quizzesPerCollection: Record<string, number> = {};
      let materialsTotal = 0;

      collections?.forEach((col: any) => {
        const count = col.materials?.[0]?.count || 0;
        materialsPerCollection[col.id] = count;
        materialsTotal += count;
      });

      quizzes?.forEach((q: any) => {
        quizzesPerCollection[q.collection_id] = (quizzesPerCollection[q.collection_id] || 0) + 1;
      });

      return {
        collections: collectionCount || 0,
        materialsTotal,
        materialsPerCollection,
        quizzesPerCollection,
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  const getLimitsForPlan = (userPlan: UserPlan, appConfig: AppConfig): UserLimits => {
    switch (userPlan) {
      case 'pro':
        return {
          maxCollections: Infinity,
          maxMaterialsTotal: Infinity,
          maxMaterialsPerCollection: Infinity,
          maxQuizzesPerCollection: Infinity,
        };
      case 'student':
        return {
          maxCollections: appConfig.student_max_collections,
          maxMaterialsTotal: appConfig.student_max_materials_total,
          maxMaterialsPerCollection: appConfig.student_max_materials_total, // Use total as per-collection for student
          maxQuizzesPerCollection: appConfig.student_max_quizzes_per_collection,
        };
      default: // free
        return {
          maxCollections: appConfig.free_max_collections,
          maxMaterialsTotal: appConfig.free_max_materials_total,
          maxMaterialsPerCollection: appConfig.free_max_materials_per_collection,
          maxQuizzesPerCollection: appConfig.free_max_quizzes_per_collection,
        };
    }
  };

  const currentPlan = plan || 'free';
  const currentConfig = config || {
    free_max_collections: 3,
    free_max_materials_total: 20,
    free_max_materials_per_collection: 10,
    free_max_quizzes_per_collection: 2,
    student_max_collections: 20,
    student_max_materials_total: 200,
    student_max_quizzes_per_collection: 10,
    student_price_sek: 49,
    pro_price_sek: 99,
  };
  const limits = getLimitsForPlan(currentPlan, currentConfig);
  const currentUsage = usage || { collections: 0, materialsTotal: 0, materialsPerCollection: {}, quizzesPerCollection: {} };

  const canCreateCollection = currentUsage.collections < limits.maxCollections;
  
  const canUploadMaterial = (collectionId?: string) => {
    if (currentUsage.materialsTotal >= limits.maxMaterialsTotal) return false;
    if (collectionId && (currentUsage.materialsPerCollection[collectionId] || 0) >= limits.maxMaterialsPerCollection) {
      return false;
    }
    return true;
  };

  const canGenerateQuiz = (collectionId: string) => {
    return (currentUsage.quizzesPerCollection[collectionId] || 0) < limits.maxQuizzesPerCollection;
  };

  const getRemainingMaterials = (collectionId?: string) => {
    const totalRemaining = limits.maxMaterialsTotal - currentUsage.materialsTotal;
    if (collectionId) {
      const collectionRemaining = limits.maxMaterialsPerCollection - (currentUsage.materialsPerCollection[collectionId] || 0);
      return Math.min(totalRemaining, collectionRemaining);
    }
    return totalRemaining;
  };

  return {
    plan: currentPlan,
    limits,
    usage: currentUsage,
    config: currentConfig,
    canCreateCollection,
    canUploadMaterial,
    canGenerateQuiz,
    getRemainingMaterials,
    isAtCollectionLimit: !canCreateCollection,
    isAtMaterialLimit: currentUsage.materialsTotal >= limits.maxMaterialsTotal,
    loading: configLoading || planLoading || usageLoading,
  };
}
