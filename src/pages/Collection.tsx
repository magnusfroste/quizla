import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Sparkles, ArrowLeft, Upload } from "lucide-react";

interface Material {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
}

const Collection = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collection, setCollection] = useState<any | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await load();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('collections')
        .select('*, materials(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setCollection(data);

      // Load quizzes for this collection
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('id, title, description, created_at')
        .eq('collection_id', id)
        .order('created_at', { ascending: false });
      
      setQuizzes(quizzesData || []);

      // Basic SEO without extra deps
      if (data) {
        document.title = `${data.title} | QuizGenius`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', data.description || 'View collection');
      }
    } catch (e: any) {
      console.error('Failed to load collection', e);
      toast({
        title: 'Could not load collection',
        description: e?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const materialCount = useMemo(() => collection?.materials?.length || 0, [collection]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const userId = session.user.id;
      let uploadedCount = 0;

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast({
            title: 'Invalid file type',
            description: `${file.name} is not an image`,
            variant: 'destructive',
          });
          continue;
        }

        const timestamp = Date.now();
        const filePath = `${userId}/${id}/${timestamp}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from('materials')
          .insert({
            collection_id: id,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
            storage_path: filePath,
          });

        if (insertError) throw insertError;
        uploadedCount++;
      }

      toast({
        title: 'Upload successful',
        description: `${uploadedCount} file${uploadedCount === 1 ? '' : 's'} uploaded`,
      });

      await load();
    } catch (e: any) {
      console.error('Upload failed', e);
      toast({
        title: 'Upload failed',
        description: e?.message || 'Could not upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerateQuiz = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { collectionId: id },
      });

      if (error) throw error;

      toast({
        title: 'Quiz generated',
        description: `Created ${data?.quiz?.questionCount ?? 0} questions for this collection.`,
      });

      // Reload to fetch the new quiz
      await load();
    } catch (e: any) {
      console.error('generate-quiz failed', e);
      const msg = e?.message || 'Failed to generate quiz.';
      toast({ title: 'AI error', description: msg, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Collection not found or you don’t have access.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">{collection.title}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{collection.description || 'No description provided.'}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  <span>{materialCount} material{materialCount === 1 ? '' : 's'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Materials</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardHeader>
              <CardContent>
                {collection.materials?.length ? (
                  <ul className="space-y-2">
                    {collection.materials.map((m: Material) => (
                      <li key={m.id} className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <p className="font-medium">{m.file_name}</p>
                          <p className="text-xs text-muted-foreground">{m.mime_type || 'file'} • {m.file_size ? `${(m.file_size/1024/1024).toFixed(2)} MB` : 'size unknown'}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No materials yet. Add files to generate a better quiz.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={handleGenerateQuiz} disabled={generating || materialCount === 0}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? 'Generating…' : 'Generate Quiz'}
                </Button>
                {materialCount === 0 && (
                  <p className="text-xs text-muted-foreground">Add at least one material to enable quiz generation.</p>
                )}
              </CardContent>
            </Card>

            {quizzes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Available Quizzes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-1">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground mb-3">{quiz.description}</p>
                      )}
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                      >
                        Take Quiz
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Collection;
