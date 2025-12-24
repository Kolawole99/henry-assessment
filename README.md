# MCP Customer Support Chatbot

A prototype chatbot connecting to a company's MCP server for product queries, using OpenRouter (GPT-4o-mini) and Streamlit.

## Setup

1.  **Envrionment**:
    Ensure you have Python 3.11+ installed.
    ```bash
    python3.11 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

2.  **Configure**:
    Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and add your `OPENROUTER_API_KEY`.
    
    *Note: The `MCP_SERVER_URL` is pre-configured to the provided assessment URL.*

3.  **Run**:
    ```bash
    streamlit run app.py
    ```