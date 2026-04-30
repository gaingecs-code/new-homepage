(function () {
  var STORAGE_KEY = "GAINGE_INQUIRIES";
  var form = document.getElementById("story-inquiry-form");
  if (!form) return;

  var statusEl = document.getElementById("story-inquiry-status");
  var submitBtn = document.getElementById("story-inquiry-submit");
  var settings = window.INQUIRY_SETTINGS || {};
  var recipientEmail = settings.recipientEmail || "gainge.cs@gainge.com";
  var apiUrl = (settings.apiUrl || "").trim();

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.classList.toggle("is-success", !isError && !!message);
  }

  function readItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_err) {
      return [];
    }
  }

  function saveItem(item) {
    var items = readItems();
    items.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  async function sendToApi(payload) {
    if (!apiUrl) return { skipped: true };
    var res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("API 요청 실패: " + res.status);
    return { skipped: false };
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("");

    var fd = new FormData(form);
    var inquiry = {
      id: "inq_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      company: String(fd.get("company") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      recipientEmail: recipientEmail,
      sourcePage: window.location.pathname
    };

    if (!inquiry.company || !inquiry.name || !inquiry.phone || !inquiry.message) {
      setStatus("필수 항목을 입력해주세요.", true);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      saveItem(inquiry);
      await sendToApi({
        inquiry: inquiry,
        email: {
          to: recipientEmail,
          subject: "[가인지] 고민 상담 접수 - " + inquiry.company,
          text:
            "기업명: " + inquiry.company + "\n" +
            "성함/직책: " + inquiry.name + "\n" +
            "연락처: " + inquiry.phone + "\n" +
            "이메일: " + (inquiry.email || "-") + "\n" +
            "고민 내용:\n" + inquiry.message
        }
      });
      setStatus("접수되었습니다. 담당 컨설턴트가 확인 후 연락드립니다.", false);
      form.reset();
    } catch (err) {
      setStatus("로컬에는 저장되었지만 서버 전송에 실패했습니다. API 설정을 확인해주세요.", true);
      console.error(err);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
