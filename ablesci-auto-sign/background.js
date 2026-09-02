// 科研通(AbleSci.com)自动签到 - Service Worker
// 策略：每 20 分钟轮询签到，当天成功后停止，次日自动重置

const SIGN_URL = "https://www.ablesci.com/user/sign";
const SITE_URL = "https://www.ablesci.com/";
const ALARM_NAME = "ablesci-auto-sign";
const POLL_INTERVAL = 20; // 分钟

// ─── 工具函数 ───

/** 获取当天日期字符串（北京时间），用于判断"今天是否已签" */
function getTodayStr() {
  return new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

// ─── 签到核心逻辑 ───

let isSigning = false;

async function doSign() {
  if (isSigning) {
    console.log("[科研通签到] 已有签到任务正在执行，忽略重复触发");
    return { success: false, message: "已有签到任务正在执行" };
  }
  isSigning = true;

  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  console.log(`[科研通签到] ${now} 开始执行签到...`);

  try {
    // ─── 方案 A: 优先使用已打开的科研通网页标签页直接执行签到 ───
    try {
      const tabExecResult = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 3000); // 3秒超时保护
        chrome.tabs.query({ url: "*://*.ablesci.com/*" }, (tabs) => {
          if (!tabs || tabs.length === 0 || !tabs[0].id) {
            clearTimeout(timer);
            return resolve(null);
          }
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              func: async () => {
                try {
                  const token =
                    document.querySelector('meta[name="csrf-token"]')?.content ||
                    document.querySelector('meta[name="_csrf"]')?.content ||
                    document.querySelector('input[name="_csrf"]')?.value ||
                    (window.yii && window.yii.getCsrfToken ? window.yii.getCsrfToken() : "");

                  const res = await fetch("/user/sign", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                      "X-CSRF-Token": token,
                      "X-Requested-With": "XMLHttpRequest",
                      "Accept": "application/json, text/javascript, */*; q=0.01",
                    },
                    body: `_csrf=${encodeURIComponent(token)}`,
                    credentials: "include",
                  });
                  const txt = await res.text();
                  return { ok: res.ok, status: res.status, text: txt };
                } catch (e) {
                  return { ok: false, error: e.message };
                }
              },
            },
            (results) => {
              clearTimeout(timer);
              if (chrome.runtime.lastError || !results || !results[0]) {
                resolve(null);
              } else {
                resolve(results[0].result);
              }
            }
          );
        });
      });

      if (tabExecResult && tabExecResult.text) {
        console.log("[科研通签到] 网页标签直接执行响应:", tabExecResult);
        let resultJson = {};
        try {
          resultJson = JSON.parse(tabExecResult.text);
        } catch {
          resultJson = { raw: tabExecResult.text };
        }

        const rawMsg =
          resultJson.message ||
          resultJson.msg ||
          resultJson.info ||
          (typeof resultJson.raw === "string" ? resultJson.raw : "");

        const isSuccess =
          resultJson.code === 200 ||
          resultJson.code === 1 ||
          resultJson.status === 1 ||
          resultJson.status === "success" ||
          rawMsg.includes("成功") ||
          rawMsg.includes("已签") ||
          rawMsg.includes("已经签到") ||
          rawMsg.includes("明天再来") ||
          (tabExecResult.ok && !rawMsg.includes("400") && !rawMsg.includes("无法被验证") && !rawMsg.includes("失败"));

        if (isSuccess) {
          const successMsg = rawMsg || "签到成功！";
          await saveLog("success", successMsg);
          await chrome.storage.local.set({ signedToday: getTodayStr() });
          showNotification("签到成功", successMsg);
          return { success: true, message: successMsg };
        }
      }
    } catch (tabErr) {
      console.warn("[科研通签到] 网页标签执行尝试失败，切入后台网络请求:", tabErr);
    }

    // ─── 方案 B: 后台独立网络请求 ───
    let cookies = await chrome.cookies.getAll({ url: "https://www.ablesci.com/" });
    if (!cookies || cookies.length === 0) {
      cookies = await chrome.cookies.getAll({ url: "https://ablesci.com/" });
    }
    if (!cookies || cookies.length === 0) {
      cookies = await chrome.cookies.getAll({ domain: "ablesci.com" });
    }
    if (!cookies || cookies.length === 0) {
      cookies = await chrome.cookies.getAll({ domain: "www.ablesci.com" });
    }

    if (!cookies || cookies.length === 0) {
      const msg = "未找到科研通的登录 Cookie，请先在浏览器中登录 ablesci.com 并刷新页面";
      console.warn(`[科研通签到] ${msg}`);
      await saveLog("fail", msg);
      showNotification("签到失败", msg);
      return { success: false, message: msg };
    }

    // 从主页抓取最新的 CSRF Token
    let csrfToken = "";
    try {
      const pageRes = await fetch(SITE_URL, {
        method: "GET",
        credentials: "include",
      });
      const html = await pageRes.text();
      const match =
        html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']csrf-token["']/i) ||
        html.match(/name=["']_csrf["']\s+value=["']([^"']+)["']/i);
      if (match && match[1]) {
        csrfToken = match[1];
        console.log("[科研通签到] 从主页提取到 CSRF Token:", csrfToken);
      }
    } catch (e) {
      console.warn("[科研通签到] 获取 CSRF Token 失败:", e);
    }

    const headers = {
      "Referer": SITE_URL,
      "Origin": "https://www.ablesci.com",
      "X-Requested-With": "XMLHttpRequest",
      "Accept": "application/json, text/javascript, */*; q=0.01",
    };

    let body = undefined;
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      body = `_csrf=${encodeURIComponent(csrfToken)}`;
    }

    const response = await fetch(SIGN_URL, {
      method: "POST",
      headers: headers,
      body: body,
      credentials: "include",
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    console.log(`[科研通签到] 响应:`, result);

    const rawMsg =
      (result && (result.message || result.msg || result.info)) ||
      (typeof result.raw === "string" && result.raw.length < 100 ? result.raw : "") ||
      "";

    const isSuccess =
      result.code === 200 ||
      result.code === 1 ||
      result.status === 1 ||
      result.status === "success" ||
      rawMsg.includes("成功") ||
      rawMsg.includes("已签") ||
      rawMsg.includes("已经签到") ||
      rawMsg.includes("明天再来") ||
      (response.ok && !rawMsg.includes("400") && !rawMsg.includes("无法被验证") && !rawMsg.includes("失败"));

    const msg = rawMsg || (isSuccess ? "签到成功！" : `签到请求失败 (HTTP ${response.status})`);

    if (isSuccess) {
      await saveLog("success", msg);
      await chrome.storage.local.set({ signedToday: getTodayStr() });
      showNotification("签到成功", msg);
      return { success: true, message: msg };
    } else {
      await saveLog("fail", msg);
      showNotification("签到失败", msg);
      return { success: false, message: msg };
    }
  } catch (error) {
    const msg = `签到异常: ${error.message}`;
    console.error(`[科研通签到] ${msg}`);
    await saveLog("fail", msg);
    showNotification("签到失败", msg);
    return { success: false, message: msg };
  } finally {
    isSigning = false;
  }
}

// ─── 轮询守卫：今天签过就跳过 ───

async function trySign() {
  const { signedToday } = await chrome.storage.local.get("signedToday");
  const today = getTodayStr();

  if (signedToday === today) {
    console.log(`[科研通签到] 今日(${today})已签到成功，跳过`);
    return;
  }

  await doSign();
}

// ─── 日志记录 ───

async function saveLog(status, message) {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  const entry = { time: now, status, message };

  const { signLogs = [] } = await chrome.storage.local.get("signLogs");
  signLogs.unshift(entry);

  if (signLogs.length > 30) {
    signLogs.length = 30;
  }

  await chrome.storage.local.set({ signLogs, lastSign: entry });
}

// ─── 通知 ───

async function showNotification(title, message) {
  try {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1976D2";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(35, 65);
    ctx.lineTo(55, 85);
    ctx.lineTo(93, 43);
    ctx.stroke();

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const dataUrl = "data:image/png;base64," + btoa(binary);

    chrome.notifications.create(`ablesci-sign-${Date.now()}`, {
      type: "basic",
      iconUrl: dataUrl,
      title: `科研通 - ${title}`,
      message: message,
    });
  } catch (error) {
    console.error("[科研通签到] 通知显示失败:", error);
  }
}

// ─── 定时任务（20 分钟轮询） ───

async function setupAlarm() {
  const { autoSign = true } = await chrome.storage.local.get("autoSign");

  await chrome.alarms.clear(ALARM_NAME);

  if (!autoSign) {
    console.log("[科研通签到] 自动签到已关闭");
    return;
  }

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: POLL_INTERVAL,  // 20 分钟后首次触发（避免与启动时的立即签到冲突）
    periodInMinutes: POLL_INTERVAL, // 之后每 20 分钟轮询一次
  });

  console.log(
    `[科研通签到] 轮询签到已启动：每 ${POLL_INTERVAL} 分钟检查一次`
  );
}

// ─── 事件监听 ───

// 安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("autoSign");
  if (existing.autoSign === undefined) {
    await chrome.storage.local.set({ autoSign: true });
  }
  await setupAlarm();
  console.log("[科研通签到] 扩展已安装，轮询签到已配置");
});

// 浏览器启动时重新设置闹钟 + 立即尝试签到
chrome.runtime.onStartup.addListener(async () => {
  await setupAlarm();
  await trySign();
});

// 闹钟触发时执行签到（带守卫）
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("[科研通签到] 轮询触发");
    await trySign();
  }
});

// 来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "doSign") {
    (async () => {
      try {
        const result = await doSign();
        sendResponse(result || { success: false, message: "签到完成" });
      } catch (err) {
        sendResponse({ success: false, message: err.message || "执行异常" });
      }
    })();
    return true;
  }

  if (message.action === "updateAlarm") {
    (async () => {
      try {
        await setupAlarm();
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    })();
    return true;
  }

  if (message.action === "getStatus") {
    (async () => {
      try {
        const data = await chrome.storage.local.get([
          "lastSign",
          "signLogs",
          "autoSign",
          "signedToday",
        ]);
        const alarm = await chrome.alarms.get(ALARM_NAME);
        sendResponse({
          ...data,
          nextAlarm: alarm ? alarm.scheduledTime : null,
          todayStr: getTodayStr(),
        });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    })();
    return true;
  }
});
