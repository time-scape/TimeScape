import Interval from ".";

/**
 * 区间调度算法，返回最大权重和的区间集合
 * @description 算法的时间复杂度为O(n^2)，空间复杂度为O(n)
 * @param intervals 待求解的区间集合
 * @param selectedIntervals 必须选中的区间集合（用0-1表示。处于性能考虑，如果都选中会出现重叠时并不一定会报错，而是会返回一个错误的结果）
 * @param leftX 布局的最左侧边界
 * @param rightX 布局的最右侧边界
 * @returns 数组，表示每个区间是否被选中（用0-1表示）
 */
export default function schedule(
    intervals: Interval[],
    selectedIntervals: Uint8Array,
    leftX: number = -Infinity,
    rightX: number = Infinity
) {
    /** OPT[i]表示前i个区间的最大权重和 */
    const OPT = new Float64Array(intervals.length);
    /** RIGHT_X[i]表示第i个区间的右端点 */
    const RIGHT_X = new Float64Array(intervals.length);

    /** SELECTED[i]表示第i个区间是否被选中 */
    const SELECTED = new Uint8Array(intervals.length);
    /** P[i]表示当前区间前一个访问的区间（如果没有则为-1） */
    const PREV = new Int32Array(intervals.length);

    /** 初始化边界条件 */
    RIGHT_X[0] = Math.max(leftX, intervals[0].leftX) + intervals[0].width;
    let s = RIGHT_X[0] <= Math.min(rightX, intervals[0].rightX);
    OPT[0] = s ? intervals[0].weight : -Infinity;
    SELECTED[0] = s ? 1 : 0;
    PREV[0] = -1;

    /** 动态规划 */
    for (let i = 1; i < intervals.length; i++) {
        /** 前i个区间所能达到的最大权重和（初始时只选中当前区间） */
        let opt = intervals[i].weight;
        /** 当前区间的右端点（初始值表示左侧只有边界leftX阻挡，而没有其他区间） */
        let right_x = Math.max(leftX, intervals[i].leftX) + intervals[i].width;
        /** 上一个紧挨的区间的下标（初始值-1表示前序没有区间） */
        let idx = -1;
        /** 是否选中当前区间 */
        let s = 1;

        /**
         * case1：选中当前区间。则遍历所有可能的前序区间
         */
        for (let j = i - 1; j >= 0; j--) {
            let r_x = Math.max(RIGHT_X[j], intervals[i].leftX) + intervals[i].width;
            if (r_x <= Math.min(rightX, intervals[i].rightX)) {
                if (selectedIntervals[j] || OPT[j] + intervals[i].weight > opt) {
                    opt = OPT[j] + intervals[i].weight;
                    right_x = r_x;
                    idx = j;
                    s = 1;
                }
            }
            if (selectedIntervals[j]) break;
        }

        /**
         * case2：不选中当前区间。前提是当前区间不是强制选中，另需满足下面条件之一：
         * （1）不选中这个区间可以得到更高的收益OPT[i-1]
         * （2）当前区间的右端点超出了右边界rightX（强制选中的情况下并不会检查这一点）
         */
        if (selectedIntervals[i] === 0 && (OPT[i - 1] > opt || right_x > rightX)) {
            opt = OPT[i - 1];
            right_x = RIGHT_X[i - 1];
            idx = i - 1;
            s = 0;
        }

        /** 将计算出的值更新到当前区间的状态中 */
        RIGHT_X[i] = right_x;
        OPT[i] = opt;
        SELECTED[i] = s;
        PREV[i] = idx;
    }

    /** 回溯结果 */
    const result = new Uint8Array(intervals.length);
    let i = intervals.length - 1;
    while (i >= 0) {
        if (SELECTED[i]) {
            // intervals[i].cx2 = RIGHT_X[i] - intervals[i].width / 2;
            result[i] = 1;
        }
        i = PREV[i];
    }

    return result;
}