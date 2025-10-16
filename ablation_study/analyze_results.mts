// Results analysis script for the ablation study
// Usage: deno run --allow-read analyze_results.mts <results_directory>

import { promises as fs } from 'node:fs';
import path from 'node:path';

interface EvaluationResult {
  taskId: number;
  agent: string;
  config: string;
  successStrict: boolean;
  successLenient: boolean;
  latency: number;
  cost: number;
  toolCalls: number;
  response: string;
  error?: string;
  timestamp: string;
}

interface AggregatedResult {
  agent: string;
  totalRuns: number;
  successStrict: number;
  successLenient: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  avgCost: number;
  avgToolCalls: number;
}

async function analyzeResults(resultsDir: string) {
  console.log(`📊 Analyzing results from: ${resultsDir}`);
  
  // Read all JSONL files
  const files = await fs.readdir(resultsDir);
  const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
  
  console.log(`📁 Found ${jsonlFiles.length} result files`);
  
  const allResults: EvaluationResult[] = [];
  
  for (const file of jsonlFiles) {
    const filepath = path.join(resultsDir, file);
    const content = await fs.readFile(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const result = JSON.parse(line) as EvaluationResult;
          allResults.push(result);
        } catch (error) {
          console.warn(`⚠️  Failed to parse line in ${file}: ${error}`);
        }
      }
    }
  }
  
  console.log(`📊 Total results loaded: ${allResults.length}`);
  
  // Group by agent and config
  const grouped = allResults.reduce((acc, result) => {
    const key = `${result.agent}_${result.config}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as Record<string, EvaluationResult[]>);
  
  // Calculate aggregated metrics
  const aggregated: AggregatedResult[] = Object.entries(grouped).map(([key, results]) => {
    const latencies = results.map(r => r.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    
    return {
      agent: key,
      totalRuns: results.length,
      successStrict: results.filter(r => r.successStrict).length / results.length,
      successLenient: results.filter(r => r.successLenient).length / results.length,
      avgLatency: results.reduce((sum, r) => sum + r.latency, 0) / results.length,
      p50Latency: p50,
      p95Latency: p95,
      avgCost: results.reduce((sum, r) => sum + r.cost, 0) / results.length,
      avgToolCalls: results.reduce((sum, r) => sum + r.toolCalls, 0) / results.length
    };
  });
  
  // Sort by success rate (strict)
  aggregated.sort((a, b) => b.successStrict - a.successStrict);
  
  // Generate analysis report
  generateAnalysisReport(aggregated, allResults);
  
  // Save detailed analysis
  const analysisPath = path.join(resultsDir, 'detailed_analysis.json');
  await fs.writeFile(analysisPath, JSON.stringify({
    summary: aggregated,
    totalResults: allResults.length,
    analysisDate: new Date().toISOString()
  }, null, 2));
  
  console.log(`💾 Detailed analysis saved to: ${analysisPath}`);
}

function generateAnalysisReport(aggregated: AggregatedResult[], allResults: EvaluationResult[]) {
  console.log("\n📊 ABLATION STUDY ANALYSIS");
  console.log("=".repeat(60));
  
  // Performance ranking
  console.log("\n🏆 PERFORMANCE RANKING (by Success@Strict)");
  console.log("-".repeat(50));
  aggregated.forEach((result, index) => {
    const [agent, config] = result.agent.split('_');
    console.log(`${index + 1}. ${agent} (${config}): ${(result.successStrict * 100).toFixed(1)}% strict, ${(result.successLenient * 100).toFixed(1)}% lenient`);
  });
  
  // Best performers
  console.log("\n🎯 BEST PERFORMERS");
  console.log("-".repeat(30));
  
  const bestStrict = aggregated[0];
  const bestLenient = aggregated.reduce((best, current) => 
    current.successLenient > best.successLenient ? current : best
  );
  const fastest = aggregated.reduce((best, current) => 
    current.avgLatency < best.avgLatency ? current : best
  );
  const cheapest = aggregated.reduce((best, current) => 
    current.avgCost < best.avgCost ? current : best
  );
  
  console.log(`🥇 Best Strict Success: ${bestStrict.agent} (${(bestStrict.successStrict * 100).toFixed(1)}%)`);
  console.log(`🥇 Best Lenient Success: ${bestLenient.agent} (${(bestLenient.successLenient * 100).toFixed(1)}%)`);
  console.log(`⚡ Fastest: ${fastest.agent} (${fastest.avgLatency.toFixed(2)}s avg)`);
  console.log(`💰 Cheapest: ${cheapest.agent} ($${cheapest.avgCost.toFixed(4)} avg)`);
  
  // ToT analysis
  console.log("\n🌳 ToT ABLATION ANALYSIS");
  console.log("-".repeat(30));
  const totResults = aggregated.filter(r => r.agent.startsWith('tot_'));
  if (totResults.length > 0) {
    console.log("Width (B) Analysis:");
    const widthGroups = totResults.reduce((acc, result) => {
      const match = result.agent.match(/B(\d+)/);
      if (match) {
        const width = match[1];
        if (!acc[width]) acc[width] = [];
        acc[width].push(result);
      }
      return acc;
    }, {} as Record<string, AggregatedResult[]>);
    
    Object.entries(widthGroups).forEach(([width, results]) => {
      const avgSuccess = results.reduce((sum, r) => sum + r.successStrict, 0) / results.length;
      console.log(`  B=${width}: ${(avgSuccess * 100).toFixed(1)}% avg success`);
    });
    
    console.log("Depth (D) Analysis:");
    const depthGroups = totResults.reduce((acc, result) => {
      const match = result.agent.match(/D(\d+)/);
      if (match) {
        const depth = match[1];
        if (!acc[depth]) acc[depth] = [];
        acc[depth].push(result);
      }
      return acc;
    }, {} as Record<string, AggregatedResult[]>);
    
    Object.entries(depthGroups).forEach(([depth, results]) => {
      const avgSuccess = results.reduce((sum, r) => sum + r.successStrict, 0) / results.length;
      console.log(`  D=${depth}: ${(avgSuccess * 100).toFixed(1)}% avg success`);
    });
  }
  
  // Reflect analysis
  console.log("\n🔄 REFLECT ABLATION ANALYSIS");
  console.log("-".repeat(30));
  const reflectResults = aggregated.filter(r => r.agent.startsWith('reflect_'));
  if (reflectResults.length > 0) {
    reflectResults.forEach(result => {
      const match = result.agent.match(/R(\d+)/);
      if (match) {
        const rounds = match[1];
        console.log(`R=${rounds}: ${(result.successStrict * 100).toFixed(1)}% strict, ${(result.successLenient * 100).toFixed(1)}% lenient`);
      }
    });
  }
  
  // Cost-effectiveness analysis
  console.log("\n💰 COST-EFFECTIVENESS ANALYSIS");
  console.log("-".repeat(30));
  const costEffective = aggregated.map(result => ({
    ...result,
    costPerSuccess: result.avgCost / result.successStrict
  })).sort((a, b) => a.costPerSuccess - b.costPerSuccess);
  
  costEffective.slice(0, 3).forEach((result, index) => {
    console.log(`${index + 1}. ${result.agent}: $${result.costPerSuccess.toFixed(4)} per success`);
  });
  
  // Error analysis
  console.log("\n❌ ERROR ANALYSIS");
  console.log("-".repeat(20));
  const errorResults = allResults.filter(r => r.error);
  console.log(`Total errors: ${errorResults.length} (${(errorResults.length / allResults.length * 100).toFixed(1)}%)`);
  
  const errorByAgent = errorResults.reduce((acc, result) => {
    acc[result.agent] = (acc[result.agent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(errorByAgent).forEach(([agent, count]) => {
    const totalForAgent = allResults.filter(r => r.agent === agent).length;
    console.log(`${agent}: ${count} errors (${(count / totalForAgent * 100).toFixed(1)}%)`);
  });
}

// Main execution
async function main() {
  const resultsDir = Deno.args[0] || 'runs';
  
  try {
    await analyzeResults(resultsDir);
  } catch (error) {
    console.error("❌ Analysis failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
