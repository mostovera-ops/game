/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_BACKEND_ADAPTER?: 'local' | 'supabase'
  /** NET-5: если 'true' — принудительно fail-closed на supabase даже вне прод-сборки. */
  readonly VITE_REQUIRE_SUPABASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
