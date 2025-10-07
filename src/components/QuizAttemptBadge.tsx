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
      <Badge variant="outline" className={cn("text-xs", className)}>
        <Users className="h-3 w-3 mr-1" />
        Be the first to try
      </Badge>
    );
  }

  const isTrending = attemptCount >= 10;
  
  return (
    <Badge 
      variant={isTrending ? "default" : "secondary"}
      className={cn(
        "text-xs font-medium",
        isTrending && "bg-gradient-to-r from-primary to-primary-dark",
        className
      )}
    >
      {isTrending && "🔥 "}
      <Users className="h-3 w-3 mr-1" />
      {attemptCount} {attemptCount === 1 ? "student" : "students"} completed
    </Badge>
  );
};
