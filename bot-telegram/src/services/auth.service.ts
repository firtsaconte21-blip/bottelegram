import { supabase } from '../repositories/supabase.js';

export class AuthService {
    /**
     * Realiza login do usuário no bot usando e-mail e senha do site
     */
    async login(email: string, password: string, telegramUserId: number) {
        try {
            // 1. Autentica no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                if (authError.message.includes('Email not confirmed')) {
                    return {
                        success: false,
                        type: 'email_not_confirmed',
                        message: `📧 O e-mail ${email} ainda não foi confirmado.`,
                        email
                    };
                }
                throw authError;
            }

            const siteUserId = authData.user?.id;

            if (!siteUserId) throw new Error('Usuário não encontrado após login.');

            // 2. Verifica explicitamente se o e-mail está confirmado (redundância de segurança)
            if (!authData.user.email_confirmed_at) {
                return {
                    success: false,
                    type: 'email_not_confirmed',
                    message: `📧 O e-mail ${email} ainda não foi confirmado.`,
                    email
                };
            }

            // 3. Vincula o Telegram ID ao site_user_id na tabela users
            const { error: updateError } = await supabase
                .from('users')
                .update({ site_user_id: siteUserId })
                .eq('telegram_user_id', telegramUserId);

            if (updateError) throw updateError;

            return { success: true, user: authData.user };
        } catch (error: any) {
            console.error('❌ Erro no login do bot:', error.message);
            return { success: false, message: '❌ E-mail ou senha incorretos.' };
        }
    }

    /**
     * Verifica se o usuário do Telegram está vinculado a uma conta do site
     */
    async getLinkedUser(telegramUserId: number) {
        const { data, error } = await supabase
            .from('users')
            .select('site_user_id')
            .eq('telegram_user_id', telegramUserId)
            .single();

        if (error || !data?.site_user_id) return null;
        return data.site_user_id;
    }

    /**
     * Reenvia e-mail de confirmação
     */
    async resendVerificationEmail(email: string) {
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email
            });
            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('❌ Erro ao reenviar e-mail:', error.message);
            return { success: false, message: error.message };
        }
    }
}

export const authService = new AuthService();
