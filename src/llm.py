from openai import OpenAI
from src.config import OPENROUTER_API_KEY

def get_llm_client():
    """Returns an initialized OpenAI client connected to OpenRouter."""
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
