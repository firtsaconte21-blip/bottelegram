import { db } from '../repositories/supabase.js';
import type { Rating } from '../types/index.js';
import { historyService } from './history.service.js';
import { proposalsService } from './proposals.service.js';
import { adsService } from './ads.service.js';

class RatingsService {
    /**
     * Cria uma nova avaliação
     */
    async createRating(data: {
        ad_id: string;
        from_user_id: number;
        to_user_id: number;
        role: 'BUYER' | 'SELLER';
        recommend: boolean;
        rating: number;
        proposal_id?: string;
    }): Promise<Rating | null> {

        // Validações básicas
        if (data.rating < 1 || data.rating > 5) {
            console.error('Nota inválida. Deve ser entre 1 e 5.');
            return null;
        }

        return db.createRating(data);
    }

    /**
     * Confirma uma avaliação e gera registro no histórico
     */
    async confirmRating(ratingId: string): Promise<boolean> {
        const rating = await db.getRatingById(ratingId);
        if (!rating) {
            console.error('[confirmRating] Avaliação não encontrada:', ratingId);
            return false;
        }

        // Se já estiver confirmada, não faz nada (evita duplicidade no histórico)
        if (rating.confirmada) return true;

        // Marca como confirmada no banco
        const ok = await db.confirmRating(ratingId);
        if (!ok) {
            console.error('[confirmRating] Falha ao marcar avaliação como confirmada no banco.');
            return false;
        }

        // Tenta obter o ID da proposta (seja da avaliação ou buscando por anúncio/usuário)
        let proposalId = rating.proposal_id;

        if (!proposalId) {
            console.log('[confirmRating] proposal_id ausente na avaliação. Tentando encontrar proposta aceita...');
            // Fallback: Se não tem proposal_id, tenta achar a proposta aceita deste anúncio envolvendo estas partes
            const adProposals = await proposalsService.getPendingByAd(rating.ad_id); // Reusando método mas precisamos de aceitas
            // Na verdade, vamos buscar as propostas do anúncio diretamente via DB para ser mais preciso
            const { data: propp } = await (db as any).client // Casting temporário para acessar client se necessário
                .from('proposals')
                .select('*')
                .eq('ad_id', rating.ad_id)
                .eq('status', 'ACCEPTED')
                .or(`from_telegram_user_id.eq.${rating.from_user_id},from_telegram_user_id.eq.${rating.to_user_id}`)
                .limit(1);

            if (propp && propp.length > 0) {
                proposalId = propp[0].id;
                console.log('[confirmRating] Proposta encontrada via fallback:', proposalId);
            }
        }

        // Se temos uma proposta vinculada, gera o histórico para AMBAS as partes
        if (proposalId) {
            const proposal = await proposalsService.getById(proposalId);
            if (proposal) {
                const ad = await adsService.getById(proposal.ad_id);
                if (ad) {
                    console.log(`[confirmRating] Gerando histórico para proposta ${proposalId}...`);

                    // Identifica quem é o comprador e quem é o vendedor na proposta
                    // No AD de venda: Dono é vendedor, Proponente é comprador.
                    // No AD de compra: Dono é comprador, Proponente é vendedor.
                    const ownerIsBuyer = ad.type === 'BUY';
                    const buyerId = ownerIsBuyer ? ad.user_id : proposal.from_user_id;
                    const sellerId = ownerIsBuyer ? proposal.from_user_id : ad.user_id;

                    // 1. Histórico do Comprador
                    await historyService.addMileHistory({
                        user_id: buyerId,
                        tipo: 'compra',
                        companhia: ad.companhia,
                        quantidade: proposal.quantidade,
                        proposal_id: proposal.id
                    });

                    // 2. Histórico do Vendedor
                    await historyService.addMileHistory({
                        user_id: sellerId,
                        tipo: 'venda',
                        companhia: ad.companhia,
                        quantidade: proposal.quantidade,
                        proposal_id: proposal.id
                    });

                    console.log('[confirmRating] Histórico gerado com sucesso para ambos.');
                }
            }
        } else {
            console.log('[confirmRating] Nenhuma proposta encontrada para gerar histórico.');
        }

        return true;
    }

    /**
     * Calcula a média de avaliações de um usuário
     */
    async getAverageRating(userId: number): Promise<{ average: number; count: number }> {
        const ratings = await db.getUserRatings(userId);

        if (ratings.length === 0) {
            return { average: 0, count: 0 };
        }

        const sum = ratings.reduce((acc: number, curr: Rating) => acc + curr.rating, 0);
        const average = sum / ratings.length;

        return {
            average: parseFloat(average.toFixed(1)),
            count: ratings.length
        };
    }
}

export const ratingsService = new RatingsService();
