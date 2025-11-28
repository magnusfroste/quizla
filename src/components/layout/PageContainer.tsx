import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  withBottomNav?: boolean;
}

export function PageContainer({ children, className, withBottomNav = true }: PageContainerProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        withBottomNav && "pb-20 md:pb-0",
        className
      )}
    >
      {children}
    </div>
  );
}
