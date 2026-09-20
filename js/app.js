import { getAllFills, saveFill, deleteFill, getSetting, setSetting, uid, DEFAULT_SETTINGS } from "./db.js";
import { recognizeFile } from "./ocr.js";
import { parseReceipt, parseCluster, guessPhotoKind, mergeParse } from "./parse.js";
import { enrich, money, fmt, toCsv } from "./stats.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = { settings: { ...DEFAULT_SETTINGS }, fills: [], receipt: { text: "", preview: "" }, cluster: { text: "", preview: "" }, parsed: mergeParse({}, {}) };

const FIRST_FILL = {
  id: "seed-costco-2026-09-20", date: "2026-09-20", time: "12:22", station: "Costco #483", city: "San Diego, CA", pump: "8", grade: "Regular 87",
  gallons: 14.418, pricePerGal: 5.799, total: 83.61, odometer: 112464, clusterRange: 309, clusterAvgMph: 26, outsideF: 81,
  fillToFull: "Yes", tripType: "City",
  notes: "Costco Gateway Center Dr, then 4.2 mi to Tous Les Jours, National City. Cluster at bakery: ODO 112468 / Range 309 / 26 mph / 81F."
};

function showView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
}
function bindForm(data) {
  const form = $("#fill-form");
  for (const el of form.elements) if (el.name) el.value = data[el.name] == null ? "" : data[el.name];
}
function readForm() {
  const data = {};
  for (const el of $("#fill-form").elements) if (el.name) data[el.name] = el.value;
  return data;
}
function renderDashboard() {
  const s = enrich(state.fills, state.settings);
  const last = s.last;
  $("#kpi-fills").textContent = String(s.rows.length);
  $("#kpi-gallons").textContent = fmt(s.gallons, 3);
  $("#kpi-spent").textContent = money(s.spent);
  $("#kpi-ppg").textContent = s.avgPpg != null ? money(s.avgPpg, 3) : "—";
  $("#kpi-mpg").textContent = s.avgMpg != null ? fmt(s.avgMpg, 2) : "Need 2nd fill";
  $("#kpi-range").textContent = fmt(s.rangeEst, 0);
  $("#cluster-range").textContent = last?.clusterRange ? fmt(last.clusterRange, 0) : fmt(s.rangeEst, 0);
  $("#cluster-odo").textContent = last?.odometer ? Number(last.odometer).toLocaleString("en-US") : "—";
  $("#cluster-mph").textContent = last?.clusterAvgMph != null && last.clusterAvgMph !== "" ? `${last.clusterAvgMph} mph` : "—";
  $("#cluster-temp").textContent = last?.outsideF != null && last.outsideF !== "" ? `${last.outsideF}°F` : "—";
  $("#cluster-sub").textContent = last ? `${last.station || "Last fill"} · ${last.date || ""}` : "No fills yet";
  $("#epa-line").textContent = `EPA ${state.settings.epaCity}/${state.settings.epaHwy}/${state.settings.epaComb}`;
}
function renderLog() {
  const s = enrich(state.fills, state.settings);
  const box = $("#log-list");
  if (!s.rows.length) { box.innerHTML = "<div class='hint'>No fills yet.</div>"; return; }
  box.innerHTML = s.rows.slice().reverse().map((r) => `<article class="log-item" data-id="${r.id}"><div><div class="title">${r.station || "Fill"} · ${r.date || ""}</div><div class="hint">${r.gallons || "—"} gal @ ${r.pricePerGal != null ? money(r.pricePerGal, 3) : "—"} · ${money(r.total)}</div></div><div><b>${r.mpg ? fmt(r.mpg, 1) : "—"}</b></div></article>`).join("");
  box.querySelectorAll(".log-item").forEach((el) => el.addEventListener("click", () => openFill(el.dataset.id)));
}
function renderSettings() {
  const f = $("#settings-form");
  for (const el of f.elements) if (el.name && state.settings[el.name] != null) el.value = state.settings[el.name];
}
async function refresh() {
  let fills = await getAllFills();
  if (!fills.length) { await saveFill(FIRST_FILL); fills = [FIRST_FILL]; }
  state.fills = fills;
  renderDashboard(); renderLog(); renderSettings();
}
async function openFill(id) {
  const fill = state.fills.find((f) => f.id === id);
  if (!fill) return;
  state.parsed = { ...fill };
  bindForm(fill);
  showView("capture");
}
function setProgress(pct, msg) {
  $("#ocr-bar").style.width = `${pct}%`;
  $("#ocr-status").textContent = msg || "";
}
async function handlePhoto(file, slot) {
  if (!file) return;
  try {
    setProgress(8, "Preparing photo…");
    const rec = await recognizeFile(file, (m) => setProgress(40, m));
    const kind = slot || guessPhotoKind(rec.text);
    if (kind === "cluster") {
      state.cluster = { text: rec.text, preview: rec.previewUrl };
      $("#thumb-cluster").src = rec.previewUrl; $("#thumb-cluster").hidden = false;
      $("#ocr-cluster").textContent = rec.text.trim() || "(no text)";
      state.parsed = mergeParse(parseReceipt(state.receipt.text), parseCluster(rec.text), readForm());
    } else {
      state.receipt = { text: rec.text, preview: rec.previewUrl };
      $("#thumb-receipt").src = rec.previewUrl; $("#thumb-receipt").hidden = false;
      $("#ocr-receipt").textContent = rec.text.trim() || "(no text)";
      state.parsed = mergeParse(parseReceipt(rec.text), parseCluster(state.cluster.text), readForm());
    }
    bindForm(state.parsed);
    setProgress(100, "Check the fields before saving.");
  } catch (err) {
    setProgress(0, err.message || String(err));
  }
}
async function saveCurrent() {
  const data = readForm();
  if (!data.date) { $("#ocr-status").textContent = "Add a date before saving."; return; }
  const fill = {
    id: data.id || state.parsed.id || uid(), ...data,
    gallons: data.gallons === "" ? null : Number(data.gallons),
    pricePerGal: data.pricePerGal === "" ? null : Number(data.pricePerGal),
    total: data.total === "" ? null : Number(data.total),
    odometer: data.odometer === "" ? null : Number(data.odometer),
    clusterRange: data.clusterRange === "" ? null : Number(data.clusterRange),
    clusterAvgMph: data.clusterAvgMph === "" ? null : Number(data.clusterAvgMph),
    outsideF: data.outsideF === "" ? null : Number(data.outsideF),
    receiptText: state.receipt.text || "",
    clusterText: state.cluster.text || "",
    updatedAt: new Date().toISOString()
  };
  await saveFill(fill);
  await refresh();
  showView("home");
}
function resetCapture() {
  state.receipt = { text: "", preview: "" };
  state.cluster = { text: "", preview: "" };
  state.parsed = mergeParse({}, {}, { date: new Date().toISOString().slice(0, 10), fillToFull: "Yes", tripType: "Mixed" });
  bindForm({ id: "", ...state.parsed });
  $("#thumb-receipt").hidden = true; $("#thumb-cluster").hidden = true;
  $("#ocr-receipt").textContent = ""; $("#ocr-cluster").textContent = "";
  setProgress(0, "Waiting for a photo.");
}
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
async function boot() {
  $$(".tabbar button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  $("#btn-new").addEventListener("click", () => { resetCapture(); showView("capture"); });
  $("#file-receipt").addEventListener("change", (e) => handlePhoto(e.target.files[0], "receipt"));
  $("#file-cluster").addEventListener("change", (e) => handlePhoto(e.target.files[0], "cluster"));
  $("#file-auto").addEventListener("change", (e) => handlePhoto(e.target.files[0], null));
  $("#btn-save").addEventListener("click", saveCurrent);
  $("#btn-clear").addEventListener("click", resetCapture);
  $("#btn-delete").addEventListener("click", async () => {
    const data = readForm();
    if (data.id && confirm("Delete this fill?")) { await deleteFill(data.id); resetCapture(); await refresh(); showView("log"); }
  });
  $("#settings-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const next = { ...state.settings };
    for (const el of ev.target.elements) if (el.name) next[el.name] = el.type === "number" ? Number(el.value) : el.value;
    state.settings = next; await setSetting("vehicle", next); renderDashboard(); $("#settings-saved").hidden = false;
  });
  $("#btn-export-json").addEventListener("click", () => download(new Blob([JSON.stringify({ settings: state.settings, fills: state.fills }, null, 2)], { type: "application/json" }), "fillcue-backup.json"));
  $("#btn-export-csv").addEventListener("click", () => download(new Blob([toCsv(enrich(state.fills, state.settings).rows)], { type: "text/csv" }), "fillcue-log.csv"));
  $("#file-import").addEventListener("change", async (e) => {
    if (!e.target.files[0]) return;
    const data = JSON.parse(await e.target.files[0].text());
    if (data.settings) { state.settings = { ...DEFAULT_SETTINGS, ...data.settings }; await setSetting("vehicle", state.settings); }
    if (Array.isArray(data.fills)) for (const fill of data.fills) if (fill?.id) await saveFill(fill);
    await refresh();
  });
  const saved = await getSetting("vehicle", null);
  state.settings = saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  await setSetting("vehicle", state.settings);
  await refresh();
  bindForm({ id: "", date: new Date().toISOString().slice(0, 10), fillToFull: "Yes", tripType: "Mixed", grade: "Regular 87" });
  if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("./sw.js"); } catch {} }
}
boot();
