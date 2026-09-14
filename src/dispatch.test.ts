import { describe, expect, it, vi } from "vitest";
import { dispatchJob } from "./dispatch";
import type { PrinterProfile } from "./storage";

const profile = (id: string, destinationLabel?: string): PrinterProfile => ({ id, name: id, host: "printer", port: 9100, paperWidth: 58, enabled: true, destinationLabel });
describe("printer dispatch policy", () => {
  it("targets matching destination labels and isolates failures", async () => {
    const send = vi.fn(async (printer: PrinterProfile) => { if (printer.id === "offline") throw new Error("offline"); });
    const printed = await dispatchJob([profile("kitchen", "kitchen"), profile("counter", "counter"), profile("offline", "kitchen")], { orderId: "1", destinationLabel: "kitchen" }, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(printed).toBe(false);
  });
  it("uses all enabled profiles when the payload has no destination", async () => {
    const send = vi.fn(async () => undefined);
    expect(await dispatchJob([profile("one"), profile("two")], { orderId: "1" }, send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
