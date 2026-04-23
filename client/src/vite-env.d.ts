/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When set (e.g. https://api.example.com), browser calls this origin for `/api/*`. Unset = same-origin / Vite dev proxy. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
