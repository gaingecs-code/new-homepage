function uniq(list) {
  var seen = {};
  var out = [];
  (list || []).forEach(function (v) {
    var s = String(v || "").trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    out.push(s);
  });
  return out;
}

function normalizeSupabaseUrl(raw) {
  var s = String(raw || "").trim().replace(/\/+$/, "");
  // 휴먼에러 흡수: URL에 /rest/v1을 넣어도 base URL로 정규화
  return s.replace(/\/rest\/v1$/i, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "POST only" });
  }

  const SUPABASE_URL = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  );
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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

    // 휴먼에러/키종류 혼용을 흡수하기 위해 인증 헤더 조합을 순차 시도
    const keyCandidates = uniq([
      SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY,
      SUPABASE_PUBLISHABLE_KEY,
    ]);
    const attempts = [];
    var inserted = null;
    var success = false;

    for (var i = 0; i < keyCandidates.length; i += 1) {
      var apikey = keyCandidates[i];
      var authBearer = SUPABASE_SERVICE_ROLE_KEY || apikey;

      var insertRes = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apikey,
          Authorization: `Bearer ${authBearer}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      });

      if (insertRes.ok) {
        inserted = await insertRes.json();
        success = true;
        break;
      }

      var text = await insertRes.text();
      attempts.push({
        status: insertRes.status,
        message: text || "",
        keyPrefix: apikey.slice(0, 6),
      });
    }

    if (!success) {
      return res.status(500).json({
        ok: false,
        code: "SUPABASE_INSERT_FAILED",
        message: "Supabase insert failed",
        detail: attempts,
      });
    }

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

  