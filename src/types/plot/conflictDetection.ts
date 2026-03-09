export type ConflictType =
  | 'character_inconsistency'
  | 'timeline_conflict'
  | 'setting_contradiction'
  | 'plot_hole'
  | 'relationship_conflict'
  | 'power_level_inconsistency'
  | 'location_mismatch'
  | 'name_conflict';

export type ConflictSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export type ConflictStatus = 'detected' | 'acknowledged' | 'resolved' | 'ignored';

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  title: string;
  description: string;
  source: ConflictSource;
  conflictingWith: ConflictSource[];
  suggestion: string;
  autoFixable: boolean;
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
}

export interface ConflictSource {
  type: 'character' | 'timeline' | 'setting' | 'plot' | 'foreshadowing' | 'chapter';
  id: string;
  name: string;
  field?: string;
  value?: unknown;
  location?: string;
}

export interface ConflictRule {
  id: string;
  name: string;
  type: ConflictType;
  description: string;
  check: (data: unknown, allData: Record<string, unknown[]>) => Conflict | null;
  autoFix?: (conflict: Conflict, allData: Record<string, unknown[]>) => Promise<FixResult>;
}

export interface FixResult {
  success: boolean;
  changes: FileChange[];
  message: string;
}

export interface FileChange {
  path: string;
  type: 'create' | 'update' | 'delete';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface RelationDefinition {
  sourceType: string;
  sourceField: string;
  targetType: string;
  targetField: string;
  relationType: 'one_to_one' | 'one_to_many' | 'many_to_many';
  onUpdate: 'cascade' | 'set_null' | 'restrict';
  onDelete: 'cascade' | 'set_null' | 'restrict';
}

export interface UpdatePropagation {
  sourceType: string;
  sourceId: string;
  sourceField: string;
  oldValue: unknown;
  newValue: unknown;
  affectedFiles: AffectedFile[];
}

export interface AffectedFile {
  path: string;
  type: string;
  changes: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  character_inconsistency: '人物设定不一致',
  timeline_conflict: '时间线冲突',
  setting_contradiction: '设定矛盾',
  plot_hole: '剧情漏洞',
  relationship_conflict: '关系冲突',
  power_level_inconsistency: '战力体系不一致',
  location_mismatch: '地点不匹配',
  name_conflict: '名称冲突',
};

export const CONFLICT_SEVERITY_LABELS: Record<ConflictSeverity, string> = {
  critical: '严重',
  major: '重要',
  minor: '轻微',
  suggestion: '建议',
};

export const BUILTIN_RELATIONS: RelationDefinition[] = [
  {
    sourceType: 'character',
    sourceField: 'name',
    targetType: 'chapter',
    targetField: 'character_mentions',
    relationType: 'one_to_many',
    onUpdate: 'cascade',
    onDelete: 'restrict',
  },
  {
    sourceType: 'character',
    sourceField: 'location',
    targetType: 'timeline',
    targetField: 'character_location',
    relationType: 'one_to_many',
    onUpdate: 'cascade',
    onDelete: 'set_null',
  },
  {
    sourceType: 'setting',
    sourceField: 'power_levels',
    targetType: 'character',
    targetField: 'power_level',
    relationType: 'one_to_many',
    onUpdate: 'cascade',
    onDelete: 'restrict',
  },
  {
    sourceType: 'setting',
    sourceField: 'locations',
    targetType: 'timeline',
    targetField: 'location',
    relationType: 'one_to_many',
    onUpdate: 'cascade',
    onDelete: 'set_null',
  },
  {
    sourceType: 'foreshadowing',
    sourceField: 'resolved_node',
    targetType: 'plot_node',
    targetField: 'resolved_foreshadowings',
    relationType: 'many_to_many',
    onUpdate: 'cascade',
    onDelete: 'set_null',
  },
];
