import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { sendTcp } from "./transport";

describe("TCP printer transport", () => {
  let server: ReturnType<typeof createServer> | undefined;
  afterEach(() => server?.close());
  it("bounds a printer that accepts but never closes", async () => {
    server = createServer(() => undefined);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    await expect(sendTcp("127.0.0.1", typeof address === "object" && address ? address.port : 0, new Uint8Array([1]), 20)).rejects.toThrow("PRINTER_TIMEOUT");
  });
  it("rejects connection errors", async () => {
    await expect(sendTcp("127.0.0.1", 1, new Uint8Array([1]), 100)).rejects.toBeInstanceOf(Error);
  });
});
