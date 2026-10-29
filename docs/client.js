// Image requests can return JSON error bodies; decode them before displaying.
async function screenshotErrorMessage(error) {
  if (!error.response) {
    return "Unable to reach the API. Check the API URL, network, and CORS settings.";
  }
  const status = error.response.status;
  if (status === 401) {
    return "HTTP 401: API authentication failed. Check the API key for the selected API URL.";
  }
  let payload = error.response.data;
  try {
    if (payload && typeof payload.text === "function")
      payload = await payload.text();
    if (typeof payload === "string") payload = JSON.parse(payload);
  } catch (_) {
    payload = null;
  }
  const message =
    payload && typeof payload.message === "string"
      ? payload.message
      : "The API could not capture this page.";
  return `HTTP ${status}: ${message}`;
}

function httpUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw new Error(`${label} must be a complete HTTP or HTTPS address.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `${label} must use HTTP or HTTPS without embedded credentials.`,
    );
  }
  return url;
}

function captureRequest(apiUrl, apiKey, options) {
  const endpoint = httpUrl(apiUrl, "API URL");
  if (endpoint.search || endpoint.hash)
    throw new Error("API URL must not contain a query string or fragment.");
  httpUrl(options.url, "Website URL");
  if (!apiKey.trim())
    throw new Error(
      "Add your API key in API settings before capturing a page.",
    );
  const match = /^(\d{1,4})x(\d{1,4})$/.exec(options.viewport);
  if (
    !match ||
    +match[1] < 1 ||
    +match[2] < 1 ||
    +match[1] * +match[2] > 16000000
  ) {
    throw new Error(
      "Viewport dimensions must be 1–9999 pixels and total no more than 16 million pixels.",
    );
  }
  if (
    !["PNG", "JPG"].includes(options.format) ||
    !Number.isInteger(+options.delay) ||
    +options.delay < 0 ||
    +options.delay > 10
  ) {
    throw new Error("Choose PNG or JPG and a delay between 0 and 10 seconds.");
  }
  endpoint.pathname = endpoint.pathname.replace(/\/$/, "") + "/screenshot";
  endpoint.search = new URLSearchParams({
    url: options.url,
    viewport: options.viewport,
    format: options.format,
    delay: options.delay,
    fullpage: options.fullpage ? "1" : "0",
  }).toString();
  return { url: endpoint.href, headers: { Authorization: `Bearer ${apiKey}` } };
}

function readSettings(local, session) {
  for (const [storage, remember] of [
    [local, true],
    [session, false],
  ]) {
    const saved = storage.getItem("screenshotConnection");
    if (saved) {
      const connection = JSON.parse(saved);
      if (
        typeof connection.url === "string" &&
        typeof connection.key === "string"
      ) {
        return { url: connection.url, key: connection.key, remember };
      }
    }
  }
  return {
    url:
      local.getItem("apiUrl") ||
      session.getItem("apiUrl") ||
      "https://screenshot-api.oncornerstone.app",
    key: local.getItem("apiKey") || session.getItem("apiKey") || "",
    remember: Boolean(local.getItem("apiKey")),
  };
}

function persistSettings(local, session, settings) {
  const destination = settings.remember ? local : session;
  // Save the endpoint and key atomically so a failed write cannot pair an old
  // credential with a new endpoint. Read legacy keys until the first save.
  destination.setItem(
    "screenshotConnection",
    JSON.stringify({ url: settings.url, key: settings.key }),
  );
  const other = settings.remember ? session : local;
  other.removeItem("screenshotConnection");
  for (const storage of [local, session]) {
    storage.removeItem("apiUrl");
    storage.removeItem("apiKey");
  }
}

function captureFilename(format, date = new Date()) {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return `screenshot-${timestamp}.${format.toLowerCase()}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  let settings;
  try {
    settings = readSettings(localStorage, sessionStorage);
  } catch (_) {
    settings = {
      url: "https://screenshot-api.oncornerstone.app",
      key: "",
      remember: false,
    };
  }
  let imageUrl = null;
  let capturing = false;
  const dialog = $("apiSettingsModal");
  const announce = (message) => {
    $("captureAnnouncement").textContent = message;
  };
  const error = (message) => {
    $("errorContainer").textContent = message;
    $("errorContainer").hidden = false;
  };
  function updateConnection() {
    $("connectionStatus").textContent = settings.key
      ? "API configured"
      : "Set up API";
    $("connectionDot").classList.toggle("configured", Boolean(settings.key));
  }
  function closeNavigation() {
    $("sidebar").classList.remove("open");
    $("sidebar").inert = window.matchMedia("(max-width: 980px)").matches;
    $("navBackdrop").hidden = true;
    $("openNavigation").setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
    document.querySelector(".app-shell").inert = false;
  }
  function openSettings() {
    closeNavigation();
    $("apiUrl").value = settings.url;
    $("apiKey").value = settings.key;
    $("saveSettingsCheckbox").checked = settings.remember;
    $("settingsError").hidden = true;
    dialog.showModal();
  }
  document
    .querySelectorAll("[data-settings]")
    .forEach((button) => button.addEventListener("click", openSettings));
  $("closeSettings").addEventListener("click", () => dialog.close());
  $("cancelSettings").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (window.matchMedia("(max-width: 980px)").matches) {
      document.querySelector(".connection-button").focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  $("settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const url = httpUrl($("apiUrl").value.trim(), "API URL");
      if (url.search || url.hash)
        throw new Error("API URL must not contain a query string or fragment.");
      const key = $("apiKey").value.trim();
      if (!key) throw new Error("Enter an API key.");
      const next = {
        url: url.href.replace(/\/$/, ""),
        key,
        remember: $("saveSettingsCheckbox").checked,
      };
      persistSettings(localStorage, sessionStorage, next);
      settings = next;
      updateConnection();
      dialog.close();
      announce("API settings saved.");
    } catch (e) {
      $("settingsError").textContent =
        e.name === "SecurityError" || e.name === "QuotaExceededError"
          ? "Your browser could not save these settings. Allow site storage and try again."
          : e.message;
      $("settingsError").hidden = false;
    }
  });
  $("openNavigation").addEventListener("click", () => {
    $("sidebar").inert = false;
    $("sidebar").classList.add("open");
    $("navBackdrop").hidden = false;
    $("openNavigation").setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
    document.querySelector(".app-shell").inert = true;
    $("closeNavigation").focus();
  });
  $("closeNavigation").addEventListener("click", () => {
    closeNavigation();
    $("openNavigation").focus();
  });
  $("navBackdrop").addEventListener("click", closeNavigation);
  $("sidebar")
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", closeNavigation));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("sidebar").classList.contains("open")) {
      closeNavigation();
      $("openNavigation").focus();
    }
    if (event.key === "Tab" && $("sidebar").classList.contains("open")) {
      const items = [...$("sidebar").querySelectorAll("a,button")].filter(
        (el) => el.getClientRects().length,
      );
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    }
  });
  window
    .matchMedia("(min-width: 981px)")
    .addEventListener("change", closeNavigation);
  function updatePreset() {
    const custom = $("viewportPreset").value === "custom";
    $("customDimensions").hidden = !custom;
    $("width").disabled = $("height").disabled = !custom;
  }
  $("viewportPreset").addEventListener("change", updatePreset);
  $("delaySlider").addEventListener("input", () => {
    const delay = $("delaySlider").value;
    $("delayValue").textContent =
      `${delay} ${delay === "1" ? "second" : "seconds"}`;
  });
  $("resetOptions").addEventListener("click", () => {
    $("viewportPreset").value = "1440x900";
    $("width").value = "1440";
    $("height").value = "900";
    $("fullpage").checked = false;
    document.querySelector("[name=format][value=PNG]").checked = true;
    $("delaySlider").value = "1";
    $("delayValue").textContent = "1 second";
    updatePreset();
  });
  $("saveButton").addEventListener("click", (event) => {
    if (!imageUrl || capturing) event.preventDefault();
  });
  $("userForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (capturing) return;
    let request;
    const options = {
      url: $("websiteUrl").value.trim(),
      viewport:
        $("viewportPreset").value === "custom"
          ? `${$("width").value}x${$("height").value}`
          : $("viewportPreset").value,
      format: document.querySelector("[name=format]:checked").value,
      delay: $("delaySlider").value,
      fullpage: $("fullpage").checked,
    };
    try {
      request = captureRequest(settings.url, settings.key, options);
    } catch (e) {
      error(e.message);
      if (!settings.key) openSettings();
      return;
    }
    capturing = true;
    $("errorContainer").hidden = true;
    $("submitButton").disabled = true;
    $("submitLabel").textContent = "Capturing…";
    $("screenshotSpinner").hidden = false;
    $("previewCard").setAttribute("aria-busy", "true");
    $("previewStatus").textContent = "Capturing";
    $("previewStatus").classList.remove("success");
    $("previewSubtitle").textContent = new URL(options.url).hostname;
    $("loadingState").hidden = false;
    $("emptyState").hidden = true;
    $("resultLink").hidden = true;
    $("saveButton").setAttribute("aria-disabled", "true");
    announce("Capture started. Loading and rendering the page.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70000);
    const started = performance.now();
    let nextUrl;
    try {
      const response = await fetch(request.url, {
        headers: request.headers,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        const data = await response.blob();
        throw new Error(
          await screenshotErrorMessage({
            response: { status: response.status, data },
          }),
        );
      }
      const blob = await response.blob();
      if (!["image/png", "image/jpeg"].includes(blob.type))
        throw new Error(
          "The API returned an unexpected response instead of an image.",
        );
      nextUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = nextUrl;
      await image.decode();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = nextUrl;
      nextUrl = null;
      $("resultImage").src = imageUrl;
      $("resultImage").alt =
        `Screenshot of ${new URL(options.url).hostname}${options.fullpage ? ", full page" : ""}`;
      $("resultLink").href = imageUrl;
      $("saveButton").href = imageUrl;
      $("saveButton").download = captureFilename(options.format);
      const details = `${image.naturalWidth} × ${image.naturalHeight} · ${options.format} · ${Math.max(1, Math.round(blob.size / 1024))} KB · ${((performance.now() - started) / 1000).toFixed(1)}s`;
      $("resultDetails").querySelector("span").textContent = details;
      $("previewStatus").textContent = "Capture complete";
      $("previewStatus").classList.add("success");
      announce(
        `Screenshot ready. ${image.naturalWidth} by ${image.naturalHeight} pixels.`,
      );
    } catch (e) {
      if (nextUrl) URL.revokeObjectURL(nextUrl);
      const message =
        e.name === "AbortError"
          ? "The capture timed out. Try again shortly."
          : e instanceof TypeError
            ? await screenshotErrorMessage({})
            : e.message;
      error(message);
      announce("Capture failed. " + message);
      $("previewStatus").textContent = "Capture failed";
      $("previewSubtitle").textContent = imageUrl
        ? "Showing your previous capture."
        : "Adjust your settings and try again.";
    } finally {
      clearTimeout(timeout);
      capturing = false;
      $("submitButton").disabled = false;
      $("submitLabel").textContent = "Capture screenshot";
      $("screenshotSpinner").hidden = true;
      $("previewCard").setAttribute("aria-busy", "false");
      $("loadingState").hidden = true;
      $("emptyState").hidden = Boolean(imageUrl);
      $("resultLink").hidden = !imageUrl;
      $("saveButton").setAttribute("aria-disabled", String(!imageUrl));
    }
  });
  closeNavigation();
  updatePreset();
  updateConnection();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
});
