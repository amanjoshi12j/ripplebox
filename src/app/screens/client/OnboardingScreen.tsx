import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, Gift, Share2 } from "lucide-react";
import { Button } from "../../components/ui/button";

const slides = [
  {
    icon: Sparkles,
    title: "Discover Premium Salons",
    description: "Find the best hair and beauty salons near you with exclusive member rewards",
    gradient: "from-[#fef3f7] to-[#f5f0fc]",
  },
  {
    icon: Gift,
    title: "Earn & Redeem Rewards",
    description: "Get rewarded for every visit and unlock exclusive perks at your favorite salons",
    gradient: "from-[#f5f0fc] to-[#f5e6c3]",
  },
  {
    icon: Share2,
    title: "Share & Save Together",
    description: "Refer friends and earn bonus rewards. The more you share, the more you save",
    gradient: "from-[#f5e6c3] to-[#fef3f7]",
  },
];

export function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/login");
    }
  };

  const handleSkip = () => {
    navigate("/login");
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="h-screen flex flex-col bg-white max-w-md mx-auto">
      {/* Skip button */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleSkip}
          className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className={`w-48 h-48 mx-auto mb-12 rounded-full bg-gradient-to-br ${slide.gradient} flex items-center justify-center shadow-xl`}>
              <Icon size={80} className="text-white" />
            </div>

            <h2 className="text-2xl mb-4 text-[#2d2d2d]">{slide.title}</h2>
            <p className="text-gray-500 leading-relaxed max-w-sm mx-auto">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="px-8 pb-12">
        {/* Pagination dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? "w-8 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3]"
                  : "w-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Next button */}
        <Button
          onClick={handleNext}
          className="w-full h-14 bg-gradient-to-r from-[#e6d7f5] to-[#f5d7e3] text-[#2d2d2d] hover:opacity-90 transition-opacity rounded-2xl"
        >
          <span className="mr-2">
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </span>
          <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  );
}
