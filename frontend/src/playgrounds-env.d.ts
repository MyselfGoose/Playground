export {};

declare global {
  interface Window {
    /** Injected in `app/layout.js` from server env so the client uses Railway URL even if the build omitted NEXT_PUBLIC inlining. */
    __PLAYGROUNDS_CONFIG__?: {
      apiBase?: string;
      socketUrl?: string;
      sameOriginApi?: boolean;
    };
  }
}
