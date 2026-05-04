import { useTheme } from "@/components/providers/theme";
import { Button } from "@/components/ui/button";

export function LandingThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
