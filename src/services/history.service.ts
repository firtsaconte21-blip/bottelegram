
import { db } from '../repositories/supabase.js';
import { MileHistory } from '../types/index.js';

class HistoryService {
    /**
     * Adiciona uma entrada no histórico de milhas
     */
    async addMileHistory(data: {
        user_id: number;
        tipo: 'compra' | 'venda';
        companhia: string;
        quantidade: number;
        proposal_id: string;
    }): Promise<MileHistory | null> {
        return db.createMileHistory(data);
    }

    /**
     * Busca estatísticas de negociação do mês atual
     */
    async getMonthlyStats(userId: number, tipo: 'compra' | 'venda'): Promise<{ count: number; totalMiles: number }> {
        const stats = await db.getUserDetailedStats(userId);
        return {
            count: stats.monthly.totalNegotiations,
            totalMiles: stats.monthly.totalBought + stats.monthly.totalSold
        };
    }

    /**
     * Obtém todas as estatísticas detalhadas (vitalício + mensal)
     */
    async getDetailedStats(userId: number) {
        return db.getUserDetailedStats(userId);
    }
}

export const historyService = new HistoryService();
