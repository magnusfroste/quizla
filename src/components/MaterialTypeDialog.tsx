import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Material {
  id: string;
  file_name: string;
  material_type: 'content' | 'learning_objectives' | 'reference';
}

interface MaterialTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  onSave: (materialId: string, newType: 'content' | 'learning_objectives' | 'reference') => Promise<void>;
}

const typeLabels = {
  content: "Study Material",
  learning_objectives: "Learning Goals",
  reference: "Reference Material"
};

const typeDescriptions = {
  content: "Main study content that will be shown in the study viewer",
  learning_objectives: "Learning goals and objectives for quiz generation focus",
  reference: "Supporting material used only for quiz generation context"
};

export function MaterialTypeDialog({ open, onOpenChange, material, onSave }: MaterialTypeDialogProps) {
  const [selectedType, setSelectedType] = useState<'content' | 'learning_objectives' | 'reference'>(
    material?.material_type || 'content'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!material) return;
    
    setSaving(true);
    try {
      await onSave(material.id, selectedType);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update material type:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Material Category</DialogTitle>
          <DialogDescription>
            {material?.file_name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="content">
                  <div className="flex flex-col items-start">
                    <span>📚 {typeLabels.content}</span>
                    <span className="text-xs text-muted-foreground">{typeDescriptions.content}</span>
                  </div>
                </SelectItem>
                <SelectItem value="learning_objectives">
                  <div className="flex flex-col items-start">
                    <span>🎯 {typeLabels.learning_objectives}</span>
                    <span className="text-xs text-muted-foreground">{typeDescriptions.learning_objectives}</span>
                  </div>
                </SelectItem>
                <SelectItem value="reference">
                  <div className="flex flex-col items-start">
                    <span>📌 {typeLabels.reference}</span>
                    <span className="text-xs text-muted-foreground">{typeDescriptions.reference}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
