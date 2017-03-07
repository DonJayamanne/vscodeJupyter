import { createDeferred } from '../common/helpers';
const waitOn = require('wait-on');
export function getAvailablePort(protocol: string, host: string, startPort: number, numberOfPortsToTry: number = 10): Promise<number> {
    let portsToTry = Array(numberOfPortsToTry).fill(0).map((v, index) => startPort + index);
    let def = createDeferred<number>();

    function checkPortAvailability() {
        if (portsToTry.length === 0) {
            def.reject();
        }

        let port = portsToTry.shift();
        isPortAvailable(`${protocol}://${host}:${port}`)
            .then(def.resolve.bind(def))
            .catch(() => {
                checkPortAvailability();
            });
    }

    checkPortAvailability();

    return def.promise;
}

function isPortAvailable(url: string): Promise<boolean> {
    let def = createDeferred<boolean>();
    waitOn({
        resources: [url],
<<<<<<< HEAD
        delay: 0, // initial delay in ms, default 0 
        interval: 10, // poll interval in ms, default 250ms 
        timeout: 100 // timeout in ms, default Infinity 
=======
        delay: 0, // initial delay in ms, default 0
        interval: 10, // poll interval in ms, default 250ms
        timeout: 100 // timeout in ms, default Infinity
>>>>>>> 59ed4b312bad8a4f08c90f1f28bd6a68c20b8e3b
    }, (err) => {
        if (err) {
            def.reject(false);
        }
        else {
            def.resolve(true);
        }
    });

    return def.promise;
}