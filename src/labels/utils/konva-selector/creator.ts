import Konva from "konva";
import { BaseType } from "./types";

export const ElementDict: {
    [key: string]: () => BaseType;
} = {
    "group": () => new Konva.Group(),
    "text": () => new Konva.Text(),
    "rect": () => new Konva.Rect(),
    "circle": () => new Konva.Circle(),
    "line": () => new Konva.Line(),
    "path": () => new Konva.Path(),
}

export default function(query: string) {
    return ElementDict[query];
}