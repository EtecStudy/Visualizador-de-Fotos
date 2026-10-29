import type { FileService } from '../types';
import { BrowserFileService } from './browserFileService';
import { DesktopFileService, desktopBridge } from './desktopFileService';

let service: FileService | null = null;

export function getFileService(): FileService {
  if (service) return service;
  const bridge = desktopBridge();
  service = bridge ? new DesktopFileService(bridge) : new BrowserFileService();
  return service;
}

export { BrowserFileService, DesktopFileService };
