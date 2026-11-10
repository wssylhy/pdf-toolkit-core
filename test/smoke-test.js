/* pdf-toolkit-core 冒烟测试: node test/smoke-test.js */
"use strict";
const assert = require("assert");
const PDFCore = require("../pdf-core.js");

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

console.log("pdf-toolkit-core smoke tests");

/* CONST */
ok("CONST 暴露免费额度与站名", () => {
  assert.strictEqual(PDFCore.CONST.FREE_DAILY_LIMIT, 3);
  assert.ok(PDFCore.CONST.SITE.length > 0);
});

/* 激活码:生成→校验闭环 */
ok("generateCode → isValidCode 闭环", () => {
  const code = PDFCore.generateCode();
  assert.match(code, /^PDF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.strictEqual(PDFCore.isValidCode(code), true, "生成的码必须通过校验");
});
ok("isValidCode 拒绝伪造码", () => {
  assert.strictEqual(PDFCore.isValidCode("PDF-AAAA-BBBB-CCCD"), false, "校验位错一位必须被拒");
  assert.strictEqual(PDFCore.isValidCode(""), false);
  assert.strictEqual(PDFCore.isValidCode("EXB-1234-5678-90AB"), false);
});
ok("generateCode 可注入确定性随机源", () => {
  let i = 0;
  const seq = () => ((i++ * 7) % 36) / 36;
  const code = PDFCore.generateCode(seq);
  assert.strictEqual(PDFCore.isValidCode(code), true, "注入随机源生成的码同样必须有效");
});

/* 合并计划 */
ok("mergePlan 保留排列顺序并拒绝非PDF", () => {
  const plan = PDFCore.mergePlan(["b.pdf", "a.PDF", "note.txt"]);
  assert.strictEqual(plan.ok, false);
  assert.ok(/不是PDF/.test(plan.reason));
  assert.ok(/note\.txt/.test(plan.reason));
});
ok("mergePlan 接受多个PDF按原序", () => {
  const plan = PDFCore.mergePlan(["b.pdf", "a.pdf"]);
  assert.deepStrictEqual(plan, { ok: true, reason: "", order: ["b.pdf", "a.pdf"] });
});
ok("mergePlan 拒绝0个和1个文件", () => {
  assert.strictEqual(PDFCore.mergePlan([]).ok, false);
  assert.strictEqual(PDFCore.mergePlan(["only.pdf"]).ok, false);
});

/* 页码区间解析 */
ok("parseRanges 解析混合区间并去重排序", () => {
  const r = PDFCore.parseRanges("8-10,1-3,5,2", 20);
  assert.deepStrictEqual(r.pages, [1, 2, 3, 5, 8, 9, 10]);
});
ok("parseRanges 越界页裁剪", () => {
  const r = PDFCore.parseRanges("1,9,99", 10);
  assert.deepStrictEqual(r.pages, [1, 9]);
});
ok("parseRanges 拒绝非法输入", () => {
  assert.strictEqual(PDFCore.parseRanges("abc", 10).ok, false);
  assert.strictEqual(PDFCore.parseRanges("5-2", 10).ok, false);
  assert.strictEqual(PDFCore.parseRanges("", 10).ok, false);
  assert.strictEqual(PDFCore.parseRanges("1", 0).ok, false);
});

/* 拆分方案 */
ok("splitEveryPage 每页一段", () => {
  assert.deepStrictEqual(PDFCore.splitEveryPage(3), [[1], [2], [3]]);
  assert.deepStrictEqual(PDFCore.splitEveryPage(0), []);
});
ok("splitChunks 均分含余数尾段", () => {
  assert.deepStrictEqual(PDFCore.splitChunks(10, 3), [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
  assert.deepStrictEqual(PDFCore.splitChunks(6, 3), [[1, 2, 3], [4, 5, 6]]);
  assert.deepStrictEqual(PDFCore.splitChunks(5, 0), []);
});

/* 瘦身预估 */
ok("estimateShrink 返回区间与如实说明", () => {
  const est = PDFCore.estimateShrink(8);
  assert.strictEqual(est.ok, true);
  assert.ok(est.highMB > est.lowMB || (est.highMB === est.lowMB && est.lowMB >= 0));
  assert.ok(est.originalMB === 8);
  assert.ok(/无损|结构/.test(est.note));
});

console.log("\n" + passed + "/" + passed + " tests passed");
