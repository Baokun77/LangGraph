// Reflect LangGraph Agent
// Based on ReAct but with memory for failed outputs and retry mechanism

// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Global memory that persists across conversations
let globalMemory: string[] = [];

// Define the tools for the agent to use
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

// Create a model for reasoning
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// Node 1: Think - Analyze problem and decide action
async function think(state: typeof MessagesAnnotation.State) {
  console.log("\n🧠 [THINK] Analyzing question and deciding next action...");
  console.log("📝 Current context:", state.messages || "No context");
  console.log("🧠 Global memory entries:", globalMemory.length);
  
  // Include global memory in context if available
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
  console.log("💭 [THINK] Decision:", response.content);
  return { messages: [response] };
}

// Node 2: Act - Execute the determined action
async function act(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const thought = lastMessage.content as string;
  
  console.log("\n⚡ [ACT] Executing determined action...");
  console.log("🎯 Action type:", thought.startsWith("SEARCH:") ? "SEARCH" : thought.startsWith("ANSWER:") ? "ANSWER" : "DEFAULT");
  
  if (thought.startsWith("SEARCH:")) {
    // Execute search tool directly
    const searchQuery = thought.replace("SEARCH:", "").trim();
    console.log("🔍 [ACT] Searching for:", searchQuery);
    try {
      const searchResults = await tools[0].invoke(searchQuery);
      console.log("✅ [ACT] Search completed successfully");
      console.log("🔍 [ACT] Search results:", JSON.stringify(searchResults));
      return { 
        messages: [...state.messages, new AIMessage(`Search results: ${JSON.stringify(searchResults)}`)]
      };
    } catch (error) {
      console.log("❌ [ACT] Search failed:", error);
      return { 
        messages: [...state.messages, new AIMessage(`Search error: ${error}`)]
      };
    }
  } else if (thought.startsWith("ANSWER:")) {
    // Direct answer
    const answer = thought.replace("ANSWER:", "").trim();
    console.log("💬 [ACT] Providing direct answer:", answer);
    return { 
      messages: [...state.messages, new AIMessage(answer)]
    };
  }
}

// Node 3: Reflect - Evaluate output quality and decide next action
async function reflect(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  
  console.log("\n🔍 [REFLECT] Evaluating output quality...");
  console.log("📊 Output to evaluate:", content.substring(0, 100) + "...");
  
  // Check if output is valid (not false, undefined, or error)
  const isOutputValid = !content.includes("false") && 
                       !content.includes("undefined") && 
                       !content.includes("error") && 
                       !content.includes("Error") &&
                       content.trim().length > 0 &&
                       !content.includes("I don't know") &&
                       !content.includes("I cannot");
  
  console.log("✅ [REFLECT] Output validity:", isOutputValid ? "VALID" : "INVALID");
  
  if (!isOutputValid) {
    console.log("🧠 [REFLECT] Output invalid - adding to global memory and retrying");
    const memoryEntry = `Failed attempt: ${content}`;
    globalMemory.push(memoryEntry);
    console.log("🧠 [REFLECT] Added to global memory. Total entries:", globalMemory.length);
    return { 
      messages: [...state.messages, new AIMessage(`[MEMORY] ${memoryEntry}. Let me try a different approach.`)]
    };
  } else {
    console.log("✅ [REFLECT] Output is valid - conversation complete");
    return { 
      messages: state.messages
    };
  }
}

// Routing function for reflect node
function shouldContinue(state: typeof MessagesAnnotation.State) {
  console.log("\n🛤️ [ROUTING] Deciding next step...");
  
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  
  // If output is valid, we're done
  if (!content.includes("false") && 
      !content.includes("undefined") && 
      !content.includes("error") && 
      !content.includes("Error") &&
      content.trim().length > 0 &&
      !content.includes("I don't know") &&
      !content.includes("I cannot") &&
      !content.includes("[MEMORY]")) {
    console.log("🏁 [ROUTING] Ending conversation - valid output provided");
    return "__end__";
  }
  
  // If we have memory entries, continue thinking
  if (content.includes("[MEMORY]")) {
    console.log("🔄 [ROUTING] Continuing to THINK - output was invalid, retrying");
    return "think";
  }
  
  // If it's search results, continue thinking
  if (content.includes("Search results:")) {
    console.log("🔄 [ROUTING] Continuing to THINK - search results need processing");
    return "think";
  }
  
  // Default: continue thinking
  console.log("🔄 [ROUTING] Continuing to THINK - default case");
  return "think";
}

// Define Reflect graph with three nodes
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("think", think)          // Node1: Think (analyze and decide)
  .addNode("act", act)              // Node2: Act (execute action)
  .addNode("reflect", reflect)      // Node3: Reflect (evaluate output)
  .addEdge("__start__", "think")    // Start with thinking
  .addEdge("think", "act")          // Think -> Act
  .addEdge("act", "reflect")        // Act -> Reflect
  .addConditionalEdges("reflect", shouldContinue); // Reflect decides next step

// Compile the graph
const app = workflow.compile();

// Export the app for use in other modules
export { app };

// Function to clear global memory
function clearGlobalMemory() {
  globalMemory = [];
  console.log("🧠 Global memory cleared");
}

// Function to get global memory
function getGlobalMemory() {
  return globalMemory;
}

// Demo usage
console.log("🔄 Starting Reflect LangGraph Agent Demo");
console.log("=".repeat(50));

console.log("\n📋 Query 1: What is the weather in SF?");
console.log("-".repeat(30));
const finalState = await app.invoke({
  messages: [new HumanMessage("what is the weather in sf")]
});
console.log("\n🎯 Final Answer 1:", finalState.messages[finalState.messages.length - 1].content);
console.log("🧠 Global memory entries:", getGlobalMemory().length);

console.log("\n" + "=".repeat(50));
console.log("\n📋 Query 2: What about NY?");
console.log("-".repeat(30));
const nextState = await app.invoke({
  messages: [...finalState.messages, new HumanMessage("what about ny")]
});
console.log("\n🎯 Final Answer 2:", nextState.messages[nextState.messages.length - 1].content);
console.log("🧠 Global memory entries:", getGlobalMemory().length);

console.log("\n" + "=".repeat(50));
console.log("\n📋 Query 3: Test with a question that might fail");
console.log("-".repeat(30));
const testState = await app.invoke({
  messages: [new HumanMessage("What is the meaning of life?")]
});
console.log("\n🎯 Final Answer 3:", testState.messages[testState.messages.length - 1].content);
console.log("🧠 Global memory entries:", getGlobalMemory().length);

// Show global memory contents
if (getGlobalMemory().length > 0) {
  console.log("\n🧠 Global Memory Contents:");
  getGlobalMemory().forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry}`);
  });
}