/**
 * React hooks for model management
 */

import { useCallback, useEffect, useState } from 'react';
import {
  loadModel,
  listModels,
  getModelsFolder,
  type LoadModelOptions,
} from '../tauri-bindings';

export function useModel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (options: LoadModelOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      const message = await loadModel(options);
      setIsModelLoaded(true);
      setCurrentModel(options.model_path);
      console.log(message);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsModelLoaded(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    isModelLoaded,
    currentModel,
    error,
    load,
  };
}

export function useModelList() {
  const [models, setModels] = useState<string[]>([]);
  const [modelsFolder, setModelsFolder] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const folder = await getModelsFolder();
      setModelsFolder(folder);

      const modelList = await listModels(folder);
      setModels(modelList);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    modelsFolder,
    isLoading,
    error,
    refresh: fetchModels,
  };
}
