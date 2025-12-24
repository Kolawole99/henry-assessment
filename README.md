# MCP Customer Support Chatbot

A customer support chatbot using FastAPI, connecting to a company's MCP server for product queries via OpenRouter (GPT-4o-mini).

## Setup

1.  **Environment**:
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
    uvicorn src.main:app --reload
    ```
    
    Open your browser to `http://localhost:8000`

## File Structure
- `src/`: Source code directory.
    - `main.py`: FastAPI application entry point.
    - `config.py`: Configuration and environment loading.
    - `llm.py`: OpenRouter/LLM client setup.
    - `mcp_client.py`: MCP server interaction logic.
- `static/`: Frontend files (HTML/CSS/JS).
- `requirements.txt`: Project dependencies.

## API Endpoints
- `GET /`: Serves the chat interface
- `POST /api/chat`: Chat endpoint (accepts JSON with `message` and `conversation_id`)
- `GET /api/health`: Health check

## Troubleshooting
