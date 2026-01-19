import { Context } from 'telegraf';
import { stateService } from '../services/state.service.js';
import { adsService } from '../services/ads.service.js';
import { db } from '../repositories/supabase.js';
import { userService } from '../services/user.service.js';
import { authService } from '../services/auth.service.js';
import { startProposalFlow } from './proposal.handler.js';

/**
 * Handler para o comando /start
 * Suporta deep links no formato: /start proposta_<ad_id>
 */
export async function handleStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatType = ctx.chat?.type;

  if (!userId) return;

  // Reseta qualquer estado anterior ao iniciar
  await stateService.reset(userId);

  // Registra usuário (tracking de "Membro desde")
  await userService.registerUser(userId, ctx.from?.username || null);

  // Ignora mensagens em grupos
  if (chatType !== 'private') {
    return;
  }

  // Verifica se há payload (deep link)
  const message = ctx.message;
  if (message && 'text' in message) {
    const parts = message.text.split(' ');

    if (parts.length > 1) {
      const payload = parts[1];

      // Deep link para fazer proposta
      if (payload.startsWith('proposta_')) {
        const adId = payload.replace('proposta_', '');
        await handleProposalDeepLink(ctx, userId, adId);
        return;
      }
    }
  }

  // Comando /start normal - mostra menu principal
  await showMainMenu(ctx, userId);
}

/**
 * Mostra o fluxo de boas-vindas para usuários não logados
 */
export async function showWelcomeFlow(ctx: Context, userId: number): Promise<void> {
  const welcomeMessage = `
🛫 *Bem-vindo ao Marketplace de Milhas!*

Parece que você ainda não tem uma conta vinculada.

📝 [Clique aqui para criar sua conta](https://websitetelegram-9jwc.vercel.app/)

🔑 *Se você já fez o cadastro:*
Digite seu e-mail abaixo para fazer login
    `.trim();

  // Define o estado para aguardar o e-mail
  await stateService.setState(userId, 'ASK_LOGIN_EMAIL');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown'
  });
}

/**
 * Mostra o menu principal do bot
 */
async function showMainMenu(ctx: Context, userId: number): Promise<void> {
  // Verifica se o usuário está vinculado a uma conta do site
  const linkedUserId = await authService.getLinkedUser(userId);

  if (!linkedUserId) {
    return showWelcomeFlow(ctx, userId);
  }

  // Usuário está logado - mostra menu principal
  const welcomeMessage = `
🛫 *Bem-vindo ao Marketplace de Milhas!*

Aqui você pode comprar e vender milhas aéreas de forma segura e prática.

*Como funciona:*
1️⃣ Crie um anúncio de venda
2️⃣ Seu anúncio será publicado no grupo
3️⃣ Interessados fazem propostas
4️⃣ Você aceita ou recusa
5️⃣ Negociem diretamente!

*O que deseja fazer?*
  `.trim();

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Criar anúncio de COMPRA', callback_data: 'create_buy_ad' },
        ],
        [
          { text: '🔵 Criar anúncio de VENDA', callback_data: 'create_sell_ad' },
        ],
        [
          { text: '📦 Meus Anúncios', callback_data: 'my_ads' },
          { text: '❓ Ajuda', callback_data: 'help' },
        ],
      ],
    },
  });
}

/**
 * Processa deep link de proposta
 */
async function handleProposalDeepLink(
  ctx: Context,
  userId: number,
  adId: string
): Promise<void> {
  // Busca o anúncio
  const ad = await adsService.getById(adId);

  if (!ad) {
    await ctx.reply('❌ Anúncio não encontrado. Ele pode ter sido removido.');
    await showMainMenu(ctx, userId);
    return;
  }

  if (ad.status !== 'ACTIVE') {
    await ctx.reply('❌ Este anúncio não está mais disponível.');
    await showMainMenu(ctx, userId);
    return;
  }

  // Verifica acesso (Login primeiro)
  const siteUserId = await authService.getLinkedUser(userId);
  if (!siteUserId) {
    return showWelcomeFlow(ctx, userId);
  }

  // Se o anúncio é de VENDA, o usuário quer COMPRAR (permissão BUY)
  // Se o anúncio é de COMPRA, o usuário quer VENDER (permissão SELL)
  const requiredPermission = ad.type === 'SELL' ? 'BUY' : 'SELL';

  const { checkAccess } = await import('../services/middleware.service.js');
  await checkAccess(ctx, async () => {
    // Verifica se não é o próprio vendedor
    if (ad.user_id === userId) {
      await ctx.reply('❌ Você não pode fazer proposta no seu próprio anúncio!');
      await showMainMenu(ctx, userId);
      return;
    }

    // Mostra detalhes do anúncio e as opções iniciais (Comprar tudo / Personalizar)
    await startProposalFlow(ctx, adId);
  }, requiredPermission);
}

/**
 * Handler para o callback de ajuda
 */
export async function handleHelp(ctx: Context): Promise<void> {
  const helpMessage = `
❓ *Como usar o Marketplace de Milhas*

*Para Vendedores:*
1. Clique em "Criar Anúncio"
2. Informe a companhia aérea
3. Informe a quantidade de milhas
4. Informe o valor do milheiro
5. Seu anúncio será publicado automaticamente!

*Para Compradores:*
1. Veja os anúncios no grupo
2. Clique em "Fazer Proposta"
3. Informe quanto deseja pagar por milheiro
4. Aguarde a resposta do vendedor

*Importante:*
⚠️ O bot apenas conecta compradores e vendedores
⚠️ A negociação final é feita diretamente entre as partes
⚠️ Verifique a reputação antes de negociar
  `.trim();

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
