import { Context } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { adsService } from '../services/ads.service.js';
import { createTelegramService, TelegramService } from '../services/telegram.service.js';
import { Telegraf } from 'telegraf';

let telegramService: TelegramService;

export function setTelegramService(service: TelegramService): void {
  telegramService = service;
}

/**
 * Inicia o fluxo de criação de anúncio
 */
export async function startCreateAd(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Define estado inicial do fluxo
  await stateService.setState(userId, 'ASK_COMPANY', {});

  await ctx.reply(
    '🏢 *Qual a companhia aérea?*\n\n_Ex: LATAM, Azul, GOL, Smiles..._',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Processa a resposta da companhia
 */
export async function handleCompanyResponse(
  ctx: Context,
  text: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const validation = adsService.validateCompany(text);

  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}\n\n_Tente novamente:_`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  // Salva companhia e avança para próxima etapa
  await stateService.setState(userId, 'ASK_QUANTITY', {
    companhia: validation.value,
  });

  await ctx.reply(
    '📊 *Quantas milhas você deseja vender?*\n\n_Ex: 50000, 100.000..._',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Processa a resposta da quantidade
 */
export async function handleQuantityResponse(
  ctx: Context,
  text: string
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const validation = adsService.validateQuantity(text);

  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}\n\n_Tente novamente:_`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  // Atualiza dados e avança
  await stateService.updateTempData(userId, { quantidade: validation.value });
  await stateService.setState(userId, 'ASK_PRICE');

  await ctx.reply(
    '💰 *Qual o valor do milheiro (em reais)?*\n\n_Ex: 15.50, 20, 12.00..._',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Processa a resposta do preço e finaliza criação
 */
export async function handlePriceResponse(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || null;
  if (!userId) return;

  const validation = adsService.validatePrice(text);

  if (!validation.valid) {
    await ctx.reply(`❌ ${validation.error}\n\n_Tente novamente:_`, {
      parse_mode: 'Markdown',
    });
    return;
  }

  // Atualiza com o preço
  await stateService.updateTempData(userId, { valor_milheiro: validation.value });

  // Busca dados completos
  const state = await stateService.getState(userId);
  if (!state?.temp_data) {
    await ctx.reply('❌ Erro ao recuperar dados. Por favor, comece novamente com /start');
    await stateService.reset(userId);
    return;
  }

  // Cria o anúncio
  const ad = await adsService.createFromTempData(userId, username, state.temp_data);

  if (!ad) {
    await ctx.reply('❌ Erro ao criar anúncio. Por favor, tente novamente.');
    await stateService.reset(userId);
    return;
  }

  // Mostra resumo
  const valorTotal = (ad.quantidade / 1000) * ad.valor_milheiro;
  
  await ctx.reply(
    `✅ *Anúncio criado com sucesso!*\n\n` +
    `🏢 *Companhia:* ${ad.companhia}\n` +
    `📊 *Quantidade:* ${ad.quantidade.toLocaleString('pt-BR')} milhas\n` +
    `💰 *Valor:* R$ ${ad.valor_milheiro.toFixed(2)} por milheiro\n` +
    `💵 *Total:* R$ ${valorTotal.toFixed(2)}\n\n` +
    `_Publicando no grupo..._`,
    { parse_mode: 'Markdown' }
  );

  // Publica no grupo
  if (telegramService) {
    const messageId = await telegramService.publishAdToGroup(ad);
    
    if (messageId) {
      await adsService.updateMessageInfo(ad.id, messageId, parseInt(process.env.TELEGRAM_GROUP_ID || '0'));
      await ctx.reply('📢 Seu anúncio foi publicado no grupo! Você receberá notificações de propostas aqui.');
    } else {
      await ctx.reply('⚠️ Não foi possível publicar no grupo, mas seu anúncio está ativo.');
    }
  }

  // Reseta estado
  await stateService.reset(userId);
}
