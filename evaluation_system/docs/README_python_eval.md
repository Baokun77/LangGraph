# Python Agent Evaluation System

A comprehensive evaluation framework for testing AI agents with accuracy, latency, and cost metrics.

## Features

- **Three Core Metrics**: Accuracy, Latency, Cost
- **Multiple Task Types**: Factual Q&A, Tool Usage, Multi-step Reasoning
- **Command Line Interface**: Easy to run with different agents and task suites
- **Detailed Reporting**: CSV output with per-task breakdown and summary statistics

## Files

### Core Files
- `eval.py` - Main evaluation script
- `baseline.jsonl` - 15-task baseline test suite
- `requirements.txt` - Python dependencies
- `test_eval.py` - Test script to verify functionality

### Task Suite Format
Each task in the JSONL file has:
```json
{
  "id": 1,
  "task": "What is the capital of France?",
  "expected": "Paris",
  "eval_type": "factual",
  "metadata": {
    "evidence_snippet": "capital of France"
  }
}
```

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up API keys in `eval.py`:
```python
OPENAI_API_KEY = "your-actual-openai-key"
TAVILY_API_KEY = "your-actual-tavily-key"
```

## Usage

### Basic Usage
```bash
python eval.py --agent=react --suite=baseline.jsonl
```

### With Custom Output
```bash
python eval.py --agent=react --suite=baseline.jsonl --output=my_results.csv
```

### Command Line Options
- `--agent`: Agent to evaluate (react, tot, reflect)
- `--suite`: Task suite file (JSONL format)
- `--output`: Output CSV file (default: evaluation_results.csv)

## Task Types

### 1. Factual Q&A
- **Evaluation**: Exact string matching + citation hit rate
- **Accuracy**: 1.0 for exact match, 0.5 for citation hit, 0.0 otherwise
- **Metadata**: `evidence_snippet` for citation tracking

### 2. Tool Usage
- **Evaluation**: Search invocation + structured output validation
- **Accuracy**: 1.0 if tool invoked and required fields present, 0.0 otherwise
- **Metadata**: `required_fields` list, optional `tolerance` for numeric values

### 3. Multi-step Reasoning
- **Evaluation**: LLM-based assessment of logical steps
- **Accuracy**: 0.0-1.0 based on LLM judgment of reasoning correctness
- **Metadata**: `key_steps` and `intermediate_values` for validation

## Output

### Console Summary
```
📊 EVALUATION SUMMARY
============================================================
Total Tasks: 15
Successful Tasks: 12
Success Rate: 80.0%
Average Accuracy: 0.850
Total Latency: 45.2s
Average Latency: 3.01s
Total Cost: $0.023456
Average Cost: $0.001564

📈 Performance by Task Type:
| Task Type | Count | Success Rate | Avg Accuracy | Avg Latency | Avg Cost |
|-----------|-------|--------------|--------------|-------------|----------|
| factual   |     5 |         100.0% |        1.000 |       2.50s | $0.001200 |
| tool      |     5 |          80.0% |        0.800 |       4.20s | $0.002100 |
| reasoning |     5 |          60.0% |        0.750 |       2.30s | $0.001156 |
```

### CSV Output
Detailed per-task results with columns:
- Task ID, Task Type, Question, Agent
- Success, Accuracy, Latency, Cost
- Response, Error (if any)

## Testing

Run the test suite to verify everything works:
```bash
python test_eval.py
```

Expected output:
```
Running evaluation system tests
==================================================
Testing task loading...
Loaded 15 tasks
First task: What is the capital of France?
Expected: Paris
Type: factual

Testing evaluator functions...
Factual evaluation: success=True, accuracy=1.0
Tool evaluation: success=True, accuracy=1.0

Testing baseline suite...
Task distribution: {'factual': 5, 'tool': 5, 'reasoning': 5}
All task types present

Test Results: 3/3 passed
All tests passed! The evaluation system is ready.
```

## Agent Implementation

### ReAct Agent
- **Think**: Analyzes question and decides to answer or search
- **Act**: Executes search or provides direct answer
- **Observe**: Processes results and continues if needed

### Cost Tracking
- Tracks OpenAI API usage (prompt + completion tokens)
- Calculates costs based on current gpt-4o-mini pricing
- Provides per-task and total cost breakdown

### Latency Measurement
- Measures end-to-end response time
- Includes API calls, search operations, and processing
- Reports both individual and average latencies

## Extending the System

### Adding New Agents
1. Create agent class with `run(question)` method
2. Add to agent selection in `run_evaluation()`
3. Update command line help text

### Adding New Task Types
1. Add evaluation function to `Evaluator` class
2. Update `run_evaluation()` to handle new type
3. Create sample tasks in JSONL format

### Custom Task Suites
Create new JSONL files with your own tasks following the format:
```json
{"id": 1, "task": "Your question", "expected": "Expected answer", "eval_type": "factual", "metadata": {...}}
```

## Example Results

The system provides comprehensive metrics for agent performance analysis:

- **Accuracy**: How often the agent gets the right answer
- **Latency**: How fast the agent responds
- **Cost**: How much the agent costs to run

This enables comparison between different agents and optimization of performance vs. cost trade-offs.
