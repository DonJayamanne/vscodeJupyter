
export const PythonLanguage = { language: 'python', scheme: 'file' };

export namespace Commands {
    export namespace Jupyter {
        export const Get_All_KernelSpecs_For_Language = 'jupyter2.getAllKernelSpecsForLanguage';
        export const Get_All_KernelSpecs = 'jupyter2.getAllKernelSpecs';
        export const Kernel_Options = 'jupyter2.kernelOptions';
        export const StartKernelForKernelSpeck = 'jupyter2.sartKernelForKernelSpecs';
        export const ExecuteRangeInKernel = 'jupyter2.execRangeInKernel';
        export const ExecuteSelectionOrLineInKernel = 'jupyter2.runSelectionLine';
        export namespace Cell {
            export const ExecuteCurrentCell = 'jupyter2.execCurrentCell';
            export const ExecuteCurrentCellAndAdvance = 'jupyter2.execCurrentCellAndAdvance';
            export const AdcanceToCell = 'jupyter2.advanceToNextCell';
            export const DisplayCellMenu = 'jupyter2.displayCellMenu';
            export const GoToPreviousCell = 'jupyter2.gotToPreviousCell';
            export const GoToNextCell = 'jupyter2.gotToNextCell';
        }
        export namespace Kernel {
            export const Select = 'jupyter2.selectKernel';
            export const Interrupt = 'jupyter2.kernelInterrupt';
            export const Restart = 'jupyter2.kernelRestart';
            export const Shutdown = 'jupyter2.kernelShutDown';
            export const Details = 'jupyter2.kernelDetails';
        }
        export namespace Notebook {
            export const ShutDown = 'jupyter.shutdown';
        }
    }
}