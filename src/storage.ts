import { app, safeStorage } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export type PrinterProfile = { id: string; name: string; host: string; port: number; paperWidth: 58 | 80; enabled: boolean; destinationLabel?: string };
export type AppState = { token?: string; apiUrl?: string; profiles: PrinterProfile[] };
export type PrintJournalEntry = {
  jobId: string;
  attemptNumber: number;
  status: "printed" | "failed" | "uncertain" | "pending_ack";
  destinationResults: Record<string, "printed" | "failed" | "uncertain">;
  timestamp: number;
};
export class SecureStorageUnavailableError extends Error { constructor() { super("OS-protected storage is required before pairing."); } }
const file = () => join(app.getPath("userData"), "state.bin");
const journalFile = () => join(app.getPath("userData"), "journal.json");
export function assertSecureStorage() { if (!safeStorage.isEncryptionAvailable()) throw new SecureStorageUnavailableError(); }
export async function loadState(): Promise<AppState> { try { const raw = await readFile(file()); if (!safeStorage.isEncryptionAvailable()) return { profiles: [] }; return JSON.parse(safeStorage.decryptString(raw)) as AppState; } catch (error) { if (error instanceof SecureStorageUnavailableError) throw error; return { profiles: [] }; } }
export async function saveState(state: AppState) { if (state.token) assertSecureStorage(); const text = JSON.stringify(state); const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(JSON.stringify({ profiles: state.profiles })); await writeFile(file(), data, { mode: 0o600 }); }
export async function loadJournal(): Promise<Record<string, PrintJournalEntry>> {
  try {
    const raw = await readFile(journalFile(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
export async function saveJournal(journal: Record<string, PrintJournalEntry>): Promise<void> {
  try {
    await writeFile(journalFile(), JSON.stringify(journal, null, 2), { mode: 0o600 });
  } catch {}
}
