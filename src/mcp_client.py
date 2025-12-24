from mcp.client.streamable_http import streamablehttp_client
from mcp.client.session import ClientSession
from src.config import MCP_SERVER_URL
from src.llm import convert_mcp_to_openai
import json
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

async def verify_customer(email: str, pin: str):
    """
    Verify customer credentials using MCP server.
    Returns dict with success status and user_id if successful.
    """
    logger.info(f"Verifying customer: {email}")
    try:
        async with streamablehttp_client(
            MCP_SERVER_URL,
            timeout=timedelta(seconds=60),
            sse_read_timeout=timedelta(seconds=300)
        ) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # List tools to see what's available
                tools_result = await session.list_tools()
                logger.info(f"Available MCP tools: {[tool.name for tool in tools_result.tools]}")
                
                # Call verify_customer tool (try both possible names)
                tool_name = "verify_customer"
                result = await session.call_tool(tool_name, {
                    "email": email,
                    "pin": pin
                })
                
                # Process result
                content_text = ""
                for content in result.content:
                    if content.type == "text":
                        content_text += content.text
                
                logger.info(f"MCP verify_customer response: {content_text}")
                
                # Parse the response
                try:
                    data = json.loads(content_text)
                    return data
                except Exception as e:
                    logger.error(f"Failed to parse MCP response: {e}")
                    return {"success": False, "error": "Invalid response from server"}
    except Exception as e:
        logger.error(f"MCP verification error: {str(e)}", exc_info=True)
        return {"success": False, "error": f"Verification failed: {str(e)}"}

async def connect_and_execute(user_input, messages, client, model_name, user_id=None):
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
            
            # Add system message for product formatting and authentication
            system_message_content = """You are a customer support assistant for a computer products company.

PRODUCT LISTING:
When listing products, you MUST respond with ONLY a JSON object in this exact format (no additional text):
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

ORDER HISTORY:
When showing order history, respond with ONLY this JSON format:
{
  "type": "order_history",
  "orders": [
    {
      "order_id": "order_id",
      "customer_id": "customer_id",
      "status": "pending/completed/cancelled",
      "created_at": "timestamp",
      "items": [
        {
          "product_id": "SKU",
          "quantity": 3
        }
      ]
    }
  ]
}

ORDER CONFIRMATION (BEFORE PLACEMENT):
When preparing an order (after authentication, BEFORE placing it), respond with ONLY this JSON format:
{
  "customer_id": "customer_id_from_auth",
  "order_details": [
    {
      "product_id": "SKU",
      "quantity": 3
    }
  ]
}

IMPORTANT FOR PRODUCTS & ORDERS:
- When you use the list_products tool, return ONLY the product list JSON
- When user asks to see orders/order history, use get_orders tool and return order history JSON
- When preparing an order (after auth, before confirmation), return ONLY the order confirmation JSON
- Do NOT add any explanatory text before or after the JSON
- Do NOT format it as markdown code blocks
- Just return the raw JSON object

AUTHENTICATION & ORDERS FLOW:
1. Users can browse products without authentication
2. When a user wants to ORDER/BUY/PURCHASE a product, you MUST authenticate them first
3. To authenticate: Ask for their email and PIN, then use the verify_customer tool
4. After successful authentication, you'll receive a customer_id
5. Prepare the order confirmation JSON with the customer_id and order_details
6. User will see a card with "Place Order" button
7. When user confirms (message will contain "Customer ID:" and "Order details:"):
   - Extract the customer_id from the message
   - Extract the order_details array from the message
   - Call create_order tool with: {"customer_id": "extracted_id", "order_details": [extracted_array]}
8. After create_order succeeds, respond with a success message in plain text (NOT JSON)
9. If create_order fails, inform the user of the error

VIEWING ORDERS:
- When user asks to see their orders, they MUST be authenticated first
- If not authenticated, ask for their email and PIN, then use verify_customer tool
- The verify_customer tool will return a customer_id in the response
- Use that customer_id to call get_orders tool: get_orders(customer_id="the_id_from_verify_customer")
- Return the order history JSON format shown above
- User will see a list of their past orders
- Do NOT return empty order history without authentication

CRITICAL: When you see a message like "Please confirm and place my order. Customer ID: xxx, Order details: [...]", 
you MUST extract the customer_id and order_details and call the create_order tool immediately.

For non-product, non-order responses, respond normally in plain text."""

            if user_id:
                system_message_content += f"\n\nCurrent authenticated customer ID: {user_id}"
            
            system_message = {
                "role": "system",
                "content": system_message_content
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
