// Test script for the ablation study framework
// Runs a small subset to verify everything works

import { runSingleEvaluation, generateAgentConfigs } from './ablation_study.mts';

// Test task
const testTask = {
  id: 1,
  question: "What is the capital of France?",
  expected: "Paris",
  category: "factual"
};

// Test configurations
const testConfigs = [
  { agent: 'react' as const },
  { agent: 'tot' as const, config: { width: 2, depth: 2 } },
  { agent: 'reflect' as const, config: { reflectionRounds: 1 } }
];

async function runTest() {
  console.log("🧪 Testing Ablation Study Framework");
  console.log("=".repeat(40));
  
  for (const config of testConfigs) {
    console.log(`\n🔧 Testing ${config.agent} configuration...`);
    
    try {
      const result = await runSingleEvaluation(config, testTask, 1);
      console.log(`✅ Success: ${result.successStrict} (strict), ${result.successLenient} (lenient)`);
      console.log(`⏱️  Latency: ${result.latency.toFixed(2)}s`);
      console.log(`💰 Cost: $${result.cost.toFixed(4)}`);
      console.log(`🔧 Tool Calls: ${result.toolCalls}`);
      console.log(`📝 Response: ${result.response.substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }
  
  console.log("\n✅ Test completed!");
}

runTest().catch(console.error);
