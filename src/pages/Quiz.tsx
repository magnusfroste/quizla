import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { MobileQuizNavigation } from "@/components/MobileQuizNavigation";
import { useTouchSwipe } from "@/hooks/use-touch-swipe";
import { useIsMobile } from "@/hooks/use-mobile";

interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  wrong_answers: string[];
  explanation: string | null;
  order_index: number;
  // Enhanced metadata (optional)
  difficulty_level?: string | null;
  bloom_level?: string | null;
  question_type?: string | null;
  topic_category?: string | null;
  exam_likelihood?: string | null;
  exam_tip?: string | null;
  page_references?: string[] | null;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  collection_id: string;
}

const Quiz = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shuffledAnswers, setShuffledAnswers] = useState<Record<string, string[]>>({});
  const [scoreSummaryExpanded, setScoreSummaryExpanded] = useState(false);

  // Mobile swipe navigation
  useTouchSwipe({
    onSwipeLeft: () => !submitted && handleNext(),
    onSwipeRight: () => !submitted && handlePrevious(),
  });

  useEffect(() => {
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadQuiz = async () => {
    if (!id) return;
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (quizError) throw quizError;
      if (!quizData) throw new Error('Quiz not found');

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', id)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      setQuiz(quizData);
      setQuestions(questionsData || []);

      // Pre-shuffle all answers once
      const shuffled: Record<string, string[]> = {};
      (questionsData || []).forEach((q) => {
        const all = [q.correct_answer, ...q.wrong_answers];
        shuffled[q.id] = all.sort(() => Math.random() - 0.5);
      });
      setShuffledAnswers(shuffled);

      // Create attempt
      const { data: { session } } = await supabase.auth.getSession();
      const { data: attemptData, error: attemptError } = await supabase
        .from('attempts')
        .insert({
          quiz_id: id,
          user_id: session?.user?.id || null,
          total_questions: questionsData?.length || 0,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;
      setAttemptId(attemptData.id);

      document.title = `${quizData.title} | QuizGenius`;
    } catch (e: any) {
      console.error('Failed to load quiz', e);
      toast({
        title: 'Could not load quiz',
        description: e?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: answer }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;

    try {
      let correctCount = 0;

      for (const question of questions) {
        const selectedAnswer = answers[question.id];
        const isCorrect = selectedAnswer === question.correct_answer;
        if (isCorrect) correctCount++;

        await supabase.from('answers').insert({
          attempt_id: attemptId,
          question_id: question.id,
          selected_answer: selectedAnswer || '',
          is_correct: isCorrect,
        });
      }

      await supabase
        .from('attempts')
        .update({
          score: correctCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      setScore(correctCount);
      setSubmitted(true);

      toast({
        title: 'Quiz submitted',
        description: `You scored ${correctCount} out of ${questions.length}`,
      });
    } catch (e: any) {
      console.error('Failed to submit quiz', e);
      toast({
        title: 'Could not submit quiz',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Quiz not found or no questions available.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentQuestion.id];

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(`/collection/${quiz.collection_id}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Collection
            </Button>
            <h1 className="text-xl font-bold">Quiz Results</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Collapsible Score Summary on Mobile */}
          <Card className="mb-6 md:mb-6 sticky top-16 md:relative z-40 md:z-auto">
            <CardHeader 
              className="cursor-pointer md:cursor-default"
              onClick={() => isMobile && setScoreSummaryExpanded(!scoreSummaryExpanded)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl md:text-2xl">Your Score</CardTitle>
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScoreSummaryExpanded(!scoreSummaryExpanded);
                    }}
                  >
                    {scoreSummaryExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                )}
              </div>
              {/* Always show score summary */}
              <div className="text-center pt-4">
                <p className="text-4xl md:text-5xl font-bold text-primary mb-2">
                  {score} / {questions.length}
                </p>
                <p className="text-sm md:text-base text-muted-foreground">
                  {((score || 0) / questions.length * 100).toFixed(0)}% correct
                </p>
              </div>
            </CardHeader>
            
            {/* Collapsible details on mobile, always visible on desktop */}
            {(scoreSummaryExpanded || !isMobile) && (
              <CardContent>
                <div className="text-center space-y-4">
                  {/* Performance by topic */}
                  {(() => {
                    const topicScores: Record<string, { correct: number; total: number }> = {};
                    questions.forEach((q, idx) => {
                      const topic = q.topic_category || 'General';
                      if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
                      topicScores[topic].total++;
                      if (answers[q.id] === q.correct_answer) topicScores[topic].correct++;
                    });
                    
                    return Object.keys(topicScores).length > 1 ? (
                      <div className="pt-4 border-t">
                        <p className="text-sm font-medium text-muted-foreground mb-3">Performance by Topic:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {Object.entries(topicScores).map(([topic, scores]) => {
                            const percentage = Math.round((scores.correct / scores.total) * 100);
                            return (
                              <Badge 
                                key={topic} 
                                variant="outline" 
                                className={`text-xs ${
                                  percentage >= 80 ? 'bg-green-50 border-green-300' :
                                  percentage >= 60 ? 'bg-yellow-50 border-yellow-300' :
                                  'bg-red-50 border-red-300'
                                }`}
                              >
                                {topic}: {scores.correct}/{scores.total} ({percentage}%)
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </CardContent>
            )}
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review Answers</h2>
            {questions.map((question, idx) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer === question.correct_answer;
              return (
                <Card key={question.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm text-muted-foreground">Question {idx + 1}</p>
                          {question.topic_category && (
                            <Badge variant="outline" className="text-xs">
                              {question.topic_category}
                            </Badge>
                          )}
                          {question.difficulty_level && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                question.difficulty_level === 'easy' ? 'bg-green-100 text-green-700' : 
                                question.difficulty_level === 'hard' ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {question.difficulty_level}
                            </Badge>
                          )}
                          {question.exam_likelihood === 'very_high' && (
                            <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                              🎯 High Exam Probability
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{question.question_text}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Your answer:</p>
                      <p className={`text-sm ${isCorrect ? 'text-green-600' : 'text-destructive'}`}>
                        {userAnswer || 'No answer selected'}
                      </p>
                    </div>
                    {!isCorrect && (
                      <div>
                        <p className="text-sm font-medium mb-1">Correct answer:</p>
                        <p className="text-sm text-green-600">{question.correct_answer}</p>
                      </div>
                    )}
                    {question.explanation && (
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-sm font-medium mb-1">Explanation:</p>
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                    )}
                    {question.exam_tip && (
                      <div className="bg-purple-50 rounded-md p-3 border border-purple-200">
                        <p className="text-sm">
                          <span className="font-medium">💡 Exam Tip:</span>{' '}
                          <span className="text-purple-900">{question.exam_tip}</span>
                        </p>
                      </div>
                    )}
                    {question.page_references && question.page_references.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        📖 Reference: {question.page_references.join(', ')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col md:flex-row gap-3 pb-8">
            <Button 
              onClick={() => navigate(`/collection/${quiz.collection_id}`)}
              className="w-full md:w-auto h-12 md:h-10"
            >
              Back to Collection
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="w-full md:w-auto h-12 md:h-10"
            >
              Retake Quiz
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/collection/${quiz.collection_id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">{quiz.title}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {Object.keys(answers).length} answered
              </p>
            </div>
            <Progress 
              value={((currentIndex + 1) / questions.length) * 100} 
              className="h-3 md:h-2"
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {currentQuestion.topic_category && (
                <Badge variant="outline" className="text-xs">
                  📚 {currentQuestion.topic_category}
                </Badge>
              )}
              {currentQuestion.difficulty_level && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    currentQuestion.difficulty_level === 'easy' ? 'bg-green-100 text-green-700' : 
                    currentQuestion.difficulty_level === 'hard' ? 'bg-red-100 text-red-700' : 
                    'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {currentQuestion.difficulty_level}
                </Badge>
              )}
              {currentQuestion.exam_likelihood === 'very_high' && (
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  🎯 High Exam Probability
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl">{currentQuestion.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(shuffledAnswers[currentQuestion.id] || []).map((answer, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(answer)}
                className={`w-full text-left p-5 md:p-4 rounded-lg border-2 transition-all min-h-[64px] text-base md:text-sm ${
                  selectedAnswer === answer
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                {answer}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-3 justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          <div className="flex gap-3">
            {currentIndex === questions.length - 1 ? (
              <Button onClick={handleSubmit}>
                Submit Quiz
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileQuizNavigation
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSubmit={handleSubmit}
          canGoBack={currentIndex > 0}
          canGoNext={currentIndex < questions.length - 1}
          isLastQuestion={currentIndex === questions.length - 1}
        />
      </main>

      {/* Add padding to prevent content from being hidden behind mobile nav */}
      <div className="md:hidden h-24" />
    </div>
  );
};

export default Quiz;
