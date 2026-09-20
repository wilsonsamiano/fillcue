/** Receipt + cluster parsers */
function clean(text) {
  return String(text || "").replace(/\u00a0/g, " ");
}
function num(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function pickDate(text) {
  const t = clean(text);
  const mdy = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (mdy) {
    let y = Number(mdy[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(mdy[1]).padStart(2, "0")}-${String(mdy[2]).padStart(2, "0")}`;
  }
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  return iso ? iso[0] : "";
}
function pickTime(text) {
  const m = clean(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
export function parseReceipt(text) {
  const t = clean(text);
  const out = { kind: "receipt", station: "", city: "", pump: "", grade: "", gallons: null, pricePerGal: null, total: null, date: pickDate(t), time: pickTime(t), notes: "" };
  if (/costco/i.test(t)) out.station = "Costco";
  const store = t.match(/Costco\s*#\s*(\d+)/i);
  if (store) out.station = `Costco #${store[1]}`;
  const city = t.match(/([A-Za-z .]+),\s*([A-Z]{2})\s+\d{5}/);
  if (city) out.city = `${city[1].trim()}, ${city[2]}`;
  const pump = t.match(/\bPump\b[^\d]{0,8}(\d{1,2})\b/i);
  if (pump) out.pump = pump[1];
  if (/regular/i.test(t)) out.grade = "Regular 87";
  else if (/premium/i.test(t)) out.grade = "Premium";
  else if (/diesel/i.test(t)) out.grade = "Diesel";
  const galLabel = t.match(/Gallons?\s*[:\s]*([0-9]+\.[0-9]{2,4})/i) || t.match(/\b([0-9]{1,2}\.[0-9]{3})\b/);
  if (galLabel) out.gallons = num(galLabel[1]);
  const ppg = t.match(/(?:Price|PER\s*GAL(?:LON)?)\s*[:\s]*\$?\s*([0-9]\.[0-9]{2,3})/i) || t.match(/\$\s*([4-9]\.[0-9]{3})\b/);
  if (ppg) out.pricePerGal = num(ppg[1]);
  const amount = t.match(/(?:Amount|Total\s*Sale|Total)\s*[:\s]*\$?\s*([0-9]+\.[0-9]{2})/i);
  if (amount) out.total = num(amount[1]);
  if (out.gallons && out.pricePerGal && !out.total) out.total = Math.round(out.gallons * out.pricePerGal * 100) / 100;
  if (out.gallons && out.total && !out.pricePerGal) out.pricePerGal = Math.round((out.total / out.gallons) * 1000) / 1000;
  return out;
}
export function parseCluster(text) {
  const t = clean(text);
  const out = { kind: "cluster", odometer: null, clusterRange: null, clusterAvgMph: null, outsideF: null, notes: "" };
  const odo = t.match(/\bODO\b[^\d]{0,12}(\d{4,7})\b/i) || t.match(/\b(\d{5,7})\s*miles\b/i);
  if (odo) out.odometer = num(odo[1]);
  const range = t.match(/\bRange\b[^\d]{0,12}(\d{2,4})\s*(?:miles|mi)?/i);
  if (range) out.clusterRange = num(range[1]);
  const mph = t.match(/After\s*Reset[^\d]{0,12}(\d{1,3})\s*MPH/i) || t.match(/\b(\d{1,3})\s*MPH\b/i);
  if (mph) out.clusterAvgMph = num(mph[1]);
  const temp = t.match(/Outside\s*(\d{1,3})\s*°?\s*F/i);
  if (temp) out.outsideF = num(temp[1]);
  return out;
}
export function guessPhotoKind(text) {
  const t = clean(text);
  const r = [/costco/i, /gallons/i, /total sale/i, /pump/i, /regular/i].reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  const c = [/\bODO\b/i, /\bRange\b/i, /After\s*Reset/i, /\bMPH\b/i].reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  if (c > r) return "cluster";
  if (r > 0) return "receipt";
  return "unknown";
}
export function mergeParse(receipt, cluster, extra = {}) {
  return {
    date: receipt.date || extra.date || "",
    time: receipt.time || extra.time || "",
    station: receipt.station || extra.station || "",
    city: receipt.city || extra.city || "",
    pump: receipt.pump || extra.pump || "",
    grade: receipt.grade || extra.grade || "Regular 87",
    gallons: receipt.gallons ?? extra.gallons ?? "",
    pricePerGal: receipt.pricePerGal ?? extra.pricePerGal ?? "",
    total: receipt.total ?? extra.total ?? "",
    odometer: cluster.odometer ?? extra.odometer ?? "",
    clusterRange: cluster.clusterRange ?? extra.clusterRange ?? "",
    clusterAvgMph: cluster.clusterAvgMph ?? extra.clusterAvgMph ?? "",
    outsideF: cluster.outsideF ?? extra.outsideF ?? "",
    fillToFull: extra.fillToFull || "Yes",
    tripType: extra.tripType || "Mixed",
    notes: extra.notes || ""
  };
}
