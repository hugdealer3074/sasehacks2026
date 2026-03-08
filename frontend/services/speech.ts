import axios from 'axios';

const BACKEND_URL = 'http://10.138.250.241:8000';

export async function transcribeAudio(uri: string) {
    console.log('Recorded audio URI:', uri);
    console.log('Sending audio to:', `${BACKEND_URL}/speech/transcribe`);

    const formData = new FormData();

    formData.append('file', {
        uri,
        name: 'recording.m4a',
        type: 'audio/mp4',
    } as any);

    try {
        const response = await axios.post(
            `${BACKEND_URL}/speech/transcribe`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 60000,
            }
        );

        console.log('Backend response:', response.data);
        return response.data;
    } catch (error: any) {
        console.log('Transcription request failed');

        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else if (error.request) {
            console.log('No response received from backend');
        } else {
            console.log('Axios error message:', error.message);
        }

        throw error;
    }
}