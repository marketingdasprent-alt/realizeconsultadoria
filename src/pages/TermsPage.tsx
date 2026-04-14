import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const TermsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
            Termos e Condições
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground mb-6">
              Última atualização: Janeiro de 2026
            </p>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">1. Identificação</h2>
              <p className="text-muted-foreground leading-relaxed">
                Este website é propriedade da Realize Consultadoria, Lda., sociedade comercial 
                por quotas, com sede na Avenida da Liberdade, 110, 1250-146 Lisboa, Portugal.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">2. Objeto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Os presentes Termos e Condições regulam o acesso e utilização do website 
                www.realizeconsultadoria.pt e da plataforma de gestão de recursos humanos 
                disponibilizada aos clientes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">3. Serviços</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                A Realize Consultadoria disponibiliza os seguintes serviços:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Consultoria em gestão de recursos humanos</li>
                <li>Apoio em processos de imigração e legalização</li>
                <li>Plataforma digital para gestão de férias e ausências</li>
                <li>Gestão documental</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">4. Acesso à Plataforma</h2>
              <p className="text-muted-foreground leading-relaxed">
                O acesso à área de cliente requer registo prévio. Cada utilizador é responsável 
                pela confidencialidade das suas credenciais de acesso. A partilha de credenciais 
                é expressamente proibida.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">5. Obrigações do Utilizador</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                O utilizador compromete-se a:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Utilizar a plataforma de forma lícita e de boa-fé</li>
                <li>Não comprometer a segurança ou funcionamento do sistema</li>
                <li>Respeitar a legislação aplicável</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">6. Propriedade Intelectual</h2>
              <p className="text-muted-foreground leading-relaxed">
                Todos os conteúdos do website, incluindo textos, imagens, logótipos e software, 
                são propriedade da Realize Consultadoria ou dos seus licenciantes, estando 
                protegidos pela legislação aplicável em matéria de propriedade intelectual.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Realize Consultadoria não se responsabiliza por danos resultantes de 
                interrupções no serviço, erros técnicos ou uso indevido da plataforma 
                por parte dos utilizadores.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">8. Lei Aplicável</h2>
              <p className="text-muted-foreground leading-relaxed">
                Os presentes Termos e Condições são regidos pela legislação portuguesa. 
                Para a resolução de qualquer litígio, as partes elegem o foro da comarca de Lisboa.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">9. Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para esclarecimentos sobre estes Termos e Condições, contacte-nos através de: 
                info@realizeconsultadoria.pt
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
