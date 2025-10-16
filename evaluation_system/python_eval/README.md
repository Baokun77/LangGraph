# Python Evaluation System

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run evaluation
python eval.py --agent=react --suite=baseline.jsonl

# Run tests
python test_eval.py

# Run demo
python demo_eval.py
```

## Files

- `eval.py` - Main evaluation script
- `baseline.jsonl` - 15-task test suite
- `requirements.txt` - Dependencies
- `test_eval.py` - Test suite
- `demo_eval.py` - Demo script

## Usage

```bash
python eval.py --agent=react --suite=baseline.jsonl --output=results.csv
```

## Documentation

See `../docs/README_python_eval.md` for complete documentation.

