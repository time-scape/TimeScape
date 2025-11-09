import { overlapX, overlapY, ScalableRectangle } from "../utils/bounding-box";
import TimelineLabel from "./timeline-label";
import {ByteMatrix, FloatMatrix} from "../utils/Matrix";
import UnionFind from "../utils/UnionFind";
import {ScaleTime} from "../types";


type LabelVisibleThresholdAttributes = Pick<LabelVisibleThreshold,
    "debug" | "selectedLabels" | "scale" | "kRange" | "borders" | "weight" | "layer" | "rows" | "row">;

type Row = number[] & { row?: number; id: number; };

export default class LabelVisibleThreshold {
    /** 需要计算的标签列表 */
    labels: TimelineLabel[] = [];
    /** 一定要选中的标签集合 */
    selectedLabels: number[] = [];
   /** 时间轴初始比例尺 */
    scale!: ScaleTime;
    /** 缩放比例范围 */
    kRange: [number, number] = [0, 1];
    /** 是否开启debug模式 */
    debug: boolean = false;
    /** 边框 */
    borders: TimelineLabel[] = [];
    /** 权重函数，决定标签的权重 */
    weight: (label: TimelineLabel) => number = (label) => label.attr("importance");
    /** 分层函数，决定标签在第几层 */
    layer: (label: TimelineLabel) => number = () => 0;
    /** 布局行数（两个数分别对应时间轴上方和时间轴下方） */
    rows: [number, number] = [0, 1];
    /** 指定标签在第几行的函数（如果返回0则会自动分配） */
    row: (label: TimelineLabel) => number = () => 0;

    private constructor() { }
    static create() {
        return new LabelVisibleThreshold();
    }

    data(): TimelineLabel[];
    data(labels: TimelineLabel[]): this;
    data(labels?: TimelineLabel[]) {
        if (labels === undefined) return this.labels;
        this.labels = labels.slice();
        return this;
    }

    attr<T extends keyof LabelVisibleThresholdAttributes>(property: T, value: this[T]): this;
    attr<T extends keyof LabelVisibleThresholdAttributes>(property: T): this[T];
    attr<T extends keyof LabelVisibleThresholdAttributes>(property: T, value?: this[T]) {
        if (value === undefined) return this[property];
        this[property] = value;
        return this;
    }

    private getRows(rowNumber: [number, number], labels: TimelineLabel[], kij: FloatMatrix) {
        let idCounter: number = 0;

        // const weights = new Float64Array(labels.length).fill(0).map((_, i) => this.weight(labels[i]));
        const [ rowIdx0, rowIdx1 ] = rowNumber;
        if (rowIdx0 + rowIdx1 === 1) {
            const row: Row = labels.map((_, i) => i) as any;
            row.id = idCounter++;
            row.row = rowIdx0 === 1 ? -1 : 1;
            return [
                row
            ];
        }

        const totalLayerLength = rowIdx0 + rowIdx1 + 1;
        const rows = new Array(totalLayerLength).fill(0)
            .map<Row>((_, i) => {
                const list = [] as any;
                list.row = i - rowIdx0;
                list.id = idCounter++;
                return list;
            });

        for (let i = 0; i < labels.length; ++i) {
            const label = labels[i];
            let row = this.row(label);
            if (!Number.isInteger(row) || row < -rowIdx0 || row > rowIdx1) {
                row = 0;
            }
            rows[row + rowIdx0].push(i);
        }

        const groups: Row[] = [
            ...rows.slice(0, rowIdx0),
            ...rows.slice(rowIdx0 + 1),
            ...rows[rowIdx0].map(l => {
                const list = [l] as any;
                list.id = idCounter++;
                return list;
            })
        ];

        const overlapMap = new Map<string, number>();
        const getOverlap = (row1: Row, row2: Row) => {
            const id = `${row1.id}-${row2.id}`;
            let overlap = overlapMap.get(id);
            if (overlap !== undefined) {
                return overlap;
            }
            overlap = 0;
            for (let i = 0; i < row1.length; ++i) {
                for (let j = 0; j < row2.length; ++j) {
                    overlap = Math.max(kij.get(row1[i], row2[j]), overlap);
                }
            }
            overlapMap.set(id, overlap);
            return overlap;
        }

        const merge = (row1: Row, row2: Row) => {
            if (row1.row !== undefined && row2.row !== undefined) {
                return null;
            }
            else if (row1.row !== undefined) {
                row1.push(...row2);
                row1.id = idCounter++;
                return [row1, 0];
            }
            else if (row2.row !== undefined) {
                row2.push(...row1);
                row2.id = idCounter++;
                return [row2, 1];
            }
            row1.push(...row2);
            row1.id = idCounter++;
            return [row1, 0];
        }


        while (groups.length > totalLayerLength - 1) {
            let minOverlap: number | null = null;
            let group1: number = -1;
            let group2: number = -1;
            for (let i = 0; i < groups.length; ++i) {
                const isRow1 = groups[i].row !== undefined;
                for (let j = i + 1; j < groups.length; ++j) {
                    const isRow2 = groups[j].row !== undefined;
                    if (isRow1 && isRow2) continue;
                    const overlap = getOverlap(groups[i], groups[j]);
                    if (minOverlap === null) {
                        minOverlap = overlap;
                        group1 = i;
                        group2 = j;
                    }
                    else if (overlap < minOverlap) {
                        minOverlap = overlap;
                        group1 = i;
                        group2 = j;
                    }
                }
            }
            if (group1 === -1 || group2 === -1) {
                throw new Error("Invalid group");
            }
            let result = merge(groups[group1], groups[group2]);
            if (result === null) {
                throw new Error("Invalid group");
            }
            if (result[1] === 0) {
                groups.splice(group2, 1);
            }
            else {
                groups.splice(group1, 1);
            }
        }
        return groups;
    }
    /**
     * 边界框
     * 确定选中的标签
     * 待选中的标签
     * 分层函数（默认将所有标签分到同一层，主要是为了兼容硬约束1）
     * 布局的行数（目前主要是单行和两行）
     */
    private calculateVisibleThreshold(
        labelList: TimelineLabel[],
        labelIndices: number[],
        labelSelected: number[],
        kij: FloatMatrix,
    ) {
        const kRange = this.kRange;
        const debug = this.debug;

        const visibleK: [number, number][] = [];

        const labels = labelIndices.map(i => labelList[i]);
        labelSelected = labelSelected
            .map(v => labelIndices.findIndex(i => i === v))
            .filter(i => i !== -1);
        kij = kij.pick(labelIndices, labelIndices);
        const reverseMap = new Map<number, [number, number][]>();
        for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                let v = kij.get(i, j);
                let list = reverseMap.get(v);
                if(list === undefined) {
                    list = [];
                    reverseMap.set(v, list);
                }
                list.push([i, j]);
            }
        }

        const kij_sorted = Array.from(new Set(kij.value))
            .filter(v => v >= kRange[0] && v <= kRange[1]);
        if (kij_sorted.find(v => v === kRange[0]) === undefined) {
            kij_sorted.push(kRange[0]);
        }
        kij_sorted.sort((a, b) => a - b);

        // 第i个label与第j个label是否重叠，重叠为1，不重叠为0。该矩阵会构成一个图
        const overlap_matrix: ByteMatrix = new ByteMatrix(labels.length, labels.length);
        for (let i = 0; i < labels.length; i++) {
            overlap_matrix.set(i, i, 1);
            for (let j = i + 1; j < labels.length; j++) {
                const v = kij.get(i, j) > kij_sorted[0] ? 1 : 0;
                overlap_matrix.set(i, j, v);
                overlap_matrix.set(j, i, v);
            }
        }

        // 第i个label是否已经遍历过
        const traversed = new Uint8Array(labels.length).fill(0);
        for (let i = 0; i < labelSelected.length; ++i) {
            traversed[labelSelected[i]] = 1;
        }

        // 第i个label的权重
        const weights = new Float64Array(labels.length).fill(0)
            .map((_, i) => this.weight(labels[i]));

        // 当前第i个label是否被选中
        const current_selected = new Uint8Array(labels.length).fill(0);
        for (let i = 0; i < labelSelected.length; ++i) {
            current_selected[labelSelected[i]] = 1;
        }

        for (let ki = 0; ki < kij_sorted.length; ++ki) {
            const k = kij_sorted[ki];
            /** 初始化参数 */
            traversed.fill(0);

            if (ki > 0) {
                const k_prev = kij_sorted[ki];
                const removed_edges = reverseMap.get(k_prev);
                if (removed_edges !== undefined)
                    for(let [i, j] of removed_edges) {
                        overlap_matrix.set(i, j, 0);
                        overlap_matrix.set(j, i, 0);
                    }
            }

            /** 使用并查集对不同的连通子图节点进行分组 */
            const unionFind = UnionFind.create(labels.length);
            for (let i = 0; i < labels.length; i++) {
                for (let j = i + 1; j < labels.length; j++) {
                    if (overlap_matrix.get(i, j) === 1) {
                        unionFind.union(i, j);
                    }
                }
            }

            const selected: number[] = [];
            for (let i = 0; i < labels.length; i++) {
                if (traversed[i]) continue;
                traversed[i] = 1;
                let subgraph = [i];
                for (let j = i + 1; j < labels.length; j++) {
                    if (unionFind.connected(i, j)) {
                        traversed[j] = 1;
                        subgraph.push(j);
                    }
                }
                if (subgraph.length === 1) {
                    selected.push(i);
                }
                else {
                    const subgraph_selected = this.traverse(subgraph, weights, overlap_matrix, subgraph.map(i => current_selected[i]));
                    selected.push(...subgraph_selected);
                }
            }

            selected.forEach(i => {
                if (current_selected[i] === 0) {
                    const label = labels[i];
                    let maxK = Math.min(kRange[1], Math.max(k, label.attr('maxK')));
                    let minK = Math.max(k, kRange[0], label.attr('minK'));

                    if(label.children.length > 0) {
                        throw new Error ("暂不支持children");
                    }
                    visibleK[i] = [minK, maxK];
                    // label.visibleK = [minK, maxK];
                    current_selected[i] = 1;
                }
            });
        }
        return visibleK;
    }

    calculate() {

        const borders = this.borders;
        const labels = borders.concat(this.labels);
        const scale = this.scale;

        /** 计算重叠图以及反向映射 */
        const kij: FloatMatrix = new FloatMatrix(labels.length, labels.length);
        const boundingBoxes: ScalableRectangle[] = labels.map(label=>label.boundingBox(scale));
        const reverseMap = new Map<number, [number, number][]>();
        for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                let v = overlapX(boundingBoxes[i], boundingBoxes[j]);
                kij.set(i, j, v);
                kij.set(j, i, v);

                if (v === 0) continue;

                let list = reverseMap.get(v);
                if(list === undefined) {
                    list = [];
                    reverseMap.set(v, list);
                }
                list.push([i, j]);
            }
        }

        const rowNumber: [number, number] = [0, 0];
        const labelMatrix = kij.slice(borders.length, labels.length, borders.length, labels.length);
        const borderIndices = borders.map((_, i) => i);
        labels.forEach(label => label.visibleKList = []);


        while (true) {
            if (rowNumber[1] < this.rows[1]) {
                rowNumber[1] += 1;
                const rows = this.getRows(rowNumber, this.labels, labelMatrix);
                rows.forEach(row => {
                    for (let i = 0; i < row.length; ++i) {
                        row[i] += borders.length;
                    }
                });
                for (let row of rows) {
                    const visibleK = this.calculateVisibleThreshold(
                        labels,
                        borderIndices.concat(row),
                        borderIndices,
                        kij,
                    ).slice(borders.length);
                    row.forEach((i, j) => {
                        labels[i].visibleKList.push([row.row!, ...visibleK[j]]);
                    });

                    if (rowNumber[0] === 0 && rowNumber[1] === 1) {
                        row.forEach((i, j) => {
                            labels[i].visibleK = visibleK[j];
                        });
                    }
                }
            }

            if (rowNumber[0] < this.rows[0]) {
                rowNumber[0] += 1;
                const rows = this.getRows(rowNumber, this.labels, labelMatrix);
                rows.forEach(row => {
                    for (let i = 0; i < row.length; ++i) {
                        row[i] += borders.length;
                    }
                });
                for (let row of rows) {
                    const visibleK = this.calculateVisibleThreshold(
                        labels,
                        borderIndices.concat(row),
                        borderIndices,
                        kij,
                    ).slice(borders.length);
                    row.forEach((i, j) => {
                        labels[i].visibleKList.push([row.row!, ...visibleK[j]]);
                    });
                }
            }

            if (rowNumber[0] >= this.rows[0] && rowNumber[1] >= this.rows[1]) {
                break;
            }
        }

        // console.log(labels.map(label => label.visibleKList));

        // this.getRows(this.rows, this.labels, kij.slice(borders.length, labels.length, borders.length, labels.length));
        //
        // const visibleK = this.calculateVisibleThreshold(
        //     labels,
        //     labels.map((_, i) => i),
        //     borders.map((_, i) => i),
        //     kij,
        // );
        //
        // labels.forEach((label, i) => {
        //     label.visibleK = visibleK[i];
        // });
    }

    /**
     * 遍历连通子图，并在不违反重叠约束的情况下选出最高权重的标签组合（最大独立集问题）
     * 使用暴力搜索的方式，时间复杂度是指数级的，但是在实际使用中延迟是可接受的
     * @param subgraph 当前遍历的子图（下标集合）
     * @param weights 标签权重
     * @param overlap_matrix 整个图的重叠矩阵
     * @param selected 已经选中的节点（下标集合）
     */
    traverse(subgraph: number[], weights: Float64Array, overlap_matrix: ByteMatrix, selected?: number[]) {
        const labels = this.borders.concat(this.labels);
        if (this.debug && subgraph.find(i => weights[i] === 1000)) {
            console.log("traverse", subgraph.map(d => labels[d].description));
        }

        let weight = -Infinity;
        const final_selected = new Uint8Array(subgraph.length).fill(0);
        const selectables = new Uint8Array(subgraph.length).fill(1);

        const updateSelectables = (selectedIdx: number, selectables: Uint8Array) => {
            for (let i = 0; i < subgraph.length; ++i) {
                if (overlap_matrix.get(selectedIdx, subgraph[i]) === 1) {
                    selectables[i] = 0;
                }
            }
        }
        const _traverse = (
            i: number, // 当前遍历的节点
            selected: number[], // 已经选中的节点
            selectables: Uint8Array, // 可以选中的节点
        ) => {
            if (i >= subgraph.length) {
                const w = selected.reduce((sum, v, i) => sum + v * weights[subgraph[i]], 0);

                if (this.debug && subgraph.find(i => weights[i] === 1000)) {
                    console.log("pick", w, subgraph.filter((_, i) => selected[i] === 1).map(d => labels[d].description));
                }
                if (w > weight) {
                    weight = w;
                    final_selected.set(selected);
                }
                return;
            }
            if (selectables[i] === 1 && selected[i] === 0) {
                selected[i] = 1;
                const old_selectables = selectables.slice();
                updateSelectables(subgraph[i], selectables);
                _traverse(i + 1, selected, selectables);
                selected[i] = 0;
                selectables.set(old_selectables);
            }
            _traverse(i + 1, selected, selectables);
        }

        if (selected === undefined) {
            selected = new Array(subgraph.length).fill(0);
        }
        else {
            for (let i = 0; i < subgraph.length; i++) {
                if (selected[i] === 1) {
                    updateSelectables(subgraph[i], selectables);
                }
            }
        }

        if (this.debug && subgraph.find(i => weights[i] === 1000)) {
            console.log("init", selectables, selected);
        }

        _traverse(0, selected, selectables);

        if (this.debug && subgraph.find(i => weights[i] === 1000)) {
            console.log("final", weight, subgraph.filter((_, i) => final_selected[i] === 1).map(d => labels[d].description));
        }

        return subgraph.filter((_, i) => final_selected[i] === 1);
    }
}