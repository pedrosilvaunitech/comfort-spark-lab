/**
 * Local device printer configuration
 * Stored in localStorage — configured per device, not on the server
 */

const STORAGE_KEY = "unitech_local_printer";

export interface LocalPrinterConfig {
  paired: boolean;
  deviceName: string;
  vendorId: number;
  productId: number;
  autoCut: boolean;
  paperSize: "58mm" | "80mm";
  printName: boolean;
  printCpf: boolean;
  pairedAt: string;
}

const defaultConfig: LocalPrinterConfig = {
  paired: false,
  deviceName: "PT80KM POS80 Thermal Kiosk Printer",
  vendorId: 1155,   // 0x0483
  productId: 30016,  // 0x7540
  autoCut: true,
  paperSize: "80mm",
  printName: true,
  printCpf: false,
  pairedAt: "",
};

export function getLocalPrinterConfig(): LocalPrinterConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return { ...defaultConfig };
}

export function saveLocalPrinterConfig(config: Partial<LocalPrinterConfig>): LocalPrinterConfig {
  const current = getLocalPrinterConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearLocalPrinterConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLocalPrinterPaired(): boolean {
  return getLocalPrinterConfig().paired;
}
