from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import asyncio
import logging

from src.config import validate_config, MODEL_NAME
from src.llm import get_llm_client
from src.mcp_client import connect_and_execute, verify_customer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Customer Support Bot")

validate_config()

conversations = {}

class Message(BaseModel):
    role: str
    content: str

class AuthRequest(BaseModel):
    email: str
    pin: str

class AuthResponse(BaseModel):
    success: bool
    user_id: str | None = None
    email: str | None = None
    error: str | None = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: str = "default"
    user_id: str | None = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str

@app.post("/api/auth", response_model=AuthResponse)
async def authenticate(request: AuthRequest):
    """
    Authenticate user with email and PIN using MCP verify_customer tool.
    """
    logger.info(f"Authentication attempt for: {request.email}")
    try:
        result = await verify_customer(request.email, request.pin)
        
        if result.get("success"):
            logger.info(f"Authentication successful for: {request.email}")
            return AuthResponse(
                success=True,
                user_id=result.get("user_id"),
                email=request.email
            )
        else:
            logger.warning(f"Authentication failed for: {request.email}")
            return AuthResponse(
                success=False,
                error="Invalid email or PIN"
            )
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}", exc_info=True)
        return AuthResponse(
            success=False,
            error="Authentication service unavailable"
        )

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handle chat messages and return bot responses.
    """
    logger.info(f"Received chat request: {request.message[:50]}...")
    
    try:
        if request.conversation_id not in conversations:
            conversations[request.conversation_id] = []
        
        messages = conversations[request.conversation_id]
        
        logger.info("Initializing LLM client")
        client = get_llm_client()
        
        logger.info("Starting MCP connection with 90s timeout")
        try:
            response_content = await asyncio.wait_for(
                connect_and_execute(request.message, messages, client, MODEL_NAME, request.user_id),
                timeout=90.0
            )
        except asyncio.TimeoutError:
            logger.error("MCP connection timed out after 90 seconds")
            raise HTTPException(
                status_code=504,
                detail="Request timed out after 90s. The MCP server is taking too long to respond."
            )
        
        logger.info("Chat response generated successfully")
        messages.append({"role": "user", "content": request.message})
        messages.append({"role": "assistant", "content": response_content})
        
        return ChatResponse(
            response=response_content,
            conversation_id=request.conversation_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main HTML page."""
    return FileResponse("static/index.html")
