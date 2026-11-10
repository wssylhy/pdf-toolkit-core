# pdf-toolkit-core

纯 JavaScript 的 PDF 批量处理核心逻辑:页码区间解析、合并计划、拆分方案、体积预估、激活码校验。浏览器与 Node 通用,全程本地计算,数据不出设备。

在线工具版(开箱即用,文件不上传):**[pdf.nightship.cc](https://pdf.nightship.cc/?utm_source=github)**

同系列:[excel-batch-core](https://github.com/wssylhy/excel-batch-core)(Excel 批量合并/拆分/格式互转)

## 功能

| 函数 | 作用 |
|---|---|
| `parseRanges(expr, total)` | 解析页码表达式 `"1-3,5,8-10"` → `[1,2,3,5,8,9,10]`(1-based,自动去重排序,越界裁剪;非法输入返回 `{ok:false, reason}`) |
| `mergePlan(fileNames)` | 合并前校验:拒绝非 PDF 文件、少于 2 个文件,按用户排列顺序返回 `{ok, order}` |
| `splitEveryPage(total)` | 整本拆单页方案 → `[[1],[2],…]` |
| `splitChunks(total, per)` | 按每段页数均分,含余数尾段:`splitChunks(10,3)` → `[[1,2,3],[4,5,6],[7,8,9],[10]]` |
| `estimateShrink(sizeMB)` | 无损瘦身效果预估,返回节省区间与如实说明(图片为主的 PDF 变化有限,不夸大) |
| `generateCode(rng?)` | 生成 `PDF-XXXX-XXXX-XXXX` 激活码,可注入确定性随机源 |
| `isValidCode(input)` | 激活码校验(前 11 位字符和 mod36 校验位,与 EXB/IDP/VCP 系列同构) |

细节行为:`parseRanges` 空段跳过、区间必须 `a≤b` 且从 1 起;`splitChunks` 每段页数小于 1 返回空数组;码校验前统一去分隔符转大写。

## 使用

实际的 PDF 字节操作(合并/提取/瘦身)在浏览器端由 [pdf-lib](https://github.com/Hopding/pdf-lib) 完成,本库负责全部决策逻辑,与 pdf-lib 解耦。

### Node

```js
const PDFCore = require("pdf-toolkit-core");

// 从 100 页文档提取用户输入的页码
const r = PDFCore.parseRanges("1-3,5,8-10", 100);
if (!r.ok) throw new Error(r.reason);
// → [1,2,3,5,8,9,10]

// 每 3 页拆一段
PDFCore.splitChunks(10, 3);
// → [[1,2,3],[4,5,6],[7,8,9],[10]]

// 激活码闭环
const code = PDFCore.generateCode();
PDFCore.isValidCode(code); // true
```

### 浏览器

```html
<script src="pdf-core.js"></script>
<script>
  const plan = PDF.mergePlan(fileInput.files.map(f => f.name));
  if (plan.ok) renderQueue(plan.order);
</script>
```

## 测试

```bash
node test/smoke-test.js   # 13/13 通过,无需安装依赖
```

## 设计原则

- **本地优先**:所有函数为纯计算,无网络请求、无遥测;配套在线工具同样在浏览器本地处理文件
- **如实预估**:`estimateShrink` 对"图片型 PDF 压不下去"直接说明,不做虚假宣传
- **零依赖**:核心逻辑不依赖任何 npm 包,pdf-lib 以页面侧引入

## License

MIT
