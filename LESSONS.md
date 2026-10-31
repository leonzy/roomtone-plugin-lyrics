# 开发经验

## LYR-003：带空格曲号和括号歌手的文件名也需要保守识别

2026-10-31，leonFN 歌曲 52618 的原始标题为 `02 存在（汪峰）`，歌手为空。宿主空闲回收丢失来源导致立即 404；即使恢复插件，旧清洗仍会保留曲号和括号，妨碍严格候选匹配。对有编号的文件名识别空格曲号及尾部括号歌手，但不把 Live、语言、版本、年份当作歌手，不改普通括号标题与 `24 Hours`、`2.0`。真实输入回归在旧实现失败，修正后通过。Seen 1×。

English: NAS song 52618 was titled `02 存在（汪峰）` with no artist. Provider loss during host idle eviction caused immediate 404; independently, the old normalizer retained the space-separated track number and artist suffix. Numbered filenames now support this convention while preserving Live/language/version/year annotations, ordinary parenthesized titles, `24 Hours` and `2.0`. A regression using the real input fails before and passes after the change. Seen 1×.

## LYR-002：真实提供商结构、错误分类与检索元数据必须一起验证

- 2026-10-31，leonFN 的“成龙-明明白白我的心”被直接作为标题检索，歌手和专辑为推广信息；原来源仅 LRCLIB，网络异常最终被宿主吞为 404。
- 新自动模式清洗输入、并行查询 QQ/网易云/LRCLIB，按歌名、歌手、版本、时长筛选；3 秒可取消请求、2 MB 响应上限和请求合并限制资源。QQ 当前 SearchAdaptor 响应实际在 body.item_song.items，不能用旧 body.song.list 夹具冒充兼容验收。
- 22 项插件测试、类型及真实包哈希验证通过；leonFN 实际 QuickJS 安装后约 3 秒返回 QQ 和网易云成功，LRCLIB 单独报告连接失败。主程序还需对应错误透传修改，不能只改插件后声称界面已支持错误提示。未启动音频播放，未改写歌曲标签。

## LYR-001：歌词元数据查询必须还原表单编码的空格

- 范围：`songloft-org/songloft-plugin-lyrics#6`，宿主歌词搜索与配置页测试搜索。
- 证据：2026-10-17，基线 `52f75bb20765fcf65e8b594b59bf8001a3f7bfad` 使用 SDK 2.6 的 `parseQuery`，只解码百分号。宿主 Go `url.Values.Encode` 将空格编码为 `+`，实际 QuickJS 日志出现 `Fixture+Artist`；严格按原始歌手匹配的测试提供商无法命中。四项新增回归在旧实现下全部因标题包含错误的 `+` 而失败。
- 修复：两个搜索入口在 SDK 解码之前将查询字符串中的 `+` 转成 `%20`；`%2B` 保留为真实加号。回归覆盖 lrclib/LrcApi、中文、空格、真实加号、`&`、专辑及小数时长。
- Done right：本次未提交工作树中，四项回归及类型检查通过，QuickJS 包构建并通过临时宿主安装；真实 HTTP 链路使用带空格的歌手和严格匹配 fixture，9 秒后返回歌词，并只读确认数据库缓存为 `scraped`。证据 `/tmp/songloft-lyrics-6/{query-before,query-after,integration}.log`、`integration-result.json`。根目录旧清单没有哈希，旧 CLI 的根目录 validate 因此失败；在 `dist/_build/` 对实际构建清单校验通过，实际安装也验证包哈希。
- Not run：报告人的实际歌曲、歌词提供商网络和真实音箱验收；不能认定报告人的唯一根因就是编码。音箱插件的超时、错误展示和迟到响应修复记录在其仓库。
- Seen 1× (2026-10-17)。状态：经验；本次未提交、未发布。

## REL-001：手动发版迁移需要明确队列起点并校验实际产物

- 范围：歌词插件从旧手动工作流迁移为与 MIoT 相同的逐提交自动发布；2026-10-17 用户追加要求。
- 证据：旧 v2026.8.4 tag 的清单仍写 2026.8.2，之后还有业务提交；直接按旧 tag 回补会构建没有新检查工具的历史快照。根清单又没有哈希，旧 CLI 的根目录 validate 失败，不能把它当作新包构建失败或直接跳过检查。
- 修复：以迁移前 `52f75bb20765fcf65e8b594b59bf8001a3f7bfad` 为队列种子（不冒充该 SHA 已发布），首个新提交包含全部现有代码。沿用 MIoT 的隔离 worktree、不可变 tag、北京时间四段版本、文档过滤与失败恢复。`npm run validate` 对 `dist/_build` 清单、真实入口和静态资源计算哈希。
- Done right：16 项测试覆盖发布队列、迁移及篡改检测；使用干净 `npm ci`、真实 QuickJS 构建及本地 bare 远端演练默认发布路径，tag 的父提交与源码一致，元数据写回后重跑不重复出包。证据 `/tmp/songloft-lyrics-6/{release-tests,rehearsal}.log`、`rehearsal-result.json`。演练仅模拟 GitHub Release，没有写远端 GitHub。
- 校验边界：actionlint 1.7.12 不认识 `concurrency.queue`，首次检查失败。对照 [GitHub 官方并发文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) 确认 `queue: max` 合法后，仅排除该字段的旧工具诊断，其余检查通过；最终是否发布以同一提交的远端运行和包验收为准。
- Seen 1× (2026-10-17)。状态：经验；发布状态另按实际提交交付。
