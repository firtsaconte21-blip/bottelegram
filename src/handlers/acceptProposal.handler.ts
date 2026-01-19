import { Context } from 'telegraf';
import { proposalsService } from '../services/proposals.service.js';
import { adsService } from '../services/ads.service.js';
import { TelegramService } from '../services/telegram.service.js';

let telegramService: TelegramService;

export function setAcceptTelegramService(service: TelegramService): void {
  telegramService = service;
}

/**
 * Handler para aceitar uma proposta (callback query)
 */
export async function handleAcceptProposal(
  ctx: Context,
  proposalId: string
): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || null;
  if (!userId) return;

  // Busca a proposta
  const proposal = await proposalsService.getById(proposalId);
  if (!proposal) {
    await ctx.answerCbQuery('❌ Proposta não encontrada.');
    return;
  }

  if (proposal.status !== 'PENDING') {
    await ctx.answerCbQuery('❌ Esta proposta já foi processada.');
    return;
  }

  // Busca o anúncio
  const ad = await adsService.getById(proposal.ad_id);
  if (!ad) {
    await ctx.answerCbQuery('❌ Anúncio não encontrado.');
    return;
  }

  // Verifica se é o dono do anúncio
  if (ad.user_id !== userId) {
    await ctx.answerCbQuery('❌ Você não tem permissão para aceitar esta proposta.');
    return;
  }

  // Aceita a proposta
  const acceptedProposal = await proposalsService.accept(proposalId);
  if (!acceptedProposal) {
    await ctx.answerCbQuery('❌ Erro ao aceitar proposta.');
    return;
  }

  // Marca anúncio como vendido
  await adsService.markAsSold(ad.id);

  // Responde ao callback
  await ctx.answerCbQuery('✅ Proposta aceita!');

  // Edita a mensagem original
  await ctx.editMessageText(
    `✅ *PROPOSTA ACEITA*\n\n` +
    `📋 Anúncio: ${ad.companhia} - ${ad.quantidade.toLocaleString('pt-BR')} milhas\n` +
    `💰 Valor acordado: R$ ${proposal.valor_proposta.toFixed(2)} por milheiro\n\n` +
    `_Os contatos serão enviados para ambas as partes._`,
    { parse_mode: 'Markdown' }
  );

  // Notifica ambas as partes
  if (telegramService) {
    await telegramService.notifyDealClosed(
      ad.user_id,
      username,
      proposal.from_user_id,
      proposal.from_username,
      ad,
      proposal.valor_proposta,
      proposal.id
    );
  }
}

/**
 * Handler para rejeitar uma proposta (callback query)
 */
export async function handleRejectProposal(
  ctx: Context,
  proposalId: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Busca a proposta
  const proposal = await proposalsService.getById(proposalId);
  if (!proposal) {
    await ctx.answerCbQuery('❌ Proposta não encontrada.');
    return;
  }

  if (proposal.status !== 'PENDING') {
    await ctx.answerCbQuery('❌ Esta proposta já foi processada.');
    return;
  }

  // Busca o anúncio
  const ad = await adsService.getById(proposal.ad_id);
  if (!ad) {
    await ctx.answerCbQuery('❌ Anúncio não encontrado.');
    return;
  }

  // Verifica se é o dono do anúncio
  if (ad.user_id !== userId) {
    await ctx.answerCbQuery('❌ Você não tem permissão para rejeitar esta proposta.');
    return;
  }

  // Rejeita a proposta
  await proposalsService.reject(proposalId);

  // Responde ao callback
  await ctx.answerCbQuery('❌ Proposta recusada.');

  // Edita a mensagem original
  await ctx.editMessageText(
    `❌ *PROPOSTA RECUSADA*\n\n` +
    `📋 Anúncio: ${ad.companhia} - ${ad.quantidade.toLocaleString('pt-BR')} milhas\n` +
    `💰 Valor proposto: R$ ${proposal.valor_proposta.toFixed(2)} por milheiro\n\n` +
    `_O comprador foi notificado._`,
    { parse_mode: 'Markdown' }
  );

  // Notifica o comprador
  if (telegramService) {
    await telegramService.notifyProposalRejected(
      proposal.from_user_id,
      proposal.from_username,
      ad,
      proposal.valor_proposta
    );
  }
}
