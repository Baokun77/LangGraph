# Ablation Study Framework

This directory contains the comprehensive ablation study framework for comparing ReAct, ToT (Tree of Thoughts), and Reflect agents.

## Overview

The ablation study compares three different agent architectures:
- **ReAct**: Reasoning and Acting agent (baseline)
- **ToT**: Tree of Thoughts with configurable width and depth
- **Reflect**: Reflection-based agent with configurable reflection rounds

## Files

### Core Implementation
- `ablation_study.mts` - Full-featured ablation study with observability
- `clean_ablation.mts` - Simplified version without observability tracing
- `simple_ablation.mts` - Standalone implementation with minimal dependencies

### Configuration & Analysis
- `ablation_config.json` - Configuration file for study parameters
- `analyze_results.mts` - Results analysis and aggregation script
- `run_ablation.mts` - Main execution script

### Testing & Development
- `test_ablation.mts` - Quick test script
- `test_framework.mts` - Framework validation tests
- `standalone_test.mts` - Standalone test without API dependencies

### Documentation
- `ABLATION_README.md` - Detailed usage instructions
- `ABLATION_STUDY_SUMMARY.md` - Complete study summary and results

## Quick Start

1. **Set up environment variables** in `.env`:
   ```
   OPENAI_API_KEY=your-openai-key
   TAVILY_API_KEY=your-tavily-key  # Optional
   ```

2. **Run the clean ablation study**:
   ```bash
   deno run --allow-net --allow-write --allow-env --allow-read clean_ablation.mts
   ```

3. **Analyze results**:
   ```bash
   deno run --allow-net --allow-write --allow-env analyze_results.mts
   ```

## Study Configuration

### ToT Ablation Parameters
- **Width (branches)**: B ∈ {2, 3, 5}
- **Depth (thought steps)**: D ∈ {2, 3}

### Reflect Ablation Parameters
- **Reflection rounds**: R ∈ {0, 1, 2} (0 as control)

### Metrics Measured
- Success@Strict
- Success@Lenient
- P95/P50 Latency
- Average Cost/Request
- Tool Calls/Request

## Results

The study generates:
- Individual result files: `runs/<date>/<agent>_<cfg>.jsonl`
- Aggregated summary tables
- Performance analysis and rankings

## Notes

- The clean version (`clean_ablation.mts`) is recommended for production use
- Mock search functionality is available when Tavily API key is not provided
- All agents are implemented using LangGraph framework
- Results are saved in structured JSONL format for analysis
