// ToT LangGraph Agent
// Tree of Thoughts: Expand -> Evaluate -> Select

// IMPORTANT - Add your API keys here. Be careful not to publish them.
// Replace with your actual API keys
process.env.OPENAI_API_KEY = "your-openai-api-key-here";

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Create model for ToT reasoning
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
});

// Node 1: Expand - Generate multiple candidate solutions
async function expand(state: typeof MessagesAnnotation.State) {
  console.log("\n🌳 [EXPAND] Generating multiple candidate solutions...");
  
  const systemPrompt = `You are a Tree of Thoughts agent. Generate multiple diverse approaches to solve the given problem.
  
  Rules:
  1. Generate exactly 3 different approaches
  2. Each approach should be a complete solution path
  3. Make approaches diverse and creative
  4. Consider different strategies, perspectives, or methods
  
  Format your response as a JSON array of solution approaches:
  ["approach1", "approach2", "approach3"]`;

  const userPrompt = `Problem: ${state.messages[state.messages.length - 1].content}
  
  Generate 3 different solution approaches:`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    const response = await model.invoke(messages);
    const content = response.content as string;
    
    // Parse JSON response
    let candidates: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        candidates = parsed.slice(0, 3);
      }
    } catch {
      // Fallback: extract approaches from text
      const lines = content.split('\n').filter(line => line.trim());
      candidates = lines.slice(0, 3);
    }
    
    console.log(`✅ [EXPAND] Generated ${candidates.length} candidates`);
    candidates.forEach((candidate, i) => {
      console.log(`  ${i + 1}. ${candidate.substring(0, 100)}...`);
    });
    
    return { 
      messages: [...state.messages, new AIMessage(`Generated ${candidates.length} candidate solutions: ${candidates.join('; ')}`)]
    };
  } catch (error) {
    console.log("❌ [EXPAND] Error generating candidates:", error);
    return { 
      messages: [...state.messages, new AIMessage(`Error generating candidates: ${error}`)]
    };
  }
}

// Node 2: Evaluate - Score and filter candidates
async function evaluate(state: typeof MessagesAnnotation.State) {
  console.log("\n📊 [EVALUATE] Scoring and filtering candidates...");
  
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
    
    console.log(`✅ [EVALUATE] Evaluated candidates`);
    console.log("📊 Evaluation:", content);
    
    return { 
      messages: [...state.messages, new AIMessage(`Evaluation: ${content}`)]
    };
  } catch (error) {
    console.log("❌ [EVALUATE] Error evaluating candidates:", error);
    return { 
      messages: [...state.messages, new AIMessage(`Error evaluating candidates: ${error}`)]
    };
  }
}

// Node 3: Select - Choose the best candidate
async function select(state: typeof MessagesAnnotation.State) {
  console.log("\n🎯 [SELECT] Choosing the best candidate...");
  
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
    
    console.log(`✅ [SELECT] Selected best candidate`);
    console.log("🏆 Best solution:", content);
    
    return { 
      messages: [...state.messages, new AIMessage(`Selected best solution: ${content}`)]
    };
  } catch (error) {
    console.log("❌ [SELECT] Error selecting candidate:", error);
    return { 
      messages: [...state.messages, new AIMessage(`Error selecting candidate: ${error}`)]
    };
  }
}

// Routing function to determine next step
function shouldContinue(state: typeof MessagesAnnotation.State) {
  console.log("\n🛤️ [ROUTING] Determining next step...");
  
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  
  if (content.includes("Selected best solution:")) {
    console.log("🏁 [ROUTING] Best candidate selected - ending");
    return "__end__";
  }
  
  if (content.includes("Evaluation:")) {
    console.log("🎯 [ROUTING] Evaluations ready - proceeding to select");
    return "select";
  }
  
  if (content.includes("Generated") && content.includes("candidate solutions")) {
    console.log("📊 [ROUTING] Candidates ready - proceeding to evaluate");
    return "evaluate";
  }
  
  console.log("🔄 [ROUTING] No candidates - proceeding to expand");
  return "expand";
}

// Define ToT graph with three nodes
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("expand", expand)        // Node1: Expand (generate multiple candidates)
  .addNode("evaluate", evaluate)    // Node2: Evaluate (score and filter)
  .addNode("select", select)        // Node3: Select (choose best)
  .addEdge("__start__", "expand")   // Start with expanding
  .addConditionalEdges("expand", shouldContinue)    // Expand -> Evaluate
  .addConditionalEdges("evaluate", shouldContinue)  // Evaluate -> Select
  .addConditionalEdges("select", shouldContinue);   // Select -> End

// Compile the graph
const app = workflow.compile();

// Export the app for use in other modules
export { app };

// Demo usage
console.log("🌳 Starting ToT LangGraph Agent Demo");
console.log("=".repeat(50));

console.log("\n📋 Problem: How to solve climate change?");
console.log("-".repeat(30));

const finalState = await app.invoke({
  messages: [new HumanMessage("How to solve climate change?")]
});

console.log("\n🎯 Final Best Solution:", finalState.messages[finalState.messages.length - 1].content);