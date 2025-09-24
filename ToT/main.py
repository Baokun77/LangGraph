import openai
import os
import json
import re
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ToTNode:
    def __init__(self, expression: str, remaining_numbers: List[int], depth: int = 0):
        self.expression = expression
        self.remaining_numbers = remaining_numbers
        self.depth = depth
        self.children = []
        self.evaluated = False
        self.value = None
        
    def evaluate(self):
        """Safely evaluate the mathematical expression"""
        try:
            # Only allow numbers, operators, and parentheses for security
            if re.match(r'^[0-9+\-*/().\s]+$', self.expression):
                self.value = eval(self.expression)
                self.evaluated = True
                return self.value
        except:
            pass
        return None

class ToTAgent:
    def __init__(self, api_key=None):
        if api_key:
            openai.api_key = api_key
        else:
            openai.api_key = os.getenv('OPENAI_API_KEY')
        
        self.max_depth = 4
        self.max_branches = 3
        
    def generate_thoughts(self, node: ToTNode) -> List[str]:
        """Generate multiple thought branches for the current node"""
        system_prompt = """You are a mathematical reasoning agent. Given a current expression and remaining numbers, generate multiple possible next steps to reach 24.

Rules:
1. Use only ONE number from the remaining numbers: {remaining}
2. Current expression: {expression}
3. Generate exactly {max_branches} different approaches
4. Each approach should use exactly one number with an operation
5. Use only +, -, *, /, and parentheses
6. Each number can only be used once
7. Examples: if current is "2" and remaining is [4,6,8], generate things like "2+4", "2*4", "2-4", "4-2", etc.

Format your response as a JSON array of expressions:
["expression1", "expression2"]"""

        user_prompt = f"Remaining numbers: {node.remaining_numbers}\nCurrent expression: '{node.expression}'\nGenerate {self.max_branches} next steps using exactly one number:"
        
        messages = [
            {"role": "system", "content": system_prompt.format(
                remaining=node.remaining_numbers,
                expression=node.expression,
                max_branches=self.max_branches
            )},
            {"role": "user", "content": user_prompt}
        ]
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.8,
                max_tokens=200
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to parse as JSON
            try:
                thoughts = json.loads(content)
                if isinstance(thoughts, list):
                    return thoughts[:self.max_branches]
            except:
                pass
            
            # Fallback: extract expressions from text
            expressions = re.findall(r'["\']([^"\']+)["\']', content)
            return expressions[:self.max_branches]
            
        except Exception as e:
            print(f"Error generating thoughts: {e}")
            return []
    
    def create_child_nodes(self, parent: ToTNode, thoughts: List[str]) -> List[ToTNode]:
        """Create child nodes from generated thoughts"""
        children = []
        
        for thought in thoughts:
            # Extract numbers used in the thought
            used_numbers = [int(x) for x in re.findall(r'\b\d+\b', thought)]
            
            # Check if exactly one number from remaining is used
            remaining_used = [num for num in used_numbers if num in parent.remaining_numbers]
            
            if len(remaining_used) == 1:
                new_remaining = parent.remaining_numbers.copy()
                new_remaining.remove(remaining_used[0])
                
                child = ToTNode(thought, new_remaining, parent.depth + 1)
                children.append(child)
        
        return children
    
    def search_tree(self, numbers: List[int]) -> List[ToTNode]:
        """Search the tree of thoughts to find solutions"""
        # Start with first number as initial expression
        root = ToTNode(str(numbers[0]), numbers[1:], 0)
        queue = [root]
        solutions = []
        
        while queue and len(solutions) < 5:  # Limit solutions
            current = queue.pop(0)
            
            # Skip if too deep
            if current.depth >= self.max_depth:
                continue
            
            # Skip if no remaining numbers
            if not current.remaining_numbers:
                # Evaluate final expression
                value = current.evaluate()
                print(f"Final expression: {current.expression} = {value}")
                if value == 24 or (value is not None and abs(value - 24) < 0.001):
                    solutions.append(current)
                    print(f"  ✓ SOLUTION FOUND: {current.expression} = 24")
                continue
            
            # Generate thoughts for current node
            thoughts = self.generate_thoughts(current)
            print(f"Depth {current.depth}: Generated {len(thoughts)} thoughts")
            
            # Create child nodes
            children = self.create_child_nodes(current, thoughts)
            current.children = children
            
            for child in children:
                # Evaluate the expression
                value = child.evaluate()
                print(f"  Expression: {child.expression} = {value}")
                
                if value == 24:
                    solutions.append(child)
                    print(f"  ✓ SOLUTION FOUND: {child.expression} = 24")
                elif value is not None and abs(value - 24) < 0.001:
                    solutions.append(child)
                    print(f"  ✓ SOLUTION FOUND: {child.expression} = {value}")
                else:
                    # Add to queue for further exploration
                    queue.append(child)
        
        return solutions
    
    def solve_24_game(self, numbers: List[int] = [2, 4, 6, 8]):
        """Main method to solve the 24 game using Tree of Thoughts"""
        print(f"Solving 24 game with numbers: {numbers}")
        print("=" * 50)
        
        solutions = self.search_tree(numbers)
        
        if solutions:
            print(f"\nFound {len(solutions)} solution(s):")
            for i, solution in enumerate(solutions, 1):
                print(f"{i}. {solution.expression} = 24")
        else:
            print("\nNo solutions found within the search depth.")
        
        return solutions

def main():
    """Main function to run the ToT agent"""
    agent = ToTAgent()
    
    # Solve the 24 game with default numbers
    agent.solve_24_game([2, 4, 6, 8])
    

if __name__ == "__main__":
    main()