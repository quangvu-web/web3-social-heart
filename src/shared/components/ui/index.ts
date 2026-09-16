/**
 * Shared UI Components
 * Re-export all UI components from a single entry point
 * 
 * NOTE: These are duplicates of src/components/ui for the modular architecture.
 * During migration, both paths will work. Eventually, all imports should use @/shared/components/ui
 */

// Toast
export { 
  Toast, 
  ToastAction, 
  ToastClose, 
  ToastDescription, 
  ToastProvider, 
  ToastTitle, 
  ToastViewport,
  type ToastProps,
  type ToastActionElement,
} from './toast';
export { Toaster } from './toaster';

// Button
export { Button, buttonVariants, type ButtonProps } from './button';
