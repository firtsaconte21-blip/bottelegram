import { Telegraf, Markup } from 'telegraf';
import { config, validateConfig } from './config/index.js';
import { createTelegramService } from './services/telegram.service.js';
import { stateService } from './services/state.service.js';
import express from 'express';
import { pixService } from './services/pix.service.js';
import { supabase } from './repositories/supabase.js';
import { checkAccess } from './services/middleware.service.js';

// Handlers
import { handleStart, handleHelp } from './handlers/start.handler.js';
import {
  handleLogin,
  handleLogout,
  handleLoginEmail,
  handleLoginPassword,
  handleResendEmail,
  handleVerificationHelp
} from './handlers/auth.handler.js';
import { authService } from './services/auth.service.js';
import {
  startCreateAd,
  handleCompanyResponse,
  handleQuantityResponse,
  handlePriceResponse,
  setTelegramService
} from './handlers/createAd.handler.js';
import {
  startCreateBuyAd,
  handleBuyMilesResponse,
  handleBuyProgramResponse,
  handleBuyPassengersResponse,
  handleBuyUrgentResponse,
  handleBuyPriceResponse,
  handleConfirmBuyAd,
  setBuyAdTelegramService
} from './handlers/createBuyAd.handler.js';
import {
  startCreateSellAd,
  handleSellMilesResponse,
  handleSellProgramResponse,
  handleSellPriceResponse,
  handleSellUrgentResponse,
  handleConfirmSellAd,
  setSellAdTelegramService
} from './handlers/createSellAd.handler.js';
import { showPlans, handlePlanSelection } from './handlers/plans.handler.js';
import {
  handleProposalBuyAll,
  handleProposalCustomQty,
  handleProposalKeepPrice,
  handleProposalNewPrice,
  handleProposalConfirm,
  handleProposalQuantityResponse,
  handleProposalPriceResponse,
  handleProposalValueResponse,
  setProposalTelegramService
} from './handlers/proposal.handler.js';
import { handleAcceptProposal, handleRejectProposal, setAcceptTelegramService } from './handlers/acceptProposal.handler.js';
import { handleShowDetailedProfile, setUserStatsTelegramService } from './handlers/userStats.handler.js';
import {
  startRating,
  handleRatingRecommend,
  handleRatingStars,
  handleConfirmRating,
  handleCancelRating
} from './handlers/ratings.handler.js';
import { handleMyAds } from './handlers/myAds.handler.js';
import { handleChooseSeller, setChooseSellerTelegramService } from './handlers/chooseSeller.handler.js';
import { handleDeleteAd } from './handlers/deleteAd.handler.js';
import { adsService } from './services/ads.service.js';
import { startPixFlow, handlePixCpfResponse, setPixTelegramService } from './handlers/pix.handler.js';

// Valida configurações
validateConfig();

// Inicializa o bot
const bot = new Telegraf(config.telegramBotToken);
const telegramService = createTelegramService(bot);

// Injeta o serviço nos handlers
setTelegramService(telegramService);
setProposalTelegramService(telegramService);
setTelegramService(telegramService);
setBuyAdTelegramService(telegramService);
setSellAdTelegramService(telegramService);
setProposalTelegramService(telegramService);
setAcceptTelegramService(telegramService);
setChooseSellerTelegramService(telegramService);
setUserStatsTelegramService(telegramService);
setPixTelegramService(telegramService);

// ==================== WEBHOOK SERVER ====================
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  console.log('📥 Webhook recebido - Body:', JSON.stringify(req.body, null, 2));
  const { type, data, action } = req.body;

  if (type === 'payment' || action?.startsWith('payment.')) {
    const paymentId = data?.id || req.body.id;
    console.log(`🔔 Processando pagamento ID: ${paymentId}`);

    const payment = await pixService.getPaymentStatus(paymentId);
    if (!payment) {
      console.error(`❌ Não foi possível obter dados do pagamento ${paymentId} no Mercado Pago`);
      return res.status(200).send('Error');
    }

    console.log(`💳 Status do pagamento ${paymentId}: ${payment.status}`);

    if (payment.status === 'approved') {
      // Verifica se o pagamento já foi processado (Idempotência)
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('external_id', paymentId.toString())
        .maybeSingle();

      if (existingPayment) {
        console.log(`ℹ️ Pagamento ${paymentId} já foi processado anteriormente.`);
        return res.status(200).send('OK');
      }

      const externalRef = payment.external_reference || '';
      const parts = externalRef.split('_');
      const userId = parseInt(parts[0], 10);
      const planId = parts[1]; // UUID do plano

      if (!isNaN(userId)) {
        // Se temos um planId explicito no external_reference
        if (planId) {
          const { data: plan } = await supabase
            .from('plans')
            .select('id, name, duration_days')
            .eq('id', planId)
            .single();

          if (plan) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + (plan.duration_days || 365));

            await supabase.from('subscriptions').insert({
              user_id: userId,
              plan_id: plan.id,
              status: 'active',
              start_date: new Date().toISOString(),
              end_date: endDate.toISOString()
            });

            await supabase.from('payments').insert({
              user_id: userId,
              amount: payment.transaction_amount,
              status: 'approved',
              external_id: paymentId.toString(),
              payment_method: 'pix'
            });

            await bot.telegram.sendMessage(userId, `✅ *Pagamento Confirmado!* \n\nSeu plano *${plan.name}* foi ativado com sucesso e é válido até ${endDate.toLocaleDateString('pt-BR')}. \n\n🚀 Agora você pode usar todos os recursos liberados!`, {
              parse_mode: 'Markdown'
            });
            console.log(`✅ Pagamento ${paymentId} confirmado e plano ${plan.name} ativado para o usuário ${userId}`);
            return;
          }
        }

        // Fallback: Busca o plano baseado no valor pago (aproximado) se não houver planId no ref
        const amount = payment.transaction_amount;
        const { data: plans } = await supabase
          .from('plans')
          .select('id, name, duration_days')
          .gte('price', amount - 0.1)
          .lte('price', amount + 0.1)
          .limit(1)
          .maybeSingle();

        if (plans) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + (plans.duration_days || 365));

          await supabase.from('subscriptions').insert({
            user_id: userId,
            plan_id: plans.id,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: endDate.toISOString()
          });

          await supabase.from('payments').insert({
            user_id: userId,
            amount: amount,
            status: 'approved',
            external_id: paymentId.toString(),
            payment_method: 'pix'
          });

          await bot.telegram.sendMessage(userId, `✅ *Pagamento Confirmado!* \n\nSeu plano *${plans.name}* foi ativado com sucesso e é válido até ${endDate.toLocaleDateString('pt-BR')}. \n\nObrigado!`, {
            parse_mode: 'Markdown'
          });
          console.log(`✅ Pagamento ${paymentId} confirmado (fallback por valor) e plano ${plans.name} ativado para o usuário ${userId}`);
        } else {
          await bot.telegram.sendMessage(userId, '✅ *Pagamento Confirmado!* \n\nRecebemos seu PIX, mas não conseguimos identificar o plano automaticamente. Nossa equipe vai ativar para você em breve!', {
            parse_mode: 'Markdown'
          });
          console.log(`⚠️ Pagamento ${paymentId} confirmado mas plano não identificado para o valor ${amount}`);
        }
      }
    }
  }

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor de Webhooks rodando na porta ${PORT}`);
});

console.log('🤖 Iniciando bot de Marketplace de Milhas...');

// ==================== COMANDOS ====================

bot.command('start', handleStart);
bot.command('login', handleLogin);
bot.command('pix', startPixFlow);
bot.command('planos', showPlans);
bot.command('exit', handleLogout);

bot.command('cancelar', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  await stateService.reset(userId);
  await ctx.reply('✅ Operação cancelada. Use /start para começar novamente.');
});

// Boas-vindas para novos membros do grupo
bot.on('new_chat_members', async (ctx) => {
  const newMembers = ctx.message.new_chat_members;
  const chatId = ctx.chat.id.toString();

  // Verifica se o evento veio do grupo principal
  if (chatId !== config.telegramGroupId) return;

  for (const member of newMembers) {
    if (member.is_bot) continue;

    const welcomeMsg = `
🌟 *Bem-vindo(a) ao Marketplace de Milhas!* 🌟

Olá! 👋 É um prazer ter você aqui. Nosso marketplace foi criado para facilitar a compra e venda de milhas de forma simples, segura e rápida.

💡 *Como funciona:*

*Comprar milhas:* Você pode adquirir milhas de outros usuários que têm pontos acumulados e usá-las para emitir suas passagens.

*Vender milhas:* Se você possui milhas, pode vendê-las emitindo passagens para pessoas interessadas em viajar.

✨ *Por que usar nosso marketplace?*

✅ Transações seguras e confiáveis
✅ Conexão direta entre compradores e vendedores
✅ Facilidade na emissão de passagens

🚀 *Comece agora explorando as ofertas disponíveis ou anunciando suas milhas!*
    `.trim();

    try {
      await ctx.telegram.sendMessage(member.id, welcomeMsg, { parse_mode: 'Markdown' });
      console.log(`✅ Mensagem de boas-vindas enviada para o PV de ${member.first_name} (${member.id})`);
    } catch (error: any) {
      // O Telegram só permite enviar PV se o usuário já tiver interagido com o bot antes
      console.warn(`⚠️ Não foi possível enviar PV para ${member.id}: (Pode ser que o usuário nunca tenha iniciado o bot)`);
    }
  }
});

// Catch-all para comandos de usuários não registrados
bot.on('message', async (ctx, next) => {
  const userId = ctx.from?.id;
  const message = ctx.message;

  if (!userId || !('text' in message)) return next();

  const text = message.text;

  // Se for um comando (começa com /) e não for /start, /login, /pix, /cancelar ou /exit
  if (text.startsWith('/') && !['/start', '/login', '/pix', '/cancelar', '/exit'].some(cmd => text.startsWith(cmd))) {
    const linkedUserId = await authService.getLinkedUser(userId);

    if (!linkedUserId) {
      // Redireciona para o fluxo de boas-vindas
      await handleStart(ctx);
      return;
    }
  }

  return next();
});

// ==================== CALLBACK QUERIES ====================

bot.action(/^buy_plan_(.+)$/, handlePlanSelection);

bot.action('create_sell_ad', async (ctx, next) => {
  await ctx.answerCbQuery();
  return checkAccess(ctx, () => startCreateSellAd(ctx), 'SELL');
});

bot.action('create_buy_ad', async (ctx, next) => {
  await ctx.answerCbQuery();
  return checkAccess(ctx, () => startCreateBuyAd(ctx), 'BUY');
});

bot.action('my_ads', async (ctx) => {
  await ctx.answerCbQuery();
  return checkAccess(ctx, () => handleMyAds(ctx));
});

// Handler genérico para "Criar Anúncio" (usado no Meus Anúncios)
bot.action('create_ad', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from?.id;
  if (!userId) return;

  const { subscriptionService } = await import('./services/subscription.service.js');
  const sub = await subscriptionService.getActiveSubscription(userId);

  if (!sub) {
    return showPlans(ctx);
  }

  const { data: plan } = await supabase.from('plans').select('features').eq('id', sub.plan_id).single();
  const features = plan?.features || [];

  if (features.includes('BUY') && features.includes('SELL')) {
    // Se tem ambos, pergunta qual quer criar
    return ctx.reply('📝 *O que você deseja criar?*', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🟢 Anúncio de COMPRA', 'create_buy_ad')],
        [Markup.button.callback('🔵 Anúncio de VENDA', 'create_sell_ad')]
      ])
    });
  } else if (features.includes('SELL')) {
    return checkAccess(ctx, () => startCreateSellAd(ctx), 'SELL');
  } else if (features.includes('BUY')) {
    return checkAccess(ctx, () => startCreateBuyAd(ctx), 'BUY');
  } else {
    return showPlans(ctx);
  }
});

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await handleHelp(ctx);
});

bot.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await handleStart(ctx);
});

// Aceitar/Rejeitar propostas
bot.action(/^accept_(.+)$/, async (ctx) => {
  const proposalId = ctx.match[1];
  await handleAcceptProposal(ctx, proposalId);
});

bot.action(/^reject_(.+)$/, async (ctx) => {
  const proposalId = ctx.match[1];
  await handleRejectProposal(ctx, proposalId);
});

bot.action(/^choose_seller_(.+)$/, async (ctx) => {
  const proposalId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleChooseSeller(ctx, proposalId);
});

// DELETE AD CALLBACK
bot.action(/^cancel_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleDeleteAd(ctx, adId);
});

// AVALIAÇÕES (Reputation System)
bot.action('rate_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  await handleConfirmRating(ctx);
});

bot.action('rate_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await handleCancelRating(ctx);
});

bot.action('rate_rec_yes', async (ctx) => {
  await ctx.answerCbQuery();
  await handleRatingRecommend(ctx, 'yes');
});

bot.action('rate_rec_no', async (ctx) => {
  await ctx.answerCbQuery();
  await handleRatingRecommend(ctx, 'no');
});

bot.action(/^rate_star_(\d+)$/, async (ctx) => {
  const stars = parseInt(ctx.match[1], 10);
  await ctx.answerCbQuery();
  await handleRatingStars(ctx, stars);
});

// Start Rating: rate_<adId>_<targetUserId>_<proposalId>
// Ex: rate_uuid_userid_uuid
bot.action(/^rate_([^_]+)_(\d+)_([^_]+)$/, async (ctx) => {
  const adId = ctx.match[1];
  const targetUserId = ctx.match[2];
  const proposalId = ctx.match[3];

  await ctx.answerCbQuery();
  await startRating(ctx, `${adId}_${targetUserId}_${proposalId}`);
});

// Detailed User Stats: user_stats_<proposalId>
bot.action(/^user_stats_([^_]+)$/, async (ctx) => {
  const payload = ctx.match[1];
  await handleShowDetailedProfile(ctx, payload);
});

// Ações de Verificação de E-mail
bot.action(/^resend_email_(.+)$/, async (ctx) => {
  const email = ctx.match[1];
  await handleResendEmail(ctx, email);
});

bot.action('show_verification_help', async (ctx) => {
  await handleVerificationHelp(ctx);
});

// ==================== PROPOSAL CALLBACKS ====================

bot.action(/^prop_all_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  return checkAccess(ctx, () => handleProposalBuyAll(ctx, adId));
});

bot.action(/^prop_custom_qty_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  const ad = await adsService.getById(adId);
  const requiredPermission = ad?.type === 'SELL' ? 'BUY' : 'SELL';
  return checkAccess(ctx, () => handleProposalCustomQty(ctx, adId), requiredPermission);
});

bot.action(/^prop_keep_price_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleProposalKeepPrice(ctx, adId);
});

bot.action(/^prop_new_price_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleProposalNewPrice(ctx, adId);
});

bot.action(/^prop_confirm_(.+)$/, async (ctx) => {
  const adId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleProposalConfirm(ctx, adId);
});

// SELL AD CALLBACKS
bot.action(/^program_sell_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  // Passa o texto completo do botão ou o próprio callback pra ser parseado
  await handleSellProgramResponse(ctx, ctx.match[0]);
});

bot.action('confirm_sell_yes', async (ctx) => {
  await ctx.answerCbQuery();
  await handleConfirmSellAd(ctx, 'yes');
});

bot.action('confirm_sell_restart', async (ctx) => {
  await ctx.answerCbQuery();
  await handleConfirmSellAd(ctx, 'restart');
});

bot.action('urgent_sell_yes', async (ctx) => {
  await ctx.answerCbQuery();
  await handleSellUrgentResponse(ctx, 'yes');
});

bot.action('urgent_sell_no', async (ctx) => {
  await ctx.answerCbQuery();
  await handleSellUrgentResponse(ctx, 'no');
});

// BUY AD CALLBACKS
bot.action(/^program_buy_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await handleBuyProgramResponse(ctx, ctx.match[0]);
});

bot.action('urgent_buy_yes', async (ctx) => {
  await ctx.answerCbQuery();
  await handleBuyUrgentResponse(ctx, 'yes');
});

bot.action('urgent_buy_no', async (ctx) => {
  await ctx.answerCbQuery();
  await handleBuyUrgentResponse(ctx, 'no');
});

bot.action('confirm_buy_yes', async (ctx) => {
  await ctx.answerCbQuery();
  await handleConfirmBuyAd(ctx, 'yes');
});

bot.action('confirm_buy_restart', async (ctx) => {
  await ctx.answerCbQuery();
  await handleConfirmBuyAd(ctx, 'restart');
});

// ==================== MENSAGENS DE TEXTO (FLUXO) ====================

bot.on('text', async (ctx) => {
  const userId = ctx.from?.id;
  const text = ctx.message.text;
  const chatType = ctx.chat?.type;

  if (!userId || chatType !== 'private') return;

  // Ignora comandos
  if (text.startsWith('/')) return;

  // Busca estado atual do usuário
  const state = await stateService.getState(userId);

  if (state) {
    console.log(`[DEBUG] Msg from ${userId} - Current State: ${state.state}`);
  } else {
    console.log(`[DEBUG] Msg from ${userId} - No State found (or null).`);
  }

  if (!state || state.state === 'IDLE') {
    // Usuário não está em nenhum fluxo, redireciona para o menu iniciar
    return handleStart(ctx);
  }

  // Processa baseado no estado
  switch (state.state) {
    case 'ASK_COMPANY':
      await handleCompanyResponse(ctx, text);
      break;

    case 'ASK_QUANTITY':
      await handleQuantityResponse(ctx, text);
      break;

    case 'ASK_PRICE':
      await handlePriceResponse(ctx, text);
      break;

    case 'ASK_PROPOSAL_QUANTITY':
      await handleProposalQuantityResponse(ctx, text);
      break;

    case 'ASK_PROPOSAL_PRICE':
      await handleProposalPriceResponse(ctx, text);
      break;

    case 'ASK_PROPOSAL_VALUE':
      await handleProposalValueResponse(ctx, text);
      break;

    case 'ASK_BUY_MILES':
      await handleBuyMilesResponse(ctx, text);
      break;

    case 'ASK_BUY_PROGRAM':
      await handleBuyProgramResponse(ctx, text);
      break;

    case 'ASK_BUY_PASSENGERS':
      await handleBuyPassengersResponse(ctx, text);
      break;

    case 'ASK_BUY_URGENT':
      await handleBuyUrgentResponse(ctx, text);
      break;

    case 'ASK_BUY_PRICE':
      await handleBuyPriceResponse(ctx, text);
      break;

    case 'CONFIRM_BUY_AD':
      await handleConfirmBuyAd(ctx, text);
      break;

    // FLUXO DE VENDA (NOVO)
    case 'ASK_SELL_MILES':
      await handleSellMilesResponse(ctx, text);
      break;

    case 'ASK_SELL_PROGRAM':
      await handleSellProgramResponse(ctx, text);
      break;

    case 'ASK_SELL_PRICE':
      await handleSellPriceResponse(ctx, text);
      break;

    case 'ASK_SELL_URGENT':
      await handleSellUrgentResponse(ctx, text);
      break;

    case 'CONFIRM_SELL_AD':
      await handleConfirmSellAd(ctx, text);
      break;

    case 'ASK_PIX_CPF':
      await handlePixCpfResponse(ctx, text);
      break;

    case 'ASK_LOGIN_EMAIL':
      await handleLoginEmail(ctx, text);
      break;

    case 'ASK_LOGIN_PASSWORD':
      await handleLoginPassword(ctx, text);
      break;

    default:
      await stateService.reset(userId);
      return handleStart(ctx);
  }
});

// ==================== ERROR HANDLING ====================

bot.catch((err, ctx) => {
  console.error('❌ Erro no bot:', err);

  ctx.reply('⚠️ Ocorreu um erro. Por favor, tente novamente com /start')
    .catch(console.error);
});

// ==================== GRACEFUL SHUTDOWN ====================

const shutdown = async (signal: string) => {
  console.log(`\n📴 Recebido ${signal}. Encerrando bot...`);
  bot.stop(signal);
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// ==================== START ====================

bot.launch()
  .then(() => {
    console.log('✅ Bot iniciado com sucesso!');
    console.log(`📡 Bot: @${config.botUsername}`);
    console.log(`👥 Grupo: ${config.telegramGroupId}`);

    // ==================== EXPIRAÇÃO AUTOMÁTICA ====================
    // Verifica a cada 1 hora por assinaturas expiradas
    setInterval(async () => {
      console.log('⏳ Verificando assinaturas expiradas...');
      const now = new Date().toISOString();

      // Busca assinaturas que acabaram de expirar
      const { data: expiredSubs, error } = await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('status', 'active')
        .lt('end_date', now)
        .select('user_id, plan_id');

      if (error) {
        console.error('❌ Erro ao verificar expirações:', error);
        return;
      }

      if (expiredSubs && expiredSubs.length > 0) {
        console.log(`🔔 ${expiredSubs.length} assinaturas expiraram.`);
        for (const sub of expiredSubs) {
          try {
            await bot.telegram.sendMessage(
              sub.user_id,
              '⏰ *Seu plano expirou!* \n\nPara continuar negociando e acessando todos os recursos do bot, por favor escolha um novo plano usando o comando /planos.',
              { parse_mode: 'Markdown' }
            );
          } catch (err) {
            console.error(`Erro ao notificar usuário ${sub.user_id}:`, err);
          }
        }
      }
    }, 3600000); // 1 hora
  })
  .catch((err) => {
    console.error('❌ Falha ao iniciar o bot:', err);
    process.exit(1);
  });
