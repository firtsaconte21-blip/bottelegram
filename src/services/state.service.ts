import { db } from '../repositories/supabase.js';
import type { UserState, TempData, UserStateRecord } from '../types/index.js';

class StateService {
  /**
   * Obtém o estado atual do usuário
   */
  async getState(userId: number): Promise<UserStateRecord | null> {
    return db.getUserState(userId);
  }

  /**
   * Define um novo estado para o usuário
   */
  async setState(
    userId: number,
    state: UserState,
    tempData?: TempData
  ): Promise<boolean> {
    // Se tempData não for fornecido, mantém os dados existentes
    if (tempData === undefined) {
      const current = await this.getState(userId);
      tempData = current?.temp_data || {};
    }

    console.log(`[DEBUG] Setting state for ${userId} to ${state}`);
    const result = await db.setUserState(userId, state, tempData);
    console.log(`[DEBUG] Set state result for ${userId}: ${result}`);
    return result;
  }

  /**
   * Atualiza apenas os dados temporários, mantendo o estado
   */
  async updateTempData(userId: number, updates: Partial<TempData>): Promise<boolean> {
    const current = await this.getState(userId);
    const currentData = current?.temp_data || {};
    const newData = { ...currentData, ...updates };

    return db.setUserState(userId, current?.state || 'IDLE', newData);
  }

  /**
   * Atualiza o estado e mescla novos dados temporários
   */
  async updateUserState(userId: number, state: UserState, updates: Partial<TempData>): Promise<boolean> {
    const current = await this.getState(userId);
    const currentData = current?.temp_data || {};
    const newData = { ...currentData, ...updates };

    return db.setUserState(userId, state, newData);
  }

  /**
   * Reseta o estado do usuário para IDLE
   */
  async reset(userId: number): Promise<boolean> {
    return db.resetUserState(userId);
  }

  /**
   * Verifica se o usuário está em um fluxo específico
   */
  async isInState(userId: number, state: UserState): Promise<boolean> {
    const current = await this.getState(userId);
    return current?.state === state;
  }

  /**
   * Verifica se o usuário está em qualquer fluxo (não IDLE)
   */
  async isInFlow(userId: number): Promise<boolean> {
    const current = await this.getState(userId);
    return current?.state !== 'IDLE' && current?.state !== undefined;
  }
}

export const stateService = new StateService();
