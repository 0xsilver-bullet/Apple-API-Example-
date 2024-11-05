import express from 'express';
import { decode } from 'jsonwebtoken';

const port = 33;

const app = express();
app.use(express.json());

type NotificationDto = {
    signedPayload: string;
};

app.post('/', (req, res) => { // route to receive notification on
    console.log('received a notification from app store!');
    const body = req.body as NotificationDto;
    const signedPayload = body.signedPayload
    const decodedPayload = decode(signedPayload);
    console.log(JSON.stringify(decodedPayload, null, 2));
    res.status(201).end();
});

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});
