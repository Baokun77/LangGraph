// Simplified Automated Evaluator for Agent Performance Testing
// Evaluates factual Q&A, tool usage, and multi-step reasoning tasks
// This version doesn't use ObsTracer to avoid better-sqlite3 dependency issues

// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

import { readFileSync, writeFileSync } from 'fs';
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Task interface
interface Task {
  id: number;
  task: string;
  expected: string;
  eval_type: 'factual' | 'tool' | 'reasoning';
  metadata: {
    context?: string;
    evidence_snippet?: string;
    required_fields?: string[];
    tolerance?: number;
    key_steps?: string[];
    intermediate_values?: string[];
  };
}

// Evaluation result interface
interface EvaluationResult {
  taskId: number;
  taskType: string;
  question: string;
  agent: string;
  success: boolean;
  response: string;
  evaluationDetails: {
    exactMatch?: boolean;
    citationHit?: boolean;
    toolInvoked?: boolean;
    fieldsPresent?: boolean;
    withinTolerance?: boolean;
    reasoningCorrect?: boolean;
    keyStepsFound?: string[];
    intermediateValuesFound?: string[];
  };
  inferenceTime: number;
  error?: string;
}

// Simple ReAct Agent (without ObsTracer)
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

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
  const lastMessage = state.messages[state.messages.length - 1];
  const thought = lastMessage.content as string;
  
  if (thought.startsWith("SEARCH:")) {
    const searchQuery = thought.replace("SEARCH:", "").trim();
    try {
      const searchResults = await tools[0].invoke(searchQuery);
      return { 
        messages: [...state.messages, { role: "assistant", content: `Search results: ${JSON.stringify(searchResults)}` }]
      };
    } catch (error) {
      return { 
        messages: [...state.messages, { role: "assistant", content: `Search error: ${error}` }]
      };
    }
  } else if (thought.startsWith("ANSWER:")) {
    const answer = thought.replace("ANSWER:", "").trim();
    return { 
      messages: [...state.messages, { role: "assistant", content: answer }]
    };
  }
}

async function observe(state: typeof MessagesAnnotation.State) {
  return { messages: state.messages };
}

function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content as string;
  
  if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
    return "__end__";
  }
  
  return "think";
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("think", think)
  .addNode("act", act)
  .addNode("observe", observe)
  .addEdge("__start__", "think")
  .addEdge("think", "act")
  .addEdge("act", "observe")
  .addConditionalEdges("observe", shouldContinue);

const reactApp = workflow.compile();

// Load tasks from JSONL file
function loadTasks(filePath: string): Task[] {
  const content = readFileSync(filePath, 'utf-8');
  return content.trim().split('\n').map(line => JSON.parse(line));
}

// Factual Q&A evaluator - exact string match and citation hit rate
function evaluateFactual(response: string, expected: string, evidenceSnippet?: string): {
  exactMatch: boolean;
  citationHit: boolean;
} {
  const normalizedResponse = response.toLowerCase().trim();
  const normalizedExpected = expected.toLowerCase().trim();
  
  const exactMatch = normalizedResponse.includes(normalizedExpected);
  const citationHit = evidenceSnippet ? 
    normalizedResponse.includes(evidenceSnippet.toLowerCase()) : false;
  
  return { exactMatch, citationHit };
}

// Tool usage evaluator - check if Tavily was invoked and structured output
function evaluateTool(response: string, requiredFields: string[], tolerance?: number): {
  toolInvoked: boolean;
  fieldsPresent: boolean;
  withinTolerance: boolean;
} {
  const toolInvoked = response.toLowerCase().includes('search results') || 
                     response.toLowerCase().includes('tavily') ||
                     response.includes('{') && response.includes('}');
  
  const fieldsPresent = requiredFields.every(field => 
    response.toLowerCase().includes(field.toLowerCase())
  );
  
  // For tolerance check, look for numeric values in response
  const numericMatches = response.match(/\d+\.?\d*/g);
  const withinTolerance = tolerance ? 
    (numericMatches ? numericMatches.some(num => {
      const value = parseFloat(num);
      return !isNaN(value) && value > 0;
    }) : false) : true;
  
  return { toolInvoked, fieldsPresent, withinTolerance };
}

// Reasoning evaluator using LLM
async function evaluateReasoning(
  response: string, 
  keySteps: string[], 
  intermediateValues: string[],
  model: ChatOpenAI
): Promise<{
  reasoningCorrect: boolean;
  keyStepsFound: string[];
  intermediateValuesFound: string[];
}> {
  const prompt = `Evaluate if the following reasoning response contains the required logical steps and intermediate values.

Response: "${response}"

Required key steps: ${keySteps.join(', ')}
Required intermediate values: ${intermediateValues.join(', ')}

Analyze the response and determine:
1. Does it contain the key logical steps? List which ones are found.
2. Does it contain the intermediate values? List which ones are found.
3. Is the overall reasoning correct and complete?

Respond in JSON format:
{
  "keyStepsFound": ["step1", "step2"],
  "intermediateValuesFound": ["value1", "value2"],
  "reasoningCorrect": true/false
}`;

  try {
    const result = await model.invoke([{ role: "user", content: prompt }]);
    const content = result.content as string;
    
    // Parse JSON response
    const evaluation = JSON.parse(content);
    
    return {
      reasoningCorrect: evaluation.reasoningCorrect || false,
      keyStepsFound: evaluation.keyStepsFound || [],
      intermediateValuesFound: evaluation.intermediateValuesFound || []
    };
  } catch (error) {
    console.log("Error in LLM reasoning evaluation:", error);
    return {
      reasoningCorrect: false,
      keyStepsFound: [],
      intermediateValuesFound: []
    };
  }
}

// Run agent on a task
async function runAgent(agentName: string, question: string): Promise<{
  response: string;
  time: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    let result;
    switch (agentName) {
      case 'ReAct':
        result = await reactApp.invoke({
          messages: [new HumanMessage(question)]
        });
        break;
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
    
    const lastMessage = result.messages[result.messages.length - 1];
    const response = typeof lastMessage.content === 'string' ? 
      lastMessage.content : JSON.stringify(lastMessage.content);
    
    const endTime = Date.now();
    const time = (endTime - startTime) / 1000;
    
    return { response, time };
  } catch (error) {
    const endTime = Date.now();
    const time = (endTime - startTime) / 1000;
    return { 
      response: '', 
      time, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Main evaluation function
async function evaluateTask(
  task: Task, 
  agentName: string, 
  model: ChatOpenAI
): Promise<EvaluationResult> {
  console.log(`\n🧪 Testing ${agentName} on Task ${task.id}: ${task.eval_type}`);
  console.log(`❓ Question: ${task.task}`);
  
  // Run agent
  const { response, time, error } = await runAgent(agentName, task.task);
  
  if (error) {
    return {
      taskId: task.id,
      taskType: task.eval_type,
      question: task.task,
      agent: agentName,
      success: false,
      response: '',
      evaluationDetails: {},
      inferenceTime: time,
      error
    };
  }
  
  // Evaluate based on task type
  let evaluationDetails: any = {};
  let success = false;
  
  switch (task.eval_type) {
    case 'factual':
      const factualEval = evaluateFactual(response, task.expected, task.metadata.evidence_snippet);
      evaluationDetails = factualEval;
      success = factualEval.exactMatch;
      break;
      
    case 'tool':
      const toolEval = evaluateTool(response, task.metadata.required_fields || [], task.metadata.tolerance);
      evaluationDetails = toolEval;
      success = toolEval.toolInvoked && toolEval.fieldsPresent && toolEval.withinTolerance;
      break;
      
    case 'reasoning':
      const reasoningEval = await evaluateReasoning(
        response, 
        task.metadata.key_steps || [], 
        task.metadata.intermediate_values || [],
        model
      );
      evaluationDetails = reasoningEval;
      success = reasoningEval.reasoningCorrect;
      break;
  }
  
  console.log(`✅ ${agentName} - Success: ${success}, Time: ${time.toFixed(2)}s`);
  
  return {
    taskId: task.id,
    taskType: task.eval_type,
    question: task.task,
    agent: agentName,
    success,
    response,
    evaluationDetails,
    inferenceTime: time
  };
}

// Save results to CSV
function saveResultsToCSV(results: EvaluationResult[]) {
  const headers = [
    'Task ID', 'Task Type', 'Question', 'Agent', 'Success', 'Response', 
    'Exact Match', 'Citation Hit', 'Tool Invoked', 'Fields Present', 
    'Within Tolerance', 'Reasoning Correct', 'Key Steps Found', 
    'Intermediate Values Found', 'Inference Time', 'Error'
  ];
  
  const csvContent = [
    headers.join(','),
    ...results.map(result => [
      result.taskId,
      `"${result.taskType}"`,
      `"${result.question.replace(/"/g, '""')}"`,
      `"${result.agent}"`,
      result.success,
      `"${result.response.replace(/"/g, '""')}"`,
      result.evaluationDetails.exactMatch || false,
      result.evaluationDetails.citationHit || false,
      result.evaluationDetails.toolInvoked || false,
      result.evaluationDetails.fieldsPresent || false,
      result.evaluationDetails.withinTolerance || false,
      result.evaluationDetails.reasoningCorrect || false,
      `"${(result.evaluationDetails.keyStepsFound || []).join(';')}"`,
      `"${(result.evaluationDetails.intermediateValuesFound || []).join(';')}"`,
      result.inferenceTime,
      `"${result.error || ''}"`
    ].join(','))
  ].join('\n');
  
  writeFileSync('evaluation_results_auto.csv', csvContent);
  console.log('\n💾 Results saved to evaluation_results_auto.csv');
}

// Main evaluation runner - test with first 3 tasks only
async function runAutomatedEvaluation() {
  console.log("🚀 Starting Automated Agent Evaluation (Test Run)");
  console.log("=".repeat(60));
  
  // Load tasks
  const allTasks = loadTasks('evaluation_dataset.jsonl');
  const tasks = allTasks.slice(0, 3); // Test with first 3 tasks only
  console.log(`📋 Testing with ${tasks.length} tasks (out of ${allTasks.length} total)`);
  
  // Initialize LLM for reasoning evaluation
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });
  
  const agents = ['ReAct'];
  const results: EvaluationResult[] = [];
  
  // Evaluate each agent on each task
  for (const task of tasks) {
    console.log(`\n📋 Task ${task.id}: ${task.eval_type.toUpperCase()}`);
    console.log(`❓ Question: ${task.task}`);
    console.log("-".repeat(40));
    
    for (const agent of agents) {
      const result = await evaluateTask(task, agent, model);
      results.push(result);
    }
  }
  
  // Display results
  console.log("\n📊 EVALUATION RESULTS");
  console.log("=".repeat(80));
  
  console.log("\n| Task ID | Task Type | Agent | Success | Time | Response Preview |");
  console.log("|---------|-----------|-------|---------|------|------------------|");
  
  results.forEach(result => {
    const successIcon = result.success ? "✅" : "❌";
    const responsePreview = result.response.substring(0, 50) + "...";
    console.log(`| ${result.taskId} | ${result.taskType} | ${result.agent} | ${successIcon} | ${result.inferenceTime.toFixed(2)}s | ${responsePreview} |`);
  });
  
  // Save results
  saveResultsToCSV(results);
  
  return results;
}

// Run the evaluation
runAutomatedEvaluation().catch(console.error);
