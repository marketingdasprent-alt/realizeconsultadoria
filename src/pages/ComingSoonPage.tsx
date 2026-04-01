import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ComingSoonHeader from "@/components/layout/ComingSoonHeader";
import Footer from "@/components/layout/Footer";

const ComingSoonPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <ComingSoonHeader />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-8 py-12 mt-16">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto px-4">
          {/* Animated Icon */}
          <motion.div
            className="mb-8 inline-flex items-center justify-center"
            animate={{ 
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="relative">
              <Rocket className="h-16 w-16 sm:h-20 sm:w-20 text-primary" />
              <motion.div
                className="absolute -top-2 -right-2"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-gold" />
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Estamos a construir algo{" "}
            <span className="text-primary">incrível</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            O nosso novo website está em desenvolvimento.
            <br />
            Em breve, teremos uma experiência completa para si.
          </motion.p>

          {/* Additional message */}
          <motion.p
            className="text-sm text-muted-foreground/80 mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Enquanto isso, colaboradores e administradores podem aceder aos seus portais.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link to="/colaborador/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full min-w-[180px]">
                Colaboradores
              </Button>
            </Link>
            <Link to="/admin/login" className="w-full sm:w-auto">
              <Button variant="gold" size="lg" className="w-full min-w-[180px]">
                Administração
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ComingSoonPage;
