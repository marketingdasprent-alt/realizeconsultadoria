-- Domínios: passar a guardar a data da PRÓXIMA RENOVAÇÃO em vez da data de criação.
--
-- Antes: guardava-se creation_date e o sistema calculava o aniversário. Confuso ao inserir.
-- Agora: o admin insere directamente a data da próxima renovação (como no dominios.pt),
-- e marcar "Pago" avança essa data um ano.
--
-- Escrito de forma defensiva porque a tabela pode ter sido criada com qualquer um dos
-- dois esquemas (migração 20260429154000 vs. create_domains.sql aplicado à mão).

DO $mig$
BEGIN
  -- 1. Garantir que as colunas novas existem
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_domains' AND column_name = 'renewal_date'
  ) THEN
    ALTER TABLE public.site_domains ADD COLUMN renewal_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_domains' AND column_name = 'last_paid_year'
  ) THEN
    ALTER TABLE public.site_domains ADD COLUMN last_paid_year integer;
  END IF;

  -- 2. Migrar os dados antigos (creation_date -> renewal_date) e largar a coluna antiga
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_domains' AND column_name = 'creation_date'
  ) THEN
    EXECUTE $sql$
      UPDATE public.site_domains sd
      SET renewal_date = CASE
        -- Já pago num dado ano: a próxima renovação é o aniversário do ano seguinte
        WHEN sd.last_paid_year IS NOT NULL THEN
          (sd.creation_date + make_interval(years => GREATEST(
            sd.last_paid_year + 1 - EXTRACT(YEAR FROM sd.creation_date)::int, 0
          )))::date
        -- Caso contrário: o primeiro aniversário que ainda não passou
        ELSE COALESCE(
          (SELECT MIN((sd.creation_date + make_interval(years => g))::date)
             FROM generate_series(0, 100) AS g
            WHERE (sd.creation_date + make_interval(years => g))::date >= CURRENT_DATE),
          sd.creation_date
        )
      END
      WHERE sd.renewal_date IS NULL
    $sql$;

    EXECUTE 'ALTER TABLE public.site_domains DROP COLUMN creation_date';
  END IF;

  -- 3. renewal_date passa a ser obrigatória
  UPDATE public.site_domains SET renewal_date = CURRENT_DATE WHERE renewal_date IS NULL;
  ALTER TABLE public.site_domains ALTER COLUMN renewal_date SET NOT NULL;
END
$mig$;

COMMENT ON COLUMN public.site_domains.renewal_date IS
  'Data da próxima renovação do domínio. Avança +1 ano quando é marcado como pago.';
COMMENT ON COLUMN public.site_domains.last_paid_year IS
  'Ano da última renovação paga. Considera-se pago quando last_paid_year = ano(renewal_date) - 1.';
