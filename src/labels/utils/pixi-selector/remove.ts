import { BaseType } from "./types";
export default function<T extends BaseType>(this: T) {
    this?.removeFromParent();
}