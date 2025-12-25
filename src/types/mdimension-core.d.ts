declare module 'mdimension-core' {
  /**
   * Initialize the WASM module
   */
  export default function init(): Promise<void>;

  /**
   * Initialize panic hook for better error logging
   */
  export function start(): void;

  /**
   * Log a greeting to the console
   */
  export function greet(name: string): void;

  /**
   * Add two numbers (sanity check)
   */
  export function add_wasm(a: number, b: number): number;
}
