/**
 * 按照年为单位分箱的直方图
 * @param data 
 * @param accessor 
 * @param binNumber 
 * @param year0 起始年 
 * @param year1 终止年（包含）
 */
export default function histogramYear<T> (
    data: T[],
    accessor: (d: T, i: number) => Date,
    year0: number,
    year1: number,
) {
    const n = data.length;
    if (n === 0) {
        throw new Error("Data length must be > 0");
    }
    const binNumber = year1 - year0 + 1,
          bins = new Array<T[] & { year: number }>(binNumber),
          binIndex = new Array<number>(n);

    for (let i = 0, bin; i < binNumber; ++i) {
        bin = bins[i] = new Array() as any;
        bin.year = year0 + i;
    }
    for (let i = 0, year, index, d; i < n; ++i) {
        d = data[i];
        year = accessor(d, i).getFullYear();
        index = binIndex[i] = year - year0;
        bins[index].push(d);
    }
    
    return bins;
}
