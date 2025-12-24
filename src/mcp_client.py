from mcp.client.sse import sse_client
from mcp.client.session import ClientSession
from config import MCP_SERVER_URL
import json

async def connect_and_execute(user_input, messages, client, model_name):
    """
    Connects to MCP server, negotiates tools, and runs the chat loop.
    Returns the final response content.
    """
    # Connect to MCP server - NOTE: requires Accept header for this specific server
    # Server takes ~15s to send first ping, so we need longer timeout
    async with sse_client(
        MCP_SERVER_URL, 
        headers={"Accept": "text/event-stream"},
        timeout=30.0,  # Connection timeout in seconds
        sse_read_timeout=300.0  # SSE read timeout in seconds
    ) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # List available tools
            tools_result = await session.list_tools()
            mcp_tools = tools_result.tools
            
            # Convert to OpenAI format
            openai_tools = []
            for tool in mcp_tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.inputSchema
                    }
                })
            
            # Prepare messages
            # Note: We don't modify the session state messages list in place here,
            # we build the list for the API call.
            current_messages = messages + [{"role": "user", "content": user_input}]
            
            # 1. Call LLM with tools
            response = client.chat.completions.create(
                model=model_name,
                messages=current_messages,
                tools=openai_tools,
                tool_choice="auto"
            )
            
            response_message = response.choices[0].message
            
            # 2. Check for tool calls
            tool_calls = response_message.tool_calls
            
            if tool_calls:
                current_messages.append(response_message)
                
                # Yield tool calls so UI can show them (optional, tricky with async generator in streamlit)
                # For now, we'll just execute them.
                
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    
                    # Execute tool on MCP
                    result = await session.call_tool(function_name, function_args)
                    
                    # Process result
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
                
                # 3. Get final response from LLM
                final_response = client.chat.completions.create(
                    model=model_name,
                    messages=current_messages,
                )
                return final_response.choices[0].message.content
            else:
                return response_message.content
