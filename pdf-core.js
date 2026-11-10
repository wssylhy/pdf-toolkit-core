/* PDF工具集 core.js — 纯前端本地处理,浏览器与 Node 测试共用 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PDF = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CONST = {
    APP_NAME: "PDF工具集",
    WATERMARK: "由PDF工具集生成 · pdf.nightship.cc",
    SITE: "pdf.nightship.cc",
    PRICE_STD: "9.9",
    FREE_DAILY_LIMIT: 3,
    INPUT_MAX_MB: 100,
  };

  /* ── 激活码: PDF-XXXX-XXXX-XXXX,前11位字符和 mod36 校验位(同 EXB/IDP/VCP 系列) ── */
  var CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function codeSum(s) {
    var sum = 0;
    for (var i = 0; i < s.length; i++) sum += CHARS.indexOf(s[i]) >= 0 ? CHARS.indexOf(s[i]) : 0;
    return sum % 36;
  }
  function isValidCode(input) {
    var code = String(input || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!/^PDF[0-9A-Z]{12}$/.test(code)) return false;
    var body = code.slice(3, 14), check = code.slice(14);
    return codeSum(body) === parseInt(check, 36);
  }
  function generateCode(rng) {
    function pick() { return CHARS[Math.floor((rng ? rng() : Math.random()) * CHARS.length)]; }
    var body = ""; for (var i = 0; i < 11; i++) body += pick();
    var check = CHARS[codeSum(body)];
    return "PDF-" + body.slice(0, 4) + "-" + body.slice(4, 8) + "-" + body.slice(8) + check;
  }

  /* ── 合并计划: 按 selectOrder 保留用户排列顺序,校验扩展名 ── */
  function mergePlan(fileNames) {
    if (!Array.isArray(fileNames) || fileNames.length === 0) return { ok: false, reason: "未选择文件", order: [] };
    if (fileNames.length === 1) return { ok: false, reason: "至少需要2个文件才能合并", order: [] };
    var order = [], bad = [];
    for (var i = 0; i < fileNames.length; i++) {
      var n = String(fileNames[i] || "");
      if (!/\.pdf$/i.test(n)) { bad.push(n); continue; }
      order.push(n);
    }
    if (bad.length) return { ok: false, reason: "以下不是PDF文件: " + bad.join(", "), order: [] };
    return { ok: true, reason: "", order: order };
  }

  /* ── 拆分计划: 解析页码范围表达式 ──
     parseRanges("1-3,5,8-10", total) → [1,2,3,5,8,9,10] (1-based,自动去重排序,越界裁剪)
     非法输入返回 { ok:false, reason } */
  function parseRanges(expr, total) {
    expr = String(expr || "").trim();
    total = Number(total) || 0;
    if (!expr) return { ok: false, reason: "请输入页码范围" };
    if (!/^[0-9,\-\s]+$/.test(expr)) return { ok: false, reason: "页码只能包含数字、逗号和连字符" };
    if (total < 1) return { ok: false, reason: "文档页数异常" };
    var seen = {};
    var pages = [];
    var parts = expr.split(",");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      if (p.indexOf("-") >= 0) {
        var m = p.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) return { ok: false, reason: "范围格式错误: " + p };
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a < 1 || b < a) return { ok: false, reason: "范围无效: " + p };
        for (var x = a; x <= b; x++) { if (x <= total && !seen[x]) { seen[x] = 1; pages.push(x); } }
      } else {
        var n = parseInt(p, 10);
        if (isNaN(n) || n < 1) return { ok: false, reason: "页码无效: " + p };
        if (n <= total && !seen[n]) { seen[n] = 1; pages.push(n); }
      }
    }
    if (!pages.length) return { ok: false, reason: "没有有效页码(超出文档范围)" };
    pages.sort(function (a, b) { return a - b; });
    return { ok: true, reason: "", pages: pages };
  }

  /* 整本拆单页方案: 返回每段的页码数组(每段1页) */
  function splitEveryPage(total) {
    total = Number(total) || 0;
    var out = [];
    for (var i = 1; i <= total; i++) out.push([i]);
    return out;
  }

  /* 自定义分段方案: 按每段页数均分 (如 total=10, per=3 → [[1,2,3],[4,5,6],[7,8,9],[10]]) */
  function splitChunks(total, per) {
    total = Number(total) || 0;
    per = Number(per) || 0;
    if (per < 1) return [];
    var out = [];
    for (var start = 1; start <= total; start += per) {
      var chunk = [];
      for (var p = start; p < start + per && p <= total; p++) chunk.push(p);
      out.push(chunk);
    }
    return out;
  }

  /* ── 压缩(重构瘦身)估算: pdf-lib 重保存主要清理冗余对象,效果与原文件结构强相关 ──
     honest: 明确标注这是重构瘦身,不是有损压缩 */
  function estimateShrink(sizeMB, structuralRedundancy) {
    sizeMB = Number(sizeMB) || 0;
    structuralRedundancy = Number(structuralRedundancy);
    if (isNaN(structuralRedundancy)) structuralRedundancy = 0.15; /* 经验默认15%可清理冗余 */
    if (sizeMB <= 0) return { ok: false, note: "文件大小异常" };
    var low = sizeMB * Math.max(0, structuralRedundancy - 0.08);
    var high = sizeMB * Math.min(0.45, structuralRedundancy + 0.15);
    return {
      ok: true,
      originalMB: sizeMB,
      lowMB: +(sizeMB - high).toFixed(2),
      highMB: +(sizeMB - low).toFixed(2),
      note: "重构瘦身为无损操作:移除冗余对象与未引用资源,实际效果取决于原文件结构;图片为主的PDF体积变化有限,如实预期 10%~30%"
    };
  }

  return {
    CONST: CONST,
    isValidCode: isValidCode,
    generateCode: generateCode,
    mergePlan: mergePlan,
    parseRanges: parseRanges,
    splitEveryPage: splitEveryPage,
    splitChunks: splitChunks,
    estimateShrink: estimateShrink,
  };
});
