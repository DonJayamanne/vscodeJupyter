"use strict";

import { KernelspecMetadata, Kernelspec, ParsedIOMessage } from '../contracts';
import * as Rx from 'rx';
import { Kernel } from '@jupyterlab/services';

export interface IJupyterClientAdapter {
    getAllKernelSpecs(): Promise<Kernel.ISpecModels>;
    startKernel(kernelSpec: Kernel.ISpecModel): Promise<[string, any, string]>;
    shutdownkernel(kernelUUID: string): Promise<any>;
    interruptKernel(kernelUUID: string): Promise<any>;
    restartKernel(kernelUUID: string): Promise<any>;
    runCode(code: string): Rx.IObservable<ParsedIOMessage>;
    on(event: string | symbol, listener: Function): this;
}

export enum KernelCommand {
    shutdown, restart, interrupt
}
