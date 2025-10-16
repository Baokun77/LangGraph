// Test the ablation study framework without API calls
// This verifies the structure and logic work correctly

import { generateAgentConfigs } from './simple_ablation.mts';

// Mock evaluation functions
function evaluateSuccessStrict(response: string, expected: string, category: string): boolean {
  if (!response || response.trim().length === 0) return false;
  
  if (category === "search") return response.includes("Search results") || response.includes("weather") || response.includes("news");
  if (category === "creative") return response.length > 20 && !response.includes("I don't know");
  if (category === "error") return response.includes("error") || response.includes("Error") || response.includes("don't know");
  
  const responseLower = response.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  if (responseLower.includes(expectedLower)) return true;
  if (expectedLower.includes(" ") && responseLower.includes(expectedLower.split(" ")[0])) return true;
  
  return false;
}

function evaluateSuccessLenient(response: string, expected: string, category: string): boolean {
  if (!response || response.trim().length === 0) return false;
  
  if (category === "search") return response.includes("Search") || response.includes("weather") || response.includes("news") || response.includes("information");
  if (category === "creative") return response.length > 10 && !response.includes("I don't know");
  if (category === "error") return response.includes("error") || response.includes("Error") || response.includes("don't know") || response.includes("cannot");
  
  const responseLower = response.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  if (responseLower.includes(expectedLower)) return true;
  if (expectedLower.includes(" ") && responseLower.includes(expectedLower.split(" ")[0])) return true;
  if (expectedLower.length > 3 && responseLower.includes(expectedLower.substring(0, 3))) return true;
  
  if (category === "arithmetic") {
    const numbers = response.match(/\d+/g);
    return numbers && numbers.length > 0;
  }
  
  return false;
}

// Test tasks
const testTasks = [
  { id: 1, question: "What is the capital of France?", expected: "Paris", category: "factual" },
  { id: 2, question: "What is 15 + 27 * 3?", expected: "96", category: "arithmetic" },
  { id: 3, question: "What is the current weather in Tokyo?", expected: "weather", category: "search" },
  { id: 4, question: "If all birds can fly and penguins are birds, can penguins fly?", expected: "no", category: "reasoning" },
  { id: 5, question: "Write a haiku about programming", expected: "creative", category: "creative" }
];

// Mock responses for testing
const mockResponses = [
  "The capital of France is Paris, a beautiful city known for its art and culture.",
  "The answer is 96. Let me calculate: 15 + 27 * 3 = 15 + 81 = 96",
  "Search results: The current weather in Tokyo is sunny with a temperature of 22°C.",
  "No, penguins cannot fly. While they are birds, they have evolved to swim instead of fly.",
  "Code flows like water,\nBugs hide in the shadows deep,\nDebug brings the light."
];

async function testFramework() {
  console.log("🧪 Testing Ablation Study Framework");
  console.log("=".repeat(50));
  
  // Test 1: Generate agent configurations
  console.log("\n1️⃣ Testing agent configuration generation...");
  const configs = generateAgentConfigs();
  console.log(`✅ Generated ${configs.length} configurations:`);
  configs.forEach(config => {
    const configStr = config.config ? JSON.stringify(config.config) : "default";
    console.log(`   - ${config.agent}: ${configStr}`);
  });
  
  // Test 2: Test evaluation functions
  console.log("\n2️⃣ Testing evaluation functions...");
  testTasks.forEach((task, i) => {
    const response = mockResponses[i];
    const strict = evaluateSuccessStrict(response, task.expected, task.category);
    const lenient = evaluateSuccessLenient(response, task.expected, task.category);
    console.log(`   Task ${task.id} (${task.category}): Strict=${strict ? '✅' : '❌'}, Lenient=${lenient ? '✅' : '❌'}`);
  });
  
  // Test 3: Simulate results aggregation
  console.log("\n3️⃣ Testing results aggregation...");
  const mockResults = configs.map(config => {
    const configStr = config.config ? JSON.stringify(config.config) : "default";
    return {
      agent: `${config.agent}_${configStr}`,
      totalRuns: 30,
      successStrict: Math.random() * 0.4 + 0.3, // Random between 0.3-0.7
      successLenient: Math.random() * 0.3 + 0.6, // Random between 0.6-0.9
      avgLatency: Math.random() * 3 + 1, // Random between 1-4 seconds
      p50Latency: Math.random() * 2 + 1,
      p95Latency: Math.random() * 4 + 2,
      avgCost: Math.random() * 0.005 + 0.001,
      avgToolCalls: Math.random() * 2 + 0.5
    };
  });
  
  // Display mock results table
  console.log("\n📊 Mock Results Table:");
  console.log("| Agent | Config | Success@Strict | Success@Lenient | Avg Latency (s) | P50 Latency (s) | P95 Latency (s) | Avg Cost ($) | Avg Tool Calls |");
  console.log("|-------|--------|----------------|-----------------|-----------------|-----------------|-----------------|--------------|----------------|");
  
  mockResults.forEach(result => {
    const [agent, config] = result.agent.split('_');
    console.log(`| ${agent} | ${config} | ${(result.successStrict * 100).toFixed(1)}% | ${(result.successLenient * 100).toFixed(1)}% | ${result.avgLatency.toFixed(2)} | ${result.p50Latency.toFixed(2)} | ${result.p95Latency.toFixed(2)} | $${result.avgCost.toFixed(4)} | ${result.avgToolCalls.toFixed(1)} |`);
  });
  
  // Test 4: Find best performers
  console.log("\n4️⃣ Testing performance analysis...");
  const bestStrict = mockResults.reduce((best, current) => 
    current.successStrict > best.successStrict ? current : best
  );
  const bestLenient = mockResults.reduce((best, current) => 
    current.successLenient > best.successLenient ? current : best
  );
  const fastest = mockResults.reduce((best, current) => 
    current.avgLatency < best.avgLatency ? current : best
  );
  
  console.log(`🥇 Best Strict Success: ${bestStrict.agent} (${(bestStrict.successStrict * 100).toFixed(1)}%)`);
  console.log(`🥇 Best Lenient Success: ${bestLenient.agent} (${(bestLenient.successLenient * 100).toFixed(1)}%)`);
  console.log(`⚡ Fastest: ${fastest.agent} (${fastest.avgLatency.toFixed(2)}s avg)`);
  
  console.log("\n✅ Framework test completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Set your API keys as environment variables:");
  console.log("   export OPENAI_API_KEY='sk-your-actual-key'");
  console.log("   export TAVILY_API_KEY='tvly-your-actual-key'");
  console.log("2. Run the full ablation study:");
  console.log("   deno run --allow-net --allow-write --allow-env simple_ablation.mts");
}

testFramework().catch(console.error);
