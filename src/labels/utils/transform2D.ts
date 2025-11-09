import {ScaleLinear, ScaleTime} from "@/global/types";

/**
 * @class 二维空间线性变换类
 * 假设变化前的坐标为(X0, Y0)，则变换后的坐标(X, Y)满足：
 * X = kx * X0 + x
 * Y = ky * Y0 + y
 */
export default class Transform2D {
    static identity = new Transform2D();

    /** 横坐标偏移量 */
    readonly x: number = 0;
    /** 纵坐标偏移量 */
    readonly y: number = 0;
    /** 横坐标缩放系数 */
    readonly kx: number = 1;
    /** 纵坐标缩放系数 */
    readonly ky: number = 1;

    /** 缩放系数（如果不需要横纵坐标有不同的缩放系数，可以使用这个—） */
    get k(): number {
        if (this.kx !== this.ky) throw new Error("kx and ky are not equal");
        return this.kx;
    }
    // set k(value: number) {
    //     this.kx = this.ky = value;
    // }

    constructor(x: number = 0, y: number = 0, kx: number = 1, ky: number = 1) {
        this.x = x;
        this.y = y;
        this.kx = kx;
        this.ky = ky;
    }

    /** 缩放 */
    scale (k: number): Transform2D;
    scale (kx: number, ky: number): Transform2D;
    scale (kx: number, ky?: number) {
        (ky === undefined) && (ky = kx);
        return new Transform2D(
            this.x,
            this.y,
            this.kx * kx,
            this.ky * ky,
        );
    }

    /** 平移 */
    translate(x: number = 0, y: number = 0): Transform2D {
        return new Transform2D(
            this.x + x,
            this.y + y,
            this.kx,
            this.ky,
        );
    }

    /**
     * 应用到x轴比例尺上
     */
    rescaleX<T extends ScaleTime | ScaleLinear>(x: T): T {
        return x.copy().domain(x.range().map(this.invertX, this).map((x as any).invert, x)) as T;
    }

    /**
     * 应用到y轴比例尺上
     */
    rescaleY<T extends ScaleTime | ScaleLinear>(y: T): T {
        return y.copy().domain(y.range().map(this.invertY, this).map((y as any).invert, y)) as T;
    }

    toString () {
        return `translate(${this.x},${this.y}) scale(${this.kx},${this.ky})`;
    }

    /** 应用变换 */
    apply (point: [number, number]): [number, number] {
        return [
            this.applyX(point[0]),
            this.applyY(point[1]),
        ]
    }
    applyX(x: number): number {
        return this.kx * x + this.x;
    }
    applyY(y: number): number {
        return this.ky * y + this.y;
    }

    /** 应用逆变换 */
    invert(point: [number, number]): [number, number] {
        return [
            this.invertX(point[0]),
            this.invertY(point[1])
        ]
    }
    invertX(x: number): number {
        return (x - this.x) / this.kx;
    }
    invertY(y: number):  number {
        return (y - this.y) / this.ky;
    }
}
export const identity = new Transform2D();