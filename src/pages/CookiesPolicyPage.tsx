import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const CookiesPolicyPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
            Política de Cookies
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground mb-6">
              Última atualização: Janeiro de 2026
            </p>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">O que são Cookies?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Cookies são pequenos ficheiros de texto que os websites colocam no seu dispositivo 
                quando os visita. São amplamente utilizados para fazer os websites funcionarem 
                de forma mais eficiente e fornecer informações aos proprietários do site.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">Cookies que Utilizamos</h2>
              
              <h3 className="font-display text-xl font-semibold mb-3 mt-6">Cookies Essenciais</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Estes cookies são necessários para o funcionamento do website. Incluem, por exemplo, 
                cookies que permitem fazer login na sua área de cliente.
              </p>

              <h3 className="font-display text-xl font-semibold mb-3 mt-6">Cookies de Desempenho</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Estes cookies recolhem informações sobre como os visitantes usam o website, 
                permitindo-nos melhorar o seu funcionamento.
              </p>

              <h3 className="font-display text-xl font-semibold mb-3 mt-6">Cookies de Funcionalidade</h3>
              <p className="text-muted-foreground leading-relaxed">
                Permitem que o website se lembre das suas escolhas (como o seu nome de utilizador 
                ou preferências de idioma) para proporcionar uma experiência mais personalizada.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">Gestão de Cookies</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Pode controlar e/ou eliminar cookies conforme desejar. Pode eliminar todos os 
                cookies que já estão no seu computador e configurar a maioria dos browsers para 
                impedir que sejam colocados.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                No entanto, se o fizer, poderá ter de ajustar manualmente algumas preferências 
                sempre que visitar um site e alguns serviços e funcionalidades poderão não funcionar.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-2xl font-semibold mb-4">Contacto</h2>
              <p className="text-muted-foreground leading-relaxed">
                Se tiver questões sobre a nossa utilização de cookies, contacte-nos através de: 
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

export default CookiesPolicyPage;
