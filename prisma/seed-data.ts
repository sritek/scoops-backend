/**
 * Seed Data Constants
 * All static data for seeding the database in one place
 */

import {
  FeeComponentType,
  ScholarshipType,
  ScholarshipBasis,
  BloodGroup,
  VisionStatus,
  HearingStatus,
  AcademicEventType,
  ComplaintPriority,
  StudentLeaveType,
} from "@prisma/client";

// ============================================
// INDIAN NAMES DATASET
// ============================================

export const FIRST_NAMES_MALE = [
  "Aarav", "Arjun", "Vihaan", "Aditya", "Sai", "Ayaan", "Krishna", "Ishaan",
  "Reyansh", "Kabir", "Vivaan", "Shivansh", "Dhruv", "Harsh", "Ansh", "Rudra",
  "Atharv", "Aryan", "Advait", "Shaurya", "Dev", "Karan", "Rahul", "Amit",
  "Rohan", "Vikram", "Raj", "Yash", "Nikhil", "Varun", "Siddharth", "Aakash",
  "Pranav", "Surya", "Karthik", "Vijay", "Ajay", "Arun", "Ganesh", "Harish",
];

export const FIRST_NAMES_FEMALE = [
  "Ananya", "Diya", "Myra", "Amaira", "Pari", "Saanvi", "Kiara", "Avni",
  "Aadhya", "Kavya", "Navya", "Prisha", "Anika", "Ishita", "Anvi", "Aaradhya",
  "Ridhi", "Siya", "Riya", "Shreya", "Priya", "Neha", "Pooja", "Anjali",
  "Meera", "Sneha", "Kritika", "Tanya", "Nisha", "Swati", "Lakshmi", "Divya",
  "Deepa", "Preethi", "Sindhu", "Swetha", "Padma", "Gayathri", "Bhavani", "Vaishnavi",
];

export const LAST_NAMES = [
  "Sharma", "Gupta", "Singh", "Kumar", "Verma", "Joshi", "Agarwal", "Tiwari",
  "Pandey", "Mishra", "Chauhan", "Yadav", "Saxena", "Srivastava", "Tripathi",
  "Dubey", "Shukla", "Awasthi", "Pathak", "Chaudhary", "Iyer", "Rao", "Reddy",
  "Nair", "Menon", "Pillai", "Patel", "Shah", "Mehta", "Desai", "Jain",
  "Banerjee", "Chatterjee", "Mukherjee", "Roy", "Das", "Sen", "Bose", "Dutta", "Ghosh",
];

export const CATEGORIES = ["gen", "obc", "sc", "st", "ews"];

// ============================================
// ORGANIZATION DEFINITIONS
// ============================================

export interface BranchDefinition {
  name: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
}

export interface SubjectDefinition {
  name: string;
  code: string;
}

export interface OrgDefinition {
  name: string;
  type: "school" | "coaching";
  branches: BranchDefinition[];
  subjects: SubjectDefinition[];
}

// School Subjects
export const SCHOOL_SUBJECTS: SubjectDefinition[] = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Hindi", code: "HIN" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SST" },
  { name: "Physics", code: "PHY" },
  { name: "Chemistry", code: "CHEM" },
  { name: "Computer Science", code: "CS" },
];

// IIT-JEE Subjects
export const IIT_JEE_SUBJECTS: SubjectDefinition[] = [
  { name: "Physics", code: "PHY" },
  { name: "Chemistry (Organic)", code: "CHO" },
  { name: "Chemistry (Inorganic)", code: "CHI" },
  { name: "Chemistry (Physical)", code: "CHP" },
  { name: "Mathematics (Algebra)", code: "MALG" },
  { name: "Mathematics (Calculus)", code: "MCAL" },
  { name: "Problem Solving", code: "PS" },
  { name: "Mock Tests", code: "MT" },
];

// IAS Subjects
export const IAS_SUBJECTS: SubjectDefinition[] = [
  { name: "Indian Polity", code: "POL" },
  { name: "Indian Economy", code: "ECO" },
  { name: "Geography", code: "GEO" },
  { name: "History (Modern)", code: "HMOD" },
  { name: "Current Affairs", code: "CA" },
  { name: "Ethics & Integrity", code: "ETH" },
  { name: "Essay Writing", code: "ESS" },
  { name: "CSAT", code: "CSAT" },
];

// Organization Definitions (2 schools + 2 coaching centers)
export const ORGANIZATIONS: OrgDefinition[] = [
  // School 1
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
    ],
  },
  // School 2
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
    ],
  },
  // Coaching 1
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
    ],
  },
  // Coaching 2
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
    ],
  },
];

// ============================================
// BATCH DEFINITIONS
// ============================================

export interface SchoolBatchDef {
  classNumber: number;
  section: string;
  academicLevel: string;
  stream?: string;
}

export interface CoachingBatchDef {
  name: string;
  academicLevel: string;
  stream?: string;
}

export function getSchoolBatches(): SchoolBatchDef[] {
  const batches: SchoolBatchDef[] = [];

  // Primary (Class 1-5)
  for (let cls = 1; cls <= 5; cls++) {
    batches.push({ classNumber: cls, section: "A", academicLevel: "primary" });
  }

  // Middle School (Class 6-8)
  for (let cls = 6; cls <= 8; cls++) {
    batches.push({ classNumber: cls, section: "A", academicLevel: "middle" });
  }

  // Secondary (Class 9-10)
  for (let cls = 9; cls <= 10; cls++) {
    batches.push({ classNumber: cls, section: "A", academicLevel: "secondary" });
  }

  return batches; // 10 batches per branch
}

export function getIITBatches(): CoachingBatchDef[] {
  return [
    { name: "Foundation (Class 9-10)", academicLevel: "secondary", stream: "science" },
    { name: "Target JEE (Class 11)", academicLevel: "senior_secondary", stream: "science" },
    { name: "Target JEE (Class 12)", academicLevel: "senior_secondary", stream: "science" },
    { name: "Dropper Batch", academicLevel: "coaching", stream: "science" },
    { name: "NEET Foundation", academicLevel: "secondary", stream: "science" },
    { name: "Target NEET (Class 12)", academicLevel: "senior_secondary", stream: "science" },
  ];
}

export function getIASBatches(): CoachingBatchDef[] {
  return [
    { name: "Prelims Foundation", academicLevel: "coaching" },
    { name: "Mains Batch", academicLevel: "coaching" },
    { name: "Optional: PSIR", academicLevel: "coaching" },
    { name: "Test Series - Prelims", academicLevel: "coaching" },
    { name: "Interview Preparation", academicLevel: "coaching" },
    { name: "Current Affairs", academicLevel: "coaching" },
  ];
}

// ============================================
// PERIOD TEMPLATE SLOTS
// ============================================

export interface SlotDefinition {
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  breakName?: string;
}

export const DEFAULT_PERIOD_SLOTS: SlotDefinition[] = [
  { periodNumber: 1, startTime: "08:00", endTime: "08:45", isBreak: false },
  { periodNumber: 2, startTime: "08:45", endTime: "09:30", isBreak: false },
  { periodNumber: 3, startTime: "09:30", endTime: "10:15", isBreak: false },
  { periodNumber: 0, startTime: "10:15", endTime: "10:30", isBreak: true, breakName: "Short Break" },
  { periodNumber: 4, startTime: "10:30", endTime: "11:15", isBreak: false },
  { periodNumber: 5, startTime: "11:15", endTime: "12:00", isBreak: false },
  { periodNumber: 0, startTime: "12:00", endTime: "12:45", isBreak: true, breakName: "Lunch Break" },
  { periodNumber: 6, startTime: "12:45", endTime: "13:30", isBreak: false },
];

// ============================================
// FEE COMPONENT DEFINITIONS
// ============================================

export interface FeeComponentDef {
  name: string;
  type: FeeComponentType;
  description: string;
  isSchoolOnly?: boolean;
  isCoachingOnly?: boolean;
  baseAmount: number; // Base amount for calculations
}

export const FEE_COMPONENTS: FeeComponentDef[] = [
  { name: "Tuition Fee", type: "tuition", description: "Regular tuition fee", baseAmount: 3000 },
  { name: "Admission Fee", type: "admission", description: "One-time admission fee", baseAmount: 5000 },
  { name: "Transport Fee", type: "transport", description: "School bus transportation", baseAmount: 1500, isSchoolOnly: true },
  { name: "Lab Fee", type: "lab", description: "Science/Computer lab usage", baseAmount: 500 },
  { name: "Library Fee", type: "library", description: "Library and reading room access", baseAmount: 300 },
  { name: "Sports Fee", type: "sports", description: "Sports and physical education", baseAmount: 400, isSchoolOnly: true },
  { name: "Exam Fee", type: "exam", description: "Examination and assessment fee", baseAmount: 600 },
  { name: "Study Material", type: "misc", description: "Books and study materials", baseAmount: 2000 },
  { name: "Test Series Fee", type: "misc", description: "Mock test and practice series", baseAmount: 3000, isCoachingOnly: true },
];

// ============================================
// SCHOLARSHIP DEFINITIONS
// ============================================

export interface ScholarshipDef {
  name: string;
  type: ScholarshipType;
  basis: ScholarshipBasis;
  value: number;
  maxAmount?: number;
  description: string;
}

export const SCHOLARSHIPS: ScholarshipDef[] = [
  {
    name: "Merit Scholarship (10%)",
    type: "percentage",
    basis: "merit",
    value: 10,
    description: "For students scoring above 90% in previous exams",
  },
  {
    name: "Merit Scholarship (25%)",
    type: "percentage",
    basis: "merit",
    value: 25,
    maxAmount: 50000,
    description: "For students scoring above 95% in previous exams",
  },
  {
    name: "Sibling Discount",
    type: "fixed_amount",
    basis: "sibling",
    value: 5000,
    description: "Discount for second sibling enrolled in same institution",
  },
  {
    name: "Staff Ward Concession",
    type: "percentage",
    basis: "staff_ward",
    value: 50,
    description: "50% fee waiver for children of staff members",
  },
  {
    name: "EWS Scholarship",
    type: "percentage",
    basis: "need_based",
    value: 75,
    description: "For economically weaker section students",
  },
];

// ============================================
// ACADEMIC EVENT DEFINITIONS
// ============================================

export interface AcademicEventDef {
  title: string;
  type: AcademicEventType;
  description: string;
  daysFromNow: number; // Positive = future, negative = past
  durationDays?: number;
}

export const ACADEMIC_EVENTS: AcademicEventDef[] = [
  // Holidays
  { title: "Republic Day", type: "holiday", description: "National Holiday", daysFromNow: -5 },
  { title: "Holi", type: "holiday", description: "Festival of Colors", daysFromNow: 45 },
  { title: "Good Friday", type: "holiday", description: "Religious Holiday", daysFromNow: 60 },
  { title: "Independence Day", type: "holiday", description: "National Holiday", daysFromNow: 200 },
  // Exams
  { title: "Unit Test 1", type: "exam", description: "First Unit Test", daysFromNow: -20, durationDays: 5 },
  { title: "Mid-Term Examination", type: "exam", description: "Half-yearly examination", daysFromNow: 30, durationDays: 10 },
  { title: "Final Examination", type: "exam", description: "Annual examination", daysFromNow: 90, durationDays: 15 },
  // PTM
  { title: "Parent-Teacher Meeting", type: "ptm", description: "Monthly PTM", daysFromNow: 14 },
  { title: "Annual PTM", type: "ptm", description: "Annual parent-teacher meeting", daysFromNow: 100 },
  // Events
  { title: "Annual Sports Day", type: "event", description: "Inter-class sports competition", daysFromNow: 75 },
  { title: "Science Exhibition", type: "event", description: "Student science projects showcase", daysFromNow: 50 },
  // Deadlines
  { title: "Admission Deadline", type: "deadline", description: "Last date for new admissions", daysFromNow: 20 },
  { title: "Fee Payment Deadline", type: "deadline", description: "Last date for fee payment", daysFromNow: 10 },
];

// ============================================
// HOMEWORK TEMPLATES
// ============================================

export interface HomeworkTemplate {
  title: string;
  description: string;
  totalMarks?: number;
}

export const HOMEWORK_TEMPLATES: HomeworkTemplate[] = [
  { title: "Chapter Review Questions", description: "Answer the questions at the end of chapter. Show all working.", totalMarks: 20 },
  { title: "Practice Problems", description: "Solve the practice problems from the workbook. Submit neat work.", totalMarks: 15 },
  { title: "Essay Writing", description: "Write an essay on the given topic. Minimum 500 words.", totalMarks: 25 },
  { title: "Research Assignment", description: "Research and prepare a report on the assigned topic.", totalMarks: 30 },
  { title: "Lab Report", description: "Document the experiment conducted in class with observations.", totalMarks: 20 },
  { title: "Revision Worksheet", description: "Complete the revision worksheet for upcoming test.", totalMarks: 10 },
];

// ============================================
// COMPLAINT CATEGORIES
// ============================================

export interface ComplaintTemplate {
  subject: string;
  category: string;
  description: string;
  priority: ComplaintPriority;
}

export const COMPLAINT_TEMPLATES: ComplaintTemplate[] = [
  { subject: "Fee payment issue", category: "fees", description: "I have made the payment but it is not reflecting in the system.", priority: "high" },
  { subject: "Bus route change request", category: "facilities", description: "Requesting change in bus pickup location due to house shift.", priority: "medium" },
  { subject: "Teacher absence concern", category: "academics", description: "Regular teacher has been absent frequently, affecting studies.", priority: "high" },
  { subject: "Canteen food quality", category: "facilities", description: "The food quality in canteen has deteriorated recently.", priority: "low" },
  { subject: "Exam result query", category: "academics", description: "There seems to be an error in the marks calculation.", priority: "medium" },
  { subject: "Bullying incident", category: "staff", description: "My child reported being bullied by classmates.", priority: "urgent" },
  { subject: "Library book damage charge", category: "fees", description: "I was charged for book damage that was pre-existing.", priority: "medium" },
  { subject: "Sports equipment shortage", category: "facilities", description: "Not enough sports equipment for all students during PE.", priority: "low" },
];

// ============================================
// LEAVE APPLICATION TYPES
// ============================================

export interface LeaveTemplate {
  type: StudentLeaveType;
  reason: string;
  days: number;
}

export const LEAVE_TEMPLATES: LeaveTemplate[] = [
  { type: "sick", reason: "Child is having fever and needs rest at home.", days: 3 },
  { type: "family", reason: "Family function - wedding ceremony.", days: 2 },
  { type: "medical", reason: "Doctor's appointment for regular checkup.", days: 1 },
  { type: "vacation", reason: "Family vacation during school break.", days: 5 },
  { type: "other", reason: "Personal work at home.", days: 1 },
];

// ============================================
// HEALTH RELATED CONSTANTS
// ============================================

export const COMMON_ALLERGIES = [
  "Peanuts",
  "Dust",
  "Pollen",
  "Milk",
  "Eggs",
  "Shellfish",
  "Penicillin",
  "None",
];

export const CHRONIC_CONDITIONS = [
  "Asthma",
  "Diabetes Type 1",
  "Epilepsy",
  "ADHD",
  "None",
];

export const BLOOD_GROUPS: BloodGroup[] = [
  "A_positive", "A_negative", "B_positive", "B_negative",
  "AB_positive", "AB_negative", "O_positive", "O_negative",
];

export const VISION_STATUSES: VisionStatus[] = [
  "normal", "corrected_with_glasses", "corrected_with_lenses", "impaired",
];

export const HEARING_STATUSES: HearingStatus[] = [
  "normal", "mild_impairment", "moderate_impairment",
];

// ============================================
// MESSAGE TEMPLATES
// ============================================

export interface MessageTemplateDef {
  type: string;
  name: string;
  content: string;
}

export const MESSAGE_TEMPLATES: MessageTemplateDef[] = [
  { type: "absent", name: "Student Absent", content: "Dear Parent, {{studentName}} was absent on {{date}}. Please contact school for any queries." },
  { type: "fee_due", name: "Fee Due", content: "Fee of ₹{{amount}} is due for {{studentName}} by {{dueDate}}. Please pay on time." },
  { type: "fee_paid", name: "Fee Paid", content: "✓ Payment of ₹{{amount}} received for {{studentName}}. Thank you!" },
  { type: "fee_overdue", name: "Fee Overdue Alert", content: "⚠️ Fee of ₹{{amount}} is overdue for {{studentName}} (Due: {{dueDate}}). Please pay immediately." },
  { type: "fee_reminder", name: "Fee Reminder", content: "Reminder: Fee of ₹{{amount}} for {{studentName}} is due in {{days}} days ({{dueDate}})." },
  { type: "birthday", name: "Birthday Wishes", content: "🎂 Happy Birthday {{studentName}}! Wishing you a wonderful day." },
];

// ============================================
// EMI PLAN TEMPLATES
// ============================================

export interface EMIPlanDef {
  name: string;
  installmentCount: number;
  splitConfig: Array<{ percent: number; dueDaysFromStart: number }>;
  isDefault: boolean;
}

export const EMI_PLANS: EMIPlanDef[] = [
  {
    name: "Quarterly",
    installmentCount: 4,
    splitConfig: [
      { percent: 25, dueDaysFromStart: 0 },
      { percent: 25, dueDaysFromStart: 90 },
      { percent: 25, dueDaysFromStart: 180 },
      { percent: 25, dueDaysFromStart: 270 },
    ],
    isDefault: true,
  },
  {
    name: "Half-Yearly",
    installmentCount: 2,
    splitConfig: [
      { percent: 50, dueDaysFromStart: 0 },
      { percent: 50, dueDaysFromStart: 180 },
    ],
    isDefault: false,
  },
  {
    name: "One-Time",
    installmentCount: 1,
    splitConfig: [{ percent: 100, dueDaysFromStart: 0 }],
    isDefault: false,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePhone(): string {
  const prefixes = ["98", "97", "96", "95", "94", "93", "91", "90", "89", "88", "87", "86", "85", "84", "83", "82", "81", "80", "79", "78", "77", "76", "75", "74", "73", "72", "71", "70"];
  return randomElement(prefixes) + Math.random().toString().slice(2, 10);
}

export function generateEmployeeId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function getWorkingDays(count: number, beforeToday: boolean = true): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let current = new Date(today);
  let daysFound = 0;
  
  while (daysFound < count) {
    if (beforeToday) {
      current.setDate(current.getDate() - 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
    
    // Skip Sundays (0)
    if (current.getDay() !== 0) {
      dates.push(new Date(current));
      daysFound++;
    }
  }
  
  return dates;
}
