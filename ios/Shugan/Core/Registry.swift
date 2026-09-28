import Foundation

/**
 * 题库注册表 —— 与 bank.ts 的 GRADES 树一致（2024 沪教版五四制归类）。
 * 年级 → 单元 → 知识点；skill id 与网页版/小程序版完全相同，便于将来数据互通。
 */

let GRADES: [Grade] = [
    Grade(
        id: "g5",
        title: "五年级 · 分数与小数",
        units: [
            Unit(id: "g5-frac-meaning", title: "5.1 分数的意义与改写", skills: [rewriteSkill]),
            Unit(id: "g5-frac-simplify", title: "5.2 约分", skills: [simplifySkill]),
            Unit(id: "g5-frac-lcd", title: "5.3 通分", skills: [lcdSkill]),
            Unit(id: "g5-frac-compare", title: "5.4 分数的大小比较", skills: [compareSkill]),
            Unit(id: "g5-frac-addsub", title: "5.5 分数的加减法", skills: [fracAddSkill, fracSubSkill]),
            Unit(id: "g5-frac-mul", title: "5.6 分数的乘法", skills: [fracMulSkill, crossCancelSkill]),
            Unit(id: "g5-frac-div", title: "5.7 分数的除法", skills: [reciprocalSkill, fracDivSkill]),
            Unit(id: "g5-frac-dec", title: "5.8 分数与小数", skills: [rationalConvertSkill, fracDecMixSkill]),
        ],
        available: true
    ),
    Grade(
        id: "g6",
        title: "六年级上 · 第1章 有理数",
        units: [
            Unit(id: "g6-1-1", title: "1.1 有理数的引入", skills: [oppositeAbsSkill, signCompareSkill]),
            Unit(id: "g6-1-2", title: "1.2 有理数的加法与减法", skills: [signFlashSkill, signedAddSkill]),
            Unit(id: "g6-1-3", title: "1.3 有理数的乘法与除法", skills: [signFlashMulSkill, signedMulSkill]),
            Unit(id: "g6-1-4", title: "1.4 有理数的乘方", skills: [powerFlashSkill]),
            Unit(id: "g6-1-5", title: "1.5 有理数的混合运算", skills: [opOrderSkill, opLawsSkill]),
        ],
        available: true
    ),
    Grade(
        id: "g6b",
        title: "六年级下",
        units: [Unit(id: "g6b-5-2", title: "5.2 百分数", skills: [])],
        available: true
    ),
    Grade(id: "g7", title: "七年级", units: [], available: false),
    Grade(id: "g8", title: "八年级", units: [], available: false),
    Grade(id: "g9", title: "九年级", units: [], available: false),
]

func findSkill(_ skillId: String) -> Skill? {
    for g in GRADES {
        for u in g.units {
            for s in u.skills where s.id == skillId { return s }
        }
    }
    return nil
}

/** 一局题目的生成：均匀混合所有题型，种子可复现；count 可覆盖题量（复习模式 20 题） */
func generateQuiz(_ skill: Skill, seed: Int = Int(Date().timeIntervalSince1970 * 1000), count: Int? = nil) -> [Question] {
    let rng = Mulberry32(seed: seed)
    let total = count ?? skill.questionCount
    return (0..<total).map { i in
        skill.generators[i % skill.generators.count](rng)
    }
}
