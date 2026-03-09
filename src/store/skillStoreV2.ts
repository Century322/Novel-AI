import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  SkillFile,
  SkillCategoryType,
  ProjectConfig,
  ProjectAnalysis,
  KnowledgeFile,
  SkillReviewer,
} from '@/types/tools/skill';
import { skillService } from '@/services/tools/skillService';
import { logger } from '@/services/core/loggerService';

const createDefaultConfig = (): ProjectConfig => ({
  id: `config_${Date.now()}`,
  name: '默认配置',
  selectedSkills: {
    style: null,
    structure: null,
    setting: null,
    technique: null,
    workflow: null,
    review: null,
    analysis: null,
    custom: null,
  },
  activeReviewers: [],
  knowledgeFiles: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: {
    autoAnalyze: false,
    analyzeInterval: 300000,
    contextWindow: 4000,
  },
});

interface SkillState {
  skills: SkillFile[];
  projectConfig: ProjectConfig | null;
  projectAnalysis: ProjectAnalysis | null;
  knowledgeFiles: KnowledgeFile[];
  isLoading: boolean;
}

interface SkillActions {
  init: () => Promise<void>;
  scanSkills: () => Promise<void>;
  loadSkill: (skillPath: string) => Promise<SkillFile | null>;
  createSkill: (skill: Partial<SkillFile>) => Promise<string | null>;
  updateSkill: (skillPath: string, updates: Partial<SkillFile>) => Promise<boolean>;
  deleteSkill: (skillPath: string) => Promise<boolean>;
  selectSkill: (category: SkillCategoryType, skillId: string | null) => Promise<void>;
  getSelectedSkill: (category: SkillCategoryType) => SkillFile | null;
  getAllSelectedSkills: () => SkillFile[];
  getSkillsByCategory: (category: SkillCategoryType) => SkillFile[];
  generatePrompt: (skillId: string) => string;
  generateAllPrompts: () => string;
  addKnowledgeFile: (
    sourcePath: string,
    type?: KnowledgeFile['type']
  ) => Promise<KnowledgeFile | null>;
  removeKnowledgeFile: (knowledgePath: string) => Promise<boolean>;
  getKnowledgeContent: (knowledgePath: string) => Promise<string>;
  getAllKnowledgeContent: () => Promise<string>;
  runAnalysis: () => Promise<ProjectAnalysis | null>;
  getActiveReviewers: () => SkillReviewer[];
  toggleReviewer: (reviewerId: string) => void;
  exportSkill: (skillId: string) => string | null;
  importSkill: (skillJson: string) => Promise<boolean>;
}

type SkillStore = SkillState & SkillActions;

export const useSkillStore = create<SkillStore>()(
  persist(
    (set, get) => ({
      skills: [],
      projectConfig: null,
      projectAnalysis: null,
      knowledgeFiles: [],
      isLoading: false,

      init: async () => {
        set({ isLoading: true });

        try {
          const [config, customSkills, knowledgeFiles, analysis] = await Promise.all([
            skillService.loadProjectConfig(),
            skillService.scanSkills(),
            skillService.scanKnowledge(),
            skillService.loadProjectAnalysis(),
          ]);

          set({
            projectConfig: config || createDefaultConfig(),
            skills: [...customSkills],
            knowledgeFiles,
            projectAnalysis: analysis,
            isLoading: false,
          });
        } catch (error) {
          logger.error('初始化失败', { error });
          set({ isLoading: false, projectConfig: createDefaultConfig() });
        }
      },

      scanSkills: async () => {
        const customSkills = await skillService.scanSkills();
        set({ skills: [...customSkills] });
      },

      loadSkill: async (skillPath: string) => {
        return await skillService.loadSkill(skillPath);
      },

      createSkill: async (skill: Partial<SkillFile>) => {
        const skillPath = await skillService.saveSkill(skill);
        if (skillPath) {
          await get().scanSkills();
        }
        return skillPath;
      },

      updateSkill: async (skillPath: string, updates: Partial<SkillFile>) => {
        const existing = await skillService.loadSkill(skillPath);
        if (!existing) {
          return false;
        }

        const updated = { ...existing, ...updates };
        const newPath = await skillService.saveSkill(updated);

        if (newPath) {
          await get().scanSkills();
          return true;
        }
        return false;
      },

      deleteSkill: async (skillPath: string) => {
        const success = await skillService.deleteSkill(skillPath);
        if (success) {
          await get().scanSkills();
        }
        return success;
      },

      selectSkill: async (category: SkillCategoryType, skillId: string | null) => {
        const { projectConfig } = get();
        
        const baseConfig = projectConfig || createDefaultConfig();
        const newConfig: ProjectConfig = {
          ...baseConfig,
          selectedSkills: {
            ...baseConfig.selectedSkills,
            [category]: skillId,
          },
          updatedAt: Date.now(),
        };

        await skillService.saveProjectConfig(newConfig);
        set({ projectConfig: newConfig });
      },

      getSelectedSkill: (category: SkillCategoryType) => {
        const { skills, projectConfig } = get();
        if (!projectConfig) {
          return null;
        }

        const skillId = projectConfig.selectedSkills[category];
        return skills.find((s) => s.meta.id === skillId) || null;
      },

      getAllSelectedSkills: () => {
        const { skills, projectConfig } = get();
        if (!projectConfig) {
          return [];
        }

        const selectedIds = Object.values(projectConfig.selectedSkills).filter(Boolean);
        return skills.filter((s) => selectedIds.includes(s.meta.id));
      },

      getSkillsByCategory: (category: SkillCategoryType) => {
        return get().skills.filter((s) => s.meta.category === category);
      },

      generatePrompt: (skillId: string) => {
        const { skills } = get();
        const skill = skills.find((s) => s.meta.id === skillId);
        if (!skill) {
          return '';
        }

        let prompt = `【${skill.meta.name}】\n`;
        prompt += `类型: ${skill.meta.category}\n`;
        prompt += `描述: ${skill.meta.description}\n\n`;
        prompt += `【系统提示】\n${skill.prompt.system}\n`;

        if (skill.prompt.examples?.length) {
          prompt += `\n【示例】\n${skill.prompt.examples.join('\n\n')}\n`;
        }

        if (skill.chain?.before?.length || skill.chain?.after?.length) {
          prompt += '\n【调用链】\n';
          if (skill.chain.before?.length) {
            prompt += `前置: ${skill.chain.before.join(' → ')}\n`;
          }
          if (skill.chain.after?.length) {
            prompt += `后置: ${skill.chain.after.join(' → ')}\n`;
          }
        }

        return prompt;
      },

      generateAllPrompts: () => {
        const selectedSkills = get().getAllSelectedSkills();
        return selectedSkills.map((s) => get().generatePrompt(s.meta.id)).join('\n\n---\n\n');
      },

      addKnowledgeFile: async (sourcePath: string, type: KnowledgeFile['type'] = 'reference') => {
        const knowledgeFile = await skillService.addKnowledgeFile(sourcePath, type);
        if (knowledgeFile) {
          set((state) => ({
            knowledgeFiles: [...state.knowledgeFiles, knowledgeFile],
          }));
        }
        return knowledgeFile;
      },

      removeKnowledgeFile: async (knowledgePath: string) => {
        const success = await skillService.removeKnowledgeFile(knowledgePath);
        if (success) {
          set((state) => ({
            knowledgeFiles: state.knowledgeFiles.filter((f) => f.path !== knowledgePath),
          }));
        }
        return success;
      },

      getKnowledgeContent: async (knowledgePath: string) => {
        return await skillService.getKnowledgeContent(knowledgePath);
      },

      getAllKnowledgeContent: async () => {
        const { knowledgeFiles } = get();
        const contents: string[] = [];

        for (const file of knowledgeFiles) {
          const content = await skillService.getKnowledgeContent(file.path);
          if (content) {
            contents.push(
              `【资料: ${file.name}】\n${content.substring(0, 5000)}${content.length > 5000 ? '...(已截断)' : ''}`
            );
          }
        }

        return contents.join('\n\n---\n\n');
      },

      runAnalysis: async () => {
        const analysis = await skillService.loadProjectAnalysis();
        set({ projectAnalysis: analysis });
        return analysis;
      },

      getActiveReviewers: () => {
        const { skills, projectConfig } = get();
        const reviewers: SkillReviewer[] = [];

        for (const skill of skills) {
          if (skill.reviewers) {
            for (const reviewer of skill.reviewers) {
              if (projectConfig?.activeReviewers.includes(reviewer.id)) {
                reviewers.push({ ...reviewer, isActive: true });
              } else if (skill.meta.category === 'review') {
                reviewers.push(reviewer);
              }
            }
          }
        }

        return reviewers.filter((r) => r.isActive);
      },

      toggleReviewer: (reviewerId: string) => {
        const { projectConfig } = get();
        
        const baseConfig = projectConfig || createDefaultConfig();
        const activeReviewers = baseConfig.activeReviewers.includes(reviewerId)
          ? baseConfig.activeReviewers.filter((id) => id !== reviewerId)
          : [...baseConfig.activeReviewers, reviewerId];

        const newConfig: ProjectConfig = {
          ...baseConfig,
          activeReviewers,
          updatedAt: Date.now(),
        };

        skillService.saveProjectConfig(newConfig);
        set({ projectConfig: newConfig });
      },

      exportSkill: (skillId: string) => {
        const { skills } = get();
        const skill = skills.find((s) => s.meta.id === skillId);
        if (!skill) {
          return null;
        }
        return JSON.stringify(skill, null, 2);
      },

      importSkill: async (skillJson: string) => {
        try {
          const skillData = JSON.parse(skillJson) as Partial<SkillFile>;
          const path = await get().createSkill(skillData);
          return !!path;
        } catch (error) {
          logger.error('导入技能失败', { error });
          return false;
        }
      },
    }),
    {
      name: 'skill-store-v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
