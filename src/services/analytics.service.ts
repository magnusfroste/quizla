import { supabase } from "@/integrations/supabase/client";
import type { Analytics, Attempt, TopicStats } from "@/types";

export const analyticsService = {
  async getAnalytics(): Promise<Analytics> {
    // Load quiz attempts with quiz and collection info
    const { data: attemptsData, error: attemptsError } = await supabase
      .from('attempts')
      .select(`
        id, quiz_id, score, total_questions, completed_at,
        quizzes(id, title, collections(id, title))
      `)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (attemptsError) throw attemptsError;

    const formattedAttempts: Attempt[] = (attemptsData || []).map((attempt: any) => ({
      id: attempt.id,
      quiz_id: attempt.quiz_id,
      user_id: null,
      score: attempt.score,
      total_questions: attempt.total_questions,
      completed_at: attempt.completed_at,
      created_at: attempt.completed_at,
      quiz: {
        title: attempt.quizzes?.title || 'Unknown Quiz',
        collection: {
          title: attempt.quizzes?.collections?.title || 'Unknown Collection',
        },
      },
    }));

    // Calculate average score
    const totalScore = formattedAttempts.reduce(
      (sum, a) => sum + ((a.score || 0) / a.total_questions) * 100,
      0
    );
    const averageScore = formattedAttempts.length > 0
      ? Math.round(totalScore / formattedAttempts.length)
      : 0;

    // Load shared quizzes count
    const { data: sharesData } = await supabase
      .from('quiz_shares')
      .select('id');

    // Load topic performance stats
    const { data: answersData } = await supabase
      .from('answers')
      .select(`is_correct, questions(topic_category)`);

    const topicMap = new Map<string, { correct: number; total: number }>();

    (answersData || []).forEach((answer: any) => {
      const topic = answer.questions?.topic_category || 'General';
      const stats = topicMap.get(topic) || { correct: 0, total: 0 };
      stats.total++;
      if (answer.is_correct) stats.correct++;
      topicMap.set(topic, stats);
    });

    const topicStats: TopicStats[] = Array.from(topicMap.entries())
      .map(([topic, stats]) => ({
        topic,
        correct: stats.correct,
        total: stats.total,
        percentage: Math.round((stats.correct / stats.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      attempts: formattedAttempts,
      totalAttempts: formattedAttempts.length,
      averageScore,
      sharedQuizzes: sharesData?.length || 0,
      topicStats,
    };
  },
};
