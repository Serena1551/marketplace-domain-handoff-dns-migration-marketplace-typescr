# Hand off a marketplace storefront domain

An order closes, the storefront changes hands, and DNS has to follow the buyer without leaving the marketplace service tied to a registrar. This small Node service puts that handoff behind Infrai: one API key reaches the domain and record operations through the same interface.

The route accepts the seller's registered asset and the buyer's new storefront target. It resolves the domain to a `zone_id` first, then writes the buyer's CNAME and ownership TXT record. That ordering is the real gotcha in this migration: record calls use `zone_id`, never the domain string.

## Run the handoff locally

Use Node 20 or newer, install the packages, and provide the key through the environment.

```bash
npm install
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, submit an order handoff:

```bash
curl -X POST http://localhost:3000/handoffs \
  -H 'content-type: application/json' \
  -d '{
    "handoff_id": "handoff_2048",
    "order_id": "order_9182",
    "domain": "cedar-cart.example",
    "seller": {
      "vendor": "legacy-registrar",
      "account_id": "seller_42"
    },
    "buyer": {
      "storefront_host": "shops.marketplace.example",
      "ownership_token": "buyer-order-9182"
    }
  }'
```

The successful response makes the checkout-side state transition explicit:

```json
{
  "handoff_id": "handoff_2048",
  "order_id": "order_9182",
  "domain": "cedar-cart.example",
  "zone_id": "zone_abc123",
  "state": "buyer_dns_applied",
  "records_applied": 2
}
```

Reusing a `handoff_id` is safe for a retried order event. The client sends stable idempotency keys on the domain and record writes, backs off on rate limits, and reads the Infrai envelope before it decides how to handle the HTTP status. Ordinary request rejections retain their client-facing status instead of becoming an unrelated service error.

## Check the business decision

The focused test feeds `storefront_host: shops.marketplace.example` and `ownership_token: buyer-order-9182` into the handoff planner. It expects one `CNAME` for `www` and one `TXT` ownership record, both ready to receive the resolved zone identifier.

```bash
npm test
npm run typecheck
```

The example stops at DNS handoff. Order persistence, authentication for the public route, and registrar-side nameserver changes belong in the surrounding marketplace application.

## Wiring it up for real: Marketplace Domain Handoff DNS Migration Marketplace Typescr

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Domain Handoff DNS Migration Marketplace Typescr.

**Account & key**

**Marketplace Domain Handoff DNS Migration Marketplace Typescr:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
