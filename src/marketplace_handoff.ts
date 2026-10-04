import { createServer, type ServerResponse } from "node:http";
import { InfraiDnsClient, InfraiError } from "./infrai_dns.js";
import { handoffRequestSchema, planBuyerRecords } from "./handoff_plan.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const dns = new InfraiDnsClient(apiKey);

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/handoffs") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const parsed = handoffRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      sendJson(response, 400, { error: "Invalid handoff", issues: parsed.error.issues });
      return;
    }

    const input = parsed.data;
    let zone: { zone_id: string } | undefined;
    try {
      zone = await dns.getDomain(input.domain);
    } catch (error) {
      if (!(error instanceof InfraiError) || error.status !== 404) throw error;
    }
    if (!zone?.zone_id) {
      zone = await dns.addDomain({
        domain: input.domain,
        vendor: input.seller.vendor,
        account_id: input.seller.account_id,
        metadata: { order_id: input.order_id },
      }, `${input.handoff_id}:domain`);
    }

    const records = planBuyerRecords(input);
    await Promise.all(records.map((record, index) => dns.upsertRecord({
      zone_id: zone.zone_id,
      ...record,
      metadata: { order_id: input.order_id },
    }, `${input.handoff_id}:record:${index}`)));

    sendJson(response, 200, {
      handoff_id: input.handoff_id,
      order_id: input.order_id,
      domain: input.domain,
      zone_id: zone.zone_id,
      state: "buyer_dns_applied",
      records_applied: records.length,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      sendJson(response, error.status, { error: error.code, details: error.details });
      return;
    }
    sendJson(response, 502, { error: "Domain handoff could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Marketplace handoff service listening on http://localhost:${port}`));
