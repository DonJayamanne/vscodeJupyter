import * as io from 'socket.io';
import * as http from 'http';
import { createDeferred, Deferred } from '../common/helpers';
import { EventEmitter } from 'events';
import * as express from 'express';
import { Express } from 'express';
import * as path from 'path';
import * as cors from 'cors';
const uniqid = require('uniqid');
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
        // Required by transformime
        // It will look in the path http://localhost:port/resources/MathJax/MathJax.js
        this.app.use(express.static(path.join(__dirname, '..', '..', '..', 'node_modules', 'mathjax-electron')));
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

    private buffer: any[] = [];
    public clearBuffer() {
        this.buffer = [];
    }
    public sendResults(data: any[]) {
        // Add an id to each item (poor separation of concerns... but what ever)
        let results = data.map(item => { return { id: uniqid('x'), value: item }; });
        this.buffer = this.buffer.concat(results);
        this.broadcast('results', results);
    }

    public sendSetting(name: string, value: any) {
        this.broadcast(name, value);
    }
    private broadcast(eventName: string, data: any) {
        this.server.emit(eventName, data);
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
        socket.on('settings.appendResults', (data: any) => {
            this.emit('settings.appendResults', data);
        });
        socket.on('clearResults', () => {
            this.buffer = [];
        });
        socket.on('results.ack', () => {
            this.buffer = [];
        });
        this.emit('connected');

        // Someone is connected, send them the data we have
        socket.emit('results', this.buffer);
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