import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ContactSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simular envio
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Mensagem enviada!",
      description: "Entraremos em contacto consigo brevemente.",
    });
    
    setIsLoading(false);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <section id="contacto" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-gold font-medium text-sm uppercase tracking-wider">
            Contacte-nos
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mt-4 mb-6">
            Estamos aqui para ajudar
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Tem questões? Entre em contacto connosco. A nossa equipa terá todo o gosto 
            em esclarecer as suas dúvidas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h4 className="font-display text-xl font-semibold mb-1">Email</h4>
                <p className="text-muted-foreground">info@realizeconsultadoria.pt</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h4 className="font-display text-xl font-semibold mb-1">Telefone</h4>
                <p className="text-muted-foreground">+351 21 000 0000</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h4 className="font-display text-xl font-semibold mb-1">Morada</h4>
                <p className="text-muted-foreground">
                  Avenida da Liberdade, 110<br />
                  1250-146 Lisboa, Portugal
                </p>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <form onSubmit={handleSubmit} className="bg-card p-8 rounded-lg shadow-card">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Nome *
                  </label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="O seu nome"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="email@exemplo.pt"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  Telefone
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+351 900 000 000"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Mensagem *
                </label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Como podemos ajudá-lo?"
                />
              </div>

              <Button type="submit" variant="gold" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  "A enviar..."
                ) : (
                  <>
                    Enviar Mensagem
                    <Send className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Ao submeter este formulário, concorda com a nossa{" "}
                <a href="/politica-privacidade" className="text-gold hover:underline">
                  Política de Privacidade
                </a>.
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
