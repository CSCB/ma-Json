const https = require('https');
const http = require('http');

const HOST = 'maas-api.cn-huabei-1.xf-yun.com';
const FULL_KEY = '670a5a5adb08c09e069e8fd54ef2a466:ZWM1MjViZWE3Njk2MzFjNWI2MDA4OThi';
const MODEL = 'xop3qwen1b7';

function makeRequest(protocol, path, method, headers, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            path: path,
            method: method,
            headers: headers
        };

        const req = (protocol === 'https' ? https : http).request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function testAll() {
    console.log('Starting connectivity tests...');
    
    // Test 1: v2 (HTTPS)
    await runTest('v2', 'https');

    // Test 2: v1 (HTTP) - Just in case
    await runTest('v1', 'http');
    
    // Test 3: v1 (HTTPS)
    await runTest('v1', 'https');

    // Test 4: Try using the AppID part of the key as the Model ID
    const appId = FULL_KEY.split(':')[0];
    await runTest('v2', 'https', appId);
}

// Modified runTest to accept model
async function runTest(version, protocolStr, modelOverride) {
    const currentModel = modelOverride || MODEL;
    const body = JSON.stringify({
        model: currentModel,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false
    });

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FULL_KEY}`
    };

    const path = `/${version}/chat/completions`;
    const url = `${protocolStr}://${HOST}${path}`;
    
    console.log(`\n--- Testing ${version.toUpperCase()} (${url}) ---`);
    console.log('Model:', currentModel);
    
    try {
        const res = await makeRequest(protocolStr, path, 'POST', headers, body);
        console.log(`Status: ${res.statusCode}`);
        // console.log(`Headers: ${JSON.stringify(res.headers)}`);
        console.log(`Body: ${res.body}`);
        
        if (res.statusCode === 200) {
            console.log('>>> SUCCESS! This endpoint works.');
            return true;
        } else {
            console.log('>>> FAILED.');
            return false;
        }
    } catch (e) {
        console.error('Error:', e.message);
        return false;
    }
}

async function testAll() {
    console.log('Starting connectivity tests...');
    
    // Test 1: v2 (HTTPS)
    await runTest('v2', 'https');

    // Test 2: v1 (HTTP) - Just in case
    await runTest('v1', 'http');
    
    // Test 3: v1 (HTTPS)
    await runTest('v1', 'https');
}

testAll();
