const https = require('https');

function makeRequest(urlStr, options) {
  options = options || {};
  return new Promise(function(resolve, reject) {
    var url = new URL(urlStr);
    var reqOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    var req = https.request(reqOptions, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ data: data, headers: res.headers, status: res.statusCode }); });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function buscar(nombre) {
  var agent = new https.Agent({ keepAlive: true });

  var session = await makeRequest('https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul', {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-419,es;q=0.9',
      'Connection': 'keep-alive'
    },
    agent: agent
  });

  var setCookie = session.headers['set-cookie'] || [];
  var jsessionCookie = setCookie.find(function(c) { return c.includes('JSESSIONID'); }) || '';
  var jsessionMatch = jsessionCookie.match(/JSESSIONID=([^;]+)/);
  var jsessionid = jsessionMatch ? jsessionMatch[1] : '';

  var dtidMatch = session.data.match(/'(z_[a-z0-9]+)'/);
  var dtid = dtidMatch ? dtidMatch[1] : 'z_y07';

  var zkSidMatch = session.data.match(/zk\.sid\s*=\s*['"]?(\d+)['"]?/);
  var zkSid = zkSidMatch ? zkSidMatch[1] : '1';

  var params = new URLSearchParams();
  params.append('dtid', dtid);
  params.append('cmd_0', 'onChange');
  params.append('uuid_0', 'zk_comp_28');
  params.append('data_0', JSON.stringify({ value: nombre, start: nombre.length }));
  params.append('cmd_1', 'onClick');
  params.append('uuid_1', 'zk_comp_80');
  params.append('data_1', JSON.stringify({ pageX: 143, pageY: 351, which: 1, x: 39, y: 16 }));

  var zkauUrl = 'https://servicios.pami.org.ar/vademecum/zkau;jsessionid=' + jsessionid;

  var result = await makeRequest(zkauUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'Accept': '*/*',
      'Accept-Language': 'es-419,es;q=0.9',
      'Origin': 'https://servicios.pami.org.ar',
      'Referer': 'https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul',
      'ZK-SID': zkSid,
      'Cookie': 'JSESSIONID=' + jsessionid,
      'Connection': 'keep-alive'
    },
    body: params.toString(),
    agent: agent
  });

  if (result.data.includes('timeout') || result.data.includes('cfmClose')) {
    throw new Error('Session expired - retry');
  }

  return result;
}

exports.handler = async function(event) {
  var nombre = event.queryStringParameters && event.queryStringParameters.q;
  if (!nombre) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing q param' }) };
  }

  try {
    var result = await buscar(nombre);
    var sinTacc = result.data.includes('isologo1.jpg');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        nombre: nombre,
        sin_tacc: sinTacc,
        found: result.data.length > 50,
        result_preview: result.data.substring(0, 1000)
      })
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
