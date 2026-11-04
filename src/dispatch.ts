import type { PrinterProfile } from "./storage";
import type { TicketPayload } from "./escpos";
import { renderTicket } from "./escpos";
export function profilesForJob(profiles: PrinterProfile[], payload: TicketPayload) { const enabled = profiles.filter((profile) => profile.enabled); return payload.destinationLabel ? enabled.filter((profile) => profile.destinationLabel === payload.destinationLabel) : enabled; }
export async function dispatchJob(profiles: PrinterProfile[], payload: TicketPayload, send: (profile: PrinterProfile, bytes: Uint8Array) => Promise<void>) { const selected = profilesForJob(profiles, payload); const results = await Promise.all(selected.map(async (profile) => { try { await send(profile, renderTicket(payload, profile.paperWidth)); return true; } catch { return false; } })); return selected.length > 0 && results.every(Boolean); }
export async function dispatchJobWithJournal(
  profiles: PrinterProfile[],
  payload: TicketPayload,
  send: (profile: PrinterProfile, bytes: Uint8Array) => Promise<void>,
  alreadyPrintedProfileIds: Set<string> = new Set()
): Promise<{
  allSucceeded: boolean;
  destinationResults: Record<string, "printed" | "failed" | "uncertain">;
}> {
  const selected = profilesForJob(profiles, payload);
  const destinationResults: Record<string, "printed" | "failed" | "uncertain"> = {};
  for (const profile of selected) {
    if (alreadyPrintedProfileIds.has(profile.id)) {
      destinationResults[profile.id] = "printed";
      continue;
    }
    try {
      await send(profile, renderTicket(payload, profile.paperWidth));
      destinationResults[profile.id] = "printed";
    } catch {
      destinationResults[profile.id] = "uncertain";
    }
  }
  const allSucceeded = selected.length > 0 && Object.values(destinationResults).every((s) => s === "printed");
  return { allSucceeded, destinationResults };
}
