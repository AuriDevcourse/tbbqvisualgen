import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

// Despite the legacy "Glass" name, the surface follows the TechBBQ brand:
// a flat dark panel (#131313, one surface step above the page) with no border
// and no shadow. Depth comes from the surface step, not strokes.
export function GlassCard({ children, className, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-8",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
