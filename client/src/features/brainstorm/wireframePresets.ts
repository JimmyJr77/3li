import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  Bell,
  Boxes,
  Cable,
  Calendar,
  Cloud,
  Container,
  Cpu,
  CreditCard,
  Database,
  GitBranch,
  Globe2,
  HardDrive,
  Image,
  Key,
  Layers,
  LayoutGrid,
  List,
  Lock,
  Mail,
  MapPin,
  Monitor,
  MousePointerClick,
  Navigation,
  Network,
  Package,
  PanelTop,
  Radio,
  RectangleHorizontal,
  Router,
  ScrollText,
  Search,
  SeparatorHorizontal,
  Server,
  ServerCog,
  Shield,
  Sidebar,
  Square,
  TextCursorInput,
  Type,
  User,
  Wifi,
  Workflow,
} from "lucide-react";

export type WireframeLibrary = "wireframe_backend" | "wireframe_frontend";

export type WireframePresetDef = { id: string; label: string; Icon: LucideIcon };

/** Software / backend architecture stencils (Lucide-based). */
export const BACKEND_WIREFRAME_PRESETS: WireframePresetDef[] = [
  { id: "cloud", label: "Cloud", Icon: Cloud },
  { id: "server", label: "Server", Icon: Server },
  { id: "database", label: "Database", Icon: Database },
  { id: "hard_drive", label: "Storage", Icon: HardDrive },
  { id: "network", label: "Network", Icon: Network },
  { id: "internet", label: "Internet", Icon: Globe2 },
  { id: "lock", label: "Security", Icon: Lock },
  { id: "cpu", label: "Compute", Icon: Cpu },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "package", label: "Package", Icon: Package },
  { id: "workflow", label: "Pipeline", Icon: Workflow },
  { id: "git_branch", label: "Branch", Icon: GitBranch },
  { id: "shield", label: "Shield", Icon: Shield },
  { id: "key", label: "Key", Icon: Key },
  { id: "wifi", label: "Wi‑Fi", Icon: Wifi },
  { id: "router", label: "Router", Icon: Router },
  { id: "monitor", label: "Monitor", Icon: Monitor },
  { id: "container", label: "Container", Icon: Container },
  { id: "server_cog", label: "Server config", Icon: ServerCog },
  { id: "cable", label: "Cable", Icon: Cable },
  { id: "radio", label: "Radio", Icon: Radio },
  { id: "boxes", label: "Services", Icon: Boxes },
];

/** UI / front-end wireframe stencils. */
export const FRONTEND_WIREFRAME_PRESETS: WireframePresetDef[] = [
  { id: "primary_button", label: "Button", Icon: RectangleHorizontal },
  { id: "square", label: "Box", Icon: Square },
  { id: "heading", label: "Heading", Icon: Type },
  { id: "image_placeholder", label: "Image", Icon: Image },
  { id: "grid", label: "Grid", Icon: LayoutGrid },
  { id: "list", label: "List", Icon: List },
  { id: "nav", label: "Nav", Icon: Navigation },
  { id: "text_field", label: "Text field", Icon: TextCursorInput },
  { id: "header", label: "Header", Icon: PanelTop },
  { id: "click", label: "Click area", Icon: MousePointerClick },
  { id: "sidebar", label: "Sidebar", Icon: Sidebar },
  { id: "divider", label: "Divider", Icon: SeparatorHorizontal },
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "align", label: "Text block", Icon: AlignLeft },
  { id: "scroll", label: "Scroll area", Icon: ScrollText },
  { id: "search", label: "Search", Icon: Search },
  { id: "calendar", label: "Date", Icon: Calendar },
  { id: "mail", label: "Email", Icon: Mail },
  { id: "user", label: "User", Icon: User },
  { id: "bell", label: "Alert", Icon: Bell },
  { id: "map_pin", label: "Location", Icon: MapPin },
];

export function presetsForWireframeLibrary(lib: WireframeLibrary): WireframePresetDef[] {
  return lib === "wireframe_backend" ? BACKEND_WIREFRAME_PRESETS : FRONTEND_WIREFRAME_PRESETS;
}

export function defaultPresetIdForLibrary(lib: WireframeLibrary): string {
  return presetsForWireframeLibrary(lib)[0]!.id;
}

export function findWireframePreset(
  lib: WireframeLibrary,
  presetId: string | undefined,
): WireframePresetDef | undefined {
  const list = presetsForWireframeLibrary(lib);
  if (!presetId) return list[0];
  return list.find((p) => p.id === presetId) ?? list[0];
}
