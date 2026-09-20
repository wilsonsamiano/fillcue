export function enrich(fills, settings) {
  const rows = fills.map((f) => ({ ...f }));
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    const gal = Number(cur.gallons);
    const total = Number(cur.total);
    const odo = Number(cur.odometer);
    const prevOdo = prev ? Number(prev.odometer) : NaN;
    cur.milesThisTank = Number.isFinite(odo) && Number.isFinite(prevOdo) ? odo - prevOdo : null;
    cur.mpg = cur.milesThisTank && gal ? cur.milesThisTank / gal : null;
    cur.costPerMile = cur.milesThisTank && total ? total / cur.milesThisTank : null;
  }
  const gallons = rows.reduce((s, r) => s + (Number(r.gallons) || 0), 0);
  const spent = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const mpgVals = rows.map((r) => r.mpg).filter((n) => Number.isFinite(n) && n > 0 && n < 80);
  const avgMpg = mpgVals.length ? mpgVals.reduce((a, b) => a + b, 0) / mpgVals.length : null;
  const last = rows[rows.length - 1] || null;
  const usable = Number(settings.usableGal) || 18.5;
  const epa = Number(settings.epaComb) || 20;
  const rangeEst = (avgMpg || epa) * usable;
  const avgPpg = gallons ? spent / gallons : null;
  return { rows, gallons, spent, avgMpg, avgPpg, last, rangeEst, settings };
}

export function money(n, d = 2) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmt(n, d = 1) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export function toCsv(rows) {
  const cols = ["date","time","station","city","pump","grade","gallons","pricePerGal","total","odometer","clusterRange","clusterAvgMph","outsideF","milesThisTank","mpg","costPerMile","fillToFull","tripType","notes"];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
