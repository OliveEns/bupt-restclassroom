// ==UserScript==
// @name         北邮主楼空闲教室分析
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  登录北邮移动教务网页端，自动执行空闲教室分析
// @author       Oliver
// @match        *://jwglweixin.bupt.edu.cn/sjd/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    // -------------------------- 页面标识 --------------------------
    const Hashs =['#/login','#/new/Home_10013','#/restClassroom'];

    // -------------------------- 用户配置 --------------------------
    const LOGIN_CONFIG = {
        username: "", // 学号
        password: "", // 教务密码
        maxWaitTime: 10000,
        loginDelay: 100
    };
    // -------------------------- 功能配置 --------------------------
    const LOGIN_SELECTORS = {
        usernameInput: '.log-input:nth-child(1) .input-item input[type="text"]',
        passwordInput: '.log-input:nth-child(2) .input-item input[type="password"]',
        loginButton: '.log-btn button'
    };

    const TARGET_REQUEST_PATH = '/bjyddx/todayClassrooms';
    const TARGET_REQUEST_METHOD = 'POST';
    // --------------------------------------------------------------

    let isLoginExecuted = false; // 标记是否已执行
    let isClickExecuted = false;
    let isRoomExecuted = false;

    let pollingTimer = null;

    let rawData = null;

    // -------------------------- 表格样式 --------------------------
    const TABLE_STYLE ={ style:`
        /* 全局样式重置 */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            margin: 0;
            padding: 20px;
            font-family: "Inter", "Microsoft YaHei", sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
        }

        /* 主容器样式 */
        .container {
            max-width: 98%;
            margin: 0 auto;
            overflow: hidden;
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        /* 标题区域样式 */
        .title-wrapper {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 2px solid #e8f4f8;
            padding-bottom: 15px;
        }
        .main-title {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 8px;
        }
        .sub-title {
            font-size: 14px;
            color: #718096;
            font-weight: 400;
        }

        /* 统计信息栏样式 */
        .stats-bar {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #4299e1;
        }
        .stat-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .stat-label {
            color: #4a5568;
            font-size: 14px;
        }
        .stat-value {
            color: #2d3748;
            font-size: 16px;
            font-weight: 600;
        }

        /* 表格滚动容器样式 */
        .table-scroll-container {
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 10px;
            transition: all 0.3s ease;
        }

        /* 核心表格样式 */
        .classroom-table {
            border-collapse: separate;
            border-spacing: 0;
            width: 100%;
            min-width: 1200px;
            background: white;
            border-radius: 10px;
            overflow: hidden;
        }

        /* 表头样式 */
        .classroom-table th {
            background: linear-gradient(135deg, #4299e1 0%, #38b2ac 100%);
            color: white;
            font-weight: 600;
            padding: 12px 8px;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
            font-size: 13px;
            border: none;
        }
        .classroom-table th:first-child {
            position: sticky;
            left: 0;
            z-index: 101;
            background: #4299e1;
        }

        /* 单元格基础样式 */
        .classroom-table td {
            padding: 10px 8px;
            text-align: center;
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
            border-right: 1px solid #e2e8f0;
            transition: all 0.2s ease;
        }
        .classroom-table td:last-child {
            border-right: none;
        }
        .classroom-table tr:last-child td {
            border-bottom: none;
        }

        /* 教室名称列样式 */
        .classroom-name {
            background: #e8f4f8;
            color: #2d3748;
            font-weight: 600;
            position: sticky;
            left: 0;
            z-index: 90;
            border-right: 2px solid #d1e7dd !important;
        }

        /* 空闲/忙碌状态样式 */
        .free {
            background: #f0f8fb;
            color: #38b2ac;
            font-weight: 600;
        }
        .free::before {
            content: "✓ ";
            color: #38b2ac;
        }
        .busy {
            background: #fef7fb;
            color: #e53e3e;
        }
        .busy::before {
            content: "✗ ";
            color: #e53e3e;
        }

        /* 行交互效果 - 统一处理奇偶行hover */
        .classroom-table tr:hover td {
            background: #f8f9fa !important;
        }
        .classroom-table tr:hover .classroom-name {
            background: #d1e7dd !important;
        }
        .classroom-table tr:hover .free {
            background: #e8f4f8 !important;
        }
        .classroom-table tr:hover .busy {
            background: #fdf2f8 !important;
        }

        /* 奇偶行区分样式 */
        .classroom-table tr:nth-child(even) td {
            background: #fafafa;
        }
        .classroom-table tr:nth-child(even) .classroom-name {
            background: #f0f8fb;
        }
        .classroom-table tr:nth-child(even) .free {
            background: #f5fafe;
        }
        .classroom-table tr:nth-child(even) .busy {
            background: #fef5f7;
        }

        /* 滚动条样式优化 */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }

        /* 响应式适配样式 */
        @media (max-width: 1024px) {
            .container {
                padding: 20px;
            }
            .main-title {
                font-size: 22px;
            }
            .stats-bar {
                gap: 15px;
                padding: 12px;
            }
            .classroom-table th, .classroom-table td {
                padding: 10px 6px;
                font-size: 12px;
            }
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 15px;
                border-radius: 12px;
            }
            .main-title {
                font-size: 20px;
            }
            .sub-title {
                font-size: 12px;
            }
            .stats-bar {
                gap: 10px;
                padding: 10px;
                flex-direction: column;
                align-items: flex-start;
            }
            .stat-item {
                width: 100%;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px dashed #e2e8f0;
            }
            .stat-item:last-child {
                border-bottom: none;
            }
            .classroom-table th, .classroom-table td {
                padding: 8px 4px;
                font-size: 11px;
            }
        }

        @media (max-width: 480px) {
            .container {
                padding: 10px;
            }
            .classroom-name {
                min-width: 80px;
            }
        }
    `};

    // ---------------------------- 登录 ----------------------------

    /**
     * 等待元素加载
     * @param {string} selector - CSS选择器
     * @returns {Promise<Element|null>} 找到的元素/超时返回null
     */
    function waitForElement(selector) {
        return new Promise((resolve) => {
            const checkInterval = 300;
            let checkCount = 0;

            const timer = setInterval(() => {
                const element = document.querySelector(selector);
                if (element || checkCount >= LOGIN_CONFIG.maxWaitTime / checkInterval) {
                    clearInterval(timer);
                    resolve(element);
                }
                checkCount++;
            }, checkInterval);
        });
    }

    /**
     * 模拟输入
     * @param {Element} element - 输入框元素
     * @param {string} value - 要输入的值
     * @returns {boolean} 输入是否成功
     */
    function simulateVueInput(element, value) {
        if (!element) return false;

        element.value = "";
        element.focus();

        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
        }

        element.blur();
        console.log(`✅ 成功填充【${element.type === 'password' ? '密码' : '学号'}】`);
        return true;
    }

    /**
     * 核心自动登录逻辑
     */
    async function autoLogin() {
        if (isLoginExecuted) return;
        isLoginExecuted = true;

        console.log(`🔍 开始执行北邮移动教务自动登录...`);

        try {
            // 等待核心元素加载
            const usernameEl = await waitForElement(LOGIN_SELECTORS.usernameInput);
            const passwordEl = await waitForElement(LOGIN_SELECTORS.passwordInput);
            const loginBtn = await waitForElement(LOGIN_SELECTORS.loginButton);

            // 检查元素是否全部找到
            if (!usernameEl) throw new Error(`未找到学号/工号输入框`);
            if (!passwordEl) throw new Error(`未找到密码输入框`);
            if (!loginBtn) throw new Error(`未找到登录按钮`);

            // 填充账号密码
            simulateVueInput(usernameEl, LOGIN_CONFIG.username);
            simulateVueInput(passwordEl, LOGIN_CONFIG.password);

            // 延迟点击登录
            setTimeout(() => {
                loginBtn.click();
                console.log(`✅ 点击登录按钮，登录流程完成！`);
            }, LOGIN_CONFIG.loginDelay);

        } catch (error) {
            console.error(`❌ 自动登录失败：`, error.message);
            isLoginExecuted = false;
        }
    }

    // ------------------------ 查询空闲教室 ------------------------

    /**
     * 模拟真实用户的鼠标点击事件
     * @param {HTMLElement} element - 目标元素
     */
    function simulateRealClick(element) {
        if (!element) return false;

        const events = [
            { type: 'mouseover', bubbles: true },
            { type: 'mousedown', bubbles: true, button: 0 },
            { type: 'mouseup', bubbles: true, button: 0 },
            { type: 'click', bubbles: true }
        ];

        events.forEach(eventOpts => {
            const event = new MouseEvent(eventOpts.type, {
                bubbles: eventOpts.bubbles,
                cancelable: true,
                view: window,
                button: eventOpts.button || 0
            });
            element.dispatchEvent(event);
        });

        const touchEvents = [
            { type: 'touchstart', bubbles: true },
            { type: 'touchend', bubbles: true }
        ];

        touchEvents.forEach(eventOpts => {
            const event = new TouchEvent(eventOpts.type, {
                bubbles: eventOpts.bubbles,
                cancelable: true,
                touches: [new Touch({ identifier: 0, target: element, clientX: 10, clientY: 10 })]
            });
            element.dispatchEvent(event);
        });

        console.log(`✅ 已模拟真实用户点击事件`);
        return true;
    }

    /**
     * 查找目标元素
     */
    function findTargetElement() {
        const gridItems = document.querySelectorAll('.common-item.van-grid-item');
        for (const item of gridItems) {
            const textNode = item.querySelector('.item-value');
            if (textNode && textNode.textContent.trim() === '今日空闲教室') {
                const clickableEl = item.querySelector('.van-grid-item__content');
                return clickableEl || item;
            }
        }
        return null;
    }

    /**
     * 轮询检测并触发点击
     */
    function pollAndClick() {
        let attempts = 0;
        const maxAttempts = 30;
        const interval = 100;

        if (isClickExecuted) return;
        isClickExecuted = true;
        const timer = setInterval(() => {
            attempts++;
            console.log(`🔍 第${attempts}次检测目标元素...`);

            const targetEl = findTargetElement();
            if (targetEl) {
                clearInterval(timer);
                console.log(`✅ 找到目标元素，开始模拟点击`);
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    simulateRealClick(targetEl);
                }, 100);
                return;
            }

            // 达到最大尝试次数
            if (attempts >= maxAttempts) {
                clearInterval(timer);
                console.warn(`❌ 未找到“今日空闲教室”按钮，点击失败`);
                isClickExecuted = false;
                const allGridItems = document.querySelectorAll('.van-grid-item');
                console.log(`📌 页面中所有grid元素：`, allGridItems);
                allGridItems.forEach((el, idx) => {
                    const text = el.querySelector('.item-value')?.textContent || '无文本';
                    console.log(`第${idx+1}个：${text.trim()}`);
                });
            }
        }, interval);
    }

    // ---------------------- 获取数据渲染表格 ----------------------

    /**
     * 获取url路径
     */
    function getUrlPath(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname;
        } catch (e) {
            return url.split('?')[0].split('#')[0];
        }
    }

    /**
     * 核心数据处理及渲染逻辑
     */
    function runClassroomAnalysis() {
        if (isRoomExecuted) return;
        isRoomExecuted = true;

        // 数据预处理与排序
        function processAndSortClassrooms(rawData) {
            const classroomFreeTimes = {};
            const nodeTimeMap = {};
            const totalNodes = rawData.data.length;

            rawData.data.forEach(timeNode => {
                const nodeNum = parseInt(timeNode.NODENAME);
                nodeTimeMap[nodeNum] = timeNode.NODETIME;

                const classrooms = timeNode.CLASSROOMS.split(',').map(cls => {
                    const cleanCls = cls.split('(')[0].trim();
                    return cleanCls.startsWith('未') ? cleanCls : null;
                }).filter(Boolean);

                classrooms.forEach(cls => {
                    if (!classroomFreeTimes[cls]) {
                        classroomFreeTimes[cls] = [];
                    }
                    if (!classroomFreeTimes[cls].includes(nodeNum)) {
                        classroomFreeTimes[cls].push(nodeNum);
                    }
                });
            });

            Object.keys(classroomFreeTimes).forEach(cls => {
                classroomFreeTimes[cls].sort((a, b) => a - b);
            });

            function calculateFreeScore(freeNodes) {
                if (new Set(freeNodes).size === totalNodes && freeNodes.includes(totalNodes)) {
                    return 100 + totalNodes;
                }

                let maxContinuous = 0;
                let currentContinuous = 0;
                let lastNode = totalNodes;

                for (let i = freeNodes.length - 1; i >= 0; i--) {
                    const node = freeNodes[i];
                    if (node === lastNode) {
                        currentContinuous++;
                        lastNode--;
                    } else {
                        break;
                    }
                }
                maxContinuous = currentContinuous;

                if (maxContinuous === 0) {
                    let current = 1;
                    for (let i = 1; i < freeNodes.length; i++) {
                        if (freeNodes[i] === freeNodes[i-1] + 1) {
                            current++;
                            maxContinuous = Math.max(maxContinuous, current);
                        } else {
                            current = 1;
                        }
                    }
                    maxContinuous = Math.max(maxContinuous, current);
                }

                if (maxContinuous > 0) {
                    const startNode = totalNodes - maxContinuous + 1;
                    if (freeNodes.includes(startNode)) {
                        return maxContinuous + (totalNodes + 1 - startNode) / 10;
                    }
                }

                return maxContinuous;
            }

            const classroomAnalysis = [];
            Object.keys(classroomFreeTimes).forEach(cls => {
                const freeNodes = classroomFreeTimes[cls];
                const score = calculateFreeScore(freeNodes);

                let maxLen = 0;
                let maxStart = null;
                let maxEnd = null;
                const isAllFree = new Set(freeNodes).size === totalNodes && freeNodes.includes(totalNodes);

                if (isAllFree) {
                    maxLen = totalNodes;
                    maxStart = 1;
                    maxEnd = totalNodes;
                } else {
                    let currentLen = 0;
                    let last = totalNodes;
                    for (let i = freeNodes.length - 1; i >= 0; i--) {
                        if (freeNodes[i] === last) {
                            currentLen++;
                            last--;
                        } else {
                            break;
                        }
                    }

                    if (currentLen > 0) {
                        maxLen = currentLen;
                        maxStart = totalNodes - currentLen + 1;
                        maxEnd = totalNodes;
                    } else {
                        let current = 1;
                        let currentStart = freeNodes[0];
                        for (let i = 1; i < freeNodes.length; i++) {
                            if (freeNodes[i] === freeNodes[i-1] + 1) {
                                current++;
                            } else {
                                if (current > maxLen) {
                                    maxLen = current;
                                    maxStart = currentStart;
                                    maxEnd = freeNodes[i-1];
                                }
                                current = 1;
                                currentStart = freeNodes[i];
                            }
                        }
                        if (current > maxLen) {
                            maxLen = current;
                            maxStart = currentStart;
                            maxEnd = freeNodes[freeNodes.length - 1];
                        }
                    }
                }

                classroomAnalysis.push({
                    classroom: cls,
                    score: score,
                    isAllFree: isAllFree,
                    maxContinuousLength: maxLen,
                    maxContinuousStart: maxStart,
                    maxContinuousEnd: maxEnd,
                    maxContinuousStartTime: nodeTimeMap[maxStart] || "未知",
                    maxContinuousEndTime: nodeTimeMap[maxEnd] || "未知",
                    freeNodes: freeNodes,
                    allFreeNodes: [...freeNodes].sort((a, b) => a - b)
                });
            });

            classroomAnalysis.sort((a, b) => b.score - a.score);

            const totalClassrooms = classroomAnalysis.length;
            const allFreeClassrooms = classroomAnalysis.filter(item => item.isAllFree).length;
            const maxContinuousAll = Math.max(...classroomAnalysis.map(item => item.maxContinuousLength));
            const bestClassroom = classroomAnalysis[0] || {};

            return {
                sortedClassrooms: classroomAnalysis,
                nodeTimeMap: nodeTimeMap,
                totalNodes: totalNodes,
                nodeList: Object.keys(nodeTimeMap).map(num => parseInt(num)).sort((a, b) => a - b),
                stats: {
                    totalClassrooms,
                    allFreeClassrooms,
                    maxContinuousAll,
                    bestClassroom: bestClassroom.classroom || "无",
                    bestContinuous: `${bestClassroom.maxContinuousStartTime || "未知"} - ${bestClassroom.maxContinuousEndTime || "未知"}`
                },
                updateTime: new Date().toLocaleString('zh-CN')
            };
        }

        // 渲染表格
        function renderClassroomTable(processedData) {
            const { sortedClassrooms, nodeTimeMap, nodeList, stats, updateTime } = processedData;

            document.documentElement.innerHTML = '';
            document.body.innerHTML = '';
            const styleEl = document.createElement('style');
            styleEl.textContent = TABLE_STYLE.style;
            document.head.appendChild(styleEl);

            const container = document.createElement('div');
            container.className = 'container';

            const titleWrapper = document.createElement('div');
            titleWrapper.className = 'title-wrapper';

            const mainTitle = document.createElement('h1');
            mainTitle.className = 'main-title';
            mainTitle.textContent = '北邮主楼空闲教室分析';

            const subTitle = document.createElement('p');
            subTitle.className = 'sub-title';
            subTitle.textContent = `数据更新时间：${updateTime} | 排序规则：全天空闲 > 连续至最后时段 > 最长连续时长`;

            titleWrapper.appendChild(mainTitle);
            titleWrapper.appendChild(subTitle);
            container.appendChild(titleWrapper);

            const statsBar = document.createElement('div');
            statsBar.className = 'stats-bar';

            const statsItems = [
                { label: '主楼教室总数', value: stats.totalClassrooms },
                { label: '全天空闲教室', value: stats.allFreeClassrooms },
                { label: '最长连续空闲段', value: `${stats.maxContinuousAll}个时段` },
                { label: '最优空闲教室', value: stats.bestClassroom },
                { label: '最优连续时段', value: stats.bestContinuous }
            ];

            statsItems.forEach(item => {
                const statItem = document.createElement('div');
                statItem.className = 'stat-item';

                const label = document.createElement('span');
                label.className = 'stat-label';
                label.textContent = item.label + '：';

                const value = document.createElement('span');
                value.className = 'stat-value';
                value.textContent = item.value;

                statItem.appendChild(label);
                statItem.appendChild(value);
                statsBar.appendChild(statItem);
            });
            container.appendChild(statsBar);

            const tableScrollContainer = document.createElement('div');
            tableScrollContainer.className = 'table-scroll-container';

            const table = document.createElement('table');
            table.className = 'classroom-table';

            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');

            const headerCell = document.createElement('th');
            headerCell.textContent = '教室名称';
            headerRow.appendChild(headerCell);

            nodeList.forEach(nodeNum => {
                const th = document.createElement('th');
                th.innerHTML = `${nodeNum}<br><small style="font-size: 11px; opacity: 0.9;">${nodeTimeMap[nodeNum]}</small>`;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            sortedClassrooms.forEach((item) => {
                const row = document.createElement('tr');

                const clsCell = document.createElement('td');
                clsCell.className = 'classroom-name';
                clsCell.textContent = item.classroom;
                row.appendChild(clsCell);

                nodeList.forEach(nodeNum => {
                    const td = document.createElement('td');
                    if (item.freeNodes.includes(nodeNum)) {
                        td.className = 'free';
                        td.textContent = '空闲';
                    } else {
                        td.className = 'busy';
                        td.textContent = '忙碌';
                    }
                    row.appendChild(td);
                });

                tbody.appendChild(row);
            });
            table.appendChild(tbody);

            tableScrollContainer.appendChild(table);
            container.appendChild(tableScrollContainer);

            document.body.appendChild(container);

            console.log(`✅ 教室分析完成`);
            stopPolling();
        }

        const processedData = processAndSortClassrooms(rawData);
        renderClassroomTable(processedData);

        console.log(`✅ 空闲教室分析脚本已启动`);
    }

    /**
     * XHR捕获
     */
    function initXHRInterceptor() {
        const originalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            let requestMethod = '';
            let requestUrl = '';

            xhr.open = function(method, url) {
                requestMethod = (method || 'GET').toUpperCase();
                requestUrl = url;
                originalXHR.prototype.open.apply(this, arguments);
            };

            xhr.addEventListener('load', function() {
                const requestPath = getUrlPath(requestUrl);
                const isTargetRequest = requestMethod === TARGET_REQUEST_METHOD && requestPath === TARGET_REQUEST_PATH;

                if (isTargetRequest && xhr.status >= 200 && xhr.status < 300) {
                    try {
                        rawData = JSON.parse(xhr.responseText);
                        if (rawData.code === '1' && rawData.Msg === 'success') {
                            console.log(`✅ 空闲教室数据已获取`,rawData);
                        } else {
                            throw new Error(`请求失败：${rawData.Msg || '未知错误'}`);
                            isRoomExecuted = false;
                        }
                    } catch (error) {
                        console.error(`❌ 数据处理失败`, error);
                        document.body.innerHTML = `
                            <div class="container" style="text-align: center; padding: 40px;">
                                <h2 style="color: #e53e3e; margin-bottom: 20px;">数据加载失败 😕</h2>
                                <p style="color: #4a5568; margin-bottom: 15px;">${error.message}</p>
                                <p style="color: #718096; font-size: 14px;">原始响应：${xhr.responseText}</p>
                            </div>
                        `;
                    }
                }
            });

            xhr.addEventListener('error', function() {
                const requestPath = getUrlPath(requestUrl);
                if (requestMethod === TARGET_REQUEST_METHOD && requestPath === TARGET_REQUEST_PATH) {
                    document.body.innerHTML = `
                        <div class="container" style="text-align: center; padding: 40px;">
                            <h2 style="color: #e53e3e; margin-bottom: 20px;">网络请求出错 😞</h2>
                            <p style="color: #4a5568;">请检查网络连接，或刷新页面重试</p>
                        </div>
                    `;
                    isRoomExecuted = false;
                }
            });

            return xhr;
        };
    }

    // -------------------------- 运行逻辑 --------------------------
    /**
     * 轮询检测页面变化
     */
    function startPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
        }

        pollingTimer = setInterval(() => {
            if (window.location.hash.startsWith(Hashs[2]) && rawData){
                runClassroomAnalysis();
            }
            else if (window.location.hash.startsWith(Hashs[0])){
                autoLogin();
            }
            else if (window.location.hash.startsWith(Hashs[1])){
                pollAndClick();
            }
        }, 100);
        console.log("轮询已启动，定时器ID：", pollingTimer);
    }

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
            console.log("轮询已停止");
        } else {
            console.log("当前没有运行中的轮询");
        }
    }

    initXHRInterceptor();
    startPolling();
})();