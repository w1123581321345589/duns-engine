import { seedDemoData } from "./lib/demo-data";

async function seed() {
  console.log("Seeding database...");
  const result = await seedDemoData((msg) => console.log(msg));
  console.log(
    `Seed complete. ${result.cases_seeded} cases, ${result.quota_seeded} quota rows.`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
