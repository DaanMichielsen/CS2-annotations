// Declares Vite-specific ImportMeta extensions so non-Vite compilers (e.g. Next.js tsc)
// don't error when they traverse this package's source files.
interface ImportMeta {
  glob(pattern: string, options?: Record<string, unknown>): Record<string, unknown>
}
