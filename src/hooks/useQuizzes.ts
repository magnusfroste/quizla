import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quizzesService } from "@/services/quizzes.service";

export function useQuizzes() {
  return useQuery({
    queryKey: ['quizzes'],
    queryFn: quizzesService.getAll,
  });
}

export function useCollectionQuizzes(collectionId: string | undefined) {
  return useQuery({
    queryKey: ['quizzes', 'collection', collectionId],
    queryFn: () => quizzesService.getByCollectionId(collectionId!),
    enabled: !!collectionId,
  });
}

export function useQuiz(id: string | undefined) {
  return useQuery({
    queryKey: ['quiz', id],
    queryFn: () => quizzesService.getById(id!),
    enabled: !!id,
  });
}

export function useQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ['quiz', quizId, 'questions'],
    queryFn: () => quizzesService.getQuestions(quizId!),
    enabled: !!quizId,
  });
}

export function useGenerateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: string) => quizzesService.generateQuiz(collectionId),
    onSuccess: (_, collectionId) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'collection', collectionId] });
    },
  });
}

export function useAttemptCount(quizId: string | undefined) {
  return useQuery({
    queryKey: ['quiz', quizId, 'attemptCount'],
    queryFn: () => quizzesService.getAttemptCount(quizId!),
    enabled: !!quizId,
  });
}
