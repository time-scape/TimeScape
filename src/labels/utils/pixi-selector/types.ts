import * as PIXI from "pixi.js";

export type KeyType = string | number;
export type BaseType = PIXI.Container<any> | null;
export type ValueFn<T extends BaseType, Datum, Result> = (
    this: T,
    datum: Datum,
    index: number,
    groups: T[] | ArrayLike<T>,
) => Result;