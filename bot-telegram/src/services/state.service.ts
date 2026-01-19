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
    try {
      // Se tempData não for fornecido, mantém os dados existentes
      if (tempData === undefined) {
        const current = await this.getState(userId);
        tempData = current?.temp_data || {};
      }

      console.log(`[STATE] Setting state for ${userId}: ${state}`, tempData);
      const result = await db.setUserState(userId, state, tempData);

      if (!result) {
        console.error(`[STATE] Failed to set state for ${userId} to ${state}`);
      }
      return result;
    } catch (error) {
      console.error(`[STATE] Error in setState for ${userId}:`, error);
      return false;
    }
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
    try {
      const current = await this.getState(userId);
      const currentData = current?.temp_data || {};
      const newData = { ...currentData, ...updates };

      console.log(`[STATE] Updating state for ${userId}: ${state}`, updates);
      const result = await db.setUserState(userId, state, newData);

      if (!result) {
        console.error(`[STATE] Failed to update state for ${userId} to ${state}`);
      }
      return result;
    } catch (error) {
      console.error(`[STATE] Error in updateUserState for ${userId}:`, error);
      return false;
    }
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
