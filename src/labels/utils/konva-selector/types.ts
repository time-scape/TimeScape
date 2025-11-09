import Konva from "konva";

export type KeyType = string | number;
export type BaseType = Konva.Group | Konva.Shape | null;
export type ValueFn<T extends BaseType, Datum, Result> = (
    this: T,
    datum: Datum,
    index: number,
    groups: T[] | ArrayLike<T>,
) => Result;