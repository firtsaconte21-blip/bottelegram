import { authService } from '../services/auth.service.js';
import { stateService } from '../services/state.service.js';
import { Context, Markup } from 'telegraf';

/**
 * Inicia o fluxo de login passo a passo
 */
export async function handleLogin(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    await stateService.setState(userId, 'ASK_LOGIN_EMAIL');
    return ctx.reply(
        '🔐 *Login do Sistema* \n\n' +
        'Por favor, digite seu *e-mail* cadastrado no site:',
        { parse_mode: 'Markdown' }
    );
}

/**
 * Recebe o e-mail e pede a senha
 */
export async function handleLoginEmail(ctx: Context, email: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!email.includes('@')) {
        return ctx.reply('❌ E-mail inválido. Digite novamente:');
    }

    await stateService.setState(userId, 'ASK_LOGIN_PASSWORD', { email });
    return ctx.reply('Sua *senha*:', { parse_mode: 'Markdown' });
}

/**
 * Recebe a senha e finaliza o login
 */
export async function handleLoginPassword(ctx: Context, password: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const state = await stateService.getState(userId);
    const email = state?.temp_data?.email;

    if (!email) {
        await stateService.reset(userId);
        return ctx.reply('❌ Algo deu errado. Use /login novamente.');
    }

    // Deleta a mensagem da senha por segurança (se possível)
    try {
        await ctx.deleteMessage();
    } catch (e) { }

    const statusMsg = await ctx.reply('⏳ Autenticando...');

    const result = await authService.login(email, password, userId);

    if (result.success) {
        await stateService.reset(userId);
        await ctx.telegram.editMessageText(
            ctx.chat?.id!,
            statusMsg.message_id,
            undefined,
            '✅ *Login realizado com sucesso!* \n\nSua conta do site agora está vinculada ao seu Telegram.',
            { parse_mode: 'Markdown' }
        );

        // Mostra o menu principal automaticamente
        const { handleStart } = await import('./start.handler.js');
        await handleStart(ctx);
    } else if (result.type === 'email_not_confirmed') {
        const email = (result as any).email;
        await ctx.telegram.editMessageText(
            ctx.chat?.id!,
            statusMsg.message_id,
            undefined,
            `⚠️ *E-mail não verificado* \n\nUm e-mail de confirmação foi enviado para *${email}*.\n\nPor favor, verifique sua caixa de entrada e spam.`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Reenviar E-mail', `resend_email_${email}`)],
                    [Markup.button.callback('❓ Não recebi o código', 'show_verification_help')]
                ])
            }
        );
    } else {
        await ctx.telegram.editMessageText(
            ctx.chat?.id!,
            statusMsg.message_id,
            undefined,
            result.message || '❌ E-mail ou senha incorretos.',
            { parse_mode: 'Markdown' }
        );
    }
}

/**
 * Handler para reenviar e-mail de confirmação
 */
export async function handleResendEmail(ctx: Context, email: string) {
    await ctx.answerCbQuery('⏳ Reenviando...');

    const result = await authService.resendVerificationEmail(email);

    if (result.success) {
        return ctx.editMessageText(
            `✅ *E-mail de verificação reenviado com sucesso!* \n\n` +
            `Verifique o seu e-mail (inclusive no lixo eletrônico) e tente fazer o login novamente usando /login.`,
            { parse_mode: 'Markdown' }
        );
    } else {
        return ctx.reply(`❌ Erro ao reenviar: ${result.message}`);
    }
}

/**
 * Handler para ajuda na verificação
 */
export async function handleVerificationHelp(ctx: Context) {
    await ctx.answerCbQuery();
    return ctx.reply(
        '💡 *Dicas para verificação:* \n\n' +
        '1. Confira a pasta de Spam ou Lixo Eletrônico.\n' +
        '2. Verifique se o e-mail digitado está correto.\n' +
        '3. Aguarde alguns minutos e tente o reenvio.\n\n' +
        'Se o problema persistir, entre em contato com nosso suporte.',
        { parse_mode: 'Markdown' }
    );
}
