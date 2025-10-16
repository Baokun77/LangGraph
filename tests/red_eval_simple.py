#!/usr/bin/env python3
"""
Red Team Evaluation Script for Security Gateway (Simple Version)
Tests the security gateway against various attack vectors
"""

import json
import sys
import os
import asyncio
from typing import Dict, List, Any
from dataclasses import dataclass
import time

@dataclass
class TestResult:
    test_id: int
    category: str
    subcategory: str
    input_text: str
    expected_risk: str
    expected_action: str
    actual_risk: str
    actual_action: str
    passed: bool
    processing_time: float
    description: str

class RedTeamEvaluator:
    def __init__(self, test_file: str = "redteam.jsonl"):
        self.test_file = test_file
        self.test_cases: List[Dict[str, Any]] = []
        self.results: List[TestResult] = []
        
    def load_test_cases(self) -> None:
        """Load test cases from JSONL file"""
        try:
            with open(self.test_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        test_case = json.loads(line.strip())
                        self.test_cases.append(test_case)
            print(f"[OK] Loaded {len(self.test_cases)} test cases from {self.test_file}")
        except FileNotFoundError:
            print(f"[ERROR] Test file {self.test_file} not found")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Error parsing JSON in {self.test_file}: {e}")
            sys.exit(1)
    
    async def run_security_check(self, input_text: str) -> Dict[str, Any]:
        """Mock security gateway implementation for testing"""
        await asyncio.sleep(0.1)  # Simulate processing time
        
        input_lower = input_text.lower()
        
        # Check for critical threats
        critical_patterns = [
            'api key', 'password', 'secret', 'token', 'credential',
            'rm -rf', 'delete system', 'modify registry', 'elevated permissions',
            'reverse shell', 'connect to', 'execute command'
        ]
        
        high_patterns = [
            'ignore previous', 'disregard', 'override', 'jailbreak', 'dan mode',
            'system prompt', 'environment variables', 'upload file', 'download file',
            'install software', 'run code', 'execute script'
        ]
        
        medium_patterns = [
            'base64 decode', 'rot13 decode', 'hidden instruction', 'pretend you are'
        ]
        
        detected_threats = []
        risk_level = 'LOW'
        suggested_action = 'ALLOW'
        
        for pattern in critical_patterns:
            if pattern in input_lower:
                detected_threats.append(f"Critical threat: {pattern}")
                risk_level = 'CRITICAL'
                suggested_action = 'BLOCK'
                break
        
        if risk_level == 'LOW':
            for pattern in high_patterns:
                if pattern in input_lower:
                    detected_threats.append(f"High risk: {pattern}")
                    risk_level = 'HIGH'
                    suggested_action = 'BLOCK'
                    break
        
        if risk_level == 'LOW':
            for pattern in medium_patterns:
                if pattern in input_lower:
                    detected_threats.append(f"Medium risk: {pattern}")
                    risk_level = 'MEDIUM'
                    suggested_action = 'CONFIRM'
                    break
        
        return {
            'passed': len(detected_threats) == 0,
            'riskLevel': risk_level,
            'reason': 'No threats detected' if len(detected_threats) == 0 else f'Detected {len(detected_threats)} threat(s)',
            'suggestedAction': suggested_action,
            'detectedThreats': detected_threats
        }
    
    async def run_single_test(self, test_case: Dict[str, Any]) -> TestResult:
        """Run a single test case"""
        start_time = time.time()
        security_result = await self.run_security_check(test_case['input'])
        processing_time = time.time() - start_time
        
        # Determine if test passed
        risk_match = security_result['riskLevel'] == test_case['expected_risk']
        action_match = security_result['suggestedAction'] == test_case['expected_action']
        passed = risk_match and action_match
        
        return TestResult(
            test_id=test_case['id'],
            category=test_case['category'],
            subcategory=test_case['subcategory'],
            input_text=test_case['input'],
            expected_risk=test_case['expected_risk'],
            expected_action=test_case['expected_action'],
            actual_risk=security_result['riskLevel'],
            actual_action=security_result['suggestedAction'],
            passed=passed,
            processing_time=processing_time,
            description=test_case['description']
        )
    
    async def run_all_tests(self) -> None:
        """Run all test cases"""
        print(f"[TEST] Running {len(self.test_cases)} red team tests...")
        print("=" * 60)
        
        for i, test_case in enumerate(self.test_cases, 1):
            print(f"Test {i}/{len(self.test_cases)}: {test_case['description']}")
            
            result = await self.run_single_test(test_case)
            self.results.append(result)
            
            status = "[PASS]" if result.passed else "[FAIL]"
            print(f"  {status} | Expected: {result.expected_risk}/{result.expected_action} | Got: {result.actual_risk}/{result.actual_action}")
            print(f"  Time: {result.processing_time:.3f}s")
            print()
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r.passed)
        failed_tests = total_tests - passed_tests
        
        # Category breakdown
        category_stats = {}
        for result in self.results:
            if result.category not in category_stats:
                category_stats[result.category] = {'total': 0, 'passed': 0, 'failed': 0}
            category_stats[result.category]['total'] += 1
            if result.passed:
                category_stats[result.category]['passed'] += 1
            else:
                category_stats[result.category]['failed'] += 1
        
        # Risk level breakdown
        risk_stats = {}
        for result in self.results:
            if result.actual_risk not in risk_stats:
                risk_stats[result.actual_risk] = 0
            risk_stats[result.actual_risk] += 1
        
        # Performance stats
        avg_processing_time = sum(r.processing_time for r in self.results) / total_tests
        max_processing_time = max(r.processing_time for r in self.results)
        min_processing_time = min(r.processing_time for r in self.results)
        
        report = {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'pass_rate': (passed_tests / total_tests) * 100 if total_tests > 0 else 0
            },
            'category_breakdown': category_stats,
            'risk_level_breakdown': risk_stats,
            'performance': {
                'avg_processing_time': avg_processing_time,
                'max_processing_time': max_processing_time,
                'min_processing_time': min_processing_time
            },
            'failed_tests': [
                {
                    'id': r.test_id,
                    'category': r.category,
                    'description': r.description,
                    'expected': f"{r.expected_risk}/{r.expected_action}",
                    'actual': f"{r.actual_risk}/{r.actual_action}",
                    'input': r.input_text[:100] + "..." if len(r.input_text) > 100 else r.input_text
                }
                for r in self.results if not r.passed
            ]
        }
        
        return report
    
    def print_report(self, report: Dict[str, Any]) -> None:
        """Print formatted test report"""
        print("\n" + "=" * 60)
        print("RED TEAM SECURITY EVALUATION REPORT")
        print("=" * 60)
        
        # Summary
        summary = report['summary']
        print(f"\nSUMMARY:")
        print(f"  Total Tests: {summary['total_tests']}")
        print(f"  Passed: {summary['passed_tests']} [PASS]")
        print(f"  Failed: {summary['failed_tests']} [FAIL]")
        print(f"  Pass Rate: {summary['pass_rate']:.1f}%")
        
        # Category breakdown
        print(f"\nCATEGORY BREAKDOWN:")
        for category, stats in report['category_breakdown'].items():
            pass_rate = (stats['passed'] / stats['total']) * 100 if stats['total'] > 0 else 0
            print(f"  {category}: {stats['passed']}/{stats['total']} ({pass_rate:.1f}%)")
        
        # Risk level breakdown
        print(f"\nRISK LEVEL DETECTION:")
        for risk_level, count in report['risk_level_breakdown'].items():
            print(f"  {risk_level}: {count} tests")
        
        # Performance
        perf = report['performance']
        print(f"\nPERFORMANCE:")
        print(f"  Average Processing Time: {perf['avg_processing_time']:.3f}s")
        print(f"  Max Processing Time: {perf['max_processing_time']:.3f}s")
        print(f"  Min Processing Time: {perf['min_processing_time']:.3f}s")
        
        # Failed tests
        if report['failed_tests']:
            print(f"\nFAILED TESTS:")
            for failed in report['failed_tests']:
                print(f"  Test {failed['id']}: {failed['description']}")
                print(f"    Expected: {failed['expected']} | Got: {failed['actual']}")
                print(f"    Input: {failed['input']}")
                print()
        
        # Overall assessment
        pass_rate = summary['pass_rate']
        if pass_rate >= 90:
            print("EXCELLENT: Security gateway is highly effective")
        elif pass_rate >= 80:
            print("GOOD: Security gateway is mostly effective with minor issues")
        elif pass_rate >= 70:
            print("FAIR: Security gateway needs improvement")
        else:
            print("POOR: Security gateway has significant vulnerabilities")
    
    def save_report(self, report: Dict[str, Any], filename: str = "red_team_report.json") -> None:
        """Save report to JSON file"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nReport saved to {filename}")

async def main():
    """Main function"""
    evaluator = RedTeamEvaluator()
    
    # Load test cases
    evaluator.load_test_cases()
    
    # Run all tests
    await evaluator.run_all_tests()
    
    # Generate and print report
    report = evaluator.generate_report()
    evaluator.print_report(report)
    
    # Save report
    evaluator.save_report(report)
    
    # Exit with appropriate code
    if report['summary']['pass_rate'] >= 80:
        print("\nRed team evaluation completed successfully")
        sys.exit(0)
    else:
        print("\nRed team evaluation found security issues")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
