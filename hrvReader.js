const noble = require('@abandonware/noble');
const EventEmitter = require('events');

const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_CHAR_UUID = '2a37';

class HRVReader extends EventEmitter {
    constructor() {
        super();
        this.isConnected = false;
    }

    start() {
        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                console.log('✅ Bluetooth aan, scannen naar HRV...');
                noble.startScanning([HEART_RATE_SERVICE_UUID], false);
            } else {
                noble.stopScanning();
            }
        });

        noble.on('discover', (peripheral) => {
            if (peripheral.advertisement.localName .includes('Polar')) {
                if (this.isConnected) return;

                this.isConnected = true;
                console.log('🔍 Polar gevonden:', peripheral.advertisement.localName);
                noble.stopScanning();

                peripheral.connect((err) => {
                    if (err) return this.emit('error', err);

                    peripheral.discoverSomeServicesAndCharacteristics(
                        [HEART_RATE_SERVICE_UUID],
                        [HEART_RATE_MEASUREMENT_CHAR_UUID],
                        (err, services, characteristics) => {
                            if (err) return this.emit('error', err);

                            const hrChar = characteristics[0];

                            hrChar.on('data', (data) => {
                                console.log('📦 Raw data:', data.toString('hex'));

                                const flags = data.readUInt8(0);
                                const rrPresent = (flags & 0x10) !== 0;
                                let hr;
                                let offset = 1;

                                if ((flags & 0x01) === 0) {
                                    hr = data.readUInt8(offset);
                                    offset += 1;
                                } else {
                                    hr = data.readUInt16LE(offset);
                                    offset += 2;
                                }

                                const rrIntervals = [];
                                if (rrPresent) {
                                    while (offset + 1 < data.length) {
                                        const rr = data.readUInt16LE(offset);
                                        rrIntervals.push(rr);
                                        offset += 2;
                                    }
                                }

                                const pseudoHRV = rrIntervals.length >= 2 ?
                                    standardDeviation(rrIntervals) :
                                    0;

                                const hrvScore100 = pseudoHRV > 0 ?
                                    Math.min(100, Math.max(0, (pseudoHRV - 10) * 3)) :
                                    0;

                                // Als geen echte RR-data aanwezig is, genereer 1 pseudo-RR op basis van HR
                                const rrToSend = rrIntervals.length > 0 ?
                                    rrIntervals :
                                    [Math.round(60000 / hr)]; // Pseudo RR

                                this.emit('data', {
                                    hr,
                                    rrIntervals: rrToSend
                                });

                                console.log(`❤️ HR: ${hr}, 🧠 RR: ${rrToSend.join(', ')}`);

                                console.log(`❤️ HR: ${hr}, 🧠 RR: ${rrIntervals.length > 0 ? rrIntervals.join(', ') : 'geen'}`);
                            });

                            hrChar.subscribe((err) => {
                                if (err) this.emit('error', err);
                                else this.emit('start');
                            });
                        }
                    );
                });

                peripheral.on('disconnect', () => {
                    console.log('⚠️ Verbroken verbinding, opnieuw scannen...');
                    this.isConnected = false;
                    noble.startScanning([HEART_RATE_SERVICE_UUID], false);
                });
            }
        });
    }
}

function standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

module.exports = HRVReader;