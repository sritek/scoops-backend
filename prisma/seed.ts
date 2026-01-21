/**
 * Comprehensive Database Seed Script
 * Seeds all tables for testing all features including pagination
 */

import {
  PrismaClient,
  PaymentMode,
  Role,
  StudentStatus,
  AttendanceStatus,
  FeeStatus,
  InstallmentStatus,
  StaffAttendanceStatus,
  StudentLeaveStatus,
  HomeworkStatus,
  SubmissionStatus,
  ExamType,
  MessageType,
  ComplaintStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";

// Import all seed data from centralized data file
import {
  FIRST_NAMES_MALE,
  FIRST_NAMES_FEMALE,
  LAST_NAMES,
  CATEGORIES,
  ORGANIZATIONS,
  OrgDefinition,
  getSchoolBatches,
  getIITBatches,
  getIASBatches,
  DEFAULT_PERIOD_SLOTS,
  FEE_COMPONENTS,
  SCHOLARSHIPS,
  ACADEMIC_EVENTS,
  HOMEWORK_TEMPLATES,
  COMPLAINT_TEMPLATES,
  LEAVE_TEMPLATES,
  BLOOD_GROUPS,
  COMMON_ALLERGIES,
  CHRONIC_CONDITIONS,
  MESSAGE_TEMPLATES,
  EMI_PLANS,
  randomElement,
  randomInt,
  generatePhone,
  generateEmployeeId,
  addDays,
  getWorkingDays,
} from "./seed-data";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Password123";

// ============================================
// TYPE DEFINITIONS
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
  startDate: Date;
}

interface CreatedUser {
  id: string;
  orgId: string;
  branchId: string;
  employeeId: string;
  role: Role;
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
  orgName: string;
  isSchool: boolean;
}

interface CreatedStudent {
  id: string;
  orgId: string;
  branchId: string;
  batchId: string;
  firstName: string;
  lastName: string;
}

interface CreatedParent {
  id: string;
  orgId: string;
  branchId: string;
  phone: string;
  studentIds: string[];
}

interface CreatedSubject {
  id: string;
  orgId: string;
  name: string;
  code: string;
}

interface CreatedFeeComponent {
  id: string;
  orgId: string;
  name: string;
  type: string;
  baseAmount: number;
}

interface CreatedScholarship {
  id: string;
  orgId: string;
  name: string;
  type: string;
  value: number;
}

// Seed context to hold all created entities
interface SeedContext {
  orgs: CreatedOrg[];
  branches: CreatedBranch[];
  sessions: CreatedSession[];
  users: CreatedUser[];
  teachers: CreatedUser[];
  accountants: CreatedUser[];
  batches: CreatedBatch[];
  students: CreatedStudent[];
  parents: CreatedParent[];
  subjects: CreatedSubject[];
  feeComponents: CreatedFeeComponent[];
  scholarships: CreatedScholarship[];
  studentParentMap: Map<string, string>; // studentId -> parentId
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function logPhase(phase: number, name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📦 PHASE ${phase}: ${name}`);
  console.log("=".repeat(60));
}

function logStep(step: string) {
  console.log(`   ➤ ${step}`);
}

function logSuccess(message: string) {
  console.log(`   ✓ ${message}`);
}

// ============================================
// DATABASE CLEANUP
// ============================================

async function cleanDatabase() {
  console.log("\n🧹 Cleaning existing data...");
  
  const tables = [
    // Phase 8: Health
    "healthCheckup", "studentHealth",
    // Phase 7: Communication
    "complaintComment", "complaint", "complaintSequence",
    "message", "conversationParticipant", "conversation",
    // Phase 6: Academics
    "homeworkSubmission", "homework",
    "examScore", "exam",
    "academicEvent",
    // Phase 5: Attendance & Leave
    "leaveApplication",
    "staffAttendance",
    "attendanceRecord", "attendanceSession",
    // Phase 4: Fee System
    "feeReminder", "installmentPayment", "feeInstallment",
    "studentFeeLineItem", "studentFeeStructure",
    "studentScholarship", "scholarship",
    "batchFeeLineItem", "batchFeeStructure",
    "feeComponent", "eMIPlanTemplate",
    "receipt", "receiptSequence",
    "paymentLink", "reportGeneration",
    "feePayment", "studentFee", "feePlan",
    // Phase 3: Users & Students
    "parentSession", "otpCode",
    "studentParent", "parent", "student",
    "period",
    // Phase 2: Academic Setup
    "batch",
    "periodTemplateSlot", "periodTemplate",
    "subject",
    "academicSession",
    // Phase 1: Core
    "notificationLog", "messageTemplate",
    "event", "jobRun",
    "user", "branch", "organization",
  ];

  for (const table of tables) {
    try {
      // @ts-expect-error - Dynamic table access
      await prisma[table]?.deleteMany?.();
    } catch {
      // Table might not exist, continue
    }
  }
  
  console.log("   ✓ Database cleaned\n");
}

// ============================================
// PHASE 1: CORE TENANCY
// ============================================

async function seedPhase1CoreTenancy(ctx: SeedContext) {
  logPhase(1, "CORE TENANCY");
  
  // Create Organizations
  logStep("Creating organizations...");
  for (const orgDef of ORGANIZATIONS) {
    const org = await prisma.organization.create({
      data: {
        name: orgDef.name,
        type: orgDef.type,
        language: "en",
        timezone: "Asia/Kolkata",
        notificationsEnabled: true,
        birthdayNotifications: true,
        feeReminderDays: 3,
        attendanceBufferMinutes: 5,
      },
    });

    ctx.orgs.push({
      id: org.id,
      name: org.name,
      type: org.type,
      definition: orgDef,
    });

    // Create Branches
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

      ctx.branches.push({
        id: branch.id,
        orgId: org.id,
        name: branch.name,
        isDefault: branch.isDefault,
        orgName: org.name,
        orgType: org.type,
      });
    }
  }
  
  logSuccess(`${ctx.orgs.length} organizations created`);
  logSuccess(`${ctx.branches.length} branches created`);
}

// ============================================
// PHASE 2: ACADEMIC SETUP
// ============================================

async function seedPhase2AcademicSetup(ctx: SeedContext) {
  logPhase(2, "ACADEMIC SETUP");
  
  // Create Academic Sessions
  logStep("Creating academic sessions...");
  const sessionYears = ["2024-25", "2025-26"];
  
  for (const org of ctx.orgs) {
    for (let i = 0; i < sessionYears.length; i++) {
      const year = sessionYears[i];
      const startYear = parseInt(year.split("-")[0]);
      const session = await prisma.academicSession.create({
        data: {
          orgId: org.id,
          name: year,
          startDate: new Date(startYear, 3, 1), // April 1st
          endDate: new Date(startYear + 1, 2, 31), // March 31st
          isCurrent: i === sessionYears.length - 1,
        },
      });
      ctx.sessions.push({
        id: session.id,
        orgId: org.id,
        name: session.name,
        isCurrent: session.isCurrent,
        startDate: session.startDate,
      });
    }
  }
  logSuccess(`${ctx.sessions.length} academic sessions created`);
  
  // Create Subjects
  logStep("Creating subjects...");
  for (const org of ctx.orgs) {
    const subjectData = org.definition.subjects.map((s) => ({
      id: randomUUID(),
      orgId: org.id,
      name: s.name,
      code: s.code,
      isActive: true,
    }));
    
    await prisma.subject.createMany({ data: subjectData });
    
    for (const s of subjectData) {
      ctx.subjects.push({
        id: s.id,
        orgId: s.orgId,
        name: s.name,
        code: s.code,
      });
    }
  }
  logSuccess(`${ctx.subjects.length} subjects created`);
  
  // Create Period Templates
  logStep("Creating period templates...");
  for (const org of ctx.orgs) {
    const template = await prisma.periodTemplate.create({
      data: {
        orgId: org.id,
        name: "Default Schedule",
        isDefault: true,
        activeDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
      },
    });

    let breakCounter = 100;
    await prisma.periodTemplateSlot.createMany({
      data: DEFAULT_PERIOD_SLOTS.map((slot) => ({
        templateId: template.id,
        periodNumber: slot.isBreak ? breakCounter++ : slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak,
        breakName: slot.breakName ?? null,
      })),
    });
  }
  logSuccess(`Period templates created for ${ctx.orgs.length} organizations`);
  
  // Create EMI Plan Templates
  logStep("Creating EMI plan templates...");
  for (const org of ctx.orgs) {
    await prisma.eMIPlanTemplate.createMany({
      data: EMI_PLANS.map((plan) => ({
        orgId: org.id,
        name: plan.name,
        installmentCount: plan.installmentCount,
        splitConfig: JSON.stringify(plan.splitConfig),
        isDefault: plan.isDefault,
        isActive: true,
      })),
    });
  }
  logSuccess(`EMI plan templates created`);
  
  // Create Message Templates
  logStep("Creating message templates...");
  for (const org of ctx.orgs) {
    await prisma.messageTemplate.createMany({
      data: MESSAGE_TEMPLATES.map((t) => ({
        orgId: org.id,
        type: t.type,
        name: t.name,
        content: `${t.content} - ${org.name}`,
        isActive: true,
      })),
    });
  }
  logSuccess(`Message templates created`);
}

// ============================================
// PHASE 3: USERS, STUDENTS, PARENTS
// ============================================

async function seedPhase3UsersStudents(ctx: SeedContext, passwordHash: string) {
  logPhase(3, "USERS, STUDENTS & PARENTS");
  
  // Create Users (per branch)
  logStep("Creating users...");
  
  for (const branch of ctx.branches) {
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
      role: Role;
      isActive: boolean;
      employmentType: "full_time" | "part_time";
      joiningDate: Date;
      department: string;
    }> = [];

    // 1 Admin
    const adminId = randomUUID();
    branchUsers.push({
      id: adminId,
      orgId: branch.orgId,
      branchId: branch.id,
      employeeId: generateEmployeeId(),
      passwordHash,
      mustChangePassword: false,
      firstName: randomElement(FIRST_NAMES_MALE),
      lastName: randomElement(LAST_NAMES),
      phone: generatePhone(),
      email: `admin.${branch.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      role: "admin",
      isActive: true,
      employmentType: "full_time",
      joiningDate: new Date(2020, 3, 1),
      department: "Administration",
    });

    // 3 Teachers
    for (let i = 0; i < 3; i++) {
      const isMale = Math.random() > 0.4;
      const teacherId = randomUUID();
      branchUsers.push({
        id: teacherId,
        orgId: branch.orgId,
        branchId: branch.id,
        employeeId: generateEmployeeId(),
        passwordHash,
        mustChangePassword: false,
        firstName: randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
        lastName: randomElement(LAST_NAMES),
        phone: generatePhone(),
        email: null,
        role: "teacher",
        isActive: true,
        employmentType: "full_time",
        joiningDate: new Date(2021 + i, randomInt(0, 11), randomInt(1, 28)),
        department: "Teaching",
      });
    }

    // 1 Accountant
    const accountantId = randomUUID();
    branchUsers.push({
      id: accountantId,
      orgId: branch.orgId,
      branchId: branch.id,
      employeeId: generateEmployeeId(),
      passwordHash,
      mustChangePassword: false,
      firstName: randomElement(Math.random() > 0.5 ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomElement(LAST_NAMES),
      phone: generatePhone(),
      email: null,
      role: "accounts",
      isActive: true,
      employmentType: "full_time",
      joiningDate: new Date(2022, 5, 1),
      department: "Accounts",
    });

    // 1 Staff
    const staffId = randomUUID();
    branchUsers.push({
      id: staffId,
      orgId: branch.orgId,
      branchId: branch.id,
      employeeId: generateEmployeeId(),
      passwordHash,
      mustChangePassword: false,
      firstName: randomElement(FIRST_NAMES_MALE),
      lastName: randomElement(LAST_NAMES),
      phone: generatePhone(),
      email: null,
      role: "staff",
      isActive: true,
      employmentType: "full_time",
      joiningDate: new Date(2023, 0, 15),
      department: "Support",
    });

    await prisma.user.createMany({ data: branchUsers });

    for (const u of branchUsers) {
      const userRecord: CreatedUser = {
        id: u.id,
        orgId: u.orgId,
        branchId: u.branchId,
        employeeId: u.employeeId,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
      };
      ctx.users.push(userRecord);
      if (u.role === "teacher") ctx.teachers.push(userRecord);
      if (u.role === "accounts") ctx.accountants.push(userRecord);
    }
  }
  logSuccess(`${ctx.users.length} users created (${ctx.teachers.length} teachers)`);

  // Create Batches
  logStep("Creating batches...");
  
  for (const branch of ctx.branches) {
    const org = ctx.orgs.find((o) => o.id === branch.orgId)!;
    const currentSession = ctx.sessions.find((s) => s.orgId === org.id && s.isCurrent)!;
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branch.id);

    const isSchool = org.type === "school";
    let batchDefs: { name: string; academicLevel: string; stream?: string }[];

    if (isSchool) {
      const schoolBatches = getSchoolBatches();
      batchDefs = schoolBatches.map((b) => ({
        name: `Class ${b.classNumber}-${b.section}`,
        academicLevel: b.academicLevel,
        stream: b.stream,
      }));
    } else if (org.name.includes("Kota IIT")) {
      batchDefs = getIITBatches();
    } else {
      batchDefs = getIASBatches();
    }

    const batchData = batchDefs.map((def) => {
      const classTeacher = branchTeachers.length > 0 ? randomElement(branchTeachers) : null;
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

    for (const b of batchData) {
      ctx.batches.push({
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
  logSuccess(`${ctx.batches.length} batches created`);

  // Create Students and Parents
  logStep("Creating students and parents...");
  
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
    status: StudentStatus;
  }> = [];

  const allParentData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  }> = [];

  const studentParentLinks: Array<{
    studentId: string;
    parentId: string;
    relation: string;
    isPrimaryContact: boolean;
  }> = [];

  for (const batch of ctx.batches) {
    // 10 students per batch (enough for pagination)
    const studentCount = 10;

    for (let i = 0; i < studentCount; i++) {
      const isMale = Math.random() > 0.5;
      const lastName = randomElement(LAST_NAMES);
      const dobYear = batch.isSchool ? randomInt(2008, 2018) : randomInt(1998, 2006);

      const studentId = randomUUID();
      const fatherParentId = randomUUID();
      const motherParentId = randomUUID();
      const studentFirstName = randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);

      // Student
      allStudentData.push({
        id: studentId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        batchId: batch.id,
        firstName: studentFirstName,
        lastName,
        gender: isMale ? "male" : "female",
        dob: new Date(dobYear, randomInt(0, 11), randomInt(1, 28)),
        category: randomElement(CATEGORIES),
        admissionYear: randomInt(2022, 2025),
        status: "active",
      });

      // Father (primary contact)
      allParentData.push({
        id: fatherParentId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        firstName: randomElement(FIRST_NAMES_MALE),
        lastName,
        phone: generatePhone(),
        email: `parent.${studentFirstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      });

      // Mother (secondary contact for 50% of students)
      if (Math.random() > 0.5) {
        allParentData.push({
          id: motherParentId,
          orgId: batch.orgId,
          branchId: batch.branchId,
          firstName: randomElement(FIRST_NAMES_FEMALE),
          lastName,
          phone: generatePhone(),
          email: null,
        });

        studentParentLinks.push({
          studentId,
          parentId: motherParentId,
          relation: "mother",
          isPrimaryContact: false,
        });
      }

      // Father link (always primary)
      studentParentLinks.push({
        studentId,
        parentId: fatherParentId,
        relation: "father",
        isPrimaryContact: true,
      });

      ctx.studentParentMap.set(studentId, fatherParentId);
    }
  }

  // Bulk insert students
  await prisma.student.createMany({ data: allStudentData });
  logSuccess(`${allStudentData.length} students created`);

  // Track students
  for (const s of allStudentData) {
    ctx.students.push({
      id: s.id,
      orgId: s.orgId,
      branchId: s.branchId,
      batchId: s.batchId,
      firstName: s.firstName,
      lastName: s.lastName,
    });
  }

  // Bulk insert parents
  await prisma.parent.createMany({ data: allParentData });
  logSuccess(`${allParentData.length} parents created`);

  // Track parents
  const parentMap = new Map<string, string[]>();
  for (const link of studentParentLinks) {
    if (!parentMap.has(link.parentId)) {
      parentMap.set(link.parentId, []);
    }
    parentMap.get(link.parentId)!.push(link.studentId);
  }

  for (const p of allParentData) {
    ctx.parents.push({
      id: p.id,
      orgId: p.orgId,
      branchId: p.branchId,
      phone: p.phone,
      studentIds: parentMap.get(p.id) || [],
    });
  }

  // Bulk insert student-parent links
  await prisma.studentParent.createMany({ data: studentParentLinks });
  logSuccess(`${studentParentLinks.length} student-parent links created`);
}

// ============================================
// PHASE 4: PERIOD (TIMETABLE)
// ============================================

async function seedPhase4Timetable(ctx: SeedContext) {
  logPhase(4, "TIMETABLE (PERIODS)");
  
  logStep("Creating timetable periods...");
  
  const allPeriodData: Array<{
    id: string;
    batchId: string;
    dayOfWeek: number;
    periodNumber: number;
    startTime: string;
    endTime: string;
    subjectId: string | null;
    teacherId: string | null;
  }> = [];

  // Create periods for sampled batches (first 5 per branch for performance)
  const batchesByBranch = new Map<string, CreatedBatch[]>();
  for (const batch of ctx.batches) {
    if (!batchesByBranch.has(batch.branchId)) {
      batchesByBranch.set(batch.branchId, []);
    }
    batchesByBranch.get(batch.branchId)!.push(batch);
  }

  for (const [branchId, branchBatches] of batchesByBranch) {
    const sampledBatches = branchBatches.slice(0, 5);
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branchId);
    const org = ctx.orgs.find((o) => o.id === sampledBatches[0]?.orgId);
    const orgSubjects = ctx.subjects.filter((s) => s.orgId === org?.id);

    for (const batch of sampledBatches) {
      // Days 1-6 (Mon-Sat)
      for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
        // 6 periods per day
        for (let periodNumber = 1; periodNumber <= 6; periodNumber++) {
          const slot = DEFAULT_PERIOD_SLOTS.find((s) => s.periodNumber === periodNumber);
          if (!slot) continue;

          const subject = orgSubjects.length > 0 ? randomElement(orgSubjects) : null;
          const teacher = branchTeachers.length > 0 ? randomElement(branchTeachers) : null;

          allPeriodData.push({
            id: randomUUID(),
            batchId: batch.id,
            dayOfWeek,
            periodNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectId: subject?.id ?? null,
            teacherId: teacher?.id ?? null,
          });
        }
      }
    }
  }

  // Batch insert in chunks to avoid query size limits
  const chunkSize = 500;
  for (let i = 0; i < allPeriodData.length; i += chunkSize) {
    const chunk = allPeriodData.slice(i, i + chunkSize);
    await prisma.period.createMany({ data: chunk });
  }

  logSuccess(`${allPeriodData.length} period entries created`);
}

// ============================================
// PHASE 5: FEE SYSTEM
// ============================================

async function seedPhase5FeeSystem(ctx: SeedContext) {
  logPhase(5, "FEE SYSTEM");

  // Create Fee Components
  logStep("Creating fee components...");
  for (const org of ctx.orgs) {
    const isSchool = org.type === "school";
    const applicableComponents = FEE_COMPONENTS.filter((c) => {
      if (isSchool && c.isCoachingOnly) return false;
      if (!isSchool && c.isSchoolOnly) return false;
      return true;
    });

    const componentData = applicableComponents.map((c) => ({
      id: randomUUID(),
      orgId: org.id,
      name: c.name,
      type: c.type,
      description: c.description,
      isActive: true,
    }));

    await prisma.feeComponent.createMany({ data: componentData });

    for (let i = 0; i < componentData.length; i++) {
      ctx.feeComponents.push({
        id: componentData[i].id,
        orgId: org.id,
        name: componentData[i].name,
        type: componentData[i].type,
        baseAmount: applicableComponents[i].baseAmount,
      });
    }
  }
  logSuccess(`${ctx.feeComponents.length} fee components created`);

  // Create Scholarships
  logStep("Creating scholarships...");
  for (const org of ctx.orgs) {
    const scholarshipData = SCHOLARSHIPS.map((s) => ({
      id: randomUUID(),
      orgId: org.id,
      name: s.name,
      type: s.type,
      basis: s.basis,
      value: s.value,
      maxAmount: s.maxAmount ?? null,
      description: s.description,
      isActive: true,
    }));

    await prisma.scholarship.createMany({ data: scholarshipData });

    for (const s of scholarshipData) {
      ctx.scholarships.push({
        id: s.id,
        orgId: org.id,
        name: s.name,
        type: s.type,
        value: s.value,
      });
    }
  }
  logSuccess(`${ctx.scholarships.length} scholarships created`);

  // Create Batch Fee Structures
  logStep("Creating batch fee structures...");
  const batchFeeStructures: Array<{ id: string; batchId: string; orgId: string; branchId: string; sessionId: string; totalAmount: number }> = [];

  for (const batch of ctx.batches) {
    const currentSession = ctx.sessions.find((s) => s.orgId === batch.orgId && s.isCurrent);
    if (!currentSession || !batch.sessionId) continue;

    const orgComponents = ctx.feeComponents.filter((c) => c.orgId === batch.orgId);
    const totalAmount = orgComponents.reduce((sum, c) => sum + c.baseAmount, 0);

    const bfsId = randomUUID();
    batchFeeStructures.push({
      id: bfsId,
      batchId: batch.id,
      orgId: batch.orgId,
      branchId: batch.branchId,
      sessionId: currentSession.id,
      totalAmount,
    });
  }

  // Create batch fee structures
  await prisma.batchFeeStructure.createMany({
    data: batchFeeStructures.map((bfs) => ({
      id: bfs.id,
      orgId: bfs.orgId,
      branchId: bfs.branchId,
      batchId: bfs.batchId,
      sessionId: bfs.sessionId,
      name: `Fee Structure 2025-26`,
      totalAmount: bfs.totalAmount,
      isActive: true,
    })),
  });
  logSuccess(`${batchFeeStructures.length} batch fee structures created`);

  // Create Batch Fee Line Items
  logStep("Creating batch fee line items...");
  const batchFeeLineItems: Array<{
    batchFeeStructureId: string;
    feeComponentId: string;
    amount: number;
  }> = [];

  for (const bfs of batchFeeStructures) {
    const batch = ctx.batches.find((b) => b.id === bfs.batchId)!;
    const orgComponents = ctx.feeComponents.filter((c) => c.orgId === batch.orgId);

    for (const comp of orgComponents) {
      batchFeeLineItems.push({
        batchFeeStructureId: bfs.id,
        feeComponentId: comp.id,
        amount: comp.baseAmount,
      });
    }
  }

  await prisma.batchFeeLineItem.createMany({ data: batchFeeLineItems });
  logSuccess(`${batchFeeLineItems.length} batch fee line items created`);

  // Create Student Fee Structures and Installments
  logStep("Creating student fee structures and installments...");
  
  const studentFeeStructures: Array<{
    id: string;
    studentId: string;
    sessionId: string;
    batchFeeStructureId: string;
    grossAmount: number;
    scholarshipAmount: number;
    netAmount: number;
  }> = [];

  const studentFeeLineItems: Array<{
    studentFeeStructureId: string;
    feeComponentId: string;
    originalAmount: number;
    adjustedAmount: number;
  }> = [];

  const feeInstallments: Array<{
    id: string;
    studentFeeStructureId: string;
    installmentNumber: number;
    amount: number;
    dueDate: Date;
    status: InstallmentStatus;
    paidAmount: number;
  }> = [];

  const installmentPayments: Array<{
    installmentId: string;
    amount: number;
    paymentMode: PaymentMode;
    receivedById: string;
    receivedAt: Date;
  }> = [];

  const studentScholarships: Array<{
    studentId: string;
    scholarshipId: string;
    sessionId: string;
    discountAmount: number;
    approvedById: string;
  }> = [];

  const bfsMap = new Map(batchFeeStructures.map((bfs) => [bfs.batchId, bfs]));

  for (const student of ctx.students) {
    const batch = ctx.batches.find((b) => b.id === student.batchId);
    if (!batch) continue;

    const bfs = bfsMap.get(batch.id);
    if (!bfs) continue;

    const currentSession = ctx.sessions.find((s) => s.orgId === student.orgId && s.isCurrent);
    if (!currentSession) continue;

    const orgComponents = ctx.feeComponents.filter((c) => c.orgId === student.orgId);

    // 10% of students get scholarships
    let scholarshipAmount = 0;
    if (Math.random() < 0.1) {
      const orgScholarships = ctx.scholarships.filter((s) => s.orgId === student.orgId);
      if (orgScholarships.length > 0) {
        const scholarship = randomElement(orgScholarships);
        const approver = ctx.users.find((u) => u.branchId === student.branchId && u.role === "admin");
        
        if (scholarship.type === "percentage") {
          scholarshipAmount = Math.round(bfs.totalAmount * (scholarship.value / 100));
        } else {
          scholarshipAmount = scholarship.value;
        }

        if (approver) {
          studentScholarships.push({
            studentId: student.id,
            scholarshipId: scholarship.id,
            sessionId: currentSession.id,
            discountAmount: scholarshipAmount,
            approvedById: approver.id,
          });
        }
      }
    }

    const netAmount = bfs.totalAmount - scholarshipAmount;
    const sfsId = randomUUID();

    studentFeeStructures.push({
      id: sfsId,
      studentId: student.id,
      sessionId: currentSession.id,
      batchFeeStructureId: bfs.id,
      grossAmount: bfs.totalAmount,
      scholarshipAmount,
      netAmount,
    });

    // Line items
    for (const comp of orgComponents) {
      studentFeeLineItems.push({
        studentFeeStructureId: sfsId,
        feeComponentId: comp.id,
        originalAmount: comp.baseAmount,
        adjustedAmount: comp.baseAmount,
      });
    }

    // Create 4 quarterly installments
    const installmentAmount = Math.round(netAmount / 4);
    const accountant = ctx.accountants.find((a) => a.branchId === student.branchId);

    for (let i = 1; i <= 4; i++) {
      const dueDate = addDays(currentSession.startDate, (i - 1) * 90);
      const isPaid = i <= 2 && Math.random() > 0.3; // First 2 installments mostly paid
      const isPartial = !isPaid && i <= 2 && Math.random() > 0.5;
      const paidAmount = isPaid ? installmentAmount : isPartial ? Math.round(installmentAmount * 0.5) : 0;

      const installmentId = randomUUID();
      feeInstallments.push({
        id: installmentId,
        studentFeeStructureId: sfsId,
        installmentNumber: i,
        amount: installmentAmount,
        dueDate,
        status: isPaid ? "paid" : isPartial ? "partial" : i <= 2 ? "overdue" : "upcoming",
        paidAmount,
      });

      // Create payment record if paid
      if (paidAmount > 0 && accountant) {
        installmentPayments.push({
          installmentId,
          amount: paidAmount,
          paymentMode: randomElement(["cash", "upi", "bank"] as PaymentMode[]),
          receivedById: accountant.id,
          receivedAt: addDays(dueDate, randomInt(0, 10)),
        });
      }
    }
  }

  // Batch insert in chunks
  const chunkSize = 500;

  for (let i = 0; i < studentFeeStructures.length; i += chunkSize) {
    await prisma.studentFeeStructure.createMany({
      data: studentFeeStructures.slice(i, i + chunkSize).map((sfs) => ({
        id: sfs.id,
        studentId: sfs.studentId,
        sessionId: sfs.sessionId,
        source: "batch_default" as const,
        batchFeeStructureId: sfs.batchFeeStructureId,
        grossAmount: sfs.grossAmount,
        scholarshipAmount: sfs.scholarshipAmount,
        netAmount: sfs.netAmount,
      })),
    });
  }
  logSuccess(`${studentFeeStructures.length} student fee structures created`);

  for (let i = 0; i < studentFeeLineItems.length; i += chunkSize) {
    await prisma.studentFeeLineItem.createMany({
      data: studentFeeLineItems.slice(i, i + chunkSize),
    });
  }
  logSuccess(`${studentFeeLineItems.length} student fee line items created`);

  if (studentScholarships.length > 0) {
    await prisma.studentScholarship.createMany({
      data: studentScholarships.map((ss) => ({
        studentId: ss.studentId,
        scholarshipId: ss.scholarshipId,
        sessionId: ss.sessionId,
        discountAmount: ss.discountAmount,
        approvedById: ss.approvedById,
        isActive: true,
      })),
    });
    logSuccess(`${studentScholarships.length} student scholarships created`);
  }

  for (let i = 0; i < feeInstallments.length; i += chunkSize) {
    await prisma.feeInstallment.createMany({
      data: feeInstallments.slice(i, i + chunkSize),
    });
  }
  logSuccess(`${feeInstallments.length} fee installments created`);

  if (installmentPayments.length > 0) {
    await prisma.installmentPayment.createMany({ data: installmentPayments });
    logSuccess(`${installmentPayments.length} installment payments created`);
  }

  // Create Receipt Sequence
  logStep("Creating receipt sequences...");
  for (const org of ctx.orgs) {
    await prisma.receiptSequence.create({
      data: {
        orgId: org.id,
        year: 2025,
        lastNumber: installmentPayments.length,
      },
    });
  }
  logSuccess(`Receipt sequences created`);
}

// ============================================
// PHASE 6: ATTENDANCE & LEAVE
// ============================================

async function seedPhase6AttendanceLeave(ctx: SeedContext) {
  logPhase(6, "ATTENDANCE & LEAVE");

  // Student Attendance
  logStep("Creating student attendance...");
  const workingDays = getWorkingDays(15);
  let attendanceSessionCount = 0;
  let attendanceRecordCount = 0;

  // Sample batches (first 3 per branch)
  const batchesByBranch = new Map<string, CreatedBatch[]>();
  for (const batch of ctx.batches) {
    if (!batchesByBranch.has(batch.branchId)) {
      batchesByBranch.set(batch.branchId, []);
    }
    batchesByBranch.get(batch.branchId)!.push(batch);
  }

  for (const [branchId, branchBatches] of batchesByBranch) {
    const sampledBatches = branchBatches.slice(0, 3);
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branchId);

    for (const batch of sampledBatches) {
      const batchStudents = ctx.students.filter((s) => s.batchId === batch.id);
      if (batchStudents.length === 0) continue;

      const teacher = batch.classTeacherId
        ? ctx.teachers.find((t) => t.id === batch.classTeacherId)
        : branchTeachers[0];
      if (!teacher) continue;

      for (const date of workingDays) {
        try {
          const session = await prisma.attendanceSession.create({
            data: {
              orgId: batch.orgId,
              branchId: batch.branchId,
              batchId: batch.id,
              attendanceDate: date,
              createdById: teacher.id,
            },
          });
          attendanceSessionCount++;

          const records = batchStudents.map((student) => ({
            attendanceSessionId: session.id,
            studentId: student.id,
            status: (Math.random() < 0.9 ? "present" : "absent") as AttendanceStatus,
            markedAt: new Date(date.getTime() + 9 * 60 * 60 * 1000),
          }));

          await prisma.attendanceRecord.createMany({ data: records });
          attendanceRecordCount += records.length;
        } catch {
          continue;
        }
      }
    }
  }
  logSuccess(`${attendanceSessionCount} attendance sessions, ${attendanceRecordCount} records created`);

  // Staff Attendance
  logStep("Creating staff attendance...");
  const staffAttendanceData: Array<{
    orgId: string;
    branchId: string;
    userId: string;
    date: Date;
    checkIn: Date;
    checkOut: Date | null;
    status: StaffAttendanceStatus;
  }> = [];

  for (const user of ctx.users) {
    const branch = ctx.branches.find((b) => b.id === user.branchId)!;

    for (const date of workingDays) {
      const isPresent = Math.random() > 0.1;
      const isHalfDay = !isPresent && Math.random() > 0.5;

      staffAttendanceData.push({
        orgId: branch.orgId,
        branchId: user.branchId,
        userId: user.id,
        date,
        checkIn: new Date(date.getTime() + 8 * 60 * 60 * 1000),
        checkOut: isPresent ? new Date(date.getTime() + 17 * 60 * 60 * 1000) : null,
        status: isPresent ? "present" : isHalfDay ? "half_day" : "absent",
      });
    }
  }

  const chunkSize = 500;
  for (let i = 0; i < staffAttendanceData.length; i += chunkSize) {
    await prisma.staffAttendance.createMany({
      data: staffAttendanceData.slice(i, i + chunkSize),
    });
  }
  logSuccess(`${staffAttendanceData.length} staff attendance records created`);

  // Leave Applications
  logStep("Creating leave applications...");
  const leaveApplications: Array<{
    orgId: string;
    branchId: string;
    studentId: string;
    parentId: string;
    type: typeof LEAVE_TEMPLATES[0]["type"];
    reason: string;
    startDate: Date;
    endDate: Date;
    totalDays: number;
    status: StudentLeaveStatus;
    reviewedById: string | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
  }> = [];

  // 3 leave applications per branch
  for (const branch of ctx.branches) {
    const branchStudents = ctx.students.filter((s) => s.branchId === branch.id);
    const branchAdmin = ctx.users.find((u) => u.branchId === branch.id && u.role === "admin");

    for (let i = 0; i < 3 && i < branchStudents.length; i++) {
      const student = branchStudents[i];
      const parentId = ctx.studentParentMap.get(student.id);
      if (!parentId) continue;

      const template = randomElement(LEAVE_TEMPLATES);
      const startDate = addDays(new Date(), -randomInt(1, 20));
      const statuses: StudentLeaveStatus[] = ["pending", "approved", "rejected"];
      const status = statuses[i % 3];

      leaveApplications.push({
        orgId: branch.orgId,
        branchId: branch.id,
        studentId: student.id,
        parentId,
        type: template.type,
        reason: template.reason,
        startDate,
        endDate: addDays(startDate, template.days - 1),
        totalDays: template.days,
        status,
        reviewedById: status !== "pending" && branchAdmin ? branchAdmin.id : null,
        reviewedAt: status !== "pending" ? addDays(startDate, 1) : null,
        reviewNote: status === "rejected" ? "Please provide medical certificate" : null,
      });
    }
  }

  await prisma.leaveApplication.createMany({ data: leaveApplications });
  logSuccess(`${leaveApplications.length} leave applications created`);
}

// ============================================
// PHASE 7: ACADEMICS
// ============================================

async function seedPhase7Academics(ctx: SeedContext) {
  logPhase(7, "ACADEMICS (Events, Exams, Homework)");

  // Academic Events
  logStep("Creating academic events...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const branch of ctx.branches) {
    const admin = ctx.users.find((u) => u.branchId === branch.id && u.role === "admin");
    if (!admin) continue;

    const eventsData = ACADEMIC_EVENTS.map((event) => ({
      orgId: branch.orgId,
      branchId: branch.id,
      type: event.type,
      title: event.title,
      description: event.description,
      startDate: addDays(today, event.daysFromNow),
      endDate: event.durationDays ? addDays(today, event.daysFromNow + event.durationDays - 1) : null,
      isAllDay: true,
      createdById: admin.id,
    }));

    await prisma.academicEvent.createMany({ data: eventsData });
  }
  logSuccess(`Academic events created for ${ctx.branches.length} branches`);

  // Exams
  logStep("Creating exams and scores...");
  const examData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    batchId: string;
    subjectId: string | null;
    name: string;
    type: ExamType;
    totalMarks: number;
    passingMarks: number;
    examDate: Date;
    isPublished: boolean;
    createdById: string;
  }> = [];

  const examScores: Array<{
    examId: string;
    studentId: string;
    marksObtained: number | null;
    gradedById: string;
  }> = [];

  // 2 exams per batch (for sampled batches)
  const batchesByBranch = new Map<string, CreatedBatch[]>();
  for (const batch of ctx.batches) {
    if (!batchesByBranch.has(batch.branchId)) {
      batchesByBranch.set(batch.branchId, []);
    }
    batchesByBranch.get(batch.branchId)!.push(batch);
  }

  for (const [branchId, branchBatches] of batchesByBranch) {
    const sampledBatches = branchBatches.slice(0, 3);
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branchId);

    for (const batch of sampledBatches) {
      const teacher = branchTeachers[0];
      if (!teacher) continue;

      const orgSubjects = ctx.subjects.filter((s) => s.orgId === batch.orgId);
      const batchStudents = ctx.students.filter((s) => s.batchId === batch.id);

      // Unit Test (past)
      const unitTestId = randomUUID();
      examData.push({
        id: unitTestId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        batchId: batch.id,
        subjectId: orgSubjects.length > 0 ? orgSubjects[0].id : null,
        name: "Unit Test 1",
        type: "unit_test",
        totalMarks: 25,
        passingMarks: 10,
        examDate: addDays(today, -15),
        isPublished: true,
        createdById: teacher.id,
      });

      // Add scores for unit test
      for (const student of batchStudents) {
        examScores.push({
          examId: unitTestId,
          studentId: student.id,
          marksObtained: Math.random() > 0.05 ? randomInt(8, 25) : null, // 5% absent
          gradedById: teacher.id,
        });
      }

      // Mid-Term (upcoming)
      const midTermId = randomUUID();
      examData.push({
        id: midTermId,
        orgId: batch.orgId,
        branchId: batch.branchId,
        batchId: batch.id,
        subjectId: orgSubjects.length > 1 ? orgSubjects[1].id : null,
        name: "Mid-Term Exam",
        type: "mid_term",
        totalMarks: 100,
        passingMarks: 35,
        examDate: addDays(today, 30),
        isPublished: false,
        createdById: teacher.id,
      });
    }
  }

  await prisma.exam.createMany({ data: examData });
  logSuccess(`${examData.length} exams created`);

  if (examScores.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < examScores.length; i += chunkSize) {
      await prisma.examScore.createMany({
        data: examScores.slice(i, i + chunkSize),
      });
    }
    logSuccess(`${examScores.length} exam scores created`);
  }

  // Homework
  logStep("Creating homework and submissions...");
  const homeworkData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    batchId: string;
    subjectId: string | null;
    title: string;
    description: string;
    dueDate: Date;
    totalMarks: number | null;
    status: HomeworkStatus;
    createdById: string;
  }> = [];

  const homeworkSubmissions: Array<{
    homeworkId: string;
    studentId: string;
    status: SubmissionStatus;
    submittedAt: Date | null;
    marks: number | null;
    feedback: string | null;
    gradedById: string | null;
    gradedAt: Date | null;
  }> = [];

  for (const [branchId, branchBatches] of batchesByBranch) {
    const sampledBatches = branchBatches.slice(0, 3);
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branchId);

    for (const batch of sampledBatches) {
      const teacher = branchTeachers[0];
      if (!teacher) continue;

      const orgSubjects = ctx.subjects.filter((s) => s.orgId === batch.orgId);
      const batchStudents = ctx.students.filter((s) => s.batchId === batch.id);

      // 3 homework per batch
      for (let i = 0; i < 3; i++) {
        const template = HOMEWORK_TEMPLATES[i % HOMEWORK_TEMPLATES.length];
        const homeworkId = randomUUID();
        const dueDate = addDays(today, i === 0 ? -5 : i === 1 ? 3 : 10);
        const status: HomeworkStatus = i === 0 ? "closed" : i === 1 ? "published" : "draft";

        homeworkData.push({
          id: homeworkId,
          orgId: batch.orgId,
          branchId: batch.branchId,
          batchId: batch.id,
          subjectId: orgSubjects.length > i ? orgSubjects[i].id : null,
          title: template.title,
          description: template.description,
          dueDate,
          totalMarks: template.totalMarks ?? null,
          status,
          createdById: teacher.id,
        });

        // Add submissions for closed/published homework
        if (status !== "draft") {
          for (const student of batchStudents) {
            const isSubmitted = Math.random() > 0.2;
            const isGraded = status === "closed" && isSubmitted && Math.random() > 0.3;

            homeworkSubmissions.push({
              homeworkId,
              studentId: student.id,
              status: isGraded ? "graded" : isSubmitted ? "submitted" : "pending",
              submittedAt: isSubmitted ? addDays(dueDate, -randomInt(1, 3)) : null,
              marks: isGraded && template.totalMarks ? randomInt(Math.round(template.totalMarks * 0.4), template.totalMarks) : null,
              feedback: isGraded ? "Good work!" : null,
              gradedById: isGraded ? teacher.id : null,
              gradedAt: isGraded ? addDays(dueDate, 1) : null,
            });
          }
        }
      }
    }
  }

  await prisma.homework.createMany({ data: homeworkData });
  logSuccess(`${homeworkData.length} homework assignments created`);

  if (homeworkSubmissions.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < homeworkSubmissions.length; i += chunkSize) {
      await prisma.homeworkSubmission.createMany({
        data: homeworkSubmissions.slice(i, i + chunkSize),
      });
    }
    logSuccess(`${homeworkSubmissions.length} homework submissions created`);
  }
}

// ============================================
// PHASE 8: COMMUNICATION
// ============================================

async function seedPhase8Communication(ctx: SeedContext) {
  logPhase(8, "COMMUNICATION (Messages, Complaints)");

  // Conversations and Messages
  logStep("Creating conversations and messages...");
  
  for (const branch of ctx.branches) {
    const branchTeachers = ctx.teachers.filter((t) => t.branchId === branch.id);
    const branchParents = ctx.parents.filter((p) => p.branchId === branch.id);
    const branchBatches = ctx.batches.filter((b) => b.branchId === branch.id);

    if (branchTeachers.length === 0 || branchParents.length === 0) continue;

    // 3 Direct Conversations (parent-teacher)
    for (let i = 0; i < 3 && i < branchParents.length; i++) {
      const parent = branchParents[i];
      const teacher = randomElement(branchTeachers);

      const conversation = await prisma.conversation.create({
        data: {
          orgId: branch.orgId,
          branchId: branch.id,
          type: "direct",
          createdById: teacher.id,
        },
      });

      // Add participants
      await prisma.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: teacher.id },
          { conversationId: conversation.id, parentId: parent.id },
        ],
      });

      // Add 5-8 messages
      const messageCount = randomInt(5, 8);
      const messages: Array<{
        conversationId: string;
        senderUserId: string | null;
        senderParentId: string | null;
        content: string;
        createdAt: Date;
      }> = [];

      for (let m = 0; m < messageCount; m++) {
        const isFromTeacher = m % 2 === 0;
        messages.push({
          conversationId: conversation.id,
          senderUserId: isFromTeacher ? teacher.id : null,
          senderParentId: isFromTeacher ? null : parent.id,
          content: isFromTeacher
            ? randomElement([
                "Hello! How can I help you?",
                "Your child is doing well in class.",
                "Please ensure homework is completed on time.",
                "Let me check and get back to you.",
                "Thank you for reaching out.",
              ])
            : randomElement([
                "Thank you for the update.",
                "I have a question about the homework.",
                "When is the next PTM?",
                "My child will be absent tomorrow.",
                "Thank you for your help!",
              ]),
          createdAt: addDays(new Date(), -messageCount + m),
        });
      }

      await prisma.message.createMany({ data: messages });
    }

    // 1 Broadcast announcement per branch
    if (branchBatches.length > 0) {
      const batch = branchBatches[0];
      const teacher = branchTeachers[0];

      const broadcast = await prisma.conversation.create({
        data: {
          orgId: branch.orgId,
          branchId: branch.id,
          type: "broadcast",
          title: "Important Announcement",
          batchId: batch.id,
          createdById: teacher.id,
        },
      });

      await prisma.conversationParticipant.create({
        data: { conversationId: broadcast.id, userId: teacher.id },
      });

      await prisma.message.create({
        data: {
          conversationId: broadcast.id,
          senderUserId: teacher.id,
          content: "Dear Parents, please note that the school will remain closed tomorrow due to a local holiday. Classes will resume as usual the day after.",
        },
      });
    }
  }
  logSuccess(`Conversations and messages created`);

  // Complaints
  logStep("Creating complaints...");
  
  // Initialize complaint sequence for each org
  for (const org of ctx.orgs) {
    await prisma.complaintSequence.create({
      data: { orgId: org.id, lastNumber: 0 },
    });
  }

  const complaints: Array<{
    id: string;
    orgId: string;
    branchId: string;
    ticketNumber: string;
    subject: string;
    description: string;
    category: string;
    priority: typeof COMPLAINT_TEMPLATES[0]["priority"];
    status: ComplaintStatus;
    submittedByParentId: string;
    studentId: string;
    assignedToId: string | null;
    resolvedAt: Date | null;
    resolution: string | null;
  }> = [];

  const complaintComments: Array<{
    complaintId: string;
    content: string;
    authorUserId: string | null;
    authorParentId: string | null;
    isInternal: boolean;
  }> = [];

  let ticketCounter = 1;

  // 5 complaints per branch
  for (const branch of ctx.branches) {
    const branchParents = ctx.parents.filter((p) => p.branchId === branch.id);
    const branchAdmin = ctx.users.find((u) => u.branchId === branch.id && u.role === "admin");
    const branchStudents = ctx.students.filter((s) => s.branchId === branch.id);

    for (let i = 0; i < 5 && i < branchParents.length; i++) {
      const parent = branchParents[i];
      const template = COMPLAINT_TEMPLATES[i % COMPLAINT_TEMPLATES.length];
      const statuses: ComplaintStatus[] = ["open", "in_progress", "resolved", "closed", "open"];
      const status = statuses[i];

      const student = branchStudents.find((s) => parent.studentIds.includes(s.id));
      if (!student) continue;

      const complaintId = randomUUID();
      const ticketNumber = `TKT-${String(ticketCounter++).padStart(4, "0")}`;

      complaints.push({
        id: complaintId,
        orgId: branch.orgId,
        branchId: branch.id,
        ticketNumber,
        subject: template.subject,
        description: template.description,
        category: template.category,
        priority: template.priority,
        status,
        submittedByParentId: parent.id,
        studentId: student.id,
        assignedToId: status !== "open" && branchAdmin ? branchAdmin.id : null,
        resolvedAt: status === "resolved" || status === "closed" ? addDays(new Date(), -randomInt(1, 5)) : null,
        resolution: status === "resolved" || status === "closed" ? "Issue has been addressed. Thank you for bringing this to our attention." : null,
      });

      // Add comments
      if (status !== "open" && branchAdmin) {
        complaintComments.push({
          complaintId,
          content: "We have received your complaint and are looking into it.",
          authorUserId: branchAdmin.id,
          authorParentId: null,
          isInternal: false,
        });

        complaintComments.push({
          complaintId,
          content: "Internal note: Follow up with department head.",
          authorUserId: branchAdmin.id,
          authorParentId: null,
          isInternal: true,
        });
      }

      if (status === "resolved" || status === "closed") {
        complaintComments.push({
          complaintId,
          content: "Thank you for resolving this issue.",
          authorUserId: null,
          authorParentId: parent.id,
          isInternal: false,
        });
      }
    }
  }

  await prisma.complaint.createMany({ data: complaints });
  logSuccess(`${complaints.length} complaints created`);

  if (complaintComments.length > 0) {
    await prisma.complaintComment.createMany({ data: complaintComments });
    logSuccess(`${complaintComments.length} complaint comments created`);
  }

  // Update complaint sequences
  for (const org of ctx.orgs) {
    const orgComplaints = complaints.filter((c) => c.orgId === org.id);
    await prisma.complaintSequence.update({
      where: { orgId: org.id },
      data: { lastNumber: orgComplaints.length },
    });
  }
}

// ============================================
// PHASE 9: HEALTH
// ============================================

async function seedPhase9Health(ctx: SeedContext) {
  logPhase(9, "HEALTH RECORDS");

  logStep("Creating student health records...");
  
  // Health records for 30% of students
  const studentsWithHealth = ctx.students.filter(() => Math.random() < 0.3);

  const healthRecords = studentsWithHealth.map((student) => ({
    studentId: student.id,
    bloodGroup: randomElement(BLOOD_GROUPS),
    heightCm: randomInt(100, 180),
    weightKg: randomInt(20, 80),
    allergies: Math.random() > 0.7 ? randomElement(COMMON_ALLERGIES.filter((a) => a !== "None")) : "None",
    chronicConditions: Math.random() > 0.8 ? randomElement(CHRONIC_CONDITIONS.filter((c) => c !== "None")) : "None",
    visionLeft: randomElement(["normal", "corrected_with_glasses"] as const),
    visionRight: randomElement(["normal", "corrected_with_glasses"] as const),
    usesGlasses: Math.random() > 0.7,
    hearingStatus: "normal" as const,
    hasInsurance: Math.random() > 0.5,
    dietaryRestrictions: Math.random() > 0.8 ? "Vegetarian" : null,
  }));

  await prisma.studentHealth.createMany({ data: healthRecords });
  logSuccess(`${healthRecords.length} student health records created`);

  // Health checkups
  logStep("Creating health checkups...");
  const checkups = studentsWithHealth.slice(0, Math.floor(studentsWithHealth.length * 0.5)).map((student) => ({
    studentId: student.id,
    checkupDate: addDays(new Date(), -randomInt(30, 180)),
    heightCm: randomInt(100, 180),
    weightKg: randomInt(20, 80),
    bmi: randomInt(15, 30),
    visionLeft: "6/6",
    visionRight: "6/6",
    bloodPressure: "120/80",
    pulse: randomInt(70, 90),
    dentalStatus: randomElement(["Good", "Cavities", "Normal"]),
    findings: "General health is satisfactory.",
    recommendations: "Continue regular exercise and balanced diet.",
    conductedBy: "Dr. Sharma",
  }));

  await prisma.healthCheckup.createMany({ data: checkups });
  logSuccess(`${checkups.length} health checkups created`);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  const startTime = Date.now();
  console.log("\n🌱 COMPREHENSIVE DATABASE SEED");
  console.log("=".repeat(60));
  console.log("Starting seed process...\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Initialize seed context
  const ctx: SeedContext = {
    orgs: [],
    branches: [],
    sessions: [],
    users: [],
    teachers: [],
    accountants: [],
    batches: [],
    students: [],
    parents: [],
    subjects: [],
    feeComponents: [],
    scholarships: [],
    studentParentMap: new Map(),
  };

  // Clean database
  await cleanDatabase();

  // Execute all phases
  await seedPhase1CoreTenancy(ctx);
  await seedPhase2AcademicSetup(ctx);
  await seedPhase3UsersStudents(ctx, passwordHash);
  await seedPhase4Timetable(ctx);
  await seedPhase5FeeSystem(ctx);
  await seedPhase6AttendanceLeave(ctx);
  await seedPhase7Academics(ctx);
  await seedPhase8Communication(ctx);
  await seedPhase9Health(ctx);

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log(`✅ SEED COMPLETED in ${duration}s!`);
  console.log("=".repeat(60));

  console.log("\n📊 Summary:");
  console.log(`   Organizations: ${ctx.orgs.length}`);
  console.log(`   Branches: ${ctx.branches.length}`);
  console.log(`   Academic Sessions: ${ctx.sessions.length}`);
  console.log(`   Users: ${ctx.users.length} (${ctx.teachers.length} teachers)`);
  console.log(`   Batches: ${ctx.batches.length}`);
  console.log(`   Students: ${ctx.students.length}`);
  console.log(`   Parents: ${ctx.parents.length}`);

  console.log(`\n🔑 Test Credentials (Password: ${DEFAULT_PASSWORD}):`);
  console.log("-".repeat(60));

  for (const org of ctx.orgs.slice(0, 2)) {
    console.log(`\n   📌 ${org.name} (${org.type})`);
    const orgBranches = ctx.branches.filter((b) => b.orgId === org.id);
    for (const branch of orgBranches.slice(0, 1)) {
      console.log(`      🏢 ${branch.name}`);
      const branchUsers = ctx.users.filter((u) => u.branchId === branch.id);
      for (const user of branchUsers.slice(0, 3)) {
        console.log(`         ${user.employeeId} | ${user.role.padEnd(8)} | ${user.firstName} ${user.lastName}`);
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
