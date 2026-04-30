import { useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { isNodeSelection, mergeAttributes, ResizableNodeView } from "@tiptap/core";
import { defaultCasesData } from "../data/defaultCases";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";

function IconAlignLeft() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3 4h18v2H3V4zm0 5h12v2H3V9zm0 5h18v2H3v-2zm0 5h12v2H3v-2z" />
    </svg>
  );
}
function IconAlignCenter() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3 4h18v2H3V4zm3 5h12v2H6V9zm-3 5h18v2H3v-2zm3 5h12v2H6v-2z" />
    </svg>
  );
}
function IconAlignRight() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3 4h18v2H3V4zm6 5h12v2H9V9zm-6 5h18v2H3v-2zm6 5h12v2H9v-2z" />
    </svg>
  );
}

/** 이미지 블록 좌·중·우 배치 (그림 상자 위치) */
function IconImageAlignLeft() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="5" width="9" height="7" rx="1" fill="currentColor" opacity="0.38" />
      <path fill="currentColor" d="M13 7h9v1.5h-9V7zm0 3.25h7v1.5H13v-1.5zm0 3.25h9v1.5h-9V13.5z" opacity="0.9" />
    </svg>
  );
}
function IconImageAlignCenter() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <rect x="7.5" y="5" width="9" height="7" rx="1" fill="currentColor" opacity="0.38" />
      <path fill="currentColor" d="M3 7h18v1.5H3V7zm2 3.25h14v1.5H5v-1.5zm-2 3.25h18v1.5H3V13.5z" opacity="0.9" />
    </svg>
  );
}
function IconImageAlignRight() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <rect x="13" y="5" width="9" height="7" rx="1" fill="currentColor" opacity="0.38" />
      <path fill="currentColor" d="M2 7h9v1.5H2V7zm2 3.25h7v1.5H4v-1.5zm-2 3.25h9v1.5H2V13.5z" opacity="0.9" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
      />
    </svg>
  );
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STORAGE_KEY = "admin.local.cases.v1";
const INDUSTRY_OPTIONS = ["소비재·F&B·뷰티", "ICT·전자", "모빌리티·산업재", "건설·에너지", "바이오·헬스케어", "콘텐츠·교육·미디어", "금융", "공공영역·NGO", "유통·라이프스타일"];
const SCALE_OPTIONS = ["5인 미만", "5~10인", "10~20인", "20~50인", "50인 이상"];
const CONSULTING_OPTIONS = ["HR 컨설팅", "전략 컨설팅", "마케팅 컨설팅", "성과관리 컨설팅", "경영자문"];

/** 에디터 안에서만 쓰는 리사이즈 핸들 방향 (상하좌우 + 네 모서리 = 8) */
const IMAGE_RESIZE_DIRECTIONS = ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"];

/** JSON/HTML 내보내기용: 단독 img에는 margin으로 좌·중·우 정렬 */
function marginCssForImageAlign(align) {
  const a = align === "left" || align === "right" || align === "center" ? align : "center";
  if (a === "left") return "0 auto 0 0";
  if (a === "right") return "0 0 0 auto";
  return "0 auto";
}

/** 에디터 NodeView: 바깥 컨테이너 flex 정렬 + 래퍼는 이미지 크기에 맞춤 — 리사이즈 핸들이 이미지 테두리에 붙도록 */
function syncImageAlignInEditor(container, img, align) {
  const a = align === "left" || align === "right" || align === "center" ? align : "center";
  container.dataset.align = a;
  img.setAttribute("data-align", a);
  img.style.display = "block";
  img.style.maxWidth = "100%";
  img.style.margin = "0";
}

const CustomImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      allowBase64: true,
      resize: {
        enabled: true,
        minWidth: 48,
        minHeight: 48,
        alwaysPreserveAspectRatio: true,
        directions: IMAGE_RESIZE_DIRECTIONS,
      },
    };
  },
  addAttributes() {
    const parent = this.parent?.();
    return {
      ...parent,
      width: {
        ...parent?.width,
        parseHTML: (element) => {
          const w = element.style?.width || "";
          if (w.endsWith("px")) return Math.round(parseFloat(w));
          return null;
        },
      },
      height: {
        ...parent?.height,
        parseHTML: (element) => {
          const h = element.style?.height || "";
          if (h.endsWith("px")) return Math.round(parseFloat(h));
          return null;
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const align = node.attrs.align ?? "center";
    const margin = marginCssForImageAlign(align);
    const styles = ["display:block", "max-width:100%", `margin:${margin}`];
    if (node.attrs.width != null) styles.push(`width:${node.attrs.width}px`);
    if (node.attrs.height != null) styles.push(`height:${node.attrs.height}px`);
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style: styles.join(";"), "data-align": align })];
  },

  addNodeView() {
    const resizeOpt = this.options.resize;
    if (!resizeOpt || !resizeOpt.enabled || typeof document === "undefined") {
      return null;
    }
    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = resizeOpt;
    const dirs = Array.isArray(directions) && directions.length > 0 ? directions : IMAGE_RESIZE_DIRECTIONS;

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement("img");
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value != null) {
          switch (key) {
            case "width":
            case "height":
              break;
            default:
              el.setAttribute(key, value);
              break;
          }
        }
      });
      el.src = HTMLAttributes.src;

      let nodeView;
      nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
        },
        onCommit: (width, height) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor.chain().setNodeSelection(pos).updateAttributes(this.name, { width, height }).run();
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;
          syncImageAlignInEditor(nodeView.dom, el, updatedNode.attrs.align);
          return true;
        },
        options: {
          directions: dirs,
          min: { width: minWidth, height: minHeight },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
          className: {
            container: "cases-img-resize-root",
            wrapper: "cases-img-resize-wrap",
            handle: "cases-img-resize-handle",
            resizing: "cases-img-resizing",
          },
        },
      });

      const dom = nodeView.dom;
      syncImageAlignInEditor(dom, el, node.attrs.align);
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      el.onload = () => {
        syncImageAlignInEditor(dom, el, node.attrs.align);
        dom.style.visibility = "";
        dom.style.pointerEvents = "";
      };

      return nodeView;
    };
  },
});

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function slugify(input) {
  const text = String(input || "").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9가-힣-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return text || "case";
}

function blocksToHtml(blocks) {
  return (blocks || [])
    .map((block) => {
      if (block.type === "image") {
        const src = block.imageUrl || "";
        const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : "";
        return src ? `<figure><img src="${src}" style="max-width:100%;" />${caption}</figure>` : "";
      }
      return block.text ? `<p>${block.text.replace(/\n/g, "<br/>")}</p>` : "";
    })
    .join("");
}

function withDerivedFields(rawItems) {
  const items = (rawItems || []).map((item) => ({
    ...item,
    authorName: item.authorName || "",
    industryTags: Array.isArray(item.industryTags) ? item.industryTags : [],
    companySize: item.companySize || "",
    consultingTypeTags: Array.isArray(item.consultingTypeTags) ? item.consultingTypeTags : [],
    contentHtml: item.contentHtml || blocksToHtml(item.contentBlocks) || (item.content ? `<p>${item.content.replace(/\n/g, "<br/>")}</p>` : "<p></p>"),
  }));
  const used = new Set();
  items.forEach((item) => {
    const base = slugify(item.slug || item.title || item.id);
    let slug = base;
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    used.add(slug);
    item.slug = slug;
  });
  items.forEach((item, index) => {
    if (!item.link) item.link = `story-testimonial-${index + 1}.html`;
  });
  return items;
}

function normalizeData(data) {
  return { ...data, items: withDerivedFields(data.items || []) };
}

export default function CasesEditorPage() {
  const [data, setData] = useState(() => normalizeData(loadLocalDraft(STORAGE_KEY, defaultCasesData)));
  const [selectedId, setSelectedId] = useState(data.items?.[0]?.id ?? null);
  const [message, setMessage] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const items = useMemo(() => withDerivedFields(data.items || []), [data.items]);
  const selected = items.find((x) => x.id === selectedId) || null;

  function patchItems(updater) {
    setData((prev) => ({ ...prev, items: withDerivedFields(updater(withDerivedFields(prev.items || []))), updatedAt: nowIso() }));
  }

  function updateCase(id, key, value) {
    patchItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x, [key]: value, updatedAt: nowIso() };
        if (key === "status" && value === "published" && !x.publishedAt) next.publishedAt = nowIso();
        return next;
      })
    );
  }

  function toggleTag(id, key, value) {
    patchItems((arr) =>
      arr.map((x) => {
        if (x.id !== id) return x;
        const set = new Set(x[key] || []);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        return { ...x, [key]: Array.from(set), updatedAt: nowIso() };
      })
    );
  }

  function addCase() {
    const id = `case-${Date.now()}`;
    patchItems((arr) => [
      {
        id,
        slug: "",
        title: "새 고객 사례",
        authorName: "",
        industryTags: [],
        companySize: "",
        consultingTypeTags: [],
        content: "",
        contentHtml: "<p></p>",
        imageUrl: "",
        link: "",
        status: "draft",
        publishedAt: "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      ...arr,
    ]);
    setSelectedId(id);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function editCase(id) {
    setSelectedId(id);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function removeCase(id) {
    patchItems((arr) => arr.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function saveDraft() {
    saveLocalDraft(STORAGE_KEY, data);
    setMessage("고객 사례 초안을 로컬 저장했습니다.");
  }

  function exportJson() {
    downloadJson("cases.json", data);
    setMessage("고객 사례 JSON을 내보냈습니다.");
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const next = normalizeData(await readJsonFile(file));
      setData(next);
      setSelectedId(next.items?.[0]?.id ?? null);
      setMessage("고객 사례 JSON을 불러왔습니다.");
    } catch (err) {
      setMessage(`불러오기 실패: ${err.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
        CustomImage.configure({ inline: false }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
      ],
      content: selected?.contentHtml || "<p></p>",
      onUpdate: ({ editor: ed }) => {
        if (!selected) return;
        updateCase(selected.id, "contentHtml", ed.getHTML());
      },
    },
    [selected?.id]
  );

  async function insertImageFromFile(file) {
    if (!file || !editor || !selected) return;
    try {
      const src = await readAsDataUrl(file);
      editor.chain().focus().setImage({ src }).updateAttributes("image", { align: "center" }).run();
      if (!selected.imageUrl) updateCase(selected.id, "imageUrl", src);
      setMessage("본문 이미지를 삽입했습니다.");
    } catch (err) {
      setMessage(`이미지 삽입 실패: ${err.message || String(err)}`);
    }
  }

  function updateSelectedImageAttrs(attrs) {
    if (!editor) return;
    const sel = editor.state.selection;
    if (!isNodeSelection(sel) || sel.node.type.name !== "image") {
      setMessage("본문에서 위치를 바꿀 이미지를 먼저 클릭해 선택해 주세요.");
      return;
    }
    editor.chain().focus().updateAttributes("image", attrs).run();
  }

  function publishSelected() {
    if (!selected) return;
    patchItems((arr) =>
      arr.map((x) =>
        x.id === selected.id ? { ...x, status: "published", publishedAt: x.publishedAt || nowIso(), updatedAt: nowIso() } : x
      )
    );
    setMessage("발행되었습니다.");
  }

  function saveSelectedAsDraft() {
    if (!selected) return;
    patchItems((arr) => arr.map((x) => (x.id === selected.id ? { ...x, status: "draft", updatedAt: nowIso() } : x)));
    setMessage("임시 저장(초안)으로 저장했습니다.");
  }

  function insertOrEditLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("링크 URL (비우면 링크 제거)", previousUrl || "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setMessage("링크를 제거했습니다.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    setMessage("링크를 적용했습니다.");
  }

  function openPreviewInNewWindow() {
    if (!selected || !editor) return;
    const title = escapeHtml(selected.title || "미리보기");
    const author = escapeHtml(selected.authorName || "");
    const bodyHtml = editor.getHTML();
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
  body { font-family: "Pretendard", "Segoe UI", system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1.25rem 3rem; line-height: 1.65; color: #111827; background: #fafafa; }
  h1 { font-size: 1.75rem; margin: 0 0 0.75rem; line-height: 1.3; }
  .meta { color: #6b7280; font-size: 0.95rem; margin: 0 0 1.75rem; }
  .content { font-size: 1rem; }
  .content img { max-width: 100%; height: auto; }
  .content a { color: #2563eb; }
  .content p { margin: 0.75em 0; }
</style></head><body>
<h1>${title}</h1>
${author ? `<p class="meta">작성자: ${author}</p>` : `<p class="meta">&nbsp;</p>`}
<div class="content">${bodyHtml}</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (win) {
      win.focus();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } else {
      URL.revokeObjectURL(blobUrl);
      setMessage("팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.");
    }
  }

  function statusLabel(status) {
    if (status === "published") return "발행";
    return "임시";
  }

  return (
    <section className="page">
      <h2 className="page-title">고객 사례 관리</h2>
      <div className="admin-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <button className="btn btn-primary" type="button" onClick={saveDraft}>로컬 저장 (PC에 문서로 저장합니다)</button>
        <button className="btn btn-outline" type="button" onClick={exportJson}>JSON 내보내기 (웹 게시용 파일로 저장합니다.)</button>
        <label className="btn btn-outline" style={{ cursor: "pointer" }}>JSON 불러오기 (웹 게시용 파일을 불러옵니다.)<input type="file" accept="application/json,.json" onChange={importJson} style={{ display: "none" }} /></label>
        <button className="btn btn-outline" type="button" onClick={addCase}>사례 추가</button>
      </div>
      {message && <p className="muted">{message}</p>}
      <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "0.85rem" }}>
        배포 반영 안내: 업로드 이미지는 JSON에 포함됩니다. 작업 후 반드시 JSON 내보내기 후 배포 반영을 진행해주세요.
      </p>

      <div className="split-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel">
          <table className="table">
            <thead><tr><th>제목</th><th>작성자</th><th>상태</th><th>수정</th><th>삭제</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={selected?.id === item.id ? "is-selected" : ""}>
                  <td onClick={() => setSelectedId(item.id)}>{item.title}</td>
                  <td>{item.authorName || "-"}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td><button className="btn btn-outline" type="button" onClick={() => editCase(item.id)}>수정</button></td>
                  <td><button className="btn btn-outline" type="button" onClick={() => removeCase(item.id)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="panel detail-panel" ref={editorRef}>
          {selected ? (
            <>
              <h3 style={{ marginTop: 0, marginBottom: "0.8rem" }}>게시글 작성/수정</h3>

              <div className="panel" style={{ marginBottom: "0.8rem" }}>
                <p className="card-label">카테고리 분류</p>
                <div style={{ marginTop: "0.55rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontWeight: 600, fontSize: "0.9rem" }}>산업 (중복 선택)</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{INDUSTRY_OPTIONS.map((x) => <label key={x}><input type="checkbox" checked={(selected.industryTags || []).includes(x)} onChange={() => toggleTag(selected.id, "industryTags", x)} /> {x}</label>)}</div>
                </div>
                <div style={{ marginTop: "0.85rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontWeight: 600, fontSize: "0.9rem" }}>규모 (단일 선택)</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{SCALE_OPTIONS.map((x) => <label key={x}><input type="radio" name={`scale-${selected.id}`} checked={selected.companySize === x} onChange={() => updateCase(selected.id, "companySize", x)} /> {x}</label>)}</div>
                </div>
                <div style={{ marginTop: "0.85rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontWeight: 600, fontSize: "0.9rem" }}>컨설팅 유형 (중복 선택)</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>{CONSULTING_OPTIONS.map((x) => <label key={x}><input type="checkbox" checked={(selected.consultingTypeTags || []).includes(x)} onChange={() => toggleTag(selected.id, "consultingTypeTags", x)} /> {x}</label>)}</div>
                </div>
              </div>

              <details style={{ marginBottom: "0.85rem" }} open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
                <summary>고급 필드 (자동 생성값 확인)</summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.5rem" }}>
                  <label className="field"><span>ID</span><input className="input" value={selected.id} disabled /></label>
                  <label className="field"><span>Slug (자동)</span><input className="input" value={selected.slug || ""} disabled /></label>
                  <label className="field"><span>연결 링크 (자동)</span><input className="input" value={selected.link || ""} disabled /></label>
                  <label className="field"><span>게시일시 (자동)</span><input className="input" value={selected.publishedAt || "-"} disabled /></label>
                </div>
              </details>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0.75rem", marginBottom: "0.85rem", alignItems: "end" }}>
                <label className="field"><span>제목</span><input className="input" value={selected.title || ""} onChange={(e) => updateCase(selected.id, "title", e.target.value)} /></label>
                <label className="field"><span>작성자 이름</span><input className="input" value={selected.authorName || ""} onChange={(e) => updateCase(selected.id, "authorName", e.target.value)} /></label>
              </div>

              <div className="panel" style={{ marginTop: 0 }}>
                <p className="card-label">본문 편집기 (블로그형)</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "0.5rem 0", alignItems: "center" }}>
                  <button className="btn btn-outline btn-icon" type="button" title="굵게" aria-label="굵게" onClick={() => editor?.chain().focus().toggleBold().run()}>
                    <span className="toolbar-mark toolbar-mark--bold">B</span>
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="기울임" aria-label="기울임" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                    <span className="toolbar-mark toolbar-mark--italic">I</span>
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="밑줄" aria-label="밑줄" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                    <span className="toolbar-mark toolbar-mark--underline">U</span>
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="링크 삽입·편집 (비우면 제거)" aria-label="링크 삽입" onClick={insertOrEditLink}>
                    <IconLink />
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="텍스트 왼쪽 정렬" aria-label="텍스트 왼쪽 정렬" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
                    <IconAlignLeft />
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="텍스트 가운데 정렬" aria-label="텍스트 가운데 정렬" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
                    <IconAlignCenter />
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="텍스트 오른쪽 정렬" aria-label="텍스트 오른쪽 정렬" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
                    <IconAlignRight />
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => imageInputRef.current?.click()}>이미지 업로드</button>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>이미지 선택 후 모서리·변을 드래그해 크기 조절</span>
                  <button className="btn btn-outline btn-icon" type="button" title="이미지 왼쪽 맞춤" aria-label="이미지 왼쪽 맞춤" onClick={() => updateSelectedImageAttrs({ align: "left" })}>
                    <IconImageAlignLeft />
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="이미지 가운데 맞춤" aria-label="이미지 가운데 맞춤" onClick={() => updateSelectedImageAttrs({ align: "center" })}>
                    <IconImageAlignCenter />
                  </button>
                  <button className="btn btn-outline btn-icon" type="button" title="이미지 오른쪽 맞춤" aria-label="이미지 오른쪽 맞춤" onClick={() => updateSelectedImageAttrs({ align: "right" })}>
                    <IconImageAlignRight />
                  </button>
                  <span style={{ display: "inline-block", width: "1px", height: "1.5rem", margin: "0 0.15rem", background: "#e5e7eb", alignSelf: "center" }} aria-hidden />
                  <button className="btn btn-primary" type="button" onClick={publishSelected}>
                    발행하기
                  </button>
                  <button className="btn btn-outline" type="button" onClick={saveSelectedAsDraft}>
                    임시저장
                  </button>
                  <button className="btn btn-outline" type="button" onClick={openPreviewInNewWindow}>
                    게시글 미리보기
                  </button>
                  <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
                    현재: {selected.status === "published" ? "발행됨" : "임시 저장(초안)"}
                  </span>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    insertImageFromFile(file);
                    e.target.value = "";
                  }}
                />
                <div className="cases-editor-scroll">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </>
          ) : <p className="muted">선택된 사례가 없습니다.</p>}
        </aside>
      </div>
    </section>
  );
}
