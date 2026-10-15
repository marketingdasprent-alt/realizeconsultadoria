// Edge function mail-api (API do Webmail). A lógica está em handler.ts (também usada por
// scripts/dev-mail-functions.ts, para correr as funções no localhost).
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { mailApiHandler } from './handler.ts';

serve(mailApiHandler);
