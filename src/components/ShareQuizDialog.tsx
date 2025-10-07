import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Share2, X, Copy, Check, Search, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ShareQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  quizTitle: string;
  isPublic: boolean;
}

interface SharedUser {
  id: string;
  email: string;
  full_name: string | null;
}

export function ShareQuizDialog({ open, onOpenChange, quizId, quizTitle, isPublic: initialIsPublic }: ShareQuizDialogProps) {
  const [email, setEmail] = useState("");
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadSharedUsers();
      setIsPublic(initialIsPublic);
    }
  }, [open, quizId, initialIsPublic]);

  const loadSharedUsers = async () => {
    const { data, error } = await supabase
      .from("quiz_shares")
      .select(`
        shared_with_user_id,
        profiles:shared_with_user_id (
          id,
          email,
          full_name
        )
      `)
      .eq("quiz_id", quizId);

    if (error) {
      console.error("Error loading shared users:", error);
      return;
    }

    const users = data
      .map((share: any) => share.profiles)
      .filter(Boolean);
    setSharedUsers(users);
  };

  const handleShare = async () => {
    if (!email.trim()) return;

    setLoading(true);
    try {
      // Find user by email
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", email.trim())
        .limit(1);

      if (profileError) throw profileError;

      if (!profiles || profiles.length === 0) {
        toast({
          title: "User not found",
          description: "No user found with that email address.",
          variant: "destructive",
        });
        return;
      }

      const user = profiles[0];

      // Check if already shared
      const alreadyShared = sharedUsers.some(u => u.id === user.id);
      if (alreadyShared) {
        toast({
          title: "Already shared",
          description: "This quiz is already shared with this user.",
        });
        return;
      }

      // Create share
      const { error: shareError } = await supabase
        .from("quiz_shares")
        .insert({
          quiz_id: quizId,
          shared_with_user_id: user.id,
        });

      if (shareError) throw shareError;

      toast({
        title: "Quiz shared",
        description: `Shared with ${user.email}`,
      });

      setEmail("");
      loadSharedUsers();
    } catch (error: any) {
      console.error("Error sharing quiz:", error);
      toast({
        title: "Error",
        description: "Failed to share quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("quiz_shares")
        .delete()
        .eq("quiz_id", quizId)
        .eq("shared_with_user_id", userId);

      if (error) throw error;

      toast({
        title: "Access removed",
        description: "User can no longer access this quiz.",
      });

      loadSharedUsers();
    } catch (error) {
      console.error("Error removing share:", error);
      toast({
        title: "Error",
        description: "Failed to remove access.",
        variant: "destructive",
      });
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_public: checked })
        .eq("id", quizId);

      if (error) throw error;

      setIsPublic(checked);
      toast({
        title: checked ? "Quiz is now public" : "Quiz is now private",
        description: checked 
          ? "Anyone with the link can access this quiz." 
          : "Only you and shared users can access this quiz.",
      });
    } catch (error) {
      console.error("Error updating quiz visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update quiz visibility.",
        variant: "destructive",
      });
    }
  };

  const copyShareLink = async () => {
    // Auto-enable public access if not already enabled
    if (!isPublic) {
      try {
        const { error } = await supabase
          .from("quizzes")
          .update({ is_public: true })
          .eq("id", quizId);

        if (error) throw error;
        
        setIsPublic(true);
        toast({
          title: "Quiz is now public",
          description: "Anyone with the link can now access this quiz.",
        });
      } catch (error) {
        console.error("Error making quiz public:", error);
        toast({
          title: "Error",
          description: "Failed to make quiz public. Please try the toggle manually.",
          variant: "destructive",
        });
        return;
      }
    }

    const link = `${window.location.origin}/quiz/${quizId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: "Link copied",
      description: "Quiz link copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Quiz
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm mb-2">{quizTitle}</h3>
          </div>

          {/* Public Access Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex-1">
              <Label htmlFor="public-toggle" className="font-semibold">
                Public Access
              </Label>
              <p className="text-sm text-muted-foreground">
                Anyone with the link can access
              </p>
            </div>
            <Switch
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={handleTogglePublic}
            />
          </div>

          {/* Copy Link Button */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={copyShareLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {isPublic ? "Copy Share Link" : "Make Public & Copy Link"}
                </>
              )}
            </Button>
            {!isPublic && (
              <p className="text-xs text-muted-foreground text-center">
                Clicking this will automatically make the quiz public
              </p>
            )}
          </div>

          {/* Share with specific users */}
          <div>
            <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Share with classmates
            </Label>
            <div className="flex gap-2 mt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShare()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleShare} disabled={loading || !email.trim()}>
                Share
              </Button>
            </div>
          </div>

          {/* Shared Users List */}
          {sharedUsers.length > 0 && (
            <div>
              <Label className="text-sm font-semibold mb-2">Shared with</Label>
              <div className="space-y-2 mt-2">
                {sharedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || user.email}
                      </p>
                      {user.full_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveShare(user.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
