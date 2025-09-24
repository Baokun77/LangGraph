// Visualize the final ReAct pattern implementation
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Set up the same environment as agents.mts
// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";

// Define the tools for the agent to use
const tools = [new TavilySearchResults({ maxResults: 3 })];

// Create a model without tool binding for pure ReAct pattern
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// ReAct Pattern: Node1 - Think (分析问题并决定下一步行动)
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

// ReAct Pattern: Node2 - Act (执行确定的行动)
async function act(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const thought = lastMessage.content as string;
  
  if (thought.startsWith("SEARCH:")) {
    // Execute search tool directly
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
    // Direct answer
    const answer = thought.replace("ANSWER:", "").trim();
    return { 
      messages: [...state.messages, new AIMessage(answer)]
    };
  } else {
    // Default to search
    try {
      const searchResults = await tools[0].invoke(thought);
      return { 
        messages: [...state.messages, new AIMessage(`Search results: ${JSON.stringify(searchResults)}`)]
      };
    } catch (error) {
      return { 
        messages: [...state.messages, new AIMessage(`Search error: ${error}`)]
      };
    }
  }
}

// ReAct Pattern: Node3 - Observe (处理行动结果)
async function observe(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  
  // If it's a direct answer, we're done
  if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
    return { messages: state.messages };
  }
  
  // If it's search results, continue thinking
  return { messages: state.messages };
}

// Routing function for observe node
function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;

  // If it's a direct answer, we're done
  if (content.startsWith("ANSWER:") || !content.includes("Search results:")) {
    return "__end__";
  }
  
  // If it's search results, continue thinking
  return "think";
}

// Define ReAct graph with three nodes
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("think", think)          // Node1: Think (分析问题并决定下一步行动)
  .addNode("act", act)              // Node2: Act (执行确定的行动)
  .addNode("observe", observe)      // Node3: Observe (处理行动结果)
  .addEdge("__start__", "think")    // Start with thinking
  .addEdge("think", "act")          // Think -> Act
  .addEdge("act", "observe")        // Act -> Observe
  .addConditionalEdges("observe", shouldContinue); // Observe decides next step

// Finally, we compile it into a LangChain Runnable.
const app = workflow.compile();

async function main() {
  console.log("Generating Final ReAct Pattern Visualization...");
  
  // Get the graph representation
  const rep = app.getGraph();
  
  // Generate Mermaid diagram
  const mermaid = await rep.drawMermaid();
  console.log("Final ReAct Mermaid diagram generated!");
  
  // Save to file
  await import("node:fs/promises").then(fs => fs.writeFile("final_react_graph.mmd", mermaid));
  console.log("Saved to final_react_graph.mmd");
  
  // Print the Mermaid diagram to console
  console.log("\n=== FINAL REACT MERMAID DIAGRAM ===");
  console.log(mermaid);
  console.log("\n=== END DIAGRAM ===");
  
  console.log("\n✅ ReAct Pattern Successfully Implemented:");
  console.log("1. THINK: LLM analyzes input and decides next action");
  console.log("2. ACT: Execute search tools or provide direct response");
  console.log("3. OBSERVE: Process results and decide if more thinking needed");
  console.log("4. Loop back to THINK if search results found, otherwise END");
  
  console.log("\n🔄 Flow matches Python ReAct implementation:");
  console.log("- Think -> Act -> Observe -> (loop or end)");
  console.log("- Uses SEARCH: and ANSWER: prefixes for decision making");
  console.log("- Direct tool invocation without LangGraph tool calling");
}

main().catch(console.error);


