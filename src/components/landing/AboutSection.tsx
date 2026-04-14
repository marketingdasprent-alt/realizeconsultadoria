import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const highlights = [
  "Mais de 10 anos de experiência",
  "Equipa especializada multilingue",
  "Parceiros em todo o país",
  "Acompanhamento personalizado",
  "Conformidade RGPD garantida",
  "Suporte contínuo",
];

const AboutSection = () => {
  return (
    <section id="sobre" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-gold font-medium text-sm uppercase tracking-wider">
              Sobre Nós
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-semibold mt-4 mb-6">
              A sua parceira de confiança em Portugal
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              A Realize Consultadoria nasceu da vontade de simplificar e humanizar 
              os processos de gestão de recursos humanos e apoio à imigração em Portugal.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Trabalhamos lado a lado com empresas e colaboradores, oferecendo soluções 
              personalizadas que respondem às necessidades específicas de cada cliente. 
              O nosso compromisso é garantir que cada processo seja tratado com rigor, 
              transparência e dedicação.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {highlights.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="h-5 w-5 text-gold shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual Element */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="aspect-square bg-gradient-hero rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="font-display text-8xl font-bold text-gold mb-4">
                    10+
                  </div>
                  <p className="text-background/80 text-xl">
                    Anos de experiência
                  </p>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gold/10 to-transparent" />
            </div>
            
            {/* Floating Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute -bottom-8 -left-8 bg-card p-6 rounded-lg shadow-elegant max-w-xs"
            >
              <div className="font-display text-3xl font-bold text-gold mb-2">
                500+
              </div>
              <p className="text-muted-foreground text-sm">
                Empresas confiam em nós para gerir os seus recursos humanos
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
