import { app, safeStorage } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export type PrinterProfile = { id: string; name: string; host: string; port: number; paperWidth: 58 | 80; enabled: boolean; destinationLabel?: string };
export type AppState = { token?: string; apiUrl?: string; profiles: PrinterProfile[] };
export class SecureStorageUnavailableError extends Error { constructor() { super("OS-protected storage is required before pairing."); } }
const file = () => join(app.getPath("userData"), "state.bin");
export function assertSecureStorage() { if (!safeStorage.isEncryptionAvailable()) throw new SecureStorageUnavailableError(); }
export async function loadState(): Promise<AppState> { try { const raw = await readFile(file()); if (!safeStorage.isEncryptionAvailable()) return { profiles: [] }; return JSON.parse(safeStorage.decryptString(raw)) as AppState; } catch (error) { if (error instanceof SecureStorageUnavailableError) throw error; return { profiles: [] }; } }
export async function saveState(state: AppState) { if (state.token) assertSecureStorage(); const text = JSON.stringify(state); const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(JSON.stringify({ profiles: state.profiles })); await writeFile(file(), data, { mode: 0o600 }); }
