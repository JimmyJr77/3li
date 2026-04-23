import { useTheme } from "next-themes";
import { landingContentIsDark } from "@/lib/themeIds";

/** Marketing sections: zinc + red when using site themes; align with workspace light/dark when app themes are active on public. */
export function useLandingPalette() {
  const { theme, resolvedTheme } = useTheme();
  const isDark = landingContentIsDark(theme, resolvedTheme);
  return { isDark };
}
