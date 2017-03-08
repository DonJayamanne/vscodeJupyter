import * as io from 'socket.io-client';

export class ServerBridge {
    private socket: SocketIOClient.Socket;
    constructor() {
        // Use io (object) available in the script
        this.socket = (window as any).io();
        this.socket.on('connect', () => {
            console.log('bridge works');
        });
    }
}