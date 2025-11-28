import { useNavigate } from "react-router-dom";
import { Rocket, X, Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: 'collections' | 'materials' | 'quizzes';
  currentUsage: number;
  maxUsage: number;
}

const limitMessages = {
  collections: {
    title: 'Samlingsgräns nådd',
    description: 'Du har nått maxgränsen för samlingar i din Free-plan.',
  },
  materials: {
    title: 'Materialgräns nådd',
    description: 'Du har nått maxgränsen för uppladdade material i din Free-plan.',
  },
  quizzes: {
    title: 'Quiz-gräns nådd',
    description: 'Du har nått maxgränsen för quiz i denna samling.',
  },
};

const studentBenefits = [
  '20 samlingar',
  '200 sidor totalt',
  '10 quiz per samling',
  'Prioriterad support',
];

export function UpgradePrompt({
  open,
  onOpenChange,
  limitType,
  currentUsage,
  maxUsage,
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const message = limitMessages[limitType];

  const handleViewPlans = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>{message.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {message.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Usage indicator */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Din användning</span>
            <span className="font-semibold text-foreground">
              {currentUsage}/{maxUsage}
            </span>
          </div>

          {/* Student plan benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">Student-planen ger dig:</span>
            </div>
            <ul className="space-y-2 pl-6">
              {studentBenefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Stäng
          </Button>
          <Button onClick={handleViewPlans} className="flex-1">
            Se planer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
