import { describe, expect, it } from "vitest";
import { renderTicket } from "./escpos";

describe("ESC/POS ticket renderer", () => {
  it("renders the canonical order labels and cut command", () => {
    const output = new TextDecoder().decode(renderTicket({ orderId: "order-1", purchaseNumber: "7", source: "admin_direct", customer: { name: "Ada" }, items: [{ name: "Burger", quantity: 1, options: [{ name: "Extra queso" }], lineTotal: "1000" }], summary: { total: "1000" } }));
    expect(output).toContain("Compra #7");
    expect(output).toContain("Extra queso");
    expect(output).toContain("\x1dV\x00");
  });
});
