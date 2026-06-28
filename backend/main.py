from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from scipy.spatial import KDTree
import os
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UFDS:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, i):
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            if self.rank[root_i] < self.rank[root_j]:
                self.parent[root_i] = root_j
            elif self.rank[root_i] > self.rank[root_j]:
                self.parent[root_j] = root_i
            else:
                self.parent[root_j] = root_i
                self.rank[root_i] += 1
            return True
        return False

datos_nodos = []
x_coords = []
y_coords = []

@app.on_event("startup")
def cargar_datos():
    global datos_nodos, x_coords, y_coords
    
    folder_actual = os.path.dirname(os.path.abspath(__file__))
    archivo_excel = os.path.join(folder_actual, 'dataset_cusco_geogpsperu.xlsx')
    
    if not os.path.exists(archivo_excel):
        print(f"ERROR: No se encontró el archivo Excel en la ruta: {archivo_excel}")
        return

    print(f"Cargando dataset desde: {archivo_excel}")
    df = pd.read_excel(archivo_excel)
    df = df.dropna(subset=['LONGITUD', 'LATITUD'])
    
    x_coords = df['LONGITUD'].values
    y_coords = df['LATITUD'].values
    
    for i in range(len(x_coords)):
        datos_nodos.append({
            "id": i,
            "x": float(x_coords[i]),
            "y": float(y_coords[i])
        })
    print(f"¡Servidor FastAPI listo! {len(datos_nodos)} nodos cargados en memoria.")

@app.get("/api/nodos")
def get_nodos():
    """Devuelve los nodos base para dibujar el mapa inicial."""
    return {"nodos": datos_nodos}

@app.get("/api/kruskal")
def ejecutar_kruskal():
    """Ejecuta KDTree + Kruskal y devuelve las aristas óptimas."""
    start_time = time.time()
    num_nodos = len(x_coords)
    puntos = np.column_stack((x_coords, y_coords))
    
    arbol = KDTree(puntos)
    distancias, indices = arbol.query(puntos, k=15) 
    
    aristas_candidatas = []
    aristas_vistas = set()
    
    for i in range(num_nodos):
        for j in range(1, 15):
            vecino = int(indices[i][j])
            peso = float(distancias[i][j])
            arista_id = tuple(sorted((i, vecino)))
            
            if arista_id not in aristas_vistas:
                aristas_vistas.add(arista_id)
                aristas_candidatas.append((peso, i, vecino))
                
    aristas_candidatas.sort(key=lambda item: item[0])
    
    ufds = UFDS(num_nodos)
    mst_aristas = []
    costo_total = 0.0
    
    for peso, u, v in aristas_candidatas:
        if ufds.union(u, v):
            mst_aristas.append({"origen": u, "destino": v})
            costo_total += peso
            if len(mst_aristas) == num_nodos - 1:
                break
                
    tiempo_ms = round((time.time() - start_time) * 1000, 2)
    
    return {
        "nodos": datos_nodos,
        "aristas": mst_aristas,
        "metricas": {
            "distancia": round(costo_total, 4),
            "total_aristas": len(mst_aristas),
            "tiempo_ms": tiempo_ms
        }
    }
