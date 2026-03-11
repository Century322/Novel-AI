import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkshopStore } from '@/store';
import { createWorldModelService, WorldModelService } from '@/services/world/worldModelService';
import {
  worldBuildingService,
  WorldBuildingProgress,
} from '@/services/worldbuilding/worldBuildingService';
import { settingExtractionService } from '@/services/extraction/settingExtractionService';
import { logger } from '@/services/core/loggerService';

type Step =
  | 'input'
  | 'extracting'
  | 'review'
  | 'characters'
  | 'worldbuilding'
  | 'outline'
  | 'complete';

interface StepConfig {
  id: Step;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  { id: 'input', title: 'Idea Input', description: 'Describe your story idea', icon: <Sparkles size={20} /> },
  {
    id: 'extracting',
    title: 'AI Analysis',
    description: 'Analyzing and extracting world data',
    icon: <Loader2 size={20} className="animate-spin" />,
  },
  { id: 'review', title: 'Review', description: 'Review extracted setup', icon: <FileText size={20} /> },
  { id: 'characters', title: 'Characters', description: 'Review characters', icon: <Users size={20} /> },
  {
    id: 'worldbuilding',
    title: 'Worldbuilding',
    description: 'Review locations, factions, and rules',
    icon: <Globe size={20} />,
  },
  { id: 'outline', title: 'Outline', description: 'Review story outline', icon: <FileText size={20} /> },
  { id: 'complete', title: 'Complete', description: 'World setup is ready', icon: <Check size={20} /> },
];

const STEP_ORDER: Step[] = [
  'input',
  'extracting',
  'review',
  'characters',
  'worldbuilding',
  'outline',
  'complete',
];

export const WorldBuildingWizard: React.FC = () => {
  const { projectPath } = useWorkshopStore();

  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<WorldBuildingProgress | null>(null);
  const [worldModelService, setWorldModelService] = useState<WorldModelService | null>(null);
  const [extractedData, setExtractedData] = useState<{
    characters: number;
    locations: number;
    factions: number;
    rules: number;
    foreshadowing: number;
    suggestions: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndInit = async () => {
      try {
        setError(null);
        const service = createWorldModelService(projectPath || '');
        await service.initialize();

        setWorldModelService(service);
        worldBuildingService.setWorldModelService(service);
        settingExtractionService.setWorldModelService(service);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('Failed to initialize WorldModelService', { error: errorMessage });
        setError(`Initialization failed: ${errorMessage}`);
      }
    };

    checkAndInit();
  }, [projectPath]);

  const handleStartExtraction = useCallback(async () => {
    if (!userInput.trim() || !worldModelService) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStep('extracting');

    try {
      const result = await worldBuildingService.buildWorldFromInput(userInput, {
        generateOutline: true,
        targetWordCount: 100000,
        onProgress: setProgress,
      });

      if (result.success) {
        setExtractedData({
          characters: result.worldModel.characters,
          locations: result.worldModel.locations,
          factions: result.worldModel.factions,
          rules: result.worldModel.rules,
          foreshadowing: result.worldModel.foreshadowing,
          suggestions: result.suggestions,
        });
        setCurrentStep('review');
      } else {
        setError(result.error || 'Build failed');
        setCurrentStep('input');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      logger.error('World building failed', { error: errorMessage });
      setCurrentStep('input');
    } finally {
      setIsProcessing(false);
    }
  }, [userInput, worldModelService]);

  const handleNextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = STEP_ORDER.indexOf(prev);
      return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : prev;
    });
  }, []);

  const handlePrevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const idx = STEP_ORDER.indexOf(prev);
      return idx > 0 ? STEP_ORDER[idx - 1] : prev;
    });
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-400">初始化错误</p>
        <p className="text-xs text-zinc-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          重新加载
        </button>
      </div>
    );
  }

  if (!worldModelService) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <RefreshCw size={24} className="animate-spin mr-2" />
        Loading service...
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const visibleSteps = STEPS.filter((s) => s.id !== 'extracting');

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#1a1a1a]">
      <div className="px-6 py-4 border-b border-white/5">
        <h2 className="text-lg font-medium text-white">Worldbuilding Wizard</h2>
        <p className="text-sm text-zinc-400 mt-1">Build characters, world settings, and story outline</p>
      </div>

      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          {visibleSteps.map((step, index) => {
            const stepIndex = STEPS.findIndex((s) => s.id === step.id);
            const isActive = currentStepIndex === stepIndex;
            const isCompleted = currentStepIndex > stepIndex;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                      isActive && 'bg-blue-500 text-white',
                      isCompleted && 'bg-green-500 text-white',
                      !isActive && !isCompleted && 'bg-white/5 text-zinc-500'
                    )}
                  >
                    {isCompleted ? <Check size={20} /> : step.icon}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-2 transition-colors',
                      isActive && 'text-white',
                      isCompleted && 'text-green-400',
                      !isActive && !isCompleted && 'text-zinc-500'
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 transition-colors',
                      isCompleted ? 'bg-green-500' : 'bg-white/5'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {currentStep === 'input' && (
          <InputStep
            userInput={userInput}
            setUserInput={setUserInput}
            onStart={handleStartExtraction}
            isProcessing={isProcessing}
          />
        )}

        {currentStep === 'extracting' && <ExtractingStep progress={progress} />}

        {currentStep === 'review' && extractedData && (
          <ReviewStep extractedData={extractedData} onNext={handleNextStep} />
        )}

        {currentStep === 'characters' && (
          <CharactersStep
            worldModelService={worldModelService}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}

        {currentStep === 'worldbuilding' && (
          <WorldbuildingStep
            worldModelService={worldModelService}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}

        {currentStep === 'outline' && (
          <OutlineStep
            worldModelService={worldModelService}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        )}

        {currentStep === 'complete' && <CompleteStep onRestart={() => setCurrentStep('input')} />}
      </div>
    </div>
  );
};

interface InputStepProps {
  userInput: string;
  setUserInput: (input: string) => void;
  onStart: () => void;
  isProcessing: boolean;
}

const InputStep: React.FC<InputStepProps> = ({ userInput, setUserInput, onStart, isProcessing }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Sparkles size={48} className="mx-auto text-blue-400 mb-4" />
        <h3 className="text-xl font-medium text-white">Describe Your Story Idea</h3>
        <p className="text-zinc-400 mt-2">Add genre, protagonist, world setup, and core conflict.</p>
      </div>

      <textarea
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="Example: A fantasy story about a village boy who discovers an ancient artifact..."
        className="w-full h-64 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500"
      />

      <button
        onClick={onStart}
        disabled={!userInput.trim() || isProcessing}
        className={cn(
          'w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2',
          userInput.trim() && !isProcessing
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-white/5 text-zinc-500 cursor-not-allowed'
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Sparkles size={20} />
            <span>Start Building</span>
          </>
        )}
      </button>
    </div>
  );
};

const ExtractingStep: React.FC<{ progress: WorldBuildingProgress | null }> = ({ progress }) => {
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <Loader2 size={48} className="mx-auto text-blue-400 animate-spin mb-6" />
      <h3 className="text-xl font-medium text-white mb-2">AI is extracting world information</h3>
      <p className="text-zinc-400 mb-6">{progress?.message || 'Working...'}</p>
      <div className="w-full max-w-md mx-auto bg-white/5 rounded-full h-2 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress?.progress || 0}%` }} />
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{
  extractedData: {
    characters: number;
    locations: number;
    factions: number;
    rules: number;
    foreshadowing: number;
    suggestions: string[];
  };
  onNext: () => void;
}> = ({ extractedData, onNext }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <Check size={48} className="mx-auto text-green-400 mb-4" />
        <h3 className="text-xl font-medium text-white">Extraction Complete</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <StatCard label="Characters" value={extractedData.characters} />
        <StatCard label="Locations" value={extractedData.locations} />
        <StatCard label="Factions" value={extractedData.factions} />
        <StatCard label="Rules" value={extractedData.rules} />
      </div>

      {extractedData.suggestions.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h4 className="text-yellow-400 font-medium mb-2">Suggestions</h4>
          <ul className="space-y-1 text-sm text-zinc-300">
            {extractedData.suggestions.map((suggestion, idx) => (
              <li key={idx}>- {suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
      >
        <span>Continue</span>
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
    <div className="text-zinc-400">{label}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
);

const CharactersStep: React.FC<{
  worldModelService: WorldModelService;
  onNext: () => void;
  onPrev: () => void;
}> = ({ worldModelService, onNext, onPrev }) => {
  const characters = worldModelService.getCharacters();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium text-white">Characters ({characters.length})</h3>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 flex items-center gap-2">
          <Plus size={16} />
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {characters.length === 0 ? (
          <div className="text-zinc-500">No characters yet.</div>
        ) : (
          characters.map((char) => (
            <div key={char.id} className="bg-white/5 rounded-lg border border-white/10 p-4">
              <div className="text-white font-medium">{char.name}</div>
              {char.notes && <div className="text-sm text-zinc-400 mt-1">{char.notes}</div>}
            </div>
          ))
        )}
      </div>

      <StepNav onPrev={onPrev} onNext={onNext} nextLabel="Next" />
    </div>
  );
};

const WorldbuildingStep: React.FC<{
  worldModelService: WorldModelService;
  onNext: () => void;
  onPrev: () => void;
}> = ({ worldModelService, onNext, onPrev }) => {
  const locations = worldModelService.getLocations();
  const factions = worldModelService.getFactions();
  const rules = worldModelService.getRules();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h3 className="text-xl font-medium text-white">Worldbuilding</h3>
      <div className="text-zinc-400 text-sm">
        {locations.length} locations, {factions.length} factions, {rules.length} rules
      </div>
      <StepNav onPrev={onPrev} onNext={onNext} nextLabel="Next" />
    </div>
  );
};

const OutlineStep: React.FC<{
  worldModelService: WorldModelService;
  onNext: () => void;
  onPrev: () => void;
}> = ({ worldModelService, onNext, onPrev }) => {
  const nodes = worldModelService.getOutlineNodes();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h3 className="text-xl font-medium text-white">Outline ({nodes.length})</h3>
      <StepNav onPrev={onPrev} onNext={onNext} nextLabel="Finish" />
    </div>
  );
};

const CompleteStep: React.FC<{ onRestart: () => void }> = ({ onRestart }) => {
  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <Check size={64} className="mx-auto text-green-400 mb-6" />
      <h3 className="text-2xl font-medium text-white mb-2">World Setup Complete</h3>
      <p className="text-zinc-400 mb-8">You can now start writing with this world model.</p>
      <button
        onClick={onRestart}
        className="px-6 py-3 bg-white/5 text-zinc-300 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 mx-auto"
      >
        <RefreshCw size={20} />
        <span>Start Over</span>
      </button>
    </div>
  );
};

const StepNav: React.FC<{ onPrev: () => void; onNext: () => void; nextLabel: string }> = ({
  onPrev,
  onNext,
  nextLabel,
}) => (
  <div className="flex gap-3">
    <button
      onClick={onPrev}
      className="flex-1 py-3 bg-white/5 text-zinc-300 rounded-lg font-medium hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
    >
      <ChevronLeft size={20} />
      <span>Back</span>
    </button>
    <button
      onClick={onNext}
      className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
    >
      <span>{nextLabel}</span>
      <ChevronRight size={20} />
    </button>
  </div>
);

export default WorldBuildingWizard;
