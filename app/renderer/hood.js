// "Under the hood": a small, discreet panel saying what each screen really uses, and how the project answers
// the challenge criteria. Honest about what is live, what is a sample and what we left out on purpose.
import { getLang } from "../../src/i18n.js";

const T = (en, pt) => ({ en, pt });
const LIVE = T("live", "ao vivo"), SAMPLE = T("sample here, real with a tape", "exemplo aqui, real com um vídeo"), LOGIC = T("our logic", "nossa lógica");

const SCREEN = {
  cold: [[LOGIC, T("The whole idea in two lines: a living face has a heartbeat. The Ghost Detector is built on Presage SmartSpectra's camera pulse reading.", "A ideia em duas frases: rosto vivo tem batimento. O Detector de Fantasma é feito com a leitura de pulso por câmera do Presage SmartSpectra.")]],
  title: [[LOGIC, T("Three characters, three readings of the same data: Luna believes, Dr. Bigotes doubts, Xochi only records.", "Três personagens, três leituras dos mesmos dados: a Luna acredita, o Dr. Bigotes duvida, a Xochi só registra.")]],
  consent: [[LOGIC, T("Consent comes first. Camera only on a button press, video only (no microphone), off at any time, no frames saved.", "O consentimento vem primeiro. Câmera só ao apertar um botão, só vídeo (sem microfone), desliga a qualquer hora, nenhum quadro salvo.")]],
  case: [[LOGIC, T("The hook. Marina is a character, and the screen says so.", "O gancho. A Marina é uma personagem, e a tela diz isso.")]],
  calendar: [[SAMPLE, T("Each square is one night summarised as faces counted and faces with a pulse, from SDK pulse rate and validation status. The moving figure is story art, not data.", "Cada quadrado é uma noite resumida em rostos contados e rostos com pulso, a partir do pulso e do status de validação do SDK. A figura que anda é arte da história, não dado.")]],
  tape: [
    [SAMPLE, T("Pulse rate with confidence (cardio.pulseRate). Only readings at 50% or more drive the heart and the detector, and the beat speed is the bpm itself.", "Pulso com confiança (cardio.pulseRate). Só leituras de 50% ou mais movem o coração e o detector, e a velocidade da batida é o próprio bpm.")],
    [SAMPLE, T("Validation status: the SDK's multiple-faces code becomes \"a second face\".", "Status de validação: o código de múltiplos rostos do SDK vira \"um segundo rosto\".")],
    [SAMPLE, T("Chest trace (breathing.upperTrace): a flat stretch of 3 s or more becomes \"she held her breath\".", "Traço do tórax (breathing.upperTrace): um trecho reto de 3 s ou mais vira \"ela prendeu a respiração\".")],
    [LOGIC, T("A rise of 8 bpm within 10 s becomes \"her pulse jumped\". A recording is fed to the SDK frame by frame through a canvas stream.", "Uma subida de 8 bpm em 10 s vira \"o pulso dela disparou\". A gravação entra no SDK quadro a quadro por um stream de canvas.")],
  ],
  point: [
    [SAMPLE, T("Region reading: one part of the frame is cropped, enlarged up to 4 times and sent to the SDK on its own, so a small face in a corner gets its own pulse reading.", "Leitura de região: um pedaço do quadro é recortado, ampliado até 4 vezes e enviado sozinho ao SDK, para um rosto pequeno no canto ter sua própria leitura.")],
    [LOGIC, T("Verdict: a face present with no valid pulse is \"no pulse\"; no face is \"a shape\"; too dark is \"unreadable\", never a ghost.", "Veredito: rosto presente sem pulso válido é \"sem pulso\"; sem rosto é \"uma forma\"; escuro demais é \"ilegível\", nunca fantasma.")],
  ],
  locker: [[LOGIC, T("Each card is a number from the scan with its time range. Everything the crew says must cite a card (\"cite or vanish\").", "Cada cartão é um número da leitura com seu intervalo de tempo. Tudo o que a equipe diz precisa citar um cartão (\"cite ou suma\").")]],
  roomLive: [
    [LIVE, T("Your webcam goes through the SDK in this app's main process. Pulse rate, breathing rate, chest trace, talking, blinking and facial expression, all in real time.", "Sua webcam passa pelo SDK no processo principal do app. Pulso, ritmo respiratório, traço do tórax, fala, piscadas e expressão facial, tudo em tempo real.")],
    [LIVE, T("The image is only shown on screen and never stored. SDK validation hints (light, distance, motion) appear as short messages.", "A imagem só aparece na tela e nunca é guardada. As dicas de validação do SDK (luz, distância, movimento) aparecem como mensagens curtas.")],
  ],
  board: [
    [LIVE, T("Optional camera: the glass moves on your exhale, read from the live chest trace. One breath out carries it three letters.", "O copo anda quando você solta o ar, lido do traço do tórax ao vivo. Uma expirada leva o copo por três letras.")],
    [LIVE, T("The SDK's talking signal pauses the glass while you speak.", "O sinal de fala do SDK pausa o copo enquanto você fala.")],
    [LOGIC, T("No language model. Answers are templates that must cite measured evidence, and numbers must match it.", "Sem modelo de linguagem. As respostas são modelos que precisam citar provas medidas, e os números precisam bater.")],
  ],
  dossier: [[LOGIC, T("Luna interprets, Dr. Bigotes refuses to, and the file holds numbers and words only. It exists only if you press Download.", "A Luna interpreta, o Dr. Bigotes se recusa, e o arquivo só tem números e palavras. Ele só existe se você apertar Baixar.")]],
  end: [[LOGIC, T("The case closes here. Everything the crew concluded cites a measured card, and the story around it is fiction.", "O caso se fecha aqui. Tudo o que a equipe concluiu cita um cartão medido, e a história em volta é ficção.")]],
  dare: [
    [LIVE, T("Your own recording runs through the same SDK reading as Marina's. The picker stays locked until you confirm that everyone in it agreed.", "Sua própria gravação passa pela mesma leitura do SDK que a da Marina. O seletor fica travado até você confirmar que todos concordaram.")],
  ],
  room: [
    [LIVE, T("Your live pulse, breath and pulse jumps become evidence cards.", "Seu pulso, respiração e disparos ao vivo viram cartões de prova.")],
    [LIVE, T("Blinking: the figure moves only when the SDK sees you blink. Expression: your strongest stable expression becomes a card.", "Piscadas: a figura só se move quando o SDK vê você piscar. Expressão: sua expressão estável mais forte vira um cartão.")],
  ],
  tested: [[LIVE, T("After the Room or your own video, the counters on the proof tab come straight from the SDK. In Marina's case they are samples, and the tag above them says so.", "Depois da Sala ou do seu vídeo, os contadores da aba de prova vêm direto do SDK. No caso da Marina eles são de exemplo, e a etiqueta acima deles diz isso.")], [LOGIC, T("Synthetic scans with known answers test our logic. They do not measure Presage's accuracy, and the screen says so.", "Leituras sintéticas com resposta conhecida testam nossa lógica. Elas não medem a precisão da Presage, e a tela diz isso.")]],
};

const CRITERIA = [
  [T("Prize category", "Categoria do prêmio"), T("Most Creative or Delightful Use: the most original, playful, or unexpected use of SmartSpectra.", "Most Creative or Delightful Use: o uso mais original, divertido ou inesperado do SmartSpectra.")],
  [T("Use of the technology", "Uso da tecnologia"), T("SmartSpectra Node SDK in Electron: pulse rate with confidence, breathing rate, chest trace, talking, blinking, expressions and validation codes, on a live camera and on recordings, including cropped regions.", "SDK Node do SmartSpectra no Electron: pulso com confiança, ritmo respiratório, traço do tórax, fala, piscadas, expressões e códigos de validação, em câmera ao vivo e em gravações, inclusive em regiões recortadas.")],
  [T("Usability", "Usabilidade"), T("One guided story, automatic analysis with visible progress, a timeline you can drag, English and Portuguese, voices, and a way to play without a camera.", "Uma história guiada, análise automática com progresso visível, linha do tempo que dá para arrastar, inglês e português, vozes e opção de jogar sem câmera.")],
  [T("Originality", "Originalidade"), T("The absence of a signal is the discovery: a face with no pulse. Your own breath moves the board, and your blink moves the ghost.", "A ausência do sinal é a descoberta: um rosto sem pulso. Sua própria respiração move o tabuleiro, e sua piscada move o fantasma.")],
  [T("Consent and data", "Consentimento e dados"), T("Camera only on a button press, no microphone, no frames or video saved, readings in memory only, SDK telemetry off, a consent check for tapes. No language model or other AI service.", "Câmera só ao apertar um botão, sem microfone, sem salvar quadros ou vídeo, leituras só na memória, telemetria do SDK desligada, confirmação de consentimento para vídeos. Sem modelo de linguagem ou outro serviço de IA.")],
  [T("Left out on purpose", "Deixado de fora de propósito"), T("HRV stress index, arterial pressure trace and apnea are available in the SDK but unused: this is a game, never a health tool.", "Índice de estresse da VFC, traço de pressão arterial e apneia existem no SDK, mas não são usados: isto é um jogo, nunca uma ferramenta de saúde.")],
];

export function hoodHTML(screenId) {
  const l = getLang(), pick = (x) => x[l];
  const rows = (SCREEN[screenId] ?? []).map(([tag, text]) => `<li><span class="hood-tag ${tag === LIVE ? "live" : tag === SAMPLE ? "sample" : ""}">${pick(tag)}</span> ${pick(text)}</li>`).join("");
  const crit = CRITERIA.map(([a, b]) => `<li><b>${pick(a)}.</b> ${pick(b)}</li>`).join("");
  return `<div class="hood-h">${l === "pt" ? "Nesta tela" : "On this screen"}</div><ul>${rows}</ul>
    <details><summary>${l === "pt" ? "Critérios do desafio" : "Challenge criteria"}</summary><ul>${crit}</ul></details>`;
}
