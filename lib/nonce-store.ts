const NONCE_TTL = 5 * 60 * 1000; // 5 minutes

interface NonceEntry {
  nonce: string;
  createdAt: number;
}

class NonceStore {
  private store = new Map<string, NonceEntry>();

  constructor() {
    // Cleanup old nonces periodically
    setInterval(() => {
      const now = Date.now();
      this.store.forEach((value, key) => {
        if (now - value.createdAt > NONCE_TTL) {
          this.store.delete(key);
        }
      });
    }, 60_000);
  }

  set(key: string, nonce: string) {
    this.store.set(key, { nonce, createdAt: Date.now() });
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > NONCE_TTL) {
      this.store.delete(key);
      return null;
    }
    return entry.nonce;
  }

  consume(key: string): string | null {
    const nonce = this.get(key);
    if (nonce) this.store.delete(key);
    return nonce;
  }
}

export const nonceStore = new NonceStore();
