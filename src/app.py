import streamlit as st
import asyncio
from config import validate_config, MODEL_NAME
from llm import get_llm_client
from mcp_client import connect_and_execute

validate_config()
st.title("MCP Customer Support Bot 🤖")

if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt := st.chat_input("How can I help you?"):
    # Show user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Generate response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                # Initialize LLM client
                client = get_llm_client()
                
                # Run the chat logic (with timeout)
                # Pass a copy of messages to avoid direct mutation issues during async execution
                messages_copy = list(st.session_state.messages)
                
                response_content = asyncio.run(
                    asyncio.wait_for(
                        connect_and_execute(prompt, messages_copy, client, MODEL_NAME), 
                        timeout=60
                    )
                )
                
                st.markdown(response_content)
                st.session_state.messages.append({"role": "assistant", "content": response_content})
            
            except asyncio.TimeoutError:
                st.error("Request timed out. The MCP server might be slow or unresponsive.")
            except Exception as e:
                st.error(f"An error occurred: {e}")
