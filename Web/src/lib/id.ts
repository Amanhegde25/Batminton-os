/**
 * Compact CUID-like ID generator.
 * Replaces Prisma's @default(cuid()) for MongoDB documents.
 */

let counter = 0;

export function cuid(): string {
  const timestamp = Date.now().toString(36);
  const count = (counter++).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  const pid = (typeof process !== "undefined" ? process.pid : 0).toString(36);
  return `c${timestamp}${pid}${count}${random}`;
}
