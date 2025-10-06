import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Sparkles, ArrowLeft, Upload, Brain, BookOpen, Download, Camera, PlayCircle } from "lucide-react";
import { StudyMaterialViewer } from "@/components/StudyMaterialViewer";
import { MaterialGallery } from "@/components/MaterialGallery";
import { MaterialViewer } from "@/components/MaterialViewer";
import { generateStudyMaterialPDF } from "@/lib/pdfExport";
import { UploadProgress } from "@/components/UploadProgress";
import { compressImage, createImagePreview } from "@/lib/imageCompression";

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
  const [analyzing, setAnalyzing] = useState(false);
  const [collection, setCollection] = useState<any | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [showViewer, setShowViewer] = useState(false);
  const [materialViewerOpen, setMaterialViewerOpen] = useState(false);
  const [materialViewerIndex, setMaterialViewerIndex] = useState(0);
  const [uploadItems, setUploadItems] = useState<Array<{
    id: string;
    file: File;
    preview: string;
    status: 'pending' | 'compressing' | 'uploading' | 'complete' | 'error';
    progress: number;
    error?: string;
  }>>([]);
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

      // Load material analyses
      const { data: analysesData } = await supabase
        .from('material_analysis')
        .select('*')
        .eq('collection_id', id)
        .order('page_number');
      
      setAnalyses(analysesData || []);

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

    // Create upload items with previews
    const items = await Promise.all(
      Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          return null;
        }
        const preview = await createImagePreview(file);
        return {
          id: `${Date.now()}-${Math.random()}`,
          file,
          preview,
          status: 'pending' as const,
          progress: 0,
        };
      })
    );

    const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
    setUploadItems(validItems);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const userId = session.user.id;
      let uploadedCount = 0;

      for (const item of validItems) {
        try {
          // Update status to compressing
          setUploadItems(prev => 
            prev.map(u => u.id === item.id ? { ...u, status: 'compressing' as const } : u)
          );

          // Compress image
          const compressedFile = await compressImage(item.file, {
            onProgress: (progress) => {
              setUploadItems(prev => 
                prev.map(u => u.id === item.id ? { ...u, progress: progress * 0.3 } : u)
              );
            }
          });

          // Update status to uploading
          setUploadItems(prev => 
            prev.map(u => u.id === item.id ? { ...u, status: 'uploading' as const, progress: 30 } : u)
          );

          const timestamp = Date.now();
          const filePath = `${userId}/${id}/${timestamp}-${item.file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('study-materials')
            .upload(filePath, compressedFile);

          if (uploadError) throw uploadError;

          // Update progress
          setUploadItems(prev => 
            prev.map(u => u.id === item.id ? { ...u, progress: 70 } : u)
          );

          const { error: insertError } = await supabase
            .from('materials')
            .insert({
              collection_id: id,
              file_name: item.file.name,
              mime_type: item.file.type,
              file_size: compressedFile.size,
              storage_path: filePath,
            });

          if (insertError) throw insertError;

          // Update status to complete
          setUploadItems(prev => 
            prev.map(u => u.id === item.id ? { ...u, status: 'complete' as const, progress: 100 } : u)
          );

          uploadedCount++;
        } catch (error: any) {
          setUploadItems(prev => 
            prev.map(u => u.id === item.id ? { 
              ...u, 
              status: 'error' as const,
              error: error.message || 'Upload failed'
            } : u)
          );
        }
      }

      if (uploadedCount > 0) {
        toast({
          title: 'Upload successful',
          description: `${uploadedCount} file${uploadedCount === 1 ? '' : 's'} uploaded and optimized`,
        });
        await load();
      }
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

  const handleCancelUpload = (id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
    if (uploadItems.length === 1) {
      setUploading(false);
    }
  };

  const handleCloseUploadProgress = () => {
    setUploadItems([]);
  };

  const handleGenerateQuiz = async () => {
    if (!id) return;
    
    // Check if materials have been analyzed
    if (analyses.length === 0) {
      toast({
        title: 'Content extraction required',
        description: 'Please extract content from materials first before generating a quiz.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { collectionId: id },
      });

      if (error) throw error;

      toast({
        title: 'Quiz generated',
        description: `Created ${data?.quiz?.questionCount ?? 0} questions using knowledge base.`,
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

  const handleAnalyzeMaterials = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-materials', {
        body: { collectionId: id },
      });

      if (error) throw error;

      toast({
        title: 'Content extraction complete',
        description: `Analyzed ${data?.analyzed_count ?? 0} materials successfully.`,
      });

      // Reload to fetch the analyses
      await load();
    } catch (e: any) {
      console.error('analyze-materials failed', e);
      const msg = e?.message || 'Failed to analyze materials.';
      toast({ title: 'Analysis error', description: msg, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportPDF = async () => {
    if (analyses.length === 0) {
      toast({
        title: 'No content to export',
        description: 'Please extract content first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      toast({
        title: 'Generating PDF',
        description: 'Please wait...',
      });

      await generateStudyMaterialPDF(
        analyses,
        collection.title,
        collection.description
      );

      toast({
        title: 'PDF exported',
        description: 'Your study materials have been downloaded.',
      });
    } catch (e: any) {
      console.error('PDF export failed', e);
      toast({
        title: 'Export failed',
        description: e?.message || 'Could not generate PDF',
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
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">{collection.title}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            {quizzes.length > 0 && (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5 text-primary" />
                    Available Quizzes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="border rounded-xl p-6 bg-card hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-lg mb-2">{quiz.title}</h3>
                      {quiz.description && (
                        <p className="text-sm text-muted-foreground mb-4">{quiz.description}</p>
                      )}
                      <Button 
                        size="lg"
                        className="w-full h-12 bg-gradient-to-r from-primary to-primary-dark text-base font-semibold"
                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                      >
                        <PlayCircle className="h-5 w-5 mr-2" />
                        Start Learning
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle>Materials</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="lg"
                    className="h-12 md:h-10"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Camera className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                    {uploading ? 'Uploading…' : 'Scan Page'}
                  </Button>
                </div>
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
                  <MaterialGallery 
                    materials={collection.materials}
                    analyses={analyses}
                    onMaterialClick={(material, index) => {
                      setMaterialViewerIndex(index);
                      setMaterialViewerOpen(true);
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground">No materials yet. Add files to generate a better quiz.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full"
                  onClick={handleAnalyzeMaterials}
                  disabled={analyzing || materialCount === 0}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  {analyzing ? 'Analyzing...' : 'Extract Content'}
                </Button>

                {analyses.length > 0 && (
                  <>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowViewer(true)}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Study Materials
                    </Button>
                    
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={handleExportPDF}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </>
                )}

                {materialCount === 0 && (
                  <p className="text-xs text-muted-foreground">Add materials to extract content.</p>
                )}

                {analyses.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ✓ {analyses.length} page{analyses.length === 1 ? '' : 's'} analyzed
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Quiz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={handleGenerateQuiz} disabled={generating || analyses.length === 0}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? 'Generating…' : 'Generate Quiz'}
                </Button>
                {analyses.length === 0 && (
                  <p className="text-xs text-muted-foreground">Extract content first to enable quiz generation.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <StudyMaterialViewer 
          analyses={analyses}
          open={showViewer}
          onClose={() => setShowViewer(false)}
        />

        <MaterialViewer 
          materials={collection.materials || []}
          analyses={analyses}
          initialIndex={materialViewerIndex}
          open={materialViewerOpen}
          onClose={() => setMaterialViewerOpen(false)}
        />

        {uploadItems.length > 0 && (
          <UploadProgress 
            uploads={uploadItems}
            onCancel={handleCancelUpload}
            onClose={handleCloseUploadProgress}
          />
        )}
      </main>
    </div>
  );
};

export default Collection;
