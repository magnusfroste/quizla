import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Image as ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CollectionCardProps {
  collection: any;
  onUpdate: () => void;
}

const CollectionCard = ({ collection, onUpdate }: CollectionCardProps) => {
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('collections')
        .delete()
        .eq('id', collection.id);

      if (error) throw error;

      toast({
        title: "Collection deleted",
        description: "Your collection has been removed.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="group hover:shadow-medium transition-all duration-300 border hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="bg-gradient-to-br from-primary to-primary-dark p-2 rounded-lg mb-2">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          {collection.is_public && (
            <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full">
              Public
            </span>
          )}
        </div>
        <CardTitle className="line-clamp-1">{collection.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {collection.description || "No description"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>{collection.materials?.[0]?.count || 0} materials</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate(`/collection/${collection.id}`)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Open
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" disabled={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete collection?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{collection.title}" and all its materials and quizzes.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

export default CollectionCard;