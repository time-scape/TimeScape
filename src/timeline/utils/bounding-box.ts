export type ScalableRectangle = [
    /** 左上角坐标: [x,y] */
    [number, number],
    /** 右下角坐标: [x,y] */
    [number, number],
    /** 每个方向上是否可缩放: [x,y] */
    [boolean, boolean],
];

export type BoundingBox = {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 在BoundingBox的基础上，判断两个边界是不是被视窗截断 */
export type BoundingBoxWithTruncated = BoundingBox & {
    truncatedX1: boolean;
    truncatedX2: boolean;
}

/**
 * 判断两个矩形需要多大的放大倍数才能不重叠，如果无法不重叠则返回Infinity
 * @param a
 * @param b
 */
export function overlapX(a: ScalableRectangle, b: ScalableRectangle): number{
    if(a[0][1] >= b[1][1] || a[1][1] <= b[0][1]){
        return 0
    }
    let cx1 = (a[0][0] + a[1][0]) / 2
    let cx2 = (b[0][0] + b[1][0]) / 2
    let w1 = Math.abs(a[1][0] - a[0][0])
    let w2 = Math.abs(b[1][0] - b[0][0])

    let dist = Math.abs(cx1 - cx2)

    let result;
    if(a[2][0] && b[2][0]){
        result = (w1 + w2) / 2 > dist + 1e-6 ? Infinity : 0
    }
    else if(a[2][0]){
        let r = 1 - (w1 / 2 / dist)
        result = r <= 0 ? Infinity : w2 / 2 / (r * dist)
    }
    else if(b[2][0]){
        let r = 1 - (w2 / 2 / dist)
        result = r <= 0 ? Infinity : w1 / 2 /(r * dist)
    }
    else{
        result = ((w1 + w2) / 2) / Math.max(Math.abs(cx1 - cx2), 1e-6)
    }
    return result;
}
export function overlapY(a: ScalableRectangle, b: ScalableRectangle): number{
    if(a[0][0] >= b[1][0] || a[1][0] <= b[0][0]){
        return 0
    }

    let cy1 = (a[0][1] + a[1][1]) / 2
    let cy2 = (b[0][1] + b[1][1]) / 2
    let h1 = Math.abs(a[1][1] - a[0][1])
    let h2 = Math.abs(b[1][1] - b[0][1])

    let dist = Math.abs(cy1 - cy2)
    a[2] = a[2] || []
    b[2] = b[2] || []

    let result;
    if(a[2][1] && b[2][1]){
        result = (h1 + h2) / 2 > dist + 1e-6 ? Infinity : 0
    }
    else if(a[2][1]){
        let r = 1 - (h1 / 2 / dist)
        result = r <= 0 ? Infinity : h2 / 2 / (r * dist)
    }
    else if(b[2][1]){
        let r = 1 - (h2 / 2 / dist)
        result = r <= 0 ? Infinity : h1 / 2 /(r * dist)
    }
    else{
        result = ((h1 + h2) / 2) / Math.max(Math.abs(cy1 - cy2), 1e-6)
    }
    return result;
}
