import type { CSSProperties } from "react";
import type { LineStyle } from "@/features/brainstorm/types";

export function lineStyleToStroke(style: LineStyle | undefined): CSSProperties {
  switch (style) {
    case "solid_bold":
      return { strokeWidth: 2.75 };
    case "dotted":
      return { strokeDasharray: "5 5", strokeWidth: 1.5 };
    default:
      return { strokeWidth: 1.5 };
  }
}
