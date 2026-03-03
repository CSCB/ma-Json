const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);

    // API 代理接口
    if (parsedUrl.pathname === '/api/proxy' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { targetUrl, method, headers, body: requestBody } = JSON.parse(body);
                
                // 简单的安全检查，防止滥用
                const target = new URL(targetUrl);
                if (!target.hostname.endsWith('xf-yun.com')) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '只允许访问讯飞 API' }));
                    return;
                }

                const options = {
                    hostname: target.hostname,
                    port: target.port || (target.protocol === 'https:' ? 443 : 80),
                    path: target.pathname + target.search,
                    method: method || 'POST',
                    headers: {
                        ...headers,
                        'Host': target.hostname
                    }
                };

                const requestModule = target.protocol === 'https:' ? https : http;
                const proxyReq = requestModule.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res);
                });

                proxyReq.on('error', (e) => {
                    console.error('代理请求错误:', e);
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '代理请求失败', details: e.message }));
                });

                if (requestBody) {
                    proxyReq.write(typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody));
                }
                proxyReq.end();

            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '无效的请求数据' }));
            }
        });
        return;
    }

    // 静态文件服务
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT'){
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const port = 8081;
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
