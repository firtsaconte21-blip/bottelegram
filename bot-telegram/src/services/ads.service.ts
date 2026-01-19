import { db } from '../repositories/supabase.js';
import type { Ad, TempData } from '../types/index.js';

class AdsService {
  /**
   * Cria um novo anúncio com os dados temporários do usuário
   */
  async createFromTempData(
    userId: number,
    username: string | null,
    tempData: TempData
  ): Promise<Ad | null> {
    const { companhia, quantidade, valor_milheiro, type, passengers, urgent } = tempData;

    if (!companhia || !quantidade || !valor_milheiro) {
      console.error('Dados incompletos para criar anúncio:', tempData);
      return null;
    }

    return db.createAd({
      user_id: userId,
      username,
      type: type || 'SELL',
      companhia,
      quantidade,
      valor_milheiro,
      passengers, // Optional
      urgent      // Optional
    });
  }

  /**
   * Busca um anúncio pelo ID
   */
  async getById(id: string): Promise<Ad | null> {
    return db.getAdById(id);
  }

  /**
   * Atualiza o message_id e chat_id após publicação no grupo
   */
  async updateMessageInfo(
    adId: string,
    messageId: number,
    chatId: number
  ): Promise<Ad | null> {
    return db.updateAd(adId, {
      message_id: messageId,
      chat_id: chatId,
    });
  }

  /**
   * Marca o anúncio como vendido
   */
  async markAsSold(adId: string): Promise<Ad | null> {
    return db.updateAd(adId, { status: 'SOLD' });
  }

  /**
   * Cancela um anúncio
   */
  async cancel(adId: string): Promise<Ad | null> {
    return db.updateAd(adId, { status: 'CANCELLED' });
  }

  /**
   * Lista anúncios ativos de um usuário
   */
  async getActiveByUser(userId: number): Promise<Ad[]> {
    return db.getActiveAdsByUser(userId);
  }

  /**
   * Valida o nome da companhia
   */
  validateCompany(input: string): { valid: boolean; value: string; error?: string } {
    const trimmed = input.trim();

    if (trimmed.length < 2) {
      return { valid: false, value: '', error: 'Nome da companhia muito curto.' };
    }

    if (trimmed.length > 50) {
      return { valid: false, value: '', error: 'Nome da companhia muito longo (máx 50 caracteres).' };
    }

    return { valid: true, value: trimmed };
  }

  /**
   * Valida a quantidade de milhas
   */
  validateQuantity(input: string): { valid: boolean; value: number; error?: string } {
    // Remove pontos e vírgulas usados como separadores de milhar
    const cleaned = input.replace(/[.,]/g, '');
    const quantity = parseInt(cleaned, 10);

    if (isNaN(quantity) || quantity <= 0) {
      return { valid: false, value: 0, error: 'Por favor, informe um número válido maior que zero.' };
    }

    if (quantity > 100_000_000) {
      return { valid: false, value: 0, error: 'Quantidade muito alta. Máximo: 100.000.000 milhas.' };
    }

    return { valid: true, value: quantity };
  }

  /**
   * Valida o valor do milheiro
   */
  validatePrice(input: string): { valid: boolean; value: number; error?: string } {
    // Aceita formatos: 12.50, 12,50, 12
    const cleaned = input.replace(',', '.').replace(/[^\d.]/g, '');
    const price = parseFloat(cleaned);

    if (isNaN(price) || price <= 0) {
      return { valid: false, value: 0, error: 'Por favor, informe um valor válido maior que zero.' };
    }

    if (price > 1000) {
      return { valid: false, value: 0, error: 'Valor do milheiro muito alto. Máximo: R$ 1.000,00.' };
    }

    return { valid: true, value: Math.round(price * 100) / 100 };
  }
}

export const adsService = new AdsService();
