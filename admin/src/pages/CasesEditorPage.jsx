import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { isNodeSelection, mergeAttributes, ResizableNodeView } from "@tiptap/core";
import { defaultCasesData } from "../data/defaultCases";
import { downloadJson, loadLocalDraft, nowIso, readJsonFile, saveLocalDraft } from "../lib/localJsonDraft";
import { supabaseEnabled } from "../lib/supabase";
import { loadRemoteJsonByKey, saveRemoteJsonByKey } from "../lib/adminRemoteJson";

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
    <svg width="1.76em" height="1.76em" viewBox="0 0 24 24" aria-hidden>
      <rect x="2.8" y="5.2" width="8.6" height="8.6" rx="1.2" fill="currentColor" />
      <path d="M4.3 11.3l1.9-2.1l2 2.3l1.3-1.5l1.4 2.3" fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13.6" y1="6.6" x2="21.4" y2="6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="13.6" y1="10.2" x2="21.4" y2="10.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="13.6" y1="13.8" x2="21.4" y2="13.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="2.8" y1="17.6" x2="21.4" y2="17.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconImageAlignCenter() {
  return (
    <svg width="1.76em" height="1.76em" viewBox="0 0 24 24" aria-hidden>
      <line x1="2.8" y1="6.6" x2="8.6" y2="6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="15.4" y1="6.6" x2="21.2" y2="6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="8.6" y="5.2" width="6.8" height="8.6" rx="1.2" fill="currentColor" />
      <path d="M9.8 11.3l1.4-1.8l1.8 2l1.1-1.4l1.3 2.1" fill="none" stroke="#ffffff" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2.8" y1="10.2" x2="6.8" y2="10.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="17.2" y1="10.2" x2="21.2" y2="10.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="2.8" y1="13.8" x2="8" y2="13.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="16" y1="13.8" x2="21.2" y2="13.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="2.8" y1="17.6" x2="21.2" y2="17.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconImageAlignRight() {
  return (
    <svg width="1.76em" height="1.76em" viewBox="0 0 24 24" aria-hidden>
      <line x1="2.6" y1="6.6" x2="10.4" y2="6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="2.6" y1="10.2" x2="10.4" y2="10.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="2.6" y1="13.8" x2="10.4" y2="13.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="12.6" y="5.2" width="8.6" height="8.6" rx="1.2" fill="currentColor" />
      <path d="M14 11.3l1.9-2.1l2 2.3l1.3-1.5l1.4 2.3" fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="2.6" y1="17.6" x2="21.2" y2="17.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
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
const PUBLISHED_STORAGE_KEY = "admin.published.cases.v1";
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

function collectImageSourcesFromEditorNode(node, out) {
  if (!node || typeof node !== "object") return;
  if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src.trim()) {
    out.push(node.attrs.src.trim());
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((child) => collectImageSourcesFromEditorNode(child, out));
  }
}

function extractImageSourcesFromEditorJson(json) {
  const list = [];
  collectImageSourcesFromEditorNode(json, list);
  const seen = new Set();
  return list.filter((src) => {
    if (seen.has(src)) return false;
    seen.add(src);
    return true;
  });
}

function withDerivedFields(rawItems) {
  const items = (rawItems || []).map((item) => ({
    ...item,
    authorName: item.authorName || "",
    industryTags: Array.isArray(item.industryTags) ? item.industryTags : [],
    companySize: item.companySize || "",
    consultingTypeTags: Array.isArray(item.consultingTypeTags) ? item.consultingTypeTags : [],
    thumbnailUrl: item.thumbnailUrl || "",
    featuredImageUrl: item.featuredImageUrl || "",
    imageUrl: item.thumbnailUrl || item.featuredImageUrl || item.imageUrl || "",
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
  const [previewModal, setPreviewModal] = useState({ open: false, title: "", author: "", html: "" });
  const [buttonFeedbackKey, setButtonFeedbackKey] = useState("");
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const buttonFeedbackTimerRef = useRef(null);
  const [editorImages, setEditorImages] = useState([]);
  const items = useMemo(() => withDerivedFields(data.items || []), [data.items]);
  const selected = items.find((x) => x.id === selectedId) || null;

  useEffect(() => {
    let cancelled = false;
    async function bootstrapRemote() {
      if (!supabaseEnabled) return;
      const next = normalizeData(await loadRemoteJsonByKey(STORAGE_KEY, defaultCasesData));
      if (cancelled) return;
      setData(next);
      setSelectedId(next.items?.[0]?.id ?? null);
    }
    bootstrapRemote();
    return () => {
      cancelled = true;
    };
  }, []);

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
        thumbnailUrl: "",
        featuredImageUrl: "",
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

  async function saveDraft() {
    if (supabaseEnabled) {
      const { error } = await saveRemoteJsonByKey(STORAGE_KEY, data);
      if (error) {
        setMessage(`저장 실패: ${error.message}`);
        return;
      }
    } else {
      saveLocalDraft(STORAGE_KEY, data);
      saveLocalDraft(PUBLISHED_STORAGE_KEY, data);
    }
    setMessage("웹 저장하기: 전체 고객 사례를 즉시 반영용으로 저장했습니다.");
    flashButtonFeedback("save");
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
        const nextHtml = ed.getHTML();
        const sources = extractImageSourcesFromEditorJson(ed.getJSON());
        setEditorImages(sources);
        patchItems((arr) =>
          arr.map((x) => {
            if (x.id !== selected.id) return x;
            let featuredImageUrl = x.featuredImageUrl || "";
            if (featuredImageUrl && !sources.includes(featuredImageUrl)) {
              featuredImageUrl = "";
            }
            const thumbnailUrl = x.thumbnailUrl || "";
            return {
              ...x,
              contentHtml: nextHtml,
              featuredImageUrl,
              imageUrl: thumbnailUrl || featuredImageUrl || "",
              updatedAt: nowIso(),
            };
          })
        );
      },
    },
    [selected?.id]
  );

  useEffect(() => {
    if (!editor) return;
    setEditorImages(extractImageSourcesFromEditorJson(editor.getJSON()));
  }, [editor, selected?.id]);

  useEffect(
    () => () => {
      if (buttonFeedbackTimerRef.current) {
        clearTimeout(buttonFeedbackTimerRef.current);
        buttonFeedbackTimerRef.current = null;
      }
    },
    []
  );

  function flashButtonFeedback(key) {
    setButtonFeedbackKey(key);
    if (buttonFeedbackTimerRef.current) clearTimeout(buttonFeedbackTimerRef.current);
    buttonFeedbackTimerRef.current = setTimeout(() => {
      setButtonFeedbackKey("");
      buttonFeedbackTimerRef.current = null;
    }, 1800);
  }

  useEffect(() => {
    if (!previewModal.open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        setPreviewModal((prev) => ({ ...prev, open: false }));
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewModal.open]);

  async function insertImageFromFile(file) {
    if (!file || !editor || !selected) return;
    try {
      const src = await readAsDataUrl(file);
      editor.chain().focus().setImage({ src }).updateAttributes("image", { align: "center" }).run();
      patchItems((arr) =>
        arr.map((x) => {
          if (x.id !== selected.id) return x;
          const thumbnailUrl = x.thumbnailUrl || "";
          const featuredImageUrl = x.featuredImageUrl || src;
          return {
            ...x,
            featuredImageUrl,
            imageUrl: thumbnailUrl || featuredImageUrl || "",
            updatedAt: nowIso(),
          };
        })
      );
      setMessage("본문 이미지를 삽입했습니다.");
    } catch (err) {
      setMessage(`이미지 삽입 실패: ${err.message || String(err)}`);
    }
  }

  async function uploadThumbnailFromFile(file) {
    if (!file || !selected) return;
    try {
      const src = await readAsDataUrl(file);
      patchItems((arr) =>
        arr.map((x) =>
          x.id === selected.id
            ? { ...x, thumbnailUrl: src, imageUrl: src, updatedAt: nowIso() }
            : x
        )
      );
      setMessage("썸네일 이미지를 업로드했습니다. 본문 대표 이미지보다 우선 적용됩니다.");
    } catch (err) {
      setMessage(`썸네일 업로드 실패: ${err.message || String(err)}`);
    }
  }

  function clearThumbnail() {
    if (!selected) return;
    patchItems((arr) =>
      arr.map((x) =>
        x.id === selected.id
          ? {
              ...x,
              thumbnailUrl: "",
              imageUrl: x.featuredImageUrl || "",
              updatedAt: nowIso(),
            }
          : x
      )
    );
    setMessage("별도 썸네일을 제거했습니다. 대표 이미지를 썸네일로 사용합니다.");
  }

  function pickRepresentativeImage(src) {
    if (!selected || !src) return;
    patchItems((arr) =>
      arr.map((x) =>
        x.id === selected.id
          ? {
              ...x,
              featuredImageUrl: src,
              imageUrl: x.thumbnailUrl || src,
              updatedAt: nowIso(),
            }
          : x
      )
    );
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

  async function publishSelected() {
    if (!selected) return;
    const now = nowIso();
    let publishedData = null;
    patchItems((arr) => {
      const nextItems = arr.map((x) => (x.id === selected.id ? { ...x, status: "published", publishedAt: x.publishedAt || now, updatedAt: now } : x));
      publishedData = { ...data, items: nextItems, updatedAt: now };
      return nextItems;
    });
    if (publishedData) {
      if (supabaseEnabled) {
        const { error } = await saveRemoteJsonByKey(STORAGE_KEY, publishedData);
        if (error) {
          setMessage(`저장 실패: ${error.message}`);
          return;
        }
      } else {
        saveLocalDraft(PUBLISHED_STORAGE_KEY, publishedData);
      }
    }
    setMessage("작성 완료 처리 후 웹 반영용으로 저장했습니다.");
    flashButtonFeedback("publish");
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

  function openPreviewModal() {
    if (!selected) return;
    setPreviewModal({
      open: true,
      title: String(selected.title || "미리보기"),
      author: String(selected.authorName || ""),
      html: editor ? editor.getHTML() : String(selected.contentHtml || "<p></p>"),
    });
  }

  function closePreviewModal() {
    setPreviewModal((prev) => ({ ...prev, open: false }));
  }

  function statusLabel(status) {
    if (status === "published") return "발행";
    return "임시";
  }

  return (
    <section className="page">
      <h2 className="page-title">고객 사례 관리</h2>
      <div className="admin-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <button className="btn btn-primary" type="button" onClick={saveDraft}>웹 저장하기</button>
          {buttonFeedbackKey === "save" ? (
            <span
              style={{
                position: "absolute",
                left: "50%",
                bottom: "calc(100% + 0.3rem)",
                transform: "translateX(-50%)",
                background: "#047857",
                color: "#ffffff",
                fontSize: "0.72rem",
                fontWeight: 600,
                lineHeight: 1,
                padding: "0.22rem 0.42rem",
                borderRadius: "999px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}
            >
              반영됨
            </span>
          ) : null}
        </div>
        <button className="btn btn-outline" type="button" onClick={addCase}>사례 추가</button>
      </div>
      {message && <p className="muted">{message}</p>}
      <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "0.85rem" }}>
        배포 반영 안내: 업로드 이미지는 JSON에 포함됩니다. 작업 후 반드시 JSON 내보내기 후 배포 반영을 진행해주세요.
      </p>

      <div className="split-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel">
          <table className="table cases-list-table">
            <colgroup>
              <col className="cases-col-title" />
              <col className="cases-col-author" />
              <col className="cases-col-status" />
              <col className="cases-col-edit" />
              <col className="cases-col-delete" />
            </colgroup>
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
                  <button className="btn btn-outline" type="button" onClick={() => thumbnailInputRef.current?.click()}>
                    썸네일 업로드
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => imageInputRef.current?.click()}>이미지 업로드</button>
                  {selected.thumbnailUrl ? (
                    <button className="btn btn-outline" type="button" onClick={clearThumbnail}>
                      썸네일 제거
                    </button>
                  ) : null}
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
                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                    <button className="btn btn-primary" type="button" onClick={publishSelected}>
                      작성 완료
                    </button>
                    {buttonFeedbackKey === "publish" ? (
                      <span
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "calc(100% + 0.3rem)",
                          transform: "translateX(-50%)",
                          background: "#047857",
                          color: "#ffffff",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          lineHeight: 1,
                          padding: "0.22rem 0.42rem",
                          borderRadius: "999px",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                      >
                        반영됨
                      </span>
                    ) : null}
                  </div>
                  <button className="btn btn-outline" type="button" onClick={saveSelectedAsDraft}>
                    임시 저장
                  </button>
                  <button className="btn btn-outline" type="button" onClick={openPreviewModal}>
                    미리보기
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
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    uploadThumbnailFromFile(file);
                    e.target.value = "";
                  }}
                />
                {selected.thumbnailUrl || editorImages.length ? (
                  <div className="cases-thumbnail-strip-row">
                    {selected.thumbnailUrl ? (
                      <div className="cases-thumbnail-preview-panel">
                        <p className="card-label" style={{ margin: "0 0 0.45rem" }}>
                          업로드된 썸네일 미리보기 (최우선 적용)
                        </p>
                        <img src={selected.thumbnailUrl} alt="업로드한 썸네일 미리보기" className="cases-thumbnail-preview-image" />
                      </div>
                    ) : null}
                    {editorImages.length ? (
                      <div className="cases-thumbnail-pick-panel">
                        <p className="card-label" style={{ margin: "0 0 0.45rem" }}>
                          본문 이미지 대표 선택 (별도 썸네일이 없을 때 사용)
                        </p>
                        <div className="cases-thumbnail-pick-grid">
                          {editorImages.map((src, idx) => {
                            const isPicked = !selected.thumbnailUrl && selected.featuredImageUrl === src;
                            return (
                              <div key={`${src}-${idx}`} className="cases-thumbnail-pick-item">
                                <button
                                  type="button"
                                  className={`btn btn-outline cases-thumbnail-pick-btn ${isPicked ? "is-active" : ""}`}
                                  onClick={() => pickRepresentativeImage(src)}
                                >
                                  대표
                                </button>
                                <img src={src} alt={`본문 이미지 ${idx + 1}`} className="cases-thumbnail-pick-image" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="cases-editor-scroll">
                  <EditorContent editor={editor} />
                </div>
                <div style={{ marginTop: "0.7rem", display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                    <button className="btn btn-primary" type="button" onClick={publishSelected}>
                      작성 완료
                    </button>
                    {buttonFeedbackKey === "publish" ? (
                      <span
                        style={{
                          position: "absolute",
                          left: "50%",
                          bottom: "calc(100% + 0.3rem)",
                          transform: "translateX(-50%)",
                          background: "#047857",
                          color: "#ffffff",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          lineHeight: 1,
                          padding: "0.22rem 0.42rem",
                          borderRadius: "999px",
                          whiteSpace: "nowrap",
                          pointerEvents: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        }}
                      >
                        반영됨
                      </span>
                    ) : null}
                  </div>
                </div>
                <details style={{ marginTop: "0.85rem" }} open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
                  <summary>고급 필드 (자동 생성값 확인)</summary>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.5rem" }}>
                    <label className="field"><span>ID</span><input className="input" value={selected.id} disabled /></label>
                    <label className="field"><span>Slug (자동)</span><input className="input" value={selected.slug || ""} disabled /></label>
                    <label className="field"><span>연결 링크 (자동)</span><input className="input" value={selected.link || ""} disabled /></label>
                    <label className="field"><span>게시일시 (자동)</span><input className="input" value={selected.publishedAt || "-"} disabled /></label>
                  </div>
                </details>
              </div>
            </>
          ) : <p className="muted">선택된 사례가 없습니다.</p>}
        </aside>
      </div>
      {previewModal.open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="게시글 미리보기"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreviewModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(15, 23, 42, 0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "min(860px, 100%)",
              maxHeight: "92vh",
              borderRadius: "14px",
              background: "#ffffff",
              boxShadow: "0 18px 52px rgba(0,0,0,0.28)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.85rem 1rem",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <strong style={{ fontSize: "1rem", color: "#111827" }}>게시글 미리보기</strong>
              <button className="btn btn-outline" type="button" onClick={closePreviewModal} aria-label="미리보기 닫기">
                닫기
              </button>
            </div>
            <div style={{ overflow: "auto", padding: "1.1rem 1.2rem 1.4rem", background: "#f8fafc" }}>
              <article style={{ maxWidth: "720px", margin: "0 auto", color: "#111827", lineHeight: 1.65 }}>
                <h1 style={{ margin: "0 0 0.65rem", fontSize: "1.75rem", lineHeight: 1.3 }}>{previewModal.title}</h1>
                <p style={{ margin: "0 0 1.2rem", color: "#6b7280", fontSize: "0.95rem" }}>
                  {previewModal.author ? `작성자: ${previewModal.author}` : "\u00A0"}
                </p>
                <div
                  className="tiptap-preview-content"
                  style={{ fontSize: "1rem" }}
                  dangerouslySetInnerHTML={{ __html: previewModal.html }}
                />
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
