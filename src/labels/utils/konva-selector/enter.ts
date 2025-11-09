import Konva from "konva";
import { BaseType } from "./types";
export class EnterNode<Element extends BaseType, Datum, PElement extends BaseType> {
    
    __data__: Datum;

    parent: PElement;
    _next?: Element;

    constructor(parent: PElement, datum: Datum) {
        this.parent = parent;
        this.__data__ = datum;
    }

    addChild(element: Element) {
        const parent = this.parent as Konva.Group;
        const index = parent.children.findIndex(c => c === this._next);
        (element as any).__data__ = this.__data__;
        if (index !== -1) {
            parent.children.splice(index, 0, element!);
            element!.parent = parent;
        }
        else {
            parent.children.push(element!);
            element!.parent = parent;
        }
        return element;
    }
}