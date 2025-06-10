const noble = require('@abandonware/noble');
const EventEmitter = require('events');

const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_CHAR_UUID = '2a37';

class HRVReader extends EventEmitter {
    constructor() {
        super();
        this.isConnected = false;
        this.rrBuffer = []; // Buffer voor RR-intervallen
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
            if (peripheral.advertisement.localName ?.includes('Polar')) {
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

                                const rrToUse = rrIntervals.length > 0 ?
                                    rrIntervals : [Math.round(60000 / hr)]; // Pseudo-RR

                                // Voeg nieuwe RR's toe aan buffer
                                this.rrBuffer.push(...rrToUse);

                                // Beperk tot laatste 20
                                if (this.rrBuffer.length > 50) { // Of 150-200
                                    this.rrBuffer = this.rrBuffer.slice(-100);
                                }

                                // Alleen doorgaan als genoeg RR's
                                let rmssd = 0;
                                if (this.rrBuffer.length >= 2) {
                                    rmssd = calculateRMSSD(this.rrBuffer);
                                }

                                this.emit('data', {
                                    hr,
                                    rrIntervals: rrToUse,
                                    rmssd
                                });

                                console.log(`❤️ HR: ${hr}, 🧠 RR: ${rrToUse.join(', ')}, 💓 RMSSD: ${rmssd.toFixed(2)}`);
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

// RMSSD = root mean square of successive differences
function calculateRMSSD(rrs) {
    if (rrs.length < 2) return 0;

    let sumSquares = 0;
    for (let i = 1; i < rrs.length; i++) {
        const diff = rrs[i] - rrs[i - 1];
        sumSquares += diff * diff;
    }

    return Math.sqrt(sumSquares / (rrs.length - 1));
}

module.exports = HRVReader;