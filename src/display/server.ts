import * as io from 'socket.io';
import * as http from 'http';
import { createDeferred, Deferred } from '../common/helpers';
import { EventEmitter } from 'events';
import * as express from 'express';
import { Express } from 'express';
import * as path from 'path';
import * as cors from 'cors';
export class Server extends EventEmitter {
    private server: SocketIO.Server;
    private app: Express;
    private httpServer: http.Server;
    private clients: SocketIO.Socket[] = [];
    constructor() {
        super();
        this.responsePromises = new Map<string, Deferred<boolean>>();
    }

    public dispose() {
        this.app = null;
        this.port = null;
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }

    private port: number;
    public start(): Promise<number> {
        if (this.port) {
            return Promise.resolve(this.port);
        }
        let def = createDeferred<number>();

        this.app = express();
        this.httpServer = http.createServer(this.app);
        this.server = io(this.httpServer);

        let rootDirectory = path.join(__dirname, '..', '..', 'browser');
        this.app.use(express.static(rootDirectory));
        this.app.use(cors());
        this.app.get('/', function (req, res, next) {
            res.sendFile(path.join(rootDirectory, 'index.html'));
        });

        this.httpServer.listen(0, () => {
            this.port = this.httpServer.address().port;
            def.resolve(this.port);
            def = null;
        });
        this.httpServer.on('error', error => {
            if (def) {
                def.reject(error);
            }
        });

        this.server.on('connection', this.onSocketConnection.bind(this));
        return def.promise;
    }
    public sendResults(data: any[]) {
        this.broadcast('results', data);
    }
    private broadcast(eventName: string, data: any) {
        this.clients = this.clients.filter(client => client && client.connected);
        this.clients.forEach(client => {
            try {
                client.emit(eventName, data);
            }
            catch (ex) {
            }
        });
    }

    private onSocketConnection(socket: SocketIO.Socket) {
        this.clients.push(socket);
        socket.on('disconnect', () => {
            const index = this.clients.findIndex(sock => sock.id === socket.id);
            if (index >= 0) {
                this.clients.splice(index, 1);
            }
        });
        socket.on('clientExists', (data: { id: string }) => {
            if (!this.responsePromises.has(data.id)) {
                return;
            }
            const def = this.responsePromises.get(data.id);
            this.responsePromises.delete(data.id);
            def.resolve(true);
        });
        socket.on('appendResults', (data: { append: string }) => {
            this.emit('appendResults', data.append);
        });
        this.emit('connected');
    }

    private responsePromises: Map<string, Deferred<boolean>>;
    public clientsConnected(timeoutMilliSeconds: number): Promise<any> {
        const id = new Date().getTime().toString();
        const def = createDeferred<boolean>();
        this.broadcast('clientExists', { id: id });
        this.responsePromises.set(id, def);

        setTimeout(() => {
            if (this.responsePromises.has(id)) {
                this.responsePromises.delete(id);
                def.resolve(false);
            }
        }, timeoutMilliSeconds);

        return def.promise;
    }
}