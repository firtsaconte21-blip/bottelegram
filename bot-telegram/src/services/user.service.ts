
import { db } from '../repositories/supabase.js';
import { ratingsService } from './ratings.service.js';

class UserService {
    /**
     * Registra o usuário no banco de dados (ignorando se já existir)
     */
    async registerUser(userId: number, username: string | null): Promise<void> {
        await db.upsertUser({
            telegram_user_id: userId,
            username: username
        });
    }

    /**
     * Obtém o perfil completo do usuário (dados + reputação)
     */
    async getUserProfile(userId: number): Promise<{
        memberSince: Date | null;
        rating: number;
        indications: number;
        verified: boolean;
    }> {
        const user = await db.getUser(userId);
        const { average, count } = await ratingsService.getAverageRating(userId);

        // Lógica simulada de verificação (ex: tem username e pelo menos 1 avaliação)
        const verified = !!user?.username && count > 0;

        return {
            memberSince: user ? new Date(user.created_at) : null,
            rating: average,
            indications: count, // Usando count total como "indicações" por enquanto
            verified: verified
        };
    }
}

export const userService = new UserService();
