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
import Svg, { Circle, Ellipse, Line, Path, Polyline, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { Audio } from 'expo-av';

// ── ElevenLabs config ─────────────────────────────────────────────────────────
const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  blueHero: '#9BAEEA',
  blueMid: '#7B96DF',
  blueDeep: '#5470C6',
  bluePale: '#D0DAFA',
  blueXpale: '#EDF0FB',
  pinkSoft: '#F4B8C8',
  pinkMid: '#EF8FA8',
  pinkPale: '#FCE8EE',
  white: '#FFFFFF',
  offWhite: '#F4F5FB',
  ink: '#1E2340',
  inkMid: '#4A5280',
  inkSoft: '#8E93B8',
  border: '#DDE3F4',
  greenBg: '#E5F5ED',
  greenText: '#1F8A55',
  redBg: '#FDF0F3',
  redText: '#C0354F',
} as const;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

type Language = typeof LANGUAGES[number];
type AppStep = 'language' | 'location' | 'query' | 'searching' | 'loading' | 'results';

type Clinic = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  lowCost: boolean;
  hours: string;
  phone: string;
  aiSummary: string;
  englishSummary: string;
  spanishSummary: string;
  matchScore: number;
  tag: string;
};

const UI_TEXT = {
  en: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    continue: 'Continue',
    searchLanguage: 'Search language…',

    enableLocation: 'Enable Location',
    locationSub:
      'CareFind uses your location to find the nearest clinics and care providers close to you.',
    privacyProtected: 'Your privacy is protected',
    privacyBody:
      'Your location is only used to find nearby care. It is never stored or shared.',
    nearbyClinicsOnly: 'Nearby clinics only',
    nearbyClinicsOnlyRest: ' — results within your area',
    oneTimeUse: 'One-time use',
    oneTimeUseRest: " — we don't track your movements",
    noAccountRequired: 'No account required',
    noAccountRequiredRest: ' — anonymous by default',
    allowLocation: 'Allow Location',
    enterManually: 'Enter manually instead',
    locationRequired: 'Location Required',
    locationRequiredBody:
      'Please allow location services. Go to Settings and enable Location for CareFind.',
    ok: 'OK',

    signIn: 'Sign In',
    howCanWeHelp: 'How can we help?',
    querySub: 'Describe your symptoms or the kind of care you need',
    speak: 'Speak',
    text: 'Text',
    recordAgain: 'Record Again',
    startSpeaking: 'Start Speaking',
    listening: 'Listening…',
    transcribed: 'Transcribed',
    typeSymptoms: 'Start typing your symptoms…',
    findCareNearMe: 'Find Care Near Me',
    emergencyDisclaimer: 'For emergencies, always call 911 immediately.',

    recordingError: 'Recording error',
    noAudioCreated: 'No audio file was created.',
    missingApiKey: 'Missing API key',
    missingElevenLabsKey: 'ELEVENLABS_API_KEY is not set.',
    noSpeechDetected: 'No speech detected',
    noSpeechDetectedBody:
      'We could not transcribe any speech from that recording.',
    transcriptionFailed: 'Transcription failed',
    transcriptionFailedBody:
      'We could not turn that recording into text.',

    findingProviders: 'Finding nearby providers',
    takesFewSeconds: 'This usually takes a few seconds',

    nearbyResults: 'Nearby Results',

    response: 'Response',
    read: 'Read',
    loading: 'Loading…',
    clinicsFound: (count: number) => `${count} Clinics Found`,
    tapToExpand: 'Tap to expand',
    directions: 'Directions',
    call: 'Call',
    noResults: 'No results found',
    noResultsBody: 'Try describing your symptoms in a little more detail.',
    summary: 'Summary',
    address: 'Address',
    hours: 'Hours',
    phone: 'Phone',
    match: (percent: number) => `Match ${percent}%`,
    lowCost: 'Low Cost',

    noOverviewAvailable: 'No overview available',
    noOverviewAvailableBody:
      'This clinic does not have an AI overview to read aloud yet.',
    audioError: 'Audio error',
    audioErrorBody: 'We could not read this clinic card out loud.',

    missingInfo: 'Missing info',
    missingInfoBody: 'Please type or speak your medical need first.',
    searchError: 'Search error',
    searchFailedBody: 'We could not search for clinics.',
    couldNotLoadResults: 'We could not load results right now.',
    foundClinics: 'I found these clinics for you.',
  },
  es: {
    stepOf: (step: number, total: number) => `Paso ${step} de ${total}`,
    continue: 'Continuar',
    searchLanguage: 'Buscar idioma…',

    enableLocation: 'Activar ubicación',
    locationSub:
      'CareFind usa tu ubicación para encontrar las clínicas y centros de atención más cercanos a ti.',
    privacyProtected: 'Tu privacidad está protegida',
    privacyBody:
      'Tu ubicación solo se usa para encontrar atención cercana. Nunca se guarda ni se comparte.',
    nearbyClinicsOnly: 'Solo clínicas cercanas',
    nearbyClinicsOnlyRest: ' — resultados en tu área',
    oneTimeUse: 'Uso único',
    oneTimeUseRest: ' — no rastreamos tus movimientos',
    noAccountRequired: 'No necesitas cuenta',
    noAccountRequiredRest: ' — anónimo por defecto',
    allowLocation: 'Permitir ubicación',
    enterManually: 'Ingresar manualmente',
    locationRequired: 'Se requiere ubicación',
    locationRequiredBody:
      'Permite los servicios de ubicación. Ve a Configuración y activa la ubicación para CareFind.',
    ok: 'OK',

    signIn: 'Iniciar sesión',
    howCanWeHelp: '¿Cómo podemos ayudarte?',
    querySub: 'Describe tus síntomas o el tipo de atención que necesitas',
    speak: 'Hablar',
    text: 'Texto',
    recordAgain: 'Grabar de nuevo',
    startSpeaking: 'Comenzar a hablar',
    listening: 'Escuchando…',
    transcribed: 'Transcrito',
    typeSymptoms: 'Escribe tus síntomas…',
    findCareNearMe: 'Buscar atención cerca de mí',
    emergencyDisclaimer: 'En emergencias, llama al 911 de inmediato.',

    recordingError: 'Error de grabación',
    noAudioCreated: 'No se creó ningún archivo de audio.',
    missingApiKey: 'Falta la clave API',
    missingElevenLabsKey: 'ELEVENLABS_API_KEY no está configurada.',
    noSpeechDetected: 'No se detectó voz',
    noSpeechDetectedBody:
      'No pudimos transcribir ninguna voz de esa grabación.',
    transcriptionFailed: 'Falló la transcripción',
    transcriptionFailedBody:
      'No pudimos convertir esa grabación en texto.',

    findingProviders: 'Buscando proveedores cercanos',
    takesFewSeconds: 'Esto suele tardar unos segundos',

    nearbyResults: 'Resultados cercanos',

    response: 'Respuesta',
    read: 'Leer',
    loading: 'Cargando…',
    clinicsFound: (count: number) => `${count} Clínicas encontradas`,
    tapToExpand: 'Toca para abrir',
    directions: 'Direcciones',
    call: 'Llamar',
    noResults: 'No se encontraron resultados',
    noResultsBody: 'Intenta describir tus síntomas con más detalle.',
    summary: 'Resumen',
    address: 'Dirección',
    hours: 'Horario',
    phone: 'Teléfono',
    match: (percent: number) => `Coincidencia ${percent}%`,
    lowCost: 'Bajo costo',

    noOverviewAvailable: 'No hay resumen disponible',
    noOverviewAvailableBody:
      'Esta clínica todavía no tiene un resumen de IA para leer en voz alta.',
    audioError: 'Error de audio',
    audioErrorBody: 'No pudimos leer esta tarjeta de clínica en voz alta.',

    missingInfo: 'Falta información',
    missingInfoBody: 'Describe o dicta tu necesidad médica primero.',
    searchError: 'Error de búsqueda',
    searchFailedBody: 'No pudimos buscar clínicas.',
    couldNotLoadResults: 'No pudimos cargar resultados en este momento.',
    foundClinics: 'Encontré estas clínicas para ti.',
  },
} as const;

function getUIText(isSpanish: boolean) {
  return isSpanish ? UI_TEXT.es : UI_TEXT.en;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG ICONS
// ─────────────────────────────────────────────────────────────────────────────
const SignalIcon = () => (
  <Svg width={14} height={10} viewBox="0 0 14 10" fill="none">
    <Rect x={0} y={6} width={2.5} height={4} rx={1} fill="rgba(255,255,255,0.8)" />
    <Rect x={3.5} y={4} width={2.5} height={6} rx={1} fill="rgba(255,255,255,0.8)" />
    <Rect x={7} y={2} width={2.5} height={8} rx={1} fill="rgba(255,255,255,0.8)" />
    <Rect x={10.5} y={0} width={2.5} height={10} rx={1} fill="rgba(255,255,255,0.8)" />
  </Svg>
);

const BatteryIcon = () => (
  <Svg width={18} height={10} viewBox="0 0 18 10" fill="none">
    <Rect x={0} y={1} width={15} height={8} rx={2} stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} />
    <Rect x={1.5} y={2.5} width={10} height={5} rx={1} fill="rgba(255,255,255,0.85)" />
    <Rect x={15.5} y={3.5} width={2} height={3} rx={1} fill="rgba(255,255,255,0.6)" />
  </Svg>
);

const HeroArc = () => (
  <Svg width="100%" height={48} viewBox="0 0 300 48" preserveAspectRatio="none">
    <Path d="M0,48 L0,30 Q75,6 150,20 Q225,34 300,12 L300,48 Z" fill="rgba(255,255,255,0.12)" />
    <Path d="M0,48 L0,36 Q75,16 150,28 Q225,40 300,22 L300,48 Z" fill="rgba(255,255,255,0.09)" />
    <Path d="M0,48 L0,48 Q75,30 150,40 Q225,48 300,36 L300,48 Z" fill={C.offWhite} />
  </Svg>
);

const GlobeIcon = () => (
  <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
    <Circle cx={13} cy={13} r={10} stroke="white" strokeWidth={1.5} strokeOpacity={0.9} />
    <Ellipse cx={13} cy={13} rx={4.5} ry={10} stroke="white" strokeWidth={1.5} strokeOpacity={0.7} />
    <Line x1={3} y1={13} x2={23} y2={13} stroke="white" strokeWidth={1.5} strokeOpacity={0.7} />
    <Line x1={4.5} y1={8} x2={21.5} y2={8} stroke="white" strokeWidth={1.2} strokeOpacity={0.5} />
    <Line x1={4.5} y1={18} x2={21.5} y2={18} stroke="white" strokeWidth={1.2} strokeOpacity={0.5} />
  </Svg>
);

const SearchIcon = ({ color = C.inkSoft }: { color?: string }) => (
  <Svg width={15} height={15} viewBox="0 0 15 15" fill="none">
    <Circle cx={6.5} cy={6.5} r={4.5} stroke={color} strokeWidth={1.5} />
    <Line x1={10} y1={10} x2={13.5} y2={13.5} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const ArrowRightIcon = () => (
  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
    <Line x1={1} y1={5.5} x2={10} y2={5.5} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
    <Polyline points="6,2 10,5.5 6,9" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
    <Polyline points="1,4 4,7 9,1" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BackArrowWhite = () => (
  <Svg width={12} height={10} viewBox="0 0 12 10" fill="none">
    <Line x1={11} y1={5} x2={1} y2={5} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
    <Polyline points="5,1 1,5 5,9" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BackArrowDark = () => (
  <Svg width={11} height={9} viewBox="0 0 11 9" fill="none">
    <Line x1={10} y1={4.5} x2={1} y2={4.5} stroke={C.inkMid} strokeWidth={1.4} strokeLinecap="round" />
    <Polyline points="4.5,1 1,4.5 4.5,8" stroke={C.inkMid} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LockIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Rect x={3} y={8} width={12} height={9} rx={2} stroke={C.blueDeep} strokeWidth={1.4} />
    <Path d="M6 8V6a3 3 0 0 1 6 0v2" stroke={C.blueDeep} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

const PinIcon = () => (
  <Svg width={32} height={38} viewBox="0 0 32 38" fill="none">
    <Path d="M16 2C9.373 2 4 7.373 4 14C4 21.732 16 36 16 36C16 36 28 21.732 28 14C28 7.373 22.627 2 16 2Z" fill="white" fillOpacity={0.9} />
    <Circle cx={16} cy={14} r={5} fill={C.blueHero} />
  </Svg>
);

const LocationPinBtnIcon = () => (
  <Svg width={14} height={16} viewBox="0 0 14 16" fill="none">
    <Path d="M7 1C4.239 1 2 3.239 2 6C2 9.5 7 15 7 15C7 15 12 9.5 12 6C12 3.239 9.761 1 7 1Z" stroke="white" strokeWidth={1.4} />
    <Circle cx={7} cy={6} r={2} fill="white" />
  </Svg>
);

const StethoscopeIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
    <Path d="M8 4v8a6 6 0 0 0 12 0V4" stroke="white" strokeWidth={1.6} strokeLinecap="round" />
    <Line x1={8} y1={4} x2={8} y2={8} stroke="white" strokeWidth={1.6} strokeLinecap="round" />
    <Line x1={20} y1={4} x2={20} y2={8} stroke="white" strokeWidth={1.6} strokeLinecap="round" />
    <Path d="M14 18v3a4 4 0 0 0 8 0v-2" stroke="white" strokeWidth={1.6} strokeLinecap="round" />
    <Circle cx={22} cy={19} r={2} stroke="white" strokeWidth={1.4} />
  </Svg>
);

const PersonIcon = () => (
  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
    <Circle cx={5.5} cy={4} r={2.5} stroke="white" strokeWidth={1.3} />
    <Path d="M1 10c0-2.485 2.015-4.5 4.5-4.5S10 7.515 10 10" stroke="white" strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

const MicSmIcon = ({ color }: { color: string }) => (
  <Svg width={13} height={14} viewBox="0 0 13 14" fill="none">
    <Rect x={4} y={1} width={5} height={8} rx={2.5} stroke={color} strokeWidth={1.3} />
    <Path d="M2 8a4.5 4.5 0 0 0 9 0" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    <Line x1={6.5} y1={12.5} x2={6.5} y2={13} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

const MicLgIcon = () => (
  <Svg width={18} height={20} viewBox="0 0 18 20" fill="none">
    <Rect x={5} y={1} width={8} height={12} rx={4} stroke="white" strokeWidth={1.5} />
    <Path d="M2 11a7 7 0 0 0 14 0" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={9} y1={18} x2={9} y2={19.5} stroke="white" strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const TextLinesIcon = () => (
  <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
    <Line x1={2} y1={4} x2={11} y2={4} stroke={C.inkSoft} strokeWidth={1.3} strokeLinecap="round" />
    <Line x1={2} y1={6.5} x2={11} y2={6.5} stroke={C.inkSoft} strokeWidth={1.3} strokeLinecap="round" />
    <Line x1={2} y1={9} x2={7} y2={9} stroke={C.inkSoft} strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

const InfoIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
    <Circle cx={7} cy={7} r={5.5} stroke={C.pinkMid} strokeWidth={1.3} />
    <Line x1={7} y1={4.5} x2={7} y2={7.5} stroke={C.pinkMid} strokeWidth={1.3} strokeLinecap="round" />
    <Circle cx={7} cy={9.5} r={0.7} fill={C.pinkMid} />
  </Svg>
);

const PhoneIcon = ({ color = 'white' }: { color?: string }) => (
  <Svg width={11} height={11} viewBox="0 0 11 11" fill="none">
    <Path d="M2 1h2.5l1 2.5L4 5a7 7 0 0 0 2 2l1.5-1.5L10 6.5V9a1 1 0 0 1-1 1C3.477 10 1 7.523 1 4.5A2.5 2.5 0 0 1 2 1Z" stroke={color} strokeWidth={1.2} />
  </Svg>
);

const CopyIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
    <Rect x={1} y={3} width={8} height={8} rx={1.5} stroke={C.inkMid} strokeWidth={1.2} />
    <Path d="M4 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H9" stroke={C.inkMid} strokeWidth={1.2} strokeLinecap="round" />
  </Svg>
);

const SparkleIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
    <Path d="M6 1l1.18 3.09L10.5 5l-3.32.91L6 11l-1.18-5.09L1.5 5l3.32-.91Z" fill={C.blueDeep} />
  </Svg>
);

const MapQIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
    <Circle cx={5} cy={5} r={3.5} stroke={C.inkSoft} strokeWidth={1.2} />
    <Line x1={7.5} y1={7.5} x2={10.5} y2={10.5} stroke={C.inkSoft} strokeWidth={1.2} strokeLinecap="round" />
  </Svg>
);

const HospitalIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Rect x={2} y={7} width={14} height={10} rx={2} stroke={C.blueDeep} strokeWidth={1.3} />
    <Path d="M6 7V5a3 3 0 0 1 6 0v2" stroke={C.blueDeep} strokeWidth={1.3} />
    <Line x1={9} y1={10} x2={9} y2={14} stroke={C.blueDeep} strokeWidth={1.3} strokeLinecap="round" />
    <Line x1={7} y1={12} x2={11} y2={12} stroke={C.blueDeep} strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

const PersonCardIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={6} r={3} stroke={C.pinkMid} strokeWidth={1.3} />
    <Path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={C.pinkMid} strokeWidth={1.3} strokeLinecap="round" />
  </Svg>
);

const StarIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
    <Path d="M9 2L11 7H16L12 10.5L13.5 15.5L9 12.5L4.5 15.5L6 10.5L2 7H7Z" stroke={C.blueDeep} strokeWidth={1.3} strokeLinejoin="round" />
  </Svg>
);

const SpeakerIcon = ({ color = C.blueDeep }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M3 6H5.5L9 3V13L5.5 10H3V6Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    <Path d="M11 5C11.8 5.8 12.3 6.8 12.3 8C12.3 9.2 11.8 10.2 11 11" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
  </Svg>
);

// ── Backend config / navigate helpers ────────────────────────────────────────
const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
  'http://10.138.250.241:8000';

type NavigateClinicResponse = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tag?: string;
  hours?: string | null;
  phone?: string | null;
  match_score?: number;
  aisummary?: string;
  translatedSummary?: string | null;
  lowCost?: boolean;
};

type NavigateResponse = {
  reply?: string;
  clinics?: NavigateClinicResponse[];
};

function getNavigateLanguage(selectedLang: Language | null): 'English' | 'Spanish' {
  return selectedLang?.code === 'es' ? 'Spanish' : 'English';
}

function mapClinicFromBackend(item: NavigateClinicResponse): Clinic {
  const englishSummary = item.aisummary?.trim() || 'No summary available.';
  const spanishSummary = item.translatedSummary?.trim() || englishSummary;

  return {
    id: item.id ?? Math.random().toString(),
    name: item.name ?? 'Unknown clinic',
    address: item.address ?? 'Address unavailable',
    lat: typeof item.lat === 'number' ? item.lat : 29.652,
    lng: typeof item.lng === 'number' ? item.lng : -82.372,
    lowCost: Boolean(item.lowCost),
    hours: item.hours?.trim() || 'Hours unavailable',
    phone: item.phone?.trim() || 'Phone unavailable',
    aiSummary: englishSummary,
    englishSummary,
    spanishSummary,
    matchScore: typeof item.match_score === 'number' ? item.match_score : 0,
    tag: item.tag?.trim() || '',
  };
}

async function fetchNavigateResults(text: string, selectedLang: Language | null): Promise<{
  reply: string;
  clinics: Clinic[];
}> {
  const response = await fetch(`${BACKEND_URL}/navigate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      language: getNavigateLanguage(selectedLang),
    }),
  });

  const rawText = await response.text();
  let parsed: NavigateResponse = {};

  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`Backend returned invalid JSON: ${rawText}`);
  }

  if (!response.ok) {
    const detail =
      typeof (parsed as any)?.detail === 'string'
        ? (parsed as any).detail
        : rawText || 'Navigation request failed.';
    throw new Error(detail);
  }

  return {
    reply: parsed.reply?.trim() || 'I found these clinics for you.',
    clinics: Array.isArray(parsed.clinics) ? parsed.clinics.map(mapClinicFromBackend) : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatusBarRow() {
  return null;
}

function HeroWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.hero}>
      {children}
      <HeroArc />
    </View>
  );
}

function ClinicBadge({ text, variant }: { text: string; variant: 'green' | 'blue' | 'red' }) {
  const bg = variant === 'green' ? C.greenBg : variant === 'red' ? C.redBg : C.blueXpale;
  const color = variant === 'green' ? C.greenText : variant === 'red' ? C.redText : C.blueDeep;
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color }]}>{text}</Text></View>;
}

function ClinicBadges({ clinic, isSpanish }: { clinic: Clinic; isSpanish: boolean }) {
  const t = getUIText(isSpanish);
  const matchPercent = Math.max(0, Math.min(100, Math.round(clinic.matchScore * 100)));

  return (
    <View style={s.badgesRow}>
      <ClinicBadge
        text={t.match(matchPercent)}
        variant="green"
      />
      {clinic.lowCost && (
        <ClinicBadge text={t.lowCost} variant="blue" />
      )}
      {!!clinic.tag && <ClinicBadge text={clinic.tag} variant="blue" />}
    </View>
  );
}

function OnboardingProgressBar({ step, isSpanish = false }: { step: 1 | 2; isSpanish?: boolean }) {
  const t = getUIText(isSpanish);
  const fillAnim = useRef(new Animated.Value(step === 1 ? 0.5 : 1)).current;

  useEffect(() => {
    Animated.timing(fillAnim, { toValue: step === 1 ? 0.5 : 1, duration: 380, useNativeDriver: false }).start();
  }, [step, fillAnim]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={s.progFooter}>
      <View style={s.progMeta}>
        {[1, 2].map(n => (
          <View key={n} style={[s.progDot, n <= step ? s.progDotOn : s.progDotOff]} />
        ))}
        <Text style={s.progLabel}>{t.stepOf(step, 2)}</Text>
      </View>
      <View style={s.progTrack}>
        <Animated.View style={[s.progFill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type LanguageScreenProps = { selectedLang: Language | null; onSelect: (lang: Language) => void };

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
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      <HeroWrapper>
        <StatusBarRow />
        <View style={s.heroInner}>
          <View style={s.iconRing}><GlobeIcon /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Text style={s.heroH1}>Select your </Text>
            <Animated.Text style={[s.heroH1Em, { opacity: fadeAnim }]}>{LANG_WORDS[langIndex]}</Animated.Text>
          </View>
          <Text style={s.heroSub}>Choose the language you're most comfortable with</Text>
        </View>
      </HeroWrapper>

      <View style={s.searchLift}>
        <View style={s.searchBar}>
          <SearchIcon />
          <TextInput
            style={s.searchInput}
            placeholder="Search language…"
            placeholderTextColor={C.inkSoft}
            value={search}
            onChangeText={setSearch}
          />
          <View style={s.searchArrow}><ArrowRightIcon /></View>
        </View>
      </View>

      <View style={s.bodyFlex}>
        <ScrollView
          style={s.flex1}
          contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 4, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map(lang => {
            const sel = selectedLang?.code === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.langRow, sel && s.langRowSel]}
                onPress={() => onSelect(lang)}
                activeOpacity={0.7}
              >
                <Text style={s.langFlag}>{lang.flag}</Text>
                <View style={s.flex1}>
                  <Text style={s.langName}>{lang.name}</Text>
                  <Text style={s.langNat}>{lang.native}</Text>
                </View>
                {sel && <View style={s.checkCircle}><CheckIcon /></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedLang && (
          <View style={s.langFooter}>
            <TouchableOpacity style={s.btnBlue} onPress={() => onSelect(selectedLang)} activeOpacity={0.85}>
              <Text style={s.btnBlueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        <OnboardingProgressBar step={1} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type LocationScreenProps = { isSpanish: boolean; onBack: () => void; onAllow: () => void };

function LocationScreen({ isSpanish, onBack, onAllow }: LocationScreenProps) {
  const t = getUIText(isSpanish);
  const [showModal, setShowModal] = useState(false);
  const pinFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pinFloat, { toValue: -7, duration: 1400, useNativeDriver: true }),
        Animated.timing(pinFloat, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pinFloat]);

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      <HeroWrapper>
        <StatusBarRow />
        <View style={s.navBar}>
          <TouchableOpacity style={s.navBtn} onPress={onBack}><BackArrowWhite /></TouchableOpacity>
          <View style={s.flex1} />
          <View style={{ width: 30 }} />
        </View>
        <View style={s.heroInner}>
          <Animated.View style={[s.locIllus, { transform: [{ translateY: pinFloat }] }]}>
            <PinIcon />
          </Animated.View>
          <Text style={[s.heroH1, { marginBottom: 4 }]}>{t.enableLocation}</Text>
          <Text style={s.heroSub}>
            {t.locationSub}
          </Text>
        </View>
      </HeroWrapper>

      <View style={s.bodyFlex}>
        <ScrollView style={s.flex1} contentContainerStyle={s.bodyScroll} showsVerticalScrollIndicator={false}>
          <View style={[s.card, { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 }]}>
            <View style={s.iconRingSm}><LockIcon /></View>
            <View style={s.flex1}>
              <Text style={s.cardH2}>{t.privacyProtected}</Text>
              <Text style={s.cardBody}>{t.privacyBody}</Text>
            </View>
          </View>

          <View style={[s.card, { marginBottom: 12 }]}>
            {[
              { dot: C.blueMid, strong: t.nearbyClinicsOnly, rest: t.nearbyClinicsOnlyRest },
              { dot: C.pinkMid, strong: t.oneTimeUse, rest: t.oneTimeUseRest },
              { dot: C.blueMid, strong: t.noAccountRequired, rest: t.noAccountRequiredRest, last: true },
            ].map(({ dot, strong, rest, last }, i) => (
              <View key={i} style={[s.infoItem, last && { borderBottomWidth: 0 }]}>
                <View style={[s.infoDot, { backgroundColor: dot }]} />
                <Text style={s.infoText}><Text style={s.infoStrong}>{strong}</Text>{rest}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.btnBlue, { flexDirection: 'row', gap: 8, marginBottom: 8 }]}
            onPress={onAllow}
            activeOpacity={0.85}
          >
            <LocationPinBtnIcon />
            <Text style={s.btnBlueText}>{t.allowLocation}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnGhost} activeOpacity={0.75}>
            <Text style={s.btnGhostText}>{t.enterManually}</Text>
          </TouchableOpacity>
        </ScrollView>

        <OnboardingProgressBar step={2} isSpanish={isSpanish} />
      </View>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.alertModal}>
            <Text style={s.alertTitle}>{t.locationRequired}</Text>
            <Text style={s.alertBody}>
              {t.locationRequiredBody}
            </Text>
            <TouchableOpacity style={[s.btnBlue, { marginTop: 22, width: '100%' }]} onPress={() => setShowModal(false)}>
              <Text style={s.btnBlueText}>{t.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type QueryScreenProps = { isSpanish: boolean; onBack: () => void; onSearch: (text: string) => void };

function QueryScreen({ isSpanish, onBack, onSearch }: QueryScreenProps) {
  const t = getUIText(isSpanish);
  const [inputMode, setInputMode] = useState<'speak' | 'text'>('speak');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');

  const recordBoxAnim = useRef(new Animated.Value(0)).current;
  const transcriptAnim = useRef(new Animated.Value(0)).current;
  const textBoxAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0.15))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startWave = useCallback(() => {
    waveLoops.current.forEach(l => l.stop());
    waveLoops.current = waveAnims.map((anim, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 70),
        Animated.timing(anim, { toValue: 1, duration: 250 + i * 35, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.15, duration: 250 + i * 35, useNativeDriver: true }),
      ]))
    );
    waveLoops.current.forEach(l => l.start());
  }, [waveAnims]);

  const stopWave = useCallback(() => {
    waveLoops.current.forEach(l => l.stop());
    waveAnims.forEach(a => a.setValue(0.15));
  }, [waveAnims]);

  useEffect(() => {
    Audio.requestPermissionsAsync().catch(() => { });
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true }).catch(() => { });
    return () => { stopWave(); recordingRef.current?.stopAndUnloadAsync().catch(() => { }); };
  }, [stopWave]);

  const handleStartSpeaking = useCallback(async () => {
    setTranscript('');
    Animated.timing(transcriptAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    setIsRecording(true);
    startWave();
    Animated.spring(recordBoxAnim, { toValue: 1, tension: 60, friction: 11, useNativeDriver: false }).start();
    try {
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) {
        const { granted: g2 } = await Audio.requestPermissionsAsync();
        if (!g2) throw new Error('Microphone permission denied');
      }
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
    } catch {
      stopWave(); setIsRecording(false);
      Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
    }
  }, [startWave, stopWave, recordBoxAnim, transcriptAnim]);

  const handleStopRecording = useCallback(async () => {
    stopWave(); setIsRecording(false);
    Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      recordingRef.current = null;
      const uri = recording.getURI();
      if (!uri) { Alert.alert(t.recordingError, t.noAudioCreated); return; }
      if (!ELEVENLABS_API_KEY) { Alert.alert(t.missingApiKey, t.missingElevenLabsKey); return; }
      const formData = new FormData();
      formData.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' } as any);
      formData.append('model_id', 'scribe_v1');
      const res = await fetch(ELEVENLABS_STT_URL, {
        method: 'POST', headers: { 'xi-api-key': ELEVENLABS_API_KEY }, body: formData,
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`STT failed: ${res.status} ${raw}`);

      const parsed = JSON.parse(raw);
      const rawText = parsed?.text?.trim?.() ?? '';

      const cleanedText = rawText
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[\s*[^\]]*\]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim();

      if (cleanedText) {
        setTranscript(cleanedText);
        Animated.spring(transcriptAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }).start();
      } else {
        Alert.alert(t.noSpeechDetected, t.noSpeechDetectedBody);
      }
    } catch (error) {
      console.log('Transcription failed:', error);
      Alert.alert(t.transcriptionFailed, t.transcriptionFailedBody);
    }
  }, [stopWave, recordBoxAnim, transcriptAnim, t]);

  const switchMode = useCallback((mode: 'speak' | 'text') => {
    if (mode === inputMode) return;
    if (mode === 'text') {
      if (isRecording) {
        stopWave(); setIsRecording(false);
        try { recordingRef.current?.stopAndUnloadAsync(); recordingRef.current = null; } catch (_) { }
      }
      Animated.spring(recordBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
      Animated.timing(transcriptAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.spring(textBoxAnim, { toValue: 1, tension: 60, friction: 11, useNativeDriver: false }).start();
    } else {
      Animated.spring(textBoxAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: false }).start();
      setTextInput('');
    }
    setInputMode(mode);
  }, [inputMode, isRecording, recordBoxAnim, transcriptAnim, textBoxAnim, stopWave]);

  const recordBoxHeight = recordBoxAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 130] });
  const recordBoxOpacity = recordBoxAnim.interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp' });
  const textBoxHeight = textBoxAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });
  const textBoxOpacity = textBoxAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const textBoxMT = textBoxAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const trCardOpacity = transcriptAnim;
  const trCardY = transcriptAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const activeQuery = inputMode === 'speak' ? transcript : textInput;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      <HeroWrapper>
        <StatusBarRow />
        <View style={s.navBar}>
          <TouchableOpacity style={s.navBtn} onPress={onBack}><BackArrowWhite /></TouchableOpacity>
          <View style={s.flex1} />
          <TouchableOpacity style={s.signInPill} activeOpacity={0.8}>
            <PersonIcon />
            <Text style={s.signInText}>{t.signIn}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.heroInner}>
          <View style={s.iconRing}><StethoscopeIcon /></View>
          <Text style={[s.heroH1, { marginBottom: 4 }]}>{t.howCanWeHelp}</Text>
          <Text style={s.heroSub}>
            {t.querySub}
          </Text>
        </View>
      </HeroWrapper>

      <KeyboardAvoidingView style={s.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.bodyScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={s.modeSlider}>
            <TouchableOpacity style={[s.modeOpt, inputMode === 'speak' && s.modeOptOn]} onPress={() => switchMode('speak')} activeOpacity={0.75}>
              <MicSmIcon color={inputMode === 'speak' ? C.white : C.inkSoft} />
              <Text style={[s.modeOptTxt, inputMode === 'speak' && s.modeOptTxtOn]}>{t.speak}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeOpt, inputMode === 'text' && s.modeOptOn]} onPress={() => switchMode('text')} activeOpacity={0.75}>
              <TextLinesIcon />
              <Text style={[s.modeOptTxt, inputMode === 'text' && s.modeOptTxtOn]}>{t.text}</Text>
            </TouchableOpacity>
          </View>

          {inputMode === 'speak' && !isRecording && (
            <TouchableOpacity style={s.speakBtn} onPress={handleStartSpeaking} activeOpacity={0.85}>
              <MicLgIcon />
              <Text style={s.speakBtnText}>{transcript ? t.recordAgain : t.startSpeaking}</Text>
            </TouchableOpacity>
          )}

          <Animated.View
            style={[s.recordingBox, { height: recordBoxHeight, opacity: recordBoxOpacity, borderWidth: isRecording ? 1.5 : 0 }]}
            pointerEvents={isRecording ? 'auto' : 'none'}
          >
            <View style={s.waveWrap}>
              {waveAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[s.waveBar, { transform: [{ scaleY: anim }], backgroundColor: i % 2 === 0 ? C.blueMid : C.blueHero }]}
                />
              ))}
            </View>
            <Text style={s.listeningLbl}>{t.listening}</Text>
            <TouchableOpacity style={s.stopBtn} onPress={handleStopRecording} activeOpacity={0.8}>
              <View style={s.stopDot} />
            </TouchableOpacity>
          </Animated.View>

          {inputMode === 'speak' && !!transcript && (
            <Animated.View style={[s.trCard, { opacity: trCardOpacity, transform: [{ translateY: trCardY }] }]}>
              <View style={s.trCardHead}>
                <Text style={s.trCardLbl}>{t.transcribed}</Text>
                <TouchableOpacity onPress={() => {
                  setTranscript('');
                  Animated.timing(transcriptAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
                }}>
                  <Text style={s.trClear}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.trCardTxt}>{transcript}</Text>
            </Animated.View>
          )}

          <Animated.View
            style={[s.textBox, { height: textBoxHeight, opacity: textBoxOpacity, marginTop: textBoxMT, borderWidth: 1.5, overflow: 'hidden' }]}
            pointerEvents={inputMode === 'text' ? 'auto' : 'none'}
          >
            <TextInput
              style={s.textBoxInput}
              placeholder={t.typeSymptoms}
              placeholderTextColor={C.inkSoft}
              multiline
              value={textInput}
              onChangeText={setTextInput}
              autoFocus={inputMode === 'text'}
            />
          </Animated.View>

          <TouchableOpacity
            style={[s.btnPink, { flexDirection: 'row', gap: 8, marginTop: 11, marginBottom: 11 }]}
            onPress={() => onSearch(activeQuery)}
            activeOpacity={0.85}
          >
            <SearchIcon color="white" />
            <Text style={s.btnPinkText}>{t.findCareNearMe}</Text>
          </TouchableOpacity>

          <View style={s.disclaimer}>
            <InfoIcon />
            <Text style={s.disclaimerTxt}>{t.emergencyDisclaimer}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCHING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function SearchingScreen({ isSpanish }: { isSpanish: boolean }) {
  const t = getUIText(isSpanish);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, useNativeDriver: true })).start();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={[s.flex1, { backgroundColor: C.offWhite, alignItems: 'center', justifyContent: 'center' }]}>
      <StatusBar barStyle="dark-content" />
      <Animated.View style={[s.spinner, { transform: [{ rotate }] }]} />
      <Text style={s.loadTitle}>{t.findingProviders}</Text>
      <Text style={s.loadSub}>{t.takesFewSeconds}</Text>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN (skeleton)
// ─────────────────────────────────────────────────────────────────────────────
type LoadingScreenProps = { spokenText: string; isSpanish: boolean; onBack: () => void };

function LoadingScreen({ spokenText, isSpanish, onBack }: LoadingScreenProps) {
  const t = getUIText(isSpanish);
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
    ])).start();
  }, [pulse]);

  return (
    <SafeAreaView style={[s.flex1, { backgroundColor: C.offWhite }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.loadTopBar}>
        <TouchableOpacity style={s.loadBackBtn} onPress={onBack}><BackArrowDark /></TouchableOpacity>
        <Text style={s.loadNavTitle}>{t.nearbyResults}</Text>
        <View style={{ width: 30 }} />
      </View>
      <View style={s.qPillWrap}>
        <View style={s.qPill}>
          <SearchIcon />
          <Text style={s.qPillText} numberOfLines={1}>{spokenText}</Text>
        </View>
      </View>
      <Animated.View style={[{ flex: 1, padding: 16, gap: 14 }, { opacity: pulse }]}>
        {[['72%', '44%'], ['88%', '55%'], ['58%']].map((widths, ci) => (
          <View key={ci} style={s.skelCard}>
            <View style={s.skelRow}>
              <View style={s.skelCircle} />
              <View style={s.flex1}>
                {widths.map((w, li) => <View key={li} style={[s.skelLine, { width: w as any }]} />)}
              </View>
            </View>
            {ci === 0 && (
              <>
                <View style={s.skelBlock} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={[s.skelLine, { flex: 1, height: 36, borderRadius: 10 }]} />
                  <View style={[s.skelLine, { flex: 1, height: 36, borderRadius: 10 }]} />
                  <View style={[s.skelLine, { width: 36, height: 36, borderRadius: 10 }]} />
                </View>
              </>
            )}
            {ci === 1 && <View style={s.skelBlock} />}
          </View>
        ))}
      </Animated.View>
    </SafeAreaView>
  );
}

async function createAndPlayClinicSpeech(
  clinic: Clinic,
  summaryText: string,
  isSpanish: boolean,
  setLoadingClinicId: (id: string | null) => void,
  currentSoundRef: React.MutableRefObject<Audio.Sound | null>,
) {
  const t = getUIText(isSpanish);

  try {
    if (!ELEVENLABS_API_KEY) {
      Alert.alert(t.missingApiKey, 'EXPO_PUBLIC_ELEVENLABS_API_KEY is not set.');
      return;
    }

    setLoadingClinicId(clinic.id);

    if (currentSoundRef.current) {
      await currentSoundRef.current.unloadAsync().catch(() => { });
      currentSoundRef.current = null;
    }

    const speechText = summaryText?.trim();

    if (!speechText) {
      Alert.alert(t.noOverviewAvailable, t.noOverviewAvailableBody);
      return;
    }

    const response = await fetch(`${ELEVENLABS_TTS_URL}/JBFqnCBsd6RMkjVDRZzb`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: speechText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS failed: ${response.status} ${errorText}`);
    }

    const audioBlob = await response.blob();
    const reader = new FileReader();

    const base64Audio: string = await new Promise((resolve, reject) => {
      reader.onerror = reject;
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.readAsDataURL(audioBlob);
    });

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    const sound = new Audio.Sound();

    await sound.loadAsync(
      { uri: `data:audio/mpeg;base64,${base64Audio}` },
      {
        shouldPlay: true,
        volume: 1.0,
        rate: 1.0,
        shouldCorrectPitch: true,
      }
    );

    await sound.setVolumeAsync(1.0);
    currentSoundRef.current = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => { });
        if (currentSoundRef.current === sound) currentSoundRef.current = null;
      }
    });
  } catch (error) {
    console.log('TTS error:', error);
    Alert.alert(t.audioError, t.audioErrorBody);
  } finally {
    setLoadingClinicId(null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type ResultsScreenProps = { clinics: Clinic[]; spokenText: string; onBack: () => void; onEditQuery: () => void; selectedLang: Language | null; reply: string };

function ResultsScreen({ clinics, spokenText, onBack, onEditQuery, selectedLang, reply }: ResultsScreenProps) {
  const SHEET_PEEK = SCREEN_HEIGHT * 0.60;
  const SHEET_OPEN = SCREEN_HEIGHT * 0.08;
  const isSpanish = selectedLang?.code === 'es';
  const t = getUIText(isSpanish);

  const sheetY = useRef(new Animated.Value(SHEET_PEEK)).current;
  const sheetOffset = useRef(SHEET_PEEK);

  const [expandedClinic, setExpandedClinic] = useState<Clinic | null>(null);
  const [loadingSpeechClinicId, setLoadingSpeechClinicId] = useState<string | null>(null);
  const [overviewTtsLoading, setOverviewTtsLoading] = useState(false);
  const expandedSheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const ttsSoundRef = useRef<Audio.Sound | null>(null);

  const getSummary = useCallback(
    (clinic: Clinic) => (isSpanish ? clinic.spanishSummary : clinic.englishSummary),
    [isSpanish]
  );

  useEffect(() => {
    return () => {
      if (ttsSoundRef.current) {
        ttsSoundRef.current.unloadAsync().catch(() => { });
        ttsSoundRef.current = null;
      }
    };
  }, []);

  const openExpanded = useCallback((clinic: Clinic) => {
    setExpandedClinic(clinic);
    expandedSheetY.setValue(SCREEN_HEIGHT);
    Animated.spring(expandedSheetY, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
  }, [expandedSheetY]);

  const closeExpanded = useCallback(() => {
    Animated.timing(expandedSheetY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true })
      .start(() => setExpandedClinic(null));
  }, [expandedSheetY]);

  const closeRef = useRef(closeExpanded);
  useEffect(() => { closeRef.current = closeExpanded; }, [closeExpanded]);

  const sheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 4,
    onPanResponderGrant: () => { sheetY.stopAnimation(val => { sheetOffset.current = val; }); },
    onPanResponderMove: (_, { dy }) => {
      const next = sheetOffset.current + dy;
      if (next >= SHEET_OPEN - 20 && next <= SHEET_PEEK + 60) sheetY.setValue(next);
    },
    onPanResponderRelease: (_, { dy, vy }) => {
      const target = (dy < -60 || vy < -0.6) ? SHEET_OPEN : SHEET_PEEK;
      sheetOffset.current = target;
      Animated.spring(sheetY, { toValue: target, tension: 60, friction: 10, useNativeDriver: false }).start();
    },
  })).current;

  const expandedPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 6,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) expandedSheetY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 110 || vy > 0.9) closeRef.current();
      else Animated.spring(expandedSheetY, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }).start();
    },
  })).current;

  const ClinicIconFor = ({ clinic }: { clinic: Clinic }) => {
    if (clinic.lowCost) return <View style={s.iconRingPk}><PersonCardIcon /></View>;
    if (clinic.matchScore >= 0.7) return <View style={s.iconRingSm}><StarIcon /></View>;
    return <View style={s.iconRingSm}><HospitalIcon /></View>;
  };

  return (
    <View style={s.mapRoot}>
      <StatusBar barStyle="dark-content" />

      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: clinics[0]?.lat ?? 29.652,
          longitude: clinics[0]?.lng ?? -82.372,
          latitudeDelta: 0.08,
          longitudeDelta: 0.06,
        }}
      >
        {clinics.map(clinic => (
          <Marker
            key={clinic.id}
            coordinate={{ latitude: clinic.lat, longitude: clinic.lng }}
            title={clinic.name}
            description={clinic.address}
            onPress={() => openExpanded(clinic)}
          />
        ))}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <TouchableOpacity style={s.floatBack} onPress={onBack}><BackArrowDark /></TouchableOpacity>
      </SafeAreaView>

      <Animated.View style={[s.bottomSheet, { transform: [{ translateY: sheetY }] }]}>
        <View style={s.sheetHandleArea} {...sheetPan.panHandlers}>
          <View style={s.sheetHandle} />
        </View>

        <View style={s.qPillWrap}>
          <View style={s.qPill}>
            <MapQIcon />
            <Text style={s.qPillText} numberOfLines={1}>"{spokenText}"</Text>
          </View>
        </View>

        <ScrollView style={s.flex1} contentContainerStyle={s.sheetScroll} showsVerticalScrollIndicator={false}>
          <View style={s.aiBox}>
            <View style={s.aiHead}>
              <SparkleIcon />
              <Text style={s.aiLbl}>{t.response}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={s.aiTtsBtn}
                onPress={() => {
                  const fakeClinic = { id: '__overview__' } as Clinic;
                  setOverviewTtsLoading(true);
                  createAndPlayClinicSpeech(fakeClinic, reply, isSpanish, (id) => {
                    setOverviewTtsLoading(false);
                  }, ttsSoundRef);
                }}
                activeOpacity={0.8}
              >
                <SpeakerIcon color={C.blueDeep} />
                <Text style={s.ttsBtnTxt}>{overviewTtsLoading ? t.loading : t.read}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.aiTxt}>{reply}</Text>
          </View>

          <View style={s.resMeta}>
            <Text style={s.resCount}>
              {t.clinicsFound(clinics.length)}
            </Text>
            <Text style={s.resHint}>{t.tapToExpand}</Text>
          </View>

          {!expandedClinic && clinics.map((clinic, idx) => (
            <TouchableOpacity
              key={clinic.id}
              style={[s.clinicCard, idx === 0 && s.clinicCardTop]}
              onPress={() => openExpanded(clinic)}
              activeOpacity={0.75}
            >
              <View style={s.ccHead}>
                <ClinicIconFor clinic={clinic} />
                <View style={s.flex1}>
                  <Text style={s.ccName}>{clinic.name}</Text>
                  <Text style={s.ccAddr}>{clinic.address}</Text>
                </View>
              </View>
              <ClinicBadges clinic={clinic} isSpanish={isSpanish} />
              <View style={s.ccSummary}>
                <View style={s.ccSummaryRow}>
                  <Text style={[s.ccSummaryTxt, { flex: 1 }]}>{getSummary(clinic)}</Text>
                  <TouchableOpacity
                    style={s.ccSummaryTtsBtn}
                    onPress={(e) => { e.stopPropagation(); createAndPlayClinicSpeech(clinic, getSummary(clinic), isSpanish, setLoadingSpeechClinicId, ttsSoundRef); }}
                    activeOpacity={0.75}
                  >
                    <SpeakerIcon color={loadingSpeechClinicId === clinic.id ? C.pinkMid : C.blueDeep} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.ccActs}>
                <TouchableOpacity style={[s.ccBtn, s.ccBtnPri]}>
                  <PhoneIcon /><Text style={s.ccBtnPriTxt}>{t.call}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ccBtn, s.ccBtnSec]}>
                  <Text style={s.ccBtnSecTxt}>{t.directions}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ccBtn, s.ccBtnSec, s.ccBtnIco]} onPress={() => Clipboard.setStringAsync(clinic.address)}>
                  <CopyIcon />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {clinics.length === 0 && (
            <View style={s.card}>
              <Text style={s.cardH2}>{t.noResults}</Text>
              <Text style={s.cardBody}>
                {t.noResultsBody}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {expandedClinic && (
        <Animated.View style={[s.expandedSheet, { transform: [{ translateY: expandedSheetY }] }]}>
          <View style={s.expandedDrag} {...expandedPan.panHandlers}>
            <View style={s.sheetHandle} />
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={closeExpanded}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={s.expandedScroll} showsVerticalScrollIndicator={false}>
            <Text style={s.expandedName}>{expandedClinic.name}</Text>
            <ClinicBadges clinic={expandedClinic} isSpanish={isSpanish} />
            <View style={s.divider} />
            <View style={s.aiBox}>
              <View style={s.aiHead}>
                <SparkleIcon />
                <Text style={s.aiLbl}>{t.summary}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={s.aiTtsBtn}
                  onPress={() => createAndPlayClinicSpeech(expandedClinic, getSummary(expandedClinic), isSpanish, setLoadingSpeechClinicId, ttsSoundRef)}
                  activeOpacity={0.8}
                >
                  <SpeakerIcon color={C.blueDeep} />
                  <Text style={s.ttsBtnTxt}>{loadingSpeechClinicId === expandedClinic.id ? t.loading : t.read}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.aiTxt}>{getSummary(expandedClinic)}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.detailList}>
              {[
                { label: t.address, value: expandedClinic.address },
                { label: t.hours, value: expandedClinic.hours },
                { label: t.phone, value: expandedClinic.phone },
              ].map(({ label, value }) => (
                <View key={label} style={s.detailRow}>
                  <Text style={s.detailLbl}>{label}</Text>
                  <Text style={s.detailVal}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={s.divider} />
            <View style={s.ccActs}>
              <TouchableOpacity style={[s.ccBtn, s.ccBtnPri, { flex: 1, height: 48 }]}>
                <Text style={s.ccBtnPriTxt}>{t.directions}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ccBtn, s.ccBtnSec, { flex: 1, height: 48 }]}>
                <PhoneIcon color={C.inkMid} /><Text style={s.ccBtnSecTxt}>{t.call}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ccBtn, s.ccBtnSec, s.ccBtnIco, { height: 48 }]} onPress={() => Clipboard.setStringAsync(expandedClinic.address)}>
                <CopyIcon />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function CareFindFlowApp() {
  const [step, setStep] = useState<AppStep>('language');
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [reply, setReply] = useState('');

  const isSpanish = selectedLang?.code === 'es';
  const t = getUIText(isSpanish);

  const handleLanguageSelect = useCallback((lang: Language) => {
    setSelectedLang(lang); setStep('location');
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert(
        t.missingInfo,
        t.missingInfoBody
      );
      return;
    }

    setSpokenText(trimmed);
    setStep('searching');

    try {
      const result = await fetchNavigateResults(trimmed, selectedLang);
      setStep('loading');
      await new Promise(r => setTimeout(r, 700));

      setReply(result.reply);
      setClinics(result.clinics);
      setStep('results');
    } catch (error) {
      console.log('Navigate failed:', error);
      const message =
        error instanceof Error ? error.message : t.searchFailedBody;

      setReply(t.couldNotLoadResults);
      setClinics([]);
      setStep('query');

      Alert.alert(
        t.searchError,
        message
      );
    }
  }, [selectedLang, t]);

  if (step === 'language') return <LanguageScreen selectedLang={selectedLang} onSelect={handleLanguageSelect} />;
  if (step === 'location') return <LocationScreen isSpanish={isSpanish} onBack={() => setStep('language')} onAllow={() => setStep('query')} />;
  if (step === 'query') return <QueryScreen isSpanish={isSpanish} onBack={() => setStep('location')} onSearch={runSearch} />;
  if (step === 'searching') return <SearchingScreen isSpanish={isSpanish} />;
  if (step === 'loading') return <LoadingScreen spokenText={spokenText} isSpanish={isSpanish} onBack={() => setStep('query')} />;

  return (
    <ResultsScreen
      clinics={clinics}
      spokenText={spokenText}
      selectedLang={selectedLang}
      reply={reply || t.foundClinics}
      onBack={() => setStep('query')}
      onEditQuery={() => setStep('query')}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex1: { flex: 1 },
  mapRoot: { flex: 1, backgroundColor: '#000' },

  screen: { flex: 1, backgroundColor: C.offWhite },

  hero: { width: '100%', flexShrink: 0, backgroundColor: C.blueHero },

  statusBar: { height: 0, overflow: 'hidden' },
  statusTime: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  heroInner: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, alignItems: 'center' },
  heroH1: { fontSize: 26, fontWeight: '700', color: 'white', lineHeight: 32, letterSpacing: -0.4, textAlign: 'center' },
  heroH1Em: { fontSize: 26, fontWeight: '700', color: C.pinkSoft, lineHeight: 32, letterSpacing: -0.4 },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.82)', lineHeight: 23, marginTop: 6, textAlign: 'center' },

  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  navBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  bodyFlex: { flex: 1, overflow: 'hidden', backgroundColor: C.offWhite },
  bodyScroll: { padding: 16, paddingBottom: 24 },

  iconRing: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 10,
  },
  iconRingSm: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.blueXpale, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconRingPk: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.pinkPale, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  searchLift: { marginHorizontal: 16, marginTop: -20, zIndex: 10, marginBottom: 10 },
  searchBar: {
    backgroundColor: C.white, borderRadius: 18,
    shadowColor: C.blueDeep, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, height: 52,
  },
  searchInput: { flex: 1, fontSize: 17, color: C.ink },
  searchArrow: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.blueMid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  sectionLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 8 },

  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    marginBottom: 7,
  },
  langRowSel: { borderColor: C.blueMid, backgroundColor: C.blueXpale },
  langFlag: { fontSize: 26, lineHeight: 30, flexShrink: 0 },
  langName: { fontSize: 18, fontWeight: '700', color: C.ink },
  langNat: { fontSize: 14, color: C.inkSoft, marginTop: 2 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.blueMid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  langFooter: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.white },

  progFooter: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 12, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  progMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  progDot: { width: 6, height: 6, borderRadius: 3 },
  progDotOn: { backgroundColor: C.blueMid },
  progDotOff: { backgroundColor: C.bluePale },
  progLabel: { fontSize: 14, fontWeight: '700', color: C.inkSoft, marginLeft: 4 },
  progTrack: { height: 4, backgroundColor: C.bluePale, borderRadius: 999, overflow: 'hidden' },
  progFill: { height: 4, borderRadius: 999, backgroundColor: C.blueMid },

  btnBlue: {
    backgroundColor: C.blueMid, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.blueDeep, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  btnBlueText: { fontSize: 17, fontWeight: '700', color: C.white },

  btnPink: {
    backgroundColor: C.pinkMid, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.pinkMid, shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  btnPinkText: { fontSize: 17, fontWeight: '700', color: C.white },

  btnGhost: {
    backgroundColor: C.white, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border,
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  btnGhostText: { fontSize: 17, fontWeight: '700', color: C.inkMid },

  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 14,
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardH2: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 4 },
  cardBody: { fontSize: 15, color: C.inkSoft, lineHeight: 22 },

  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  infoDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0, marginTop: 4 },
  infoText: { fontSize: 15, color: C.inkMid, lineHeight: 22, flex: 1 },
  infoStrong: { fontWeight: '700', color: C.ink },

  locIllus: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },

  signInPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.pinkMid },
  signInText: { fontSize: 13, fontWeight: '700', color: C.white },

  modeSlider: {
    flexDirection: 'row', backgroundColor: C.white, borderRadius: 999, padding: 3,
    borderWidth: 1.5, borderColor: C.border,
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    marginBottom: 12,
  },
  modeOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 999, backgroundColor: 'transparent' },
  modeOptOn: { backgroundColor: C.blueMid, shadowColor: C.blueDeep, shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  modeOptTxt: { fontSize: 15, fontWeight: '700', color: C.inkSoft },
  modeOptTxtOn: { color: C.white },

  speakBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.blueMid, paddingVertical: 16, borderRadius: 18,
    shadowColor: C.blueDeep, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 11,
  },
  speakBtnText: { fontSize: 17, fontWeight: '700', color: C.white },

  recordingBox: {
    backgroundColor: C.blueXpale, borderColor: C.bluePale, borderRadius: 18, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
  },
  waveWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, height: 44 },
  waveBar: { width: 4, height: 28, borderRadius: 2 },
  listeningLbl: { fontSize: 15, color: C.inkMid, fontWeight: '600', marginRight: 10 },
  stopBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D0342C', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stopDot: { width: 12, height: 12, borderRadius: 2, backgroundColor: C.white },

  trCard: { marginTop: 11, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.bluePale, borderRadius: 18, padding: 14 },
  trCardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  trCardLbl: { flex: 1, fontSize: 13, fontWeight: '700', color: C.blueDeep, textTransform: 'uppercase', letterSpacing: 1 },
  trClear: { fontSize: 14, color: C.inkSoft },
  trCardTxt: { fontSize: 16, color: C.ink, lineHeight: 24 },

  textBox: { backgroundColor: C.white, borderColor: C.border, borderRadius: 18 },
  textBoxInput: { fontSize: 16, color: C.ink, lineHeight: 24, padding: 14, textAlignVertical: 'top', minHeight: 90 },

  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, paddingHorizontal: 12, backgroundColor: C.pinkPale, borderRadius: 10, borderWidth: 1, borderColor: C.pinkSoft },
  disclaimerTxt: { fontSize: 14, color: C.pinkMid, fontWeight: '600', lineHeight: 20, flex: 1 },

  spinner: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: C.bluePale, borderTopColor: C.blueDeep, marginBottom: 20 },
  loadTitle: { fontSize: 21, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 6 },
  loadSub: { fontSize: 16, color: C.inkMid, textAlign: 'center' },

  loadTopBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, gap: 8 },
  loadBackBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  loadNavTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: C.ink },
  qPillWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  qPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  qPillText: { flex: 1, fontSize: 15, color: C.ink, fontWeight: '600' },
  qPillEdit: { fontSize: 15, fontWeight: '700', color: C.blueDeep },
  skelCard: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 18, padding: 14, gap: 10 },
  skelRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  skelCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.border },
  skelLine: { height: 10, borderRadius: 5, backgroundColor: C.border, marginBottom: 6 },
  skelBlock: { height: 56, borderRadius: 10, backgroundColor: C.border },

  floatBack: {
    margin: 16, width: 30, height: 30, borderRadius: 15, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, height: SCREEN_HEIGHT * 0.96,
    backgroundColor: C.offWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 10,
  },
  sheetHandleArea: { paddingTop: 14, paddingBottom: 12, alignItems: 'center' },
  sheetHandle: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.inkSoft, opacity: 0.35 },
  sheetScroll: { padding: 14, paddingTop: 0, paddingBottom: 20 },

  aiBox: { backgroundColor: C.blueXpale, borderWidth: 1, borderColor: C.bluePale, borderRadius: 18, padding: 12, marginBottom: 12 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiLbl: { fontSize: 12, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', color: C.blueDeep },
  aiTxt: { fontSize: 15, color: C.inkMid, lineHeight: 23 },
  aiTtsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.bluePale },

  resMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  resCount: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft },
  resHint: { fontSize: 13, color: C.inkSoft },

  clinicCard: {
    backgroundColor: C.white, borderRadius: 18, padding: 13, marginBottom: 10,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: C.blueDeep, shadowOpacity: 0.10, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  clinicCardTop: { borderColor: C.bluePale },
  ccHead: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 8 },
  ccName: { fontSize: 17, fontWeight: '700', color: C.ink, lineHeight: 23, marginBottom: 4 },
  ccAddr: { fontSize: 14, color: C.inkSoft },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  ccSummary: { padding: 8, paddingHorizontal: 10, backgroundColor: C.offWhite, borderRadius: 8, borderLeftWidth: 2.5, borderLeftColor: C.blueHero, marginBottom: 9 },
  ccSummaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ccSummaryTxt: { fontSize: 14, color: C.inkSoft, lineHeight: 21 },
  ccSummaryTtsBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.blueXpale, borderWidth: 1, borderColor: C.bluePale, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },

  ccActs: { flexDirection: 'row', gap: 6 },
  ccBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  ccBtnPri: { backgroundColor: C.blueMid, shadowColor: C.blueDeep, shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  ccBtnPriTxt: { fontSize: 15, fontWeight: '700', color: C.white },
  ccBtnSec: { backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.border },
  ccBtnSecTxt: { fontSize: 15, fontWeight: '700', color: C.inkMid },
  ccBtnIco: { flex: 0, width: 34, paddingVertical: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  alertModal: { backgroundColor: C.white, borderRadius: 22, padding: 24, alignItems: 'center', width: '100%' },
  alertTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  alertBody: { fontSize: 14, lineHeight: 21, color: C.inkMid, textAlign: 'center' },

  expandedSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_HEIGHT * 0.88,
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12,
  },
  expandedDrag: { paddingTop: 14, paddingBottom: 12, alignItems: 'center' },
  expandedScroll: { padding: 18, paddingTop: 4 },
  expandedName: { fontSize: 21, fontWeight: '700', color: C.ink, marginBottom: 12 },
  ttsBtnTxt: { fontSize: 13, color: C.blueDeep, fontWeight: '700' },
  closeBtn: { position: 'absolute', right: 16, top: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  closeTxt: { fontSize: 16, color: C.inkMid, fontWeight: '700' },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  detailList: { gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailLbl: { fontSize: 15, fontWeight: '700', color: C.ink, width: 68 },
  detailVal: { flex: 1, fontSize: 15, color: C.inkMid, lineHeight: 22 },
});