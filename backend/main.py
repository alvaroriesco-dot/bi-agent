from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

app = FastAPI(title="BI Agent API - Just Eat")

# CORS - permitir requests desde frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción: ["https://tudominio.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# MODELOS
# =====================

class QueryRequest(BaseModel):
    team: str  # "sales" o "finance"
    metric: str  # nombre de la métrica
    granularity: str  # "país", "provincia", "ciudad"
    start_date: str  # "2026-01-01"
    end_date: str  # "2026-01-31"

class QueryResponse(BaseModel):
    team: str
    metric: str
    granularity: str
    data: dict
    query_executed: str
    timestamp: str

# =====================
# MOCK DATA (después reemplazamos con BigQuery real)
# =====================

def get_bigquery_data(team: str, metric: str, granularity: str, start_date: str, end_date: str):
    """Ejecuta queries en BigQuery con credenciales del usuario"""
    
    from google.cloud import bigquery
    import os
    
    try:
        # Obtener proyecto de credenciales
        project = os.environ.get('GOOGLE_CLOUD_PROJECT', 'just-data-counalyticses-dev')
        print(f"🔍 Conectando a BigQuery con proyecto: {project}")
        
        client = bigquery.Client(project=project)
        
        # Construir query según granularidad
        if granularity == "País":
            location_select = "'España' as location"
            group_by = ""
        elif granularity == "Provincia":
            location_select = "province_tr as location"
            group_by = "GROUP BY province_tr"
        else:  # Ciudad
            location_select = "city_tr as location"
            group_by = "GROUP BY city_tr"
        
        # Construir métrica según team
        if team == "sales":
            if metric == "Órdenes totales":
                metric_calc = "COUNT(DISTINCT order_id) as value"
            elif metric == "Clientes únicos":
                metric_calc = "COUNT(DISTINCT customer_id) as value"
        
        elif team == "finance":
            if metric == "GMV total":
                metric_calc = "SUM(gross_monetary_value) as value"
        
        # Query final
        query = f"""
            SELECT 
                {location_select},
                {metric_calc}
            FROM `just-data-warehouse.international_reporting.es_all_in_one`
            WHERE order_date BETWEEN '{start_date}' AND '{end_date}'
            AND order_status_type = 'Good'
            {group_by}
            ORDER BY value DESC
        """
        
        print(f"📊 Ejecutando query BigQuery...")
        print(f"Query: {query[:100]}...")
        
        job_config = bigquery.QueryJobConfig()
        job = client.query(query, job_config=job_config)
        results = job.result()
        
        print(f"✅ Query exitosa, procesando resultados...")
        
        data = {}
        for row in results:
            location = str(row['location']).strip() if row['location'] else 'Sin especificar'
            value = row['value']
            
            # Convertir valor a número serializable
            if value is None:
                value = 0
            elif isinstance(value, int):
                pass  # Ya es int
            else:
                try:
                    value = float(value)
                    # Si es GMV, dejar decimales, si no redondear
                    if metric == "GMV total":
                        value = round(value, 2)
                    else:
                        value = int(value)
                except:
                    value = 0
            
            data[location] = value
        
        print(f"✅ {len(data)} registros obtenidos: {list(data.keys())}")
        return data, query
    
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"❌ ERROR EN BIGQUERY:")
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Error BigQuery: {str(e)}")

# =====================
# ENDPOINTS
# =====================

@app.get("/health")
def health_check():
    """Health check para validar que el backend está vivo"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/api/query")
def execute_query(request: QueryRequest):
    """
    Ejecuta una query según team, metric y granularity
    
    Estructura esperada:
    {
        "team": "sales" | "finance",
        "metric": "Órdenes totales" | "Clientes únicos" | "GMV total",
        "granularity": "País" | "Provincia" | "Ciudad",
        "start_date": "2026-01-01",
        "end_date": "2026-01-31"
    }
    """
    
    try:
        # Validar team
        if request.team not in ["sales", "finance"]:
            raise HTTPException(status_code=400, detail=f"Team '{request.team}' no válido")
        
        # Validar metric según team
        valid_metrics = {
            "sales": ["Órdenes totales", "Clientes únicos"],
            "finance": ["GMV total"]
        }
        
        if request.metric not in valid_metrics.get(request.team, []):
            raise HTTPException(status_code=400, detail=f"Métrica '{request.metric}' no válida para {request.team}")
        
        # Validar granularity
        if request.granularity not in ["País", "Provincia", "Ciudad"]:
            raise HTTPException(status_code=400, detail=f"Granularidad '{request.granularity}' no válida")
        
        # Ejecutar query en BigQuery real
        data, query_str = get_bigquery_data(
            request.team, 
            request.metric, 
            request.granularity,
            request.start_date,
            request.end_date
        )
        
        response = QueryResponse(
            team=request.team,
            metric=request.metric,
            granularity=request.granularity,
            data=data,
            query_executed=query_str.strip(),
            timestamp=datetime.now().isoformat()
        )
        
        return response
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/api/teams")
def get_teams():
    """Retorna los equipos disponibles"""
    return {
        "teams": [
            {
                "id": "sales",
                "label": "📈 Ventas",
                "metrics": ["Órdenes totales", "Clientes únicos"]
            },
            {
                "id": "finance",
                "label": "💰 Finance",
                "metrics": ["GMV total"]
            }
        ]
    }

@app.get("/api/granularities")
def get_granularities():
    """Retorna las granularidades disponibles"""
    return {
        "granularities": [
            {"label": "🌍 País completo", "value": "País"},
            {"label": "🗺️ Por provincia", "value": "Provincia"},
            {"label": "🏙️ Por ciudad", "value": "Ciudad"}
        ]
    }

# =====================
# STARTUP
# =====================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor FastAPI en http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
