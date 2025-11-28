import { supabase } from "@/integrations/supabase/client";
import type { Quiz, Question, Attempt, Answer } from "@/types";

export const quizzesService = {
  async getAll(): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`
        id, title, description, created_at, is_public, collection_id,
        collections(id, title),
        attempts(id, completed_at)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(quiz => ({
      ...quiz,
      attemptCount: quiz.attempts?.filter((a: any) => a.completed_at !== null).length || 0,
    }));
  },

  async getByCollectionId(collectionId: string): Promise<Quiz[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select(`id, title, description, created_at, is_public, collection_id, attempts(id, completed_at)`)
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(quiz => ({
      ...quiz,
      attemptCount: quiz.attempts?.filter((a: any) => a.completed_at !== null).length || 0,
    }));
  },

  async getById(id: string): Promise<Quiz | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getQuestions(quizId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async generateQuiz(collectionId: string) {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: { collectionId },
    });

    if (error) throw error;
    return data;
  },

  async createAttempt(quizId: string, userId: string | null, totalQuestions: number): Promise<Attempt> {
    const { data, error } = await supabase
      .from('attempts')
      .insert({
        quiz_id: quizId,
        user_id: userId,
        total_questions: totalQuestions,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async submitAttempt(attemptId: string, score: number, answers: { questionId: string; answer: string; isCorrect: boolean }[]): Promise<void> {
    // Update attempt
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        score,
        completed_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    if (updateError) throw updateError;

    // Insert answers
    const { error: answersError } = await supabase
      .from('answers')
      .insert(
        answers.map(a => ({
          attempt_id: attemptId,
          question_id: a.questionId,
          selected_answer: a.answer,
          is_correct: a.isCorrect,
        }))
      );

    if (answersError) throw answersError;
  },

  async getAttemptCount(quizId: string): Promise<number> {
    const { data, error } = await supabase
      .from('attempts')
      .select('id')
      .eq('quiz_id', quizId)
      .not('completed_at', 'is', null);

    if (error) throw error;
    return data?.length || 0;
  },

  async getUserLastAttempt(quizId: string, userId: string): Promise<Attempt | null> {
    const { data, error } = await supabase
      .from('attempts')
      .select('id, score, total_questions, completed_at')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as Attempt | null;
  },

  async getAttemptAnswers(attemptId: string): Promise<Answer[]> {
    const { data, error } = await supabase
      .from('answers')
      .select('question_id, selected_answer, is_correct')
      .eq('attempt_id', attemptId);

    if (error) throw error;
    return (data || []) as Answer[];
  },
};
