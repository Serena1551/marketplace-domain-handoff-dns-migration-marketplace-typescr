import { z } from "zod";

export const handoffRequestSchema = z.object({
  handoff_id: z.string().min(1),
  order_id: z.string().min(1),
  domain: z.string().min(1),
  seller: z.object({
    vendor: z.string().min(1),
    account_id: z.string().min(1),
  }),
  buyer: z.object({
    storefront_host: z.string().min(1),
    ownership_token: z.string().min(1),
  }),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type PlannedRecord = {
  record_type: "CNAME" | "TXT";
  name: string;
  content: string;
  ttl: number;
};

export function planBuyerRecords(input: HandoffRequest): PlannedRecord[] {
  return [
    {
      record_type: "CNAME",
      name: "www",
      content: input.buyer.storefront_host,
      ttl: 300,
    },
    {
      record_type: "TXT",
      name: "_marketplace-handoff",
      content: input.buyer.ownership_token,
      ttl: 300,
    },
  ];
}
