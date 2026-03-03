const { execSync, spawn } = require('child_process');
const http = require('http');

const PORT = 8081;

// 检查并释放端口
async function releasePort() {
    console.log(`\n==============================================`);
    console.log(`        正在启动 JSON 验证工具`);
    console.log(`==============================================\n`);
    
    console.log(`正在检查端口 ${PORT} 是否被占用...`);
    try {
        // 使用 PowerShell 查找占用端口的进程
        // 注意：这里需要确保 execSync 执行成功并返回 pid
        const command = `powershell -NoProfile -Command "$ErrorActionPreference = 'SilentlyContinue'; Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess"`;
        const pid = execSync(command, { encoding: 'utf8' }).trim();

        if (pid) {
            console.log(`发现端口被进程 PID: ${pid} 占用，正在结束该进程...`);
            try {
                execSync(`taskkill /F /PID ${pid}`);
                console.log('端口已成功释放。');
            } catch (e) {
                console.error('无法释放端口，请尝试以管理员身份运行。');
            }
        } else {
            // console.log('端口未被占用。');
        }
    } catch (error) {
        // 忽略错误，因为可能是没有权限或者是没有找到进程
        // console.error('释放端口时出错:', error.message);
    }
}

// 启动浏览器
function openBrowser() {
    console.log('正在打开浏览器...');
    const url = `http://localhost:${PORT}`;
    const startCmd = process.platform === 'win32' ? 'start ""' : 'open';
    try {
        execSync(`${startCmd} "${url}"`);
    } catch (e) {
        console.error('无法自动打开浏览器，请手动访问:', url);
    }
}

// 启动服务器
function startServer() {
    console.log('正在启动服务器...');
    console.log('服务器运行中，请保持此窗口开启。关闭窗口将停止服务。\n');
    
    // 启动 server.js
    const serverProcess = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });

    serverProcess.on('error', (err) => {
        console.error('无法启动 server.js:', err.message);
        console.log('请检查是否已安装 Node.js，并且 server.js 文件存在。');
    });

    // 如果服务器进程关闭，提示用户
    serverProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`服务器进程异常退出，退出码: ${code}`);
            console.log('按任意键退出...');
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.on('data', process.exit.bind(process, 0));
        }
    });
}

// 主流程
(async () => {
    try {
        await releasePort();
        // 稍微等待一下确保端口释放完成
        setTimeout(() => {
            // 先启动服务器
            startServer();
            // 等待服务器启动后再打开浏览器
            setTimeout(openBrowser, 1500);
        }, 1000);
    } catch (err) {
        console.error('发生未知错误:', err);
    }
})();
