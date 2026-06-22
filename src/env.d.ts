/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, any>;
  export default component;
}

interface ImportMetaEnv {
  /** WEB 端口 */
  readonly VITE_WEB_PORT?: string;
  /** API 端口 */
  readonly VITE_SERVER_PORT?: string;
  /** API 地址 */
  readonly VITE_API_URL?: string;
  /** Cloudflare Turnstile Site Key */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** 构建类型 */
  readonly VITE_BUILD_TYPE?: string;
  /** 启用一起听功能 */
  readonly VITE_ENABLE_LISTEN_TOGETHER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
