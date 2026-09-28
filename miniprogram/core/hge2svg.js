/**
 * HGE2 手绘 SVG 图形（小程序版）：微信小程序不支持内联 SVG，
 * 统一转 data:image/svg+xml 用 <image> 渲染。图形路径与网页版 mechanics.tsx/HGE2Tier.tsx 一致。
 */

function uri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* 卡通大脚丫：五趾分开、大脚趾最大、收出脚后跟 */
const FOOT = uri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 190">' +
    '<path d="M30 48 C15 76 15 124 42 154 C64 176 108 172 120 136 C130 106 124 66 110 46 C90 58 50 58 30 48 Z" fill="#F8C08E" stroke="#4A2C14" stroke-width="6" stroke-linejoin="round"/>' +
    '<ellipse cx="36" cy="33" rx="15" ry="18" fill="#F8C08E" stroke="#4A2C14" stroke-width="6"/>' +
    '<ellipse cx="65" cy="21" rx="11" ry="13" fill="#F8C08E" stroke="#4A2C14" stroke-width="6"/>' +
    '<ellipse cx="87" cy="18" rx="10" ry="12" fill="#F8C08E" stroke="#4A2C14" stroke-width="6"/>' +
    '<ellipse cx="106" cy="22" rx="9" ry="11" fill="#F8C08E" stroke="#4A2C14" stroke-width="6"/>' +
    '<ellipse cx="122" cy="31" rx="8" ry="10" fill="#F8C08E" stroke="#4A2C14" stroke-width="6"/>' +
    '<ellipse cx="36" cy="28" rx="6.5" ry="5" fill="#FDE6D0" stroke="#4A2C14" stroke-width="2.5"/>' +
    '<path d="M44 78 C62 66 92 66 108 80" fill="none" stroke="#D98E55" stroke-width="4" stroke-linecap="round"/>' +
    '<ellipse cx="76" cy="122" rx="20" ry="26" fill="#E89B62" opacity="0.45"/>' +
  '</svg>'
);

/* 白羽毛：弯曲羽轴 + 两侧蓬松绒羽丝 */
const FEATHER = uri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">' +
    '<path d="M28 56 C19 45 15 30 23 16 C29 6 40 3 45 6 C53 11 52 25 46 37 C40 49 34 55 28 56 Z" fill="#ffffff" stroke="#212121" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M28 56 C30 42 34 24 42 8" fill="none" stroke="#212121" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M31 45 C27 43 24 41 22 38 M33 36 C29 34 26 31 25 28 M36 27 C33 25 31 22 30 19 M38 18 C36 16 35 14 34 11" fill="none" stroke="#212121" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M32 48 C37 47 41 45 43 42 M34 39 C39 38 43 35 45 32 M37 29 C42 28 45 26 47 22 M39 20 C43 19 46 16 47 13" fill="none" stroke="#212121" stroke-width="1.8" stroke-linecap="round"/>' +
  '</svg>'
);

/* 石头剪刀布卡通手（默认指向右；蓝方渲染时容器 scaleX(-1) 翻转） */
function handSvg(inner) {
  return uri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">' + inner + '</svg>'
  );
}
const SKIN = 'fill="#F5C9A8" stroke="#4A2C14" stroke-width="6" stroke-linejoin="round"';
const CREASE = 'fill="none" stroke="#4A2C14" stroke-width="4.5" stroke-linecap="round"';

const HAND_R = handSvg(
  '<rect x="0" y="52" width="80" height="40" rx="18" ' + SKIN + '/>' +
  '<circle cx="112" cy="70" r="46" ' + SKIN + '/>' +
  '<circle cx="140" cy="58" r="16" ' + SKIN + '/>' +
  '<path d="M98 34 C110 42 114 52 110 60" ' + CREASE + '/>' +
  '<path d="M94 62 C106 70 110 80 106 88" ' + CREASE + '/>' +
  '<path d="M90 90 C102 98 106 108 102 116" ' + CREASE + '/>'
);

const HAND_P = handSvg(
  '<rect x="0" y="55" width="72" height="38" rx="17" ' + SKIN + '/>' +
  '<circle cx="100" cy="72" r="42" ' + SKIN + '/>' +
  '<rect x="126" y="26" width="64" height="17" rx="8.5" transform="rotate(-6 126 34)" ' + SKIN + '/>' +
  '<rect x="132" y="48" width="66" height="17" rx="8.5" ' + SKIN + '/>' +
  '<rect x="132" y="70" width="64" height="17" rx="8.5" ' + SKIN + '/>' +
  '<rect x="126" y="92" width="56" height="16" rx="8" transform="rotate(6 126 100)" ' + SKIN + '/>' +
  '<circle cx="88" cy="102" r="15" ' + SKIN + '/>'
);

const HAND_S = handSvg(
  '<rect x="0" y="55" width="72" height="38" rx="17" ' + SKIN + '/>' +
  '<circle cx="98" cy="72" r="40" ' + SKIN + '/>' +
  '<rect x="112" y="24" width="80" height="17" rx="8.5" transform="rotate(-18 112 32)" ' + SKIN + '/>' +
  '<rect x="112" y="101" width="80" height="17" rx="8.5" transform="rotate(18 112 109)" ' + SKIN + '/>' +
  '<circle cx="124" cy="58" r="9.5" ' + SKIN + '/>' +
  '<circle cx="124" cy="86" r="9.5" ' + SKIN + '/>' +
  '<path d="M110 50 C116 54 118 60 116 66 M110 80 C116 84 118 90 116 96" ' + CREASE + '/>' +
  '<circle cx="78" cy="46" r="14" ' + SKIN + '/>'
);

const HANDS = { r: HAND_R, s: HAND_S, p: HAND_P };

/* 五角星（关卡卡主体）；dim 版灰化 */
function star(dim) {
  return uri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<path d="M50 6 L62 38 L96 39 L69 60 L79 93 L50 74 L21 93 L31 60 L4 39 L38 38 Z" fill="#FFD83D" stroke="#B25B00" stroke-width="6" stroke-linejoin="round"' +
      (dim ? ' opacity="0.35"' : '') + '/>' +
    '</svg>'
  );
}
const STAR = star(false);
const STAR_DIM = star(true);

module.exports = { FOOT, FEATHER, HANDS, STAR, STAR_DIM };
