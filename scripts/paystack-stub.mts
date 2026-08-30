/*
 * A stand-in for Paystack, for exercising the payment path locally.
 *
 * Implements only what the app calls: initialize and verify. Every reference
 * it has seen is remembered, so verify reports success for a transaction that
 * was actually initialized and "abandoned" for one that was not — and a second
 * initialize on the same reference is rejected, the way Paystack rejects it.
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 4455);
const seen = new Map<string, { amount: number; currency: string }>();

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks).toString() || "{}";
  const json = (status: number, obj: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  // Key probe: the admin console verifies a key before storing it.
  if (req.url?.startsWith("/transaction/totals")) {
    const auth = req.headers.authorization ?? "";
    if (!/^Bearer sk_(test|live)_[A-Za-z0-9]{10,}$/.test(auth)) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ status: false, message: "Invalid key" }));
    }
    return json(200, { status: true, data: { total_volume: 0 } });
  }

  if (req.url?.startsWith("/transaction/initialize")) {
    const { reference, amount, currency } = JSON.parse(body);
    if (seen.has(reference)) return json(400, { status: false, message: "Duplicate Transaction Reference" });
    seen.set(reference, { amount, currency });
    return json(200, {
      status: true,
      data: {
        authorization_url: `http://localhost:${port}/checkout/${reference}`,
        access_code: "stub",
        reference,
      },
    });
  }

  if (req.url?.startsWith("/transaction/verify/")) {
    const reference = decodeURIComponent(req.url.split("/transaction/verify/")[1]);
    const tx = seen.get(reference);
    if (!tx) return json(200, { status: true, data: { status: "abandoned", reference, amount: 0 } });
    return json(200, {
      status: true,
      data: {
        status: "success",
        reference,
        amount: tx.amount,
        currency: tx.currency,
        channel: "card",
        paid_at: new Date().toISOString(),
      },
    });
  }

  json(404, { status: false, message: "not found" });
}).listen(port, () => console.log(`paystack stub on ${port}`));
