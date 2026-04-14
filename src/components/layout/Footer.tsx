import { Link } from "react-router-dom";
import logo from "@/assets/logo-realize.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Logo e Descrição */}
          <div className="md:col-span-2">
            <img 
              src={logo} 
              alt="Realize Consultadoria" 
              className="h-12 w-auto mb-6 brightness-0 invert"
            />
            <p className="text-background/70 max-w-md leading-relaxed">
              Especialistas em gestão de recursos humanos e apoio à imigração. 
              Ajudamos empresas e colaboradores a realizarem os seus objetivos em Portugal.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Navegação</h4>
            <ul className="space-y-3">
              <li>
                <a href="#servicos" className="text-background/70 hover:text-gold transition-colors">
                  Serviços
                </a>
              </li>
              <li>
                <a href="#sobre" className="text-background/70 hover:text-gold transition-colors">
                  Sobre Nós
                </a>
              </li>
              <li>
                <a href="#contacto" className="text-background/70 hover:text-gold transition-colors">
                  Contacto
                </a>
              </li>
              <li>
                <Link to="/auth" className="text-background/70 hover:text-gold transition-colors">
                  Área de Cliente
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-6">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/politica-privacidade" className="text-background/70 hover:text-gold transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/termos-condicoes" className="text-background/70 hover:text-gold transition-colors">
                  Termos e Condições
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-background/70 hover:text-gold transition-colors">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-background/20 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-background/60 text-sm">
              © {currentYear} Realize Consultadoria. Todos os direitos reservados.
            </p>
            <p className="text-background/60 text-sm">
              NIF: 000000000 | Portugal
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
