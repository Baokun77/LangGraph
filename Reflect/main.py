import openai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ReflectAgent:
    def __init__(self, api_key=None):
        if api_key:
            openai.api_key = api_key
        else:
            openai.api_key = os.getenv('OPENAI_API_KEY')
        
        self.max_reflections = 3
    
    def generate_initial_answer(self, question):
        """Generate initial answer to the question"""
        system_prompt = """You are a helpful assistant. Answer the user's question accurately and completely."""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ]
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error generating answer: {str(e)}"
    
    def reflect_on_answer(self, question, answer):
        """Reflect on whether the answer is correct and complete"""
        system_prompt = """You are a critical reviewer. Analyze if the given answer correctly and completely addresses the question.
        
        Consider:
        1. Is the answer factually correct?
        2. Does it fully address all parts of the question?
        3. Are there any gaps or missing information?
        4. Is the answer clear and well-structured?
        
        Respond with:
        - "CORRECT" if the answer is accurate and complete
        - "INCORRECT: [specific issues]" if there are problems
        - "INCOMPLETE: [missing information]" if more details are needed"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}\n\nAnswer: {answer}\n\nIs this answer correct and complete?"}
        ]
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error reflecting: {str(e)}"
    
    def generate_corrected_answer(self, question, original_answer, reflection):
        """Generate a corrected answer based on reflection feedback"""
        system_prompt = """You are a helpful assistant. The previous answer had issues. Generate an improved answer that addresses the problems identified in the reflection.
        
        Focus on:
        1. Correcting any factual errors
        2. Adding missing information
        3. Improving clarity and structure
        4. Ensuring completeness"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}\n\nOriginal Answer: {original_answer}\n\nReflection: {reflection}\n\nPlease provide a corrected and improved answer."}
        ]
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error generating corrected answer: {str(e)}"
    
    def run(self, question):
        """Main Reflect loop: Answer -> Reflect -> Correct -> Repeat"""
        print(f"Question: {question}")
        print("-" * 50)
        
        # Generate initial answer
        print("Generating initial answer...")
        current_answer = self.generate_initial_answer(question)
        print(f"Initial Answer: {current_answer}")
        
        for reflection_round in range(self.max_reflections):
            print(f"\nReflection Round {reflection_round + 1}:")
            
            # Reflect on current answer
            print("Reflecting on answer...")
            reflection = self.reflect_on_answer(question, current_answer)
            print(f"Reflection: {reflection}")
            
            # Check if answer is correct
            if reflection.startswith("CORRECT"):
                print(f"\nFinal Answer: {current_answer}")
                return current_answer
            
            # Generate corrected answer
            print("Generating corrected answer...")
            corrected_answer = self.generate_corrected_answer(question, current_answer, reflection)
            print(f"Corrected Answer: {corrected_answer}")
            
            current_answer = corrected_answer
        
        print(f"\nMax reflections reached. Final Answer: {current_answer}")
        return current_answer

def main():
    """Main function to run the Reflect agent"""
    agent = ReflectAgent()
    
    while True:
        user_input = input("\nEnter your question (or 'quit' to exit): ")
        if user_input.lower() == 'quit':
            break
        
        if user_input.strip():
            agent.run(user_input)

if __name__ == "__main__":
    main()
