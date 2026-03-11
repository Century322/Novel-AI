import { ServiceError } from './errorHandling';
import { logger } from './loggerService';

export type ServiceFactory<T> = (container: ServiceContainer) => T;
export type ServiceInitializer<T> = (service: T, container: ServiceContainer) => Promise<void> | void;

interface ServiceRegistration {
  factory: ServiceFactory<unknown>;
  instance?: unknown;
  initialized: boolean;
  initializer?: ServiceInitializer<unknown>;
  dependencies: string[];
}

export class ServiceContainer {
  private registrations = new Map<string, ServiceRegistration>();
  private initializing = new Set<string>();
  private projectPath: string;

  constructor(projectPath: string = '') {
    this.projectPath = projectPath;
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  register<T>(
    name: string,
    factory: ServiceFactory<T>,
    options: {
      dependencies?: string[];
      initializer?: ServiceInitializer<T>;
    } = {}
  ): this {
    if (this.registrations.has(name)) {
      logger.warn(`Service "${name}" is already registered, overwriting`);
    }

    this.registrations.set(name, {
      factory: factory as ServiceFactory<unknown>,
      initialized: false,
      initializer: options.initializer as ServiceInitializer<unknown> | undefined,
      dependencies: options.dependencies || [],
    });

    return this;
  }

  has(name: string): boolean {
    return this.registrations.has(name);
  }

  get<T>(name: string): T {
    const registration = this.registrations.get(name);

    if (!registration) {
      throw ServiceError.notFound('Service', name);
    }

    if (registration.instance === undefined) {
      registration.instance = registration.factory(this);
    }

    return registration.instance as T;
  }

  async initialize(name: string): Promise<void> {
    const registration = this.registrations.get(name);

    if (!registration) {
      throw ServiceError.notFound('Service', name);
    }

    if (registration.initialized) {
      return;
    }

    if (this.initializing.has(name)) {
      throw new ServiceError(
        `Circular dependency detected while initializing "${name}"`,
        'INITIALIZATION_FAILED' as never,
        { initializing: Array.from(this.initializing) }
      );
    }

    this.initializing.add(name);

    try {
      for (const dep of registration.dependencies) {
        await this.initialize(dep);
      }

      const instance = this.get(name);

      if (registration.initializer) {
        await registration.initializer(instance, this);
      }

      registration.initialized = true;
      logger.debug(`Service "${name}" initialized`);
    } finally {
      this.initializing.delete(name);
    }
  }

  async initializeAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const name of this.registrations.keys()) {
      promises.push(this.initialize(name));
    }

    await Promise.all(promises);
  }

  isInitialized(name: string): boolean {
    const registration = this.registrations.get(name);
    return registration?.initialized ?? false;
  }

  dispose(name: string): void {
    const registration = this.registrations.get(name);
    if (!registration) {
      return;
    }
    if (registration.instance && typeof (registration.instance as { dispose?: () => void }).dispose === 'function') {
      (registration.instance as { dispose: () => void }).dispose();
    }
    registration.instance = undefined;
    registration.initialized = false;
  }

  disposeAll(): void {
    for (const name of this.registrations.keys()) {
      this.dispose(name);
    }
  }
}

let globalContainer: ServiceContainer | null = null;

export function getGlobalContainer(): ServiceContainer {
  if (!globalContainer) {
    globalContainer = new ServiceContainer();
  }
  return globalContainer;
}

export function setGlobalContainer(container: ServiceContainer): void {
  globalContainer = container;
}

export function createServiceContainer(projectPath: string): ServiceContainer {
  return new ServiceContainer(projectPath);
}
