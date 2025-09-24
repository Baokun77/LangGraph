from openai_server import OpenAIClient
from search import search_web

class ReActAgent:
    def __init__(self, api_key=None):
        self.openai_client = OpenAIClient(api_key)
        self.conversation_history = []
    
    def think(self, user_question):
        """
        Reasoning step: Analyze the question and determine next action.
        """
        system_prompt = """You are a ReAct agent that can reason and act. 
        You can either:
        1. Answer directly if you have enough information
        2. Search for more information if needed
        
        Respond with either:
        - "ANSWER: [your response]" if you can answer directly
        - "SEARCH: [search query]" if you need to search for information
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_question}
        ]
        
        response = self.openai_client.send_message(messages)
        return response
    
    def act(self, thought):
        """
        Acting step: Execute the determined action.
        """
        if thought.startswith("SEARCH:"):
            search_query = thought.replace("SEARCH:", "").strip()
            search_results = search_web(search_query)
            return "search", search_results
        elif thought.startswith("ANSWER:"):
            answer = thought.replace("ANSWER:", "").strip()
            return "answer", answer
        else:
            return "search", search_web(thought)
    
    def observe(self, action_type, result):
        """
        Observation step: Process the results of the action.
        """
        if action_type == "search":
            return f"Search results: {result}"
        else:
            return result
    
    def run(self, user_question, max_iterations=3):
        """
        Main ReAct loop: Think -> Act -> Observe -> Repeat
        """
        print(f"User Question: {user_question}")
        print("-" * 50)
        
        current_context = user_question
        
        for iteration in range(max_iterations):
            print(f"\nIteration {iteration + 1}:")
            print("Thinking...")
            
            # Think
            thought = self.think(current_context)
            print(f"Thought: {thought}")
            
            # Act
            action_type, result = self.act(thought)
            print(f"Action: {action_type}")
            
            # Observe
            observation = self.observe(action_type, result)
            print(f"Observation: {observation[:200]}...")
            
            if action_type == "answer":
                print(f"\nFinal Answer: {result}")
                return result
            
            # Update context for next iteration
            current_context = f"Original question: {user_question}\nPrevious search results: {observation}"
        
        print("\nMax iterations reached. Providing best available answer.")
        return "I've gathered some information but may need more specific details to provide a complete answer."

def main():
    """
    Main function to run the ReAct agent.
    """
    agent = ReActAgent()
    
    while True:
        user_input = input("\nEnter your question (or 'quit' to exit): ")
        if user_input.lower() == 'quit':
            break
        
        if user_input.strip():
            agent.run(user_input)

if __name__ == "__main__":
    main()