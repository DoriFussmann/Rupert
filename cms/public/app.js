const SESSION_ID =
  sessionStorage.getItem("cmsSessionId") ||
  (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem("cmsSessionId", id);
    return id;
  })();

const TITLE_MIN = 55;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;
const ALT_MIN = 10;

const FIELD_ORDER = [
  "title",
  "description",
  "slug",
  "date",
  "author",
  "category",
  "tags",
  "image",
  "imageAlt",
  "robots",
  "schemaType",
  "locale",
  "twitterCard",
  "draft",
  "updatedDate",
  "keywords",
  "canonical",
  "image2",
  "image2Alt",
  "image3",
  "image3Alt",
  "ogTitle",
  "ogDescription",
  "ogImage",
  "internalLinks",
  "externalLinks",
  "faqs",
];

const state = {
  data: {},
  body: "",
  sessionImages: {},
  validation: null,
  authors: [],
  existingSlugs: [],
  knownPaths: [],
  busy: false,
};

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-session-id", SESSION_ID);
  if (options.json) {
    headers.set("Content-Type", "application/json");
  }
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Server returned non-JSON (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("action-status");
  if (!el) return;
  el.textContent = msg;
  el.dataset.error = isError ? "true" : "false";
}

function setBusy(busy, label = "") {
  state.busy = busy;
  const gen = document.getElementById("generate");
  const preview = document.getElementById("preview-jsonld");
  if (busy) {
    setStatus(label || "Working…");
    if (gen) gen.disabled = true;
    if (preview) preview.disabled = true;
  } else {
    if (preview) preview.disabled = false;
    refreshValidationUI();
  }
}

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function charCount(s) {
  return [...String(s || "")].length;
}

function updateCounters() {
  const title = document.getElementById("field-title")?.value || "";
  const desc = document.getElementById("field-description")?.value || "";
  const tc = document.getElementById("title-count");
  const dc = document.getElementById("description-count");
  if (tc) {
    const n = charCount(title);
    const ok = n >= TITLE_MIN && n <= TITLE_MAX;
    tc.textContent = `${n} chars (${TITLE_MIN}–${TITLE_MAX})`;
    tc.classList.toggle("ok", ok);
    tc.classList.toggle("bad", !ok);
  }
  if (dc) {
    const n = charCount(desc);
    const ok = n >= DESCRIPTION_MIN && n <= DESCRIPTION_MAX;
    dc.textContent = `${n} chars (${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`;
    dc.classList.toggle("ok", ok);
    dc.classList.toggle("bad", !ok);
  }
}

function collectFormData() {
  const g = (id) => document.getElementById(id)?.value ?? "";
  const tags = g("field-tags")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = g("field-keywords")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const internalLinks = [...document.querySelectorAll("#internal-links .row")].map(
    (row) => ({
      label: row.querySelector('[name="label"]')?.value || "",
      url: row.querySelector('[name="url"]')?.value || "",
    }),
  );
  const externalLinks = [...document.querySelectorAll("#external-links .row")].map(
    (row) => ({
      label: row.querySelector('[name="label"]')?.value || "",
      url: row.querySelector('[name="url"]')?.value || "",
    }),
  );
  const faqs = [...document.querySelectorAll("#faqs .row")].map((row) => ({
    question: row.querySelector('[name="question"]')?.value || "",
    answer: row.querySelector('[name="answer"]')?.value || "",
  }));

  return {
    title: g("field-title"),
    description: g("field-description"),
    slug: g("field-slug"),
    date: g("field-date"),
    updatedDate: g("field-updatedDate") || g("field-date"),
    author: g("field-author"),
    category: g("field-category"),
    tags,
    keywords: keywords.length ? keywords : undefined,
    image: state.data.image,
    imageAlt: g("field-imageAlt"),
    image2: state.data.image2,
    image2Alt: g("field-image2Alt") || undefined,
    image3: state.data.image3,
    image3Alt: g("field-image3Alt") || undefined,
    robots: g("field-robots") || "index, follow",
    schemaType: g("field-schemaType") || "BlogPosting",
    locale: g("field-locale") || "en-US",
    twitterCard: g("field-twitterCard") || "summary_large_image",
    draft: g("field-draft") === "true",
    canonical: g("field-canonical") || undefined,
    ogTitle: g("field-ogTitle") || undefined,
    ogDescription: g("field-ogDescription") || undefined,
    internalLinks,
    externalLinks,
    faqs,
  };
}

function fillForm(data, body = "") {
  state.data = { ...data };
  state.body = body;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };
  set("field-title", data.title);
  set("field-description", data.description);
  set("field-slug", data.slug);
  set("field-date", toDateInput(data.date));
  set("field-updatedDate", toDateInput(data.updatedDate || data.date));
  set("field-author", data.author);
  set("field-category", data.category);
  set("field-tags", Array.isArray(data.tags) ? data.tags.join(", ") : "");
  set(
    "field-keywords",
    Array.isArray(data.keywords) ? data.keywords.join(", ") : "",
  );
  set("field-imageAlt", data.imageAlt);
  set("field-image2Alt", data.image2Alt);
  set("field-image3Alt", data.image3Alt);
  set("field-robots", data.robots || "index, follow");
  set("field-schemaType", data.schemaType || "BlogPosting");
  set("field-locale", data.locale || "en-US");
  set("field-twitterCard", data.twitterCard || "summary_large_image");
  set("field-draft", String(Boolean(data.draft)));
  set("field-canonical", data.canonical);
  set("field-ogTitle", data.ogTitle);
  set("field-ogDescription", data.ogDescription);
  set("field-body", body);

  renderLinkRows("internal-links", data.internalLinks || [], "internal");
  renderLinkRows("external-links", data.externalLinks || [], "external");
  renderFaqRows(data.faqs || []);
  updateCounters();
  updateImageStatus();
  updateSlugCollision();
}

function renderLinkRows(containerId, links, kind) {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = "";
  for (const link of links) {
    root.appendChild(makeLinkRow(link.label, link.url, kind));
  }
}

function makeLinkRow(label = "", url = "", kind = "internal") {
  const row = document.createElement("p");
  row.className = "row";
  row.innerHTML = `
    <label>label <input name="label" type="text" value="" /></label>
    <label>url <input name="url" type="text" value="" /></label>
    <button type="button" class="remove">Remove</button>
  `;
  row.querySelector('[name="label"]').value = label;
  row.querySelector('[name="url"]').value = url;
  row.querySelector(".remove").addEventListener("click", () => {
    row.remove();
    scheduleValidate();
  });
  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", scheduleValidate);
  });
  void kind;
  return row;
}

function renderFaqRows(faqs) {
  const root = document.getElementById("faqs");
  if (!root) return;
  root.innerHTML = "";
  for (const faq of faqs) {
    root.appendChild(makeFaqRow(faq.question, faq.answer));
  }
}

function makeFaqRow(question = "", answer = "") {
  const row = document.createElement("p");
  row.className = "row";
  row.innerHTML = `
    <label>question <input name="question" type="text" /></label>
    <label>answer <textarea name="answer" rows="2"></textarea></label>
    <button type="button" class="remove">Remove</button>
  `;
  row.querySelector('[name="question"]').value = question;
  row.querySelector('[name="answer"]').value = answer;
  row.querySelector(".remove").addEventListener("click", () => {
    row.remove();
    scheduleValidate();
  });
  row.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("input", scheduleValidate);
  });
  return row;
}

function updateImageStatus() {
  const el = document.getElementById("image-status");
  if (!el) return;
  const parts = [];
  parts.push(
    state.sessionImages.image
      ? `Hero: ${state.sessionImages.image}`
      : "Hero: not uploaded this session",
  );
  parts.push(
    state.sessionImages.image2
      ? `Image2: ${state.sessionImages.image2}`
      : "Image2: optional",
  );
  parts.push(
    state.sessionImages.image3
      ? `Image3: ${state.sessionImages.image3}`
      : "Image3: optional",
  );
  el.textContent = parts.join(" · ");
}

function updateSlugCollision() {
  const el = document.getElementById("slug-collision");
  if (!el) return;
  const slug = document.getElementById("field-slug")?.value || "";
  const overwrite = document.getElementById("overwrite")?.checked;
  if (slug && state.existingSlugs.includes(slug) && !overwrite) {
    el.textContent = `Warning: slug "${slug}" already exists. Check overwrite or rename.`;
  } else if (slug && state.existingSlugs.includes(slug) && overwrite) {
    el.textContent = `Will overwrite existing article "${slug}".`;
  } else {
    el.textContent = "";
  }
}

async function scheduleValidate() {
  updateCounters();
  updateSlugCollision();
  try {
    const data = collectFormData();
    state.data = { ...state.data, ...data };
    state.body = document.getElementById("field-body")?.value || "";
    const overwrite = document.getElementById("overwrite")?.checked;
    const result = await api("/api/validate", {
      method: "POST",
      json: true,
      body: JSON.stringify({ data, overwrite }),
    });
    state.validation = result.validation;
    // Keep local filenames; server only returns which slots are filled
    const filled = new Set(result.sessionImages || []);
    for (const key of ["image", "image2", "image3"]) {
      if (!filled.has(key)) delete state.sessionImages[key];
    }
    refreshValidationUI();
  } catch (err) {
    setStatus(err.message, true);
  }
}

function refreshValidationUI() {
  const summary = document.getElementById("missing-summary");
  const list = document.getElementById("field-checklist");
  const reason = document.getElementById("generate-reason");
  const gen = document.getElementById("generate");
  const v = state.validation;

  if (!v) {
    if (summary) summary.textContent = "Drop a markdown file to begin.";
    if (gen) gen.disabled = true;
    if (reason) reason.textContent = "Generate disabled: no validation yet.";
    return;
  }

  if (summary) summary.textContent = v.summary;

  if (list) {
    list.innerHTML = "";
    const byName = Object.fromEntries(v.fields.map((f) => [f.name, f]));
    for (const name of FIELD_ORDER) {
      const f = byName[name] || { name, ok: false, message: "not checked" };
      const li = document.createElement("li");
      li.className = f.ok ? "ok" : "missing";
      li.textContent = f.ok
        ? name
        : `${name}${f.message ? `: ${f.message}` : ""}`;
      list.appendChild(li);
    }
  }

  const overwrite = document.getElementById("overwrite")?.checked;
  const slug = document.getElementById("field-slug")?.value || "";
  const collision = slug && state.existingSlugs.includes(slug) && !overwrite;

  let disabled = !v.ok || state.busy || collision;
  let why = "";
  if (state.busy) why = "Generate disabled: request in progress.";
  else if (!v.ok) why = `Generate disabled: ${v.summary}`;
  else if (collision)
    why = `Generate disabled: slug "${slug}" exists — enable overwrite or rename.`;
  else why = "Generate enabled.";

  if (gen) gen.disabled = disabled;
  if (reason) reason.textContent = why;
  updateImageStatus();
}

async function loadAuthorsAndRoutes() {
  const routes = await api("/api/routes");
  state.authors = routes.authors || [];
  state.knownPaths = routes.internalPaths || [];
  const select = document.getElementById("field-author");
  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="">— select team member —</option>';
    for (const a of state.authors) {
      const opt = document.createElement("option");
      opt.value = a.slug;
      opt.textContent = `${a.name} (${a.slug})`;
      select.appendChild(opt);
    }
    if (current) select.value = current;
  }
}

async function loadArticleList() {
  const ul = document.getElementById("article-list");
  if (!ul) return;
  try {
    const result = await api("/articles");
    state.existingSlugs = result.articles.map((a) => a.slug);
    if (!result.articles.length) {
      ul.innerHTML = "<li>No articles yet.</li>";
      return;
    }
    ul.innerHTML = "";
    for (const a of result.articles) {
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" data-slug="${a.slug}">${a.title}</a>
        <span class="article-status">[${a.draft ? "draft" : "published"}]</span>
        <span class="article-actions">
          <button type="button" class="btn-compact" data-edit="${a.slug}">Edit</button>
          <button type="button" class="btn-compact" data-unpublish="${a.slug}">${a.draft ? "Publish" : "Unpublish"}</button>
          <button type="button" class="btn-compact" data-delete="${a.slug}">Delete</button>
        </span>
      `;
      ul.appendChild(li);
    }
    ul.querySelectorAll("a[data-slug]").forEach((a) => {
      a.addEventListener("click", async (e) => {
        e.preventDefault();
        await loadExisting(a.dataset.slug);
      });
    });
    ul.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await loadExisting(btn.getAttribute("data-edit"));
      });
    });
    ul.querySelectorAll("[data-unpublish]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          setBusy(true, "Updating draft status…");
          const slug = btn.getAttribute("data-unpublish");
          const article = state.existingSlugs.includes(slug)
            ? (await api("/articles")).articles.find((x) => x.slug === slug)
            : null;
          const nextDraft = article ? !article.draft : true;
          // Toggle based on current button label
          const makeDraft = btn.textContent === "Unpublish";
          await api(`/api/articles/${slug}/draft`, {
            method: "PATCH",
            json: true,
            body: JSON.stringify({ draft: makeDraft }),
          });
          void nextDraft;
          await loadArticleList();
          setBusy(false);
          setStatus(`Updated draft status for ${slug}.`);
        } catch (err) {
          setBusy(false);
          setStatus(err.message, true);
        }
      });
    });
    ul.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slug = btn.getAttribute("data-delete");
        if (!confirm(`Delete article "${slug}"?`)) return;
        try {
          setBusy(true, "Deleting…");
          await api(`/api/articles/${slug}`, { method: "DELETE" });
          await loadArticleList();
          setBusy(false);
          setStatus(`Deleted ${slug}.`);
        } catch (err) {
          setBusy(false);
          setStatus(err.message, true);
        }
      });
    });
  } catch (err) {
    ul.innerHTML = `<li>Error: ${err.message}</li>`;
  }
}

async function loadExisting(slug) {
  try {
    setBusy(true, "Loading article…");
    // Editing existing: clear session images so user must re-upload
    state.sessionImages = {};
    const result = await api(`/articles/${encodeURIComponent(slug)}`);
    fillForm(result.data, result.body);
    document.getElementById("overwrite").checked = true;
    setBusy(false);
    setStatus(
      `Loaded "${slug}". Re-upload images this session before Generate (paths in file do not count).`,
    );
    await scheduleValidate();
  } catch (err) {
    setBusy(false);
    setStatus(err.message, true);
  }
}

async function handleMarkdownFile(file) {
  if (!file) return;
  try {
    setBusy(true, "Parsing markdown…");
    const fd = new FormData();
    fd.append("markdown", file);
    const result = await api("/parse", { method: "POST", body: fd });
    state.existingSlugs = result.existingSlugs || state.existingSlugs;
    // Fresh parse: keep prior session images only if same session — reset for clarity
    fillForm(result.data, result.body);
    state.validation = result.validation;
    setBusy(false);
    setStatus(`Parsed ${file.name}.`);
    refreshValidationUI();
    await scheduleValidate();
  } catch (err) {
    setBusy(false);
    setStatus(err.message, true);
  }
}

async function uploadImage(file) {
  const altHero = document.getElementById("field-imageAlt")?.value || "";
  const nextSlot = !state.sessionImages.image
    ? "image"
    : !state.sessionImages.image2
      ? "image2"
      : !state.sessionImages.image3
        ? "image3"
        : null;
  if (!nextSlot) {
    setStatus("All 3 image slots are filled.", true);
    return;
  }
  if (nextSlot === "image" && charCount(altHero) < ALT_MIN) {
    setStatus(
      `Enter imageAlt (min ${ALT_MIN} chars) before uploading the hero image.`,
      true,
    );
    return;
  }
  if (nextSlot === "image2") {
    const alt = document.getElementById("field-image2Alt")?.value || "";
    if (charCount(alt) < ALT_MIN) {
      setStatus(
        `Enter image2Alt (min ${ALT_MIN} chars) before uploading image2.`,
        true,
      );
      return;
    }
  }
  if (nextSlot === "image3") {
    const alt = document.getElementById("field-image3Alt")?.value || "";
    if (charCount(alt) < ALT_MIN) {
      setStatus(
        `Enter image3Alt (min ${ALT_MIN} chars) before uploading image3.`,
        true,
      );
      return;
    }
  }

  try {
    setBusy(true, `Uploading ${nextSlot}…`);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("slot", nextSlot);
    const result = await api("/api/upload-image", { method: "POST", body: fd });
    state.sessionImages[nextSlot] = result.originalName;
    setBusy(false);
    setStatus(`Uploaded ${nextSlot}: ${result.originalName}`);
    updateImageStatus();
    await scheduleValidate();
  } catch (err) {
    setBusy(false);
    setStatus(err.message, true);
  }
}

function bindDropZone(el, onFiles) {
  if (!el) return;
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    onFiles(files);
  });
}

function initArticlePage() {
  if (!document.getElementById("article-form")) return;

  bindDropZone(document.getElementById("md-drop"), (files) => {
    const md = files.find((f) => f.name.endsWith(".md"));
    if (md) handleMarkdownFile(md);
    else setStatus("Please drop a .md file.", true);
  });
  document.getElementById("md-file")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleMarkdownFile(file);
  });

  bindDropZone(document.getElementById("image-drop"), (files) => {
    files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 3)
      .forEach((f) => uploadImage(f));
  });
  document.getElementById("image-file")?.addEventListener("change", (e) => {
    [...(e.target.files || [])].forEach((f) => uploadImage(f));
  });

  document.getElementById("add-internal")?.addEventListener("click", () => {
    document.getElementById("internal-links")?.appendChild(makeLinkRow());
  });
  document.getElementById("add-external")?.addEventListener("click", () => {
    document.getElementById("external-links")?.appendChild(makeLinkRow());
  });
  document.getElementById("add-faq")?.addEventListener("click", () => {
    document.getElementById("faqs")?.appendChild(makeFaqRow());
  });

  document.getElementById("article-form")?.addEventListener("input", () => {
    scheduleValidate();
  });
  document.getElementById("overwrite")?.addEventListener("change", () => {
    updateSlugCollision();
    scheduleValidate();
  });

  document.getElementById("preview-jsonld")?.addEventListener("click", async () => {
    try {
      setBusy(true, "Building JSON-LD preview…");
      const data = collectFormData();
      const result = await api("/api/preview-jsonld", {
        method: "POST",
        json: true,
        body: JSON.stringify({ data }),
      });
      const pre = document.getElementById("jsonld-preview");
      if (pre) pre.textContent = JSON.stringify(result.schemas, null, 2);
      setBusy(false);
      setStatus("JSON-LD preview ready.");
    } catch (err) {
      setBusy(false);
      setStatus(err.message, true);
    }
  });

  document.getElementById("generate")?.addEventListener("click", async () => {
    try {
      setBusy(true, "Generating article…");
      const data = collectFormData();
      const body = document.getElementById("field-body")?.value || "";
      const overwrite = document.getElementById("overwrite")?.checked;
      const result = await api("/api/articles", {
        method: "POST",
        json: true,
        body: JSON.stringify({ data, body, overwrite }),
      });
      state.sessionImages = {};
      updateImageStatus();
      await loadArticleList();
      setBusy(false);
      setStatus(`Generated article "${result.slug}" and rebuilt llms.txt.`);
      await scheduleValidate();
    } catch (err) {
      setBusy(false);
      setStatus(err.message, true);
    }
  });

  Promise.all([loadAuthorsAndRoutes(), loadArticleList()])
    .then(() => setStatus("Ready."))
    .catch((err) => setStatus(err.message, true));
}

initArticlePage();

// Export helpers for team/dashboard pages loaded separately if needed
export { api, setStatus, setBusy };
