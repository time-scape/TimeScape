/**
 * @typedef {Object} JOIN
 * @property {number[]} enter 新增的元素在new_data中的索引
 * @property {number[]} update 更新的元素在new_data中的索引
 * @property {number[]} exit 删除的元素在old_data中的索引
 */

/**
 * 比较两个数据集，返回新增、更新和删除的数据索引
 * @param old_data 旧数据
 * @param new_data 新数据
 * @param key 用于比较数据的key函数，返回数据的唯一标识符
 * @returns {JOIN} 返回一个对象，包含enter、update和exit三个属性
 * 
 */
export function join<DATA>(
    old_data: readonly DATA[],
    new_data: readonly DATA[],
    key: (datum: DATA, i: number) => number | string,
): {
    enter: number[]; // 新增的元素在new_data中的索引
    update: number[]; // 更新的元素在new_data中的索引
    exit: number[]; // 删除的元素在old_data中的索引
} {
    const oldMap = new Map<ReturnType<typeof key>, number>();
    old_data.forEach((d, i) => oldMap.set(key(d, i), i));
    /** 旧数据每一项是否保留 */
    const retain = new Uint8Array(old_data.length);
    /** 新数据每一项是否是新增的 */
    const newin = new Uint8Array(new_data.length);
    new_data.forEach((d, i) => {
        const id = key(d, i);
        if (oldMap.has(id)) {
            const j = oldMap.get(id)!;
            retain[j] = 1;
        }
        else {
            newin[i] = 1;
        }
    });
    return {
        enter: Array.from(newin.keys()).filter(i => newin[i] === 1),
        update: Array.from(newin.keys()).filter(i => newin[i] === 0),
        exit: Array.from(retain.keys()).filter(i => retain[i] === 0),
    };
}