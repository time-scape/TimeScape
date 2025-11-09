abstract class Matrix<CLASS, T> {
    abstract readonly value: T;
    abstract readonly columnCount: number;
    abstract readonly rowCount: number;

    abstract get(row: number, column: number): number;
    abstract getRow(row: number): T;
    abstract getColumn(column: number): T;
    abstract set(row: number, column: number, value: number): this;
    abstract setRow(row: number, value: ArrayLike<number>): this;
    abstract setColumn(column: number, value: ArrayLike<number>): this;
    abstract slice(rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): CLASS;
    abstract sliceRow(rowStart: number, rowEnd: number): CLASS;
    abstract sliceColumn(columnStart: number, columnEnd: number): CLASS;
}

export class ByteMatrix implements Matrix<ByteMatrix, Uint8Array> {

    readonly value!: Uint8Array;
    readonly columnCount!: number;
    readonly rowCount!: number;

    constructor(matrix: ByteMatrix);
    constructor(row: number, column: number);
    constructor(v1: number | ByteMatrix, v2?: number) {
        if (typeof v1 === 'number' && typeof v2 === 'number') {
            this.value = new Uint8Array(v1 * v2);
            this.rowCount = v1;
            this.columnCount = v2;
        }
        else if (v1 instanceof ByteMatrix) {
            this.value = v1.value.slice(0);
            this.rowCount = v1.rowCount;
            this.columnCount = v1.columnCount;
        }
        else {
            throw new Error('Invalid arguments');
        }
    }

    toArray(): number[][] {
        const result = new Array(this.rowCount);
        for (let i = 0; i < this.rowCount; i++) {
            result[i] = new Array(this.columnCount);
            for (let j = 0; j < this.columnCount; j++) {
                result[i][j] = this.value[i * this.columnCount + j];
            }
        }
        return result;
    }

    get(row: number, column: number): number {
        return this.value[row * this.columnCount + column];
    }

    getRow(row: number): Uint8Array {
        return this.value.slice(row * this.columnCount, (row + 1) * this.columnCount);
    }

    getColumn(column: number): Uint8Array {
        const result = new Uint8Array(this.rowCount);
        for (let i = 0; i < this.rowCount; i++) {
            result[i] = this.value[i * this.columnCount + column];
        }
        return result;
    }

    set(row: number, column: number, value: number): this {
        this.value[row * this.columnCount + column] = value;
        return this;
    }

    setRow(row: number, value: Uint8Array): this {
        this.value.set(value, row * this.columnCount);
        return this;
    }

    setColumn(column: number, value: Uint8Array): this {
        for (let i = 0; i < this.rowCount; i++) {
            this.value[i * this.columnCount + column] = value[i];
        }
        return this;
    }

    slice(rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): ByteMatrix {
        const row = rowEnd - rowStart;
        const column = columnEnd - columnStart;
        const result = new ByteMatrix(row, column);
        for (let i = 0; i < row; i++) {
            const offset = (i + rowStart) * this.columnCount;
            result.value.set(
                this.value.slice(offset + columnStart, offset + columnEnd),
                i * column
            );
        }
        return result;
    }

    pick(rowIndices: number[], columnIndices: number[]): ByteMatrix {
        const row = rowIndices.length;
        const column = columnIndices.length;
        const result = new ByteMatrix(row, column);
        for (let i = 0; i < row; i++) {
            const offset = rowIndices[i] * this.columnCount;
            result.value.set(
                this.value.slice(offset).filter((_, j) => columnIndices.includes(j)),
                i * column
            );
        }
        return result;
    }

    sliceRow(rowStart: number, rowEnd: number): ByteMatrix {
        return this.slice(rowStart, rowEnd, 0, this.columnCount);
    }

    sliceColumn(columnStart: number, columnEnd: number): ByteMatrix {
        return this.slice(0, this.rowCount, columnStart, columnEnd);
    }
}

export class FloatMatrix implements Matrix<FloatMatrix, Float64Array> {

    readonly value!: Float64Array;
    readonly columnCount!: number;
    readonly rowCount!: number;

    constructor(matrix: FloatMatrix);
    constructor(row: number, column: number);
    constructor(v1: number | FloatMatrix, v2?: number) {
        if (typeof v1 === 'number' && typeof v2 === 'number') {
            this.value = new Float64Array(v1 * v2);
            this.rowCount = v1;
            this.columnCount = v2;
        }
        else if (v1 instanceof FloatMatrix) {
            this.value = v1.value.slice(0);
            this.rowCount = v1.rowCount;
            this.columnCount = v1.columnCount;
        }
        else {
            throw new Error('Invalid arguments');
        }
    }

    toArray(): number[][] {
        const result = new Array(this.rowCount);
        for (let i = 0; i < this.rowCount; i++) {
            result[i] = new Array(this.columnCount);
            for (let j = 0; j < this.columnCount; j++) {
                result[i][j] = this.value[i * this.columnCount + j];
            }
        }
        return result;
    }

    get(row: number, column: number): number {
        return this.value[row * this.columnCount + column];
    }

    getRow(row: number): Float64Array {
        return this.value.slice(row * this.columnCount, (row + 1) * this.columnCount);
    }

    getColumn(column: number): Float64Array {
        const result = new Float64Array(this.rowCount);
        for (let i = 0; i < this.rowCount; i++) {
            result[i] = this.value[i * this.columnCount + column];
        }
        return result;
    }

    set(row: number, column: number, value: number): this {
        this.value[row * this.columnCount + column] = value;
        return this;
    }

    setRow(row: number, value: Float64Array): this {
        this.value.set(value, row * this.columnCount);
        return this;
    }

    setColumn(column: number, value: Float64Array): this {
        for (let i = 0; i < this.rowCount; i++) {
            this.value[i * this.columnCount + column] = value[i];
        }
        return this;
    }

    slice(rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): FloatMatrix {
        const row = rowEnd - rowStart;
        const column = columnEnd - columnStart;
        const result = new FloatMatrix(row, column);
        for (let i = 0; i < row; i++) {
            const offset = (i + rowStart) * this.columnCount;
            result.value.set(
                this.value.slice(offset + columnStart, offset + columnEnd),
                i * column
            );
        }
        return result;
    }

    pick(rowIndices: number[], columnIndices: number[]): FloatMatrix {
        const row = rowIndices.length;
        const column = columnIndices.length;
        const result = new FloatMatrix(row, column);
        for (let i = 0; i < row; i++) {
            const offset = rowIndices[i] * this.columnCount;
            const slice = this.value.slice(offset);
            result.value.set(
                columnIndices.map(j => slice[j]),
                i * column
            );
        }
        return result;
    }

    sliceRow(rowStart: number, rowEnd: number): FloatMatrix {
        return this.slice(rowStart, rowEnd, 0, this.columnCount);
    }

    sliceColumn(columnStart: number, columnEnd: number): FloatMatrix {
        return this.slice(0, this.rowCount, columnStart, columnEnd);
    }
}