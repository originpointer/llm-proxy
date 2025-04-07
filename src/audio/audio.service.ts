import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { WebSocket} from 'ws';

const url = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';

@Injectable()
export class AudioService {
    private appKey = '7036668880';
    private token = 'k8CShpBq-nF27V1E_MFXSbfgfrY48tg8';
    private resourceId = 'volc.bigasr.sauc.duration';
    private connectId = nanoid();
    private socket;

    connect() {
        this.socket = new WebSocket(url, {
            headers: {
                'X-Api-App-Key': this.appKey,
                'X-Api-Access-Key': this.token,
                'X-Api-Resource-Id': this.resourceId,
                'X-Api-Connect-Id': this.connectId
            }
        });

        this.socket.on('open', () => {
            console.log('connected');
        });

        this.socket.on('message', (message) => {
            console.log(message);
        });

        this.socket.on('error', (error) => {
            console.error(error);
        });

        this.socket.on('close', () => {
            console.log('closed');
        });
        
        
    }
}
