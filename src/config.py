import os
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")
MODEL_NAME = "openai/gpt-4o-mini"

def validate_config():
    """Validates that necessary environment variables are set."""
    if not OPENROUTER_API_KEY:
        raise ValueError("Missing OPENROUTER_API_KEY in .env")

    if not MCP_SERVER_URL:
        raise ValueError("Missing MCP_SERVER_URL in .env")
