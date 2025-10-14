// Script to view observability data in a readable format
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function viewObservabilityData() {
  const csvPath = join('traces', 'observability.csv');
  
  if (!existsSync(csvPath)) {
    console.log('❌ No observability data found. Run a test first.');
    return;
  }
  
  console.log('📊 Observability Data Summary');
  console.log('='.repeat(60));
  
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  
  if (lines.length <= 1) {
    console.log('📝 No data entries found.');
    return;
  }
  
  const headers = lines[0].split(',');
  const dataLines = lines.slice(1);
  
  console.log(`\n📈 Total Executions: ${dataLines.length}`);
  
  // Group by run_id
  const runs: { [key: string]: any[] } = {};
  dataLines.forEach(line => {
    const values = line.split(',');
    const runId = values[0];
    if (!runs[runId]) runs[runId] = [];
    runs[runId].push(values);
  });
  
  console.log(`🆔 Total Runs: ${Object.keys(runs).length}`);
  
  // Display each run
  Object.entries(runs).forEach(([runId, steps], runIndex) => {
    console.log(`\n🔄 Run ${runIndex + 1}: ${runId.substring(0, 8)}...`);
    console.log('-'.repeat(50));
    
    let totalCost = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    
    steps.forEach((step, stepIndex) => {
      const stepIdx = step[2];
      const nodeName = step[3];
      const latency = parseFloat(step[7]) || 0;
      const promptTokens = parseInt(step[8]) || 0;
      const completionTokens = parseInt(step[9]) || 0;
      const cost = parseFloat(step[10]) || 0;
      const timestamp = step[12];
      
      totalCost += cost;
      totalTokens += promptTokens + completionTokens;
      totalLatency += latency;
      
      console.log(`  Step ${stepIdx}: ${nodeName}`);
      console.log(`    ⏱️  Latency: ${latency}ms`);
      console.log(`    🎯 Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${promptTokens + completionTokens} total`);
      console.log(`    💰 Cost: $${cost.toFixed(6)}`);
      console.log(`    🕐 Time: ${new Date(timestamp).toLocaleTimeString()}`);
      console.log('');
    });
    
    console.log(`📊 Run Summary:`);
    console.log(`  💰 Total Cost: $${totalCost.toFixed(6)}`);
    console.log(`  🎯 Total Tokens: ${totalTokens}`);
    console.log(`  ⏱️  Total Latency: ${totalLatency}ms`);
    console.log(`  📈 Average Latency: ${(totalLatency / steps.length).toFixed(1)}ms per step`);
  });
  
  // Overall summary
  const allSteps = dataLines.map(line => line.split(','));
  const totalCost = allSteps.reduce((sum, step) => sum + (parseFloat(step[10]) || 0), 0);
  const totalTokens = allSteps.reduce((sum, step) => sum + (parseInt(step[8]) || 0) + (parseInt(step[9]) || 0), 0);
  const totalLatency = allSteps.reduce((sum, step) => sum + (parseFloat(step[7]) || 0), 0);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Overall Summary:');
  console.log(`  💰 Total Cost: $${totalCost.toFixed(6)}`);
  console.log(`  🎯 Total Tokens: ${totalTokens}`);
  console.log(`  ⏱️  Total Latency: ${totalLatency}ms`);
  console.log(`  📈 Average Latency: ${(totalLatency / allSteps.length).toFixed(1)}ms per step`);
  console.log(`  🔄 Total Steps: ${allSteps.length}`);
}

// Run the viewer
viewObservabilityData();
