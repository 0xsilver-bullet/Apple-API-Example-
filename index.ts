import { readFileSync } from 'fs';
import { SignedDataVerifier, Environment, JWSTransactionDecodedPayload, AppStoreServerAPIClient, SendTestNotificationResponse, Status } from "@apple/app-store-server-library"
import { VerificationException, VerificationStatus } from '@apple/app-store-server-library/dist/jws_verification';

const APP_ID = 0; // TODO: put correct App Id
const ENABLED_ONLINE_CHECKS = true;
const APP_BUNDLE_ID = "com.ghosthub.Ghost";

const ISSUER_ID = "TODO:";
const KEY_ID = "TODO:";
const SECRET_FILE_PATH = "./APP_CONNECT_PRIVATE_KEY.p8";

async function main() {
    const encodedKey = readFileSync(SECRET_FILE_PATH).toString().trim()

    const client = new AppStoreServerAPIClient(
        encodedKey,
        KEY_ID,
        ISSUER_ID,
        APP_BUNDLE_ID,
        Environment.SANDBOX,
    );

    const originalTrId = "2000000694762518";

    const result = await client.getAllSubscriptionStatuses(originalTrId, [Status.ACTIVE]);
    console.log(JSON.stringify(result, null, 2));

    console.log(`Number of active subscriptions: ${result.data.length}`);
}

async function sendServerNotificationExample() {
    const encodedKey = readFileSync(SECRET_FILE_PATH).toString().trim()

    const client = new AppStoreServerAPIClient(
        encodedKey,
        KEY_ID,
        ISSUER_ID,
        APP_BUNDLE_ID,
        Environment.SANDBOX,
    );


    try {
        console.log('sending test notification....');
        const response: SendTestNotificationResponse = await client.requestTestNotification()
        console.log(response)
    } catch (e) {
        console.error(e)
    }
}

async function decodeSignedTransactionExample() {
    const appleRootCAs = loadCertsBuffers();

    if (appleRootCAs == null) {
        console.log('[-] failed to load certificates!');
        return;
    }

    const sandboxDataVerifier = new SignedDataVerifier(
        appleRootCAs,
        ENABLED_ONLINE_CHECKS,
        Environment.SANDBOX,
        APP_BUNDLE_ID,
        APP_ID
    );

    const productionDataVerifier = new SignedDataVerifier(
        appleRootCAs,
        ENABLED_ONLINE_CHECKS,
        Environment.PRODUCTION,
        APP_BUNDLE_ID,
        APP_ID
    );

    const tr = readTransactionFromFile();

    let decodedTransaction: JWSTransactionDecodedPayload;
    try {
        console.log('[+] verifying transaction');
        decodedTransaction = await verifyTransaction(tr, productionDataVerifier, sandboxDataVerifier);
        console.log('[+] verified successfully!');
    } catch (e) {
        console.log('[-] failed to validate transaction!');
        console.log(e);
        return;
    }

    if (decodedTransaction.bundleId !== APP_BUNDLE_ID) {
        console.log('[-] Wrong Bundle ID found!');
    }

    console.log(JSON.stringify(decodedTransaction, null, 2));
}

async function decodeNotificationExample() {
    const signedPayload = readFileSync("./notification.txt").toString().trim();

    const appleRootCAs = loadCertsBuffers();

    if (appleRootCAs == null) {
        console.log('[-] failed to load certificates!');
        return;
    }

    const sandboxDataVerifier = new SignedDataVerifier(
        appleRootCAs,
        ENABLED_ONLINE_CHECKS,
        Environment.SANDBOX,
        APP_BUNDLE_ID,
        APP_ID
    );

    const productionDataVerifier = new SignedDataVerifier(
        appleRootCAs,
        ENABLED_ONLINE_CHECKS,
        Environment.PRODUCTION,
        APP_BUNDLE_ID,
        APP_ID
    );

    console.log(`decoding signedPayload of size: ${signedPayload.length} byters`);

    const decodedNotification = await sandboxDataVerifier.verifyAndDecodeNotification(signedPayload);
    console.log('decoded!')
    console.log(JSON.stringify(decodedNotification, null, 2));
}

/**
 * @description this function tries to validate and decrypt the tr against prod env first, if it fails
 * it will try to verify against sandbox env, it will rethrow errors returned from the verifier as they are
 * except if the error was caused by environment because in this case we should switch environment before
 * rethrowing the error.
 * @throws VerificationException Thrown if the data could not be verified against sandbox or prod env.
**/
async function verifyTransaction(
    tr: string,
    prodVerifyier: SignedDataVerifier,
    sandboxVerifier: SignedDataVerifier,
    mode: 'prod' | 'sandbox' = 'prod',
): Promise<JWSTransactionDecodedPayload> {
    switch (mode) {
        case 'prod':
            try {
                const decodedPayload = await prodVerifyier.verifyAndDecodeTransaction(tr);
                return decodedPayload;
            }
            catch (e) {
                if (e instanceof VerificationException) {
                    if (e.status === VerificationStatus.INVALID_ENVIRONMENT) {
                        // then test against sandbox env
                        return verifyTransaction(tr, prodVerifyier, sandboxVerifier, 'sandbox');
                    }
                    throw e;
                }
                throw e; // shouldn't happen based on their doc
            }
        case 'sandbox':
            return await sandboxVerifier.verifyAndDecodeTransaction(tr);
    }
}


/**
 * @returns array of buffers if it reads the certs correctly otherwise null if error occurred
**/
function loadCertsBuffers(): Buffer[] | null {
    try {
        const cert1 = readFileSync('./certs/AppleComputerRootCertificate.cer');
        const cert2 = readFileSync('./certs/AppleIncRootCertificate.cer');
        const cert3 = readFileSync('./certs/AppleRootCA-G2.cer');
        const cert4 = readFileSync('./certs/AppleRootCA-G3.cer');
        return [cert1, cert2, cert3, cert4];
    } catch {
        return null;
    }
}

/**
 * @description reads file called tr.txt which includes the transaction or exists the process in case of failure.
 **/
function readTransactionFromFile(): string {
    try {
        return readFileSync('./tr.txt').toString().trim();
    } catch {
        console.log('[-] failed to load transaction');
        process.exit(1);
    }
}

main();
