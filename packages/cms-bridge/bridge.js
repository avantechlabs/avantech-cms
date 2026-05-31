(function () {
  const params = new URLSearchParams(location.search);
  const parentOrigin = params.get("parent");

  // Do not activate if no parent origin is specified.
  if (!parentOrigin) return;

  const FIELD_SELECTOR = "[data-cms-field]";
  let scheduled = false;

  function isEditableField(element) {
    return !element.querySelector(FIELD_SELECTOR);
  }

  function allFields() {
    return [...document.querySelectorAll(FIELD_SELECTOR)];
  }

  function fieldFromElement(element) {
    const rect = element.getBoundingClientRect();
    return {
      id: element.dataset.cmsField,
      value: element.textContent.trim(),
      editable: isEditableField(element),
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  function getEditableField(fieldId) {
    const element = document.querySelector('[data-cms-field="' + fieldId + '"]');
    if (!element || !isEditableField(element)) return null;
    return element;
  }

  function send(message) {
    parent.postMessage(message, parentOrigin);
  }

  function sendFields() {
    scheduled = false;
    send({
      type: "cms:fields",
      fields: allFields().map(fieldFromElement),
    });
  }

  function scheduleFields() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sendFields);
  }

  function applyField(fieldId, value) {
    const element = getEditableField(fieldId);
    if (element) element.textContent = value;
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== parentOrigin) return;
    const message = event.data;

    if (message.type === "cms:discover-fields") sendFields();

    if (message.type === "cms:update-field") {
      applyField(message.fieldId, message.value);
      scheduleFields();
    }

    if (message.type === "cms:apply-fields") {
      for (const [fieldId, value] of Object.entries(message.fields || {})) {
        applyField(fieldId, value);
      }
      scheduleFields();
    }
  });

  document.addEventListener("click", (event) => {
    const field = event.target.closest(FIELD_SELECTOR);
    if (!field || !isEditableField(field)) return;
    event.preventDefault();
    send({ type: "cms:field-clicked", fieldId: field.dataset.cmsField });
  });

  new MutationObserver(scheduleFields).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  addEventListener("scroll", scheduleFields, { passive: true });
  addEventListener("resize", scheduleFields);
  send({ type: "cms:ready" });
  scheduleFields();
})();
