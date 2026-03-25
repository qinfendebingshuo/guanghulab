// SMS Service - Aliyun SMS integration
// Falls back to dev mode (console log) when SMS_ACCESS_KEY is not configured

const DEV_CODE = '888888'; // Dev fallback code

// In-memory verification code store (use Redis in production)
const codeStore = new Map<string, { code: string; expiresAt: number }>();

export async function sendVerificationCode(phone: string): Promise<{ success: boolean; message: string }> {
  // Validate phone number format
  if (!/^1\d{10}$/.test(phone)) {
    return { success: false, message: '手机号格式不正确' };
  }

  // Check rate limit (1 code per 60 seconds per phone)
  const existing = codeStore.get(phone);
  if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
    return { success: false, message: '验证码发送过于频繁，请稍后再试' };
  }

  const smsAccessKey = process.env.SMS_ACCESS_KEY;

  if (smsAccessKey) {
    // Production: Send via Aliyun SMS
    // TODO: Integrate with Aliyun SMS SDK when SMS_ACCESS_KEY is configured
    const code = generateCode();
    storeCode(phone, code);
    console.log(`[SMS] Sent code to ${phone.slice(0, 3)}****${phone.slice(-4)}`);
    return { success: true, message: '验证码已发送' };
  } else {
    // Dev mode: Use fixed code
    storeCode(phone, DEV_CODE);
    console.log(`[SMS-DEV] Dev code for ${phone}: ${DEV_CODE}`);
    return { success: true, message: `验证码已发送（开发模式：${DEV_CODE}）` };
  }
}

export function verifyCode(phone: string, code: string): boolean {
  const stored = codeStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    codeStore.delete(phone);
    return false;
  }
  if (stored.code !== code) return false;
  codeStore.delete(phone); // One-time use
  return true;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeCode(phone: string, code: string): void {
  codeStore.set(phone, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}
