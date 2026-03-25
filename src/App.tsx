import React, { useMemo, useRef, useState } from "react";
import { FiDownload, FiSave, FiFolder, FiUpload, FiHelpCircle } from "react-icons/fi";


type Gender = "Masculin" | "Féminin" | "Autre" | "";
type DeskKind = "single" | "duo" | "quad";
type EditorMode = "toggle" | "single" | "duo" | "quad" | "split";

type Student = {
  id: string;
  name: string;
  gender: Gender;
  birthDate?: string;
  email?: string;
  options: string[];
};

type Seat = {
  id: string;
  row: number;
  col: number;
  active: boolean;
  deskId: string;
  deskKind: DeskKind;
};

type RulePair = {
  id: string;
  a: string;
  b: string;
};

type Assignment = Record<string, string | undefined>;

type ProjectData = {
  students: Student[];
  rows: number;
  cols: number;
  seats: Seat[];
  frontRowsCount: number;
  preferMixedGender: boolean;
  frontStudentIds: string[];
  farPairs: RulePair[];
  avoidAdjacentPairs: RulePair[];
};

const seatUiWidth = 156;
const seatUiHeight = 96;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function createDefaultClassroomLayout(rows = 5, cols = 8): Seat[] {
  let seats = createSeats(rows, cols);

  // Motif voulu sur 8 colonnes :
  // [0,1] = table de 2
  // [2,3,4,5] = double table de 2
  // [6,7] = table de 2
  if (cols >= 2) {
    for (let row = 0; row < rows; row += 1) {
      seats = assignDeskGroup(
        seats,
        [
          { row, col: 0 },
          { row, col: 1 },
        ],
        "duo"
      );
    }
  }

  if (cols >= 6) {
    for (let row = 0; row < rows; row += 1) {
      seats = assignDeskGroup(
        seats,
        [
          { row, col: 2 },
          { row, col: 3 },
          { row, col: 4 },
          { row, col: 5 },
        ],
        "quad"
      );
    }
  }

  if (cols >= 8) {
    for (let row = 0; row < rows; row += 1) {
      seats = assignDeskGroup(
        seats,
        [
          { row, col: 6 },
          { row, col: 7 },
        ],
        "duo"
      );
    }
  }

  return seats;
}

function createSeats(rows: number, cols: number): Seat[] {
  const seats: Seat[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      seats.push({
        id: `seat_${row}_${col}`,
        row,
        col,
        active: true,
        deskId: `desk_${row}_${col}`,
        deskKind: "single",
      });
    }
  }
  return seats;
}

function parseDelimitedLine(line: string, delimiter = ";") {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function parsePronoteCsv(text: string): Student[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseDelimitedLine(lines[0]).map((header) => header.replace(/^"|"$/g, "").trim());

  const nameIndex = headers.findIndex((h) => h.toLowerCase().includes("élèves") || h.toLowerCase().includes("eleves"));
  const genderIndex = headers.findIndex((h) => h.toLowerCase() === "sexe");
  const birthDateIndex = headers.findIndex((h) => h.toLowerCase().includes("né(e) le") || h.toLowerCase().includes("ne(e) le"));
  const emailIndex = headers.findIndex((h) => h.toLowerCase().includes("adresse e-mail") || h.toLowerCase().includes("adresse email"));

  const optionIndexes = headers
    .map((header, index) => ({ header: header.toLowerCase(), index }))
    .filter(({ header }) => ["option 1", "option 2", "option 3", "autres options"].some((needle) => header.includes(needle)))
    .map(({ index }) => index);

  const parsed = lines
    .slice(1)
    .map((line): Student | null => {
      const cells = parseDelimitedLine(line);

      const name = (cells[nameIndex] || "").replace(/^"|"$/g, "").trim();
      if (!name) return null;

      const options = optionIndexes
        .flatMap((idx) => (cells[idx] || "").replace(/^"|"$/g, "").split(","))
        .map((option) => option.trim())
        .filter(Boolean);

      const genderRaw = (cells[genderIndex] || "").replace(/^"|"$/g, "").trim();
      const gender: Gender =
        genderRaw === "Masculin" || genderRaw === "Féminin" ? genderRaw : genderRaw ? "Autre" : "";

      return {
        id: uid("student"),
        name,
        gender,
        birthDate: ((cells[birthDateIndex] || "").replace(/^"|"$/g, "").trim()) || undefined,
        email: ((cells[emailIndex] || "").replace(/^"|"$/g, "").trim()) || undefined,
        options,
      };
    });

  return parsed.filter((student): student is Student => student !== null);
}

function shuffle<T>(array: T[]) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function manhattan(a: Seat, b: Seat) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

function getActiveSeats(seats: Seat[]) {
  return seats.filter((seat) => seat.active).sort((a, b) => a.row - b.row || a.col - b.col);
}

function getSeatAt(seats: Seat[], row: number, col: number) {
  return seats.find((seat) => seat.row === row && seat.col === col);
}

function splitDeskById(seats: Seat[], deskId: string) {
  return seats.map((seat) => {
    if (seat.deskId !== deskId) return seat;
    return {
      ...seat,
      active: seat.active,
      deskId: `desk_${seat.row}_${seat.col}_${uid("s")}`,
      deskKind: "single" as DeskKind,
    };
  });
}

function assignDeskGroup(seats: Seat[], positions: Array<{ row: number; col: number }>, kind: DeskKind) {
  const deskId = uid("desk");
  const occupied = new Set(positions.map((position) => `${position.row}:${position.col}`));
  let nextSeats = [...seats];
  const deskIdsToSplit = new Set<string>();

  for (const position of positions) {
    const seat = getSeatAt(nextSeats, position.row, position.col);
    if (!seat) return seats;
    deskIdsToSplit.add(seat.deskId);
  }

  for (const existingDeskId of deskIdsToSplit) {
    nextSeats = splitDeskById(nextSeats, existingDeskId);
  }

  return nextSeats.map((seat) => {
    if (!occupied.has(`${seat.row}:${seat.col}`)) return seat;
    return {
      ...seat,
      active: true,
      deskId,
      deskKind: kind,
    };
  });
}

function updateRoomSeat(seats: Seat[], row: number, col: number, mode: EditorMode, cols: number): Seat[] {
  const target = getSeatAt(seats, row, col);
  if (!target) return seats;

  if (mode === "toggle") {
    const nextSeats = splitDeskById(seats, target.deskId);
    return nextSeats.map((seat): Seat => {
      if (seat.row !== row || seat.col !== col) return seat;

      if (seat.active) {
        return {
          ...seat,
          active: false,
          deskId: `desk_${seat.row}_${seat.col}_${uid("off")}`,
          deskKind: "single",
        };
      }

      return {
        ...seat,
        active: true,
        deskId: `desk_${seat.row}_${seat.col}_${uid("on")}`,
        deskKind: "single",
      };
    });
  }

  if (mode === "split") {
    return splitDeskById(seats, target.deskId);
  }

  if (mode === "single") {
    return assignDeskGroup(seats, [{ row, col }], "single");
  }

  if (mode === "duo") {
    if (col + 1 >= cols) return seats;
    return assignDeskGroup(
      seats,
      [
        { row, col },
        { row, col: col + 1 },
      ],
      "duo"
    );
  }

  if (mode === "quad") {
    if (col + 3 >= cols) return seats;
    return assignDeskGroup(
      seats,
      [
        { row, col },
        { row, col: col + 1 },
        { row, col: col + 2 },
        { row, col: col + 3 },
      ],
      "quad"
    );
  }

  return seats;
}

function getDeskGroups(seats: Seat[]) {
  const groups = new Map<string, Seat[]>();
  for (const seat of seats.filter((seat) => seat.active)) {
    if (!groups.has(seat.deskId)) groups.set(seat.deskId, []);
    groups.get(seat.deskId)?.push(seat);
  }
  return Array.from(groups.entries()).map(([deskId, deskSeats]) => ({
    deskId,
    seats: deskSeats.sort((a, b) => a.row - b.row || a.col - b.col),
    kind: deskSeats[0]?.deskKind || "single",
  }));
}

function buildAssignment(students: Student[], seats: Seat[]): Assignment {
  const result: Assignment = {};
  for (let i = 0; i < seats.length; i += 1) {
    result[seats[i].id] = students[i]?.id;
  }
  return result;
}

function scoreAssignment(params: {
  assignment: Assignment;
  seats: Seat[];
  students: Student[];
  frontRowsCount: number;
  preferMixedGender: boolean;
  frontStudentIds: string[];
  farPairs: RulePair[];
  avoidAdjacentPairs: RulePair[];
}) {
  const { assignment, seats, students, frontRowsCount, preferMixedGender, frontStudentIds, farPairs, avoidAdjacentPairs } = params;

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const seatMap = new Map(seats.map((seat) => [seat.id, seat]));
  const seatByStudent = new Map<string, Seat>();

  Object.entries(assignment).forEach(([seatId, studentId]) => {
    if (!studentId) return;
    const seat = seatMap.get(seatId);
    if (seat) seatByStudent.set(studentId, seat);
  });

  let score = 0;
  const reasons: string[] = [];

  for (const studentId of frontStudentIds) {
    const seat = seatByStudent.get(studentId);
    if (!seat) continue;
    if (seat.row < frontRowsCount) {
      score += 50;
    } else {
      score -= 120;
      const student = studentMap.get(studentId);
      reasons.push(`${student?.name || "Élève"} n'est pas placé devant.`);
    }
  }

  const avoidSet = new Set(avoidAdjacentPairs.map((pair) => pairKey(pair.a, pair.b)));

  for (const seat of seats) {
    const studentId = assignment[seat.id];
    if (!studentId) continue;

    const rightNeighbor = seats.find((candidate) => candidate.active && candidate.row === seat.row && candidate.col === seat.col + 1);
    if (!rightNeighbor) continue;

    const rightStudentId = assignment[rightNeighbor.id];
    if (!rightStudentId) continue;

    const key = pairKey(studentId, rightStudentId);
    if (avoidSet.has(key)) {
      score -= 220;
      const a = studentMap.get(studentId)?.name || "Élève";
      const b = studentMap.get(rightStudentId)?.name || "Élève";
      reasons.push(`${a} et ${b} sont côte à côte alors qu'ils doivent être séparés.`);
    }

    if (preferMixedGender) {
      const left = studentMap.get(studentId);
      const right = studentMap.get(rightStudentId);
      if (left?.gender && right?.gender) {
        if (left.gender !== right.gender) {
          score += 12;
        } else {
          score -= 8;
        }
      }
    }
  }

  for (const pair of farPairs) {
    const seatA = seatByStudent.get(pair.a);
    const seatB = seatByStudent.get(pair.b);
    if (!seatA || !seatB) continue;
    const distance = manhattan(seatA, seatB);
    score += distance * 10;
  }

  return { score, reasons };
}

function optimizeAssignment(params: {
  students: Student[];
  seats: Seat[];
  frontRowsCount: number;
  preferMixedGender: boolean;
  frontStudentIds: string[];
  farPairs: RulePair[];
  avoidAdjacentPairs: RulePair[];
}) {
  const { students, seats, frontRowsCount, preferMixedGender, frontStudentIds, farPairs, avoidAdjacentPairs } = params;

  const activeSeats = getActiveSeats(seats);
  const seatsToUse = activeSeats.slice(0, students.length);

  if (students.length === 0 || seatsToUse.length === 0) {
    return { assignment: {} as Assignment, score: 0, reasons: [] as string[] };
  }

  let bestAssignment: Assignment = {};
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestReasons: string[] = [];

  for (let attempt = 0; attempt < 700; attempt += 1) {
    const candidateStudents = shuffle(students);
    const frontSet = new Set(frontStudentIds);
    const frontStudents = candidateStudents.filter((student) => frontSet.has(student.id));
    const others = candidateStudents.filter((student) => !frontSet.has(student.id));
    const frontSeats = seatsToUse.filter((seat) => seat.row < frontRowsCount);
    const backSeats = seatsToUse.filter((seat) => seat.row >= frontRowsCount);

    const arranged: Student[] = [];
    if (frontStudents.length <= frontSeats.length) {
      arranged.push(...shuffle(frontStudents));
      arranged.push(...shuffle(others));
    } else {
      arranged.push(...shuffle(candidateStudents));
    }

    let assignment = buildAssignment(arranged, [...frontSeats, ...backSeats]);
    let { score } = scoreAssignment({
      assignment,
      seats: seatsToUse,
      students,
      frontRowsCount,
      preferMixedGender,
      frontStudentIds,
      farPairs,
      avoidAdjacentPairs,
    });

    for (let step = 0; step < 160; step += 1) {
      const usedSeats = [...frontSeats, ...backSeats];
      const seatA = usedSeats[Math.floor(Math.random() * usedSeats.length)];
      const seatB = usedSeats[Math.floor(Math.random() * usedSeats.length)];
      if (!seatA || !seatB || seatA.id === seatB.id) continue;

      const nextAssignment: Assignment = { ...assignment };
      [nextAssignment[seatA.id], nextAssignment[seatB.id]] = [nextAssignment[seatB.id], nextAssignment[seatA.id]];

      const nextScore = scoreAssignment({
        assignment: nextAssignment,
        seats: seatsToUse,
        students,
        frontRowsCount,
        preferMixedGender,
        frontStudentIds,
        farPairs,
        avoidAdjacentPairs,
      }).score;

      if (nextScore >= score || Math.random() < 0.04) {
        assignment = nextAssignment;
        score = nextScore;
      }
    }

    const scored = scoreAssignment({
      assignment,
      seats: seatsToUse,
      students,
      frontRowsCount,
      preferMixedGender,
      frontStudentIds,
      farPairs,
      avoidAdjacentPairs,
    });

    if (scored.score > bestScore) {
      bestScore = scored.score;
      bestAssignment = assignment;
      bestReasons = scored.reasons;
    }
  }

  return { assignment: bestAssignment, score: bestScore, reasons: bestReasons };
}

function downloadTextFile(filename: string, content: string, contentType = "application/json") {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function splitLabel(text: string, maxChars = 16) {
  const clean = text.trim();
  if (!clean) return ["Vide"];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (word.length > maxChars) {
        lines.push(word.slice(0, maxChars));
        current = word.slice(maxChars);
      } else {
        current = word;
      }
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function renderSvgMultilineText(x: number, y: number, lines: string[], fontSize: number) {
  const lineHeight = fontSize + 4;
  const offset = ((lines.length - 1) * lineHeight) / 2;
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" font-family="Arial" font-weight="bold">${lines
    .map((line, index) => `<tspan x="${x}" y="${y - offset + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}

function exportSvg(params: {
  seats: Seat[];
  assignment: Assignment;
  students: Student[];
  rows: number;
  cols: number;
  frontRowsCount: number;
}) {
  const { seats, assignment, students, rows, cols, frontRowsCount } = params;
  const activeSeats = seats.filter((seat) => seat.active);
  const deskGroups = getDeskGroups(activeSeats);
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const svgCellW = 210;
  const svgCellH = 122;
  const marginX = 90;
  const marginY = 80;
  const width = cols * svgCellW + marginX * 2;
  const height = rows * svgCellH + marginY * 2;

  const deskRects = deskGroups
    .map((group) => {
      const minCol = Math.min(...group.seats.map((seat) => seat.col));
      const maxCol = Math.max(...group.seats.map((seat) => seat.col));
      const minRow = Math.min(...group.seats.map((seat) => seat.row));
      const x = marginX + minCol * svgCellW;
      const y = marginY + minRow * svgCellH;
      const widthDesk = (maxCol - minCol + 1) * svgCellW - 12;
      const heightDesk = svgCellH - 18;
      const fill = minRow < frontRowsCount ? "#dbeafe" : "#ffffff";

      const separators = group.seats
        .slice(1)
        .map((seat) => {
          const lineX = marginX + seat.col * svgCellW - 6;
          return `<line x1="${lineX}" y1="${y + 8}" x2="${lineX}" y2="${y + heightDesk - 8}" stroke="#94a3b8" stroke-width="1.5" />`;
        })
        .join("\n");

      const labels = group.seats
        .map((seat) => {
          const student = studentMap.get(assignment[seat.id] || "");
          if (!student?.name) return "";
          const lines = splitLabel(student.name, group.kind === "single" ? 18 : 14);
          const centerX = marginX + seat.col * svgCellW + (svgCellW - 12) / 2;
          const centerY = y + heightDesk / 2;
          return renderSvgMultilineText(centerX, centerY, lines, 18);
        })
        .join("\n");

      return `
        <g>
          <rect x="${x}" y="${y}" width="${widthDesk}" height="${heightDesk}" rx="18" fill="${fill}" stroke="#0f172a" stroke-width="2" />
          ${separators}
          ${labels}
        </g>
      `;
    })
    .join("\n");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#f8fafc" />
      <rect x="${marginX}" y="18" width="${cols * svgCellW - 12}" height="20" rx="8" fill="#111827" />
      ${deskRects}
    </svg>
  `;

  downloadTextFile("plan-de-classe.svg", svg, "image/svg+xml");
}

export default function App() {
  const [moveMode, setMoveMode] = useState(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGender, setNewStudentGender] = useState<Gender>("");
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(8);
  const [seats, setSeats] = useState<Seat[]>(() => createDefaultClassroomLayout(5, 8));
  const [frontRowsCount, setFrontRowsCount] = useState(2);
  const [preferMixedGender, setPreferMixedGender] = useState(true);
  const [frontStudentIds, setFrontStudentIds] = useState<string[]>([]);
  const [farPairs, setFarPairs] = useState<RulePair[]>([]);
  const [avoidAdjacentPairs, setAvoidAdjacentPairs] = useState<RulePair[]>([]);
  const [pairForm, setPairForm] = useState({ a: "", b: "" });
  const [editorMode, setEditorMode] = useState<EditorMode>("toggle");
  const [result, setResult] = useState<{ assignment: Assignment; score: number; reasons: string[] }>({
    assignment: {},
    score: 0,
    reasons: [],
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSeats = useMemo(() => getActiveSeats(seats), [seats]);
  const studentsById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const deskGroups = useMemo(() => getDeskGroups(seats), [seats]);

  const tableStats = useMemo(() => {
    const stats = { single: 0, duo: 0, quad: 0 };
    for (const group of deskGroups) {
      if (group.kind === "single") stats.single += 1;
      if (group.kind === "duo") stats.duo += 1;
      if (group.kind === "quad") stats.quad += 1;
    }
    return stats;
  }, [deskGroups]);

  function swapStudentsBetweenSeats(fromSeatId: string, toSeatId: string) {
    setResult((current) => {
      const nextAssignment = { ...current.assignment };
      [nextAssignment[fromSeatId], nextAssignment[toSeatId]] = [
        nextAssignment[toSeatId],
        nextAssignment[fromSeatId],
      ];

      return {
        ...current,
        assignment: nextAssignment,
      };
    });
  }

  function resizeRoom(nextRows: number, nextCols: number) {
    const safeRows = Math.max(1, Math.min(12, Number(nextRows) || 1));
    const safeCols = Math.max(1, Math.min(12, Number(nextCols) || 1));
    setRows(safeRows);
    setCols(safeCols);
    setFrontRowsCount((current) => Math.min(current, safeRows));

    if (safeRows === 5 && safeCols === 8) {
      setSeats(createDefaultClassroomLayout(5, 8));
    } else {
      setSeats((currentSeats) => {
        const next = createSeats(safeRows, safeCols);
        const currentMap = new Map(currentSeats.map((seat) => [seat.id, seat]));
        return next.map((seat) => currentMap.get(seat.id) || seat);
      });
    }
  }

  function resetRoomLayout() {
    setSeats(createDefaultClassroomLayout(rows, cols));
    setResult({ assignment: {}, score: 0, reasons: [] });
  }

  function handleSeatClick(row: number, col: number) {
    const clickedSeat = getSeatAt(seats, row, col);
    if (!clickedSeat) return;

    // Mode déplacement : échange les élèves au lieu de modifier la salle
    if (moveMode && clickedSeat.active && Object.keys(result.assignment).length > 0) {
      if (!selectedSeatId) {
        setSelectedSeatId(clickedSeat.id);
        return;
      }

      if (selectedSeatId === clickedSeat.id) {
        setSelectedSeatId(null);
        return;
      }

      swapStudentsBetweenSeats(selectedSeatId, clickedSeat.id);
      setSelectedSeatId(null);
      return;
    }

    // Mode normal : édition de la salle
    setSeats((current) => updateRoomSeat(current, row, col, editorMode, cols));
  }

  function addStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    setStudents((current) => [...current, { id: uid("student"), name, gender: newStudentGender, options: [] }]);
    setNewStudentName("");
    setNewStudentGender("");
  }

  function removeStudent(studentId: string) {
    setStudents((current) => current.filter((student) => student.id !== studentId));
    setFrontStudentIds((current) => current.filter((id) => id !== studentId));
    setFarPairs((current) => current.filter((pair) => pair.a !== studentId && pair.b !== studentId));
    setAvoidAdjacentPairs((current) => current.filter((pair) => pair.a !== studentId && pair.b !== studentId));
  }

  function onImportCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const imported = parsePronoteCsv(text);
      if (imported.length > 0) {
        setStudents(imported);
        setFrontStudentIds([]);
        setFarPairs([]);
        setAvoidAdjacentPairs([]);
        setResult({ assignment: {}, score: 0, reasons: [] });
      }
      event.target.value = "";
    });
  }

  function toggleFrontStudent(studentId: string) {
    setFrontStudentIds((current) => (current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]));
  }

  function addPair(target: "far" | "avoid") {
    if (!pairForm.a || !pairForm.b || pairForm.a === pairForm.b) return;
    const pair: RulePair = { id: uid("pair"), a: pairForm.a, b: pairForm.b };
    if (target === "far") {
      setFarPairs((current) => [...current, pair]);
    } else {
      setAvoidAdjacentPairs((current) => [...current, pair]);
    }
    setPairForm({ a: "", b: "" });
  }

  function generatePlan() {
    const seatsToUse = activeSeats;
    if (students.length === 0) {
      alert("Ajoute ou importe des élèves d'abord.");
      return;
    }
    if (students.length > seatsToUse.length) {
      alert(`Il manque ${students.length - seatsToUse.length} place(s) active(s).`);
      return;
    }

    const optimized = optimizeAssignment({
      students,
      seats,
      frontRowsCount,
      preferMixedGender,
      frontStudentIds,
      farPairs,
      avoidAdjacentPairs,
    });
    setMoveMode(false);
    setSelectedSeatId(null);
    setResult(optimized);
  }

  function saveProject() {
    const data: ProjectData = {
      students,
      rows,
      cols,
      seats,
      frontRowsCount,
      preferMixedGender,
      frontStudentIds,
      farPairs,
      avoidAdjacentPairs,
    };
    downloadTextFile("plan-de-classe-projet.json", JSON.stringify(data, null, 2));
  }

  function loadProject(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text) as ProjectData;
      setStudents(data.students || []);
      setRows(data.rows || 5);
      setCols(data.cols || 8);
      setSeats(data.seats || createDefaultClassroomLayout(data.rows || 5, data.cols || 8));
      setFrontRowsCount(data.frontRowsCount || 2);
      setPreferMixedGender(Boolean(data.preferMixedGender));
      setFrontStudentIds(data.frontStudentIds || []);
      setFarPairs(data.farPairs || []);
      setAvoidAdjacentPairs(data.avoidAdjacentPairs || []);
      setResult({ assignment: {}, score: 0, reasons: [] });
      event.target.value = "";
    });
  }

  const placedStudents = useMemo(() => {
    const entries = Object.entries(result.assignment).filter(([, studentId]) => Boolean(studentId));
    return entries.map(([seatId, studentId]) => ({
      seat: seats.find((seat) => seat.id === seatId),
      student: studentsById.get(studentId || ""),
    }));
  }, [result.assignment, seats, studentsById]);

  function getDeskTitle(kind: DeskKind) {
    if (kind === "single") return "1 place";
    if (kind === "duo") return "2 places";
    return "2+2 places";
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-[1800px] p-6">
        <header className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold">Plan de classe</h1>
          <div className="flex">

            <span className="mr-5 pt-2">Commencez par importer votre liste d'élèves exportée sur pronotes ou ajouter manuellement vos élèves.</span>
            <button onClick={() => window.open(`${import.meta.env.BASE_URL}help.html`, "_blank")} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
              <FiHelpCircle /> Aide
            </button>

          </div>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Plan de salle</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={generatePlan} className="rounded-2xl bg-slate-900 px-4 py-2 text-white">
                Générer le plan
              </button>

              <button
                onClick={() => {
                  setMoveMode((current) => !current);
                  setSelectedSeatId(null);
                }}
                className={`rounded-2xl px-4 py-2 border ${moveMode ? "bg-amber-100 border-amber-300 text-amber-900" : "border-slate-300"
                  }`}
              >
                {moveMode ? "Quitter déplacement" : "Déplacer un élève"}
              </button>

              <button
                onClick={() => exportSvg({ seats, assignment: result.assignment, students, rows, cols, frontRowsCount })}
                className="rounded-2xl border border-slate-300 px-4 py-2 flex items-center gap-2"
              >
                <FiDownload />
                Image
              </button>
            </div>

          </div>

          <div className="mt-6 overflow-auto rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-5 flex justify-center">
              <div className="h-6 w-[70%] rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-medium">
                Tableau
              </div>
            </div>

            <div className="flex w-max min-w-full flex-col gap-4">
              {Array.from({ length: rows }).map((_, row) => (
                <div key={`row-${row}`} className="flex items-stretch justify-center">
                  {Array.from({ length: cols }).map((__, col) => {
                    const seat = getSeatAt(seats, row, col);
                    if (!seat) return null;

                    const sameLeft = getSeatAt(seats, row, col - 1)?.deskId === seat.deskId && seat.active;
                    const sameRight = getSeatAt(seats, row, col + 1)?.deskId === seat.deskId && seat.active;
                    const student = studentsById.get(result.assignment[seat.id] || "");
                    const labelLines = splitLabel(student?.name || "Place libre", seat.deskKind === "single" ? 18 : 15);
                    const isDeskStart = !sameLeft && seat.active;
                    const tableGap = sameRight ? 0 : 18;
                    const isSelected = selectedSeatId === seat.id;

                    return (
                      <button
                        key={seat.id}
                        onClick={() => handleSeatClick(row, col)}
                        className={`relative overflow-hidden p-3 text-left transition ${seat.active ? "hover:scale-[1.01]" : "hover:bg-slate-300"}`}
                        style={{
                          width: seatUiWidth,
                          height: seatUiHeight,
                          marginRight: col === cols - 1 ? 0 : tableGap,
                          borderTopLeftRadius: sameLeft ? 6 : 20,
                          borderBottomLeftRadius: sameLeft ? 6 : 20,
                          borderTopRightRadius: sameRight ? 6 : 20,
                          borderBottomRightRadius: sameRight ? 6 : 20,
                          borderWidth: isSelected ? 4 : 2,
                          borderStyle: "solid",
                          borderColor: isSelected ? "#f59e0b" : seat.active ? "#334155" : "#cbd5e1",
                          borderLeftWidth: sameLeft ? 1 : isSelected ? 4 : 2,
                          borderRightWidth: sameRight ? 1 : isSelected ? 4 : 2,
                          background: !seat.active ? "#cbd5e1" : row < frontRowsCount ? "#dbeafe" : "#ffffff",
                        }}
                      >
                        {seat.active ? (
                          <>
                            {isDeskStart && (
                              <div className="absolute right-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
                                {getDeskTitle(seat.deskKind)}
                              </div>
                            )}
                            <div className="mt-6 space-y-1">
                              {labelLines.map((line, lineIndex) => (
                                <div key={`${seat.id}-${lineIndex}`} className="text-sm font-semibold leading-4 text-slate-900">
                                  {line}
                                </div>
                              ))}
                            </div>
                            <div className="absolute bottom-2 left-3 text-[11px] text-slate-500">
                              L{row + 1} • C{col + 1}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-medium text-slate-500">Inactif</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {moveMode && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {!selectedSeatId
                  ? "Clique sur une place pour sélectionner un élève, puis clique sur une autre place pour échanger les noms."
                  : "Élève sélectionné : clique sur une autre place pour effectuer l’échange."}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Élèves</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStudent()}
                placeholder="Nom et prénom"
                className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
              <select
                value={newStudentGender}
                onChange={(e) => setNewStudentGender(e.target.value as Gender)}
                className="w-[120px] rounded-2xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Genre</option>
                <option value="Masculin">Masculin</option>
                <option value="Féminin">Féminin</option>
                <option value="Autre">Autre</option>
              </select>
              <button onClick={addStudent} className="rounded-2xl bg-slate-900 px-4 py-2 text-white">
                Ajouter
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-slate-300 px-3 py-2 text-sm flex items-center gap-2">
                <FiUpload />
                Importer CSV Pronote
              </button>
              <label className="rounded-2xl border border-slate-300 px-3 py-2 text-sm flex items-center gap-2">
                <FiFolder />
                Charger un projet
                <input type="file" accept="application/json" className="hidden" onChange={loadProject} />
              </label>
              <button onClick={saveProject} className="rounded-2xl border border-slate-300 px-3 py-2 text-sm flex items-center gap-2">
                <FiSave />
                Sauvegarder
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImportCsv} />

            <div className="mt-4 text-sm text-slate-600">
              {students.length} élève(s) • {activeSeats.length} place(s) active(s)
            </div>

            <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
              {students.map((student) => (
                <div key={student.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-xs text-slate-500">{student.gender || "Genre non renseigné"}</div>
                    </div>
                    <button onClick={() => removeStudent(student.id)} className="text-sm text-red-600">
                      Supprimer
                    </button>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={frontStudentIds.includes(student.id)} onChange={() => toggleFrontStudent(student.id)} />
                    À placer devant
                  </label>
                </div>
              ))}
              {students.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Aucun élève pour le moment.</div>}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Salle</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <label>
                <div className="mb-1">Lignes</div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={rows}
                  onChange={(e) => resizeRoom(Number(e.target.value), cols)}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label>
                <div className="mb-1">Colonnes</div>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={cols}
                  onChange={(e) => resizeRoom(rows, Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="col-span-2">
                <div className="mb-1">Nombre de rangées considérées “devant”</div>
                <input
                  type="number"
                  min={1}
                  max={rows}
                  value={frontRowsCount}
                  onChange={(e) => setFrontRowsCount(Math.max(1, Math.min(rows, Number(e.target.value) || 1)))}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-3">
              <div className="text-sm font-medium">Mode d'édition</div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {[
                  { key: "toggle", label: "Activer / désactiver" },
                  { key: "single", label: "Table 1" },
                  { key: "duo", label: "Table 2" },
                  { key: "quad", label: "Double table 2+2" },
                  { key: "split", label: "Dissocier" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setEditorMode(mode.key as EditorMode)}
                    className={`rounded-2xl px-3 py-2 ${editorMode === mode.key ? "bg-slate-900 text-white" : "border border-slate-300"}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Table 2 : clique sur la place de gauche. Double table 2+2 : clique sur la place la plus à gauche d'un bloc de 4 places sur la même rangée.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-100 px-3 py-2">Tables 1 : {tableStats.single}</div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2">Tables 2 : {tableStats.duo}</div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2">Tables 2+2 : {tableStats.quad}</div>
            </div>

            <button onClick={resetRoomLayout} className="mt-4 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm">
              Réinitialiser la disposition
            </button>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Règles</h2>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={preferMixedGender} onChange={(e) => setPreferMixedGender(e.target.checked)} />
              Préférer fille/garçon côte à côte
            </label>

            <div className="mt-4 rounded-2xl border border-slate-200 p-3">
              <div className="text-sm font-medium">Ajouter une paire</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <select
                  value={pairForm.a}
                  onChange={(e) => setPairForm((current) => ({ ...current, a: e.target.value }))}
                  className="rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Élève A</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
                <select
                  value={pairForm.b}
                  onChange={(e) => setPairForm((current) => ({ ...current, b: e.target.value }))}
                  className="rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Élève B</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => addPair("far")} className="rounded-2xl border border-slate-300 px-3 py-2 text-sm">
                  Éloigner au maximum
                </button>
                <button onClick={() => addPair("avoid")} className="rounded-2xl border border-slate-300 px-3 py-2 text-sm">
                  Interdire côte à côte
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="font-medium">Paires à éloigner</div>
                <div className="mt-2 space-y-2">
                  {farPairs.map((pair) => (
                    <div key={pair.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
                      <span>
                        {studentsById.get(pair.a)?.name} ↔ {studentsById.get(pair.b)?.name}
                      </span>
                      <button onClick={() => setFarPairs((current) => current.filter((item) => item.id !== pair.id))}>✕</button>
                    </div>
                  ))}
                  {farPairs.length === 0 && <div className="text-slate-500">Aucune paire.</div>}
                </div>
              </div>

              <div>
                <div className="font-medium">Paires interdites côte à côte</div>
                <div className="mt-2 space-y-2">
                  {avoidAdjacentPairs.map((pair) => (
                    <div key={pair.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2">
                      <span>
                        {studentsById.get(pair.a)?.name} ↔ {studentsById.get(pair.b)?.name}
                      </span>
                      <button onClick={() => setAvoidAdjacentPairs((current) => current.filter((item) => item.id !== pair.id))}>✕</button>
                    </div>
                  ))}
                  {avoidAdjacentPairs.length === 0 && <div className="text-slate-500">Aucune paire.</div>}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Résultat</h3>
            <div className="mt-2 text-sm text-slate-600">Score du plan : {result.score}</div>
            <div className="mt-4 max-h-80 space-y-2 overflow-auto">
              {placedStudents.map(({ seat, student }) => (
                <div key={`${seat?.id}-${student?.id}`} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium">{student?.name}</span>
                  {seat ? ` → Ligne ${seat.row + 1}, Colonne ${seat.col + 1}` : ""}
                </div>
              ))}
              {placedStudents.length === 0 && <div className="text-sm text-slate-500">Aucun plan généré.</div>}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Points à surveiller</h3>
            <div className="mt-4 space-y-2 text-sm">
              {result.reasons.length > 0 ? (
                result.reasons.map((reason, index) => (
                  <div key={`${reason}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                    {reason}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">Aucune alerte particulière sur ce plan.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

