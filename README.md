# M3U8 Web Player

一个现代化的、基于 Web 的 HLS (M3U8) 视频播放器。

## 功能特性

- **HLS 播放支持**：使用 HLS.js 核心，支持流媒体播放。
- **播放历史**：自动记录最近播放的视频。
- **收藏夹功能**：
    - 支持收藏视频并添加备注。
    - 收藏列表支持编辑和删除。
    - **导入/导出**：支持将收藏夹导出为 JSON 文件进行备份，或从文件恢复。
- **现代化 UI**：
    - 基于 Tailwind CSS 设计。
    - 深色模式界面。
    - 响应式布局，适配移动端和桌面端。
- **交互体验**：
    - 视频下方快捷收藏按钮，支持状态实时反馈（已收藏/未收藏）。
    - 播放状态指示灯。

## 技术栈

- HTML5 / CSS3 / JavaScript
- [HLS.js](https://github.com/video-dev/hls.js)
- [Tailwind CSS](https://tailwindcss.com/)
- FontAwesome Icons

## 使用说明

1. 下载项目文件。
2. 直接在浏览器中打开 `index.html`。
3. 在输入框粘贴 `.m3u8` 视频链接。
4. 点击播放。

## 许可证

MIT License
