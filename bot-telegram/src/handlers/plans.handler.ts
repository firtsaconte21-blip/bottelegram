import { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { supabase } from '../repositories/supabase.js';
import { pixService } from '../services/pix.service.js';
import { stateService } from '../services/state.service.js';

/**
 * Mostra os planos disponíveis com botões inline
 */
/**
 * Mostra os planos disponíveis com botões inline (Dinâmico)
 */
export async function showPlans(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Busca planos do banco para garantir IDs corretos
    const { data: plans, error } = await supabase
        .from('plans')
        .select('*')
        .order('price', { ascending: true }); // Ordena por preço

    if (error || !plans || plans.length === 0) {
        console.error('Erro ao buscar planos:', error);
        await ctx.reply('⚠️ Erro ao carregar planos. Tente novamente mais tarde.');
        return;
    }

    const message = `💳 *Plano Necessário*

Você não possui um plano ativo ou sua assinatura expirou.
Escolha um dos planos abaixo para liberar o acesso aos recursos:

` + plans.map(p => {
        let icon = '⚪';
        if (p.name.includes('Comprador')) icon = '🟢';
        if (p.name.includes('Vendedor')) icon = '🔵';
        if (p.name.includes('Full')) icon = '🟣';

        let desc = '';
        if (p.name.includes('Comprador')) desc = 'Permite: Acessar o botão de Comprar Milhas e fazer propostas em anúncios de venda.';
        if (p.name.includes('Vendedor')) desc = 'Permite: Criar anúncio de venda e fazer propostas em anúncios de compra.';
        if (p.name.includes('Full')) desc = 'Permite: Acesso completo a todos os recursos da plataforma.';

        return `${icon} *${p.name}: R$ ${parseFloat(p.price).toFixed(2).replace('.', ',')}*\n${desc}\n`;
    }).join('\n') + `
_Validade: ${plans[0].duration_days || 365} dias a partir da ativação_`;

    // Gera botões dinamicamente
    const buttons = plans.map(p => {
        let icon = '💎';
        if (p.name.includes('Comprador')) icon = '🟢';
        if (p.name.includes('Vendedor')) icon = '🔵';
        if (p.name.includes('Full')) icon = '🟣';

        return [Markup.button.callback(`${icon} ${p.name} - R$${parseFloat(p.price).toFixed(2).replace('.', ',')}`, `buy_plan_${p.id}`)];
    });

    await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
}

/**
 * Processa a seleção de um plano
 */
export async function handlePlanSelection(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Extrai o plan_id do callback_data
    const callbackData = (ctx as any).match[0];
    const planId = callbackData.replace('buy_plan_', '');

    await ctx.answerCbQuery();
    await ctx.reply('⏳ Gerando PIX, por favor aguarde...');

    // Busca dados do plano
    const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (planError || !plan) {
        await ctx.reply('❌ Erro ao buscar informações do plano. Tente novamente.');
        return;
    }

    // Busca dados do usuário do site
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('site_user_id')
        .eq('telegram_user_id', userId)
        .single();

    if (userError || !user?.site_user_id) {
        await ctx.reply('❌ Você precisa estar logado para comprar um plano. Use /login primeiro.');
        return;
    }

    const { data: siteUser, error: siteUserError } = await supabase
        .from('site_users')
        .select('full_name, email, cpf, phone')
        .eq('id', user.site_user_id)
        .single();

    if (siteUserError || !siteUser) {
        await ctx.reply('❌ Erro ao buscar seus dados cadastrais. Entre em contato com o suporte.');
        return;
    }

    // Gera PIX com dados do usuário
    const amount = parseFloat(plan.price);
    const description = `Assinatura: ${plan.name}`;

    const pixResult = await pixService.createPix(
        userId,
        amount,
        description,
        siteUser.cpf.replace(/\D/g, ''),
        siteUser.email,
        `${userId}_${planId}` // external_reference com userId_planId
    );

    if (!pixResult) {
        await ctx.reply('❌ Ocorreu um erro ao gerar o PIX. Por favor, tente novamente mais tarde.');
        return;
    }

    // Salva o plan_id no temp_data para referência
    await stateService.updateTempData(userId, {
        payment_id: pixResult.id.toString(),
        plan_id: planId,
        plan_name: plan.name
    });

    // Envia o QR Code
    const qrCodeBuffer = Buffer.from(pixResult.qr_code_base64, 'base64');

    await ctx.replyWithPhoto(
        { source: qrCodeBuffer },
        {
            caption: `✅ *PIX Gerado com Sucesso!*\n\n💰 *Valor:* R$ ${amount.toFixed(2)}\n📦 *Plano:* ${plan.name}\n🆔 *ID:* ${pixResult.id}\n\n*Código Copia e Cola:*`,
            parse_mode: 'Markdown'
        }
    );

    // Envia o código Copia e Cola
    await ctx.reply(`\`${pixResult.qr_code}\``, { parse_mode: 'Markdown' });

    await ctx.reply(
        `🔔 Assim que o pagamento for confirmado, você receberá uma notificação aqui.\n\n` +
        `⏰ *Prazo de pagamento:* 30 minutos\n` +
        `📅 *Validade do plano:* 12 meses após ativação`,
        { parse_mode: 'Markdown' }
    );
}
