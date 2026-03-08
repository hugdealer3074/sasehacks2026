import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';

// ── ElevenLabs config ──────────────────────────────────────────────────────────
const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary: '#73c7e3',
  primaryDark: '#3fa8cc',
  primaryMid: '#9dd5ea',
  primaryLight: '#dff3fa',
  primaryXlight: '#f0f9fd',
  successDark: '#1E8A62',
  warnDark: '#C4622C',
  warnLight: '#FEF3EB',
  nd1: '#1A1C20',
  nd2: '#2D3035',
  nd3: '#4A4D54',
  nd4: '#6B6E78',
  nd5: '#9B9CA3',
  nl1: '#C5C6CC',
  nl2: '#D8D9DE',
  nl3: '#E5E6EA',
  nl4: '#F2F3F5',
  nl5: '#FFFFFF',
} as const;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Static data ───────────────────────────────────────────────────────────────
const LANG_WORDS = [
  'Language', 'Idioma', '语言', 'Langue', 'Sprache',
  'Língua', '言語', '언어', 'اللغة', 'भाषा', 'Ngôn ngữ', 'Wika',
] as const;

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', native: 'Spanish', flag: '🇪🇸' },
  { code: 'zh', name: '中文', native: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', native: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', native: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', native: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: '日本語', native: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', native: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', native: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', native: 'Hindi', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', native: 'Vietnamese', flag: '🇻🇳' },
  { code: 'tl', name: 'Filipino', native: 'Filipino', flag: '🇵🇭' },
  { code: 'ru', name: 'Русский', native: 'Russian', flag: '🇷🇺' },
  { code: 'it', name: 'Italiano', native: 'Italian', flag: '🇮🇹' },
  { code: 'ht', name: 'Kreyòl', native: 'Haitian Creole', flag: '🇭🇹' },
  { code: 'so', name: 'Soomaali', native: 'Somali', flag: '🇸🇴' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type Language = typeof LANGUAGES[number];
type AppStep = 'language' | 'location' | 'query' | 'searching' | 'loading' | 'results';

type Clinic = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  lowCost: boolean;
  status: 'Open' | 'Closed';
  opensAt?: string;
  distance: string;
  hours: string;
  phone: string;
  aiSummary: string;
};

// ── Mock clinic data ───────────────────────────────────────────────────────────
const MOCK_CLINICS: Clinic[] = [
  {
    id: '1',
    name: 'Gainesville Urgent Care Center',
    address: '3510 SW Archer Rd, Gainesville, FL',
    lat: 29.6393, lng: -82.3487,
    lowCost: true, status: 'Open',
    distance: '0.8 mi',
    hours: 'Mon–Fri 8am–8pm · Sat–Sun 9am–5pm',
    phone: '(352) 555-0182',
    aiSummary: 'Walk-in friendly. Accepts most major insurance and offers sliding-scale fees for uninsured patients. Best choice for immediate walk-in care with the shortest wait times.',
  },
  {
    id: '2',
    name: 'UF Health Primary Care – Tower Hill',
    address: '4037 NW 86th Terrace, Gainesville, FL',
    lat: 29.6763, lng: -82.3812,
    lowCost: false, status: 'Open',
    distance: '1.4 mi',
    hours: 'Mon–Fri 8am–5pm · Closed weekends',
    phone: '(352) 265-0830',
    aiSummary: 'Academic medical center clinic. Same-day slots often available. Ideal if you prefer a more thorough clinical evaluation — physicians here are UF Health faculty.',
  },
  {
    id: '3',
    name: 'Meridian Behavioral Health Clinic',
    address: '4300 SW 13th St, Gainesville, FL',
    lat: 29.6283, lng: -82.3558,
    lowCost: true, status: 'Closed', opensAt: '8am',
    distance: '2.1 mi',
    hours: 'Mon–Fri 8am–6pm · Sat 9am–2pm',
    phone: '(352) 374-5600',
    aiSummary: 'Sliding-scale fees available. Also offers general practitioner services. A good option for budget-conscious patients — reopens at 8am if timing is not urgent.',
  },
];

// ── Shared sub-component: ClinicBadges ────────────────────────────────────────
// Extracted to module level so React never sees a new component type on re-render.
function ClinicBadges({ clinic }: { clinic: Clinic }) {
  return (
    <View style={s.badgesRow}>
      {clinic.lowCost && (
        <View style={s.badge}>
          <Ionicons name="arrow-down-circle-outline" size={19} color={C.primaryDark} />
          <Text style={[s.badgeText, { color: C.primaryDark }]}>Low Cost</Text>
        </View>
      )}
      <View style={s.badge}>
        <Ionicons name="location-outline" size={19} color={C.nd4} />
        <Text style={[s.badgeText, { color: C.nd4 }]}>{clinic.distance}</Text>
      </View>
      <View style={s.badge}>
        <Ionicons
          name={clinic.status === 'Open' ? 'checkmark-circle-outline' : 'close-circle-outline'}
          size={19}
          color={clinic.status === 'Open' ? C.successDark : C.warnDark}
        />
        <Text style={[s.badgeText, { color: clinic.status === 'Open' ? C.successDark : C.warnDark }]}>
          {clinic.status === 'Open' ? 'Open' : `Closed · ${clinic.opensAt}`}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING PROGRESS BAR
// step: 1 = Language, 2 = Location  (out of 2 total onboarding steps)
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingProgressBar({ step }: { step: 1 | 2 }) {
  const fillAnim = useRef(new Animated.Value(step === 1 ? 0.5 : 1)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: step === 1 ? 0.5 : 1,
      duration: 380,
      useNativeDriver: false,
    }).start();
  }, [step, fillAnim]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.onboardingFooter}>
      {/* Step dots */}
      <View style={s.progressStepRow}>
        {[1, 2].map(n => (
          <View
            key={n}
            style={[
              s.progressDot,
              n <= step ? s.progressDotActive : s.progressDotInactive,
            ]}
          />
        ))}
        <Text style={s.progressLabel}>Step {step} of 2</Text>
      </View>

      {/* Animated fill bar */}
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE SCREEN
// Extracted to top level: state (search, langIndex) survives parent re-renders.
// ─────────────────────────────────────────────────────────────────────────────
type LanguageScreenProps = {
  selectedLang: Language | null;
  onSelect: (lang: Language) => void;
};

function LanguageScreen({ selectedLang, onSelect }: LanguageScreenProps) {
  const [search, setSearch] = useState('');
  const [langIndex, setLangIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => {
        setLangIndex(i => (i + 1) % LANG_WORDS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.langHeader}>
        <View style={s.langIconBg}>
          <Ionicons name="globe-outline" size={34} color={C.primaryDark} />
        </View>
        <View style={s.langTitleRow}>
          <Text style={s.langTitleStatic}>Select </Text>
          <Animated.Text style={[s.langTitleAnimated, { opacity: fadeAnim }]}>
            {LANG_WORDS[langIndex]}
          </Animated.Text>
        </View>
        <Text style={s.langSubtitle}>Choose the language you're most comfortable with</Text>
      </View>

      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={21} color={C.nd5} />
          <TextInput
            style={s.searchInput}
            placeholder="Search language…"
            placeholderTextColor={C.nd5}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView style={s.flex1} contentContainerStyle={s.langListContent}>
        <Text style={s.listSectionHeader}>All Languages</Text>
        {filtered.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[s.langRow, selectedLang?.code === lang.code ? s.langRowSelected : s.langRowOutline]}
            onPress={() => onSelect(lang)}
            activeOpacity={0.7}
          >
            <Text style={s.langFlag}>{lang.flag}</Text>
            <View style={s.flex1}>
              <Text style={[s.langRowName, selectedLang?.code === lang.code && s.langRowNameSelected]}>
                {lang.name}
              </Text>
              <Text style={s.langRowNative}>{lang.native}</Text>
            </View>
            {selectedLang?.code === lang.code && (
              <View style={s.checkCircle}>
                <Ionicons name="checkmark" size={20} color={C.nl5} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Continue footer — only appears once a language is tapped */}
      {selectedLang && (
        <View style={s.langFooter}>
          {/* onSelect already navigated; this is a second confirm tap — intentional UX */}
          <TouchableOpacity style={s.primaryButton} onPress={() => onSelect(selectedLang)}>
            <Text style={s.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Onboarding progress — always visible at the very bottom */}
      <OnboardingProgressBar step={1} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type LocationScreenProps = { onBack: () => void; onAllow: () => void };

function LocationScreen({ onBack, onAllow }: LocationScreenProps) {
  const [showModal, setShowModal] = useState(false);
  const pulse0 = useRef(new Animated.Value(0)).current;
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pinFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    [pulse0, pulse1, pulse2].forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
    Animated.loop(
      Animated.sequence([
        Animated.timing(pinFloat, { toValue: -9, duration: 1300, useNativeDriver: true }),
        Animated.timing(pinFloat, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse0, pulse1, pulse2, pinFloat]);

  const RINGS = [
    { anim: pulse0, size: 160 },
    { anim: pulse1, size: 118 },
    { anim: pulse2, size: 80 },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.topBar}>
        <TouchableOpacity style={s.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color={C.nd1} />
        </TouchableOpacity>
      </View>

      <View style={s.centeredScreen}>
        <View style={s.pinIllus}>
          {RINGS.map(({ anim, size }) => (
            <Animated.View
              key={size}
              style={[s.pulseRing, {
                width: size, height: size, borderRadius: size / 2,
                opacity: anim,
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] }) }],
              }]}
            />
          ))}
          <Animated.View style={[s.pinWrap, { transform: [{ translateY: pinFloat }] }]}>
            <View style={s.pinBase}>
              <Ionicons name="location" size={40} color={C.primaryDark} />
            </View>
          </Animated.View>
        </View>

        <Text style={s.title}>Enable Location</Text>
        <Text style={s.subtitle}>
          CareFind uses your location to find the nearest clinics and care providers in your area — you'll only see options close to you.
        </Text>

        <View style={s.trustCard}>
          <View style={s.trustIcon}>
            <Ionicons name="lock-closed-outline" size={24} color={C.primaryDark} />
          </View>
          <View style={s.flex1}>
            <Text style={s.trustTitle}>Your privacy is protected</Text>
            <Text style={s.trustBody}>Your location is only used to find nearby care. It is never stored or shared.</Text>
          </View>
        </View>

        <TouchableOpacity style={[s.primaryButton, s.fullWidth]} onPress={onAllow}>
          <Ionicons name="location-outline" size={24} color={C.nd1} style={s.btnIcon} />
          <Text style={s.primaryButtonText}>Allow Location</Text>
        </TouchableOpacity>
      </View>

      {/* Location-denied modal — currently unreachable but kept for real OS integration */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.alertModal}>
            <Ionicons name="location-outline" size={44} color={C.warnDark} style={s.modalIcon} />
            <Text style={s.alertTitle}>Location Required</Text>
            <Text style={s.alertBody}>
              Please allow location services for this app to function properly. Go to your device Settings and enable Location for CareFind.
            </Text>
            <TouchableOpacity style={[s.primaryButton, s.modalBtn]} onPress={() => setShowModal(false)}>
              <Text style={s.primaryButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Onboarding progress */}
      <OnboardingProgressBar step={2} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type QueryScreenProps = {
  isSpanish: boolean;
  onBack: () => void;
  onSearch: (text: string) => void;
};

function QueryScreen({ isSpanish, onBack, onSearch }: QueryScreenProps) {
  const [inputMode, setInputMode] = useState<'speak' | 'text'>('speak');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');

  const sliderAnim = useRef(new Animated.Value(0)).current;
  // Recording box height (0 = collapsed, 1 = open)
  const recordBoxAnim = useRef(new Animated.Value(0)).current;
  // Transcript card (0 = hidden, 1 = visible)
  const transcriptAnim = useRef(new Animated.Value(0)).current;
  // Text input box (0 = collapsed, 1 = open)
  const textBoxAnim = useRef(new Animated.Value(0)).current;

  const waveAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0.15))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const SLIDER_TRACK_WIDTH = SCREEN_WIDTH - 40;
  const SLIDER_HALF = (SLIDER_TRACK_WIDTH - 8) / 2;

  // ── Waveform ────────────────────────────────────────────────────────────────
  const startWave = useCallback(() => {
    waveLoops.current.forEach(l => l.stop());
    waveLoops.current = waveAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 70),
          Animated.timing(anim, { toValue: 1, duration: 250 + i * 35, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.15, duration: 250 + i * 35, useNativeDriver: true }),
        ])
      )
    );
    waveLoops.current.forEach(l => l.start());
  }, [waveAnims]);

  const stopWave = useCallback(() => {
    waveLoops.current.forEach(l => l.stop());
    waveAnims.forEach(a => a.setValue(0.15));
  }, [waveAnims]);

  // ── Audio permissions ────────────────────────────────────────────────────────
  useEffect(() => {
    Audio.requestPermissionsAsync().catch(() => { });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch(() => { });

    return () => {
      stopWave();
      recordingRef.current?.stopAndUnloadAsync().catch(() => { });
    };
  }, [stopWave]);

  // ── Recording controls (ElevenLabs STT) ─────────────────────────────────────
  const handleStartSpeaking = useCallback(async () => {
    // Reset transcript, collapse transcript card
    setTranscript('');
    Animated.timing(transcriptAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    // Open the recording box
    setIsRecording(true);
    startWave();
    Animated.spring(recordBoxAnim, { toValue: 1, tension: 60, friction: 11, useNativeDriver: false }).start();

    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) {
        const { granted: g2 } = await Audio.requestPermissionsAsync();
        if (!g2) throw new Error('Microphone permission denied');
      }
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
    } catch (err) {
      stopWave();
      setIsRecording(false);
      Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
    }
  }, [startWave, stopWave, recordBoxAnim, transcriptAnim]);

  const handleStopRecording = useCallback(async () => {
    stopWave();
    setIsRecording(false);
    Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();

    try {
      const recording = recordingRef.current;
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      recordingRef.current = null;

      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('Recording error', 'No audio file was created from the recording.');
        return;
      }

      if (!ELEVENLABS_API_KEY) {
        Alert.alert('Missing API key', 'ELEVENLABS_API_KEY is not set.');
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as any);
      formData.append('model_id', 'scribe_v1');

      const sttResponse = await fetch(ELEVENLABS_STT_URL, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
      });

      const raw = await sttResponse.text();
      console.log('ElevenLabs STT status:', sttResponse.status);
      console.log('ElevenLabs STT raw response:', raw);

      if (!sttResponse.ok) {
        throw new Error(`STT failed: ${sttResponse.status} ${raw}`);
      }

      const data = JSON.parse(raw);
      const text = data?.text?.trim?.() ?? '';

      if (text) {
        setTranscript(text);
        Animated.spring(transcriptAnim, {
          toValue: 1,
          tension: 60,
          friction: 12,
          useNativeDriver: true,
        }).start();
      } else {
        Alert.alert('No speech detected', 'We could not transcribe any speech from that recording.');
      }
    } catch (err) {
      console.error('STT error:', err);
      Alert.alert('Transcription failed', 'We could not turn that recording into text.');
    }
  }, [stopWave, recordBoxAnim, transcriptAnim]);

  // ── Mode switching ──────────────────────────────────────────────────────────
  const switchMode = useCallback((mode: 'speak' | 'text') => {
    if (mode === inputMode) return;

    Animated.spring(sliderAnim, {
      toValue: mode === 'text' ? 1 : 0,
      tension: 70, friction: 12, useNativeDriver: false,
    }).start();

    if (mode === 'text') {
      // Stop recording if active
      if (isRecording) {
        stopWave();
        setIsRecording(false);
        try {
          recordingRef.current?.stopAndUnloadAsync();
          recordingRef.current = null;
        } catch (_) { }
      }
      // Collapse recording box + transcript card, open text box
      Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
      Animated.timing(transcriptAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.spring(textBoxAnim, { toValue: 1, tension: 60, friction: 11, useNativeDriver: false }).start();
    } else {
      // Collapse text box
      Animated.spring(textBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
      setTextInput('');
    }
    setInputMode(mode);
  }, [inputMode, isRecording, sliderAnim, recordBoxAnim, transcriptAnim, textBoxAnim, stopWave]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const sliderLeft = sliderAnim.interpolate({
    inputRange: [0, 1], outputRange: [4, SLIDER_HALF + 4],
  });

  // Recording box: height 0 → 130
  const recordBoxHeight = recordBoxAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 130],
  });
  const recordBoxOpacity = recordBoxAnim.interpolate({
    inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp',
  });

  // Transcript card: opacity + slide up
  const transcriptCardOpacity = transcriptAnim;
  const transcriptCardY = transcriptAnim.interpolate({
    inputRange: [0, 1], outputRange: [10, 0],
  });

  // Text box: height 0 → 140
  const textBoxHeight = textBoxAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 140],
  });
  const textBoxOpacity = textBoxAnim.interpolate({
    inputRange: [0, 0.25, 1], outputRange: [0, 0, 1], extrapolate: 'clamp',
  });
  const textBoxMarginTop = textBoxAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 10],
  });

  const activeQuery = inputMode === 'speak' ? transcript : textInput;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={s.topBar}>
        <TouchableOpacity style={s.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color={C.nd1} />
        </TouchableOpacity>
        <View style={s.flex1} />
        <TouchableOpacity style={s.signInPill} activeOpacity={0.8}>
          <Ionicons name="person-outline" size={19} color={C.primaryDark} />
          <Text style={s.signInText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={s.heroCenter}>
            <View style={s.queryIconRing}>
              <Ionicons name="location" size={50} color={C.primaryDark} />
            </View>
            <Text style={s.title}>How can we help?</Text>
            <Text style={s.subtitle}>
              {isSpanish
                ? 'Describe tus síntomas o el tipo de atención que necesitas'
                : 'Describe your symptoms or what kind of care you need'}
            </Text>
          </View>

          {/* Speak / Text slider */}
          <View style={[s.modeSlider, { width: SLIDER_TRACK_WIDTH }]}>
            <Animated.View style={[s.modeSliderActive, { left: sliderLeft, width: SLIDER_HALF }]} />
            <TouchableOpacity style={s.modeSliderOption} onPress={() => switchMode('speak')} activeOpacity={0.75}>
              <Ionicons name="mic-outline" size={24} color={inputMode === 'speak' ? C.nd1 : C.nd4} />
              <Text style={[s.modeSliderText, inputMode === 'speak' && s.modeSliderTextActive]}>Speak</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modeSliderOption} onPress={() => switchMode('text')} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={24} color={inputMode === 'text' ? C.nd1 : C.nd4} />
              <Text style={[s.modeSliderText, inputMode === 'text' && s.modeSliderTextActive]}>Text</Text>
            </TouchableOpacity>
          </View>

          {/* ── SPEAK MODE ELEMENTS (always rendered, shown/hidden via opacity+pointer) ── */}

          {/* Start Speaking button — visible when not recording */}
          {!isRecording && inputMode === 'speak' && (
            <TouchableOpacity style={s.startSpeakingBtn} onPress={handleStartSpeaking} activeOpacity={0.8}>
              <Ionicons name="mic" size={28} color={C.nd1} />
              <Text style={s.startSpeakingText}>
                {transcript ? 'Record Again' : 'Start Speaking'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Recording box — always in DOM, height animated so it can spring open/closed
              without unmounting. Overflow hidden clips it when height=0. */}
          <Animated.View
            style={[s.recordingBox, {
              height: recordBoxHeight,
              opacity: recordBoxOpacity,
              // Hide border visually when fully collapsed
              borderWidth: isRecording ? 1.5 : 0,
            }]}
            pointerEvents={isRecording ? 'auto' : 'none'}
          >
            {/* Waveform — left side */}
            <View style={s.waveformContainer}>
              {waveAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[s.waveBar, {
                    transform: [{ scaleY: anim }],
                    backgroundColor: i % 2 === 0 ? C.primary : C.primaryMid,
                  }]}
                />
              ))}
            </View>

            {/* Listening label — center */}
            <Text style={s.listeningLabel}>Listening…</Text>

            {/* Red stop button — top-right corner of the box */}
            <TouchableOpacity style={s.stopBtnInBox} onPress={handleStopRecording} activeOpacity={0.8}>
              <Ionicons name="stop-circle" size={30} color={C.nl5} />
            </TouchableOpacity>
          </Animated.View>

          {/* Transcript card — only render in speak mode when transcript exists */}
          {inputMode === 'speak' && !!transcript && (
            <Animated.View
              style={[s.transcriptCard, {
                opacity: transcriptCardOpacity,
                transform: [{ translateY: transcriptCardY }],
              }]}
            >
              <View style={s.transcriptCardHeader}>
                <Ionicons name="mic" size={15} color={C.primaryDark} />
                <Text style={s.transcriptCardLabel}>Transcribed</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTranscript('');
                    Animated.timing(transcriptAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
                  }}
                >
                  <Ionicons name="close-circle" size={19} color={C.nd5} />
                </TouchableOpacity>
              </View>
              <Text style={s.transcriptCardText}>{transcript}</Text>
            </Animated.View>
          )}

          {/* ── TEXT MODE INPUT BOX — always rendered, height animated ── */}
          <Animated.View
            style={[s.queryInputAnimated, {
              height: textBoxHeight,
              opacity: textBoxOpacity,
              marginTop: textBoxMarginTop,
              borderWidth: 1.5,
              overflow: 'hidden',
            }]}
            pointerEvents={inputMode === 'text' ? 'auto' : 'none'}
          >
            <View style={s.transcriptBox}>
              <ScrollView
                style={s.transcriptScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <TextInput
                  style={s.transcriptInput}
                  placeholder="Start typing…"
                  placeholderTextColor={C.nd5}
                  multiline
                  value={textInput}
                  onChangeText={setTextInput}
                  autoFocus={inputMode === 'text'}
                />
              </ScrollView>
            </View>
          </Animated.View>

          <View style={s.spacer} />

          <TouchableOpacity style={s.primaryButton} onPress={() => onSearch(activeQuery)}>
            <Ionicons name="search" size={22} color={C.nd1} style={s.btnIcon} />
            <Text style={s.primaryButtonText}>Find Care Near Me</Text>
          </TouchableOpacity>

          <View style={[s.queryDisclaimer, s.disclaimerTop]}>
            <Ionicons name="warning-outline" size={20} color={C.warnDark} />
            <Text style={s.queryDisclaimerText}>For emergencies, always call 911 immediately.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function SearchingScreen() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, useNativeDriver: true })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.centeredScreen}>
        <Animated.View style={[s.spinnerRing, { transform: [{ rotate: spin }] }]} />
        <Text style={s.loadingTitle}>Finding nearby providers</Text>
        <Text style={s.loadingSubtitle}>This usually takes a few seconds</Text>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN (skeleton shimmer)
// ─────────────────────────────────────────────────────────────────────────────
type LoadingScreenProps = { spokenText: string; onBack: () => void };

function LoadingScreen({ spokenText, onBack }: LoadingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.topBar}>
        <TouchableOpacity style={s.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color={C.nd1} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Nearby Results</Text>
        <View style={s.navSpacer} />
      </View>

      <View style={s.queryPillWrap}>
        <View style={s.queryPill}>
          <Ionicons name="search" size={18} color={C.nd4} />
          <Text style={s.queryPillText} numberOfLines={1}>{spokenText}</Text>
        </View>
      </View>

      <Animated.View style={[s.skeletonWrap, { opacity: pulseAnim }]}>
        {/* Card 1 — full skeleton */}
        <View style={s.skeletonCard}>
          <View style={s.skeletonRow}>
            <View style={s.skeletonCircle} />
            <View style={s.flex1}>
              <View style={[s.skeletonLine, { width: '72%' }]} />
              <View style={[s.skeletonLine, { width: '44%' }]} />
            </View>
          </View>
          <View style={s.skeletonBlock} />
          <View style={s.skeletonBtnRow}>
            <View style={[s.skeletonLine, s.skeletonBtn]} />
            <View style={[s.skeletonLine, s.skeletonBtn]} />
            <View style={[s.skeletonLine, s.skeletonBtnSm]} />
          </View>
        </View>
        {/* Card 2 — partial */}
        <View style={s.skeletonCard}>
          <View style={s.skeletonRow}>
            <View style={s.skeletonCircle} />
            <View style={s.flex1}>
              <View style={[s.skeletonLine, { width: '88%' }]} />
              <View style={[s.skeletonLine, { width: '55%' }]} />
            </View>
          </View>
          <View style={s.skeletonBlock} />
        </View>
        {/* Card 3 — minimal */}
        <View style={s.skeletonCard}>
          <View style={s.skeletonRow}>
            <View style={s.skeletonCircle} />
            <View style={s.flex1}>
              <View style={[s.skeletonLine, { width: '58%' }]} />
            </View>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type ResultsScreenProps = {
  clinics: Clinic[];
  spokenText: string;
  onBack: () => void;
  onEditQuery: () => void;
};

function ResultsScreen({ clinics, spokenText, onBack, onEditQuery }: ResultsScreenProps) {
  // Sheet position constants — defined once outside the pan-responder closures
  // so they can't go stale if the component re-renders.
  const SHEET_PEEK = SCREEN_HEIGHT * 0.60;
  const SHEET_OPEN = SCREEN_HEIGHT * 0.08;

  const sheetY = useRef(new Animated.Value(SHEET_PEEK)).current;
  const sheetOffset = useRef(SHEET_PEEK);

  const [expandedClinic, setExpandedClinic] = useState<Clinic | null>(null);
  const expandedSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Stable ref-based open/close so PanResponder closures always see latest version
  const openExpandedCard = useCallback((clinic: Clinic) => {
    setExpandedClinic(clinic);
    expandedSheetY.setValue(SCREEN_HEIGHT);
    Animated.spring(expandedSheetY, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
  }, [expandedSheetY]);

  const closeExpandedCard = useCallback(() => {
    Animated.timing(expandedSheetY, {
      toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true,
    }).start(() => setExpandedClinic(null));
  }, [expandedSheetY]);

  // Keep close function in a ref so PanResponder can call the latest version
  const closeExpandedCardRef = useRef(closeExpandedCard);
  useEffect(() => { closeExpandedCardRef.current = closeExpandedCard; }, [closeExpandedCard]);

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
      onPanResponderGrant: () => {
        sheetY.stopAnimation(val => { sheetOffset.current = val; });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = sheetOffset.current + dy;
        if (next >= SHEET_OPEN - 20 && next <= SHEET_PEEK + 60) sheetY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const target = (dy < -60 || vy < -0.6) ? SHEET_OPEN : SHEET_PEEK;
        sheetOffset.current = target;
        Animated.spring(sheetY, { toValue: target, tension: 60, friction: 10, useNativeDriver: false }).start();
      },
    })
  ).current;

  const expandedPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 6,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) expandedSheetY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 110 || vy > 0.9) {
          closeExpandedCardRef.current();
        } else {
          Animated.spring(expandedSheetY, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={s.mapRoot}>
      <StatusBar barStyle="dark-content" />

      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: 29.652, longitude: -82.372, latitudeDelta: 0.08, longitudeDelta: 0.06 }}
      >
        {clinics.map(clinic => (
          <Marker
            key={clinic.id}
            coordinate={{ latitude: clinic.lat, longitude: clinic.lng }}
            title={clinic.name}
            onPress={() => openExpandedCard(clinic)}
          />
        ))}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <TouchableOpacity style={s.floatingBack} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color={C.nd1} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom results sheet */}
      <Animated.View style={[s.bottomSheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={s.sheetHandleArea} {...sheetPan.panHandlers}>
          <Ionicons name="chevron-up" size={32} color={C.nl1} />
        </View>

        <View style={s.queryPillWrap}>
          <View style={s.queryPill}>
            <Ionicons name="search" size={18} color={C.nd4} />
            <Text style={s.queryPillText} numberOfLines={1}>{spokenText}</Text>
            <TouchableOpacity onPress={onEditQuery}>
              <Text style={s.queryPillEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={s.flex1} contentContainerStyle={s.sheetScrollContent} showsVerticalScrollIndicator={false}>
          <View style={s.aiOverviewBox}>
            <View style={s.aiOverviewHeader}>
              <Ionicons name="sparkles" size={18} color={C.primaryDark} />
              <Text style={s.aiOverviewLabel}>AI Overview</Text>
            </View>
            <Text style={s.aiOverviewText}>
              Based on your symptoms,{' '}
              <Text style={s.bold}>{clinics.length} nearby providers</Text> were found.
              Gainesville Urgent Care is the closest and most affordable, open now with walk-in availability.
              UF Health offers same-day appointments and academic-grade care. Meridian is currently closed but reopens at 8am.
            </Text>
          </View>

          <View style={s.resultsCountRow}>
            <Text style={s.resultsCount}>{clinics.length} results nearby</Text>
            <Text style={s.resultsHint}>Tap a card to expand</Text>
          </View>

          {clinics.map(clinic => (
            <TouchableOpacity
              key={clinic.id}
              style={s.collapsedCard}
              onPress={() => openExpandedCard(clinic)}
              activeOpacity={0.75}
            >
              <View style={s.flex1}>
                <Text style={s.cardName}>{clinic.name}</Text>
                <ClinicBadges clinic={clinic} />
              </View>
              <Ionicons name="chevron-up" size={22} color={C.nd5} />
            </TouchableOpacity>
          ))}

          <View style={s.disclaimer}>
            <Ionicons name="warning-outline" size={19} color={C.warnDark} style={s.disclaimerIcon} />
            <Text style={s.disclaimerText}>
              AI suggestions are not a replacement for professional healthcare advice.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Expanded clinic card sheet.
          Close button is a sibling — NOT nested inside the pan-handler strip —
          so its onPress is never consumed by PanResponder. */}
      {expandedClinic && (
        <Animated.View style={[s.expandedSheet, { transform: [{ translateY: expandedSheetY }] }]}>
          <View style={s.expandedDragStrip} {...expandedPan.panHandlers}>
            <Ionicons name="chevron-down" size={32} color={C.nl1} />
          </View>

          <TouchableOpacity style={s.closeBtn} onPress={closeExpandedCard}>
            <Ionicons name="close" size={20} color={C.nd3} />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={s.expandedScrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[s.cardName, s.expandedCardName]}>{expandedClinic.name}</Text>
            <ClinicBadges clinic={expandedClinic} />

            <View style={s.divider} />

            <View style={s.aiSummaryBox}>
              <View style={s.aiOverviewHeader}>
                <Ionicons name="sparkles" size={16} color={C.primaryDark} />
                <Text style={s.aiOverviewLabel}>AI Overview</Text>
              </View>
              <Text style={s.aiOverviewText}>{expandedClinic.aiSummary}</Text>
            </View>

            <View style={s.divider} />

            <View style={s.detailList}>
              <View style={s.detailRow}>
                <Ionicons name="location-outline" size={21} color={C.nd4} />
                <Text style={s.detailText}>{expandedClinic.address}</Text>
              </View>
              <View style={s.detailRow}>
                <Ionicons name="time-outline" size={21} color={C.nd4} />
                <Text style={s.detailText}>
                  <Text style={s.detailLabel}>Hours: </Text>
                  {expandedClinic.hours}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Ionicons name="call-outline" size={21} color={C.nd4} />
                <Text style={s.detailText}>{expandedClinic.phone}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <View style={s.cardActions}>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]}>
                <Ionicons name="navigate" size={20} color={C.nd1} />
                <Text style={s.actionBtnPrimaryText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnSecondary]}>
                <Ionicons name="call-outline" size={20} color={C.nd2} />
                <Text style={s.actionBtnSecondaryText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnCopy]}
                onPress={() => Clipboard.setStringAsync(expandedClinic.address)}
              >
                <Ionicons name="copy-outline" size={20} color={C.nd3} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP — owns only navigation state and search orchestration
// ─────────────────────────────────────────────────────────────────────────────
export default function CareFindFlowApp() {
  const [step, setStep] = useState<AppStep>('language');
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const [clinics, setClinics] = useState<Clinic[]>([]);

  const isSpanish = selectedLang?.code === 'es';

  const handleLanguageSelect = useCallback((lang: Language) => {
    setSelectedLang(lang);
    setStep('location');
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Missing info', 'Please type or speak your medical need first.');
      return;
    }
    setSpokenText(trimmed);
    setStep('searching');
    await new Promise(r => setTimeout(r, 1300));
    setStep('loading');
    await new Promise(r => setTimeout(r, 1400));
    setClinics(MOCK_CLINICS);
    setStep('results');
  }, []);

  if (step === 'language') return (
    <LanguageScreen selectedLang={selectedLang} onSelect={handleLanguageSelect} />
  );
  if (step === 'location') return (
    <LocationScreen onBack={() => setStep('language')} onAllow={() => setStep('query')} />
  );
  if (step === 'query') return (
    <QueryScreen isSpanish={isSpanish} onBack={() => setStep('location')} onSearch={runSearch} />
  );
  if (step === 'searching') return <SearchingScreen />;
  if (step === 'loading') return (
    <LoadingScreen spokenText={spokenText} onBack={() => setStep('query')} />
  );
  return (
    <ResultsScreen
      clinics={clinics}
      spokenText={spokenText}
      onBack={() => setStep('query')}
      onEditQuery={() => setStep('query')}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Utility ───────────────────────────────────────────────────────────────
  flex1: { flex: 1 },
  fullWidth: { width: '100%' },
  safe: { flex: 1, backgroundColor: C.nl5 },
  bold: { fontWeight: '700' },
  btnIcon: { marginRight: 8 },
  spacer: { height: 8 },
  mapRoot: { flex: 1, backgroundColor: '#000' },

  // ── Shared layout ─────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8,
  },
  backButton: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.nl5, borderWidth: 1.5, borderColor: C.nl3,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600', color: C.nd1 },
  navSpacer: { width: 44 },
  centeredScreen: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  heroCenter: { alignItems: 'center', marginBottom: 16 },
  title: {
    fontSize: 30, fontWeight: '700', color: C.nd1,
    textAlign: 'center', letterSpacing: -0.3, marginBottom: 10,
  },
  subtitle: {
    fontSize: 19, lineHeight: 28, color: C.nd4,
    textAlign: 'center', marginBottom: 28, maxWidth: 300,
  },
  primaryButton: {
    backgroundColor: C.primary, paddingVertical: 20, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  primaryButtonText: { fontSize: 20, fontWeight: '700', color: C.nd1 },

  // ── Language screen ───────────────────────────────────────────────────────
  langHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.nl3,
  },
  langIconBg: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  langTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  langTitleStatic: { fontSize: 34, fontWeight: '800', color: C.nd1 },
  langTitleAnimated: { fontSize: 34, fontWeight: '800', color: C.primaryDark },
  langSubtitle: { fontSize: 20, color: C.nd4, textAlign: 'center', lineHeight: 28 },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.nl5 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.nl4, borderRadius: 14, borderWidth: 1.5, borderColor: C.nl3,
    paddingHorizontal: 14, height: 52,
  },
  searchInput: { flex: 1, fontSize: 20, color: C.nd1 },
  langListContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 120 },
  listSectionHeader: {
    paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6,
    fontSize: 14, fontWeight: '700', color: C.nd5, letterSpacing: 0.9, textTransform: 'uppercase',
  },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 20, paddingHorizontal: 18,
    borderRadius: 16, marginBottom: 8, borderWidth: 1.5,
  },
  langRowOutline: { backgroundColor: C.nl5, borderColor: C.nl3 },
  langRowSelected: { backgroundColor: C.primaryXlight, borderColor: C.primary },
  langFlag: { fontSize: 30 },
  langRowName: { fontSize: 22, fontWeight: '600', color: C.nd2 },
  langRowNameSelected: { color: C.primaryDark, fontWeight: '700' },
  langRowNative: { fontSize: 17, color: C.nd5, marginTop: 3 },
  checkCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  langFooter: {
    paddingHorizontal: 20, paddingBottom: 12, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.nl3, backgroundColor: C.nl5,
  },

  // ── Onboarding progress bar footer ───────────────────────────────────────
  onboardingFooter: {
    paddingHorizontal: 24, paddingBottom: 28, paddingTop: 14,
    backgroundColor: C.nl5, borderTopWidth: 1, borderTopColor: C.nl3,
    gap: 10,
  },
  progressStepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  progressDotActive: { backgroundColor: C.primaryDark },
  progressDotInactive: { backgroundColor: C.nl2 },
  progressLabel: {
    fontSize: 13, fontWeight: '600', color: C.nd5,
    marginLeft: 4, letterSpacing: 0.3,
  },
  progressTrack: {
    height: 6, backgroundColor: C.nl3, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: 6, backgroundColor: C.primary, borderRadius: 3,
  },

  // ── Location screen ───────────────────────────────────────────────────────
  pinIllus: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  pulseRing: { position: 'absolute', backgroundColor: 'rgba(115,199,227,0.13)' },
  pinWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  pinBase: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.nl5, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  trustCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: C.nl4, borderWidth: 1.5, borderColor: C.nl3,
    borderRadius: 18, padding: 18, marginBottom: 28, width: '100%',
  },
  trustIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  trustTitle: { fontSize: 17, fontWeight: '700', color: C.nd2, marginBottom: 4 },
  trustBody: { fontSize: 16, color: C.nd4, lineHeight: 23 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  alertModal: { backgroundColor: C.nl5, borderRadius: 22, padding: 30, alignItems: 'center', width: '100%' },
  alertTitle: { fontSize: 24, fontWeight: '700', color: C.nd1, marginBottom: 10, textAlign: 'center' },
  alertBody: { fontSize: 18, lineHeight: 26, color: C.nd3, textAlign: 'center' },
  modalIcon: { marginBottom: 14 },
  modalBtn: { marginTop: 22, width: '100%' },

  // ── Query screen ──────────────────────────────────────────────────────────
  signInPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 10,
    backgroundColor: C.primaryXlight, borderRadius: 24,
    borderWidth: 1, borderColor: C.primaryLight,
  },
  signInText: { fontSize: 17, fontWeight: '600', color: C.primaryDark },
  queryIconRing: {
    width: 106, height: 106, borderRadius: 53,
    backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  modeSlider: {
    flexDirection: 'row', backgroundColor: C.nl4,
    borderRadius: 32, padding: 4, marginBottom: 10,
    borderWidth: 1.5, borderColor: C.nl3, position: 'relative',
  },
  modeSliderActive: {
    position: 'absolute', top: 4, bottom: 4,
    backgroundColor: C.primary, borderRadius: 28,
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  modeSliderOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, paddingVertical: 16, zIndex: 1,
  },
  modeSliderText: { fontSize: 19, fontWeight: '600', color: C.nd4 },
  modeSliderTextActive: { color: C.nd1 },

  // Start Speaking button
  startSpeakingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    backgroundColor: C.primary, paddingVertical: 22, borderRadius: 18,
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
    marginBottom: 0,
  },
  startSpeakingText: { fontSize: 22, fontWeight: '700', color: C.nd1 },

  // Recording box — waveform + stop button, springs open while mic is active
  recordingBox: {
    marginTop: 14,
    backgroundColor: C.nl4, borderColor: C.nl3, borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18,
  },
  waveformContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    flex: 1, height: 44,
  },
  waveBar: { width: 4, height: 30, borderRadius: 2 },
  listeningLabel: { fontSize: 17, color: C.nd4, fontWeight: '500', marginRight: 12 },

  // Red stop button — sits in the top-right corner of the recording box
  stopBtnInBox: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#D0342C',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    shadowColor: '#D0342C', shadowOpacity: 0.4, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  // Transcript card — appears below Start Speaking after recording stops
  transcriptCard: {
    marginTop: 14,
    backgroundColor: C.nl5, borderWidth: 1.5, borderColor: C.primaryLight,
    borderRadius: 16, padding: 16,
    shadowColor: C.primary, shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  transcriptCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  transcriptCardLabel: {
    flex: 1, fontSize: 13, fontWeight: '700', color: C.primaryDark,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  transcriptCardText: { fontSize: 18, color: C.nd1, lineHeight: 27 },

  // Text input box — always rendered, height animated
  queryInputAnimated: {
    backgroundColor: C.nl4, borderColor: C.nl3, borderRadius: 18,
  },
  transcriptBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 10 },
  transcriptScroll: { flex: 1, maxHeight: 200 },
  transcriptInput: {
    flex: 1, fontSize: 18, color: C.nd1, lineHeight: 27,
    textAlignVertical: 'top', minHeight: 44,
  },
  stopSendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.nl5, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.nl3, flexShrink: 0, marginTop: 1,
  },
  queryDisclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.warnLight, borderWidth: 1, borderColor: '#f0c090',
    borderRadius: 14, padding: 14,
  },
  disclaimerTop: { marginTop: 16 },
  queryDisclaimerText: { flex: 1, fontSize: 17, fontWeight: '500', color: C.warnDark, lineHeight: 25 },

  // ── Searching screen ──────────────────────────────────────────────────────
  spinnerRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: C.primaryLight, borderTopColor: C.primary, marginBottom: 26,
  },
  loadingTitle: { fontSize: 22, fontWeight: '700', color: C.nd1, textAlign: 'center', marginBottom: 10 },
  loadingSubtitle: { fontSize: 18, color: C.nd4, textAlign: 'center' },

  // ── Loading screen (skeleton) ─────────────────────────────────────────────
  queryPillWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  queryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.nl4, borderWidth: 1.5, borderColor: C.nl3,
    borderRadius: 13, paddingHorizontal: 15, paddingVertical: 12,
  },
  queryPillText: { flex: 1, fontSize: 18, color: C.nd3 },
  queryPillEdit: { fontSize: 17, fontWeight: '600', color: C.primaryDark },
  skeletonWrap: { flex: 1, padding: 16, gap: 14 },
  skeletonCard: {
    backgroundColor: C.nl5, borderWidth: 1.5, borderColor: C.nl3,
    borderRadius: 22, padding: 20, gap: 13,
  },
  skeletonRow: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  skeletonCircle: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.nl3 },
  skeletonLine: { height: 13, borderRadius: 7, backgroundColor: C.nl3, marginBottom: 9 },
  skeletonBlock: { height: 70, borderRadius: 13, backgroundColor: C.nl3 },
  skeletonBtnRow: { flexDirection: 'row', gap: 8 },
  skeletonBtn: { flex: 1, height: 44, borderRadius: 12 },
  skeletonBtnSm: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.nl3 },

  // ── Results screen ────────────────────────────────────────────────────────
  floatingBack: {
    margin: 16, width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.nl5, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.96,
    backgroundColor: C.nl5,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  sheetHandleArea: { paddingTop: 14, paddingBottom: 14, alignItems: 'center' },
  sheetScrollContent: { padding: 16, paddingTop: 0 },
  aiOverviewBox: {
    backgroundColor: C.primaryXlight, borderWidth: 1, borderColor: C.primaryLight,
    borderRadius: 16, padding: 18, marginBottom: 16,
  },
  aiOverviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  aiOverviewLabel: {
    fontSize: 14, fontWeight: '700', color: C.primaryDark,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  aiOverviewText: { fontSize: 17, color: C.nd3, lineHeight: 26 },
  resultsCountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  resultsCount: { fontSize: 17, fontWeight: '600', color: C.nd4 },
  resultsHint: { fontSize: 15, color: C.nd5 },
  collapsedCard: {
    backgroundColor: C.nl5, borderWidth: 1.5, borderColor: C.nl3,
    borderRadius: 22, padding: 22, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  cardName: { fontSize: 20, fontWeight: '700', color: C.nd1, marginBottom: 12, letterSpacing: -0.1 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { fontSize: 17, fontWeight: '600' },
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.warnLight, borderWidth: 1, borderColor: '#f0c090',
    borderRadius: 14, padding: 14, marginTop: 8,
  },
  disclaimerIcon: { marginTop: 1 },
  disclaimerText: { flex: 1, fontSize: 16, fontWeight: '500', color: C.warnDark, lineHeight: 23 },

  // ── Expanded card sheet ───────────────────────────────────────────────────
  expandedSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: SCREEN_HEIGHT * 0.90,
    backgroundColor: C.nl5,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  expandedDragStrip: { paddingTop: 14, paddingBottom: 14, alignItems: 'center' },
  expandedScrollContent: { padding: 22, paddingTop: 4 },
  expandedCardName: { fontSize: 22, marginBottom: 14 },
  closeBtn: {
    position: 'absolute', right: 18, top: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.nl3, alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  divider: { height: 1, backgroundColor: C.nl3, marginVertical: 18 },
  aiSummaryBox: {
    backgroundColor: C.primaryXlight, borderWidth: 1, borderColor: C.primaryLight, borderRadius: 14, padding: 16,
  },
  detailList: { gap: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  detailText: { flex: 1, fontSize: 18, color: C.nd4, lineHeight: 26 },
  detailLabel: { fontWeight: '600', color: C.nd2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 15,
  },
  actionBtnPrimary: {
    flex: 1, backgroundColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  actionBtnPrimaryText: { fontSize: 18, fontWeight: '600', color: C.nd1 },
  actionBtnSecondary: { flex: 1, backgroundColor: C.nl4, borderWidth: 1.5, borderColor: C.nl2 },
  actionBtnSecondaryText: { fontSize: 18, fontWeight: '600', color: C.nd2 },
  actionBtnCopy: { width: 56, backgroundColor: C.nl4, borderWidth: 1.5, borderColor: C.nl2 },
});
