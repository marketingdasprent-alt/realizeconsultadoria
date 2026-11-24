// Pacotes npm: das funções Deno (mail-api) que os testes do Vitest importam e substituem com
// vi.mock. O tsc do browser não os resolve; aqui ficam declarados sem tipos.
declare module 'npm:imapflow@1.0.164';
declare module 'npm:mailparser@3.7.1';
declare module 'npm:nodemailer@6.9.15';
