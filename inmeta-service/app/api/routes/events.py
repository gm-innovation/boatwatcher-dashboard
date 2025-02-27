from fastapi import APIRouter, HTTPException, Depends
from app.api.models import AccessEventRequest, AccessEventResponse
from app.services.inmeta import InmetaService
from app.core.config import settings

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/access", response_model=AccessEventResponse)
async def get_access_events(
    request: AccessEventRequest,
    inmeta_service: InmetaService = Depends(InmetaService)
) -> AccessEventResponse:
    """
    Busca eventos de acesso do Inmeta com base na data e projeto.
    Inclui cache e processamento de dados com pandas.
    """
    try:
        events = await inmeta_service.get_access_events(
            start_date=request.start_date,
            end_date=request.end_date,
            project_id=request.project_id
        )
        
        return AccessEventResponse(
            events=events,
            total=len(events),
            cached=inmeta_service.was_cached
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar eventos: {str(e)}"
        )
