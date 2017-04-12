import { Kernel, KernelMessage, IAjaxSettings } from '@jupyterlab/services';
import { KernelImpl } from './kernel';
import { KernelspecMetadata, ParsedIOMessage } from '../contracts';
import { IJupyterClientAdapter } from './contracts';
import * as Rx from 'rx';

export class JupyterClientKernel extends KernelImpl {
    constructor(kernelUUID: string, kernelSpec: Readonly<Kernel.ISpecModel>, private connection: any, private connectionFile: string, jupyterClient: IJupyterClientAdapter) {
        super(kernelUUID, kernelSpec, jupyterClient);
        this.jupyterClient.on('status', status => {
            this.raiseOnStatusChange(status);
        });
    }

    public dispose() {
        this.shutdown().catch(() => { });
        super.dispose();
    };

    public interrupt(): any {
        this.jupyterClient.interruptKernel(this.kernelUUID);
    };

    public shutdown(restart?: boolean): Promise<any> {
        if (restart === true) {
            return this.jupyterClient.restartKernel(this.kernelUUID);
        }
        return this.jupyterClient.shutdownkernel(this.kernelUUID);
    };

    public execute(code: string): Rx.IObservable<ParsedIOMessage> {
        return this.jupyterClient.runCode(code);
    };
}