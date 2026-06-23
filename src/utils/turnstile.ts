// Cloudflare Turnstile 不可见验证（仅 Web 端）
import { isElectron } from "./env";

// Turnstile 全局类型声明
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string | undefined;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
      execute: (container: string | HTMLElement) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey?: string;
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
  callback?: (token: string) => void;
  "error-callback"?: (errorCode: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const CONTAINER_ID = "turnstile-invisible";
// Turnstile token 有效期 5 分钟，提前 1 分钟刷新
const TOKEN_TTL = 4 * 60 * 1000;

let widgetId: string | null = null;
let currentToken: string | null = null;
let tokenTimestamp = 0;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;
let scriptLoaded = false;

// 加载 Turnstile 脚本
const loadScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (scriptLoaded || window.turnstile) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Turnstile 脚本加载失败"));
    document.head.appendChild(script);
  });
};

// 初始化不可见组件
const initWidget = async (): Promise<void> => {
  if (widgetId !== null) return;

  await loadScript();

  if (!window.turnstile) throw new Error("Turnstile 未就绪");

  // 创建隐藏容器
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    document.body.appendChild(container);
  }

  widgetId =
    window.turnstile.render(`#${CONTAINER_ID}`, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      execution: "execute", // 手动触发，避免页面加载时自动验证
      callback: (token: string) => {
        currentToken = token;
        tokenTimestamp = Date.now();
        if (pendingResolve) {
          pendingResolve(token);
          pendingResolve = null;
          pendingReject = null;
        }
      },
      "error-callback": () => {
        if (pendingReject) {
          pendingReject(new Error("Turnstile 验证失败"));
          pendingResolve = null;
          pendingReject = null;
        }
      },
      "expired-callback": () => {
        currentToken = null;
      },
    }) ?? null;
};

// 获取 Turnstile token（Web 端专用）
export const getTurnstileToken = async (): Promise<string> => {
  // Electron 环境不需要 Turnstile
  if (isElectron) return "";

  // 未配置 site key 时跳过
  if (!SITE_KEY) {
    console.warn("VITE_TURNSTILE_SITE_KEY 未配置，跳过验证");
    return "";
  }

  await initWidget();

  // 如果 token 仍然有效，直接返回
  if (currentToken && Date.now() - tokenTimestamp < TOKEN_TTL) {
    return currentToken;
  }

  // 重置并等待新 token
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;

    // 重置后执行验证
    window.turnstile!.reset(widgetId!);
    window.turnstile!.execute(`#${CONTAINER_ID}`);

    // 超时 30 秒
    setTimeout(() => {
      if (pendingResolve) {
        pendingResolve = null;
        pendingReject = null;
        reject(new Error("Turnstile 验证超时"));
      }
    }, 30_000);
  });
};
