import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
