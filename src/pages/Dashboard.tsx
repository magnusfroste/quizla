import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Trophy, Target, TrendingUp, PlayCircle, Share2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CollectionCard from "@/components/CollectionCard";
import CreateCollectionDialog from "@/components/CreateCollectionDialog";
import { QuizHistory } from "@/components/QuizHistory";
import { PerformanceChart } from "@/components/PerformanceChart";
import { TopicBreakdown } from "@/components/TopicBreakdown";
import { ShareQuizDialog } from "@/components/ShareQuizDialog";
import { QuizAttemptBadge } from "@/components/QuizAttemptBadge";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
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

  return (
    <PageContainer>
      <Header onSignOut={handleSignOut} />

      <main className="container mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: BookOpen, label: "Collections", value: collections.length, color: "primary" },
            { icon: Trophy, label: "Completed", value: analytics.totalAttempts, color: "secondary" },
            { icon: Target, label: "Avg Score", value: `${analytics.averageScore}%`, color: "accent" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl p-4 border shadow-soft">
              <div className={`inline-flex p-2 rounded-lg bg-${stat.color}/10 mb-2`}>
                <stat.icon className={`h-4 w-4 text-${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Ready to Learn Section */}
        {quizzes.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <PlayCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Ready to Learn</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {quizzes.slice(0, 6).map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex-shrink-0 w-[280px] bg-card rounded-xl p-4 border shadow-soft"
                >
                  <p className="text-xs text-muted-foreground mb-1 truncate">
                    {quiz.collections?.title || 'Collection'}
                  </p>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold line-clamp-2 flex-1">{quiz.title}</h3>
                    <QuizAttemptBadge attemptCount={quiz.attemptCount || 0} />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                      className="flex-1 h-10 bg-gradient-to-r from-primary to-primary-dark font-semibold"
                      size="sm"
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => {
                        setSelectedQuiz(quiz);
                        setShareDialogOpen(true);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="collections" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="collections" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Collections</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collections" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Collections</h2>
              <Button
                onClick={() => setCreateOpen(true)}
                className="h-10 bg-gradient-to-r from-primary to-primary-dark"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-2xl border">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No collections yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first collection to start
                </p>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="bg-gradient-to-r from-primary to-primary-dark"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Collection
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onUpdate={loadCollections}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <h2 className="text-xl font-bold">Performance</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PerformanceChart attempts={analytics.attempts} />
              <TopicBreakdown topics={analytics.topicStats} />
            </div>
            <QuizHistory attempts={analytics.attempts.slice(0, 10)} />
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />

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
