
-- Enum para tipo de senha
CREATE TYPE public.ticket_type AS ENUM ('normal', 'priority', 'preferential');

-- Enum para status da senha
CREATE TYPE public.ticket_status AS ENUM ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show');

-- Enum para status de impressão
CREATE TYPE public.print_status AS ENUM ('success', 'failed', 'pending');

-- Tipos de serviço
CREATE TABLE public.service_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service types are viewable by everyone" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "Only authenticated can manage service types" ON public.service_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Guichês / Balcões
CREATE TABLE public.counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  number INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_ticket_id UUID,
  operator_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counters are viewable by everyone" ON public.counters FOR SELECT USING (true);
CREATE POLICY "Only authenticated can manage counters" ON public.counters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Senhas / Tickets
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL,
  display_number TEXT NOT NULL,
  ticket_type ticket_type NOT NULL DEFAULT 'normal',
  status ticket_status NOT NULL DEFAULT 'waiting',
  service_type_id UUID REFERENCES public.service_types(id),
  counter_id UUID REFERENCES public.counters(id),
  patient_name TEXT,
  patient_cpf TEXT,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets are viewable by everyone" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Anyone can create tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true);

-- Configurações do sistema
CREATE TABLE public.system_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config is viewable by everyone" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Only authenticated can manage config" ON public.system_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Log de impressão
CREATE TABLE public.print_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  status print_status NOT NULL DEFAULT 'pending',
  print_method TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Print logs viewable by authenticated" ON public.print_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert print logs" ON public.print_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update print logs" ON public.print_logs FOR UPDATE TO authenticated USING (true);

-- Sequência diária de senhas
CREATE TABLE public.daily_sequence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_type_id UUID REFERENCES public.service_types(id),
  last_number INT NOT NULL DEFAULT 0,
  UNIQUE(date, service_type_id)
);
ALTER TABLE public.daily_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sequence viewable by everyone" ON public.daily_sequence FOR SELECT USING (true);
CREATE POLICY "Anyone can manage sequence" ON public.daily_sequence FOR ALL USING (true) WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar referência de current_ticket_id
ALTER TABLE public.counters
  ADD CONSTRAINT counters_current_ticket_fk
  FOREIGN KEY (current_ticket_id) REFERENCES public.tickets(id);

-- Inserir tipos de serviço padrão
INSERT INTO public.service_types (name, prefix, description, display_order) VALUES
  ('Normal', 'N', 'Atendimento normal', 1),
  ('Prioritário', 'P', 'Atendimento prioritário (idosos, gestantes, PCD)', 2),
  ('Exames', 'E', 'Retirada de exames', 3);

-- Inserir guichês padrão
INSERT INTO public.counters (name, number) VALUES
  ('Guichê 1', 1),
  ('Guichê 2', 2),
  ('Guichê 3', 3);

-- Inserir configurações padrão
INSERT INTO public.system_config (key, value) VALUES
  ('printer', '{
    "enabled": false,
    "connectionType": "network",
    "ip": "192.168.1.100",
    "port": 9100,
    "usbVendorId": "",
    "usbProductId": "",
    "serialPort": "COM1",
    "serialBaudrate": 9600,
    "autoCut": true,
    "printLogo": false,
    "printQrCode": true,
    "printCpf": true,
    "printName": true,
    "printMode": "detailed",
    "paperSize": "80mm"
  }'::jsonb),
  ('ticket_layout', '{
    "clinicName": "Clínica Exemplo",
    "header": "Bem-vindo!",
    "footer": "Aguarde ser chamado no painel",
    "customMessage": "",
    "lgpdNotice": "Seus dados são protegidos conforme LGPD",
    "showDateTime": true,
    "fontSize": "large",
    "alignment": "center",
    "lineSpacing": 1
  }'::jsonb),
  ('general', '{
    "clinicName": "Clínica Exemplo",
    "resetDaily": true,
    "soundEnabled": true,
    "theme": "light"
  }'::jsonb);

-- Habilitar realtime para tickets e counters
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.counters;
