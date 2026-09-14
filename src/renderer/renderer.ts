export {};

type PrinterProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  paperWidth: 58 | 80;
  enabled: boolean;
};

declare global {
  interface Window {
    komanda: {
      state(): Promise<{ paired: boolean; profiles: PrinterProfile[] }>;
      pair(apiUrl: string, code: string, name: string): Promise<void>;
      saveProfiles(profiles: PrinterProfile[]): Promise<PrinterProfile[]>;
      testPrinter(profile: PrinterProfile): Promise<void>;
    };
  }
}

const root = document.querySelector("#root")!;
root.innerHTML = `
  <h1>Komanda Desktop</h1>
  <p id="status">Loading...</p>
  <label>API URL <input id="api" value="http://localhost:3000"></label>
  <label>Pairing code <input id="code" inputmode="numeric" maxlength="4"></label>
  <label>Agent name <input id="name" value="Komanda Desktop"></label>
  <button id="pair">Pair</button>
  <h2>Printer profile</h2>
  <label>Name <input id="printer-name" value="Kitchen"></label>
  <label>Host <input id="host"></label>
  <label>Port <input id="port" type="number" value="9100"></label>
  <label>Width <select id="width"><option value="58">58mm</option><option value="80">80mm</option></select></label>
  <button id="save">Save profile</button>
  <button id="test">Test print</button>
  <p>Network printers use TCP port 9100. The agent token never enters the renderer.</p>`;

const statusNode = document.querySelector("#status")!;
let profiles: PrinterProfile[] = [];
const input = (id: string) => document.querySelector(`#${id}`) as HTMLInputElement;
const profile = (): PrinterProfile => ({
  id: "",
  name: input("printer-name").value,
  host: input("host").value,
  port: Number(input("port").value) || 9100,
  paperWidth: Number((document.querySelector("#width") as HTMLSelectElement).value) as 58 | 80,
  enabled: true,
});

document.querySelector("#pair")!.addEventListener("click", async () => {
  try {
    await window.komanda.pair(input("api").value, input("code").value, input("name").value);
    statusNode.textContent = "Paired. Token is stored securely.";
  } catch { statusNode.textContent = "Pairing failed."; }
});
document.querySelector("#save")!.addEventListener("click", async () => {
  profiles = await window.komanda.saveProfiles([...profiles, profile()]);
  statusNode.textContent = `${profiles.length} printer profile(s) saved.`;
});
document.querySelector("#test")!.addEventListener("click", async () => {
  try { await window.komanda.testPrinter(profile()); statusNode.textContent = "Test print sent."; }
  catch { statusNode.textContent = "Printer test failed or timed out."; }
});
window.komanda.state().then((value) => { profiles = value.profiles; statusNode.textContent = value.paired ? "Paired and running." : "Not paired."; });
