declare module 'pg' {
    export class Pool {
        constructor(config?: Record<string, unknown>);
        query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
        connect(): Promise<PoolClient>;
        on(event: string, listener: (err: Error) => void): this;
        end(): Promise<void>;
    }
    export class Client {
        constructor(config?: Record<string, unknown>);
        connect(): Promise<void>;
        query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
        end(): Promise<void>;
    }
    export type PoolClient = {
        query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
        release(): void;
    };
    export const types: {
        builtins: { NUMERIC: number; INT8: number };
        setTypeParser(oid: number, parser: (value: string) => unknown): void;
    };
}
