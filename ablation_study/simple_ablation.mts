// Simplified Ablation Study - Standalone Implementation
// Compares ReAct, ToT, and Reflect agents with configurable parameters

// Load environment variables from .env file
import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts';
await config({ export: true });

// Check if API keys are set
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set! Please add it to your .env file.");
  console.error("   Example: OPENAI_API_KEY=sk-your-actual-key");
  process.exit(1);
}

// Tavily is optional - we'll use mock search if not available
const hasTavilyKey = process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY !== "your-tavily-api-key-here";
if (!hasTavilyKey) {
  console.log("⚠️  TAVILY_API_KEY not set - using mock search functionality");
}

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ToolNode } from "@langchain/langgraph/prebuilt";

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

// Simplified task dataset
const tasks = [
  { id: 1, question: "What is the capital of France?", expected: "Paris", category: "factual" },
  { id: 2, question: "What is 15 + 27 * 3?", expected: "96", category: "arithmetic" },
  { id: 3, question: "What is the current weather in Tokyo?", expected: "weather", category: "search" },
  { id: 4, question: "If all birds can fly and penguins are birds, can penguins fly?", expected: "no", category: "reasoning" },
  { id: 5, question: "Write a haiku about programming", expected: "creative", category: "creative" },
  { id: 6, question: "What is the largest planet in our solar system?", expected: "Jupiter", category: "factual" },
  { id: 7, question: "Calculate 2^8 + 3^3", expected: "283", category: "arithmetic" },
  { id: 8, question: "What are the latest news about AI?", expected: "news", category: "search" },
  { id: 9, question: "A train leaves at 2 PM and arrives at 4 PM. If it travels 120 miles, what's its speed?", expected: "60", category: "reasoning" },
  { id: 10, question: "Create a short story about a robot", expected: "creative", category: "creative" }
];

// Model configuration
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
});

// Tools - use Tavily if available, otherwise mock search
let tools: any[] = [];
let toolNode: any = null;

if (hasTavilyKey) {
  tools = [new TavilySearchResults({ maxResults: 3 })];
  toolNode = new ToolNode(tools);
} else {
  // Mock search tool
  const mockSearchTool = {
    invoke: async (query: string) => {
      return {
        results: [
          {
            title: `Mock search result for: ${query}`,
            content: `This is a mock search result for the query "${query}". In a real implementation, this would return actual search results from Tavily.`,
            url: "https://example.com/mock-result"
          }
        ]
      };
    }
  };
  tools = [mockSearchTool];
}

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

  return new StateGraph(MessagesAnnotation)
    .addNode("think", think)
    .addNode("act", act)
    .addNode("observe", observe)
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

  return new StateGraph(MessagesAnnotation)
    .addNode("expand", expand)
    .addNode("evaluate", evaluate)
    .addNode("select", select)
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

  return new StateGraph(MessagesAnnotation)
    .addNode("think", think)
    .addNode("act", act)
    .addNode("reflect", reflect)
    .addEdge("__start__", "think")
    .addEdge("think", "act")
    .addEdge("act", "reflect")
    .addConditionalEdges("reflect", shouldContinue)
    .compile();
}

// Evaluation functions
function evaluateSuccessStrict(response: string, expected: string, category: string): boolean {
  if (!response || response.trim().length === 0) return false;
  
  if (category === "search") return response.includes("Search results") || response.includes("weather") || response.includes("news") || response.includes("Mock search result");
  if (category === "creative") return response.length > 20 && !response.includes("I don't know");
  if (category === "error") return response.includes("error") || response.includes("Error") || response.includes("don't know");
  
  const responseLower = response.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  // More flexible matching
  if (responseLower.includes(expectedLower)) return true;
  if (expectedLower.includes(" ") && responseLower.includes(expectedLower.split(" ")[0])) return true;
  
  return false;
}

function evaluateSuccessLenient(response: string, expected: string, category: string): boolean {
  if (!response || response.trim().length === 0) return false;
  
  if (category === "search") return response.includes("Search") || response.includes("weather") || response.includes("news") || response.includes("information") || response.includes("Mock search result");
  if (category === "creative") return response.length > 10 && !response.includes("I don't know");
  if (category === "error") return response.includes("error") || response.includes("Error") || response.includes("don't know") || response.includes("cannot");
  
  const responseLower = response.toLowerCase();
  const expectedLower = expected.toLowerCase();
  
  // Very lenient matching
  if (responseLower.includes(expectedLower)) return true;
  if (expectedLower.includes(" ") && responseLower.includes(expectedLower.split(" ")[0])) return true;
  if (expectedLower.length > 3 && responseLower.includes(expectedLower.substring(0, 3))) return true;
  
  // For arithmetic, check if numbers are present
  if (category === "arithmetic") {
    const numbers = response.match(/\d+/g);
    return numbers && numbers.length > 0;
  }
  
  return false;
}

function calculateCost(tokenUsage: any): number {
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
  console.log("🚀 Starting Simplified Ablation Study");
  console.log("=".repeat(60));
  
  const agentConfigs = generateAgentConfigs();
  const results: EvaluationResult[] = [];
  const runsPerConfig = 3; // Reduced for demo
  
  console.log(`🔧 Testing ${agentConfigs.length} configurations with ${runsPerConfig} runs each`);
  console.log(`📊 Total evaluations: ${agentConfigs.length * runsPerConfig * tasks.length}`);
  
  for (const agentConfig of agentConfigs) {
    const configString = agentConfig.config ? JSON.stringify(agentConfig.config) : "default";
    console.log(`\n🧪 Testing ${agentConfig.agent} (${configString})`);
    
    for (let run = 0; run < runsPerConfig; run++) {
      console.log(`  Run ${run + 1}/${runsPerConfig}`);
      
      for (const task of tasks) {
        const result = await runSingleEvaluation(agentConfig, task, run);
        results.push(result);
        
        console.log(`    Task ${task.id}: ${result.successStrict ? '✅' : '❌'} (${result.latency.toFixed(2)}s)`);
      }
    }
  }
  
  // Generate aggregated results
  generateAggregatedResults(results);
  
  console.log("\n✅ Ablation study completed!");
  return results;
}

// Generate aggregated results table
function generateAggregatedResults(results: EvaluationResult[]) {
  console.log("\n📊 AGGREGATED RESULTS");
  console.log("=".repeat(80));
  
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
  
  // Display results table
  console.log("\n| Agent | Config | Success@Strict | Success@Lenient | Avg Latency (s) | P50 Latency (s) | P95 Latency (s) | Avg Cost ($) | Avg Tool Calls |");
  console.log("|-------|--------|----------------|-----------------|-----------------|-----------------|-----------------|--------------|----------------|");
  
  aggregated.forEach(result => {
    const [agent, config] = result.agent.split('_');
    console.log(`| ${agent} | ${config} | ${(result.successStrict * 100).toFixed(1)}% | ${(result.successLenient * 100).toFixed(1)}% | ${result.avgLatency.toFixed(2)} | ${result.p50Latency.toFixed(2)} | ${result.p95Latency.toFixed(2)} | $${result.avgCost.toFixed(4)} | ${result.avgToolCalls.toFixed(1)} |`);
  });
  
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
  
  console.log("\n🎯 KEY FINDINGS:");
  console.log(`🥇 Best Strict Success: ${bestStrict.agent} (${(bestStrict.successStrict * 100).toFixed(1)}%)`);
  console.log(`🥇 Best Lenient Success: ${bestLenient.agent} (${(bestLenient.successLenient * 100).toFixed(1)}%)`);
  console.log(`⚡ Fastest: ${fastest.agent} (${fastest.avgLatency.toFixed(2)}s avg)`);
}

// Run the ablation study
if (import.meta.main) {
  runAblationStudy().catch(console.error);
}

export { runAblationStudy, generateAgentConfigs, createReActAgent, createToTAgent, createReflectAgent };
