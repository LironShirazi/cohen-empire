import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2 — בית הגלישה של הגלריה כש-Storage של Supabase מתמלא
 * (מיגרציה 0022). צד שרת בלבד: המפתחות לא יוצאים מכאן, והדפדפן מקבל
 * רק כתובת חתומה לקובץ אחד.
 *
 * החתימה היא AWS SigV4 ביד ולא דרך SDK — R2 מדבר S3, וזה כל מה שצריך
 * בשביל PUT ו-DELETE. בלי תלות חדשה ב-npm.
 */

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

export const isR2Configured = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket && publicBase
);

const host = `${accountId}.r2.cloudflarestorage.com`;

// RFC 3986 — encodeURIComponent משאיר את !'()* כמו שהם, ו-SigV4 לא
function encode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const hmac = (key: string | Buffer, value: string) =>
  createHmac("sha256", key).update(value).digest();

/**
 * כתובת חתומה לפעולה אחת על מפתח אחד. כל header שמועבר כאן נכנס
 * לחתימה, ובקשה שתשלח ערך אחר תידחה — כך `content-length` הופך את
 * הגודל שהשרת אישר לתקרה שנאכפת ב-R2 עצמו, כמו `file_size_limit`
 * של bucket ב-Supabase.
 */
function presign(
  method: "PUT" | "DELETE",
  key: string,
  headers: Record<string, string> = {},
  expiresSeconds = 600
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;

  const signed = Object.entries({ ...headers, host })
    .map(([name, value]) => [name.toLowerCase(), value.trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const signedHeaders = signed.map(([name]) => name).join(";");

  const query = Object.entries({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  })
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .sort()
    .join("&");

  const path = `/${bucket}/${key.split("/").map(encode).join("/")}`;
  const canonical = [
    method,
    path,
    query,
    signed.map(([name, value]) => `${name}:${value}\n`).join(""),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonical),
  ].join("\n");

  const signingKey = ["auto", "s3", "aws4_request"].reduce<Buffer>(
    (key, part) => hmac(key, part),
    hmac(`AWS4${secretAccessKey}`, day)
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

/** כתובת העלאה לדפדפן — לגודל ולסוג המדויקים שהשרת אישר */
export function presignUpload(key: string, size: number, contentType: string) {
  return presign("PUT", key, {
    "content-length": String(size),
    "content-type": contentType,
  });
}

export function publicUrl(key: string) {
  return `${publicBase}/${key.split("/").map(encode).join("/")}`;
}

/** מחיקה מהשרת עצמו — לדפדפן אין סיבה לקבל כתובת מחיקה */
export async function deleteObject(key: string) {
  const response = await fetch(presign("DELETE", key, {}, 60), {
    method: "DELETE",
  });
  // 404 — הקובץ כבר לא שם, וזו בדיוק התוצאה שרצינו
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed: ${response.status}`);
  }
}
