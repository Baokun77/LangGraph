import openai
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class OpenAIClient:
    def __init__(self, api_key=None):
        if api_key:
            openai.api_key = api_key
        else:
            # Try to get from environment variable
            openai.api_key = os.getenv('OPENAI_API_KEY')
            print(f"OpenAI API key: {openai.api_key}")
    
    def send_message(self, messages, model="gpt-3.5-turbo"):
        """
        Send messages to OpenAI API and get response.
        Returns the assistant's response.
        """
        try:
            response = openai.ChatCompletion.create(
                model=model,
                messages=messages,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error calling OpenAI API: {str(e)}"
    
    def should_search(self, message):
        """
        Determine if the message indicates a need for web search.
        Returns True if search is needed, False otherwise.
        """
        search_keywords = [
            "search", "find", "look up", "what is", "who is", "when did", 
            "where is", "how to", "current", "latest", "recent", "news"
        ]
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in search_keywords)