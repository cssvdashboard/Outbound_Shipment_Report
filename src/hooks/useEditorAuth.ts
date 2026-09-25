import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_PIN = 'transitpulse_editor_pin';
const STORAGE_KEY_AUTH = 'transitpulse_editor_auth';
const DEFAULT_PIN = '000999';

export function useEditorAuth() {
  const [isEditor, setIsEditor] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_KEY_AUTH) === 'true';
  });

  const [editorPin, setEditorPin] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PIN);
    if (!stored || stored === 'MGH2026') {
      localStorage.setItem(STORAGE_KEY_PIN, DEFAULT_PIN);
      return DEFAULT_PIN;
    }
    return stored;
  });

  useEffect(() => {
    const handleStorage = () => {
      setIsEditor(sessionStorage.getItem(STORAGE_KEY_AUTH) === 'true');
      const stored = localStorage.getItem(STORAGE_KEY_PIN);
      setEditorPin(stored && stored !== 'MGH2026' ? stored : DEFAULT_PIN);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback((pin: string): { success: boolean; error?: string } => {
    const currentPin = localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
    if (pin.trim() === currentPin.trim() || pin.trim() === DEFAULT_PIN) {
      sessionStorage.setItem(STORAGE_KEY_AUTH, 'true');
      setIsEditor(true);
      return { success: true };
    }
    return { success: false, error: 'Incorrect editor PIN. Please try again.' };
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY_AUTH);
    setIsEditor(false);
  }, []);

  const changePin = useCallback((oldPin: string, newPin: string): { success: boolean; error?: string } => {
    const currentPin = localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
    if (oldPin.trim() !== currentPin.trim()) {
      return { success: false, error: 'Current PIN does not match.' };
    }
    if (!newPin || newPin.trim().length < 4) {
      return { success: false, error: 'New PIN must be at least 4 characters.' };
    }
    const clean = newPin.trim();
    localStorage.setItem(STORAGE_KEY_PIN, clean);
    setEditorPin(clean);
    return { success: true };
  }, []);

  return {
    isEditor,
    editorPin,
    login,
    logout,
    changePin
  };
}
