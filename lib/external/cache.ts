// Caché con vencimiento y limitador de solicitudes.
//
// Dos objetivos: no repetir consultas al mismo dominio en segundos (cortesía
// con los registros públicos, que son gratuitos y no nos deben nada) y poner
// un techo duro a cuántas consultas puede disparar una sesión.
//
// El reloj se inyecta para poder probar vencimientos sin esperar.

export type Clock = () => number;

export type CacheEntry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  // Campos explícitos: las propiedades de parámetro de TypeScript no funcionan
  // con el modo «strip-only» de Node que usan las pruebas.
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly clock: Clock;

  constructor(ttlMs: number, maxEntries = 500, clock: Clock = () => Date.now()) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.clock = clock;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.clock()) {
      this.store.delete(key);
      return null;
    }
    // Reinserta para que el orden del Map refleje el uso reciente.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: this.clock() + this.ttlMs });
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Ventana deslizante: N solicitudes por clave en un intervalo. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;

  constructor(limit: number, windowMs: number, clock: Clock = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  /** `true` si la solicitud cabe en la ventana; la registra en ese caso. */
  tryAcquire(key: string): boolean {
    const now = this.clock();
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  remaining(key: string): number {
    const since = this.clock() - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > since);
    return Math.max(0, this.limit - recent.length);
  }

  clear(): void {
    this.hits.clear();
  }
}
