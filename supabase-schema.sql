-- ============================================================
-- Schema completo do Sistema de Senhas
-- Cole este SQL inteiro no SQL Editor do Supabase e clique em RUN
-- ============================================================

-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'gestor');
CREATE TYPE public.ticket_status AS ENUM ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.ticket_type AS ENUM ('normal', 'priority', 'preferential');
CREATE TYPE public.print_status AS ENUM ('success', 'failed', 'pending');

-- 2. Tabelas
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  operator_name text,
  current_ticket_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL,
  display_number text NOT NULL,
  ticket_type public.ticket_type NOT NULL DEFAULT 'normal',
  status public.ticket_status NOT NULL DEFAULT 'waiting',
  service_type_id uuid REFERENCES public.service_types(id),
  counter_id uuid REFERENCES public.counters(id),
  operator_id uuid,
  patient_name text,
  patient_cpf text,
  custom_voice_text text,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK counter -> ticket
ALTER TABLE public.counters
  ADD CONSTRAINT counters_current_ticket_fk
  FOREIGN KEY (current_ticket_id) REFERENCES public.tickets(id);

CREATE TABLE public.daily_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  last_number integer NOT NULL DEFAULT 0,
  service_type_id uuid REFERENCES public.service_types(id)
);

CREATE TABLE public.print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id),
  status public.print_status NOT NULL DEFAULT 'pending',
  print_method text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Funções

-- has_role (SECURITY DEFINER - evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- setup_first_admin (só funciona se não existe admin)
CREATE OR REPLACE FUNCTION public.setup_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Um administrador já existe';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

-- handle_new_user (trigger para criar profile automaticamente)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

-- update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Triggers

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on tickets
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RLS Policies

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- service_types
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service types are viewable by everyone" ON public.service_types FOR SELECT TO public USING (true);
CREATE POLICY "Only authenticated can manage service types" ON public.service_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- counters
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Counters are viewable by everyone" ON public.counters FOR SELECT TO public USING (true);
CREATE POLICY "Only authenticated can manage counters" ON public.counters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets are viewable by everyone" ON public.tickets FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can create tickets" ON public.tickets FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can update tickets" ON public.tickets FOR UPDATE TO authenticated USING (true);

-- daily_sequence
ALTER TABLE public.daily_sequence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sequence viewable by everyone" ON public.daily_sequence FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can manage sequence" ON public.daily_sequence FOR ALL TO public USING (true) WITH CHECK (true);

-- print_logs
ALTER TABLE public.print_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Print logs viewable by authenticated" ON public.print_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert print logs" ON public.print_logs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can update print logs" ON public.print_logs FOR UPDATE TO authenticated USING (true);

-- system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config is viewable by everyone" ON public.system_config FOR SELECT TO public USING (true);
CREATE POLICY "Only authenticated can manage config" ON public.system_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.counters;

-- ✅ Schema aplicado com sucesso!
