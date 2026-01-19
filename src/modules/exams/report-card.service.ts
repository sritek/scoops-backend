/**
 * Report Card PDF Service
 *
 * Generates PDF report cards for students showing all their exam results
 */

import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import { prisma } from "../../config/database.js";
import type { TenantScope } from "../../types/request.js";
import { NotFoundError } from "../../utils/error-handler.js";

/**
 * Calculate grade based on percentage
 */
function calculateGrade(marksObtained: number | null, totalMarks: number): string {
  if (marksObtained === null) return "AB"; // Absent

  const percentage = (marksObtained / totalMarks) * 100;

  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  if (percentage >= 33) return "D";
  return "F";
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format exam type for display
 */
function formatExamType(type: string): string {
  const types: Record<string, string> = {
    unit_test: "Unit Test",
    mid_term: "Mid-Term",
    final: "Final",
    practical: "Practical",
    assignment: "Assignment",
  };
  return types[type] || type;
}

/**
 * Get report card data for PDF generation
 */
async function getReportCardData(studentId: string, scope: TenantScope) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      orgId: scope.orgId,
      branchId: scope.branchId,
    },
    include: {
      batch: { select: { name: true } },
      organization: {
        select: {
          name: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true,
        },
      },
      branch: { select: { name: true } },
    },
  });

  if (!student) {
    throw new NotFoundError("Student");
  }

  const scores = await prisma.examScore.findMany({
    where: {
      studentId,
      exam: {
        isPublished: true,
        branchId: scope.branchId,
      },
    },
    include: {
      exam: {
        select: {
          id: true,
          name: true,
          type: true,
          totalMarks: true,
          passingMarks: true,
          examDate: true,
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: { exam: { examDate: "desc" } },
  });

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      batchName: student.batch?.name || "N/A",
      branchName: student.branch?.name || "N/A",
    },
    organization: student.organization,
    exams: scores.map((s) => ({
      examName: s.exam.name,
      examType: s.exam.type,
      subjectName: s.exam.subject?.name || "General",
      examDate: s.exam.examDate,
      totalMarks: s.exam.totalMarks,
      passingMarks: s.exam.passingMarks,
      marksObtained: s.marksObtained,
      grade: calculateGrade(s.marksObtained, s.exam.totalMarks),
      isPassed: s.marksObtained !== null && s.marksObtained >= s.exam.passingMarks,
    })),
  };
}

/**
 * Generate PDF for a student's report card
 * Returns a readable stream that can be piped to response
 */
export async function generateReportCardPDF(
  studentId: string,
  scope: TenantScope
): Promise<{ stream: Readable; fileName: string }> {
  const data = await getReportCardData(studentId, scope);

  // Create PDF document
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `Report Card - ${data.student.name}`,
      Author: data.organization.name,
    },
  });

  const pageWidth = doc.page.width - 100;

  // Header - Organization details
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(data.organization.name, 50, 50, {
      align: "center",
      width: pageWidth,
    });

  // Organization contact
  const contactParts: string[] = [];
  if (data.organization.address) contactParts.push(data.organization.address);
  if (data.organization.phone) contactParts.push(`Phone: ${data.organization.phone}`);
  if (data.organization.email) contactParts.push(`Email: ${data.organization.email}`);

  if (contactParts.length > 0) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(contactParts.join(" | "), 50, 75, {
        align: "center",
        width: pageWidth,
      });
  }

  // Report Card Title
  doc.moveDown(1.5);
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("STUDENT REPORT CARD", 50, doc.y, {
      align: "center",
      width: pageWidth,
    });

  // Horizontal line
  doc.moveDown(0.5);
  const lineY = doc.y;
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, lineY)
    .lineTo(545, lineY)
    .stroke();

  // Student details box
  doc.moveDown(1);
  const boxTop = doc.y;
  doc.rect(50, boxTop, 495, 60).stroke("#cccccc");

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000").text("Student Details", 60, boxTop + 10);

  doc.fontSize(10).font("Helvetica-Bold").text("Name:", 60, boxTop + 30);
  doc.font("Helvetica").text(data.student.name, 110, boxTop + 30);

  doc.font("Helvetica-Bold").text("Class/Batch:", 280, boxTop + 30);
  doc.font("Helvetica").text(data.student.batchName, 360, boxTop + 30);

  doc.font("Helvetica-Bold").text("Student ID:", 60, boxTop + 45);
  doc.font("Helvetica").text(data.student.id.substring(0, 8).toUpperCase(), 130, boxTop + 45);

  doc.font("Helvetica-Bold").text("Branch:", 280, boxTop + 45);
  doc.font("Helvetica").text(data.student.branchName, 330, boxTop + 45);

  // Exam Results Section
  doc.y = boxTop + 80;
  doc.fontSize(12).font("Helvetica-Bold").text("Examination Results", 50, doc.y);

  if (data.exams.length === 0) {
    doc.moveDown(1);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666666")
      .text("No published exam results available.", 50, doc.y, {
        align: "center",
        width: pageWidth,
      });
  } else {
    // Table header
    doc.moveDown(0.5);
    const tableTop = doc.y;
    const colWidths = {
      date: 70,
      exam: 100,
      subject: 80,
      marks: 60,
      total: 50,
      grade: 50,
      status: 60,
    };

    // Header row
    doc.rect(50, tableTop, 495, 22).fill("#f5f5f5").stroke("#cccccc");

    doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
    let xPos = 55;
    doc.text("Date", xPos, tableTop + 7);
    xPos += colWidths.date;
    doc.text("Exam", xPos, tableTop + 7);
    xPos += colWidths.exam;
    doc.text("Subject", xPos, tableTop + 7);
    xPos += colWidths.subject;
    doc.text("Marks", xPos, tableTop + 7);
    xPos += colWidths.marks;
    doc.text("Total", xPos, tableTop + 7);
    xPos += colWidths.total;
    doc.text("Grade", xPos, tableTop + 7);
    xPos += colWidths.grade;
    doc.text("Status", xPos, tableTop + 7);

    // Data rows
    let rowTop = tableTop + 22;
    const rowHeight = 20;

    for (const exam of data.exams) {
      // Check if we need a new page
      if (rowTop + rowHeight > 700) {
        doc.addPage();
        rowTop = 50;
      }

      doc.rect(50, rowTop, 495, rowHeight).stroke("#cccccc");

      doc.fontSize(8).font("Helvetica").fillColor("#000000");
      xPos = 55;
      doc.text(formatDate(exam.examDate), xPos, rowTop + 6, { width: colWidths.date - 5 });
      xPos += colWidths.date;
      doc.text(exam.examName, xPos, rowTop + 6, { width: colWidths.exam - 5 });
      xPos += colWidths.exam;
      doc.text(exam.subjectName, xPos, rowTop + 6, { width: colWidths.subject - 5 });
      xPos += colWidths.subject;

      // Marks (handle absent)
      const marksText = exam.marksObtained !== null ? exam.marksObtained.toString() : "AB";
      doc.text(marksText, xPos, rowTop + 6, { width: colWidths.marks - 5 });
      xPos += colWidths.marks;

      doc.text(exam.totalMarks.toString(), xPos, rowTop + 6, { width: colWidths.total - 5 });
      xPos += colWidths.total;

      // Grade with color
      const gradeColor = exam.grade === "AB" ? "#666666" : exam.isPassed ? "#22c55e" : "#ef4444";
      doc.font("Helvetica-Bold").fillColor(gradeColor).text(exam.grade, xPos, rowTop + 6, { width: colWidths.grade - 5 });
      xPos += colWidths.grade;

      // Status with color
      const statusText = exam.marksObtained === null ? "Absent" : exam.isPassed ? "Pass" : "Fail";
      const statusColor = exam.marksObtained === null ? "#666666" : exam.isPassed ? "#22c55e" : "#ef4444";
      doc.fillColor(statusColor).text(statusText, xPos, rowTop + 6, { width: colWidths.status - 5 });

      rowTop += rowHeight;
    }

    // Summary section
    doc.y = rowTop + 20;
    if (doc.y > 650) {
      doc.addPage();
      doc.y = 50;
    }

    // Calculate statistics
    const scoredExams = data.exams.filter((e) => e.marksObtained !== null);
    const totalExams = data.exams.length;
    const passedExams = scoredExams.filter((e) => e.isPassed).length;
    const failedExams = scoredExams.filter((e) => !e.isPassed).length;
    const absentExams = data.exams.filter((e) => e.marksObtained === null).length;

    const totalMarksObtained = scoredExams.reduce((sum, e) => sum + (e.marksObtained || 0), 0);
    const totalMaxMarks = scoredExams.reduce((sum, e) => sum + e.totalMarks, 0);
    const overallPercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

    // Summary box
    const summaryTop = doc.y;
    doc.rect(50, summaryTop, 495, 80).fill("#f9fafb").stroke("#cccccc");

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("Performance Summary", 60, summaryTop + 10);

    // Stats in two columns
    doc.fontSize(10).font("Helvetica");

    // Left column
    doc.text(`Total Exams: ${totalExams}`, 60, summaryTop + 32);
    doc.text(`Exams Passed: ${passedExams}`, 60, summaryTop + 48);
    doc.text(`Exams Failed: ${failedExams}`, 60, summaryTop + 64);

    // Right column
    doc.text(`Absent: ${absentExams}`, 280, summaryTop + 32);
    doc.text(`Total Marks: ${totalMarksObtained}/${totalMaxMarks}`, 280, summaryTop + 48);

    // Overall percentage with emphasis
    doc.fontSize(12).font("Helvetica-Bold");
    const percentageColor = overallPercentage >= 60 ? "#22c55e" : overallPercentage >= 33 ? "#f59e0b" : "#ef4444";
    doc.fillColor(percentageColor).text(`Overall: ${overallPercentage}%`, 280, summaryTop + 64);
  }

  // Footer
  doc.y = 720;
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();

  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#666666")
    .text("This is a computer-generated report card and does not require a signature.", 50, doc.y, {
      align: "center",
      width: pageWidth,
    });

  doc.moveDown(0.5);
  doc.text(`Generated on: ${formatDate(new Date())}`, 50, doc.y, {
    align: "center",
    width: pageWidth,
  });

  // Finalize PDF
  doc.end();

  const fileName = `Report_Card_${data.student.name.replace(/\s+/g, "_")}.pdf`;

  return { stream: doc as unknown as Readable, fileName };
}
