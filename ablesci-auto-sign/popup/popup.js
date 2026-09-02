// 科研通签到 - Popup 交互逻辑

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadStatus();
  bindEvents();
}

// ─── 加载状态 ───

async function loadStatus() {
  const response = await chrome.runtime.sendMessage({ action: "getStatus" });

  if (!response) return;

  const { lastSign, signLogs = [], autoSign = true, signedToday, nextAlarm, todayStr } = response;

  // 更新状态卡片（判断今天是否已签到）
  const isTodaySigned = signedToday === todayStr;
  updateStatusCard(lastSign, isTodaySigned);

  // 更新设置
  document.getElementById("autoSignToggle").checked = autoSign;

  // 更新提示文字
  const hint = document.getElementById("settingHint");
  if (autoSign) {
    hint.textContent = "每 20 分钟自动检查，签到成功后当天不再重试";
    hint.style.opacity = "1";
  } else {
    hint.textContent = "自动签到已关闭，请手动签到";
    hint.style.opacity = "0.6";
  }

  // 更新下次检查时间
  if (nextAlarm && autoSign && !isTodaySigned) {
    const nextTime = new Date(nextAlarm).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    document.getElementById("nextAlarm").textContent = `下次检查: ${nextTime}`;
  } else if (isTodaySigned && autoSign) {
    document.getElementById("nextAlarm").textContent = "✅ 今日已签到，明日自动重置";
  } else {
    document.getElementById("nextAlarm").textContent = "";
  }

  // 更新日志
  updateLogList(signLogs);
}

function updateStatusCard(lastSign, isTodaySigned) {
  const card = document.getElementById("statusCard");
  const icon = document.getElementById("statusIcon");
  const text = document.getElementById("statusText");
  const detail = document.getElementById("statusDetail");

  card.className = "card status-card";

  if (!lastSign) {
    icon.textContent = "📋";
    text.textContent = "尚未签到";
    detail.textContent = "点击下方按钮手动签到";
    card.classList.add("status-pending");
    return;
  }

  if (isTodaySigned) {
    icon.textContent = "✅";
    text.textContent = "今日已签到";
    detail.textContent = `${lastSign.time} — ${lastSign.message}`;
    card.classList.add("status-success");
  } else if (lastSign.status === "success") {
    icon.textContent = "✅";
    text.textContent = "签到成功（非今日）";
    detail.textContent = `${lastSign.time} — ${lastSign.message}`;
    card.classList.add("status-pending");
  } else {
    icon.textContent = "❌";
    text.textContent = "签到失败";
    detail.textContent = `${lastSign.time} — ${lastSign.message}`;
    card.classList.add("status-fail");
  }
}

function updateLogList(logs) {
  const list = document.getElementById("logList");

  if (!logs || logs.length === 0) {
    list.innerHTML = '<div class="log-empty">暂无签到记录</div>';
    return;
  }

  list.innerHTML = logs
    .map(
      (log) => `
    <div class="log-item">
      <span class="log-badge ${log.status}">${log.status === "success" ? "成功" : "失败"}</span>
      <div class="log-info">
        <div class="log-time">${log.time}</div>
        <div class="log-msg">${escapeHtml(log.message)}</div>
      </div>
    </div>
  `
    )
    .join("");
}

// ─── 事件绑定 ───

function bindEvents() {
  // 手动签到
  document.getElementById("signBtn").addEventListener("click", async () => {
    const btn = document.getElementById("signBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> 签到中...';

    try {
      // 增加 8 秒超时保护，防止按钮卡住
      const signPromise = chrome.runtime.sendMessage({ action: "doSign" });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("签到超时，请重试")), 8000)
      );

      await Promise.race([signPromise, timeoutPromise]);
      await loadStatus();
    } catch (error) {
      console.error("签到处理异常:", error);
      await loadStatus();
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">✅</span> 立即签到';
    }
  });

  // 自动签到开关
  document.getElementById("autoSignToggle").addEventListener("change", async (e) => {
    const autoSign = e.target.checked;
    await chrome.storage.local.set({ autoSign });
    await chrome.runtime.sendMessage({ action: "updateAlarm" });
    await loadStatus();
  });
}

// ─── 工具函数 ───

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
