import { Post } from "../types";


export default class PostParser {

    private static ranks: any = {
        "地方官類": {
            "地方官類(路官)": {
                "轉運使司門": (name: string) => {
                    if (name.includes("轉運使")) {
                        return 6;
                    }
                    if (name.includes("轉運副使")) {
                        return 6;
                    }
                    if (name.includes("司判官")) {
                        return 5;
                    }
                    return 4;
                },
                "提點刑獄司門": (name: string) => {
                    if (/提點.*?公事/.test(name)) {
                        return 5;
                    }
                    return 4;
                },
                "提舉茶馬司門": (name: string) => {
                    return 5;
                },
                "提舉常平司門": (name: string) => {
                    return 5;
                },
                "安撫使司門": (name: string) => {
                    if (/安撫使.*?[官|監]/.test(name)) {
                        return 6;
                    }
                    if (name.includes("安撫使") || name.includes("安撫大使")) {
                        return 6;
                    }
                    else if (name.includes("安撫副使")) {
                        return 6;
                    }
                    return 5;
                },
                "發運使司門": (name: string) => {
                    if (name.includes("發運使")) {
                        return 6;
                    }
                    else if (name.includes("提舉公觀")) {
                        return 6;
                    }
                    else return 4;
                },
                "default": (name: string) => {
                    if (/提[點|舉].*?[官|公事]/.test(name)) {
                        return 6;
                    }
                    return 4;
                }
            },
            "地方官類(郡縣官)": {
                "縣鎮官門": (name: string) => {
                    if (/知.*?[縣]/.test(name)) {
                        return 2;
                    }
                    else if (name.includes("縣丞")) {
                        return 1;
                    }
                    return 1;
                },
                "州府軍監門": (name: string) => {
                    return 3;
                },
                "default": (name: string) => {
                    return 2;
                }
            },
        },
        "中樞機構類": () => 8,
        "軍事統帥機構與地方治安機構類": () => 6,
        "宰執官類": 9,
        "階官類": 1,
        "章服類": 1,
        "祠祿官類": 1,
        "皇宮京城禁衛與侍奉機構類": () => {
            return 10; // todo
        },
        "宮廷制度類": {
            "帝后門": {
                "皇帝": 14,
                "default": 13,
            },
            "default": 9,
        },
        "default": 1,
    };

    /**
     * 各个等级对应的颜色
     */
    static postColorMap = [
        "#888888",
        "#74B293",
        "#199666",
        "#017767",
        "#75BBDD",
        "#1A6FB2",
        "#085B8D",
        "#C1A1D0",
        "#8A5F9D",
        "#6D337A",
        "#B76D2D",
        "#8E5C2A",
        "#6F553A",
        "#B60613",
    ];

    /**
     * 给官职定等级
     * 
     * @param post 官职
     * @returns 等级
     */
    static rank(post: Post): number {
        let ranks = PostParser.ranks;
        let i = post.institutions.length - 2;
        for (; i >= 0; --i) {
            const institution = post.institutions[i];
            ranks = ranks[(institution as any).__name__] ?? ranks.default;
            if (typeof ranks === "number" || typeof ranks === "function") {
                --i;
                break;
            }
        }
        if (typeof ranks === "function") {
            const key = i < 0 ? (post as any).__name__ : (post.institutions[i] as any).__name__;
            return ranks(key);
        }

        if (typeof ranks !== "number") {
            ranks = ranks.default;
        }
        return ranks as number;
    }
}