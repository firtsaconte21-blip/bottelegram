import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import type { Ad, Proposal, UserStateRecord, UserState, TempData, Rating, User, MileHistory } from '../types/index.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Retorna uma nova instância do cliente Supabase para operações de autenticação.
 * Isso evita que o cliente global 'supabase' seja "poluído" com a sessão de um usuário específico,
 * o que causaria erros de permissão (RLS) em outras partes do bot.
 */
export function getAuthClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

class SupabaseRepository {
  private client: SupabaseClient = supabase;

  constructor() { }

  // ==================== ADS ====================

  async createAd(data: {
    user_id: number;
    username: string | null;
    type: 'BUY' | 'SELL';
    companhia: string;
    quantidade: number;
    valor_milheiro: number;
    passengers?: number;
    urgent?: boolean;
  }): Promise<Ad | null> {
    const { data: ad, error } = await this.client
      .from('ads')
      .insert({
        telegram_user_id: data.user_id,
        type: data.type,
        companhia: data.companhia,
        quantidade: data.quantidade,
        valor_milheiro: data.valor_milheiro,
        passengers: data.passengers || null,
        urgent: data.urgent || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar anúncio:', error);
      return null;
    }

    // Map back
    return {
      ...ad,
      user_id: ad.telegram_user_id,
    } as unknown as Ad;
  }

  async getAdById(id: string): Promise<Ad | null> {
    const { data, error } = await this.client
      .from('ads')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar anúncio:', error);
      return null;
    }

    if (data) {
      return {
        ...data,
        user_id: data.telegram_user_id,
      } as unknown as Ad;
    }
    return null;
  }

  async updateAd(id: string, updates: Partial<Ad>): Promise<Ad | null> {
    const { data, error } = await this.client
      .from('ads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar anúncio:', error);
      return null;
    }

    if (data) {
      return {
        ...data,
        user_id: data.telegram_user_id,
      } as unknown as Ad;
    }
    return null;
  }

  async getActiveAdsByUser(userId: number): Promise<Ad[]> {
    const { data, error } = await this.client
      .from('ads')
      .select(`
        *,
        proposals(status)
      `)
      .eq('telegram_user_id', userId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar anúncios do usuário:', error);
      return [];
    }

    // Filtra para garantir que nenhum anúncio com proposta aceita apareça como ativo
    const filteredAds = data.filter(ad => {
      const proposals = (ad as any).proposals || [];
      return !proposals.some((p: any) => p.status === 'ACCEPTED');
    });

    return filteredAds.map(ad => ({
      ...ad,
      user_id: ad.telegram_user_id
    })) as unknown as Ad[];
  }

  // ==================== PROPOSALS ====================

  async createProposal(data: {
    ad_id: string;
    from_user_id: number;
    from_username: string | null;
    quantidade: number;
    valor_proposta: number;
  }): Promise<Proposal | null> {
    const { data: proposal, error } = await this.client
      .from('proposals')
      .insert({
        ad_id: data.ad_id,
        from_telegram_user_id: data.from_user_id,
        quantidade: data.quantidade,
        valor_proposta: data.valor_proposta,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DB] Erro ao criar proposta:', error.message);
      console.dir(error);
      return null;
    }

    // Map back
    if (proposal) {
      return {
        ...proposal,
        from_user_id: proposal.from_telegram_user_id,
      } as unknown as Proposal;
    }
    return null;
  }

  async getProposalById(id: string): Promise<Proposal | null> {
    const { data, error } = await this.client
      .from('proposals')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar proposta:', error);
      return null;
    }

    if (data) {
      return {
        ...data,
        from_user_id: data.from_telegram_user_id,
      } as unknown as Proposal;
    }
    return null;
  }

  async updateProposal(id: string, updates: Partial<Proposal>): Promise<Proposal | null> {
    const { data, error } = await this.client
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar proposta:', error);
      return null;
    }

    if (data) {
      return {
        ...data,
        from_user_id: data.from_telegram_user_id,
      } as unknown as Proposal;
    }
    return null;
  }

  async getPendingProposalsByAd(adId: string): Promise<Proposal[]> {
    const { data, error } = await this.client
      .from('proposals')
      .select()
      .eq('ad_id', adId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar propostas:', error);
      return [];
    }

    return data.map(p => ({
      ...p,
      from_user_id: p.from_telegram_user_id
    })) as unknown as Proposal[];
  }

  // ==================== USER STATES ====================

  async getUserState(userId: number): Promise<UserStateRecord | null> {
    const { data, error } = await this.client
      .from('user_states')
      .select()
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (data) {
      // Map back to internal type
      return {
        user_id: data.telegram_user_id,
        state: data.state,
        temp_data: data.temp_data,
        updated_at: data.updated_at
      };
    }

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar estado do usuário:', error);
      console.error('Erro ao buscar estado do usuário:', error);
      return null;
    }

    console.log(`[DEBUG] DB getState for ${userId}:`, data);
    return data;
  }

  async setUserState(
    userId: number,
    state: UserState,
    tempData: TempData = {}
  ): Promise<boolean> {
    const { error } = await this.client
      .from('user_states')
      .upsert(
        {
          telegram_user_id: userId,
          state,
          temp_data: tempData,
        },
        { onConflict: 'telegram_user_id' }
      );

    if (error) {
      console.error('Erro ao atualizar estado do usuário:', error);
      return false;
    }

    console.log(`[DEBUG] DB upsert success for ${userId}`);
    return true;
  }

  async resetUserState(userId: number): Promise<boolean> {
    return this.setUserState(userId, 'IDLE', {});
  }
  // ==================== RATINGS ====================

  async createRating(data: {
    ad_id: string;
    from_user_id: number;
    to_user_id: number;
    role: 'BUYER' | 'SELLER';
    recommend: boolean;
    rating: number;
    proposal_id?: string;
  }): Promise<Rating | null> {
    const { data: rating, error } = await this.client
      .from('ratings')
      .insert({
        ad_id: data.ad_id,
        from_user_id: data.from_user_id,
        to_user_id: data.to_user_id,
        role: data.role,
        recommend: data.recommend,
        rating: data.rating,
        proposal_id: data.proposal_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar avaliação:', error);
      return null;
    }

    return rating as unknown as Rating;
  }

  async getUserRatings(userId: number): Promise<Rating[]> {
    const { data, error } = await this.client
      .from('ratings')
      .select()
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avaliações:', error);
      return [];
    }

    return data as unknown as Rating[];
  }

  async getRatingById(id: string): Promise<Rating | null> {
    const { data, error } = await this.client
      .from('ratings')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar avaliação:', error);
      return null;
    }

    return data as unknown as Rating;
  }

  async confirmRating(id: string): Promise<boolean> {
    const { error } = await this.client
      .from('ratings')
      .update({ confirmada: true })
      .eq('id', id);

    if (error) {
      console.error('Erro ao confirmar avaliação:', error);
      return false;
    }
    return true;
  }

  async createMileHistory(data: {
    user_id: number;
    tipo: 'compra' | 'venda';
    companhia: string;
    quantidade: number;
    proposal_id: string;
  }): Promise<MileHistory | null> {
    const { data: history, error } = await this.client
      .from('mile_history')
      .insert({
        user_id: data.user_id,
        tipo: data.tipo,
        companhia: data.companhia,
        quantidade: data.quantidade,
        proposal_id: data.proposal_id,
      })
      .select()
      .single();

    if (error) {
      // Ignora erro de duplicidade se for o código de violação de UNIQUE (P0001 ou similar)
      if (error.code === '23505') {
        return null;
      }
      console.error('Erro ao criar histórico de milhas:', error);
      return null;
    }

    return history as unknown as MileHistory;
  }

  async getUserDetailedStats(userId: number): Promise<{
    allTime: {
      rating: number;
      totalRatings: number;
      totalBought: number;
      totalSold: number;
      totalNegotiations: number;
    };
    monthly: {
      rating: number;
      totalRatings: number;
      totalBought: number;
      totalSold: number;
      totalNegotiations: number;
    };
  }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. Busca Histórico (Vitalício e Mensal)
    const { data: history, error: historyError } = await this.client
      .from('mile_history')
      .select('tipo, quantidade, created_at')
      .eq('user_id', userId);

    // 2. Busca Avaliações (Vitalício e Mensal)
    const { data: ratings, error: ratingsError } = await this.client
      .from('ratings')
      .select('rating, created_at')
      .eq('to_user_id', userId)
      .eq('confirmada', true);

    if (historyError || ratingsError) {
      console.error('Erro ao buscar estatísticas detalhadas:', { historyError, ratingsError });
      return {
        allTime: { rating: 0, totalRatings: 0, totalBought: 0, totalSold: 0, totalNegotiations: 0 },
        monthly: { rating: 0, totalRatings: 0, totalBought: 0, totalSold: 0, totalNegotiations: 0 }
      };
    }

    // Processamento All Time
    const allTimeBought = history
      .filter(h => h.tipo === 'compra')
      .reduce((acc, curr) => acc + curr.quantidade, 0);
    const allTimeSold = history
      .filter(h => h.tipo === 'venda')
      .reduce((acc, curr) => acc + curr.quantidade, 0);
    const allTimeRatingSum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
    const allTimeAvgRating = ratings.length > 0 ? allTimeRatingSum / ratings.length : 0;

    // Processamento Mensal
    const monthlyHistory = history.filter(h => h.created_at >= firstDayOfMonth);
    const monthlyBought = monthlyHistory
      .filter(h => h.tipo === 'compra')
      .reduce((acc, curr) => acc + curr.quantidade, 0);
    const monthlySold = monthlyHistory
      .filter(h => h.tipo === 'venda')
      .reduce((acc, curr) => acc + curr.quantidade, 0);

    const monthlyRatings = ratings.filter(r => r.created_at >= firstDayOfMonth);
    const monthlyRatingSum = monthlyRatings.reduce((acc, curr) => acc + curr.rating, 0);
    const monthlyAvgRating = monthlyRatings.length > 0 ? monthlyRatingSum / monthlyRatings.length : 0;

    return {
      allTime: {
        rating: Math.round(allTimeAvgRating * 10) / 10,
        totalRatings: ratings.length,
        totalBought: allTimeBought,
        totalSold: allTimeSold,
        totalNegotiations: history.length
      },
      monthly: {
        rating: Math.round(monthlyAvgRating * 10) / 10,
        totalRatings: monthlyRatings.length,
        totalBought: monthlyBought,
        totalSold: monthlySold,
        totalNegotiations: monthlyHistory.length
      }
    };
  }

  // ==================== USERS ====================

  async upsertUser(data: { telegram_user_id: number; username: string | null }): Promise<User | null> {
    // Tenta inserir, se já existir, não faz nada (onConflict ignore)
    // Para manter o created_at original
    const { data: user, error } = await this.client
      .from('users')
      .upsert(
        { telegram_user_id: data.telegram_user_id, username: data.username },
        { onConflict: 'telegram_user_id', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    // Se ignoreDuplicates for true e o usuário já existir, data será null?
    // Nesse caso, buscamos o usuário
    if (error) {
      console.error('Erro ao registrar usuário:', error);
      return null;
    }

    if (!user) {
      return this.getUser(data.telegram_user_id);
    }

    return user as unknown as User;
  }

  async getUser(telegramUserId: number): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select()
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    if (error) {
      //   console.error('Erro ao buscar usuário:', error); // Log opcional para não poluir
      return null;
    }

    return data as unknown as User;
  }
}

// Singleton export
export const db = new SupabaseRepository();
