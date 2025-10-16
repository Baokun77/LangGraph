# Ablation Study Framework

This framework provides a comprehensive comparison of ReAct, ToT, and Reflect agents with configurable parameters.

## Features

### Agent Configurations
- **ReAct**: Baseline agent (think → act → observe)
- **ToT**: Tree of Thoughts with configurable width (B ∈ {2,3,5}) and depth (D ∈ {2,3})
- **Reflect**: Reflection agent with configurable reflection rounds (R ∈ {0,1,2})

### Evaluation Metrics
- **Success@Strict**: Exact match with expected answers
- **Success@Lenient**: Partial match with expected answers
- **Latency**: P50, P95, and average response times
- **Cost**: Average cost per request (based on token usage)
- **Tool Calls**: Average number of tool calls per request

### Task Categories
- Factual questions (3 tasks)
- Arithmetic problems (3 tasks)
- Search tasks (3 tasks)
- Logical reasoning (3 tasks)
- Creative tasks (3 tasks)
- Complex multi-step problems (3 tasks)
- Error handling (2 tasks)
- Edge cases (3 tasks)
- Technical questions (3 tasks)
- Business questions (3 tasks)
- Science questions (3 tasks)

## Usage

### Quick Start
```bash
# Run the complete ablation study
deno run --allow-net --allow-write run_ablation.mts
```

### Configuration
Edit `ablation_config.json` to adjust:
- Number of runs per configuration (default: 30)
- Task distribution
- Agent configurations
- Model settings
- Metrics to track

### Results Structure
Results are saved in `runs/<date>/`:
```
runs/
└── 2024-01-15/
    ├── react_default.jsonl
    ├── tot_B2_D2.jsonl
    ├── tot_B2_D3.jsonl
    ├── tot_B3_D2.jsonl
    ├── tot_B3_D3.jsonl
    ├── tot_B5_D2.jsonl
    ├── tot_B5_D3.jsonl
    ├── reflect_R0.jsonl
    ├── reflect_R1.jsonl
    ├── reflect_R2.jsonl
    ├── aggregated_results.json
    └── results_summary.md
```

## Configuration Details

### ToT Ablation
- **Width (B)**: Number of candidate solutions generated
  - B=2: Generate 2 candidates
  - B=3: Generate 3 candidates  
  - B=5: Generate 5 candidates
- **Depth (D)**: Number of thinking steps
  - D=2: 2-step process (expand → select)
  - D=3: 3-step process (expand → evaluate → select)

### Reflect Ablation
- **Reflection Rounds (R)**: Number of retry attempts
  - R=0: No reflection (baseline)
  - R=1: One reflection round
  - R=2: Two reflection rounds

## Expected Output

The study will generate:
1. **Individual Results**: JSONL files for each agent configuration
2. **Aggregated Results**: JSON file with summary statistics
3. **Markdown Summary**: Human-readable results table with key findings

### Sample Results Table
| Agent | Config | Success@Strict | Success@Lenient | Avg Latency (s) | P50 Latency (s) | P95 Latency (s) | Avg Cost ($) | Avg Tool Calls |
|-------|--------|----------------|-----------------|-----------------|-----------------|-----------------|--------------|----------------|
| react | default | 45.2% | 67.8% | 2.34 | 2.12 | 3.45 | $0.0023 | 1.2 |
| tot | B2_D2 | 52.1% | 71.3% | 3.67 | 3.45 | 4.89 | $0.0045 | 0.8 |
| tot | B3_D3 | 58.7% | 76.2% | 5.23 | 4.98 | 6.78 | $0.0067 | 0.6 |
| reflect | R1 | 48.9% | 69.4% | 2.89 | 2.67 | 4.12 | $0.0034 | 1.5 |

## Requirements

- Deno runtime
- OpenAI API key
- Tavily API key (for search functionality)

## API Keys Setup

Add your API keys to the environment variables in the script files:
```typescript
process.env.OPENAI_API_KEY = "your-openai-api-key-here";
process.env.TAVILY_API_KEY = "your-tavily-api-key-here";
```

## Notes

- Each configuration runs 30 times on 32 different tasks (960 evaluations per config)
- Total evaluations: 10 configurations × 960 = 9,600 evaluations
- Estimated runtime: 2-4 hours depending on API response times
- Results include detailed error tracking and performance metrics
