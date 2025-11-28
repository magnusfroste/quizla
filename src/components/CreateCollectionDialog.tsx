import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserLimits } from "@/hooks/useUserLimits";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { AlertCircle } from "lucide-react";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateCollectionDialog = ({ open, onOpenChange, onSuccess }: CreateCollectionDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const { toast } = useToast();
  const { canCreateCollection, usage, limits, plan } = useUserLimits();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check limit before creating
    if (!canCreateCollection) {
      setUpgradePromptOpen(true);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from('collections')
        .insert({
          user_id: user.id,
          title,
          description,
        });

      if (error) throw error;

      toast({
        title: "Collection created!",
        description: "Start adding study materials to generate quizzes.",
      });

      setTitle("");
      setDescription("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAtLimit = !canCreateCollection;
  const usageText = limits.maxCollections === Infinity 
    ? `${usage.collections} samlingar` 
    : `${usage.collections}/${limits.maxCollections} samlingar`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Organize your study materials into collections to generate AI-powered quizzes.
            </DialogDescription>
          </DialogHeader>

          {/* Usage indicator */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${isAtLimit ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'}`}>
            {isAtLimit && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            <span className="text-sm">
              {isAtLimit 
                ? `Du har nått gränsen för din ${plan === 'free' ? 'Free' : plan === 'student' ? 'Student' : 'Pro'}-plan`
                : usageText
              }
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Biology Chapter 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isAtLimit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What topics does this collection cover?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={isAtLimit}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {isAtLimit ? (
                <Button
                  type="button"
                  onClick={() => setUpgradePromptOpen(true)}
                  className="bg-gradient-to-r from-primary to-primary-dark"
                >
                  Uppgradera
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || !title.trim()}
                  className="bg-gradient-to-r from-primary to-primary-dark"
                >
                  {loading ? "Creating..." : "Create Collection"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UpgradePrompt
        open={upgradePromptOpen}
        onOpenChange={setUpgradePromptOpen}
        limitType="collections"
        currentUsage={usage.collections}
        maxUsage={limits.maxCollections}
      />
    </>
  );
};

export default CreateCollectionDialog;
