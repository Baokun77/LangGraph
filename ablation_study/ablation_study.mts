// Comprehensive Ablation Study Framework
// Compares ReAct, ToT, and Reflect agents with configurable parameters
// Generates success@strict, success@lenient, latency, cost, and tool_calls metrics

// IMPORTANT - Add your API keys here. Be careful not to publish them.
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ObsTracer } from "./obs_tracer.mts";
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Configuration interfaces
interface ToTConfig {
  width: number;  // B ∈ {2, 3, 5}
  depth: number;  // D ∈ {2, 3}
}

interface ReflectConfig {
  reflectionRounds: number;  // R ∈ {0, 1, 2}
}

interface AgentConfig {
  agent: 'react' | 'tot' | 'reflect';
  config?: ToTConfig | ReflectConfig;
}

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

// Task dataset - expanded for more comprehensive evaluation
const tasks = [
  // Factual questions
  { id: 1, question: "What is the capital of France?", expected: "Paris", category: "factual" },
  { id: 2, question: "Who wrote '1984'?", expected: "George Orwell", category: "factual" },
  { id: 3, question: "What is the largest planet in our solar system?", expected: "Jupiter", category: "factual" },
  
  // Arithmetic
  { id: 4, question: "What is 15 + 27 * 3?", expected: "96", category: "arithmetic" },
  { id: 5, question: "Calculate 2^8 + 3^3", expected: "283", category: "arithmetic" },
  { id: 6, question: "What is the square root of 144?", expected: "12", category: "arithmetic" },
  
  // Search tasks
  { id: 7, question: "What is the current weather in Tokyo?", expected: "weather", category: "search" },
  { id: 8, question: "What are the latest news about AI?", expected: "news", category: "search" },
  { id: 9, question: "What is the current stock price of Apple?", expected: "stock", category: "search" },
  
  // Reasoning
  { id: 10, question: "If all birds can fly and penguins are birds, can penguins fly?", expected: "no", category: "reasoning" },
  { id: 11, question: "A train leaves at 2 PM and arrives at 4 PM. If it travels 120 miles, what's its speed?", expected: "60", category: "reasoning" },
  { id: 12, question: "If it's raining and I don't have an umbrella, what should I do?", expected: "solution", category: "reasoning" },
  
  // Creative
  { id: 13, question: "Write a haiku about programming", expected: "creative", category: "creative" },
  { id: 14, question: "Create a short story about a robot", expected: "creative", category: "creative" },
  { id: 15, question: "Design a logo concept for a tech startup", expected: "creative", category: "creative" },
  
  // Complex multi-step
  { id: 16, question: "Plan a 3-day trip to Paris including budget and itinerary", expected: "plan", category: "complex" },
  { id: 17, question: "Explain how photosynthesis works step by step", expected: "explanation", category: "complex" },
  { id: 18, question: "Compare the pros and cons of renewable energy sources", expected: "comparison", category: "complex" },
  
  // Error handling
  { id: 19, question: "What is the color of the number 7?", expected: "error", category: "error" },
  { id: 20, question: "Calculate the square root of -1", expected: "error", category: "error" },
  
  // Edge cases
  { id: 21, question: "", expected: "error", category: "edge" },
  { id: 22, question: "What is the meaning of life?", expected: "philosophical", category: "edge" },
  { id: 23, question: "Tell me a joke", expected: "joke", category: "edge" },
  
  // Technical
  { id: 24, question: "How do you implement a binary search algorithm?", expected: "algorithm", category: "technical" },
  { id: 25, question: "What is the difference between HTTP and HTTPS?", expected: "protocol", category: "technical" },
  { id: 26, question: "Explain machine learning overfitting", expected: "ml", category: "technical" },
  
  // Business
  { id: 27, question: "What are the key metrics for a SaaS startup?", expected: "metrics", category: "business" },
  { id: 28, question: "How do you calculate customer lifetime value?", expected: "clv", category: "business" },
  { id: 29, question: "What is the difference between B2B and B2C marketing?", expected: "marketing", category: "business" },
  
  // Science
  { id: 30, question: "What is the theory of relativity?", expected: "physics", category: "science" },
  { id: 31, question: "How does DNA replication work?", expected: "biology", category: "science" },
  { id: 32, question: "What causes climate change?", expected: "climate", category: "science" }
];

// Model configuration
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
});

// Tools
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

// Initialize observability tracer
const tracer = new ObsTracer();

// ReAct Agent Implementation
function createReActAgent() {
  async function think(state: typeof MessagesAnnotation.State) {
    const systemPrompt = `You are a ReAct agent that can reason and act. 
    You can either:
    1. Answer directly if you have enough information
    2. Search for more information if needed
    
    Respond with either:
    - "ANSWER: [your response]" if you can answer directly
    - "SEARCH: [search query]" if you need to search for information`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...state.messages
    ];

    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  async function act(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const thought = lastMessage.content as string;
    
    if (thought.startsWith("SEARCH:")) {
      const searchQuery = thought.replace("SEARCH:", "").trim();
      try {
        const searchResults = await tools[0].invoke(searchQuery);
        return { 
          messages: [...state.messages, new AIMessage(`Search results: ${JSON.stringify(searchResults)}`)]
        };
      } catch (error) {
        return { 
          messages: [...state.messages, new AIMessage(`Search error: ${error}`)]
        };
      }
    } else if (thought.startsWith("ANSWER:")) {
      const answer = thought.replace("ANSWER:", "").trim();
      return { 
        messages: [...state.messages, new AIMessage(answer)]
      };
    }
  }

  async function observe(state: typeof MessagesAnnotation.State) {
    return { messages: state.messages };
  }

  function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1] as AIMessage;
    const content = lastMessage.content as string;
    
    if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
      return "__end__";
    }
    
    return "think";
  }

  const wrappedThink = tracer.wrapNode(think, 'think', 'react');
  const wrappedAct = tracer.wrapNode(act, 'act', 'react');
  const wrappedObserve = tracer.wrapNode(observe, 'observe', 'react');

  return new StateGraph(MessagesAnnotation)
    .addNode("think", wrappedThink)
    .addNode("act", wrappedAct)
    .addNode("observe", wrappedObserve)
    .addEdge("__start__", "think")
    .addEdge("think", "act")
    .addEdge("act", "observe")
    .addConditionalEdges("observe", shouldContinue)
    .compile();
}

// ToT Agent Implementation with configurable width and depth
function createToTAgent(config: ToTConfig) {
  async function expand(state: typeof MessagesAnnotation.State) {
    const systemPrompt = `You are a Tree of Thoughts agent. Generate multiple diverse approaches to solve the given problem.
    
    Rules:
    1. Generate exactly ${config.width} different approaches
    2. Each approach should be a complete solution path
    3. Make approaches diverse and creative
    4. Consider different strategies, perspectives, or methods
    
    Format your response as a JSON array of solution approaches:
    ${JSON.stringify(Array(config.width).fill("approach"))}`;

    const userPrompt = `Problem: ${state.messages[state.messages.length - 1].content}
    
    Generate ${config.width} different solution approaches:`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    try {
      const response = await model.invoke(messages);
      const content = response.content as string;
      
      let candidates: string[] = [];
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          candidates = parsed.slice(0, config.width);
        }
      } catch {
        const lines = content.split('\n').filter(line => line.trim());
        candidates = lines.slice(0, config.width);
      }
      
      return { 
        messages: [...state.messages, new AIMessage(`Generated ${candidates.length} candidate solutions: ${candidates.join('; ')}`)]
      };
    } catch (error) {
      return { 
        messages: [...state.messages, new AIMessage(`Error generating candidates: ${error}`)]
      };
    }
  }

  async function evaluate(state: typeof MessagesAnnotation.State) {
    const systemPrompt = `You are an evaluator. Rate each candidate solution on multiple criteria.
    
    For each candidate, provide:
    1. A score from 1-10 (10 being best)
    2. Brief reasoning for the score
    3. Consider: feasibility, creativity, completeness, correctness
    
    Format as JSON:
    [
      {"candidate": "text", "score": 8, "reasoning": "explanation"},
      {"candidate": "text", "score": 6, "reasoning": "explanation"}
    ]`;

    const userPrompt = `Evaluate these candidate solutions:
    
    ${state.messages[state.messages.length - 1].content}
    
    Provide scores and reasoning for each:`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    try {
      const response = await model.invoke(messages);
      const content = response.content as string;
      
      return { 
        messages: [...state.messages, new AIMessage(`Evaluation: ${content}`)]
      };
    } catch (error) {
      return { 
        messages: [...state.messages, new AIMessage(`Error evaluating candidates: ${error}`)]
      };
    }
  }

  async function select(state: typeof MessagesAnnotation.State) {
    const systemPrompt = `You are a selector. Based on the evaluations, choose the best solution approach.
    
    Consider:
    1. Highest score from evaluation
    2. Most feasible approach
    3. Most complete solution
    4. Best reasoning provided
    
    Provide your final selected solution with brief justification.`;

    const userPrompt = `Based on these evaluations, select the best solution:
    
    ${state.messages[state.messages.length - 1].content}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    try {
      const response = await model.invoke(messages);
      const content = response.content as string;
      
      return { 
        messages: [...state.messages, new AIMessage(`Selected best solution: ${content}`)]
      };
    } catch (error) {
      return { 
        messages: [...state.messages, new AIMessage(`Error selecting candidate: ${error}`)]
      };
    }
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const content = lastMessage.content as string;
    
    if (content.includes("Selected best solution:")) {
      return "__end__";
    }
    
    if (content.includes("Evaluation:")) {
      return "select";
    }
    
    if (content.includes("Generated") && content.includes("candidate solutions")) {
      return "evaluate";
    }
    
    return "expand";
  }

  const wrappedExpand = tracer.wrapNode(expand, 'expand', 'tot');
  const wrappedEvaluate = tracer.wrapNode(evaluate, 'evaluate', 'tot');
  const wrappedSelect = tracer.wrapNode(select, 'select', 'tot');

  return new StateGraph(MessagesAnnotation)
    .addNode("expand", wrappedExpand)
    .addNode("evaluate", wrappedEvaluate)
    .addNode("select", wrappedSelect)
    .addEdge("__start__", "expand")
    .addConditionalEdges("expand", shouldContinue)
    .addConditionalEdges("evaluate", shouldContinue)
    .addConditionalEdges("select", shouldContinue)
    .compile();
}

// Reflect Agent Implementation with configurable reflection rounds
function createReflectAgent(config: ReflectConfig) {
  let globalMemory: string[] = [];
  let reflectionCount = 0;

  async function think(state: typeof MessagesAnnotation.State) {
    const memoryContext = globalMemory.length > 0 
      ? `\n\nPrevious failed attempts (learn from these):\n${globalMemory.join('\n')}`
      : "";
    
    const systemPrompt = `You are a Reflect agent that can reason and act. 
    You can either:
    1. Answer directly if you have enough information
    2. Search for more information if needed
    
    ${globalMemory.length > 0 ? 'Learn from previous failures and try a different approach.' : ''}
    
    Respond with either:
    - "ANSWER: [your response]" if you can answer directly
    - "SEARCH: [search query]" if you need to search for information`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...state.messages
    ];

    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  async function act(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const thought = lastMessage.content as string;
    
    if (thought.startsWith("SEARCH:")) {
      const searchQuery = thought.replace("SEARCH:", "").trim();
      try {
        const searchResults = await tools[0].invoke(searchQuery);
        return { 
          messages: [...state.messages, new AIMessage(`Search results: ${JSON.stringify(searchResults)}`)]
        };
      } catch (error) {
        return { 
          messages: [...state.messages, new AIMessage(`Search error: ${error}`)]
        };
      }
    } else if (thought.startsWith("ANSWER:")) {
      const answer = thought.replace("ANSWER:", "").trim();
      return { 
        messages: [...state.messages, new AIMessage(answer)]
      };
    }
  }

  async function reflect(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const content = lastMessage.content as string;
    
    const isOutputValid = !content.includes("false") && 
                         !content.includes("undefined") && 
                         !content.includes("error") && 
                         !content.includes("Error") &&
                         content.trim().length > 0 &&
                         !content.includes("I don't know") &&
                         !content.includes("I cannot");
    
    if (!isOutputValid && reflectionCount < config.reflectionRounds) {
      reflectionCount++;
      const memoryEntry = `Failed attempt ${reflectionCount}: ${content}`;
      globalMemory.push(memoryEntry);
      return { 
        messages: [...state.messages, new AIMessage(`[MEMORY] ${memoryEntry}. Let me try a different approach.`)]
      };
    } else {
      return { 
        messages: state.messages
      };
    }
  }

  function shouldContinue(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const content = lastMessage.content as string;
    
    if (!content.includes("false") && 
        !content.includes("undefined") && 
        !content.includes("error") && 
        !content.includes("Error") &&
        content.trim().length > 0 &&
        !content.includes("I don't know") &&
        !content.includes("I cannot") &&
        !content.includes("[MEMORY]")) {
      return "__end__";
    }
    
    if (content.includes("[MEMORY]")) {
      return "think";
    }
    
    if (content.includes("Search results:")) {
      return "think";
    }
    
    return "think";
  }

  const wrappedThink = tracer.wrapNode(think, 'think', 'reflect');
  const wrappedAct = tracer.wrapNode(act, 'act', 'reflect');
  const wrappedReflect = tracer.wrapNode(reflect, 'reflect', 'reflect');

  return new StateGraph(MessagesAnnotation)
    .addNode("think", wrappedThink)
    .addNode("act", wrappedAct)
    .addNode("reflect", wrappedReflect)
    .addEdge("__start__", "think")
    .addEdge("think", "act")
    .addEdge("act", "reflect")
    .addConditionalEdges("reflect", shouldContinue)
    .compile();
}

// Evaluation functions
function evaluateSuccessStrict(response: string, expected: string, category: string): boolean {
  if (category === "search") return response.includes("Search results");
  if (category === "creative") return response.length > 20;
  if (category === "error") return response.includes("error") || response.includes("Error");
  if (category === "edge") return response.length > 10;
  
  return response.toLowerCase().includes(expected.toLowerCase());
}

function evaluateSuccessLenient(response: string, expected: string, category: string): boolean {
  if (category === "search") return response.includes("Search") || response.includes("weather") || response.includes("news");
  if (category === "creative") return response.length > 10;
  if (category === "error") return response.includes("error") || response.includes("Error") || response.includes("don't know");
  if (category === "edge") return response.length > 5;
  
  const responseLower = response.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  // More lenient matching
  if (expectedLower.includes(" ") && responseLower.includes(expectedLower.split(" ")[0])) return true;
  if (expectedLower.length > 3 && responseLower.includes(expectedLower.substring(0, 3))) return true;
  
  return responseLower.includes(expectedLower);
}

function calculateCost(tokenUsage: any): number {
  // GPT-4o-mini pricing: $0.00015/1K input tokens, $0.0006/1K output tokens
  const inputCost = (tokenUsage.promptTokens || 0) * 0.00015 / 1000;
  const outputCost = (tokenUsage.completionTokens || 0) * 0.0006 / 1000;
  return inputCost + outputCost;
}

// Main evaluation function
async function runSingleEvaluation(
  agentConfig: AgentConfig,
  task: any,
  runId: number
): Promise<EvaluationResult> {
  const startTime = Date.now();
  let toolCalls = 0;
  let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  
  try {
    let app;
    let configString = "";
    
    if (agentConfig.agent === 'react') {
      app = createReActAgent();
      configString = "default";
    } else if (agentConfig.agent === 'tot') {
      const totConfig = agentConfig.config as ToTConfig;
      app = createToTAgent(totConfig);
      configString = `B${totConfig.width}_D${totConfig.depth}`;
    } else if (agentConfig.agent === 'reflect') {
      const reflectConfig = agentConfig.config as ReflectConfig;
      app = createReflectAgent(reflectConfig);
      configString = `R${reflectConfig.reflectionRounds}`;
    }
    
    const result = await app.invoke({
      messages: [new HumanMessage(task.question)]
    });
    
    const endTime = Date.now();
    const latency = (endTime - startTime) / 1000;
    
    const lastMessage = result.messages[result.messages.length - 1];
    const response = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
    
    // Count tool calls (rough estimate based on search results)
    toolCalls = (response.match(/Search results:/g) || []).length;
    
    const successStrict = evaluateSuccessStrict(response, task.expected, task.category);
    const successLenient = evaluateSuccessLenient(response, task.expected, task.category);
    const cost = calculateCost(tokenUsage);
    
    return {
      taskId: task.id,
      agent: agentConfig.agent,
      config: configString,
      successStrict,
      successLenient,
      latency,
      cost,
      toolCalls,
      response,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const endTime = Date.now();
    const latency = (endTime - startTime) / 1000;
    
    return {
      taskId: task.id,
      agent: agentConfig.agent,
      config: agentConfig.config ? JSON.stringify(agentConfig.config) : "default",
      successStrict: false,
      successLenient: false,
      latency,
      cost: 0,
      toolCalls,
      response: "",
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// Generate all agent configurations
function generateAgentConfigs(): AgentConfig[] {
  const configs: AgentConfig[] = [];
  
  // ReAct (baseline)
  configs.push({ agent: 'react' });
  
  // ToT configurations
  const totWidths = [2, 3, 5];
  const totDepths = [2, 3];
  for (const width of totWidths) {
    for (const depth of totDepths) {
      configs.push({
        agent: 'tot',
        config: { width, depth }
      });
    }
  }
  
  // Reflect configurations
  const reflectRounds = [0, 1, 2];
  for (const rounds of reflectRounds) {
    configs.push({
      agent: 'reflect',
      config: { reflectionRounds: rounds }
    });
  }
  
  return configs;
}

// Main ablation study runner
async function runAblationStudy() {
  console.log("🚀 Starting Comprehensive Ablation Study");
  console.log("=".repeat(60));
  
  const agentConfigs = generateAgentConfigs();
  const results: EvaluationResult[] = [];
  const runsPerConfig = 30;
  
  // Create results directory
  const dateStr = new Date().toISOString().split('T')[0];
  const runsDir = path.join('runs', dateStr);
  await fs.mkdir(runsDir, { recursive: true });
  
  console.log(`📁 Results will be saved to: ${runsDir}`);
  console.log(`🔧 Testing ${agentConfigs.length} configurations with ${runsPerConfig} runs each`);
  console.log(`📊 Total evaluations: ${agentConfigs.length * runsPerConfig * tasks.length}`);
  
  for (const agentConfig of agentConfigs) {
    const configString = agentConfig.config ? JSON.stringify(agentConfig.config) : "default";
    console.log(`\n🧪 Testing ${agentConfig.agent} (${configString})`);
    
    const configResults: EvaluationResult[] = [];
    
    for (let run = 0; run < runsPerConfig; run++) {
      console.log(`  Run ${run + 1}/${runsPerConfig}`);
      
      for (const task of tasks) {
        const result = await runSingleEvaluation(agentConfig, task, run);
        configResults.push(result);
        results.push(result);
      }
    }
    
    // Save individual config results
    const filename = `${agentConfig.agent}_${configString.replace(/[{}":,]/g, '_')}.jsonl`;
    const filepath = path.join(runsDir, filename);
    const jsonlContent = configResults.map(r => JSON.stringify(r)).join('\n');
    await fs.writeFile(filepath, jsonlContent);
    
    console.log(`  💾 Saved ${configResults.length} results to ${filename}`);
  }
  
  // Generate aggregated results
  await generateAggregatedResults(results, runsDir);
  
  console.log("\n✅ Ablation study completed!");
  return results;
}

// Generate aggregated results table
async function generateAggregatedResults(results: EvaluationResult[], runsDir: string) {
  console.log("\n📊 Generating aggregated results...");
  
  // Group by agent and config
  const grouped = results.reduce((acc, result) => {
    const key = `${result.agent}_${result.config}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as Record<string, EvaluationResult[]>);
  
  // Calculate metrics for each group
  const aggregated = Object.entries(grouped).map(([key, groupResults]) => {
    const latencies = groupResults.map(r => r.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    
    const successStrictRate = groupResults.filter(r => r.successStrict).length / groupResults.length;
    const successLenientRate = groupResults.filter(r => r.successLenient).length / groupResults.length;
    const avgCost = groupResults.reduce((sum, r) => sum + r.cost, 0) / groupResults.length;
    const avgToolCalls = groupResults.reduce((sum, r) => sum + r.toolCalls, 0) / groupResults.length;
    const avgLatency = groupResults.reduce((sum, r) => sum + r.latency, 0) / groupResults.length;
    
    return {
      agent: key,
      totalRuns: groupResults.length,
      successStrict: successStrictRate,
      successLenient: successLenientRate,
      avgLatency,
      p50Latency: p50,
      p95Latency: p95,
      avgCost,
      avgToolCalls
    };
  });
  
  // Save aggregated results
  const aggregatedPath = path.join(runsDir, 'aggregated_results.json');
  await fs.writeFile(aggregatedPath, JSON.stringify(aggregated, null, 2));
  
  // Generate markdown table
  const markdownTable = generateMarkdownTable(aggregated);
  const markdownPath = path.join(runsDir, 'results_summary.md');
  await fs.writeFile(markdownPath, markdownTable);
  
  console.log("📊 Aggregated results saved to:");
  console.log(`  - ${aggregatedPath}`);
  console.log(`  - ${markdownPath}`);
}

function generateMarkdownTable(aggregated: any[]): string {
  let markdown = "# Ablation Study Results\n\n";
  markdown += "## Performance Metrics\n\n";
  markdown += "| Agent | Config | Success@Strict | Success@Lenient | Avg Latency (s) | P50 Latency (s) | P95 Latency (s) | Avg Cost ($) | Avg Tool Calls |\n";
  markdown += "|-------|--------|----------------|-----------------|-----------------|-----------------|-----------------|--------------|----------------|\n";
  
  aggregated.forEach(result => {
    const [agent, config] = result.agent.split('_');
    markdown += `| ${agent} | ${config} | ${(result.successStrict * 100).toFixed(1)}% | ${(result.successLenient * 100).toFixed(1)}% | ${result.avgLatency.toFixed(2)} | ${result.p50Latency.toFixed(2)} | ${result.p95Latency.toFixed(2)} | $${result.avgCost.toFixed(4)} | ${result.avgToolCalls.toFixed(1)} |\n`;
  });
  
  markdown += "\n## Key Findings\n\n";
  
  // Find best performers
  const bestStrict = aggregated.reduce((best, current) => 
    current.successStrict > best.successStrict ? current : best
  );
  const bestLenient = aggregated.reduce((best, current) => 
    current.successLenient > best.successLenient ? current : best
  );
  const fastest = aggregated.reduce((best, current) => 
    current.avgLatency < best.avgLatency ? current : best
  );
  const cheapest = aggregated.reduce((best, current) => 
    current.avgCost < best.avgCost ? current : best
  );
  
  markdown += `- **Best Strict Success Rate**: ${bestStrict.agent} (${(bestStrict.successStrict * 100).toFixed(1)}%)\n`;
  markdown += `- **Best Lenient Success Rate**: ${bestLenient.agent} (${(bestLenient.successLenient * 100).toFixed(1)}%)\n`;
  markdown += `- **Fastest**: ${fastest.agent} (${fastest.avgLatency.toFixed(2)}s avg)\n`;
  markdown += `- **Cheapest**: ${cheapest.agent} ($${cheapest.avgCost.toFixed(4)} avg)\n`;
  
  return markdown;
}

// Run the ablation study
if (import.meta.main) {
  runAblationStudy().catch(console.error);
}

export { runAblationStudy, generateAgentConfigs, createReActAgent, createToTAgent, createReflectAgent };
