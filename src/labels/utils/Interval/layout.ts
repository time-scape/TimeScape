import Interval from ".";

/**
 * 布局优化算法
 * @example
 * // 初始化后紧接着调用solve方法，结果直接写入每个interval的cx字段，没有返回值
 * Layout.init(intervals, leftX, rightX).solve();
 */
class Layout {
    /** 待布局的标签集合，需要确保这些标签可以布局得下（否则算法会报错） */
    intervals!: Interval[];
    /** 布局的最左侧边界 */
    leftX!: number;
    /** 布局的最右侧边界 */
    rightX!: number;

    /** 每个标签的平衡位置 */
    CXs!: Float64Array;
    /** 每个标签允许向左偏移的最大值 */
    DLEFT!: Float64Array;
    /** 每个标签允许向右偏移的最大值 */
    DRIGHT!: Float64Array;
    /** 第i个表示 $ \sum_{j=1}^{i}(l_j + l_{j+1}) $ */
    L!: Float64Array;
    /** 第i个表示 $ \sum_{j=1}^{i} d_j $ */
    D!: Float64Array;
    /** 第i个表示 $ \sum_{j=1}^{i} w_j $ */
    W!: Float64Array;
    private constructor(intervals: Interval[], leftX: number, rightX: number) {
        this.intervals = intervals.slice().sort((a, b) => a.cx - b.cx);
        this.leftX = leftX;
        this.rightX = rightX;
        this.preprocess();
    }

    /**
     * 初始化布局优化算法
     * @param intervals 待布局的标签集合，需要确保这些标签可以布局得下（否则算法会报错）
     * @param leftX 布局的最左侧边界
     * @param rightX 布局的最右侧边界
     */
    static init(intervals: Interval[], leftX: number, rightX: number) {
        return new Layout(intervals, leftX, rightX);
    }

    /**
     * 优化标签的布局，最终得到的布局会直接写入到各个interval.cx2中
     * @description 时间复杂度为O(n^2)，空间复杂度为O(n)
     */
    solve() {
        const intervals = this.intervals;
        const L = this.L;

        if (intervals.length === 0) {
            return;
        }

        const groups: [number, number][] = [];
        let group: [number, number] = [0, 0];
        intervals[0].cx2 = Math.max(
            this.leftX + intervals[0].width / 2,
            Math.min(intervals[0].cx, this.rightX - intervals[0].width / 2)
        );

        for (let i = 1; i < this.intervals.length; ++i) {
            if (intervals[i].cx - intervals[i].width / 2 > intervals[group[1]].cx2! + intervals[group[1]].width / 2) {
                groups.push(group);
                group = [i, i];
            }
            else {
                group[1] = i;
            }
            let x = this.optimize(...group);

            let lastGroup;
            while((lastGroup = groups[groups.length - 1]) !== undefined) {
                let rightInterval = intervals[lastGroup[1]];
                let leftInterval = intervals[group[0]];

                if (rightInterval.cx2! + rightInterval.width / 2 + leftInterval.width / 2 <= x) {
                    break;
                }

                group = [lastGroup[0], group[1]];
                x = this.optimize(...group);
                groups.pop();
            }

            for (let j = group[0]; j <= group[1]; ++j) {
                intervals[j].cx2 = x + this.getAcc(L, group[0], j - 1);
            }
        }
    }

    /**
     * 算法预处理
     * @description 时间复杂度为O(n)，空间复杂度为O(n)
     */
    private preprocess() {
        const intervals = this.intervals;
        this.CXs = new Float64Array(intervals.length);
        this.DLEFT = new Float64Array(intervals.length);
        this.DRIGHT = new Float64Array(intervals.length);
        this.L = new Float64Array(intervals.length);
        this.D = new Float64Array(intervals.length);
        this.W = new Float64Array(intervals.length);

        for (let i = 0; i < intervals.length; ++i) {
            const interval = intervals[i];
            this.CXs[i] = interval.cx;
            const delta = (interval.rightX - interval.leftX - interval.width) / 2;
            this.DLEFT[i] = Math.min(delta, this.CXs[i] - interval.width / 2 - this.leftX);
            this.DRIGHT[i] = Math.min(delta, this.rightX - this.CXs[i] - interval.width / 2);
            this.W[i] = (this.W[i - 1] ?? 0) + interval.weight;
        }
        for (let i = 0; i < intervals.length - 1; ++i) {
            const interval = intervals[i];
            this.L[i] = (this.L[i - 1] ?? 0) + (interval.width + intervals[i + 1].width) / 2;
            this.D[i] = this.CXs[i + 1] - this.CXs[0];
        }
    }

    /**
     * 优化[p1, p2]区间的布局，将其视为互相影响的弹簧系统
     * @description 时间复杂度为O(n)，空间复杂度为O(1)
     * @param p1
     * @param p2
     * @returns 优化后的p1的平衡位置（中心横坐标）
     */
    private optimize(p1: number, p2: number) {
        const intervals = this.intervals;
        const CXs = this.CXs;
        /** 特殊情况：只有一个标签 */
        if (p1 === p2) {
            return Math.min(Math.max(this.leftX + intervals[p1].width / 2, CXs[p1]), this.rightX - intervals[p1].width / 2);
        }

        const DLEFT = this.DLEFT;
        const DRIGHT = this.DRIGHT;
        const L = this.L;
        const D = this.D;
        const W = this.W;

        /** 找到因为左右偏移导致的约束条件，进而修改最优解 */
        let min = -Infinity;
        let max = Infinity;
        for (let i = p1; i <= p2; ++i) {
            const cx = CXs[p1] - this.getAcc(L, p1, i - 1) + this.getAcc(D, p1, i - 1)
            min = Math.max(min, cx - DLEFT[i], this.leftX + intervals[i].width / 2);
            max = Math.min(max, cx + DRIGHT[i], this.rightX - intervals[i].width / 2);
        }
        if (min > max) {
            // console.warn("No solution", min, max);
            // throw new Error('No solution');
        }

        /** 计算最优的平衡位置 */
        let acc = 0;
        for (let i = p1; i <= p2; ++i) {
            const interval = intervals[i];
            acc += interval.weight * (
                + this.getAcc(D, p1, i - 1)
                - this.getAcc(L, p1, i - 1)
            );
        }
        acc /= this.getAcc(W, p1, p2);
        let x = CXs[p1] + acc;

        if (min <= max) {
            x = Math.min(Math.max(x, min), max);
        }
        return x;
    }

    /**
     * 获取累加数组的区间和
     * @param acc 累加数组（第i项实际表示的是前i项的和）
     * @param p1 区间左端点
     * @param p2 区间右端点
     * @private
     */
    private getAcc(acc: Float64Array, p1: number, p2: number) {
        if (p1 > p2) return 0;
        return ((acc[p2] ?? 0) - (acc[p1 - 1] ?? 0));
    }
}

export default function layout(intervals: Interval[], leftX: number, rightX: number) {
    return Layout.init(intervals, leftX, rightX).solve();
}
