/** Fixed status vocabulary so every claim on the site says how it is known. */
export const statuses = {
  shipped: 'Shipped',
  tested: 'Software tested',
  simulated: 'Simulated',
  pending: 'Hardware pending',
  manuscript: 'Manuscript in preparation',
  disclosure: 'Disclosure in progress',
  prototype: 'Prototype',
  press: 'Press coverage',
} as const;
export type Status = keyof typeof statuses;
