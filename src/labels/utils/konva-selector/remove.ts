import { BaseType } from "./types";
export default function<T extends BaseType>(this: T) {
    let index;
    (index = this?.parent?.children.findIndex((child) => child === this)) !== -1 &&
        this?.parent?.children.splice(index!, 1);
    this?.remove();
}