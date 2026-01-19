import { PrismaClient, PaymentMode } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "crypto";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Password123";

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateEmployeeId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone(): string {
  const prefixes = [
    "98",
    "97",
    "96",
    "95",
    "94",
    "93",
    "91",
    "90",
    "89",
    "88",
    "87",
    "86",
    "85",
    "84",
    "83",
    "82",
    "81",
    "80",
    "79",
    "78",
    "77",
    "76",
    "75",
    "74",
    "73",
    "72",
    "71",
    "70",
  ];
  return randomElement(prefixes) + Math.random().toString().slice(2, 10);
}

function logStep(step: number, total: number, message: string) {
  console.log(`   [${step}/${total}] ${message}`);
}

// ============================================
// INDIAN NAMES DATASET
// ============================================

const FIRST_NAMES_MALE = [
  "Aarav",
  "Arjun",
  "Vihaan",
  "Aditya",
  "Sai",
  "Ayaan",
  "Krishna",
  "Ishaan",
  "Reyansh",
  "Kabir",
  "Vivaan",
  "Shivansh",
  "Dhruv",
  "Harsh",
  "Ansh",
  "Rudra",
  "Atharv",
  "Aryan",
  "Advait",
  "Shaurya",
  "Dev",
  "Karan",
  "Rahul",
  "Amit",
  "Rohan",
  "Vikram",
  "Raj",
  "Yash",
  "Nikhil",
  "Varun",
  "Siddharth",
  "Aakash",
  "Pranav",
  "Surya",
  "Karthik",
  "Vijay",
  "Ajay",
  "Arun",
  "Ganesh",
  "Harish",
  "Sourav",
  "Arnab",
  "Debashish",
  "Partha",
  "Subhash",
  "Animesh",
  "Dipankar",
  "Joydeep",
  "Kaushik",
  "Prosenjit",
];

const FIRST_NAMES_FEMALE = [
  "Ananya",
  "Diya",
  "Myra",
  "Amaira",
  "Pari",
  "Saanvi",
  "Kiara",
  "Avni",
  "Aadhya",
  "Kavya",
  "Navya",
  "Prisha",
  "Anika",
  "Ishita",
  "Anvi",
  "Aaradhya",
  "Ridhi",
  "Siya",
  "Riya",
  "Shreya",
  "Priya",
  "Neha",
  "Pooja",
  "Anjali",
  "Meera",
  "Sneha",
  "Kritika",
  "Tanya",
  "Nisha",
  "Swati",
  "Lakshmi",
  "Divya",
  "Deepa",
  "Preethi",
  "Sindhu",
  "Swetha",
  "Padma",
  "Gayathri",
  "Bhavani",
  "Vaishnavi",
  "Aparajita",
  "Dipannita",
  "Rituparna",
  "Swastika",
  "Paoli",
  "Raima",
  "Rupa",
  "Tanushree",
  "Ankita",
  "Payel",
];

const LAST_NAMES = [
  "Sharma",
  "Gupta",
  "Singh",
  "Kumar",
  "Verma",
  "Joshi",
  "Agarwal",
  "Tiwari",
  "Pandey",
  "Mishra",
  "Chauhan",
  "Yadav",
  "Saxena",
  "Srivastava",
  "Tripathi",
  "Dubey",
  "Shukla",
  "Awasthi",
  "Pathak",
  "Chaudhary",
  "Iyer",
  "Rao",
  "Reddy",
  "Nair",
  "Menon",
  "Pillai",
  "Krishnan",
  "Subramaniam",
  "Venkataraman",
  "Raghavan",
  "Patel",
  "Shah",
  "Mehta",
  "Desai",
  "Jain",
  "Parikh",
  "Trivedi",
  "Modi",
  "Gandhi",
  "Parekh",
  "Banerjee",
  "Chatterjee",
  "Mukherjee",
  "Roy",
  "Das",
  "Sen",
  "Bose",
  "Dutta",
  "Ghosh",
  "Chakraborty",
];

const CATEGORIES: string[] = ["gen", "obc", "sc", "st", "ews"];
const PAYMENT_MODES: PaymentMode[] = ["cash", "upi", "bank"];

// ============================================
// ORGANIZATION DEFINITIONS
// ============================================

interface OrgDefinition {
  name: string;
  type: "school" | "coaching";
  branches: BranchDefinition[];
  subjects: SubjectDefinition[];
}

interface BranchDefinition {
  name: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
}

interface SubjectDefinition {
  name: string;
  code: string;
}

const SCHOOL_SUBJECTS: SubjectDefinition[] = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Hindi", code: "HIN" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SST" },
  { name: "Physics", code: "PHY" },
  { name: "Chemistry", code: "CHEM" },
  { name: "Biology", code: "BIO" },
  { name: "Computer Science", code: "CS" },
  { name: "Physical Education", code: "PE" },
];

const IIT_JEE_SUBJECTS: SubjectDefinition[] = [
  { name: "Physics", code: "PHY" },
  { name: "Chemistry (Organic)", code: "CHO" },
  { name: "Chemistry (Inorganic)", code: "CHI" },
  { name: "Chemistry (Physical)", code: "CHP" },
  { name: "Mathematics (Algebra)", code: "MALG" },
  { name: "Mathematics (Calculus)", code: "MCAL" },
  { name: "Mathematics (Coordinate)", code: "MCOR" },
  { name: "Problem Solving", code: "PS" },
  { name: "Mock Tests", code: "MT" },
  { name: "Doubt Clearing", code: "DC" },
];

const IAS_SUBJECTS: SubjectDefinition[] = [
  { name: "Indian Polity", code: "POL" },
  { name: "Indian Economy", code: "ECO" },
  { name: "Geography", code: "GEO" },
  { name: "History (Ancient)", code: "HANC" },
  { name: "History (Medieval)", code: "HMED" },
  { name: "History (Modern)", code: "HMOD" },
  { name: "Current Affairs", code: "CA" },
  { name: "Ethics & Integrity", code: "ETH" },
  { name: "Essay Writing", code: "ESS" },
  { name: "CSAT", code: "CSAT" },
];

const PROFESSIONAL_SUBJECTS: SubjectDefinition[] = [
  { name: "Accounting", code: "ACC" },
  { name: "Business Law", code: "BLAW" },
  { name: "Economics", code: "ECO" },
  { name: "Financial Management", code: "FM" },
  { name: "Auditing", code: "AUD" },
  { name: "Taxation", code: "TAX" },
  { name: "Company Law", code: "CLAW" },
  { name: "Cost Accounting", code: "COST" },
  { name: "Banking & Finance", code: "BF" },
  { name: "Quantitative Aptitude", code: "QA" },
];

const ORGANIZATIONS: OrgDefinition[] = [
  // Schools (3 branches each)
  {
    name: "Delhi Public School",
    type: "school",
    subjects: SCHOOL_SUBJECTS,
    branches: [
      {
        name: "Rohini Campus",
        city: "Delhi",
        state: "Delhi",
        pincode: "110085",
        address: "Sector 14, Rohini",
      },
      {
        name: "Noida Campus",
        city: "Noida",
        state: "Uttar Pradesh",
        pincode: "201301",
        address: "Sector 62, Noida",
      },
      {
        name: "Gurgaon Campus",
        city: "Gurgaon",
        state: "Haryana",
        pincode: "122001",
        address: "DLF Phase 4",
      },
    ],
  },
  {
    name: "Kendriya Vidyalaya",
    type: "school",
    subjects: SCHOOL_SUBJECTS,
    branches: [
      {
        name: "RK Puram",
        city: "Delhi",
        state: "Delhi",
        pincode: "110022",
        address: "Sector 4, RK Puram",
      },
      {
        name: "Pune Cantonment",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        address: "Pune Cantonment Area",
      },
      {
        name: "Bangalore ASC",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560007",
        address: "ASC Centre, Bangalore",
      },
    ],
  },
  {
    name: "St. Mary's Convent School",
    type: "school",
    subjects: SCHOOL_SUBJECTS,
    branches: [
      {
        name: "Andheri Campus",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400058",
        address: "Andheri East",
      },
      {
        name: "Thane Campus",
        city: "Thane",
        state: "Maharashtra",
        pincode: "400601",
        address: "Thane West",
      },
      {
        name: "Navi Mumbai Campus",
        city: "Navi Mumbai",
        state: "Maharashtra",
        pincode: "400706",
        address: "Vashi",
      },
    ],
  },
  // Coaching Centers (5 branches each)
  {
    name: "Kota IIT Academy",
    type: "coaching",
    subjects: IIT_JEE_SUBJECTS,
    branches: [
      {
        name: "Kota Main",
        city: "Kota",
        state: "Rajasthan",
        pincode: "324001",
        address: "Vigyan Nagar",
      },
      {
        name: "Delhi Centre",
        city: "Delhi",
        state: "Delhi",
        pincode: "110034",
        address: "Mukherjee Nagar",
      },
      {
        name: "Jaipur Centre",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302001",
        address: "C-Scheme",
      },
      {
        name: "Mumbai Centre",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        address: "Fort",
      },
      {
        name: "Hyderabad Centre",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500034",
        address: "Kukatpally",
      },
    ],
  },
  {
    name: "Vision IAS Institute",
    type: "coaching",
    subjects: IAS_SUBJECTS,
    branches: [
      {
        name: "Old Rajender Nagar",
        city: "Delhi",
        state: "Delhi",
        pincode: "110060",
        address: "25/1, Rajender Nagar",
      },
      {
        name: "Bangalore Centre",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560001",
        address: "MG Road",
      },
      {
        name: "Hyderabad Centre",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500029",
        address: "Ashok Nagar",
      },
      {
        name: "Pune Centre",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411004",
        address: "FC Road",
      },
      {
        name: "Chennai Centre",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600017",
        address: "T Nagar",
      },
    ],
  },
  {
    name: "Career Launcher Academy",
    type: "coaching",
    subjects: PROFESSIONAL_SUBJECTS,
    branches: [
      {
        name: "Connaught Place",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        address: "Connaught Place",
      },
      {
        name: "Dadar Centre",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400028",
        address: "Dadar West",
      },
      {
        name: "Salt Lake Centre",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700091",
        address: "Salt Lake Sector V",
      },
      {
        name: "Anna Nagar Centre",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600040",
        address: "Anna Nagar",
      },
      {
        name: "Koramangala Centre",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560034",
        address: "Koramangala",
      },
    ],
  },
];

// ============================================
// BATCH DEFINITIONS (REDUCED FOR PERFORMANCE)
// ============================================

interface SchoolBatchDef {
  classNumber: number;
  section: string;
  academicLevel: string;
  stream?: string;
}

interface CoachingBatchDef {
  name: string;
  academicLevel: string;
  stream?: string;
}

function getSchoolBatches(hasTwoSections: boolean): SchoolBatchDef[] {
  const sections = hasTwoSections ? ["A", "B"] : ["A"];
  const batches: SchoolBatchDef[] = [];

  // Primary (Class 1-5)
  for (let cls = 1; cls <= 5; cls++) {
    for (const section of sections) {
      batches.push({ classNumber: cls, section, academicLevel: "primary" });
    }
  }

  // Middle School (Class 6-8)
  for (let cls = 6; cls <= 8; cls++) {
    for (const section of sections) {
      batches.push({ classNumber: cls, section, academicLevel: "middle" });
    }
  }

  // Secondary (Class 9-10)
  for (let cls = 9; cls <= 10; cls++) {
    for (const section of sections) {
      batches.push({ classNumber: cls, section, academicLevel: "secondary" });
    }
  }

  // Senior Secondary (Class 11-12) with streams
  for (let cls = 11; cls <= 12; cls++) {
    batches.push({
      classNumber: cls,
      section: "A",
      academicLevel: "senior_secondary",
      stream: "science",
    });
    batches.push({
      classNumber: cls,
      section: "B",
      academicLevel: "senior_secondary",
      stream: "commerce",
    });
    batches.push({
      classNumber: cls,
      section: "C",
      academicLevel: "senior_secondary",
      stream: "arts",
    });
  }

  return batches;
}

function getIITBatches(): CoachingBatchDef[] {
  return [
    {
      name: "Foundation (Class 9-10)",
      academicLevel: "secondary",
      stream: "science",
    },
    {
      name: "Target JEE (Class 11)",
      academicLevel: "senior_secondary",
      stream: "science",
    },
    {
      name: "Target JEE (Class 12)",
      academicLevel: "senior_secondary",
      stream: "science",
    },
    { name: "Dropper Batch", academicLevel: "coaching", stream: "science" },
    { name: "NEET Foundation", academicLevel: "secondary", stream: "science" },
    {
      name: "Target NEET (Class 12)",
      academicLevel: "senior_secondary",
      stream: "science",
    },
  ];
}

function getIASBatches(): CoachingBatchDef[] {
  return [
    { name: "Prelims Foundation", academicLevel: "coaching" },
    { name: "Mains Batch", academicLevel: "coaching" },
    { name: "Optional: PSIR", academicLevel: "coaching" },
    { name: "Test Series - Prelims", academicLevel: "coaching" },
  ];
}

function getProfessionalBatches(): CoachingBatchDef[] {
  return [
    { name: "CA Foundation", academicLevel: "coaching", stream: "commerce" },
    { name: "CA Intermediate", academicLevel: "coaching", stream: "commerce" },
    { name: "GATE - CSE", academicLevel: "coaching", stream: "science" },
    { name: "Bank PO Preparation", academicLevel: "coaching" },
  ];
}

// ============================================
// FEE STRUCTURE
// ============================================

function getFeeForBatch(
  academicLevel: string,
  isSchool: boolean,
  orgName: string
): number {
  const isPremium =
    orgName.includes("Delhi Public") || orgName.includes("St. Mary");
  const multiplier = isPremium ? 1.5 : 1;

  if (isSchool) {
    switch (academicLevel) {
      case "primary":
        return Math.round(randomInt(2000, 4000) * multiplier);
      case "middle":
        return Math.round(randomInt(3000, 5000) * multiplier);
      case "secondary":
        return Math.round(randomInt(4000, 6000) * multiplier);
      case "senior_secondary":
        return Math.round(randomInt(5000, 8000) * multiplier);
      default:
        return 3500;
    }
  } else {
    if (orgName.includes("Kota IIT")) return randomInt(8000, 15000);
    if (orgName.includes("Vision IAS")) return randomInt(12000, 25000);
    return randomInt(5000, 12000);
  }
}

// ============================================
// PERIOD TEMPLATE
// ============================================

interface SlotDef {
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  breakName?: string;
}

const DEFAULT_SLOTS: SlotDef[] = [
  { periodNumber: 1, startTime: "08:00", endTime: "08:45", isBreak: false },
  { periodNumber: 2, startTime: "08:45", endTime: "09:30", isBreak: false },
  { periodNumber: 3, startTime: "09:30", endTime: "10:15", isBreak: false },
  {
    periodNumber: 0,
    startTime: "10:15",
    endTime: "10:30",
    isBreak: true,
    breakName: "Short Break",
  },
  { periodNumber: 4, startTime: "10:30", endTime: "11:15", isBreak: false },
  { periodNumber: 5, startTime: "11:15", endTime: "12:00", isBreak: false },
  {
    periodNumber: 0,
    startTime: "12:00",
    endTime: "12:45",
    isBreak: true,
    breakName: "Lunch Break",
  },
  { periodNumber: 6, startTime: "12:45", endTime: "13:30", isBreak: false },
  { periodNumber: 7, startTime: "13:30", endTime: "14:15", isBreak: false },
  { periodNumber: 8, startTime: "14:15", endTime: "15:00", isBreak: false },
];

// ============================================
// CLEANUP FUNCTION
// ============================================

async function safeDeleteMany(
  model: { deleteMany: () => Promise<unknown> },
  name: string
) {
  try {
    await model.deleteMany();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2021"
    ) {
      console.log(`   ⚠ Table ${name} doesn't exist, skipping...`);
    } else {
      throw error;
    }
  }
}

async function cleanDatabase() {
  console.log("🧹 Cleaning existing data...");

  await safeDeleteMany(prisma.notificationLog, "NotificationLog");
  await safeDeleteMany(prisma.messageTemplate, "MessageTemplate");
  await safeDeleteMany(prisma.event, "Event");
  await safeDeleteMany(prisma.feePayment, "FeePayment");
  await safeDeleteMany(prisma.studentFee, "StudentFee");
  await safeDeleteMany(prisma.feePlan, "FeePlan");
  await safeDeleteMany(prisma.attendanceRecord, "AttendanceRecord");
  await safeDeleteMany(prisma.attendanceSession, "AttendanceSession");
  await safeDeleteMany(prisma.period, "Period");
  await safeDeleteMany(prisma.periodTemplateSlot, "PeriodTemplateSlot");
  await safeDeleteMany(prisma.periodTemplate, "PeriodTemplate");
  await safeDeleteMany(prisma.subject, "Subject");
  await safeDeleteMany(prisma.studentParent, "StudentParent");
  await safeDeleteMany(prisma.parent, "Parent");
  await safeDeleteMany(prisma.student, "Student");
  await safeDeleteMany(prisma.batch, "Batch");
  await safeDeleteMany(prisma.academicSession, "AcademicSession");
  await safeDeleteMany(prisma.user, "User");
  await safeDeleteMany(prisma.branch, "Branch");
  await safeDeleteMany(prisma.organization, "Organization");

  console.log("   ✓ Database cleaned\n");
}

// ============================================
// TYPES
// ============================================

interface CreatedOrg {
  id: string;
  name: string;
  type: string;
  definition: OrgDefinition;
}

interface CreatedBranch {
  id: string;
  orgId: string;
  name: string;
  isDefault: boolean;
  orgName: string;
  orgType: string;
}

interface CreatedSession {
  id: string;
  orgId: string;
  name: string;
  isCurrent: boolean;
}

interface CreatedUser {
  id: string;
  orgId: string;
  branchId: string;
  employeeId: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface CreatedBatch {
  id: string;
  orgId: string;
  branchId: string;
  sessionId: string | null;
  name: string;
  academicLevel: string;
  stream: string | null;
  classTeacherId: string | null;
  feePlanId?: string;
  orgName: string;
  isSchool: boolean;
}

interface StudentWithParent {
  studentId: string;
  parentId: string;
  orgId: string;
  branchId: string;
  batchId: string;
  lastName: string;
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  const startTime = Date.now();
  console.log("🌱 Starting optimized Indian education seed...\n");
  console.log("=".repeat(60));

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
  const TOTAL_STEPS = 12;

  // Phase 1: Cleanup
  await cleanDatabase();

  // Phase 2: Organizations & Branches
  logStep(1, TOTAL_STEPS, "Creating organizations and branches...");
  const orgs: CreatedOrg[] = [];
  const branches: CreatedBranch[] = [];

  for (const orgDef of ORGANIZATIONS) {
    const org = await prisma.organization.create({
      data: {
        name: orgDef.name,
        type: orgDef.type,
        language: "en",
        timezone: "Asia/Kolkata",
      },
    });

    orgs.push({
      id: org.id,
      name: org.name,
      type: org.type,
      definition: orgDef,
    });

    for (let i = 0; i < orgDef.branches.length; i++) {
      const branchDef = orgDef.branches[i];
      const branch = await prisma.branch.create({
        data: {
          orgId: org.id,
          name: branchDef.name,
          address: branchDef.address,
          city: branchDef.city,
          state: branchDef.state,
          pincode: branchDef.pincode,
          isDefault: i === 0,
        },
      });

      branches.push({
        id: branch.id,
        orgId: org.id,
        name: branch.name,
        isDefault: branch.isDefault,
        orgName: org.name,
        orgType: org.type,
      });
    }
  }
  console.log(
    `       ✓ ${orgs.length} organizations, ${branches.length} branches`
  );

  // Phase 3: Academic Sessions
  logStep(2, TOTAL_STEPS, "Creating academic sessions...");
  const sessions: CreatedSession[] = [];
  const sessionYears = ["2023-24", "2024-25", "2025-26"];

  for (const org of orgs) {
    for (let i = 0; i < sessionYears.length; i++) {
      const year = sessionYears[i];
      const startYear = parseInt(year.split("-")[0]);
      const session = await prisma.academicSession.create({
        data: {
          orgId: org.id,
          name: year,
          startDate: new Date(startYear, 3, 1),
          endDate: new Date(startYear + 1, 2, 31),
          isCurrent: i === sessionYears.length - 1,
        },
      });
      sessions.push({
        id: session.id,
        orgId: org.id,
        name: session.name,
        isCurrent: session.isCurrent,
      });
    }
  }
  console.log(`       ✓ ${sessions.length} academic sessions`);

  // Phase 4: Subjects (bulk)
  logStep(3, TOTAL_STEPS, "Creating subjects...");
  for (const org of orgs) {
    await prisma.subject.createMany({
      data: org.definition.subjects.map((s) => ({
        orgId: org.id,
        name: s.name,
        code: s.code,
        isActive: true,
      })),
    });
  }
  console.log(`       ✓ Subjects created for ${orgs.length} organizations`);

  // Phase 5: Period Templates (bulk)
  logStep(4, TOTAL_STEPS, "Creating period templates...");
  for (const org of orgs) {
    const template = await prisma.periodTemplate.create({
      data: { orgId: org.id, name: "Default Schedule", isDefault: true },
    });

    let breakCounter = 100;
    await prisma.periodTemplateSlot.createMany({
      data: DEFAULT_SLOTS.map((slot) => ({
        templateId: template.id,
        periodNumber: slot.isBreak ? breakCounter++ : slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak,
        breakName: slot.breakName ?? null,
      })),
    });
  }
  console.log(`       ✓ Period templates created`);

  // Phase 6: Users (bulk per branch)
  logStep(5, TOTAL_STEPS, "Creating users...");
  const users: CreatedUser[] = [];
  const teachers: CreatedUser[] = [];
  const accountants: CreatedUser[] = [];

  for (const branch of branches) {
    const branchUsers: Array<{
      id: string;
      orgId: string;
      branchId: string;
      employeeId: string;
      passwordHash: string;
      mustChangePassword: boolean;
      firstName: string;
      lastName: string;
      phone: string;
      email: string | null;
      role: "admin" | "teacher" | "accounts" | "staff";
      isActive: boolean;
    }> = [];

    // Admin
    const adminId = randomUUID();
    branchUsers.push({
      id: adminId,
      orgId: branch.orgId,
      branchId: branch.id,
      employeeId: generateEmployeeId(),
      passwordHash,
      mustChangePassword: true,
      firstName: randomElement(FIRST_NAMES_MALE),
      lastName: randomElement(LAST_NAMES),
      phone: generatePhone(),
      email: `admin.${branch.name
        .toLowerCase()
        .replace(/\s+/g, ".")}@example.com`,
      role: "admin",
      isActive: true,
    });

    // 3-4 Teachers
    const teacherCount = randomInt(3, 4);
    for (let i = 0; i < teacherCount; i++) {
      const isMale = Math.random() > 0.4;
      const teacherId = randomUUID();
      branchUsers.push({
        id: teacherId,
        orgId: branch.orgId,
        branchId: branch.id,
        employeeId: generateEmployeeId(),
        passwordHash,
        mustChangePassword: true,
        firstName: randomElement(
          isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE
        ),
        lastName: randomElement(LAST_NAMES),
        phone: generatePhone(),
        email: null,
        role: "teacher",
        isActive: true,
      });
    }

    // Accountant
    const accountantId = randomUUID();
    branchUsers.push({
      id: accountantId,
      orgId: branch.orgId,
      branchId: branch.id,
      employeeId: generateEmployeeId(),
      passwordHash,
      mustChangePassword: true,
      firstName: randomElement(
        Math.random() > 0.5 ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE
      ),
      lastName: randomElement(LAST_NAMES),
      phone: generatePhone(),
      email: null,
      role: "accounts",
      isActive: true,
    });

    // Bulk insert users for this branch
    await prisma.user.createMany({ data: branchUsers });

    // Track users for later use
    for (const u of branchUsers) {
      const userRecord = {
        id: u.id,
        orgId: u.orgId,
        branchId: u.branchId,
        employeeId: u.employeeId,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
      };
      users.push(userRecord);
      if (u.role === "teacher") teachers.push(userRecord);
      if (u.role === "accounts") accountants.push(userRecord);
    }
  }
  console.log(`       ✓ ${users.length} users (${teachers.length} teachers)`);

  // Phase 7: Batches
  logStep(6, TOTAL_STEPS, "Creating batches...");
  const batches: CreatedBatch[] = [];

  for (const branch of branches) {
    const org = orgs.find((o) => o.id === branch.orgId)!;
    const currentSession = sessions.find(
      (s) => s.orgId === org.id && s.isCurrent
    )!;
    const branchTeachers = teachers.filter((t) => t.branchId === branch.id);

    const isSchool = org.type === "school";
    let batchDefs: { name: string; academicLevel: string; stream?: string }[] =
      [];

    if (isSchool) {
      const hasTwoSections = org.name.includes("Delhi Public");
      const schoolBatches = getSchoolBatches(hasTwoSections);
      batchDefs = schoolBatches.map((b) => ({
        name: `Class ${b.classNumber}-${b.section}${
          b.stream ? ` (${b.stream})` : ""
        }`,
        academicLevel: b.academicLevel,
        stream: b.stream,
      }));
    } else if (org.name.includes("Kota IIT")) {
      batchDefs = getIITBatches();
    } else if (org.name.includes("Vision IAS")) {
      batchDefs = getIASBatches();
    } else {
      batchDefs = getProfessionalBatches();
    }

    // Prepare batch data for bulk insert
    const batchData = batchDefs.map((def) => {
      const classTeacher =
        branchTeachers.length > 0 ? randomElement(branchTeachers) : null;
      return {
        id: randomUUID(),
        orgId: org.id,
        branchId: branch.id,
        sessionId: currentSession.id,
        name: def.name,
        academicLevel: def.academicLevel,
        stream: def.stream ?? null,
        classTeacherId: classTeacher?.id ?? null,
        isActive: true,
      };
    });

    await prisma.batch.createMany({ data: batchData });

    // Track batches
    for (const b of batchData) {
      batches.push({
        id: b.id,
        orgId: b.orgId,
        branchId: b.branchId,
        sessionId: b.sessionId,
        name: b.name,
        academicLevel: b.academicLevel,
        stream: b.stream,
        classTeacherId: b.classTeacherId,
        orgName: org.name,
        isSchool,
      });
    }
  }
  console.log(`       ✓ ${batches.length} batches`);

  // Phase 8: Fee Plans (bulk)
  logStep(7, TOTAL_STEPS, "Creating fee plans...");
  const feePlanData = batches.map((batch) => ({
    id: randomUUID(),
    orgId: batch.orgId,
    branchId: batch.branchId,
    name: `Fee - ${batch.name}`,
    amount: getFeeForBatch(batch.academicLevel, batch.isSchool, batch.orgName),
    frequency: "monthly" as const,
    isActive: true,
  }));

  await prisma.feePlan.createMany({ data: feePlanData });

  // Map fee plans to batches
  const feePlanMap = new Map<string, { id: string; amount: number }>();
  for (let i = 0; i < batches.length; i++) {
    batches[i].feePlanId = feePlanData[i].id;
    feePlanMap.set(batches[i].id, {
      id: feePlanData[i].id,
      amount: feePlanData[i].amount,
    });
  }
  console.log(`       ✓ ${feePlanData.length} fee plans`);

  // Phase 9: Students & Parents (BULK - the main optimization)
  logStep(8, TOTAL_STEPS, "Creating students and parents (bulk)...");

  // Pre-generate ALL student and parent data
  const allStudentData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    batchId: string;
    firstName: string;
    lastName: string;
    gender: string;
    dob: Date;
    category: string;
    admissionYear: number;
    status: "active";
  }> = [];

  const allParentData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    firstName: string;
    lastName: string;
    phone: string;
  }> = [];

  const studentParentLinks: StudentWithParent[] = [];

  for (const batch of batches) {
    // REDUCED student counts for moderate data volume
    const studentCount = batch.isSchool ? randomInt(5, 8) : randomInt(10, 15);

    for (let i = 0; i < studentCount; i++) {
      const isMale = Math.random() > 0.5;
      const lastName = randomElement(LAST_NAMES);
      const dobYear = batch.isSchool
        ? randomInt(2006, 2018)
        : randomInt(1998, 2007);

      const studentId = randomUUID();
      const parentId = randomUUID();

      allStudentData.push({
        id: studentId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        batchId: batch.id,
        firstName: randomElement(
          isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE
        ),
        lastName,
        gender: isMale ? "male" : "female",
        dob: new Date(dobYear, randomInt(0, 11), randomInt(1, 28)),
        category: randomElement(CATEGORIES),
        admissionYear: randomInt(2022, 2025),
        status: "active",
      });

      allParentData.push({
        id: parentId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        firstName: randomElement(FIRST_NAMES_MALE),
        lastName,
        phone: generatePhone(),
      });

      studentParentLinks.push({
        studentId,
        parentId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        batchId: batch.id,
        lastName,
      });
    }
  }

  // Bulk insert students
  await prisma.student.createMany({ data: allStudentData });
  console.log(`       ✓ ${allStudentData.length} students`);

  // Bulk insert parents
  await prisma.parent.createMany({ data: allParentData });
  console.log(`       ✓ ${allParentData.length} parents`);

  // Bulk insert student-parent links
  logStep(9, TOTAL_STEPS, "Creating student-parent links (bulk)...");
  await prisma.studentParent.createMany({
    data: studentParentLinks.map((link) => ({
      studentId: link.studentId,
      parentId: link.parentId,
      relation: "father",
    })),
  });
  console.log(`       ✓ ${studentParentLinks.length} links`);

  // Phase 10: Fees & Payments (BULK)
  logStep(10, TOTAL_STEPS, "Creating fees and payments (bulk)...");
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 10);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 10);

  const allFeeData: Array<{
    id: string;
    studentId: string;
    feePlanId: string;
    totalAmount: number;
    paidAmount: number;
    dueDate: Date;
    status: "paid" | "partial" | "pending";
  }> = [];

  const allPaymentData: Array<{
    studentFeeId: string;
    amount: number;
    paymentMode: PaymentMode;
    receivedById: string;
    receivedAt: Date;
  }> = [];

  for (const link of studentParentLinks) {
    const feePlan = feePlanMap.get(link.batchId);
    if (!feePlan) continue;

    const accountant = accountants.find((a) => a.branchId === link.branchId);
    if (!accountant) continue;

    // Last month fee
    const lastMonthPaid = Math.random() < 0.85;
    const lastMonthPartial = !lastMonthPaid && Math.random() < 0.4;
    const lastMonthPaidAmount = lastMonthPaid
      ? feePlan.amount
      : lastMonthPartial
      ? Math.floor(feePlan.amount * 0.5)
      : 0;

    const lastMonthFeeId = randomUUID();
    allFeeData.push({
      id: lastMonthFeeId,
      studentId: link.studentId,
      feePlanId: feePlan.id,
      totalAmount: feePlan.amount,
      paidAmount: lastMonthPaidAmount,
      dueDate: lastMonth,
      status: lastMonthPaid ? "paid" : lastMonthPartial ? "partial" : "pending",
    });

    if (lastMonthPaidAmount > 0) {
      allPaymentData.push({
        studentFeeId: lastMonthFeeId,
        amount: lastMonthPaidAmount,
        paymentMode: randomElement(PAYMENT_MODES),
        receivedById: accountant.id,
        receivedAt: new Date(
          lastMonth.getTime() + randomInt(1, 15) * 24 * 60 * 60 * 1000
        ),
      });
    }

    // This month fee
    const thisMonthPaid = Math.random() < 0.5;
    const thisMonthPaidAmount = thisMonthPaid ? feePlan.amount : 0;

    const thisMonthFeeId = randomUUID();
    allFeeData.push({
      id: thisMonthFeeId,
      studentId: link.studentId,
      feePlanId: feePlan.id,
      totalAmount: feePlan.amount,
      paidAmount: thisMonthPaidAmount,
      dueDate: thisMonth,
      status: thisMonthPaid ? "paid" : "pending",
    });

    if (thisMonthPaidAmount > 0) {
      allPaymentData.push({
        studentFeeId: thisMonthFeeId,
        amount: thisMonthPaidAmount,
        paymentMode: randomElement(PAYMENT_MODES),
        receivedById: accountant.id,
        receivedAt: new Date(
          thisMonth.getTime() + randomInt(0, 10) * 24 * 60 * 60 * 1000
        ),
      });
    }
  }

  // Bulk insert fees and payments
  await prisma.studentFee.createMany({ data: allFeeData });
  console.log(`       ✓ ${allFeeData.length} fee records`);

  await prisma.feePayment.createMany({ data: allPaymentData });
  console.log(`       ✓ ${allPaymentData.length} payments`);

  // Phase 11: Attendance (bulk, limited to 10 days)
  logStep(11, TOTAL_STEPS, "Creating attendance (bulk, last 10 days)...");

  const currentMonthDates: Date[] = [];
  for (let d = 0; d < 10; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (date.getDay() !== 0)
      currentMonthDates.push(new Date(date.setHours(0, 0, 0, 0)));
  }

  // Sample 30 batches for attendance
  const sampledBatches = batches.slice(0, 30);
  let attendanceSessionCount = 0;
  let attendanceRecordCount = 0;

  for (const batch of sampledBatches) {
    const batchStudents = studentParentLinks.filter(
      (s) => s.batchId === batch.id
    );
    if (batchStudents.length === 0) continue;

    const branchTeachers = teachers.filter(
      (t) => t.branchId === batch.branchId
    );
    const createdBy = batch.classTeacherId
      ? teachers.find((t) => t.id === batch.classTeacherId)
      : branchTeachers[0];
    if (!createdBy) continue;

    for (const date of currentMonthDates) {
      try {
        const session = await prisma.attendanceSession.create({
          data: {
            orgId: batch.orgId,
            branchId: batch.branchId,
            batchId: batch.id,
            attendanceDate: date,
            createdById: createdBy.id,
          },
        });
        attendanceSessionCount++;

        const records = batchStudents.map((student) => ({
          attendanceSessionId: session.id,
          studentId: student.studentId,
          status:
            Math.random() < 0.9 ? ("present" as const) : ("absent" as const),
          markedAt: new Date(date.getTime() + 9 * 60 * 60 * 1000),
        }));

        await prisma.attendanceRecord.createMany({ data: records });
        attendanceRecordCount += records.length;
      } catch {
        continue;
      }
    }
  }
  console.log(
    `       ✓ ${attendanceSessionCount} sessions, ${attendanceRecordCount} records`
  );

  // Phase 12: Message Templates
  logStep(12, TOTAL_STEPS, "Creating message templates...");
  for (const org of orgs) {
    await prisma.messageTemplate.createMany({
      data: [
        {
          orgId: org.id,
          type: "absent",
          name: "Student Absent",
          content: `Dear Parent, {{studentName}} was absent on {{date}}. Please contact school for any queries. - ${org.name}`,
          isActive: true,
        },
        {
          orgId: org.id,
          type: "fee_due",
          name: "Fee Due",
          content: `Fee of ₹{{amount}} is due for {{studentName}} by {{dueDate}}. Please pay on time. - ${org.name}`,
          isActive: true,
        },
        {
          orgId: org.id,
          type: "fee_paid",
          name: "Fee Paid",
          content: `✓ Payment of ₹{{amount}} received for {{studentName}}. Thank you! - ${org.name}`,
          isActive: true,
        },
        {
          orgId: org.id,
          type: "fee_overdue",
          name: "Fee Overdue Alert",
          content: `⚠️ Fee of ₹{{amount}} is overdue for {{studentName}} (Due: {{dueDate}}). Please pay immediately. - ${org.name}`,
          isActive: true,
        },
        {
          orgId: org.id,
          type: "fee_reminder",
          name: "Fee Reminder",
          content: `Reminder: Fee of ₹{{amount}} for {{studentName}} is due in {{days}} days ({{dueDate}}). - ${org.name}`,
          isActive: true,
        },
        {
          orgId: org.id,
          type: "birthday",
          name: "Birthday Wishes",
          content: `🎂 Happy Birthday {{studentName}}! Wishing you a wonderful day. - ${org.name}`,
          isActive: true,
        },
      ],
    });
  }
  console.log(`       ✓ Message templates created`);

  // ============================================
  // SUMMARY
  // ============================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log(`✅ SEED COMPLETED in ${duration}s!`);
  console.log("=".repeat(60));

  console.log("\n📊 Summary:");
  console.log(`   Organizations: ${orgs.length}`);
  console.log(`   Branches: ${branches.length}`);
  console.log(`   Academic Sessions: ${sessions.length}`);
  console.log(`   Users: ${users.length} (${teachers.length} teachers)`);
  console.log(`   Batches: ${batches.length}`);
  console.log(`   Students: ${allStudentData.length}`);
  console.log(`   Parents: ${allParentData.length}`);
  console.log(`   Fee Plans: ${feePlanData.length}`);
  console.log(`   Fee Records: ${allFeeData.length}`);
  console.log(`   Payments: ${allPaymentData.length}`);
  console.log(`   Attendance Sessions: ${attendanceSessionCount}`);
  console.log(`   Attendance Records: ${attendanceRecordCount}`);

  console.log(`\n🔑 Test Credentials (Password: ${DEFAULT_PASSWORD}):`);
  console.log("-".repeat(60));

  for (const org of orgs.slice(0, 3)) {
    console.log(`\n   📌 ${org.name} (${org.type})`);
    const orgBranches = branches.filter((b) => b.orgId === org.id);
    for (const branch of orgBranches.slice(0, 1)) {
      console.log(`      🏢 ${branch.name}`);
      const branchUsers = users.filter((u) => u.branchId === branch.id);
      for (const user of branchUsers.slice(0, 2)) {
        console.log(
          `         ${user.employeeId} | ${user.role.padEnd(8)} | ${
            user.firstName
          } ${user.lastName}`
        );
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
