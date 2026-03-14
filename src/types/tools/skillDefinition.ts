// 重新导出 skill.ts 中的所有类型
export * from './skill';

// 额外的兼容类型
import type { SkillCategoryType } from './skill';

export type WorkshopSkillCategory = SkillCategoryType;
