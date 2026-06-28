document.addEventListener('DOMContentLoaded', () => {
    const btnLoadNodes = document.getElementById('btn-load-nodes');
    const btnKruskal = document.getElementById('btn-kruskal');
    const statusText = document.getElementById('status-text');
    const connectionStatus = document.getElementById('connection-status');
    const mapLegend = document.getElementById('map-legend');
    
    const metricDistance = document.getElementById('metric-distance');
    const metricEdges = document.getElementById('metric-edges');
    const metricTime = document.getElementById('metric-time');

    const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');

    const API_URL = 'http://localhost:8000';

    let graphData = { nodos: [], aristas: [], minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let camera = { x: 0, y: 0, scale: 1, baseScale: 1 };
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let colors = { nodos: '#ffffffe6', aristas: '#4caf50' };

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        ctx.scale(dpr, dpr);
        if (graphData.nodos.length > 0) render();
    }
    window.addEventListener('resize', resizeCanvas);

    function render() {
        if (graphData.nodos.length === 0) return;

        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.save();
        
        ctx.translate(rect.width / 2 + camera.x, rect.height / 2 + camera.y);
        
        const currentScale = camera.baseScale * camera.scale;
        ctx.scale(currentScale, currentScale);

        const cx = (graphData.minX + graphData.maxX) / 2;
        const cy = (graphData.minY + graphData.maxY) / 2;

        if (graphData.aristas && graphData.aristas.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = colors.aristas;
            ctx.lineWidth = 1 / currentScale; 
            ctx.globalAlpha = 0.8;

            for (let i = 0; i < graphData.aristas.length; i++) {
                const a = graphData.aristas[i];
                const n1 = graphData.nodos[a.origen];
                const n2 = graphData.nodos[a.destino];
                
                ctx.moveTo(n1.x - cx, -(n1.y - cy));
                ctx.lineTo(n2.x - cx, -(n2.y - cy));
            }
            ctx.stroke();
        }

        ctx.fillStyle = colors.nodos;
        ctx.globalAlpha = 0.9;
       
        const pixelSize = 0.8 + (camera.scale * 0.12); 
        
        const nodeSize = pixelSize / currentScale; 
        
        for (let i = 0; i < graphData.nodos.length; i++) {
            const n = graphData.nodos[i];
            ctx.beginPath();
            ctx.arc(n.x - cx, -(n.y - cy), nodeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    function loadGraph(nodos, aristas, colorN, colorA) {
        colors.nodos = colorN;
        colors.aristas = colorA;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodos.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        graphData = { nodos, aristas, minX, maxX, minY, maxY };

        const rect = canvas.getBoundingClientRect();
        const scaleX = (rect.width * 0.9) / (maxX - minX);
        const scaleY = (rect.height * 0.9) / (maxY - minY);
        
        camera.baseScale = Math.min(scaleX, scaleY);
        camera.x = 0;
        camera.y = 0;
        camera.scale = 1;

        render();
    }

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
        canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        camera.x = e.clientX - dragStart.x;
        camera.y = e.clientY - dragStart.y;
        render(); 
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(wheel * zoomIntensity);
        
        const newScale = camera.scale * zoomFactor;
        
        if (newScale >= 0.5 && newScale <= 50) {
            camera.x = mouseX - (mouseX - camera.x) * zoomFactor;
            camera.y = mouseY - (mouseY - camera.y) * zoomFactor;
            camera.scale = newScale;
            render();
        }
    }, { passive: false });

    resizeCanvas(); 
    canvas.style.cursor = 'grab';

    fetch(`${API_URL}/api/nodos`)
        .then(res => {
            if (res.ok) {
                connectionStatus.textContent = 'Servidor Conectado';
                connectionStatus.classList.add('connected');
                statusText.textContent = 'Listo. Presiona "Cargar Nodos".';
            }
        })
        .catch(() => {
            connectionStatus.textContent = 'Error: API Desconectada';
            statusText.textContent = 'Enciende el servidor (uvicorn main:app) en la terminal.';
        });

    btnLoadNodes.addEventListener('click', async () => {
        statusText.textContent = 'Cargando datos desde Python...';
        try {
            const res = await fetch(`${API_URL}/api/nodos`);
            const data = await res.json();
            loadGraph(data.nodos, [], '#ffffffe6', null);
            statusText.textContent = ''; 
            if(mapLegend) mapLegend.classList.add('hidden');
        } catch (error) {
            console.error(error);
        }
    });

    btnKruskal.addEventListener('click', async () => {
        statusText.textContent = 'Ejecutando Kruskal en Backend (O(E log V))...';
        metricDistance.textContent = 'Calculando...';
        metricEdges.textContent = '...';
        metricTime.textContent = '...';

        try {
            const res = await fetch(`${API_URL}/api/kruskal`);
            const data = await res.json();
            
            loadGraph(data.nodos, data.aristas, '#ffffffe6', '#4caf50');  
            
            metricDistance.textContent = `${data.metricas.distancia} unid.`;
            metricEdges.textContent = data.metricas.total_aristas;
            metricTime.textContent = `${data.metricas.tiempo_ms} ms`;
            statusText.textContent = '';
            
            if(mapLegend) mapLegend.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Error al ejecutar algoritmo.';
        }
    });
});
