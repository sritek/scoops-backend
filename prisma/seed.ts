import { PrismaClient, Student } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Clean existing data (in reverse order of dependencies)
  console.log("Cleaning existing data...");
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
  // Organization 1: ABC Coaching Center
  // ============================================
  console.log("Creating Organization 1 (ABC Coaching Center)...");
  const org1 = await prisma.organization.create({
    data: {
      name: "ABC Coaching Center",
      type: "coaching",
      language: "en",
      timezone: "Asia/Kolkata",
    },
  });

  // Branch 1 of Org 1 (Main Branch)
  console.log("Creating Branch 1 (Main Branch)...");
  const org1Branch1 = await prisma.branch.create({
    data: {
      orgId: org1.id,
      name: "Main Branch",
      address: "123 Education Street",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
      isDefault: true,
    },
  });

  // Branch 2 of Org 1 (South Branch - for branch isolation tests)
  console.log("Creating Branch 2 (South Branch)...");
  const org1Branch2 = await prisma.branch.create({
    data: {
      orgId: org1.id,
      name: "South Branch",
      address: "456 Learning Avenue",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560068",
      isDefault: false,
    },
  });

  // Users for Org 1, Branch 1
  console.log("Creating users for Org 1, Branch 1...");
  const admin = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      firstName: "Rajesh",
      lastName: "Kumar",
      phone: "9876543210",
      email: "admin@abccoaching.com",
      role: "admin",
      isActive: true,
    },
  });

  const teacher1 = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      firstName: "Priya",
      lastName: "Sharma",
      phone: "9876543211",
      email: "priya@abccoaching.com",
      role: "teacher",
      isActive: true,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      firstName: "Amit",
      lastName: "Patel",
      phone: "9876543212",
      email: "amit@abccoaching.com",
      role: "teacher",
      isActive: true,
    },
  });

  const accountant = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      firstName: "Sunita",
      lastName: "Verma",
      phone: "9876543213",
      email: "accounts@abccoaching.com",
      role: "accounts",
      isActive: true,
    },
  });

  const staff = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      firstName: "Ramesh",
      lastName: "Yadav",
      phone: "9876543214",
      email: "staff@abccoaching.com",
      role: "staff",
      isActive: true,
    },
  });

  // Users for Org 1, Branch 2 (for branch isolation tests)
  console.log("Creating users for Org 1, Branch 2...");
  const org1Branch2Admin = await prisma.user.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch2.id,
      firstName: "Sunil",
      lastName: "Sharma",
      phone: "9876543220",
      email: "admin.south@abccoaching.com",
      role: "admin",
      isActive: true,
    },
  });

  // ============================================
  // Organization 2: XYZ Academy (for org isolation tests)
  // ============================================
  console.log("Creating Organization 2 (XYZ Academy)...");
  const org2 = await prisma.organization.create({
    data: {
      name: "XYZ Academy",
      type: "school",
      language: "en",
      timezone: "Asia/Kolkata",
    },
  });

  // Branch 1 of Org 2 (Central Campus)
  console.log("Creating Branch 1 of Org 2 (Central Campus)...");
  const org2Branch1 = await prisma.branch.create({
    data: {
      orgId: org2.id,
      name: "Central Campus",
      address: "789 Knowledge Park",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      isDefault: true,
    },
  });

  // Users for Org 2
  console.log("Creating users for Org 2...");
  const org2Admin = await prisma.user.create({
    data: {
      orgId: org2.id,
      branchId: org2Branch1.id,
      firstName: "Vikram",
      lastName: "Desai",
      phone: "9876543230",
      email: "admin@xyzacademy.com",
      role: "admin",
      isActive: true,
    },
  });

  // ============================================
  // Batches for Org 1, Branch 1
  // ============================================
  console.log("Creating batches for Org 1, Branch 1...");
  const batch10Science = await prisma.batch.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      name: "Class 10 - Science",
      academicLevel: "secondary",
      stream: "science",
      teacherId: teacher1.id,
      isActive: true,
    },
  });

  const batch12Commerce = await prisma.batch.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      name: "Class 12 - Commerce",
      academicLevel: "senior_secondary",
      stream: "commerce",
      teacherId: teacher2.id,
      isActive: true,
    },
  });

  // Batch for Org 1, Branch 2
  console.log("Creating batch for Org 1, Branch 2...");
  const org1Branch2Batch = await prisma.batch.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch2.id,
      name: "Class 9 - General",
      academicLevel: "secondary",
      stream: "general",
      isActive: true,
    },
  });

  // Batch for Org 2
  console.log("Creating batch for Org 2...");
  const org2Batch = await prisma.batch.create({
    data: {
      orgId: org2.id,
      branchId: org2Branch1.id,
      name: "Class 8 - Foundation",
      academicLevel: "middle",
      stream: "general",
      isActive: true,
    },
  });

  // ============================================
  // Students and Parents for Org 1, Branch 1
  // ============================================
  console.log("Creating students and parents for Org 1, Branch 1...");

  // Class 10 Students
  const class10Students = [
    {
      firstName: "Arun",
      lastName: "Mehta",
      gender: "male",
      parentFirstName: "Vijay",
      parentLastName: "Mehta",
      parentPhone: "9811111111",
    },
    {
      firstName: "Sneha",
      lastName: "Gupta",
      gender: "female",
      parentFirstName: "Rakesh",
      parentLastName: "Gupta",
      parentPhone: "9811111112",
    },
    {
      firstName: "Rohit",
      lastName: "Singh",
      gender: "male",
      parentFirstName: "Manoj",
      parentLastName: "Singh",
      parentPhone: "9811111113",
    },
    {
      firstName: "Anjali",
      lastName: "Reddy",
      gender: "female",
      parentFirstName: "Krishna",
      parentLastName: "Reddy",
      parentPhone: "9811111114",
    },
    {
      firstName: "Vikram",
      lastName: "Joshi",
      gender: "male",
      parentFirstName: "Suresh",
      parentLastName: "Joshi",
      parentPhone: "9811111115",
    },
  ];

  const class10StudentRecords: Student[] = [];
  for (const s of class10Students) {
    const student = await prisma.student.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch1.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dob: new Date(
          2010,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        ),
        admissionYear: 2024,
        batchId: batch10Science.id,
        status: "active",
      },
    });

    const parent = await prisma.parent.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch1.id,
        firstName: s.parentFirstName,
        lastName: s.parentLastName,
        phone: s.parentPhone,
      },
    });

    await prisma.studentParent.create({
      data: {
        studentId: student.id,
        parentId: parent.id,
        relation: "father",
      },
    });

    class10StudentRecords.push(student);
  }

  // Class 12 Students
  const class12Students = [
    {
      firstName: "Kavya",
      lastName: "Nair",
      gender: "female",
      parentFirstName: "Gopal",
      parentLastName: "Nair",
      parentPhone: "9822222221",
    },
    {
      firstName: "Arjun",
      lastName: "Das",
      gender: "male",
      parentFirstName: "Bikash",
      parentLastName: "Das",
      parentPhone: "9822222222",
    },
    {
      firstName: "Meera",
      lastName: "Iyer",
      gender: "female",
      parentFirstName: "Ramesh",
      parentLastName: "Iyer",
      parentPhone: "9822222223",
    },
    {
      firstName: "Sanjay",
      lastName: "Pillai",
      gender: "male",
      parentFirstName: "Mohan",
      parentLastName: "Pillai",
      parentPhone: "9822222224",
    },
    {
      firstName: "Divya",
      lastName: "Menon",
      gender: "female",
      parentFirstName: "Anil",
      parentLastName: "Menon",
      parentPhone: "9822222225",
    },
  ];

  const class12StudentRecords: Student[] = [];
  for (const s of class12Students) {
    const student = await prisma.student.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch1.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dob: new Date(
          2008,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        ),
        admissionYear: 2024,
        batchId: batch12Commerce.id,
        status: "active",
      },
    });

    const parent = await prisma.parent.create({
      data: {
        orgId: org1.id,
        branchId: org1Branch1.id,
        firstName: s.parentFirstName,
        lastName: s.parentLastName,
        phone: s.parentPhone,
      },
    });

    await prisma.studentParent.create({
      data: {
        studentId: student.id,
        parentId: parent.id,
        relation: "father",
      },
    });

    class12StudentRecords.push(student);
  }

  // ============================================
  // Student for Org 1, Branch 2 (for isolation tests)
  // ============================================
  console.log("Creating student for Org 1, Branch 2...");
  const branch2Student = await prisma.student.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch2.id,
      firstName: "Kiran",
      lastName: "Shah",
      gender: "male",
      dob: new Date(2011, 5, 15),
      admissionYear: 2024,
      batchId: org1Branch2Batch.id,
      status: "active",
    },
  });

  const branch2Parent = await prisma.parent.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch2.id,
      firstName: "Dilip",
      lastName: "Shah",
      phone: "9833333331",
    },
  });

  await prisma.studentParent.create({
    data: {
      studentId: branch2Student.id,
      parentId: branch2Parent.id,
      relation: "father",
    },
  });

  // ============================================
  // Student for Org 2 (for isolation tests)
  // ============================================
  console.log("Creating student for Org 2...");
  const org2Student = await prisma.student.create({
    data: {
      orgId: org2.id,
      branchId: org2Branch1.id,
      firstName: "Ananya",
      lastName: "Kapoor",
      gender: "female",
      dob: new Date(2012, 3, 20),
      admissionYear: 2024,
      batchId: org2Batch.id,
      status: "active",
    },
  });

  const org2Parent = await prisma.parent.create({
    data: {
      orgId: org2.id,
      branchId: org2Branch1.id,
      firstName: "Raj",
      lastName: "Kapoor",
      phone: "9844444441",
    },
  });

  await prisma.studentParent.create({
    data: {
      studentId: org2Student.id,
      parentId: org2Parent.id,
      relation: "father",
    },
  });

  // ============================================
  // Fee Plans
  // ============================================
  console.log("Creating fee plans...");
  const feePlan10 = await prisma.feePlan.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      name: "Monthly Tuition - Class 10",
      amount: 3000,
      frequency: "monthly",
      isActive: true,
    },
  });

  const feePlan12 = await prisma.feePlan.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      name: "Monthly Tuition - Class 12",
      amount: 4000,
      frequency: "monthly",
      isActive: true,
    },
  });

  // Assign fees to students
  console.log("Assigning fees to students...");
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days

  for (const student of class10StudentRecords) {
    await prisma.studentFee.create({
      data: {
        studentId: student.id,
        feePlanId: feePlan10.id,
        totalAmount: 3000,
        paidAmount: 0,
        dueDate,
        status: "pending",
      },
    });
  }

  for (const student of class12StudentRecords) {
    await prisma.studentFee.create({
      data: {
        studentId: student.id,
        feePlanId: feePlan12.id,
        totalAmount: 4000,
        paidAmount: 0,
        dueDate,
        status: "pending",
      },
    });
  }

  // Create some payments for variety
  console.log("Creating sample payments...");
  const feeToPayPartial = await prisma.studentFee.findFirst({
    where: { studentId: class10StudentRecords[0].id },
  });

  if (feeToPayPartial) {
    await prisma.feePayment.create({
      data: {
        studentFeeId: feeToPayPartial.id,
        amount: 1500,
        paymentMode: "cash",
        receivedById: accountant.id,
        receivedAt: new Date(),
      },
    });

    await prisma.studentFee.update({
      where: { id: feeToPayPartial.id },
      data: {
        paidAmount: 1500,
        status: "partial",
      },
    });
  }

  const feeToPayFull = await prisma.studentFee.findFirst({
    where: { studentId: class12StudentRecords[0].id },
  });

  if (feeToPayFull) {
    await prisma.feePayment.create({
      data: {
        studentFeeId: feeToPayFull.id,
        amount: 4000,
        paymentMode: "upi",
        receivedById: accountant.id,
        receivedAt: new Date(),
      },
    });

    await prisma.studentFee.update({
      where: { id: feeToPayFull.id },
      data: {
        paidAmount: 4000,
        status: "paid",
      },
    });
  }

  // ============================================
  // Message Templates
  // ============================================
  console.log("Creating message templates...");
  await prisma.messageTemplate.createMany({
    data: [
      {
        orgId: org1.id,
        type: "absent",
        content:
          "Dear Parent, your child {{studentName}} was absent today ({{date}}). Please contact us if you need assistance.",
        isActive: true,
      },
      {
        orgId: org1.id,
        type: "fee_due",
        content:
          "Dear Parent, a fee of ₹{{amount}} for {{studentName}} is due on {{dueDate}}. Please make the payment at your earliest convenience.",
        isActive: true,
      },
      {
        orgId: org1.id,
        type: "fee_paid",
        content:
          "Dear Parent, we have received a payment of ₹{{amount}} for {{studentName}} via {{paymentMode}}. Thank you!",
        isActive: true,
      },
    ],
  });

  // ============================================
  // Sample Attendance
  // ============================================
  console.log("Creating sample attendance...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const session10 = await prisma.attendanceSession.create({
    data: {
      orgId: org1.id,
      branchId: org1Branch1.id,
      batchId: batch10Science.id,
      attendanceDate: today,
      createdById: teacher1.id,
    },
  });

  for (let i = 0; i < class10StudentRecords.length; i++) {
    await prisma.attendanceRecord.create({
      data: {
        attendanceSessionId: session10.id,
        studentId: class10StudentRecords[i].id,
        status: i === 2 ? "absent" : "present", // One student absent
        markedAt: new Date(),
      },
    });
  }

  // ============================================
  // Summary Output
  // ============================================
  console.log("\n✅ Seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log("   --- Organization 1: ABC Coaching Center ---");
  console.log(`   Branch 1 (Main): ${org1Branch1.name}`);
  console.log(`     - Admin: ${admin.email}`);
  console.log(`     - Teacher 1: ${teacher1.email}`);
  console.log(`     - Teacher 2: ${teacher2.email}`);
  console.log(`     - Accountant: ${accountant.email}`);
  console.log(`     - Staff: ${staff.email}`);
  console.log(`     - Batches: 2, Students: 10`);
  console.log(`   Branch 2 (South): ${org1Branch2.name}`);
  console.log(`     - Admin: ${org1Branch2Admin.email}`);
  console.log(`     - Batches: 1, Students: 1`);
  console.log("\n   --- Organization 2: XYZ Academy ---");
  console.log(`   Branch 1 (Central): ${org2Branch1.name}`);
  console.log(`     - Admin: ${org2Admin.email}`);
  console.log(`     - Batches: 1, Students: 1`);

  console.log("\n🔑 Test Users:");
  console.log("   Org 1, Branch 1:");
  console.log(`     Admin: ${admin.email}`);
  console.log(`     Teacher: ${teacher1.email}`);
  console.log(`     Accounts: ${accountant.email}`);
  console.log(`     Staff: ${staff.email}`);
  console.log("   Org 1, Branch 2:");
  console.log(`     Admin: ${org1Branch2Admin.email}`);
  console.log("   Org 2:");
  console.log(`     Admin: ${org2Admin.email}`);

  // Suppress unused variable warnings
  void org1Branch2Batch;
  void org2Batch;
  void branch2Student;
  void org2Student;
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
