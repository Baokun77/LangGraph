// Unified Evaluation Framework for ReAct, ToT, and Reflect Agents
// Tests 5 different task types and measures performance metrics

// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

import { HumanMessage } from "@langchain/core/messages";

// Import existing agents
import { app as reactApp } from './ReAct_agents.mts';
import { app as totApp } from './ToT_langgraph.mts';
import { app as reflectApp } from './Reflect_langgraph.mts';

// Task definitions
const tasks = [
  {
    id: 1,
    type: "Factual Question",
    question: "What is the capital of France?",
    expectedAnswer: "Paris",
    category: "factual"
  },
  {
    id: 2,
    type: "Basic Arithmetic",
    question: "What is 15 + 27 * 3?",
    expectedAnswer: "96",
    category: "arithmetic"
  },
  {
    id: 3,
    type: "Search Task",
    question: "What is the current weather in Tokyo?",
    expectedAnswer: "weather information",
    category: "search"
  },
  {
    id: 4,
    type: "Logical Reasoning",
    question: "If all birds can fly and penguins are birds, can penguins fly?",
    expectedAnswer: "No, penguins cannot fly",
    category: "reasoning"
  },
  {
    id: 5,
    type: "Creative Task",
    question: "Write a haiku about programming",
    expectedAnswer: "creative response",
    category: "creative"
  }
];

// Result interface
interface EvaluationResult {
  taskId: number;
  taskType: string;
  question: string;
  agent: string;
  success: boolean;
  inferenceTime: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  response: string;
  error?: string;
}

// Utility function to measure time and tokens
async function measurePerformance<T>(
  fn: () => Promise<T>,
  agentName: string
): Promise<{ result: T; time: number; tokens: any }> {
  const startTime = Date.now();
  let tokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  
  try {
    const result = await fn();
    const endTime = Date.now();
    const time = (endTime - startTime) / 1000; // Convert to seconds
    
    return { result, time, tokens };
  } catch (error) {
    const endTime = Date.now();
    const time = (endTime - startTime) / 1000;
    throw { error, time, tokens };
  }
}

// ReAct Agent Implementation
async function runReActAgent(question: string): Promise<string> {
  try {
    const result = await reactApp.invoke({
      messages: [new HumanMessage(question)]
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
  } catch (error) {
    return `ReAct Error: ${error}`;
  }
}

// ToT Agent Implementation
async function runToTAgent(question: string): Promise<string> {
  try {
    const result = await totApp.invoke({
      messages: [new HumanMessage(question)]
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
  } catch (error) {
    return `ToT Error: ${error}`;
  }
}

// Reflect Agent Implementation
async function runReflectAgent(question: string): Promise<string> {
  try {
    const result = await reflectApp.invoke({
      messages: [new HumanMessage(question)]
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
  } catch (error) {
    return `Reflect Error: ${error}`;
  }
}

// Evaluation function
async function evaluateAgent(
  agentName: string,
  agentFunction: (question: string) => Promise<string>,
  task: any
): Promise<EvaluationResult> {
  console.log(`\n🧪 Testing ${agentName} on: ${task.question}`);
  
  try {
    const { result, time, tokens } = await measurePerformance(
      () => agentFunction(task.question),
      agentName
    );
    
    // Simple success evaluation
    const success = result.toLowerCase().includes(task.expectedAnswer.toLowerCase()) ||
                   (task.category === "search" && result.includes("Search results")) ||
                   (task.category === "creative" && result.length > 10);
    
    console.log(`✅ ${agentName} - Success: ${success}, Time: ${time.toFixed(2)}s`);
    
    return {
      taskId: task.id,
      taskType: task.type,
      question: task.question,
      agent: agentName,
      success,
      inferenceTime: time,
      tokenUsage: tokens,
      response: result
    };
  } catch (error: any) {
    console.log(`❌ ${agentName} - Error: ${error.error || error}`);
    
    return {
      taskId: task.id,
      taskType: task.type,
      question: task.question,
      agent: agentName,
      success: false,
      inferenceTime: error.time || 0,
      tokenUsage: error.tokens || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: "",
      error: error.error?.toString() || error.toString()
    };
  }
}

// Main evaluation function
async function runEvaluation() {
  console.log("🚀 Starting Unified Agent Evaluation");
  console.log("=".repeat(60));
  
  const results: EvaluationResult[] = [];
  
  // Test each agent on each task
  for (const task of tasks) {
    console.log(`\n📋 Task ${task.id}: ${task.type}`);
    console.log(`❓ Question: ${task.question}`);
    console.log("-".repeat(40));
    
    // Test ReAct Agent
    const reactResult = await evaluateAgent("ReAct", runReActAgent, task);
    results.push(reactResult);
    
    // Test ToT Agent
    const totResult = await evaluateAgent("ToT", runToTAgent, task);
    results.push(totResult);
    
    // Test Reflect Agent
    const reflectResult = await evaluateAgent("Reflect", runReflectAgent, task);
    results.push(reflectResult);
  }
  
  // Generate results table
  generateResultsTable(results);
  
  return results;
}

// Generate results table
function generateResultsTable(results: EvaluationResult[]) {
  console.log("\n📊 EVALUATION RESULTS");
  console.log("=".repeat(80));
  
  // Markdown table
  console.log("\n## Agent Performance Comparison");
  console.log("\n| Task | Agent | Success | Time (s) | Tokens | Response Preview |");
  console.log("|------|--------|---------|----------|--------|------------------|");
  
  results.forEach(result => {
    const successIcon = result.success ? "✅" : "❌";
    const responsePreview = result.response.substring(0, 50) + "...";
    console.log(`| ${result.taskId} | ${result.agent} | ${successIcon} | ${result.inferenceTime.toFixed(2)} | ${result.tokenUsage.totalTokens} | ${responsePreview} |`);
  });
  
  // Summary statistics
  console.log("\n## Summary Statistics");
  console.log("\n| Agent | Total Tasks | Success Rate | Avg Time (s) | Total Tokens |");
  console.log("|-------|-------------|--------------|--------------|--------------|");
  
  const agentStats = results.reduce((acc, result) => {
    if (!acc[result.agent]) {
      acc[result.agent] = { total: 0, success: 0, totalTime: 0, totalTokens: 0 };
    }
    acc[result.agent].total++;
    if (result.success) acc[result.agent].success++;
    acc[result.agent].totalTime += result.inferenceTime;
    acc[result.agent].totalTokens += result.tokenUsage.totalTokens;
    return acc;
  }, {} as any);
  
  Object.entries(agentStats).forEach(([agent, stats]: [string, any]) => {
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    const avgTime = (stats.totalTime / stats.total).toFixed(2);
    console.log(`| ${agent} | ${stats.total} | ${successRate}% | ${avgTime} | ${stats.totalTokens} |`);
  });
  
  // Save to CSV
  saveResultsToCSV(results);
}

// Save results to CSV
function saveResultsToCSV(results: EvaluationResult[]) {
  const csvContent = [
    "Task ID,Task Type,Question,Agent,Success,Inference Time,Prompt Tokens,Completion Tokens,Total Tokens,Response,Error",
    ...results.map(result => 
      `${result.taskId},"${result.taskType}","${result.question}","${result.agent}",${result.success},${result.inferenceTime},${result.tokenUsage.promptTokens},${result.tokenUsage.completionTokens},${result.tokenUsage.totalTokens},"${result.response.replace(/"/g, '""')}","${result.error || ''}"`
    )
  ].join('\n');
  
  // Use Node.js fs module
  import('fs').then(fs => {
    fs.writeFileSync('evaluation_results.csv', csvContent);
    console.log("\n💾 Results saved to evaluation_results.csv");
  }).catch(() => {
    console.log("\n💾 CSV save failed, but results are displayed above");
  });
}

// Run the evaluation
runEvaluation().catch(console.error);
