
import { Context, Markup } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { ratingsService } from '../services/ratings.service.js';
import { adsService } from '../services/ads.service.js';

/**
 * Inicia o fluxo de avaliação
 * Callback: rate_<ad_id>_<target_user_id> ou rate_p_<proposal_id>
 */
export async function startRating(ctx: Context, payload: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    let adId: string;
    let targetUserId: number;
    let proposalIdToState: string | undefined;

    if (payload.startsWith('p_')) {
        // Novo formato: rate_p_${proposalId}
        const proposalId = payload.replace('p_', '');
        const { proposalsService } = await import('../services/proposals.service.js');
        const proposal = await proposalsService.getById(proposalId);

        if (!proposal) {
            await ctx.answerCbQuery('❌ Proposta não encontrada.');
            return;
        }

        adId = proposal.ad_id;

        // Identifica o alvo
        const ad = await adsService.getById(adId);
        if (!ad) {
            await ctx.answerCbQuery('❌ Anúncio não encontrado.');
            return;
        }

        if (userId === ad.user_id) {
            targetUserId = proposal.from_user_id;
        } else {
            targetUserId = ad.user_id;
        }

        proposalIdToState = proposalId;
    } else {
        // Formato antigo: rate_<ad_id>_<target_user_id>_<proposal_id>
        const parts = payload.split('_');
        adId = parts[0];
        targetUserId = parseInt(parts[1], 10);
        const propId = parts[2];
        proposalIdToState = (propId && propId !== 'undefined' && propId !== 'null' && propId.length > 10) ? propId : undefined;
    }

    const ad = await adsService.getById(adId);
    if (!ad) {
        await ctx.reply('❌ Anúncio não encontrado.');
        return;
    }

    // Determina o papel de quem está avaliando
    const isOwner = ad.user_id === userId;
    const role = ad.type === 'SELL'
        ? (isOwner ? 'SELLER' : 'BUYER')
        : (isOwner ? 'BUYER' : 'SELLER');

    await stateService.setState(userId, 'RATING_RECOMMEND', {
        ad_id: adId,
        target_user_id: targetUserId,
        rating_role: role,
        proposal_id: proposalIdToState
    });

    await ctx.reply(
        `👤 *Avaliação de Usuário*\n\nVocê recomenda este ${role === 'SELLER' ? 'vendedor' : 'comprador'}?`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('👍 SIM', 'rate_rec_yes'),
                    Markup.button.callback('👎 NÃO', 'rate_rec_no')
                ]
            ])
        }
    );
}

/**
 * Processa a recomendação (Sim/Não)
 */
export async function handleRatingRecommend(ctx: Context, answer: 'yes' | 'no'): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const recommend = answer === 'yes';
    await stateService.updateUserState(userId, 'RATING_STARS', { rating_recommend: recommend });

    // Remove botões da etapa anterior
    try {
        await ctx.editMessageReplyMarkup(undefined);
    } catch (e) {
        console.error('Erro ao remover botões de recomendação:', e);
    }

    await ctx.reply(
        '⭐ *Como você avalia a negociação realizada?*',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('⭐ 1', 'rate_star_1'),
                    Markup.button.callback('⭐ 2', 'rate_star_2'),
                    Markup.button.callback('⭐ 3', 'rate_star_3'),
                    Markup.button.callback('⭐ 4', 'rate_star_4'),
                    Markup.button.callback('⭐ 5', 'rate_star_5')
                ]
            ])
        }
    );
}

/**
 * Processa a escolha de estrelas
 */
export async function handleRatingStars(ctx: Context, stars: number): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    await stateService.updateUserState(userId, 'RATING_CONFIRM', { rating_stars: stars });

    // Remove botões da etapa anterior
    try {
        await ctx.editMessageReplyMarkup(undefined);
    } catch (e) {
        console.error('Erro ao remover botões de estrelas:', e);
    }

    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data) return;

    const recommendText = data.rating_recommend ? '👍 Sim' : '👎 Não';
    const evalTargetRole = data.rating_role === 'SELLER' ? 'Comprador' : 'Vendedor';

    const summary = `
📝 *Confirmar Avaliação*

👤 *Usuário:* ${evalTargetRole}
👍 *Recomenda:* ${recommendText}
⭐ *Nota:* ${stars}/5

_Se você de fato concretizou esta negociação, clique em CONFIRMAR. Isso atualizará seu histórico oficial de milhas compradas/vendidas._
  `.trim();

    await ctx.reply(summary, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ CONFIRMAR', 'rate_confirm')],
            [Markup.button.callback('❌ CANCELAR', 'rate_cancel')]
        ])
    });
}

/**
 * Confirma e salva a avaliação
 */
export async function handleConfirmRating(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = await stateService.getState(userId);
    const data = state?.temp_data;

    if (!data || !data.ad_id || !data.target_user_id || !data.rating_role || data.rating_recommend === undefined || !data.rating_stars) {
        await ctx.reply('❌ Dados incompletos. Tente novamente.');
        await stateService.reset(userId);
        return;
    }

    const rating = await ratingsService.createRating({
        ad_id: data.ad_id as string,
        from_user_id: userId,
        to_user_id: data.target_user_id as number,
        role: data.rating_role as 'BUYER' | 'SELLER',
        recommend: data.rating_recommend as boolean,
        rating: data.rating_stars as number,
        proposal_id: (data.proposal_id as string) || undefined
    });

    if (rating && rating.id) {
        // Remove os botões da mensagem de confirmação
        try {
            await ctx.editMessageReplyMarkup(undefined);
        } catch (e) {
            console.error('Erro ao remover botões de confirmação:', e);
        }

        // Confirmação definitiva para disparar histórico
        const confirmed = await ratingsService.confirmRating(rating.id);
        if (confirmed) {
            await ctx.reply('✅ Avaliação registrada e histórico de milhas atualizado com sucesso! Obrigado.');
        } else {
            // Se a avaliação foi salva mas o histórico falhou, avisa mas não bloqueia a UI
            await ctx.reply('✅ Avaliação registrada, porém houve um atraso ao atualizar seu histórico de milhas.');
        }
    } else {
        console.error('Falha ao criar avaliação no banco de dados. Dados:', data);
        await ctx.reply('❌ Erro ao salvar avaliação no banco de dados. Por favor, tente novamente mais tarde.');
    }

    await stateService.reset(userId);
}

/**
 * Cancela a avaliação
 */
export async function handleCancelRating(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Remove os botões da mensagem de confirmação
    try {
        await ctx.editMessageReplyMarkup(undefined);
    } catch (e) {
        console.error('Erro ao remover botões de cancelamento:', e);
    }

    await stateService.reset(userId);
    await ctx.reply('❌ Avaliação cancelada.');
}
