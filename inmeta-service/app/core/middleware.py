import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.logging import get_request_logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware para logging de requisições e respostas"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Gerar ID único para a requisição
        request_id = request.headers.get(settings.REQUEST_ID_HEADER, str(uuid.uuid4()))
        
        # Configurar logger com request_id
        logger = get_request_logger(request_id)
        
        # Registrar início da requisição
        start_time = time.time()
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            {"path": request.url.path, "method": request.method, "query": str(request.query_params)}
        )
        
        # Processar a requisição
        try:
            response = await call_next(request)
            
            # Registrar fim da requisição
            process_time = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                {
                    "path": request.url.path,
                    "method": request.method,
                    "status_code": response.status_code,
                    "processing_time": process_time
                }
            )
            
            # Adicionar request_id ao cabeçalho da resposta
            response.headers[settings.REQUEST_ID_HEADER] = request_id
            
            return response
            
        except Exception as e:
            # Registrar exceção
            process_time = time.time() - start_time
            logger.exception(
                f"Request failed: {request.method} {request.url.path}",
                {
                    "path": request.url.path,
                    "method": request.method,
                    "processing_time": process_time,
                    "error": str(e)
                }
            )
            raise
