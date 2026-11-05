# DNS do email — para os emails não irem para o spam

Verificado a 05/11/2026 (DNS dos dois domínios está no Cloudflare, conta marketing.dasprent@gmail.com).
Cloudflare → domínio → **DNS → Records**. Mudar só o que está aqui.

## 1. dasprent.pt — SPF repetido (TXT na raiz `@`)

Agora:
```
v=spf1 +ip4:185.12.116.106 +include:spf.protection.outlook.com include:spf.protection.outlook.com ~all
```
Passa a:
```
v=spf1 ip4:185.12.116.106 include:spf.protection.outlook.com ~all
```

## 2. dasprent.pt — DKIM do Microsoft 365 (o mais importante)

O email da dasprent.pt é Microsoft 365, mas os emails saem **sem assinatura DKIM do domínio**
(não há `selector1._domainkey.dasprent.pt`). Por isso vão mais vezes para o spam.

1. Entrar em https://security.microsoft.com/dkimv2 (admin do Microsoft 365).
2. Clicar em **dasprent.pt** → aparecem 2 registos CNAME (`selector1` e `selector2`) com o valor
   próprio do vosso tenant.
3. No Cloudflare, criar os 2 CNAME tal como aparecem, com **Proxy desligado (DNS only, nuvem cinzenta)**:
   - Nome `selector1._domainkey` → valor `selector1-dasprent-pt._domainkey.<…>` (copiar do Microsoft)
   - Nome `selector2._domainkey` → valor `selector2-dasprent-pt._domainkey.<…>`
4. Esperar ~15 min e, no Microsoft, ligar **"Assinar mensagens com DKIM"**.

## 3. realizeconsultadoria.pt — DMARC com relatórios (TXT `_dmarc`)

Agora: `v=DMARC1; p=none;` (ninguém recebe relatórios).
Passa a:
```
v=DMARC1; p=none; rua=mailto:marketing@dasprent.pt; fo=1
```
E, porque o relatório vai para outro domínio, **no domínio dasprent.pt** criar este TXT:
- Nome `realizeconsultadoria.pt._report._dmarc` → valor `v=DMARC1`

## 4. Daqui a 3–4 semanas (depois de ver os relatórios sem problemas)

Endurecer o DMARC nos dois domínios para quem se fizer passar por vocês ir para o spam:
```
p=quarantine
```
(Não fazer já: se algum sistema legítimo — Brevo, cPanel, impressoras… — não estiver no SPF/DKIM,
os emails dele passariam a ir para o spam.)
