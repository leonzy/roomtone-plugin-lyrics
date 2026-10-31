# 歌词搜索插件

Roomtone fork：支持 QQ音乐、网易云、LRCLIB 并行查询（按此顺序优先采用），也可单独选择来源或保留自定义 API。自动模式不会因为一个来源异常而放弃其他来源。原项目：[songloft-org/songloft-plugin-lyrics](https://github.com/songloft-org/songloft-plugin-lyrics)。

搜索前清理曲号、音频扩展名、推广标签，并在歌手缺失或明显被推广信息污染时拆分“歌手-歌名”。候选仍须通过歌名、歌手、版本与时长校验；不会把放宽搜索条件当成放宽匹配标准。返回同步歌词及来源可提供的翻译/罗马音。

失败会分别报告各来源的 HTTP 状态、业务错误码、超时、网络错误、无匹配或响应格式异常。自动查询使用宿主可取消 HTTP 流，单次网络请求最多 3 秒、响应最多 2 MB；同一歌曲的并发查询合并，结束后释放。主程序需支持分来源错误透传，旧主程序可能仍只显示通用错误。使用公开接口，不要求 API key；服务商可能限制访问，不能保证所有来源永远可用。

当歌曲没有歌词时，自动从 [lrclib.net](https://lrclib.net) 或自定义兼容 API 搜索歌词。插件通过服务端歌词提供者回调机制注册，由主程序在需要时自动调用。

## 安装

1. 下载 [lyrics.jsplugin.zip](../../releases/latest)
2. 放入 Songloft 的 `data/jsplugins/` 目录
3. 重启 Songloft

## 功能

- **自动搜索**：注册为服务端歌词提供者，歌曲无歌词时主程序自动调用搜索
- **精确 + 模糊两级匹配**：先按标题/艺术家/专辑/时长精确匹配，失败后降级到模糊搜索
- **同步歌词优先**：搜索结果中有同步歌词（LRC 格式）时优先选取
- **自定义 API**：支持切换到自部署的 lrclib 兼容 API
- **配置页面**：提供 Web UI 管理开关和提供商设置，支持在线测试搜索

## 使用

### 启用插件

安装后默认**未启用**。打开插件配置页面，勾选「启用歌词搜索」并保存。启用后插件会向主程序注册歌词提供者，禁用时自动取消注册。

### 提供商选择

- **lrclib.net**（默认）：免费开放的歌词数据库，无需注册
- **自定义 API**：填入兼容 lrclib API 格式的自定义地址（需提供 `/api/get` 精确查询和 `/api/search` 模糊搜索端点）

### 测试搜索

配置页面底部提供测试搜索功能，可输入歌曲名和艺术家验证连通性和匹配效果。

### 智能音箱播放页

智能音箱插件通过主程序的歌曲歌词接口调用本插件，无需单独配置歌词提供商。除启用插件本身外，还需保存「启用歌词搜索」开关。播放曲库中的歌曲后，打开智能音箱插件的歌词页即可自动搜索；未命中时可使用新版音箱插件的「重新获取歌词」按钮。带空格的歌名、歌手和专辑按原始文本搜索，真实的 `+` 符号会保留。

这显示的是插件网页歌词；音箱触屏上的歌词由智能音箱插件的「触屏音箱显示歌词」设置另行控制。

### 自动发布

推送到 `main` 后，每个非文档提交自动发布一个 `YYYY.M.D.N` 版本（北京时间，当天从 `.0` 开始递增）。纯 Markdown / `docs/` 改动不出包，版本元数据提交不递归触发；失败可手动重跑续发，不覆盖旧 tag 或 Release。每个包先完成干净依赖安装、类型检查、测试、QuickJS 构建与产物哈希校验。

完整规则、迁移起点和本地验证见 [自动发布](docs/releases.md)。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/lyric-search?title=...&artist=...&album=...&duration=...&fingerprint=...&isrc=...` | 歌词搜索（由主程序 InvokeHTTP 调用，fingerprint 和 isrc 为可选参数） |
| GET | `/config` | 获取当前配置 |
| PUT | `/config` | 更新配置 |
| GET | `/test-search?title=...&artist=...` | 测试搜索 |
| GET | `/` | 重定向到配置页面 |

## 开发与构建

基于 `@songloft/plugin-sdk` 和 TypeScript 构建，运行在 QuickJS 沙盒中。

```bash
npm install
npm run dev       # watch + auto-upload to local Songloft
npm run build     # produce dist/lyrics.jsplugin.zip
npx tsc --noEmit
node --test tests/*.test.mjs
npm run validate  # 校验 dist/_build 的清单和产物哈希
```

## 环境要求

- Songloft v2.6.0+

## 许可

Apache-2.0
