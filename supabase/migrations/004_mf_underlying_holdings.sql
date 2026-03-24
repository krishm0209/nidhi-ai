CREATE TABLE public.mf_underlying_holdings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code   INTEGER NOT NULL,
  stock_name    TEXT NOT NULL,
  stock_isin    TEXT,
  pct_of_aum    DECIMAL(5,2) NOT NULL,
  rank          INTEGER,
  as_of_date    DATE NOT NULL,
  source        TEXT NOT NULL DEFAULT 'gemini',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON public.mf_underlying_holdings (scheme_code);
CREATE INDEX ON public.mf_underlying_holdings (scheme_code, as_of_date DESC);
