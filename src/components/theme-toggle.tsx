import { Lightbulb, LightbulbOff } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex items-center justify-center h-9 w-9 rounded-xl glass hover:bg-accent transition ${className}`}
    >
      {isDark ? (
        <LightbulbOff className="h-4 w-4" />
      ) : (
        <Lightbulb className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}
