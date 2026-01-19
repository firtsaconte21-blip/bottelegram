-- Enum para status de anúncios
CREATE TYPE public.ad_status AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- Enum para status de propostas
CREATE TYPE public.proposal_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- Enum para estados do usuário no fluxo do bot
CREATE TYPE public.user_state AS ENUM ('IDLE', 'ASK_COMPANY', 'ASK_QUANTITY', 'ASK_PRICE', 'ASK_PROPOSAL_VALUE');

-- Tabela de anúncios de milhas
CREATE TABLE public.ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    username TEXT,
    companhia TEXT NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_milheiro NUMERIC(10,2) NOT NULL CHECK (valor_milheiro > 0),
    status ad_status NOT NULL DEFAULT 'ACTIVE',
    message_id BIGINT,
    chat_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de propostas
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    from_user_id BIGINT NOT NULL,
    from_username TEXT,
    valor_proposta NUMERIC(10,2) NOT NULL CHECK (valor_proposta > 0),
    status proposal_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de estados do usuário (para controle de fluxo conversacional)
CREATE TABLE public.user_states (
    user_id BIGINT PRIMARY KEY,
    state user_state NOT NULL DEFAULT 'IDLE',
    temp_data JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ads_user_id ON public.ads(user_id);
CREATE INDEX idx_ads_status ON public.ads(status);
CREATE INDEX idx_proposals_ad_id ON public.proposals(ad_id);
CREATE INDEX idx_proposals_from_user ON public.proposals(from_user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ads_updated_at
    BEFORE UPDATE ON public.ads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_states_updated_at
    BEFORE UPDATE ON public.user_states
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS desabilitado para uso via service_role_key (backend do bot)
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;

-- Policies para service role (acesso total via backend)
CREATE POLICY "Service role full access ads" ON public.ads FOR ALL USING (true);
CREATE POLICY "Service role full access proposals" ON public.proposals FOR ALL USING (true);
CREATE POLICY "Service role full access user_states" ON public.user_states FOR ALL USING (true);