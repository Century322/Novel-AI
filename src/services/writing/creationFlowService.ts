import {
  CreationStage,
  CreationStep,
  CreationProgress,
  GuidedQuestion,
  GuidedCard,
  GuidedAction,
  CREATION_STAGES,
  NOVEL_TYPES,
  THEME_TEMPLATES,
} from '@/types/writing/creationFlow';
import { novelTypeService } from '../analysis/novelTypeService';
import { NovelTypeDetectionResult } from '@/types/ecosystem/novelType';

export interface CreationFlowState {
  progress: CreationProgress;
  collectedData: Record<string, unknown>;
  history: Array<{
    stepId: string;
    data: Record<string, unknown>;
    timestamp: number;
  }>;
  novelTypeResult?: NovelTypeDetectionResult;
}

export class CreationFlowService {
  private state: CreationFlowState;

  constructor(_projectPath: string) {
    this.state = this.initializeState();
  }

  private initializeState(): CreationFlowState {
    return {
      progress: {
        currentStage: 'concept',
        currentStep: null,
        completedSteps: [],
        stageStatus: {
          concept: 'available',
          worldbuilding: 'locked',
          characters: 'locked',
          outline: 'locked',
          writing: 'locked',
          revision: 'locked',
          complete: 'locked',
        },
        percentage: 0,
      },
      collectedData: {},
      history: [],
    };
  }

  getState(): CreationFlowState {
    return this.state;
  }

  getProgress(): CreationProgress {
    return this.state.progress;
  }

  getCurrentStage(): CreationStage {
    return this.state.progress.currentStage;
  }

  getCurrentStep(): CreationStep | null {
    if (!this.state.progress.currentStep) {
      return null;
    }

    const stage = CREATION_STAGES[this.state.progress.currentStage];
    return stage.steps.find((s) => s.id === this.state.progress.currentStep) || null;
  }

  getStageInfo(stage: CreationStage) {
    return CREATION_STAGES[stage];
  }

  getNextStep(): CreationStep | null {
    const currentStage = CREATION_STAGES[this.state.progress.currentStage];

    for (const step of currentStage.steps) {
      if (!this.state.progress.completedSteps.includes(step.id)) {
        if (this.canStartStep(step)) {
          return step;
        }
      }
    }

    return null;
  }

  canStartStep(step: CreationStep): boolean {
    return step.dependencies.every((dep) => this.state.progress.completedSteps.includes(dep));
  }

  startStep(stepId: string): boolean {
    const stage = CREATION_STAGES[this.state.progress.currentStage];
    const step = stage.steps.find((s) => s.id === stepId);

    if (!step || !this.canStartStep(step)) {
      return false;
    }

    this.state.progress.currentStep = stepId;
    this.state.progress.stageStatus[this.state.progress.currentStage] = 'in_progress';

    return true;
  }

  completeStep(stepId: string, data: Record<string, unknown>): boolean {
    if (this.state.progress.currentStep !== stepId) {
      return false;
    }

    this.state.progress.completedSteps.push(stepId);
    this.state.collectedData[stepId] = data;
    this.state.history.push({
      stepId,
      data,
      timestamp: Date.now(),
    });

    this.state.progress.currentStep = null;
    this.updateProgress();

    const currentStage = CREATION_STAGES[this.state.progress.currentStage];
    const allStageStepsCompleted = currentStage.steps
      .filter((s) => s.required)
      .every((s) => this.state.progress.completedSteps.includes(s.id));

    if (allStageStepsCompleted && currentStage.nextStage) {
      this.advanceStage();
    }

    return true;
  }

  private updateProgress(): void {
    const totalSteps = Object.values(CREATION_STAGES)
      .flatMap((s) => s.steps)
      .filter((s) => s.required).length;

    const completedRequiredSteps = this.state.progress.completedSteps.filter((id) => {
      const step = this.findStepById(id);
      return step?.required;
    }).length;

    this.state.progress.percentage = Math.round((completedRequiredSteps / totalSteps) * 100);
  }

  private findStepById(stepId: string): CreationStep | null {
    for (const stage of Object.values(CREATION_STAGES)) {
      const step = stage.steps.find((s) => s.id === stepId);
      if (step) {
        return step;
      }
    }
    return null;
  }

  private advanceStage(): void {
    const currentStage = CREATION_STAGES[this.state.progress.currentStage];

    if (currentStage.nextStage) {
      this.state.progress.stageStatus[this.state.progress.currentStage] = 'completed';
      this.state.progress.currentStage = currentStage.nextStage;
      this.state.progress.stageStatus[currentStage.nextStage] = 'available';
    }
  }

  skipStep(stepId: string): boolean {
    const step = this.findStepById(stepId);
    if (!step || step.required) {
      return false;
    }

    this.state.progress.completedSteps.push(stepId);
    this.state.collectedData[stepId] = { skipped: true };
    this.updateProgress();

    return true;
  }

  goToStage(stage: CreationStage): boolean {
    const status = this.state.progress.stageStatus[stage];
    if (status === 'locked') {
      return false;
    }

    this.state.progress.currentStage = stage;
    this.state.progress.currentStep = null;

    return true;
  }

  getGuidedCardForStep(step: CreationStep): GuidedCard {
    const questions: GuidedQuestion[] = this.generateQuestionsForStep(step);
    const actions: GuidedAction[] = this.generateActionsForStep(step);

    return {
      id: `guided_${step.id}`,
      type: 'question',
      title: step.title,
      content: step.description,
      questions,
      actions,
      data: { stepId: step.id, stage: step.stage },
    };
  }

  private generateQuestionsForStep(step: CreationStep): GuidedQuestion[] {
    const questions: GuidedQuestion[] = [];

    switch (step.id) {
      case 'concept_type':
        questions.push({
          id: 'novel_type',
          question: '你想写什么类型的小说？',
          type: 'choice',
          options: NOVEL_TYPES.map((t) => ({
            label: t.label,
            value: t.value,
            description: t.description,
            icon: t.icon,
          })),
          required: true,
          helpText: '选择一个类型可以帮助后续设定',
        });
        break;

      case 'concept_theme':
        questions.push({
          id: 'theme',
          question: '你的小说想表达什么主题？',
          type: 'choice',
          options: THEME_TEMPLATES.map((t) => ({
            label: t.label,
            value: t.value,
            description: t.description,
          })),
          required: true,
        });
        questions.push({
          id: 'theme_custom',
          question: '或者输入自定义主题',
          type: 'text',
          placeholder: '例如：追求自由、守护爱情...',
          required: false,
        });
        break;

      case 'concept_hook':
        questions.push({
          id: 'hook',
          question: '你的小说有什么独特之处？',
          type: 'text',
          placeholder: '例如：独特的金手指设定、新颖的世界观...',
          required: false,
          helpText: '这是吸引读者的关键',
        });
        break;

      case 'char_protagonist':
        questions.push({
          id: 'protagonist_name',
          question: '主角叫什么名字？',
          type: 'text',
          placeholder: '输入主角姓名',
          required: true,
        });
        questions.push({
          id: 'protagonist_personality',
          question: '主角的性格是怎样的？',
          type: 'text',
          placeholder: '例如：理性冷静、热血冲动、腹黑...',
          required: true,
        });
        questions.push({
          id: 'protagonist_background',
          question: '主角的背景故事？',
          type: 'text',
          placeholder: '例如：穿越者、孤儿、天才...',
          required: false,
        });
        break;

      case 'char_goldfinger':
        questions.push({
          id: 'goldfinger_name',
          question: '金手指的名称？',
          type: 'text',
          placeholder: '例如：属性面板、修炼系统...',
          required: false,
        });
        questions.push({
          id: 'goldfinger_ability',
          question: '金手指有什么能力？',
          type: 'text',
          placeholder: '描述金手指的具体功能',
          required: false,
        });
        break;

      case 'world_background':
        questions.push({
          id: 'world_type',
          question: '故事发生在什么样的世界？',
          type: 'choice',
          options: [
            { label: '古代修仙世界', value: 'xianxia' },
            { label: '现代都市', value: 'modern' },
            { label: '未来科幻', value: 'scifi' },
            { label: '异世界', value: 'isekai' },
            { label: '架空历史', value: 'alt_history' },
          ],
          required: true,
        });
        questions.push({
          id: 'world_description',
          question: '这个世界有什么特点？',
          type: 'text',
          placeholder: '描述世界的独特之处',
          required: false,
        });
        break;

      case 'world_power':
        questions.push({
          id: 'power_system',
          question: '力量体系是怎样的？',
          type: 'text',
          placeholder: '例如：炼气-筑基-金丹-元婴...',
          required: false,
        });
        break;

      case 'outline_main':
        questions.push({
          id: 'main_plot',
          question: '主线剧情是什么？',
          type: 'text',
          placeholder: '描述故事的主线发展',
          required: true,
        });
        break;

      default:
        questions.push({
          id: 'input',
          question: step.prompts[0] || '请输入',
          type: 'text',
          placeholder: step.examples[0] || '',
          required: step.required,
        });
    }

    return questions;
  }

  private generateActionsForStep(step: CreationStep): GuidedAction[] {
    const actions: GuidedAction[] = [
      {
        id: 'confirm',
        label: '确认',
        type: 'primary',
        action: 'confirm',
      },
    ];

    if (!step.required) {
      actions.push({
        id: 'skip',
        label: '跳过',
        type: 'secondary',
        action: 'skip',
      });
    }

    return actions;
  }

  getWelcomeCard(): GuidedCard {
    return {
      id: 'welcome',
      type: 'question',
      title: '开始创作你的小说',
      content:
        '让我们一步步完成小说的设定。我会引导你完成世界观、人物、大纲等设定，然后开始创作正文。',
      questions: [
        {
          id: 'start_choice',
          question: '你想怎么开始？',
          type: 'choice',
          options: [
            { label: '开始引导', value: 'guided', description: '我会一步步引导你完成设定' },
            { label: '自由创作', value: 'free', description: '直接开始，我自己设定' },
            { label: '继续上次', value: 'continue', description: '继续之前的创作进度' },
          ],
          required: true,
        },
      ],
      actions: [{ id: 'start', label: '开始', type: 'primary', action: 'start' }],
    };
  }

  getProgressCard(): GuidedCard {
    const progress = this.state.progress;
    const stages = Object.entries(CREATION_STAGES)
      .filter(([key]) => key !== 'complete')
      .map(([key, stage]) => ({
        name: stage.name,
        icon: stage.icon,
        status: progress.stageStatus[key as CreationStage],
      }));

    return {
      id: 'progress',
      type: 'progress',
      title: '创作进度',
      content: `当前进度：${progress.percentage}%`,
      data: {
        stages,
        currentStage: progress.currentStage,
        percentage: progress.percentage,
      },
      actions: [
        { id: 'continue', label: '继续创作', type: 'primary', action: 'continue' },
        { id: 'view', label: '查看设定', type: 'secondary', action: 'view_settings' },
      ],
    };
  }

  getSuggestionCard(context: string): GuidedCard {
    const suggestions = this.generateSuggestions(context);

    return {
      id: 'suggestion',
      type: 'suggestion',
      title: '建议',
      content: suggestions[0] || '继续你的创作吧！',
      data: { suggestions },
      actions: [
        { id: 'accept', label: '采纳', type: 'primary', action: 'accept_suggestion' },
        { id: 'dismiss', label: '忽略', type: 'secondary', action: 'dismiss' },
      ],
    };
  }

  private generateSuggestions(_context: string): string[] {
    const suggestions: string[] = [];
    const progress = this.state.progress;

    if (progress.currentStage === 'concept' && !this.state.collectedData['concept_type']) {
      suggestions.push('建议先选择小说类型，这会影响后续的设定');
    }

    if (progress.currentStage === 'characters') {
      if (!this.state.collectedData['char_goldfinger']) {
        suggestions.push('主角的金手指可以让故事更有趣，考虑设定一个？');
      }
      if (!this.state.collectedData['char_antagonist']) {
        suggestions.push('一个好的反派可以让故事更精彩');
      }
    }

    if (progress.currentStage === 'outline') {
      if (!this.state.collectedData['outline_foreshadowing']) {
        suggestions.push('规划一些伏笔可以让剧情更有深度');
      }
    }

    return suggestions;
  }

  async detectNovelType(description: string): Promise<NovelTypeDetectionResult> {
    const result = await novelTypeService.detectNovelType(description);
    this.state.novelTypeResult = result;
    return result;
  }

  getNovelTypeResult(): NovelTypeDetectionResult | undefined {
    return this.state.novelTypeResult;
  }

  getTypeBasedQuestions(): GuidedQuestion[] {
    const typeResult = this.state.novelTypeResult;
    if (!typeResult) {
      return [];
    }

    const questions: GuidedQuestion[] = [];
    const typeInfo = novelTypeService.getTypeInfo(typeResult.detectedType);

    if (typeInfo.powerSystems.length > 0) {
      questions.push({
        id: 'power_system',
        question: `检测到 ${typeInfo.name} 类型，力量体系选择：`,
        type: 'choice',
        options: typeInfo.powerSystems.map((p) => ({
          label: p,
          value: p.toLowerCase(),
        })),
        required: false,
        helpText: '选择或自定义力量体系名称',
      });
    }

    return questions;
  }

  reset(): void {
    this.state = this.initializeState();
  }

  loadState(savedState: CreationFlowState): void {
    this.state = savedState;
  }

  exportCollectedData(): Record<string, unknown> {
    return { ...this.state.collectedData };
  }
}

export function createCreationFlowService(projectPath: string): CreationFlowService {
  return new CreationFlowService(projectPath);
}
