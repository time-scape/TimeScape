import Label from "../timeline-label";

export type LabelBuilderAttributes = Pick<LabelBuilder<any>, "time" | "offsetX" | "offsetY" | "importance">;
export abstract class LabelBuilder<T> {
    time!: [Date, Date] | Date;
    offsetX: number = 0;
    offsetY: number = 0;
    importance: number = 1;
    debug: boolean = true;

    abstract attr<K extends keyof T>(property: K, value: T[K]): this;
    abstract attr<K extends keyof T>(property: K): T[K];

    abstract build(): Label | Label[];
}
