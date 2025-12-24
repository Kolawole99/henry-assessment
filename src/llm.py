from openai import OpenAI
from config import OPENROUTER_API_KEY

def get_llm_client():
    """Returns an initialized OpenAI client connected to OpenRouter."""
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

def convert_mcp_to_openai(mcp_tool):
    """Converts MCP tool definition to OpenAI function format."""
    return {
        "type": "function",
        "function": {
            "name": mcp_tool.name,
            "description": mcp_tool.description,
            "parameters": mcp_tool.inputSchema
        }
    }
