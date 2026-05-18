export interface ApiKeyConfig {
  key: string;
  provider: string;
  baseUrl: string;
  model: string;
}

export class ApiKeyManager {
  private static readonly STORAGE_KEY = 'musicagent_api_config';
  private static readonly ENCRYPTION_MARKER = 'enc_v1:';

  private config: ApiKeyConfig | null = null;

  loadFromStorage(): boolean {
    try {
      const raw = localStorage.getItem(ApiKeyManager.STORAGE_KEY);
      if (!raw) return false;

      if (raw.startsWith(ApiKeyManager.ENCRYPTION_MARKER)) {
        const encrypted = raw.slice(ApiKeyManager.ENCRYPTION_MARKER.length);
        const decoded = this.decodeConfig(encrypted);
        this.config = decoded;
        return true;
      }

      const plain: ApiKeyConfig = JSON.parse(raw);
      this.config = plain;
      this.saveToStorage(plain);
      return true;
    } catch {
      return false;
    }
  }

  saveToStorage(config: ApiKeyConfig): void {
    try {
      const encoded = this.encodeConfig(config);
      localStorage.setItem(
        ApiKeyManager.STORAGE_KEY,
        ApiKeyManager.ENCRYPTION_MARKER + encoded
      );
      this.config = config;
    } catch {
      // ignore storage errors
    }
  }

  getConfig(): ApiKeyConfig | null {
    if (!this.config) {
      this.loadFromStorage();
    }
    return this.config;
  }

  getApiKey(): string {
    return this.config?.key ?? '';
  }

  isConfigured(): boolean {
    return !!this.getConfig()?.key;
  }

  clear(): void {
    try {
      localStorage.removeItem(ApiKeyManager.STORAGE_KEY);
    } catch {
      // ignore
    }
    this.config = null;
  }

  private encodeConfig(config: ApiKeyConfig): string {
    const json = JSON.stringify(config);
    const bytes = new TextEncoder().encode(json);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.split('').reverse().join('');
  }

  private decodeConfig(encoded: string): ApiKeyConfig {
    const reversed = encoded.split('').reverse().join('');
    const binary = atob(reversed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }
}

export const apiKeyManager = new ApiKeyManager();
