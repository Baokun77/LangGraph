#!/usr/bin/env python3
"""
Test script for the evaluation system
"""

import json
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from eval import load_tasks, Evaluator

def test_load_tasks():
    """Test loading tasks from JSONL"""
    print("Testing task loading...")
    
    tasks = load_tasks('baseline.jsonl')
    print(f"Loaded {len(tasks)} tasks")
    
    # Check first task
    first_task = tasks[0]
    print(f"First task: {first_task.task}")
    print(f"Expected: {first_task.expected}")
    print(f"Type: {first_task.eval_type}")
    
    return True

def test_evaluator():
    """Test evaluation functions"""
    print("\nTesting evaluator functions...")
    
    evaluator = Evaluator()
    
    # Test factual evaluation
    response = "Paris is the capital of France"
    expected = "Paris"
    evidence = "capital of France"
    
    success, accuracy = evaluator.evaluate_factual(response, expected, evidence)
    print(f"Factual evaluation: success={success}, accuracy={accuracy}")
    
    # Test tool evaluation
    response = "Search results: {'temperature': '22°C', 'condition': 'sunny', 'location': 'Tokyo'}"
    required_fields = ["temperature", "condition", "location"]
    
    success, accuracy = evaluator.evaluate_tool(response, required_fields)
    print(f"Tool evaluation: success={success}, accuracy={accuracy}")
    
    return True

def test_baseline_suite():
    """Test the baseline suite structure"""
    print("\nTesting baseline suite...")
    
    tasks = load_tasks('baseline.jsonl')
    
    # Count by type
    type_counts = {}
    for task in tasks:
        type_counts[task.eval_type] = type_counts.get(task.eval_type, 0) + 1
    
    print(f"Task distribution: {type_counts}")
    
    # Verify we have all three types
    expected_types = ['factual', 'tool', 'reasoning']
    for task_type in expected_types:
        if task_type not in type_counts:
            print(f"Missing task type: {task_type}")
            return False
    
    print("All task types present")
    return True

def main():
    """Run all tests"""
    print("Running evaluation system tests")
    print("=" * 50)
    
    tests = [
        test_load_tasks,
        test_evaluator,
        test_baseline_suite
    ]
    
    passed = 0
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                print(f"Test failed: {test.__name__}")
        except Exception as e:
            print(f"Test error in {test.__name__}: {e}")
    
    print(f"\nTest Results: {passed}/{len(tests)} passed")
    
    if passed == len(tests):
        print("All tests passed! The evaluation system is ready.")
        print("\nUsage:")
        print("  python eval.py --agent=react --suite=baseline.jsonl")
        print("  python eval.py --agent=react --suite=baseline.jsonl --output=my_results.csv")
    else:
        print("Some tests failed. Please check the implementation.")
        sys.exit(1)

if __name__ == "__main__":
    main()
