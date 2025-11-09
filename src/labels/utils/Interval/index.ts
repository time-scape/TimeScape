import schedule from "./schedule";
import layout from "./layout";

/**
 * 静态区间类
 */
export default class Interval {
    /** 理想区间中心点 */
    cx: number;
    /** 区间宽度 */
    width: number;
    /** 区间左右允许的偏移 */
    delta: number;
    /** 区间权重 */
    weight: number;

    /** 实际区间中心点（由layout算法计算得到） */
    cx2?: number = undefined;

    /** 布局的最左侧边界 */
    leftX: number;
    /** 布局的最右侧边界 */
    rightX: number;

    constructor(
        cx: number,
        width: number,
        delta: number,
        weight: number = 1
    ) {
        this.cx = cx;
        this.width = width;
        this.delta = delta;
        this.weight = weight;

        const halfTotalWidth = width / 2 + delta;
        this.leftX = cx - halfTotalWidth;
        this.rightX = cx + halfTotalWidth;
    }

    static createFromRange(leftX: number, rightX: number, width: number, weight: number = 1) {
        const delta = (rightX - leftX - width) / 2;
        return new Interval(
            (leftX + rightX) / 2,
            width,
            delta,
            weight,
        );
    }

    copy() {
        return new Interval(this.cx, this.width, this.delta, this.weight);
    }

    /**
     * 区间调度算法，返回最大权重和的区间集合
     * @description 算法的时间复杂度为O(n^2)（未优化，优化版本可以达到O(n)），空间复杂度为O(n)
     * @param intervals 待求解的区间集合
     * @param selectedIntervals 必须选中的区间集合（用0-1表示。处于性能考虑，如果都选中会出现重叠时并不一定会报错，而是会返回一个错误的结果）
     * @param leftX 布局的最左侧边界
     * @param rightX 布局的最右侧边界
     * @returns 数组，表示每个区间是否被选中（用0-1表示）
     */
    static schedule (
        intervals: Interval[],
        selectedIntervals: Uint8Array,
        leftX: number = -Infinity,
        rightX: number = Infinity,
    ) {
        return schedule(intervals, selectedIntervals, leftX, rightX);
    }

    /**
     * 布局算法
     * @description 算法的时间复杂度为O(n^2)，空间复杂度为O(n)
     * @param intervals 待求解的区间集合
     * @param leftX 布局的最左侧边界
     * @param rightX 布局的最右侧边界
     * @returns 无返回值，结果直接写入每个interval的cx字段
     */
    static layout(
        intervals: Interval[],
        leftX: number = -Infinity,
        rightX: number = Infinity,
    ) {
        return layout(intervals, leftX, rightX);
    }
}
