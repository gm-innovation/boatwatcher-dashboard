import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict, Optional

from app.core.config import settings


class JSONLogFormatter(logging.Formatter):
    """Formata logs em formato JSON para facilitar a integração com ferramentas de log"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Adicionar exceção se existir
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        # Adicionar dados extras
        if hasattr(record, "data") and record.data:
            log_data["data"] = record.data
            
        return json.dumps(log_data)


def get_logger(name: str) -> logging.Logger:
    """Configura e retorna um logger com formatação JSON"""
    logger = logging.getLogger(name)
    
    # Configurar nível de log
    logger.setLevel(settings.LOG_LEVEL)
    
    # Evitar duplicação de handlers
    if not logger.handlers:
        # Handler para stdout
        handler = logging.StreamHandler(sys.stdout)
        
        # Usar JSON formatter em produção, texto simples em desenvolvimento
        if settings.ENVIRONMENT == "production":
            formatter = JSONLogFormatter()
        else:
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )
            
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger


class LoggerAdapter(logging.LoggerAdapter):
    """Adapter para adicionar dados contextuais aos logs"""
    
    def __init__(self, logger: logging.Logger, extra: Optional[Dict[str, Any]] = None):
        super().__init__(logger, extra or {})
        
    def process(self, msg: str, kwargs: Dict[str, Any]) -> tuple:
        # Adicionar dados extras ao registro de log
        kwargs.setdefault("extra", {}).setdefault("data", {}).update(self.extra)
        return msg, kwargs


def get_request_logger(request_id: str) -> LoggerAdapter:
    """Retorna um logger com o ID da requisição anexado"""
    logger = get_logger("api")
    return LoggerAdapter(logger, {"request_id": request_id})
