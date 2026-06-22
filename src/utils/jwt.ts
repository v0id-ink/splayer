import { getTurnstileToken } from "./turnstile";
import { isElectron } from "./env";

// JWT 缓存与刷新
let jwtToken: string | null = null;
let jwtExpireAt = 0; // 毫秒时间戳
let refreshPromise: Promise<string> | null = null;

// 判断是否过期（提前 60 秒刷新）
const isExpired = (): boolean => {
  return !jwtToken || Date.now() >= jwtExpireAt - 60_000;
};

// 从 Vercel 拉取新 JWT
const fetchJwt = async (): Promise<string> => {
  // Web 端：先获取 Turnstile token 再进行验证
  let url = "/api/token";
  if (!isElectron) {
    const turnstileToken = await getTurnstileToken();
    if (turnstileToken) {
      url += `?turnstile=${encodeURIComponent(turnstileToken)}`;
    }
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`获取 JWT 失败: ${res.status}`);
  const data = (await res.json()) as { token: string; exp: number };
  jwtToken = data.token;
  jwtExpireAt = data.exp * 1000;
  return data.token;
};

// 获取有效 JWT（带并发去重）
export const ensureJwt = async (): Promise<string> => {
  if (!isExpired()) return jwtToken as string;
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchJwt().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};
