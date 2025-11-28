import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="relative">
        <div 
          className={cn(
            "animate-spin rounded-full border-2 border-primary/20 border-t-primary",
            sizeClasses[size],
            className
          )} 
        />
        <div 
          className={cn(
            "absolute inset-0 animate-ping rounded-full border border-primary/30",
            sizeClasses[size]
          )} 
          style={{ animationDuration: '1.5s' }}
        />
      </div>
    </div>
  );
}
