import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, ChevronRight, Play, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CreateCollectionDialog from "@/components/CreateCollectionDialog";
import { QuizHistory } from "@/components/QuizHistory";
import { PerformanceChart } from "@/components/PerformanceChart";
import { TopicBreakdown } from "@/components/TopicBreakdown";
import { ShareQuizDialog } from "@/components/ShareQuizDialog";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSpinner } from "@/components/layout/LoadingSpinner";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [analytics, setAnalytics] = useState({
    attempts: [],
    totalAttempts: 0,
    averageScore: 0,
    sharedQuizzes: 0,
    topicStats: [],
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await loadCollections();
      await loadQuizzes();
    };

    checkAuth();
    loadAnalytics();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadAnalytics();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadCollections = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('collections')
        .select('*, materials(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error: any) {
      console.error('Error loading collections:', error);
      toast({
        title: "Error loading collections",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          id, title, description, created_at, is_public,
          collections(id, title),
          attempts(id, completed_at)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quizzesWithCounts = (data || []).map(quiz => ({
        ...quiz,
        attemptCount: quiz.attempts?.filter((a: any) => a.completed_at !== null).length || 0,
      }));

      setQuizzes(quizzesWithCounts);
    } catch (error: any) {
      console.error('Error loading quizzes:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
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

      const formattedAttempts = (attemptsData || []).map((attempt: any) => ({
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        score: attempt.score,
        total_questions: attempt.total_questions,
        completed_at: attempt.completed_at,
        quiz: {
          title: attempt.quizzes?.title || 'Unknown Quiz',
          collection: {
            title: attempt.quizzes?.collections?.title || 'Unknown Collection',
          },
        },
      }));

      const totalScore = formattedAttempts.reduce((sum: number, a: any) =>
        sum + (a.score / a.total_questions) * 100, 0
      );
      const averageScore = formattedAttempts.length > 0
        ? Math.round(totalScore / formattedAttempts.length)
        : 0;

      const { data: sharesData } = await supabase.from('quiz_shares').select('id');

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

      const topicStats = Array.from(topicMap.entries())
        .map(([topic, stats]) => ({
          topic,
          correct: stats.correct,
          total: stats.total,
          percentage: Math.round((stats.correct / stats.total) * 100),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setAnalytics({
        attempts: formattedAttempts,
        totalAttempts: formattedAttempts.length,
        averageScore,
        sharedQuizzes: sharesData?.length || 0,
        topicStats,
      });
    } catch (error: any) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const showStats = searchParams.get("tab") === "analytics";
  const firstName = (user?.user_metadata?.full_name || user?.email || "").split(/[ @]/)[0];

  return (
    <PageContainer>
      <Header onSignOut={handleSignOut} />

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-8">
        {showStats ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Stats</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Quizzes done", value: analytics.totalAttempts },
                { label: "Avg score", value: `${analytics.averageScore}%` },
                { label: "Collections", value: collections.length },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border bg-card p-3">
                  <p className="font-mono text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <PerformanceChart attempts={analytics.attempts} />
            <TopicBreakdown topics={analytics.topicStats} />
            <QuizHistory attempts={analytics.attempts.slice(0, 10)} />
          </section>
        ) : (
          <>
            <section>
              <p className="text-muted-foreground text-sm">Hi {firstName}</p>
              <h2 className="text-2xl font-bold mb-4">Snap. Quiz. Ace.</h2>
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full flex items-center gap-4 rounded-2xl bg-primary text-primary-foreground p-5 text-left active:scale-[0.98] transition-transform tap-highlight-none"
              >
                <span className="rounded-full bg-foreground text-background p-3">
                  <Camera className="h-6 w-6" />
                </span>
                <span>
                  <span className="block font-mono text-lg font-bold">Scan notes</span>
                  <span className="block text-sm opacity-80">Start a new collection</span>
                </span>
              </button>
            </section>

            {quizzes.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Quizzes</h3>
                <ul className="divide-y divide-border rounded-2xl border bg-card">
                  {quizzes.slice(0, 5).map((quiz) => (
                    <li key={quiz.id} className="flex items-center gap-3 p-3">
                      <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                        <p className="font-medium truncate">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {quiz.collections?.title} · {quiz.attemptCount || 0}× played
                        </p>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedQuiz(quiz); setShareDialogOpen(true); }}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" className="rounded-full" onClick={() => navigate(`/quiz/${quiz.id}`)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Collections</h3>
              {collections.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">
                  Nothing yet — scan your first page above.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border bg-card">
                  {collections.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => navigate(`/collection/${c.id}`)}
                        className="w-full flex items-center justify-between gap-3 p-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{c.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.materials?.[0]?.count || 0} pages
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={loadCollections}
      />

      {selectedQuiz && (
        <ShareQuizDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          quizId={selectedQuiz.id}
          quizTitle={selectedQuiz.title}
          isPublic={selectedQuiz.is_public || false}
        />
      )}
    </PageContainer>
  );
};

export default Dashboard;
