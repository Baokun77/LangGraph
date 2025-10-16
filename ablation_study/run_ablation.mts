// Simple runner script for the ablation study
// Usage: deno run --allow-net --allow-write run_ablation.mts

import { runAblationStudy } from './ablation_study.mts';

console.log("🚀 Starting Ablation Study Runner");
console.log("=".repeat(50));

try {
  const results = await runAblationStudy();
  console.log(`\n✅ Study completed with ${results.length} total evaluations`);
} catch (error) {
  console.error("❌ Ablation study failed:", error);
  process.exit(1);
}
