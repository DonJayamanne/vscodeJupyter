import { createDeferred } from '../../common/helpers';
const tcpPortUsed = require('tcp-port-used');
export function getAvailablePort(protocol: string, host: string, startPort: number, numberOfPortsToTry: number = 10): Promise<number> {
    let portsToTry = Array(numberOfPortsToTry).fill(0).map((v, index) => startPort + index);
    let def = createDeferred<number>();

    function checkPortAvailability() {
        if (portsToTry.length === 0) {
            def.reject('None available');
        }

        let port = portsToTry.shift();
        isPortAvailable(host, port)
            .then(available => {
                if (available) {
                    def.resolve(port);
                }
                else {
                    checkPortAvailability();
                }
            });
    }

    checkPortAvailability();

    return def.promise;
}

function isPortAvailable(host: string, port: number): Promise<boolean> {
    let def = createDeferred<boolean>();
    tcpPortUsed.check(port, host)
        .then(function (inUse) {
            def.resolve(!inUse);
        }, () => {
            def.resolve(false);
        });

    return def.promise;
}