// fps-meter.ts
export interface FPSMeterOptions {
  /** 容器父节点（默认 document.body） */
  parent?: HTMLElement;
  /** 组件宽度（CSS 像素） */
  width?: number;
  /** 组件高度（CSS 像素） */
  height?: number;
}

export default class FPSMeter {
  private parent: HTMLElement;
  private width: number;
  private height: number;

  private wrapper: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private rafId: number | null = null;
  private lastTime = performance.now();
  private frameCount = 0;

  private fps = 0;          // 瞬时 FPS（基于 1s 窗口计算）
  private avgFps = 0;       // 平滑后 FPS
  private smoothing = 0.25; // 0~1，越大越灵敏
  private cap = 120;        // 柱状图上限（显示范围）

  constructor({ parent = document.body, width = 110, height = 54 }: FPSMeterOptions = {}) {
    if (!(parent instanceof HTMLElement)) {
      throw new Error("`parent` 必须是一个 HTMLElement");
    }
    this.parent = parent;
    this.width = width;
    this.height = height;

    this.wrapper = document.createElement("div");
    this.canvas = document.createElement("canvas");

    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("无法获取 2D 渲染上下文");
    this.ctx = ctx;

    this.setupDom();
    this.resizeCanvas(width, height);
    this.drawFrame(0, 0);
  }

  /** 启动监听与绘制 */
  public start(): void {
    if (this.rafId) return;
    this.lastTime = performance.now();

    const loop = (now: number) => {
      this.rafId = requestAnimationFrame(loop);

      this.frameCount++;
      const delta = now - this.lastTime;

      if (delta >= 1000) {
        this.fps = (this.frameCount * 1000) / delta;
        this.avgFps = this.avgFps
          ? this.avgFps * (1 - this.smoothing) + this.fps * this.smoothing
          : this.fps;

        this.frameCount = 0;
        this.lastTime = now;

        this.drawFrame(this.avgFps, this.fps);
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /** 停止监听 */
  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** 销毁并移除 DOM */
  public destroy(): void {
    this.stop();
    if (this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    // 断开引用
    // （可选）将属性置为 null/undefined 以帮助 GC
    // 这里保持简单，不做多余处理
  }

  /** 更新组件尺寸 */
  public updateSize(width: number, height: number): void {
    if (typeof width === "number" && typeof height === "number") {
      this.resizeCanvas(width, height);
    }
  }

  /** 获取平滑后的 FPS（便于外部读取） */
  public getFPS(): number {
    return this.avgFps;
  }

  /** 当前是否在运行 */
  public isRunning(): boolean {
    return this.rafId !== null;
  }

  // ---------------- 内部实现 ----------------

  private setupDom(): void {
    const wrap = this.wrapper;
    const cvs = this.canvas;

    wrap.style.position = this.parent === document.body ? "fixed" : "absolute";
    wrap.style.top = "8px";
    wrap.style.right = "8px";
    wrap.style.zIndex = "2147483647";
    wrap.style.pointerEvents = "none";
    wrap.style.filter = "drop-shadow(0 2px 6px rgba(0,0,0,.25))";

    if (this.parent !== document.body) {
      const cs = getComputedStyle(this.parent);
      if (cs.position === "static") {
        this.parent.style.position = "relative";
      }
    }

    cvs.style.display = "block";
    cvs.style.borderRadius = "10px";
    cvs.style.background = "rgba(0,0,0,0.55)";

    wrap.appendChild(cvs);
    this.parent.appendChild(wrap);
  }

  private resizeCanvas(w: number, h: number): void {
    this.width = w;
    this.height = h;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawFrame(this.avgFps, this.fps);
  }

  private drawFrame(avgFps = 0, instFps = 0): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    const padding = 10;
    ctx.font = "600 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillStyle = "#E6FFE6";
    ctx.textBaseline = "top";
    ctx.fillText("FPS", padding, padding);

    ctx.font = "700 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillStyle = "#C8F7C5";
    const fpsText = Number.isFinite(avgFps) ? avgFps.toFixed(1) : "0.0";
    ctx.fillText(fpsText, padding, padding + 18);

    // 右侧柱状图区域
    const bar = { x: W - 40, y: padding, w: 24, h: H - padding * 2 };

    // 背槽
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);

    // 柱
    const ratio = Math.max(0, Math.min(1, instFps / this.cap));
    const barHeight = Math.max(2, Math.round(bar.h * ratio));
    ctx.fillStyle = "#9BE89B";
    ctx.fillRect(bar.x, bar.y + (bar.h - barHeight), bar.w, barHeight);

    // 60fps 辅助线
    const sixtyY = bar.y + (bar.h - Math.round(bar.h * (60 / this.cap)));
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bar.x - 6, sixtyY + 0.5);
    ctx.lineTo(bar.x + bar.w + 2, sixtyY + 0.5);
    ctx.stroke();

    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("60", bar.x - 18, sixtyY - 6);
  }
}
