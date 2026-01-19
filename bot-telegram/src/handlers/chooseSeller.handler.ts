
import { Context } from 'telegraf';
import { proposalsService } from '../services/proposals.service.js';
import { adsService } from '../services/ads.service.js';
import { TelegramService } from '../services/telegram.service.js';

let telegramService: TelegramService;

export function setChooseSellerTelegramService(service: TelegramService) {
    telegramService = service;
}

/**
 * Handler para quando o COMPRADOR escolhe um VENDEDOR (Aceita proposta de VENDA)
 * Callback: choose_seller_{proposalId}
 */
export async function handleChooseSeller(ctx: Context, proposalId: string): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Busca a proposta
    const proposal = await proposalsService.getById(proposalId);
    if (!proposal) {
        await ctx.reply('❌ Proposta não encontrada.');
        return;
    }

    // Busca o anúncio
    const ad = await adsService.getById(proposal.ad_id);
    if (!ad) {
        await ctx.reply('❌ Anúncio não encontrado.');
        return;
    }

    // Validação: Apenas o dono do anúncio (COMPRADOR) pode escolher o vendedor
    if (ad.user_id !== userId) {
        await ctx.reply('❌ Você não tem permissão para realizar esta ação.');
        return;
    }

    if (ad.status !== 'ACTIVE') {
        await ctx.reply('❌ Este anúncio já foi finalizado ou cancelado.');
        return;
    }

    if (proposal.status !== 'PENDING') {
        await ctx.reply('❌ Esta proposta não está mais pendente.');
        return;
    }

    // Aceita a proposta
    const success = await proposalsService.accept(proposalId);
    if (!success) {
        await ctx.reply('❌ Erro ao aceitar proposta. Tente novamente.');
        return;
    }

    await ctx.reply(`✅ *Você escolheu este vendedor!*
  
  A negociação foi iniciada e ambos receberão os contatos um do outro.`, { parse_mode: 'Markdown' });

    // Notifica ambas as partes
    // No fluxo de COMPRA:
    // Dono do Ad (userId) = COMPRADOR
    // Dono da Proposta (proposal.from_user_id) = VENDEDOR
    if (telegramService) {
        await telegramService.notifyDealClosed(
            proposal.from_user_id, // Seller ID
            proposal.from_username, // Seller Username
            userId, // Buyer ID (Ad Owner)
            ctx.from?.username || null, // Buyer Username
            ad,
            proposal.valor_proposta,
            proposalId
        );
    }
}
