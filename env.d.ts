declare module '*?url' {
  const source: string;
  export default source;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
  }
}
