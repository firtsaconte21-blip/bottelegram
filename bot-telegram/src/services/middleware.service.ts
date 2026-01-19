import { Context } from 'telegraf';
import { authService } from './auth.service.js';
import { subscriptionService } from './subscription.service.js';

export async function checkAccess(ctx: Context, next: () => Promise<void>, requiredPermission?: 'BUY' | 'SELL', onUnauthenticated?: () => Promise<void>) {
    const userId = ctx.from?.id;
    if (!userId) return;

    // 1. Verifica se está logado (vinculado ao site)
    const siteUserId = await authService.getLinkedUser(userId);
    if (!siteUserId) {
        if (onUnauthenticated) {
            return onUnauthenticated();
        }
        return ctx.reply(
            '⚠️ *Acesso Restrito* \n\n' +
            'Você precisa vincular sua conta do site para usar esta função. \n' +
            'Use `/login` para entrar.',
            { parse_mode: 'Markdown' }
        );
    }

    // 2. Verifica se tem assinatura ativa e válida
    const sub = await subscriptionService.getActiveSubscription(userId);
    if (!sub || (sub.end_date && new Date(sub.end_date) < new Date())) {
        // Importa e mostra os planos disponíveis
        const { showPlans } = await import('../handlers/plans.handler.js');
        return showPlans(ctx);
    }

    // 3. Verifica permissão específica (opcional)
    if (requiredPermission) {
        const hasPerm = await subscriptionService.hasPermission(userId, requiredPermission);
        if (!hasPerm) {
            const { Markup } = await import('telegraf');
            const planName = sub.plans?.name || 'seu plano atual';
            // Busca plano Full Acesso dinamicamente
            const { data: fullPlan } = await import('../repositories/supabase.js').then(m => m.supabase
                .from('plans')
                .select('id')
                .ilike('name', '%Full%')
                .maybeSingle()
            );

            const buttons = [];
            if (fullPlan) {
                buttons.push([Markup.button.callback('💎 Atualizar para Full Acesso', `buy_plan_${fullPlan.id}`)]);
            }

            return ctx.reply(
                `❌ *Permissão Negada* \n\nO seu plano (*${planName}*) não permite esta ação.`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard(buttons)
                }
            );
        }
    }

    return next();
}
