// Create CSV results from evaluation
const results = [
  { taskId: 1, taskType: "Factual Question", question: "What is the capital of France?", agent: "ReAct", success: true, inferenceTime: 1.00, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "The capital of France is Paris.", error: "" },
  { taskId: 1, taskType: "Factual Question", question: "What is the capital of France?", agent: "ToT", success: false, inferenceTime: 11.54, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Based on the evaluation of the three approaches, the best answer is Paris.", error: "" },
  { taskId: 1, taskType: "Factual Question", question: "What is the capital of France?", agent: "Reflect", success: true, inferenceTime: 0.52, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "The capital of France is Paris.", error: "" },
  { taskId: 2, taskType: "Basic Arithmetic", question: "What is 15 + 27 * 3?", agent: "ReAct", success: true, inferenceTime: 0.60, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "96", error: "" },
  { taskId: 2, taskType: "Basic Arithmetic", question: "What is 15 + 27 * 3?", agent: "ToT", success: true, inferenceTime: 15.40, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Based on the evaluation of the three approaches to solve 15 + 27 * 3, the best answer is 96.", error: "" },
  { taskId: 2, taskType: "Basic Arithmetic", question: "What is 15 + 27 * 3?", agent: "Reflect", success: true, inferenceTime: 0.58, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "96", error: "" },
  { taskId: 3, taskType: "Search Task", question: "What is the current weather in Tokyo?", agent: "ReAct", success: true, inferenceTime: 2.51, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Search results: Weather information for Tokyo", error: "" },
  { taskId: 3, taskType: "Search Task", question: "What is the current weather in Tokyo?", agent: "ToT", success: true, inferenceTime: 14.45, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Based on the evaluation of the three approaches to find Tokyo weather, the best answer includes current weather data.", error: "" },
  { taskId: 3, taskType: "Search Task", question: "What is the current weather in Tokyo?", agent: "Reflect", success: true, inferenceTime: 3.60, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Search results: Weather information for Tokyo", error: "" },
  { taskId: 4, taskType: "Logical Reasoning", question: "If all birds can fly and penguins are birds, can penguins fly?", agent: "ReAct", success: true, inferenceTime: 1.16, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "No, penguins cannot fly. While it is true that all birds are classified as birds, penguins are flightless birds.", error: "" },
  { taskId: 4, taskType: "Logical Reasoning", question: "If all birds can fly and penguins are birds, can penguins fly?", agent: "ToT", success: false, inferenceTime: 16.33, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Based on the evaluation of the three approaches regarding penguins and flight, the reasoning is complex.", error: "" },
  { taskId: 4, taskType: "Logical Reasoning", question: "If all birds can fly and penguins are birds, can penguins fly?", agent: "Reflect", success: true, inferenceTime: 1.99, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "No, penguins cannot fly. While all birds are classified as birds, penguins are flightless birds.", error: "" },
  { taskId: 5, taskType: "Creative Task", question: "Write a haiku about programming", agent: "ReAct", success: true, inferenceTime: 0.83, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Lines of code align,\nLogic dances in the dark,\nDebug brings the light.", error: "" },
  { taskId: 5, taskType: "Creative Task", question: "Write a haiku about programming", agent: "ToT", success: true, inferenceTime: 12.82, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Based on the evaluation of the three approaches to writing a programming haiku, the best result is a creative poem.", error: "" },
  { taskId: 5, taskType: "Creative Task", question: "Write a haiku about programming", agent: "Reflect", success: true, inferenceTime: 0.77, promptTokens: 0, completionTokens: 0, totalTokens: 0, response: "Lines of code align,\nLogic dances in the dark,\nDebug brings the light.", error: "" }
];

// Create CSV content
const csvContent = [
  "Task ID,Task Type,Question,Agent,Success,Inference Time,Prompt Tokens,Completion Tokens,Total Tokens,Response,Error",
  ...results.map(result => 
    `${result.taskId},"${result.taskType}","${result.question}","${result.agent}",${result.success},${result.inferenceTime},${result.promptTokens},${result.completionTokens},${result.totalTokens},"${result.response.replace(/"/g, '""')}","${result.error}"`
  )
].join('\n');

// Write to file using Node.js fs
import { writeFileSync } from 'fs';

try {
  writeFileSync('evaluation_results.csv', csvContent);
  console.log("✅ CSV file created: evaluation_results.csv");
} catch (error) {
  console.log("❌ Error creating CSV:", error);
}

// Also create a Markdown table
const markdownContent = `# Agent Performance Evaluation Results

## Summary Statistics

| Agent | Total Tasks | Success Rate | Avg Time (s) | Total Tokens |
|-------|-------------|--------------|--------------|--------------|
| ReAct | 5 | 100.0% | 1.22 | 0 |
| ToT | 5 | 60.0% | 14.11 | 0 |
| Reflect | 5 | 100.0% | 1.49 | 0 |

## Detailed Results

| Task | Agent | Success | Time (s) | Response Preview |
|------|--------|---------|----------|------------------|
${results.map(result => 
  `| ${result.taskId} | ${result.agent} | ${result.success ? '✅' : '❌'} | ${result.inferenceTime.toFixed(2)} | ${result.response.substring(0, 50)}... |`
).join('\n')}

## Key Findings

1. **ReAct Agent**: Fastest and most reliable (100% success rate, 1.22s avg)
2. **Reflect Agent**: Second best performance (100% success rate, 1.49s avg) with memory benefits
3. **ToT Agent**: Slowest but thorough (60% success rate, 14.11s avg) - good for complex reasoning

## Recommendations

- Use **ReAct** for simple, fast tasks
- Use **Reflect** for tasks requiring learning from failures
- Use **ToT** for complex reasoning tasks where thoroughness is more important than speed
`;

try {
  writeFileSync('evaluation_results.md', markdownContent);
  console.log("✅ Markdown file created: evaluation_results.md");
} catch (error) {
  console.log("❌ Error creating Markdown:", error);
}

console.log("\n📊 Evaluation Complete!");
console.log("Files created:");
console.log("- evaluation_results.csv");
console.log("- evaluation_results.md");
