// Edge function mail-oauth (ligar caixas por OAuth). A lógica está em handler.ts (também usada por
// scripts/dev-mail-functions.ts, para correr as funções no localhost).
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { mailOAuthHandler } from './handler.ts';

serve(mailOAuthHandler);
