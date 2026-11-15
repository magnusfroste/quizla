import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  RotateCcw,
  X,
} from "lucide-react";
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
const LONG_QUESTION = 150;

/* ---------- One reviewed question ---------- */
function ReviewItem({
  index,
  question,
  userAnswer,
}: {
  index: number;
  question: Question;
  userAnswer?: string;
}) {
  const [open, setOpen] = useState(false);
  const isCorrect = userAnswer === question.correct_answer;
  const long = question.question_text.length > LONG_QUESTION;
  const showToggle = long || !!question.explanation;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
            isCorrect ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
          }`}
        >
          {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">
            {index + 1}
            {question.topic_category ? ` · ${question.topic_category}` : ""}
          </p>
          <p
            className={`text-sm font-medium leading-snug ${
              open ? "" : "line-clamp-2 md:line-clamp-none"
            }`}
          >
            {question.question_text}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1 pl-9 text-sm">
        <p className={isCorrect ? "text-foreground" : "text-destructive"}>
          {userAnswer || "No answer"}
        </p>
        {!isCorrect && (
          <p className="font-medium text-foreground">{question.correct_answer}</p>
        )}
      </div>

      {question.explanation && (
        <p className="mt-2 ml-9 hidden bg-muted/60 p-3 text-sm text-muted-foreground md:block">
          {question.explanation}
        </p>
      )}

      {showToggle && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 ml-9 flex items-center gap-1 font-mono text-xs font-bold text-primary md:hidden"
        >
          {open ? "Show less" : "Why?"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {open && question.explanation && (
        <p className="mt-2 ml-9 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground md:hidden">
          {question.explanation}
        </p>
      )}
    </div>
  );
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSignupBanner, setShowSignupBanner] = useState(true);
  const [showFullQuestion, setShowFullQuestion] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const reviewTouched = useRef(false);

  useTouchSwipe({
    onSwipeLeft: () => !submitted && handleNext(),
    onSwipeRight: () => !submitted && handlePrevious(),
  });

  useEffect(() => {
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setShowFullQuestion(false);
  }, [currentIndex]);

  useEffect(() => {
    if (isMobile && !reviewTouched.current) setShowReview(false);
  }, [isMobile]);

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

  const toggleReview = () => {
    reviewTouched.current = true;
    setShowReview((s) => !s);
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
  const questionIsLong = currentQuestion.question_text.length > LONG_QUESTION;

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
            <div className="text-center mb-6">
              <p className="font-mono text-6xl font-bold text-primary">
                {score}<span className="text-2xl text-muted-foreground">/{questions.length}</span>
              </p>
              <p className="text-muted-foreground mt-1">{percent}% correct</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <p className="font-semibold text-center">Create a free account to:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>See every explanation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>Track your progress</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>Save and share quizzes</span>
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
            </div>
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
    const reviewVisible = isMobile ? showReview : true;

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

        <main className="container mx-auto px-4 py-6 max-w-2xl pb-24 md:pb-8">
          {/* Score */}
          <div className="text-center">
            <p className="font-mono text-6xl font-bold text-primary">
              {score}<span className="text-2xl text-muted-foreground">/{questions.length}</span>
            </p>
            <p className="text-muted-foreground mt-1">{percent}% correct</p>

            {topics.length > 1 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {topics.map(([topic, s]) => (
                  <Badge key={topic} variant="outline" className="text-xs">
                    {topic}: {s.correct}/{s.total}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:justify-center">
              <Button onClick={handleRetake} className="h-12 w-full font-semibold sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/collection/${quiz.collection_id}`)}
                className="h-12 w-full sm:w-auto"
              >
                Back to Collection
              </Button>
            </div>
          </div>

          {/* Review */}
          <div className="mt-8">
            <button
              onClick={toggleReview}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm font-bold md:hidden"
            >
              Review ({questions.length})
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showReview ? "rotate-180" : ""}`}
              />
            </button>

            {reviewVisible && (
              <div className="mt-4 space-y-2.5">
                {questions.map((question, idx) => (
                  <ReviewItem
                    key={question.id}
                    index={idx}
                    question={question}
                    userAnswer={answers[question.id]}
                  />
                ))}
              </div>
            )}
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

      <main className="container mx-auto px-4 pt-5 pb-28 max-w-2xl md:pb-8">
        {isAnonymous && showSignupBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
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

        {/* Question */}
        <div>
          {currentQuestion.topic_category && (
            <Badge variant="outline" className="font-mono text-xs uppercase">
              {currentQuestion.topic_category}
            </Badge>
          )}

          <h2
            className={`mt-2 text-lg font-semibold leading-snug md:text-xl ${
              questionIsLong && !showFullQuestion
                ? "line-clamp-4 md:line-clamp-none"
                : ""
            }`}
          >
            {currentQuestion.question_text}
          </h2>

          {questionIsLong && (
            <button
              onClick={() => setShowFullQuestion((s) => !s)}
              className="mt-1 font-mono text-xs font-bold text-primary md:hidden"
            >
              {showFullQuestion ? "Show less" : "Show full question"}
            </button>
          )}
        </div>

        {/* Answers */}
        <div className="mt-5 space-y-2.5">
          {(shuffledAnswers[currentQuestion.id] || []).map((answer, idx) => {
            const isSelected = selectedAnswer === answer;
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(answer)}
                aria-pressed={isSelected}
                className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {LETTERS[idx]}
                </span>
                <span className="flex-1 text-base leading-snug">{answer}</span>
                {isSelected && <Check className="h-5 w-5 flex-shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

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
    </div>
  );
};

export default Quiz;
