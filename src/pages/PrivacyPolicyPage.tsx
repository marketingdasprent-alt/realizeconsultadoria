import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
            Política de Privacidade
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground mb-6">
              Última atualização: Janeiro de 2026
            </p>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">1. Responsável pelo Tratamento</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Realize Consultadoria, Lda. (doravante "Realize Consultadoria", "nós" ou "empresa"), 
                com sede na Avenida da Liberdade, 110, 1250-146 Lisboa, Portugal, é a entidade responsável 
                pelo tratamento dos seus dados pessoais, nos termos do Regulamento Geral sobre a Proteção 
                de Dados (RGPD) – Regulamento (UE) 2016/679.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">2. Dados Pessoais Recolhidos</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Recolhemos os seguintes dados pessoais:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Dados de identificação: nome, NIF, número de identificação civil</li>
                <li>Dados de contacto: email, telefone, morada</li>
                <li>Dados profissionais: empresa, cargo, departamento</li>
                <li>Dados de utilização da plataforma: registos de férias, ausências</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">3. Finalidades do Tratamento</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Os seus dados são tratados para as seguintes finalidades:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Prestação de serviços de consultoria em recursos humanos</li>
                <li>Apoio em processos de imigração e legalização</li>
                <li>Gestão de férias e ausências através da plataforma digital</li>
                <li>Comunicação sobre os nossos serviços</li>
                <li>Cumprimento de obrigações legais</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">4. Base Legal</h2>
              <p className="text-muted-foreground leading-relaxed">
                O tratamento dos seus dados pessoais baseia-se: (a) na execução de contrato; 
                (b) no cumprimento de obrigações legais; (c) no consentimento quando aplicável; 
                e (d) nos interesses legítimos da empresa.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">5. Os Seus Direitos</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Nos termos do RGPD, tem direito a:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Aceder aos seus dados pessoais</li>
                <li>Retificar dados inexatos ou incompletos</li>
                <li>Solicitar o apagamento dos dados (direito ao esquecimento)</li>
                <li>Limitar o tratamento dos dados</li>
                <li>Portabilidade dos dados</li>
                <li>Opor-se ao tratamento</li>
                <li>Retirar o consentimento a qualquer momento</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Para exercer estes direitos, contacte-nos através de: rgpd@realizeconsultadoria.pt
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">6. Prazo de Conservação</h2>
              <p className="text-muted-foreground leading-relaxed">
                Os dados pessoais são conservados pelo período necessário à prossecução das 
                finalidades para as quais foram recolhidos, ou durante o prazo legalmente 
                exigido para cumprimento de obrigações legais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">7. Segurança</h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas técnicas e organizativas adequadas para proteger os seus 
                dados pessoais contra acessos não autorizados, perda ou destruição acidental.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">8. Contacto e Reclamações</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para questões relacionadas com a proteção de dados, contacte o nosso Encarregado 
                de Proteção de Dados através de: dpo@realizeconsultadoria.pt
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Tem também o direito de apresentar uma reclamação junto da Comissão Nacional de 
                Proteção de Dados (CNPD): www.cnpd.pt
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
