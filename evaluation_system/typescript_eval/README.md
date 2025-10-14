# TypeScript Evaluation System

## Quick Start

```bash
# Run simplified evaluator (recommended)
npx tsx automated_evaluator_simple.mts

# Run full evaluator (requires better-sqlite3)
npx tsx automated_evaluator.mts
```

## Files

- `automated_evaluator.mts` - Full TypeScript evaluator
- `automated_evaluator_simple.mts` - Simplified version (no better-sqlite3 dependency)

## Usage

The TypeScript evaluators automatically load tasks from `../datasets/evaluation_dataset.jsonl` and generate results.

## Documentation

See `../docs/README_evaluation.md` for complete documentation.
