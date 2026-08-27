/**
 * Prisma seed scaffold.
 *
 * Intentionally empty for Phase 2.
 * No merchants, risk events, playbooks, or other business data
 * are seeded at this stage. Future phases will populate this file
 * with the seeding logic they require.
 */

async function main(): Promise<void> {
  // No seeding logic in Phase 2.
}

main()
  .then(() => {
    console.log("Seed scaffold ran (no-op).");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });