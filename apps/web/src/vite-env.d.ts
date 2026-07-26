/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  /** Required at runtime — operator name on legal pages */
  readonly VITE_OPERATOR_NAME?: string;
  /** Required at runtime — contact email on legal pages */
  readonly VITE_CONTACT_EMAIL?: string;
  /** Required at runtime — canonical public service URL on legal pages */
  readonly VITE_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
