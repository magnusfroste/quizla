import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, BookOpen, Users, Trophy, Target, TrendingUp, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CollectionCard from "@/components/CollectionCard";
import CreateCollectionDialog from "@/components/CreateCollectionDialog";
import { QuizHistory } from "@/components/QuizHistory";
import { PerformanceChart } from "@/components/PerformanceChart";
import { TopicBreakdown } from "@/components/TopicBreakdown";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [analytics, setAnalytics] = useState({
    attempts: [],
    totalAttempts: 0,
    averageScore: 0,
    sharedCollections: 0,
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
        description: error?.message || "Failed to load collections. Please try again.",
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
          id,
          title,
          description,
          created_at,
          collections (
            id,
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error: any) {
      console.error('Error loading quizzes:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      // Load quiz attempts with quiz and collection info
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('attempts')
        .select(`
          id,
          quiz_id,
          score,
          total_questions,
          completed_at,
          quizzes (
            id,
            title,
            collections (
              id,
              title
            )
          )
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

      // Calculate average score
      const totalScore = formattedAttempts.reduce((sum: number, a: any) => 
        sum + (a.score / a.total_questions) * 100, 0
      );
      const averageScore = formattedAttempts.length > 0 
        ? Math.round(totalScore / formattedAttempts.length) 
        : 0;

      // Load shared collections
      const { data: sharesData } = await supabase
        .from('collection_shares')
        .select('id');

      // Load topic performance stats
      const { data: answersData } = await supabase
        .from('answers')
        .select(`
          is_correct,
          questions (
            topic_category
          )
        `);

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
        sharedCollections: sharesData?.length || 0,
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-primary-dark p-2 rounded-xl">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">QuizGenius</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Learning</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl p-6 shadow-soft border">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collections</p>
                <p className="text-2xl font-bold">{collections.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-soft border">
            <div className="flex items-center gap-3">
              <div className="bg-secondary/10 p-3 rounded-lg">
                <Trophy className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quizzes Completed</p>
                <p className="text-2xl font-bold">{analytics.totalAttempts}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 shadow-soft border">
            <div className="flex items-center gap-3">
              <div className="bg-accent/10 p-3 rounded-lg">
                <Target className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{analytics.averageScore}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ready to Learn Hero Section */}
        {quizzes.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <PlayCircle className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Ready to Learn</h2>
                  <p className="text-muted-foreground">Start practicing with available quizzes</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.slice(0, 6).map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-card rounded-xl p-5 border shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {quiz.collections?.title || 'Unknown Collection'}
                        </p>
                        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
                          {quiz.title}
                        </h3>
                        {quiz.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {quiz.description}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                        className="w-full bg-gradient-to-r from-primary to-primary-dark h-12 text-base font-semibold"
                      >
                        <PlayCircle className="h-5 w-5 mr-2" />
                        Start Learning
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {quizzes.length > 6 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    +{quizzes.length - 6} more quizzes available in your collections
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs for Collections and Analytics */}
        <Tabs defaultValue="collections" className="space-y-6">
          <TabsList className="grid w-full md:w-auto grid-cols-2 md:inline-grid md:grid-cols-2">
            <TabsTrigger value="collections" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collections" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Collections</h2>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-gradient-to-r from-primary to-primary-dark h-12 md:h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Collection
              </Button>
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No collections yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first collection to start generating AI quizzes
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold">Performance Analytics</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceChart attempts={analytics.attempts} />
              <TopicBreakdown topics={analytics.topicStats} />
            </div>

            <QuizHistory attempts={analytics.attempts.slice(0, 10)} />
          </TabsContent>
        </Tabs>
      </main>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={loadCollections}
      />
    </div>
  );
};

export default Dashboard;