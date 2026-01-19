// Tipos para o banco de dados

export type AdStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';
export type AdType = 'BUY' | 'SELL';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type UserState =
  | 'IDLE'
  | 'ASK_COMPANY' | 'ASK_QUANTITY' | 'ASK_PRICE'
  | 'ASK_PROPOSAL_QUANTITY' | 'ASK_PROPOSAL_PRICE' | 'ASK_PROPOSAL_VALUE'
  | 'ASK_BUY_MILES' | 'ASK_BUY_PROGRAM' | 'ASK_BUY_PASSENGERS' | 'ASK_BUY_URGENT' | 'ASK_BUY_PRICE' | 'CONFIRM_BUY_AD'
  | 'ASK_SELL_MILES' | 'ASK_SELL_PROGRAM' | 'ASK_SELL_PRICE' | 'ASK_SELL_URGENT' | 'CONFIRM_SELL_AD'
  | 'RATING_RECOMMEND' | 'RATING_STARS' | 'RATING_CONFIRM'
  | 'ASK_PIX_CPF'
  | 'ASK_LOGIN_EMAIL' | 'ASK_LOGIN_PASSWORD';

export interface Ad {
  id: string;
  user_id: number;
  username: string | null;
  type: AdType;
  companhia: string;
  quantidade: number;
  valor_milheiro: number;
  passengers?: number;
  urgent?: boolean;
  status: AdStatus;
  message_id: number | null;
  chat_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  ad_id: string;
  from_user_id: number;
  from_username: string | null;
  quantidade: number;
  valor_proposta: number;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

export interface UserStateRecord {
  user_id: number;
  state: UserState;
  temp_data: TempData;
  updated_at: string;
}

export interface TempData {
  type?: AdType;
  companhia?: string;
  program?: string;
  quantidade?: number;
  miles?: number;
  valor_milheiro?: number;
  price?: number;
  passengers?: number;
  urgent?: boolean;
  ad_id?: string;
  target_user_id?: number;
  rating_role?: 'BUYER' | 'SELLER';
  rating_recommend?: boolean;
  rating_stars?: number;
  proposal_id?: string;
  pix_cpf?: string;
  payment_id?: string;
  email?: string;
  [key: string]: unknown;
}

export interface User {
  telegram_user_id: number;
  username: string | null;
  created_at: string;
}

export interface Rating {
  id?: string;
  ad_id: string;
  from_user_id: number;
  to_user_id: number;
  role: 'BUYER' | 'SELLER';
  recommend: boolean;
  rating: number;
  proposal_id?: string;
  confirmada?: boolean;
  created_at?: string;
}

export interface MileHistory {
  id?: string;
  user_id: number;
  tipo: 'compra' | 'venda';
  companhia: string;
  quantidade: number;
  proposal_id: string;
  created_at?: string;
}

// Tipos para o contexto do Telegraf
export interface BotContext {
  userId: number;
  username: string | null;
  chatId: number;
  isPrivate: boolean;
}
