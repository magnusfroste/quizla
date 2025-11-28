import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuizAttemptBadgeProps {
  attemptCount: number;
  className?: string;
}

export const QuizAttemptBadge = ({ attemptCount, className }: QuizAttemptBadgeProps) => {
  if (attemptCount === 0) {
    return (
      <Badge variant="outline" className={cn("text-xs px-2", className)}>
        New
      </Badge>
    );
  }

  const isTrending = attemptCount >= 10;
  
  return (
    <Badge 
      variant={isTrending ? "default" : "secondary"}
      className={cn(
        "text-xs font-medium px-2",
        isTrending && "bg-gradient-to-r from-primary to-primary-dark",
        className
      )}
    >
      {isTrending && "🔥 "}
      <Users className="h-3 w-3 mr-1" />
      {attemptCount}
    </Badge>
  );
};
