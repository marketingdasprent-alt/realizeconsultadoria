import { motion } from "framer-motion";
import { Users, Globe, FileText, Calendar, Shield, HeartHandshake } from "lucide-react";

const services = [
  {
    icon: Users,
    title: "Gestão de RH",
    description: "Gestão completa de recursos humanos, desde o recrutamento até ao desenvolvimento de talento.",
  },
  {
    icon: Globe,
    title: "Apoio à Imigração",
    description: "Acompanhamento em todos os processos de visto, autorização de residência e legalização.",
  },
  {
    icon: FileText,
    title: "Documentação",
    description: "Tratamento e organização de toda a documentação necessária para empresas e colaboradores.",
  },
  {
    icon: Calendar,
    title: "Gestão de Férias",
    description: "Plataforma digital para marcação e gestão de férias e ausências dos colaboradores.",
  },
  {
    icon: Shield,
    title: "Conformidade Legal",
    description: "Garantimos o cumprimento de todas as obrigações legais e regulamentares em Portugal.",
  },
  {
    icon: HeartHandshake,
    title: "Integração Cultural",
    description: "Apoio na adaptação cultural e integração de colaboradores internacionais.",
  },
];

const ServicesSection = () => {
  return (
    <section id="servicos" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-gold font-medium text-sm uppercase tracking-wider">
            Os Nossos Serviços
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mt-4 mb-6">
            Soluções Completas para a sua Empresa
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Oferecemos um conjunto integrado de serviços que simplificam a gestão de recursos humanos 
            e facilitam os processos de imigração.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group bg-card p-8 rounded-lg shadow-card hover:shadow-elegant transition-all duration-300"
            >
              <div className="w-14 h-14 bg-gold/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-colors">
                <service.icon className="h-7 w-7 text-gold" />
              </div>
              <h3 className="font-display text-2xl font-semibold mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
