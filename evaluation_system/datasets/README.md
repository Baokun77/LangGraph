# Evaluation Datasets

## Task Datasets

### baseline.jsonl
- **Location**: `../python_eval/baseline.jsonl`
- **Tasks**: 15 tasks (5 factual, 5 tool, 5 reasoning)
- **Purpose**: Quick testing and validation
- **Usage**: `python eval.py --agent=react --suite=baseline.jsonl`

### evaluation_dataset.jsonl
- **Location**: `evaluation_dataset.jsonl`
- **Tasks**: 30 tasks (10 factual, 10 tool, 10 reasoning)
- **Purpose**: Comprehensive evaluation
- **Usage**: TypeScript evaluators automatically load this file

## Results

### evaluation_results_auto.csv
- Sample results from TypeScript evaluator
- Shows expected output format
- Includes all evaluation metrics

## Task Format

Each task follows this JSON structure:
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

## Task Types

### Factual Q&A
- **eval_type**: "factual"
- **metadata**: `evidence_snippet` for citation tracking
- **evaluation**: Exact string matching + citation hit rate

### Tool Usage
- **eval_type**: "tool"
- **metadata**: `required_fields`, optional `tolerance`
- **evaluation**: Search invocation + structured output validation

### Multi-step Reasoning
- **eval_type**: "reasoning"
- **metadata**: `key_steps`, `intermediate_values`
- **evaluation**: LLM-based reasoning assessment

