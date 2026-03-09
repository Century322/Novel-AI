import {
  CharacterProfile,
  CharacterRole,
  CharacterArchetype,
  CharacterRelationship,
  CharacterSecret,
  CharacterArc,
  CharacterGrowthStage,
  CHARACTER_ROLES,
  CHARACTER_ARCHETYPES,
} from '@/types/character/characterProfile';
import { workshopService } from '../core/workshopService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../core/loggerService';

export class CharacterService {
  private projectPath: string;
  private characters: Map<string, CharacterProfile> = new Map();
  private nameIndex: Map<string, string> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const filePath = `${this.projectPath}/设定/人物档案.json`;
      const content = await workshopService.readFile(filePath);
      if (content) {
        const data = JSON.parse(content);
        this.characters = new Map(data.map((c: CharacterProfile) => [c.id, c]));
        this.rebuildNameIndex();
      }
    } catch (error) {
      logger.error('加载人物档案失败', { error });
    }
  }

  private rebuildNameIndex(): void {
    this.nameIndex.clear();
    for (const [id, char] of this.characters) {
      this.nameIndex.set(char.name.toLowerCase(), id);
      for (const alias of char.aliases) {
        this.nameIndex.set(alias.toLowerCase(), id);
      }
    }
  }

  private async saveToDisk(): Promise<void> {
    try {
      const filePath = `${this.projectPath}/设定/人物档案.json`;
      await workshopService.writeFile(
        filePath,
        JSON.stringify(Array.from(this.characters.values()), null, 2)
      );
    } catch (error) {
      logger.error('保存人物档案失败', { error });
    }
  }

  createCharacter(data: {
    name: string;
    role: CharacterRole;
    archetype: CharacterArchetype;
    aliases?: string[];
    appearance?: Partial<CharacterProfile['appearance']>;
    personality?: Partial<CharacterProfile['personality']>;
    background?: Partial<CharacterProfile['background']>;
    abilities?: Partial<CharacterProfile['abilities']>;
    notes?: string;
  }): CharacterProfile {
    const id = `char_${uuidv4()}`;
    const now = Date.now();

    const character: CharacterProfile = {
      id,
      name: data.name,
      aliases: data.aliases || [],
      role: data.role,
      archetype: data.archetype,
      appearance: {
        age: data.appearance?.age || '未知',
        gender: data.appearance?.gender || '未知',
        height: data.appearance?.height,
        build: data.appearance?.build,
        hair: data.appearance?.hair,
        eyes: data.appearance?.eyes,
        distinctiveFeatures: data.appearance?.distinctiveFeatures || [],
        clothing: data.appearance?.clothing || '',
        overallImpression: data.appearance?.overallImpression || '',
      },
      personality: {
        traits: data.personality?.traits || [],
        virtues: data.personality?.virtues || [],
        flaws: data.personality?.flaws || [],
        fears: data.personality?.fears || [],
        desires: data.personality?.desires || [],
        habits: data.personality?.habits || [],
        quirks: data.personality?.quirks || [],
        speech: data.personality?.speech || {
          style: '',
          catchphrases: [],
          vocabulary: '',
        },
      },
      background: {
        birthplace: data.background?.birthplace || '',
        family: data.background?.family || {
          parents: '',
          siblings: '',
        },
        childhood: data.background?.childhood || '',
        education: data.background?.education || '',
        occupation: data.background?.occupation || '',
        socialStatus: data.background?.socialStatus || '',
        significantEvents: data.background?.significantEvents || [],
      },
      abilities: {
        skills: data.abilities?.skills || [],
        powers: data.abilities?.powers || [],
        equipment: data.abilities?.equipment || [],
        weaknesses: data.abilities?.weaknesses || [],
      },
      relationships: [],
      arc: {
        startingPoint: {
          state: '',
          beliefs: [],
          goals: [],
        },
        journey: [],
        endPoint: {
          state: '',
          beliefs: [],
          goals: [],
          resolution: '',
        },
        theme: '',
      },
      secrets: [],
      motivations: {
        consciousGoals: [],
        unconsciousDesires: [],
        fears: [],
        values: [],
        internalConflict: '',
        externalConflict: '',
      },
      firstAppearance: '',
      totalAppearances: 0,
      notes: data.notes || '',
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    this.characters.set(id, character);
    this.nameIndex.set(data.name.toLowerCase(), id);
    this.saveToDisk();
    return character;
  }

  getCharacter(id: string): CharacterProfile | undefined {
    return this.characters.get(id);
  }

  getCharacterByName(name: string): CharacterProfile | undefined {
    const id = this.nameIndex.get(name.toLowerCase());
    return id ? this.characters.get(id) : undefined;
  }

  getAllCharacters(): CharacterProfile[] {
    return Array.from(this.characters.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getCharactersByRole(role: CharacterRole): CharacterProfile[] {
    return this.getAllCharacters().filter((c) => c.role === role);
  }

  getProtagonist(): CharacterProfile | undefined {
    return this.getCharactersByRole('protagonist')[0];
  }

  getAntagonists(): CharacterProfile[] {
    return this.getCharactersByRole('antagonist');
  }

  getSupportingCharacters(): CharacterProfile[] {
    return this.getCharactersByRole('supporting');
  }

  updateCharacter(id: string, updates: Partial<CharacterProfile>): CharacterProfile | undefined {
    const character = this.characters.get(id);
    if (!character) {
      return undefined;
    }

    const updated: CharacterProfile = {
      ...character,
      ...updates,
      updatedAt: Date.now(),
    };

    this.characters.set(id, updated);

    if (updates.name && updates.name !== character.name) {
      this.nameIndex.delete(character.name.toLowerCase());
      this.nameIndex.set(updates.name.toLowerCase(), id);
    }

    this.saveToDisk();
    return updated;
  }

  deleteCharacter(id: string): boolean {
    const character = this.characters.get(id);
    if (!character) {
      return false;
    }

    this.nameIndex.delete(character.name.toLowerCase());
    for (const alias of character.aliases) {
      this.nameIndex.delete(alias.toLowerCase());
    }

    this.characters.delete(id);
    this.saveToDisk();
    return true;
  }

  addRelationship(
    characterId: string,
    relationship: Omit<CharacterRelationship, 'targetId'> & { targetName: string }
  ): CharacterRelationship | undefined {
    const character = this.characters.get(characterId);
    if (!character) {
      return undefined;
    }

    const target = this.getCharacterByName(relationship.targetName);
    if (!target) {
      return undefined;
    }

    const newRelationship: CharacterRelationship = {
      targetId: target.id,
      targetName: relationship.targetName,
      relationshipType: relationship.relationshipType,
      description: relationship.description,
      history: relationship.history,
      currentStatus: relationship.currentStatus,
      development: relationship.development || [],
    };

    character.relationships.push(newRelationship);
    this.updateCharacter(characterId, { relationships: character.relationships });

    const reverseRelationship: CharacterRelationship = {
      targetId: characterId,
      targetName: character.name,
      relationshipType: this.getReverseRelationshipType(relationship.relationshipType),
      description: relationship.description,
      history: relationship.history,
      currentStatus: relationship.currentStatus,
      development: relationship.development || [],
    };
    target.relationships.push(reverseRelationship);
    this.updateCharacter(target.id, { relationships: target.relationships });

    return newRelationship;
  }

  private getReverseRelationshipType(type: string): string {
    const reverseMap: Record<string, string> = {
      师徒: '徒弟',
      徒弟: '师徒',
      父子: '子父',
      母女: '女母',
      兄弟: '兄弟',
      姐妹: '姐妹',
      主仆: '仆主',
      仆主: '主仆',
    };
    return reverseMap[type] || type;
  }

  addSecret(characterId: string, secret: Omit<CharacterSecret, 'id'>): CharacterSecret | undefined {
    const character = this.characters.get(characterId);
    if (!character) {
      return undefined;
    }

    const newSecret: CharacterSecret = {
      id: `secret_${uuidv4()}`,
      ...secret,
    };

    character.secrets.push(newSecret);
    this.updateCharacter(characterId, { secrets: character.secrets });
    return newSecret;
  }

  revealSecret(characterId: string, secretId: string, revealedAt: string): boolean {
    const character = this.characters.get(characterId);
    if (!character) {
      return false;
    }

    const secret = character.secrets.find((s) => s.id === secretId);
    if (!secret) {
      return false;
    }

    secret.revealedAt = revealedAt;
    this.updateCharacter(characterId, { secrets: character.secrets });
    return true;
  }

  updateArc(characterId: string, arcUpdates: Partial<CharacterArc>): CharacterArc | undefined {
    const character = this.characters.get(characterId);
    if (!character) {
      return undefined;
    }

    const updatedArc = {
      ...character.arc,
      ...arcUpdates,
    };

    this.updateCharacter(characterId, { arc: updatedArc });
    return updatedArc;
  }

  addArcStage(
    characterId: string,
    stage: CharacterGrowthStage,
    data: {
      events: string;
      internalChange: string;
      externalChange: string;
    }
  ): boolean {
    const character = this.characters.get(characterId);
    if (!character) {
      return false;
    }

    character.arc.journey.push({
      stage,
      ...data,
    });

    this.updateCharacter(characterId, { arc: character.arc });
    return true;
  }

  recordAppearance(characterId: string, chapter: string): void {
    const character = this.characters.get(characterId);
    if (!character) {
      return;
    }

    if (!character.firstAppearance) {
      character.firstAppearance = chapter;
    }
    character.totalAppearances++;
    character.lastAppearance = chapter;

    this.updateCharacter(characterId, {
      firstAppearance: character.firstAppearance,
      lastAppearance: character.lastAppearance,
      totalAppearances: character.totalAppearances,
    });
  }

  getCharacterSummary(id: string): string {
    const character = this.characters.get(id);
    if (!character) {
      return '人物不存在';
    }

    const roleInfo = CHARACTER_ROLES[character.role];
    const archetypeInfo = CHARACTER_ARCHETYPES[character.archetype];

    let summary = `## ${character.name}\n\n`;
    summary += `- **角色**: ${roleInfo.name}\n`;
    summary += `- **原型**: ${archetypeInfo.name}\n`;

    if (character.aliases.length > 0) {
      summary += `- **别名**: ${character.aliases.join(', ')}\n`;
    }

    summary += `\n### 外貌\n${character.appearance.overallImpression || '未设定'}\n`;

    if (character.personality.traits.length > 0) {
      summary += `\n### 性格\n${character.personality.traits.join('、')}\n`;
    }

    if (character.background.occupation) {
      summary += `\n### 职业\n${character.background.occupation}\n`;
    }

    if (character.relationships.length > 0) {
      summary += '\n### 关系\n';
      for (const rel of character.relationships) {
        summary += `- ${rel.targetName}: ${rel.relationshipType}\n`;
      }
    }

    return summary;
  }

  searchCharacters(query: string): CharacterProfile[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCharacters().filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.aliases.some((a) => a.toLowerCase().includes(lowerQuery)) ||
        c.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
        c.notes.toLowerCase().includes(lowerQuery)
    );
  }

  getCharacterNetwork(characterId: string):
    | {
        character: CharacterProfile;
        connections: Array<{
          character: CharacterProfile;
          relationship: CharacterRelationship;
        }>;
      }
    | undefined {
    const character = this.characters.get(characterId);
    if (!character) {
      return undefined;
    }

    const connections = character.relationships
      .map((rel) => {
        const target = this.characters.get(rel.targetId);
        return target ? { character: target, relationship: rel } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return { character, connections };
  }

  exportData(): CharacterProfile[] {
    return this.getAllCharacters();
  }

  importData(data: CharacterProfile[]): void {
    for (const char of data) {
      this.characters.set(char.id, char);
    }
    this.rebuildNameIndex();
    this.saveToDisk();
  }
}

export function createCharacterService(projectPath: string): CharacterService {
  return new CharacterService(projectPath);
}
