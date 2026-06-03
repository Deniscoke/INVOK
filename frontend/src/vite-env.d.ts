// Ambient typing for Vite's import.meta.env (self-contained, no external types).
interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_PUBLIC_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
