import { Context } from 'telegraf';
import { adsService } from '../services/ads.service.js';

/**
 * Handler para listar anúncios do usuário
 */
export async function handleMyAds(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const ads = await adsService.getActiveByUser(userId);

  if (ads.length === 0) {
    await ctx.reply(
      '📋 *Meus Anúncios*\n\n' +
      '_Você ainda não tem anúncios ativos._\n\n' +
      'Use o botão abaixo para criar seu primeiro anúncio!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Criar Anúncio', callback_data: 'create_ad' }],
          ],
        },
      }
    );
    return;
  }

  let message = '📋 *Meus Anúncios Ativos*\n\n';

  ads.forEach((ad, index) => {
    const valorTotal = (ad.quantidade / 1000) * ad.valor_milheiro;
    message += `*${index + 1}. ${ad.companhia}*\n`;
    message += `   📊 ${ad.quantidade.toLocaleString('pt-BR')} milhas\n`;
    message += `   💰 R$ ${ad.valor_milheiro.toFixed(2)}/milheiro\n`;
    message += `   💵 Total: R$ ${valorTotal.toFixed(2)}\n`;
    message += `   🆔 \`${ad.id.slice(0, 8)}\`\n\n`;
  });

  message += `_Total: ${ads.length} anúncio(s) ativo(s)_`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 Criar Novo Anúncio', callback_data: 'create_ad' }],
        [{ text: '🔙 Voltar', callback_data: 'back_to_menu' }],
      ],
    },
  });
}
