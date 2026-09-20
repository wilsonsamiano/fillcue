import { parseReceipt, parseCluster, guessPhotoKind } from "./parse.js";

const receipt = `
Costco #483
844 Gateway Center Dr
San Diego, CA 92102
Date: 09/20/26
Time: 12:22
Pump 8
Gallons 14.418
Price $ 5.799
Product Regular
Amount $ 83.61
Total Sale $ 83.61
`;

const cluster = `
Outside 81\u00b0F
P
Range
309 miles
After Reset
26 MPH
ODO 112468 miles
`;

const r = parseReceipt(receipt);
const c = parseCluster(cluster);

const checks = [
  ["station", r.station.includes("Costco"), r.station],
  ["gallons", r.gallons === 14.418, r.gallons],
  ["ppg", r.pricePerGal === 5.799, r.pricePerGal],
  ["total", r.total === 83.61, r.total],
  ["date", r.date === "2026-09-20", r.date],
  ["time", r.time === "12:22", r.time],
  ["grade", r.grade.startsWith("Regular"), r.grade],
  ["odo", c.odometer === 112468, c.odometer],
  ["range", c.clusterRange === 309, c.clusterRange],
  ["mph", c.clusterAvgMph === 26, c.clusterAvgMph],
  ["temp", c.outsideF === 81, c.outsideF],
  ["kind-r", guessPhotoKind(receipt) === "receipt", guessPhotoKind(receipt)],
  ["kind-c", guessPhotoKind(cluster) === "cluster", guessPhotoKind(cluster)],
];

let failed = 0;
for (const [name, ok, val] of checks) {
  console.log(ok ? "ok " : "FAIL ", name, val);
  if (!ok) failed++;
}
if (failed) {
  console.error(failed, "failed");
  process.exit(1);
}
console.log("all passed");
