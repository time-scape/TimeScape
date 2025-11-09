import Label from "./label";

type BBoxFunction = (label: Label) => {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}[];

/** 基于Bitmap的采样方法 */
export default class Sampling {

    /** 画布x和y值的范围，需要确保能够容纳下所有的标签 */
    xRange: [number, number];
    yRange: [number, number];

    /** 横向和纵向的网格数量 */
    grid: [number, number];

    /** 允许同时重叠的标签数量，默认2 */
    maxOverlap: number;

    /** 根据x坐标获得网格x索引 */
    private getGridX(x: number) {
        return Math.floor((x - this.xRange[0]) / (this.xRange[1] - this.xRange[0]) * this.grid[0]);
    }
    /** 根据y坐标获得网格y索引 */
    private getGridY(y: number) {
        return Math.floor((y - this.yRange[0]) / (this.yRange[1] - this.yRange[0]) * this.grid[1]);
    }

    private gridArray: Uint8Array[];
    constructor(xRange: [number, number], yRange: [number, number], grid: [number, number], maxOverlap: number = 2) {
        this.xRange = xRange;
        this.yRange = yRange;
        this.grid = grid;
        this.gridArray = new Array(maxOverlap).fill(0).map(() => new Uint8Array(grid[0] * grid[1]));
        this.maxOverlap = maxOverlap;
    }

    /**
     * 应用基于bitmap的采样算法
     * @param labels 标签列表
     * @param bboxFunction 数组形式，表示如何计算每个标签的边界框（一个标签可以有多个边界框）
     * @param maxOverlap 允许同时重叠的标签数量，默认2
     * @returns 
     */
    solve(labels: Label[], bboxFunction: BBoxFunction) {
        const grid = this.grid;
        const gridArray = this.gridArray;
        const maxOverlap = this.maxOverlap;
        gridArray.forEach(arr => arr.fill(0));

        // TODO: 需要给标签进行适当的排序

        const result: Label[] = [];
        const levels: number[] = [];

        labels.forEach((label) => {
            const bboxes = bboxFunction(label).map((res) => {
                return {
                    x1: Math.max(Math.min(this.getGridX(res.x1), grid[0] - 1), 0),
                    y1: Math.max(Math.min(this.getGridY(res.y1), grid[1] - 1), 0),
                    x2: Math.max(Math.min(this.getGridX(res.x2), grid[0] - 1), 0),
                    y2: Math.max(Math.min(this.getGridY(res.y2), grid[1] - 1), 0),
                }
            });

            let layer = -1;
            for (let l = 0, arr, overlap; l < maxOverlap; l++) {
                arr = gridArray[l];
                overlap = false;
                loop: for (const { x1, y1, x2, y2 } of bboxes) {
                    for (let x = x1; x <= x2; x++) {
                        for (let y = y1; y <= y2; y++) {
                            const idx = y * grid[0] + x;
                            if (arr[idx] > 0) {
                                overlap = true;
                                break loop;
                            }
                        }
                    }
                }
                if (!overlap) {
                    layer = l;
                    break;
                }
            }
            if (layer === -1) {
                return;
            }

            const arr = gridArray[layer];
            for (const { x1, y1, x2, y2 } of bboxes) {
                for (let x = x1; x <= x2; x++) {
                    for (let y = y1; y <= y2; y++) {
                        const idx = y * grid[0] + x;
                        arr[idx] = 1;
                    }
                }
            }
            result.push(label);
            levels.push(layer);
        });

        return [result, levels] as [Label[], number[]];
    }
}