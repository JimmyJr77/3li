import { useTheme } from "next-themes";

/** Marketing sections: explicit zinc palette vs global shadcn theme. */
export function useLandingPalette() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return { isDark };
}
