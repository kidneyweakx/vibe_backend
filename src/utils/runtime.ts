/**
 * Runtime environment detection utilities
 */

export enum RuntimeEnvironment {
  LOCAL = 'local',
  CLOUDFLARE = 'cloudflare',
  UNKNOWN = 'unknown'
}

/**
 * Detect current runtime environment
 */
export function detectRuntime(): RuntimeEnvironment {
  // Cloudflare Workers specific globals
  if (typeof globalThis !== 'undefined') {
    // Check for Cloudflare Workers environment
    if ('__ENV' in globalThis && (globalThis as any).__ENV) {
      return RuntimeEnvironment.CLOUDFLARE
    }
  }

  // Check for Bun runtime (local development)
  if (typeof process !== 'undefined' && process.versions?.bun) {
    return RuntimeEnvironment.LOCAL
  }

  return RuntimeEnvironment.UNKNOWN
}

/**
 * Check if running in local environment
 */
export function isLocal(): boolean {
  return detectRuntime() === RuntimeEnvironment.LOCAL
}

/**
 * Check if running in Cloudflare Workers
 */
export function isCloudflare(): boolean {
  return detectRuntime() === RuntimeEnvironment.CLOUDFLARE
}
