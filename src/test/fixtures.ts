/**
 * Test fixtures - known data from seed.ts
 * These constants match the seeded data and are used for testing
 */

// ============================================
// Organization 1 - ABC Coaching Center (Main)
// ============================================

export const ORG1 = {
  name: "ABC Coaching Center",
  type: "coaching",
};

export const ORG1_BRANCH1 = {
  name: "Main Branch",
  city: "Bangalore",
};

// Second branch in same org (for branch isolation tests)
export const ORG1_BRANCH2 = {
  name: "South Branch",
  city: "Bangalore",
};

// Users in Org1, Branch1
export const USERS = {
  admin: {
    email: "admin@abccoaching.com",
    role: "admin",
    firstName: "Rajesh",
    lastName: "Kumar",
  },
  teacher1: {
    email: "priya@abccoaching.com",
    role: "teacher",
    firstName: "Priya",
    lastName: "Sharma",
  },
  teacher2: {
    email: "amit@abccoaching.com",
    role: "teacher",
    firstName: "Amit",
    lastName: "Patel",
  },
  accounts: {
    email: "accounts@abccoaching.com",
    role: "accounts",
    firstName: "Sunita",
    lastName: "Verma",
  },
  staff: {
    email: "staff@abccoaching.com",
    role: "staff",
    firstName: "Ramesh",
    lastName: "Yadav",
  },
} as const;

// Users in Org1, Branch2 (for branch isolation tests)
export const ORG1_BRANCH2_USERS = {
  admin: {
    email: "admin.south@abccoaching.com",
    role: "admin",
    firstName: "Sunil",
    lastName: "Sharma",
  },
} as const;

// ============================================
// Organization 2 - XYZ Academy (for isolation tests)
// ============================================

export const ORG2 = {
  name: "XYZ Academy",
  type: "school",
};

export const ORG2_BRANCH1 = {
  name: "Central Campus",
  city: "Mumbai",
};

export const ORG2_USERS = {
  admin: {
    email: "admin@xyzacademy.com",
    role: "admin",
    firstName: "Vikram",
    lastName: "Desai",
  },
} as const;

// ============================================
// Batches
// ============================================

export const BATCHES = {
  class10Science: {
    name: "Class 10 - Science",
    academicLevel: "secondary",
    stream: "science",
  },
  class12Commerce: {
    name: "Class 12 - Commerce",
    academicLevel: "senior_secondary",
    stream: "commerce",
  },
} as const;

// ============================================
// Fee Plans
// ============================================

export const FEE_PLANS = {
  class10: {
    name: "Class 10 Monthly Fee",
    amount: 5000,
    cycle: "monthly",
  },
  class12: {
    name: "Class 12 Monthly Fee",
    amount: 6000,
    cycle: "monthly",
  },
} as const;

// ============================================
// Test Data Generation
// ============================================

export const TEST_STUDENT_DATA = {
  firstName: "Test",
  lastName: "Student",
  gender: "male",
  dob: "2010-05-15",
  admissionYear: 2024,
  status: "active",
  parents: [
    {
      firstName: "Test",
      lastName: "Parent",
      phone: "9999999999",
      relation: "father",
    },
  ],
};

export const TEST_BATCH_DATA = {
  name: "Test Batch",
  academicLevel: "secondary",
  stream: "science",
  isActive: true,
};

export const TEST_ATTENDANCE_DATA = {
  date: new Date().toISOString().split("T")[0], // Today's date
};
