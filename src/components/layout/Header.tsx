import { Button } from "@/components/ui/button";
import { Zap, LogOut, User, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";

interface HeaderProps {
  onSignOut?: () => void;
  showMenu?: boolean;
}

export function Header({ onSignOut, showMenu = true }: HeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-50 safe-area-top">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <button
          className="flex items-center gap-2"
          onClick={() => navigate('/dashboard')}
        >
          <span className="h-3 w-3 rounded-full bg-primary" />
          <span className="font-mono text-lg font-bold tracking-tight">quizla</span>
        </button>

        {showMenu && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/admin')}
                className="text-primary hover:text-primary/80"
              >
                <Shield className="h-5 w-5" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="text-muted-foreground hover:text-foreground"
            >
              <User className="h-5 w-5" />
            </Button>
            {onSignOut && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
