/**
 * MathExpr → 扁平渲染 token 列表（小程序 WXML 无递归组件，拍平后 wx:for 渲染）。
 * token 类型：
 *  text  —— 普通文本 { t:'text', v }
 *  frac  —— 分数（分子在上分母在下）{ t:'frac', n, d }
 *  op    —— 运算符 { t:'op', v }
 *  paren —— 括号 { t:'paren', v }
 *  vsq   —— 比大小中间的 ? { t:'vsq' }
 */

function flat(e, out) {
  if (e.kind === 'text') {
    out.push({ t: 'text', v: e.text });
  } else if (e.kind === 'frac') {
    out.push({ t: 'frac', n: e.n, d: e.d });
  } else if (e.kind === 'mixed') {
    out.push({ t: 'text', v: e.whole });
    out.push({ t: 'frac', n: e.n, d: e.d });
  } else if (e.kind === 'vs') {
    flat(e.left, out);
    out.push({ t: 'vsq' });
    flat(e.right, out);
  } else if (e.kind === 'op') {
    e.terms.forEach((term, i) => {
      if (i > 0) out.push({ t: 'op', v: e.op });
      // 负数项加括号：(-3) + (-5) 的有理数标准写法
      if (term.kind === 'text' && term.text.startsWith('-')) {
        out.push({ t: 'paren', v: '(' });
        flat(term, out);
        out.push({ t: 'paren', v: ')' });
      } else {
        flat(term, out);
      }
    });
  }
}

function exprToTokens(e) {
  const out = [];
  flat(e, out);
  return out;
}

module.exports = { exprToTokens };
