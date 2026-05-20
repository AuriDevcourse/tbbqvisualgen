import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

// Despite the legacy "Glass" name, the surface now matches the new TechBBQ
// website style — solid dark card with a subtle warm tint and a faint warm
// border (no translucent backdrop blur).
export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-[#15110e]/95 border border-[#ff6b00]/10 rounded-2xl p-8",
        "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_30px_60px_-30px_rgba(0,0,0,0.6)]",
        className
      )}
    >
      {children}
    </div>
  );
}
