import crypto from "node:crypto";
import { parse as parseUrl } from "node:url";

// JWT 配置
const JWT_TTL = 60 * 60; // 1 小时
const ISS = "splayer-vercel";
const AUD = "splayer-fcapp";

// Turnstile Siteverify API
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Base64url 编码
const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64url");

// 签发 RS256 JWT（无 kid，匹配阿里云 FC 无 kid 的 JWKS）
const signJWT = (privateKeyPem: string): { token: string; exp: number } => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: ISS,
    aud: AUD,
    iat: now,
    exp: now + JWT_TTL,
    form: "splayer",
    jti: crypto.randomUUID(),
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(data), privateKeyPem);
  return { token: `${data}.${b64url(signature)}`, exp: payload.exp };
};

// 验证 Turnstile token
const verifyTurnstile = async (token: string, secretKey: string): Promise<boolean> => {
  const formData = new URLSearchParams();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    console.error("Turnstile Siteverify 请求失败:", res.status);
    return false;
  }

  const data = (await res.json()) as { success: boolean };
  return data.success === true;
};

// 处理 CORS
const setCors = (res: any): void => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};

// Vercel Serverless Function 入口
export default async function handler(req: any, res: any): Promise<void> {
  setCors(res);
  // 预检
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  // 读取私钥
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("JWT_PRIVATE_KEY 未配置");
    res.status(500).json({ error: "Server Misconfigured" });
    return;
  }

  // Turnstile 验证（若配置了密钥）
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const parsedUrl = parseUrl(req.url || "", true);
    const turnstileToken = parsedUrl.query.turnstile as string | undefined;
    if (!turnstileToken) {
      res.status(400).json({ error: "缺少 Turnstile token" });
      return;
    }
    const valid = await verifyTurnstile(turnstileToken, turnstileSecret);
    if (!valid) {
      console.warn("Turnstile 验证失败");
      res.status(403).json({ error: "Turnstile 验证失败" });
      return;
    }
  }

  try {
    const { token, exp } = signJWT(privateKey);
    res.status(200).json({ token, exp, ttl: JWT_TTL });
  } catch (e) {
    console.error("签发失败:", e);
    res.status(500).json({ error: "Token Generation Failed" });
  }
}
