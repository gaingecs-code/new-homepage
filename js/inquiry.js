(function () {
  var LEGACY_STORAGE_KEY = "GAINGE_INQUIRIES";
  var ADMIN_STORAGE_KEY = "admin.local.inquiries.v1";
  var CONTRACT_VERSION = "v1";
  var form = document.getElementById("story-inquiry-form");
  if (!form) return;

  var statusEl = document.getElementById("story-inquiry-status");
  var submitBtn = document.getElementById("story-inquiry-submit");
  var settings = window.INQUIRY_SETTINGS || {};
  var recipientEmail = settings.recipientEmail || "gainge.cs@gainge.com";
  var apiUrl = String(settings.apiUrl || "").trim();
  var apiTimeoutMs = Number(settings.apiTimeoutMs || 12000);

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.classList.toggle("is-success", !isError && !!message);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randomSuffix() {
    return Math.random().toString(36).slice(2, 8);
  }

  function guessInquiryType() {
    var overrideType = String(settings.inquiryType || "").trim();
    if (overrideType) return overrideType;
    var source = (document.referrer || "") + " " + (window.location.search || "");
    var s = source.toLowerCase();
    if (s.indexOf("corporate-education") >= 0 || s.indexOf("education") >= 0) return "education";
    if (s.indexOf("consulting") >= 0) return "consulting";
    return "general";
  }

  function readLegacyItems() {
    try {
      var raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  }

  function saveLegacyItem(item) {
    var items = readLegacyItems();
    items.unshift(item);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(items));
  }

  function readAdminDraft() {
    try {
      var raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : { updatedAt: nowIso(), items: [] };
    } catch (_err) {
      return { updatedAt: nowIso(), items: [] };
    }
  }

  function saveAdminDraft(inquiry) {
    var current = readAdminDraft();
    var items = Array.isArray(current.items) ? current.items.slice() : [];
    items.unshift({
      id: inquiry.id,
      createdAt: inquiry.createdAt,
      company: inquiry.company,
      name: inquiry.name,
      phone: inquiry.phone,
      email: inquiry.email || "",
      message: inquiry.message,
      memo: "",
      isRead: false,
      readAt: null,
      recipientEmail: inquiry.recipientEmail,
      sourcePage: inquiry.source.page,
      inquiryType: inquiry.source.type,
      updatedAt: nowIso(),
    });
    localStorage.setItem(
      ADMIN_STORAGE_KEY,
      JSON.stringify(
        {
          ...current,
          updatedAt: nowIso(),
          items: items,
        },
        null,
        2
      )
    );
  }

  function buildInquiryPayload(fd) {
    return {
      id: "inq_" + Date.now() + "_" + randomSuffix(),
      createdAt: nowIso(),
      company: String(fd.get("company") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      recipientEmail: recipientEmail,
      source: {
        page: window.location.pathname,
        type: guessInquiryType(),
      },
      schemaVersion: CONTRACT_VERSION,
    };
  }

  function buildEmailPayload(inquiry) {
    return {
      to: recipientEmail,
      subject: "[가인지] 상담 문의 접수 - " + inquiry.company,
      text:
        "문의 유형: " + inquiry.source.type + "\n" +
        "기업명: " + inquiry.company + "\n" +
        "성함/직책: " + inquiry.name + "\n" +
        "연락처: " + inquiry.phone + "\n" +
        "이메일: " + (inquiry.email || "-") + "\n" +
        "문의 내용:\n" + inquiry.message,
    };
  }

  async function sendToApi(envelope) {
    if (!apiUrl) {
      return {
        ok: true,
        status: "local_only",
        message: "API URL 미설정: 로컬 저장만 수행",
      };
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, apiTimeoutMs);
    try {
      var res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
        signal: ctrl.signal,
      });
      var json = null;
      try {
        json = await res.json();
      } catch (_err) {
        json = null;
      }
      if (!res.ok) {
        throw new Error("API 요청 실패: " + res.status);
      }
      return {
        ok: true,
        status: "delivered",
        inquiryId: (json && json.inquiryId) || envelope.inquiry.id,
        mailed: json && typeof json.mailed === "boolean" ? json.mailed : true,
        message: (json && json.message) || "문의가 접수되었습니다.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // API 연결 전에도 프론트에서 계약 형태를 사용할 수 있도록 노출
  window.GaingeInquiryApi = {
    version: CONTRACT_VERSION,
    buildInquiryPayload: buildInquiryPayload,
    buildEmailPayload: buildEmailPayload,
    submit: sendToApi,
  };

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("");

    var fd = new FormData(form);
    var inquiry = buildInquiryPayload(fd);
    if (!inquiry.company || !inquiry.name || !inquiry.phone || !inquiry.message) {
      setStatus("필수 항목을 입력해주세요.", true);
      return;
    }

    var envelope = {
      schemaVersion: CONTRACT_VERSION,
      inquiry: inquiry,
      email: buildEmailPayload(inquiry),
      meta: {
        requestedAt: nowIso(),
        channel: "web_form",
      },
    };

    if (submitBtn) submitBtn.disabled = true;
    try {
      // API 연결 전/실패 상황에서도 문의 데이터는 반드시 남긴다.
      saveLegacyItem(inquiry);
      saveAdminDraft(inquiry);
      var result = await sendToApi(envelope);
      if (result.ok) {
        setStatus("접수되었습니다. 담당 컨설턴트가 확인 후 연락드립니다.", false);
        form.reset();
      } else {
        setStatus("문의는 저장되었지만 서버 전송에 실패했습니다.", true);
      }
    } catch (err) {
      setStatus("문의는 저장되었지만 서버 전송에 실패했습니다. API 설정을 확인해주세요.", true);
      console.error(err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
