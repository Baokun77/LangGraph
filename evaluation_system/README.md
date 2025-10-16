# AI Agent Evaluation System

A comprehensive evaluation framework for testing AI agents with accuracy, latency, and cost metrics.

## 🎯 Quick Start

### Python Evaluation (Recommended)
```bash
cd python_eval
python eval.py --agent=react --suite=baseline.jsonl
```

### TypeScript Evaluation
```bash
cd typescript_eval
npx tsx automated_evaluator_simple.mts
```

## 📁 Directory Structure

```
evaluation_system/
├── README.md                    # This file
├── python_eval/                 # Python-based evaluation system
│   ├── eval.py                 # Main evaluation script
│   ├── baseline.jsonl          # 15-task test suite
│   ├── requirements.txt        # Python dependencies
│   ├── test_eval.py           # Test suite
│   └── demo_eval.py           # Demo script
├── typescript_eval/            # TypeScript-based evaluation system
│   ├── automated_evaluator.mts # Full TypeScript evaluator
│   └── automated_evaluator_simple.mts # Simplified version
├── datasets/                   # Task datasets and results
│   ├── evaluation_dataset.jsonl # 30-task comprehensive dataset
│   └── evaluation_results_auto.csv # Sample results
└── docs/                      # Documentation
    ├── README_python_eval.md   # Python system guide
    ├── README_evaluation.md    # TypeScript system guide
    └── EVALUATION_SYSTEM_SUMMARY.md # Implementation summary
```

## 🚀 Features

### Three Core Metrics
- **Accuracy**: Exact string matching, citation hit rates, LLM-based reasoning assessment
- **Latency**: End-to-end response time measurement
- **Cost**: Real-time API token tracking and cost calculation

### Task Types
- **Factual Q&A**: Knowledge-based questions with evidence tracking
- **Tool Usage**: Web search and structured output validation
- **Multi-step Reasoning**: Complex logical problems requiring step-by-step analysis

### Supported Agents
- **ReAct**: Reasoning and Acting agent
- **ToT**: Tree of Thoughts agent
- **Reflect**: Self-reflective agent

## 📊 Usage Examples

### Python System
```bash
# Basic evaluation
python eval.py --agent=react --suite=baseline.jsonl

# Custom output file
python eval.py --agent=react --suite=baseline.jsonl --output=my_results.csv

# Run tests
python test_eval.py

# Run demo
python demo_eval.py
```

### TypeScript System
```bash
# Run simplified evaluator
npx tsx automated_evaluator_simple.mts

# Run full evaluator (requires better-sqlite3)
npx tsx automated_evaluator.mts
```

## 🔧 Setup

### Python System
1. Install dependencies: `pip install -r requirements.txt`
2. Set API keys in `eval.py`
3. Run evaluation: `python eval.py --agent=react --suite=baseline.jsonl`

### TypeScript System
1. Install dependencies: `npm install`
2. Set API keys in evaluator files
3. Run evaluation: `npx tsx automated_evaluator_simple.mts`

## 📈 Expected Output

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
```

## 📚 Documentation

- [Python Evaluation Guide](docs/README_python_eval.md)
- [TypeScript Evaluation Guide](docs/README_evaluation.md)
- [Implementation Summary](docs/EVALUATION_SYSTEM_SUMMARY.md)

## 🧪 Testing

Both systems include comprehensive test suites:
- Python: `python test_eval.py`
- TypeScript: Built-in validation in evaluator files

## 🎯 Task Datasets

- **baseline.jsonl**: 15-task quick test suite (5 factual, 5 tool, 5 reasoning)
- **evaluation_dataset.jsonl**: 30-task comprehensive dataset (10 each type)

## 🔑 API Keys Required

- OpenAI API key for LLM calls
- Tavily API key for web search functionality

Set these in the respective evaluator files before running.

