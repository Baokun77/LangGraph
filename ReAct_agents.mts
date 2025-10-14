// agent.mts

// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ObsTracer } from "./obs_tracer.mts";

// Define the tools for the agent to use
const tools = [new TavilySearchResults({ maxResults: 3 })];
const toolNode = new ToolNode(tools);

// Create a model without tool binding for pure ReAct pattern
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// Initialize observability tracer
const tracer = new ObsTracer();

// ReAct Pattern: Node1 - Think (分析问题并决定下一步行动)
async function think(state: typeof MessagesAnnotation.State) {
  console.log("\n🧠 [THINK] Analyzing question and deciding next action...");
  console.log("📝 Current context:", state.messages || "No context");
  
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
  console.log("💭 [THINK] Decision:", response.content);
  return { messages: [response] };
}

// ReAct Pattern: Node2 - Act (执行确定的行动)
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

// ReAct Pattern: Node3 - Observe (处理行动结果)
async function observe(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  
  console.log("\n👁️ [OBSERVE] Processing action results...");
  console.log("📊 Result type:", content.startsWith("ANSWER:") ? "DIRECT_ANSWER" : content.includes("Search results:") ? "SEARCH_RESULTS" : "OTHER");
  
  // If it's a direct answer, we're done
  if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
    console.log("✅ [OBSERVE] Direct answer provided - conversation complete");
    return { messages: state.messages };
  }
  
  // If it's search results, continue thinking
  console.log("🔄 [OBSERVE] Search results found - continuing reasoning loop");
  return { messages: state.messages };
}

// Routing function for observe node
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;

  console.log("\n🛤️ [ROUTING] Deciding next step...");
  
  // If it's a direct answer, we're done
  if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
    console.log("🏁 [ROUTING] Ending conversation - direct answer provided");
    return "__end__";
  }
  
  // If it's search results, continue thinking
  console.log("🔄 [ROUTING] Continuing to THINK - search results need processing");
  return "think";
}

// Wrap nodes with observability tracer
const wrappedThink = tracer.wrapNode(think, 'think', 'react');
const wrappedAct = tracer.wrapNode(act, 'act', 'react');
const wrappedObserve = tracer.wrapNode(observe, 'observe', 'react');

// Define ReAct graph with three nodes
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("think", wrappedThink)          // Node1: Think (分析问题并决定下一步行动)
  .addNode("act", wrappedAct)              // Node2: Act (执行确定的行动)
  .addNode("observe", wrappedObserve)      // Node3: Observe (处理行动结果)
  .addEdge("__start__", "think")    // Start with thinking
  .addEdge("think", "act")          // Think -> Act
  .addEdge("act", "observe")        // Act -> Observe
  .addConditionalEdges("observe", shouldContinue); // Observe decides next step

// Finally, we compile it into a LangChain Runnable.
const app = workflow.compile();

// Export the app for use in other modules
export { app };

// Use the agent
console.log("🚀 Starting ReAct Agent Demo");
console.log("=".repeat(50));

console.log("\n📋 Query 1: What is the weather in SF?");
console.log("-".repeat(30));
const finalState = await app.invoke({
  messages: [new HumanMessage("what is the weather in sf")],
});
console.log("\n🎯 Final Answer 1:", finalState.messages[finalState.messages.length - 1].content);

console.log("\n" + "=".repeat(50));
console.log("\n📋 Query 2: What about NY?");
console.log("-".repeat(30));
const nextState = await app.invoke({
  messages: [...finalState.messages, new HumanMessage("what about ny")],
});
console.log("\n🎯 Final Answer 2:", nextState.messages[nextState.messages.length - 1].content);


