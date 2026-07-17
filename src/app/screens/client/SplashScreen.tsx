import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/onboarding");
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#fef3f7] via-white to-[#f5f0fc] max-w-md mx-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="inline-block mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#e6d7f5] to-[#f5d7e3] flex items-center justify-center shadow-lg">
            <Sparkles size={48} className="text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl mb-2 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] bg-clip-text text-transparent"
        >
          Ripplebox
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-gray-500 text-sm"
        >
          Beauty rewards that grow with you
        </motion.p>
      </motion.div>
    </div>
  );
}
