from http.server import BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import re
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Obtener el nombre del medicamento del query string
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        nombre = params.get('q', [''])[0]
        
        if not nombre:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'missing q param'}).encode())
            return

        try:
            result = buscar_medicamento(nombre)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

def buscar_medicamento(nombre):
    session_url = 'https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul'
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    }
    
    # Paso 1: obtener dtid de la sesión
    req = urllib.request.Request(session_url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        cookies = resp.headers.get('Set-Cookie', '')
    
    dtid_match = re.search(r"dtid\s*=\s*['\"]([^'\"]+)['\"]", html)
    if not dtid_match:
        dtid_match = re.search(r'z_a\w+', html)
    
    dtid = dtid_match.group(1) if dtid_match and dtid_match.lastindex else ''
    if not dtid:
        dtid_match = re.search(r"'(z_[a-z0-9]+)'", html)
        dtid = dtid_match.group(1) if dtid_match else 'z_a8y'

    # Paso 2: buscar el medicamento
    zkau_url = 'https://servicios.pami.org.ar/vademecum/zkau'
    data = urllib.parse.urlencode({
        'dtid': dtid,
        'cmd_0': 'onChange',
        'uuid_0': 'zk_comp_34',
        'data_0': json.dumps({'value': nombre, 'start': len(nombre)})
    }).encode()
    
    req2 = urllib.request.Request(zkau_url, data=data, headers={
        **headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
    })
    
    with urllib.request.urlopen(req2, timeout=15) as resp2:
        response_html = resp2.read().decode('utf-8', errors='ignore')
    
    sin_tacc = 'isologo1.jpg' in response_html
    
    return {
        'nombre': nombre,
        'sin_tacc': sin_tacc,
        'found': len(response_html) > 100
    }
