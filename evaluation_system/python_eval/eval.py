#!/usr/bin/env python3
"""
Automated Agent Evaluation Script
Usage: python eval.py --agent=react --suite=baseline.jsonl
"""

import json
import time
import argparse
import csv
import os
import sys
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import requests
import openai
from datetime import datetime

# Configuration
OPENAI_API_KEY = "your-openai-api-key-here"
TAVILY_API_KEY = "your-tavily-api-key-here"

# Set up API keys
openai.api_key = OPENAI_API_KEY
os.environ["TAVILY_API_KEY"] = TAVILY_API_KEY

@dataclass
class Task:
    id: int
    task: str
    expected: str
    eval_type: str
    metadata: Dict[str, Any]

@dataclass
class EvaluationResult:
    task_id: int
    task_type: str
    question: str
    agent: str
    success: bool
    response: str
    accuracy: float
    latency: float
    cost: float
    error: str = ""

class ReActAgent:
    """Simple ReAct agent implementation"""
    
    def __init__(self):
        self.model = "gpt-4o-mini"
        self.total_tokens = 0
        self.total_cost = 0.0
    
    def search(self, query: str) -> str:
        """Search using Tavily API"""
        try:
            url = "https://api.tavily.com/search"
            payload = {
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "basic",
                "max_results": 3
            }
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                results = response.json()
                return json.dumps(results.get("results", []))
            else:
                return f"Search error: {response.status_code}"
        except Exception as e:
            return f"Search error: {str(e)}"
    
    def call_llm(self, messages: List[Dict[str, str]]) -> Tuple[str, int, float]:
        """Call OpenAI API and track tokens/cost"""
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=messages,
                temperature=0,
                max_tokens=1000
            )
            
            # Calculate cost (approximate for gpt-4o-mini)
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens
            
            # Cost calculation for gpt-4o-mini (as of 2024)
            prompt_cost = prompt_tokens * 0.00015 / 1000  # $0.15 per 1M tokens
            completion_cost = completion_tokens * 0.0006 / 1000  # $0.60 per 1M tokens
            total_cost = prompt_cost + completion_cost
            
            self.total_tokens += total_tokens
            self.total_cost += total_cost
            
            return response.choices[0].message.content, total_tokens, total_cost
            
        except Exception as e:
            return f"LLM error: {str(e)}", 0, 0.0
    
    def run(self, question: str) -> Tuple[str, float, float]:
        """Run ReAct agent on a question"""
        start_time = time.time()
        
        # Think step
        think_prompt = f"""You are a ReAct agent. Analyze this question and decide:
1. Can you answer directly? Respond with "ANSWER: [your answer]"
2. Do you need to search? Respond with "SEARCH: [search query]"

Question: {question}"""
        
        messages = [{"role": "user", "content": think_prompt}]
        thought, tokens1, cost1 = self.call_llm(messages)
        
        if "SEARCH:" in thought:
            # Extract search query
            search_query = thought.split("SEARCH:")[1].strip()
            search_results = self.search(search_query)
            
            # Act step - process search results
            act_prompt = f"""Based on the search results, provide a complete answer to the question.

Question: {question}
Search Results: {search_results}

Provide a clear, accurate answer:"""
            
            messages = [{"role": "user", "content": act_prompt}]
            response, tokens2, cost2 = self.call_llm(messages)
            
        elif "ANSWER:" in thought:
            response = thought.split("ANSWER:")[1].strip()
            tokens2, cost2 = 0, 0.0
        else:
            response = thought
            tokens2, cost2 = 0, 0.0
        
        end_time = time.time()
        latency = end_time - start_time
        
        return response, latency, self.total_cost

class Evaluator:
    """Evaluation engine for different task types"""
    
    def __init__(self):
        self.llm_client = openai
    
    def evaluate_factual(self, response: str, expected: str, evidence_snippet: str = None) -> Tuple[bool, float]:
        """Evaluate factual Q&A with exact match and citation hit"""
        normalized_response = response.lower().strip()
        normalized_expected = expected.lower().strip()
        
        exact_match = normalized_expected in normalized_response
        citation_hit = evidence_snippet and evidence_snippet.lower() in normalized_response
        
        # Accuracy: 1.0 for exact match, 0.5 for citation hit only, 0.0 otherwise
        if exact_match:
            accuracy = 1.0
        elif citation_hit:
            accuracy = 0.5
        else:
            accuracy = 0.0
            
        return exact_match, accuracy
    
    def evaluate_tool(self, response: str, required_fields: List[str], tolerance: float = None) -> Tuple[bool, float]:
        """Evaluate tool usage tasks"""
        # Check if search was invoked
        tool_invoked = "search" in response.lower() or "{" in response
        
        # Check if required fields are present
        fields_present = all(field.lower() in response.lower() for field in required_fields)
        
        # Check tolerance for numeric values
        within_tolerance = True
        if tolerance is not None:
            import re
            numbers = re.findall(r'\d+\.?\d*', response)
            within_tolerance = len(numbers) > 0
        
        success = tool_invoked and fields_present and within_tolerance
        accuracy = 1.0 if success else 0.0
        
        return success, accuracy
    
    def evaluate_reasoning(self, response: str, key_steps: List[str], intermediate_values: List[str]) -> Tuple[bool, float]:
        """Evaluate multi-step reasoning using LLM"""
        try:
            prompt = f"""Evaluate if this reasoning response contains the required logical steps and intermediate values.

Response: "{response}"

Required key steps: {', '.join(key_steps)}
Required intermediate values: {', '.join(intermediate_values)}

Analyze and respond with JSON:
{{
  "keyStepsFound": ["step1", "step2"],
  "intermediateValuesFound": ["value1", "value2"],
  "reasoningCorrect": true/false,
  "accuracy": 0.0-1.0
}}"""
            
            messages = [{"role": "user", "content": prompt}]
            response_obj = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0,
                max_tokens=200
            )
            
            result = json.loads(response_obj.choices[0].message.content)
            success = result.get("reasoningCorrect", False)
            accuracy = result.get("accuracy", 0.0)
            
            return success, accuracy
            
        except Exception as e:
            print(f"Reasoning evaluation error: {e}")
            return False, 0.0

def load_tasks(file_path: str) -> List[Task]:
    """Load tasks from JSONL file"""
    tasks = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data = json.loads(line)
                task = Task(
                    id=data['id'],
                    task=data['task'],
                    expected=data['expected'],
                    eval_type=data['eval_type'],
                    metadata=data['metadata']
                )
                tasks.append(task)
    return tasks

def run_evaluation(agent_name: str, suite_file: str) -> List[EvaluationResult]:
    """Run evaluation on specified agent and task suite"""
    print(f"🚀 Starting evaluation: {agent_name} on {suite_file}")
    print("=" * 60)
    
    # Load tasks
    tasks = load_tasks(suite_file)
    print(f"📋 Loaded {len(tasks)} tasks")
    
    # Initialize agent
    if agent_name.lower() == "react":
        agent = ReActAgent()
    else:
        raise ValueError(f"Unknown agent: {agent_name}")
    
    # Initialize evaluator
    evaluator = Evaluator()
    
    results = []
    
    # Run evaluation
    for i, task in enumerate(tasks, 1):
        print(f"\n📋 Task {i}/{len(tasks)}: {task.eval_type.upper()}")
        print(f"❓ Question: {task.task}")
        print("-" * 40)
        
        try:
            # Run agent
            response, latency, cost = agent.run(task.task)
            
            # Evaluate based on task type
            if task.eval_type == "factual":
                success, accuracy = evaluator.evaluate_factual(
                    response, 
                    task.expected, 
                    task.metadata.get("evidence_snippet")
                )
            elif task.eval_type == "tool":
                success, accuracy = evaluator.evaluate_tool(
                    response,
                    task.metadata.get("required_fields", []),
                    task.metadata.get("tolerance")
                )
            elif task.eval_type == "reasoning":
                success, accuracy = evaluator.evaluate_reasoning(
                    response,
                    task.metadata.get("key_steps", []),
                    task.metadata.get("intermediate_values", [])
                )
            else:
                success, accuracy = False, 0.0
            
            result = EvaluationResult(
                task_id=task.id,
                task_type=task.eval_type,
                question=task.task,
                agent=agent_name,
                success=success,
                response=response,
                accuracy=accuracy,
                latency=latency,
                cost=cost
            )
            
            print(f"✅ Success: {success}, Accuracy: {accuracy:.2f}, Time: {latency:.2f}s, Cost: ${cost:.6f}")
            
        except Exception as e:
            result = EvaluationResult(
                task_id=task.id,
                task_type=task.eval_type,
                question=task.task,
                agent=agent_name,
                success=False,
                response="",
                accuracy=0.0,
                latency=0.0,
                cost=0.0,
                error=str(e)
            )
            print(f"❌ Error: {e}")
        
        results.append(result)
    
    return results

def save_results(results: List[EvaluationResult], output_file: str):
    """Save results to CSV"""
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Task ID', 'Task Type', 'Question', 'Agent', 'Success', 
            'Accuracy', 'Latency', 'Cost', 'Response', 'Error'
        ])
        
        for result in results:
            writer.writerow([
                result.task_id,
                result.task_type,
                result.question,
                result.agent,
                result.success,
                result.accuracy,
                result.latency,
                result.cost,
                result.response,
                result.error
            ])
    
    print(f"\n💾 Results saved to {output_file}")

def print_summary(results: List[EvaluationResult]):
    """Print evaluation summary"""
    if not results:
        return
    
    total_tasks = len(results)
    successful_tasks = sum(1 for r in results if r.success)
    total_accuracy = sum(r.accuracy for r in results) / total_tasks
    total_latency = sum(r.latency for r in results)
    total_cost = sum(r.cost for r in results)
    
    print("\n📊 EVALUATION SUMMARY")
    print("=" * 60)
    print(f"Total Tasks: {total_tasks}")
    print(f"Successful Tasks: {successful_tasks}")
    print(f"Success Rate: {(successful_tasks/total_tasks)*100:.1f}%")
    print(f"Average Accuracy: {total_accuracy:.3f}")
    print(f"Total Latency: {total_latency:.2f}s")
    print(f"Average Latency: {total_latency/total_tasks:.2f}s")
    print(f"Total Cost: ${total_cost:.6f}")
    print(f"Average Cost: ${total_cost/total_tasks:.6f}")
    
    # By task type
    task_types = {}
    for result in results:
        if result.task_type not in task_types:
            task_types[result.task_type] = []
        task_types[result.task_type].append(result)
    
    print("\n📈 Performance by Task Type:")
    print("| Task Type | Count | Success Rate | Avg Accuracy | Avg Latency | Avg Cost |")
    print("|-----------|-------|--------------|--------------|-------------|----------|")
    
    for task_type, type_results in task_types.items():
        count = len(type_results)
        success_count = sum(1 for r in type_results if r.success)
        success_rate = (success_count/count)*100
        avg_accuracy = sum(r.accuracy for r in type_results) / count
        avg_latency = sum(r.latency for r in type_results) / count
        avg_cost = sum(r.cost for r in type_results) / count
        
        print(f"| {task_type:10} | {count:5} | {success_rate:11.1f}% | {avg_accuracy:12.3f} | {avg_latency:11.2f}s | ${avg_cost:8.6f} |")

def main():
    parser = argparse.ArgumentParser(description='Automated Agent Evaluation')
    parser.add_argument('--agent', required=True, help='Agent to evaluate (react, tot, reflect)')
    parser.add_argument('--suite', required=True, help='Task suite file (JSONL format)')
    parser.add_argument('--output', default='evaluation_results.csv', help='Output CSV file')
    
    args = parser.parse_args()
    
    # Check if suite file exists
    if not os.path.exists(args.suite):
        print(f"❌ Error: Suite file '{args.suite}' not found")
        sys.exit(1)
    
    # Run evaluation
    try:
        results = run_evaluation(args.agent, args.suite)
        save_results(results, args.output)
        print_summary(results)
        
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
