import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "@/app/router";
import { Providers } from "@/app/providers";
import { migrateThemeLocalStorageV2ToV3 } from "@/lib/migrateThemeStorage";
import "./index.css";
import "./styles/tokens.css";

migrateThemeLocalStorageV2ToV3();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <AppRouter />
    </Providers>
  </StrictMode>,
);
