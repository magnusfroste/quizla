import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface QuizAttempt {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  quiz: {
    title: string;
    collection: {
      title: string;
    };
  };
}

interface QuizHistoryProps {
  attempts: QuizAttempt[];
}

export function QuizHistory({ attempts }: QuizHistoryProps) {
  const navigate = useNavigate();

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return "bg-green-500/10 text-green-700 dark:text-green-400";
    if (percentage >= 60) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    return "bg-red-500/10 text-red-700 dark:text-red-400";
  };

  if (attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Quizzes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No quiz attempts yet. Complete a quiz to see your history!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Quizzes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/quiz/${attempt.quiz_id}`)}
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{attempt.quiz.title}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {attempt.quiz.collection.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(attempt.completed_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 ml-4">
                <Badge
                  className={`${getScoreColor(attempt.score, attempt.total_questions)} font-semibold`}
                >
                  {attempt.score}/{attempt.total_questions}
                </Badge>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {Math.round((attempt.score / attempt.total_questions) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
