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
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => navigate('/dashboard')}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent blur-lg opacity-50" />
            <div className="relative bg-gradient-to-br from-primary to-accent p-2.5 rounded-xl">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Quizla
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
              Study Smarter
            </p>
          </div>
        </div>

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
