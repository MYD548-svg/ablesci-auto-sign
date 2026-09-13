<div align="center">

# 🔬 科研通自动签到

**AbleSci.com 自动签到浏览器扩展**  
支持自动签到、手动签到、状态查看与签到记录。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/Manifest-V3-brightgreen)
![Chrome](https://img.shields.io/badge/Chrome-supported-4285F4?logo=googlechrome&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-supported-0078D7?logo=microsoftedge&logoColor=white)
![Stars](https://img.shields.io/github/stars/MYD548-svg/ablesci-auto-sign?style=flat)

</div>

> [!NOTE]
> 本扩展依赖浏览器中已经登录的科研通账号，无需在扩展内再次输入账号和密码。

## ✨ 功能特性

- **自动签到**：启用后每 20 分钟检查一次签到状态。
- **智能停止重试**：当天签到成功后不再重复签到，次日自动恢复检查。
- **手动签到**：可在扩展弹窗中随时点击“立即签到”。
- **状态查看**：显示最近一次签到结果与下一次自动检查时间。
- **签到记录**：保存最近的签到结果，方便快速确认运行状态。
- **结果通知**：签到成功或失败时可通过浏览器通知反馈结果。
- **Chrome / Edge 支持**：基于 Manifest V3，可通过开发者模式加载使用。

## 📦 安装方法

### 1. 下载项目

点击 GitHub 页面右上方的 **Code → Download ZIP**，下载后解压到一个固定目录。

> [!IMPORTANT]
> 加载扩展时，请选择**包含 `manifest.json` 的目录**：
>
> `ablesci-auto-sign/ablesci-auto-sign/`
>
> 解压后请不要随意移动或删除该目录，否则浏览器可能无法继续加载扩展。

### 2. 打开扩展管理页面

| 浏览器 | 地址 |
| --- | --- |
| Microsoft Edge | `edge://extensions/` |
| Google Chrome | `chrome://extensions/` |

### 3. 加载扩展

1. 打开右上角的 **开发人员模式 / Developer mode**。
2. 点击 **加载解压缩的扩展 / Load unpacked**。
3. 选择包含 `manifest.json` 的 `ablesci-auto-sign` 文件夹。
4. 加载成功后，可将“科研通签到”固定到浏览器工具栏。

## 🚀 使用方法

1. 先在浏览器中登录 [科研通 AbleSci.com](https://www.ablesci.com/)。
2. 点击浏览器工具栏中的 **科研通签到** 扩展图标。
3. 根据需要使用：
   - 点击 **立即签到**：立刻执行一次签到；
   - 开启 **启用自动签到**：扩展将定期自动检查并签到。
4. 在弹窗中查看签到状态、下一次检查时间和最近签到记录。

> 自动签到默认每 **20 分钟**检查一次；当天成功后会停止重复尝试，并在下一天重新开始检查。

## 🔐 权限说明

本扩展仅为实现签到功能申请必要的浏览器扩展权限：

| 权限 | 用途 |
| --- | --- |
| `alarms` | 定时触发自动签到检查 |
| `storage` | 保存自动签到开关、签到状态和签到记录 |
| `cookies` | 使用浏览器中现有的科研通登录状态 |
| `notifications` | 显示签到成功或失败通知 |
| `tabs` / `scripting` | 在已打开的科研通页面中执行签到请求 |

站点访问范围仅配置为 `ablesci.com` 相关页面。

## 📁 项目结构

```text
ablesci-auto-sign/
├── README.md
└── ablesci-auto-sign/
    ├── manifest.json
    ├── background.js
    ├── 使用说明.txt
    └── popup/
        ├── popup.html
        ├── popup.css
        └── popup.js
```

## ❓ 常见问题

<details>
<summary><strong>加载扩展时提示找不到 manifest.json？</strong></summary>

请确认选择的是内层 `ablesci-auto-sign` 文件夹，也就是直接包含 `manifest.json` 的目录，而不是仓库最外层目录。

</details>

<details>
<summary><strong>自动签到没有成功怎么办？</strong></summary>

请先确认：

- 已经在当前浏览器中登录科研通；
- 扩展中的“启用自动签到”处于开启状态；
- 浏览器能够正常访问 `ablesci.com`；
- 可先尝试点击一次“立即签到”，查看签到记录中的提示信息。

</details>

<details>
<summary><strong>为什么浏览器完全退出后没有自动签到？</strong></summary>

该项目是浏览器扩展，自动任务依赖浏览器扩展运行环境。浏览器未运行时，扩展无法执行签到任务。

</details>

## ⚠️ 注意事项

- 本项目为第三方辅助工具，与科研通（AbleSci.com）官方无隶属或合作关系。
- 网站接口或页面结构发生变化时，自动签到功能可能受到影响。
- 请遵守科研通网站的相关使用规则，并合理使用本项目。

---

<div align="center">

如果这个项目对你有帮助，可以点一个 ⭐ Star。

</div>
