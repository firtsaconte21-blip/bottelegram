import { Context } from 'telegraf';
import { historyService } from '../services/history.service.js';
import { TelegramService } from '../services/telegram.service.js';

let telegramService: TelegramService;

export function setUserStatsTelegramService(service: TelegramService): void {
    telegramService = service;
}

/**
 * Exibe o perfil detalhado do usuário (Confiômetro Full)
 * Callback: user_stats_<adId>_<targetUserId>_<proposalId>
 */
export async function handleShowDetailedProfile(ctx: Context, payload: string): Promise<void> {
    try {
        const proposalId = payload;
        const chatId = ctx.chat?.id;

        if (!chatId || !proposalId) {
            await ctx.answerCbQuery('❌ Erro ao processar perfil.', { show_alert: true });
            return;
        }

        // Recupera a proposta para descobrir quem é o alvo
        const { proposalsService } = await import('../services/proposals.service.js');
        const proposal = await proposalsService.getById(proposalId);

        if (!proposal) {
            await ctx.answerCbQuery('❌ Proposta não encontrada.', { show_alert: true });
            return;
        }

        // O alvo é sempre quem enviou a proposta (proponente)
        // já que o botão é enviado para o dono do anúncio
        const targetUserId = proposal.from_user_id;

        // Busca estatísticas consolidadas (Vitalício + Mensal)
        const stats = await historyService.getDetailedStats(targetUserId);

        // Busca o anúncio para determinar o papel (Buyer/Seller)
        const { adsService } = await import('../services/ads.service.js');
        const ad = await adsService.getById(proposal.ad_id);

        const role = ad?.type === 'SELL' ? 'Comprador' : 'Vendedor';

        await ctx.answerCbQuery();

        if (telegramService) {
            await telegramService.sendDetailedProfile(
                chatId,
                targetUserId,
                stats,
                role as 'Vendedor' | 'Comprador',
                proposalId
            );
        }
    } catch (error) {
        console.error('Erro no handleShowDetailedProfile:', error);
        await ctx.answerCbQuery('❌ Ocorreu um erro ao carregar o perfil.', { show_alert: true });
    }
}
