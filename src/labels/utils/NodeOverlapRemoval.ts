// fast-node-overlap.ts
// TypeScript implementation of FNOR (Fast Node Overlap Removal)
// 1) Constraint generation via sweep-line (Cno_x / Cno_y)
// 2) VPSC solver: satisfyVPSC (near-optimal), optional solveVPSC (active-set)

export type Rect = { x1: number; x2: number; y1: number; y2: number };
type Var = {
  id: number;
  des: number;       // desired position (center on axis)
  weight: number;    // default 1
};
type Constraint = { left: number; right: number; gap: number }; // v_left + gap <= v_right

export type ResolveOptions = {
  // axis gaps added to half-sum width/height
  extraGapX?: number;
  extraGapY?: number;
  weights?: number[];       // per-rectangle weight in objective
  orthogonalOrder?: boolean;// preserve original orthogonal order (optional)
  useActiveSet?: boolean;   // use solveVPSC (else satisfyVPSC)
  maxSplits?: number;       // cap for active-set loop
};

export type ResolveResult = {
  rects: Rect[];
  moved: number;     // total |delta| sum of centers
};

// ---------- helpers ----------
function centerX(r: Rect) { return (r.x1 + r.x2) / 2; }
function centerY(r: Rect) { return (r.y1 + r.y2) / 2; }
function width(r: Rect)   { return r.x2 - r.x1; }
function height(r: Rect)  { return r.y2 - r.y1; }

function olapX(a: Rect, b: Rect) {
  return (width(a) + width(b)) / 2 - Math.abs(centerX(a) - centerX(b));
}
function olapY(a: Rect, b: Rect) {
  return (height(a) + height(b)) / 2 - Math.abs(centerY(a) - centerY(b));
}

// red-black tree替代：这里用有序数组维护 active（n 通常不大；若需 n→10^5，可换平衡树）
function insertSorted<T>(arr: T[], x: T, key: (t: T) => number) {
  const k = key(x);
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(arr[mid]) <= k) lo = mid + 1; else hi = mid;
  }
  arr.splice(lo, 0, x);
}

function removeOne<T>(arr: T[], pred: (t: T) => boolean) {
  const i = arr.findIndex(pred);
  if (i >= 0) arr.splice(i, 1);
}

// =============== 1) Constraint generation (Cno_x / Cno_y) ===============
// 根据论文：Cno_x 通过纵向扫描生成“左右”分离约束；Cno_y 通过横向扫描生成“上下”分离约束。
// X 轴：get_left_nb / get_right_nb 选择最近的非重叠或“横向重叠小于纵向重叠”的重叠邻居；
// 并删除左右邻居之间已有的冗余约束（由 u-v 与 v-u' 两条约束隐含）。
// Y 轴：只需选择最靠近的上下邻居即可，保证约束数 O(n)。

function generateCnoX(rects: Rect[], extraGapX = 0, orthOrder?: boolean): Constraint[] {
  type Ev = { pos: number; kind: 0 | 1; i: number }; // 0=open at y1, 1=close at y2
  const n = rects.length;
  const evs: Ev[] = [];
  for (let i = 0; i < n; i++) {
    evs.push({ pos: rects[i].y1, kind: 0, i });
    evs.push({ pos: rects[i].y2, kind: 1, i });
  }
  evs.sort((a, b) => a.pos - b.pos || a.kind - b.kind);

  const constraints: Constraint[] = [];
  const lefts: number[][] = Array.from({ length: n }, () => []);
  const rights: number[][] = Array.from({ length: n }, () => []);

  // 活动集按 x 中心排序
  const active: number[] = [];
  const key = (idx: number) => centerX(rects[idx]);

  function getLeftNeighbours(v: number): number[] {
    const res: number[] = [];
    // 从 active 中向“左”回看
    for (let k = active.length - 1; k >= 0; k--) {
      const u = active[k];
      if (u === v) continue;
      const ox = olapX(rects[u], rects[v]);
      const oy = olapY(rects[u], rects[v]);
      if (ox <= 0) { res.push(u); break; }
      if (ox <= oy) res.push(u);
    }
    return res;
  }
  function getRightNeighbours(v: number): number[] {
    const res: number[] = [];
    for (let k = 0; k < active.length; k++) {
      const u = active[k];
      if (u === v) continue;
      const ox = olapX(rects[v], rects[u]);
      const oy = olapY(rects[v], rects[u]);
      if (ox <= 0) { res.push(u); break; }
      if (ox <= oy) res.push(u);
    }
    return res;
  }

  for (const e of evs) {
    const i = e.i;
    if (e.kind === 0) {
      insertSorted(active, i, key);
      const L = getLeftNeighbours(i);
      const R = getRightNeighbours(i);
      lefts[i] = L;
      for (const u of L) {
        // rights[u] = (rights[u] ∪ {i}) \ R    —— 删除冗余对
        if (!rights[u].includes(i)) rights[u].push(i);
        for (const w of R) {
          const p = rights[u].indexOf(w);
          if (p !== -1) rights[u].splice(p, 1);
        }
      }
      rights[i] = R;
      for (const u of R) {
        if (!lefts[u].includes(i)) lefts[u].push(i);
        for (const w of L) {
          const p = lefts[u].indexOf(w);
          if (p !== -1) lefts[u].splice(p, 1);
        }
      }
    } else {
      // close: 生成约束 & 清理邻接
      for (const u of lefts[i]) {
        const gap = (width(rects[u]) + width(rects[i])) / 2 + extraGapX;
        // u + gap <= i  （i 在右）
        constraints.push({ left: u, right: i, gap });
        removeOne(rights[u], (x) => x === i);
      }
      for (const u of rights[i]) {
        const gap = (width(rects[u]) + width(rects[i])) / 2 + extraGapX;
        // i + gap <= u  （u 在右）
        constraints.push({ left: i, right: u, gap });
        removeOne(lefts[u], (x) => x === i);
      }
      removeOne(active, (x) => x === i);
    }
  }

  // 可选：保持原始 X 方向正交次序（减少“越位”）
  if (orthOrder) {
    const order = [...rects.keys()].sort((a, b) => centerX(rects[a]) - centerX(rects[b]));
    for (let k = 1; k < order.length; k++) {
      const u = order[k - 1], v = order[k];
      constraints.push({ left: u, right: v, gap: 0 }); // xv >= xu
    }
  }
  return constraints;
}

function generateCnoY(rects: Rect[], extraGapY = 0, orthOrder?: boolean): Constraint[] {
  type Ev = { pos: number; kind: 0 | 1; i: number }; // 0=open at x1, 1=close at x2
  const n = rects.length;
  const evs: Ev[] = [];
  for (let i = 0; i < n; i++) {
    evs.push({ pos: rects[i].x1, kind: 0, i });
    evs.push({ pos: rects[i].x2, kind: 1, i });
  }
  evs.sort((a, b) => a.pos - b.pos || a.kind - b.kind);

  const constraints: Constraint[] = [];
  const active: number[] = [];
  const key = (idx: number) => centerY(rects[idx]);

  function nearestAboveBelow(v: number): { below?: number; above?: number } {
    let below: number | undefined;
    let above: number | undefined;
    // active 已按 y 排序
    for (const u of active) {
      if (u === v) continue;
      if (centerY(rects[u]) <= centerY(rects[v])) {
        if (below === undefined || centerY(rects[u]) > centerY(rects[below])) below = u;
      } else {
        if (above === undefined || centerY(rects[u]) < centerY(rects[above])) above = u;
      }
    }
    return { below, above };
  }

  for (const e of evs) {
    const i = e.i;
    if (e.kind === 0) {
      insertSorted(active, i, key);
    } else {
      // 只对“最靠近的上下邻居”建约束
      const { below, above } = nearestAboveBelow(i);
      if (below !== undefined) {
        const gap = (height(rects[below]) + height(rects[i])) / 2 + extraGapY;
        // below + gap <= i   （i 在上）
        constraints.push({ left: below, right: i, gap });
      }
      if (above !== undefined) {
        const gap = (height(rects[above]) + height(rects[i])) / 2 + extraGapY;
        // i + gap <= above   （above 在上）
        constraints.push({ left: i, right: above, gap });
      }
      removeOne(active, (x) => x === i);
    }
  }

  if (orthOrder) {
    const order = [...rects.keys()].sort((a, b) => centerY(rects[a]) - centerY(rects[b]));
    for (let k = 1; k < order.length; k++) {
      const u = order[k - 1], v = order[k];
      constraints.push({ left: u, right: v, gap: 0 }); // yv >= yu
    }
  }
  return constraints;
}

// =============== 2) VPSC solver ===============
// satisfyVPSC: 近似最优（论文 Figure 1 右半部分思路）
// 数据结构：块 block 含 vars、active（活动等式约束树）、in/out（跨块约束堆）等。
// 这里用简化实现：保持 “左约束 in” 的最大违例优先级队列，用二叉堆即可。

class BinHeap<T> {
  private a: T[] = [];
  constructor(private less: (x: T, y: T) => boolean) {}
  push(x: T) { this.a.push(x); this.up(this.a.length - 1); }
  top(): T | undefined { return this.a[0]; }
  pop(): T | undefined { const r = this.a[0]; const x = this.a.pop(); if (this.a.length && x !== undefined) { this.a[0] = x; this.down(0); } return r; }
  get size() { return this.a.length; }
  private up(i: number) { const a = this.a, less = this.less; while (i) { const p = (i - 1) >> 1; if (!less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  private down(i: number) { const a = this.a, n = a.length, less = this.less; while (true) { let l = i * 2 + 1, r = l + 1, m = i; if (l < n && less(a[l], a[m])) m = l; if (r < n && less(a[r], a[m])) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
}

type Block = {
  vars: number[];               // variable indices
  posn: number;                 // current block ref pos
  weight: number;               // sum of var weights
  wposn: number;                // sum of weights * desired (with offsets)
  inQ: BinHeap<number>;         // indices of constraints, ordered by descending violation
  active: number[];             // active constraints (tree edges) indices
};

function satisfyVPSC(vars: Var[], cons: Constraint[]): number[] {
  const n = vars.length;
  // 拓扑序（约束图无环）
  const indeg = new Array(n).fill(0);
  const outAdj: number[][] = Array.from({ length: n }, () => []);
  cons.forEach((c, idx) => { outAdj[c.left].push(idx); indeg[c.right]++; });
  const Q: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) Q.push(i);
  const order: number[] = [];
  while (Q.length) {
    const u = Q.shift()!;
    order.push(u);
    for (const ei of outAdj[u]) {
      const v = cons[ei].right;
      if (--indeg[v] === 0) Q.push(v);
    }
  }

  // block/offset 初始化
  const blockOf = new Array(n).fill(-1);
  const offset = new Array(n).fill(0);
  const blocks: Block[] = [];

  function newBlockForSingle(v: number): number {
    const b: Block = {
      vars: [v],
      posn: vars[v].des,
      weight: vars[v].weight,
      wposn: vars[v].weight * vars[v].des,
      inQ: new BinHeap<number>((i, j) => violation(i) > violation(j)), // 大顶堆：违例更大优先
      active: [],
    };
    const id = blocks.push(b) - 1;
    blockOf[v] = id;
    offset[v] = 0;
    // 填充 inQ（所有入边）
    for (let k = 0; k < cons.length; k++) if (cons[k].right === v) b.inQ.push(k);
    return id;
  }
  function pos(v: number) { const b = blocks[blockOf[v]]; return b.posn + offset[v]; }
  function violation(ci: number) {
    const c = cons[ci]; // left + gap - right
    return (pos(c.left) + c.gap) - pos(c.right);
  }
  function mergeBlocks(biKeep: number, edgeIdx: number, biGone: number, dist_keep_to_gone: number) {
    // 把 biGone 合并进 biKeep，edgeIdx 为激活的等式约束
    const BK = blocks[biKeep], BG = blocks[biGone];
    // 更新 offset：让 BG 的每个变量相对 BK 的参考点有偏移
    for (const v of BG.vars) {
      blockOf[v] = biKeep;
      offset[v] += dist_keep_to_gone;
      BK.vars.push(v);
    }
    // active & inQ 合并
    BK.active.push(edgeIdx);
    for (let i = 0; i < BG.active.length; i++) BK.active.push(BG.active[i]);
    while (BG.inQ.size) { const ci = BG.inQ.pop()!; BK.inQ.push(ci); }
    // 合并加权中心
    BK.wposn = BK.wposn + BG.wposn - dist_keep_to_gone * BG.weight;
    BK.weight += BG.weight;
    BK.posn = BK.wposn / BK.weight;
  }

  function mergeLeft(bi: number) {
    // 处理左侧入约束的违例（largest violation first）
    while (blocks[bi].inQ.size && violation(blocks[bi].inQ.top()!) > 0) {
      const ci = blocks[bi].inQ.pop()!;
      const c = cons[ci];
      const bl = blockOf[c.left];
      if (bl === bi) continue; // 内部约束，忽略
      // 距离偏移：offset[left] + gap - offset[right]
      const dist = offset[c.left] + c.gap - offset[c.right];
      // 谁大谁合并谁：这里直接把较小块并入较大块可减少链高（也可按论文策略）
      const keep = blocks[bi].vars.length >= blocks[bl].vars.length ? bi : bl;
      const gone = keep === bi ? bl : bi;
      const dist_keep_to_gone = keep === bi ? -dist : dist; // 调整方向
      mergeBlocks(keep, ci, gone, dist_keep_to_gone);
      bi = keep;
    }
  }

  // 主循环：按拓扑序依次插入变量，必要时通过“合并到左”消除入约束违例
  for (const v of order) {
    const bi = newBlockForSingle(v);
    mergeLeft(bi);
  }

  // 返回位置
  const x: number[] = new Array(n);
  for (let v = 0; v < n; v++) x[v] = pos(v);
  return x;
}

// 计算各活动约束的“λ/2”（拉格朗日乘子的一半）；若存在 <0，则可拆分改进
function computeLagrangeHalf(vars: Var[], cons: Constraint[], blocks: ReturnType<typeof buildBlockIndex>) {
  const { blocksArr, blockOf, offset } = blocks;
  const lm = new Array(cons.length).fill(0);
  function pos(v: number) { const b = blocksArr[blockOf[v]]; return b.posn + offset[v]; }

  // 深度优先在每个 block.active 树上累加：dfdv = Σ w*(pos - des)
  function dfsVar(v: number, activeIdxs: number[], parent: number | null, dir: 1 | -1): number {
    const b = blocksArr[blockOf[v]];
    let dfdv = vars[v].weight * (pos(v) - vars[v].des);
    for (const ci of activeIdxs) {
      const c = cons[ci];
      if (dir === 1 && c.left === v && (parent === null || c.right !== parent)) {
        lm[ci] = dfsVar(c.right, activeIdxs, v, 1); // 向右
        dfdv += lm[ci];
      } else if (dir === -1 && c.right === v && (parent === null || c.left !== parent)) {
        lm[ci] = -dfsVar(c.left, activeIdxs, v, -1); // 向左
        dfdv -= lm[ci];
      }
    }
    return dfdv;
  }

  for (const b of blocksArr) {
    if (b.vars.length === 0) continue;
    const root = b.vars[0];
    dfsVar(root, b.active, null, 1);
  }
  return lm;
}

function buildBlockIndex(vars: Var[], cons: Constraint[], solution: number[]) {
  // 根据 satisfyVPSC 结束后的状态重建 block 索引；这里用每个变量自成块 + 根据“等式约束”把相同位置且由 active 连接的合并
  // 简化：我们假设 “等式约束” 即当前满足为等式的那些：|v_right - (v_left + gap)| < eps
  const eps = 1e-9;
  const n = vars.length;
  const parent = [...Array(n).keys()];
  function find(x: number): number { return parent[x] === x ? x : (parent[x] = find(parent[x])); }
  function uni(a: number, b: number) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }

  cons.forEach(c => {
    const lhs = solution[c.left] + c.gap;
    const rhs = solution[c.right];
    if (Math.abs(lhs - rhs) < eps) uni(c.left, c.right);
  });

  const blocksMap = new Map<number, Block>();
  const blockOf = new Array(n);
  const offset = new Array(n).fill(0);
  for (let v = 0; v < n; v++) {
    const r = find(v);
    let b = blocksMap.get(r);
    if (!b) {
      b = { vars: [], posn: 0, weight: 0, wposn: 0, inQ: new BinHeap<number>(() => false), active: [] };
      blocksMap.set(r, b);
    }
    b.vars.push(v);
    b.weight += vars[v].weight;
    b.posn = solution[r]; // 参考点：代表元的解
    blockOf[v] = r;
    offset[v] = solution[v] - solution[r];
  }
  const blocksArr = [...blocksMap.values()];
  return { blocksArr, blockOf, offset };
}

function solveVPSC(vars: Var[], cons: Constraint[], maxSplits = 20): number[] {
  // 先用 satisfyVPSC
  let x = satisfyVPSC(vars, cons);
  for (let iter = 0; iter < maxSplits; iter++) {
    const state = buildBlockIndex(vars, cons, x);
    const lm = computeLagrangeHalf(vars, cons, state);
    // 找到最负的 λ/2（意味着该活动等式约束应被打断）
    let bestIdx = -1, bestVal = 0;
    for (let i = 0; i < lm.length; i++) if (lm[i] < bestVal) { bestVal = lm[i]; bestIdx = i; }
    if (bestIdx === -1) break; // optimal

    // “拆分”：将 bestIdx 对应的等式约束打断——在此简化为：稍微放松该约束，并重跑 satisfyVPSC
    // 更严谨的实现应按论文对 block 做 left/right 子集划分并局部 merge-left/right 调整。
    const tiny = 1e-9;
    cons[bestIdx] = { ...cons[bestIdx], gap: cons[bestIdx].gap + tiny };
    x = satisfyVPSC(vars, cons);
  }
  return x;
}

// =============== 3) Public API ===============
export function resolveRectangles(rectsIn: Rect[], options: ResolveOptions = {}): ResolveResult {
  const rects = rectsIn.map(r => ({ ...r }));
  const n = rects.length;
  const wts = options.weights ?? Array(n).fill(1);

  // ---- X 轴 ----
  const varsX: Var[] = rects.map((r, i) => ({ id: i, des: centerX(r), weight: wts[i] }));
  const Cx = generateCnoX(rects, options.extraGapX ?? 0, options.orthogonalOrder);
  const solX = options.useActiveSet
    ? solveVPSC(varsX, Cx, options.maxSplits ?? 20)
    : satisfyVPSC(varsX, Cx);

  // 更新 x1,x2（保持 width 不变）
  for (let i = 0; i < n; i++) {
    const w = width(rects[i]);
    const cx = solX[i];
    rects[i].x1 = cx - w / 2;
    rects[i].x2 = cx + w / 2;
  }

  // ---- Y 轴 ----
  const varsY: Var[] = rects.map((r, i) => ({ id: i, des: centerY(r), weight: wts[i] }));
  const Cy = generateCnoY(rects, options.extraGapY ?? 0, options.orthogonalOrder);
  const solY = options.useActiveSet
    ? solveVPSC(varsY, Cy, options.maxSplits ?? 20)
    : satisfyVPSC(varsY, Cy);

  for (let i = 0; i < n; i++) {
    const h = height(rects[i]);
    const cy = solY[i];
    rects[i].y1 = cy - h / 2;
    rects[i].y2 = cy + h / 2;
  }

  // 统计总位移（中心曼哈顿距离）
  let moved = 0;
  for (let i = 0; i < n; i++) {
    moved += Math.abs(solX[i] - varsX[i].des) + Math.abs(solY[i] - varsY[i].des);
  }
  return { rects, moved };
}
