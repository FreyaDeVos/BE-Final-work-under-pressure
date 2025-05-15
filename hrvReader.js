const noble = require('@abandonware/noble');
const EventEmitter = require('events');

const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_CHAR_UUID = '2a37';

class HRVReader extends EventEmitter {
    constructor() {
        super();
        this.isConnected = false; // voorkomt dubbele verbindingen
    }

    start() {
        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                console.log('✅ Bluetooth aan, scannen naar HRV...');
                noble.startScanning([HEART_RATE_SERVICE_UUID], false); // false om duplicates te vermijden
            } else {
                noble.stopScanning();
            }
        });

        noble.on('discover', (peripheral) => {
            if (peripheral.advertisement.localName ?.includes('Polar')) {
                if (this.isConnected) return; // al verbonden

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
                                // Data verwerken en meteen emitten
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

                                // Emit parsed data
                                this.emit('data', {
                                    hr,
                                    rrIntervals
                                });

                                // Log ter controle (kan je later uitzetten)
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

module.exports = HRVReader;