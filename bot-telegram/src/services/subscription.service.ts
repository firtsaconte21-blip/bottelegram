import { supabase } from '../repositories/supabase.js';

export class SubscriptionService {
    /**
     * Verifica se o usuário tem uma assinatura ativa e quais as permissões
     */
    async getActiveSubscription(telegramUserId: number) {
        try {
            // 1. Busca o site_user_id vinculado para este Telegram ID
            const { data: userData } = await supabase
                .from('users')
                .select('site_user_id')
                .eq('telegram_user_id', telegramUserId)
                .maybeSingle();

            const siteUserId = userData?.site_user_id;

            // 2. Busca assinatura ativa usando ou o Telegram ID ou o UUID do site
            let query = supabase
                .from('subscriptions')
                .select(`
                    *,
                    plans:plan_id (
                        name,
                        features
                    )
                `)
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .order('created_at', { ascending: false });

            // Aplica filtro OR: user_id = telegramUserId OU site_user_id = siteUserId
            if (siteUserId) {
                query = query.or(`user_id.eq.${telegramUserId},site_user_id.eq.${siteUserId}`);
            } else {
                query = query.eq('user_id', telegramUserId);
            }

            const { data, error } = await query.limit(1).maybeSingle();

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('❌ Erro ao buscar assinatura:', error.message);
            return null;
        }
    }

    /**
     * Verifica se o usuário tem uma permissão específica (ex: BUY, SELL)
     */
    async hasPermission(telegramUserId: number, requiredPermission: 'BUY' | 'SELL') {
        const sub = await this.getActiveSubscription(telegramUserId);
        if (!sub || !sub.plans) return false;

        const features = sub.plans.features as string[];
        return features.includes(requiredPermission);
    }
}

export const subscriptionService = new SubscriptionService();
