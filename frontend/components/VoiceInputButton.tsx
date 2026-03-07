import React, { useState } from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { transcribeAudio } from '../services/speech';

type Props = {
    onTranscript: (text: string) => void;
};

export default function VoiceInputButton({ onTranscript }: Props) {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();

            if (!permission.granted) {
                Alert.alert('Microphone permission is required');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Could not start recording');
        }
    };

    const stopRecording = async () => {
        try {
            if (!recording) return;

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            setRecording(null);
            setIsRecording(false);

            if (!uri) {
                Alert.alert('No audio file found');
                return;
            }

            const result = await transcribeAudio(uri);
            onTranscript(result.text);
        } catch (error) {
            console.error('Failed to stop recording:', error);
            Alert.alert('Could not stop recording');
        }
    };

    return (
        <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={{
                marginTop: 15,
                backgroundColor: isRecording ? '#FF3B30' : '#34C759',
                padding: 14,
                borderRadius: 12,
                alignItems: 'center',
            }}
        >
            <Ionicons
                name={isRecording ? 'stop-circle' : 'mic'}
                size={22}
                color="#fff"
                style={{ marginBottom: 4 }}
            />
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                {isRecording ? 'Stop Recording' : 'Speak Your Request'}
            </Text>
        </TouchableOpacity>
    );
}