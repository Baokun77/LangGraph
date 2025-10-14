#!/usr/bin/env python3
"""
Demo script showing the evaluation system in action
"""

import subprocess
import sys
import os

def run_demo():
    """Run a demonstration of the evaluation system"""
    print("Python Agent Evaluation System Demo")
    print("=" * 50)
    
    # Check if files exist
    required_files = ['eval.py', 'baseline.jsonl', 'test_eval.py']
    for file in required_files:
        if not os.path.exists(file):
            print(f"Error: {file} not found")
            return False
    
    print("All required files found")
    
    # Run tests
    print("\n1. Running system tests...")
    try:
        result = subprocess.run([sys.executable, 'test_eval.py'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("Tests passed")
            print("Test output:")
            print(result.stdout)
        else:
            print("Tests failed")
            print("Error output:")
            print(result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print("Tests timed out")
        return False
    except Exception as e:
        print(f"Test error: {e}")
        return False
    
    # Show help
    print("\n2. Showing command line help...")
    try:
        result = subprocess.run([sys.executable, 'eval.py', '--help'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print("Help command works")
            print("Help output:")
            print(result.stdout)
        else:
            print("Help command failed")
            return False
    except Exception as e:
        print(f"Help error: {e}")
        return False
    
    # Show task suite
    print("\n3. Showing task suite structure...")
    try:
        with open('baseline.jsonl', 'r') as f:
            lines = f.readlines()
            print(f"Task suite loaded: {len(lines)} tasks")
            
            # Show first few tasks
            print("\nFirst 3 tasks:")
            for i, line in enumerate(lines[:3]):
                import json
                task = json.loads(line)
                print(f"  {i+1}. {task['task']} (Type: {task['eval_type']})")
    except Exception as e:
        print(f"Error reading task suite: {e}")
        return False
    
    print("\n4. System ready for evaluation!")
    print("\nTo run a full evaluation (requires API keys):")
    print("  python eval.py --agent=react --suite=baseline.jsonl")
    print("\nTo run with custom output:")
    print("  python eval.py --agent=react --suite=baseline.jsonl --output=my_results.csv")
    
    return True

if __name__ == "__main__":
    success = run_demo()
    if not success:
        sys.exit(1)
    print("\nDemo completed successfully!")
