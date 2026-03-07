import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

// 1. UPDATE THIS with your laptop's current IP address
const BACKEND_URL = "http://10.136.25.213:8000"; 

export default function SingleFileApp() {
  const [activeTab, setActiveTab] = useState('input'); // Default to 'input' for search
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<string | null>(null); // New state for language selection
  
  // 2. Dynamic State for Clinics (replaces static MOCK_CLINICS)
  const [clinics, setClinics] = useState<any[]>([]);

  // 3. The Function that links to main.py
  const handleSearch = async () => {
    setLoading(true);
    
    // FAKE BACKEND CALL (Use this until you're off campus Wi-Fi)
    setTimeout(() => {
      const mockResults = [
        { id: '1', name: 'Miami Rescue Mission', address: '2250 NW 1st Ave', lat: 25.7984, lng: -80.1989, tag: 'Free' },
        { id: '2', name: 'Camillus Health Concern', address: '336 NW 5th St', lat: 25.7794, lng: -80.1982, tag: 'Low-Cost' },
        { id: '3', name: 'Open Door Health', address: '1350 NW 14th St', lat: 25.7891, lng: -80.2185, tag: 'Sliding Scale' },
      ];
      
      setClinics(mockResults);
      setActiveTab('list');
      setLoading(false);
    }, 800); 
  };

  // --- NEW LANGUAGE SELECTION COMPONENT ---
  const LanguageSelection = () => (
    <View style={styles.langContainer}>
      <Ionicons name="medical" size={60} color="#007AFF" style={{ marginBottom: 20 }} />
      <Text style={styles.langHeader}>Select Language</Text>
      <Text style={styles.langSub}>Choose a language to begin</Text>
      
      <TouchableOpacity style={styles.langButton} onPress={() => setLanguage('English')}>
        <Text style={styles.langButtonText}>English</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.langButton, { backgroundColor: '#34C759' }]} onPress={() => setLanguage('Español')}>
        <Text style={styles.langButtonText}>Español</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.langButton, { backgroundColor: '#FF9500' }]} onPress={() => setLanguage('Kreyòl')}>
        <Text style={styles.langButtonText}>Kreyòl Ayisyen</Text>
      </TouchableOpacity>
    </View>
  );

  // --- VIEW COMPONENTS ---

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
        {/* Render markers from the dynamic state */}
        {clinics.map(c => (
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
      <Text style={{ textAlign: 'center', marginBottom: 10, color: '#666' }}>Mode: {language}</Text>
      <TextInput
        style={styles.input}
        placeholder="How can we help? (e.g. Spanish speaking doctor)"
        multiline
        value={userInput}
        onChangeText={setUserInput}
      />
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleSearch}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Search Resources</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setLanguage(null)} style={{ marginTop: 20 }}>
        <Text style={{ color: '#007AFF', textAlign: 'center' }}>Change Language</Text>
      </TouchableOpacity>
    </View>
  );

  const ListViewContent = () => (
    <FlatList
      data={clinics}
      keyExtractor={item => item.id.toString()}
      contentContainerStyle={{ padding: 20 }}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 50, color: '#666' }}>
          No results yet. Describe your need in the 'Ask' tab.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.address}</Text>
          <View style={styles.tag}><Text style={styles.tagText}>{item.tag}</Text></View>
        </View>
      )}
    />
  );

  // --- RENDERING LOGIC ---
  if (!language) {
    return <LanguageSelection />;
  }

  return (
    <View style={styles.container}>
      {/* MAIN CONTENT AREA */}
      <View style={styles.content}>
        {activeTab === 'map' && <MapViewContent />}
        {activeTab === 'input' && <InputViewContent />}
        {activeTab === 'list' && <ListViewContent />}
      </View>

      {/* CUSTOM NAVBAR */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('map')}>
          <Ionicons name="map" size={24} color={activeTab === 'map' ? '#007AFF' : '#666'} />
          <Text style={[styles.navText, activeTab === 'map' && styles.activeText]}>Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('input')}>
          <Ionicons name="chatbubble" size={24} color={activeTab === 'input' ? '#007AFF' : '#666'} />
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
  langContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  langHeader: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  langSub: { fontSize: 16, color: '#666', marginBottom: 30 },
  langButton: { backgroundColor: '#007AFF', width: '100%', padding: 20, borderRadius: 15, marginBottom: 15, alignItems: 'center' },
  langButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1 },
  full: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  centered: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#007AFF' },
  input: { height: 120, borderWidth: 1, borderColor: '#ddd', borderRadius: 15, padding: 15, textAlignVertical: 'top', backgroundColor: '#f9f9f9', fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, marginTop: 25, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#eee', elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  cardSub: { color: '#666', marginTop: 5 },
  tag: { backgroundColor: '#E1F5FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start', marginTop: 12 },
  tagText: { color: '#01579B', fontWeight: 'bold', fontSize: 12 },
  navbar: { flexDirection: 'row', height: 90, borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: 25, backgroundColor: '#fff' },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navText: { fontSize: 12, color: '#666', marginTop: 4 },
  activeText: { color: '#007AFF', fontWeight: 'bold' }
});