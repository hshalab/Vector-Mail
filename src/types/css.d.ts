// Next.js only declares CSS Modules (`*.module.css`, see next/types/global.d.ts),
// so plain global stylesheets have no type declaration. TypeScript's
// `noUncheckedSideEffectImports` check — which the editor's TS server applies —
// then reports TS2882/TS2307 on every `import "@/styles/*.css"`.
//
// Global CSS is imported purely for its side effect and exports nothing, so the
// empty body is deliberate. Next's `*.module.css` declaration is the more
// specific pattern and still wins for CSS Modules.
declare module "*.css" {}
