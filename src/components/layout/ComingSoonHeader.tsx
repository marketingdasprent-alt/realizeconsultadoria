import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo-realize.png";

const navLinks = [
  { label: "Serviços" },
  { label: "Sobre Nós" },
  { label: "Contacto" },
];

const ComingSoonHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img 
              src={logo} 
              alt="Realize" 
              className="h-10 md:h-12 w-auto"
            />
          </div>

          {/* Desktop Navigation - Disabled Links */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <span
                key={link.label}
                className="text-sm font-medium text-muted-foreground/50 cursor-default select-none"
              >
                {link.label}
              </span>
            ))}
          </nav>

          {/* Desktop CTAs - Only these work */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/colaborador/login">
              <Button variant="outline" size="sm">
                Colaboradores
              </Button>
            </Link>
            <Link to="/admin/login">
              <Button variant="gold" size="sm">
                Administração
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/40">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <span
                  key={link.label}
                  className="text-sm font-medium text-muted-foreground/50 cursor-default select-none px-2"
                >
                  {link.label}
                </span>
              ))}
              <div className="flex flex-col space-y-2 pt-4 border-t border-border/40">
                <Link to="/colaborador/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Colaboradores
                  </Button>
                </Link>
                <Link to="/admin/login" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="gold" className="w-full">
                    Administração
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default ComingSoonHeader;
