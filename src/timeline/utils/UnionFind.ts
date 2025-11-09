/**
 * 并查集
 */
export default class UnionFind {
    length: number = 0;
    fa!: Int32Array;
    private constructor(length: number) {
        this.length = length;
        this.init();
    }
    static create(length: number) {
        return new UnionFind(length);
    }

    init() {
        this.fa = new Int32Array(this.length).fill(0).map((_, i) => i);
    }

    find(i: number): number {
        if (this.fa[i] === i) return i;
        return this.fa[i] = this.find(this.fa[i]);
    }

    union(i: number, j: number) {
        this.fa[this.find(i)] = this.find(j);
    }

    connected(i: number, j: number) {
        return this.find(i) === this.find(j);
    }

    flatten() {
        const fa = this.fa;
        for (let i = 0; i < fa.length; i++) {
            fa[i] = this.find(i);
        }
        return fa;
    }
}