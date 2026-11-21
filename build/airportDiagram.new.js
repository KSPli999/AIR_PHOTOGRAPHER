function airportDiagram(a, g, zc, k, vb){
  const rwys = runwaysOf(a, g);
  if (!rwys.length) return '';
  const fs = n => (n / zc).toFixed(5);
  const M = v => v * k;                 // 米 → 世界坐标
  const P = (x, y) => nf(x) + ',' + nf(y);
  const ends = {};
  (a.runways || []).forEach(r => { if (r.d) ends[r.d] = r; });
  let out = '';

  const text = (txt, x, y, szPx, fill, rot) => {
    out += `<text x="${nf(x)}" y="${nf(y)}" text-anchor="middle" fill="${fill}" ` +
      (rot == null ? '' : `transform="rotate(${rot.toFixed(1)} ${nf(x)} ${nf(y)})" `) +
      `style="font-size:${fs(szPx)}px;font-weight:700;paint-order:stroke;stroke:#081016;stroke-width:${fs(2.8)}px">${esc(txt)}</text>`;
  };

  for (const rw of rwys) {
    const [x1, y1] = pt(rw.le), [x2, y2] = pt(rw.he);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const W = Math.max(M(rw.w || 45), 5 / zc);
    const hw = W / 2;
    const lenM = L / k;                        // 跑道长（米）
    const lead = Math.min(60, lenM * .06);     // 端头留白
    const usable = Math.max(W - 2 * M(3.5), W * .55);

    // 道面
    const quad = (o1, o2, s0, s1) => `<polygon points="${[
      P(x1 + ux * M(s0) + nx * (o1), y1 + uy * M(s0) + ny * (o1)),
      P(x1 + ux * M(s1) + nx * (o1), y1 + uy * M(s1) + ny * (o1)),
      P(x1 + ux * M(s1) + nx * (o2), y1 + uy * M(s1) + ny * (o2)),
      P(x1 + ux * M(s0) + nx * (o2), y1 + uy * M(s0) + ny * (o2)),
    ].join(' ')}" fill="#5c6672" stroke="none"/>`;

    out += `<polygon points="${[
      P(x1 + nx * hw, y1 + ny * hw), P(x2 + nx * hw, y2 + ny * hw),
      P(x2 - nx * hw, y2 - ny * hw), P(x1 - nx * hw, y1 - ny * hw),
    ].join(' ')}" fill="#5c6672" stroke="#9fb0c0" stroke-width="${fs(0.7)}" stroke-opacity=".85"/>`;

    // 边线：距道面边缘 1.5m
    const inset = Math.max(M(1.5), W * .05);
    for (const sgn of [1, -1]) {
      const o = sgn * (hw - inset);
      out += `<line x1="${nf(x1 + nx * o + ux * M(2))}" y1="${nf(y1 + ny * o + uy * M(2))}" x2="${nf(x2 + nx * o - ux * M(2))}" y2="${nf(y2 + ny * o - uy * M(2))}" stroke="#dbe6f2" stroke-width="${fs(0.9)}" stroke-opacity=".75"/>`;
    }

    // 中线虚线：两端各留 60m
    const gap = Math.min(lead, lenM * .1);
    out += `<line x1="${nf(x1 + ux * M(gap))}" y1="${nf(y1 + uy * M(gap))}" x2="${nf(x2 - ux * M(gap))}" y2="${nf(y2 - uy * M(gap))}" stroke="#eef4fa" stroke-width="${fs(0.8)}" stroke-dasharray="${nf(M(30))} ${nf(M(20))}" stroke-opacity=".6"/>`;

    // 两端标记：入口条纹 + 瞄准点 + 接地区
    for (const [ex, ey, dir] of [[x1, y1, 1], [x2, y2, -1]]) {
      const bx0 = (s, o) => ex + ux * dir * M(s) + nx * o;
      const by0 = (s, o) => ey + uy * dir * M(s) + ny * o;
      // 入口“钢琴键”：8 条，条宽 = 缝宽
      const sw = usable / 15;
      for (let i = 0; i < 8; i++) {
        const o = -usable / 2 + sw / 2 + i * 2 * sw;
        const a1 = [bx0(6, o - sw / 2), by0(6, o - sw / 2)];
        const a2 = [bx0(6 + 30, o - sw / 2), by0(6 + 30, o - sw / 2)];
        const a3 = [bx0(6 + 30, o + sw / 2), by0(6 + 30, o + sw / 2)];
        const a4 = [bx0(6, o + sw / 2), by0(6, o + sw / 2)];
        out += `<polygon points="${[P(...a1), P(...a2), P(...a3), P(...a4)].join(' ')}" fill="#e9f1f9" fill-opacity=".92"/>`;
      }
      // 瞄准点：两条 45m × 9m，距入口 300m（短跑道按比例前移）
      const aimD = Math.min(300, Math.max(120, lenM * .3));
      if (aimD + 45 < lenM - 60) {
        const barHalf = M(9) / 2;
        for (const sgn of [1, -1]) {
          const o = sgn * usable * .22;
          const p1 = [bx0(aimD, o - barHalf), by0(aimD, o - barHalf)];
          const p2 = [bx0(aimD + 45, o - barHalf), by0(aimD + 45, o - barHalf)];
          const p3 = [bx0(aimD + 45, o + barHalf), by0(aimD + 45, o + barHalf)];
          const p4 = [bx0(aimD, o + barHalf), by0(aimD, o + barHalf)];
          out += `<polygon points="${[P(...p1), P(...p2), P(...p3), P(...p4)].join(' ')}" fill="#e9f1f9" fill-opacity=".9"/>`;
        }
      }
      // 接地区短杠：150m / 450m 各一对
      for (const d of [150, 450]) {
        if (d + 22 > lenM - 60) continue;
        for (const sgn of [1, -1]) {
          const o = sgn * usable * .22;
          const bh = M(3) / 2;
          const p1 = [bx0(d, o - bh), by0(d, o - bh)];
          const p2 = [bx0(d + 22, o - bh), by0(d + 22, o - bh)];
          const p3 = [bx0(d + 22, o + bh), by0(d + 22, o + bh)];
          const p4 = [bx0(d, o + bh), by0(d, o + bh)];
          out += `<polygon points="${[P(...p1), P(...p2), P(...p3), P(...p4)].join(' ')}" fill="#e9f1f9" fill-opacity=".85"/>`;
        }
      }
    }

    // 跑道号：沿跑道方向，翻正可读
    let rot = Math.atan2(dy, dx) * 180 / Math.PI;
    if (rot > 90 || rot <= -90) rot += 180;
    const numAt = (d, ex, ey, dir) => {
      if (!d) return;
      text(d, ex + ux * dir * M(52), ey + uy * dir * M(52), 9.5, '#ffffff', rot);
    };
    numAt(rw.la, x1, y1, 1);
    numAt(rw.lb, x2, y2, -1);

    // ILS 标牌：跑道端外侧，CAT + 频率
    const ilsAt = (d, ex, ey, dir) => {
      const e = ends[d];
      if (!e || !e.ils) return;
      const cat = e.ils.cat || 'ILS';
      const txt = `${cat} ${e.ils.locF}`;
      text(txt, ex - ux * dir * M(34), ey - uy * dir * M(34), 7, '#7fe3ff', rot);
    };
    ilsAt(rw.la, x1, y1, 1);
    ilsAt(rw.lb, x2, y2, -1);

    // 塔台按跑道分频：多套塔台时标在该跑道外侧
    const twrs = a.twr || [];
    if (twrs.length > 1) {
      const hit = twrs.filter(t => (t.rwys || []).includes(rw.la) || (t.rwys || []).includes(rw.lb));
      if (hit.length) {
        const txt = 'TWR ' + hit.map(t => t.f).join('/');
        text(txt, x1 - ux * M(48) - nx * (hw + M(12)), y1 - uy * M(48) - ny * (hw + M(12)), 7, '#ffd479', rot);
      }
    }
  }

  // 频率牌：塔台按跑道分列
  const uniq = types => {
    const arr = [];
    (a.comms || []).forEach(c => { if (types.includes(c.type) && c.f && !arr.includes(c.f)) arr.push(c.f); });
    return arr.slice(0, 2).join(' / ');
  };
  const lines = [];
  const twrs = a.twr || [];
  if (twrs.length) {
    twrs.slice(0, 4).forEach(t => {
      lines.push(['塔台 TWR' + (t.rwys && t.rwys.length ? ' ' + t.rwys.join('/') : ''), t.f + (t.alt ? ' / ' + t.alt : '')]);
    });
  }
  const gd = uniq(['GND']); if (gd) lines.push(['地面 GND', gd]);
  const ap = uniq(['APN', 'RAMP']); if (ap) lines.push(['机坪 APN', ap]);
  const at = uniq(['ATIS']); if (at) lines.push(['通播', at]);
  {
    const fsz = 9, lh = 12, hh = 14;
    const title = (a.nameCn || a.id) + ' ' + a.id + ' · 跑道频率';
    const wpx = Math.max(textW(title, 9), ...lines.map(l => textW(l[0] + '  ' + l[1], fsz))) + 12;
    const hpx = hh + lines.length * lh + 8;
    const bxp2 = vb.x1 - (wpx + 14) / zc, byp2 = vb.y0 + 10 / zc;
    out += `<rect x="${nf(bxp2)}" y="${nf(byp2)}" width="${fs(wpx + 2)}" height="${fs(hpx)}" rx="${fs(3)}" fill="#0b1620" fill-opacity=".9" stroke="#2c4a5e" stroke-width="${fs(1)}"/>`;
    out += `<text x="${nf(bxp2 + 6 / zc)}" y="${nf(byp2 + 10 / zc)}" fill="#ffe6b8" style="font-size:${fs(9)}px;font-weight:700">${esc(title)}</text>`;
    lines.forEach((l, i) => {
      const yy = byp2 + (hh + i * lh + 8) / zc;
      out += `<text x="${nf(bxp2 + 6 / zc)}" y="${nf(yy)}" fill="#8fb3c9" style="font-size:${fs(fsz)}px">${esc(l[0])}</text>`;
      out += `<text x="${nf(bxp2 + (wpx - 6) / zc)}" y="${nf(yy)}" text-anchor="end" fill="#e8eef5" style="font-size:${fs(fsz)}px;font-weight:700">${esc(l[1])}</text>`;
    });
  }
  return out;
}
