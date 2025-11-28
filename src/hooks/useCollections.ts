import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collectionsService } from "@/services/collections.service";
import type { CreateCollectionData } from "@/types";

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: collectionsService.getAll,
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionsService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, userId }: { data: CreateCollectionData; userId: string }) =>
      collectionsService.create(data, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
