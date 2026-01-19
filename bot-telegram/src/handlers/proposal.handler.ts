import { Context } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { proposalsService } from '../services/proposals.service.js';
import { adsService } from '../services/ads.service.js';
import { TelegramService } from '../services/telegram.service.js';
import { userService } from '../services/user.service.js';
import { historyService } from '../services/history.service.js';

let telegramService: TelegramService;

export function setProposalTelegramService(service: TelegramService): void {
  telegramService = service;
}

export async function startProposalFlow(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const ad = await adsService.getById(adId);
  if (!ad || ad.status !== 'ACTIVE') {
    await ctx.reply('❌ Este anúncio não está mais disponível.');
    return;
  }

  // Prepara dados temporários (sempre começamos com a quantidade total do anúncio)
  await stateService.setState(userId, 'IDLE', { ad_id: adId, quantidade: ad.quantidade });

  if (ad.type === 'BUY') {
    // NOVO FLUXO PARA ANÚNCIO DE COMPRA (O usuário quer VENDER para o comprador)
    const adDetails = `
📋 *Detalhes do Anúncio*

🏢 *Companhia:* ${ad.companhia}
📊 *Quantidade:* ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor solicitado:* R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')} por milheiro

Gostaria de manter a oferta no anúncio ou fazer uma nova proposta?
    `.trim();

    await ctx.reply(adDetails, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Manter oferta', callback_data: `prop_keep_price_${adId}` },
          ],
          [
            { text: '🔁 Fazer nova proposta', callback_data: `prop_new_price_${adId}` },
          ],
        ],
      },
    });
    return;
  }

  // FLUXO PARA ANÚNCIO DE VENDA (O usuário quer COMPRAR do vendedor)
  const message = `
📋 *Detalhes do anúncio selecionado*

🏢 *Companhia:* ${ad.companhia}
📊 *Quantidade disponível:* ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor anunciado:* R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')} por milheiro

Você tem interesse em comprar todas as milhas disponíveis ou deseja personalizar a quantidade?
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Comprar todas as milhas', callback_data: `prop_all_${adId}` },
        ],
        [
          { text: '✏️ Personalizar quantidade', callback_data: `prop_custom_qty_${adId}` },
        ],
      ],
    },
  });
}

/**
 * Processa o valor da proposta enviado diretamente (Não mais usado para o fluxo inicial, mas mantido por segurança)
 */
export async function handleProposalValueResponse(
  ctx: Context,
  text: string
): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || null;
  if (!userId) return;

  const state = await stateService.getState(userId);
  if (!state?.temp_data?.ad_id) return;

  const adId = state.temp_data.ad_id as string;
  const qty = state.temp_data.quantidade as number;

  const ad = await adsService.getById(adId);
  if (!ad || ad.status !== 'ACTIVE') {
    await ctx.reply('❌ Este anúncio não está mais disponível.');
    await stateService.reset(userId);
    return;
  }

  const validation = proposalsService.validateProposalValue(text);
  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}\n\n_Tente novamente:_`, { parse_mode: 'Markdown' });
    return;
  }

  // Cria a proposta (sem o passo de confirmação extra, conforme o fluxo antigo)
  const proposal = await proposalsService.create(adId, userId, username, qty, validation.value);

  if (!proposal) {
    await ctx.reply('❌ Erro ao enviar proposta.');
    return;
  }

  await ctx.reply(
    `✅ *Proposta enviada com sucesso!*\n\n` +
    `💰 *Valor:* R$ ${validation.value.toFixed(2).replace('.', ',')} por milheiro\n` +
    `📊 *Quantidade:* ${qty.toLocaleString('pt-BR')} milhas\n\n` +
    `_Aguarde a resposta do comprador. Você será notificado aqui 📩_`,
    { parse_mode: 'Markdown' }
  );

  // Notifica o dono do anúncio
  if (telegramService) {
    const fromProfile = await userService.getUserProfile(userId);
    const monthlyStats = await historyService.getMonthlyStats(userId, 'venda');

    await telegramService.notifyBuyerNewSellerProposal(
      ad.user_id,
      ad,
      proposal.id,
      validation.value,
      qty,
      userId, // sellerId
      {
        username,
        ...fromProfile,
        monthlyStats
      }
    );
  }

  await stateService.reset(userId);
}

/**
 * Handler para "Comprar todas as milhas"
 */
export async function handleProposalBuyAll(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const ad = await adsService.getById(adId);
  if (!ad) return;

  await stateService.setState(userId, 'IDLE', { ad_id: adId, quantidade: ad.quantidade });

  const message = `
✅ *Você escolheu comprar todas as milhas disponíveis.*

📊 *Quantidade:* ${ad.quantidade.toLocaleString('pt-BR')} milhas
💰 *Valor anunciado:* R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')} por milheiro

Deseja manter o valor anunciado ou fazer uma nova proposta?
  `.trim();

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Manter valor anunciado', callback_data: `prop_keep_price_${adId}` },
        ],
        [
          { text: '🔁 Fazer nova proposta', callback_data: `prop_new_price_${adId}` },
        ],
      ],
    },
  });
}

/**
 * Handler para "Personalizar quantidade"
 */
export async function handleProposalCustomQty(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await stateService.setState(userId, 'ASK_PROPOSAL_QUANTITY', { ad_id: adId });

  await ctx.editMessageText(
    `✏️ *Quantas milhas você deseja comprar?*\n\n` +
    `📌 Envie apenas o número\n` +
    `Exemplo: 15000`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Processa a resposta de quantidade personalizada
 */
export async function handleProposalQuantityResponse(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await stateService.getState(userId);
  const adId = state?.temp_data?.ad_id as string;
  if (!adId) return;

  const ad = await adsService.getById(adId);
  if (!ad) return;

  const qty = parseInt(text.replace(/[^\d]/g, ''), 10);
  if (isNaN(qty) || qty <= 0) {
    await ctx.reply('❌ Quantidade inválida. Por favor, envie apenas números maiores que zero.');
    return;
  }

  // Atualiza estado
  await stateService.setState(userId, 'IDLE', { ad_id: adId, quantidade: qty });

  const message = `
📌 *Resumo da compra*

📊 *Quantidade escolhida:* ${qty.toLocaleString('pt-BR')} milhas
💰 *Valor anunciado:* R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')} por milheiro

Deseja manter o valor anunciado ou fazer uma nova proposta?
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Manter valor anunciado', callback_data: `prop_keep_price_${adId}` },
        ],
        [
          { text: '🔁 Fazer nova proposta', callback_data: `prop_new_price_${adId}` },
        ],
      ],
    },
  });
}

/**
 * Handler para "Manter valor anunciado"
 */
export async function handleProposalKeepPrice(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await stateService.getState(userId);
  const qty = state?.temp_data?.quantidade as number;
  const ad = await adsService.getById(adId);
  if (!ad) return;

  // Atualiza temp_data com o preço anunciado
  await stateService.setState(userId, 'IDLE', { ...state?.temp_data, valor_milheiro: ad.valor_milheiro });

  const message = `
📌 *Resumo da proposta*

🏢 *Companhia:* ${ad.companhia}
📊 *Quantidade:* ${qty.toLocaleString('pt-BR')} milhas
💰 *Valor:* R$ ${ad.valor_milheiro.toFixed(2).replace('.', ',')} por milheiro

Deseja confirmar o envio da proposta?
  `.trim();

  await ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Confirmar proposta', callback_data: `prop_confirm_${adId}` },
        ],
        [
          { text: '🔄 Cancelar', callback_data: 'back_to_menu' },
        ],
      ],
    },
  });
}

/**
 * Handler para "Fazer nova proposta" (pede valor)
 */
export async function handleProposalNewPrice(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  await stateService.setState(userId, 'ASK_PROPOSAL_PRICE', { ... (await stateService.getState(userId))?.temp_data });

  await ctx.editMessageText(
    `💬 *Qual valor você deseja propor por milheiro?*\n\n` +
    `📌 Envie apenas o número\n` +
    `Exemplo: 24.50`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Processa a resposta de preço personalizado
 */
export async function handleProposalPriceResponse(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = await stateService.getState(userId);
  const adId = state?.temp_data?.ad_id as string;
  const qty = state?.temp_data?.quantidade as number;
  if (!adId) return;

  const validation = proposalsService.validateProposalValue(text);
  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}\n\n_Tente novamente:_`, { parse_mode: 'Markdown' });
    return;
  }

  // Atualiza estado
  await stateService.setState(userId, 'IDLE', { ...state?.temp_data, valor_milheiro: validation.value });

  const message = `
📌 *Resumo da proposta*

📊 *Quantidade:* ${qty.toLocaleString('pt-BR')} milhas
💰 *Seu valor:* R$ ${validation.value.toFixed(2).replace('.', ',')} por milheiro

Deseja confirmar o envio?
  `.trim();

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Confirmar proposta', callback_data: `prop_confirm_${adId}` },
        ],
        [
          { text: '🔄 Reiniciar', callback_data: `prop_new_price_${adId}` },
        ],
      ],
    },
  });
}

/**
 * Finaliza e envia a proposta
 */
export async function handleProposalConfirm(ctx: Context, adId: string): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || null;
  if (!userId) return;

  const state = await stateService.getState(userId);
  const qty = state?.temp_data?.quantidade as number;
  const price = state?.temp_data?.valor_milheiro as number;

  const ad = await adsService.getById(adId);
  if (!ad || ad.status !== 'ACTIVE') {
    await ctx.reply('❌ Este anúncio não está mais disponível.');
    await stateService.reset(userId);
    return;
  }

  // Cria a proposta
  const proposal = await proposalsService.create(
    adId,
    userId,
    username,
    qty,
    price
  );

  if (!proposal) {
    console.error(`[PROPOSAL] Failed to create proposal for ad ${adId} from user ${userId}`);
    await ctx.reply('❌ Erro ao enviar proposta. Por favor, tente novamente.');
    return;
  }

  // Confirma para o usuário
  await ctx.editMessageText(
    `✅ *Proposta enviada com sucesso!*\n\n` +
    `💰 *Valor:* R$ ${price.toFixed(2).replace('.', ',')} por milheiro\n` +
    `📊 *Quantidade:* ${qty.toLocaleString('pt-BR')} milhas\n\n` +
    `_Aguarde a resposta do ${ad.type === 'SELL' ? 'vendedor' : 'comprador'}. Você será notificado aqui 📩_`,
    { parse_mode: 'Markdown' }
  );

  // Notifica o dono do anúncio
  if (telegramService) {
    const fromProfile = await userService.getUserProfile(userId);

    if (ad.type === 'SELL') {
      const monthlyStats = await historyService.getMonthlyStats(userId, 'compra');
      await telegramService.notifySellerNewProposal(
        ad.user_id,
        ad,
        proposal.id,
        price,
        qty,
        userId, // buyerId
        {
          username,
          ...fromProfile,
          monthlyStats
        }
      );
    } else {
      const monthlyStats = await historyService.getMonthlyStats(userId, 'venda');
      await telegramService.notifyBuyerNewSellerProposal(
        ad.user_id,
        ad,
        proposal.id,
        price,
        qty,
        userId, // sellerId 
        {
          username,
          ...fromProfile,
          monthlyStats
        }
      );
    }
  }

  await stateService.reset(userId);
}
