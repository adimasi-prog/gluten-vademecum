import urllib.request
import urllib.parse
import re
import json

def handler(event, context):
    params = urllib.parse.parse_qs(urllib.parse.urlparse(event.get('path', '') + '?' + event.get('queryStringParameters', {}).get('q', '')).query)
    nombre = event.get('queryStringParameters', {}).get('q', '')
    
    if not nombre:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'missing q param'})
        }

    try:
        result = buscar_medicamento(nombre)
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def buscar_medicamento(nombre):
    session_url = 'https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul'
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    }
    
    req = urllib.request.Request(session_url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        cookies = resp.headers.get('Set-Cookie', '')
    
    dtid_match = re.search(r"'(z_[a-z0-9]+)'", html)
    dtid = dtid_match.group(1) if dtid_match else 'z_a8y'

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
