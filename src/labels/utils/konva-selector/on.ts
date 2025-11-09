import { BaseType } from "./types";

export type OnKeys = "mouseover" | "mouseenter" | "mouseout" | "mouseleave" | "click" | "dblclick" | "wheel";
export type OnHandler<Element extends BaseType, Datum> = {
    (element: Element, datum: Datum): void;
}

export default function on<
    Element extends BaseType,
    Datum,
    Key extends OnKeys
>(this: Element, key: Key, handler: OnHandler<Element, Datum>, datum: Datum) {
    this?.on(key, (event) => {
        handler.call(this, event as any, datum);
    });
}