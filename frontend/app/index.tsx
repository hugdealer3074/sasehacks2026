import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import VoiceInputButton from '../components/VoiceInputButton';

// Update this to your laptop's current local IP
const BACKEND_URL = 'http://10.138.250.241:8000';

type Clinic = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tag: string;
};

export default function SingleFileApp() {
  const [activeTab, setActiveTab] = useState<'map' | 'input' | 'list'>('input');
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [spokenText, setSpokenText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = async (overrideText?: string) => {
    const queryToUse = (overrideText ?? userInput).trim();

    if (!queryToUse) {
      Alert.alert('Please enter or record something first.');
      return;
    }

    if (!language) {
      Alert.alert('Please select a language first.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(`${BACKEND_URL}/translate-and-search`, {
        text: queryToUse,
        language,
      });

      setSpokenText(response.data.original_text || queryToUse);
      setTranslatedText(response.data.translated_text || '');
      setClinics(response.data.clinics || []);
      setActiveTab('list');
    } catch (error: any) {
      console.error('Translate/search failed:', error);

      setSpokenText(queryToUse);
      setTranslatedText('');
      setErrorMessage('Translation failed. Please try again.');

      Alert.alert(
        'Something went wrong',
        'We could not translate your request right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const LanguageSelection = () => (
    <View style={styles.langContainer}>
      <Ionicons name="medical" size={60} color="#007AFF" style={{ marginBottom: 20 }} />
      <Text style={styles.langHeader}>Select Language</Text>
      <Text style={styles.langSub}>Choose a language to begin</Text>

      <TouchableOpacity style={styles.langButton} onPress={() => setLanguage('English')}>
        <Text style={styles.langButtonText}>English</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.langButton, { backgroundColor: '#34C759' }]}
        onPress={() => setLanguage('Español')}
      >
        <Text style={styles.langButtonText}>Español</Text>
      </TouchableOpacity>
    </View>
  );

  const MapViewContent = () => (
    <View style={styles.full}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 25.7617,
          longitude: -80.1918,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {clinics.map((c) => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            title={c.name}
            description={c.address}
          />
        ))}
      </MapView>
    </View>
  );

  const InputViewContent = () => (
    <View style={styles.centered}>
      <Text style={styles.header}>Ask the Navigator</Text>
      <Text style={styles.modeText}>Mode: {language}</Text>

      <TextInput
        style={styles.input}
        placeholder={
          language === 'Español'
            ? 'Describe tu necesidad médica en español'
            : 'How can we help? (e.g. Spanish speaking doctor)'
        }
        multiline
        value={userInput}
        onChangeText={setUserInput}
      />

      <VoiceInputButton
        onTranscript={(text) => {
          setUserInput(text);
          setSpokenText(text);
        }}
        onAutoSearch={(text) => handleSearch(text)}
      />

      {loading && (
        <View style={styles.statusBox}>
          <ActivityIndicator />
          <Text style={styles.statusText}>
            {language === 'Español'
              ? 'Transcribing and translating...'
              : 'Processing your request...'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={() => handleSearch()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {language === 'Español' ? 'Traducir y buscar recursos' : 'Search Resources'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setLanguage(null)} style={{ marginTop: 20 }}>
        <Text style={{ color: '#007AFF', textAlign: 'center' }}>Change Language</Text>
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.resultsHeader}>Your Request</Text>

      {!!spokenText && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            You said {language === 'Español' ? '(Spanish)' : ''}
          </Text>
          <Text style={styles.summaryText}>{spokenText}</Text>
        </View>
      )}

      {!!translatedText && language === 'Español' && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Translated to English</Text>
          <Text style={styles.summaryText}>{translatedText}</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={[styles.summaryCard, { borderColor: '#ffcccc', backgroundColor: '#fff5f5' }]}>
          <Text style={[styles.summaryLabel, { color: '#cc0000' }]}>Error</Text>
          <Text style={[styles.summaryText, { color: '#cc0000' }]}>{errorMessage}</Text>
        </View>
      )}

      <Text style={styles.resultsHeader}>Mocked Clinic Results</Text>
    </View>
  );

  const ListViewContent = () => (
    <FlatList
      data={clinics}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ padding: 20 }}
      ListHeaderComponent={<ListHeader />}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 50, color: '#666' }}>
          No results yet. Describe your need in the Ask tab.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.address}</Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
        </View>
      )}
    />
  );

  if (!language) {
    return <LanguageSelection />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {activeTab === 'map' && <MapViewContent />}
        {activeTab === 'input' && <InputViewContent />}
        {activeTab === 'list' && <ListViewContent />}
      </View>

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('map')}>
          <Ionicons name="map" size={24} color={activeTab === 'map' ? '#007AFF' : '#666'} />
          <Text style={[styles.navText, activeTab === 'map' && styles.activeText]}>Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('input')}>
          <Ionicons
            name="chatbubble"
            size={24}
            color={activeTab === 'input' ? '#007AFF' : '#666'}
          />
          <Text style={[styles.navText, activeTab === 'input' && styles.activeText]}>Ask</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('list')}>
          <Ionicons name="list" size={24} color={activeTab === 'list' ? '#007AFF' : '#666'} />
          <Text style={[styles.navText, activeTab === 'list' && styles.activeText]}>Results</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  langContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  langHeader: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  langSub: { fontSize: 16, color: '#666', marginBottom: 30 },
  langButton: {
    backgroundColor: '#007AFF',
    width: '100%',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  langButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1 },
  full: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, padding: 30, justifyContent: 'center' },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#007AFF',
  },
  modeText: {
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
    padding: 15,
    textAlignVertical: 'top',
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  statusBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f2f7ff',
    alignItems: 'center',
  },
  statusText: {
    marginTop: 8,
    color: '#335',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 15,
    marginTop: 25,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  resultsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#f9f9f9',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 16,
    color: '#222',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  cardSub: { color: '#666', marginTop: 5 },
  tag: {
    backgroundColor: '#E1F5FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  tagText: { color: '#01579B', fontWeight: 'bold', fontSize: 12 },
  navbar: {
    flexDirection: 'row',
    height: 90,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
    backgroundColor: '#fff',
  },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navText: { fontSize: 12, color: '#666', marginTop: 4 },
  activeText: { color: '#007AFF', fontWeight: 'bold' },
});