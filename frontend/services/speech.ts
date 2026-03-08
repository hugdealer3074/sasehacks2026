import axios from 'axios';

const BACKEND_URL = 'http://10.138.250.241:8000';

export async function transcribeAudio(uri: string) {
    console.log('Recorded audio URI:', uri);

    const formData = new FormData();

    formData.append('file', {
        uri,
        name: 'recording.m4a',
        type: 'audio/m4a',
    } as any);

    const response = await axios.post(
        `${BACKEND_URL}/speech/transcribe`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );

    console.log("Backend response:", response.data);

    return response.data;
}