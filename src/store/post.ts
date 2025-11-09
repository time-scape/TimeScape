import { atom } from "nanostores";
import { PostNode, InstitutionNode } from "../types";
import { Figure } from "../types";

/** 选中的职位/机构（为了方便在层次结构中定位，选中的官职使用 PostNode 或 InstitutionNode 类型） */
export const $postSelected = atom<PostNode | InstitutionNode | null>(null);

export function generateTree(allFigures: Figure[], figures: Figure[]) {
    const root: InstitutionNode = {
        parent: null,
        value: {} as any, // 根节点没有职位
        count: 0,
        figCount: 0,
        figFilteredCount: 0,
        children: [],
    };

    const nodes: (InstitutionNode | PostNode)[] = [];

    const figureSet = new Set<number>(figures.map(f => f.id));

    for (const figure of allFigures) {
        const visitList = new Set<InstitutionNode | PostNode>();
        const isFiltered = figureSet.has(figure.id);
        figure.posts.forEach(post => {
            let p: InstitutionNode = root;
            p.count++;
            if (!visitList.has(p)) {
                visitList.add(p);
                p.figCount++;
                isFiltered && (p.figFilteredCount++);
            }
            const hierarchy = post.institutions;
            for (let i = hierarchy.length - 1; i >= 0; --i) {
                const institution = hierarchy[i];
                let node = p.children.find(child => {
                    return ("id" in child.value) && child.value.id === institution.id;
                });
                if (!node) {
                    node = {
                        parent: p,
                        value: institution,
                        count: 0,
                        figCount: 0,
                        figFilteredCount: 0,
                        children: [],
                    };
                    nodes.push(node);
                    p.children.push(node);
                }
                p = node as InstitutionNode;
                p.count++;
                if (!visitList.has(p)) {
                    visitList.add(p);
                    p.figCount++;
                    isFiltered && (p.figFilteredCount++);
                }
            }
            let node = p.children.find(child => {
                return child.value.id === post.id;
            });
            if (!node) {
                node = {
                    parent: p,
                    value: post,
                    count: 0,
                    figCount: 0,
                    figFilteredCount: 0,
                };
                nodes.push(node);
                p.children.push(node);
            }
            node.count++;
            if (!visitList.has(node)) {
                visitList.add(node);
                node.figCount++;
                isFiltered && (node.figFilteredCount++);
            }
        });
    }
    // 对树进行排序
    const sortTree = (node: InstitutionNode) => {
        node.children.sort((a, b) => {
            if ("children" in a && "children" in b) {
                return b.figCount - a.figCount; // 按照出现次数降序排序
            }
            if ("children" in a) return -1; // 非叶节点排在叶节点前面
            if ("children" in b) return 1; // 非叶节点排在叶节点前面
            // 叶节点按照出现次数降序排序
            return b.figCount - a.figCount;
        });
        node.children.forEach(child => {
            if ("children" in child) {
                sortTree(child as InstitutionNode);
            }
        });
    };
    sortTree(root);
    return [root, nodes];
}