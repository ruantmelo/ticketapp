import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import {
  isDynamicQrWindowAccepted,
  parseDynamicQrPayload,
  type LoginInput,
  type User,
  type ValidatorEvent,
  type ValidationResultCode,
  type ValidationScanResponse,
} from "@ticket-chain/shared";
import { ApiClientError, createScannerApiClient, getScannerApiBaseUrl, isSessionError } from "./src/api";

type Screen = "login" | "events" | "scanner";
type StatusTone = "success" | "warning" | "danger" | "neutral";

const VALIDATOR_COPY = {
  loginTitle: "Validador online",
  loginSubtitle: "Acesse com a conta do staff para abrir os eventos e validar o QR dinâmico na porta.",
  eventsTitle: "Eventos liberados",
  eventsSubtitle: "Escolha o evento e abra o scanner.",
  scannerTitle: "Scanner de entrada",
  scannerSubtitle: "Aponte a câmera para o QR do ingresso.",
};

const toneByStatus: Record<ValidationResultCode, StatusTone> = {
  VALID_ACCEPTED: "success",
  INVALID_SIGNATURE: "danger",
  EXPIRED_QR: "warning",
  NOT_OWNER: "danger",
  ALREADY_USED: "warning",
  UNKNOWN_TICKET: "danger",
  CHAIN_UNAVAILABLE: "danger",
  INVALID_QR: "danger",
  FORBIDDEN_EVENT: "danger",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toneLabel(status: ValidationResultCode): string {
  switch (status) {
    case "VALID_ACCEPTED":
      return "Entrada liberada";
    case "EXPIRED_QR":
      return "QR expirado";
    case "ALREADY_USED":
      return "Ticket já usado";
    case "INVALID_SIGNATURE":
      return "Assinatura inválida";
    case "NOT_OWNER":
      return "Propriedade inválida";
    case "UNKNOWN_TICKET":
      return "Ticket desconhecido";
    case "CHAIN_UNAVAILABLE":
      return "Blockchain indisponível";
    case "INVALID_QR":
      return "QR inválido";
    case "FORBIDDEN_EVENT":
      return "Evento bloqueado";
  }
}

function toneMessage(response: ValidationScanResponse | null): string {
  if (!response) return "Pronto para escanear.";
  return response.message;
}

function bannerStyleForTone(tone: StatusTone) {
  switch (tone) {
    case "success":
      return styles.banner_success;
    case "warning":
      return styles.banner_warning;
    case "danger":
      return styles.banner_danger;
    default:
      return styles.banner_neutral;
  }
}

function toneColor(status: ValidationResultCode | null): string {
  if (!status) return "#8b93a7";
  switch (toneByStatus[status]) {
    case "success":
      return "#22c55e";
    case "warning":
      return "#f59e0b";
    case "danger":
      return "#ef4444";
    default:
      return "#8b93a7";
  }
}

function toneSurface(status: ValidationResultCode | null): string {
  if (!status) return "rgba(15, 23, 42, 0.92)";
  switch (toneByStatus[status]) {
    case "success":
      return "rgba(6, 78, 59, 0.94)";
    case "warning":
      return "rgba(120, 53, 15, 0.94)";
    case "danger":
      return "rgba(127, 29, 29, 0.94)";
    default:
      return "rgba(15, 23, 42, 0.92)";
  }
}

export default function App() {
  const apiBaseUrl = useMemo(() => getScannerApiBaseUrl(), []);
  const api = useMemo(() => createScannerApiClient(apiBaseUrl), [apiBaseUrl]);

  const [screen, setScreen] = useState<Screen>("login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState<ValidatorEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ValidatorEvent | null>(null);
  const [scanResult, setScanResult] = useState<ValidationScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: StatusTone; title: string; detail?: string } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockedRef = useRef(false);
  const lastScanRef = useRef<{ payload: string; at: number } | null>(null);

  const scanLocked = scanLockedRef.current;

  const resetScan = useCallback(() => {
    scanLockedRef.current = false;
    setScanResult(null);
    setMessage(null);
  }, []);

  const showSessionMessage = useCallback((tone: StatusTone, title: string, detail?: string) => {
    setMessage({ tone, title, detail });
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.events();
      setEvents(response.items);
    } catch (error) {
      if (isSessionError(error)) {
        api.clearSession();
        setUser(null);
        setScreen("login");
        showSessionMessage("danger", "Sessão expirada", "Faça login novamente.");
        return;
      }

      const detail = error instanceof Error ? error.message : "Não foi possível carregar os eventos.";
      showSessionMessage("danger", "API indisponível", detail);
    } finally {
      setLoading(false);
    }
  }, [api, showSessionMessage]);

  const handleLogin = useCallback(async () => {
    const credentials: LoginInput = { email: email.trim(), password };
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.login(credentials);
      if (response.user.role !== "validator") {
        api.clearSession();
        setUser(null);
        showSessionMessage("danger", "Acesso negado", "Esta conta não tem role validator.");
        return;
      }

      setUser(response.user);
      setScreen("events");
      showSessionMessage("success", "Login autorizado", `Olá, ${response.user.name}.`);
      await loadEvents();
    } catch (error) {
      const detail = error instanceof ApiClientError ? error.message : "Falha ao autenticar.";
      showSessionMessage("danger", "Não foi possível entrar", detail);
    } finally {
      setLoading(false);
    }
  }, [api, email, loadEvents, password, showSessionMessage]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await api.logout();
    } catch {
      api.clearSession();
    } finally {
      api.clearSession();
      setUser(null);
      setEvents([]);
      setSelectedEvent(null);
      resetScan();
      setScreen("login");
      setLoading(false);
    }
  }, [api, resetScan]);

  const openScanner = useCallback(
    (event: ValidatorEvent) => {
      setSelectedEvent(event);
      resetScan();
      setScreen("scanner");
    },
    [resetScan],
  );

  useEffect(() => {
    if (screen !== "scanner") return;
    if (permission?.granted) return;
    if (permission && !permission.canAskAgain) return;
    void requestPermission();
  }, [permission, requestPermission, screen]);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (screen !== "scanner" || !selectedEvent || scanLockedRef.current) return;

      const payload = result.data.trim();
      const recent = lastScanRef.current;
      const now = Date.now();
      if (recent && recent.payload === payload && now - recent.at < 2500) return;

      lastScanRef.current = { payload, at: now };
      scanLockedRef.current = true;
      setMessage(null);

      const parsed = parseDynamicQrPayload(payload);
      if (!parsed) {
        setScanResult({ status: "INVALID_QR", message: "QR inválido." });
        return;
      }

      if (!isDynamicQrWindowAccepted(parsed.windowIndex)) {
        setScanResult({ status: "EXPIRED_QR", message: "QR expirado." });
        return;
      }

      try {
        const response = await api.scan(selectedEvent.id, payload);
        setScanResult(response);
      } catch (error) {
        if (isSessionError(error)) {
          api.clearSession();
          setUser(null);
          setScreen("login");
          showSessionMessage("danger", "Sessão expirada", "Faça login novamente.");
          return;
        }

        const detail = error instanceof ApiClientError ? error.message : "Não foi possível validar.";
        setScanResult({ status: "CHAIN_UNAVAILABLE", message: detail });
      }
    },
    [api, screen, selectedEvent, showSessionMessage],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.background}>
        <View style={styles.glowA} />
        <View style={styles.glowB} />
        <View style={styles.glowC} />

        <View style={styles.shell}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>TICKETCHAIN</Text>
              <Text style={styles.title}>
                {screen === "login" ? VALIDATOR_COPY.loginTitle : screen === "events" ? VALIDATOR_COPY.eventsTitle : VALIDATOR_COPY.scannerTitle}
              </Text>
              <Text style={styles.subtitle}>
                {screen === "login" ? VALIDATOR_COPY.loginSubtitle : screen === "events" ? VALIDATOR_COPY.eventsSubtitle : VALIDATOR_COPY.scannerSubtitle}
              </Text>
            </View>
            <View style={styles.apiChip}>
              <Text style={styles.apiChipLabel}>API</Text>
              <Text style={styles.apiChipValue}>{apiBaseUrl}</Text>
            </View>
          </View>

          {message ? (
            <View style={[styles.banner, bannerStyleForTone(message.tone)]}>
              <Text style={styles.bannerTitle}>{message.title}</Text>
              {message.detail ? <Text style={styles.bannerDetail}>{message.detail}</Text> : null}
            </View>
          ) : null}

          {screen === "login" ? (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
              <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Acesso do staff</Text>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>E-mail</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="validador@evento.com"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Senha</Text>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                      editable={!loading}
                      onSubmitEditing={() => void handleLogin()}
                    />
                  </View>

                  <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => void handleLogin()} disabled={loading}>
                    {loading ? <ActivityIndicator color="#050816" /> : <Text style={styles.primaryButtonText}>Entrar e carregar eventos</Text>}
                  </Pressable>

                
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : null}

          {screen === "events" ? (
            <ScrollView contentContainerStyle={styles.eventsContent}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Eventos disponíveis</Text>
                <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]} onPress={() => void loadEvents()} disabled={loading}>
                  <Text style={styles.ghostButtonText}>Atualizar</Text>
                </Pressable>
              </View>

              {events.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nenhum evento liberado</Text>
                  <Text style={styles.emptyText}>O endpoint /validator/events ainda não trouxe eventos minted.</Text>
                </View>
              ) : (
                events.map((event) => (
                  <Pressable key={event.id} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]} onPress={() => openScanner(event)}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <View style={styles.eventBadge}>
                        <Text style={styles.eventBadgeText}>minted</Text>
                      </View>
                    </View>
                    <Text style={styles.eventMeta}>{event.location}</Text>
                    <Text style={styles.eventMeta}>{formatDateTime(event.startsAt)}</Text>
                    <Text style={styles.eventAction}>Abrir scanner</Text>
                  </Pressable>
                ))
              )}

              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => void handleLogout()} disabled={loading}>
                <Text style={styles.secondaryButtonText}>Sair</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {screen === "scanner" && selectedEvent ? (
            <View style={styles.scannerShell}>
              <View style={styles.scannerTopBar}>
                <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]} onPress={() => setScreen("events")}>
                  <Text style={styles.ghostButtonText}>Eventos</Text>
                </Pressable>
                <View style={styles.scannerEventChip}>
                  <Text style={styles.scannerEventChipText}>{selectedEvent.title}</Text>
                </View>
              </View>

              <View style={styles.cameraCard}>
                {permission?.granted ? (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  />
                ) : (
                  <View style={styles.permissionCard}>
                    <Text style={styles.permissionTitle}>Câmera bloqueada</Text>
                    <Text style={styles.permissionText}>Permita o acesso para escanear os QRs na porta.</Text>
                    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => void requestPermission()}>
                      <Text style={styles.primaryButtonText}>Permitir câmera</Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.cameraOverlay}>
                  <View style={styles.scanFrame} />
                  <Text style={styles.scanHint}>{scanLocked ? "Aguardando resposta..." : "Centralize o QR no enquadramento"}</Text>
                </View>
              </View>

              <View style={[styles.resultCard, { backgroundColor: toneSurface(scanResult?.status ?? null), borderColor: toneColor(scanResult?.status ?? null) }]}> 
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultStatus, { color: toneColor(scanResult?.status ?? null) }]}>
                    {scanResult ? toneLabel(scanResult.status) : "Pronto para validar"}
                  </Text>
                  <View style={[styles.resultDot, { backgroundColor: toneColor(scanResult?.status ?? null) }]} />
                </View>
                <Text style={styles.resultMessage}>{toneMessage(scanResult)}</Text>

                {scanResult ? (
                  <View style={styles.resultActions}>
                    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={resetScan}>
                      <Text style={styles.primaryButtonText}>Nova leitura</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]} onPress={() => setScreen("events")}>
                      <Text style={styles.ghostButtonText}>Trocar evento</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.resultActions}>
                    <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]} onPress={resetScan} disabled={!scanLocked}>
                      <Text style={styles.ghostButtonText}>Destravar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050816",
  },
  background: {
    flex: 1,
    backgroundColor: "#050816",
  },
  glowA: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 280,
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    top: -80,
    right: -90,
  },
  glowB: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    bottom: 180,
    left: -100,
  },
  glowC: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(244, 114, 182, 0.08)",
    bottom: -80,
    right: 24,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 14,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: "#94a3b8",
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: "700",
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    marginTop: 4,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 280,
  },
  apiChip: {
    maxWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  apiChipLabel: {
    color: "#94a3b8",
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  apiChipValue: {
    color: "#e2e8f0",
    fontSize: 11,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
  },
  banner: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  bannerTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  bannerDetail: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 20,
  },
  banner_success: {
    backgroundColor: "rgba(6, 78, 59, 0.94)",
    borderColor: "rgba(34, 197, 94, 0.45)",
  },
  banner_warning: {
    backgroundColor: "rgba(120, 53, 15, 0.94)",
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  banner_danger: {
    backgroundColor: "rgba(127, 29, 29, 0.94)",
    borderColor: "rgba(239, 68, 68, 0.45)",
  },
  banner_neutral: {
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  loginContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    gap: 14,
  },
  cardLabel: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(2, 6, 23, 0.7)",
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonText: {
    color: "#050816",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
  },
  secondaryButtonText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  helperText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  helperMono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
    color: "#e2e8f0",
  },
  eventsContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
  },
  emptyCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    gap: 8,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "800",
  },
  emptyText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 19,
  },
  eventCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    gap: 8,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eventTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  eventBadgeText: {
    color: "#86efac",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eventMeta: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
  },
  eventAction: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  scannerShell: {
    flex: 1,
    gap: 12,
  },
  scannerTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scannerEventChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scannerEventChipText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  cameraCard: {
    flex: 1,
    minHeight: 300,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    justifyContent: "center",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(2, 6, 23, 0.3)",
    gap: 16,
  },
  scanFrame: {
    width: "76%",
    aspectRatio: 1,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(248, 250, 252, 0.92)",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  scanHint: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  permissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
  },
  permissionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  permissionText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  resultCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultStatus: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  resultDot: {
    width: 12,
    height: 12,
    borderRadius: 12,
  },
  resultMessage: {
    color: "#f8fafc",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  resultActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
});
