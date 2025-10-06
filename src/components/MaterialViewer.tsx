import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTouchSwipe } from "@/hooks/use-touch-swipe";

interface Material {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
}

interface MaterialViewerProps {
  materials: Material[];
  analyses: any[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

// Cache for signed URLs
const urlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrl(storagePath: string): Promise<string> {
  const cached = urlCache.get(storagePath);
  const now = Date.now();
  
  if (cached && cached.expires > now) {
    return cached.url;
  }
  
  const { data } = await supabase.storage
    .from('study-materials')
    .createSignedUrl(storagePath, 3600);
  
  if (data?.signedUrl) {
    urlCache.set(storagePath, {
      url: data.signedUrl,
      expires: now + (59 * 60 * 1000)
    });
    return data.signedUrl;
  }
  
  throw new Error('Failed to get signed URL');
}

export function MaterialViewer({
  materials,
  analyses,
  initialIndex,
  open,
  onClose,
}: MaterialViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const currentMaterial = materials[currentIndex];
  const currentAnalysis = currentMaterial
    ? analyses.find(a => a.material_id === currentMaterial.id)
    : null;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : materials.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < materials.length - 1 ? prev + 1 : 0));
  };

  // Touch swipe gestures
  useTouchSwipe({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrevious,
  });

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!open || !currentMaterial) return;

    const loadImage = async () => {
      setLoading(true);
      try {
        const url = await getSignedUrl(currentMaterial.storage_path);
        setImageUrl(url);
      } catch (error) {
        console.error("Failed to load image:", error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [currentMaterial, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, materials.length]);

  if (!currentMaterial) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-screen md:h-[90vh] max-h-screen p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg truncate max-w-md">
              {currentMaterial.file_name}
            </DialogTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} / {materials.length}
              </span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex items-center justify-center bg-muted/20 relative overflow-hidden">
          {loading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          ) : (
            <img
              src={imageUrl}
              alt={currentMaterial.file_name}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {/* Navigation Buttons */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 md:left-4 top-2/3 md:top-1/2 -translate-y-1/2 h-14 w-14 md:h-12 md:w-12 rounded-full shadow-lg"
            onClick={handlePrevious}
            disabled={loading}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 md:right-4 top-2/3 md:top-1/2 -translate-y-1/2 h-14 w-14 md:h-12 md:w-12 rounded-full shadow-lg"
            onClick={handleNext}
            disabled={loading}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Metadata Footer */}
        <div className="px-6 py-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={currentAnalysis ? "default" : "secondary"}>
              {currentAnalysis ? "✓ Analyzed" : "⏳ Not Analyzed"}
            </Badge>
            {currentAnalysis?.page_number && (
              <span className="text-sm text-muted-foreground">
                Page {currentAnalysis.page_number}
              </span>
            )}
          </div>

          {currentAnalysis && (
            <div className="space-y-2">
              {currentAnalysis.major_topics?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Topics:</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.major_topics.map((topic: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {currentAnalysis.key_concepts?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Key Concepts:</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentAnalysis.key_concepts.map((concept: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {concept}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
