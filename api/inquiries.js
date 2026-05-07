module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" });
  }

  const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      ok: false,
      code: "SERVER_ENV_MISSING",
      message: "Supabase env vars are missing",
    });
  }

  try {
    // Vercel runtime 환경에 따라 req.body가 문자열일 수 있어 안전하게 파싱
    const envelope =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const inquiry = envelope.inquiry || {};
    const source = inquiry.source || {};

    if (!inquiry.company || !inquiry.name || !inquiry.phone || !inquiry.message) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_PAYLOAD",
        message: "필수 항목이 누락되었습니다.",
      });
    }

    const row = {
      company: inquiry.company || null,
      name: inquiry.name || null,
      phone: inquiry.phone || null,
      email: inquiry.email || null,
      message: inquiry.message || null,
      recipient_email: inquiry.recipientEmail || null,
      source_page: source.page || null,
      source_type: source.type || null,
      raw_payload: envelope,
    };

    // key 타입(legacy JWT vs new secret)에 따라 apikey 헤더를 안전하게 선택
    const serviceKeyLooksLikeJwt = /^eyJ/.test(SUPABASE_SERVICE_ROLE_KEY);
    const apikeyHeader = serviceKeyLooksLikeJwt
      ? SUPABASE_SERVICE_ROLE_KEY
      : (SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY);

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apikeyHeader,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      return res.status(500).json({
        ok: false,
        code: "SUPABASE_INSERT_FAILED",
        message: text || "Supabase insert failed",
      });
    }

    const inserted = await insertRes.json();
    const inquiryId = inserted && inserted[0] ? inserted[0].id : (inquiry.id || null);

    return res.status(200).json({
      ok: true,
      inquiryId,
      mailed: false,
      message: "문의가 정상 접수되었습니다.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      message: err && err.message ? err.message : "Internal error",
    });
  }
};

  