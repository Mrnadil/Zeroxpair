const { chamindaid } = require('./id'); 
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { Storage } = require("megajs");

const {
    default: Team_BitX,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

// Function to generate a random Mega ID
function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

// Function to upload credentials to Mega
async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'chutyputha01@gmail.com', // Your Mega A/c Email Here
            password: '@MWKnadil123' // Your Mega A/c Password Here
        }).ready;
        console.log('Mega storage initialized.');

        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }

        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;

        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

// Function to remove a file
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Router to handle pairing code generation
router.get('/', async (req, res) => {
    const id = chamindaid(); 
    let num = req.query.number;

    async function CHAMINDA_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let Chaminda = Team_BitX({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Chaminda")
            });

            if (!Chaminda.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Chaminda.requestPairingCode(num);
                console.log(`Your Code: ${code}`);

                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            Chaminda.ev.on('creds.update', saveCreds);
            Chaminda.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);
                    const filePath = __dirname + `/temp/${id}/creds.json`;

                    if (!fs.existsSync(filePath)) {
                        console.error("File not found:", filePath);
                        return;
                    }

                    const megaUrl = await uploadCredsToMega(filePath);
                    const sid = megaUrl.includes("https://mega.nz/file/")
                        ? 'Chaminda~' + megaUrl.split("https://mega.nz/file/")[1]
                        : 'Error: Invalid URL';

                    console.log(`Session ID: ${sid}`);

                    const session = await Chaminda.sendMessage(Chaminda.user.id, { text: sid });

                    const CHAMINDA_TEXT = `
*ඔය උඩ තියෙන්නෙ උබේ Session ID එක. ඕක නැතිකරගන්න එහෙම එපා*

> Powerd By Bit X Team`;

                    await Chaminda.sendMessage(Chaminda.user.id, { text: CHAMINDA_TEXT }, { quoted: session });

                    await delay(100);
                    await Chaminda.ws.close();
                    return removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    CHAMINDA_PAIR_CODE();
                }
            });
        } catch (err) {
            console.error("Service Has Been Restarted:", err);
            removeFile('./temp/' + id);

            if (!res.headersSent) {
                res.send({ code: "Service is Currently Unavailable" });
            }
        }
    }

    await CHAMINDA_PAIR_CODE();
});

module.exports = router;
