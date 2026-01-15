import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = "Password123";

// ============================================
// DATA HELPERS
// ============================================

const FIRST_NAMES_MALE = ["Aarav", "Arjun", "Ishaan", "Vihaan", "Rohan", "Kabir", "Dev", "Karan", "Rahul", "Amit"];
const FIRST_NAMES_FEMALE = ["Ananya", "Diya", "Kavya", "Priya", "Sneha", "Riya", "Meera", "Anjali", "Neha", "Pooja"];
const LAST_NAMES = ["Sharma", "Gupta", "Singh", "Kumar", "Patel", "Verma", "Joshi", "Mehta", "Shah", "Reddy"];
const CATEGORIES = ["gen", "obc", "sc", "st", "ews"];
const PAYMENT_MODES: Array<"cash" | "upi" | "bank"> = ["cash", "upi", "bank"];

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
  return "98" + Math.random().toString().slice(2, 10);
}

// ============================================
// MAIN SEED
// ============================================

async function main() {
  console.log("🌱 Starting seed...\n");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Clean existing data
  console.log("🧹 Cleaning existing data...");
  await prisma.notificationLog.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.event.deleteMany();
  await prisma.feePayment.deleteMany();
  await prisma.studentFee.deleteMany();
  await prisma.feePlan.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.studentParent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();

  // ============================================
  // ORG 1: ABC Coaching Center
  // ============================================
  console.log("\n📦 Creating ABC Coaching Center...");

  const org1 = await prisma.organization.create({
    data: { name: "ABC Coaching Center", type: "coaching", language: "en", timezone: "Asia/Kolkata" },
  });

  const org1Branch1 = await prisma.branch.create({
    data: { orgId: org1.id, name: "Main Branch", address: "123 MG Road", city: "Bangalore", state: "Karnataka", pincode: "560001", isDefault: true },
  });

  const org1Branch2 = await prisma.branch.create({
    data: { orgId: org1.id, name: "South Branch", address: "456 BTM Layout", city: "Bangalore", state: "Karnataka", pincode: "560068", isDefault: false },
  });

  // Users for Org1
  const org1Admin = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Rajesh", lastName: "Kumar", phone: "9876543210", email: "admin@abccoaching.com", role: "admin", isActive: true },
  });

  const org1Teacher1 = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Priya", lastName: "Sharma", phone: "9876543211", email: "priya@abccoaching.com", role: "teacher", isActive: true },
  });

  const org1Teacher2 = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Amit", lastName: "Patel", phone: "9876543212", email: "amit@abccoaching.com", role: "teacher", isActive: true },
  });

  const org1Accountant = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Sunita", lastName: "Verma", phone: "9876543213", email: "accounts@abccoaching.com", role: "accounts", isActive: true },
  });

  const org1Staff = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Ramesh", lastName: "Yadav", phone: "9876543214", email: "staff@abccoaching.com", role: "staff", isActive: true },
  });

  const org1Branch2Admin = await prisma.user.create({
    data: { orgId: org1.id, branchId: org1Branch2.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Sunil", lastName: "Sharma", phone: "9876543220", email: "admin.south@abccoaching.com", role: "admin", isActive: true },
  });

  // Batches for Org1
  const batch10Science = await prisma.batch.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, name: "JEE Foundation", academicLevel: "secondary", stream: "science", teacherId: org1Teacher1.id, isActive: true },
  });

  const batch12Commerce = await prisma.batch.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, name: "NEET Crash Course", academicLevel: "senior_secondary", stream: "science", teacherId: org1Teacher2.id, isActive: true },
  });

  const batch9General = await prisma.batch.create({
    data: { orgId: org1.id, branchId: org1Branch2.id, name: "Board Prep - Class 10", academicLevel: "secondary", stream: null, isActive: true },
  });

  // Fee Plans for Org1
  const feePlan1 = await prisma.feePlan.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, name: "Monthly Tuition - Secondary", amount: 3500, frequency: "monthly", isActive: true },
  });

  const feePlan2 = await prisma.feePlan.create({
    data: { orgId: org1.id, branchId: org1Branch1.id, name: "Monthly Tuition - Senior Secondary", amount: 5000, frequency: "monthly", isActive: true },
  });

  const feePlan3 = await prisma.feePlan.create({
    data: { orgId: org1.id, branchId: org1Branch2.id, name: "Monthly Tuition - Secondary", amount: 3000, frequency: "monthly", isActive: true },
  });

  // ============================================
  // ORG 2: Sunrise School
  // ============================================
  console.log("📦 Creating Sunrise School...");

  const org2 = await prisma.organization.create({
    data: { name: "Sunrise Public School", type: "school", language: "en", timezone: "Asia/Kolkata" },
  });

  const org2Branch1 = await prisma.branch.create({
    data: { orgId: org2.id, name: "Main Campus", address: "789 Knowledge Park", city: "Pune", state: "Maharashtra", pincode: "411001", isDefault: true },
  });

  const org2Admin = await prisma.user.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Vikram", lastName: "Desai", phone: "9876543230", email: "admin@sunriseschool.com", role: "admin", isActive: true },
  });

  const org2Teacher = await prisma.user.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Meera", lastName: "Iyer", phone: "9876543231", email: "meera@sunriseschool.com", role: "teacher", isActive: true },
  });

  const org2Accountant = await prisma.user.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, employeeId: generateEmployeeId(), passwordHash, mustChangePassword: true, firstName: "Gopal", lastName: "Nair", phone: "9876543232", email: "accounts@sunriseschool.com", role: "accounts", isActive: true },
  });

  const org2Batch1 = await prisma.batch.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, name: "Class 8", academicLevel: "middle", stream: null, teacherId: org2Teacher.id, isActive: true },
  });

  const org2Batch2 = await prisma.batch.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, name: "Class 10 - Science", academicLevel: "secondary", stream: "science", teacherId: org2Teacher.id, isActive: true },
  });

  const org2FeePlan = await prisma.feePlan.create({
    data: { orgId: org2.id, branchId: org2Branch1.id, name: "Monthly Tuition", amount: 4000, frequency: "monthly", isActive: true },
  });

  // ============================================
  // CREATE STUDENTS (25 per org)
  // ============================================
  console.log("👨‍🎓 Creating students...");

  const allStudents: Array<{ id: string; batchId: string | null; branchId: string; orgId: string }> = [];

  // Org1 Branch1 - 15 students
  for (let i = 0; i < 15; i++) {
    const isMale = Math.random() > 0.5;
    const batch = i < 8 ? batch10Science : batch12Commerce;
    const student = await prisma.student.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch1.id,
        firstName: randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
        lastName: randomElement(LAST_NAMES),
        gender: isMale ? "male" : "female",
        dob: new Date(randomInt(2007, 2012), randomInt(0, 11), randomInt(1, 28)),
        category: randomElement(CATEGORIES),
        admissionYear: randomInt(2022, 2025),
        batchId: batch.id,
        status: "active",
      },
    });
    allStudents.push(student);

    // Create parent
    const parent = await prisma.parent.create({
      data: { orgId: org1.id, branchId: org1Branch1.id, firstName: randomElement(FIRST_NAMES_MALE), lastName: student.lastName, phone: generatePhone() },
    });
    await prisma.studentParent.create({ data: { studentId: student.id, parentId: parent.id, relation: "father" } });
  }

  // Org1 Branch2 - 10 students
  for (let i = 0; i < 10; i++) {
    const isMale = Math.random() > 0.5;
    const student = await prisma.student.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch2.id,
        firstName: randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
        lastName: randomElement(LAST_NAMES),
        gender: isMale ? "male" : "female",
        dob: new Date(randomInt(2009, 2012), randomInt(0, 11), randomInt(1, 28)),
        category: randomElement(CATEGORIES),
        admissionYear: randomInt(2022, 2025),
        batchId: batch9General.id,
        status: "active",
      },
    });
    allStudents.push(student);

    const parent = await prisma.parent.create({
      data: { orgId: org1.id, branchId: org1Branch2.id, firstName: randomElement(FIRST_NAMES_MALE), lastName: student.lastName, phone: generatePhone() },
    });
    await prisma.studentParent.create({ data: { studentId: student.id, parentId: parent.id, relation: "father" } });
  }

  // Org2 - 20 students
  for (let i = 0; i < 20; i++) {
    const isMale = Math.random() > 0.5;
    const batch = i < 10 ? org2Batch1 : org2Batch2;
    const student = await prisma.student.create({
      data: {
        orgId: org2.id,
        branchId: org2Branch1.id,
        firstName: randomElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
        lastName: randomElement(LAST_NAMES),
        gender: isMale ? "male" : "female",
        dob: new Date(randomInt(2008, 2013), randomInt(0, 11), randomInt(1, 28)),
        category: randomElement(CATEGORIES),
        admissionYear: randomInt(2022, 2025),
        batchId: batch.id,
        status: "active",
      },
    });
    allStudents.push(student);

    const parent = await prisma.parent.create({
      data: { orgId: org2.id, branchId: org2Branch1.id, firstName: randomElement(FIRST_NAMES_MALE), lastName: student.lastName, phone: generatePhone() },
    });
    await prisma.studentParent.create({ data: { studentId: student.id, parentId: parent.id, relation: "father" } });
  }

  // ============================================
  // CREATE FEES AND PAYMENTS
  // ============================================
  console.log("💳 Creating fees and payments...");

  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 10);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 10);

  for (const student of allStudents) {
    let feePlan: typeof feePlan1;
    if (student.orgId === org1.id) {
      if (student.branchId === org1Branch1.id) {
        feePlan = student.batchId === batch10Science.id ? feePlan1 : feePlan2;
      } else {
        feePlan = feePlan3;
      }
    } else {
      feePlan = org2FeePlan;
    }

    // Last month fee - mostly paid
    const lastMonthPaid = Math.random() < 0.8;
    const lastMonthPartial = !lastMonthPaid && Math.random() < 0.5;
    const lastMonthPaidAmount = lastMonthPaid ? feePlan.amount : lastMonthPartial ? Math.floor(feePlan.amount * 0.5) : 0;

    const lastMonthFee = await prisma.studentFee.create({
      data: {
        studentId: student.id,
        feePlanId: feePlan.id,
        totalAmount: feePlan.amount,
        paidAmount: lastMonthPaidAmount,
        dueDate: lastMonth,
        status: lastMonthPaid ? "paid" : lastMonthPartial ? "partial" : "pending",
      },
    });

    if (lastMonthPaidAmount > 0) {
      const receiverId = student.orgId === org1.id ? org1Accountant.id : org2Accountant.id;
      await prisma.feePayment.create({
        data: { studentFeeId: lastMonthFee.id, amount: lastMonthPaidAmount, paymentMode: randomElement(PAYMENT_MODES), receivedById: receiverId, receivedAt: new Date(lastMonth.getTime() + randomInt(1, 10) * 24 * 60 * 60 * 1000) },
      });
    }

    // This month fee - some pending
    const thisMonthPaid = Math.random() < 0.4;
    const thisMonthPaidAmount = thisMonthPaid ? feePlan.amount : 0;

    const thisMonthFee = await prisma.studentFee.create({
      data: {
        studentId: student.id,
        feePlanId: feePlan.id,
        totalAmount: feePlan.amount,
        paidAmount: thisMonthPaidAmount,
        dueDate: thisMonth,
        status: thisMonthPaid ? "paid" : "pending",
      },
    });

    if (thisMonthPaidAmount > 0) {
      const receiverId = student.orgId === org1.id ? org1Accountant.id : org2Accountant.id;
      await prisma.feePayment.create({
        data: { studentFeeId: thisMonthFee.id, amount: thisMonthPaidAmount, paymentMode: randomElement(PAYMENT_MODES), receivedById: receiverId, receivedAt: new Date() },
      });
    }
  }

  // ============================================
  // CREATE ATTENDANCE (last 7 days)
  // ============================================
  console.log("📋 Creating attendance...");

  const batches = [
    { batch: batch10Science, teacher: org1Teacher1, orgId: org1.id, branchId: org1Branch1.id },
    { batch: batch12Commerce, teacher: org1Teacher2, orgId: org1.id, branchId: org1Branch1.id },
    { batch: batch9General, teacher: org1Branch2Admin, orgId: org1.id, branchId: org1Branch2.id },
    { batch: org2Batch1, teacher: org2Teacher, orgId: org2.id, branchId: org2Branch1.id },
    { batch: org2Batch2, teacher: org2Teacher, orgId: org2.id, branchId: org2Branch1.id },
  ];

  for (const { batch, teacher, orgId, branchId } of batches) {
    const batchStudents = allStudents.filter((s) => s.batchId === batch.id);

    for (let d = 1; d <= 7; d++) {
      const attendanceDate = new Date(today);
      attendanceDate.setDate(attendanceDate.getDate() - d);
      attendanceDate.setHours(0, 0, 0, 0);

      if (attendanceDate.getDay() === 0) continue; // Skip Sunday

      try {
        const session = await prisma.attendanceSession.create({
          data: { orgId, branchId, batchId: batch.id, attendanceDate, createdById: teacher.id },
        });

        for (const student of batchStudents) {
          await prisma.attendanceRecord.create({
            data: {
              attendanceSessionId: session.id,
              studentId: student.id,
              status: Math.random() < 0.9 ? "present" : "absent",
              markedAt: new Date(attendanceDate.getTime() + 9 * 60 * 60 * 1000),
            },
          });
        }
      } catch {
        continue;
      }
    }
  }

  // ============================================
  // MESSAGE TEMPLATES
  // ============================================
  await prisma.messageTemplate.createMany({
    data: [
      { orgId: org1.id, type: "absent", content: "Dear Parent, {{studentName}} was absent on {{date}}. - ABC Coaching", isActive: true },
      { orgId: org1.id, type: "fee_due", content: "Fee of ₹{{amount}} due for {{studentName}} on {{dueDate}}. - ABC Coaching", isActive: true },
      { orgId: org2.id, type: "absent", content: "Dear Parent, {{studentName}} was absent on {{date}}. - Sunrise School", isActive: true },
      { orgId: org2.id, type: "fee_due", content: "Fee of ₹{{amount}} due for {{studentName}} on {{dueDate}}. - Sunrise School", isActive: true },
    ],
  });

  // ============================================
  // SUMMARY
  // ============================================
  const studentCount = await prisma.student.count();
  const feeCount = await prisma.studentFee.count();
  const paymentCount = await prisma.feePayment.count();
  const attendanceCount = await prisma.attendanceRecord.count();

  console.log("\n" + "=".repeat(50));
  console.log("✅ SEED COMPLETED!");
  console.log("=".repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`   Organizations: 2`);
  console.log(`   Branches: 3`);
  console.log(`   Users: 10`);
  console.log(`   Batches: 5`);
  console.log(`   Students: ${studentCount}`);
  console.log(`   Fee Records: ${feeCount}`);
  console.log(`   Payments: ${paymentCount}`);
  console.log(`   Attendance Records: ${attendanceCount}`);

  console.log(`\n🔑 Test Credentials (Password: ${DEFAULT_PASSWORD}):`);
  console.log(`\n   ABC Coaching Center:`);
  console.log(`      Main Branch Admin: ${org1Admin.employeeId} (${org1Admin.firstName} ${org1Admin.lastName})`);
  console.log(`      Teacher: ${org1Teacher1.employeeId} (${org1Teacher1.firstName} ${org1Teacher1.lastName})`);
  console.log(`      Accountant: ${org1Accountant.employeeId}`);
  console.log(`      South Branch Admin: ${org1Branch2Admin.employeeId}`);
  console.log(`\n   Sunrise School:`);
  console.log(`      Admin: ${org2Admin.employeeId} (${org2Admin.firstName} ${org2Admin.lastName})`);
  console.log(`      Teacher: ${org2Teacher.employeeId}`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
