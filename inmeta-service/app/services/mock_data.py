"""
Dados simulados para desenvolvimento e testes
"""
from datetime import datetime, timedelta
import random
import uuid
from typing import List, Dict, Any, Optional

# Dados simulados para projetos
MOCK_PROJECTS = [
    {
        "id": "1",
        "name": "Marina Itajaí",
        "description": "Projeto de monitoramento da Marina Itajaí",
        "inmeta_id": "marina-itajai-001",
        "location": "Itajaí, SC",
        "client": "Marina Itajaí",
        "status": "active",
        "start_date": datetime.now() - timedelta(days=90),
        "end_date": datetime.now() + timedelta(days=275),
        "metadata": {
            "capacity": 150,
            "has_fuel_station": True,
            "services": ["maintenance", "storage", "security"]
        },
        "created_at": datetime.now() - timedelta(days=95),
        "updated_at": datetime.now() - timedelta(days=10)
    },
    {
        "id": "2",
        "name": "Porto de Santos",
        "description": "Monitoramento de embarcações no Porto de Santos",
        "inmeta_id": "porto-santos-002",
        "location": "Santos, SP",
        "client": "Autoridade Portuária de Santos",
        "status": "active",
        "start_date": datetime.now() - timedelta(days=180),
        "end_date": datetime.now() + timedelta(days=185),
        "metadata": {
            "area": "commercial",
            "vessel_types": ["cargo", "container", "oil_tanker"],
            "monitoring_points": 12
        },
        "created_at": datetime.now() - timedelta(days=185),
        "updated_at": datetime.now() - timedelta(days=5)
    },
    {
        "id": "3",
        "name": "Clube Náutico Guarujá",
        "description": "Sistema de controle de acesso para o Clube Náutico Guarujá",
        "inmeta_id": "clube-nautico-guaruja-003",
        "location": "Guarujá, SP",
        "client": "Clube Náutico Guarujá",
        "status": "planning",
        "start_date": datetime.now() + timedelta(days=30),
        "end_date": datetime.now() + timedelta(days=395),
        "metadata": {
            "members": 350,
            "boats": 85,
            "facilities": ["restaurant", "pool", "gym"]
        },
        "created_at": datetime.now() - timedelta(days=15),
        "updated_at": datetime.now() - timedelta(days=2)
    },
    {
        "id": "4",
        "name": "Marina da Glória",
        "description": "Upgrade do sistema de segurança da Marina da Glória",
        "inmeta_id": "marina-gloria-004",
        "location": "Rio de Janeiro, RJ",
        "client": "Marina da Glória",
        "status": "completed",
        "start_date": datetime.now() - timedelta(days=365),
        "end_date": datetime.now() - timedelta(days=30),
        "metadata": {
            "capacity": 450,
            "security_level": "high",
            "cameras": 75
        },
        "created_at": datetime.now() - timedelta(days=370),
        "updated_at": datetime.now() - timedelta(days=25)
    },
    {
        "id": "5",
        "name": "Estaleiro Atlântico Sul",
        "description": "Monitoramento de produção no Estaleiro Atlântico Sul",
        "inmeta_id": "estaleiro-atlantico-005",
        "location": "Ipojuca, PE",
        "client": "Estaleiro Atlântico Sul",
        "status": "active",
        "start_date": datetime.now() - timedelta(days=120),
        "end_date": datetime.now() + timedelta(days=245),
        "metadata": {
            "area": "industrial",
            "production_capacity": "large",
            "employees": 1200
        },
        "created_at": datetime.now() - timedelta(days=125),
        "updated_at": datetime.now() - timedelta(days=3)
    }
]

# Dados simulados para eventos de acesso
def generate_mock_events(project_id: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Gera eventos simulados para um projeto específico
    
    Args:
        project_id: ID do projeto
        days: Número de dias para gerar eventos
        
    Returns:
        Lista de eventos simulados
    """
    events = []
    event_types = ["entry", "exit", "denied", "alarm"]
    event_locations = ["main_gate", "dock_a", "dock_b", "marina_office", "fuel_station", "maintenance_area"]
    
    # Encontra o projeto para usar seus dados
    project = next((p for p in MOCK_PROJECTS if p["id"] == project_id), None)
    if not project:
        return []
    
    # Gera eventos para os últimos 'days' dias
    for day in range(days):
        # Número aleatório de eventos por dia (3-15)
        num_events = random.randint(3, 15)
        
        for _ in range(num_events):
            # Horário aleatório durante o dia
            hour = random.randint(6, 22)
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            
            event_time = datetime.now() - timedelta(days=day, 
                                                  hours=random.randint(0, 23),
                                                  minutes=random.randint(0, 59))
            
            # Tipo de evento com pesos diferentes (mais entradas/saídas, menos alarmes)
            event_type = random.choices(
                event_types, 
                weights=[0.45, 0.45, 0.08, 0.02], 
                k=1
            )[0]
            
            # Localização do evento
            location = random.choice(event_locations)
            
            # Pessoa associada ao evento
            person_id = f"person-{random.randint(1000, 9999)}"
            person_name = f"Usuário {random.randint(1, 100)}"
            
            # Detalhes extras com base no tipo de evento
            details = {}
            if event_type == "entry":
                details["access_method"] = random.choice(["card", "biometric", "manual"])
                details["authorized_by"] = f"Staff {random.randint(1, 10)}" if random.random() < 0.3 else None
            elif event_type == "exit":
                details["access_method"] = random.choice(["card", "biometric", "manual", "automatic"])
            elif event_type == "denied":
                details["reason"] = random.choice(["expired_card", "unauthorized_area", "invalid_credentials"])
                details["attempted_location"] = random.choice(event_locations)
            elif event_type == "alarm":
                details["alarm_type"] = random.choice(["security", "fire", "environmental"])
                details["severity"] = random.choice(["low", "medium", "high"])
                details["response_time_seconds"] = random.randint(30, 300)
            
            # Cria o evento
            event = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "project_name": project["name"],
                "timestamp": event_time,
                "event_type": event_type,
                "location": location,
                "person_id": person_id,
                "person_name": person_name,
                "details": details
            }
            
            events.append(event)
    
    # Ordena eventos por timestamp (mais recentes primeiro)
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return events


def get_mock_project_events_summary(project_id: str) -> Dict[str, Any]:
    """
    Gera um resumo de eventos para um projeto
    
    Args:
        project_id: ID do projeto
        
    Returns:
        Resumo dos eventos
    """
    events = generate_mock_events(project_id)
    
    if not events:
        return {
            "total_events": 0,
            "event_types": {},
            "locations": {},
            "timeline": []
        }
    
    # Total de eventos
    total_events = len(events)
    
    # Contagem por tipo de evento
    event_types = {}
    for event in events:
        event_type = event["event_type"]
        event_types[event_type] = event_types.get(event_type, 0) + 1
    
    # Contagem por localização
    locations = {}
    for event in events:
        location = event["location"]
        locations[location] = locations.get(location, 0) + 1
    
    # Timeline simplificada (eventos por dia)
    timeline = {}
    for event in events:
        day = event["timestamp"].strftime("%Y-%m-%d")
        if day not in timeline:
            timeline[day] = {"date": day, "count": 0, "types": {}}
        
        timeline[day]["count"] += 1
        
        event_type = event["event_type"]
        if event_type not in timeline[day]["types"]:
            timeline[day]["types"][event_type] = 0
        timeline[day]["types"][event_type] += 1
    
    # Converte timeline para lista e ordena por data
    timeline_list = list(timeline.values())
    timeline_list.sort(key=lambda x: x["date"])
    
    # Último evento
    last_event = events[0]["timestamp"] if events else None
    
    return {
        "total_events": total_events,
        "event_types": event_types,
        "locations": locations,
        "timeline": timeline_list,
        "last_event": last_event
    }
