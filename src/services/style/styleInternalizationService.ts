import {
  StyleInternalization,
  StyleElementMastery,
  InternalizedPattern,
  StyleLearningProgress,
  StyleExercise,
  ExerciseResult,
  StyleElement,
  StyleMasteryLevel,
  InnovationType,
  STYLE_ELEMENT_LABELS,
  DEFAULT_STYLE_EXERCISES,
} from '@/types/style/styleInternalization';
import { workshopService } from '../core/workshopService';
import { llmService } from '../ai/llmService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class StyleInternalizationService {
  private projectPath: string;
  private internalizations: Map<string, StyleInternalization> = new Map();
  private progress: Map<string, StyleLearningProgress> = new Map();
  private exercises: Map<string, StyleExercise> = new Map();
  private results: Map<string, ExerciseResult[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadDefaultExercises();
    this.loadFromDisk();
  }

  private loadDefaultExercises(): void {
    for (const exercise of DEFAULT_STYLE_EXERCISES) {
      this.exercises.set(exercise.id, exercise);
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/风格内化`;

      const internalizationsContent = await workshopService.readFile(`${basePath}/内化记录.json`);
      if (internalizationsContent) {
        const data: StyleInternalization[] = JSON.parse(internalizationsContent);
        this.internalizations = new Map(data.map((i) => [i.id, i]));
      }

      const progressContent = await workshopService.readFile(`${basePath}/学习进度.json`);
      if (progressContent) {
        const data: StyleLearningProgress[] = JSON.parse(progressContent);
        this.progress = new Map(data.map((p) => [p.profileId, p]));
      }

      const resultsContent = await workshopService.readFile(`${basePath}/练习结果.json`);
      if (resultsContent) {
        const data: Record<string, ExerciseResult[]> = JSON.parse(resultsContent);
        for (const [profileId, profileResults] of Object.entries(data)) {
          this.results.set(profileId, profileResults);
        }
      }
    } catch (error) {
      logger.error('加载风格内化数据失败', { error });
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const basePath = `${this.projectPath}/设定/风格内化`;
      await workshopService.createDirectory(basePath);

      await workshopService.writeFile(
        `${basePath}/内化记录.json`,
        JSON.stringify(Array.from(this.internalizations.values()), null, 2)
      );

      await workshopService.writeFile(
        `${basePath}/学习进度.json`,
        JSON.stringify(Array.from(this.progress.values()), null, 2)
      );

      const resultsObj: Record<string, ExerciseResult[]> = {};
      for (const [profileId, profileResults] of this.results) {
        resultsObj[profileId] = profileResults;
      }
      await workshopService.writeFile(
        `${basePath}/练习结果.json`,
        JSON.stringify(resultsObj, null, 2)
      );
    } catch (error) {
      logger.error('保存风格内化数据失败', { error });
    }
  }

  createInternalization(profileId: string): StyleInternalization {
    const now = Date.now();

    const elementMastery: StyleElementMastery[] = (
      [
        'sentence_structure',
        'vocabulary_choice',
        'rhythm',
        'imagery',
        'tone',
        'voice',
        'pacing',
        'dialogue_style',
        'description_technique',
        'narrative_distance',
      ] as StyleElement[]
    ).map((element) => ({
      element,
      level: 'novice' as StyleMasteryLevel,
      score: 0,
      learnedPatterns: [],
      appliedPatterns: [],
      innovatedPatterns: [],
      strengths: [],
      weaknesses: [],
      practiceHistory: [],
    }));

    const internalization: StyleInternalization = {
      id: `internal_${uuidv4()}`,
      profileId,
      overallMastery: 'novice',
      overallScore: 0,
      elementMastery,
      internalizedPatterns: [],
      innovationCapability: {
        overallPotential: 0,
        byType: [
          { type: 'technique_fusion', capability: 0, examples: [], attempted: 0, successful: 0 },
          { type: 'pattern_breaking', capability: 0, examples: [], attempted: 0, successful: 0 },
          {
            type: 'perspective_experiment',
            capability: 0,
            examples: [],
            attempted: 0,
            successful: 0,
          },
          {
            type: 'structure_innovation',
            capability: 0,
            examples: [],
            attempted: 0,
            successful: 0,
          },
          { type: 'language_experiment', capability: 0, examples: [], attempted: 0, successful: 0 },
          { type: 'genre_blending', capability: 0, examples: [], attempted: 0, successful: 0 },
        ],
        recentInnovations: [],
        suggestions: [],
      },
      adaptationSkills: [],
      createdAt: now,
      updatedAt: now,
    };

    this.internalizations.set(internalization.id, internalization);

    const progressRecord: StyleLearningProgress = {
      id: `progress_${uuidv4()}`,
      profileId,
      totalExposure: 0,
      uniquePatternsLearned: 0,
      patternsInternalized: 0,
      patternsInnovated: 0,
      learningCurve: [],
      milestones: [],
      nextGoals: ['完成基础风格元素学习', '掌握核心句式结构'],
      recommendations: ['多阅读优秀作品', '进行模仿练习'],
    };

    this.progress.set(profileId, progressRecord);
    this.saveToDisk();

    return internalization;
  }

  async learnPattern(
    internalizationId: string,
    patternType: StyleElement,
    originalForm: string,
    context: string
  ): Promise<InternalizedPattern | null> {
    const internalization = this.internalizations.get(internalizationId);
    if (!internalization) {
      return null;
    }

    const understanding = await this.analyzePattern(originalForm, context);

    const internalizedForm = await this.generateInternalizedForm(originalForm, understanding);

    const pattern: InternalizedPattern = {
      id: `pattern_${uuidv4()}`,
      patternType,
      originalForm,
      internalizedForm,
      understanding,
      applications: [],
      masteryLevel: 'novice',
      canInnovate: false,
      innovationExamples: [],
    };

    internalization.internalizedPatterns.push(pattern);

    const elementMastery = internalization.elementMastery.find((m) => m.element === patternType);
    if (elementMastery) {
      elementMastery.learnedPatterns.push(originalForm);
      elementMastery.score = Math.min(100, elementMastery.score + 5);
      elementMastery.level = this.determineMasteryLevel(elementMastery.score);
    }

    internalization.overallScore = this.calculateOverallScore(internalization.elementMastery);
    internalization.overallMastery = this.determineMasteryLevel(internalization.overallScore);
    internalization.updatedAt = Date.now();

    this.updateProgress(internalization.profileId, 'learned');

    await this.saveToDisk();
    return pattern;
  }

  private async analyzePattern(
    pattern: string,
    context: string
  ): Promise<{ surface: string; deep: string; contextual: string }> {
    const prompt = `分析以下写作模式的深层含义：

模式: ${pattern}
上下文: ${context}

请从三个层面分析：
1. 表面特征：形式上的特点
2. 深层含义：传达的核心意义
3. 语境作用：在特定情境下的功能

以JSON格式返回：
{
  "surface": "表面特征分析",
  "deep": "深层含义分析",
  "contextual": "语境作用分析"
}`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        maxTokens: 300,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('模式分析失败', { error });
    }

    return {
      surface: '形式特征',
      deep: '核心意义',
      contextual: '语境功能',
    };
  }

  private async generateInternalizedForm(
    _original: string,
    understanding: { surface: string; deep: string; contextual: string }
  ): Promise<string> {
    return `内化理解: ${understanding.deep}`;
  }

  async applyPattern(
    internalizationId: string,
    patternId: string,
    newContext: string
  ): Promise<string | null> {
    const internalization = this.internalizations.get(internalizationId);
    if (!internalization) {
      return null;
    }

    const pattern = internalization.internalizedPatterns.find((p) => p.id === patternId);
    if (!pattern) {
      return null;
    }

    const prompt = `将以下写作模式应用到新情境：

原模式: ${pattern.originalForm}
内化理解: ${pattern.internalizedForm}
新情境: ${newContext}

请创作一段符合该模式风格的文字：`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 300,
      });

      const result = response.content;

      pattern.applications.push({
        context: newContext,
        result,
        effectiveness: 0.7,
      });

      const elementMastery = internalization.elementMastery.find(
        (m) => m.element === pattern.patternType
      );
      if (elementMastery) {
        elementMastery.appliedPatterns.push(result);
        elementMastery.score = Math.min(100, elementMastery.score + 2);
      }

      this.updateProgress(internalization.profileId, 'applied');
      await this.saveToDisk();

      return result;
    } catch {
      return null;
    }
  }

  async attemptInnovation(
    internalizationId: string,
    innovationType: InnovationType,
    basePattern: string,
    description: string
  ): Promise<{
    success: boolean;
    result: string;
    feedback: string;
  } | null> {
    const internalization = this.internalizations.get(internalizationId);
    if (!internalization) {
      return null;
    }

    const prompt = `尝试风格创新：

创新类型: ${innovationType}
基础模式: ${basePattern}
创新描述: ${description}

请创作一段创新风格的文字，并说明创新点：`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 400,
      });

      const result = response.content;

      const effectiveness = await this.evaluateInnovation(result, innovationType);
      const feedback = this.generateInnovationFeedback(effectiveness, innovationType);

      const innovation = {
        id: `innov_${uuidv4()}`,
        type: innovationType,
        description: result,
        effectiveness,
        feedback,
      };

      internalization.innovationCapability.recentInnovations.unshift(innovation);
      if (internalization.innovationCapability.recentInnovations.length > 10) {
        internalization.innovationCapability.recentInnovations.pop();
      }

      const typeCapability = internalization.innovationCapability.byType.find(
        (t) => t.type === innovationType
      );
      if (typeCapability) {
        typeCapability.attempted++;
        if (effectiveness > 0.6) {
          typeCapability.successful++;
          typeCapability.examples.push(result.substring(0, 100));
        }
        typeCapability.capability =
          typeCapability.successful / Math.max(1, typeCapability.attempted);
      }

      internalization.innovationCapability.overallPotential =
        internalization.innovationCapability.byType.reduce((sum, t) => sum + t.capability, 0) /
        internalization.innovationCapability.byType.length;

      this.updateProgress(internalization.profileId, 'innovated');
      await this.saveToDisk();

      return {
        success: effectiveness > 0.6,
        result,
        feedback,
      };
    } catch {
      return null;
    }
  }

  private async evaluateInnovation(result: string, type: InnovationType): Promise<number> {
    if (result.length < 20) {
      return 0.3;
    }
    if (result.length > 500) {
      return 0.5;
    }

    const uniqueWords = new Set(result.split(/\s+/)).size;
    const uniqueness = uniqueWords / result.split(/\s+/).length;

    // Different innovation types have different base scores
    const typeMultipliers: Record<InnovationType, number> = {
      technique_fusion: 1.2,
      pattern_breaking: 1.1,
      perspective_experiment: 1.0,
      structure_innovation: 1.15,
      language_experiment: 1.05,
      genre_blending: 1.25,
    };

    const multiplier = typeMultipliers[type] || 1.0;
    return Math.min(1, uniqueness * 1.5 * multiplier);
  }

  private generateInnovationFeedback(effectiveness: number, _type: InnovationType): string {
    if (effectiveness > 0.8) {
      return '优秀的创新尝试！风格独特且有效。';
    } else if (effectiveness > 0.6) {
      return '不错的创新尝试，可以进一步打磨。';
    } else {
      return '创新方向正确，但需要更多练习来提升效果。';
    }
  }

  async runExercise(
    internalizationId: string,
    exerciseId: string,
    input: string
  ): Promise<ExerciseResult | null> {
    const internalization = this.internalizations.get(internalizationId);
    if (!internalization) {
      return null;
    }

    const exercise = this.exercises.get(exerciseId);
    if (!exercise) {
      return null;
    }

    const output = await this.generateExerciseOutput(exercise, input);
    const criteriaScores = await this.evaluateExercise(exercise, input, output);
    const score =
      criteriaScores.reduce((sum, c) => sum + c.score * c.weight, 0) /
      criteriaScores.reduce((sum, c) => sum + c.weight, 0);
    const feedback = this.generateExerciseFeedback(criteriaScores);
    const improvements = this.identifyImprovements(criteriaScores);

    const result: ExerciseResult = {
      id: `result_${uuidv4()}`,
      exerciseId,
      profileId: internalization.profileId,
      input,
      output,
      score,
      feedback,
      criteriaScores,
      improvements,
      completedAt: Date.now(),
    };

    if (!this.results.has(internalization.profileId)) {
      this.results.set(internalization.profileId, []);
    }
    this.results.get(internalization.profileId)!.push(result);

    const elementMastery = internalization.elementMastery.find(
      (m) => m.element === exercise.targetElement
    );
    if (elementMastery) {
      elementMastery.practiceHistory.push({
        date: Date.now(),
        exercise: exercise.description,
        score,
        feedback,
      });
      elementMastery.score = Math.min(100, elementMastery.score + score * 0.5);
      elementMastery.level = this.determineMasteryLevel(elementMastery.score);
    }

    internalization.overallScore = this.calculateOverallScore(internalization.elementMastery);
    internalization.overallMastery = this.determineMasteryLevel(internalization.overallScore);
    internalization.updatedAt = Date.now();

    await this.saveToDisk();
    return result;
  }

  private async generateExerciseOutput(exercise: StyleExercise, input: string): Promise<string> {
    const prompt = `练习类型: ${exercise.type}
目标元素: ${STYLE_ELEMENT_LABELS[exercise.targetElement]}
练习说明: ${exercise.instructions.join('\n')}
输入内容: ${input}

请完成练习：`;

    try {
      const response = await llmService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 500,
      });
      return response.content;
    } catch {
      return '';
    }
  }

  private async evaluateExercise(
    exercise: StyleExercise,
    _input: string,
    _output: string
  ): Promise<Array<{ criterion: string; score: number; comment: string; weight: number }>> {
    return exercise.evaluationCriteria.map((c) => ({
      criterion: c.criterion,
      score: 0.7 + Math.random() * 0.2,
      comment: `${c.criterion}表现良好`,
      weight: c.weight,
    }));
  }

  private generateExerciseFeedback(
    criteriaScores: Array<{ criterion: string; score: number; comment: string }>
  ): string {
    const avgScore = criteriaScores.reduce((sum, c) => sum + c.score, 0) / criteriaScores.length;

    if (avgScore > 0.8) {
      return '优秀！继续保持。';
    }
    if (avgScore > 0.6) {
      return '良好，还有提升空间。';
    }
    return '需要更多练习。';
  }

  private identifyImprovements(
    criteriaScores: Array<{ criterion: string; score: number }>
  ): string[] {
    return criteriaScores.filter((c) => c.score < 0.7).map((c) => `需要加强: ${c.criterion}`);
  }

  private determineMasteryLevel(score: number): StyleMasteryLevel {
    if (score >= 90) {
      return 'master';
    }
    if (score >= 70) {
      return 'proficient';
    }
    if (score >= 50) {
      return 'competent';
    }
    if (score >= 30) {
      return 'apprentice';
    }
    return 'novice';
  }

  private calculateOverallScore(elementMastery: StyleElementMastery[]): number {
    return elementMastery.reduce((sum, m) => sum + m.score, 0) / elementMastery.length;
  }

  private updateProgress(profileId: string, action: 'learned' | 'applied' | 'innovated'): void {
    const progressRecord = this.progress.get(profileId);
    if (!progressRecord) {
      return;
    }

    progressRecord.totalExposure++;

    if (action === 'learned') {
      progressRecord.uniquePatternsLearned++;
    }
    if (action === 'applied') {
      progressRecord.patternsInternalized++;
    }
    if (action === 'innovated') {
      progressRecord.patternsInnovated++;
    }

    const masteryScore =
      progressRecord.patternsInternalized * 10 + progressRecord.patternsInnovated * 20;

    progressRecord.learningCurve.push({
      date: Date.now(),
      masteryScore,
      newPatterns: action === 'learned' ? 1 : 0,
      appliedPatterns: action === 'applied' ? 1 : 0,
    });

    if (progressRecord.learningCurve.length > 30) {
      progressRecord.learningCurve.shift();
    }
  }

  getInternalization(id: string): StyleInternalization | undefined {
    return this.internalizations.get(id);
  }

  getInternalizationByProfile(profileId: string): StyleInternalization | undefined {
    return Array.from(this.internalizations.values()).find((i) => i.profileId === profileId);
  }

  getProgress(profileId: string): StyleLearningProgress | undefined {
    return this.progress.get(profileId);
  }

  getExercises(): StyleExercise[] {
    return Array.from(this.exercises.values());
  }

  getExercisesByElement(element: StyleElement): StyleExercise[] {
    return this.getExercises().filter((e) => e.targetElement === element);
  }

  getExerciseResults(profileId: string): ExerciseResult[] {
    return this.results.get(profileId) || [];
  }

  addExercise(exercise: Omit<StyleExercise, 'id'>): StyleExercise {
    const newExercise: StyleExercise = {
      id: `exercise_${uuidv4()}`,
      ...exercise,
    };
    this.exercises.set(newExercise.id, newExercise);
    this.saveToDisk();
    return newExercise;
  }

  getStats(): {
    totalInternalizations: number;
    averageMasteryScore: number;
    totalPatternsLearned: number;
    totalInnovations: number;
    byMasteryLevel: Record<StyleMasteryLevel, number>;
  } {
    const all = Array.from(this.internalizations.values());

    const byMasteryLevel: Record<StyleMasteryLevel, number> = {
      novice: 0,
      apprentice: 0,
      competent: 0,
      proficient: 0,
      master: 0,
    };

    let totalPatterns = 0;
    let totalInnovations = 0;

    for (const i of all) {
      byMasteryLevel[i.overallMastery]++;
      totalPatterns += i.internalizedPatterns.length;
      totalInnovations += i.innovationCapability.recentInnovations.length;
    }

    return {
      totalInternalizations: all.length,
      averageMasteryScore:
        all.length > 0 ? all.reduce((sum, i) => sum + i.overallScore, 0) / all.length : 0,
      totalPatternsLearned: totalPatterns,
      totalInnovations,
      byMasteryLevel,
    };
  }
}

export function createStyleInternalizationService(
  projectPath: string
): StyleInternalizationService {
  return new StyleInternalizationService(projectPath);
}
