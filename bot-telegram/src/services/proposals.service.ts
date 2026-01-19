import { db } from '../repositories/supabase.js';
import type { Proposal } from '../types/index.js';

class ProposalsService {
  /**
   * Cria uma nova proposta
   */
  async create(
    adId: string,
    fromUserId: number,
    fromUsername: string | null,
    quantidade: number,
    valorProposta: number
  ): Promise<Proposal | null> {
    return db.createProposal({
      ad_id: adId,
      from_user_id: fromUserId,
      from_username: fromUsername,
      quantidade,
      valor_proposta: valorProposta,
    });
  }

  /**
   * Busca uma proposta pelo ID
   */
  async getById(id: string): Promise<Proposal | null> {
    return db.getProposalById(id);
  }

  /**
   * Aceita uma proposta
   */
  async accept(id: string): Promise<Proposal | null> {
    return db.updateProposal(id, { status: 'ACCEPTED' });
  }

  /**
   * Rejeita uma proposta
   */
  async reject(id: string): Promise<Proposal | null> {
    return db.updateProposal(id, { status: 'REJECTED' });
  }

  /**
   * Lista propostas pendentes de um anúncio
   */
  async getPendingByAd(adId: string): Promise<Proposal[]> {
    return db.getPendingProposalsByAd(adId);
  }

  /**
   * Valida o valor da proposta
   */
  validateProposalValue(input: string): { valid: boolean; value: number; error?: string } {
    const cleaned = input.replace(',', '.').replace(/[^\d.]/g, '');
    const value = parseFloat(cleaned);

    if (isNaN(value) || value <= 0) {
      return { valid: false, value: 0, error: 'Por favor, informe um valor válido maior que zero.' };
    }

    if (value > 1000) {
      return { valid: false, value: 0, error: 'Valor muito alto. Máximo: R$ 1.000,00 por milheiro.' };
    }

    return { valid: true, value: Math.round(value * 100) / 100 };
  }
}

export const proposalsService = new ProposalsService();
