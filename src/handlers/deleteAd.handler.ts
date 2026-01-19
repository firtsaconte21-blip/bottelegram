import { Context } from 'telegraf';
import { adsService } from '../services/ads.service.js';

/**
 * Handler para cancelar/excluir um anúncio
 * Callback: cancel_{adId}
 */
export async function handleDeleteAd(ctx: Context, adId: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Busca o anúncio
    const ad = await adsService.getById(adId);

    if (!ad) {
        await ctx.reply('❌ Anúncio não encontrado.');
        return;
    }

    // Verifica se o usuário é o dono do anúncio
    if (ad.user_id !== userId) {
        await ctx.reply('❌ Você não tem permissão para excluir este anúncio.');
        return;
    }

    // Verifica se o anúncio já foi cancelado
    if (ad.status === 'CANCELLED') {
        await ctx.reply('⚠️ Este anúncio já foi cancelado anteriormente.');
        return;
    }

    // Cancela o anúncio
    const success = await adsService.cancel(adId);

    if (success) {
        const adType = ad.type === 'BUY' ? 'COMPRA' : 'VENDA';
        await ctx.reply(
            `✅ *Anúncio de ${adType} cancelado com sucesso!*\n\n` +
            `O anúncio foi removido e não aparecerá mais para outros usuários.`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await ctx.reply('❌ Erro ao cancelar anúncio. Tente novamente.');
    }
}
