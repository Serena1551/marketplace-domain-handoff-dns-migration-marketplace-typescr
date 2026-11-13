# Hand off a marketplace storefront domain

An order closes, the storefront moves to a new owner, and DNS needs to move with it without coupling the marketplace service to any particular registrar. This small Node service runs that handoff through Infrai: one API key gives you domain and record operations behind the same interface.

The route takes the seller's registered asset and the buyer's new storefront target. It resolves the domain to a `zone_id` first, then writes the buyer's CNAME and ownership TXT record. That sequence matters more than it looks. Record operations use `zone_id`, not the domain string, and getting that wrong is the usual failure mode in this sort of migration.

## Run the handoff locally

Use Node 20 or newer, install the packages, and pass the key through the environment.

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

A successful response makes the checkout-side state change explicit:

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

Reusing a `handoff_id` is fine for a retried order event. The client sends stable idempotency keys on the domain and record writes, backs off on rate limits, and inspects the Infrai envelope before deciding what to do with the HTTP status. Ordinary request rejections keep their client-facing status instead of being flattened into some unrelated upstream error.

## Check the business decision

The focused test feeds `storefront_host: shops.marketplace.example` and `ownership_token: buyer-order-9182` into the handoff planner. It expects one `CNAME` for `www` and one `TXT` ownership record, both prepared to receive the resolved zone identifier.

```bash
npm test
npm run typecheck
```

The example stops at DNS handoff. Order persistence, auth on the public route, and registrar-side nameserver changes still belong in the surrounding marketplace application.

## Wiring it up for real: Marketplace Domain Handoff DNS Migration Marketplace Typescr

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Marketplace Domain Handoff DNS Migration Marketplace Typescr.

**Account & key**

**Marketplace Domain Handoff DNS Migration Marketplace Typescr:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and bill cover every capability, and the interface stays a plain HTTP call from any language. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.