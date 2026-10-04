import assert from "node:assert/strict";
import test from "node:test";
import { handoffRequestSchema, planBuyerRecords } from "../src/handoff_plan.js";

test("buyer handoff points the storefront and proves ownership", () => {
  const input = handoffRequestSchema.parse({
    handoff_id: "handoff_2048",
    order_id: "order_9182",
    domain: "cedar-cart.example",
    seller: { vendor: "legacy-registrar", account_id: "seller_42" },
    buyer: {
      storefront_host: "shops.marketplace.example",
      ownership_token: "buyer-order-9182",
    },
  });

  assert.deepEqual(planBuyerRecords(input), [
    { record_type: "CNAME", name: "www", content: "shops.marketplace.example", ttl: 300 },
    { record_type: "TXT", name: "_marketplace-handoff", content: "buyer-order-9182", ttl: 300 },
  ]);
});
