const https = require('https');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, headers: res.headers }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

exports.handler = async (event) => {
  const nombre = event.queryStringParameters?.q;
  
  if (!nombre) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing q param' }) };
  }

  try {
    const session = await makeRequest('https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul', {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const dtidMatch = session.data.match(/'(z_[a-z0-9]+)'/);
    const dtid = dtidMatch ? dtidMatch[1] : 'z_a8y';
    const cookies = session.headers['set-cookie']?.join('; ') || '';

    c    const body = new URLSearchParams({
      dtid,
      cmd_0: 'onChange',
      uuid_0: 'zk_comp_28',
      data_0: JSON.stringify({ value: nombre, start: nombre.length }),
      cmd_1: 'onClick',
      uuid_1: 'zk_comp_80',
      data_1: JSON.stringify({ pageX: 143, pageY: 351, which: 1, x: 39, y: 16 })
    }).toString();

    const result = await makeRequest('https://servicios.pami.org.ar/vademecum/zkau', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body
    });

        const sinTacc = result.data.includes('isologo1.jpg');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        nombre, 
        sin_tacc: sinTacc, 
        found: result.data.length > 100,
        session_length: session.data.length,
        result_length: result.data.length,
        dtid,
        result_preview: result.data.substring(0, 200)
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
