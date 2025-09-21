import { load } from 'js-yaml';
import { RuleDefinitionModel } from '@/models/ruleDefinition';
import { AlertModel, CreateAlertData } from '@/models/alert';
import { EvidenceModel } from '@/models/evidence';
import { CaseModel } from '@/models/case';
import { logger } from '@/utils/logger';

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  value?: any;
}

export interface RuleAction {
  type: 'create_alert';
  severity: 'low' | 'medium' | 'high';
  message: string;
  evidence_refs?: string[];
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

export class RulesEngine {
  private rules: RuleDefinition[] = [];

  constructor() {
    this.loadRules();
  }

  // Load rules from database
  async loadRules(): Promise<void> {
    try {
      const ruleDefs = await RuleDefinitionModel.findAllActive();

      this.rules = ruleDefs.map(def => {
        try {
          const yamlContent = load(def.yaml_definition) as any;

          return {
            id: def.id,
            name: def.name,
            description: def.description,
            conditions: this.parseConditions(yamlContent.when || yamlContent.conditions),
            actions: this.parseActions(yamlContent.actions || yamlContent.on_failure),
            enabled: def.active
          };
        } catch (error) {
          logger.error(`Error parsing rule ${def.id}:`, error);
          return null;
        }
      }).filter(Boolean) as RuleDefinition[];

      logger.info(`Loaded ${this.rules.length} active rules`);
    } catch (error) {
      logger.error('Error loading rules:', error);
      throw error;
    }
  }

  // Process evidence against all rules
  async processEvidence(evidenceId: string): Promise<void> {
    const evidence = await EvidenceModel.findById(evidenceId);
    if (!evidence) {
      logger.warn(`Evidence ${evidenceId} not found for processing`);
      return;
    }

    const caseData = await CaseModel.findById(evidence.case_id);
    if (!caseData) {
      logger.warn(`Case ${evidence.case_id} not found for evidence ${evidenceId}`);
      return;
    }

    // Create context for rule evaluation
    const context = {
      evidence: this.flattenEvidence(evidence),
      case: this.flattenCase(caseData),
      now: new Date()
    };

    // Evaluate each rule
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        const shouldTrigger = this.evaluateConditions(rule.conditions, context);

        if (shouldTrigger) {
          await this.executeActions(rule.actions, context, evidence);
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  // Process all evidence for a case
  async processCase(caseId: string): Promise<void> {
    const evidenceItems = await EvidenceModel.findByCase(caseId);

    logger.info(`Processing ${evidenceItems.length} evidence items for case ${caseId}`);

    for (const evidence of evidenceItems) {
      await this.processEvidence(evidence.id);
    }
  }

  // Add a new rule
  async addRule(ruleDef: Omit<RuleDefinition, 'id'>): Promise<void> {
    const ruleId = `R-${Date.now()}`;
    const yamlDefinition = this.generateYamlDefinition(ruleDef);

    await RuleDefinitionModel.create({
      id: ruleId,
      name: ruleDef.name,
      description: ruleDef.description,
      yaml_definition: yamlDefinition,
      owner: 'system',
      active: ruleDef.enabled
    });

    // Reload rules
    await this.loadRules();
  }

  private evaluateConditions(conditions: RuleCondition[], context: any): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(context, condition.field);
      const result = this.evaluateCondition(condition, fieldValue);

      if (!result) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: RuleCondition, fieldValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return Array.isArray(fieldValue) ? fieldValue.includes(condition.value) : String(fieldValue).includes(condition.value);
      case 'greater_than':
        return fieldValue > condition.value;
      case 'less_than':
        return fieldValue < condition.value;
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      case 'not_exists':
        return fieldValue === null || fieldValue === undefined;
      default:
        return false;
    }
  }

  private getFieldValue(context: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private executeActions(actions: RuleAction[], context: any, evidence: any): Promise<void>[] {
    return actions.map(async (action) => {
      if (action.type === 'create_alert') {
        const alertData: CreateAlertData = {
          case_id: evidence.case_id,
          rule_id: context.rule?.id || 'unknown',
          severity: action.severity,
          explanation: this.interpolateString(action.message, context),
          evidence_refs: action.evidence_refs || [evidence.id]
        };

        await AlertModel.create(alertData);
        logger.info(`Alert created by rule: ${alertData.rule_id} (severity: ${alertData.severity})`);
      }
    });
  }

  private interpolateString(template: string, context: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getFieldValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private parseConditions(yamlConditions: any): RuleCondition[] {
    const conditions: RuleCondition[] = [];

    if (Array.isArray(yamlConditions)) {
      for (const cond of yamlConditions) {
        conditions.push({
          field: cond.field || cond.path,
          operator: this.mapOperator(cond.operator || cond.op),
          value: cond.value
        });
      }
    }

    return conditions;
  }

  private parseActions(yamlActions: any): RuleAction[] {
    const actions: RuleAction[] = [];

    if (Array.isArray(yamlActions)) {
      for (const action of yamlActions) {
        actions.push({
          type: action.type || 'create_alert',
          severity: action.severity || 'medium',
          message: action.message,
          evidence_refs: action.evidence_refs
        });
      }
    }

    return actions;
  }

  private mapOperator(operator: string): RuleCondition['operator'] {
    const operatorMap: Record<string, RuleCondition['operator']> = {
      '==': 'equals',
      '!=': 'not_equals',
      'contains': 'contains',
      '>': 'greater_than',
      '<': 'less_than',
      'exists': 'exists',
      '!exists': 'not_exists'
    };

    return operatorMap[operator] || 'equals';
  }

  private flattenEvidence(evidence: any): any {
    return {
      id: evidence.id,
      type: evidence.type,
      timestamp: evidence.timestamp,
      location: evidence.location,
      owner_source: evidence.owner_source,
      chain_of_custody_length: evidence.chain_of_custody_json?.length || 0
    };
  }

  private flattenCase(caseData: any): any {
    return {
      id: caseData.id,
      case_number: caseData.case_number,
      status: caseData.status,
      created_at: caseData.created_at
    };
  }

  private generateYamlDefinition(rule: Omit<RuleDefinition, 'id'>): string {
    const yaml = {
      name: rule.name,
      description: rule.description,
      when: rule.conditions.map(cond => ({
        field: cond.field,
        operator: this.reverseMapOperator(cond.operator),
        value: cond.value
      })),
      actions: rule.actions.map(action => ({
        type: action.type,
        severity: action.severity,
        message: action.message,
        evidence_refs: action.evidence_refs
      }))
    };

    return require('js-yaml').dump(yaml);
  }

  private reverseMapOperator(operator: RuleCondition['operator']): string {
    const reverseMap: Record<RuleCondition['operator'], string> = {
      'equals': '==',
      'not_equals': '!=',
      'contains': 'contains',
      'greater_than': '>',
      'less_than': '<',
      'exists': 'exists',
      'not_exists': '!exists'
    };

    return reverseMap[operator] || '==';
  }
}
