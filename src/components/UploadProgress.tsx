import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'compressing' | 'uploading' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadItem[];
  onCancel: (id: string) => void;
  onClose: () => void;
}

export function UploadProgress({ uploads, onCancel, onClose }: UploadProgressProps) {
  const allComplete = uploads.every(u => u.status === 'complete' || u.status === 'error');
  const hasErrors = uploads.some(u => u.status === 'error');

  return (
    <Card className="fixed bottom-4 right-4 w-80 md:w-96 z-50 shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {allComplete ? 'Upload Complete' : 'Uploading...'}
          </h3>
          {allComplete && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {uploads.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <img 
                src={item.preview} 
                alt={item.file.name}
                className="w-12 h-12 rounded object-cover flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
                
                {item.status === 'compressing' && (
                  <p className="text-xs text-blue-500">Optimizing...</p>
                )}
                
                {item.status === 'uploading' && (
                  <Progress value={item.progress} className="h-1 mt-1" />
                )}
                
                {item.status === 'complete' && (
                  <div className="flex items-center gap-1 text-green-500 text-xs mt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Complete</span>
                  </div>
                )}
                
                {item.status === 'error' && (
                  <div className="flex items-center gap-1 text-destructive text-xs mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{item.error || 'Failed'}</span>
                  </div>
                )}
              </div>

              {(item.status === 'pending' || item.status === 'compressing') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onCancel(item.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {allComplete && !hasErrors && (
          <p className="text-xs text-green-500 text-center">
            ✓ {uploads.length} file{uploads.length === 1 ? '' : 's'} uploaded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
