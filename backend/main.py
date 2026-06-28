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

class DSU:
    def __init__(self, n):
        self.p = list(range(n))
        self.r = [0]*n
    def find(self, x):
        if self.p[x] != x:
            self.p[x] = self.find(self.p[x])
        return self.p[x]
    def union(self, a, b):
        a = self.find(a); b = self.find(b)
        if a == b:
            return False
        if self.r[a] < self.r[b]:
            a, b = b, a
        self.p[b] = a
        if self.r[a] == self.r[b]:
            self.r[a] += 1
        return True

def kruskal(n, edges):
    edges_sorted = sorted(edges, key=lambda e: e[2])
    dsu = DSU(n)
    mst = []
    total = 0
    for u, v, w in edges_sorted:
        if dsu.union(u, v):
            mst.append((u, v, w))
            total += w
    return mst, total

datos_nodos = []
x_coords = []
y_coords = []

@app.on_event("startup")
def cargar_datos():
    global datos_nodos, x_coords, y_coords
    folder_actual = os.path.dirname(os.path.abspath(__file__))
    archivo_excel = os.path.join(folder_actual, 'dataset_cusco_geogpsperu.xlsx')
    if not os.path.exists(archivo_excel):
        print(f"ERROR: No se encontró el archivo: {archivo_excel}")
        return
    df = pd.read_excel(archivo_excel)
    df = df.dropna(subset=['LONGITUD', 'LATITUD'])
    x_coords = df['LONGITUD'].values
    y_coords = df['LATITUD'].values
    for i in range(len(x_coords)):
        datos_nodos.append({"id": i, "x": float(x_coords[i]), "y": float(y_coords[i])})
    print("¡Servidor listo!")

@app.get("/api/nodos")
def get_nodos():
    return {"nodos": datos_nodos}

@app.get("/api/kruskal")
def ejecutar_kruskal():
    start_time = time.time()
    num_nodos = len(x_coords)
    puntos = np.column_stack((x_coords, y_coords))
    arbol = KDTree(puntos)
    distancias, indices = arbol.query(puntos, k=15) 
    edges = []
    aristas_vistas = set()
    for i in range(num_nodos):
        for j in range(1, 15):
            vecino = int(indices[i][j])
            peso = float(distancias[i][j])
            arista_id = tuple(sorted((i, vecino)))
            if arista_id not in aristas_vistas:
                aristas_vistas.add(arista_id)
                edges.append((i, vecino, peso))
    mst_edges, costo_total = kruskal(num_nodos, edges)
    tiempo_ms = round((time.time() - start_time) * 1000, 2)
    return {
        "nodos": datos_nodos,
        "aristas": [{"origen": u, "destino": v} for u, v, w in mst_edges],
        "metricas": {
            "distancia": round(costo_total, 4),
            "total_aristas": len(mst_edges),
            "tiempo_ms": tiempo_ms
        }
    }
