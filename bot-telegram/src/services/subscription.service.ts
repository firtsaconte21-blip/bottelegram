import { supabase } from '../repositories/supabase.js';

export class SubscriptionService {
    /**
     * Verifica se o usuário tem uma assinatura ativa e quais as permissões
     */
    async getActiveSubscription(telegramUserId: number) {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select(`
          *,
          plans:plan_id (
            name,
            features
          )
        `)
                .eq('user_id', telegramUserId)
                .eq('status', 'active')
                .gt('end_date', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

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
