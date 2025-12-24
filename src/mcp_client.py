from mcp.client.streamable_http import streamablehttp_client
from mcp.client.session import ClientSession
from src.config import MCP_SERVER_URL
from src.llm import convert_mcp_to_openai
import json
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

async def connect_and_execute(user_input, messages, client, model_name):
    """
    Connects to MCP server, negotiates tools, and runs the chat loop.
    Returns the final response content.
    """

    logger.info(f"Starting MCP connection to {MCP_SERVER_URL}")

    async with streamablehttp_client(
        MCP_SERVER_URL,
        timeout=timedelta(seconds=60),
        sse_read_timeout=timedelta(seconds=300)
    ) as (read, write, _):
        logger.info("Streamable HTTP client connected successfully")

        async with ClientSession(read, write) as session:
            await session.initialize()
            
            logger.info("Listing available tools...")
            tools_result = await session.list_tools()
            logger.info(f"Found {len(tools_result.tools)} tools")
            mcp_tools = tools_result.tools
            
            openai_tools = []
            for tool in mcp_tools:
                openai_tools.append(convert_mcp_to_openai(tool))
            
            current_messages = messages + [{"role": "user", "content": user_input}]
            
            # Add system message for product formatting
            system_message = {
                "role": "system",
                "content": """When listing products, you MUST respond with ONLY a JSON object in this exact format (no additional text):
{
  "type": "product_list",
  "products": [
    {
      "id": "product_id",
      "name": "Product Name",
      "price": 123.45,
      "stock": 10,
      "category": "Category Name",
      "image": "https://via.placeholder.com/300x200?text=Product+Name"
    }
  ]
}

IMPORTANT: 
- When you use the list_products tool, return ONLY the JSON object above, nothing else
- Do NOT add any explanatory text before or after the JSON
- Do NOT format it as markdown code blocks
- Just return the raw JSON object
- For non-product responses, respond normally in plain text"""
            }
            
            # Insert system message at the beginning if not already present
            if not current_messages or current_messages[0].get("role") != "system":
                current_messages = [system_message] + current_messages
            
            logger.info(f"Calling LLM with {len(openai_tools)} tools")
            response = client.chat.completions.create(
                model=model_name,
                messages=current_messages,
                tools=openai_tools,
                tool_choice="auto"
            )
            
            response_message = response.choices[0].message
            
            tool_calls = response_message.tool_calls
            
            if tool_calls:
                logger.info(f"LLM requested {len(tool_calls)} tool calls")
                current_messages.append(response_message)
                
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"Executing tool: {function_name} with args: {function_args}")
                    result = await session.call_tool(function_name, function_args)
                    logger.info(f"Tool {function_name} executed successfully")
                    
                    content_text = ""
                    for content in result.content:
                        if content.type == "text":
                            content_text += content.text
                        elif content.type == "image":
                            content_text += "[Image Content]"
                        else:
                            content_text += str(content)

                    current_messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": content_text,
                    })
                
                logger.info("Getting final response from LLM")
                final_response = client.chat.completions.create(
                    model=model_name,
                    messages=current_messages + [{
                        "role": "system",
                        "content": "Remember: If this is a product list, respond with ONLY the JSON object, no additional text."
                    }],
                )
                return final_response.choices[0].message.content
            else:
                return response_message.content
