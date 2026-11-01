import type { Person, Source } from "./types";

// ---------------------------------------------------------------------------
// Synthetic demo data: "RoboCell", a fictional college robotics club.
// Every person, company, email and repo below is invented for the demo.
// Planted on purpose: two conflicts, decisions without reasons, unowned tasks,
// tasks owned by the person who is leaving, a credential in chat, and a
// confidential core-team channel that no incoming member may see.
// ---------------------------------------------------------------------------

export const CLUB = {
  name: "RoboCell Robotics Club",
  leaverId: "aarav",
  leaverName: "Aarav Mehta",
  leavingOn: "December 2026",
};

export const PEOPLE: Person[] = [
  {
    id: "aarav",
    name: "Aarav Mehta",
    title: "Club lead, leaving in Dec 2026",
    roles: ["member", "tech", "finance", "core"],
    kind: "leaver",
  },
  {
    id: "rao",
    name: "Dr. Meera Rao",
    title: "Faculty advisor, reviewer",
    roles: ["member", "tech", "finance", "core", "advisor"],
    kind: "reviewer",
  },
  {
    id: "priya",
    name: "Priya Nair",
    title: "Incoming tech lead",
    roles: ["member", "tech"],
    kind: "incoming",
  },
  {
    id: "kabir",
    name: "Kabir Shah",
    title: "Incoming treasurer",
    roles: ["member", "finance"],
    kind: "incoming",
  },
];

const ALL: Source["access"] = ["member", "tech", "finance", "core", "advisor"];
const TECH: Source["access"] = ["tech", "core", "advisor"];
const FIN: Source["access"] = ["finance", "core", "advisor"];
const CORE: Source["access"] = ["core", "advisor"];

const commits = [
  ["2026-10-20", "Rohan Iyer", "Point telemetry back to MongoDB until Postgres migration is done"],
  ["2026-10-17", "Aarav Mehta", "Add LiDAR driver stub"],
  ["2026-10-14", "Aarav Mehta", "Refactor nav launch files for ROS 2 Humble"],
  ["2026-10-09", "Rohan Iyer", "Tune PID gains for TB6612 driver"],
  ["2026-10-06", "Aarav Mehta", "Add watchdog for motor brownout"],
  ["2026-10-01", "Aarav Mehta", "Telemetry: batch writes"],
  ["2026-09-27", "Ishaan Verma", "Update chassis dimensions in URDF"],
  ["2026-09-24", "Aarav Mehta", "Fix odometry frame ids"],
  ["2026-09-21", "Rohan Iyer", "Motor module: TB6612 support"],
  ["2026-09-18", "Aarav Mehta", "Bring up ROS 2 Humble workspace"],
  ["2026-09-15", "Aarav Mehta", "Remove custom nav stack"],
  ["2026-09-10", "Rohan Iyer", "Motor module: remove L298N code"],
  ["2026-09-05", "Aarav Mehta", "Telemetry dashboard API"],
  ["2026-09-02", "Aarav Mehta", "Telemetry schema draft"],
  ["2026-08-28", "Ishaan Verma", "Add sample-arm servo config"],
  ["2026-08-25", "Rohan Iyer", "Stall test script"],
  ["2026-08-20", "Aarav Mehta", "IMU calibration routine"],
  ["2026-08-14", "Aarav Mehta", "CI: build on push"],
  ["2026-08-10", "Rohan Iyer", "Initial motor control module"],
  ["2026-08-05", "Aarav Mehta", "Initial commit"],
].map(([date, author, message]) => ({ date, author, message }));

export const DEMO_SOURCES: Source[] = [
  {
    id: "gh-firmware",
    kind: "github",
    name: "GitHub · robocell/rover-firmware",
    description: "Code, issues and commit history of the rover.",
    access: TECH,
    items: [
      {
        id: "gh-readme",
        title: "README.md",
        author: "Aarav Mehta",
        date: "2026-09-18",
        text: "Rover firmware for RoboCell's autonomous rover. Built on ROS 2 Humble. Motor control lives in src/motors and telemetry in src/telemetry. Flash the Jetson with make flash.",
      },
      {
        id: "gh-dbconfig",
        title: "config/db.yaml",
        author: "Rohan Iyer",
        date: "2026-10-20",
        text: "telemetry:\n  driver: mongodb\n  uri: mongodb://localhost:27017/telemetry",
      },
      {
        id: "gh-issue-42",
        title: "Issue #42 · Rover resets when motors stall",
        author: "Rohan Iyer",
        date: "2026-08-25",
        text: "When both motors stall, the Jetson resets. It happened again at the September demo. Workaround: add a 1000 uF capacitor across the motor supply.",
        meta: { state: "open", assignee: null, labels: ["bug"] },
      },
      {
        id: "gh-issue-47",
        title: "Issue #47 · Tune PID for TB6612 driver",
        author: "Rohan Iyer",
        date: "2026-09-21",
        text: "Wheel speed overshoots after the driver change. Needs new PID gains.",
        meta: { state: "open", assignee: "Rohan Iyer", labels: ["motors"] },
      },
      {
        id: "gh-issue-51",
        title: "Issue #51 · Migrate telemetry to PostgreSQL",
        author: "Aarav Mehta",
        date: "2026-09-03",
        text: "Follow-up to the 2 Sep decision. Needs a schema design and a data migration script.",
        meta: { state: "open", assignee: null, labels: ["telemetry"] },
      },
      {
        id: "gh-commits",
        title: "Commit history (last 20)",
        author: "GitHub",
        date: "2026-10-20",
        text: commits.map((c) => `${c.date} ${c.author}: ${c.message}`).join("\n"),
        meta: { commits },
      },
    ],
  },
  {
    id: "drive-shared",
    kind: "drive",
    name: "Google Drive · RoboCell Shared",
    description: "Meeting notes and competition documents for all members.",
    access: ALL,
    items: [
      {
        id: "dr-notes-0812",
        title: "Meeting notes · 12 Aug 2026",
        author: "Aarav Mehta",
        date: "2026-08-12",
        text: "Attendees: Aarav, Rohan, Ishaan, Sneha.\nDecision: Switch the rover motor driver from L298N to TB6612FNG.\nAction: Rohan Iyer to rewrite the motor control module by 30 August 2026.\nLab access after 8 pm requires Dr. Meera Rao's signed permission slip each semester.",
      },
      {
        id: "dr-notes-0902",
        title: "Meeting notes · 2 Sep 2026",
        author: "Aarav Mehta",
        date: "2026-09-02",
        text: "Attendees: Aarav, Rohan, Priya, Ishaan.\nDecision: Move telemetry storage from MongoDB to PostgreSQL because the dashboard needs SQL joins.\nAction: Aarav Mehta to write the National Rover Challenge design report.\nThe workshop 3D printer is managed by Mr. Suresh Pillai; contact him for printer access.",
      },
      {
        id: "dr-brief",
        title: "National Rover Challenge 2027 · Brief",
        author: "Ishaan Verma",
        date: "2026-07-30",
        text: "The rover must autonomously navigate a 50 m course and return soil samples.\nDesign report submission deadline: 15 January 2027.\nFinal round on campus: 20 February 2027.\nTeams must register at least one faculty mentor.",
      },
    ],
  },
  {
    id: "drive-finance",
    kind: "drive",
    name: "Google Drive · RoboCell Finance",
    description: "Sponsor agreement and budget. Treasurer, core team and advisor only.",
    access: FIN,
    items: [
      {
        id: "dr-sponsor",
        title: "Sponsor agreement · Zentrix Robotics",
        author: "Sneha Kulkarni",
        date: "2026-06-15",
        text: "Zentrix Robotics will sponsor RoboCell with Rs 40,000 for the 2026-27 season.\nSponsor contact: Vikram Desai, Partnerships Manager (vikram.desai@zentrix.example).\nRoboCell must submit a sponsor progress report by 10 December 2026.\nThe Zentrix logo must appear on the rover and on the design report.",
      },
      {
        id: "dr-budget",
        title: "Budget 2026-27",
        author: "Sneha Kulkarni",
        date: "2026-09-05",
        text: "Total budget: Rs 65,000 (Rs 40,000 sponsor grant and Rs 25,000 college fund).\nDecision: Use Rs 28,000 of the sponsor grant for a LiDAR sensor.\nSpent so far: Rs 21,500 on motors, batteries and chassis.\nCollege fund reimbursements require bills within 30 days of purchase.",
      },
    ],
  },
  {
    id: "discord-general",
    kind: "discord",
    name: "Discord export · #general",
    description: "Club-wide announcements.",
    access: ALL,
    items: [
      {
        id: "dc-g-1",
        title: "#general · Ishaan Verma",
        author: "Ishaan Verma",
        date: "2026-09-20",
        text: "Workshop is closed on Sundays, plan your prints before Saturday evening.",
      },
      {
        id: "dc-g-2",
        title: "#general · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-10-28",
        text: "Heads up everyone: the design report deadline has moved to 22 January 2027.",
      },
      {
        id: "dc-g-3",
        title: "#general · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-10-30",
        text: "I'm leaving RoboCell in December for my internship. Priya will take over as tech lead and Kabir as treasurer.",
      },
    ],
  },
  {
    id: "discord-tech",
    kind: "discord",
    name: "Discord export · #tech",
    description: "Technical discussion. Tech team, core team and advisor.",
    access: TECH,
    items: [
      {
        id: "dc-t-1",
        title: "#tech · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-09-15",
        text: "We decided to use ROS 2 Humble instead of writing our own navigation stack, because we can reuse open-source SLAM.",
      },
      {
        id: "dc-t-2",
        title: "#tech · Rohan Iyer",
        author: "Rohan Iyer",
        date: "2026-09-28",
        text: "The 3D printer nozzle clogged again. Use the 0.6 mm nozzle for PETG, it keeps jamming with 0.4 mm.",
      },
      {
        id: "dc-t-3",
        title: "#tech · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-10-05",
        text: "Navigation testing is blocked until the LiDAR arrives.",
      },
      {
        id: "dc-t-4",
        title: "#tech · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-10-12",
        text: "For deploys, the Vercel dashboard login is robocell.club@example.com, password: Rc#2025rover",
      },
      {
        id: "dc-t-5",
        title: "#tech · Rohan Iyer",
        author: "Rohan Iyer",
        date: "2026-10-20",
        text: "The rover reset again during the stall test. Same brownout issue as issue #42.",
      },
    ],
  },
  {
    id: "discord-core",
    kind: "discord",
    name: "Discord export · #core-private",
    description: "Private core-team channel. Confidential.",
    access: CORE,
    confidential: true,
    items: [
      {
        id: "dc-c-1",
        title: "#core-private · Sneha Kulkarni",
        author: "Sneha Kulkarni",
        date: "2026-10-18",
        text: "Confidential: we agreed not to renew Dev's membership after the lab incident. Keep this within core.",
      },
      {
        id: "dc-c-2",
        title: "#core-private · Aarav Mehta",
        author: "Aarav Mehta",
        date: "2026-10-22",
        text: "Core only: the college may cut our fund next year if the sponsor report is late.",
      },
    ],
  },
  {
    id: "trello",
    kind: "trello",
    name: "Trello · RoboCell Season 2026-27",
    description: "Task board for all members.",
    access: ALL,
    items: [
      {
        id: "tr-1",
        title: "Write design report",
        author: "Aarav Mehta",
        date: "2026-09-02",
        text: "Card: Write design report. List: In progress. Assignee: Aarav Mehta. Due: 15 January 2027.",
        meta: { assignee: "Aarav Mehta", due: "2027-01-15", list: "In progress" },
      },
      {
        id: "tr-2",
        title: "Build battery charging station",
        author: "Ishaan Verma",
        date: "2026-09-10",
        text: "Card: Build battery charging station. List: To do. Assignee: none.",
        meta: { assignee: null, due: null, list: "To do" },
      },
      {
        id: "tr-3",
        title: "Order LiDAR sensor",
        author: "Sneha Kulkarni",
        date: "2026-09-06",
        text: "Card: Order LiDAR sensor. List: In progress. Assignee: Sneha Kulkarni. Due: 20 November 2026.",
        meta: { assignee: "Sneha Kulkarni", due: "2026-11-20", list: "In progress" },
      },
      {
        id: "tr-4",
        title: "Fix IMU drift in odometry",
        author: "Rohan Iyer",
        date: "2026-10-01",
        text: "Card: Fix IMU drift in odometry. List: In progress. Assignee: Rohan Iyer. Due: 5 December 2026.",
        meta: { assignee: "Rohan Iyer", due: "2026-12-05", list: "In progress" },
      },
      {
        id: "tr-5",
        title: "Submit sponsor progress report",
        author: "Aarav Mehta",
        date: "2026-10-01",
        text: "Card: Submit sponsor progress report. List: To do. Assignee: Aarav Mehta. Due: 10 December 2026.",
        meta: { assignee: "Aarav Mehta", due: "2026-12-10", list: "To do" },
      },
    ],
  },
];
