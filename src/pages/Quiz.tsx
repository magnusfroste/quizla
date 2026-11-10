import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, X } from "lucide-react";
import { MobileQuizNavigation } from "@/components/MobileQuizNavigation";
import { useTouchSwipe } from "@/hooks/use-touch-swipe";

interface Question {
  id: string;
  question_text: string;
  correct_answer: string;
  wrong_answers: string[];
  explanation: string | null;
  order_index: number;
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

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const Quiz = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shuffledAnswers, setShuffledAnswers] = useState<Record<string, string[]>>({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSignupBanner, setShowSignupBanner] = useState(true);

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

      const shuffled: Record<string, string[]> = {};
      (questionsData || []).forEach((q) => {
        const all = [q.correct_answer, ...q.wrong_answers];
        shuffled[q.id] = all.sort(() => Math.random() - 0.5);
      });
      setShuffledAnswers(shuffled);

      const { data: { session } } = await supabase.auth.getSession();
      setIsAnonymous(!session?.user);

      if (session?.user) {
        try {
          const { data: completedAttempt, error: attemptError } = await supabase
            .from('attempts')
            .select('id, score, total_questions, completed_at')
            .eq('quiz_id', id)
            .eq('user_id', session.user.id)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (completedAttempt && !attemptError) {
            const { data: userAnswers, error: answersError } = await supabase
              .from('answers')
              .select('question_id, selected_answer, is_correct')
              .eq('attempt_id', completedAttempt.id);

            if (userAnswers && !answersError) {
              const answersMap: Record<string, string> = {};
              userAnswers.forEach(ans => {
                answersMap[ans.question_id] = ans.selected_answer;
              });

              setAnswers(answersMap);
              setAttemptId(completedAttempt.id);
              setScore(completedAttempt.score);
              setSubmitted(true);
            }
          }
        } catch (err) {
          console.warn('Could not load previous attempt; starting fresh quiz', err);
        }
      }

      document.title = `${quizData.title} | Quizla`;
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
    let correctCount = 0;

    for (const question of questions) {
      const selectedAnswer = answers[question.id];
      if (selectedAnswer === question.correct_answer) correctCount++;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      let finalAttemptId = attemptId;

      if (!finalAttemptId) {
        try {
          const { data: attemptData, error: attemptError } = await supabase
            .from('attempts')
            .insert({
              quiz_id: id,
              user_id: session?.user?.id || null,
              total_questions: questions.length,
              score: correctCount,
              completed_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (attemptError) throw attemptError;
          finalAttemptId = attemptData.id;
          setAttemptId(finalAttemptId);
        } catch (err) {
          console.warn('Attempt creation failed; showing results without saving', err);
          setScore(correctCount);
          setSubmitted(true);
          toast({
            title: 'Quiz completed (not saved)',
            description: `Sign up to save your results. You scored ${correctCount} out of ${questions.length}`,
          });
          return;
        }
      } else {
        await supabase
          .from('attempts')
          .update({
            score: correctCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', finalAttemptId);
      }

      for (const question of questions) {
        const selectedAnswer = answers[question.id];
        const isCorrect = selectedAnswer === question.correct_answer;

        await supabase.from('answers').insert({
          attempt_id: finalAttemptId,
          question_id: question.id,
          selected_answer: selectedAnswer || '',
          is_correct: isCorrect,
        });
      }

      setScore(correctCount);
      setSubmitted(true);
    } catch (e: any) {
      console.error('Failed to submit quiz', e);
      toast({
        title: 'Could not submit quiz',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setAttemptId(null);
    setSubmitted(false);
    setScore(null);
    setCurrentIndex(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Quiz not found.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>Back</Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const selectedAnswer = answers[currentQuestion.id];
  const percent = Math.round(((score || 0) / questions.length) * 100);

  // ---------- RESULTS ----------
  if (submitted) {
    if (isAnonymous) {
      return (
        <div className="min-h-screen bg-background">
          <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-50 safe-area-top">
            <div className="container mx-auto px-4 py-3 flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-mono font-bold">Result</span>
            </div>
          </header>

          <main className="container mx-auto px-4 py-10 max-w-md">
            <div className="text-center mb-8">
              <p className="font-mono text-6xl font-bold text-primary">
                {score}<span className="text-2xl text-muted-foreground">/{questions.length}</span>
              </p>
              <p className="text-muted-foreground mt-2">{percent}% correct</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="font-semibold text-center">Create a free account to:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>See explanations for every answer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Track your progress over time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Create and share your own quizzes</span>
                  </li>
                </ul>
                <Button
                  onClick={() => navigate('/auth')}
                  className="w-full h-12 font-semibold"
                >
                  Create Free Account
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  className="w-full"
                >
                  Continue as Guest
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      );
    }

    const topicScores: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q) => {
      const topic = q.topic_category || 'General';
      if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
      topicScores[topic].total++;
      if (answers[q.id] === q.correct_answer) topicScores[topic].correct++;
    });
    const topics = Object.entries(topicScores);

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-50 safe-area-top">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/collection/${quiz.collection_id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-mono font-bold truncate">{quiz.title}</span>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl pb-24 md:pb-8">
          {/* Score */}
          <div className="text-center mb-8">
            <p className="font-mono text-6xl font-bold text-primary">
              {score}<span className="text-2xl text-muted-foreground">/{questions.length}</span>
            </p>
            <p className="text-muted-foreground mt-2">{percent}% correct</p>

            {topics.length > 1 && (
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {topics.map(([topic, s]) => (
                  <Badge key={topic} variant="outline" className="text-xs">
                    {topic}: {s.correct}/{s.total}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-center mt-6">
              <Button onClick={handleRetake} className="font-semibold">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate(`/collection/${quiz.collection_id}`)}>
                Back to Collection
              </Button>
            </div>
          </div>

          {/* Review */}
          <h2 className="font-mono font-bold text-lg mb-4">Review</h2>
          <div className="space-y-3">
            {questions.map((question, idx) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer === question.correct_answer;
              return (
                <Card key={question.id}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">
                          {idx + 1}{question.topic_category ? ` · ${question.topic_category}` : ''}
                        </p>
                        <p className="font-medium">{question.question_text}</p>
                      </div>
                    </div>

                    <div className="pl-8 space-y-1 text-sm">
                      <p className={isCorrect ? 'text-foreground' : 'text-destructive'}>
                        {userAnswer || 'No answer'}
                      </p>
                      {!isCorrect && (
                        <p className="text-foreground font-medium">{question.correct_answer}</p>
                      )}
                    </div>

                    {question.explanation && (
                      <div className="ml-8 bg-muted/60 rounded-md p-3">
                        <p className="text-sm text-muted-foreground">{question.explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // ---------- QUIZ ----------
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-50 safe-area-top">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/collection/${quiz.collection_id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-mono font-bold truncate flex-1">{quiz.title}</span>
          <span className="font-mono text-sm text-muted-foreground flex-shrink-0">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1 rounded-none" />
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {isAnonymous && showSignupBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Sign up to save your score.
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="sm" onClick={() => navigate('/auth')}>Sign Up</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSignupBanner(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="pt-6 space-y-5">
            {currentQuestion.topic_category && (
              <Badge variant="outline" className="text-xs">
                {currentQuestion.topic_category}
              </Badge>
            )}

            <h2 className="text-xl font-semibold leading-snug">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-2">
              {(shuffledAnswers[currentQuestion.id] || []).map((answer, idx) => {
                const isSelected = selectedAnswer === answer;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(answer)}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-lg border-2 transition-colors min-h-[56px] ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <span className={`font-mono text-sm font-bold h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {LETTERS[idx]}
                    </span>
                    <span className="text-base">{answer}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-3 justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          {currentIndex === questions.length - 1 ? (
            <Button onClick={handleSubmit} className="font-semibold">
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </div>

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

      <div className="md:hidden h-24" />
    </div>
  );
};

export default Quiz;
