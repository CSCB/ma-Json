document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('jsonInput');
    const jsonOutput = document.getElementById('jsonOutput');
    const validateBtn = document.getElementById('validateBtn');
    const compressBtn = document.getElementById('compressBtn');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // 设置相关元素
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.querySelector('.close');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const apiUrlInput = document.getElementById('apiUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const modelNameInput = document.getElementById('modelName');

    // 默认配置
    let config = {
        apiUrl: 'https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions',
        apiKey: '670a5a5adb08c09e069e8fd54ef2a466:ZWM1MjViZWE3Njk2MzFjNWI2MDA4OThi',
        modelName: 'xop3qwen1b7'
    };

    // 验证并格式化 JSON
    validateBtn.addEventListener('click', () => {
        const input = jsonInput.value.trim();
        if (!input) {
            showStatus('请输入 JSON 字符串', 'invalid');
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const formatted = JSON.stringify(parsed, null, 4);
            const highlighted = syntaxHighlight(formatted);
            jsonOutput.innerHTML = formatWithLineNumbers(highlighted);
            showStatus('验证成功：JSON 格式正确', 'valid');
        } catch (e) {
            // 将英文错误信息翻译为中文
            const errorMsg = translateErrorMessage(e.message);
            
            // 尝试自动修复
            const fixedJson = tryFixJson(input);
            
            let html = `<div class="error-message">${errorMsg}</div>`;
            
            if (fixedJson) {
                html += `
                    <div class="fix-suggestion">
                        <p>💡 本地智能修复方案：</p>
                        <button id="autoFixBtn" class="fix-btn">一键修复</button>
                        <div class="preview-fix">${syntaxHighlight(JSON.stringify(JSON.parse(fixedJson), null, 4))}</div>
                    </div>
                `;
            }

            // 添加 AI 修复按钮
            html += `
                <div class="fix-suggestion" style="background-color: #f0f9ff; border-color: #bae6fd;">
                    <p>🤖 大模型智能修复：</p>
                    <button id="aiFixBtn" class="fix-btn" style="background-color: #0ea5e9;">尝试 AI 修复</button>
                    <div id="aiFixStatus" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
                </div>
            `;
            
            jsonOutput.innerHTML = html;
            showStatus('验证失败：JSON 格式错误', 'invalid');

            // 绑定本地修复按钮事件
            if (fixedJson) {
                const autoFixBtn = document.getElementById('autoFixBtn');
                if (autoFixBtn) {
                    autoFixBtn.addEventListener('click', () => {
                        jsonInput.value = JSON.stringify(JSON.parse(fixedJson), null, 4);
                        validateBtn.click(); // 重新触发验证
                    });
                }
            }

            // 绑定 AI 修复按钮事件
            const aiFixBtn = document.getElementById('aiFixBtn');
            if (aiFixBtn) {
                aiFixBtn.addEventListener('click', () => {
                    handleAiFix(input);
                });
            }
        }
    });

    // 处理 AI 修复
    async function handleAiFix(wrongJson) {
        const aiFixBtn = document.getElementById('aiFixBtn');
        const aiFixStatus = document.getElementById('aiFixStatus');
        
        aiFixBtn.disabled = true;
        aiFixBtn.textContent = '修复中...';
        aiFixStatus.textContent = '正在请求大模型，请稍候...';

        try {
            let response;
            try {
                // 优先尝试通过本地代理请求
                response = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        targetUrl: config.apiUrl,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`
                        },
                        body: {
                            model: config.modelName,
                            messages: [
                                {
                                    role: 'system',
                                    content: '你是一个 JSON 修复专家。请修复用户提供的 JSON 字符串。只返回修复后的 JSON 内容，不要包含任何 Markdown 标记（如 ```json），不要包含任何解释性文字。如果无法修复，请返回原始字符串。'
                                },
                                {
                                    role: 'user',
                                    content: wrongJson
                                }
                            ],
                            stream: false
                        }
                    })
                });

                // 如果代理接口不存在(404)或出错，抛出异常以触发降级重试
                if (response.status === 404) {
                    throw new Error('Proxy not found');
                }
            } catch (proxyError) {
                console.warn('代理请求失败，尝试直接请求:', proxyError);
                // 降级：直接请求大模型接口 (需接口支持 CORS)
                response = await fetch(config.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: config.modelName,
                        messages: [
                            {
                                role: 'system',
                                content: '你是一个 JSON 修复专家。请修复用户提供的 JSON 字符串。只返回修复后的 JSON 内容，不要包含任何 Markdown 标记（如 ```json），不要包含任何解释性文字。如果无法修复，请返回原始字符串。'
                            },
                            {
                                role: 'user',
                                content: wrongJson
                            }
                        ],
                        stream: false
                    })
                });
            }

            if (!response.ok) {
                let errorMsg = `请求失败: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMsg = `${response.status} - ${errorData.error.message}`;
                    } else if (errorData.message) {
                        errorMsg = `${response.status} - ${errorData.message}`;
                    }
                    
                    // 特定状态码处理
                    if (response.status === 401) {
                        errorMsg = `身份验证失败 (401)：请检查 API Key 是否正确。\n原始错误: ${errorMsg}`;
                    } else if (response.status === 403) {
                        errorMsg = `权限不足 (403)：请检查是否开通了该模型权限或 API Key 是否正确。\n原始错误: ${errorMsg}`;
                    } else if (response.status === 429) {
                        errorMsg = `请求过快或额度不足 (429)：请稍后重试或检查账户余额。\n原始错误: ${errorMsg}`;
                    } else if (response.status >= 500) {
                        errorMsg = `服务器错误 (${response.status})：讯飞服务暂时不可用，请稍后重试。\n原始错误: ${errorMsg}`;
                    }
                } catch (e) {
                    // JSON 解析失败，使用默认错误
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            
            // 解析 OpenAI 格式的响应
            let fixedContent = '';
            let reasoningContent = '';
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const message = data.choices[0].message;
                fixedContent = message.content || '';
                reasoningContent = message.reasoning_content || ''; // 获取思考过程
            } else {
                throw new Error('大模型返回格式异常');
            }

            // 清理可能的 Markdown 标记
            fixedContent = fixedContent.replace(/^```json\s*/, '').replace(/^```/, '').replace(/\s*```$/, '');
            
            // 如果有思考过程，可以在控制台输出或显示（这里简单打印到控制台，如果用户需要可以展示）
            if (reasoningContent) {
                console.log('AI 思考过程:', reasoningContent);
            }

            try {
                // 验证修复后的 JSON
                const parsed = JSON.parse(fixedContent);
                jsonInput.value = JSON.stringify(parsed, null, 4);
                validateBtn.click(); // 重新触发验证
                aiFixStatus.textContent = '修复成功！';
            } catch (e) {
                aiFixStatus.textContent = '大模型修复后的结果仍无效，请检查 Key 或模型配置。';
                console.error('AI 修复结果无效:', fixedContent);
                
                // 如果修复失败但有内容，显示原始内容供参考
                if (fixedContent) {
                     aiFixStatus.innerHTML += `<br><a href="#" onclick="alert(decodeURIComponent('${encodeURIComponent(fixedContent)}'));return false;">查看返回内容</a>`;
                }
            }

        } catch (error) {
            console.error('AI Fix Error:', error);
            aiFixStatus.innerHTML = `<span style="color: red;">修复失败: ${error.message}</span>`;
        } finally {
            aiFixBtn.disabled = false;
            aiFixBtn.textContent = '尝试 AI 修复';
        }
    }

    // 设置模态框逻辑
    settingsBtn.onclick = () => {
        apiUrlInput.value = config.apiUrl;
        apiKeyInput.value = config.apiKey;
        modelNameInput.value = config.modelName;
        settingsModal.style.display = "block";
    }

    closeBtn.onclick = () => {
        settingsModal.style.display = "none";
    }

    window.onclick = (event) => {
        if (event.target == settingsModal) {
            settingsModal.style.display = "none";
        }
    }

    saveSettingsBtn.onclick = () => {
        config.apiUrl = apiUrlInput.value.trim();
        config.apiKey = apiKeyInput.value.trim();
        config.modelName = modelNameInput.value.trim();
        settingsModal.style.display = "none";
        showStatus('配置已保存', 'valid');
    }

    // 尝试修复 JSON (本地逻辑保持不变)
    function tryFixJson(str) {
        let fixed = str;
        fixed = fixed.replace(/\bNone\b/g, 'null').replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false');
        fixed = fixed.replace(/,\s*([\]}])/g, '$1');
        fixed = fixed.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
        try { JSON.parse(fixed); return fixed; } catch(e) {}
        let quoteFixed = fixed.replace(/'/g, '"');
        try { JSON.parse(quoteFixed); return quoteFixed; } catch(e) {}
        let keyFixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
        try { JSON.parse(keyFixed); return keyFixed; } catch(e) {}
        let combo = fixed.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3').replace(/,\s*([\]}])/g, '$1');
        try { JSON.parse(combo); return combo; } catch(e) {}
        return null;
    }

    // 压缩 JSON
    compressBtn.addEventListener('click', () => {
        const input = jsonInput.value.trim();
        if (!input) {
             showStatus('请输入 JSON 字符串', 'invalid');
             return;
        }

        try {
            const parsed = JSON.parse(input);
            const compressed = JSON.stringify(parsed);
            jsonOutput.innerHTML = `<div class="simple-output">${compressed}</div>`;
            showStatus('压缩成功', 'valid');
        } catch (e) {
            const errorMsg = translateErrorMessage(e.message);
            jsonOutput.innerHTML = `<div class="error-message">${errorMsg}</div>`;
            showStatus('压缩失败：JSON 格式错误', 'invalid');
        }
    });

    // 清空
    clearBtn.addEventListener('click', () => {
        jsonInput.value = '';
        jsonOutput.innerHTML = '';
        statusMessage.textContent = '';
    });

    // 复制结果
    copyBtn.addEventListener('click', () => {
        let text = '';
        const codeContents = jsonOutput.querySelectorAll('.code-content');
        if (codeContents.length > 0) {
            text = Array.from(codeContents).map(el => el.textContent).join('\n');
        } else {
            text = jsonOutput.innerText;
        }

        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '已复制!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('无法复制内容: ', err);
            showStatus('复制失败', 'invalid');
        });
    });

    // 显示状态信息
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type === 'valid' ? 'status-valid' : 'status-invalid';
    }

    // 简单的错误信息翻译
    function translateErrorMessage(msg) {
        if (msg.includes('Expected property name') || msg.includes('Expected double-quoted property name')) {
            return `语法错误：Key 必须使用双引号。\n(可能原因：Key 没有加引号，或者使用了单引号)\n原始错误：${msg}`;
        }
        if (msg.includes('Unexpected token')) {
            return `语法错误：在 JSON 中发现了意外的字符。\n(可能原因：多余的逗号、缺少引号、使用了中文符号等)\n原始错误：${msg}`;
        }
        if (msg.includes('Unexpected end of JSON input')) {
            return `语法错误：JSON 输入不完整（意外结尾）。\n(可能原因：缺少结束的大括号 } 或中括号 ])\n原始错误：${msg}`;
        }
        if (msg.includes('Unexpected number')) {
            return `语法错误：数字格式不正确。\n原始错误：${msg}`;
        }
        if (msg.includes('Unexpected string')) {
            return `语法错误：字符串格式不正确。\n原始错误：${msg}`;
        }
        if (msg.includes('Expected')) {
             return `语法错误：JSON 结构不符合预期。\n原始错误：${msg}`;
        }
        return `解析错误：${msg}`;
    }

    // JSON 语法高亮
    function syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    // 添加行号
    function formatWithLineNumbers(html) {
        const lines = html.split('\n');
        return lines.map((line, index) => 
            `<div class="code-line">
                <div class="line-number">${index + 1}</div>
                <div class="code-content">${line}</div>
            </div>`
        ).join('');
    }
});
