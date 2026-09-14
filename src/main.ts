import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import { randomUUID } from "node:crypto";
import { renderTicket, type TicketPayload } from "./escpos";
import { loadState, saveState, type AppState, type PrinterProfile } from "./storage";
import { sendTcp } from "./transport";
import { dispatchJob } from "./dispatch";
import { assertSecureStorage } from "./storage";
import { z } from "zod";

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let state: AppState = { profiles: [] };
let polling = false;

function createWindow() {
  window = new BrowserWindow({
    width: 720,
    height: 600,
    webPreferences: { preload: `${__dirname}/preload.js`, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.loadFile(`${__dirname}/renderer/index.html`);
  window.on("close", (event) => { if (tray) { event.preventDefault(); window?.hide(); } });
}

const profileSchema = z.object({ id: z.string(), name: z.string().trim().min(1).max(120), host: z.string().trim().min(1).max(253), port: z.number().int().min(1).max(65535).default(9100), paperWidth: z.union([z.literal(58), z.literal(80)]), enabled: z.boolean(), destinationLabel: z.string().trim().max(120).optional() }).strict();
const apiSchema = z.string().url().refine((value) => { const url = new URL(value); return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)); }, "HTTPS is required except localhost.");
const jobSchema = z.object({ job: z.object({ id: z.string().uuid(), attemptNumber: z.number().int().positive(), payload: z.object({ orderId: z.string() }).passthrough() }) }).strict();
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); } }

async function poll() {
  if (polling || !state.token || !state.apiUrl) return;
  polling = true;
  try {
    const response = await fetchWithTimeout(`${state.apiUrl}/api/v1/print/jobs/claim`, { method: "POST", headers: { Authorization: `Bearer ${state.token}` } });
    if (response.status === 204 || !response.ok) return;
    const job = jobSchema.parse(await response.json()) as { job: { id: string; attemptNumber: number; payload: TicketPayload } };
    const printed = await dispatchJob(state.profiles, job.job.payload, (profile, bytes) => sendTcp(profile.host, profile.port, bytes));
    const result = await fetchWithTimeout(`${state.apiUrl}/api/v1/print/jobs/${job.job.id}/result`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json", "Idempotency-Key": `desktop:${job.job.id}:${job.job.attemptNumber}` },
      body: JSON.stringify({ status: printed ? "printed" : "failed", attemptNumber: job.job.attemptNumber, errorCode: printed ? undefined : "printer_failed" }),
    });
    if (!result.ok) throw new Error("RESULT_REPORT_FAILED");
  } finally { polling = false; }
}

app.whenReady().then(async () => {
  state = await loadState();
  app.setLoginItemSettings({ openAtLogin: true });
  tray = new Tray(nativeImage.createEmpty());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Komanda Desktop", click: () => window?.show() },
    { label: "Quit", click: () => app.quit() },
  ]));
  createWindow();
  ipcMain.handle("state", () => ({ paired: Boolean(state.token), profiles: state.profiles }));
  ipcMain.handle("pair", async (_event, apiUrl: unknown, code: unknown, name: unknown) => {
    assertSecureStorage();
    const safeApiUrl = apiSchema.parse(apiUrl);
    const safeCode = z.string().regex(/^\d{4}$/).parse(code);
    const safeName = z.string().trim().min(1).max(120).parse(name);
    const response = await fetchWithTimeout(`${safeApiUrl}/api/v1/print/pair`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: safeCode, name: safeName }) });
    if (!response.ok) throw new Error("PAIRING_FAILED");
    const body = z.object({ token: z.string().regex(/^kp_[a-f0-9]{16}_.+$/) }).passthrough().parse(await response.json());
    state = { ...state, token: body.token, apiUrl: safeApiUrl };
    await saveState(state);
  });
  ipcMain.handle("profiles", async (_event, profiles: unknown) => {
    const parsed = z.array(profileSchema).max(100).parse(profiles);
    state = { ...state, profiles: parsed.map((profile) => ({ ...profile, id: profile.id || randomUUID() })) };
    await saveState(state);
    return state.profiles;
  });
  ipcMain.handle("test-printer", (_event, profile: unknown) => { const parsed = profileSchema.parse(profile); return sendTcp(parsed.host, parsed.port, renderTicket({ orderId: "TEST", tenant: "Komanda Desktop", summary: { total: 0 } }, parsed.paperWidth)); });
  setInterval(() => { void poll().catch(() => undefined); }, 5000);
});
