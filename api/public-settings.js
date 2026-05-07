function normalizeSupabaseUrl(url) {
  var s = String(url || "").trim();
  if (!s) return "";
  return s.replace(/\/+$/, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  var key = String((req.query && req.query.key) || "").trim();
  if (!key) {
    return res.status(400).json({ ok: false, code: "INVALID_KEY" });
  }

  var SUPABASE_URL = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  );
  var SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, code: "MISSING_SUPABASE_ENV" });
  }

  try {
    var r = await fetch(
      SUPABASE_URL +
        "/rest/v1/app_settings?key=eq." +
        encodeURIComponent(key) +
        "&select=value&limit=1",
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );

    var rows = [];
    try {
      rows = await r.json();
    } catch (e) {
      rows = [];
    }
    if (!r.ok) {
      return res.status(500).json({ ok: false, code: "SUPABASE_READ_FAILED" });
    }

    var value = rows && rows[0] ? rows[0].value : null;
    return res.status(200).json({ ok: true, key: key, value: value });
  } catch (e) {
    return res.status(500).json({ ok: false, code: "UNEXPECTED_ERROR" });
  }
};

