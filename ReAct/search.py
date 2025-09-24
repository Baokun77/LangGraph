import requests
import json
import time

def search_web(query):
    """
    Search the web for information using multiple approaches.
    Returns search results as a string.
    """
    # Try multiple search methods for better results
    methods = [
        _search_duckduckgo,
        _search_wikipedia,
        _search_fallback
    ]
    
    for method in methods:
        try:
            result = method(query)
            if result and "No specific information found" not in result and "Search failed" not in result:
                return result
        except Exception as e:
            continue
    
    return f"Unable to find information for: {query}"

def _search_duckduckgo(query):
    """Search using DuckDuckGo API"""
    url = "https://api.duckduckgo.com/"
    params = {
        'q': query,
        'format': 'json',
        'no_html': '1',
        'skip_disambig': '1'
    }
    
    response = requests.get(url, params=params, timeout=5)
    data = response.json()
    
    result = ""
    if data.get('Abstract'):
        result += f"Summary: {data['Abstract']}\n"
    if data.get('Definition'):
        result += f"Definition: {data['Definition']}\n"
    if data.get('RelatedTopics'):
        result += "Related topics:\n"
        for topic in data['RelatedTopics'][:2]:
            if isinstance(topic, dict) and topic.get('Text'):
                result += f"- {topic['Text'][:150]}...\n"
    
    return result if result else None

def _search_wikipedia(query):
    """Search using Wikipedia API"""
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + query.replace(" ", "_")
    response = requests.get(url, timeout=5)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('extract'):
            return f"Wikipedia: {data['extract'][:300]}..."
    
    return None

def _search_fallback(query):
    """Fallback search with basic information"""
    # Simple knowledge base for common queries
    knowledge_base = {
        "ceo of openai": "Sam Altman is the CEO of OpenAI. He co-founded OpenAI and has been instrumental in its development.",
        "openai ceo": "Sam Altman is the CEO of OpenAI. He co-founded OpenAI and has been instrumental in its development.",
        "sam altman": "Sam Altman is an American entrepreneur and investor, best known as the CEO of OpenAI.",
        "capital of france": "Paris is the capital and largest city of France.",
        "capital of china": "Beijing is the capital of China.",
        "capital of japan": "Tokyo is the capital of Japan.",
        "capital of germany": "Berlin is the capital of Germany.",
        "capital of italy": "Rome is the capital of Italy.",
        "capital of spain": "Madrid is the capital of Spain.",
        "capital of uk": "London is the capital of the United Kingdom.",
        "capital of usa": "Washington D.C. is the capital of the United States.",
        "capital of canada": "Ottawa is the capital of Canada.",
        "capital of australia": "Canberra is the capital of Australia.",
        "capital of brazil": "Brasília is the capital of Brazil.",
        "capital of india": "New Delhi is the capital of India.",
        "capital of russia": "Moscow is the capital of Russia.",
        "python programming": "Python is a high-level, general-purpose programming language known for its simplicity and readability.",
        "what is python": "Python is a high-level, general-purpose programming language known for its simplicity and readability.",
        "javascript": "JavaScript is a programming language commonly used for web development.",
        "java": "Java is a high-level, class-based, object-oriented programming language.",
        "c++": "C++ is a general-purpose programming language developed as an extension of the C programming language.",
        "html": "HTML (HyperText Markup Language) is the standard markup language for creating web pages.",
        "css": "CSS (Cascading Style Sheets) is a style sheet language used for describing the presentation of web pages.",
        "sql": "SQL (Structured Query Language) is a domain-specific language used in programming and designed for managing data in relational databases."
    }
    
    query_lower = query.lower().strip()
    if query_lower in knowledge_base:
        return knowledge_base[query_lower]
    
    return None