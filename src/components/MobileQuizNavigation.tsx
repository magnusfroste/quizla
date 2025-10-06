import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MobileQuizNavigationProps {
  currentIndex: number;
  totalQuestions: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastQuestion: boolean;
}

export function MobileQuizNavigation({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onSubmit,
  canGoBack,
  canGoNext,
  isLastQuestion,
}: MobileQuizNavigationProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50 safe-area-bottom">
      <div className="flex items-center justify-between p-4 gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={onPrevious}
          disabled={!canGoBack}
          className="h-12 w-12 flex-shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
          <span className="text-sm font-medium">
            {currentIndex + 1} / {totalQuestions}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            Question {currentIndex + 1}
          </span>
        </div>

        {isLastQuestion ? (
          <Button
            onClick={onSubmit}
            className="h-12 px-6 flex-shrink-0 font-semibold"
          >
            Submit
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            disabled={!canGoNext}
            className="h-12 w-12 flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
