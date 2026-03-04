import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

// Educational content database
export const educationContent = {
  completeProtein: {
    title: 'Complete Protein',
    quick: 'Contains all 9 essential amino acids your body cannot make.',
    detailed: `A complete protein provides all 9 essential amino acids in adequate amounts. Your body cannot produce these, so you must get them from food.

**Essential Amino Acids:**
• Histidine - Tissue repair, immune function
• Isoleucine - Muscle metabolism, energy
• Leucine - Protein synthesis, muscle growth
• Lysine - Calcium absorption, collagen
• Methionine - Metabolism, detoxification
• Phenylalanine - Neurotransmitter production
• Threonine - Collagen, elastin production
• Tryptophan - Serotonin, sleep regulation
• Valine - Muscle growth, tissue repair

**Complete protein sources:** Eggs, meat, fish, dairy, quinoa, soy

**Tip:** Combine incomplete proteins (rice + beans) to get all amino acids.`
  },
  aminoAcids: {
    title: 'Amino Acids',
    quick: 'Building blocks of protein. 9 are "essential" - you must eat them.',
    detailed: `Amino acids are organic compounds that combine to form proteins. When you eat protein, your body breaks it down into amino acids.

**Why track amino acids?**
Not all protein is equal. 100g of protein from rice vs beef have very different amino acid profiles. Tracking helps ensure you're getting what your body needs.

**Essential vs Non-Essential:**
• Essential (9): Must come from food
• Non-essential (11): Body can produce
• Conditional: Needed during illness/stress

**For Keto Dieters:**
High-fat protein sources like beef, salmon, and eggs typically provide complete amino acid profiles while keeping you in ketosis.`
  },
  ketoScore: {
    title: 'Keto Score',
    quick: 'Measures how keto-friendly your daily intake is (0-100).',
    detailed: `The Keto Score rates your daily food choices on a 0-100 scale based on macronutrient ratios optimal for ketosis.

**Scoring Factors:**
• Net carbs (biggest impact)
• Fat-to-protein ratio
• Fiber content
• Food quality

**Score Ranges:**
• 90-100: Deep ketosis likely
• 70-89: Good ketogenic state
• 50-69: Light ketosis possible
• Below 50: May kick you out of ketosis

**Tips to improve:**
• Stay under 20g net carbs
• Prioritize healthy fats
• Moderate protein intake
• Choose whole foods`
  },
  omegaRatio: {
    title: 'Omega-3:6 Ratio',
    quick: 'Ideal ratio is 1:1 to 1:4. Most people are at 1:15 or worse.',
    detailed: `The Omega-3 to Omega-6 ratio is crucial for inflammation control and overall health.

**Why it matters:**
• Omega-6 promotes inflammation (needed, but often excessive)
• Omega-3 reduces inflammation
• Modern diets are heavily skewed toward Omega-6

**Ideal Ratio:** 1:1 to 1:4 (Omega-3 to Omega-6)
**Typical Western Diet:** 1:15 to 1:20

**Improve your ratio:**
• Eat fatty fish 2-3x/week (salmon, mackerel, sardines)
• Use olive oil instead of vegetable oils
• Limit processed foods
• Consider fish oil supplements

**Keto Advantage:**
Many keto foods (salmon, sardines, grass-fed beef) are naturally high in Omega-3.`
  },
  nutritionScore: {
    title: 'Nutrition Score',
    quick: 'Combined score based on protein quality, amino acids, and fatty acids.',
    detailed: `The Nutrition Score gives you a holistic view of your daily nutrition quality beyond just macros.

**Components:**
• Protein completion (33%) - Are you getting all essential amino acids?
• Omega balance (33%) - Is your fatty acid ratio healthy?
• Keto adherence (34%) - Are you staying in ketosis?

**Grades:**
• A (90-100): Excellent - Optimal nutrition
• B (75-89): Good - Minor improvements possible
• C (60-74): Fair - Some gaps to address
• D (40-59): Poor - Significant gaps
• F (0-39): Needs work - Major improvements needed

**How to improve:**
• Vary protein sources throughout the day
• Include fatty fish regularly
• Stay within carb limits
• Eat whole, unprocessed foods`
  },
  leanBodyMass: {
    title: 'Lean Body Mass (LBM)',
    quick: 'Your weight minus body fat. Used to calculate protein needs.',
    detailed: `Lean Body Mass is everything in your body except fat: muscles, bones, organs, water.

**Why use LBM for protein?**
Fat tissue doesn't need protein for maintenance. Calculating protein needs based on LBM is more accurate than total body weight.

**Formula:**
LBM = Weight × (1 - Body Fat %)

**Example:**
180 lbs at 20% body fat
LBM = 180 × 0.80 = 144 lbs (65 kg)

**Protein recommendations per kg LBM:**
• Sedentary: 1.2-1.6g
• Active: 1.6-2.2g
• Athlete/Building muscle: 2.2-3.0g

**For Keto:**
Higher protein (2.0-2.5g/kg LBM) helps preserve muscle during fat loss.`
  }
};

// Info tooltip with quick explanation
export const InfoTooltip = ({ contentKey, className }) => {
  const { theme } = useTheme();
  const content = educationContent[contentKey];
  
  if (!content) return null;
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button className={cn(
            "inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors",
            theme === 'dark' 
              ? 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10' 
              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50',
            className
          )}>
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className={cn(
            "max-w-xs p-3",
            theme === 'dark' 
              ? 'bg-zinc-800 border-zinc-700 text-white' 
              : 'bg-white border-gray-200 text-gray-900'
          )}
        >
          <p className="font-semibold mb-1">{content.title}</p>
          <p className={cn(
            "text-sm",
            theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
          )}>{content.quick}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Expandable education card
export const EducationCard = ({ contentKey, defaultExpanded = false }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const content = educationContent[contentKey];
  
  if (!content) return null;
  
  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      theme === 'dark' 
        ? 'bg-zinc-900/50 border-white/10' 
        : 'bg-white border-gray-200'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
          )}>
            <Info className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className={cn(
              "font-semibold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>{content.title}</p>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
            )}>{content.quick}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-400'} />
        ) : (
          <ChevronDown className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-400'} />
        )}
      </button>
      
      {expanded && (
        <div className={cn(
          "px-4 pb-4 border-t",
          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
        )}>
          <div className={cn(
            "mt-4 prose prose-sm max-w-none",
            theme === 'dark' ? 'prose-invert' : ''
          )}>
            {content.detailed.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className={cn(
                "mb-3 text-sm whitespace-pre-line",
                theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
              )}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Full education modal
export const EducationModal = ({ contentKey, open, onClose }) => {
  const { theme } = useTheme();
  const content = educationContent[contentKey];
  
  if (!content) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-lg max-h-[80vh] overflow-y-auto",
        theme === 'dark' 
          ? 'bg-zinc-900 border-white/10 text-white' 
          : 'bg-white border-gray-200 text-gray-900'
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
            )}>
              <Info className="w-5 h-5 text-emerald-500" />
            </div>
            {content.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <p className={cn(
            "text-lg mb-4 p-3 rounded-lg",
            theme === 'dark' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
          )}>
            {content.quick}
          </p>
          
          <div className="space-y-4">
            {content.detailed.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className={cn(
                "text-sm whitespace-pre-line leading-relaxed",
                theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
              )}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Inline learn more link
export const LearnMoreLink = ({ contentKey, children }) => {
  const { theme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-medium transition-colors",
          theme === 'dark' 
            ? 'text-emerald-400 hover:text-emerald-300' 
            : 'text-emerald-600 hover:text-emerald-500'
        )}
      >
        {children || 'Learn more'}
        <Info className="w-3.5 h-3.5" />
      </button>
      <EducationModal 
        contentKey={contentKey} 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </>
  );
};
