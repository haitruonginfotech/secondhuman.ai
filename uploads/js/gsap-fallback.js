/**
 * gsap-fallback.js — script thường, KHÔNG phải module.
 *
 * GSAP/ScrollTrigger tải từ CDN. Nếu mất mạng hoặc CDN lỗi, file này gắn một bộ
 * stub vào window.gsap / window.ScrollTrigger: mọi animation thành no-op,
 * gsap.set() ghi thẳng style để nội dung vẫn hiện đầy đủ thay vì trang trắng.
 *
 * Phải nạp SAU hai thẻ script gsap của CDN.
 */
window.__SH_GSAP_STUB = (function () {
  'use strict';

  function toList(targets) {
    if (!targets) return [];
    if (typeof targets === 'string') return Array.prototype.slice.call(document.querySelectorAll(targets));
    if (targets instanceof Element) return [targets];
    if (typeof targets.length === 'number') return Array.prototype.slice.call(targets);
    return [targets];
  }

  function px(v) { return typeof v === 'number' ? v + 'px' : v; }

  /** Áp vars của gsap lên inline style ở trạng thái cuối (không tween). */
  function apply(targets, vars) {
    if (!vars) return;
    toList(targets).forEach(function (el) {
      if (!el || !el.style) return;
      if (vars.autoAlpha !== undefined) {
        el.style.opacity = String(vars.autoAlpha);
        el.style.visibility = Number(vars.autoAlpha) > 0 ? 'visible' : 'hidden';
      }
      if (vars.opacity !== undefined) el.style.opacity = String(vars.opacity);
      if (vars.visibility !== undefined) el.style.visibility = vars.visibility;
      var tr = [];
      if (vars.x !== undefined) tr.push('translateX(' + px(vars.x) + ')');
      if (vars.y !== undefined) tr.push('translateY(' + px(vars.y) + ')');
      if (vars.xPercent !== undefined) tr.push('translateX(' + vars.xPercent + '%)');
      if (vars.yPercent !== undefined) tr.push('translateY(' + vars.yPercent + '%)');
      if (vars.scale !== undefined) tr.push('scale(' + vars.scale + ')');
      if (vars.rotate !== undefined) tr.push('rotate(' + vars.rotate + 'deg)');
      if (tr.length) el.style.transform = tr.join(' ');
      if (vars.transformOrigin) el.style.transformOrigin = vars.transformOrigin;
      if (vars.clearProps) el.style.cssText = el.style.cssText; // no-op giữ nguyên
    });
  }

  var noop = function () {};
  var tween = { kill: noop, pause: noop, play: noop, restart: noop, progress: function () { return 1; } };

  var timeline = {
    to: function () { return timeline; },
    from: function () { return timeline; },
    fromTo: function () { return timeline; },
    set: function () { return timeline; },
    add: function () { return timeline; },
    kill: noop,
    pause: noop,
    play: noop,
  };

  var gsap = {
    set: function (t, v) { apply(t, v); return tween; },
    to: function (t, v) { apply(t, v); return tween; },
    from: function () { return tween; },
    fromTo: function (t, a, b) { apply(t, b); return tween; },
    timeline: function () { return timeline; },
    killTweensOf: noop,
    registerPlugin: noop,
    quickTo: function () { return noop; },
    utils: {
      toArray: toList,
      clamp: function (min, max, v) { return Math.min(max, Math.max(min, v)); },
      interpolate: function (a, b) { return function (t) { return a + (b - a) * t; }; },
    },
  };

  var instance = { kill: noop, refresh: noop, disable: noop, enable: noop, progress: 0 };
  var ScrollTrigger = {
    create: function () { return instance; },
    refresh: noop,
    update: noop,
    killAll: noop,
    getAll: function () { return []; },
    batch: noop,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: noop,
  };

  return { gsap: gsap, ScrollTrigger: ScrollTrigger };
})();

// GSAP thật có mặt hay không — main.js dựa vào cờ này để quyết định chạy animation.
window.__SH_HAS_GSAP = Boolean(window.gsap && window.ScrollTrigger);
if (!window.__SH_HAS_GSAP) {
  window.gsap = window.__SH_GSAP_STUB.gsap;
  window.ScrollTrigger = window.__SH_GSAP_STUB.ScrollTrigger;
}
