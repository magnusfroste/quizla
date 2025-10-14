import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";
import { MaterialTypeDialog } from "./MaterialTypeDialog";

interface Material {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  material_type: 'content' | 'learning_objectives' | 'reference';
}

interface MaterialGalleryProps {
  materials: Material[];
  analyses: any[];
  onMaterialClick: (material: Material, index: number) => void;
  onTypeChange?: (materialId: string, newType: 'content' | 'learning_objectives' | 'reference') => Promise<void>;
}

// Cache for signed URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string; expires: number }>();

async function getSignedUrl(storagePath: string): Promise<string> {
  const cached = urlCache.get(storagePath);
  const now = Date.now();
  
  // Return cached URL if still valid (59 minutes)
  if (cached && cached.expires > now) {
    return cached.url;
  }
  
  // Fetch new signed URL (valid for 1 hour)
  const { data } = await supabase.storage
    .from('study-materials')
    .createSignedUrl(storagePath, 3600);
  
  if (data?.signedUrl) {
    urlCache.set(storagePath, {
      url: data.signedUrl,
      expires: now + (59 * 60 * 1000) // 59 minutes
    });
    return data.signedUrl;
  }
  
  throw new Error('Failed to get signed URL');
}

export function MaterialGallery({ materials, analyses, onMaterialClick, onTypeChange }: MaterialGalleryProps) {
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchUrls = async () => {
      const urls = new Map<string, string>();
      
      for (const material of materials) {
        try {
          const url = await getSignedUrl(material.storage_path);
          urls.set(material.id, url);
        } catch (error) {
          console.error(`Failed to get URL for ${material.file_name}:`, error);
        }
      }
      
      setImageUrls(urls);
      setLoadingUrls(false);
    };

    fetchUrls();
  }, [materials]);

  const handleBadgeClick = (e: React.MouseEvent, material: Material) => {
    e.stopPropagation();
    setSelectedMaterial(material);
    setDialogOpen(true);
  };

  const handleSaveType = async (materialId: string, newType: 'content' | 'learning_objectives' | 'reference') => {
    if (onTypeChange) {
      await onTypeChange(materialId, newType);
    }
  };

  const getTypeBadge = (type: 'content' | 'learning_objectives' | 'reference') => {
    switch (type) {
      case 'learning_objectives':
        return { icon: '🎯', label: 'Goals', variant: 'secondary' as const };
      case 'reference':
        return { icon: '📌', label: 'Ref', variant: 'outline' as const };
      default:
        return null;
    }
  };

  if (loadingUrls) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {materials.map((material) => (
          <div key={material.id} className="animate-pulse">
            <AspectRatio ratio={1}>
              <div className="w-full h-full bg-muted rounded-lg" />
            </AspectRatio>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {materials.map((material, index) => {
        const isAnalyzed = analyses.some(a => a.material_id === material.id);
        const imageUrl = imageUrls.get(material.id);
        
        return (
          <div
            key={material.id}
            className="group relative cursor-pointer transition-transform hover:scale-105"
            onClick={() => onMaterialClick(material, index)}
          >
            <AspectRatio ratio={1}>
              <div className="relative w-full h-full overflow-hidden rounded-lg border bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={material.file_name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className="hidden absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
                
                {/* Status Badge */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge 
                    variant={isAnalyzed ? "default" : "secondary"} 
                    className="text-xs cursor-pointer hover:opacity-80"
                    onClick={(e) => handleBadgeClick(e, material)}
                  >
                    {isAnalyzed ? "✓ Analyzed" : "⏳ Pending"}
                  </Badge>
                </div>
                
                {/* Type Badge */}
                {getTypeBadge(material.material_type) && (
                  <div className="absolute top-2 left-2">
                    <Badge 
                      variant={getTypeBadge(material.material_type)!.variant}
                      className="text-xs"
                    >
                      {getTypeBadge(material.material_type)!.icon} {getTypeBadge(material.material_type)!.label}
                    </Badge>
                  </div>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <p className="text-white text-sm font-medium truncate w-full">
                    {material.file_name}
                  </p>
                </div>
              </div>
            </AspectRatio>
          </div>
        );
      })}
      </div>

      <MaterialTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        material={selectedMaterial}
        onSave={handleSaveType}
      />
    </>
  );
}
