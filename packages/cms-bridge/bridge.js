(function () {
  const params = new URLSearchParams(location.search);
  const parentOrigin = params.get("parent");

  // Only activate when embedded by the CMS editor.
  if (!parentOrigin) return;

  const FIELD_SELECTOR = "[data-cms-field]";

  let scheduled = false;
  let editMode = true; // bridge is injected only in edit; parent confirms via cms:set-mode
  let activeEl = null;
  let activeStartValue = "";
  let hoverEl = null;

  // ── Friendly field labels (never show raw ids to the owner) ─────────────
  const SYNONYMS = {
    desc: "Description", cta: "Button", subtitle: "Subtitle", lede: "Intro",
    eyebrow: "Label", copy: "Text", nav: "Nav", brand: "Brand",
    howItWorks: "How it works", primary: "Primary", secondary: "Secondary",
    testimonial: "Quote", footer: "Footer", hero: "Hero", stats: "Stat",
    features: "Feature", steps: "Step",
  };
  function humanize(id) {
    return id
      .split(".")
      .map((seg) => {
        if (/^\d+$/.test(seg)) return seg;
        if (SYNONYMS[seg]) return SYNONYMS[seg];
        const spaced = seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
      })
      .join(" ");
  }

  // ── Injected chrome (outlines, label chip) ──────────────────────────────
  const style = document.createElement("style");
  style.id = "cms-bridge-style";
  style.textContent = `
    :root {
      --cms-gold: #FDB714;
      --cms-text: #1A1916;
      --cms-surface: #FFFFFF;
      --cms-line: #E7E3DC;
      --cms-draft: #B7791F;
      --cms-draft-tint: rgba(183,121,31,0.10);
    }
    body.cms-edit [data-cms-field].cms-leaf {
      cursor: text;
      border-radius: 4px;
      outline: 1.5px solid transparent;
      outline-offset: 6px;
      transition: outline-color .14s ease, background-color .14s ease;
    }
    body.cms-edit [data-cms-field].cms-leaf.cms-draft {
      /* calm "you changed this": soft tint + soft solid accent, never an alarming dashed box */
      background-color: var(--cms-draft-tint);
      outline-color: color-mix(in srgb, var(--cms-draft) 45%, transparent);
    }
    body.cms-edit [data-cms-field].cms-leaf.cms-hover {
      outline-color: var(--cms-gold);
      background-color: color-mix(in srgb, var(--cms-gold) 7%, transparent);
    }
    body.cms-edit [data-cms-field].cms-leaf.cms-active {
      outline: 2px solid var(--cms-gold) !important;
      outline-offset: 6px;
      background-color: transparent !important;
    }
    .cms-chip {
      position: fixed;
      z-index: 2147483646;
      font: 400 10px/1 'Space Mono', ui-monospace, monospace;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: var(--cms-surface);
      background: var(--cms-text);
      padding: 4px 7px;
      border-radius: 4px;
      pointer-events: none;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(3px);
      transition: opacity .14s ease, transform .14s ease;
    }
    .cms-chip.cms-show { opacity: .96; transform: translateY(0); }
    @media (prefers-reduced-motion: reduce) {
      body.cms-edit [data-cms-field].cms-leaf,
      .cms-chip { transition: none; }
    }
  `;

  const chip = document.createElement("div");
  chip.className = "cms-chip";

  function mountChrome() {
    document.head.appendChild(style);
    document.body.appendChild(chip);
    document.body.classList.toggle("cms-edit", editMode);
  }

  // ── Field helpers ───────────────────────────────────────────────────────
  function isLeaf(el) {
    return !el.querySelector(FIELD_SELECTOR);
  }
  function allFields() {
    return [...document.querySelectorAll(FIELD_SELECTOR)];
  }
  function leafFields() {
    return allFields().filter(isLeaf);
  }
  function getLeaf(fieldId) {
    const escaped = window.CSS && CSS.escape ? CSS.escape(fieldId) : fieldId;
    const el = document.querySelector('[data-cms-field="' + escaped + '"]');
    return el && isLeaf(el) ? el : null;
  }
  function markLeaves() {
    for (const el of leafFields()) el.classList.add("cms-leaf");
  }

  // ── Discovery ───────────────────────────────────────────────────────────
  function fieldFromElement(el) {
    const r = el.getBoundingClientRect();
    return {
      id: el.dataset.cmsField,
      value: el.textContent.trim(),
      editable: isLeaf(el),
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
    };
  }
  function send(message) {
    parent.postMessage(message, parentOrigin);
  }
  function sendFields() {
    scheduled = false;
    markLeaves();
    send({ type: "cms:fields", fields: allFields().map(fieldFromElement) });
  }
  function scheduleFields() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sendFields);
  }
  function applyField(fieldId, value) {
    const el = getLeaf(fieldId);
    if (el && el !== activeEl) el.textContent = value;
  }

  // ── Hover label chip ────────────────────────────────────────────────────
  function showChip(el) {
    chip.textContent = humanize(el.dataset.cmsField);
    const r = el.getBoundingClientRect();
    chip.style.left = Math.max(6, r.left) + "px";
    chip.style.top = Math.max(6, r.top - 24) + "px";
    chip.classList.add("cms-show");
  }
  function hideChip() {
    chip.classList.remove("cms-show");
  }

  // ── Inline editing ──────────────────────────────────────────────────────
  function enterEdit(el) {
    if (activeEl === el) return;
    commit();
    activeEl = el;
    activeStartValue = el.textContent;
    el.classList.remove("cms-hover");
    el.classList.add("cms-active");
    try {
      el.contentEditable = "plaintext-only";
    } catch (_) {
      el.contentEditable = "true";
    }
    if (el.contentEditable !== "plaintext-only" && el.contentEditable !== "true") {
      el.contentEditable = "true";
    }
    el.focus();
    hideChip();
    send({ type: "cms:editing", fieldId: el.dataset.cmsField });
  }

  function commit() {
    if (!activeEl) return;
    const el = activeEl;
    activeEl = null;
    el.contentEditable = "false";
    el.classList.remove("cms-active");
    const value = el.textContent;
    if (value !== activeStartValue) {
      send({ type: "cms:field-changed", fieldId: el.dataset.cmsField, value });
    }
    send({ type: "cms:editing", fieldId: null });
  }

  // ── Events ──────────────────────────────────────────────────────────────
  document.addEventListener("mouseover", (event) => {
    if (!editMode || activeEl) return;
    const field = event.target.closest(FIELD_SELECTOR);
    if (!field || !isLeaf(field)) {
      if (hoverEl) {
        hoverEl.classList.remove("cms-hover");
        hoverEl = null;
        hideChip();
      }
      return;
    }
    if (hoverEl && hoverEl !== field) hoverEl.classList.remove("cms-hover");
    hoverEl = field;
    field.classList.add("cms-hover");
    showChip(field);
  });

  document.addEventListener("click", (event) => {
    const field = event.target.closest(FIELD_SELECTOR);
    if (editMode && field && isLeaf(field)) {
      event.preventDefault();
      enterEdit(field);
      send({ type: "cms:field-clicked", fieldId: field.dataset.cmsField });
      return;
    }
    if (activeEl && field !== activeEl) commit();
  });

  document.addEventListener("keydown", (event) => {
    if (!activeEl) return;
    if (event.key === "Escape") {
      event.preventDefault();
      commit();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  });

  document.addEventListener("focusout", (event) => {
    if (activeEl && event.target === activeEl) commit();
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== parentOrigin) return;
    const message = event.data || {};

    switch (message.type) {
      case "cms:discover-fields":
        sendFields();
        break;
      case "cms:update-field":
        applyField(message.fieldId, message.value);
        scheduleFields();
        break;
      case "cms:apply-fields":
        for (const [id, value] of Object.entries(message.fields || {})) {
          applyField(id, value);
        }
        scheduleFields();
        break;
      case "cms:select-field": {
        const el = getLeaf(message.fieldId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
      case "cms:enter-field": {
        const el = getLeaf(message.fieldId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          enterEdit(el);
        }
        break;
      }
      case "cms:set-mode":
        editMode = message.mode === "edit";
        if (!editMode) {
          commit();
          hideChip();
          if (hoverEl) {
            hoverEl.classList.remove("cms-hover");
            hoverEl = null;
          }
        }
        document.body.classList.toggle("cms-edit", editMode);
        break;
      case "cms:set-theme":
        for (const [name, value] of Object.entries(message.tokens || {})) {
          document.documentElement.style.setProperty(name, value);
        }
        break;
      case "cms:set-drafts": {
        const drafts = new Set(message.fieldIds || []);
        for (const el of leafFields()) {
          el.classList.toggle("cms-draft", drafts.has(el.dataset.cmsField));
        }
        break;
      }
    }
  });

  // Re-report field geometry on layout changes, but never while the owner is typing.
  new MutationObserver(() => {
    if (activeEl) return;
    scheduleFields();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  addEventListener("scroll", () => {
    if (hoverEl) showChip(hoverEl);
    scheduleFields();
  }, { passive: true });
  addEventListener("resize", scheduleFields);

  function boot() {
    mountChrome();
    send({ type: "cms:ready" });
    scheduleFields();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
